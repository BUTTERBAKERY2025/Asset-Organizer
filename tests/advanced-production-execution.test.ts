import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { canonicalManualProductionPayload } from "../shared/manual-production-operation";
import { getManualProductionReservedField, isOperationallyLinkedProductionBatch } from "../shared/manual-production-entry";

const state = vi.hoisted(() => ({
  queue: [] as any[][], queries: [] as any[], inserted: null as any,
  snapshot: vi.fn(), post: vi.fn(), access: true, tx: null as any, checkedBranches: [] as string[],
  linkError: null as Error | null,
}));
vi.mock("../server/db", () => ({ db: {
  select: () => state.tx.select(),
  execute: (...args: any[]) => state.tx.execute(...args),
  transaction: async (fn: any) => {
    const prior = state.inserted;
    try { return await fn(state.tx); } catch (error) { state.inserted = prior; throw error; }
  },
} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  isUserAdmin: () => false,
  canAccessBranch: async (_req: any, branch: string) => {
    state.checkedBranches.push(branch);
    return state.access && branch === "kitchen";
  },
}));
vi.mock("../server/central-kitchen-batch-materials", () => ({
  snapshotRecipeBackedBatchMaterials: (...args: any[]) => state.snapshot(...args),
  CentralKitchenBatchMaterialsError: class extends Error { status = 409; },
}));
vi.mock("../server/production-stock-posting", () => ({
  postProductionBatchToStock: (...args: any[]) => state.post(...args),
  ProductionStockPostingError: class extends Error { status = 409; },
}));
import { registerAdvancedProductionExecutionRoutes } from "../server/advanced-production-execution";

const routes: Record<string, any> = {};
registerAdvancedProductionExecutionRoutes({
  get: (path: string, ...handlers: any[]) => { routes[`GET ${path}`] = handlers.at(-1); },
  put: (path: string, ...handlers: any[]) => { routes[`PUT ${path}`] = handlers.at(-1); },
  delete: (path: string, ...handlers: any[]) => { routes[`DELETE ${path}`] = handlers.at(-1); },
  post: (path: string, ...handlers: any[]) => { routes[path] = handlers.at(-1); },
} as any);
const base = "/api/advanced-production-orders/:orderId/items/:itemId/batches";
const order = { id: 7, status: "approved", sourceBranchId: "kitchen", targetBranchId: "branch", startDate: "2026-01-01", endDate: "2026-01-31" };
const item = { id: 9, orderId: 7, productId: 11, targetQuantity: 10, status: "pending", executionUnit: null };
const product = { id: 11, name: "منتج", category: "bread", isActive: "true", productType: "finish", unit: "قطعة" };
const body = { quantity: 4, unit: "قطعة", productionDate: "2026-01-02", destination: "display_bar" };
const requestItem = { id: 31, orderId: 30, productId: 11, warehouseItemId: null, unit: "قطعة", requestedQuantity: 10, preparedQuantity: null, substituteQuantity: null };
const requestOrder = { id: 30, centralKitchenId: "kitchen", requestBranchId: "branch", inventoryMode: "real", status: "approved", neededDate: "2026-02-01" };
const linkPath = "/api/advanced-production-orders/:orderId/items/:itemId/request-link";
async function linkRequest(input: any = { requestItemId: 31, reason: "طلب الفرع المعتمد" }) {
  const req = { body: input, params: { orderId: "7", itemId: "9" }, currentUser: { id: "actor" } };
  const res = { statusCode: 200, body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; } };
  await routes[`PUT ${linkPath}`](req, res);
  return res;
}
const fingerprint = createHash("sha256").update(canonicalManualProductionPayload({ orderId: 7, itemId: 9, ...body })).digest("hex");
async function request(input = body, action?: string) {
  const req = {
    body: input, params: { orderId: "7", itemId: "9", batchId: "20", action },
    currentUser: { id: "actor" }, get: () => "advanced-test-key",
  };
  const res = { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; } };
  await routes[action ? `${base}/:batchId/:action` : base](req, res);
  return res;
}
beforeEach(() => {
  state.queue = []; state.queries = []; state.inserted = null; state.access = true; state.checkedBranches = [];
  state.snapshot.mockReset(); state.post.mockReset(); state.linkError = null;
  state.tx = {
    execute: async (query: any) => { state.queries.push(query); return { rows: [] }; },
    select: () => {
      const value = state.queue.shift() || [];
      const chain: any = {
        from: () => chain, where: () => chain, for: () => Promise.resolve(value), limit: () => Promise.resolve(value),
        then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject),
      };
      return chain;
    },
    update: () => ({ set: (values: any) => ({ where: () => ({
      returning: async () => [{ id: 20, ...values }],
    }) }) }),
    delete: () => ({ where: async () => { state.inserted = null; } }),
    insert: () => ({ values: (values: any) => ({ returning: async () => {
      if (state.linkError) throw state.linkError;
      state.inserted = { id: 20, ...values }; return [state.inserted];
    } }) }),
  };
});

describe("prospective advanced request link", () => {
  it("keeps demand serialization and direct/advanced sums in migration, not just application reads", () => {
    const migration = readFileSync(new URL("../migrations/044_advanced_request_coverage.sql", import.meta.url), "utf8");
    expect(migration).toContain("WHERE id = p_request_item FOR NO KEY UPDATE");
    expect(migration).toContain("sum(i.target_quantity)");
    expect(migration).toContain("sum(b.quantity)");
    expect(migration).toContain("b.status IN ('in_progress','finished')");
    expect(migration).toContain("AFTER INSERT OR UPDATE ON daily_production_batches");
    expect(migration).toContain("status IN ('in_progress','finished')");
    expect(migration).toContain("NEW.request_branch_id IS DISTINCT FROM OLD.request_branch_id");
    expect(migration).toContain("NEW.target_branch_id IS DISTINCT FROM OLD.target_branch_id");
    expect(migration).toContain("p.source_branch_id IS DISTINCT FROM request.central_kitchen_id");
    expect(migration).toContain("p.target_branch_id IS DISTINCT FROM request.request_branch_id");
    expect(migration).toContain("i.execution_unit IS DISTINCT FROM demand.unit");
    expect(migration).not.toMatch(/UPDATE finished_goods_inventory|INSERT INTO finished_goods_inventory/i);
  });
  it("authorizes plan kitchen before disclosing request or replay", async () => {
    state.access = false; state.queue = [[order]];
    expect((await linkRequest()).statusCode).toBe(403);
    expect(state.checkedBranches).toEqual(["kitchen"]);
  });
  it("rejects a mismatched unit/date/identity before persisting", async () => {
    state.queue = [[order], [item], [{ ...requestItem, unit: "كيلو" }], [requestOrder], [], [product]];
    expect((await linkRequest()).statusCode).toBe(409);
    expect(state.inserted).toBeNull();
  });
  it("replays the same persisted reason without writing and conflicts on a changed reason", async () => {
    const existing = { planItemId: 9, requestItemId: 31, reason: "طلب الفرع المعتمد" };
    state.queue = [[order], [item], [requestItem], [requestOrder], [existing]];
    expect((await linkRequest()).statusCode).toBe(200);
    expect(state.inserted).toBeNull();
    state.queue = [[order], [item], [requestItem], [requestOrder], [existing]];
    expect((await linkRequest({ requestItemId: 31, reason: "سبب جديد" })).statusCode).toBe(409);
  });
  it("translates concurrent overcoverage rejected by the locked database guard", async () => {
    state.queue = [[order], [item], [requestItem], [requestOrder], [], [product], []];
    state.linkError = Object.assign(new Error("Linked and direct production exceed request quantity"), { code: "23514" });
    expect((await linkRequest()).statusCode).toBe(409);
    expect(state.inserted).toBeNull();
  });
  it("scopes candidate search to the authorized plan kitchen before database search", async () => {
    state.access = false;
    state.queue = [[order]];
    const res = { statusCode: 200, status(code: number) { this.statusCode = code; return this; },
      json(_value: any) { return this; }, set() { return this; } };
    await routes[`GET ${linkPath}/candidates`]({ params: { orderId: "7", itemId: "9" }, query: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(state.checkedBranches).toEqual(["kitchen"]);
  });
  it("returns a bounded candidate page with explicit truncation and available quantity", async () => {
    state.queue = [[order], [item], [product], []];
    state.tx.execute = async (query: any) => {
      state.queries.push(query);
      return { rows: [
        { requestItemId: 31, requestOrderId: 30, productId: 11, unit: "قطعة", requestedQuantity: "15", availableQuantity: "11", alreadyLinked: false },
        { requestItemId: 32, requestOrderId: 33, productId: 11, unit: "قطعة", requestedQuantity: "20", availableQuantity: "20", alreadyLinked: false },
      ] };
    };
    const res = { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; },
      json(value: any) { this.body = value; return this; }, set() { return this; } };
    await routes[`GET ${linkPath}/candidates`]({
      params: { orderId: "7", itemId: "9" }, query: { limit: "1", offset: "0" },
    }, res);
    expect(res.body).toMatchObject({ limit: 1, offset: 0, truncated: true, nextOffset: 1 });
    expect(res.body.candidates).toEqual([expect.objectContaining({ requestItemId: 31, availableQuantity: 11 })]);
  });
  it("allows unlink after cancelled-only execution subject to database guard, then repeats safely", async () => {
    const req = { params: { orderId: "7", itemId: "9" } };
    const response = () => ({ statusCode: 200, status(code: number) { this.statusCode = code; return this; },
      end() { return this; }, json(_value: any) { return this; } });
    state.queue = [[order], [item], [{ planItemId: 9, requestItemId: 31 }], [requestItem], [requestOrder]];
    const first = response();
    await routes[`DELETE ${linkPath}`](req, first);
    expect(first.statusCode).toBe(204);
    state.queue = [[order], [item], []];
    const second = response();
    await routes[`DELETE ${linkPath}`](req, second);
    expect(second.statusCode).toBe(204);
  });
});

describe("advanced explicit execution without database access", () => {
  it("accepts an operationally enabled final product that is not sale-active", async () => {
    state.queue = [[order], [item], [], [{ ...product, isActive: "false", operationsEnabled: true }], [{ quantity: 0 }], [], [{ id: 20, recipeBacked: true }]];
    expect((await request()).statusCode).toBe(201);
  });
  it("rejects operationally disabled or raw products without creating a batch", async () => {
    for (const invalid of [
      { ...product, isActive: "false", operationsEnabled: false },
      { ...product, productType: "inventory" },
    ]) {
      state.queue = [[order], [item], [], [invalid]];
      expect((await request()).statusCode).toBe(409);
      expect(state.inserted).toBeNull();
    }
  });
  it("creates only a linked recipe-backed in-progress batch and snapshots in the same transaction", async () => {
    state.queue = [[order], [item], [], [product], [{ quantity: 0 }], [], [{ id: 20, recipeBacked: true }]];
    const res = await request();
    expect(res.statusCode).toBe(201);
    expect(state.inserted).toMatchObject({ advancedProductionOrderItemId: 9, productionOrderId: 7, recipeBacked: false, status: "in_progress", advancedPayloadFingerprint: fingerprint });
    expect(res.body.batch.recipeBacked).toBe(true); // Return reread state after snapshot helper promotion.
    expect(state.snapshot).toHaveBeenCalledWith(state.tx, expect.objectContaining({ batchId: 20, kitchenId: "kitchen", batchQuantity: 4 }));
    expect(state.post).not.toHaveBeenCalled();
    expect(state.queries.length).toBe(2);
    expect(state.checkedBranches).toEqual(["kitchen"]); // Producer needs no unrelated destination permission.
  });
  it("freezes the request reference on an actually executed linked batch", async () => {
    state.queue = [[order], [item], [], [product], [{ quantity: 0 }],
      [{ planItemId: 9, requestItemId: 31 }], [{ id: 20, recipeBacked: true }]];
    expect((await request()).statusCode).toBe(201);
    expect(state.inserted).toMatchObject({ advancedRequestItemId: 31, advancedProductionOrderItemId: 9 });
  });
  it("replays the same actor key without a second snapshot or credit", async () => {
    state.queue = [[order], [item], [{ id: 20, advancedPayloadFingerprint: fingerprint }]];
    const res = await request();
    expect(res.body.replayed).toBe(true);
    expect(state.inserted).toBeNull();
    expect(state.snapshot).not.toHaveBeenCalled();
  });
  it("rejects key reuse with changed payload", async () => {
    state.queue = [[order], [item], [{ id: 20, advancedPayloadFingerprint: "different" }]];
    expect((await request()).statusCode).toBe(409);
  });
  it("rechecks branch authorization before idempotent replay", async () => {
    state.access = false; state.queue = [[order]];
    expect((await request()).statusCode).toBe(403);
  });
  it("caps total active batches instead of individual batch quantity", async () => {
    state.queue = [[order], [item], [], [product], [{ quantity: 7 }]];
    expect((await request()).statusCode).toBe(409);
    expect(state.inserted).toBeNull();
  });
  it.each(["draft", "pending", "completed", "cancelled"])("rejects new execution for %s plans", async status => {
    state.queue = [[{ ...order, status }], [item], []];
    expect((await request()).statusCode).toBe(409);
  });
  it("rejects a unit mismatch", async () => {
    state.queue = [[order], [item], [], [product]];
    expect((await request({ ...body, unit: "كيلو" })).statusCode).toBe(409);
  });
  it("rejects fractional quantity and impossible dates before transaction work", async () => {
    expect((await request({ ...body, quantity: 0.5 })).statusCode).toBe(400);
    expect((await request({ ...body, productionDate: "2026-02-30" })).statusCode).toBe(400);
    expect(state.queries).toHaveLength(0);
  });
  it("rolls back creation on recipe snapshot failure without manual fallback", async () => {
    const { CentralKitchenBatchMaterialsError } = await import("../server/central-kitchen-batch-materials");
    state.snapshot.mockRejectedValue(new CentralKitchenBatchMaterialsError("No approved recipe", 409));
    state.queue = [[order], [item], [], [product], [{ quantity: 0 }]];
    expect((await request()).statusCode).toBe(409);
    expect(state.inserted).toBeNull();
  });
  it("rejects and rolls back a snapshot helper that does not promote the persisted recipe flag", async () => {
    state.queue = [[order], [item], [], [product], [{ quantity: 0 }], [], [{ id: 20, recipeBacked: false }]];
    expect((await request()).statusCode).toBe(409);
    expect(state.snapshot).toHaveBeenCalledTimes(1);
    expect(state.inserted).toBeNull();
    expect(state.post).not.toHaveBeenCalled();
  });
  it("finishes through the existing stock/material posting service exactly once", async () => {
    const batch = { id: 20, status: "in_progress", branchId: "kitchen", productId: 11, unit: "قطعة" };
    state.queue = [[order], [{ ...item, executionUnit: "قطعة" }], [batch]];
    expect((await request(body, "finish")).statusCode).toBe(200);
    expect(state.post).toHaveBeenCalledTimes(1);
    state.queue = [[order], [item], [{ ...batch, status: "finished" }]];
    expect((await request(body, "finish")).statusCode).toBe(200);
    expect(state.post).toHaveBeenCalledTimes(1);
  });
  it("cancels only in-progress batches without a stock posting", async () => {
    state.queue = [[order], [{ ...item, executionUnit: "قطعة" }], [{ status: "in_progress", branchId: "kitchen", productId: 11, unit: "قطعة" }]];
    expect((await request(body, "cancel")).body.status).toBe("cancelled");
    expect(state.post).not.toHaveBeenCalled();
    state.queue = [[order], [item], [{ status: "finished" }]];
    expect((await request(body, "cancel")).statusCode).toBe(409);
  });
  it.each(["advancedProductionOrderItemId", "advancedIdempotencyKey", "advancedPayloadFingerprint", "advanced_production_order_item_id"])("protects raw generic field %s, including null", field => {
    expect(getManualProductionReservedField({ [field]: null })).toBe(field);
  });
  it("protects advanced owned batches at the generic mutation boundary", () => {
    expect(isOperationallyLinkedProductionBatch({ advancedProductionOrderItemId: 9 })).toBe(true);
  });
  it("ships additive constraints without historical UPDATE/backfill statements", () => {
    const migration = readFileSync("migrations/advanced_production_explicit_execution.sql", "utf8");
    expect(migration).toContain("ON DELETE RESTRICT");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("Historical batches cannot be linked retrospectively");
    expect(migration).toContain("CREATE CONSTRAINT TRIGGER require_advanced_execution_recipe_proof");
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(migration).toContain("SELECT * INTO batch FROM daily_production_batches WHERE id = NEW.id");
    expect(migration).toContain("Advanced linked batches cannot commit without recipe snapshot proof");
    expect(migration).toContain("used + (CASE WHEN"); // Preserve PostgreSQL CASE-parenthesis fix.
    expect(migration).not.toMatch(/^\s*UPDATE\s+(daily_production_batches|production_order_items)\s+SET/im);
  });
});