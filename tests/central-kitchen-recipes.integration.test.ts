import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  branchStock,
  branches,
  centralKitchenRecipeIngredients,
  finishedGoodsInventory,
  products,
  users,
  warehouseItems,
} from "../shared/schema";
import * as schema from "../shared/schema";

const databaseState = vi.hoisted(() => ({ db: null as any, pool: null as any }));
const authState = vi.hoisted(() => ({
  permissionCalls: [] as Array<{ module: string; action?: string }>,
}));

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

/*
 * Authentication is the only mocked production dependency in this suite. The
 * database, route handlers, catalog checks, optimistic guards, and inventory
 * code are all real. Unlike the older central-kitchen integration harness,
 * this mock executes permission middleware so a route accidentally guarded by
 * a generic module/action cannot pass silently.
 */
vi.mock("../server/auth", () => {
  const getAllowed = (req: any) =>
    new Set<string>(req.currentUser?.testAllowedBranchIds || [req.currentUser?.branchId].filter(Boolean));
  const isAdmin = (req: any) => req.currentUser?.role === "admin";
  const permissionMiddleware = (module: string, action?: string) => {
    authState.permissionCalls.push({ module, action });
    const middleware: any = (req: any, res: any, next: () => any) => {
      if (!req.currentUser) return res.status(401).json({ error: "Unauthenticated" });
      if (isAdmin(req)) return next();
      const requestedAction = action || ({
        GET: "view",
        HEAD: "view",
        OPTIONS: "view",
        POST: "create",
        PUT: "edit",
        PATCH: "edit",
        DELETE: "delete",
      } as Record<string, string>)[req.method] || "edit";
      const actions = req.currentUser.testPermissions?.[module] || [];
      if (!actions.includes(requestedAction)) {
        return res.status(403).json({ error: `Missing ${module}:${requestedAction}` });
      }
      return next();
    };
    middleware.recipePermission = { module, action };
    return middleware;
  };
  const passThrough = () => (_req: any, _res: any, next: () => any) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: (req: any, res: any, next: () =>
      any) => req.currentUser ? next() : res.status(401).json({ error: "Unauthenticated" }),
    requirePermission: permissionMiddleware,
    requireAnyPermission: passThrough,
    requireRole: passThrough,
    requireBranchAccess: passThrough,
    canAccessBranch: async (req: any, branchId: string) =>
      isAdmin(req) || getAllowed(req).has(branchId),
    isUserAdmin: isAdmin,
    getAllowedBranchIds: async (req: any) =>
      isAdmin(req) ? null : Array.from(getAllowed(req)),
    getActiveBranchFilter: (req: any) => req.currentUser?.branchId || null,
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      if (isAdmin(req)) return { hasAccess: true, singleBranchId: requested || null, branchIds: null };
      const ids = Array.from(getAllowed(req));
      if (requested) {
        return { hasAccess: ids.includes(requested), singleBranchId: requested, branchIds: ids };
      }
      return { hasAccess: true, singleBranchId: ids.length === 1 ? ids[0] : null, branchIds: ids };
    },
    invalidateAuthCache: vi.fn(),
    getCachedPermissionsForUser: (id: string) => {
      // The recipe handlers do not need the real permission table, but keeping
      // this seam honest avoids accidentally turning a permission lookup into
      // an unconditional allow if a handler starts using it.
      return null;
    },
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
  kitchenBranchId: string;
  alternateKitchenBranchId: string;
  outsiderBranchId: string;
  requestBranchId: string;
  kitchenUser: any;
  viewerUser: any;
  outsiderUser: any;
  requestUser: any;
  productId: number;
  alternateProductId: number;
  inactiveProductId: number;
  materialId: number;
  inactiveMaterialId: number;
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
  return match;
}

async function invoke(
  method: string,
  path: string,
  options: {
    user: any;
    params?: any;
    query?: any;
    body?: any;
    headers?: Record<string, string>;
  },
): Promise<TestResponse> {
  const headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const response: TestResponse = { statusCode: 200, body: undefined, headers: {} };
  const req: any = {
    method: method.toUpperCase(),
    currentUser: options.user,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    originalUrl: path,
    headers,
    ip: "127.0.0.1",
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
  const res: any = {
    status(code: number) {
      response.statusCode = code;
      return res;
    },
    set(name: string, value: string) {
      response.headers[name.toLowerCase()] = value;
      return res;
    },
    header(name: string, value: string) {
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
    end(body?: any) {
      if (body !== undefined) response.body = body;
      return res;
    },
  };
  const registration = route(method, path);
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
    // Express middleware normally returns next(), but tolerate a test seam
    // that invokes next synchronously and returns void.
    if (nextCalled) return;
  };
  await run();
  return response;
}

function key(label: string) {
  keySequence += 1;
  return `ck-recipe-${label}-${keySequence}-12345678`;
}

function user(
  id: string,
  branchId: string,
  role: string,
  testPermissions: Record<string, string[]>,
) {
  return {
    id,
    username: id,
    branchId,
    role,
    testPermissions,
    testAllowedBranchIds: [branchId],
  };
}

const kitchenPermissions = {
  production: ["view", "create", "edit", "delete", "approve"],
};

function createPayload(idempotencyKey = key("create")) {
  return {
    kitchenId: fixture.kitchenBranchId,
    productId: fixture.productId,
    outputQuantity: 12,
    outputUnit: "tray",
    notes: "Browser recipe payload with all fields",
    ingredients: [{
      warehouseItemId: fixture.materialId,
      quantity: 2.5,
      unit: "kg",
    }],
    idempotencyKey,
  };
}

function recipeBody(body: any): any {
  return body?.recipe || body?.data || body;
}

function revisionOf(recipe: any) {
  return {
    version: recipe.version,
    updateToken: recipe.updateToken,
  };
}

async function getRecipe(id: number, user = fixture.kitchenUser) {
  const response = await invoke("get", "/api/central-kitchen-recipes/:id", {
    user,
    params: { id: String(id) },
  });
  expect(response.statusCode).toBe(200);
  return recipeBody(response.body);
}

async function inventorySnapshot() {
  const [branchRows, finishedRows, warehouseRows] = await Promise.all([
    databaseState.db.execute(sql`
      SELECT branch_id, item_id, current_quantity, reserved_quantity
      FROM branch_stock
      WHERE branch_id IN (
        ${fixture.kitchenBranchId},
        ${fixture.alternateKitchenBranchId},
        ${fixture.requestBranchId},
        ${fixture.outsiderBranchId}
      )
      ORDER BY branch_id, item_id
    `),
    databaseState.db.execute(sql`
      SELECT branch_id, product_id, product_name, quantity, reserved_quantity, unit, production_date
      FROM finished_goods_inventory
      WHERE branch_id IN (
        ${fixture.kitchenBranchId},
        ${fixture.alternateKitchenBranchId},
        ${fixture.requestBranchId},
        ${fixture.outsiderBranchId}
      )
      ORDER BY branch_id, product_id, production_date
    `),
    databaseState.db.execute(sql`
      SELECT id, current_stock
      FROM warehouse_items
      WHERE id IN (${fixture.materialId}, ${fixture.inactiveMaterialId}, ${fixture.wrongUnitMaterialId})
      ORDER BY id
    `),
  ]);
  return {
    branchStock: branchRows.rows,
    finishedGoods: finishedRows.rows,
    warehouseItems: warehouseRows.rows,
  };
}

async function expectSavepointFailure(
  savepoint: string,
  operation: () => Promise<unknown>,
) {
  await databaseState.db.execute(sql.raw(`SAVEPOINT ${savepoint}`));
  let error: unknown;
  try {
    await operation();
  } catch (caught) {
    error = caught;
  }
  await databaseState.db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
  await databaseState.db.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));
  expect(error, `${savepoint} must be rejected by the database guard`).toBeTruthy();
}

describe.sequential("central kitchen recipes database-backed workflow", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Central-kitchen recipe integration tests are forbidden outside DEVELOPMENT");
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
    const rollback = new Error("CENTRAL_KITCHEN_RECIPE_TEST_ROLLBACK");

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
    const kitchenBranchId = `ck-recipe-kitchen-${suffix}`;
    const alternateKitchenBranchId = `ck-recipe-kitchen-alt-${suffix}`;
    const outsiderBranchId = `ck-recipe-outsider-${suffix}`;
    const requestBranchId = `ck-recipe-request-${suffix}`;
    const kitchenUser = user(
      `ck-recipe-kitchen-user-${suffix}`,
      kitchenBranchId,
      "manager",
      kitchenPermissions,
    );
    // The test actor is allowed to see both kitchen branches so identity
    // changes reach the route's 409 guard instead of being hidden by branch
    // authorization (the recipe identity is still immutable).
    kitchenUser.testAllowedBranchIds = [kitchenBranchId, alternateKitchenBranchId];
    const viewerUser = user(
      `ck-recipe-viewer-user-${suffix}`,
      kitchenBranchId,
      "viewer",
      { production: ["view"] },
    );
    const outsiderUser = user(
      `ck-recipe-outsider-user-${suffix}`,
      outsiderBranchId,
      "manager",
      kitchenPermissions,
    );
    const requestUser = user(
      `ck-recipe-request-user-${suffix}`,
      requestBranchId,
      "manager",
      kitchenPermissions,
    );

    await databaseState.db.insert(branches).values([
      { id: kitchenBranchId, name: "CK recipe kitchen", isCentralKitchen: true },
      { id: alternateKitchenBranchId, name: "CK recipe alternate kitchen", isCentralKitchen: true },
      { id: outsiderBranchId, name: "CK recipe outsider" },
      { id: requestBranchId, name: "CK recipe request branch" },
    ]);
    await databaseState.db.insert(users).values([
      { id: kitchenUser.id, username: kitchenUser.username, role: kitchenUser.role, branchId: kitchenBranchId },
      { id: viewerUser.id, username: viewerUser.username, role: viewerUser.role, branchId: kitchenBranchId },
      { id: outsiderUser.id, username: outsiderUser.username, role: outsiderUser.role, branchId: outsiderBranchId },
      { id: requestUser.id, username: requestUser.username, role: requestUser.role, branchId: requestBranchId },
    ]);

    const idResult = await databaseState.db.execute(sql`
      SELECT GREATEST(
        COALESCE((SELECT MAX(id) FROM products), 0),
        COALESCE((SELECT MAX(id) FROM warehouse_items), 0)
      )::int + 4000 AS id
    `);
    const firstId = Number(idResult.rows[0].id);
    const productId = firstId;
    const inactiveProductId = firstId + 1;
    const materialId = firstId + 2;
    const inactiveMaterialId = firstId + 3;
    const wrongUnitMaterialId = firstId + 4;
    const alternateProductId = firstId + 5;

    await databaseState.db.insert(products).values([
      {
        id: productId,
        name: `CK recipe product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
      {
        id: inactiveProductId,
        name: `CK recipe inactive product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "false",
      },
      {
        id: alternateProductId,
        name: `CK recipe alternate product ${suffix}`,
        category: "test",
        unit: "tray",
        isActive: "true",
      },
    ]);
    await databaseState.db.insert(warehouseItems).values([
      {
        id: materialId,
        name: `CK recipe material ${suffix}`,
        category: "raw",
        unit: "kg",
        currentStock: 500,
        isActive: true,
      },
      {
        id: inactiveMaterialId,
        name: `CK recipe inactive material ${suffix}`,
        category: "raw",
        unit: "kg",
        currentStock: 500,
        isActive: false,
      },
      {
        id: wrongUnitMaterialId,
        name: `CK recipe case material ${suffix}`,
        category: "raw",
        unit: "case",
        currentStock: 500,
        isActive: true,
      },
    ]);
    await databaseState.db.insert(branchStock).values([
      { branchId: kitchenBranchId, itemId: materialId, currentQuantity: 77, reservedQuantity: 3 },
      { branchId: kitchenBranchId, itemId: wrongUnitMaterialId, currentQuantity: 33, reservedQuantity: 0 },
    ]);
    await databaseState.db.insert(finishedGoodsInventory).values({
      branchId: kitchenBranchId,
      productId,
      productName: `CK recipe product ${suffix}`,
      productNameNormalized: `ck recipe product ${suffix}`,
      productCategory: "test",
      quantity: 25,
      reservedQuantity: 2,
      unit: "tray",
      productionDate: "2099-01-01",
    });

    fixture = {
      kitchenBranchId,
      alternateKitchenBranchId,
      outsiderBranchId,
      requestBranchId,
      kitchenUser,
      viewerUser,
      outsiderUser,
      requestUser,
      productId,
      alternateProductId,
      inactiveProductId,
      materialId,
      inactiveMaterialId,
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

  it("wires approval to exactly production:approve and protects all recipe reads", async () => {
    const expectedGuards = [
      ["get", "/api/central-kitchen-recipes/catalog", "view"],
      ["get", "/api/central-kitchen-recipes", "view"],
      ["post", "/api/central-kitchen-recipes", "create"],
      ["get", "/api/central-kitchen-recipes/:id", "view"],
      ["patch", "/api/central-kitchen-recipes/:id", "edit"],
      ["post", "/api/central-kitchen-recipes/:id/approve", "approve"],
      ["post", "/api/central-kitchen-recipes/:id/revise", "create"],
      ["delete", "/api/central-kitchen-recipes/:id", "delete"],
    ] as const;
    for (const [method, path, action] of expectedGuards) {
      const registration = route(method, path);
      const guard = registration.handlers.find(
        (handler: any) => handler.recipePermission,
      ) as any;
      expect(guard?.recipePermission, `${method.toUpperCase()} ${path}`)
        .toEqual({ module: "production", action });
    }
    const approveRegistration = route("post", "/api/central-kitchen-recipes/:id/approve");
    const approvalGuard = approveRegistration.handlers.find(
      (handler: any) => handler.recipePermission,
    ) as any;
    expect(approvalGuard?.recipePermission).toEqual({
      module: "production",
      action: "approve",
    });
    expect(authState.permissionCalls).toContainEqual({
      module: "production",
      action: "approve",
    });

    const list = await invoke("get", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const catalog = await invoke("get", "/api/central-kitchen-recipes/catalog", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.body).toMatchObject({
      products: expect.arrayContaining([
        expect.objectContaining({ id: fixture.productId, unit: "tray" }),
      ]),
      materials: expect.arrayContaining([
        expect.objectContaining({ id: fixture.materialId, unit: "kg" }),
      ]),
    });
    expect(catalog.body.products).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.inactiveProductId }),
    ]));
    expect(catalog.body.materials).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.inactiveMaterialId }),
    ]));

    for (const [method, path, options] of [
      ["get", "/api/central-kitchen-recipes", { query: { kitchenId: fixture.kitchenBranchId } }],
      ["get", "/api/central-kitchen-recipes/catalog", { query: { kitchenId: fixture.kitchenBranchId } }],
    ] as const) {
      const outsider = await invoke(method, path, { ...options, user: fixture.outsiderUser });
      expect(outsider.statusCode).toBe(403);
    }
  });

  it("rejects malformed quantities, duplicate materials, catalog mismatches, and inactive identities", async () => {
    const cases = [
      {
        label: "zero quantity",
        body: { ...createPayload(), ingredients: [{ warehouseItemId: fixture.materialId, quantity: 0, unit: "kg" }] },
      },
      {
        label: "duplicate material",
        body: {
          ...createPayload(),
          ingredients: [
            { warehouseItemId: fixture.materialId, quantity: 1, unit: "kg" },
            { warehouseItemId: fixture.materialId, quantity: 2, unit: "kg" },
          ],
        },
      },
      {
        label: "output unit mismatch",
        body: { ...createPayload(), outputUnit: "piece" },
      },
      {
        label: "ingredient unit mismatch",
        body: {
          ...createPayload(),
          ingredients: [{ warehouseItemId: fixture.materialId, quantity: 2, unit: "gram" }],
        },
      },
      {
        label: "inactive product",
        body: { ...createPayload(), productId: fixture.inactiveProductId },
      },
      {
        label: "inactive material",
        body: {
          ...createPayload(),
          ingredients: [{ warehouseItemId: fixture.inactiveMaterialId, quantity: 2, unit: "kg" }],
        },
      },
      {
        label: "active wrong-unit material",
        body: {
          ...createPayload(),
          ingredients: [{ warehouseItemId: fixture.wrongUnitMaterialId, quantity: 2, unit: "kg" }],
        },
      },
    ];
    for (const testCase of cases) {
      const response = await invoke("post", "/api/central-kitchen-recipes", {
        user: fixture.kitchenUser,
        body: { ...testCase.body, idempotencyKey: key(testCase.label) },
      });
      expect(response.statusCode, testCase.label).toBe(400);
    }
  });

  it("runs draft, guarded edit, approval, immutable rejection, revision, supersession, and draft deletion", async () => {
    const balancesBefore = await inventorySnapshot();

    const validBody = createPayload(key("double-create"));
    // The rollback harness deliberately holds one database connection. Promise
    // concurrency here would be re-entrant work in the same transaction and
    // cannot model two production connections contending on the advisory lock.
    // The separate browser retry is intentionally sequential; cross-connection
    // lock contention is not covered by this rollback-only suite.
    const firstCreate = await invoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      body: validBody,
    });
    const secondCreate = await invoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      body: validBody,
    });
    expect([201, 200]).toContain(firstCreate.statusCode);
    expect([201, 200]).toContain(secondCreate.statusCode);
    const firstDraft = recipeBody(firstCreate.body);
    const replayedDraft = recipeBody(secondCreate.body);
    expect(firstDraft.id).toBe(replayedDraft.id);
    expect(firstDraft.status).toBe("draft");
    expect(firstDraft.ingredients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        warehouseItemId: fixture.materialId,
        quantity: 2.5,
        unit: "kg",
      }),
    ]));

    const initialList = await invoke("get", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(initialList.statusCode).toBe(200);
    expect(initialList.body.filter((recipe: any) => recipe.id === firstDraft.id)).toHaveLength(1);
    const firstId = firstDraft.id;

    const requestSide = await invoke("get", "/api/central-kitchen-recipes/:id", {
      user: fixture.requestUser,
      params: { id: String(firstId) },
    });
    expect(requestSide.statusCode).toBe(403);
    const outsiderDetail = await invoke("get", "/api/central-kitchen-recipes/:id", {
      user: fixture.outsiderUser,
      params: { id: String(firstId) },
    });
    expect(outsiderDetail.statusCode).toBe(403);
    const kitchenDetail = await getRecipe(firstId);
    expect(kitchenDetail.status).toBe("draft");

    const draftKitchenIdentityChange = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: {
        ...createPayload(key("draft-kitchen-identity-change")),
        ...revisionOf(kitchenDetail),
        kitchenId: fixture.alternateKitchenBranchId,
      },
    });
    expect(draftKitchenIdentityChange.statusCode).toBe(409);
    const draftProductIdentityChange = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: {
        ...createPayload(key("draft-product-identity-change")),
        ...revisionOf(kitchenDetail),
        productId: fixture.alternateProductId,
      },
    });
    expect(draftProductIdentityChange.statusCode).toBe(409);
    expect(await getRecipe(firstId)).toMatchObject({
      id: firstId,
      status: "draft",
      kitchenId: fixture.kitchenBranchId,
      productId: fixture.productId,
    });

    const missingRevision = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: { ...createPayload(key("missing-revision")), notes: "Missing expected revision" },
    });
    expect(missingRevision.statusCode).toBe(400);

    const staleToken = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: {
        ...createPayload(key("stale-token")),
        ...revisionOf(kitchenDetail),
        updateToken: "stale-token-that-is-not-current-123456",
        notes: "Stale optimistic update",
      },
    });
    expect(staleToken.statusCode).toBe(409);

    const edited = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: {
        ...createPayload(key("edit")),
        ...revisionOf(kitchenDetail),
        notes: "Edited optimistically",
        outputQuantity: 14,
      },
    });
    expect(edited.statusCode).toBe(200);
    const editedDetail = await getRecipe(firstId);
    expect(editedDetail).toMatchObject({
      id: firstId,
      status: "draft",
      notes: "Edited optimistically",
      outputQuantity: 14,
    });
    expect(editedDetail.version).toBeGreaterThan(kitchenDetail.version);

    const staleAfterEdit = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: {
        ...createPayload(key("stale-after-edit")),
        ...revisionOf(kitchenDetail),
        notes: "Should lose the race",
      },
    });
    expect(staleAfterEdit.statusCode).toBe(409);

    const viewerApproval = await invoke("post", "/api/central-kitchen-recipes/:id/approve", {
      user: fixture.viewerUser,
      params: { id: String(firstId) },
      body: { ...revisionOf(editedDetail), idempotencyKey: key("viewer-approve") },
    });
    expect(viewerApproval.statusCode).toBe(403);

    const approved = await invoke("post", "/api/central-kitchen-recipes/:id/approve", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: { ...revisionOf(editedDetail), idempotencyKey: key("approve-old") },
    });
    expect(approved.statusCode).toBe(200);
    const approvedDetail = await getRecipe(firstId);
    expect(approvedDetail.status).toBe("approved");

    const originalCreateReplayAfterApproval = await invoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      body: validBody,
    });
    expect(originalCreateReplayAfterApproval.statusCode).toBe(200);
    expect(recipeBody(originalCreateReplayAfterApproval.body).id).toBe(approvedDetail.id);
    expect(await getRecipe(firstId)).toEqual(approvedDetail);

    const freshPostForApprovedProduct = await invoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      body: createPayload(key("fresh-post-for-approved-product")),
    });
    expect(freshPostForApprovedProduct.statusCode).toBe(409);
    const listAfterFreshPost = await invoke("get", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(listAfterFreshPost.body.filter(
      (recipe: any) =>
        recipe.kitchenId === fixture.kitchenBranchId &&
        recipe.productId === fixture.productId,
    )).toHaveLength(1);

    const immutableEdit = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: {
        ...createPayload(key("immutable-edit")),
        ...revisionOf(approvedDetail),
        notes: "Approved recipes are immutable",
      },
    });
    expect(immutableEdit.statusCode).toBe(409);
    const immutableDelete = await invoke("delete", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: { ...revisionOf(approvedDetail), idempotencyKey: key("immutable-delete") },
    });
    expect(immutableDelete.statusCode).toBe(409);
    expect((await getRecipe(firstId)).status).toBe("approved");

    const reviseBody = {
      ...revisionOf(approvedDetail),
      idempotencyKey: key("double-revise"),
    };
    const firstRevision = await invoke("post", "/api/central-kitchen-recipes/:id/revise", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: reviseBody,
    });
    const secondRevision = await invoke("post", "/api/central-kitchen-recipes/:id/revise", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: reviseBody,
    });
    expect([201, 200], JSON.stringify(firstRevision.body)).toContain(firstRevision.statusCode);
    expect([201, 200], JSON.stringify(secondRevision.body)).toContain(secondRevision.statusCode);
    const revisedDraft = recipeBody(firstRevision.body);
    expect(revisedDraft.id).toBe(recipeBody(secondRevision.body).id);
    expect(revisedDraft.id).not.toBe(firstId);
    expect(revisedDraft.status).toBe("draft");
    expect(revisedDraft.supersedesRecipeId).toBe(firstId);
    expect(revisedDraft).toMatchObject({
      kitchenId: approvedDetail.kitchenId,
      productId: approvedDetail.productId,
    });
    expect((await getRecipe(firstId)).status).toBe("approved");

    const revisedDetail = await getRecipe(revisedDraft.id);
    const revisedKitchenIdentityChange = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(revisedDraft.id) },
      body: {
        ...createPayload(key("revision-kitchen-identity-change")),
        ...revisionOf(revisedDetail),
        kitchenId: fixture.alternateKitchenBranchId,
      },
    });
    expect(revisedKitchenIdentityChange.statusCode).toBe(409);
    const revisedProductIdentityChange = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(revisedDraft.id) },
      body: {
        ...createPayload(key("revision-product-identity-change")),
        ...revisionOf(revisedDetail),
        productId: fixture.alternateProductId,
      },
    });
    expect(revisedProductIdentityChange.statusCode).toBe(409);

    const revisedEdit = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(revisedDraft.id) },
      body: {
        ...createPayload(key("edit-revised-draft")),
        ...revisionOf(revisedDetail),
        notes: "Edited revision before replay",
        outputQuantity: 15,
      },
    });
    expect(revisedEdit.statusCode).toBe(200);
    const revisedEditedDetail = await getRecipe(revisedDraft.id);
    expect(revisedEditedDetail).toMatchObject({
      id: revisedDraft.id,
      status: "draft",
      kitchenId: approvedDetail.kitchenId,
      productId: approvedDetail.productId,
      notes: "Edited revision before replay",
      outputQuantity: 15,
      supersedesRecipeId: firstId,
    });

    const revisedReplayAfterEdit = await invoke("post", "/api/central-kitchen-recipes/:id/revise", {
      user: fixture.kitchenUser,
      params: { id: String(firstId) },
      body: reviseBody,
    });
    expect(revisedReplayAfterEdit.statusCode).toBe(200);
    expect(recipeBody(revisedReplayAfterEdit.body).id).toBe(revisedEditedDetail.id);
    expect(await getRecipe(revisedDraft.id)).toEqual(revisedEditedDetail);

    const revisedApproval = await invoke("post", "/api/central-kitchen-recipes/:id/approve", {
      user: fixture.kitchenUser,
      params: { id: String(revisedDraft.id) },
      body: { ...revisionOf(revisedEditedDetail), idempotencyKey: key("approve-revised") },
    });
    expect(revisedApproval.statusCode).toBe(200);

    const oldAfterSupersession = await getRecipe(firstId);
    const newAfterSupersession = await getRecipe(revisedDraft.id);
    expect(oldAfterSupersession.status).toBe("superseded");
    expect(oldAfterSupersession.supersededByRecipeId).toBe(revisedDraft.id);
    expect(newAfterSupersession.status).toBe("approved");
    expect(newAfterSupersession.supersedesRecipeId).toBe(firstId);
    expect(oldAfterSupersession).toMatchObject({
      kitchenId: approvedDetail.kitchenId,
      productId: approvedDetail.productId,
    });
    expect(newAfterSupersession).toMatchObject({
      kitchenId: approvedDetail.kitchenId,
      productId: approvedDetail.productId,
      supersedesRecipeId: firstId,
    });

    const [approvedIngredient] = await databaseState.db
      .select()
      .from(centralKitchenRecipeIngredients)
      .where(sql`${centralKitchenRecipeIngredients.recipeId} = ${revisedDraft.id}`)
      .limit(1);
    expect(approvedIngredient).toBeTruthy();
    await expectSavepointFailure("ck_recipe_insert_ingredient", async () => {
      await databaseState.db.insert(centralKitchenRecipeIngredients).values({
        recipeId: revisedDraft.id,
        warehouseItemId: fixture.wrongUnitMaterialId,
        quantity: "1.000000",
        unit: "case",
      });
    });
    await expectSavepointFailure("ck_recipe_update_ingredient", async () => {
      await databaseState.db
        .update(centralKitchenRecipeIngredients)
        .set({ quantity: "99.000000" })
        .where(sql`${centralKitchenRecipeIngredients.id} = ${approvedIngredient.id}`);
    });
    await expectSavepointFailure("ck_recipe_delete_ingredient", async () => {
      await databaseState.db
        .delete(centralKitchenRecipeIngredients)
        .where(sql`${centralKitchenRecipeIngredients.id} = ${approvedIngredient.id}`);
    });
    const [unchangedIngredient] = await databaseState.db
      .select()
      .from(centralKitchenRecipeIngredients)
      .where(sql`${centralKitchenRecipeIngredients.id} = ${approvedIngredient.id}`)
      .limit(1);
    expect(unchangedIngredient).toEqual(approvedIngredient);

    const finalList = await invoke("get", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(finalList.statusCode).toBe(200);
    expect(finalList.body.filter((recipe: any) => recipe.status === "approved")).toHaveLength(1);
    expect(finalList.body.filter((recipe: any) => recipe.id === firstId)).toHaveLength(1);
    expect(finalList.body.filter((recipe: any) => recipe.id === revisedDraft.id)).toHaveLength(1);

    const discardCreate = await invoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      body: { ...createPayload(key("discard")), productId: fixture.alternateProductId, notes: "Draft to delete" },
    });
    expect(discardCreate.statusCode).toBe(201);
    const discard = recipeBody(discardCreate.body);
    const deleteBody = { ...revisionOf(discard), idempotencyKey: key("delete-draft") };
    const deleted = await invoke("delete", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(discard.id) },
      body: deleteBody,
    });
    expect([200, 204]).toContain(deleted.statusCode);
    const unauthorizedDeleteReplay = await invoke("delete", "/api/central-kitchen-recipes/:id", {
      user: { ...fixture.kitchenUser, testAllowedBranchIds: [] },
      params: { id: String(discard.id) },
      body: deleteBody,
    });
    expect(unauthorizedDeleteReplay.statusCode).toBe(403);
    const repeatedDelete = await invoke("delete", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(discard.id) },
      body: deleteBody,
    });
    expect(repeatedDelete.statusCode).toBe(200);
    expect(repeatedDelete.body).toEqual(deleted.body);
    const changedDeletePayload = await invoke("delete", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(discard.id) },
      body: { ...deleteBody, version: discard.version + 1 },
    });
    expect(changedDeletePayload.statusCode).toBe(409);
    const changedDeleteAction = await invoke("post", "/api/central-kitchen-recipes", {
      user: fixture.kitchenUser,
      body: { ...createPayload(deleteBody.idempotencyKey), productId: fixture.alternateProductId },
    });
    expect(changedDeleteAction.statusCode).toBe(409);
    const deletedDetail = await invoke("get", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(discard.id) },
    });
    expect(deletedDetail.statusCode).toBe(404);

    expect(await inventorySnapshot()).toEqual(balancesBefore);
  }, 30_000);
});