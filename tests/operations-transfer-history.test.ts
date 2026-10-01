import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({ queries: [] as any[], transfers: [] as any[], history: [] as any[], writes: 0,
  readiness: [] as any[], schemaError: undefined as any }));
function queryRows(query: any) {
  const compiled = new PgDialect().sqlToQuery(query.where);
  const param = (number: string) => compiled.params[Number(number) - 1];
  if (query.table === "transfer_history") return state.history.filter(row => compiled.params.includes(row.transferId));
  let rows = state.transfers;
  for (const field of ["source_branch_id", "destination_branch_id"]) {
    const clause = compiled.sql.match(new RegExp(`"${field}" in \\(([^)]+)\\)`));
    if (clause) {
      const allowed = [...clause[1].matchAll(/\$(\d+)/g)].map(match => param(match[1]));
      const key = field === "source_branch_id" ? "sourceBranchId" : "destinationBranchId";
      rows = rows.filter(row => allowed.includes(row[key]));
    }
  }
  const branch = compiled.sql.match(/"source_branch_id" = \$(\d+)/);
  if (branch) rows = rows.filter(row => row.sourceBranchId === param(branch[1]) || row.destinationBranchId === param(branch[1]));
  const timestamp = compiled.sql.match(/"requested_at" < \$(\d+)::timestamp/);
  const tieId = compiled.sql.match(/"id" < \$(\d+)/);
  if (timestamp && tieId) rows = rows.filter(row => row.cursorTimestamp < param(timestamp[1]) ||
    (row.cursorTimestamp === param(timestamp[1]) && row.id < Number(param(tieId[1]))));
  return [...rows].sort((a, b) => String(b.cursorTimestamp ?? "").localeCompare(String(a.cursorTimestamp ?? "")) || b.id - a.id)
    .slice(0, query.limit ?? rows.length);
}
vi.mock("../server/db", () => ({ db: {
  execute: async (statement: any) => {
    state.readiness.push(new PgDialect().sqlToQuery(statement));
    if (state.schemaError) throw state.schemaError;
    return { rows: [] };
  },
  select: (selection: any) => ({ from: (table: any) => {
    const query: any = { table: getTableName(table), selection };
    state.queries.push(query);
    const builder: any = {
      innerJoin: () => builder, leftJoin: () => builder,
      where: (condition: any) => { query.where = condition; return builder; },
      orderBy: (...order: any[]) => { query.order = order; return builder; },
      limit: async (limit: number) => { query.limit = limit; return queryRows(query); },
      then: (resolve: any, reject: any) => Promise.resolve(queryRows(query)).then(resolve, reject),
    };
    return builder;
  } }),
  transaction: async () => { state.writes++; throw new Error("unexpected write"); },
} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  getAllowedBranchIds: (req: any) => req.allowed,
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));
import { registerOperationsHrRoutes } from "../server/operations-hr-routes";
const routes: Record<string, Function[]> = {};
registerOperationsHrRoutes({ get: (path: string, ...handlers: Function[]) => { routes[`GET ${path}`] = handlers; },
  post: (path: string, ...handlers: Function[]) => { routes[`POST ${path}`] = handlers; } } as any);

async function call(method: string, body: any = {}, allowed = ["a", "b"], query: any = {}) {
  const req: any = { currentUser: { id: "actor", role: "operations_manager" }, body, allowed, query };
  let status = 200, result: any;
  const headers: Record<string, string> = {};
  const res: any = { status(code: number) { status = code; return this; }, json(data: any) { result = data; return this; },
    set(key: string, value: string) { headers[key] = value; return this; } };
  const handlers = routes[`${method} /api/operations-hr/transfers`];
  const run = async (i: number): Promise<void> => {
    let next: Promise<void> | undefined;
    await handlers[i]?.(req, res, () => { next = run(i + 1); });
    await next;
  };
  await run(0);
  return { status, result, headers };
}

beforeEach(() => { state.queries = []; state.transfers = []; state.history = []; state.writes = 0;
  state.readiness = []; state.schemaError = undefined; });
describe("scoped transfer history actual route", () => {
  it("requires both source and destination SQL scope and reads recorded event actors", async () => {
    state.transfers = [{ id: 10, requestedBy: "requester", sourceBranchId: "a", destinationBranchId: "b" }];
    state.history = [{ id: 2, transferId: 10, eventType: "completed", performedBy: "performer",
      performedByName: "Actual event actor", eventTimestamp: "2026-10-01T10:00:00Z", details: { reason: "Recorded reason" } }];
    const result = await call("GET");
    expect(result.status).toBe(200);
    const query = new PgDialect().sqlToQuery(state.queries[0].where);
    expect(query.sql).toContain('"source_branch_id" in');
    expect(query.sql).toContain('"destination_branch_id" in');
    expect(query.params).toEqual(["a", "b", "a", "b"]);
    expect(state.queries[0].selection).toHaveProperty("employeeNumber");
    expect(state.queries[0].selection).toHaveProperty("jobTitle");
    expect(state.queries[0].selection).toHaveProperty("completedAt");
    expect(state.queries[1].selection).toHaveProperty("performedByName");
    expect(result.result[0].history[0]).toMatchObject({ performedBy: "performer", performedByName: "Actual event actor" });
  });
  it("no scope returns no histories and makes no reads", async () => {
    expect((await call("GET", {}, [])).result).toEqual([]);
    expect(state.queries).toHaveLength(0);
    expect(state.readiness).toHaveLength(0);
  });
  it("filters branch source OR destination in SQL before limiting, without relaxing either endpoint's scope", async () => {
    // More than the old global limit are newer, but do not involve branch a.
    state.transfers = Array.from({ length: 220 }, (_, i) => ({
      id: 1000 + i, sourceBranchId: "b", destinationBranchId: "c", cursorTimestamp: "2026-10-03T10:00:00.123456",
    }));
    state.transfers.push(
      { id: 3, sourceBranchId: "a", destinationBranchId: "outside", cursorTimestamp: "2026-10-04T10:00:00.123456" },
      { id: 2, sourceBranchId: "a", destinationBranchId: "b", employeeNumber: "EMP-2", jobTitle: "Baker",
        completedAt: "2026-10-02T10:00:00Z", cursorTimestamp: "2026-10-02T10:00:00.123456" },
      { id: 1, sourceBranchId: "c", destinationBranchId: "a", cursorTimestamp: "2026-10-01T10:00:00.123456" },
    );
    const result = await call("GET", {}, ["a", "b", "c"], { branchId: "a", limit: "1" });
    expect(result.status).toBe(200);
    expect(result.result.transfers).toEqual([expect.objectContaining({ id: 2, employeeNumber: "EMP-2", jobTitle: "Baker" })]);
    expect(result.result).toMatchObject({ hasMore: true, truncated: true, limit: 1 });
    expect(result.headers["Cache-Control"]).toBe("no-store");
    const compiled = new PgDialect().sqlToQuery(state.queries[0].where);
    expect(compiled.sql).toContain(" or ");
    expect(compiled.params).toEqual(["a", "b", "c", "a", "b", "c", "a", "a"]);
    expect(state.queries[0].limit).toBe(2);
    expect(new PgDialect().sqlToQuery(state.queries[1].where).params).toEqual([2]);
  });
  it("paginates equal timestamps by id and preserves microseconds with no repeats or skips", async () => {
    state.transfers = [5, 4, 3].map(id => ({ id, sourceBranchId: "a", destinationBranchId: "b",
      cursorTimestamp: "2026-10-01T10:00:00.123456" }));
    state.transfers.push({ id: 2, sourceBranchId: "a", destinationBranchId: "b",
      cursorTimestamp: "2026-10-01T10:00:00.123455" });
    const first = await call("GET", {}, ["a", "b"], { limit: "2" });
    expect(first.result.transfers.map((row: any) => row.id)).toEqual([5, 4]);
    expect(first.result.transfers[0]).not.toHaveProperty("cursorTimestamp");
    expect(JSON.parse(Buffer.from(first.result.nextCursor, "base64url").toString())).toEqual({
      at: "2026-10-01T10:00:00.123456", id: 4, branchId: null,
    });
    const order = state.queries[0].order.map((value: any) => new PgDialect().sqlToQuery(value).sql);
    expect(order).toEqual(['"employee_transfer_requests"."requested_at" desc', '"employee_transfer_requests"."id" desc']);
    const second = await call("GET", {}, ["a", "b"], { limit: "2", cursor: first.result.nextCursor });
    expect(second.result.transfers.map((row: any) => row.id)).toEqual([3, 2]);
    expect(second.result).toMatchObject({ hasMore: false, truncated: false, nextCursor: null });
  });
  it.each([
    [{ branchId: ["a", "b"] }, 400], [{ branchId: "" }, 400], [{ branchId: "outside" }, 403],
    [{ branchId: "main_warehouse" }, 403], [{ limit: "0" }, 400], [{ limit: "201" }, 400],
    [{ limit: ["2"] }, 400], [{ limit: "1.5" }, 400], [{ cursor: "bad_cursor" }, 400],
  ])("rejects malformed or unauthorized queries before reads: %j", async (query, status) => {
    expect((await call("GET", {}, ["a", "b", "main_warehouse"], query)).status).toBe(status);
    expect(state.queries).toHaveLength(0);
    expect(state.readiness).toHaveLength(0);
  });
  it.each([
    { at: "2026-02-30T10:00:00.123456", id: 1, branchId: null },
    { at: "0000-01-01T10:00:00.123456", id: 1, branchId: null },
    { at: "2026-10-01T10:00:00.123456", id: 2_147_483_648, branchId: null },
    { at: "2026-10-01T10:00:00.123456", id: 1.5, branchId: null },
    { at: "2026-10-01T10:00:00.123456", id: 1, branchId: "a" },
  ])("rejects decoded invalid cursor %j before database access", async cursor => {
    const encoded = Buffer.from(JSON.stringify(cursor)).toString("base64url");
    expect((await call("GET", {}, ["a", "b"], { cursor: encoded })).status).toBe(400);
    expect(state.queries).toHaveLength(0);
    expect(state.readiness).toHaveLength(0);
  });
  it("revalidates scope on every cursor page and rejects a cursor for another branch filter", async () => {
    state.transfers = [3, 2, 1].map(id => ({ id, sourceBranchId: "a", destinationBranchId: "b",
      cursorTimestamp: "2026-10-01T10:00:00.123456" }));
    const first = await call("GET", {}, ["a", "b"], { branchId: "a", limit: "1" });
    expect((await call("GET", {}, ["a", "b"], { branchId: "b", cursor: first.result.nextCursor })).status).toBe(400);
    const revoked = await call("GET", {}, ["a"], { branchId: "a", cursor: first.result.nextCursor });
    expect(revoked.result.transfers).toEqual([]);
    expect(revoked.result).toMatchObject({ nextCursor: null, hasMore: false });
  });
  it("keeps empty and legacy response shapes, with explicit truncation metadata", async () => {
    expect((await call("GET", {}, ["a", "b"], { limit: "2" })).result)
      .toEqual({ transfers: [], nextCursor: null, hasMore: false, truncated: false, limit: 2 });
    state.transfers = Array.from({ length: 201 }, (_, i) => ({
      id: i + 1, sourceBranchId: "a", destinationBranchId: "b", cursorTimestamp: "2026-10-01T10:00:00.123456",
    }));
    const legacy = await call("GET");
    expect(legacy.result).toHaveLength(200);
    expect(legacy.headers["X-Transfers-Truncated"]).toBe("true");
  });
  it("fails clearly for a missing transfer schema using only a read-only probe", async () => {
    state.schemaError = { cause: { code: "42P01" } };
    const response = await call("GET", {}, ["a", "b"], { limit: "2" });
    expect(response.status).toBe(503);
    expect(response.result.code).toBe("TRANSFER_SCHEMA_NOT_READY");
    expect(state.queries).toHaveLength(0);
    expect(state.readiness[0].sql).toContain("WHERE false");
    expect(state.readiness[0].sql).not.toMatch(/\b(CREATE|ALTER|INSERT|UPDATE|DELETE)\b/);
    expect(state.writes).toBe(0);
  });
  it("denies unauthorized source, destination and HQ before writes", async () => {
    const base = { employeeId: 1, sourceBranchId: "a", destinationBranchId: "b", reason: "transfer" };
    expect((await call("POST", base, ["a"])).status).toBe(403);
    expect((await call("POST", base, ["b"])).status).toBe(403);
    expect((await call("POST", { ...base, destinationBranchId: "main_warehouse" })).status).toBe(403);
    expect(state.writes).toBe(0);
  });
});