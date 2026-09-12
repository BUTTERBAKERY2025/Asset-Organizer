import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  branches,
  centralKitchenRuntime,
  products,
  users,
  warehouseItems,
} from "../shared/schema";
import * as schema from "../shared/schema";

const databaseState = vi.hoisted(() => ({ db: null as any, pool: null as any }));

// Authentication is the only production dependency replaced here.  Each route,
// storage operation, transaction, and inventory table below is real.
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
let sequence = 0;
let fixture: {
  kitchenBranchId: string;
  requestBranchId: string;
  outsiderBranchId: string;
  kitchenUser: any;
  requestUser: any;
  outsiderUser: any;
  productId: number;
  noRecipeProductId: number;
  materialId: number;
  transferMaterialId: number;
  recipe: any;
  recipeBatchId: number;
  recipeBatchOrderId: number;
  recipeBatchOrderItemId: number;
  recipeBatchIdempotencyKey: string;
  warehouseUser: any;
  sourceWarehouseUser: any;
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

function key(label: string) {
  sequence += 1;
  return `ck-material-integration-${label}-${sequence}-12345678`;
}

function bodyOf(value: any) {
  return value?.recipe || value?.data || value;
}

const permissions = {
  production: ["view", "create", "edit", "delete", "approve"],
  central_kitchen_orders: ["view", "create", "edit", "delete", "approve"],
  warehouse: ["view", "create", "edit", "delete", "approve"],
};

function actor(id: string, branchId: string, role = "manager") {
  return {
    id,
    username: id,
    branchId,
    role,
    testPermissions: permissions,
    testAllowedBranchIds: [branchId],
  };
}

function recipePayload(ingredientQuantity = 2, idempotencyKey = key("recipe")) {
  return {
    kitchenId: fixture.kitchenBranchId,
    productId: fixture.productId,
    outputQuantity: 4,
    outputUnit: "tray",
    ingredients: [{
      warehouseItemId: fixture.materialId,
      quantity: ingredientQuantity,
      unit: "kg",
    }],
    notes: "Recipe used by the material debit integration test",
    idempotencyKey,
  };
}

async function createApprovedRecipe() {
  const created = await invoke("post", "/api/central-kitchen-recipes", {
    user: fixture.kitchenUser,
    body: recipePayload(),
  });
  expect(created.statusCode).toBe(201);
  const draft = bodyOf(created.body);
  const approved = await invoke("post", "/api/central-kitchen-recipes/:id/approve", {
    user: fixture.kitchenUser,
    params: { id: String(draft.id) },
    body: { version: draft.version, updateToken: draft.updateToken, idempotencyKey: key("recipe-approve") },
  });
  expect(approved.statusCode).toBe(200);
  return bodyOf(approved.body);
}

async function createApprovedRealOrder(productId = fixture.productId, quantity = 4) {
  const [product] = await databaseState.db.execute(sql`
    SELECT name, unit FROM products WHERE id = ${productId}
  `).then((result: any) => result.rows);
  const created = await invoke("post", "/api/central-kitchen-orders", {
    user: fixture.requestUser,
    body: {
      requestBranchId: fixture.requestBranchId,
      centralKitchenId: fixture.kitchenBranchId,
      idempotencyKey: key("order"),
      items: [{ productId, productName: product.name, requestedQuantity: quantity, unit: product.unit }],
    },
  });
  expect(created.statusCode).toBe(201);
  expect(created.body.inventoryMode).toBe("real");
  const approved = await invoke("post", "/api/central-kitchen-orders/:id/approve", {
    user: fixture.kitchenUser,
    params: { id: String(created.body.id) },
    body: { idempotencyKey: key("order-approve") },
  });
  expect(approved.statusCode).toBe(200);
  return created.body;
}

async function createLinkedBatch(order: any, options: {
  recipeBacked: boolean;
  productionDate: string;
  idempotencyKey?: string;
  quantity?: number;
}) {
  const idempotencyKey = options.idempotencyKey || key("batch");
  return invoke("post", "/api/central-kitchen-orders/:id/items/:itemId/production-batches", {
    user: fixture.kitchenUser,
    params: { id: String(order.id), itemId: String(order.items[0].id) },
    // This is the body sent by the browser.  Do not rely on the optional
    // Idempotency-Key header for the recipe-backed production contract.
    body: {
      quantity: options.quantity || 1,
      productionDate: options.productionDate,
      recipeBacked: options.recipeBacked,
      idempotencyKey,
    },
  });
}

async function materialState() {
  const result = await databaseState.db.execute(sql`
    SELECT bs.current_quantity::text, bs.reserved_quantity::text, wi.current_stock::text
    FROM branch_stock bs
    INNER JOIN warehouse_items wi ON wi.id = bs.item_id
    WHERE bs.branch_id = ${fixture.kitchenBranchId} AND bs.item_id = ${fixture.materialId}
  `);
  const row = result.rows[0] as any;
  return {
    currentQuantity: row.current_quantity,
    reservedQuantity: row.reserved_quantity,
    mainWarehouseQuantity: row.current_stock,
  };
}

async function batchEffects(batchId: number) {
  const [movements, logs, inventory, batch] = await Promise.all([
    databaseState.db.execute(sql`
      SELECT warehouse_item_id, quantity::text, unit
      FROM central_kitchen_batch_material_movements WHERE batch_id = ${batchId}
      ORDER BY warehouse_item_id
    `),
    databaseState.db.execute(sql`
      SELECT id FROM production_inventory_logs WHERE batch_id = ${batchId}
    `),
    databaseState.db.execute(sql`
      SELECT COALESCE(SUM(quantity), 0)::text AS quantity
      FROM finished_goods_inventory
      WHERE branch_id = ${fixture.kitchenBranchId} AND product_id = ${fixture.productId}
    `),
    databaseState.db.execute(sql`
      SELECT status FROM daily_production_batches WHERE id = ${batchId}
    `),
  ]);
  return {
    movements: movements.rows,
    logs: logs.rows,
    finishedQuantity: inventory.rows[0].quantity,
    status: batch.rows[0]?.status,
  };
}

async function createWarehouseTransfer(quantity = 0.5, additionalTransferData: Record<string, unknown> = {}) {
  const created = await invoke("post", "/api/warehouse/material-transfers", {
    user: fixture.warehouseUser,
    body: {
      sourceType: "warehouse",
      // This is the production/UI sentinel, not a made-up test branch.
      sourceBranchId: "main_warehouse",
      destinationBranchId: fixture.kitchenBranchId,
      transferDate: "2099-02-10",
      notes: "Fractional material supply test",
      ...additionalTransferData,
      items: [{
        itemId: fixture.transferMaterialId,
        itemName: "Fractional supply material",
        category: "raw",
        unit: "kg",
        quantity,
      }],
    },
  });
  expect(created.statusCode).toBe(201);
  const items = await databaseState.db.execute(sql`
    SELECT id, item_id FROM material_transfer_items WHERE transfer_id = ${created.body.id}
  `);
  expect(items.rows).toHaveLength(1);
  return { transfer: created.body, item: items.rows[0] as any };
}

async function markTransferInTransit(transferId: number) {
  const approved = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
    user: fixture.warehouseUser,
    params: { id: String(transferId) },
    body: { status: "approved" },
  });
  expect(approved.statusCode).toBe(200);
  const response = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
    user: fixture.warehouseUser,
    params: { id: String(transferId) },
    body: { status: "in_transit" },
  });
  expect(response.statusCode).toBe(200);
}

async function supplyBalances() {
  const result = await databaseState.db.execute(sql`
    SELECT
      (SELECT current_stock::text FROM warehouse_items WHERE id = ${fixture.transferMaterialId}) AS warehouse,
      (SELECT COALESCE(current_quantity, 0)::text FROM branch_stock
       WHERE branch_id = ${fixture.kitchenBranchId} AND item_id = ${fixture.transferMaterialId}) AS kitchen
  `);
  return result.rows[0] as { warehouse: string; kitchen: string };
}

async function transferRows(transferId: number) {
  const [transfer, item, logs] = await Promise.all([
    databaseState.db.execute(sql`
      SELECT status, source_branch_id, destination_branch_id
      FROM material_transfers WHERE id = ${transferId}
    `),
    databaseState.db.execute(sql`
      SELECT received_quantity::text, discrepancy::text
      FROM material_transfer_items WHERE transfer_id = ${transferId}
    `),
    databaseState.db.execute(sql`
      SELECT movement_type, branch_id, quantity::text
      FROM warehouse_movement_logs
      WHERE reference_type = 'transfer' AND reference_id = ${transferId}
      ORDER BY id
    `),
  ]);
  return { transfer: transfer.rows[0] as any, item: item.rows[0] as any, logs: logs.rows as any[] };
}

/*
 * This rollback fixture intentionally holds one development-DB connection.
 * A Promise.all race inside it would be re-entrant work on that same
 * transaction, not two contending database sessions.  We do not create a
 * second independent connection because it could not observe the uncommitted
 * fixtures without committing them, and this suite must never write outside
 * its DEV rollback boundary.  Cross-connection race coverage therefore
 * belongs in a disposable-schema harness, not a falsely concurrent test here.
 */
describe.sequential("recipe-backed central-kitchen batch materials (development DB)", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Batch material integration tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, allowExitOnIdle: true });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const finishPromise = new Promise<void>((resolve) => { finishTransaction = resolve; });
    const rollback = new Error("CENTRAL_KITCHEN_BATCH_MATERIAL_TEST_ROLLBACK");
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

    const migrations = await databaseState.db.execute(sql`
      SELECT to_regclass('central_kitchen_batch_recipe_snapshots') AS snapshots,
             to_regclass('central_kitchen_batch_materials') AS materials,
             to_regclass('central_kitchen_batch_material_movements') AS movements,
             (SELECT data_type FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND table_name = 'branch_stock'
                AND column_name = 'current_quantity') AS branch_quantity_type,
             (SELECT data_type FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND table_name = 'branch_stock'
                AND column_name = 'reserved_quantity') AS branch_reserved_type
    `);
    const migrationRow = migrations.rows[0] as Record<string, unknown>;
    if (!migrationRow.snapshots || !migrationRow.materials || !migrationRow.movements) {
      throw new Error("Migration 033_central_kitchen_batch_materials.sql must be applied before this suite");
    }
    if (migrationRow.branch_quantity_type !== "numeric" || migrationRow.branch_reserved_type !== "numeric") {
      throw new Error("Migration 032 material decimal balances must be applied before this suite");
    }

    const suffix = `${process.pid}-${Date.now()}`;
    const kitchenBranchId = `ck-material-kitchen-${suffix}`;
    const requestBranchId = `ck-material-request-${suffix}`;
    const outsiderBranchId = `ck-material-outsider-${suffix}`;
    const kitchenUser = actor(`ck-material-kitchen-user-${suffix}`, kitchenBranchId);
    const requestUser = actor(`ck-material-request-user-${suffix}`, requestBranchId);
    const outsiderUser = actor(`ck-material-outsider-user-${suffix}`, outsiderBranchId);
    const warehouseUser = actor(`ck-material-warehouse-user-${suffix}`, "main_warehouse", "admin");
    const sourceWarehouseUser = actor(`ck-material-source-user-${suffix}`, "main_warehouse");

    await databaseState.db.insert(branches).values([
      { id: kitchenBranchId, name: "CK materials kitchen", isCentralKitchen: true },
      { id: requestBranchId, name: "CK materials requesting branch" },
      { id: outsiderBranchId, name: "CK materials outsider branch" },
    ]);
    // The production transfer UI uses this existing sentinel as its warehouse
    // source.  Creating it only when absent keeps the FK-backed fixture safe
    // on otherwise empty development databases.
    await databaseState.db.execute(sql`
      INSERT INTO branches (id, name) VALUES ('main_warehouse', 'Main Warehouse')
      ON CONFLICT (id) DO NOTHING
    `);
    await databaseState.db.insert(users).values([
      { id: kitchenUser.id, username: kitchenUser.username, role: kitchenUser.role, branchId: kitchenBranchId },
      { id: requestUser.id, username: requestUser.username, role: requestUser.role, branchId: requestBranchId },
      { id: outsiderUser.id, username: outsiderUser.username, role: outsiderUser.role, branchId: outsiderBranchId },
      { id: warehouseUser.id, username: warehouseUser.username, role: warehouseUser.role, branchId: "main_warehouse" },
      { id: sourceWarehouseUser.id, username: sourceWarehouseUser.username, role: sourceWarehouseUser.role, branchId: "main_warehouse" },
    ]);

    const ids = await databaseState.db.execute(sql`
      SELECT GREATEST(
        COALESCE((SELECT MAX(id) FROM products), 0),
        COALESCE((SELECT MAX(id) FROM warehouse_items), 0)
      )::int + 6000 AS id
    `);
    const productId = Number(ids.rows[0].id);
    const noRecipeProductId = productId + 1;
    const materialId = productId + 2;
    const transferMaterialId = productId + 3;
    await databaseState.db.insert(products).values([
      { id: productId, name: `CK fractional output ${suffix}`, category: "test", unit: "tray", isActive: "true" },
      { id: noRecipeProductId, name: `CK no-recipe output ${suffix}`, category: "test", unit: "tray", isActive: "true" },
    ]);
    await databaseState.db.insert(warehouseItems).values([
      {
        id: materialId,
        name: `CK fractional material ${suffix}`,
        category: "raw",
        unit: "kg",
        currentStock: 100,
        isActive: true,
      },
      {
        id: transferMaterialId,
        name: "Fractional supply material",
        category: "raw",
        unit: "kg",
        currentStock: 5,
        isActive: true,
      },
    ]);
    // NUMERIC values are deliberately inserted with raw SQL: the pre-033
    // Drizzle declaration is integer-shaped while migration 032 makes kitchen
    // material balances decimal.
    await databaseState.db.execute(sql`
      INSERT INTO branch_stock (branch_id, item_id, current_quantity, reserved_quantity)
      VALUES (${kitchenBranchId}, ${materialId}, 0.750000, 0.300000)
    `);
    await databaseState.db.execute(sql`
      INSERT INTO branch_stock (branch_id, item_id, current_quantity, reserved_quantity)
      VALUES (${kitchenBranchId}, ${transferMaterialId}, 0.000000, 0.000000)
    `);
    await databaseState.db.insert(centralKitchenRuntime).values({
      kitchenId: kitchenBranchId,
      mode: "real",
      updatedBy: kitchenUser.id,
    });

    fixture = {
      kitchenBranchId,
      requestBranchId,
      outsiderBranchId,
      kitchenUser,
      requestUser,
      outsiderUser,
      productId,
      noRecipeProductId,
      materialId,
      transferMaterialId,
      recipe: null,
      recipeBatchId: 0,
      recipeBatchOrderId: 0,
      recipeBatchOrderItemId: 0,
      recipeBatchIdempotencyKey: "",
      warehouseUser,
      sourceWarehouseUser,
    };
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
    fixture.recipe = await createApprovedRecipe();
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("freezes the approved recipe at batch creation and previews fractional availability excluding reservations", async () => {
    const order = await createApprovedRealOrder();
    const createKey = key("recipe-backed-batch");
    const created = await createLinkedBatch(order, {
      recipeBacked: true,
      productionDate: "2099-01-01",
      idempotencyKey: createKey,
    });
    expect(created.statusCode).toBe(201);
    expect(created.body).toMatchObject({ recipeBacked: true, status: "in_progress" });
    fixture.recipeBatchId = created.body.id;
    fixture.recipeBatchOrderId = order.id;
    fixture.recipeBatchOrderItemId = order.items[0].id;
    fixture.recipeBatchIdempotencyKey = createKey;

    const requirements = await invoke(
      "get",
      "/api/central-kitchen/production/batches/:batchId/material-requirements",
      { user: fixture.kitchenUser, params: { batchId: String(created.body.id) } },
    );
    expect(requirements.statusCode).toBe(200);
    expect(requirements.body).toMatchObject({
      recipeBacked: true,
      batchQuantity: "1.000000",
      materialConsumptionStatus: "pending",
      recipe: {
        recipeId: fixture.recipe.id,
        recipeVersion: fixture.recipe.version,
        outputQuantity: "4.000000",
        outputUnit: "tray",
      },
      requirements: [expect.objectContaining({
        warehouseItemId: fixture.materialId,
        recipeQuantity: "2.000000",
        requiredQuantity: "0.500000",
        currentQuantity: "0.750000",
        reservedQuantity: "0.300000",
        availableQuantity: "0.450000",
        shortageQuantity: "0.050000",
        unit: "kg",
      })],
    });

    const snapshot = await databaseState.db.execute(sql`
      SELECT source_recipe_id, source_recipe_version, recipe_output_quantity::text, batch_output_quantity::text,
             ingredient_count, ingredient_checksum
      FROM central_kitchen_batch_recipe_snapshots WHERE batch_id = ${created.body.id}
    `);
    const materials = await databaseState.db.execute(sql`
      SELECT warehouse_item_id, recipe_quantity::text, required_quantity::text
      FROM central_kitchen_batch_materials WHERE batch_id = ${created.body.id}
    `);
    expect(snapshot.rows).toEqual([{
      source_recipe_id: fixture.recipe.id,
      source_recipe_version: fixture.recipe.version,
      recipe_output_quantity: "4.000000",
      batch_output_quantity: "1.000000",
      ingredient_count: 1,
      ingredient_checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    }]);
    expect(materials.rows).toEqual([{
      warehouse_item_id: fixture.materialId,
      recipe_quantity: "2.000000",
      required_quantity: "0.500000",
    }]);
  });

  it("rolls back an insufficient completion, then debits exactly once after fractional replenishment", async () => {
    const before = await materialState();
    const beforeEffects = await batchEffects(fixture.recipeBatchId);
    const insufficient = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(fixture.recipeBatchId) },
    });
    expect(insufficient.statusCode).toBe(409);
    expect(await materialState()).toEqual(before);
    expect(await batchEffects(fixture.recipeBatchId)).toEqual(beforeEffects);
    expect(beforeEffects).toMatchObject({
      movements: [],
      logs: [],
      finishedQuantity: "0",
      status: "in_progress",
    });

    // Only 0.05 kg is replenished; the reserved 0.30 kg remains unavailable.
    await databaseState.db.execute(sql`
      UPDATE branch_stock SET current_quantity = 0.800000
      WHERE branch_id = ${fixture.kitchenBranchId} AND item_id = ${fixture.materialId}
    `);
    const finished = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(fixture.recipeBatchId) },
    });
    expect(finished.statusCode).toBe(200);
    expect(finished.body.status).toBe("finished");
    expect(await materialState()).toEqual({
      currentQuantity: "0.300000",
      reservedQuantity: "0.300000",
      mainWarehouseQuantity: "100.000000",
    });
    expect(await batchEffects(fixture.recipeBatchId)).toMatchObject({
      movements: [{ warehouse_item_id: fixture.materialId, quantity: "0.500000", unit: "kg" }],
      logs: [expect.any(Object)],
      finishedQuantity: "1",
      status: "finished",
    });
    const consumedRequirements = await invoke(
      "get",
      "/api/central-kitchen/production/batches/:batchId/material-requirements",
      { user: fixture.kitchenUser, params: { batchId: String(fixture.recipeBatchId) } },
    );
    expect(consumedRequirements.body).toMatchObject({
      recipeBacked: true,
      materialConsumptionStatus: "consumed",
      consumedAt: expect.any(String),
    });

    const retry = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(fixture.recipeBatchId) },
    });
    expect(retry.statusCode).toBe(200);
    expect(await materialState()).toEqual({
      currentQuantity: "0.300000",
      reservedQuantity: "0.300000",
      mainWarehouseQuantity: "100.000000",
    });
    const afterRetry = await batchEffects(fixture.recipeBatchId);
    expect(afterRetry.movements).toHaveLength(1);
    expect(afterRetry.logs).toHaveLength(1);
    expect(afterRetry.finishedQuantity).toBe("1");
  });

  it("rejects no-recipe and over-precise browser payloads without creating a batch or snapshot", async () => {
    const noRecipeOrder = await createApprovedRealOrder(fixture.noRecipeProductId);
    const noRecipe = await createLinkedBatch(noRecipeOrder, {
      recipeBacked: true,
      productionDate: "2099-01-02",
    });
    expect(noRecipe.statusCode).toBe(409);
    const noRecipeRows = await databaseState.db.execute(sql`
      SELECT id FROM daily_production_batches
      WHERE central_kitchen_order_item_id = ${noRecipeOrder.items[0].id}
    `);
    expect(noRecipeRows.rows).toEqual([]);

    const beforeSnapshots = await databaseState.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM central_kitchen_batch_recipe_snapshots
    `);
    const tooPrecise = await invoke("post", "/api/central-kitchen-orders/:id/items/:itemId/production-batches", {
      user: fixture.kitchenUser,
      params: { id: String(noRecipeOrder.id), itemId: String(noRecipeOrder.items[0].id) },
      body: {
        quantity: 1.0000001,
        productionDate: "2099-01-03",
        recipeBacked: true,
        idempotencyKey: key("too-precise-batch"),
      },
    });
    expect(tooPrecise.statusCode).toBe(400);
    const tooPrecisePreview = await invoke("get", "/api/central-kitchen/production/requirements", {
      user: fixture.kitchenUser,
      query: {
        kitchenId: fixture.kitchenBranchId,
        productId: String(fixture.productId),
        quantity: "1.0000001",
      },
    });
    expect(tooPrecisePreview.statusCode).toBe(400);
    const genericRecipeFlag = await invoke("post", "/api/daily-production/batches", {
      user: fixture.kitchenUser,
      body: { recipeBacked: true },
    });
    expect(genericRecipeFlag.statusCode).toBe(400);
    const afterSnapshots = await databaseState.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM central_kitchen_batch_recipe_snapshots
    `);
    expect(afterSnapshots.rows).toEqual(beforeSnapshots.rows);
  });

  it("does not infer recipe consumption for a legacy non-recipe linked batch", async () => {
    const order = await createApprovedRealOrder();
    const beforeMaterial = await materialState();
    const created = await createLinkedBatch(order, {
      recipeBacked: false,
      productionDate: "2099-01-04",
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.recipeBacked).toBe(false);

    const finished = await invoke("post", "/api/daily-production/batches/:id/finish", {
      user: fixture.kitchenUser,
      params: { id: String(created.body.id) },
    });
    expect(finished.statusCode).toBe(200);
    expect(await materialState()).toEqual(beforeMaterial);
    const effects = await batchEffects(created.body.id);
    expect(effects.movements).toEqual([]);
    expect(effects.logs).toHaveLength(1);
    expect(effects.finishedQuantity).toBe("2");
    const legacyRequirements = await invoke(
      "get",
      "/api/central-kitchen/production/batches/:batchId/material-requirements",
      { user: fixture.kitchenUser, params: { batchId: String(created.body.id) } },
    );
    expect(legacyRequirements.body).toMatchObject({
      recipeBacked: false,
      recipe: null,
      requirements: [],
      materialConsumptionStatus: "not_applicable",
    });
  });

  it("receives a fractional main-warehouse supply once and makes same-key confirmation replay safe", async () => {
    const { transfer, item } = await createWarehouseTransfer(0.5);
    await markTransferInTransit(transfer.id);
    const before = await supplyBalances();
    const confirmation = {
      receivedItems: [{ itemId: item.item_id, receivedQuantity: 0.5 }],
      receiverSignature: "fractional-receipt",
      deliveryNotes: "Received exactly half a kilogram",
      idempotencyKey: key("supply-confirm"),
    };
    const first = await invoke("post", "/api/warehouse/material-transfers/:id/confirm-delivery", {
      user: fixture.kitchenUser,
      params: { id: String(transfer.id) },
      headers: { "Idempotency-Key": confirmation.idempotencyKey },
      body: confirmation,
    });
    expect(first.statusCode).toBe(200);
    expect(await supplyBalances()).toEqual({
      warehouse: "4.500000",
      kitchen: "0.500000",
    });
    const firstRows = await transferRows(transfer.id);
    expect(firstRows.transfer.status).toBe("delivered");
    expect(firstRows.item).toMatchObject({ received_quantity: "0.500000", discrepancy: "0.000000" });
    expect(firstRows.logs.some((log) => log.movement_type === "transfer_in" && log.quantity === "0.500000")).toBe(true);

    const replay = await invoke("post", "/api/warehouse/material-transfers/:id/confirm-delivery", {
      user: fixture.kitchenUser,
      params: { id: String(transfer.id) },
      headers: { "Idempotency-Key": confirmation.idempotencyKey },
      body: confirmation,
    });
    expect(replay.statusCode).toBe(200);
    expect(await supplyBalances()).toEqual({
      warehouse: "4.500000",
      kitchen: "0.500000",
    });
    expect(await transferRows(transfer.id)).toEqual(firstRows);

    const changedReplay = await invoke("post", "/api/warehouse/material-transfers/:id/confirm-delivery", {
      user: fixture.kitchenUser,
      params: { id: String(transfer.id) },
      headers: { "Idempotency-Key": confirmation.idempotencyKey },
      body: {
        ...confirmation,
        receivedItems: [{ itemId: item.item_id, receivedQuantity: 0.4 }],
      },
    });
    expect(changedReplay.statusCode).toBe(409);
    expect(await supplyBalances()).toEqual({
      warehouse: "4.500000",
      kitchen: "0.500000",
    });
    expect(await transferRows(transfer.id)).toEqual(firstRows);
    expect(before).toEqual({ warehouse: "5.000000", kitchen: "0.000000" });
  });

  it("accepts a zero receipt without destination credit/audit and rejects an over-receipt atomically", async () => {
    const zeroReceipt = await createWarehouseTransfer(0.5);
    await markTransferInTransit(zeroReceipt.transfer.id);
    const beforeZero = await supplyBalances();
    const zeroKey = key("zero-receipt");
    const zero = await invoke("post", "/api/warehouse/material-transfers/:id/confirm-delivery", {
      user: fixture.kitchenUser,
      params: { id: String(zeroReceipt.transfer.id) },
      headers: { "Idempotency-Key": zeroKey },
      body: {
        receivedItems: [{ itemId: zeroReceipt.item.item_id, receivedQuantity: 0 }],
        idempotencyKey: zeroKey,
      },
    });
    expect(zero.statusCode).toBe(200);
    expect(await supplyBalances()).toEqual({
      warehouse: "4.000000",
      kitchen: beforeZero.kitchen,
    });
    const zeroRows = await transferRows(zeroReceipt.transfer.id);
    expect(zeroRows.transfer.status).toBe("delivered");
    expect(zeroRows.item).toMatchObject({ received_quantity: "0.000000", discrepancy: "-0.500000" });
    expect(zeroRows.logs.filter((log) => log.movement_type === "transfer_in")).toEqual([]);

    const overReceipt = await createWarehouseTransfer(0.5);
    await markTransferInTransit(overReceipt.transfer.id);
    const beforeOver = await supplyBalances();
    const overKey = key("over-receipt");
    const rejected = await invoke("post", "/api/warehouse/material-transfers/:id/confirm-delivery", {
      user: fixture.kitchenUser,
      params: { id: String(overReceipt.transfer.id) },
      headers: { "Idempotency-Key": overKey },
      body: {
        receivedItems: [{ itemId: overReceipt.item.item_id, receivedQuantity: 0.500001 }],
        idempotencyKey: overKey,
      },
    });
    expect(rejected.statusCode).toBe(409);
    expect(await supplyBalances()).toEqual(beforeOver);
    expect(await transferRows(overReceipt.transfer.id)).toMatchObject({
      transfer: { status: "in_transit" },
      item: { received_quantity: null, discrepancy: null },
      logs: [],
    });
  });

  it("uses the same main-warehouse debit path for the generic delivered status endpoint", async () => {
    const { transfer } = await createWarehouseTransfer(0.5);
    await markTransferInTransit(transfer.id);
    const before = await supplyBalances();
    const delivered = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
      user: fixture.kitchenUser,
      params: { id: String(transfer.id) },
      body: { status: "delivered" },
    });
    expect(delivered.statusCode).toBe(200);
    expect(await supplyBalances()).toEqual({
      warehouse: "3.500000",
      kitchen: "1.000000",
    });
    const rows = await transferRows(transfer.id);
    expect(rows.transfer.status).toBe("delivered");
    expect(rows.logs.some((log) => log.movement_type === "transfer_in" && log.quantity === "0.500000")).toBe(true);
    expect(before).toEqual({ warehouse: "4.000000", kitchen: "0.500000" });
  });

  it("enforces the warehouse transfer authority/state graph and ignores identity fields in status payloads", async () => {
    // Creation is source-owned and always begins pending, even if a browser
    // attempts to supply a later terminal/intermediate status.
    const { transfer } = await createWarehouseTransfer(0.5, { status: "approved" });
    expect((await transferRows(transfer.id)).transfer).toMatchObject({
      status: "pending",
      source_branch_id: "main_warehouse",
      destination_branch_id: fixture.kitchenBranchId,
    });

    // A destination actor may acknowledge receipt only; it cannot approve or
    // dispatch the warehouse's pending request.
    for (const status of ["approved", "in_transit"]) {
      const denied = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
        user: fixture.kitchenUser,
        params: { id: String(transfer.id) },
        body: { status },
      });
      expect(denied.statusCode, `destination cannot set ${status}`).toBe(403);
      expect((await transferRows(transfer.id)).transfer.status).toBe("pending");
    }

    // Source-side progress is legal, but request-body additional data must
    // never be able to retarget the immutable transfer identity.
    const approved = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
      user: fixture.sourceWarehouseUser,
      params: { id: String(transfer.id) },
      body: {
        status: "approved",
        sourceBranchId: fixture.outsiderBranchId,
        destinationBranchId: fixture.outsiderBranchId,
      },
    });
    expect(approved.statusCode).toBe(200);
    expect((await transferRows(transfer.id)).transfer).toMatchObject({
      status: "approved",
      source_branch_id: "main_warehouse",
      destination_branch_id: fixture.kitchenBranchId,
    });
    const dispatched = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
      user: fixture.sourceWarehouseUser,
      params: { id: String(transfer.id) },
      body: { status: "in_transit" },
    });
    expect(dispatched.statusCode).toBe(200);

    const beforeDelivery = await supplyBalances();
    const delivered = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
      user: fixture.kitchenUser,
      params: { id: String(transfer.id) },
      body: { status: "delivered" },
    });
    expect(delivered.statusCode).toBe(200);
    const afterDelivery = await supplyBalances();
    expect(afterDelivery).toEqual({
      warehouse: "3.000000",
      kitchen: "1.500000",
    });

    // A delivered transfer is terminal: it cannot be reset and then used to
    // perform a second delivery debit/credit.
    const reset = await invoke("put", "/api/warehouse/material-transfers/:id/status", {
      user: fixture.sourceWarehouseUser,
      params: { id: String(transfer.id) },
      body: { status: "pending" },
    });
    expect(reset.statusCode).toBe(409);
    expect(await supplyBalances()).toEqual(afterDelivery);
    expect((await transferRows(transfer.id)).transfer).toMatchObject({ status: "delivered" });

    // Receipt is forbidden until a separate transfer has actually moved into
    // transit; failure cannot produce a partial receipt, source debit, or log.
    const pending = await createWarehouseTransfer(0.5);
    const beforePrematureReceipt = await supplyBalances();
    const prematureKey = key("premature-receipt");
    const premature = await invoke("post", "/api/warehouse/material-transfers/:id/confirm-delivery", {
      user: fixture.kitchenUser,
      params: { id: String(pending.transfer.id) },
      headers: { "Idempotency-Key": prematureKey },
      body: {
        receivedItems: [{ itemId: pending.item.item_id, receivedQuantity: 0.5 }],
        idempotencyKey: prematureKey,
      },
    });
    expect(premature.statusCode).toBe(409);
    expect(await supplyBalances()).toEqual(beforePrematureReceipt);
    expect(await transferRows(pending.transfer.id)).toMatchObject({
      transfer: { status: "pending" },
      item: { received_quantity: null, discrepancy: null },
      logs: [],
    });
    expect(beforeDelivery).toEqual({ warehouse: "3.500000", kitchen: "1.000000" });
  });

  it("keeps the existing snapshot after a superseding recipe and protects an unauthorized idempotent replay", async () => {
    const beforeBatchRequirements = await invoke(
      "get",
      "/api/central-kitchen/production/batches/:batchId/material-requirements",
      { user: fixture.kitchenUser, params: { batchId: String(fixture.recipeBatchId) } },
    );
    const oldRecipeResponse = await invoke("get", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(fixture.recipe.id) },
    });
    expect(oldRecipeResponse.statusCode).toBe(200);
    const oldRecipe = bodyOf(oldRecipeResponse.body);
    const revisedResponse = await invoke("post", "/api/central-kitchen-recipes/:id/revise", {
      user: fixture.kitchenUser,
      params: { id: String(oldRecipe.id) },
      body: { version: oldRecipe.version, updateToken: oldRecipe.updateToken, idempotencyKey: key("revise") },
    });
    expect(revisedResponse.statusCode).toBe(201);
    const revised = bodyOf(revisedResponse.body);
    const edited = await invoke("patch", "/api/central-kitchen-recipes/:id", {
      user: fixture.kitchenUser,
      params: { id: String(revised.id) },
      body: {
        ...recipePayload(4, key("revise-edit")),
        version: revised.version,
        updateToken: revised.updateToken,
      },
    });
    expect(edited.statusCode).toBe(200);
    const editedRecipe = bodyOf(edited.body);
    const approved = await invoke("post", "/api/central-kitchen-recipes/:id/approve", {
      user: fixture.kitchenUser,
      params: { id: String(revised.id) },
      body: { version: editedRecipe.version, updateToken: editedRecipe.updateToken, idempotencyKey: key("revise-approve") },
    });
    expect(approved.statusCode).toBe(200);

    const oldBatchAfterSupersession = await invoke(
      "get",
      "/api/central-kitchen/production/batches/:batchId/material-requirements",
      { user: fixture.kitchenUser, params: { batchId: String(fixture.recipeBatchId) } },
    );
    expect(oldBatchAfterSupersession.statusCode).toBe(200);
    expect(oldBatchAfterSupersession.body).toEqual(beforeBatchRequirements.body);
    const currentPreview = await invoke("get", "/api/central-kitchen/production/requirements", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId, productId: String(fixture.productId), quantity: "1" },
    });
    expect(currentPreview.statusCode).toBe(200);
    expect(currentPreview.body).toMatchObject({
      recipeBacked: true,
      recipe: { recipeId: revised.id },
      requirements: [expect.objectContaining({ requiredQuantity: "1.000000" })],
    });

    const unauthorizedReplay = await invoke(
      "post",
      "/api/central-kitchen-orders/:id/items/:itemId/production-batches",
      {
        user: { ...fixture.kitchenUser, testAllowedBranchIds: [] },
        params: {
          id: String(fixture.recipeBatchOrderId),
          itemId: String(fixture.recipeBatchOrderItemId),
        },
        body: {
          quantity: 1,
          productionDate: "2099-01-01",
          recipeBacked: true,
          idempotencyKey: fixture.recipeBatchIdempotencyKey,
        },
      },
    );
    expect(unauthorizedReplay.statusCode).toBe(403);
    const movements = await batchEffects(fixture.recipeBatchId);
    expect(movements.movements).toHaveLength(1);
    expect(movements.logs).toHaveLength(1);
  });
});