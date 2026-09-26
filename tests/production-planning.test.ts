import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { CentralKitchenWorkplan } from "../shared/central-kitchen-workplan";

vi.mock("../server/db", () => ({ db: {} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, res: any, next: () => void) =>
    req.user ? next() : res.status(401).json({ error: "login required" }),
  requirePermission: (module: string, action: string) => (req: any, res: any, next: () => void) =>
    req.user?.permissions?.includes(`${module}:${action}`) ? next() : res.status(403).json({ error: "permission denied" }),
  canAccessBranch: (req: any, branchId: string) => Promise.resolve(req.user?.branchIds?.includes(branchId) || false),
}));
const workplan = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../server/central-kitchen-workplan", () => ({ getCentralKitchenWorkplan: workplan.get }));

import { registerProductionPlanningRoute, getProductionPlanning } from "../server/production-planning";

const central: CentralKitchenWorkplan = {
  kitchen: { id: "kitchen", name: "Kitchen" }, date: "2035-06-10", generatedAt: "2035-06-10T00:00:00Z",
  orders: [{
    id: 10, orderNumber: "REQ-10", orderDate: "2035-06-09", neededDate: "2035-06-10",
    cohort: "date", source: { requestingBranch: { id: "requester", name: "Requester" }, kitchen: { id: "kitchen", name: "Kitchen" } },
    rawStatus: "approved", inventoryMode: "shadow", discrepancyStatus: "none",
    nextStep: {} as any, finished: false, directOrderLink: "/api/central-kitchen-orders/10",
    items: [{
      id: 100, productId: 9, warehouseItemId: null, productName: "Bread", unit: "قطعة",
      requestedQuantity: 5, preparedQuantity: 4, preparedFromStock: 4, preparedFromProduction: 0,
      preparationSourceStatus: "recorded", productionFulfillmentEvidence: null,
      dispatchedQuantity: null, receivedQuantity: null, damagedQuantity: null, missingQuantity: null,
      catalogMapping: "product", approvedRecipe: true, approvedRecipeNote: null,
    }],
    linkedBatches: { count: 0, refs: [], byUnitAndStatus: [], recipeEvidence: { recipeBacked: 0, legacy: 0, unknown: 0 },
      materialPosting: { consumed: 0, pending: 0, unknown: 0 }, batches: [] },
    readiness: { status: "unknown", reason: "allocated_stock_not_evaluated" }, exceptions: [],
  }],
  overdueEarlierOrders: [], summary: {} as any,
  metadata: { dateCohort: { truncated: false }, overdueEarlier: { truncated: false, lookbackDays: 365 } } as any,
};

const plan = (id: number, cohort: string, itemId: number, overrides: Record<string, unknown> = {}) => ({
  id, order_number: `PLAN-${id}`, status: "approved", start_date: "2035-06-08", end_date: "2035-06-12",
  source_branch_id: "kitchen", source_name: "Kitchen", cohort, item_id: itemId,
  product_id: 9, product_name: "Bread", target_quantity: 10, execution_unit: "قطعة",
  mapped_product_id: 9, product_unit: "قطعة", product_type: "finish", is_active: "true", operations_enabled: false,
  approved_recipe: true, finished_quantity: "2", progress_quantity: "1", linked_count: "2",
  identity_mismatch: false, ...overrides,
});
const queryText = (query: any): string => query.queryChunks?.map((part: any) =>
  typeof part === "string" ? part : part.value ? part.value.join("") : queryText(part)).join("") || "";

function setup(rows: any[] = [plan(1, "date", 1), plan(1, "date", 2), plan(2, "overdue", 3)],
  now = "2035-06-10T08:00:00Z") {
  const statements: string[] = [];
  const tx = { execute: vi.fn(async (query: any) => {
    const text = queryText(query);
    statements.push(text);
    if (text.includes("SELECT mode FROM central_kitchen_runtime")) return { rows: [{ mode: "paused" }] };
    if (text.includes("SELECT id, unit, product_type, is_active, operations_enabled FROM products")) return {
      rows: [{ id: 9, unit: "قطعة", product_type: "finish", is_active: "true", operations_enabled: false }],
    };
    if (text.includes("SELECT a.id, a.order_number")) return { rows };
    if (text.includes("AS date_count")) return { rows: [{ date_count: 2, overdue_count: 1 }] };
    if (text.includes("FROM central_kitchen_orders o JOIN central_kitchen_order_items i")) return { rows: [] };
    if (text.includes("FROM daily_production_batches b")) return { rows: [] };
    if (text.includes("FROM finished_goods_inventory WHERE branch_id")) return { rows: [] };
    if (text.includes("FROM central_kitchen_inventory_allocations a")) return { rows: [] };
    if (text.includes("SELECT 'product' AS kind")) return { rows: [] };
    throw Error(`Unexpected SELECT: ${text}`);
  }) };
  const database = { transaction: vi.fn(async (cb: any) => cb(tx)) };
  workplan.get.mockResolvedValue(central);
  const route: { handlers?: any[] } = {};
  registerProductionPlanningRoute({ get: (_path: string, ...handlers: any[]) => { route.handlers = handlers; } } as any, {
    database, now: () => new Date(now),
  });
  async function request(user: any, query: any = { kitchenId: "kitchen", date: "2035-06-10" }) {
    const req = { user, query };
    let code = 200, body: any;
    const res = { status: (status: number) => { code = status; return res; },
      json: (value: any) => { body = value; return res; }, set: () => res };
    const handlers = route.handlers!;
    const dispatch = async (index: number): Promise<void> => {
      if (index < handlers.length) await handlers[index](req, res, () => dispatch(index + 1));
    };
    await dispatch(0);
    return { code, body };
  }
  return { request, statements, database };
}

describe("unified production planning read boundary", () => {
  const viewer = { permissions: ["production:view"], branchIds: ["kitchen"] };
  it("rejects unauthenticated, unauthorized, branch IDOR, and invalid dates without querying", async () => {
    const { request, database } = setup();
    expect((await request(null)).code).toBe(401);
    expect((await request({ permissions: [], branchIds: ["kitchen"] })).code).toBe(403);
    expect((await request(viewer, { kitchenId: "other", date: "2035-06-10" })).code).toBe(403);
    expect((await request(viewer, { kitchenId: "kitchen", date: "2035-02-30" })).code).toBe(400);
    expect((await request(viewer, { kitchenId: "kitchen", date: ["2035-06-10"] })).code).toBe(400);
    expect(database.transaction).not.toHaveBeenCalled();
  });
  it("keeps overlapping plans unique, source counts separate and unknown request completion null", async () => {
    const { request, statements } = setup();
    const { code, body } = await request(viewer);
    expect(code).toBe(200);
    expect(body.rows.map((row: any) => row.key)).toEqual(["central_request:10", "advanced_plan:1", "advanced_plan:2"]);
    expect(body.rows.map((row: any) => row.inventoryMode)).toEqual(["shadow", null, null]);
    expect(body.rows[0].items[0]).toMatchObject({ plannedQuantity: 5, completedQuantity: null, remainingQuantity: null });
    expect(body.rows[1].items).toHaveLength(2);
    expect(body.rows[1].items[0]).toMatchObject({ completedQuantity: 2, inProgressQuantity: 1, remainingQuantity: 7 });
    expect(body.summary.bySource).toEqual({ central_request: { date: 1, overdue: 0 }, advanced_plan: { date: 1, overdue: 1 } });
    expect(body.checks.find((check: any) => check.id === "opening_balances").status).toBe("unknown");
    expect(body.checks.find((check: any) => check.id === "sales_source_role_approvals").status).toBe("unknown");
    expect(body.metadata.configuration.inventoryMode).toBe("paused");
    expect(body.metadata.allocationReadiness).toBe("unknown");
    expect(statements.every(statement => /^\s*(WITH|SELECT)/i.test(statement))).toBe(true);
    expect(statements.join(" ")).toContain("source_branch_id");
    expect(statements.join(" ")).toContain("end_date <");
    expect(statements.join(" ")).toContain("b.advanced_production_order_item_id = i.id");
    expect(statements.join(" ")).toContain("i.execution_unit");
    expect(statements.join(" ")).toContain("p.operations_enabled");
  });
  it("does not certify inactive mapped products or infer completion without identity evidence", async () => {
    const { request } = setup([plan(1, "date", 1, {
      is_active: "false", execution_unit: null, finished_quantity: "5", status: "draft",
    })]);
    const { body } = await request(viewer);
    expect(body.rows[1].status).toBe("draft");
    expect(body.rows[1].items[0]).toMatchObject({
      catalogMapping: "inactive_product", completedQuantity: null, remainingQuantity: null,
    });
    expect(body.checks.find((check: any) => check.id === "product_references_units").status).toBe("warning");
  });
  it("accepts operations-enabled catalog identity even if legacy POS activity is false", async () => {
    const { request } = setup([plan(1, "date", 1, { is_active: "false", operations_enabled: true })]);
    const { body } = await request(viewer);
    expect(body.rows[1].items[0]).toMatchObject({
      catalogMapping: "product", completedQuantity: 2, remainingQuantity: 7,
    });
  });
  it("does not convert uncovered historical plans to completed zero", async () => {
    const { request } = setup([plan(1, "date", 1, {
      execution_unit: "قطعة", linked_count: "0", finished_quantity: "0", progress_quantity: "0",
    })]);
    const { body } = await request(viewer);
    expect(body.rows[1].items[0]).toMatchObject({
      completedQuantity: null, inProgressQuantity: null, remainingQuantity: null,
    });
    expect(body.checks.find((check: any) => check.id === "product_references_units").status).toBe("warning");
  });
  it("clamps overproduction rather than reporting negative remaining", async () => {
    const { request } = setup([plan(1, "date", 1, {
      finished_quantity: "12", progress_quantity: "2", linked_count: "2",
    })]);
    const { body } = await request(viewer);
    expect(body.rows[1].items[0]).toMatchObject({
      completedQuantity: 12, inProgressQuantity: 2, remainingQuantity: 0,
    });
    expect(body.rows[1].items[0].issues).toContain("linked_production_exceeds_plan");
  });
  it("does not pass catalog and recipe coverage checks when no items are displayed", async () => {
    const { request } = setup([]);
    workplan.get.mockResolvedValueOnce({ ...central, orders: [] });
    const { body } = await request(viewer);
    expect(body.rows).toEqual([]);
    expect(body.checks.find((check: any) => check.id === "product_references_units").status).toBe("unknown");
    expect(body.checks.find((check: any) => check.id === "recipe_evidence").status).toBe("unknown");
  });
  it("preserves frozen per-request modes even when current runtime mode differs", async () => {
    const { request } = setup([]);
    workplan.get.mockResolvedValueOnce({
      ...central, orders: [{ ...central.orders[0], inventoryMode: "real" }],
      overdueEarlierOrders: [{ ...central.orders[0], id: 11, inventoryMode: "unknown",
        cohort: "overdue", neededDate: "2035-06-01" }],
    });
    const { body } = await request(viewer);
    expect(body.rows.map((row: any) => row.inventoryMode)).toEqual(["real", "unknown"]);
    expect(body.metadata.configuration.inventoryMode).toBe("paused");
  });
  it("cross-checks physical SQL fields and text dates against additive schema migrations", () => {
    const base = readFileSync("migrations/0000_add_indexes.sql", "utf8");
    const additive = readFileSync("migrations/advanced_production_explicit_execution.sql", "utf8");
    const schema = readFileSync("shared/schema.ts", "utf8");
    expect(base).toMatch(/CREATE TABLE "advanced_production_orders"[\s\S]*?"start_date" text NOT NULL,[\s\S]*?"end_date" text NOT NULL/);
    expect(base).toMatch(/CREATE TABLE "production_order_items"[\s\S]*?"target_quantity" integer NOT NULL/);
    expect(additive).toContain("ALTER TABLE production_order_items ADD COLUMN IF NOT EXISTS execution_unit text");
    expect(additive).toContain("ADD COLUMN IF NOT EXISTS advanced_production_order_item_id integer");
    expect(schema).toContain('advancedProductionOrderItemId: integer("advanced_production_order_item_id")');
    expect(schema).toContain('operationsEnabled: boolean("operations_enabled")');
  });
  it("excludes earlier future requests from the overdue cohort and reports truncation", async () => {
    const earlier = { ...central.orders[0], id: 11, orderNumber: "REQ-11",
      neededDate: "2035-06-09", cohort: "overdue" as const, items: [] };
    const { request } = setup([], "2035-06-08T08:00:00Z");
    workplan.get.mockResolvedValueOnce({ ...central, overdueEarlierOrders: [earlier],
      metadata: { ...central.metadata, dateCohort: { truncated: true },
        overdueEarlier: { truncated: false, lookbackDays: 365 } } });
    const { body } = await request({ permissions: ["production:view"], branchIds: ["kitchen"] },
      { kitchenId: "kitchen", date: "2035-06-10" });
    expect(body.rows.some((row: any) => row.key === "central_request:11")).toBe(false);
    expect(body.summary.bySource.central_request.overdue).toBe(0);
    expect(body.metadata.truncated).toBe(true);
  });
  it("validates direct builder calls before opening a read transaction", async () => {
    const { database } = setup();
    await expect(getProductionPlanning({} as any, "kitchen", "2035-13-01",
      { database, canAccessBranch: async () => true })).rejects.toThrow("تاريخ");
    expect(database.transaction).not.toHaveBeenCalled();
  });
});