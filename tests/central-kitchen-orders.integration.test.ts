import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray, sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  branchStock,
  branches,
  centralKitchenOrderEvents,
  centralKitchenOrders,
  centralKitchenShadowInventoryConfig,
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
      if (isAdmin(req)) {
        return { hasAccess: true, singleBranchId: requested || null, branchIds: null };
      }
      const ids = Array.from(allowedBranches(req));
      if (requested) {
        return {
          hasAccess: ids.includes(requested),
          singleBranchId: requested,
          branchIds: ids,
        };
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
let fixture: {
  requestBranchId: string;
  kitchenBranchId: string;
  outsiderBranchId: string;
  requestUser: any;
  kitchenUser: any;
  outsiderUser: any;
  sharedCatalogId: number;
  substituteWarehouseId: number;
  inactiveWarehouseId: number;
  inactiveProductId: number;
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
    Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
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

function key(name: string) {
  return `ck-int-${name}-12345678`;
}

describe.sequential("central kitchen database-backed handler pilot", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Central-kitchen integration tests are forbidden outside DEVELOPMENT");
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
    const rollback = new Error("CENTRAL_KITCHEN_TEST_ROLLBACK");

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
    const requestBranchId = `ck-test-request-${suffix}`;
    const kitchenBranchId = `ck-test-kitchen-${suffix}`;
    const outsiderBranchId = `ck-test-outsider-${suffix}`;
    const requestUser = {
      id: `ck-test-request-user-${suffix}`,
      username: `ck-request-${suffix}`,
      role: "manager",
      branchId: requestBranchId,
    };
    const kitchenUser = {
      id: `ck-test-kitchen-user-${suffix}`,
      username: `ck-kitchen-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
    };
    const outsiderUser = {
      id: `ck-test-outsider-user-${suffix}`,
      username: `ck-outsider-${suffix}`,
      role: "manager",
      branchId: outsiderBranchId,
    };

    await databaseState.db.insert(branches).values([
      { id: requestBranchId, name: "CK integration request branch" },
      { id: kitchenBranchId, name: "CK integration kitchen", isCentralKitchen: true },
      { id: outsiderBranchId, name: "CK integration outsider" },
    ]);
    await databaseState.db.insert(users).values([requestUser, kitchenUser, outsiderUser]);

    const idResult = await databaseState.db.execute(sql`
      select greatest(
        coalesce((select max(id) from products), 0),
        coalesce((select max(id) from warehouse_items), 0)
      )::int + 1000 as id
    `);
    const [idRow] = idResult.rows;
    const sharedCatalogId = Number((idRow as any).id);
    const substituteWarehouseId = sharedCatalogId + 1;
    const inactiveWarehouseId = sharedCatalogId + 2;
    const inactiveProductId = sharedCatalogId + 3;

    await databaseState.db.insert(products).values([
      {
        id: sharedCatalogId,
        name: "CK integration product",
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: inactiveProductId,
        name: "CK integration inactive product",
        category: "test",
        unit: "tray",
        isActive: "false",
      },
    ]);
    await databaseState.db.insert(warehouseItems).values([
      {
        id: sharedCatalogId,
        name: "CK integration warehouse original",
        category: "test",
        unit: "tray",
        currentStock: 137,
        isActive: true,
      },
      {
        id: substituteWarehouseId,
        name: "CK integration warehouse substitute",
        category: "test",
        unit: "case",
        currentStock: 83,
        isActive: true,
      },
      {
        id: inactiveWarehouseId,
        name: "CK integration inactive warehouse",
        category: "test",
        unit: "tray",
        currentStock: 41,
        isActive: false,
      },
    ]);
    await databaseState.db.insert(branchStock).values([
      { branchId: requestBranchId, itemId: sharedCatalogId, currentQuantity: 29 },
      { branchId: kitchenBranchId, itemId: sharedCatalogId, currentQuantity: 71 },
      { branchId: requestBranchId, itemId: substituteWarehouseId, currentQuantity: 17 },
      { branchId: kitchenBranchId, itemId: substituteWarehouseId, currentQuantity: 53 },
    ]);
    await databaseState.db.insert(centralKitchenShadowInventoryConfig).values({
      id: 1,
      activatedAt: new Date(0),
    }).onConflictDoUpdate({
      target: centralKitchenShadowInventoryConfig.id,
      set: { activatedAt: new Date(0) },
    });

    fixture = {
      requestBranchId,
      kitchenBranchId,
      outsiderBranchId,
      requestUser,
      kitchenUser,
      outsiderUser,
      sharedCatalogId,
      substituteWarehouseId,
      inactiveWarehouseId,
      inactiveProductId,
    };

    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("rejects missing and inactive catalog identities without creating orders", async () => {
    const before = await databaseState.db.select({ count: sql<number>`count(*)::int` })
      .from(centralKitchenOrders)
      .where(eq(centralKitchenOrders.createdBy, fixture.requestUser.id));

    const inactive = await invoke("post", "/api/central-kitchen-orders", {
      user: fixture.requestUser,
      body: {
        requestBranchId: fixture.requestBranchId,
        centralKitchenId: fixture.kitchenBranchId,
        idempotencyKey: key("inactive"),
        items: [{
          warehouseItemId: fixture.inactiveWarehouseId,
          productName: "CK integration inactive warehouse",
          requestedQuantity: 1,
          unit: "tray",
        }],
      },
    });
    expect(inactive.statusCode).toBe(400);
    expect(inactive.body.error).toContain("غير مفعّل حالياً");

    const inactiveProduct = await invoke("post", "/api/central-kitchen-orders", {
      user: fixture.requestUser,
      body: {
        requestBranchId: fixture.requestBranchId,
        centralKitchenId: fixture.kitchenBranchId,
        idempotencyKey: key("inactive-product"),
        items: [{
          productId: fixture.inactiveProductId,
          productName: "CK integration inactive product",
          requestedQuantity: 1,
          unit: "tray",
        }],
      },
    });
    expect(inactiveProduct.statusCode).toBe(400);
    expect(inactiveProduct.body.error).toContain("غير مفعّل حالياً");

    const missing = await invoke("post", "/api/central-kitchen-orders", {
      user: fixture.requestUser,
      body: {
        requestBranchId: fixture.requestBranchId,
        centralKitchenId: fixture.kitchenBranchId,
        idempotencyKey: key("missing"),
        items: [{
          productId: fixture.sharedCatalogId + 999,
          productName: "Missing product",
          requestedQuantity: 1,
          unit: "tray",
        }],
      },
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.body.error).toContain("لم يعد موجوداً");

    const changed = await invoke("post", "/api/central-kitchen-orders", {
      user: fixture.requestUser,
      body: {
        requestBranchId: fixture.requestBranchId,
        centralKitchenId: fixture.kitchenBranchId,
        idempotencyKey: key("changed"),
        items: [{
          productId: fixture.sharedCatalogId,
          productName: "Stale product name",
          requestedQuantity: 1,
          unit: "tray",
        }],
      },
    });
    expect(changed.statusCode).toBe(400);
    expect(changed.body.error).toContain("تغيّر اسم الصنف أو وحدته");

    const after = await databaseState.db.select({ count: sql<number>`count(*)::int` })
      .from(centralKitchenOrders)
      .where(eq(centralKitchenOrders.createdBy, fixture.requestUser.id));
    expect(after[0].count).toBe(before[0].count);

    const catalog = await invoke("get", "/api/central-kitchen-orders/products", {
      user: fixture.requestUser,
    });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.body).toEqual(expect.arrayContaining([
      {
        id: fixture.sharedCatalogId,
        name: "CK integration product",
        unit: "tray",
      },
    ]));
    expect(catalog.headers["cache-control"]).toBe("private, no-store");
    expect(catalog.body.every((item: any) =>
      Object.keys(item).sort().join(",") === "id,name,unit" && item.name !== "CK integration warehouse original"
    )).toBe(true);
    expect(catalog.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.inactiveProductId }),
    ]));

    const catalogV2 = await invoke("get", "/api/central-kitchen-orders/catalog-v2", {
      user: fixture.requestUser,
    });
    expect(catalogV2.statusCode).toBe(200);
    expect(catalogV2.headers["cache-control"]).toBe("private, no-store");
    expect(catalogV2.body.schemaVersion).toBe(2);
    expect(catalogV2.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.sharedCatalogId, source: "product" }),
      expect.objectContaining({ id: fixture.sharedCatalogId, source: "warehouse" }),
    ]));
    expect(catalogV2.body.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.inactiveProductId, source: "product" }),
      expect.objectContaining({ id: fixture.inactiveWarehouseId, source: "warehouse" }),
    ]));
  });

  it("runs dual-catalog create through discrepancy resolution with isolation, replay, and no balance posting", async () => {
    const warehouseIds = [fixture.sharedCatalogId, fixture.substituteWarehouseId];
    const balancesBefore = {
      warehouse: await databaseState.db.select({
        id: warehouseItems.id,
        currentStock: warehouseItems.currentStock,
      }).from(warehouseItems).where(inArray(warehouseItems.id, warehouseIds))
        .orderBy(warehouseItems.id),
      branches: await databaseState.db.select({
        branchId: branchStock.branchId,
        itemId: branchStock.itemId,
        currentQuantity: branchStock.currentQuantity,
      }).from(branchStock).where(and(
        inArray(branchStock.branchId, [fixture.requestBranchId, fixture.kitchenBranchId]),
        inArray(branchStock.itemId, warehouseIds),
      )).orderBy(branchStock.branchId, branchStock.itemId),
    };

    const createBody = {
      requestBranchId: fixture.requestBranchId,
      centralKitchenId: fixture.kitchenBranchId,
      idempotencyKey: key("create"),
      items: [
        {
          productId: fixture.sharedCatalogId,
          productName: "CK integration product",
          requestedQuantity: 10,
          unit: "tray",
        },
        {
          warehouseItemId: fixture.sharedCatalogId,
          productName: "CK integration warehouse original",
          requestedQuantity: 5,
          unit: "tray",
        },
      ],
    };

    const outsiderCreate = await invoke("post", "/api/central-kitchen-orders", {
      user: fixture.outsiderUser,
      body: { ...createBody, idempotencyKey: key("outsider-create") },
    });
    expect(outsiderCreate.statusCode).toBe(403);

    const created = await invoke("post", "/api/central-kitchen-orders", {
      user: fixture.requestUser,
      body: createBody,
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.status).toBe("requested");
    const orderId = created.body.id;
    const [productLine, warehouseLine] = created.body.items;
    expect(productLine).toMatchObject({
      productId: fixture.sharedCatalogId,
      warehouseItemId: null,
      productName: "CK integration product",
    });
    expect(warehouseLine).toMatchObject({
      productId: null,
      warehouseItemId: fixture.sharedCatalogId,
      productName: "CK integration warehouse original",
    });

    const createReplay = await invoke("post", "/api/central-kitchen-orders", {
      user: fixture.requestUser,
      body: createBody,
    });
    expect(createReplay.statusCode).toBe(200);
    expect(createReplay.headers["idempotent-replayed"]).toBe("true");
    expect(createReplay.body.id).toBe(orderId);

    const outsiderRead = await invoke("get", "/api/central-kitchen-orders/:id", {
      user: fixture.outsiderUser,
      params: { id: String(orderId) },
    });
    expect(outsiderRead.statusCode).toBe(403);

    const wrongBranchApprove = await invoke("post", "/api/central-kitchen-orders/:id/approve", {
      user: fixture.requestUser,
      params: { id: String(orderId) },
      body: { idempotencyKey: key("wrong-approve") },
    });
    expect(wrongBranchApprove.statusCode).toBe(403);

    const approved = await invoke("post", "/api/central-kitchen-orders/:id/approve", {
      user: fixture.kitchenUser,
      params: { id: String(orderId) },
      body: { idempotencyKey: key("approve") },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.body.status).toBe("approved");

    const prepareBody = {
      idempotencyKey: key("prepare"),
      items: [
        {
          itemId: productLine.id,
          preparedQuantity: 6,
          substituteQuantity: 4,
          substituteWarehouseItemId: fixture.substituteWarehouseId,
          substituteProductName: "CK integration warehouse substitute",
          substituteUnit: "tray",
        },
        {
          itemId: warehouseLine.id,
          preparedQuantity: 5,
          substituteQuantity: 0,
        },
      ],
    };
    const prepared = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(orderId) },
      body: prepareBody,
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.body.status).toBe("prepared");
    expect(prepared.body.items[0]).toMatchObject({
      productId: fixture.sharedCatalogId,
      warehouseItemId: null,
      substituteProductId: null,
      substituteWarehouseItemId: fixture.substituteWarehouseId,
      preparedQuantity: 6,
      substituteQuantity: 4,
    });

    const prepareReplay = await invoke("post", "/api/central-kitchen-orders/:id/prepare", {
      user: fixture.kitchenUser,
      params: { id: String(orderId) },
      body: prepareBody,
    });
    expect(prepareReplay.headers["idempotent-replayed"]).toBe("true");
    expect(prepareReplay.body.status).toBe("prepared");

    const dispatchBody = {
      idempotencyKey: key("dispatch"),
      driverName: "Integration Driver",
      vehicleNumber: "TEST-001",
      items: [
        { itemId: productLine.id, dispatchedQuantity: 10 },
        { itemId: warehouseLine.id, dispatchedQuantity: 5 },
      ],
    };
    const dispatched = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(orderId) },
      body: dispatchBody,
    });
    expect(dispatched.body.status).toBe("dispatched");

    const dispatchReplay = await invoke("post", "/api/central-kitchen-orders/:id/dispatch", {
      user: fixture.kitchenUser,
      params: { id: String(orderId) },
      body: dispatchBody,
    });
    expect(dispatchReplay.headers["idempotent-replayed"]).toBe("true");

    const wrongBranchReceive = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.kitchenUser,
      params: { id: String(orderId) },
      body: {
        idempotencyKey: key("wrong-receive"),
        items: [
          { itemId: productLine.id, receivedQuantity: 10, damagedQuantity: 0 },
          { itemId: warehouseLine.id, receivedQuantity: 5, damagedQuantity: 0 },
        ],
      },
    });
    expect(wrongBranchReceive.statusCode).toBe(403);

    const receiveBody = {
      idempotencyKey: key("receive"),
      items: [
        {
          itemId: productLine.id,
          receivedQuantity: 7,
          damagedQuantity: 1,
          receivingNotes: "Two missing and one damaged in transit",
        },
        { itemId: warehouseLine.id, receivedQuantity: 5, damagedQuantity: 0 },
      ],
    };
    const received = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.requestUser,
      params: { id: String(orderId) },
      body: receiveBody,
    });
    expect(received.body).toMatchObject({ status: "received", discrepancyStatus: "open" });
    expect(received.body.items[0]).toMatchObject({
      receivedQuantity: 7,
      damagedQuantity: 1,
      missingQuantity: 2,
    });

    const receiveReplay = await invoke("post", "/api/central-kitchen-orders/:id/receive", {
      user: fixture.requestUser,
      params: { id: String(orderId) },
      body: receiveBody,
    });
    expect(receiveReplay.headers["idempotent-replayed"]).toBe("true");

    const shadows = received.body.shadowInventoryEntries;
    expect(shadows).toHaveLength(6);
    expect(shadows.map((row: any) => ({
      direction: row.direction,
      component: row.component,
      branchId: row.branchId,
      counterpartyBranchId: row.counterpartyBranchId,
      productId: row.productId,
      warehouseItemId: row.warehouseItemId,
      quantity: row.quantity,
    }))).toEqual(expect.arrayContaining([
      {
        direction: "projected_kitchen_out",
        component: "original",
        branchId: fixture.kitchenBranchId,
        counterpartyBranchId: fixture.requestBranchId,
        productId: fixture.sharedCatalogId,
        warehouseItemId: null,
        quantity: 6,
      },
      {
        direction: "projected_kitchen_out",
        component: "substitute",
        branchId: fixture.kitchenBranchId,
        counterpartyBranchId: fixture.requestBranchId,
        productId: null,
        warehouseItemId: fixture.substituteWarehouseId,
        quantity: 4,
      },
      {
        direction: "projected_branch_in",
        component: "original",
        branchId: fixture.requestBranchId,
        counterpartyBranchId: fixture.kitchenBranchId,
        productId: fixture.sharedCatalogId,
        warehouseItemId: null,
        quantity: 6,
      },
      {
        direction: "projected_branch_in",
        component: "substitute",
        branchId: fixture.requestBranchId,
        counterpartyBranchId: fixture.kitchenBranchId,
        productId: null,
        warehouseItemId: fixture.substituteWarehouseId,
        quantity: 1,
      },
    ]));

    const wrongBranchResolve = await invoke("post", "/api/central-kitchen-orders/:id/resolve-discrepancy", {
      user: fixture.kitchenUser,
      params: { id: String(orderId) },
      body: { idempotencyKey: key("wrong-resolve"), notes: "Not allowed" },
    });
    expect(wrongBranchResolve.statusCode).toBe(403);

    const resolveBody = {
      idempotencyKey: key("resolve"),
      notes: "Discrepancy documented and accepted by receiving branch",
    };
    const resolved = await invoke("post", "/api/central-kitchen-orders/:id/resolve-discrepancy", {
      user: fixture.requestUser,
      params: { id: String(orderId) },
      body: resolveBody,
    });
    expect(resolved.body).toMatchObject({
      status: "received",
      discrepancyStatus: "resolved",
      discrepancyResolvedBy: fixture.requestUser.id,
      discrepancyResolutionNotes: resolveBody.notes,
    });

    const resolveReplay = await invoke("post", "/api/central-kitchen-orders/:id/resolve-discrepancy", {
      user: fixture.requestUser,
      params: { id: String(orderId) },
      body: resolveBody,
    });
    expect(resolveReplay.headers["idempotent-replayed"]).toBe("true");

    const events = await databaseState.db.select({
      eventType: centralKitchenOrderEvents.eventType,
    }).from(centralKitchenOrderEvents)
      .where(eq(centralKitchenOrderEvents.orderId, orderId))
      .orderBy(centralKitchenOrderEvents.id);
    expect(events.map((event: any) => event.eventType)).toEqual([
      "created",
      "approved",
      "prepared",
      "dispatched",
      "received",
      "discrepancy_resolved",
    ]);

    const balancesAfter = {
      warehouse: await databaseState.db.select({
        id: warehouseItems.id,
        currentStock: warehouseItems.currentStock,
      }).from(warehouseItems).where(inArray(warehouseItems.id, warehouseIds))
        .orderBy(warehouseItems.id),
      branches: await databaseState.db.select({
        branchId: branchStock.branchId,
        itemId: branchStock.itemId,
        currentQuantity: branchStock.currentQuantity,
      }).from(branchStock).where(and(
        inArray(branchStock.branchId, [fixture.requestBranchId, fixture.kitchenBranchId]),
        inArray(branchStock.itemId, warehouseIds),
      )).orderBy(branchStock.branchId, branchStock.itemId),
    };
    expect(balancesAfter).toEqual(balancesBefore);
  });
});