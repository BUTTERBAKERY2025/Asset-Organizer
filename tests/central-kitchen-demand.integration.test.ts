import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";

const databaseState = vi.hoisted(() => ({ db: null as any, pool: null as any }));

vi.mock("../server/db", () => ({
  db: new Proxy({}, {
    get(_target, property) {
      const value = databaseState.db?.[property];
      return typeof value === "function" ? value.bind(databaseState.db) : value;
    },
  }),
}));

vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
  requirePermission: () => (_req: any, _res: any, next: () => void) => next(),
  canAccessBranch: async (req: any, branchId: string) =>
    (req.currentUser?.testAllowedBranchIds || [req.currentUser?.branchId]).includes(branchId),
  getAllowedBranchIds: (req: any) => req.currentUser?.testAllowedBranchIds || [req.currentUser?.branchId].filter(Boolean),
}));

type Registration = { method: string; path: string; handlers: Array<(req: any, res: any) => any> };
const registrations: Registration[] = [];
let finishTransaction!: () => void;
let transactionPromise!: Promise<void>;
let fixture: any;

function captureApp() {
  const app: any = {};
  for (const method of ["get", "post"]) {
    app[method] = (path: string, ...handlers: Registration["handlers"]) => {
      registrations.push({ method, path, handlers });
      return app;
    };
  }
  return app;
}

function route(method: string, path: string) {
  const registration = registrations.find((entry) => entry.method === method && entry.path === path);
  if (!registration) throw new Error(`Demand route missing: ${method} ${path}`);
  return registration.handlers.at(-1)!;
}

async function invoke(method: string, path: string, options: { user: any; params?: any; query?: any; body?: any }) {
  const output: any = { status: 200, body: undefined, headers: {} };
  const req: any = {
    currentUser: options.user,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
  };
  const res: any = {
    status(value: number) { output.status = value; return res; },
    set(name: string, value: string) { output.headers[name.toLowerCase()] = value; return res; },
    json(value: any) { output.body = value; return res; },
  };
  await route(method, path)(req, res);
  return output;
}

describe.sequential("central kitchen demand live SQL handlers", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Demand integration tests are forbidden outside development");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, allowExitOnIdle: true });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    const rollback = new Error("ROLLBACK_DEMAND_HANDLER_TEST");
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const finishPromise = new Promise<void>((resolve) => { finishTransaction = resolve; });
    transactionPromise = realDb.transaction(async (tx) => {
      databaseState.db = tx;
      ready();
      await finishPromise;
      throw rollback;
    }).then(
      () => { throw new Error("Demand integration transaction unexpectedly committed"); },
      (error) => { if (error !== rollback) throw error; },
    );
    await readyPromise;

    const suffix = `${process.pid}-${Date.now()}`;
    const requestBranch = `demand-request-${suffix}`;
    const kitchenBranch = `demand-kitchen-${suffix}`;
    const outsiderBranch = `demand-outsider-${suffix}`;
    const receiver = { id: `demand-receiver-${suffix}`, role: "employee", branchId: requestBranch, testAllowedBranchIds: [requestBranch] };
    const owner = { id: `demand-owner-${suffix}`, role: "employee", branchId: kitchenBranch, testAllowedBranchIds: [kitchenBranch] };
    const outsider = { id: `demand-outsider-user-${suffix}`, role: "employee", branchId: outsiderBranch, testAllowedBranchIds: [outsiderBranch] };
    await databaseState.db.insert(schema.branches).values([
      { id: requestBranch, name: "Demand request" },
      { id: kitchenBranch, name: "Demand kitchen", isCentralKitchen: true },
      { id: outsiderBranch, name: "Demand outsider" },
    ]);
    await databaseState.db.insert(schema.users).values([receiver, owner, outsider]);
    await databaseState.db.insert(schema.userPermissions).values([
      { userId: receiver.id, module: "central_kitchen_orders", actions: ["view", "edit"] },
      { userId: owner.id, module: "central_kitchen_orders", actions: ["view", "edit", "approve"] },
      { userId: outsider.id, module: "central_kitchen_orders", actions: ["view", "edit"] },
    ]);
    await databaseState.db.insert(schema.centralKitchenRouting).values([
      { branchId: requestBranch, receiverUserId: receiver.id },
      { branchId: kitchenBranch, responsibleUserId: owner.id },
    ]);
    const [order] = await databaseState.db.insert(schema.centralKitchenOrders).values({
      requestBranchId: requestBranch, centralKitchenId: kitchenBranch, createdBy: receiver.id,
      orderNumber: `D-${suffix}`, orderDate: "2026-01-01", neededDate: "2026-01-02",
      payloadFingerprint: "a".repeat(64), idempotencyKey: `demand-order-${suffix}`,
      status: "received", inventoryMode: "shadow",
    }).returning();
    const catalog = await databaseState.db.insert(schema.warehouseItems).values([
      { name: `Demand original ${suffix}`, category: "test", unit: "piece", currentStock: 0, isActive: true },
      { name: `Demand substitute ${suffix}`, category: "test", unit: "piece", currentStock: 0, isActive: true },
    ]).returning();
    const items = await databaseState.db.insert(schema.centralKitchenOrderItems).values([
      { orderId: order.id, warehouseItemId: catalog[0].id, productName: catalog[0].name, unit: "piece", requestedQuantity: 10, reportedAvailableQuantity: 0, preparedQuantity: 6, substituteQuantity: 2, substituteWarehouseItemId: catalog[1].id, substituteProductName: catalog[1].name, substituteUnit: "piece", receivedQuantity: 6 },
      { orderId: order.id, warehouseItemId: catalog[0].id, productName: catalog[0].name, unit: "piece", requestedQuantity: 8, reportedAvailableQuantity: 0, preparedQuantity: 2, substituteQuantity: 0, receivedQuantity: 2 },
      { orderId: order.id, warehouseItemId: catalog[0].id, productName: catalog[0].name, unit: "piece", requestedQuantity: 5, reportedAvailableQuantity: 0, preparedQuantity: 2, substituteQuantity: 0, receivedQuantity: 2 },
    ]).returning();
    const commitments = await databaseState.db.insert(schema.centralKitchenDemandCommitments).values(items.map((item, index) => ({
      originalOrderId: order.id, originalOrderItemId: item.id, requestBranchId: requestBranch, centralKitchenId: kitchenBranch,
      inventoryMode: "shadow", warehouseItemId: item.warehouseItemId, productName: item.productName, unit: item.unit,
      requestedQuantity: index === 0 ? "10" : index === 1 ? "8" : "5", originalGoodReceivedQuantity: index ? "2" : "4",
      totalGoodReceivedQuantity: index ? "2" : "6", preparationShortfallQuantity: index === 0 ? "4" : index === 1 ? "6" : "3",
      transitLossQuantity: "0", substitutePreparedQuantity: index ? "0" : "2", substituteOfferedQuantity: index ? "0" : "2",
      receiptAttributionBasis: "branch_confirmed", reasonCode: "preparation_shortfall", status: index ? "open" : "substitute_pending",
      activationKind: "receipt", activatedBy: receiver.id,
    }))).returning();
    fixture = { receiver, owner, outsider, requestBranch, kitchenBranch, order, commitments };
    const { registerCentralKitchenDemandRoutes } = await import("../server/central-kitchen-demand-routes");
    registerCentralKitchenDemandRoutes(captureApp());
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("executes scoped report SQL and denies an out-of-branch decision", async () => {
    const report = await invoke("get", "/api/central-kitchen-demand", {
      user: fixture.receiver, query: { page: "1", pageSize: "1" },
    });
    expect(report.status).toBe(200);
    expect(report.body).toMatchObject({ total: 3, page: 1, pageSize: 1, totalPages: 3 });
    expect(report.body.rows).toHaveLength(1);
    expect(report.body.groups).toHaveLength(1);
    expect(report.body.groups[0]).toMatchObject({ requestedQuantity: "23", remainingQuantity: "15" });

    const statusPage1 = await invoke("get", "/api/central-kitchen-demand", {
      user: fixture.receiver, query: { status: "open", page: "1", pageSize: "1" },
    });
    expect(statusPage1.body).toMatchObject({ total: 2, page: 1, pageSize: 1, totalPages: 2 });
    expect(statusPage1.body.rows).toHaveLength(1);
    const firstOpenId = statusPage1.body.rows[0].id;
    const statusPage2 = await invoke("get", "/api/central-kitchen-demand", {
      user: fixture.receiver, query: { status: "open", page: "2", pageSize: "1" },
    });
    expect(statusPage2.body).toMatchObject({ total: 2, page: 2, pageSize: 1, totalPages: 2 });
    expect(statusPage2.body.rows).toHaveLength(1);
    expect(statusPage2.body.rows[0].id).not.toBe(firstOpenId);

    const forbidden = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.outsider, params: { id: String(fixture.commitments[0].id) },
      body: { type: "waive", quantity: "1", reason: "outsider denial", acknowledged: true, idempotencyKey: "outside-denied-1" },
    });
    expect(forbidden.status).toBe(403);
  });

  it("enforces acknowledgement, offered-quantity caps, and durable action replay", async () => {
    const commitmentId = fixture.commitments[0].id;
    const noConsent = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.receiver, params: { id: String(commitmentId) },
      body: { type: "accept_substitute", quantity: "1", reason: "branch accepts", idempotencyKey: "accept-no-consent" },
    });
    expect(noConsent.status).toBe(400);

    const overCap = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.receiver, params: { id: String(commitmentId) },
      body: { type: "accept_substitute", quantity: "3", reason: "too much substitute", acknowledged: true, idempotencyKey: "accept-over-cap" },
    });
    expect(overCap.status).toBe(409);
    expect(overCap.body.error).toContain("البديل المعروض");

    const body = { type: "accept_substitute", quantity: "1", reason: "branch accepts one", acknowledged: true, idempotencyKey: "accept-replay-key" };
    const created = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.receiver, params: { id: String(commitmentId) }, body,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ actionType: "substitute_accepted", quantity: "1.000000" });
    const replay = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.receiver, params: { id: String(commitmentId) }, body,
    });
    expect(replay.status).toBe(200);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.body.id).toBe(created.body.id);
    const conflict = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.receiver, params: { id: String(commitmentId) }, body: { ...body, quantity: "0.5" },
    });
    expect(conflict.status).toBe(409);

    const waived = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.receiver, params: { id: String(commitmentId) },
      body: { type: "waive", quantity: "5", reason: "branch waives the remainder", acknowledged: true, idempotencyKey: "waive-remainder-key" },
    });
    expect(waived.status).toBe(201);
    const afterWaiver = await invoke("get", "/api/central-kitchen-demand", {
      user: fixture.receiver, query: { originalOrderId: String(fixture.order.id), status: "waived", page: "1", pageSize: "50" },
    });
    expect(afterWaiver.body.rows).toHaveLength(1);
    expect(afterWaiver.body.rows[0]).toMatchObject({
      id: commitmentId,
      remainingQuantity: "0",
      waivedQuantity: "5",
      effectiveStatus: "waived",
      serviceFulfilled: false,
    });
  });

  it("validates the replacement owner and idempotently creates one linked order", async () => {
    const commitmentId = fixture.commitments[1].id;
    const invalidOwner = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.owner, params: { id: String(commitmentId) },
      body: { type: "replacement", quantity: "2", dueDate: "2026-02-01", responsibleUserId: fixture.outsider.id, idempotencyKey: "replacement-bad-owner" },
    });
    expect(invalidOwner.status).toBe(400);

    const body = { type: "replacement", quantity: "2", dueDate: "2026-02-01", responsibleUserId: fixture.owner.id, idempotencyKey: "replacement-good-owner" };
    const created = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.owner, params: { id: String(commitmentId) }, body,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ actionType: "replacement_created", responsibleUserId: fixture.owner.id });
    expect(created.body.replacementOrderId).toBeTypeOf("number");
    const replay = await invoke("post", "/api/central-kitchen-demand/:id/actions", {
      user: fixture.owner, params: { id: String(commitmentId) }, body,
    });
    expect(replay.status).toBe(200);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.body.replacementOrderId).toBe(created.body.replacementOrderId);

    await databaseState.db.update(schema.centralKitchenOrderItems).set({
      preparedQuantity: "2", receivedQuantity: "1.25",
    }).where(eq(schema.centralKitchenOrderItems.id, created.body.replacementOrderItemId));
    await databaseState.db.update(schema.centralKitchenOrders).set({
      status: "received", receivedAt: new Date(),
    }).where(eq(schema.centralKitchenOrders.id, created.body.replacementOrderId));
    const report = await invoke("get", "/api/central-kitchen-demand", {
      user: fixture.owner, query: { originalOrderId: String(fixture.order.id), page: "1", pageSize: "50" },
    });
    const replacementRow = report.body.rows.find((row: any) => row.id === commitmentId);
    expect(replacementRow).toMatchObject({
      compensationGoodReceivedQuantity: "1.25",
      remainingQuantity: "4.75",
      effectiveStatus: "partially_settled",
      serviceFulfilled: false,
      nextDueDate: null,
      responsibleUserIds: [],
    });
  });
});