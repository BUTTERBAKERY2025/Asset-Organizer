import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";
import { branches, products, users } from "../shared/schema";
import { MANUAL_PRODUCTION_RESERVED_FIELDS } from "../shared/manual-production-entry";

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
  const allowed = (req: any) => new Set<string>(
    req.currentUser?.testAllowedBranchIds || [req.currentUser?.branchId].filter(Boolean),
  );
  const admin = (req: any) => req.currentUser?.role === "admin";
  const permission = (module: string, action?: string) => (req: any, res: any, next: () => any) => {
    if (!req.currentUser) return res.status(401).json({ error: "Unauthenticated" });
    if (admin(req) || (req.currentUser.testPermissions?.[module] || []).includes(action || "create")) return next();
    return res.status(403).json({ error: `Missing ${module}:${action || "create"}` });
  };
  const pass = () => (_req: any, _res: any, next: () => any) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: (req: any, res: any, next: () => any) =>
      req.currentUser ? next() : res.status(401).json({ error: "Unauthenticated" }),
    requirePermission: permission,
    requireAnyPermission: pass, requireRole: pass, requireBranchAccess: pass,
    canAccessBranch: async (req: any, branchId: string) => admin(req) || allowed(req).has(branchId),
    isUserAdmin: admin,
    getAllowedBranchIds: async (req: any) => admin(req) ? null : [...allowed(req)],
    getActiveBranchFilter: (req: any) => req.currentUser?.branchId || null,
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      if (admin(req)) return { hasAccess: true, singleBranchId: requested || null, branchIds: null };
      const ids = [...allowed(req)];
      return requested
        ? { hasAccess: ids.includes(requested), singleBranchId: requested, branchIds: ids }
        : { hasAccess: true, singleBranchId: ids.length === 1 ? ids[0] : null, branchIds: ids };
    },
    invalidateAuthCache: vi.fn(), getCachedPermissionsForUser: () => null,
    parseUserAgent: () => ({ browser: "test", os: "test", device: "test" }),
    hasCrossBranchHrReadAccess: () => false,
    HR_MANAGER_MODULES: new Set(), HR_SPECIALIST_PERMISSIONS: {},
    FINANCIAL_MANAGER_PERMISSIONS: {}, OPERATIONS_MANAGER_PERMISSIONS: {},
    BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS: {},
  };
});

type Registration = { method: string; path: string; handlers: Array<(req: any, res: any, next: () => any) => any> };
type Response = { statusCode: number; body: any; headers: Record<string, string> };
const registrations: Registration[] = [];
let finishTransaction!: () => void;
let transactionPromise!: Promise<void>;
let fixture!: { branchId: string; otherBranchId: string; user: any; otherUser: any; productId: number };
let sequence = 0;

function captureApp() {
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
  sequence += 1;
  return `manual-idempotency-${label}-${sequence}-key`;
}

async function invoke(method: string, path: string, options: {
  user?: any; params?: any; body?: any; headers?: Record<string, string>;
}): Promise<Response> {
  const registration = registrations.find((entry) => entry.method === method && entry.path === path);
  if (!registration) throw new Error(`Route was not registered: ${method.toUpperCase()} ${path}`);
  const headers = Object.fromEntries(Object.entries(options.headers || {})
    .map(([name, value]) => [name.toLowerCase(), value]));
  const response: Response = { statusCode: 200, body: undefined, headers: {} };
  const req: any = {
    method: method.toUpperCase(), currentUser: options.user, user: options.user,
    params: options.params || {}, query: {}, body: options.body || {}, headers,
    get(name: string) { return headers[name.toLowerCase()]; },
  };
  const res: any = {
    status(code: number) { response.statusCode = code; return res; },
    set(name: string, value: string) { response.headers[name.toLowerCase()] = value; return res; },
    header(name: string, value: string) { response.headers[name.toLowerCase()] = value; return res; },
    json(body: any) { response.body = body; return res; },
    send(body: any) { response.body = body; return res; },
  };
  let position = 0;
  const run = async (): Promise<void> => {
    const handler = registration.handlers[position++];
    if (!handler) return;
    let nextCalled = false;
    await handler(req, res, async () => { nextCalled = true; await run(); });
    if (nextCalled) return;
  };
  await run();
  return response;
}

function body(extra: Record<string, unknown> = {}) {
  return {
    branchId: fixture.branchId, productId: fixture.productId,
    productName: "Manual idempotency product", quantity: 2, unit: "tray",
    destination: "freezer", productionDate: "2099-07-01", status: "in_progress",
    independentEntryAcknowledged: true, ...extra,
  };
}

async function create(payload = body(), idempotencyKey = key("create"), user = fixture.user) {
  return invoke("post", "/api/daily-production/batches", {
    user, body: payload, headers: { "Idempotency-Key": idempotencyKey },
  });
}

async function count(sqlText: ReturnType<typeof sql>) {
  return Number((await databaseState.db.execute(sqlText)).rows[0].count);
}

describe.sequential("manual-production idempotency routes (development DB)", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Manual-production idempotency integration tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, allowExitOnIdle: true });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const done = new Promise<void>((resolve) => { finishTransaction = resolve; });
    const rollback = new Error("MANUAL_PRODUCTION_IDEMPOTENCY_TEST_ROLLBACK");
    transactionPromise = realDb.transaction(async (tx) => {
      databaseState.db = tx; ready(); await done; throw rollback;
    }).then(() => { throw new Error("Integration transaction unexpectedly committed"); },
      (error) => { if (error !== rollback) throw error; });
    await readyPromise;

    const suffix = `${process.pid}-${Date.now()}`;
    const branchId = `manual-idempotency-${suffix}`;
    const otherBranchId = `manual-idempotency-other-${suffix}`;
    const user = {
      id: `manual-idempotency-user-${suffix}`, username: `manual-idempotency-${suffix}`,
      role: "manager", branchId, testAllowedBranchIds: [branchId],
      testPermissions: { production: ["view", "create", "edit", "delete"] },
    };
    const otherUser = {
      id: `manual-idempotency-other-user-${suffix}`, username: `manual-idempotency-other-${suffix}`,
      role: "manager", branchId: otherBranchId, testAllowedBranchIds: [otherBranchId],
      testPermissions: { production: ["view", "create", "edit", "delete"] },
    };
    await databaseState.db.insert(branches).values([
      { id: branchId, name: "Manual idempotency branch" },
      { id: otherBranchId, name: "Manual idempotency other branch" },
    ]);
    await databaseState.db.insert(users).values([
      { id: user.id, username: user.username, role: user.role, branchId },
      { id: otherUser.id, username: otherUser.username, role: otherUser.role, branchId: otherBranchId },
    ]);
    const productId = Number((await databaseState.db.execute(sql`
      SELECT COALESCE(MAX(id), 0)::int + 1000 AS id FROM products
    `)).rows[0].id);
    await databaseState.db.insert(products).values({
      id: productId, name: "Manual idempotency product", category: "test", unit: "tray", isActive: "true",
    });
    fixture = { branchId, otherBranchId, user, otherUser, productId };
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("requires the Idempotency-Key header before acknowledgement or writes", async () => {
    const before = await count(sql`SELECT COUNT(*)::int AS count FROM daily_production_batches WHERE branch_id = ${fixture.branchId}`);
    const anonymous = await invoke("post", "/api/daily-production/batches", {
      body: body(), headers: { "Idempotency-Key": key("anonymous") },
    });
    expect(anonymous.statusCode).toBe(401);
    const missingHeader = await invoke("post", "/api/daily-production/batches", { user: fixture.user, body: body() });
    expect(missingHeader.statusCode).toBe(400);
    expect(missingHeader.body.error).toContain("Idempotency-Key");
    const missingAcknowledgement = await create(body({ independentEntryAcknowledged: undefined }));
    expect(missingAcknowledgement.statusCode).toBe(400);
    expect(await count(sql`SELECT COUNT(*)::int AS count FROM daily_production_batches WHERE branch_id = ${fixture.branchId}`)).toBe(before);
  });

  it("rejects reserved fields and sourceBatchId clone requests before an insert", async () => {
    for (const field of MANUAL_PRODUCTION_RESERVED_FIELDS) {
      const response = await create(body({ [field]: null }));
      expect(response.statusCode, field).toBe(400);
    }
    const clone = await create(body({ sourceBatchId: 123 }));
    expect(clone.statusCode).toBe(400);
    expect(clone.body.error).toContain("إعادة جدولة");
  });

  it("replays the original JSON after later edits and rejects a changed payload", async () => {
    const idempotencyKey = key("replay");
    const original = await create(body({ notes: "original response" }), idempotencyKey);
    expect(original.statusCode).toBe(201);
    const edited = await invoke("patch", "/api/daily-production/batches/:id", {
      user: fixture.user, params: { id: String(original.body.id) }, body: { notes: "subsequently edited" },
    });
    expect(edited.statusCode).toBe(200);
    const replay = await create(body({ notes: "original response" }), idempotencyKey);
    expect(replay.statusCode).toBe(201);
    expect(replay.body).toEqual(original.body);
    const changed = await create(body({ notes: "changed request" }), idempotencyKey);
    expect(changed.statusCode).toBe(409);
  });

  it("isolates stored keys by actor and operation, and re-authorizes the stored branch", async () => {
    const idempotencyKey = key("isolation");
    const created = await create(body(), idempotencyKey);
    expect(created.statusCode).toBe(201);
    const otherActor = await create(body(), idempotencyKey, fixture.otherUser);
    expect(otherActor.statusCode).toBe(403);
    const lostAccess = await create(body(), idempotencyKey, {
      ...fixture.user, testAllowedBranchIds: [fixture.otherBranchId],
    });
    expect(lostAccess.statusCode).toBe(403);

    const rescheduled = await invoke("post", "/api/daily-production/batches/:id/reschedule", {
      user: fixture.user, params: { id: String(created.body.id) },
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        branchId: fixture.branchId, independentEntryAcknowledged: true,
        expectedProductionDate: "2099-07-01", expectedQuantity: 2, productionDate: "2099-07-02",
      },
    });
    expect(rescheduled.statusCode).toBe(200);
  });

  it("rolls a failed create back completely so its key can be reused", async () => {
    const idempotencyKey = key("rollback");
    const failed = await create(body({ productId: fixture.productId + 999_999 }), idempotencyKey);
    expect(failed.statusCode).toBeGreaterThanOrEqual(400);
    const retry = await create(body(), idempotencyKey);
    expect(retry.statusCode).toBe(201);
  });

  it("posts stock once for a finished create even when the request is replayed", async () => {
    const idempotencyKey = key("stock");
    const finished = await create(body({ status: "finished", quantity: 3, productionDate: "2099-07-03" }), idempotencyKey);
    expect(finished.statusCode).toBe(201);
    const replay = await create(body({ status: "finished", quantity: 3, productionDate: "2099-07-03" }), idempotencyKey);
    expect(replay.statusCode).toBe(201);
    expect(await count(sql`
      SELECT COUNT(*)::int AS count FROM production_inventory_logs WHERE batch_id = ${finished.body.id}
    `)).toBe(1);
    const stock = await databaseState.db.execute(sql`
      SELECT COALESCE(SUM(quantity), 0)::int AS quantity FROM finished_goods_inventory
      WHERE branch_id = ${fixture.branchId} AND product_id = ${fixture.productId}
        AND production_date = '2099-07-03'
    `);
    expect(Number(stock.rows[0].quantity)).toBe(3);
  });

  it("reschedules the same in-progress row only, with optimistic date/quantity guards and no stock effects", async () => {
    const created = await create(body({ quantity: 4, productionDate: "2099-07-10" }));
    expect(created.statusCode).toBe(201);
    const idempotencyKey = key("reschedule");
    const request = {
      branchId: fixture.branchId, independentEntryAcknowledged: true,
      expectedProductionDate: "2099-07-10", expectedQuantity: 4, productionDate: "2099-07-11",
    };
    const first = await invoke("post", "/api/daily-production/batches/:id/reschedule", {
      user: fixture.user, params: { id: String(created.body.id) },
      headers: { "Idempotency-Key": idempotencyKey }, body: request,
    });
    expect(first.statusCode).toBe(200);
    expect(first.body.batch.id).toBe(created.body.id);
    const replay = await invoke("post", "/api/daily-production/batches/:id/reschedule", {
      user: fixture.user, params: { id: String(created.body.id) },
      headers: { "Idempotency-Key": idempotencyKey }, body: request,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toEqual(first.body);
    const stale = await invoke("post", "/api/daily-production/batches/:id/reschedule", {
      user: fixture.user, params: { id: String(created.body.id) }, headers: { "Idempotency-Key": key("stale") },
      body: request,
    });
    expect(stale.statusCode).toBe(409);
    expect(await count(sql`SELECT COUNT(*)::int AS count FROM production_inventory_logs WHERE batch_id = ${created.body.id}`)).toBe(0);
    expect(await count(sql`
      SELECT COUNT(*)::int AS count FROM daily_production_batches
      WHERE branch_id = ${fixture.branchId} AND source_batch_id = ${created.body.id}
    `)).toBe(0);
  });

  it("rejects stale quantities, completed rows, and rows with a posting ledger", async () => {
    const quantityChanged = await create(body({ quantity: 5, productionDate: "2099-07-20" }));
    const staleQuantity = await invoke("post", "/api/daily-production/batches/:id/reschedule", {
      user: fixture.user, params: { id: String(quantityChanged.body.id) }, headers: { "Idempotency-Key": key("quantity") },
      body: {
        branchId: fixture.branchId, independentEntryAcknowledged: true,
        expectedProductionDate: "2099-07-20", expectedQuantity: 4, productionDate: "2099-07-21",
      },
    });
    expect(staleQuantity.statusCode).toBe(409);

    const completed = await create(body({ productionDate: "2099-07-20", status: "finished" }));
    const completedAttempt = await invoke("post", "/api/daily-production/batches/:id/reschedule", {
      user: fixture.user, params: { id: String(completed.body.id) }, headers: { "Idempotency-Key": key("finished") },
      body: {
        branchId: fixture.branchId, independentEntryAcknowledged: true,
        expectedProductionDate: "2099-07-20", expectedQuantity: 2, productionDate: "2099-07-21",
      },
    });
    expect(completedAttempt.statusCode).toBe(409);

    const posted = await create(body({ productionDate: "2099-07-20" }));
    await databaseState.db.execute(sql`
      INSERT INTO production_inventory_logs
        (branch_id, product_id, product_name, movement_type, quantity, balance_before, balance_after,
         reference_type, reference_id, batch_id, created_by)
      VALUES
        (${fixture.branchId}, ${fixture.productId}, 'Manual idempotency product', 'production_in', 2, 0, 2,
         'batch', ${posted.body.id}, ${posted.body.id}, ${fixture.user.id})
    `);
    const postedAttempt = await invoke("post", "/api/daily-production/batches/:id/reschedule", {
      user: fixture.user, params: { id: String(posted.body.id) }, headers: { "Idempotency-Key": key("posted") },
      body: {
        branchId: fixture.branchId, independentEntryAcknowledged: true,
        expectedProductionDate: "2099-07-20", expectedQuantity: 2, productionDate: "2099-07-21",
      },
    });
    expect(postedAttempt.statusCode).toBe(409);
  });
});