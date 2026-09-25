import { createServer } from "node:http";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InactiveBranchStockReferenceError } from "../server/catalogue-branch-stock";

const mocks = vi.hoisted(() => ({
  storage: {
    getWasteReport: vi.fn(),
    getWasteItemById: vi.fn(),
    getWasteItems: vi.fn(),
    getProduct: vi.fn(),
    getAllProducts: vi.fn(),
    getWarehouseItem: vi.fn(),
    batchReplaceWasteItems: vi.fn(),
    updateWasteItem: vi.fn(),
    updateWasteReport: vi.fn(),
    getProductionOrder: vi.fn(),
    updateProductionOrder: vi.fn(),
    getProductionOrderItemById: vi.fn(),
    getAdvancedProductionOrder: vi.fn(),
    updateProductionOrderItem: vi.fn(),
    getProductionOrderItems: vi.fn(),
    updateAdvancedProductionOrder: vi.fn(),
    getBranchProductById: vi.fn(),
    updateBranchProduct: vi.fn(),
    createPurchasingRequest: vi.fn(),
    createMaterialTransfer: vi.fn(),
    generatePurchasingRequestNumber: vi.fn(),
    getBranchProducts: vi.fn(),
    createHeldOrder: vi.fn(),
    createDisplayBarReceipt: vi.fn(),
    getDisplayBarDailySummaryById: vi.fn(),
    updateDisplayBarDailySummary: vi.fn(),
    getSalesDataUpload: vi.fn(),
    getProductSalesAnalytics: vi.fn(),
    createAdvancedProductionOrderWithItems: vi.fn(),
    getAdvancedProductionOrderWithItems: vi.fn(),
    updateBranchStock: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock("../server/storage", () => ({ storage: mocks.storage }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/auth", () => {
  const pass = () => (_req: any, _res: any, next: () => void) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: pass(),
    requirePermission: pass,
    requireAnyPermission: pass,
    requireRole: pass,
    requireBranchAccess: pass,
    canAccessBranch: async () => true,
    isUserAdmin: () => true,
    getAllowedBranchIds: async () => null,
    getActiveBranchFilter: () => null,
    getEffectiveBranchFilter: () => ({ hasAccess: true, singleBranchId: null, branchIds: null }),
    invalidateAuthCache: vi.fn(),
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

async function invoke(method: string, path: string, params: any, body: any) {
  const registration = registrations.find((item) => item.method === method && item.path === path);
  if (!registration) throw new Error(`Route was not registered: ${method} ${path}`);
  const response = { statusCode: 200, body: undefined as any };
  const res: any = {
    status(code: number) { response.statusCode = code; return res; },
    json(body: any) { response.body = body; return res; },
    send(body: any) { response.body = body; return res; },
  };
  await registration.handlers.at(-1)!({
    currentUser: { id: "test-admin", role: "admin", username: "admin" },
    body,
    params,
    query: {},
    get: () => undefined,
  }, res);
  return response;
}

const inactiveProduct = { id: 91, name: "Archived item", isActive: "false", category: "dessert" };
const inactiveWarehouseItem = { id: 77, name: "Archived material", isActive: false, category: "supplies", unit: "kg" };

describe("catalog reference write route boundaries", () => {
  beforeAll(async () => {
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 90_000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects inactive products before a waste batch replacement mutates storage", async () => {
    mocks.storage.getWasteReport.mockResolvedValue({ id: 7, branchId: "branch-a", status: "draft" });
    mocks.storage.getProduct.mockResolvedValue(inactiveProduct);

    const result = await invoke("put", "/api/waste-reports/:reportId/items/batch", { reportId: "7" }, {
      items: [{ productId: 91, quantity: 1, wasteReason: "expired" }],
    });

    expect(result.statusCode).toBe(400);
    expect(mocks.storage.batchReplaceWasteItems).not.toHaveBeenCalled();
  });

  it("allows a non-reference edit of a historical inactive waste item", async () => {
    mocks.storage.getWasteItemById.mockResolvedValue({ id: 8, wasteReportId: 7, productId: 91 });
    mocks.storage.getWasteReport.mockResolvedValue({ id: 7, branchId: "branch-a", status: "draft" });
    mocks.storage.updateWasteItem.mockResolvedValue({ id: 8, wasteReportId: 7, productId: 91, quantity: 2 });
    mocks.storage.getWasteItems.mockResolvedValue([{ quantity: 2, totalValue: 0 }]);

    const result = await invoke("patch", "/api/waste-items/:id", { id: "8" }, { quantity: 2 });

    expect(result.statusCode).toBe(200);
    expect(mocks.storage.updateWasteItem).toHaveBeenCalledWith(8, { quantity: 2 });
    expect(mocks.storage.getProduct).not.toHaveBeenCalled();
  });

  it("rejects an inactive product when replacing a waste or production-item reference", async () => {
    mocks.storage.getWasteItemById.mockResolvedValue({ id: 8, wasteReportId: 7, productId: 90 });
    mocks.storage.getWasteReport.mockResolvedValue({ id: 7, branchId: "branch-a", status: "draft" });
    mocks.storage.getProduct.mockResolvedValue(inactiveProduct);

    const wasteResult = await invoke("patch", "/api/waste-items/:id", { id: "8" }, { productId: 91 });

    mocks.storage.getProductionOrderItemById.mockResolvedValue({ id: 4, orderId: 3, productId: 90 });
    mocks.storage.getAdvancedProductionOrder.mockResolvedValue({ id: 3, sourceBranchId: "branch-a", targetBranchId: "branch-a" });
    const productionResult = await invoke("patch", "/api/production-order-items/:id", { id: "4" }, { productId: 91 });

    expect(wasteResult.statusCode).toBe(400);
    expect(productionResult.statusCode).toBe(400);
    expect(mocks.storage.updateWasteItem).not.toHaveBeenCalledWith(8, expect.anything());
    expect(mocks.storage.updateProductionOrderItem).not.toHaveBeenCalled();
  });

  it("rejects an inactive product when updating a standard production order reference", async () => {
    mocks.storage.getProductionOrder.mockResolvedValue({ id: 2, branchId: "branch-a", productId: 90 });
    mocks.storage.getProduct.mockResolvedValue(inactiveProduct);

    const result = await invoke("patch", "/api/production-orders/:id", { id: "2" }, { productId: 91 });

    expect(result.statusCode).toBe(400);
    expect(mocks.storage.updateProductionOrder).not.toHaveBeenCalled();
  });

  it("rejects an inactive product when replacing an Event POS product link", async () => {
    mocks.storage.getBranchProductById.mockResolvedValue({ id: 5, branchId: "branch-a", productId: 90 });
    mocks.storage.getProduct.mockResolvedValue(inactiveProduct);

    const result = await invoke("patch", "/api/pos/branch-products/:id", { id: "5" }, { productId: 91 });

    expect(result.statusCode).toBe(400);
    expect(mocks.storage.updateBranchProduct).not.toHaveBeenCalled();
  });

  it("rejects inactive warehouse items at purchasing and transfer creation boundaries", async () => {
    mocks.storage.getWarehouseItem.mockResolvedValue(inactiveWarehouseItem);

    const purchasingResult = await invoke("post", "/api/purchasing/requests", {}, {
      branchId: "branch-a",
      items: [{ itemId: 77, itemName: "client value", quantityRequested: 1, unit: "kg" }],
    });
    const transferResult = await invoke("post", "/api/warehouse/material-transfers", {}, {
      sourceBranchId: "branch-a",
      destinationBranchId: "branch-b",
      items: [{ itemId: 77, quantity: 1 }],
    });

    expect(purchasingResult.statusCode).toBe(400);
    expect(transferResult.statusCode).toBe(400);
    expect(mocks.storage.createPurchasingRequest).not.toHaveBeenCalled();
    expect(mocks.storage.createMaterialTransfer).not.toHaveBeenCalled();
  });

  it("rejects an inactive product embedded in a newly held POS order", async () => {
    mocks.storage.getBranchProducts.mockResolvedValue([{
      productId: 91,
      isActive: true,
      priceOverride: null,
      product: { ...inactiveProduct, basePrice: 12 },
    }]);

    const result = await invoke("post", "/api/pos/held-orders", {}, {
      branchId: "branch-a",
      cartData: JSON.stringify([{ productId: 91, quantity: 1 }]),
    });

    expect(result.statusCode).toBe(400);
    expect(mocks.storage.createHeldOrder).not.toHaveBeenCalled();
  });

  it("rejects operational-only finished goods even with a branch price override", async () => {
    mocks.storage.getBranchProducts.mockResolvedValue([{
      productId: 92,
      isActive: true,
      priceOverride: 20,
      product: { id: 92, name: "Pending price", isActive: "false", operationsEnabled: true, saleEnabled: false, basePrice: null },
    }]);
    const held = await invoke("post", "/api/pos/held-orders", {}, {
      branchId: "branch-a",
      cartData: JSON.stringify([{ productId: 92, quantity: 1 }]),
    });
    expect(held.statusCode).toBe(400);
    expect(mocks.storage.createHeldOrder).not.toHaveBeenCalled();
    const sale = await invoke("post", "/api/pos/sales", {}, {
      branchId: "branch-a",
      items: [{ productId: 92, quantity: 1 }],
    });
    expect(sale.statusCode).toBe(400);
  });

  it("rejects inactive display-bar receipt and summary product replacements", async () => {
    mocks.storage.getProduct.mockResolvedValue(inactiveProduct);
    const receiptResult = await invoke("post", "/api/display-bar/receipts", {}, {
      branchId: "branch-a",
      productId: 91,
      receiptDate: "2026-01-01",
      receiptTime: "10:00",
      quantity: 1,
    });

    mocks.storage.getDisplayBarDailySummaryById.mockResolvedValue({
      id: 6, branchId: "branch-a", productId: 90,
    });
    const summaryResult = await invoke("patch", "/api/display-bar/summary/:id", { id: "6" }, {
      productId: 91,
    });

    expect(receiptResult.statusCode).toBe(400);
    expect(summaryResult.statusCode).toBe(400);
    expect(mocks.storage.createDisplayBarReceipt).not.toHaveBeenCalled();
    expect(mocks.storage.updateDisplayBarDailySummary).not.toHaveBeenCalled();
  });

  it("filters inactive products before forecast fuzzy matching and writes the active match", async () => {
    mocks.storage.getSalesDataUpload.mockResolvedValue({
      id: 3, status: "completed", fileName: "sales.xlsx",
    });
    mocks.storage.getProductSalesAnalytics.mockResolvedValue([{
      productId: 91,
      productName: "Croissant",
      productCategory: "مخبوزات",
      totalQuantitySold: 10,
      totalRevenue: 100,
      averageDailySales: 2,
    }]);
    mocks.storage.getAllProducts.mockResolvedValue([
      inactiveProduct,
      { id: 92, name: "Croissant", isActive: "true", category: "مخبوزات", basePrice: 10 },
    ]);
    mocks.storage.createAdvancedProductionOrderWithItems.mockResolvedValue({
      order: { id: 40 },
      items: [{ id: 1 }],
    });
    mocks.storage.getAdvancedProductionOrderWithItems.mockResolvedValue({ order: { id: 40 }, items: [{ id: 1 }] });

    const result = await invoke("post", "/api/sales-data-uploads/:id/generate-forecast", { id: "3" }, {
      branchId: "branch-a",
      targetSales: 100,
      planDate: "2026-01-01",
    });

    expect(result.statusCode).toBe(201);
    expect(mocks.storage.createAdvancedProductionOrderWithItems).toHaveBeenCalledWith(
      expect.any(Object),
      [expect.objectContaining({ productId: 92, productName: "Croissant" })],
    );
  });

  it("maps the atomic inactive branch-stock rejection to its explicit HTTP error", async () => {
    mocks.storage.updateBranchStock.mockRejectedValue(new InactiveBranchStockReferenceError());

    const result = await invoke("put", "/api/warehouse/branch-stock/:branchId/:itemId", {
      branchId: "branch-a",
      itemId: "77",
    }, { quantity: 1 });

    expect(result.statusCode).toBe(400);
    expect(result.body.error).toBe("لا يمكن إنشاء مخزون فرع لصنف مستودع غير متاح");
  });
});