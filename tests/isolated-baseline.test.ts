import { beforeAll, describe, expect, it } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateDrizzleJson } from "drizzle-kit/api";
import * as schema from "../shared/schema";
import {
  buildBaseline, extractReleaseQueries, migrationBody, releaseGuards,
  selectedMigrations, sha256, splitSql, writeBaseline, reconcileSnapshot,
} from "../scripts/isolated-test/baseline";

let baseline: Awaited<ReturnType<typeof buildBaseline>>;
beforeAll(async () => { baseline = await buildBaseline(); }, 120000);

describe("offline isolated schema baseline (no database connection)", () => {
  it("is byte-deterministic and carries reviewed source/dependency checksums", async () => {
    const again = await buildBaseline();
    expect(again).toEqual(baseline);
    expect(baseline.manifest.sql.sha256).toBe(sha256(baseline.sql));
    expect(baseline.manifest.sql.bytes).toBe(Buffer.byteLength(baseline.sql));
    const lock = JSON.parse(await readFile("scripts/isolated-test/baseline.sources.json", "utf8"));
    expect(baseline.manifest.sourceHashes).toEqual(lock);
    expect(Object.keys(lock)).toHaveLength(selectedMigrations.length + 2);
    expect(baseline.manifest.versions).toEqual({
      "drizzle-kit": "0.31.10", "drizzle-orm": "0.45.2", "drizzle-zod": "0.7.1",
    });
  });

  it("creates the full Drizzle table set, users/auth tables, and sessions without records", () => {
    const tables = [...baseline.sql.matchAll(/^CREATE TABLE "([^"]+)"/gm)].map(match => match[1]);
    expect(tables.length).toBe(baseline.manifest.drizzleTableCount);
    expect(tables).toEqual(expect.arrayContaining([
      "sessions", "users", "branches", "user_permissions", "user_assignments",
      "daily_production_batches", "advanced_production_request_links",
    ]));
    expect(baseline.sql).toContain('CREATE INDEX "IDX_session_expire"');
    const sessions = baseline.sql.match(/CREATE TABLE "sessions" \([\s\S]*?\n\);/)?.[0];
    expect(sessions).toContain('"sid" varchar PRIMARY KEY NOT NULL');
    expect(sessions).toContain('"sess" jsonb NOT NULL');
    expect(sessions).toContain('"expire" timestamp NOT NULL');
    const topLevel = splitSql(baseline.sql).map(command =>
      command.replace(/^(?:\s+|--[^\n]*(?:\n|$))*/, ""),
    );
    expect(topLevel.some(command => /^(INSERT|UPDATE|DELETE|COPY|TRUNCATE)\b/.test(command))).toBe(false);
    expect(topLevel.filter(command => /^BEGIN;/.test(command))).toHaveLength(1);
    expect(topLevel.filter(command => /^COMMIT;/.test(command))).toHaveLength(1);
    expect(baseline.sql).toContain("Isolated baseline requires empty public schema");
  });

  it("records the isolated-only incompatible FK correction and fails closed on source drift", () => {
    const snapshot = generateDrizzleJson(schema);
    expect(snapshot.tables["public.campaign_expenses"].columns.branch_id.type).toBe("integer");
    expect(reconcileSnapshot(snapshot)).toEqual(baseline.manifest.schemaExceptions);
    expect(snapshot.tables["public.campaign_expenses"].columns.branch_id.type).toBe("varchar");
    expect(snapshot.tables["public.campaign_expenses"].foreignKeys.campaign_expenses_branch_id_branches_id_fk.tableTo).toBe("branches");
    expect(() => reconcileSnapshot(snapshot)).toThrow("no longer matches reviewed source");
    expect(baseline.sql.match(/CREATE TABLE "campaign_expenses" \([\s\S]*?\n\);/)?.[0])
      .toContain('"branch_id" varchar');
  });

  it("installs selected migration-only triggers/functions rather than claiming schema is sufficient", async () => {
    for (const name of selectedMigrations) {
      const source = await readFile(`migrations/${name}`, "utf8");
      expect(baseline.sql).toContain(`-- Selected supplement: ${name}`);
      expect(baseline.sql).toContain(migrationBody(source));
      for (const trigger of source.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER\s+([a-z_]+)/g))
        expect(baseline.sql).toContain(trigger[0]);
    }
    expect(baseline.sql).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(baseline.sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(baseline.sql).toContain("REVOKE ALL ON FUNCTION");
    expect(baseline.sql).toContain("baseline_advanced_request_link_reason CHECK (length(btrim(reason)) BETWEEN 1 AND 500)");
    expect(baseline.manifest.limitations.join("\n")).toContain("Not a reconstruction of production");
    expect(baseline.manifest.excludedMigrations).toContain("update_full_schema.sql");
  });

  it("covers the real 039/043/044 readiness queries including hardened 044 function bodies", async () => {
    const index = await readFile("server/index.ts", "utf8");
    const queries = extractReleaseQueries(index);
    expect(baseline.manifest.releaseGuards).toEqual(queries);
    expect(queries.map(guard => guard.migration)).toEqual(["039", "043", "044"]);
    for (const gate of queries) {
      expect(baseline.sql).toContain(gate.query);
      for (const field of gate.fields)
        expect(baseline.sql).toContain(`readiness.${field} IS DISTINCT FROM TRUE`);
    }
    for (const required of [
      "trg_linked_recipe_exception", "fk_daily_production_recipe_exception",
      "uq_daily_production_recipe_exception", "guard_advanced_request_link",
      "guard_advanced_batch_request_provenance", "guard_request_direct_coverage",
      "FOR NO KEY UPDATE", "NEW.request_branch_id IS DISTINCT FROM OLD.request_branch_id",
      "NEW.target_branch_id IS DISTINCT FROM OLD.target_branch_id",
    ]) expect(baseline.sql).toContain(required);
    expect(releaseGuards[2].fields).toContain("serialized_direct_guard");
    expect(() => extractReleaseQueries(index.replace("AS serialized_direct_guard", "AS weak_guard")))
      .toThrow("changed");
    expect(() => extractReleaseQueries(index.replace("?.branch_guard", "?.unknown_guard")))
      .toThrow("conditions changed");
  });

  it("lexically preserves procedural semicolons and refuses unreviewed top-level operations", () => {
    const functionSql = "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $body$ BEGIN PERFORM 'x;y'; END $body$;";
    expect(splitSql(functionSql)).toHaveLength(1);
    expect(splitSql("-- a;b\nSELECT 'it''s;ok'; /* nested /* ; */ ; */ SELECT \"a;b\";")).toHaveLength(2);
    expect(() => splitSql("DO $$ BEGIN;")).toThrow("Unterminated");
    expect(migrationBody(`-- header\nBEGIN;\n${functionSql}\nCOMMIT;`)).toBe(functionSql);
    expect(() => migrationBody("BEGIN; INSERT INTO users VALUES ('real'); COMMIT;"))
      .toThrow("top-level data");
    expect(() => migrationBody("CREATE EXTENSION x; GRANT ALL ON users TO PUBLIC;"))
      .toThrow("Unreviewed");
  });

  it("writes manifest+SQL only to a new directory and refuses overwrite", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "isolated-baseline-test-"));
    const output = path.join(parent, "bundle");
    try {
      const manifest = await writeBaseline(output);
      const sql = await readFile(path.join(output, "baseline.sql"), "utf8");
      expect(sha256(sql)).toBe(manifest.sql.sha256);
      expect(JSON.parse(await readFile(path.join(output, "baseline.manifest.json"), "utf8"))).toEqual(manifest);
      await expect(writeBaseline(output)).rejects.toMatchObject({ code: "EEXIST" });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("does not import application/connection code or read environment secrets", async () => {
    const tool = await readFile("scripts/isolated-test/baseline.ts", "utf8");
    expect(tool).not.toMatch(/process\.env|["']dotenv(?:\/[^"']*)?["']|dbCredentials|pushSchema|from ["']pg["']|fetch\(/);
    expect(tool).not.toMatch(/(?:from\s*|import\s*\(\s*)["'][^"']*server\//);
    const schema = await readFile("shared/schema.ts", "utf8");
    const quantity = await readFile("shared/material-quantity.ts", "utf8");
    expect(schema).not.toMatch(/process\.env|["']dotenv(?:\/[^"']*)?["']|(?:from\s*|import\s*\(\s*)["'][^"']*server\//);
    expect(quantity).not.toMatch(/process\.env|["']dotenv(?:\/[^"']*)?["']|(?:from\s*|import\s*\(\s*)["'][^"']*server\//);
    const localImports = [...schema.matchAll(/from ["'](\.[^"']+)["']/g)].map(match => match[1]);
    expect(localImports).toEqual(["./material-quantity"]);
  });
});