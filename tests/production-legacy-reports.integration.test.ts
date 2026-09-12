import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  advancedProductionOrders,
  branches,
  dailyProductionBatches,
  products,
  productionOrderItems,
  qualityChecks,
  users,
  wasteItems,
  wasteReports,
} from "../shared/schema";
import * as schema from "../shared/schema";

// The route and storage retain their production implementation.  Only session
// authorization is replaced so the test can exercise branch scoping directly.
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
  const ids = (req: any) => req.currentUser?.allowedBranchIds || [];
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
    requirePermission: middleware,
    requireAnyPermission: middleware,
    requireRole: middleware,
    requireBranchAccess: middleware,
    canAccessBranch: async (req: any, branchId: string) => ids(req).includes(branchId),
    isUserAdmin: () => false,
    getAllowedBranchIds: (req: any) => ids(req),
    getActiveBranchFilter: () => null,
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      const allowed = ids(req);
      if (requested) {
        return {
          hasAccess: allowed.includes(requested),
          singleBranchId: allowed.includes(requested) ? requested : null,
          branchIds: allowed,
        };
      }
      return {
        hasAccess: allowed.length > 0,
        singleBranchId: allowed.length === 1 ? allowed[0] : null,
        branchIds: allowed,
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

type Registration = { method: string; path: string; handlers: Array<(req: any, res: any) => any> };
const registrations: Registration[] = [];
let finishTransaction!: () => void;
let transactionPromise!: Promise<void>;
let fixture!: { a: string; b: string; outsider: string; user: any };

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

async function invoke(path: string, query: Record<string, string>) {
  const registration = registrations.find(entry => entry.method === "get" && entry.path === path);
  if (!registration) throw new Error(`Route was not registered: ${path}`);
  const response: any = { statusCode: 200, body: undefined };
  const res: any = {
    set: () => res,
    status(code: number) { response.statusCode = code; return res; },
    json(body: any) { response.body = body; return res; },
  };
  await registration.handlers.at(-1)!({ currentUser: fixture.user, query }, res);
  return response;
}

describe.sequential("legacy production report branch and status guards", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Production report integration tests are forbidden outside DEVELOPMENT");
    }
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL is required");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, allowExitOnIdle: true });
    databaseState.pool = pool;
    const realDb = drizzle(pool, { schema });
    let ready!: () => void;
    const readyPromise = new Promise<void>(resolve => { ready = resolve; });
    const finishPromise = new Promise<void>(resolve => { finishTransaction = resolve; });
    const rollback = new Error("PRODUCTION_LEGACY_REPORTS_ROLLBACK");
    transactionPromise = realDb.transaction(async tx => {
      databaseState.db = tx;
      ready();
      await finishPromise;
      throw rollback;
    }).then(
      () => { throw new Error("Integration transaction unexpectedly committed"); },
      error => { if (error !== rollback) throw error; },
    );
    await readyPromise;

    const suffix = `${process.pid}-${Date.now()}`;
    const a = `production-report-a-${suffix}`;
    const b = `production-report-b-${suffix}`;
    const outsider = `production-report-outsider-${suffix}`;
    const user = {
      id: `production-report-user-${suffix}`,
      username: `production-report-user-${suffix}`,
      role: "manager",
      branchId: a,
      allowedBranchIds: [a, b],
    };
    await databaseState.db.insert(branches).values([
      { id: a, name: "Production report A" },
      { id: b, name: "Production report B" },
      { id: outsider, name: "Production report outsider" },
    ]);
    await databaseState.db.insert(users).values({
      id: user.id, username: user.username, role: user.role, branchId: user.branchId,
    });
    const [product] = await databaseState.db.insert(products).values({
      name: `Production report product ${suffix}`, category: "test", unit: "piece", isActive: "true",
    }).returning();
    const [plannedOnlyProduct] = await databaseState.db.insert(products).values({
      name: `Production report planned-only ${suffix}`, category: "test", unit: "kg", isActive: "true",
    }).returning();
    const dayOne = "2097-04-01";
    const dayTwo = "2097-04-02";
    const [weeklyOrder] = await databaseState.db.insert(advancedProductionOrders).values({
      orderNumber: `production-report-weekly-${suffix}`,
      sourceBranchId: a,
      targetBranchId: b,
      title: "Seven day deduplication target",
      status: "approved",
      startDate: dayOne,
      endDate: "2097-04-07",
    }).returning();
    await databaseState.db.insert(productionOrderItems).values({
      orderId: weeklyOrder.id,
      productId: plannedOnlyProduct.id,
      productName: plannedOnlyProduct.name,
      targetQuantity: 100,
      // Intentionally no scheduled date: it is one range-level plan, not
      // seven independent daily plans.
    });
    await databaseState.db.insert(dailyProductionBatches).values([
      { branchId: a, productId: product.id, productName: product.name, quantity: 2, destination: "display_bar", productionDate: dayOne, status: "finished" },
      { branchId: a, productId: product.id, productName: product.name, quantity: 50, destination: "display_bar", productionDate: dayOne, status: "in_progress" },
      { branchId: a, productId: product.id, productName: product.name, quantity: 30, destination: "display_bar", productionDate: dayOne, status: "cancelled" },
      { branchId: b, productId: product.id, productName: product.name, quantity: 7, destination: "display_bar", productionDate: dayTwo, status: "finished" },
      { branchId: outsider, productId: product.id, productName: product.name, quantity: 99, destination: "display_bar", productionDate: dayTwo, status: "finished" },
    ]);
    await databaseState.db.insert(qualityChecks).values([
      { branchId: a, checkType: "appearance", checkDate: dayOne, result: "passed", checkedBy: user.username },
      { branchId: outsider, checkType: "appearance", checkDate: dayTwo, result: "failed", checkedBy: user.username },
    ]);
    const [approved] = await databaseState.db.insert(wasteReports).values({
      branchId: a, reportDate: dayOne, status: "approved", totalItems: 1, totalValue: 3,
    }).returning();
    const [draft] = await databaseState.db.insert(wasteReports).values({
      branchId: b, reportDate: dayTwo, status: "draft", totalItems: 1, totalValue: 50,
    }).returning();
    const [outsiderApproved] = await databaseState.db.insert(wasteReports).values({
      branchId: outsider, reportDate: dayTwo, status: "approved", totalItems: 1, totalValue: 99,
    }).returning();
    await databaseState.db.insert(wasteItems).values([
      { wasteReportId: approved.id, productId: product.id, quantity: 3, unitPrice: 1, totalValue: 3, wasteReason: "other" },
      { wasteReportId: draft.id, productId: product.id, quantity: 50, unitPrice: 1, totalValue: 50, wasteReason: "other" },
      { wasteReportId: outsiderApproved.id, productId: product.id, quantity: 99, unitPrice: 1, totalValue: 99, wasteReason: "other" },
    ]);
    fixture = { a, b, outsider, user };
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 30_000);

  afterAll(async () => {
    finishTransaction?.();
    await transactionPromise;
    await databaseState.pool?.end();
  });

  it("rejects an arbitrary branch and restricts an all-branch daily stat request", async () => {
    const denied = await invoke("/api/daily-production/stats", { branchId: fixture.outsider, date: "2097-04-02" });
    expect(denied.statusCode).toBe(403);

    const allowed = await invoke("/api/daily-production/stats", { branchId: "all", date: "2097-04-01" });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body.totalQuantity).toBe(2);
    expect(allowed.body.pendingQuantity).toBe(50);
    expect(allowed.body.cancelledQuantity).toBe(30);
  });

  it("uses both requested days, finished batches, and approved scoped waste only", async () => {
    const report = await invoke("/api/production/reports", {
      branchId: "all", startDate: "2097-04-01", endDate: "2097-04-02",
    });
    expect(report.statusCode).toBe(200);
    expect(report.body.dailySummary.totalQuantity).toBe(9);
    expect(report.body.targetComparison).toMatchObject({
      target: 100,
      actual: null,
      completionRate: null,
      gap: null,
      comparisonStatus: "unavailable_without_explicit_batch_link",
      plannedTarget: 100,
      finishedProduction: 9,
    });
    expect(report.body.trends.daily.map((day: any) => day.production)).toEqual([2, 7]);
    expect(report.body.wasteAnalysis.totalQuantity).toBe(3);
    expect(report.body.trends.daily.map((day: any) => day.waste)).toEqual([3, 0]);
    expect(report.body.qualityControl).toMatchObject({ totalChecks: 1, passed: 1, failed: 0 });
  });

  it("counts a cross-branch seven-day order item once, not once per day or branch", async () => {
    const report = await invoke("/api/production/reports", {
      branchId: "all", startDate: "2097-04-01", endDate: "2097-04-07",
    });
    expect(report.statusCode).toBe(200);
    expect(report.body.targetComparison.target).toBe(100);
    expect(report.body.targetComparison.actual).toBeNull();
    expect(report.body.comparisonStatus).toBe("unavailable_without_explicit_batch_link");
    expect(report.body.trends.daily.reduce((total: number, day: any) => total + day.target, 0)).toBe(100);
  });
});