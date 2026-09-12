import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";
import {
  parseProductionOperationsDateWindow,
  type ProductionOperationsReport,
} from "../shared/production-operations-report";

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

// Authentication is the only production dependency replaced by this suite.
// In particular, the branch filter below models the established `branchId=all`
// convention: it is all *assigned* branches for a scoped user, never all data.
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
      if (requested === "all") return { hasAccess: true, singleBranchId: null, branchIds: ids };
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
  requestBranchId: string;
  outsiderBranchId: string;
  outsiderRequestBranchId: string;
  kitchenUser: any;
  multiBranchUser: any;
  noPermissionUser: any;
  outputProductId: number;
  outsiderProductId: number;
  materialKgId: number;
  materialLitreId: number;
  finishedPostedBatchId: number;
  legacyBatchId: number;
  inProgressBatchId: number;
  linkedInProgressBatchId: number;
  outsiderBatchId: number;
  visibleOrderId: number;
  visibleOrderItemId: number;
  advancedOrderId: number;
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

function reportQuery(branchId: string, startDate = "2035-06-10", endDate = "2035-06-10") {
  return { branchId, startDate, endDate };
}

function byUnit(rows: Array<{ unit: string; quantity: number }>) {
  return Object.fromEntries(rows.map((row) => [row.unit, row.quantity]));
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
 * The fixture deliberately remains inside one rollback-only development
 * transaction. PostgreSQL cannot change a transaction's isolation level after
 * fixture inserts, while the production handler correctly begins its own
 * top-level read-only REPEATABLE READ transaction.  The adapter suppresses only
 * that transaction-control statement; every report source query still runs
 * against the real database and the actual handler. This is not presented as a
 * concurrency test: one connection cannot create real competing sessions while
 * keeping fixtures uncommitted and rollback-only.
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
         WHERE branch_id IN (${fixture.kitchenBranchId}, ${fixture.requestBranchId}, ${fixture.outsiderBranchId})
           AND item_id IN (${fixture.materialKgId}, ${fixture.materialLitreId})
       ) x) AS branch_stock,
      (SELECT json_agg(x ORDER BY x.id)
       FROM (
         SELECT id, current_stock::text
         FROM warehouse_items
         WHERE id IN (${fixture.materialKgId}, ${fixture.materialLitreId})
       ) x) AS warehouse_items,
      (SELECT json_agg(x ORDER BY x.id)
       FROM (
         SELECT id, branch_id, product_id, quantity, reserved_quantity
         FROM finished_goods_inventory
         WHERE branch_id IN (${fixture.kitchenBranchId}, ${fixture.requestBranchId}, ${fixture.outsiderBranchId})
       ) x) AS finished_goods
  `);
  return result.rows[0];
}

describe.sequential("production operations report (development DB)", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Production operations report integration tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, allowExitOnIdle: true });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const finishPromise = new Promise<void>((resolve) => { finishTransaction = resolve; });
    const rollback = new Error("PRODUCTION_OPERATIONS_REPORT_TEST_ROLLBACK");
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
    const kitchenBranchId = `production-report-kitchen-${suffix}`;
    const requestBranchId = `production-report-request-${suffix}`;
    const outsiderBranchId = `production-report-outsider-${suffix}`;
    const outsiderRequestBranchId = `production-report-outsider-request-${suffix}`;
    const kitchenUser = {
      id: `production-report-kitchen-user-${suffix}`,
      username: `production-report-kitchen-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
      testPermissions: { production: ["view"] },
      testAllowedBranchIds: [kitchenBranchId],
    };
    const multiBranchUser = {
      id: `production-report-multi-user-${suffix}`,
      username: `production-report-multi-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
      testPermissions: { production: ["view"] },
      testAllowedBranchIds: [kitchenBranchId, requestBranchId],
    };
    const noPermissionUser = {
      id: `production-report-denied-user-${suffix}`,
      username: `production-report-denied-${suffix}`,
      role: "manager",
      branchId: kitchenBranchId,
      testPermissions: { production: [] },
      testAllowedBranchIds: [kitchenBranchId],
    };

    await databaseState.db.execute(sql`
      INSERT INTO branches (id, name, is_central_kitchen) VALUES
        (${kitchenBranchId}, 'Production report kitchen', true),
        (${requestBranchId}, 'Production report requesting branch', false),
        (${outsiderBranchId}, 'Production report outsider kitchen', true),
        (${outsiderRequestBranchId}, 'Production report outsider request branch', false)
    `);
    await databaseState.db.execute(sql`
      INSERT INTO users (id, username, role, branch_id) VALUES
        (${kitchenUser.id}, ${kitchenUser.username}, ${kitchenUser.role}, ${kitchenBranchId}),
        (${multiBranchUser.id}, ${multiBranchUser.username}, ${multiBranchUser.role}, ${kitchenBranchId}),
        (${noPermissionUser.id}, ${noPermissionUser.username}, ${noPermissionUser.role}, ${kitchenBranchId})
    `);

    const ids = await databaseState.db.execute(sql`
      SELECT GREATEST(
        COALESCE((SELECT MAX(id) FROM products), 0),
        COALESCE((SELECT MAX(id) FROM warehouse_items), 0)
      )::int + 8000 AS id
    `);
    const outputProductId = Number((ids.rows[0] as any).id);
    const outsiderProductId = outputProductId + 1;
    const materialKgId = outputProductId + 2;
    const materialLitreId = outputProductId + 3;
    await databaseState.db.execute(sql`
      INSERT INTO products (id, name, category, unit, is_active) VALUES
        (${outputProductId}, 'Report output tray', 'test', 'tray', 'true'),
        (${outsiderProductId}, 'Outsider-only output', 'test', 'box', 'true')
    `);
    await databaseState.db.execute(sql`
      INSERT INTO warehouse_items (id, name, category, unit, current_stock, is_active) VALUES
        (${materialKgId}, 'Actual fractional flour', 'raw', 'kg', 100, true),
        (${materialLitreId}, 'Actual oil', 'raw', 'litre', 100, true)
    `);
    const stockRows = await databaseState.db.execute(sql`
      INSERT INTO branch_stock (branch_id, item_id, current_quantity, reserved_quantity) VALUES
        (${kitchenBranchId}, ${materialKgId}, 20.000000, 0.000000),
        (${kitchenBranchId}, ${materialLitreId}, 20.000000, 0.000000),
        (${outsiderBranchId}, ${materialKgId}, 20.000000, 0.000000)
      RETURNING id, branch_id, item_id
    `);
    const kitchenKgStockId = Number((stockRows.rows as any[]).find((row) =>
      row.branch_id === kitchenBranchId && Number(row.item_id) === materialKgId,
    )?.id);
    const kitchenLitreStockId = Number((stockRows.rows as any[]).find((row) =>
      row.branch_id === kitchenBranchId && Number(row.item_id) === materialLitreId,
    )?.id);
    const outsiderKgStockId = Number((stockRows.rows as any[]).find((row) =>
      row.branch_id === outsiderBranchId && Number(row.item_id) === materialKgId,
    )?.id);

    const visibleOrder = await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_orders (
        order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
        status, inventory_mode, idempotency_key, payload_fingerprint, created_by
      ) VALUES (
        ${`POR-${suffix}-visible`}, ${requestBranchId}, ${kitchenBranchId}, '2035-06-01', '2035-06-10',
        'received', 'real', ${`por-order-${suffix}`}, ${"a".repeat(64)}, ${kitchenUser.id}
      ) RETURNING id
    `);
    const visibleOrderId = Number((visibleOrder.rows[0] as any).id);
    const visibleItem = await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_order_items (
        order_id, product_id, product_name, requested_quantity, unit, prepared_quantity,
        substitute_quantity, dispatched_quantity, received_quantity, damaged_quantity,
        missing_quantity, shortage_reason
      ) VALUES (
        ${visibleOrderId}, ${outputProductId}, 'Report output tray', 10.500000, 'tray', 9.500000,
        0, 8.500000, 6.250000, 1.000000, 1.250000, 'unavailable'
      ) RETURNING id
    `);
    const visibleOrderItemId = Number((visibleItem.rows[0] as any).id);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_orders (
        order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
        status, inventory_mode, idempotency_key, payload_fingerprint, created_by
      ) VALUES (
        ${`POR-${suffix}-outsider`}, ${outsiderRequestBranchId}, ${outsiderBranchId}, '2035-06-01', '2035-06-10',
        'received', 'real', ${`por-outsider-${suffix}`}, ${"b".repeat(64)}, ${kitchenUser.id}
      )
    `);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_order_items (
        order_id, product_id, product_name, requested_quantity, unit, prepared_quantity,
        substitute_quantity, dispatched_quantity, received_quantity, damaged_quantity, missing_quantity
      )
      SELECT id, ${outsiderProductId}, 'Outsider-only output', 99, 'box', 99, 0, 99, 99, 0, 0
      FROM central_kitchen_orders WHERE order_number = ${`POR-${suffix}-outsider`}
    `);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_orders (
        order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
        status, inventory_mode, idempotency_key, payload_fingerprint, created_by
      ) VALUES (
        ${`POR-${suffix}-out-of-window`}, ${requestBranchId}, ${kitchenBranchId}, '2035-06-01', '2035-06-11',
        'requested', 'real', ${`por-out-of-window-${suffix}`}, ${"c".repeat(64)}, ${kitchenUser.id}
      )
    `);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_order_items (order_id, product_id, product_name, requested_quantity, unit)
      SELECT id, ${outputProductId}, 'Report output tray', 50, 'tray'
      FROM central_kitchen_orders WHERE order_number = ${`POR-${suffix}-out-of-window`}
    `);
    const shadowOrder = await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_orders (
        order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
        status, inventory_mode, idempotency_key, payload_fingerprint, created_by
      ) VALUES (
        ${`POR-${suffix}-shadow`}, ${requestBranchId}, ${kitchenBranchId}, '2035-06-01', '2035-06-10',
        'dispatched', 'shadow', ${`por-shadow-${suffix}`}, ${"d".repeat(64)}, ${kitchenUser.id}
      ) RETURNING id
    `);
    const shadowOrderId = Number((shadowOrder.rows[0] as any).id);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_order_items (
        order_id, product_id, product_name, requested_quantity, unit, prepared_quantity,
        substitute_quantity, dispatched_quantity
      ) VALUES (${shadowOrderId}, ${outputProductId}, 'Report output tray', 4, 'tray', 4, 0, 4)
    `);
    const unknownOrder = await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_orders (
        order_number, request_branch_id, central_kitchen_id, order_date, needed_date,
        status, inventory_mode, idempotency_key, payload_fingerprint, created_by
      ) VALUES (
        ${`POR-${suffix}-unknown`}, ${requestBranchId}, ${kitchenBranchId}, '2035-06-01', '2035-06-10',
        'requested', NULL, ${`por-unknown-${suffix}`}, ${"e".repeat(64)}, ${kitchenUser.id}
      ) RETURNING id
    `);
    const unknownOrderId = Number((unknownOrder.rows[0] as any).id);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_order_items (order_id, product_id, product_name, requested_quantity, unit)
      VALUES (${unknownOrderId}, ${outputProductId}, 'Report output tray', 3, 'tray')
    `);

    const postedBatch = await databaseState.db.execute(sql`
      INSERT INTO daily_production_batches (
        branch_id, product_id, product_name, quantity, unit, destination, production_date,
        recorded_by, status, recipe_backed, central_kitchen_order_item_id
      ) VALUES (
        ${kitchenBranchId}, ${outputProductId}, 'Report output tray', 7, 'tray', 'freezer', '2035-06-10',
        ${kitchenUser.id}, 'finished', false, ${visibleOrderItemId}
      ) RETURNING id
    `);
    const finishedPostedBatchId = Number((postedBatch.rows[0] as any).id);
    const legacyBatch = await databaseState.db.execute(sql`
      INSERT INTO daily_production_batches (
        branch_id, product_id, product_name, quantity, unit, destination, production_date, recorded_by, status, recipe_backed
      ) VALUES (
        ${kitchenBranchId}, ${outputProductId}, 'Report output tray', 2, 'tray', 'freezer', '2035-06-10',
        ${kitchenUser.id}, 'finished', false
      ) RETURNING id
    `);
    const legacyBatchId = Number((legacyBatch.rows[0] as any).id);
    const inProgressBatch = await databaseState.db.execute(sql`
      INSERT INTO daily_production_batches (
        branch_id, product_id, product_name, quantity, unit, destination, production_date, recorded_by, status
      ) VALUES (
        ${kitchenBranchId}, ${outputProductId}, 'Report output tray', 11, 'tray', 'freezer', '2035-06-10',
        ${kitchenUser.id}, 'in_progress'
      ) RETURNING id
    `);
    const inProgressBatchId = Number((inProgressBatch.rows[0] as any).id);
    // This explicit order-item FK deliberately has a production date outside
    // the output cohort. It belongs to the request's needed-date cohort.
    const linkedInProgressBatch = await databaseState.db.execute(sql`
      INSERT INTO daily_production_batches (
        branch_id, product_id, product_name, quantity, unit, destination, production_date,
        recorded_by, status, central_kitchen_order_item_id
      ) VALUES (
        ${kitchenBranchId}, ${outputProductId}, 'Report output tray', 13, 'tray', 'freezer', '2035-06-20',
        ${kitchenUser.id}, 'in_progress', ${visibleOrderItemId}
      ) RETURNING id
    `);
    const linkedInProgressBatchId = Number((linkedInProgressBatch.rows[0] as any).id);
    const outsiderBatch = await databaseState.db.execute(sql`
      INSERT INTO daily_production_batches (
        branch_id, product_id, product_name, quantity, unit, destination, production_date, recorded_by, status
      ) VALUES (
        ${outsiderBranchId}, ${outsiderProductId}, 'Outsider-only output', 99, 'box', 'freezer', '2035-06-10',
        ${kitchenUser.id}, 'finished'
      ) RETURNING id
    `);
    const outsiderBatchId = Number((outsiderBatch.rows[0] as any).id);
    const outOfWindowBatch = await databaseState.db.execute(sql`
      INSERT INTO daily_production_batches (
        branch_id, product_id, product_name, quantity, unit, destination, production_date, recorded_by, status
      ) VALUES (
        ${kitchenBranchId}, ${outputProductId}, 'Report output tray', 50, 'tray', 'freezer', '2035-06-11',
        ${kitchenUser.id}, 'finished'
      ) RETURNING id
    `);
    const outOfWindowBatchId = Number((outOfWindowBatch.rows[0] as any).id);

    // Two output log forms point to the same completed batch. They prove
    // posting coverage, but production is still counted from the one batch.
    await databaseState.db.execute(sql`
      INSERT INTO production_inventory_logs (
        branch_id, product_id, product_name, movement_type, quantity, balance_before, balance_after,
        reference_type, reference_id, batch_id, created_by
      ) VALUES
        (${kitchenBranchId}, ${outputProductId}, 'Report output tray', 'production_in', 7, 0, 7,
         'batch', ${finishedPostedBatchId}, ${finishedPostedBatchId}, ${kitchenUser.id}),
        (${kitchenBranchId}, ${outputProductId}, 'Report output tray', 'adjustment', 0, 7, 7,
         'batch', ${finishedPostedBatchId}, NULL, ${kitchenUser.id})
    `);

    // This guarded setup uses the same immutable-ledger permission checked by
    // production code. It inserts observed debits only; no recipe quantity is
    // seeded or inferred for either of the non-recipe batches.
    await databaseState.db.execute(sql`SELECT set_config('app.central_kitchen_material_consume', 'on', true)`);
    await databaseState.db.execute(sql`
      INSERT INTO central_kitchen_batch_material_movements (
        batch_id, warehouse_item_id, branch_stock_id, quantity, unit, actor_id
      ) VALUES
        (${finishedPostedBatchId}, ${materialKgId}, ${kitchenKgStockId}, 0.125000, 'kg', ${kitchenUser.id}),
        (${finishedPostedBatchId}, ${materialLitreId}, ${kitchenLitreStockId}, 1.500000, 'litre', ${kitchenUser.id}),
        (${outsiderBatchId}, ${materialKgId}, ${outsiderKgStockId}, 99.000000, 'kg', ${kitchenUser.id}),
        (${outOfWindowBatchId}, ${materialKgId}, ${kitchenKgStockId}, 50.000000, 'kg', ${kitchenUser.id})
    `);

    await databaseState.db.execute(sql`
      INSERT INTO waste_reports (branch_id, report_date, reported_by, total_items, total_value, status) VALUES
        (${kitchenBranchId}, '2035-06-10', ${kitchenUser.id}, 1, 0, 'approved'),
        (${kitchenBranchId}, '2035-06-10', ${kitchenUser.id}, 1, 0, 'draft'),
        (${outsiderBranchId}, '2035-06-10', ${kitchenUser.id}, 1, 0, 'approved'),
        (${kitchenBranchId}, '2035-06-11', ${kitchenUser.id}, 1, 0, 'approved')
    `);
    await databaseState.db.execute(sql`
      INSERT INTO waste_items (waste_report_id, product_id, quantity, waste_reason)
      SELECT id, ${outputProductId},
        CASE status WHEN 'approved' THEN 3 ELSE 80 END,
        'damaged'
      FROM waste_reports
      WHERE branch_id = ${kitchenBranchId} AND report_date = '2035-06-10'
    `);
    await databaseState.db.execute(sql`
      INSERT INTO waste_items (waste_report_id, product_id, quantity, waste_reason)
      SELECT id, ${outsiderProductId}, 99, 'damaged'
      FROM waste_reports
      WHERE branch_id = ${outsiderBranchId} AND report_date = '2035-06-10'
    `);
    await databaseState.db.execute(sql`
      INSERT INTO waste_items (waste_report_id, product_id, quantity, waste_reason)
      SELECT id, ${outputProductId}, 50, 'damaged'
      FROM waste_reports
      WHERE branch_id = ${kitchenBranchId} AND report_date = '2035-06-11'
    `);

    const advanced = await databaseState.db.execute(sql`
      INSERT INTO advanced_production_orders (
        order_number, source_branch_id, target_branch_id, title, status, priority, start_date, end_date, created_by
      ) VALUES (
        ${`POR-plan-${suffix}`}, ${kitchenBranchId}, ${requestBranchId}, 'Matching plan is not a batch link',
        'approved', 'normal', '2035-06-09', '2035-06-11', ${kitchenUser.id}
      ) RETURNING id
    `);
    const advancedOrderId = Number((advanced.rows[0] as any).id);
    await databaseState.db.execute(sql`
      INSERT INTO production_order_items (order_id, product_id, product_name, target_quantity, status)
      VALUES (${advancedOrderId}, ${outputProductId}, 'Report output tray', 17, 'pending')
    `);
    await databaseState.db.execute(sql`
      INSERT INTO advanced_production_orders (
        order_number, source_branch_id, target_branch_id, title, status, priority, start_date, end_date, created_by
      ) VALUES (
        ${`POR-plan-out-of-window-${suffix}`}, ${kitchenBranchId}, ${requestBranchId}, 'Out of window plan',
        'approved', 'normal', '2035-06-11', '2035-06-11', ${kitchenUser.id}
      )
    `);
    await databaseState.db.execute(sql`
      INSERT INTO production_order_items (order_id, product_id, product_name, target_quantity, status)
      SELECT id, ${outputProductId}, 'Report output tray', 50, 'pending'
      FROM advanced_production_orders WHERE order_number = ${`POR-plan-out-of-window-${suffix}`}
    `);
    await databaseState.db.execute(sql`
      INSERT INTO advanced_production_orders (
        order_number, source_branch_id, target_branch_id, title, status, priority, start_date, end_date, created_by
      ) VALUES (
        ${`POR-plan-outsider-${suffix}`}, ${outsiderBranchId}, ${outsiderRequestBranchId}, 'Outsider plan',
        'approved', 'normal', '2035-06-10', '2035-06-10', ${kitchenUser.id}
      )
    `);
    await databaseState.db.execute(sql`
      INSERT INTO production_order_items (order_id, product_id, product_name, target_quantity, status)
      SELECT id, ${outsiderProductId}, 'Outsider-only output', 99, 'pending'
      FROM advanced_production_orders WHERE order_number = ${`POR-plan-outsider-${suffix}`}
    `);

    fixture = {
      kitchenBranchId,
      requestBranchId,
      outsiderBranchId,
      outsiderRequestBranchId,
      kitchenUser,
      multiBranchUser,
      noPermissionUser,
      outputProductId,
      outsiderProductId,
      materialKgId,
      materialLitreId,
      finishedPostedBatchId,
      legacyBatchId,
      inProgressBatchId,
      linkedInProgressBatchId,
      outsiderBatchId,
      visibleOrderId,
      visibleOrderItemId,
      advancedOrderId,
    };

    const { registerProductionOperationsReportRoute } = await import("../server/production-operations-report");
    registerProductionOperationsReportRoute(captureApp());
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("enforces authentication, production:view permission, and assigned branch access before reporting", async () => {
    const unauthenticated = await invoke("get", "/api/production/operations-report", {
      query: reportQuery(fixture.kitchenBranchId),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const permissionDenied = await invoke("get", "/api/production/operations-report", {
      user: fixture.noPermissionUser,
      query: reportQuery(fixture.kitchenBranchId),
    });
    expect(permissionDenied.statusCode).toBe(403);

    const branchDenied = await invoke("get", "/api/production/operations-report", {
      user: fixture.kitchenUser,
      query: reportQuery(fixture.outsiderBranchId),
    });
    expect(branchDenied.statusCode).toBe(403);
  });

  it("validates Riyadh calendar dates and rejects an inverted range", async () => {
    expect(parseProductionOperationsDateWindow("2036-02-29", "2036-02-29")).toMatchObject({
      startDate: "2036-02-29",
      endDate: "2036-02-29",
      daysInclusive: 1,
    });

    const invalidCalendarDate = await invoke("get", "/api/production/operations-report", {
      user: fixture.kitchenUser,
      query: reportQuery(fixture.kitchenBranchId, "2035-02-29", "2035-06-10"),
    });
    expect(invalidCalendarDate.statusCode).toBe(400);
    expect(invalidCalendarDate.body.error).toContain("YYYY-MM-DD");

    const inverted = await invoke("get", "/api/production/operations-report", {
      user: fixture.kitchenUser,
      query: reportQuery(fixture.kitchenBranchId, "2035-06-11", "2035-06-10"),
    });
    expect(inverted.statusCode).toBe(400);
    expect(inverted.body.error).toContain("البداية");
  });

  it("reports real scoped facts by their documented date basis without mutating stock", async () => {
    const beforeStock = await stockSnapshot();
    const response = await invoke("get", "/api/production/operations-report", {
      user: fixture.kitchenUser,
      query: reportQuery(fixture.kitchenBranchId),
    });
    const afterStock = await stockSnapshot();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(afterStock).toEqual(beforeStock);

    const report = response.body as ProductionOperationsReport;
    expect(report.metadata).toMatchObject({
      readConsistency: "repeatable_read_read_only_transaction",
      branchScope: {
        requestedBranchId: fixture.kitchenBranchId,
        effectiveBranchIds: [fixture.kitchenBranchId],
        allConvention: "branchId=all",
      },
      dateWindow: {
        startDate: "2035-06-10",
        endDate: "2035-06-10",
        daysInclusive: 1,
        timezone: "Asia/Riyadh",
      },
      costing: { status: "not_available" },
      rowLimit: { applied: false },
    });
    expect(report.metadata.linkage).toEqual({
      centralKitchenOrderItemToBatch: {
        status: "available_explicit_batch_order_item_fk",
        dateBasis: "request needed_date cohort; linked batches are not filtered by production_date",
      },
      advancedPlanToBatch: {
        status: "unavailable_without_explicit_batch_link",
      },
    });
    expect(report.metadata.dateWindow.bases.map((basis) => ({
      source: basis.source,
      dateBasis: basis.dateBasis,
    }))).toEqual([
      { source: "dailyProductionBatches", dateBasis: "production_date" },
      { source: "advancedProductionOrders", dateBasis: "start_date/end_date overlap" },
      { source: "centralKitchenOrders", dateBasis: "needed_date" },
      { source: "centralKitchenBatchMaterialMovements", dateBasis: "linked batch production_date" },
      { source: "wasteReports", dateBasis: "report_date" },
    ]);

    const production = report.productionRows.find((row) => row.productId === fixture.outputProductId)!;
    expect(production).toMatchObject({
      productName: "Report output tray",
      unit: "tray",
      branchIds: [fixture.kitchenBranchId],
      finishedBatchCount: 2,
      finishedQuantity: 9,
      inProgressBatchCount: 1,
      inProgressQuantity: 11,
      recipeSourceRecipeIds: [],
    });
    expect(production.batchIds.sort((a, b) => a - b)).toEqual([
      fixture.finishedPostedBatchId,
      fixture.legacyBatchId,
      fixture.inProgressBatchId,
    ].sort((a, b) => a - b));
    // Two posting-log references prove one output posting, never two outputs.
    expect(report.summary.production).toEqual({
      finishedBatchCount: 2,
      inProgressBatchCount: 1,
      finishedQuantityByUnit: [{ unit: "tray", quantity: 9 }],
      inProgressQuantityByUnit: [{ unit: "tray", quantity: 11 }],
    });
    expect(report.coverage).toMatchObject({
      finishedBatchCount: 2,
      nonRecipe: 2,
      linked: 1,
      unlinked: 1,
      outputPostingProven: 1,
      outputPostingMissing: 0,
    });

    const request = report.requestRows.find((row) => row.orderItemIds.includes(fixture.visibleOrderItemId))!;
    expect(request).toMatchObject({
      kitchenId: fixture.kitchenBranchId,
      requestBranchIds: [fixture.requestBranchId],
      itemKind: "product",
      itemId: fixture.outputProductId,
      requestedQuantity: 10.5,
      preparedQuantity: 9.5,
      dispatchedQuantity: 8.5,
      goodReceivedQuantity: 6.25,
      damagedQuantity: 1,
      missingQuantity: 1.25,
      linkedFinishedQuantity: 7,
      linkedInProgressQuantity: 13,
      linkedProductionComparisonStatus: "available_explicit_batch_order_item_fk",
      orderIds: [fixture.visibleOrderId],
    });
    expect(request.linkedBatchIds.sort((a, b) => a - b)).toEqual([
      fixture.finishedPostedBatchId,
      fixture.linkedInProgressBatchId,
    ].sort((a, b) => a - b));
    // The same-product batches without the FK must not be guessed as request
    // output, even when one is inside the production-date report window.
    expect(request.linkedBatchIds).not.toContain(fixture.legacyBatchId);
    expect(request.linkedBatchIds).not.toContain(fixture.inProgressBatchId);

    // Mode-specific central-kitchen figures are authoritative. Do not consume
    // the legacy combined fields: combining shadow projections with real
    // inventory workflow facts would falsely make 17.5 look physically real.
    expect(report.summary.centralKitchen.combinedQuantitiesDeprecated).toBe(true);
    const modes = Object.fromEntries(report.summary.centralKitchen.byInventoryMode.map((mode) => [
      mode.inventoryMode,
      mode,
    ]));
    expect(Object.keys(modes).sort()).toEqual(["real", "shadow", "unknown"]);
    expect(modes.real).toMatchObject({
      orderCount: 1,
      activeOrderCount: 1,
      inactiveOrderCount: 0,
      requestedQuantityByUnit: [{ unit: "tray", quantity: 10.5 }],
      preparedQuantityByUnit: [{ unit: "tray", quantity: 9.5 }],
      dispatchedQuantityByUnit: [{ unit: "tray", quantity: 8.5 }],
      goodReceivedQuantityByUnit: [{ unit: "tray", quantity: 6.25 }],
      damagedQuantityByUnit: [{ unit: "tray", quantity: 1 }],
      missingQuantityByUnit: [{ unit: "tray", quantity: 1.25 }],
    });
    expect(modes.shadow).toMatchObject({
      orderCount: 1,
      activeOrderCount: 1,
      inactiveOrderCount: 0,
      requestedQuantityByUnit: [{ unit: "tray", quantity: 4 }],
      preparedQuantityByUnit: [{ unit: "tray", quantity: 4 }],
      dispatchedQuantityByUnit: [{ unit: "tray", quantity: 4 }],
      goodReceivedQuantityByUnit: [{ unit: "tray", quantity: 0 }],
    });
    expect(modes.unknown).toMatchObject({
      orderCount: 1,
      activeOrderCount: 1,
      inactiveOrderCount: 0,
      requestedQuantityByUnit: [{ unit: "tray", quantity: 3 }],
    });
    expect(report.summary.centralKitchen).toMatchObject({
      orderCount: 3,
      activeOrderCount: 3,
      inactiveOrderCount: 0,
    });
    expect(report.summary.centralKitchen.orderCountsByInventoryModeAndStatus).toEqual(expect.arrayContaining([
      { inventoryMode: "real", status: "received", orderCount: 1 },
      { inventoryMode: "shadow", status: "dispatched", orderCount: 1 },
      { inventoryMode: "unknown", status: "requested", orderCount: 1 },
    ]));

    // Consumption comes only from immutable debit movements. The non-recipe
    // batch without a movement does not acquire consumption from a recipe.
    expect(report.materialRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        warehouseItemId: fixture.materialKgId,
        unit: "kg",
        consumedQuantity: 0.125,
        batchIds: [fixture.finishedPostedBatchId],
      }),
      expect.objectContaining({
        warehouseItemId: fixture.materialLitreId,
        unit: "litre",
        consumedQuantity: 1.5,
        batchIds: [fixture.finishedPostedBatchId],
      }),
    ]));
    expect(byUnit(report.summary.materials.consumedQuantityByUnit)).toEqual({ kg: 0.125, litre: 1.5 });
    expect(report.materialRows.every((row) => row.batchIds.includes(fixture.legacyBatchId) === false)).toBe(true);
    expect(report.productionRows.some((row) => row.productId === fixture.outsiderProductId)).toBe(false);
    expect(report.requestRows.some((row) => row.itemName === "Outsider-only output")).toBe(false);
    expect(report.materialRows.every((row) => row.batchIds.includes(fixture.outsiderBatchId) === false)).toBe(true);

    // Approved waste is a separate fact; it neither reduces production nor
    // merges into material consumption. The draft waste report is excluded.
    expect(report.summary.approvedWaste).toEqual({
      reportCount: 1,
      quantityByCatalogUnit: [{ unit: "tray", quantity: 3 }],
    });
    expect(report.wasteRows).toEqual([
      expect.objectContaining({
        productId: fixture.outputProductId,
        approvedQuantity: 3,
      }),
    ]);
    expect(report.wasteRows.some((row) => row.productId === fixture.outsiderProductId)).toBe(false);

    const plan = report.plannedRows.find((row) => row.advancedOrderIds.includes(fixture.advancedOrderId))!;
    expect(plan).toMatchObject({
      productId: fixture.outputProductId,
      plannedQuantity: 17,
      sourceBranchIds: [fixture.kitchenBranchId],
      targetBranchIds: [fixture.requestBranchId],
      comparisonStatus: "unavailable_without_explicit_batch_link",
    });
    expect(Object.keys(plan)).not.toContain("batchId");
    expect(report.summary.advancedPlans.comparisonStatus).toBe("unavailable_without_explicit_batch_link");
  });

  it("keeps branchId=all constrained to the caller's allowed branch list across requests, production, waste, and material ledger", async () => {
    const response = await invoke("get", "/api/production/operations-report", {
      user: fixture.multiBranchUser,
      query: reportQuery("all"),
    });
    expect(response.statusCode).toBe(200);
    const report = response.body as ProductionOperationsReport;
    expect(report.metadata.branchScope).toEqual({
      requestedBranchId: "all",
      effectiveBranchIds: [fixture.kitchenBranchId, fixture.requestBranchId],
      allConvention: "branchId=all",
    });
    expect(report.productionRows.some((row) => row.productId === fixture.outsiderProductId)).toBe(false);
    expect(report.requestRows.some((row) => row.itemName === "Outsider-only output")).toBe(false);
    expect(report.wasteRows.some((row) => row.productId === fixture.outsiderProductId)).toBe(false);
    expect(report.plannedRows.some((row) => row.productId === fixture.outsiderProductId)).toBe(false);
    expect(report.materialRows.every((row) =>
      row.batchIds.every((batchId) => batchId !== fixture.inProgressBatchId)
      && row.batchIds.every((batchId) => batchId !== fixture.outsiderBatchId),
    )).toBe(true);
  });
});