import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { jobOffers, jobOfferTokens, jobOfferAuditLog, onboardingNotifications, onboardingTokens } from "../shared/schema";
import { ensureOperationsJoiningSchema, OPERATIONS_JOINING_SCHEMA_SQL } from "../server/operations-joining-schema";

const types: Record<string, string> = {
  serial: "int4", integer: "int4", varchar: "varchar", text: "text", timestamp: "timestamp",
  boolean: "bool", "double precision": "float8", jsonb: "jsonb",
};
const tables = [jobOffers, jobOfferTokens, jobOfferAuditLog, onboardingNotifications, onboardingTokens];
const query = vi.fn();
const release = vi.fn();
const pool: any = { connect: async () => ({ query, release }) };
vi.mock("pg", () => ({
  default: { Pool: class {
    on() {}
    query = vi.fn(async () => ({ rows: [] }));
    connect = async () => ({ query, release });
  } },
}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));
let columns: any[];
beforeEach(() => {
  columns = tables.flatMap(table => Object.values(getTableColumns(table)).map(column => ({
    table_name: getTableName(table), column_name: column.name,
    udt_name: types[column.getSQLType()], is_nullable: column.notNull ? "NO" : "YES",
  })));
  query.mockReset(); release.mockReset();
  query.mockImplementation(async (sql: string) => ({ rows: sql.includes("information_schema.columns") ? columns : [] }));
});

describe("safe operations joining source readiness", () => {
  it("creates current source tables/tokens/audit atomically without changing business rows", async () => {
    await ensureOperationsJoiningSchema(pool);
    expect(query.mock.calls[0][0]).toBe("BEGIN");
    expect(query.mock.calls.some(([sql]) => sql === OPERATIONS_JOINING_SCHEMA_SQL)).toBe(true);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(OPERATIONS_JOINING_SCHEMA_SQL).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER)\b/im);
    expect(OPERATIONS_JOINING_SCHEMA_SQL).toContain("hired_employee_id VARCHAR REFERENCES users(id)");
    expect(OPERATIONS_JOINING_SCHEMA_SQL).toContain("converted_branch_employee_id INTEGER REFERENCES branch_employees(id)");
    for (const table of tables) {
      const name = getTableName(table);
      expect(OPERATIONS_JOINING_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${name}`);
      const body = OPERATIONS_JOINING_SCHEMA_SQL.split(`CREATE TABLE IF NOT EXISTS ${name} (`)[1].split("\n);")[0];
      for (const column of Object.values(getTableColumns(table))) expect(body).toMatch(new RegExp(`\\b${column.name}\\b`));
    }
    expect(release).toHaveBeenCalledTimes(1);
  });
  it("rejects old integer hired employee identifiers without casting historical values", async () => {
    columns.find(column => column.table_name === "job_offers" && column.column_name === "hired_employee_id").udt_name = "int4";
    await expect(ensureOperationsJoiningSchema(pool)).rejects.toThrow("job_offers.hired_employee_id requires varchar");
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
  });
  it("fails explicitly for missing current columns or weakened required fields", async () => {
    columns = columns.filter(column => !(column.table_name === "onboarding_notifications" && column.column_name === "converted_branch_employee_id"));
    await expect(ensureOperationsJoiningSchema(pool)).rejects.toThrow("converted_branch_employee_id");
    columns.push({ table_name: "onboarding_notifications", column_name: "converted_branch_employee_id", udt_name: "int4", is_nullable: "YES" });
    columns.find(column => column.table_name === "job_offers" && column.column_name === "candidate_name").is_nullable = "YES";
    await expect(ensureOperationsJoiningSchema(pool)).rejects.toThrow("candidate_name requires text NOT NULL");
  });
  it("DDL failures roll back and release with actionable startup diagnostic", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql === OPERATIONS_JOINING_SCHEMA_SQL) throw new Error("DDL permission denied");
      return { rows: [] };
    });
    await expect(ensureOperationsJoiningSchema(pool)).rejects.toThrow("Operations joining schema is not ready");
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(release).toHaveBeenCalledTimes(1);
  });
  it("startup propagates joining schema incompatibility before the legacy best-effort migration block", async () => {
    columns.find(column => column.table_name === "job_offers" && column.column_name === "hired_employee_id").udt_name = "int4";
    vi.stubEnv("DATABASE_URL", "postgresql://unit:unit@localhost/unit");
    vi.stubEnv("USE_SUPABASE", "false");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const database = await import("../server/db");
      await expect(database.runStartupMigrations()).rejects.toThrow("job_offers.hired_employee_id requires varchar");
      expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    } finally {
      log.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("standalone migration shares exact safe DDL and checks identifiers before commit", () => {
    const migration = readFileSync("migrations/operations_joining_readiness.sql", "utf8");
    const ddl = migration.slice(migration.indexOf("CREATE TABLE"), migration.indexOf("-- Check key"));
    const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();
    expect(normalize(ddl)).toBe(normalize(OPERATIONS_JOINING_SCHEMA_SQL));
    expect(migration.replace(/^--.*$/gm, "")).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER)\b/im);
    expect(migration.indexOf("RAISE EXCEPTION")).toBeLessThan(migration.lastIndexOf("COMMIT"));
    expect(readFileSync("server/db.ts", "utf8")).toContain("await ensureOperationsJoiningSchema(pool)");
  });
});