import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray, sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  branchStock,
  branches,
  centralKitchenInventoryAllocations,
  centralKitchenInventoryMovements,
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
    ]);
    await databaseState.db.insert(branchStock).values([
      { branchId: kitchenBranchId, itemId: materialId, currentQuantity: 9 },
      { branchId: requestBranchId, itemId: materialId, currentQuantity: 40 },
      { branchId: kitchenBranchId, itemId: wrongUnitMaterialId, currentQuantity: 20 },
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
    };

    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 30_000);

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
    const createdBatch = await invoke(
      "post",
      "/api/central-kitchen-orders/:id/items/:itemId/production-batches",
      {
        user: fixture.kitchenUser,
        params: { id: String(order.body.id), itemId: String(line.id) },
        headers: { "Idempotency-Key": key("linked-batch") },
        body: { quantity: 4, productionDate },
      },
    );
    expect(createdBatch.statusCode).toBe(201);
    expect(createdBatch.body).toMatchObject({
      branchId: fixture.kitchenBranchId,
      productId: fixture.productionProductId,
      centralKitchenOrderItemId: line.id,
      status: "in_progress",
    });

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
});