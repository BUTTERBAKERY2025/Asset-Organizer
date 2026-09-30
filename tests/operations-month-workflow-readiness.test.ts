import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("pg", () => ({
  default: { Pool: class {
    query = mocks.query;
    on() {}
  } },
}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));

let database: typeof import("../server/db");
beforeAll(async () => {
  // The mocked pool never connects; do not consume or expose real credentials.
  vi.stubEnv("DATABASE_URL", "postgresql://unit:unit@localhost/unit");
  vi.stubEnv("USE_SUPABASE", "false");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try { database = await import("../server/db"); } finally { log.mockRestore(); }
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => { mocks.query.mockReset(); mocks.query.mockResolvedValue({ rows: [] }); });

describe("required monthly workflow schema readiness", () => {
  it("ensures the table and validates required columns before startup", async () => {
    await database.ensureOperationsMonthWorkflowSchema();
    expect(mocks.query.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS operations_month_reviews");
    expect(mocks.query.mock.calls[1][0]).toContain("FROM operations_month_reviews WHERE false");
  });
  it("does not swallow missing-schema failure in legacy best-effort migrations", async () => {
    const failure = Object.assign(new Error("required schema cannot be created"), { code: "42501" });
    mocks.query.mockRejectedValueOnce(failure);
    await expect(database.runStartupMigrations()).rejects.toBe(failure);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("fails readiness explicitly when an existing table lacks required columns", async () => {
    const failure = Object.assign(new Error("required column absent"), { code: "42703" });
    mocks.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(failure);
    await expect(database.ensureOperationsMonthWorkflowSchema()).rejects.toBe(failure);
  });
  it("ensures both expense sources, indexes and new input columns without business records", async () => {
    await database.ensurePnlExpenseSchema();
    const ddl = mocks.query.mock.calls[0][0] as string;
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS pnl_rent_history");
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS pnl_recurring_expenses");
    expect(ddl.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(5);
    expect(ddl.match(/ADD COLUMN IF NOT EXISTS/g)).toHaveLength(7);
    expect(ddl).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
    expect(ddl).not.toContain("2024-01-01");
    expect(mocks.query.mock.calls).toHaveLength(4);
    expect(mocks.query.mock.calls.slice(1).every(call => call[0].includes("WHERE false"))).toBe(true);
  });
  it("propagates expense readiness failure before best-effort startup migrations", async () => {
    const failure = Object.assign(new Error("expense schema unavailable"), { code: "42501" });
    mocks.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(failure);
    await expect(database.runStartupMigrations()).rejects.toBe(failure);
    expect(mocks.query.mock.calls[2][0]).toContain("CREATE TABLE IF NOT EXISTS pnl_rent_history");
  });
  it("external safe migration has the same expense DDL and never backfills rent", async () => {
    await database.ensurePnlExpenseSchema();
    const normalize = (sql: string) => sql.replace(/^--.*$/gm, "").replace(/\b(BEGIN|COMMIT);/g, "")
      .replace(/\s+/g, "").trim();
    const external = readFileSync("migrations/operations_month_expense_readiness.sql", "utf8");
    expect(normalize(external)).toBe(normalize(mocks.query.mock.calls[0][0]));
    expect(external.replace(/^--.*$/gm, "")).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  });
});