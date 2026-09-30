import { createServer } from "node:http";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { comparisonUploads, dailySalesData, dailyProductionBatches, dailyComparisons, products, productSalesAnalytics } from "../shared/schema";
import XLSX from "xlsx";
import { comparisonSalesFingerprint, comparisonSalesMetadata } from "../server/comparison-sales-parser";

const mocks = vi.hoisted(() => ({
  uploads: [] as any[],
  analytics: [] as any[],
  comparisonUploads: [] as any[],
  dailySales: [] as any[],
  batches: [] as any[],
  catalog: [] as any[],
  comparisons: [] as any[],
  comparisonQueries: [] as Array<{ table: string; sql: string; params: unknown[] }>,
  comparisonDeletes: [] as Array<{ sql: string; params: unknown[] }>,
  comparisonInserts: [] as any[],
  locks: [] as unknown[],
  queue: Promise.resolve(),
  access: vi.fn(async (req: any, branch: string) => req.currentUser?.role === "admin" || branch === "branch-a"),
  storage: {
    getAllSalesDataUploads: vi.fn(),
    getSalesDataUpload: vi.fn(),
    getProductSalesAnalytics: vi.fn(),
    getAllProducts: vi.fn(),
  },
}));

vi.mock("../server/storage", () => ({ storage: mocks.storage }));
vi.mock("multer", () => {
  const multer = Object.assign(
    () => ({ single: () => (req: any, _res: any, next: (err?: Error) => void) => {
      req.file = req.body.file;
      next();
    } }),
    { memoryStorage: () => ({}) },
  );
  return { default: multer };
});
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
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      const allowed = req.currentUser?.role === "admin" ? ["branch-a", "branch-b", "branch-c"] : ["branch-a", "branch-b"];
      if (requested && requested !== "all" && !allowed.includes(requested)) return { hasAccess: false, branchIds: [], singleBranchId: null };
      const ids = requested && requested !== "all" ? [requested] : allowed;
      return { hasAccess: true, singleBranchId: ids.length === 1 ? ids[0] : null, branchIds: ids };
    },
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
      // Simulate the advisory lock's serialization across concurrent requests.
      const previous = mocks.queue;
      let unlock!: () => void;
      mocks.queue = new Promise<void>(resolve => { unlock = resolve; });
      await previous;
      const dialect = new PgDialect();
      const tx = {
        execute: async (statement: any) => { mocks.locks.push(dialect.sqlToQuery(statement)); },
        select: () => ({
          from: (table: any) => ({
            then: (resolve: (rows: any[]) => void) => resolve(table === products ? mocks.catalog : []),
            where: (condition: any) => {
              const { sql, params } = dialect.sqlToQuery(condition);
              if (table === dailyComparisons) {
                mocks.comparisonQueries.push({ table: "comparison-lock", sql, params });
                return { for: async () => mocks.comparisons.filter(row =>
                  row.id === params[0] && params.includes(row.branchId)) };
              }
              const selected = () => {
                if (table === dailyProductionBatches || table === dailySalesData && sql.includes(" in (") ||
                    table === comparisonUploads && sql.includes(" in (")) {
                  const name = table === dailyProductionBatches ? "batches" : table === dailySalesData ? "sales" : "uploads";
                  mocks.comparisonQueries.push({ table: name, sql, params });
                  const source = table === dailyProductionBatches ? mocks.batches :
                    table === dailySalesData ? mocks.dailySales : mocks.comparisonUploads;
                  return source.filter(row => params.includes(row.branchId) &&
                    (table !== dailySalesData || params.includes(row.uploadId)) &&
                    (table !== comparisonUploads || row.status === "completed"));
                }
                if (table === comparisonUploads) {
                  const [branchId, , , periodEnd, periodStart] = params;
                  return mocks.comparisonUploads.filter(upload =>
                    upload.branchId === branchId && upload.status === "completed" &&
                    upload.periodStart <= periodEnd && upload.periodEnd >= periodStart);
                }
                if (table === dailySalesData) {
                  const [branchId, start, end] = params;
                  return mocks.dailySales.filter(row => row.branchId === branchId &&
                    row.salesDate >= start && row.salesDate <= end);
                }
                const [branchId, , periodEnd, periodStart] = params;
                return mocks.uploads.filter(upload =>
                  upload.branchId === branchId && upload.status === "completed" &&
                  upload.periodStart <= periodEnd && upload.periodEnd >= periodStart);
              };
              return { then: (resolve: (rows: any[]) => void) => resolve(selected()), limit: async () => selected().slice(0, 1) };
            },
          }),
        }),
        delete: (table: any) => ({
          where: async (condition: any) => {
            if (table !== dailyComparisons) throw new Error("Unexpected deletion");
            mocks.comparisonDeletes.push(dialect.sqlToQuery(condition));
          },
        }),
        insert: (table: any) => ({
          values: (value: any) => ({
            returning: async () => {
              const target = table === comparisonUploads ? mocks.comparisonUploads : mocks.uploads;
              const upload = { id: target.length + 1, ...value };
              target.push(upload);
              return [upload];
            },
            then: (resolve: (value: any) => void) => {
              if (table === productSalesAnalytics) mocks.analytics.push(...value);
              else if (table === dailySalesData) mocks.dailySales.push(...value);
              else if (table === dailyComparisons) mocks.comparisonInserts.push(...value);
              else throw new Error("Unexpected insertion");
              resolve([]);
            },
          }),
        }),
      };
      try { return await fn(tx); } finally { unlock(); }
    },
  },
  pool: { query: vi.fn(async () => ({ rows: [{ files: true, fields: true, nullable_driver: true, file_binding: true, constraint_ready: true }] })) },
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
  let done!: () => void;
  const completed = new Promise<void>(resolve => { done = resolve; });
  const res: any = {
    status(code: number) { result.status = code; return res; },
    json(value: any) { result.body = value; done(); return res; },
  };
  await route.handlers.at(-1)({
    currentUser: { id: "u1", role, branchId: "branch-a" },
    user: { id: "legacy-session-id" },
    body, params, query: {}, file: body.file, headers: {}, method: "GET",
  }, res);
  if (path === "/api/production-comparisons/upload-sales") await completed;
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
    mocks.comparisonUploads.length = 0;
    mocks.dailySales.length = 0;
    mocks.batches.length = 0;
    mocks.catalog.length = 0;
    mocks.comparisons.length = 0;
    mocks.comparisonQueries.length = 0;
    mocks.comparisonDeletes.length = 0;
    mocks.comparisonInserts.length = 0;
    mocks.locks.length = 0;
    mocks.queue = Promise.resolve();
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
      expect((await invoke("post", "/api/sales-data-uploads", { ...base, ...change })).status).toBe(409);
    }
    expect(mocks.uploads).toHaveLength(1);
    expect(mocks.analytics).toHaveLength(1);
    expect(mocks.locks).toHaveLength(4);
  });

  it("dedupes rows reordered within the same period", async () => {
    const payload = {
      branchId: "branch-a", fileName: "sales.xlsx", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      fileData: JSON.stringify([{ product: "Latte", quantity: 3 }, { product: "Mocha", quantity: 2 }]),
    };
    const first = await invoke("post", "/api/sales-data-uploads", payload);
    const second = await invoke("post", "/api/sales-data-uploads", {
      ...payload, fileData: JSON.stringify([{ product: "Mocha", quantity: 2 }, { product: "Latte", quantity: 3 }]),
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(first.body.id).toBe(second.body.id);
    expect(mocks.analytics).toHaveLength(2);
  });

  it("serializes concurrent retries without duplicate analytics", async () => {
    const payload = {
      branchId: "branch-a", fileName: "sales.xlsx", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      fileData: JSON.stringify([{ product: "Latte", quantity: 3 }]),
    };
    const [first, second] = await Promise.all([
      invoke("post", "/api/sales-data-uploads", payload),
      invoke("post", "/api/sales-data-uploads", payload),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(mocks.uploads).toHaveLength(1);
    expect(mocks.analytics).toHaveLength(1);
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

  const comparisonFile = (rows: Record<string, unknown>[]) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Sales");
    return { buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }), originalname: "sales.xlsx" };
  };

  it("authorizes comparison imports before parsing or writing, rejects bad rows atomically", async () => {
    const valid = { Date: "2026-02-01", "Product Name": "Latte", Quantity: 2 };
    const denied = await invoke("post", "/api/production-comparisons/upload-sales", {
      branchId: "branch-b", file: { buffer: Buffer.from("not xlsx"), originalname: "bad.xlsx" },
    });
    expect(denied.status).toBe(403);
    const invalid = await invoke("post", "/api/production-comparisons/upload-sales", {
      branchId: "branch-a", file: comparisonFile([valid, { ...valid, Date: "2026-02-30" }]),
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toContain("صف 3");
    expect(mocks.comparisonUploads).toHaveLength(0);
    expect(mocks.dailySales).toHaveLength(0);
  });

  it("reuses reordered comparison imports concurrently; refuses intersecting periods", async () => {
    mocks.storage.getAllProducts.mockResolvedValue([
      { id: 17, name: "Latte", sku: "L17", unit: "قطعة", isActive: "true" },
      { id: 18, name: "Mocha", sku: "M18", unit: "قطعة", isActive: "true" },
    ]);
    const latte = { Date: "2026-02-01", "Product Name": "Latte", Quantity: 2 };
    const mocha = { Date: "2026-02-02", "Product Name": "Mocha", Quantity: 1 };
    const [first, retry] = await Promise.all([
      invoke("post", "/api/production-comparisons/upload-sales", { branchId: "branch-a", file: comparisonFile([latte, mocha]) }),
      invoke("post", "/api/production-comparisons/upload-sales", { branchId: "branch-a", file: comparisonFile([mocha, latte]) }),
    ]);
    expect([first.status, retry.status].sort()).toEqual([200, 201]);
    expect(mocks.comparisonUploads).toHaveLength(1);
    expect(mocks.dailySales).toHaveLength(2);
    const evidence = JSON.parse(mocks.comparisonUploads[0].errorMessage.slice("sales-evidence:v1:".length));
    expect(evidence.rows.map((row: any) => [row.productId, row.unit]).sort()).toEqual([[17, "piece"], [18, "piece"]]);
    const conflict = await invoke("post", "/api/production-comparisons/upload-sales", {
      branchId: "branch-a", file: comparisonFile([{ ...latte, Quantity: 3 }]),
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("SALES_PERIOD_OVERLAP");
    expect(mocks.dailySales).toHaveLength(2);
  });

  it("rejects ambiguous and unknown product mappings and non-piece units before any writes", async () => {
    mocks.storage.getAllProducts.mockResolvedValue([
      { id: 17, name: "Latte", sku: "L17", unit: "قطعة", isActive: "true" },
      { id: 18, name: "Latte", sku: "L18", unit: "قطعة", isActive: "true" },
      { id: 19, name: "Bread", sku: "B19", unit: "كيلو", isActive: "true" },
    ]);
    const base = { Date: "2026-02-01", "Product Name": "Latte", Quantity: 2 };
    for (const row of [
      base,
      { ...base, "Product Name": "Unknown" },
      { ...base, "Product ID": 19, "Product Name": "Bread" },
      { ...base, "Product ID": 17, Unit: "kg" },
      { ...base, "Product ID": 17, SKU: "L18" },
    ]) {
      const response = await invoke("post", "/api/production-comparisons/upload-sales", {
        branchId: "branch-a", file: comparisonFile([row]),
      });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("صف 2");
    }
    expect(mocks.comparisonUploads).toHaveLength(0);
    expect(mocks.dailySales).toHaveLength(0);
    const selected = await invoke("post", "/api/production-comparisons/upload-sales", {
      branchId: "branch-a", file: comparisonFile([{ ...base, "Product ID": 17, Unit: "pcs" }]),
    });
    expect(selected.status).toBe(201);
    expect(JSON.parse(mocks.comparisonUploads[0].errorMessage.slice("sales-evidence:v1:".length)).rows[0].productId).toBe(17);
  });

  it("RUN scopes production, uploads, sales, deletion and insertion to every allowed branch, never C", async () => {
    const day = "2026-02-01";
    mocks.catalog.push({ id: 17, name: "Bread", sku: "B17", unit: "قطعة", category: "bread" });
    for (const [index, branchId] of ["branch-a", "branch-b", "branch-c"].entries()) {
      const row = { salesDate: day, productName: "Bread", productCategory: null,
        quantitySold: 2, salesValue: 10, sourceProductId: 17, sourceSku: null,
        sourceUnit: "قطعة", sourceLine: 2, productId: 17, unit: "piece" as const, catalogUnit: "قطعة" };
      mocks.comparisonUploads.push({ id: index + 1, branchId, status: "completed",
        periodStart: day, periodEnd: day, errorMessage: comparisonSalesMetadata(comparisonSalesFingerprint([row]), [row]) });
      mocks.dailySales.push({ id: index + 1, uploadId: index + 1, branchId, salesDate: day,
        productName: "Bread", productCategory: null, quantitySold: 2, salesValue: 10 });
      mocks.batches.push({ id: index + 1, branchId, productionDate: day, productId: 17,
        productName: "Bread", productCategory: "bread", unit: "قطعة", quantity: 4 });
    }
    const result = await invoke("post", "/api/production-comparisons/run", { startDate: day, endDate: day });
    expect(result.status).toBe(200);
    expect(result.body.comparisonsCreated).toBe(2);
    expect(mocks.comparisonQueries.map(q => q.table).sort()).toEqual(["batches", "sales", "uploads"]);
    for (const query of mocks.comparisonQueries) {
      expect(query.sql).toContain("branch_id");
      expect(query.params).toEqual(expect.arrayContaining(["branch-a", "branch-b"]));
      expect(query.params).not.toContain("branch-c");
    }
    expect(mocks.comparisonDeletes).toHaveLength(1);
    expect(mocks.comparisonDeletes[0].sql).toContain("branch_id");
    expect(mocks.comparisonDeletes[0].sql).toContain("status_reason");
    expect(mocks.comparisonDeletes[0].params).toEqual(expect.arrayContaining(["branch-a", "branch-b", day]));
    expect(mocks.comparisonDeletes[0].params).not.toContain("branch-c");
    expect(mocks.comparisonInserts.map(row => row.branchId).sort()).toEqual(["branch-a", "branch-b"]);
    expect(mocks.locks.map((lock: any) => lock.params[0])).toEqual(["branch-a", "branch-b"]);
  });

  it("RUN denies unpermitted branch before source queries and leaves rows intact if evidence cannot compare", async () => {
    const day = "2026-02-01";
    const denied = await invoke("post", "/api/production-comparisons/run", { branchId: "branch-c", startDate: day, endDate: day });
    expect(denied.status).toBe(403);
    expect(mocks.comparisonQueries).toHaveLength(0);
    expect(mocks.locks).toHaveLength(0);
    mocks.comparisonUploads.push({ id: 4, branchId: "branch-a", status: "completed", periodStart: day, periodEnd: day,
      errorMessage: "sha256:legacy-without-mapping" });
    mocks.dailySales.push({ id: 1, branchId: "branch-a", uploadId: 4, salesDate: day,
      productName: "Bread", productCategory: null, quantitySold: 1, salesValue: 5 });
    mocks.batches.push({ id: 1, branchId: "branch-a", productionDate: day, productId: 17,
      productName: "Bread", productCategory: "bread", unit: "قطعة", quantity: 2 });
    mocks.catalog.push({ id: 17, name: "Bread", sku: null, unit: "قطعة", category: "bread" });
    const unavailable = await invoke("post", "/api/production-comparisons/run", { startDate: day, endDate: day });
    expect(unavailable.status).toBe(409);
    expect(unavailable.body.code).toBe("COMPARISON_EVIDENCE_UNAVAILABLE");
    expect(mocks.comparisonDeletes).toHaveLength(0);
    expect(mocks.comparisonInserts).toHaveLength(0);
  });

  it("refuses client-supplied comparison provenance before status write", async () => {
    const reserved = '{"type":"canonical-comparison-v2","productId":17}';
    const result = await invoke("patch", "/api/production-comparisons/:id/status",
      { status: "waste", reason: reserved }, { id: "2" });
    expect(result.status).toBe(400);
    expect(mocks.comparisonDeletes).toHaveLength(0);
    expect(mocks.comparisonInserts).toHaveLength(0);
  });

  it("locks canonical rows in the authorized scope and refuses status mutation", async () => {
    mocks.comparisons.push({ id: 8, branchId: "branch-a",
      statusReason: '{"type":"canonical-comparison-v2","productId":17}', status: "variance" });
    const result = await invoke("patch", "/api/production-comparisons/:id/status",
      { status: "waste", reason: "manual" }, { id: "8" });
    expect(result.status).toBe(409);
    expect(mocks.comparisonQueries).toHaveLength(1);
    expect(mocks.comparisonQueries[0].table).toBe("comparison-lock");
    expect(mocks.comparisonQueries[0].params).toEqual(expect.arrayContaining([8, "branch-a", "branch-b"]));
    expect(mocks.comparisonQueries[0].params).not.toContain("branch-c");
    expect(mocks.comparisonInserts).toHaveLength(0);
  });
});