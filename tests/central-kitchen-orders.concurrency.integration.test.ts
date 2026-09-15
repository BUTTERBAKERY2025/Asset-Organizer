import express from "express";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";
import {
  branches,
  centralKitchenOrderEvents,
  centralKitchenOrderItems,
  centralKitchenOrders,
  products,
  users,
} from "../shared/schema";

/**
 * Authentication and permission helpers are intentionally test doubles. Each
 * HTTP request still traverses Express, the production route registrations,
 * route-level branch checks, the real Drizzle adapter, and real PostgreSQL
 * transactions. The x-test-user header is the test-only identity carrier; it
 * is never accepted by production authentication.
 */
const authState = vi.hoisted(() => ({
  identities: new Map<string, any>(),
}));

const databaseState = vi.hoisted(() => ({
  db: null as any,
  pool: null as pg.Pool | null,
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

vi.mock("../server/auth", () => {
  const allowedBranchIds = (req: any) => new Set<string>(
    req.currentUser?.testAllowedBranchIds
      || [req.currentUser?.branchId].filter(Boolean),
  );
  const isAdmin = (req: any) => req.currentUser?.role === "admin";
  const authenticated = (req: any, res: any, next: () => void) => {
    if (!req.currentUser) return res.status(401).json({ error: "Unauthenticated" });
    return next();
  };
  const permission = () => authenticated;

  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: authenticated,
    requirePermission: permission,
    requireAnyPermission: () => authenticated,
    requireRole: () => authenticated,
    requireBranchAccess: () => authenticated,
    canAccessBranch: async (req: any, branchId: string) =>
      isAdmin(req) || allowedBranchIds(req).has(branchId),
    isUserAdmin: isAdmin,
    getAllowedBranchIds: async (req: any) =>
      isAdmin(req) ? null : Array.from(allowedBranchIds(req)),
    getActiveBranchFilter: (req: any) => req.currentUser?.branchId || null,
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      if (isAdmin(req)) {
        return { hasAccess: true, singleBranchId: requested || null, branchIds: null };
      }
      const branchIds = Array.from(allowedBranchIds(req));
      if (requested) {
        return {
          hasAccess: branchIds.includes(requested),
          singleBranchId: requested,
          branchIds,
        };
      }
      return {
        hasAccess: true,
        singleBranchId: branchIds.length === 1 ? branchIds[0] : null,
        branchIds,
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

type HttpResponse = {
  status: number;
  body: any;
  headers: Record<string, string>;
};

type Fixture = {
  schemaName: string;
  requestBranchId: string;
  kitchenBranchId: string;
  outsiderBranchId: string;
  productId: number;
  requestUser: any;
  kitchenUser: any;
  outsiderUser: any;
};

let adminPool: pg.Pool | null = null;
let httpServer: Server | null = null;
let httpServerListening = false;
let baseUrl = "";
let isolatedSchemaName: string | null = null;
let fixture!: Fixture;

const ISOLATED_TABLES = [
  "branches",
  "users",
  "products",
  "warehouse_items",
  "central_kitchen_orders",
  "central_kitchen_order_items",
  "central_kitchen_order_events",
  "central_kitchen_shadow_inventory_config",
  "central_kitchen_shadow_inventory_entries",
  "central_kitchen_inventory_allocations",
  "central_kitchen_runtime",
  "daily_production_batches",
] as const;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function isolatedTable(schemaName: string, tableName: string): string {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
}

function key(label: string): string {
  return `ck-http-concurrency-${label}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function assertDevelopmentDatabase(): void {
  if (
    !["development", "test"].includes(process.env.NODE_ENV || "")
    || process.env.REPLIT_DEPLOYMENT === "1"
  ) {
    throw new Error(
      "Central-kitchen concurrency integration tests require a non-production development/test database",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("Development DATABASE_URL is required");
  }
}

/**
 * Clone only the tables exercised by these routes into a fresh schema. The
 * schema has no data, all copied foreign keys are removed so they cannot point
 * back to public, and serial defaults are redirected to schema-local
 * sequences. The route pool uses this schema as its only search_path, so a
 * missing table cannot silently fall back to an existing development row.
 */
async function createIsolatedSchema(pool: pg.Pool, schemaName: string): Promise<void> {
  await pool.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
  for (const tableName of ISOLATED_TABLES) {
    await pool.query(
      `CREATE TABLE ${isolatedTable(schemaName, tableName)} `
      + `(LIKE public.${quoteIdentifier(tableName)} INCLUDING ALL)`,
    );
  }

  const foreignKeys = await pool.query<{
    tableName: string;
    constraintName: string;
  }>(
    `SELECT c.relname AS "tableName", con.conname AS "constraintName"
     FROM pg_constraint con
     JOIN pg_class c ON c.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND con.contype = 'f'`,
    [schemaName],
  );
  for (const foreignKey of foreignKeys.rows) {
    await pool.query(
      `ALTER TABLE ${isolatedTable(schemaName, foreignKey.tableName)}
       DROP CONSTRAINT ${quoteIdentifier(foreignKey.constraintName)}`,
    );
  }

  const serialColumns = await pool.query<{
    tableName: string;
    columnName: string;
  }>(
    `SELECT table_name AS "tableName", column_name AS "columnName"
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
       AND column_default LIKE 'nextval(%'`,
    [Array.from(ISOLATED_TABLES)],
  );
  for (const serialColumn of serialColumns.rows) {
    const sequenceName = `${serialColumn.tableName}_${serialColumn.columnName}_seq`;
    const sequence = `${quoteIdentifier(schemaName)}.${quoteIdentifier(sequenceName)}`;
    await pool.query(`CREATE SEQUENCE ${sequence}`);
    await pool.query(
      `ALTER TABLE ${isolatedTable(schemaName, serialColumn.tableName)}
       ALTER COLUMN ${quoteIdentifier(serialColumn.columnName)}
       SET DEFAULT nextval('${schemaName}.${sequenceName}'::regclass)`,
    );
    await pool.query(
      `ALTER SEQUENCE ${sequence}
       OWNED BY ${isolatedTable(schemaName, serialColumn.tableName)}.${quoteIdentifier(serialColumn.columnName)}`,
    );
  }
}

async function dropIsolatedSchema(pool: pg.Pool, schemaName: string): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
}

function createOrderBody(extra: Record<string, unknown> = {}) {
  return {
    requestBranchId: fixture.requestBranchId,
    centralKitchenId: fixture.kitchenBranchId,
    items: [{
      productId: fixture.productId,
      productName: "HTTP concurrency product",
      requestedQuantity: 2,
      unit: "tray",
    }],
    ...extra,
  };
}

async function httpRequest(
  user: any,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  const requestHeaders: Record<string, string> = {
    "x-test-user": user?.id || "",
    ...headers,
  };
  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };
  if (body !== undefined) {
    requestHeaders["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let parsed: any = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return {
    status: response.status,
    body: parsed,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function createOrder(
  user = fixture.requestUser,
  idempotencyKey = key("create"),
  extra: Record<string, unknown> = {},
): Promise<HttpResponse> {
  return httpRequest(
    user,
    "POST",
    "/api/central-kitchen-orders",
    createOrderBody({ ...extra, idempotencyKey }),
  );
}

async function countRows(query: ReturnType<typeof sql>): Promise<number> {
  const result = await databaseState.db.execute(query);
  return Number((result.rows[0] as any).count);
}

describe.sequential(
  "central kitchen order HTTP concurrency (isolated development schema)",
  () => {
    beforeAll(async () => {
      assertDevelopmentDatabase();
      const schemaName = `ck_http_${process.pid}_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
      isolatedSchemaName = schemaName;
      adminPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        allowExitOnIdle: true,
      });
      await createIsolatedSchema(adminPool, schemaName);

      const routePool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 8,
        allowExitOnIdle: true,
        options: `-c search_path=${schemaName}`,
      });
      databaseState.pool = routePool;
      databaseState.db = drizzle(routePool, { schema });

      const suffix = `${process.pid}-${Date.now()}-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
      const requestBranchId = `ck-http-request-${suffix}`;
      const kitchenBranchId = `ck-http-kitchen-${suffix}`;
      const outsiderBranchId = `ck-http-outsider-${suffix}`;
      const requestUser = {
        id: `ck-http-request-user-${suffix}`,
        username: `ck-http-request-${suffix}`,
        role: "manager",
        branchId: requestBranchId,
        testAllowedBranchIds: [requestBranchId],
      };
      const kitchenUser = {
        id: `ck-http-kitchen-user-${suffix}`,
        username: `ck-http-kitchen-${suffix}`,
        role: "manager",
        branchId: kitchenBranchId,
        testAllowedBranchIds: [kitchenBranchId],
      };
      const outsiderUser = {
        id: `ck-http-outsider-user-${suffix}`,
        username: `ck-http-outsider-${suffix}`,
        role: "manager",
        branchId: outsiderBranchId,
        testAllowedBranchIds: [outsiderBranchId],
      };
      const productId = 1;

      await databaseState.db.insert(branches).values([
        { id: requestBranchId, name: "HTTP concurrency request branch" },
        { id: kitchenBranchId, name: "HTTP concurrency central kitchen", isCentralKitchen: true },
        { id: outsiderBranchId, name: "HTTP concurrency outsider branch" },
      ]);
      await databaseState.db.insert(users).values([
        { ...requestUser },
        { ...kitchenUser },
        { ...outsiderUser },
      ]);
      await databaseState.db.insert(products).values({
        id: productId,
        name: "HTTP concurrency product",
        category: "test",
        unit: "tray",
        isActive: "true",
      });

      fixture = {
        schemaName,
        requestBranchId,
        kitchenBranchId,
        outsiderBranchId,
        productId,
        requestUser,
        kitchenUser,
        outsiderUser,
      };
      authState.identities.set(requestUser.id, requestUser);
      authState.identities.set(kitchenUser.id, kitchenUser);
      authState.identities.set(outsiderUser.id, outsiderUser);

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        const identity = authState.identities.get(req.get("x-test-user") || "");
        if (identity) (req as any).currentUser = identity;
        next();
      });
      httpServer = createServer(app);
      const { registerRoutes } = await import("../server/routes");
      await registerRoutes(httpServer, app);
      await new Promise<void>((resolve, reject) => {
        httpServer!.once("error", reject);
        httpServer!.listen(0, "127.0.0.1", () => {
          httpServerListening = true;
          resolve();
        });
      });
      const address = httpServer.address();
      if (!address || typeof address === "string") throw new Error("HTTP test server did not expose a port");
      baseUrl = `http://127.0.0.1:${address.port}`;
    }, 60_000);

    afterAll(async () => {
      authState.identities.clear();
      try {
        if (httpServer && httpServerListening) {
          await new Promise<void>((resolve, reject) => {
            httpServer!.close((error) => error ? reject(error) : resolve());
          });
        }
      } finally {
        httpServerListening = false;
        try {
          await databaseState.pool?.end();
        } finally {
          databaseState.pool = null;
          databaseState.db = null;
          try {
            if (adminPool && isolatedSchemaName) {
              await dropIsolatedSchema(adminPool, isolatedSchemaName);
            }
          } finally {
            await adminPool?.end();
            adminPool = null;
            isolatedSchemaName = null;
          }
        }
      }
    }, 60_000);

    it("concurrently creates one order/event and replays the identical response", async () => {
      const idempotencyKey = key("same-create");
      const body = createOrderBody({ idempotencyKey });
      const responses = await Promise.all([
        httpRequest(fixture.requestUser, "POST", "/api/central-kitchen-orders", body),
        httpRequest(fixture.requestUser, "POST", "/api/central-kitchen-orders", body),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
      expect(responses[0].body).toEqual(responses[1].body);
      expect(responses.filter((response) => response.headers["idempotent-replayed"] === "true")).toHaveLength(1);
      expect(databaseState.pool!.totalCount).toBeGreaterThanOrEqual(2);

      const orderId = responses[0].body.id;
      expect(await countRows(sql`
        SELECT COUNT(*)::int AS count
        FROM central_kitchen_orders
         WHERE created_by = ${fixture.requestUser.id}
          AND idempotency_key = ${idempotencyKey}
      `)).toBe(1);
      expect(await countRows(sql`
        SELECT COUNT(*)::int AS count
        FROM central_kitchen_order_items
        WHERE order_id = ${orderId}
      `)).toBe(1);
      expect(await countRows(sql`
        SELECT COUNT(*)::int AS count
        FROM central_kitchen_order_events
        WHERE order_id = ${orderId}
      `)).toBe(1);
      const [event] = (await databaseState.db.execute(sql`
        SELECT event_type, to_status
        FROM central_kitchen_order_events
        WHERE order_id = ${orderId}
      `)).rows as any[];
      expect(event).toMatchObject({ event_type: "created", to_status: "requested" });

      const changedPayload = await httpRequest(
        fixture.requestUser,
        "POST",
        "/api/central-kitchen-orders",
        createOrderBody({
          idempotencyKey,
          items: [{
            productId: fixture.productId,
            productName: "HTTP concurrency product",
            requestedQuantity: 3,
            unit: "tray",
          }],
        }),
      );
      expect(changedPayload.status).toBe(409);
    });

    it("does not let an outsider list, read, change, create-for, or replay a foreign order", async () => {
      const idempotencyKey = key("outsider-target");
      const created = await createOrder(fixture.requestUser, idempotencyKey);
      expect(created.status).toBe(201);
      const orderId = created.body.id;
      const itemId = created.body.items[0].id;

      const requesterList = await httpRequest(
        fixture.requestUser,
        "GET",
        "/api/central-kitchen-orders",
      );
      expect(requesterList.status).toBe(200);
      expect(requesterList.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: orderId }),
      ]));

      const outsiderList = await httpRequest(
        fixture.outsiderUser,
        "GET",
        "/api/central-kitchen-orders",
      );
      expect(outsiderList.status).toBe(200);
      expect(outsiderList.body).toEqual([]);

      const outsiderRead = await httpRequest(
        fixture.outsiderUser,
        "GET",
        `/api/central-kitchen-orders/${orderId}`,
      );
      expect(outsiderRead.status).toBe(403);

      const outsiderCreateForBranch = await httpRequest(
        fixture.outsiderUser,
        "POST",
        "/api/central-kitchen-orders",
        createOrderBody({ idempotencyKey: undefined }),
        { "Idempotency-Key": key("outsider-create-for") },
      );
      expect(outsiderCreateForBranch.status).toBe(403);

      const outsiderReplay = await httpRequest(
        fixture.outsiderUser,
        "POST",
        "/api/central-kitchen-orders",
        createOrderBody({ idempotencyKey }),
      );
      expect(outsiderReplay.status).toBe(403);

      const transitionAttempts: Array<[string, unknown]> = [
        [`/api/central-kitchen-orders/${orderId}/approve`, {}],
        [`/api/central-kitchen-orders/${orderId}/prepare`, {
          items: [{ itemId, preparedQuantity: 2, substituteQuantity: 0 }],
        }],
        [`/api/central-kitchen-orders/${orderId}/dispatch`, {
          driverName: "Outsider",
          vehicleNumber: "OUTSIDER-1",
          items: [{ itemId, dispatchedQuantity: 0 }],
        }],
        [`/api/central-kitchen-orders/${orderId}/receive`, {
          items: [{ itemId, receivedQuantity: 0, damagedQuantity: 0 }],
        }],
        [`/api/central-kitchen-orders/${orderId}/resolve-discrepancy`, { notes: "Outsider" }],
      ];
      for (const [path, body] of transitionAttempts) {
        const response = await httpRequest(
          fixture.outsiderUser,
          "POST",
          path,
          body,
          { "Idempotency-Key": key("outsider-transition") },
        );
        expect(response.status, path).toBe(403);
      }

      expect(await countRows(sql`
        SELECT COUNT(*)::int AS count
        FROM central_kitchen_orders
        WHERE id = ${orderId}
      `)).toBe(1);
      expect(await countRows(sql`
        SELECT COUNT(*)::int AS count
        FROM central_kitchen_order_events
        WHERE order_id = ${orderId}
      `)).toBe(1);
    });

    it("allows only one competing transition, preserves state, and rejects key reuse for another action", async () => {
      const created = await createOrder();
      expect(created.status).toBe(201);
      const orderId = created.body.id;
      const itemId = created.body.items[0].id;
      const approveKeys = [key("approve-a"), key("approve-b")];

       const [approvals, outsiderApproval] = await Promise.all([
         Promise.all(approveKeys.map((idempotencyKey) =>
        httpRequest(
          fixture.kitchenUser,
          "POST",
          `/api/central-kitchen-orders/${orderId}/approve`,
          { idempotencyKey },
         ))),
         httpRequest(
           fixture.outsiderUser, "POST",
           `/api/central-kitchen-orders/${orderId}/approve`,
           { idempotencyKey: approveKeys[0] },
         ),
       ]);
      expect(approvals.map((response) => response.status).sort()).toEqual([200, 409]);
       expect(outsiderApproval.status).toBe(403);

      const [approvedOrder] = (await databaseState.db.execute(sql`
        SELECT status, approved_by
        FROM central_kitchen_orders
        WHERE id = ${orderId}
      `)).rows as any[];
      expect(approvedOrder).toMatchObject({
        status: "approved",
        approved_by: fixture.kitchenUser.id,
      });
      expect(await countRows(sql`
        SELECT COUNT(*)::int AS count
        FROM central_kitchen_order_events
        WHERE order_id = ${orderId} AND event_type = 'approved'
      `)).toBe(1);

      const winningApproveKey = approveKeys[approvals.findIndex((response) => response.status === 200)];
       const replay = await httpRequest(
         fixture.kitchenUser, "POST",
         `/api/central-kitchen-orders/${orderId}/approve`,
         { idempotencyKey: winningApproveKey },
       );
       expect(replay.status).toBe(200);
       expect(replay.headers["idempotent-replayed"]).toBe("true");
       expect(replay.body).toEqual(approvals.find((response) => response.status === 200)!.body);
      const reusedForPrepare = await httpRequest(
        fixture.kitchenUser,
        "POST",
        `/api/central-kitchen-orders/${orderId}/prepare`,
        { idempotencyKey: winningApproveKey, items: [{ itemId, preparedQuantity: 2, substituteQuantity: 0 }] },
      );
      expect(reusedForPrepare.status).toBe(409);

      const prepareBodies = [
        { idempotencyKey: key("prepare-a"), items: [{ itemId, preparedQuantity: 2, substituteQuantity: 0 }] },
        { idempotencyKey: key("prepare-b"), items: [{ itemId, preparedQuantity: 2, substituteQuantity: 0 }] },
      ];
      const preparations = await Promise.all(prepareBodies.map((prepareBody) =>
        httpRequest(
          fixture.kitchenUser,
          "POST",
          `/api/central-kitchen-orders/${orderId}/prepare`,
          prepareBody,
        )));
      expect(preparations.map((response) => response.status).sort()).toEqual([200, 409]);

      const [preparedOrder] = (await databaseState.db.execute(sql`
        SELECT status
        FROM central_kitchen_orders
        WHERE id = ${orderId}
      `)).rows as any[];
      expect(preparedOrder.status).toBe("prepared");
      const [preparedItem] = (await databaseState.db.execute(sql`
        SELECT prepared_quantity, substitute_quantity
        FROM central_kitchen_order_items
        WHERE id = ${itemId} AND order_id = ${orderId}
      `)).rows as any[];
       expect(Number(preparedItem.prepared_quantity)).toBe(2);
       expect(Number(preparedItem.substitute_quantity)).toBe(0);
      const events = (await databaseState.db.execute(sql`
        SELECT event_type, from_status, to_status
        FROM central_kitchen_order_events
        WHERE order_id = ${orderId}
        ORDER BY id
      `)).rows as any[];
      expect(events).toEqual([
        { event_type: "created", from_status: null, to_status: "requested" },
        { event_type: "approved", from_status: "requested", to_status: "approved" },
        { event_type: "prepared", from_status: "approved", to_status: "prepared" },
      ]);
    });
  },
);