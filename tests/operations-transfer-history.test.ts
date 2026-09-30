import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({ queries: [] as any[], transfers: [] as any[], history: [] as any[], writes: 0 }));
vi.mock("../server/db", () => ({ db: {
  select: (selection: any) => ({ from: (table: any) => {
    const query: any = { table: getTableName(table), selection };
    state.queries.push(query);
    const values = query.table === "transfer_history" ? state.history : state.transfers;
    const builder: any = {
      innerJoin: () => builder, leftJoin: () => builder,
      where: (condition: any) => { query.where = condition; return builder; },
      orderBy: () => builder, limit: async () => values,
      then: (resolve: any, reject: any) => Promise.resolve(values).then(resolve, reject),
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

async function call(method: string, body: any = {}, allowed = ["a", "b"]) {
  const req: any = { currentUser: { id: "actor", role: "operations_manager" }, body, allowed };
  let status = 200, result: any;
  const res: any = { status(code: number) { status = code; return this; }, json(data: any) { result = data; return this; }, set() { return this; } };
  const handlers = routes[`${method} /api/operations-hr/transfers`];
  const run = async (i: number): Promise<void> => {
    let next: Promise<void> | undefined;
    await handlers[i]?.(req, res, () => { next = run(i + 1); });
    await next;
  };
  await run(0);
  return { status, result };
}

beforeEach(() => { state.queries = []; state.transfers = []; state.history = []; state.writes = 0; });
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
    expect(state.queries[1].selection).toHaveProperty("performedByName");
    expect(result.result[0].history[0]).toMatchObject({ performedBy: "performer", performedByName: "Actual event actor" });
  });
  it("no scope returns no histories and makes no reads", async () => {
    expect((await call("GET", {}, [])).result).toEqual([]);
    expect(state.queries).toHaveLength(0);
  });
  it("denies unauthorized source, destination and HQ before writes", async () => {
    const base = { employeeId: 1, sourceBranchId: "a", destinationBranchId: "b", reason: "transfer" };
    expect((await call("POST", base, ["a"])).status).toBe(403);
    expect((await call("POST", base, ["b"])).status).toBe(403);
    expect((await call("POST", { ...base, destinationBranchId: "main_warehouse" })).status).toBe(403);
    expect(state.writes).toBe(0);
  });
});