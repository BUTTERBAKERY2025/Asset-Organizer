import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";
import {
  CENTRAL_KITCHEN_WORKPLAN_OVERDUE_LOOKBACK_DAYS,
  CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
  type CentralKitchenWorkplan,
} from "../shared/central-kitchen-workplan";

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
  const allowedBranches = (req: any) =>
    new Set<string>(req.currentUser?.testAllowedBranchIds || [req.currentUser?.branchId].filter(Boolean));
  const isAdmin = (req: any) => req.currentUser?.role === "admin";
  const middleware = (module: string, action: string) => (req: any, res: any, next: () => any) => {
    if (!req.currentUser) return res.status(401).json({ error: "Unauthenticated" });
    if (isAdmin(req) || (req.currentUser.testPermissions?.[module] || []).includes(action)) return next();
    return res.status(403).json({ error: `Missing ${module}:${action}` });
  };
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: (req: any, res: any, next: () => any) =>
      req.currentUser ? next() : res.status(401).json({ error: "Unauthenticated" }),
    requirePermission: middleware,
    requireAnyPermission: () => (_req: any, _res: any, next: () => any) => next(),
    requireRole: () => (_req: any, _res: any, next: () => any) => next(),
    requireBranchAccess: () => (_req: any, _res: any, next: () => any) => next(),
    canAccessBranch: async (req: any, branchId: string) => isAdmin(req) || allowedBranches(req).has(branchId),
    isUserAdmin: isAdmin,
    getAllowedBranchIds: async (req: any) => isAdmin(req) ? null : Array.from(allowedBranches(req)),
    getActiveBranchFilter: (req: any) => req.currentUser?.branchId || null,
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      if (isAdmin(req)) return { hasAccess: true, singleBranchId: requested || null, branchIds: null };
      const ids = Array.from(allowedBranches(req));
      return {
        hasAccess: Boolean(requested && ids.includes(requested)),
        singleBranchId: requested || null,
        branchIds: ids,
      };
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
  handlers: Array<(req: any, res: any, next: () => any) => any>;
};
type TestResponse = { statusCode: number; body: any; headers: Record<string, string> };

const registrations: Registration[] = [];
let finishTransaction!: () => void;
let transactionPromise!: Promise<void>;
let fixture: {
  kitchenBranchId: string;
  alternateKitchenBranchId: string;
  requestBranchId: string;
  outsiderKitchenBranchId: string;
  kitchenUser: any;
  noPermissionUser: any;
  branchSpoofUser: any;
  productId: number;
  boxProductId: number;
  outsiderProductId: number;
  materialId: number;
  dateOrderId: number;
  dateOrderItemId: number;
  overdueOrderId: number;
  futureOrderId: number;
  consumedBatchId: number;
  pendingBatchId: number;
  legacyBatchId: number;
  unknownBatchId: number;
  unrelatedBatchId: number;
  limitPrefix: string;
};

function captureApp() {
  const app: any = {};
  for (const method of ["get", "post", "put", "patch", "delete", "options"]) {
    app[method] = (path: string, ...handlers: Registration["handlers"]) => {
      registrations.push({ method, path, handlers });
      return app;
    };
  }
  return app;
}

function findRoute(method: string, path: string) {
  const registration = registrations.find((entry) => entry.method === method && entry.path === path);
  if (!registration) throw new Error(`Route was not registered: ${method.toUpperCase()} ${path}`);
  return registration;
}

async function invoke(
  method: string,
  path: string,
  options: { user?: any; query?: Record<string, string> },
): Promise<TestResponse> {
  const response: TestResponse = { statusCode: 200, body: undefined, headers: {} };
  const req: any = {
    method: method.toUpperCase(),
    currentUser: options.user,
    query: options.query || {},
  };
  const res: any = {
    status(code: number) { response.statusCode = code; return res; },
    set(name: string, value: string) { response.headers[name.toLowerCase()] = value; return res; },
    json(body: any) { response.body = body; return res; },
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

function workplanQuery(kitchenId: string, date = "2035-06-10") {
  return { kitchenId, date };
}

function sqlText(value: any): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(sqlText).join("");
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value.value)) return value.value.map(sqlText).join("");
  if (typeof value.value === "string") return value.value;
  if (Array.isArray(value.queryChunks)) return value.queryChunks.map(sqlText).join("");
  return "";
}

/*
 * The fixture is deliberately held in one development transaction and rolled
 * back. The route starts a read-only repeatable-read transaction of its own;
 * only that transaction-control statement is suppressed because PostgreSQL
 * cannot change isolation after the fixture inserts on this one connection.
 * All workplan SELECTs still execute against the real database transaction.
 */
function rollbackFixtureDatabase(tx: any) {
  const readOnlySnapshotTx = new Proxy(tx, {
    get(target, property) {
      if (property === "execute") {
        return async (query: any) => {
          if (sqlText(query).replace(/\s+/g, " ").includes("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")) {
            return { rows: [] };
          }
          return target.execute(query);
        };
      }
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return new Proxy(tx, {
    get(target, property) {
      if (property === "transaction") return async (callback: (nested: any) => Promise<any>) => callback(readOnlySnapshotTx);
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function stockSnapshot() {
  const result = await databaseState.db.execute(sql`
    SELECT
      (SELECT json_agg(x ORDER BY x.branch_id, x.item_id)
       FROM (
         SELECT branch_id, item_id, current_quantity::text, reserved_quantity::text
         FROM branch_stock
         WHERE branch_id IN (
           ${fixture.kitchenBranchId}, ${fixture.alternateKitchenBranchId},
           ${fixture.requestBranchId}, ${fixture.outsiderKitchenBranchId}
         )
           AND item_id = ${fixture.materialId}
       ) x) AS branch_stock,
      (SELECT json_agg(x ORDER BY x.id)
       FROM (
         SELECT id, current_stock::text
         FROM warehouse_items
         WHERE id = ${fixture.materialId}
       ) x) AS warehouse_items
  `);
  return result.rows[0];
}

describe.sequential("central kitchen workplan database-backed read-only workflow", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Central-kitchen workplan integration tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, allowExitOnIdle: true });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const finishPromise = new Promise<void>((resolve) => { finishTransaction = resolve; });
    const rollback = new Error("CENTRAL_KITCHEN_WORKPLAN_TEST_ROLLBACK");
    transactionPromise = realDb.transaction(async (tx) => {
      databaseState.db = rollbackFixtureDatabase(tx);
      ready();
      await finishPromise;
      throw rollback;
    }).then(
      () => { throw new Error("Integration transaction unexpectedly committed"); },
      (error) => { if (error !== rollback) throw error; },
    );
    await readyPromise;

    const migrationState = await databaseState.db.execute(sql`
      SELECT
        to_regclass('central_kitchen_batch_material_movements') AS movements,
        to_regclass('central_kitchen_batch_recipe_snapshots') AS snapshots
    `);
    if (!migrationState.rows[0]?.movements || !migrationState.rows[0]?.snapshots) {
      throw new Error("Migration 033_central_kitchen_batch_materials.sql must be applied before this suite");
    }

    const suffix = `${process.pid}-${Date.now()}`;
    const kitchenBranchId = `workplan-kitchen-${suffix}`;
    const alternateKitchenBranchId = `workplan-kitchen-alt-${suffix}`;
    const requestBranchId = `workplan-request-${suffix}`;
    const outsiderKitchenBranchId = `workplan-outsider-${suffix}`;
    const kitchenUser = {
      id: `workplan-kitchen-user-${suffix}`,
      username: `workplan-kitchen-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
      testPermissions: { production: ["view"] },
      testAllowedBranchIds: [kitchenBranchId],
    };
    const noPermissionUser = {
      id: `workplan-denied-user-${suffix}`,
      username: `workplan-denied-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
      testPermissions: { production: [] },
      testAllowedBranchIds: [kitchenBranchId],
    };
    const branchSpoofUser = {
      id: `workplan-spoof-user-${suffix}`,
      username: `workplan-spoof-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
      testPermissions: { production: ["view"] },
      testAllowedBranchIds: [kitchenBranchId],
    };

    await databaseState.db.execute(sql`
      INSERT INTO branches (id, name, is_central_kitchen) VALUES
        (${kitchenBranchId}, 'Workplan central kitchen', true),
        (${alternateKitchenBranchId}, 'Workplan alternate kitchen', true),
        (${requestBranchId}, 'Workplan request branch', false),
        (${outsiderKitchenBranchId}, 'Workplan outsider kitchen', true)
    `);
    await databaseState.db.execute(sql`
      INSERT INTO users (id, username, role, branch_id) VALUES
        (${kitchenUser.id}, ${kitchenUser.username}, ${kitchenUser.role}, ${kitchenBranchId}),
        (${noPermissionUser.id}, ${noPermissionUser.username}, ${noPermissionUser.role}, ${kitchenBranchId}),
        (${branchSpoofUser.id}, ${branchSpoofUser.username}, ${branchSpoofUser.role}, ${kitchenBranchId})
    `);

    const ids = await databaseState.db.execute(sql`
      SELECT GREATEST(
        COALESCE((SELECT MAX(id) FROM products), 0),
        COALESCE((SELECT MAX(id) FROM warehouse_items), 0)
      )::int + 12000 AS id
    `);
    const productId = Number((ids.rows[0] as any).id);
    const boxProductId = productId + 1;
    const outsiderProductId = productId + 2;
    const materialId = productId + 3;
    await databaseState.db.execute(sql`
      INSERT INTO products (id, name, category, unit, is_active) VALUES
        (${productId}, 'Workplan tray', 'test', 'tray', 'true'),
        (${boxProductId}, 'Workplan box', 'test', 'box', 'true'),
        (${outsiderProductId}, 'Workplan outsider product', 'test', 'box', 'true')
    `);
    await databaseState.db.execute(sql`
      INSERT INTO warehouse_items (id, name, category, unit, current_stock, is_active)
      VALUES (${materialId}, 'Workplan flour', 'raw', 'kg', 100, true)
    `);
    const stockRows = await databaseState.db.execute(sql`
      INSERT INTO branch_stock (branch_id, item_id, current_quantity, reserved_quantity) VALUES
        (${kitchenBranchId}, ${materialId}, 37.000000, 2.000000),
        (${alternateKitchenBranchId}, ${materialId}, 29.000000, 0.000000),
        (${requestBranchId}, ${materialId}, 19.000000, 1.000000),
        (${outsiderKitchenBranchId}, ${materialId}, 11.000000, 0.000000)
      RETURNING id, branch_id
    `);
    const kitchenStockId = Number((stockRows.rows as any[]).find((row) => row.branch_id === kitchenBranchId)?.id);

    const recipe = await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_recipes (
        kitchen_id, product_id, output_quantity, output_unit, status,
        version, created_by, updated_by
      ) VALUES (
        ${kitchenBranchId}, ${productId}, 10, 'tray', 'draft', 1,
        ${kitchenUser.id}, ${kitchenUser.id}
      ) RETURNING id
    `);
    const recipeId = Number((recipe.rows[0] as any).id);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_recipe_ingredients (recipe_id, warehouse_item_id, quantity, unit)
      VALUES (${recipeId}, ${materialId}, 1.250000, 'kg')
    `);
    await databaseState.db.execute(sql`
      UPDATE central_kitchen_recipes
      SET status = 'approved', approved_by = ${kitchenUser.id}, approved_at = now(), updated_by = ${kitchenUser.id}
      WHERE id = ${recipeId}
    `);

    const insertOrder = async (
      orderNumber: string,
      requestBranch: string,
      neededDate: string,
      status: string,
      inventoryMode: string | null,
      discrepancyStatus = "none",
    ) => {
      const result = await databaseState.db.execute(sql`
        INSERT INTO central_kitchen_orders (
          order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
          status, inventory_mode, discrepancy_status, idempotency_key, payload_fingerprint, created_by
        ) VALUES (
          ${orderNumber}, ${requestBranch}, ${kitchenBranchId}, ${neededDate}, ${neededDate},
          ${status}, ${inventoryMode}, ${discrepancyStatus},
          ${`${orderNumber}-key`}, ${"a".repeat(64)}, ${kitchenUser.id}
        ) RETURNING id
      `);
      return Number((result.rows[0] as any).id);
    };
    const insertItem = async (
      orderId: number,
      catalogProductId: number,
      name: string,
      unit: string,
      quantity: number,
      prepared = true,
    ) => {
      const result = await databaseState.db.execute(sql`
        INSERT INTO central_kitchen_order_items (
          order_id, product_id, product_name, requested_quantity
          , unit, prepared_quantity, substitute_quantity, dispatched_quantity,
          received_quantity, damaged_quantity, missing_quantity
        ) VALUES (
          ${orderId}, ${catalogProductId}, ${name}, ${quantity}, ${unit},
          ${prepared ? quantity : null}, ${prepared ? 0 : null},
          ${prepared ? quantity : null}, ${prepared ? quantity : null},
          ${prepared ? 0 : null}, ${prepared ? 0 : null}
        ) RETURNING id
      `);
      return Number((result.rows[0] as any).id);
    };

    const dateOrderId = await insertOrder(`WPL-${suffix}-date`, requestBranchId, "2035-06-10", "received", "real");
    const dateOrderItemId = await insertItem(dateOrderId, productId, "Workplan tray", "tray", 10);
    // A completed order may still have no approved recipe. That fact is
    // informational and must not become a fabricated production blocker.
    await insertItem(dateOrderId, boxProductId, "Workplan box", "box", 2);
    const shadowOrderId = await insertOrder(`WPL-${suffix}-shadow`, requestBranchId, "2035-06-10", "dispatched", "shadow");
    await databaseState.db.execute(sql`
      UPDATE central_kitchen_order_items SET prepared_quantity = 4, substitute_quantity = 0,
        dispatched_quantity = 4, received_quantity = NULL, damaged_quantity = NULL, missing_quantity = NULL
      WHERE id = ${await insertItem(shadowOrderId, boxProductId, "Workplan box", "box", 4)}
    `);
    const unknownOrderId = await insertOrder(`WPL-${suffix}-unknown`, requestBranchId, "2035-06-10", "requested", null);
    await insertItem(unknownOrderId, productId, "Workplan tray", "tray", 3, false);
    const overdueOrderId = await insertOrder(`WPL-${suffix}-overdue`, requestBranchId, "2035-06-09", "approved", "real");
    const overdueItemId = await insertItem(overdueOrderId, productId, "Workplan tray", "tray", 6);
    const futureOrderId = await insertOrder(`WPL-${suffix}-future`, requestBranchId, "2035-06-11", "requested", "real");
    await insertItem(futureOrderId, productId, "Workplan tray", "tray", 99);

    const outsiderOrderId = await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_orders (
        order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
        status, inventory_mode, idempotency_key, payload_fingerprint, created_by
      ) VALUES (
        ${`WPL-${suffix}-outsider`}, ${requestBranchId}, ${outsiderKitchenBranchId}, '2035-06-10', '2035-06-10',
        'received', 'real', ${`WPL-${suffix}-outsider-key`}, ${"b".repeat(64)}, ${kitchenUser.id}
      ) RETURNING id
    `);
    await insertItem(Number((outsiderOrderId.rows[0] as any).id), outsiderProductId, "Workplan outsider product", "box", 88);

    const insertBatch = async (
      orderItemId: number,
      productionDate: string,
      status: string,
      quantity: number,
      recipeBacked: boolean | null,
      name = "Workplan tray",
    ) => {
      const result = await databaseState.db.execute(sql`
        INSERT INTO daily_production_batches (
          branch_id, product_id, product_name, quantity, unit, destination,
          production_date, recorded_by, status, recipe_backed, central_kitchen_order_item_id
        ) VALUES (
          ${kitchenBranchId}, ${productId}, ${name}, ${quantity}, 'tray', 'freezer',
          ${productionDate}, ${kitchenUser.id}, ${status}, false, ${orderItemId}
        ) RETURNING id
      `);
      const batchId = Number((result.rows[0] as any).id);
      if (recipeBacked === true) {
        await databaseState.db.execute(sql`SELECT set_config('app.central_kitchen_snapshot_write', 'on', true)`);
        await databaseState.db.execute(sql`
          INSERT INTO central_kitchen_batch_recipe_snapshots (
            batch_id, kitchen_id, product_id, source_recipe_id, source_recipe_version,
            recipe_output_quantity, recipe_output_unit, batch_output_quantity,
            ingredient_count, ingredient_checksum
          ) VALUES (
            ${batchId}, ${kitchenBranchId}, ${productId}, ${recipeId}, 1,
            10, 'tray', ${quantity}, 1, ${"c".repeat(64)}
          )
        `);
        await databaseState.db.execute(sql`
          UPDATE daily_production_batches SET recipe_backed = true WHERE id = ${batchId}
        `);
      } else if (recipeBacked === null) {
        await databaseState.db.execute(sql`
          UPDATE daily_production_batches SET recipe_backed = NULL WHERE id = ${batchId}
        `);
      }
      return batchId;
    };

    const consumedBatchId = await insertBatch(dateOrderItemId, "2035-06-10", "finished", 8, true);
    await databaseState.db.execute(sql`SELECT set_config('app.central_kitchen_material_consume', 'on', true)`);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_batch_material_movements (
        batch_id, warehouse_item_id, branch_stock_id, quantity, unit, actor_id
      ) VALUES (${consumedBatchId}, ${materialId}, ${kitchenStockId}, 1.500000, 'kg', ${kitchenUser.id})
    `);
    // The production schema permits one explicit linked batch per order item
    // and production date. Distinct dates here prove the workplan follows the
    // direct FK rather than guessing by product/date.
    const pendingBatchId = await insertBatch(dateOrderItemId, "2035-06-11", "in_progress", 5, true);
    const legacyBatchId = await insertBatch(dateOrderItemId, "2035-06-12", "finished", 2, false);
    const unknownBatchId = await insertBatch(dateOrderItemId, "2035-06-13", "in_progress", 4, null);
    const unrelatedBatch = await databaseState.db.execute(sql`
      INSERT INTO daily_production_batches (
        branch_id, product_id, product_name, quantity, unit, destination,
        production_date, recorded_by, status, recipe_backed
      ) VALUES (
        ${kitchenBranchId}, ${productId}, 'Workplan tray', 777, 'tray', 'freezer',
        '2035-06-10', ${kitchenUser.id}, 'finished', false
      ) RETURNING id
    `);
    const unrelatedBatchId = Number((unrelatedBatch.rows[0] as any).id);
    await insertBatch(overdueItemId, "2035-06-01", "in_progress", 6, false);

    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_orders (
        order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
        status, inventory_mode, idempotency_key, payload_fingerprint, created_by
      )
      SELECT
        ${`WPL-${suffix}-limit-`} || n, ${requestBranchId}, ${kitchenBranchId},
        '2035-06-12', '2035-06-12', 'requested', 'real',
        ${`WPL-${suffix}-limit-key-`} || n, ${"d".repeat(64)}, ${kitchenUser.id}
      FROM generate_series(1, 251) AS n
    `);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_order_items (order_id, product_id, product_name, requested_quantity, unit)
      SELECT id, ${productId}, 'Workplan tray', 1, 'tray'
      FROM central_kitchen_orders
      WHERE order_number LIKE ${`WPL-${suffix}-limit-%`}
    `);

    fixture = {
      kitchenBranchId,
      alternateKitchenBranchId,
      requestBranchId,
      outsiderKitchenBranchId,
      kitchenUser,
      noPermissionUser,
      branchSpoofUser,
      productId,
      boxProductId,
      outsiderProductId,
      materialId,
      dateOrderId,
      dateOrderItemId,
      overdueOrderId,
      futureOrderId,
      consumedBatchId,
      pendingBatchId,
      legacyBatchId,
      unknownBatchId,
      unrelatedBatchId,
      limitPrefix: `WPL-${suffix}-limit-`,
    };

    const { registerCentralKitchenWorkplanRoute } = await import("../server/central-kitchen-workplan");
    registerCentralKitchenWorkplanRoute(captureApp());
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("enforces authentication, production:view permission, and central-kitchen branch authority", async () => {
    const unauthenticated = await invoke("get", "/api/central-kitchen-orders/workplan", {
      query: workplanQuery(fixture.kitchenBranchId),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const permissionDenied = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.noPermissionUser,
      query: workplanQuery(fixture.kitchenBranchId),
    });
    expect(permissionDenied.statusCode).toBe(403);

    const branchSpoof = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.branchSpoofUser,
      query: workplanQuery(fixture.alternateKitchenBranchId),
    });
    expect(branchSpoof.statusCode).toBe(403);

    const requestBranch = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.kitchenUser,
      query: workplanQuery(fixture.requestBranchId),
    });
    expect(requestBranch.statusCode).toBe(403);
  });

  it("validates Riyadh calendar dates and rejects malformed query values", async () => {
    const leapDay = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.kitchenUser,
      query: workplanQuery(fixture.kitchenBranchId, "2036-02-29"),
    });
    expect(leapDay.statusCode).toBe(200);
    expect((leapDay.body as CentralKitchenWorkplan).metadata.timezone).toBe("Asia/Riyadh");

    const invalidCalendarDate = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.kitchenUser,
      query: workplanQuery(fixture.kitchenBranchId, "2035-02-29"),
    });
    expect(invalidCalendarDate.statusCode).toBe(400);
    expect(invalidCalendarDate.body.error).toContain("YYYY-MM-DD");

    const missingDate = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.kitchenUser,
      query: { kitchenId: fixture.kitchenBranchId },
    });
    expect(missingDate.statusCode).toBe(200);
    expect(missingDate.body.date).toBe(missingDate.body.metadata.actualRiyadhToday);
    expect(missingDate.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns separate date and overdue cohorts, direct links, authoritative stages, truthful modes, and recipe evidence without stock writes", async () => {
    const beforeStock = await stockSnapshot();
    const response = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.kitchenUser,
      query: workplanQuery(fixture.kitchenBranchId),
    });
    const afterStock = await stockSnapshot();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(afterStock).toEqual(beforeStock);

    const workplan = response.body as CentralKitchenWorkplan;
    expect(workplan).toMatchObject({
      kitchen: { id: fixture.kitchenBranchId, name: "Workplan central kitchen" },
      date: "2035-06-10",
      metadata: {
        scope: "current_central_kitchen_orders",
        excludedSources: ["advanced_production_orders"],
        timezone: "Asia/Riyadh",
        rowLimit: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
        returnedOrderCount: workplan.orders.length,
        totalRowsTruncated: false,
        allocationReadiness: "unknown",
        limitations: {
          approvedRecipeIsInformational: true,
          materialPostingIsRecordedEvidenceNotReconciliation: true,
        },
      },
      summary: {
        countsScope: "returned_rows_only",
      },
    });
    expect(workplan.orders.some((order) => order.id === fixture.futureOrderId)).toBe(false);
    expect(workplan.orders.some((order) => order.id !== fixture.dateOrderId && order.cohort === "overdue")).toBe(false);
    expect(workplan.overdueEarlierOrders).toHaveLength(1);
    expect(workplan.overdueEarlierOrders[0]).toMatchObject({
      id: fixture.overdueOrderId,
      cohort: "overdue",
      finished: false,
      exceptions: expect.arrayContaining([
        expect.objectContaining({ code: "unfinished_linked_batch", batchIds: expect.arrayContaining([]) }),
      ]),
    });
    // "Earlier than the selected workplan date" is not the same as overdue
    // relative to today. These 2035 fixtures are future-dated relative to the
    // actual Riyadh clock, so the objective overdue exception is absent.
    expect(workplan.overdueEarlierOrders[0].exceptions.some((item) => item.code === "overdue")).toBe(false);
    expect(workplan.metadata.actualRiyadhToday).toBe(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()));
    expect(workplan.overdueEarlierOrders[0].items[0].id).toBeGreaterThan(0);

    const dateOrder = workplan.orders.find((order) => order.id === fixture.dateOrderId)!;
    expect(dateOrder).toMatchObject({
      cohort: "date",
      rawStatus: "received",
      inventoryMode: "real",
      finished: true,
      directOrderLink: `/api/central-kitchen-orders/${fixture.dateOrderId}`,
      nextStep: { stage: "complete", isComplete: true },
      readiness: { status: "unknown", reason: "allocated_stock_not_evaluated" },
    });
    expect(dateOrder.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: fixture.dateOrderItemId,
        productId: fixture.productId,
        catalogMapping: "product",
        requestedQuantity: 10,
        approvedRecipe: true,
      }),
      expect.objectContaining({
        productId: fixture.boxProductId,
        catalogMapping: "product",
        approvedRecipe: false,
        approvedRecipeNote: "الوصفة الحالية غير متوفرة؛ ليس إثبات نقص إنتاج",
      }),
    ]));
    expect(dateOrder.finished).toBe(true);
    expect(dateOrder.exceptions.some((item) => item.code === "no_approved_recipe")).toBe(false);
    expect(dateOrder.linkedBatches.count).toBe(4);
    expect(dateOrder.linkedBatches.refs).toEqual(expect.arrayContaining([
      { id: fixture.consumedBatchId, directLink: `/central-kitchen-orders?orderId=${fixture.dateOrderId}` },
      { id: fixture.pendingBatchId, directLink: `/central-kitchen-orders?orderId=${fixture.dateOrderId}` },
      { id: fixture.legacyBatchId, directLink: `/central-kitchen-orders?orderId=${fixture.dateOrderId}` },
      { id: fixture.unknownBatchId, directLink: `/central-kitchen-orders?orderId=${fixture.dateOrderId}` },
    ]));
    expect(dateOrder.linkedBatches.byUnitAndStatus).toEqual(expect.arrayContaining([
      { unit: "tray", status: "finished", batchCount: 2, quantity: 10 },
      { unit: "tray", status: "in_progress", batchCount: 2, quantity: 9 },
    ]));
    expect(dateOrder.linkedBatches.recipeEvidence).toEqual({
      recipeBacked: 2,
      legacy: 1,
      unknown: 1,
    });
    expect(dateOrder.linkedBatches.materialPosting).toEqual({
      consumed: 1,
      pending: 1,
      unknown: 2,
    });
    expect(dateOrder.linkedBatches.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: fixture.consumedBatchId,
        orderItemId: fixture.dateOrderItemId,
        rawStatus: "finished",
        status: "finished",
        finished: true,
        recipeBacked: true,
        recipeEvidence: "recipe_backed",
        materialPosting: "consumed",
        materialPostingEvidence: "recorded_movement_present",
      }),
      expect.objectContaining({
        id: fixture.pendingBatchId,
        finished: false,
        recipeEvidence: "recipe_backed",
        materialPosting: "pending",
        materialPostingEvidence: "no_recorded_movement",
      }),
      expect.objectContaining({
        id: fixture.legacyBatchId,
        recipeBacked: false,
        recipeEvidence: "legacy",
        materialPosting: "unknown",
        materialPostingEvidence: "no_recorded_movement",
      }),
      expect.objectContaining({
        id: fixture.unknownBatchId,
        recipeBacked: null,
        recipeEvidence: "unknown",
        materialPosting: "unknown",
        materialPostingEvidence: "no_recorded_movement",
      }),
    ]));
    expect(dateOrder.linkedBatches.batches.some((batch) => batch.id === fixture.unrelatedBatchId)).toBe(false);
    expect(dateOrder.exceptions.some((exception) => exception.code === "unfinished_linked_batch")).toBe(true);

    const shadowOrder = workplan.orders.find((order) => order.inventoryMode === "shadow")!;
    const unknownOrder = workplan.orders.find((order) => order.inventoryMode === "unknown")!;
    expect(shadowOrder).toMatchObject({
      rawStatus: "dispatched",
      nextStep: { stage: "receipt" },
      items: [expect.objectContaining({ unit: "box" })],
    });
    expect(unknownOrder).toMatchObject({
      rawStatus: "requested",
      nextStep: { stage: "approval" },
      items: [expect.objectContaining({ unit: "tray" })],
    });
    expect(new Set(workplan.orders.map((order) => order.inventoryMode))).toEqual(new Set(["real", "shadow", "unknown"]));
    expect(workplan.summary).toMatchObject({
      orderCount: workplan.orders.length,
      dateCohortOrderCount: workplan.orders.length,
      overdueEarlierOrderCount: 1,
      unfinishedOrderCount: expect.any(Number),
      finishedOrderCount: expect.any(Number),
      linkedBatchCount: 4,
    });
  });

  it("reports deterministic bounded candidates and truthful truncation metadata", async () => {
    const query = workplanQuery(fixture.kitchenBranchId, "2035-06-12");
    const first = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.kitchenUser,
      query,
    });
    const second = await invoke("get", "/api/central-kitchen-orders/workplan", {
      user: fixture.kitchenUser,
      query,
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const firstPlan = first.body as CentralKitchenWorkplan;
    const secondPlan = second.body as CentralKitchenWorkplan;
    expect(firstPlan.orders).toHaveLength(246);
    expect(firstPlan.overdueEarlierOrders).toHaveLength(4);
    expect(firstPlan.orders.length + firstPlan.overdueEarlierOrders.length)
      .toBe(CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT);
    expect(secondPlan.orders.map((order) => order.id)).toEqual(firstPlan.orders.map((order) => order.id));
    expect(firstPlan.metadata).toMatchObject({
      rowLimit: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
      returnedOrderCount: 246,
      totalReturnedOrderCount: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
      totalRowsTruncated: true,
      dateCohort: {
        candidateRowLimit: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
        candidateRowsReturned: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
        truncated: true,
        countComplete: false,
      },
      overdueEarlier: {
        lookbackDays: CENTRAL_KITCHEN_WORKPLAN_OVERDUE_LOOKBACK_DAYS,
        candidateRowLimit: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
        candidateRowsReturned: 4,
        truncated: false,
        countComplete: true,
      },
    });
    expect(firstPlan.summary.countsScope).toBe("returned_rows_only");
    expect(firstPlan.orders.every((order) => order.orderNumber.startsWith(fixture.limitPrefix))).toBe(true);
  });
});