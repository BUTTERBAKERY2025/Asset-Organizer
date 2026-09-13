import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";

const state = vi.hoisted(() => ({ db: null as any, pool: null as any }));

vi.mock("../server/db", () => ({
  db: new Proxy({}, { get(_target, property) {
    const value = state.db?.[property];
    return typeof value === "function" ? value.bind(state.db) : value;
  } }),
  pool: new Proxy({}, { get(_target, property) {
    const value = state.pool?.[property];
    return typeof value === "function" ? value.bind(state.pool) : value;
  } }),
}));

vi.mock("../server/auth", () => {
  const permitted = (req: any) => new Set(req.currentUser?.testAllowedBranchIds || []);
  const middleware = (_module: string, _action?: string) => (req: any, res: any, next: () => any) =>
    req.currentUser ? next() : res.status(401).json({ error: "Unauthenticated" });
  const pass = () => (_req: any, _res: any, next: () => any) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: (req: any, res: any, next: () => any) => req.currentUser ? next() : res.status(401).json({ error: "Unauthenticated" }),
    requirePermission: middleware, requireAnyPermission: pass, requireRole: pass, requireBranchAccess: pass,
    canAccessBranch: async (req: any, branchId: string) => req.currentUser?.role === "admin" || permitted(req).has(branchId),
    isUserAdmin: (req: any) => req.currentUser?.role === "admin",
    getAllowedBranchIds: async (req: any) => [...permitted(req)],
    getActiveBranchFilter: (req: any) => req.currentUser?.branchId || null,
    getEffectiveBranchFilter: (req: any, requested?: string) => ({
      hasAccess: !requested || permitted(req).has(requested), singleBranchId: requested || req.currentUser?.branchId || null,
      branchIds: [...permitted(req)],
    }),
    invalidateAuthCache: vi.fn(), getCachedPermissionsForUser: () => null,
    parseUserAgent: () => ({ browser: "test", os: "test", device: "test" }),
    hasCrossBranchHrReadAccess: () => false,
    HR_MANAGER_MODULES: new Set(), HR_SPECIALIST_PERMISSIONS: {},
    FINANCIAL_MANAGER_PERMISSIONS: {}, OPERATIONS_MANAGER_PERMISSIONS: {},
    BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS: {},
  };
});

type Registration = { method: string; path: string; handlers: Array<(req: any, res: any, next: () => any) => any> };
type TestResponse = { statusCode: number; body: any; headers: Record<string, string> };
const registrations: Registration[] = [];
let fixture!: { suffix: string; branchId: string; user: any; productId: number };
let serial = 0;

function appCapture() {
  const app: any = {};
  for (const method of ["get", "post", "put", "patch", "delete", "options"]) {
    app[method] = (path: string, ...handlers: Registration["handlers"]) => {
      registrations.push({ method, path, handlers }); return app;
    };
  }
  app.use = () => app;
  return app;
}

function key(label: string) {
  serial += 1;
  return `manual-concurrency-${label}-${serial}-key`;
}

async function invoke(method: string, path: string, options: {
  params?: Record<string, string>; body?: any; headers?: Record<string, string>;
}): Promise<TestResponse> {
  const registration = registrations.find((entry) => entry.method === method && entry.path === path);
  if (!registration) throw new Error(`Route was not registered: ${method.toUpperCase()} ${path}`);
  const headers = Object.fromEntries(Object.entries(options.headers || {})
    .map(([name, value]) => [name.toLowerCase(), value]));
  const response: TestResponse = { statusCode: 200, body: undefined, headers: {} };
  const req: any = {
    method: method.toUpperCase(), currentUser: fixture.user, user: fixture.user,
    params: options.params || {}, query: {}, body: options.body || {}, headers,
    get(name: string) { return headers[name.toLowerCase()]; },
  };
  const res: any = {
    status(code: number) { response.statusCode = code; return res; },
    set(name: string, value: string) { response.headers[name.toLowerCase()] = value; return res; },
    header(name: string, value: string) { response.headers[name.toLowerCase()] = value; return res; },
    json(value: any) { response.body = value; return res; },
    send(value: any) { response.body = value; return res; },
  };
  let i = 0;
  const next = async (): Promise<void> => {
    const handler = registration.handlers[i++];
    if (handler) await handler(req, res, next);
  };
  await next();
  return response;
}

function createBody(extra: Record<string, unknown> = {}) {
  return {
    branchId: fixture.branchId, productId: fixture.productId, productName: "Manual concurrency product",
    quantity: 2, unit: "tray", destination: "freezer", productionDate: "2099-08-01",
    status: "in_progress", independentEntryAcknowledged: true, ...extra,
  };
}

async function rows(query: ReturnType<typeof sql>) {
  return (await state.db.execute(query)).rows;
}

describe.sequential("manual-production durable idempotency concurrent connections (development DB)", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Manual-production concurrency tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");
    // This is deliberately not a rollback transaction: concurrent route
    // transactions must use independently leased PostgreSQL connections.
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, allowExitOnIdle: true });
    state.pool = pool;
    state.db = drizzle(pool, { schema });
    const suffix = `${process.pid}-${Date.now()}`;
    const branchId = `manual-concurrency-${suffix}`;
    const userId = `manual-concurrency-user-${suffix}`;
    const idResult = await rows(sql`SELECT COALESCE(MAX(id), 0)::int + 1000 AS id FROM products`);
    const productId = Number(idResult[0].id);
    await state.db.execute(sql`
      INSERT INTO branches (id, name) VALUES (${branchId}, 'Manual concurrency branch')
    `);
    await state.db.execute(sql`
      INSERT INTO users (id, username, role, branch_id)
      VALUES (${userId}, ${userId}, 'manager', ${branchId})
    `);
    await state.db.execute(sql`
      INSERT INTO products (id, name, category, unit, is_active)
      VALUES (${productId}, 'Manual concurrency product', 'test', 'tray', 'true')
    `);
    fixture = {
      suffix, branchId, productId,
      user: {
        id: userId, username: userId, role: "manager", branchId,
        testAllowedBranchIds: [branchId], testPermissions: { production: ["view", "create", "edit", "delete"] },
      },
    };
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), appCapture());
  }, 30_000);

  afterAll(async () => {
    // Restrict every cleanup statement to this test's random IDs. We do not
    // disable triggers or touch any unrelated development records.
    await state.db?.execute(sql`DELETE FROM manual_production_operations WHERE actor_id = ${fixture.user.id}`);
    await state.db?.execute(sql`DELETE FROM production_inventory_logs WHERE branch_id = ${fixture.branchId}`);
    await state.db?.execute(sql`DELETE FROM finished_goods_inventory WHERE branch_id = ${fixture.branchId}`);
    await state.db?.execute(sql`DELETE FROM daily_production_batches WHERE branch_id = ${fixture.branchId}`);
    await state.db?.execute(sql`DELETE FROM users WHERE id = ${fixture.user.id}`);
    await state.db?.execute(sql`DELETE FROM products WHERE id = ${fixture.productId}`);
    await state.db?.execute(sql`DELETE FROM branches WHERE id = ${fixture.branchId}`);
    await state.pool?.end();
  });

  it("uses concurrent PostgreSQL leases for one same-key create, inserting one row and no duplicate stock credit", async () => {
    const idempotencyKey = key("same-create");
    const requests = await Promise.all([
      invoke("post", "/api/daily-production/batches", {
        headers: { "Idempotency-Key": idempotencyKey }, body: createBody(),
      }),
      invoke("post", "/api/daily-production/batches", {
        headers: { "Idempotency-Key": idempotencyKey }, body: createBody(),
      }),
    ]);
    expect(requests.map((result) => result.statusCode)).toEqual([201, 201]);
    expect(requests[0].body).toEqual(requests[1].body);
    // The pool obtains separate physical leases while the two route
    // transactions contend on the durable advisory lock; a one-connection
    // transaction test could not establish this property.
    expect(state.pool.totalCount).toBeGreaterThanOrEqual(2);
    expect(await rows(sql`
      SELECT id FROM daily_production_batches
      WHERE branch_id = ${fixture.branchId} AND production_date = '2099-08-01'
    `)).toHaveLength(1);
    expect(await rows(sql`
      SELECT id FROM production_inventory_logs WHERE branch_id = ${fixture.branchId}
    `)).toHaveLength(0);
    expect(await rows(sql`
      SELECT id FROM manual_production_operations
      WHERE actor_id = ${fixture.user.id} AND operation = 'create' AND idempotency_key = ${idempotencyKey}
    `)).toHaveLength(1);
  });

  it("allows one of two distinct-key reschedules with one expected version and conflicts the other", async () => {
    const created = await invoke("post", "/api/daily-production/batches", {
      headers: { "Idempotency-Key": key("reschedule-source") },
      body: createBody({ productionDate: "2099-08-10" }),
    });
    expect(created.statusCode).toBe(201);
    const common = {
      branchId: fixture.branchId, independentEntryAcknowledged: true,
      expectedProductionDate: "2099-08-10", expectedQuantity: 2,
    };
    const results = await Promise.all([
      invoke("post", "/api/daily-production/batches/:id/reschedule", {
        params: { id: String(created.body.id) }, headers: { "Idempotency-Key": key("reschedule-a") },
        body: { ...common, productionDate: "2099-08-11" },
      }),
      invoke("post", "/api/daily-production/batches/:id/reschedule", {
        params: { id: String(created.body.id) }, headers: { "Idempotency-Key": key("reschedule-b") },
        body: { ...common, productionDate: "2099-08-12" },
      }),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    const [stored] = await rows(sql`
      SELECT production_date FROM daily_production_batches WHERE id = ${created.body.id}
    `);
    expect(["2099-08-11", "2099-08-12"]).toContain(stored.production_date);
    expect(await rows(sql`
      SELECT id FROM daily_production_batches WHERE branch_id = ${fixture.branchId} AND source_batch_id = ${created.body.id}
    `)).toHaveLength(0);
    expect(await rows(sql`
      SELECT id FROM production_inventory_logs WHERE batch_id = ${created.body.id}
    `)).toHaveLength(0);
  });
});