/**
 * Offline only: no drizzle config, dotenv, server import, driver, or connection.
 * CLI: node_modules/.bin/tsx scripts/isolated-test/baseline-generate.ts --out /tmp/new-directory
 * Produces SQL; NEVER applies it. The owning launcher must independently verify
 * an explicitly disposable target, then use psql ON_ERROR_STOP. Not db:push.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDrizzleJson, generateMigration, type DrizzleSnapshotJSON } from "drizzle-kit/api";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
export const selectedMigrations = [
  "029_central_kitchen_real_inventory.sql",
  "030_central_kitchen_real_inventory_hardening.sql",
  "031_central_kitchen_recipes.sql",
  "033_central_kitchen_batch_materials.sql",
  "035_central_kitchen_preparation_sources.sql",
  "039_finished_products_operational_sale_gates.sql",
  "043_recipe_exceptions.sql",
  "advanced_production_explicit_execution.sql",
  "044_advanced_request_coverage.sql",
  "049_production_recipe_output_only.sql",
  "050_permission_source_mode.sql",
  "051_job_permission_template_drafts.sql",
  "052_job_permission_template_approvals.sql",
  "053_employee_template_assignments.sql",
  "054_employee_account_additions.sql",
] as const;

export const releaseGuards = [
  { variable: "catalogueColumns", migration: "039", fields: [] as string[] },
  { variable: "recipeExceptionSchema", migration: "043", fields: [
    "exceptions_ready", "column_ready", "trigger_ready", "foreign_key_ready", "unique_index_ready", "state_check_ready",
  ] },
  { variable: "phaseTwoSchema", migration: "044", fields: [
    "table_ready", "provenance_ready", "link_guard", "provenance_guard", "direct_guard",
    "serialized_direct_guard", "branch_guard", "target_guard",
  ] },
] as const;

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

// Isolated-baseline exception, NOT a production repair or application schema edit.
// Proven by fresh PostgreSQL 16 SQLSTATE 42804 for this exact source FK. Preserve
// the FK, but use the referenced identifier's varchar type in the empty test DB.
export function reconcileSnapshot(snapshot: DrizzleSnapshotJSON) {
  const table = snapshot.tables["public.campaign_expenses"];
  const column = table?.columns.branch_id;
  const target = snapshot.tables["public.branches"]?.columns.id;
  const fk = table?.foreignKeys.campaign_expenses_branch_id_branches_id_fk;
  if (column?.type !== "integer" || target?.type !== "varchar" ||
      fk?.tableTo !== "branches" || JSON.stringify(fk.columnsFrom) !== '["branch_id"]' ||
      JSON.stringify(fk.columnsTo) !== '["id"]' || fk.onDelete !== "set null")
    throw new Error("Baseline campaign_expenses branch FK exception no longer matches reviewed source");
  column.type = target.type;
  return [{
    object: "campaign_expenses.branch_id",
    sourceType: "integer", isolatedType: "varchar",
    preservedForeignKey: fk.name,
    reason: "Fresh PostgreSQL 16 rejects integer -> branches.id varchar FK with SQLSTATE 42804",
    scope: "Empty isolated test baseline only; production and shared/schema.ts remain unchanged",
  }];
}

// Lexical splitting only, NOT a PostgreSQL grammar/PLpgSQL parser.
// Keeps dollar bodies and quoted strings intact when stripping outer transactions.
export function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote = "";
  let commentDepth = 0;
  let lineComment = false;
  let dollar = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (commentDepth) {
      if (c === "/" && next === "*") { commentDepth++; i++; }
      else if (c === "*" && next === "/") { commentDepth--; i++; }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = ""; }
      continue;
    }
    if (quote) {
      if (c === quote && next === quote) { i++; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === "-" && next === "-") { lineComment = true; i++; continue; }
    if (c === "/" && next === "*") { commentDepth = 1; i++; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === "$") {
      const match = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/);
      if (match) { dollar = match[0]; i += dollar.length - 1; continue; }
    }
    if (c === ";") { statements.push(sql.slice(start, i + 1)); start = i + 1; }
  }
  if (quote || dollar || commentDepth) throw new Error("Unterminated SQL quote/comment");
  if (sql.slice(start).trim()) statements.push(sql.slice(start));
  return statements;
}

const withoutLeadingComments = (sql: string) => sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, "").trim();

export function migrationBody(sql: string): string {
  return splitSql(sql).filter(statement => {
    const command = withoutLeadingComments(statement);
    if (/^(BEGIN|COMMIT)\s*;$/i.test(command)) return false;
    // No top-level backfills/seeds/deletes. DML inside guard functions is retained.
    if (/^(INSERT|UPDATE|DELETE|COPY|TRUNCATE|CALL|SELECT)\b/i.test(command))
      throw new Error("Selected migration contains top-level data/operational SQL");
    if (!/^(ALTER|CREATE|DROP|DO|SET LOCAL|REVOKE)\b/i.test(command) && command)
      throw new Error(`Unreviewed migration command: ${command.slice(0, 60)}`);
    return Boolean(command);
  }).join("\n").trim();
}

export function extractReleaseQueries(indexSource: string) {
  return releaseGuards.map(guard => {
    const query = indexSource.match(new RegExp(`const ${guard.variable} = await pool\\.query\\(\\x60([\\s\\S]*?)\\x60\\s*\\);`))?.[1]?.trim();
    if (!query || !query.startsWith("SELECT ")) throw new Error(`Missing release gate ${guard.variable}`);
    if (query.includes("${")) throw new Error("Dynamic release query cannot be copied offline");
    if (guard.fields.length) {
      const aliases = [...query.matchAll(/\bAS\s+([a-z_]+)/gi)].map(match => match[1]);
      if (JSON.stringify(aliases) !== JSON.stringify(guard.fields))
        throw new Error(`Release gate ${guard.variable} changed; review baseline coverage`);
      const condition = indexSource.match(new RegExp(`if \\((!${guard.variable}[\\s\\S]*?)\\)\\s*(?:\\{\\s*)?throw new Error\\("${guard.migration === "043" ? "Recipe exception" : "Manual migration 044"}`))?.[1];
      if (!condition || guard.fields.some(field => !condition.includes(`?.${field}`)))
        throw new Error(`Release gate conditions changed for ${guard.variable}`);
    } else if (!indexSource.includes("if (catalogueColumns.rows.length !== 2)")) {
      throw new Error("Catalogue release condition changed");
    }
    return { ...guard, query, sha256: sha256(query) };
  });
}

function releaseAssertions(queries: ReturnType<typeof extractReleaseQueries>) {
  return queries.map(guard => guard.fields.length
    ? `DO $baseline_gate$\nDECLARE readiness record;\nBEGIN\n  SELECT * INTO readiness FROM (${guard.query}) AS gate;\n  IF ${guard.fields.map(field => `readiness.${field} IS DISTINCT FROM TRUE`).join(" OR ")} THEN\n    RAISE EXCEPTION 'Isolated baseline failed release gate ${guard.migration}';\n  END IF;\nEND $baseline_gate$;`
    : `DO $baseline_gate$\nBEGIN\n  IF (SELECT count(*) FROM (${guard.query}) AS gate) <> 2 THEN\n    RAISE EXCEPTION 'Isolated baseline failed release gate 039';\n  END IF;\nEND $baseline_gate$;`).join("\n\n");
}

async function installedVersion(name: string) {
  const entry = require.resolve(name);
  let directory = path.dirname(entry);
  for (;;) {
    try {
      const pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
      if (pkg.name === name) return pkg.version as string;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Cannot locate installed ${name} version`);
    directory = parent;
  }
}

export async function buildBaseline() {
  const lock = JSON.parse(await readFile(path.join(root, "scripts/isolated-test/baseline.sources.json"), "utf8")) as Record<string, string>;
  const sourceHashes: Record<string, string> = {};
  for (const [source, expected] of Object.entries(lock)) {
    const actual = sha256(await readFile(path.join(root, source), "utf8"));
    if (actual !== expected) throw new Error(`Baseline source changed: ${source}; review and update baseline.sources.json explicitly`);
    sourceHashes[source] = actual;
  }
  for (const file of selectedMigrations) {
    if (!lock[`migrations/${file}`]) throw new Error(`Selected migration is not checksum-pinned: ${file}`);
  }
  const versions = Object.fromEntries(await Promise.all(
    ["drizzle-kit", "drizzle-orm", "drizzle-zod"].map(async name => [name, await installedVersion(name)]),
  ));
  const reviewedVersions: Record<string, string> = {
    "drizzle-kit": "0.31.10", "drizzle-orm": "0.45.2", "drizzle-zod": "0.7.1",
  };
  if (Object.entries(reviewedVersions).some(([name, version]) => versions[name] !== version))
    throw new Error("Review generator after Drizzle dependency version change");
  // Verify the only local imports before loading/executing schema code.
  const schema = await import("../../shared/schema");
  const snapshot = generateDrizzleJson(schema);
  const schemaExceptions = reconcileSnapshot(snapshot);
  const empty = generateDrizzleJson({});
  // Snapshot UUIDs are generation noise, not schema identity.
  snapshot.id = "00000000-0000-0000-0000-000000000001";
  snapshot.prevId = empty.id = "00000000-0000-0000-0000-000000000000";
  empty.prevId = empty.id;
  const ddl = (await generateMigration(empty, snapshot)).join("\n");
  if (!ddl.includes('CREATE TABLE "sessions"')) throw new Error("Session table missing from schema generation");
  const supplements: string[] = [];
  for (const file of selectedMigrations)
    supplements.push(`-- Selected supplement: ${file}\n${migrationBody(await readFile(path.join(root, "migrations", file), "utf8"))}`);
  const queries = extractReleaseQueries(await readFile(path.join(root, "server/index.ts"), "utf8"));
  // Drizzle already creates this table but omits the migration's inline CHECK:
  // CREATE TABLE IF NOT EXISTS in 044 does not install it on an existing table.
  const reconciliation = `ALTER TABLE public.advanced_production_request_links
  ADD CONSTRAINT baseline_advanced_request_link_reason CHECK (length(btrim(reason)) BETWEEN 1 AND 500);`;
  const sql = `-- OFFLINE ISOLATED TEST BASELINE. No production migration or data clone.
-- Generated from checksum-pinned Drizzle schema AND selected reviewed supplements.
-- Apply only to a verified disposable, empty public schema, using ON_ERROR_STOP.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $baseline_empty$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f'))
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid AND d.deptype = 'e'))
  THEN RAISE EXCEPTION 'Isolated baseline requires empty public schema'; END IF;
  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'PostgreSQL with built-in gen_random_uuid() is required';
  END IF;
END $baseline_empty$;

-- Drizzle schema (including sessions), then migration-only operational guards.
-- Explicit isolated-only type exception: campaign_expenses.branch_id integer ->
-- varchar, preserving FK to branches.id; source FK otherwise fails SQLSTATE 42804.
${ddl}

${supplements.join("\n\n")}

-- Reconcile migration CHECK omitted by Drizzle's table declaration.
${reconciliation}

-- Same read-only queries as server/index.ts, including hardened 044 guards.
${releaseAssertions(queries)}
COMMIT;
`;
  const statements = splitSql(sql);
  const allMigrations = (await readdir(path.join(root, "migrations"))).filter(file => file.endsWith(".sql")).sort();
  const manifest = {
    formatVersion: 1, purpose: "schema-only isolated-test bootstrap; not a production migration",
    versions, sourceHashes, selectedMigrations, schemaExceptions,
    releaseGuards: queries,
    sessionTable: "public.sessions", drizzleTableCount: Object.keys(snapshot.tables).length,
    sql: { file: "baseline.sql", sha256: sha256(sql), bytes: Buffer.byteLength(sql), lexicalStatementCount: statements.length },
    excludedMigrations: allMigrations.filter(file => !selectedMigrations.includes(file as typeof selectedMigrations[number])),
    reconciliation: ["044 reason CHECK must be installed explicitly because its table exists in Drizzle"],
    limitations: [
      "Offline lexical validation only; no PostgreSQL grammar, PL/pgSQL compilation, application startup or HTTP verification.",
      "Not a reconstruction of production: legacy/manual migration-only objects outside the selected supplements are not guaranteed.",
      "No users, sessions, permissions, branches, recipes or other records are seeded; separate explicit synthetic fixtures are required.",
      "No Supabase auth/storage schemas, roles, RLS policies, extensions or cloud resources are provisioned; migration role revokes are conditional.",
      "Source changes require checksum review; bootstrap is not idempotent and refuses non-empty public schemas.",
      "Application startup has independent database writes and external side effects; this generator does not make startup safe.",
    ],
  };
  return { sql, manifest };
}

export async function writeBaseline(output: string) {
  const baseline = await buildBaseline();
  // Exclusive directory creation prevents overwriting a prior reviewed artifact.
  await mkdir(output, { recursive: false });
  await writeFile(path.join(output, "baseline.sql"), baseline.sql, { flag: "wx" });
  await writeFile(path.join(output, "baseline.manifest.json"), JSON.stringify(baseline.manifest, null, 2) + "\n", { flag: "wx" });
  return baseline.manifest;
}
