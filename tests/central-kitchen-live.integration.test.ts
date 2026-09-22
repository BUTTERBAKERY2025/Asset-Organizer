import { createServer } from "node:http";
import express from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray, sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  branchStock,
  branches,
  centralKitchenInventoryAllocations,
  centralKitchenInventoryMovements,
  centralKitchenRecipeIngredients,
  centralKitchenRecipes,
  centralKitchenOrders,
  centralKitchenRuntime,
  dailyProductionBatches,
  finishedGoodsInventory,
  productionInventoryLogs,
  products,
  users,
  warehouseItems,
} from "../shared/schema";
import * as schema from "../shared/schema";

const databaseState = vi.hoisted(() => ({ db: null as any, pool: null as any }));

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

// Deliberately mock only authentication/authorization. Routes, storage, and
// inventory posting all use their production implementations and a real DB.
vi.mock("../server/auth", () => {
  const middleware = () => (_req: any, _res: any, next: () => void) => next();
  const isAdmin = (req: any) => req.currentUser?.role === "admin";
  const allowedBranches = (req: any) =>
    new Set<string>(req.currentUser?.testAllowedBranchIds || [req.currentUser?.branchId].filter(Boolean));
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
    requirePermission: middleware,
    requireAnyPermission: middleware,
    requireRole: middleware,
    requireBranchAccess: middleware,
    canAccessBranch: async (req: any, branchId: string) =>
      isAdmin(req) || allowedBranches(req).has(branchId),
    isUserAdmin: isAdmin,
    getAllowedBranchIds: async (req: any) =>
      isAdmin(req) ? null : Array.from(allowedBranches(req)),
    getActiveBranchFilter: (req: any) => req.currentUser?.branchId || null,
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      if (isAdmin(req)) return { hasAccess: true, singleBranchId: requested || null, branchIds: null };
      const ids = Array.from(allowedBranches(req));
      if (requested) {
        return { hasAccess: ids.includes(requested), singleBranchId: requested, branchIds: ids };
      }
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
  handlers: Array<(req: any, res: any) => any>;
};

type TestResponse = {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
};

const registrations: Registration[] = [];
let finishTransaction!: () => void;
let transactionPromise!: Promise<void>;
let keySequence = 0;
let fixture: {
  requestBranchId: string;
  kitchenBranchId: string;
  outsiderBranchId: string;
  requestUser: any;
  kitchenUser: any;
  outsiderUser: any;
  adminUser: any;
  stockedProductId: number;
  productionProductId: number;
  operationsProductId: number;
  guardedProductId: number;
  historicalProductId: number;
  mismatchProductId: number;
  materialId: number;
  wrongUnitMaterialId: number;
  recodeProductId: number;
  recodeMaterialId: number;
};

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

function route(method: string, path: string) {
  const match = registrations.find((entry) => entry.method === method && entry.path === path);
  if (!match) throw new Error(`Route was not registered: ${method.toUpperCase()} ${path}`);
  return match.handlers.at(-1)!;
}

async function invoke(
  method: string,
  path: string,
  options: { user: any; params?: any; query?: any; body?: any; headers?: Record<string, string> },
): Promise<TestResponse> {
  const headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const response: TestResponse = { statusCode: 200, body: undefined, headers: {} };
  const req = {
    currentUser: options.user,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
  const res = {
    status(code: number) {
      response.statusCode = code;
      return res;
    },
    set(name: string, value: string) {
      response.headers[name.toLowerCase()] = value;
      return res;
    },
    json(body: any) {
      response.body = body;
      return res;
    },
    send(body: any) {
      response.body = body;
      return res;
    },
  };
  await route(method, path)(req, res);
  return response;
}

function key(label: string) {
  keySequence += 1;
  return `ck-live-${label}-${keySequence}-12345678`;
}

// Real HTTP transport around the same captured production handlers and
// rollback-only DB fixture. Authentication remains the harness's test double;
// handler-level branch authorization and production services are not mocked.
async function httpInvoke(method: string, path: string, options: Parameters<typeof invoke>[2]): Promise<TestResponse> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).currentUser = options.user; next(); });
  (app as any)[method](path, route(method, path));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const resolvedPath = path.replace(/:([A-Za-z]+)/g, (_, name) => encodeURIComponent(options.params?.[name]));
    const response = await fetch(`http://127.0.0.1:${address.port}${resolvedPath}`, {
      method: method.toUpperCase(),
      headers: { "Content-Type": "application/json", ...options.headers },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    return { statusCode: response.status, body: await response.json(), headers: Object.fromEntries(response.headers) };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function createBody(
  items: any[],
  idempotencyKey = key("create"),
) {
  return {
    requestBranchId: fixture.requestBranchId,
    centralKitchenId: fixture.kitchenBranchId,
    idempotencyKey,
    items,
  };
}

async function createOrder(items: any[], user = fixture.requestUser) {
  return invoke("post", "/api/central-kitchen-orders", {
    user,
    body: createBody(items),
  });
}

async function approve(orderId: number) {
  return invoke("post", "/api/central-kitchen-orders/:id/approve", {
    user: fixture.kitchenUser,
    params: { id: String(orderId) },
    body: { idempotencyKey: key("approve") },
  });
}

async function createLinkedBatch(
  orderId: number,
  itemId: number,
  quantity: number,
  productionDate: string,
  user = fixture.kitchenUser,
) {
  return invoke("post", "/api/central-kitchen-orders/:id/items/:itemId/production-batches", {
    user,
    params: { id: String(orderId), itemId: String(itemId) },
    headers: { "Idempotency-Key": key("linked-batch") },
    body: { quantity, productionDate },
  });
}

async function setRuntime(mode: "shadow" | "real" | "paused", user = fixture.adminUser) {
  return invoke("put", "/api/central-kitchen-orders/runtime/:kitchenId", {
    user,
    params: { kitchenId: fixture.kitchenBranchId },
    body: { mode },
  });
}

async function warehouseBalance(branchId: string, itemId: number) {
  const [row] = await databaseState.db.select({
    quantity: branchStock.currentQuantity,
    reserved: branchStock.reservedQuantity,
  }).from(branchStock).where(and(eq(branchStock.branchId, branchId), eq(branchStock.itemId, itemId)));
  return { quantity: Number(row?.quantity || 0), reserved: Number(row?.reserved || 0) };
}

async function productBalance(branchId: string, productId: number) {
  const [row] = await databaseState.db.select({
    quantity: sql<number>`COALESCE(SUM(${finishedGoodsInventory.quantity}), 0)::int`,
    reserved: sql<number>`COALESCE(SUM(${finishedGoodsInventory.reservedQuantity}), 0)::int`,
  }).from(finishedGoodsInventory).where(and(
    eq(finishedGoodsInventory.branchId, branchId),
    eq(finishedGoodsInventory.productId, productId),
  ));
  return { quantity: Number(row.quantity), reserved: Number(row.reserved) };
}

describe.sequential("central kitchen live inventory database-backed handlers", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Central-kitchen live integration tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");
    const databaseHost = new URL(process.env.DATABASE_URL).hostname;
    // Replit's managed development PostgreSQL is reached as "helium".
    if (!["localhost", "127.0.0.1", "[::1]", "::1", "helium"].includes(databaseHost)) {
      throw new Error("Rollback integration tests require an explicitly configured local DEVELOPMENT DATABASE_URL");
    }

    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      allowExitOnIdle: true,
    });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const finishPromise = new Promise<void>((resolve) => { finishTransaction = resolve; });
    const rollback = new Error("CENTRAL_KITCHEN_LIVE_TEST_ROLLBACK");

    transactionPromise = realDb.transaction(async (tx) => {
      databaseState.db = tx;
      ready();
      await finishPromise;
      throw rollback;
    }).then(
      () => { throw new Error("Integration transaction unexpectedly committed"); },
      (error) => {
        if (error !== rollback) throw error;
      },
    );
    await readyPromise;

    const suffix = `${process.pid}-${Date.now()}`;
    const requestBranchId = `ck-live-request-${suffix}`;
    const kitchenBranchId = `ck-live-kitchen-${suffix}`;
    const outsiderBranchId = `ck-live-outsider-${suffix}`;
    const requestUser = {
      id: `ck-live-request-user-${suffix}`,
      username: `ck-live-request-${suffix}`,
      role: "manager",
      branchId: requestBranchId,
    };
    const kitchenUser = {
      id: `ck-live-kitchen-user-${suffix}`,
      username: `ck-live-kitchen-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
    };
    const outsiderUser = {
      id: `ck-live-outsider-user-${suffix}`,
      username: `ck-live-outsider-${suffix}`,
      role: "manager",
      branchId: outsiderBranchId,
    };
    const adminUser = {
      id: `ck-live-admin-user-${suffix}`,
      username: `ck-live-admin-${suffix}`,
      role: "admin",
      branchId: kitchenBranchId,
    };

    await databaseState.db.insert(branches).values([
      { id: requestBranchId, name: "CK live request branch" },
      { id: kitchenBranchId, name: "CK live central kitchen", isCentralKitchen: true },
      { id: outsiderBranchId, name: "CK live outsider branch" },
    ]);
    await databaseState.db.insert(users).values([requestUser, kitchenUser, outsiderUser, adminUser]);

    const idResult = await databaseState.db.execute(sql`
      SELECT GREATEST(
        COALESCE((SELECT MAX(id) FROM products), 0),
        COALESCE((SELECT MAX(id) FROM warehouse_items), 0)
      )::int + 2000 AS id
    `);
    const firstId = Number(idResult.rows[0].id);
    const stockedProductId = firstId;
    const productionProductId = firstId + 1;
    const operationsProductId = firstId + 2;
    const guardedProductId = firstId + 3;
    const historicalProductId = firstId + 4;
    const mismatchProductId = firstId + 5;
    const materialId = firstId + 6;
    const wrongUnitMaterialId = firstId + 7;
    const recodeProductId = firstId + 8;
    const recodeMaterialId = firstId + 9;

    await databaseState.db.insert(products).values([
      {
        id: stockedProductId,
        name: `CK live stocked product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: productionProductId,
        name: `CK live produced product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: operationsProductId,
        name: `CK live operations product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: guardedProductId,
        name: `CK live guarded product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: historicalProductId,
        name: `CK live historical product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: mismatchProductId,
        name: `CK live mismatch product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: recodeProductId,
        name: `CK live recode product ${suffix}`,
        sku: `CK-LIVE-OLD-PRODUCT-${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
    ]);
    await databaseState.db.insert(warehouseItems).values([
      {
        id: materialId,
        name: `CK live material ${suffix}`,
        category: "test",
        unit: "tray",
        currentStock: 500,
        isActive: true,
      },
      {
        id: wrongUnitMaterialId,
        name: `CK live wrong-unit material ${suffix}`,
        category: "test",
        unit: "case",
        currentStock: 500,
        isActive: true,
      },
      {
        id: recodeMaterialId,
        name: `CK live recode material ${suffix}`,
        sku: `CK-LIVE-OLD-MATERIAL-${suffix}`,
        category: "raw",
        unit: "kg",
        currentStock: 500,
        isActive: true,
      },
    ]);
    await databaseState.db.insert(branchStock).values([
      { branchId: kitchenBranchId, itemId: materialId, currentQuantity: 9 },
      { branchId: requestBranchId, itemId: materialId, currentQuantity: 40 },
      { branchId: kitchenBranchId, itemId: wrongUnitMaterialId, currentQuantity: 20 },
      { branchId: kitchenBranchId, itemId: recodeMaterialId, currentQuantity: 3 },
      { branchId: requestBranchId, itemId: recodeMaterialId, currentQuantity: 4 },
    ]);
    await databaseState.db.insert(finishedGoodsInventory).values([
      {
        branchId: kitchenBranchId,
        productId: stockedProductId,
        productName: `CK live stocked product ${suffix}`,
        productNameNormalized: `ck live stocked product ${suffix}`,
        productCategory: "test",
        quantity: 10,
        reservedQuantity: 0,
        unit: "tray",
        productionDate: "2098-01-01",
      },
      {
        branchId: kitchenBranchId,
        productId: operationsProductId,
        productName: `CK live operations product ${suffix}`,
        productNameNormalized: `ck live operations product ${suffix}`,
        productCategory: "test",
        quantity: 4,
        reservedQuantity: 0,
        unit: "tray",
        productionDate: "2098-01-01",
      },
      {
        branchId: kitchenBranchId,
        productId: recodeProductId,
        productName: `CK live recode product ${suffix}`,
        productNameNormalized: `ck live recode product ${suffix}`.toLowerCase(),
        productCategory: "test",
        quantity: 1,
        reservedQuantity: 0,
        unit: "tray",
        productionDate: "2098-09-01",
      },
    ]);

    fixture = {
      requestBranchId,
      kitchenBranchId,
      outsiderBranchId,
      requestUser,
      kitchenUser,
      outsiderUser,
      adminUser,
      stockedProductId,
      productionProductId,
      operationsProductId,
      guardedProductId,
      historicalProductId,
      mismatchProductId,
      materialId,
      wrongUnitMaterialId,
      recodeProductId,
      recodeMaterialId,
    };

    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 30_000);

  it("HTTP edits and cancels a branch request once without stock changes and denies the kitchen branch", async () => {
    expect((await setRuntime("real")).statusCode).toBe(200);
    const [product] = await databaseState.db.select().from(products).where(eq(products.id, fixture.stockedProductId));
    const stockBefore = await productBalance(fixture.kitchenBranchId, product.id);
    const materialBefore = await warehouseBalance(fixture.kitchenBranchId, fixture.materialId);
    const created = await httpInvoke("post", "/api/central-kitchen-orders", {
      user: fixture.requestUser,
      body: createBody([{ productId: product.id, productName: product.name, unit: product.unit, requestedQuantity: 2 }]),
    });
    expect(created.statusCode).toBe(201);
    const params = { id: String(created.body.id) };
    const revision = (order: any) => Math.max(0, ...order.events.map((event: any) => event.id));
    const edit = {
      expectedEventId: revision(created.body), reason: "HTTP demand correction", idempotencyKey: key("http-edit"),
      edit: { neededDate: "2098-09-01", neededTime: null, notes: "corrected",
        items: [{ itemId: created.body.items[0].id, requestedQuantity: 3 }] },
    };
    const path = "/api/central-kitchen-orders/:id/request-change";
    expect((await httpInvoke("post", path, { user: fixture.kitchenUser, params, body: edit })).statusCode).toBe(403);
    const edited = await httpInvoke("post", path, { user: fixture.requestUser, params, body: edit });
    expect(edited.statusCode).toBe(200);
    expect(Number(edited.body.items[0].requestedQuantity)).toBe(3);
    const editedReplay = await httpInvoke("post", path, { user: fixture.requestUser, params, body: edit });
    expect(editedReplay.statusCode).toBe(200);
    expect(editedReplay.headers["idempotent-replayed"]).toBe("true");
    expect(editedReplay.body.events).toHaveLength(edited.body.events.length);
    const cancel = { expectedEventId: revision(edited.body), reason: "HTTP request withdrawn", idempotencyKey: key("http-cancel") };
    const cancelled = await httpInvoke("post", path, { user: fixture.requestUser, params, body: cancel });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    const replay = await httpInvoke("post", path, { user: fixture.requestUser, params, body: cancel });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.body.events).toHaveLength(cancelled.body.events.length);
    expect(replay.body.events.filter((event: any) => event.eventType === "cancelled")).toHaveLength(1);
    expect(await productBalance(fixture.kitchenBranchId, product.id)).toEqual(stockBefore);
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.materialId)).toEqual(materialBefore);
    expect(replay.body.allocations).toHaveLength(0);
    expect(replay.body.shadowInventoryEntries).toHaveLength(0);
    expect((await setRuntime("shadow")).statusCode).toBe(200);
  });

  it("HTTP executes an approved plan through recipe-backed batches, posts finish once and releases cancelled capacity", async () => {
    const [material] = await databaseState.db.select().from(warehouseItems).where(eq(warehouseItems.id, fixture.wrongUnitMaterialId));
    const [product] = await databaseState.db.insert(products).values({
      name: key("http-plan-product"), category: "test", unit: "tray", productType: "finish", isActive: "true",
    }).returning();
    const [plan] = await databaseState.db.insert(schema.advancedProductionOrders).values({
      orderNumber: key("http-plan"), title: "HTTP execution rollback fixture", status: "approved",
      sourceBranchId: fixture.kitchenBranchId, targetBranchId: fixture.requestBranchId,
      startDate: "2098-09-01", endDate: "2098-09-01", createdBy: fixture.kitchenUser.id,
    }).returning();
    const [item] = await databaseState.db.insert(schema.productionOrderItems).values({
      orderId: plan.id, productId: product.id, productName: product.name, targetQuantity: 2,
    }).returning();
    const base = "/api/advanced-production-orders/:orderId";
    const batchPath = `${base}/items/:itemId/batches`;
    const params = { orderId: String(plan.id), itemId: String(item.id) };
    const batchBody = { quantity: 1, unit: product.unit, productionDate: "2098-09-01", destination: "display_bar" };
    const create = (user = fixture.kitchenUser) => httpInvoke("post", batchPath, {
      user, params, body: batchBody, headers: { "Idempotency-Key": key("http-plan-batch") },
    });
    expect((await create(fixture.requestUser)).statusCode).toBe(403);
    // No nonrecipe fallback is permitted.
    expect((await create()).statusCode).toBe(409);
    const recipeResult = await httpInvoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser, body: {
        kitchenId: fixture.kitchenBranchId, productId: product.id, outputQuantity: 1, outputUnit: product.unit,
        ingredients: [{ warehouseItemId: material.id, quantity: 0.5, unit: material.unit }],
        idempotencyKey: key("http-plan-recipe"),
      },
    });
    expect(recipeResult.statusCode).toBe(201);
    const recipe = recipeResult.body.recipe || recipeResult.body.data || recipeResult.body;
    expect((await httpInvoke("post", "/api/central-kitchen-recipes/:id/approve", {
      user: fixture.kitchenUser, params: { id: String(recipe.id) },
      body: { version: recipe.version, updateToken: recipe.updateToken, idempotencyKey: key("http-plan-recipe-approve") },
    })).statusCode).toBe(200);
    const materialBefore = await warehouseBalance(fixture.kitchenBranchId, material.id);
    const stockBefore = await productBalance(fixture.kitchenBranchId, product.id);
    // A rollback-only suite must explicitly flush deferred constraints: an
    // unfinished snapshot establishment must never be able to commit.
    const missingProof = await databaseState.db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT set_config('app.advanced_execution_write', 'on', true)`);
      await tx.update(schema.productionOrderItems).set({ executionUnit: product.unit })
        .where(eq(schema.productionOrderItems.id, item.id));
      await tx.insert(dailyProductionBatches).values({
        branchId: fixture.kitchenBranchId, productId: product.id, productName: product.name,
        quantity: 1, unit: product.unit, productionDate: "2098-09-01",
        destination: "display_bar", productionOrderId: plan.id,
        advancedProductionOrderItemId: item.id,
        advancedIdempotencyKey: key("http-missing-proof"),
        advancedPayloadFingerprint: "a".repeat(64),
        recipeBacked: false, status: "in_progress", recordedBy: fixture.kitchenUser.id,
      });
      await tx.execute(sql`SET CONSTRAINTS require_advanced_execution_recipe_proof IMMEDIATE`);
    }).then(() => null, (error: any) => error);
    expect(missingProof?.cause?.code || missingProof?.code).toBe("23514");
    const first = await create();
    expect(first.statusCode).toBe(201);
    const firstBatch = first.body.batch || first.body;
    expect(firstBatch.recipeBacked).toBe(true);
    expect(firstBatch.advancedProductionOrderItemId).toBe(item.id);
    await databaseState.db.execute(sql`SET CONSTRAINTS require_advanced_execution_recipe_proof IMMEDIATE`);
    await databaseState.db.execute(sql`SET CONSTRAINTS require_advanced_execution_recipe_proof DEFERRED`);
    const second = await create();
    expect(second.statusCode).toBe(201);
    const secondBatch = second.body.batch || second.body;
    expect((await create()).statusCode).toBe(409);
    const actionPath = `${batchPath}/:batchId/:action`;
    const action = (batchId: number, action: string) => httpInvoke("post", actionPath, {
      user: fixture.kitchenUser, params: { ...params, batchId: String(batchId), action },
    });
    expect((await action(secondBatch.id, "cancel")).statusCode).toBe(200);
    expect((await action(secondBatch.id, "cancel")).statusCode).toBe(200);
    expect(await warehouseBalance(fixture.kitchenBranchId, material.id)).toEqual(materialBefore);
    expect(await productBalance(fixture.kitchenBranchId, product.id)).toEqual(stockBefore);
    expect((await action(firstBatch.id, "finish")).statusCode).toBe(200);
    expect((await action(firstBatch.id, "finish")).statusCode).toBe(200);
    expect(await warehouseBalance(fixture.kitchenBranchId, material.id)).toEqual({ ...materialBefore, quantity: materialBefore.quantity - 0.5 });
    expect(await productBalance(fixture.kitchenBranchId, product.id)).toEqual({ ...stockBefore, quantity: stockBefore.quantity + 1 });
    expect((await databaseState.db.execute(sql`SELECT id FROM central_kitchen_batch_material_movements WHERE batch_id = ${firstBatch.id}`)).rows).toHaveLength(1);
    expect((await databaseState.db.select().from(productionInventoryLogs).where(eq(productionInventoryLogs.batchId, firstBatch.id))).length).toBe(1);
    expect((await action(firstBatch.id, "cancel")).statusCode).toBe(409);
    const replacement = await create();
    expect(replacement.statusCode).toBe(201);
    expect((await action((replacement.body.batch || replacement.body).id, "cancel")).statusCode).toBe(200);
  });

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("requires runtime admin, keeps legacy orders shadow, and denies outsiders", async () => {
    const deniedRuntime = await setRuntime("real", fixture.kitchenUser);
    expect(deniedRuntime.statusCode).toBe(403);

    const shadowProductBefore = await productBalance(fixture.kitchenBranchId, fixture.stockedProductId);
    const shadowMaterialBefore = await warehouseBalance(fixture.kitchenBranchId, fixture.materialId);
    const shadow = await createOrder([
      {
        productId: fixture.stockedProductId,
        productName: (await databaseState.db.select().from(products)
          .where(eq(products.id, fixture.stockedProductId)))[0].name,
        requestedQuantity: 1.5,
        unit: "tray",
      },
      {
        productName: "Legacy manual line",
        requestedQuantity: 1,
        unit: "tray",
      },
    ]);
    expect(shadow.statusCode).toBe(201);
    expect(shadow.body.inventoryMode).toBe("shadow");

    const outsiderRead = await invoke("get", "/api/central-kitchen-orders/:id", {
      user: fixture.outsiderUser,
      params: { id: String(shadow.body.id) },
    });
    expect(outsiderRead.statusCode).toBe(403);
    const outsiderAvailability = await invoke("get", "/api/central-kitchen-orders/availability", {
      user: fixture.outsiderUser,
      query: { kitchenId: fixture.kitchenBranchId, productId: fixture.stockedProductId },
    });
    expect(outsiderAvailability.statusCode).toBe(403);
    const outsiderOperations = await invoke("get", "/api/central-kitchen-orders/operations", {
      user: fixture.outsiderUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(outsiderOperations.statusCode).toBe(403);

    expect((await setRuntime("real")).statusCode).toBe(200);
    expect((await approve(shadow.body.id)).statusCode).toBe(200);
    const prepared = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(shadow.body.id) },
      body: {
        idempotencyKey: key("shadow-prepare"),
        items: [
          { itemId: shadow.body.items[0].id, preparedQuantity: 1.5, substituteQuantity: 0 },
          { itemId: shadow.body.items[1].id, preparedQuantity: 1, substituteQuantity: 0 },
        ],
      },
    });
    expect(prepared.statusCode).toBe(200);
    const dispatched = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(shadow.body.id) },
      body: {
        idempotencyKey: key("shadow-dispatch"),
        driverName: "Shadow Driver",
        vehicleNumber: "SHADOW-1",
        items: [
          { itemId: shadow.body.items[0].id, dispatchedQuantity: 1.5 },
          { itemId: shadow.body.items[1].id, dispatchedQuantity: 1 },
        ],
      },
    });
    expect(dispatched.statusCode).toBe(200);
    const received = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.requestUser,
      params: { id: String(shadow.body.id) },
      body: {
        idempotencyKey: key("shadow-receive"),
        items: [
          { itemId: shadow.body.items[0].id, receivedQuantity: 1.5, damagedQuantity: 0 },
          { itemId: shadow.body.items[1].id, receivedQuantity: 1, damagedQuantity: 0 },
        ],
      },
    });
    expect(received.statusCode).toBe(200);
    expect(await productBalance(fixture.kitchenBranchId, fixture.stockedProductId)).toEqual(shadowProductBefore);
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.materialId)).toEqual(shadowMaterialBefore);
  });

  it("snapshots real mode and rejects manual, fractional, paused, and wrong-unit work", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.stockedProductId)))[0];
    const material = (await databaseState.db.select().from(warehouseItems)
      .where(eq(warehouseItems.id, fixture.materialId)))[0];

    const manual = await createOrder([{
      productName: "Manual real line",
      requestedQuantity: 1,
      unit: "tray",
    }]);
    expect(manual.statusCode).toBe(400);

    const fractional = await createOrder([{
      productId: fixture.stockedProductId,
      productName: product.name,
      requestedQuantity: 1.5,
      unit: "tray",
    }]);
    expect(fractional.statusCode).toBe(400);

    const created = await createOrder([
      {
        productId: fixture.stockedProductId,
        productName: product.name,
        requestedQuantity: 5,
        unit: "tray",
      },
      {
        warehouseItemId: fixture.materialId,
        productName: material.name,
        requestedQuantity: 5,
        unit: "tray",
      },
    ]);
    expect(created.statusCode).toBe(201);
    expect(created.body.inventoryMode).toBe("real");
    await approve(created.body.id);

    const wrongUnit = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(created.body.id) },
      body: {
        idempotencyKey: key("wrong-unit"),
        items: [
          {
            itemId: created.body.items[0].id,
            preparedQuantity: 5,
            substituteQuantity: 0,
          },
          {
            itemId: created.body.items[1].id,
            preparedQuantity: 4,
            substituteQuantity: 1,
            substituteWarehouseItemId: fixture.wrongUnitMaterialId,
            substituteProductName: (await databaseState.db.select().from(warehouseItems)
              .where(eq(warehouseItems.id, fixture.wrongUnitMaterialId)))[0].name,
            substituteUnit: "tray",
          },
        ],
      },
    });
    expect(wrongUnit.statusCode).toBe(400);
    expect(await productBalance(fixture.kitchenBranchId, fixture.stockedProductId))
      .toEqual({ quantity: 10, reserved: 0 });
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.materialId))
      .toEqual({ quantity: 9, reserved: 0 });

    expect((await setRuntime("paused")).statusCode).toBe(200);
    const pausedCreate = await createOrder([{
      productId: fixture.stockedProductId,
      productName: product.name,
      requestedQuantity: 1,
      unit: "tray",
    }]);
    expect(pausedCreate.statusCode).toBe(423);
    const pausedPrepare = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(created.body.id) },
      body: {
        idempotencyKey: key("paused-prepare"),
        items: [
          { itemId: created.body.items[0].id, preparedQuantity: 5, substituteQuantity: 0 },
          { itemId: created.body.items[1].id, preparedQuantity: 5, substituteQuantity: 0 },
        ],
      },
    });
    expect(pausedPrepare.statusCode).toBe(423);
    await setRuntime("real");
  });

  it("reserves kitchen-local product and material stock, prevents overspend, and posts only good receipts once", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.stockedProductId)))[0];
    const material = (await databaseState.db.select().from(warehouseItems)
      .where(eq(warehouseItems.id, fixture.materialId)))[0];
    const order = await createOrder([
      {
        productId: fixture.stockedProductId,
        productName: product.name,
        requestedQuantity: 7,
        unit: "tray",
      },
      {
        warehouseItemId: fixture.materialId,
        productName: material.name,
        requestedQuantity: 5,
        unit: "tray",
      },
    ]);
    expect(order.statusCode).toBe(201);
    await approve(order.body.id);
    const [productLine, materialLine] = order.body.items;
    const prepareBody = {
      idempotencyKey: key("real-prepare"),
      items: [
        { itemId: productLine.id, preparedQuantity: 7, substituteQuantity: 0 },
        { itemId: materialLine.id, preparedQuantity: 5, substituteQuantity: 0 },
      ],
    };
    const prepared = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: prepareBody,
    });
    expect(prepared.statusCode).toBe(200);
    expect(await productBalance(fixture.kitchenBranchId, fixture.stockedProductId))
      .toEqual({ quantity: 10, reserved: 7 });
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.materialId))
      .toEqual({ quantity: 9, reserved: 5 });

    const competing = await createOrder([{
      productId: fixture.stockedProductId,
      productName: product.name,
      requestedQuantity: 4,
      unit: "tray",
    }]);
    await approve(competing.body.id);
    const overspend = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(competing.body.id) },
      body: {
        idempotencyKey: key("overspend"),
        items: [{ itemId: competing.body.items[0].id, preparedQuantity: 4, substituteQuantity: 0 }],
      },
    });
    expect(overspend.statusCode).toBe(409);

    const kitchenMaterialBeforeDispatch = await warehouseBalance(fixture.kitchenBranchId, fixture.materialId);
    const globalWarehouseBefore = Number(material.currentStock);
    const requestMaterialBefore = await warehouseBalance(fixture.requestBranchId, fixture.materialId);
    const requestProductBefore = await productBalance(fixture.requestBranchId, fixture.stockedProductId);
    const dispatchBody = {
      idempotencyKey: key("real-dispatch"),
      driverName: "Live Driver",
      vehicleNumber: "LIVE-1",
      items: [
        { itemId: productLine.id, dispatchedQuantity: 5 },
        { itemId: materialLine.id, dispatchedQuantity: 3 },
      ],
    };
    const dispatched = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: dispatchBody,
    });
    expect(dispatched.statusCode).toBe(200);
    expect(await productBalance(fixture.kitchenBranchId, fixture.stockedProductId))
      .toEqual({ quantity: 5, reserved: 0 });
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.materialId))
      .toEqual({ quantity: kitchenMaterialBeforeDispatch.quantity - 3, reserved: 0 });
    const [globalWarehouseAfter] = await databaseState.db.select({ stock: warehouseItems.currentStock })
      .from(warehouseItems).where(eq(warehouseItems.id, fixture.materialId));
    expect(Number(globalWarehouseAfter.stock)).toBe(globalWarehouseBefore);

    const allocationRows = await databaseState.db.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id));
    expect(allocationRows.reduce((sum: number, row: any) => sum + row.releasedQuantity, 0)).toBe(4);

    const receiveBody = {
      idempotencyKey: key("real-receive"),
      items: [
        {
          itemId: productLine.id,
          receivedQuantity: 3,
          damagedQuantity: 1,
          receivingNotes: "One damaged and one missing",
        },
        {
          itemId: materialLine.id,
          receivedQuantity: 2,
          damagedQuantity: 1,
          receivingNotes: "One material damaged",
        },
      ],
    };
    const received = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.requestUser,
      params: { id: String(order.body.id) },
      body: receiveBody,
    });
    expect(received.statusCode).toBe(200);
    expect(await productBalance(fixture.requestBranchId, fixture.stockedProductId))
      .toEqual({ quantity: requestProductBefore.quantity + 3, reserved: 0 });
    expect(await warehouseBalance(fixture.requestBranchId, fixture.materialId))
      .toEqual({ quantity: requestMaterialBefore.quantity + 2, reserved: 0 });

    const balancesAfterReceipt = {
      product: await productBalance(fixture.requestBranchId, fixture.stockedProductId),
      material: await warehouseBalance(fixture.requestBranchId, fixture.materialId),
    };
    const allocationsBeforeReplay = await databaseState.db.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id));
    const movementsBeforeReplay = await databaseState.db.select().from(centralKitchenInventoryMovements)
      .where(eq(centralKitchenInventoryMovements.orderId, order.body.id));
    const dispatchReplay = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: dispatchBody,
    });
    expect(dispatchReplay.headers["idempotent-replayed"]).toBe("true");
    const receiveReplay = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.requestUser,
      params: { id: String(order.body.id) },
      body: receiveBody,
    });
    expect(receiveReplay.headers["idempotent-replayed"]).toBe("true");
    expect({
      product: await productBalance(fixture.requestBranchId, fixture.stockedProductId),
      material: await warehouseBalance(fixture.requestBranchId, fixture.materialId),
    }).toEqual(balancesAfterReceipt);
    expect(await databaseState.db.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id))).toEqual(allocationsBeforeReplay);
    expect(await databaseState.db.select().from(centralKitchenInventoryMovements)
      .where(eq(centralKitchenInventoryMovements.orderId, order.body.id))).toEqual(movementsBeforeReplay);
  });

  it("creates a linked production batch and the existing finish route credits canonical stock exactly once", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.productionProductId)))[0];
    const order = await createOrder([{
      productId: fixture.productionProductId,
      productName: product.name,
      requestedQuantity: 4,
      unit: "tray",
    }]);
    expect(order.statusCode).toBe(201);
    expect((await approve(order.body.id)).statusCode).toBe(200);
    const line = order.body.items[0];
    const productionDate = "2098-02-01";
    const conflictingKey = await invoke(
      "post",
      "/api/central-kitchen-orders/:id/items/:itemId/production-batches",
      {
        user: fixture.kitchenUser,
        params: { id: String(order.body.id), itemId: String(line.id) },
        headers: { "Idempotency-Key": key("different-header") },
        body: { quantity: 4, productionDate, idempotencyKey: key("linked-batch") },
      },
    );
    expect(conflictingKey.statusCode).toBe(400);
    expect(conflictingKey.body.error).toContain("لا يطابق");
    const createdBatch = await invoke(
      "post",
      "/api/central-kitchen-orders/:id/items/:itemId/production-batches",
      {
        user: fixture.kitchenUser,
        params: { id: String(order.body.id), itemId: String(line.id) },
        body: { quantity: 4, productionDate, idempotencyKey: key("linked-batch") },
      },
    );
    expect(createdBatch.statusCode).toBe(201);
    expect(createdBatch.body).toMatchObject({
      branchId: fixture.kitchenBranchId,
      productId: fixture.productionProductId,
      centralKitchenOrderItemId: line.id,
      status: "in_progress",
    });

    const browserReplay = await invoke(
      "post",
      "/api/central-kitchen-orders/:id/items/:itemId/production-batches",
      {
        user: fixture.kitchenUser,
        params: { id: String(order.body.id), itemId: String(line.id) },
        body: { quantity: 4, productionDate, idempotencyKey: key("linked-batch") },
      },
    );
    expect(browserReplay.statusCode).toBe(200);
    expect(browserReplay.headers["idempotent-replayed"]).toBe("true");
    expect(browserReplay.body.id).toBe(createdBatch.body.id);

    const replay = await invoke(
      "post",
      "/api/central-kitchen-orders/:id/items/:itemId/production-batches",
      {
        user: fixture.kitchenUser,
        params: { id: String(order.body.id), itemId: String(line.id) },
        headers: { "Idempotency-Key": key("linked-batch-retry") },
        body: { quantity: 4, productionDate },
      },
    );
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.body.id).toBe(createdBatch.body.id);

    const before = await productBalance(fixture.kitchenBranchId, fixture.productionProductId);
    const shadowedRuntime = await setRuntime("shadow");
    expect(shadowedRuntime.statusCode).toBe(200);
    expect(shadowedRuntime.body.mode).toBe("shadow");
    const finished = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(createdBatch.body.id) },
    });
    expect(finished.statusCode).toBe(200);
    expect(finished.body.status).toBe("finished");
    expect(await productBalance(fixture.kitchenBranchId, fixture.productionProductId))
      .toEqual({ quantity: before.quantity + 4, reserved: 0 });

    const finishedReplay = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(createdBatch.body.id) },
    });
    expect(finishedReplay.statusCode).toBe(200);
    expect(await productBalance(fixture.kitchenBranchId, fixture.productionProductId))
      .toEqual({ quantity: before.quantity + 4, reserved: 0 });
    const movements = await databaseState.db.select().from(productionInventoryLogs)
      .where(eq(productionInventoryLogs.batchId, createdBatch.body.id));
    expect(movements).toHaveLength(1);
    await setRuntime("real");
  });

  it("uses only verified recipe-backed output as a preparation source, while reserving and debiting the full prepared total", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.mismatchProductId)))[0];
    const [recipe] = await databaseState.db.insert(centralKitchenRecipes).values({
      kitchenId: fixture.kitchenBranchId,
      productId: product.id,
      outputQuantity: "1.000000",
      outputUnit: "tray",
      status: "draft",
      version: 1,
      createdBy: fixture.kitchenUser.id,
      updatedBy: fixture.kitchenUser.id,
    }).returning();
    await databaseState.db.insert(centralKitchenRecipeIngredients).values({
      recipeId: recipe.id,
      warehouseItemId: fixture.materialId,
      quantity: "1.000000",
      unit: "tray",
    });
    await databaseState.db.update(centralKitchenRecipes).set({
      status: "approved",
      approvedBy: fixture.kitchenUser.id,
      approvedAt: new Date(),
      updatedBy: fixture.kitchenUser.id,
    }).where(eq(centralKitchenRecipes.id, recipe.id));

    const order = await createOrder([{
      productId: product.id,
      productName: product.name,
      requestedQuantity: 2,
      unit: "tray",
    }]);
    expect(order.statusCode).toBe(201);
    expect((await approve(order.body.id)).statusCode).toBe(200);
    const line = order.body.items[0];

    const noEvidence = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: {
        idempotencyKey: key("unverified-production"),
        items: [{
          itemId: line.id, preparedQuantity: 2, substituteQuantity: 0,
          preparedFromStock: 0, preparedFromProduction: 2,
        }],
      },
    });
    expect(noEvidence.statusCode).toBe(409);
    expect((await databaseState.db.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id)))).toHaveLength(0);

    const linked = await invoke("post", "/api/central-kitchen-orders/:id/items/:itemId/production-batches", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id), itemId: String(line.id) },
      body: {
        quantity: 2,
        productionDate: "2098-02-02",
        recipeBacked: true,
        idempotencyKey: key("verified-production"),
      },
    });
    expect(linked.statusCode).toBe(201);
    expect((await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(linked.body.id) },
    })).statusCode).toBe(200);

    const availability = await invoke(
      "get",
      "/api/central-kitchen-orders/:id/items/:itemId/production-fulfillment",
      { user: fixture.kitchenUser, params: { id: String(order.body.id), itemId: String(line.id) } },
    );
    expect(availability.statusCode).toBe(200);
    expect(availability.body).toMatchObject({
      eligibleQuantity: 2,
      batches: [{ batchId: linked.body.id, quantity: 2 }],
    });

    const prepared = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: {
        idempotencyKey: key("verified-prepare"),
        items: [{
          itemId: line.id, preparedQuantity: 2, substituteQuantity: 0,
          preparedFromStock: 1, preparedFromProduction: 1,
        }],
      },
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.body.items[0]).toMatchObject({
      preparedFromStock: 1,
      preparedFromProduction: 1,
      productionFulfillmentEvidence: {
        version: 1,
        batches: [{ batchId: linked.body.id, quantity: "1.000000", checksum: expect.any(String) }],
      },
    });
    const allocations = await databaseState.db.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id));
    expect(allocations.reduce((sum: number, allocation: any) => sum + Number(allocation.reservedQuantity), 0)).toBe(2);

    const dispatched = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: {
        idempotencyKey: key("verified-dispatch"),
        driverName: "Production proof driver",
        vehicleNumber: "PROOF-1",
        items: [{ itemId: line.id, dispatchedQuantity: 2 }],
      },
    });
    expect(dispatched.statusCode).toBe(200);
    const debits = await databaseState.db.select().from(centralKitchenInventoryMovements)
      .where(and(
        eq(centralKitchenInventoryMovements.orderId, order.body.id),
        eq(centralKitchenInventoryMovements.movementType, "dispatch_debit"),
      ));
    expect(debits).toHaveLength(1);
    expect(Number(debits[0].quantity)).toBe(2);
  });

  it("accepts a production-only preparation after verifying the linked batch evidence", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.productionProductId)))[0];
    const [recipe] = await databaseState.db.insert(centralKitchenRecipes).values({
      kitchenId: fixture.kitchenBranchId,
      productId: product.id,
      outputQuantity: "1.000000",
      outputUnit: "tray",
      status: "draft",
      version: 1,
      createdBy: fixture.kitchenUser.id,
      updatedBy: fixture.kitchenUser.id,
    }).returning();
    await databaseState.db.insert(centralKitchenRecipeIngredients).values({
      recipeId: recipe.id,
      warehouseItemId: fixture.materialId,
      quantity: "1.000000",
      unit: "tray",
    });
    await databaseState.db.update(centralKitchenRecipes).set({
      status: "approved",
      approvedBy: fixture.kitchenUser.id,
      approvedAt: new Date(),
      updatedBy: fixture.kitchenUser.id,
    }).where(eq(centralKitchenRecipes.id, recipe.id));

    const order = await createOrder([{
      productId: product.id,
      productName: product.name,
      requestedQuantity: 1,
      unit: "tray",
    }]);
    expect(order.statusCode).toBe(201);
    expect((await approve(order.body.id)).statusCode).toBe(200);
    const line = order.body.items[0];
    const linked = await invoke("post", "/api/central-kitchen-orders/:id/items/:itemId/production-batches", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id), itemId: String(line.id) },
      body: {
        quantity: 1,
        productionDate: "2098-02-04",
        recipeBacked: true,
        idempotencyKey: key("production-only-linked"),
      },
    });
    expect(linked.statusCode).toBe(201);
    expect((await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(linked.body.id) },
    })).statusCode).toBe(200);

    const prepared = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: {
        idempotencyKey: key("production-only-prepare"),
        items: [{
          itemId: line.id,
          preparedQuantity: 1,
          preparedFromStock: 0,
          preparedFromProduction: 1,
          substituteQuantity: 0,
        }],
      },
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.body.items[0]).toMatchObject({
      preparedFromStock: 0,
      preparedFromProduction: 1,
      productionFulfillmentEvidence: {
        version: 1,
        batches: [{ batchId: linked.body.id, quantity: "1.000000", checksum: expect.any(String) }],
      },
    });
    const allocations = await databaseState.db.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id));
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({
      kind: "product",
      catalogId: fixture.productionProductId,
      reservedQuantity: 1,
    });
  });

  it("allows linked production only for real approved orders and kitchen-side actors", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.guardedProductId)))[0];

    await setRuntime("shadow");
    const shadow = await createOrder([{
      productId: product.id,
      productName: product.name,
      requestedQuantity: 5,
      unit: "tray",
    }]);
    expect(shadow.statusCode).toBe(201);
    expect(shadow.body.inventoryMode).toBe("shadow");
    const shadowBatch = await createLinkedBatch(
      shadow.body.id,
      shadow.body.items[0].id,
      2,
      "2098-03-01",
    );
    expect(shadowBatch.statusCode).toBe(409);

    await setRuntime("real");
    const requested = await createOrder([{
      productId: product.id,
      productName: product.name,
      requestedQuantity: 5,
      unit: "tray",
    }]);
    expect(requested.statusCode).toBe(201);
    const requestedBatch = await createLinkedBatch(
      requested.body.id,
      requested.body.items[0].id,
      2,
      "2098-03-02",
    );
    expect(requestedBatch.statusCode).toBe(409);

    expect((await approve(requested.body.id)).statusCode).toBe(200);
    const requestBranchDenied = await createLinkedBatch(
      requested.body.id,
      requested.body.items[0].id,
      2,
      "2098-03-02",
      fixture.requestUser,
    );
    expect(requestBranchDenied.statusCode).toBe(403);
    const kitchenCreated = await createLinkedBatch(
      requested.body.id,
      requested.body.items[0].id,
      2,
      "2098-03-02",
    );
    expect(kitchenCreated.statusCode).toBe(201);
  });

  it("does not double-credit a historical finished batch whose old ledger row has null batch_id", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.historicalProductId)))[0];
    const productionDate = "2098-04-01";
    const [batch] = await databaseState.db.insert(dailyProductionBatches).values({
      branchId: fixture.kitchenBranchId,
      productId: product.id,
      productName: product.name,
      productCategory: product.category,
      quantity: 6,
      unit: "tray",
      destination: "central_kitchen_order",
      productionDate,
      status: "finished",
      recordedBy: fixture.kitchenUser.id,
    }).returning();
    await databaseState.db.insert(finishedGoodsInventory).values({
      branchId: fixture.kitchenBranchId,
      productId: product.id,
      productName: product.name,
      productNameNormalized: product.name.trim().toLowerCase(),
      productCategory: product.category,
      quantity: 6,
      reservedQuantity: 0,
      unit: "tray",
      productionDate,
      lastBatchId: batch.id,
    });
    await databaseState.db.insert(productionInventoryLogs).values({
      branchId: fixture.kitchenBranchId,
      productId: product.id,
      productName: product.name,
      movementType: "production_in",
      quantity: 6,
      balanceBefore: 0,
      balanceAfter: 6,
      referenceType: "batch",
      referenceId: batch.id,
      batchId: null,
      notes: `Legacy posting for batch #${batch.id}`,
    });

    const before = await productBalance(fixture.kitchenBranchId, product.id);
    const finished = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(batch.id) },
    });
    expect(finished.statusCode).toBe(200);
    const genericReplay = await invoke("post", "/api/finished-goods-inventory/from-batch/:batchId", {
      user: fixture.kitchenUser,
      params: { batchId: String(batch.id) },
    });
    // Historical provenance is ambiguous, so an explicit refusal is valid;
    // the critical invariant is that retrying cannot credit it a second time.
    expect(genericReplay.statusCode).toBeGreaterThanOrEqual(400);
    expect(await productBalance(fixture.kitchenBranchId, product.id)).toEqual(before);
    const logs = await databaseState.db.select().from(productionInventoryLogs).where(and(
      eq(productionInventoryLogs.referenceType, "batch"),
      eq(productionInventoryLogs.referenceId, batch.id),
    ));
    expect(logs).toHaveLength(1);
  });

  it("blocks linked finishing and the generic poster while the real kitchen is paused", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.mismatchProductId)))[0];
    const order = await createOrder([{
      productId: product.id,
      productName: product.name,
      requestedQuantity: 4,
      unit: "tray",
    }]);
    expect(order.statusCode).toBe(201);
    expect((await approve(order.body.id)).statusCode).toBe(200);
    const linked = await createLinkedBatch(
      order.body.id,
      order.body.items[0].id,
      4,
      "2098-05-01",
    );
    expect(linked.statusCode).toBe(201);
    await setRuntime("paused");

    const finish = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(linked.body.id) },
    });
    const [afterFinish] = await databaseState.db.select().from(dailyProductionBatches)
      .where(eq(dailyProductionBatches.id, linked.body.id));
    const balanceAfterFinish = await productBalance(fixture.kitchenBranchId, product.id);

    await databaseState.db.update(dailyProductionBatches).set({ status: "finished" })
      .where(eq(dailyProductionBatches.id, linked.body.id));
    const genericPost = await invoke("post", "/api/finished-goods-inventory/from-batch/:batchId", {
      user: fixture.kitchenUser,
      params: { batchId: String(linked.body.id) },
    });
    const balanceAfterGeneric = await productBalance(fixture.kitchenBranchId, product.id);
    await setRuntime("real");

    expect(finish.statusCode).toBe(423);
    expect(afterFinish.status).toBe("in_progress");
    expect(balanceAfterFinish).toEqual({ quantity: 0, reserved: 0 });
    expect(genericPost.statusCode).toBe(423);
    expect(balanceAfterGeneric).toEqual({ quantity: 0, reserved: 0 });
  });

  it("cannot allocate two linked production dates beyond the order's remaining demand", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.guardedProductId)))[0];
    const order = await createOrder([{
      productId: product.id,
      productName: product.name,
      requestedQuantity: 5,
      unit: "tray",
    }]);
    expect(order.statusCode).toBe(201);
    expect((await approve(order.body.id)).statusCode).toBe(200);
    const first = await createLinkedBatch(order.body.id, order.body.items[0].id, 3, "2098-06-01");
    expect(first.statusCode).toBe(201);
    const excessiveSecond = await createLinkedBatch(order.body.id, order.body.items[0].id, 3, "2098-06-02");
    expect(excessiveSecond.statusCode).toBe(409);
    expect(excessiveSecond.body.error).toContain("(2)");
    const batches = await databaseState.db.select().from(dailyProductionBatches)
      .where(eq(dailyProductionBatches.centralKitchenOrderItemId, order.body.items[0].id));
    expect(batches).toHaveLength(1);
  });

  it("rejects canonical name/date collisions instead of crediting a mismatched product", async () => {
    const canonical = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.historicalProductId)))[0];
    const mismatched = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.mismatchProductId)))[0];
    const productionDate = "2098-07-01";
    await databaseState.db.insert(finishedGoodsInventory).values({
      branchId: fixture.kitchenBranchId,
      productId: canonical.id,
      productName: mismatched.name,
      productNameNormalized: mismatched.name.trim().toLowerCase(),
      productCategory: canonical.category,
      quantity: 2,
      reservedQuantity: 0,
      unit: "tray",
      productionDate,
    });
    const [batch] = await databaseState.db.insert(dailyProductionBatches).values({
      branchId: fixture.kitchenBranchId,
      productId: mismatched.id,
      productName: mismatched.name,
      productCategory: mismatched.category,
      quantity: 3,
      unit: "tray",
      destination: "freezer",
      productionDate,
      status: "finished",
      recordedBy: fixture.kitchenUser.id,
    }).returning();
    const canonicalBefore = await productBalance(fixture.kitchenBranchId, canonical.id);
    const mismatchedBefore = await productBalance(fixture.kitchenBranchId, mismatched.id);
    const rejected = await invoke("post", "/api/finished-goods-inventory/from-batch/:batchId", {
      user: fixture.kitchenUser,
      params: { batchId: String(batch.id) },
    });
    expect(rejected.statusCode).toBeGreaterThanOrEqual(400);
    expect(await productBalance(fixture.kitchenBranchId, canonical.id)).toEqual(canonicalBefore);
    expect(await productBalance(fixture.kitchenBranchId, mismatched.id)).toEqual(mismatchedBefore);
    expect(await databaseState.db.select().from(productionInventoryLogs)
      .where(eq(productionInventoryLogs.batchId, batch.id))).toHaveLength(0);
  });

  it("makes the live inventory movement ledger immutable for update and delete", async () => {
    const [movement] = await databaseState.db.select().from(centralKitchenInventoryMovements).limit(1);
    expect(movement).toBeTruthy();

    await databaseState.db.execute(sql.raw("SAVEPOINT ck_ledger_update"));
    let updateError: unknown;
    try {
      await databaseState.db.update(centralKitchenInventoryMovements)
        .set({ quantity: movement.quantity + 1 })
        .where(eq(centralKitchenInventoryMovements.id, movement.id));
    } catch (error) {
      updateError = error;
    }
    await databaseState.db.execute(sql.raw("ROLLBACK TO SAVEPOINT ck_ledger_update"));
    await databaseState.db.execute(sql.raw("RELEASE SAVEPOINT ck_ledger_update"));
    expect(updateError).toBeTruthy();

    await databaseState.db.execute(sql.raw("SAVEPOINT ck_ledger_delete"));
    let deleteError: unknown;
    try {
      await databaseState.db.delete(centralKitchenInventoryMovements)
        .where(eq(centralKitchenInventoryMovements.id, movement.id));
    } catch (error) {
      deleteError = error;
    }
    await databaseState.db.execute(sql.raw("ROLLBACK TO SAVEPOINT ck_ledger_delete"));
    await databaseState.db.execute(sql.raw("RELEASE SAVEPOINT ck_ledger_delete"));
    expect(deleteError).toBeTruthy();
    const [unchanged] = await databaseState.db.select().from(centralKitchenInventoryMovements)
      .where(eq(centralKitchenInventoryMovements.id, movement.id));
    expect(unchanged).toEqual(movement);
  });

  it("groups operations demand so shared availability is never counted twice", async () => {
    const product = (await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.operationsProductId)))[0];
    const available = (await productBalance(fixture.kitchenBranchId, fixture.operationsProductId)).quantity;
    expect(available).toBe(4);
    const first = await createOrder([{
      productId: fixture.operationsProductId,
      productName: product.name,
      requestedQuantity: 3,
      unit: "tray",
    }]);
    const second = await createOrder([{
      productId: fixture.operationsProductId,
      productName: product.name,
      requestedQuantity: 3,
      unit: "tray",
    }]);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect((await approve(first.body.id)).statusCode).toBe(200);
    expect((await approve(second.body.id)).statusCode).toBe(200);
    const requestedOnly = await createOrder([{
      productId: fixture.operationsProductId,
      productName: product.name,
      requestedQuantity: 1,
      unit: "tray",
    }]);
    expect(requestedOnly.statusCode).toBe(201);

    const operations = await invoke("get", "/api/central-kitchen-orders/operations", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(operations.statusCode).toBe(200);
    const shadowOrder = await databaseState.db.select({ id: centralKitchenOrders.id })
      .from(centralKitchenOrders)
      .where(and(
        eq(centralKitchenOrders.centralKitchenId, fixture.kitchenBranchId),
        eq(centralKitchenOrders.inventoryMode, "shadow"),
        eq(centralKitchenOrders.status, "requested"),
      ));
    expect(shadowOrder.length).toBeGreaterThan(0);
    expect(operations.body.demands.map((demand: any) => demand.orderId))
      .not.toEqual(expect.arrayContaining(shadowOrder.map((order: any) => order.id)));
    expect(operations.body.demands.map((demand: any) => demand.orderId))
      .not.toContain(requestedOnly.body.id);
    const demands = operations.body.demands.filter((demand: any) =>
      demand.orderId === first.body.id || demand.orderId === second.body.id);
    expect(demands).toHaveLength(2);
    expect(demands.reduce((sum: number, demand: any) => sum + demand.availableQuantity, 0))
      .toBe(Math.min(available, 6));
    expect(demands.reduce((sum: number, demand: any) => sum + demand.uncoveredQuantity, 0))
      .toBe(Math.max(0, 6 - available));

    const uncovered = demands.find((demand: any) => demand.uncoveredQuantity > 0);
    expect(uncovered).toMatchObject({ uncoveredQuantity: 2 });
    const batch = await createLinkedBatch(
      uncovered.orderId,
      uncovered.orderItemId,
      uncovered.uncoveredQuantity,
      "2098-08-01",
    );
    expect(batch.statusCode).toBe(201);
    expect(batch.body).toMatchObject({
      centralKitchenOrderItemId: uncovered.orderItemId,
      quantity: 2,
      status: "in_progress",
    });
  });

  it("keeps recipe-backed IDs and frozen names through catalogue recode and the full real-order lifecycle", async () => {
    await setRuntime("real");
    const [product] = await databaseState.db.select().from(products)
      .where(eq(products.id, fixture.recodeProductId));
    const [material] = await databaseState.db.select().from(warehouseItems)
      .where(eq(warehouseItems.id, fixture.recodeMaterialId));
    const oldProductName = product.name;
    const oldMaterialName = material.name;
    const oldProductSku = product.sku;
    const oldMaterialSku = material.sku;

    const createdRecipe = await invoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      body: {
        kitchenId: fixture.kitchenBranchId,
        productId: fixture.recodeProductId,
        outputQuantity: 1,
        outputUnit: product.unit,
        ingredients: [{
          warehouseItemId: fixture.recodeMaterialId,
          quantity: 0.5,
          unit: material.unit,
        }],
        notes: "Catalogue recode lifecycle recipe",
        idempotencyKey: key("recode-recipe"),
      },
    });
    expect(createdRecipe.statusCode).toBe(201);
    const draft = createdRecipe.body.recipe || createdRecipe.body.data || createdRecipe.body;
    const approvedRecipe = await invoke("post", "/api/central-kitchen-recipes/:id/approve", {
      user: fixture.kitchenUser,
      params: { id: String(draft.id) },
      body: {
        version: draft.version,
        updateToken: draft.updateToken,
        idempotencyKey: key("recode-recipe-approve"),
      },
    });
    expect(approvedRecipe.statusCode).toBe(200);
    const approved = approvedRecipe.body.recipe || approvedRecipe.body.data || approvedRecipe.body;
    expect(approved).toMatchObject({
      id: draft.id,
      productId: fixture.recodeProductId,
      status: "approved",
    });

    const order = await createOrder([
      {
        productId: fixture.recodeProductId,
        productName: oldProductName,
        requestedQuantity: 2,
        unit: product.unit,
      },
      {
        warehouseItemId: fixture.recodeMaterialId,
        productName: oldMaterialName,
        requestedQuantity: 2,
        unit: material.unit,
      },
    ]);
    expect(order.statusCode).toBe(201);
    expect((await approve(order.body.id)).statusCode).toBe(200);
    const productLine = order.body.items.find((item: any) => item.productId === fixture.recodeProductId);
    const materialLine = order.body.items.find((item: any) => item.warehouseItemId === fixture.recodeMaterialId);
    expect(productLine).toMatchObject({
      productId: fixture.recodeProductId,
      productName: oldProductName,
      unit: product.unit,
    });
    expect(materialLine).toMatchObject({
      warehouseItemId: fixture.recodeMaterialId,
      productName: oldMaterialName,
      unit: material.unit,
    });

    const batchKey = key("recode-batch");
    const linked = await invoke(
      "post",
      "/api/central-kitchen-orders/:id/items/:itemId/production-batches",
      {
        user: fixture.kitchenUser,
        params: { id: String(order.body.id), itemId: String(productLine.id) },
        body: {
          quantity: 1,
          productionDate: "2098-09-02",
          recipeBacked: true,
          idempotencyKey: batchKey,
        },
      },
    );
    expect(linked.statusCode).toBe(201);
    expect(linked.body).toMatchObject({
      productId: fixture.recodeProductId,
      productName: oldProductName,
      centralKitchenOrderItemId: productLine.id,
      recipeBacked: true,
      status: "in_progress",
    });

    const frozenBeforeRecode = await databaseState.db.execute(sql`
      SELECT kitchen_id, product_id, source_recipe_id, source_recipe_version,
             recipe_output_quantity::text, recipe_output_unit, batch_output_quantity::text,
             ingredient_count, ingredient_checksum
      FROM central_kitchen_batch_recipe_snapshots
      WHERE batch_id = ${linked.body.id}
    `);
    const frozenMaterialsBeforeRecode = await databaseState.db.execute(sql`
      SELECT warehouse_item_id, material_name, unit, recipe_quantity::text, required_quantity::text
      FROM central_kitchen_batch_materials
      WHERE batch_id = ${linked.body.id}
    `);
    expect(frozenBeforeRecode.rows).toEqual([expect.objectContaining({
      kitchen_id: fixture.kitchenBranchId,
      product_id: fixture.recodeProductId,
      source_recipe_id: approved.id,
      source_recipe_version: approved.version,
      recipe_output_quantity: "1.000000",
      recipe_output_unit: product.unit,
      batch_output_quantity: "1.000000",
      ingredient_count: 1,
      ingredient_checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    })]);
    expect(frozenMaterialsBeforeRecode.rows).toEqual([{
      warehouse_item_id: fixture.recodeMaterialId,
      material_name: oldMaterialName,
      unit: material.unit,
      recipe_quantity: "0.500000",
      required_quantity: "0.500000",
    }]);

    const recodedProductName = `${oldProductName} recoded`;
    const recodedMaterialName = `${oldMaterialName} recoded`;
    const recodedProductSku = `${oldProductSku}-NEW`;
    const recodedMaterialSku = `${oldMaterialSku}-NEW`;
    await databaseState.db.update(products).set({
      name: recodedProductName,
      sku: recodedProductSku,
      unit: product.unit,
    }).where(eq(products.id, fixture.recodeProductId));
    await databaseState.db.update(warehouseItems).set({
      name: recodedMaterialName,
      sku: recodedMaterialSku,
      unit: material.unit,
    }).where(eq(warehouseItems.id, fixture.recodeMaterialId));

    const recodedCatalog = await databaseState.db.execute(sql`
      SELECT id, name, sku, unit FROM products WHERE id = ${fixture.recodeProductId}
      UNION ALL
      SELECT id, name, sku, unit FROM warehouse_items WHERE id = ${fixture.recodeMaterialId}
      ORDER BY id
    `);
    expect(recodedCatalog.rows).toEqual([
      { id: fixture.recodeProductId, name: recodedProductName, sku: recodedProductSku, unit: product.unit },
      { id: fixture.recodeMaterialId, name: recodedMaterialName, sku: recodedMaterialSku, unit: material.unit },
    ]);

    const materialBeforeFinish = await warehouseBalance(fixture.kitchenBranchId, fixture.recodeMaterialId);
    const productBeforeFinish = await productBalance(fixture.kitchenBranchId, fixture.recodeProductId);
    expect(materialBeforeFinish).toEqual({ quantity: 3, reserved: 0 });
    expect(productBeforeFinish).toEqual({ quantity: 1, reserved: 0 });

    const finished = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(linked.body.id) },
    });
    expect(finished.statusCode).toBe(200);
    expect(finished.body).toMatchObject({
      id: linked.body.id,
      productId: fixture.recodeProductId,
      status: "finished",
    });
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.recodeMaterialId))
      .toEqual({ quantity: 2.5, reserved: 0 });
    expect(await productBalance(fixture.kitchenBranchId, fixture.recodeProductId))
      .toEqual({ quantity: 2, reserved: 0 });

    const materialMovementsAfterFinish = await databaseState.db.execute(sql`
      SELECT warehouse_item_id, quantity::text, unit
      FROM central_kitchen_batch_material_movements
      WHERE batch_id = ${linked.body.id}
    `);
    const outputLogsAfterFinish = await databaseState.db.execute(sql`
      SELECT product_id, quantity::text, movement_type, batch_id
      FROM production_inventory_logs
      WHERE batch_id = ${linked.body.id}
    `);
    expect(materialMovementsAfterFinish.rows).toEqual([{
      warehouse_item_id: fixture.recodeMaterialId,
      quantity: "0.500000",
      unit: material.unit,
    }]);
    expect(outputLogsAfterFinish.rows).toEqual([{
      product_id: fixture.recodeProductId,
      quantity: "1",
      movement_type: "production_in",
      batch_id: linked.body.id,
    }]);

    const finishReplay = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(linked.body.id) },
    });
    expect(finishReplay.statusCode).toBe(200);
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.recodeMaterialId))
      .toEqual({ quantity: 2.5, reserved: 0 });
    expect(await productBalance(fixture.kitchenBranchId, fixture.recodeProductId))
      .toEqual({ quantity: 2, reserved: 0 });
    expect((await databaseState.db.execute(sql`
      SELECT warehouse_item_id FROM central_kitchen_batch_material_movements WHERE batch_id = ${linked.body.id}
    `)).rows).toEqual(materialMovementsAfterFinish.rows.map((row: any) => ({
      warehouse_item_id: row.warehouse_item_id,
    })));
    expect((await databaseState.db.execute(sql`
      SELECT product_id, quantity::text, movement_type, batch_id
      FROM production_inventory_logs WHERE batch_id = ${linked.body.id}
    `)).rows).toEqual(outputLogsAfterFinish.rows);

    const prepared = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: {
        idempotencyKey: key("recode-prepare"),
        items: [
          {
            itemId: productLine.id,
            preparedQuantity: 2,
            preparedFromStock: 1,
            preparedFromProduction: 1,
            substituteQuantity: 0,
          },
          {
            itemId: materialLine.id,
            preparedQuantity: 2,
            substituteQuantity: 0,
          },
        ],
      },
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.body.items.find((item: any) => item.id === productLine.id)).toMatchObject({
      productId: fixture.recodeProductId,
      preparedFromStock: 1,
      preparedFromProduction: 1,
      productionFulfillmentEvidence: {
        version: 1,
        batches: [{ batchId: linked.body.id, quantity: "1.000000", checksum: expect.any(String) }],
      },
    });
    expect(await productBalance(fixture.kitchenBranchId, fixture.recodeProductId))
      .toEqual({ quantity: 2, reserved: 2 });
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.recodeMaterialId))
      .toEqual({ quantity: 2.5, reserved: 2 });

    const requestProductBefore = await productBalance(fixture.requestBranchId, fixture.recodeProductId);
    const requestMaterialBefore = await warehouseBalance(fixture.requestBranchId, fixture.recodeMaterialId);
    expect(requestProductBefore).toEqual({ quantity: 0, reserved: 0 });
    expect(requestMaterialBefore).toEqual({ quantity: 4, reserved: 0 });

    const dispatchBody = {
      idempotencyKey: key("recode-dispatch"),
      driverName: "Catalogue Recode Driver",
      vehicleNumber: "RECODE-1",
      items: [
        { itemId: productLine.id, dispatchedQuantity: 2 },
        { itemId: materialLine.id, dispatchedQuantity: 2 },
      ],
    };
    const dispatched = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: dispatchBody,
    });
    expect(dispatched.statusCode).toBe(200);
    expect(await productBalance(fixture.kitchenBranchId, fixture.recodeProductId))
      .toEqual({ quantity: 0, reserved: 0 });
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.recodeMaterialId))
      .toEqual({ quantity: 0.5, reserved: 0 });

    const receiveBody = {
      idempotencyKey: key("recode-receive"),
      items: [
        {
          itemId: productLine.id,
          receivedQuantity: 1,
          damagedQuantity: 1,
          receivingNotes: "One good and one damaged after recode",
        },
        {
          itemId: materialLine.id,
          receivedQuantity: 1,
          damagedQuantity: 0,
          receivingNotes: "One kilogram missing after recode",
        },
      ],
    };
    const received = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.requestUser,
      params: { id: String(order.body.id) },
      body: receiveBody,
    });
    expect(received.statusCode).toBe(200);
    expect(await productBalance(fixture.requestBranchId, fixture.recodeProductId))
      .toEqual({ quantity: requestProductBefore.quantity + 1, reserved: 0 });
    expect(await warehouseBalance(fixture.requestBranchId, fixture.recodeMaterialId))
      .toEqual({ quantity: requestMaterialBefore.quantity + 1, reserved: 0 });
    expect(received.body).toMatchObject({
      discrepancyStatus: "open",
      items: expect.arrayContaining([
        expect.objectContaining({
          id: productLine.id,
          productId: fixture.recodeProductId,
          receivedQuantity: 1,
          damagedQuantity: 1,
          missingQuantity: 0,
        }),
        expect.objectContaining({
          id: materialLine.id,
          warehouseItemId: fixture.recodeMaterialId,
          receivedQuantity: 1,
          damagedQuantity: 0,
          missingQuantity: 1,
        }),
      ]),
    });

    const allocationsBeforeReplay = await databaseState.db.select()
      .from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id));
    const movementsBeforeReplay = await databaseState.db.select()
      .from(centralKitchenInventoryMovements)
      .where(eq(centralKitchenInventoryMovements.orderId, order.body.id));
    expect(allocationsBeforeReplay).toHaveLength(3);
    expect(allocationsBeforeReplay.map((allocation: any) => [
      allocation.kind,
      allocation.catalogId,
      Number(allocation.reservedQuantity),
      Number(allocation.dispatchedQuantity),
      Number(allocation.receivedQuantity),
      allocation.unit,
    ])).toEqual(expect.arrayContaining([
      ["product", fixture.recodeProductId, 1, 1, 1, product.unit],
      ["product", fixture.recodeProductId, 1, 1, 0, product.unit],
      ["warehouse", fixture.recodeMaterialId, 2, 2, 1, material.unit],
    ]));
    expect(movementsBeforeReplay).toHaveLength(5);
    expect(movementsBeforeReplay.map((movement: any) => [
      movement.movementType,
      movement.catalogId,
      Number(movement.quantity),
      movement.branchId,
    ])).toEqual(expect.arrayContaining([
      ["dispatch_debit", fixture.recodeProductId, 1, fixture.kitchenBranchId],
      ["dispatch_debit", fixture.recodeProductId, 1, fixture.kitchenBranchId],
      ["dispatch_debit", fixture.recodeMaterialId, 2, fixture.kitchenBranchId],
      ["receipt_credit", fixture.recodeProductId, 1, fixture.requestBranchId],
      ["receipt_credit", fixture.recodeMaterialId, 1, fixture.requestBranchId],
    ]));

    const dispatchReplay = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(order.body.id) },
      body: dispatchBody,
    });
    expect(dispatchReplay.statusCode).toBe(200);
    expect(dispatchReplay.headers["idempotent-replayed"]).toBe("true");
    const receiveReplay = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.requestUser,
      params: { id: String(order.body.id) },
      body: receiveBody,
    });
    expect(receiveReplay.statusCode).toBe(200);
    expect(receiveReplay.headers["idempotent-replayed"]).toBe("true");
    expect(await productBalance(fixture.kitchenBranchId, fixture.recodeProductId))
      .toEqual({ quantity: 0, reserved: 0 });
    expect(await warehouseBalance(fixture.kitchenBranchId, fixture.recodeMaterialId))
      .toEqual({ quantity: 0.5, reserved: 0 });
    expect(await productBalance(fixture.requestBranchId, fixture.recodeProductId))
      .toEqual({ quantity: requestProductBefore.quantity + 1, reserved: 0 });
    expect(await warehouseBalance(fixture.requestBranchId, fixture.recodeMaterialId))
      .toEqual({ quantity: requestMaterialBefore.quantity + 1, reserved: 0 });
    expect(await databaseState.db.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderId, order.body.id))).toEqual(allocationsBeforeReplay);
    expect(await databaseState.db.select().from(centralKitchenInventoryMovements)
      .where(eq(centralKitchenInventoryMovements.orderId, order.body.id))).toEqual(movementsBeforeReplay);

    expect((await databaseState.db.execute(sql`
      SELECT kitchen_id, product_id, source_recipe_id, source_recipe_version,
             recipe_output_quantity::text, recipe_output_unit, batch_output_quantity::text,
             ingredient_count, ingredient_checksum
      FROM central_kitchen_batch_recipe_snapshots
      WHERE batch_id = ${linked.body.id}
    `)).rows).toEqual(frozenBeforeRecode.rows);
    expect((await databaseState.db.execute(sql`
      SELECT warehouse_item_id, material_name, unit, recipe_quantity::text, required_quantity::text
      FROM central_kitchen_batch_materials
      WHERE batch_id = ${linked.body.id}
    `)).rows).toEqual(frozenMaterialsBeforeRecode.rows);
    const lineage = await databaseState.db.execute(sql`
      SELECT i.product_id, i.warehouse_item_id, b.product_id AS batch_product_id,
             b.product_name AS batch_product_name
      FROM central_kitchen_order_items i
      INNER JOIN daily_production_batches b ON b.central_kitchen_order_item_id = i.id
      WHERE i.id = ${productLine.id}
    `);
    expect(lineage.rows).toEqual([{
      product_id: fixture.recodeProductId,
      warehouse_item_id: null,
      batch_product_id: fixture.recodeProductId,
      batch_product_name: oldProductName,
    }]);
  });
});