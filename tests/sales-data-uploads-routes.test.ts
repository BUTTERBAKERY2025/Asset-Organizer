import { createServer } from "node:http";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { productSalesAnalytics } from "../shared/schema";

const mocks = vi.hoisted(() => ({
  uploads: [] as any[],
  analytics: [] as any[],
  locks: [] as unknown[],
  access: vi.fn(async (req: any, branch: string) => req.currentUser?.role === "admin" || branch === "branch-a"),
  storage: {
    getAllSalesDataUploads: vi.fn(),
    getSalesDataUpload: vi.fn(),
    getProductSalesAnalytics: vi.fn(),
    getAllProducts: vi.fn(),
  },
}));

const canonical = (value: any): string =>
  JSON.stringify(value, (_key, entry) =>
    entry && !Array.isArray(entry) && typeof entry === "object"
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry
  );

vi.mock("../server/storage", () => ({ storage: mocks.storage }));
vi.mock("../server/auth", () => {
  const pass = () => (_req: any, _res: any, next: () => void) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: pass(),
    requirePermission: pass,
    requireAnyPermission: pass,
    requireRole: pass,
    requireBranchAccess: pass,
    canAccessBranch: mocks.access,
    isUserAdmin: (req: any) => req.currentUser?.role === "admin",
    getAllowedBranchIds: () => ["branch-a"],
    getActiveBranchFilter: () => "branch-a",
    getEffectiveBranchFilter: () => ({ hasAccess: true, singleBranchId: "branch-a", branchIds: ["branch-a"] }),
    invalidateAuthCache: vi.fn(),
    hasCrossBranchHrReadAccess: () => false,
    HR_MANAGER_MODULES: new Set(),
    HR_SPECIALIST_PERMISSIONS: {},
    FINANCIAL_MANAGER_PERMISSIONS: {},
    OPERATIONS_MANAGER_PERMISSIONS: {},
    BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS: {},
  };
});

vi.mock("../server/db", () => ({
  db: {
    transaction: async (fn: (tx: any) => Promise<any>) => {
      const dialect = new PgDialect();
      const tx = {
        execute: async (statement: any) => { mocks.locks.push(dialect.sqlToQuery(statement)); },
        select: () => ({
          from: () => ({
            where: (condition: any) => ({
              orderBy: () => ({
                limit: async () => {
                  const { params } = dialect.sqlToQuery(condition);
                  const [branchId, periodStart, periodEnd, , rows] = params;
                  return mocks.uploads.filter(upload =>
                    upload.branchId === branchId &&
                    upload.periodStart === (periodStart ?? null) &&
                    upload.periodEnd === (periodEnd ?? null) &&
                    upload.status === "completed" &&
                    canonical(upload.parsedData) === canonical(JSON.parse(rows as string))
                  ).slice(0, 1);
                },
              }),
            }),
          }),
        }),
        insert: (table: any) => ({
          values: (value: any) => ({
            returning: async () => {
              const upload = { id: mocks.uploads.length + 1, ...value };
              mocks.uploads.push(upload);
              return [upload];
            },
            then: (resolve: (value: any) => void) => {
              if (table !== productSalesAnalytics) throw new Error("Unexpected insertion");
              mocks.analytics.push(...value);
              resolve([]);
            },
          }),
        }),
      };
      return fn(tx);
    },
  },
  pool: {},
}));

const routes: Array<{ method: string; path: string; handlers: any[] }> = [];
function captureApp() {
  const app: any = {};
  for (const method of ["get", "post", "put", "patch", "delete", "options"]) {
    app[method] = (path: string, ...handlers: any[]) => {
      routes.push({ method, path, handlers });
      return app;
    };
  }
  app.use = () => app;
  return app;
}

async function invoke(method: string, path: string, body: any = {}, params: any = {}, role = "branch_manager") {
  const route = routes.find(entry => entry.method === method && entry.path === path);
  if (!route) throw new Error(`Missing route ${method} ${path}`);
  const result = { status: 200, body: undefined as any };
  const res: any = {
    status(code: number) { result.status = code; return res; },
    json(value: any) { result.body = value; return res; },
  };
  await route.handlers.at(-1)({
    currentUser: { id: "u1", role, branchId: "branch-a" },
    user: { id: "legacy-session-id" },
    body, params, query: {},
  }, res);
  return result;
}

describe("sales upload branch scope and exact retries", () => {
  beforeAll(async () => {
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 90_000);
  beforeEach(() => {
    mocks.uploads.length = 0;
    mocks.analytics.length = 0;
    mocks.locks.length = 0;
    vi.clearAllMocks();
    mocks.storage.getAllProducts.mockResolvedValue([]);
    mocks.storage.getAllSalesDataUploads.mockImplementation(async () => mocks.uploads);
  });

  it("filters the list and rejects cross-branch create and analytics", async () => {
    mocks.uploads.push({ id: 1, branchId: "branch-a" }, { id: 2, branchId: "branch-b" });
    expect((await invoke("get", "/api/sales-data-uploads")).body.map((u: any) => u.id)).toEqual([1]);
    expect((await invoke("get", "/api/sales-data-uploads", {}, {}, "admin")).body).toHaveLength(2);
    const payload = { branchId: "branch-b", fileName: "same.xlsx", fileData: "[]" };
    expect((await invoke("post", "/api/sales-data-uploads", payload)).status).toBe(403);
    expect(mocks.locks).toHaveLength(0);
    mocks.storage.getSalesDataUpload.mockResolvedValue(mocks.uploads[1]);
    expect((await invoke("get", "/api/sales-data-uploads/:id/analytics", {}, { id: "2" })).status).toBe(403);
    expect(mocks.storage.getProductSalesAnalytics).not.toHaveBeenCalled();
  });

  it("returns 404 before fetching analytics if the upload does not exist", async () => {
    mocks.storage.getSalesDataUpload.mockResolvedValue(undefined);
    expect((await invoke("get", "/api/sales-data-uploads/:id/analytics", {}, { id: "35" })).status).toBe(404);
    expect(mocks.storage.getProductSalesAnalytics).not.toHaveBeenCalled();
  });

  it("rejects malformed and reversed periods before writing anything", async () => {
    for (const [start, end] of [
      ["2026-02-30", "2026-03-01"],
      ["2026-12-01", "2026-01-01"],
      ["not-a-date", "2026-03-01"],
      [null, "2026-03-01"],
    ]) {
      expect((await invoke("post", "/api/sales-data-uploads", {
        branchId: "branch-a", fileName: "sales.xlsx", fileData: "[]", periodStart: start, periodEnd: end,
      })).status).toBe(400);
    }
    expect(mocks.uploads).toHaveLength(0);
    expect(mocks.locks).toHaveLength(0);
  });

  it("returns the original upload without repeating analytics for identical rows, but keeps distinct inputs", async () => {
    const base = {
      branchId: "branch-a", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      fileName: "sales.xlsx", fileData: JSON.stringify([{ product: "Latte", quantity: 3, revenue: 30 }]),
    };
    const first = await invoke("post", "/api/sales-data-uploads", base);
    expect(first.status).toBe(201);
    expect(first.body.uploadedBy).toBe("u1");
    expect(mocks.analytics).toHaveLength(1);
    const retry = await invoke("post", "/api/sales-data-uploads", { ...base, fileName: "renamed.xlsx", fileData: JSON.stringify([{ revenue: 30, quantity: 3, product: "Latte" }]) });
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);
    expect(mocks.analytics).toHaveLength(1);
    for (const change of [
      { periodEnd: "2026-02-01" },
      { fileData: JSON.stringify([{ product: "Latte", quantity: 4, revenue: 30 }]) },
    ]) {
      expect((await invoke("post", "/api/sales-data-uploads", { ...base, ...change })).status).toBe(201);
    }
    expect(mocks.uploads).toHaveLength(3);
    expect(mocks.analytics).toHaveLength(3);
    expect(mocks.locks).toHaveLength(4);
  });

  it("does not dedupe rows reordered within the same period", async () => {
    const payload = {
      branchId: "branch-a", fileName: "sales.xlsx", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      fileData: JSON.stringify([{ product: "Latte", quantity: 3 }, { product: "Mocha", quantity: 2 }]),
    };
    const first = await invoke("post", "/api/sales-data-uploads", payload);
    const second = await invoke("post", "/api/sales-data-uploads", {
      ...payload, fileData: JSON.stringify([{ product: "Mocha", quantity: 2 }, { product: "Latte", quantity: 3 }]),
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).not.toBe(second.body.id);
  });

  it("keeps an identical import in another authorized branch separate", async () => {
    const payload = {
      branchId: "branch-a", fileName: "sales.xlsx", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      fileData: JSON.stringify([{ product: "Latte", quantity: 3, revenue: 30 }]),
    };
    const first = await invoke("post", "/api/sales-data-uploads", payload, {}, "admin");
    const second = await invoke("post", "/api/sales-data-uploads", { ...payload, branchId: "branch-b" }, {}, "admin");
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(mocks.analytics).toHaveLength(2);
  });
});