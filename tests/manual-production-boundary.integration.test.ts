import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";
import {
  branches,
  centralKitchenOrderItems,
  centralKitchenOrders,
  dailyProductionBatches,
  users,
} from "../shared/schema";
import { MANUAL_PRODUCTION_RESERVED_FIELDS } from "../shared/manual-production-entry";

const databaseState = vi.hoisted(() => ({ db: null as any, pool: null as any }));

// Keep authentication mocked exactly as the existing central-kitchen route
// integration harness does.  Storage, route registration, and the transaction
// below remain real.
vi.mock("../server/db", () => ({
  db: new Proxy({}, {
    get(_target, property) {
      const value = databaseState.db?.[property];
      return typeof value === "function" ? value.bind(databaseState.db) : value;
    },
  }),
  pool: new Proxy({}, {
    get(_target, property) {
      const value = databaseState.pool?.[property];
      return typeof value === "function" ? value.bind(databaseState.pool) : value;
    },
  }),
}));

vi.mock("../server/auth", () => {
  const allowedBranches = (req: any) =>
    new Set<string>(req.currentUser?.testAllowedBranchIds || [req.currentUser?.branchId].filter(Boolean));
  const isAdmin = (req: any) => req.currentUser?.role === "admin";
  const middleware = (module: string, action?: string) => (req: any, res: any, next: () => any) => {
    if (!req.currentUser) return res.status(401).json({ error: "Unauthenticated" });
    if (isAdmin(req)) return next();
    const inferred = action || ({
      GET: "view", HEAD: "view", OPTIONS: "view", POST: "create",
      PUT: "edit", PATCH: "edit", DELETE: "delete",
    } as Record<string, string>)[req.method] || "edit";
    if (!(req.currentUser.testPermissions?.[module] || []).includes(inferred)) {
      return res.status(403).json({ error: `Missing ${module}:${inferred}` });
    }
    return next();
  };
  const passThrough = () => (_req: any, _res: any, next: () => any) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: (req: any, res: any, next: () => any) =>
      req.currentUser ? next() : res.status(401).json({ error: "Unauthenticated" }),
    requirePermission: middleware,
    requireAnyPermission: passThrough,
    requireRole: passThrough,
    requireBranchAccess: passThrough,
    canAccessBranch: async (req: any, branchId: string) => isAdmin(req) || allowedBranches(req).has(branchId),
    isUserAdmin: isAdmin,
    getAllowedBranchIds: async (req: any) => isAdmin(req) ? null : Array.from(allowedBranches(req)),
    getActiveBranchFilter: (req: any) => req.currentUser?.branchId || null,
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      if (isAdmin(req)) return { hasAccess: true, singleBranchId: requested || null, branchIds: null };
      const ids = Array.from(allowedBranches(req));
      if (requested) return { hasAccess: ids.includes(requested), singleBranchId: requested, branchIds: ids };
      return { hasAccess: true, singleBranchId: ids.length === 1 ? ids[0] : null, branchIds: ids };
    },
    invalidateAuthCache: vi.fn(),
    getCachedPermissionsForUser: () => null,
    parseUserAgent: () => ({ browser: "test", os: "test", device: "test" }),
    hasCrossBranchHrReadAccess: () => false,
    HR_MANAGER_MODULES: new Set(),
    HR_SPECIALIST_PERMISSIONS: {},
    FINANCIAL_MANAGER_PERMISSIONS: {},
    OPERATIONS_MANAGER_PERMISSIONS: {},
    BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS: {},
  };
});

type Registration = {
  method: string;
  path: string;
  handlers: Array<(req: any, res: any, next?: () => any) => any>;
};
type TestResponse = { statusCode: number; body: any; headers: Record<string, string> };

const registrations: Registration[] = [];
let finishTransaction!: () => void;
let transactionPromise!: Promise<void>;
let generatedIdempotencyKey = 0;
let fixture: {
  branchId: string;
  otherBranchId: string;
  user: any;
  sourceBatchId: number;
  otherSourceBatchId: number;
  linkedBatchId: number;
} | undefined;

function captureApp() {
  const app: any = {};
  for (const method of ["get", "post", "put", "patch", "delete", "options"]) {
    app[method] = (path: string, ...handlers: Registration["handlers"]) => {
      registrations.push({ method, path, handlers });
      return app;
    };
  }
  app.use = () => app;
  return app;
}

function findRoute(method: string, path: string) {
  const registered = registrations.find((entry) => entry.method === method && entry.path === path);
  if (!registered) throw new Error(`Route was not registered: ${method.toUpperCase()} ${path}`);
  return registered;
}

async function invoke(
  method: string,
  path: string,
  options: { user: any; params?: any; query?: any; body?: any; headers?: Record<string, string> },
): Promise<TestResponse> {
  const headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  // The generic manual route now has a required durable operation key. This
  // legacy boundary suite is about acknowledgement/link fields, so give each
  // valid attempt an otherwise-unrelated unique header.
  if (method === "post" && path === "/api/daily-production/batches" && !headers["idempotency-key"]) {
    generatedIdempotencyKey += 1;
    headers["idempotency-key"] = `manual-boundary-${generatedIdempotencyKey}-key`;
  }
  const response: TestResponse = { statusCode: 200, body: undefined, headers: {} };
  const req: any = {
    method: method.toUpperCase(),
    currentUser: options.user,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers,
    originalUrl: path,
    ip: "127.0.0.1",
    get(name: string) { return headers[name.toLowerCase()]; },
  };
  const res: any = {
    status(code: number) { response.statusCode = code; return res; },
    set(name: string, value: string) { response.headers[name.toLowerCase()] = value; return res; },
    header(name: string, value: string) { response.headers[name.toLowerCase()] = value; return res; },
    json(body: any) { response.body = body; return res; },
    send(body: any) { response.body = body; return res; },
    end(body?: any) { if (body !== undefined) response.body = body; return res; },
  };
  const registration = findRoute(method, path);
  let index = 0;
  const run = async (): Promise<void> => {
    const handler = registration.handlers[index++];
    if (!handler) return;
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      await run();
    };
    await handler(req, res, next);
    if (nextCalled) return;
  };
  await run();
  return response;
}

const permissions = {
  production: ["view", "create", "edit", "delete"],
};

function actor(id: string, branchId: string) {
  return {
    id,
    username: id,
    branchId,
    role: "manager",
    testPermissions: permissions,
    testAllowedBranchIds: [branchId],
  };
}

function manualBody(branchId: string, extra: Record<string, unknown> = {}) {
  return {
    branchId,
    productName: "Manual boundary batch",
    quantity: 2,
    unit: "قطعة",
    destination: "freezer",
    productionDate: "2099-05-01",
    status: "in_progress",
    independentEntryAcknowledged: true,
    ...extra,
  };
}

async function batchCount() {
  const result = await databaseState.db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM daily_production_batches
    WHERE branch_id = ${fixture!.branchId}
  `);
  return Number(result.rows[0].count);
}

async function batchFields(batchId: number) {
  const result = await databaseState.db.execute(sql`
    SELECT id, branch_id, source_batch_id, recipe_backed,
           central_kitchen_order_item_id, central_kitchen_idempotency_key,
           central_kitchen_payload_fingerprint, production_order_id, notes
    FROM daily_production_batches
    WHERE id = ${batchId}
  `);
  return result.rows[0] as Record<string, unknown> | undefined;
}

describe.sequential("manual daily-production boundary (development DB)", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Manual production boundary integration tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, allowExitOnIdle: true });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const finishPromise = new Promise<void>((resolve) => { finishTransaction = resolve; });
    const rollback = new Error("MANUAL_PRODUCTION_BOUNDARY_TEST_ROLLBACK");
    transactionPromise = realDb.transaction(async (tx) => {
      databaseState.db = tx;
      ready();
      await finishPromise;
      throw rollback;
    }).then(
      () => { throw new Error("Integration transaction unexpectedly committed"); },
      (error) => { if (error !== rollback) throw error; },
    );
    await readyPromise;

    const suffix = `${process.pid}-${Date.now()}`;
    const branchId = `manual-boundary-${suffix}`;
    const otherBranchId = `manual-boundary-other-${suffix}`;
    const user = actor(`manual-boundary-user-${suffix}`, branchId);
    const otherUser = actor(`manual-boundary-other-user-${suffix}`, otherBranchId);

    await databaseState.db.insert(branches).values([
      { id: branchId, name: "Manual boundary branch" },
      { id: otherBranchId, name: "Manual boundary other branch" },
    ]);
    await databaseState.db.insert(users).values([
      { id: user.id, username: user.username, role: user.role, branchId },
      { id: otherUser.id, username: otherUser.username, role: otherUser.role, branchId: otherBranchId },
    ]);

    const [order] = await databaseState.db.insert(centralKitchenOrders).values({
      orderNumber: `MANUAL-BOUNDARY-${suffix}`,
      requestBranchId: otherBranchId,
      centralKitchenId: branchId,
      orderDate: "2099-05-01",
      status: "approved",
      inventoryMode: "real",
      idempotencyKey: `manual-boundary-order-${suffix}-12345678`,
      payloadFingerprint: "a".repeat(64),
      createdBy: user.id,
    }).returning({ id: centralKitchenOrders.id });
    const [orderItem] = await databaseState.db.insert(centralKitchenOrderItems).values({
      orderId: order.id,
      productName: "Linked boundary batch",
      requestedQuantity: 2,
      unit: "قطعة",
    }).returning({ id: centralKitchenOrderItems.id });

    const [sourceBatch] = await databaseState.db.insert(dailyProductionBatches).values({
      branchId,
      productName: "Independent source batch",
      quantity: 2,
      unit: "قطعة",
      destination: "freezer",
      productionDate: "2099-04-30",
      status: "in_progress",
      recipeBacked: false,
    }).returning({ id: dailyProductionBatches.id });
    const [otherSourceBatch] = await databaseState.db.insert(dailyProductionBatches).values({
      branchId: otherBranchId,
      productName: "Other branch source batch",
      quantity: 1,
      unit: "قطعة",
      destination: "freezer",
      productionDate: "2099-04-30",
      status: "in_progress",
      recipeBacked: false,
    }).returning({ id: dailyProductionBatches.id });
    const [linkedBatch] = await databaseState.db.insert(dailyProductionBatches).values({
      branchId,
      productName: "Linked boundary batch",
      quantity: 1,
      unit: "قطعة",
      destination: "freezer",
      productionDate: "2099-05-01",
      status: "in_progress",
      centralKitchenOrderItemId: orderItem.id,
    }).returning({ id: dailyProductionBatches.id });

    fixture = {
      branchId,
      otherBranchId,
      user,
      sourceBatchId: sourceBatch.id,
      otherSourceBatchId: otherSourceBatch.id,
      linkedBatchId: linkedBatch.id,
    };

    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("rejects a missing acknowledgement without writing a batch", async () => {
    const before = await batchCount();
    const response = await invoke("post", "/api/daily-production/batches", {
      user: fixture!.user,
      body: manualBody(fixture!.branchId, { independentEntryAcknowledged: undefined }),
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain("تأكيد");
    expect(await batchCount()).toBe(before);
  });

  it("retires the legacy carry-over route without writing, while preserving branch scope", async () => {
    const before = await batchCount();
    const missingAcknowledgement = await invoke("post", "/api/daily-production/batches/:id/carry-over", {
      user: fixture!.user,
      params: { id: String(fixture!.sourceBatchId) },
      body: {},
    });
    expect(missingAcknowledgement.statusCode).toBe(410);
    expect(missingAcknowledgement.body.error).toContain("تم إيقاف");

    const linkedSource = await invoke("post", "/api/daily-production/batches/:id/carry-over", {
      user: fixture!.user,
      params: { id: String(fixture!.linkedBatchId) },
      body: { sourceBatchId: fixture!.linkedBatchId, independentEntryAcknowledged: true },
    });
    expect(linkedSource.statusCode).toBe(410);
    expect(await batchCount()).toBe(before);

    const otherBranchUser = actor("manual-boundary-outside-actor", fixture!.otherBranchId);
    const outOfBranch = await invoke("post", "/api/daily-production/batches/:id/carry-over", {
      user: otherBranchUser,
      params: { id: String(fixture!.sourceBatchId) },
      body: {},
    });
    expect(outOfBranch.statusCode).toBe(403);
    expect(await batchCount()).toBe(before);
  });

  it("rejects every reserved field on POST, including null, before insert", async () => {
    for (const field of MANUAL_PRODUCTION_RESERVED_FIELDS) {
      const before = await batchCount();
      const response = await invoke("post", "/api/daily-production/batches", {
        user: fixture!.user,
        body: manualBody(fixture!.branchId, { [field]: null }),
      });
      expect(response.statusCode, field).toBe(400);
      expect(response.body.error, field).toContain("حقول الربط");
      expect(await batchCount(), field).toBe(before);
    }
  });

  it("rejects every reserved field on PATCH before parsing the batch id", async () => {
    for (const field of MANUAL_PRODUCTION_RESERVED_FIELDS) {
      const response = await invoke("patch", "/api/daily-production/batches/:id", {
        user: fixture!.user,
        params: { id: "not-a-number" },
        body: { [field]: null },
      });
      expect(response.statusCode, field).toBe(400);
      expect(response.body.error, field).toContain("حقول الربط");
    }
  });

  it("creates an acknowledged independent batch without operational links or recipe snapshots", async () => {
    const beforeSnapshots = await databaseState.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM central_kitchen_batch_recipe_snapshots
    `);
    const response = await invoke("post", "/api/daily-production/batches", {
      user: fixture!.user,
      body: manualBody(fixture!.branchId),
    });
    expect(response.statusCode).toBe(201);
    expect(response.body.recipeBacked).toBe(false);
    const row = await batchFields(response.body.id);
    expect(row).toMatchObject({
      recipe_backed: false,
      central_kitchen_order_item_id: null,
      central_kitchen_idempotency_key: null,
      central_kitchen_payload_fingerprint: null,
      production_order_id: null,
    });
    const afterSnapshots = await databaseState.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM central_kitchen_batch_recipe_snapshots
    `);
    expect(afterSnapshots.rows).toEqual(beforeSnapshots.rows);
  });

  it("rejects sourceBatchId cloning at the generic manual creation boundary", async () => {
    const before = await batchCount();
    const response = await invoke("post", "/api/daily-production/batches", {
      user: fixture!.user,
      body: manualBody(fixture!.branchId, { sourceBatchId: fixture!.sourceBatchId }),
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain("إعادة جدولة");
    expect(await batchCount()).toBe(before);
  });

  it("rejects all sourceBatchId values rather than resolving or cloning a source", async () => {
    const cases = [
      { id: 999_999_999 },
      { id: fixture!.otherSourceBatchId },
      { id: fixture!.linkedBatchId },
    ];
    for (const testCase of cases) {
      const before = await batchCount();
      const response = await invoke("post", "/api/daily-production/batches", {
        user: fixture!.user,
        body: manualBody(fixture!.branchId, { sourceBatchId: testCase.id }),
      });
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain("إعادة جدولة");
      expect(await batchCount()).toBe(before);
    }
  });

  it("keeps a central-kitchen linked batch unchanged when generic PATCH or DELETE is attempted", async () => {
    const before = await batchFields(fixture!.linkedBatchId);
    const patch = await invoke("patch", "/api/daily-production/batches/:id", {
      user: fixture!.user,
      params: { id: String(fixture!.linkedBatchId) },
      body: { notes: "must not be written" },
    });
    expect(patch.statusCode).toBe(409);
    expect(patch.body.error).toContain("الطلب الأصلي");

    const deletion = await invoke("delete", "/api/daily-production/batches/:id", {
      user: fixture!.user,
      params: { id: String(fixture!.linkedBatchId) },
    });
    expect(deletion.statusCode).toBe(409);
    expect(deletion.body.error).toContain("الطلب الأصلي");
    expect(await batchFields(fixture!.linkedBatchId)).toEqual(before);
  });
});