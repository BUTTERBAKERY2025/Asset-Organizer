import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { canAccessBranch, isAuthenticated, requirePermission } from "./auth";
import { getCentralKitchenWorkplan, type WorkplanSqlExecutor, type CentralKitchenWorkplanDatabase } from "./central-kitchen-workplan";
import { productionPlanningQuerySchema, PRODUCTION_PLANNING_ROW_LIMIT, PRODUCTION_PLANNING_OVERDUE_LOOKBACK_DAYS,
  type ProductionPlanningResponse, type ProductionPlanningRow, type ProductionPlanningItem, type ProductionPlanningCheck } from "@shared/production-planning";
import type { CentralKitchenWorkplanOrder } from "@shared/central-kitchen-workplan";
import { isNewCatalogReferenceAllowed } from "@shared/catalog-activity";
import { getProductionCoverage } from "./production-coverage";
import type { ProductionItemCoverage } from "@shared/production-coverage";

type SqlDatabase = CentralKitchenWorkplanDatabase;
type Dependencies = {
  database?: SqlDatabase;
  canAccessBranch?: (req: Request, kitchenId: string) => Promise<boolean>;
  now?: () => Date;
};
class PlanningError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const record = (value: unknown) => (value || {}) as Record<string, unknown>;
const numeric = (value: unknown) => Number(value);
const label = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
const riyadhDate = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

function centralRow(order: CentralKitchenWorkplanOrder): ProductionPlanningRow {
  const items: ProductionPlanningItem[] = order.items.map(item => {
    const batches = order.linkedBatches.batches.filter(batch => batch.orderItemId === item.id);
    const comparable = item.productId !== null && item.catalogMapping === "product" && batches.length > 0
      && batches.every(batch => batch.unit === item.unit && batch.productId === item.productId);
    const issues = [
      ...(item.catalogMapping === "none" || item.catalogMapping === "ambiguous" ? ["catalog_mapping_unverified"] : []),
      ...(item.approvedRecipe === false ? ["current_approved_recipe_unavailable_informational"] : []),
      ...(!comparable ? ["production_completion_unavailable_without_comparable_explicit_batch_link"] : []),
    ];
    return {
      id: item.id, productName: item.productName, productId: item.productId, unit: item.unit,
      plannedQuantity: item.requestedQuantity,
      completedQuantity: comparable ? batches.filter(b => b.finished).reduce((sum, b) => sum + b.quantity, 0) : null,
      inProgressQuantity: comparable ? batches.filter(b => b.status === "in_progress").reduce((sum, b) => sum + b.quantity, 0) : null,
      // A request can be fulfilled from existing stock: linked production is not the request's completed quantity.
      remainingQuantity: null, issues, catalogMapping: item.catalogMapping, approvedRecipe: item.approvedRecipe,
    };
  });
  return {
    key: `central_request:${order.id}`, source: "central_request", id: order.id,
    inventoryMode: order.inventoryMode,
    number: order.orderNumber, status: order.rawStatus, date: order.neededDate, cohort: order.cohort,
    originLabel: order.source.requestingBranch.name,
    directLink: `/central-kitchen-orders?orderId=${order.id}`,
    items, issues: [
      ...order.exceptions.map(exception => exception.code),
      ...(order.inventoryMode === "unknown" ? ["historical_inventory_mode_unknown"] : []),
    ],
  };
}

async function advancedRows(
  tx: WorkplanSqlExecutor, kitchenId: string, date: string, today: string,
): Promise<{ rows: ProductionPlanningRow[]; cohorts: { date: { returned: number; truncated: boolean }; overdue: { returned: number; truncated: boolean; lookbackDays: number } } }> {
  const limit = PRODUCTION_PLANNING_ROW_LIMIT;
  // Select order identities before joining items: joining a range plan to calendar days
  // or limiting joined item rows would duplicate/partially return plans.
  const result = await tx.execute(sql`
    WITH selected AS (
      SELECT id, 'date'::text AS cohort FROM advanced_production_orders
      WHERE source_branch_id = ${kitchenId}
        AND start_date <= ${date} AND end_date >= ${date}
      ORDER BY id LIMIT ${limit + 1}
    ), earlier AS (
      SELECT id, 'overdue'::text AS cohort FROM advanced_production_orders
      WHERE source_branch_id = ${kitchenId}
        AND end_date < ${date} AND end_date < ${today}
        AND end_date >= (${date}::date - ${PRODUCTION_PLANNING_OVERDUE_LOOKBACK_DAYS}::integer)::text
        AND status IN ('pending', 'approved', 'in_progress')
      ORDER BY end_date, id LIMIT ${limit + 1}
    ), retained AS (
      SELECT * FROM (SELECT * FROM selected LIMIT ${limit}) d
      UNION ALL
      SELECT * FROM (SELECT * FROM earlier LIMIT ${limit}) o
    )
    SELECT a.id, a.order_number, a.status, a.start_date, a.end_date, a.source_branch_id,
      source.name AS source_name, r.cohort,
      i.id AS item_id, i.product_id, i.product_name, i.target_quantity, i.execution_unit,
      CASE WHEN request_order.central_kitchen_id = a.source_branch_id
        AND request_order.request_branch_id = a.target_branch_id THEN link.request_item_id END AS linked_request_item_id,
      CASE WHEN request_order.central_kitchen_id = a.source_branch_id
        AND request_order.request_branch_id = a.target_branch_id THEN link.reason END AS link_reason,
      request_item.order_id AS linked_request_order_id, request_item.requested_quantity AS linked_request_quantity,
      p.id AS mapped_product_id, p.unit AS product_unit, p.product_type, p.is_active, p.operations_enabled,
      EXISTS (
        SELECT 1 FROM central_kitchen_recipes recipe
        WHERE recipe.kitchen_id = ${kitchenId} AND recipe.product_id = i.product_id AND recipe.status = 'approved'
      ) AS approved_recipe,
      batches.finished_quantity, batches.progress_quantity, batches.linked_count, batches.identity_mismatch
    FROM retained r
    JOIN advanced_production_orders a ON a.id = r.id
    JOIN branches source ON source.id = a.source_branch_id
    LEFT JOIN production_order_items i ON i.order_id = a.id
    LEFT JOIN advanced_production_request_links link ON link.plan_item_id = i.id
    LEFT JOIN central_kitchen_order_items request_item ON request_item.id = link.request_item_id
    LEFT JOIN central_kitchen_orders request_order ON request_order.id = request_item.order_id
    LEFT JOIN products p ON p.id = i.product_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'finished'), 0) AS finished_quantity,
        COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'in_progress'), 0) AS progress_quantity,
        COUNT(*) AS linked_count,
        BOOL_OR(b.branch_id <> a.source_branch_id OR b.product_id IS DISTINCT FROM i.product_id
          OR b.unit IS DISTINCT FROM i.execution_unit) AS identity_mismatch
      FROM daily_production_batches b WHERE b.advanced_production_order_item_id = i.id
    ) batches ON i.id IS NOT NULL
    ORDER BY r.cohort, a.end_date, a.id, i.id
  `);
  // Count extra candidate identities without ever sending their items.
  const counts = await tx.execute(sql`
    SELECT
      (SELECT count(*) FROM (
        SELECT id FROM advanced_production_orders WHERE source_branch_id = ${kitchenId}
          AND start_date <= ${date} AND end_date >= ${date} LIMIT ${limit + 1}
      ) x) AS date_count,
      (SELECT count(*) FROM (
        SELECT id FROM advanced_production_orders WHERE source_branch_id = ${kitchenId}
          AND end_date < ${date} AND end_date < ${today}
          AND end_date >= (${date}::date - ${PRODUCTION_PLANNING_OVERDUE_LOOKBACK_DAYS}::integer)::text
          AND status IN ('pending', 'approved', 'in_progress') LIMIT ${limit + 1}
      ) y) AS overdue_count
  `);
  const orders = new Map<number, ProductionPlanningRow>();
  for (const raw of result.rows) {
    const row = record(raw), id = numeric(row.id);
    if (!orders.has(id)) orders.set(id, {
      key: `advanced_plan:${id}`, source: "advanced_plan", id,
      inventoryMode: null,
      number: label(row.order_number, `#${id}`), status: label(row.status, "unknown"),
      date: label(row.start_date, ""), cohort: row.cohort === "overdue" ? "overdue" : "date",
      originLabel: label(row.source_name, label(row.source_branch_id, kitchenId)),
      directLink: `/advanced-production-orders/${id}`, items: [],
      issues: ["range_plan_counted_once", "not_a_central_request"],
    });
    if (row.item_id === null) continue;
    const plan = orders.get(id)!;
    const productId = row.product_id === null ? null : numeric(row.product_id);
    const unit = label(row.execution_unit, label(row.product_unit, "غير محددة"));
    const mapping: ProductionPlanningItem["catalogMapping"] = productId === null || row.mapped_product_id === null
      ? "none" : !isNewCatalogReferenceAllowed({ isActive: row.is_active, operationsEnabled: row.operations_enabled === true })
        || row.product_type !== "finish" ? "inactive_product" : "product";
    const identityValid = row.execution_unit !== null && row.execution_unit === row.product_unit
      && row.identity_mismatch !== true && mapping === "product" && numeric(row.linked_count) > 0;
    const finished = numeric(row.finished_quantity), progress = numeric(row.progress_quantity);
    const overproduced = identityValid && finished + progress > numeric(row.target_quantity);
    const issues = [
      ...(mapping !== "product" ? ["active_finished_product_mapping_unverified"] : []),
      ...(row.approved_recipe !== true ? ["current_approved_recipe_unavailable_informational"] : []),
      ...(!identityValid ? ["production_completion_unavailable_without_comparable_explicit_batch_link"] : []),
      ...(overproduced ? ["linked_production_exceeds_plan"] : []),
    ];
    plan.items.push({
      id: numeric(row.item_id), productId, productName: label(row.product_name, "منتج غير مسمى"), unit,
      requestLink: row.linked_request_item_id == null ? null : {
        requestItemId: numeric(row.linked_request_item_id), requestOrderId: numeric(row.linked_request_order_id),
        requestedQuantity: numeric(row.linked_request_quantity), allocatedQuantity: numeric(row.target_quantity),
        reason: String(row.link_reason),
      },
      plannedQuantity: numeric(row.target_quantity),
      completedQuantity: identityValid ? finished : null,
      inProgressQuantity: identityValid ? progress : null,
      remainingQuantity: identityValid ? Math.max(0, numeric(row.target_quantity) - finished - progress) : null,
      catalogMapping: mapping, approvedRecipe: productId === null ? null : row.approved_recipe === true,
      issues,
    });
  }
  const rows = [...orders.values()];
  const count = record(counts.rows[0]);
  return {
    rows,
    cohorts: {
      date: { returned: rows.filter(r => r.cohort === "date").length, truncated: numeric(count.date_count) > limit },
      overdue: { returned: rows.filter(r => r.cohort === "overdue").length, truncated: numeric(count.overdue_count) > limit,
        lookbackDays: PRODUCTION_PLANNING_OVERDUE_LOOKBACK_DAYS },
    },
  };
}

export async function getProductionPlanning(req: Request, kitchenId: string, date: string, dependencies: Dependencies = {}): Promise<ProductionPlanningResponse> {
  if (!productionPlanningQuerySchema.safeParse({ kitchenId, date }).success) throw new PlanningError(400, "معرف المطبخ وتاريخ صحيح بصيغة YYYY-MM-DD مطلوبان");
  if (!await (dependencies.canAccessBranch || canAccessBranch)(req, kitchenId)) throw new PlanningError(403, "غير مصرح بالوصول لهذا المطبخ");
  const now = dependencies.now?.() || new Date();
  const today = riyadhDate(now);
  const database = dependencies.database || (db as unknown as SqlDatabase);
  return database.transaction(async tx => {
    // The existing builder establishes REPEATABLE READ, READ ONLY as its first
    // statement, validates the central kitchen, and provides linked-only evidence.
    const workplan = await getCentralKitchenWorkplan(req, kitchenId, date, {
      database: { transaction: async callback => callback(tx) },
      canAccessBranch: async () => true, now: () => now,
    });
    const runtime = await tx.execute(sql`SELECT mode FROM central_kitchen_runtime WHERE kitchen_id = ${kitchenId} LIMIT 1`);
    const configuredMode = record(runtime.rows[0]).mode;
    const mode = configuredMode === "real" || configuredMode === "shadow" || configuredMode === "paused"
      ? configuredMode : configuredMode === undefined ? "shadow" : "unknown";
    const advanced = await advancedRows(tx, kitchenId, date, today);
    const coverage = await getProductionCoverage(tx, kitchenId);
    // The legacy workplan's "earlier" cohort is relative to the selected date;
    // a future earlier request must not be described as overdue.
    const overdueRequests = workplan.overdueEarlierOrders.filter(order => order.neededDate < today);
    const rows = [...workplan.orders, ...overdueRequests].map(centralRow).concat(advanced.rows);
    const requestIds = rows.filter(row => row.source === "central_request").flatMap(row => row.items.map(item => item.id));
    if (requestIds.length) {
      const links = await tx.execute(sql`
        SELECT l.request_item_id, l.reason, i.id AS plan_item_id, i.order_id AS plan_order_id, i.target_quantity
        FROM advanced_production_request_links l JOIN production_order_items i ON i.id = l.plan_item_id
        JOIN advanced_production_orders p ON p.id = i.order_id
        JOIN central_kitchen_order_items ri ON ri.id = l.request_item_id
        JOIN central_kitchen_orders ro ON ro.id = ri.order_id
        WHERE l.request_item_id IN (${sql.join(requestIds.map(id => sql`${id}`), sql`, `)})
          AND p.source_branch_id = ro.central_kitchen_id AND p.target_branch_id = ro.request_branch_id
        ORDER BY i.id
      `);
      const byRequest = new Map<number, ProductionPlanningItem["linkedAdvancedPlans"]>();
      for (const raw of links.rows) {
        const link = record(raw), id = numeric(link.request_item_id);
        const list = byRequest.get(id) ?? [];
        list.push({ planItemId: numeric(link.plan_item_id), planOrderId: numeric(link.plan_order_id),
          allocatedQuantity: numeric(link.target_quantity), reason: String(link.reason) });
        byRequest.set(id, list);
      }
      for (const row of rows.filter(row => row.source === "central_request"))
        for (const item of row.items) item.linkedAdvancedPlans = byRequest.get(item.id) ?? [];
    }
    const notApplicablePlan: ProductionItemCoverage = {
      status: "not_applicable", reason: "advanced_plan_is_not_additional_request_demand",
      persistedReserved: null, proposedFreeStock: null, prospectiveInProgress: null,
      remainingProductionNeed: null, inProgressGuaranteed: false,
    };
    for (const row of rows) for (const item of row.items) {
      const nonApproved = row.source === "central_request" && row.status !== "approved" && row.status !== "prepared";
      item.coverage = row.source === "advanced_plan" ? notApplicablePlan
        : coverage.items.get(item.id) ?? {
          status: !coverage.metadata.complete ? "unknown" : nonApproved || row.inventoryMode === "shadow" ? "not_applicable" : "unknown",
          reason: !coverage.metadata.complete ? "candidate_pool_truncated"
            : nonApproved ? "request_not_open_approved"
            : row.inventoryMode === "shadow" ? "shadow_inventory_mode" : "request_not_in_complete_eligible_pool",
          persistedReserved: null, proposedFreeStock: null, prospectiveInProgress: null,
          remainingProductionNeed: null, inProgressGuaranteed: false,
        };
    }
    const centralProductIds = [...new Set(rows.filter(row => row.source === "central_request")
      .flatMap(row => row.items.map(item => item.productId).filter((id): id is number => id !== null)))];
    if (centralProductIds.length) {
      const products = await tx.execute(sql`
        SELECT id, unit, product_type, is_active, operations_enabled FROM products
        WHERE id IN (${sql.join(centralProductIds.map(id => sql`${id}`), sql`, `)})
      `);
      const byId = new Map(products.rows.map(raw => {
        const item = record(raw);
        return [numeric(item.id), item] as const;
      }));
      for (const row of rows.filter(entry => entry.source === "central_request")) {
        for (const item of row.items) {
          if (item.productId === null) continue;
          const product = byId.get(item.productId);
          if (!product || !isNewCatalogReferenceAllowed({
            isActive: product.is_active, operationsEnabled: product.operations_enabled === true,
          }) || product.product_type !== "finish") {
            item.catalogMapping = "inactive_product";
            item.issues.push("active_finished_product_mapping_unverified");
          } else if (product.unit !== item.unit) item.issues.push("current_catalog_unit_differs_from_request_unit");
        }
      }
    }
    const centralCounts = {
      date: { returned: workplan.orders.length, truncated: workplan.metadata.dateCohort.truncated },
      overdue: { returned: overdueRequests.length, truncated: workplan.metadata.overdueEarlier.truncated,
        lookbackDays: workplan.metadata.overdueEarlier.lookbackDays },
    };
    const displayedItems = rows.flatMap(row => row.items);
    const advancedUnlinked = new Set(rows.filter(row => row.source === "advanced_plan")
      .flatMap(row => row.items.filter(item =>
        item.issues.includes("production_completion_unavailable_without_comparable_explicit_batch_link"))));
    const unmapped = displayedItems.filter(item => item.catalogMapping !== "product"
      || item.issues.includes("current_catalog_unit_differs_from_request_unit")
      || advancedUnlinked.has(item));
    const missingRecipe = displayedItems.filter(item => item.approvedRecipe === false);
    const uncertainRecipe = displayedItems.filter(item => item.approvedRecipe === null);
    const checks: ProductionPlanningCheck[] = [
      { id: "configuration_mode", title: "وضع تشغيل المطبخ", status: mode === "real" ? "pass" : mode === "unknown" ? "unknown" : "warning",
        detail: `وضع التشغيل الحالي: ${mode} (${configuredMode === undefined ? "الافتراضي عند عدم وجود سجل" : "سجل التشغيل"})` },
      { id: "product_references_units", title: "هوية المنتج والوحدة", status: !displayedItems.length ? "unknown" : unmapped.length ? "warning" : "pass",
        detail: `ضمن البنود المعروضة فقط (${displayedItems.length}): ${unmapped.length} بنداً لا يملك ربط منتج نهائي نشطاً أو وحدة تنفيذ قابلة للتحقق. لا يشمل هذا الفحص بقية الكتالوج.`,
        actionHref: "/advanced-production-orders" },
      { id: "recipe_evidence", title: "الوصفات المعتمدة الحالية", status: !displayedItems.length || uncertainRecipe.length ? "unknown" : missingRecipe.length ? "warning" : "pass",
        detail: `ضمن البنود المعروضة فقط (${displayedItems.length}): ${missingRecipe.length} بلا وصفة معتمدة حالية و${uncertainRecipe.length} غير قابل للتحقق؛ معلومة تخطيطية لا تعني نفاد المخزون ولا تنفي وصفة تاريخية مجمدة.` },
      { id: "source_separation", title: "فصل مصادر الطلب والخطة", status: "pass",
        detail: "تبقى الخطط المستقلة منفصلة؛ يرتبط بند الخطة بالطلب فقط برابط مثبت قبل التنفيذ، دون جمع المخطط كمخزون جاهز." },
      { id: "opening_balances", title: "أرصدة الافتتاح", status: "unknown",
        detail: "لم تُراجع أو تُطابق أرصدة الافتتاح أو تخصيص المخزون في هذه القراءة." },
      { id: "sales_source_role_approvals", title: "مصدر المبيعات واعتمادات الأدوار", status: "unknown",
        detail: "لم يُتحقق من مصدر المبيعات أو موافقات المسؤولين في هذه القراءة." },
      { id: "stock_allocation", title: "جاهزية تخصيص المخزون", status: "unknown",
        detail: "لم يتم تقييم الحجز أو توافر المواد أو قابلية التنفيذ." },
    ];
    return {
      kitchen: { ...workplan.kitchen, isCentralKitchen: true }, date, rows, checks,
      metadata: {
        coverage: coverage.metadata,
        timezone: "Asia/Riyadh", generatedAt: now.toISOString(), actualRiyadhToday: today,
        stateBasis: "current_persisted_state_not_historical_as_of", allocationReadiness: "unknown",
        quantitySemantics: {
          planned: "request item requested quantity / advanced plan item target quantity; source quantities never added together",
          completed: "explicitly linked, comparable finished production batches only; NOT prepared, dispatched or received fulfillment",
          inProgress: "explicitly linked, comparable in_progress production batches only",
          remaining: "advanced plan target minus explicit finished/in_progress; central request item remaining null because stock may fulfill it. Request coverage remainingProductionNeed is after free stock, active batches and distinct unstarted linked-plan capacity (not a guarantee).",
        },
        configuration: { inventoryMode: mode, source: configuredMode === undefined ? "runtime_default_shadow_no_row" : "central_kitchen_runtime" },
        cohorts: { central_request: centralCounts, advanced_plan: advanced.cohorts },
        rowLimitPerSourceAndCohort: PRODUCTION_PLANNING_ROW_LIMIT,
        truncated: centralCounts.date.truncated || centralCounts.overdue.truncated || advanced.cohorts.date.truncated || advanced.cohorts.overdue.truncated,
      },
      summary: { countsScope: "returned_rows_only", bySource: {
        central_request: { date: centralCounts.date.returned, overdue: centralCounts.overdue.returned },
        advanced_plan: { date: advanced.cohorts.date.returned, overdue: advanced.cohorts.overdue.returned },
      } },
    };
  });
}

export function registerProductionPlanningRoute(app: Express, dependencies: Dependencies = {}): void {
  app.get("/api/production/planning", isAuthenticated, requirePermission("production", "view"), async (req: Request, res: Response) => {
    const parsed = productionPlanningQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "معرف المطبخ وتاريخ صحيح بصيغة YYYY-MM-DD مطلوبان" });
    res.set("Cache-Control", "no-store");
    try {
      return res.json(await getProductionPlanning(req, parsed.data.kitchenId, parsed.data.date, dependencies));
    } catch (error) {
      if (error instanceof PlanningError) return res.status(error.status).json({ error: error.message });
      if (error instanceof Error && "status" in error && typeof error.status === "number")
        return res.status(error.status as number).json({ error: error.message });
      console.error("Production planning read failed", error);
      return res.status(500).json({ error: "تعذر قراءة خطة الإنتاج حالياً" });
    }
  });
}