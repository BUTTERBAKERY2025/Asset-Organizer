import type { CentralKitchenWorkplan, CentralKitchenWorkplanOrder } from "../../shared/central-kitchen-workplan";
import type { ProductionPlanningResponse, ProductionPlanningRow } from "../../shared/production-planning";
import type { CentralKitchenRecipeContract } from "../../shared/central-kitchen-recipes";

export const kitchens = [
  { id: "fixture-kitchen", name: "المطبخ المركزي التجريبي", isCentralKitchen: true },
  { id: "fixture-kitchen-two", name: "المطبخ المركزي الثاني", isCentralKitchen: true },
];
const now = new Date().toISOString();
export const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const quantities = { recipeBacked: 0, legacy: 0, unknown: 0 };
const posting = { consumed: 0, pending: 0, unknown: 0 };

// All rows are current date-cohort persisted examples: no inferred reservations,
// no inferred production, no fabricated historical-as-of readiness.
export function workplan(kitchenId: string, date: string): CentralKitchenWorkplan {
  const orders: CentralKitchenWorkplanOrder[] = Array.from({ length: 64 }, (_, index) => ({
    id: index + 1, orderNumber: `FIX-WP-${String(index + 1).padStart(3, "0")}`,
    orderDate: date, neededDate: date, cohort: "date",
    source: { requestingBranch: { id: "fixture-branch", name: "الفرع التجريبي" }, kitchen: { id: kitchenId, name: kitchens.find(k => k.id === kitchenId)?.name || kitchenId } },
    rawStatus: "approved", inventoryMode: index % 2 ? "shadow" : "real", discrepancyStatus: "none",
    nextStep: { label: "تجهيز الطلب", owner: "المطبخ المركزي", stage: "production_and_preparation", isComplete: false },
    finished: false, directOrderLink: `/api/central-kitchen-orders/${index + 1}`,
    items: [{ id: index + 1001, productId: index + 2001, warehouseItemId: null, productName: `صنف خطة ${String(index + 1).padStart(3, "0")}`, unit: "قطعة", requestedQuantity: 3, preparedQuantity: 0, preparedFromStock: null, preparedFromProduction: null, preparationSourceStatus: "unknown", productionFulfillmentEvidence: null, dispatchedQuantity: 0, receivedQuantity: 0, damagedQuantity: 0, missingQuantity: 0, catalogMapping: "product", approvedRecipe: null, approvedRecipeNote: null }],
    linkedBatches: { count: 1, refs: [{ id: index + 3001, directLink: `/daily-production?batchId=${index + 3001}` }], byUnitAndStatus: [{ unit: "قطعة", status: "in_progress", batchCount: 1, quantity: 1 }], recipeEvidence: { ...quantities, unknown: 1 }, materialPosting: { ...posting, pending: 1 }, batches: [{ id: index + 3001, orderItemId: index + 1001, productId: index + 2001, productName: `صنف خطة ${String(index + 1).padStart(3, "0")}`, rawStatus: "in_progress", status: "in_progress", quantity: 1, unit: "قطعة", finished: false, recipeBacked: null, recipeEvidence: "unknown", materialPosting: "pending", materialPostingEvidence: "no_recorded_movement", directLink: `/daily-production?batchId=${index + 3001}` }] },
    readiness: { status: "unknown", reason: "allocated_stock_not_evaluated" }, exceptions: [],
  }));
  return {
    kitchen: { id: kitchenId, name: kitchens.find(k => k.id === kitchenId)?.name || kitchenId }, date, generatedAt: now, orders, overdueEarlierOrders: [],
    summary: { orderCount: 64, dateCohortOrderCount: 64, overdueEarlierOrderCount: 0, unfinishedOrderCount: 64, finishedOrderCount: 0, byStatus: [{ status: "approved", orderCount: 64 }], linkedBatchCount: 64, byInventoryMode: (["real", "shadow"] as const).map(inventoryMode => ({ inventoryMode, orderCount: 32, linkedBatchCount: 32, linkedBatchQuantityByUnitAndStatus: [{ unit: "قطعة", status: "in_progress", batchCount: 32, quantity: 32 }], recipeEvidence: { ...quantities, unknown: 32 }, materialPosting: { ...posting, pending: 32 } })), recipeEvidence: { ...quantities, unknown: 64 }, materialPosting: { ...posting, pending: 64 }, exceptionCounts: {}, countsScope: "returned_rows_only" },
    metadata: { scope: "current_central_kitchen_orders", snapshotKind: "current_lifecycle_snapshot", stateBasis: "current_persisted_state_not_historical_as_of", currentState: true, historicalAsOf: null, excludedSources: ["advanced_production_orders"], timezone: "Asia/Riyadh", rowLimit: 250, returnedOrderCount: 64, totalReturnedOrderCount: 64, totalRowsTruncated: false, dateCohort: { candidateRowLimit: 251, candidateRowsReturned: 64, truncated: false, countComplete: true }, overdueEarlier: { lookbackDays: 365, candidateRowLimit: 251, candidateRowsReturned: 0, truncated: false, countComplete: true }, actualRiyadhToday: today, overdueRule: "needed_date_before_riyadh_today_and_order_not_finished", futureEarlierOrdersAreNotOverdue: true, allocationReadiness: "unknown", limitations: { reservedStock: "not_reported", materialShortages: "not_evaluated", completionIsNotReadinessPermission: true, readinessPermission: "not_evaluated", approvedRecipeIsInformational: true, materialPostingIsRecordedEvidenceNotReconciliation: true }, generatedAt: now },
  };
}

export function planning(kitchenId: string, date: string): ProductionPlanningResponse {
  const rows: ProductionPlanningRow[] = Array.from({ length: 64 }, (_, index) => ({
    key: `${index % 2 ? "advanced_plan" : "central_request"}:${index + 1}`,
    source: index % 2 ? "advanced_plan" : "central_request",
    inventoryMode: index % 2 ? null : "real", id: index + 1,
    number: `FIX-PLAN-${String(index + 1).padStart(3, "0")}`,
    status: "approved", date, cohort: "date", originLabel: "الفرع التجريبي",
    directLink: index % 2 ? `/advanced-production-orders/${index + 1}` : `/central-kitchen-orders?orderId=${index + 1}`,
    items: [{ id: index + 1001, productName: `صنف خطة ${String(index + 1).padStart(3, "0")}`, productId: index + 2001, unit: "قطعة", plannedQuantity: 3, completedQuantity: null, inProgressQuantity: null, remainingQuantity: null, issues: [], catalogMapping: "product", approvedRecipe: null,
      coverage: { status: "unknown", reason: "allocated_stock_not_evaluated", persistedReserved: null, proposedFreeStock: null, prospectiveInProgress: null, remainingProductionNeed: null, inProgressGuaranteed: false } }],
    issues: [],
  }));
  return {
    kitchen: { id: kitchenId, name: kitchens.find(k => k.id === kitchenId)?.name || kitchenId, isCentralKitchen: true }, date, rows,
    checks: Array.from({ length: 30 }, (_, index) => ({ id: `fixture_check_${index + 1}`, title: `فحص تجريبي ${String(index + 1).padStart(2, "0")}`, status: "unknown" as const, detail: "الجاهزية غير متحققة من المصدر." })),
    metadata: { coverage: { status: "unknown", scope: "all_open_eligible_requests_current_state", complete: false, candidateLimit: 250, candidateCount: 64, note: "No inventory allocation evaluated in this fixture." }, timezone: "Asia/Riyadh", generatedAt: now, actualRiyadhToday: today, stateBasis: "current_persisted_state_not_historical_as_of", allocationReadiness: "unknown", quantitySemantics: { planned: "persisted request quantity", completed: "explicit linked finished batches only", inProgress: "explicit linked active batches only", remaining: "unknown unless comparable" }, configuration: { inventoryMode: "shadow", source: "runtime_default_shadow_no_row" }, cohorts: { central_request: { date: { returned: 32, truncated: false }, overdue: { returned: 0, truncated: false, lookbackDays: 365 } }, advanced_plan: { date: { returned: 32, truncated: false }, overdue: { returned: 0, truncated: false, lookbackDays: 365 } } }, rowLimitPerSourceAndCohort: 250, truncated: false },
    summary: { countsScope: "returned_rows_only", bySource: { central_request: { date: 32, overdue: 0 }, advanced_plan: { date: 32, overdue: 0 } } },
  };
}

export function recipes(kitchenId: string): CentralKitchenRecipeContract[] {
  return Array.from({ length: 31 }, (_, index) => ({
    id: index + 1, kitchenId, productId: index + 2001, productName: `وصفة تجريبية ${String(index + 1).padStart(2, "0")}`,
    outputQuantity: 1, outputUnit: "قطعة", notes: "ملاحظات المسودة الأصلية", status: index % 3 === 0 ? "draft" : index % 3 === 1 ? "approved" : "superseded",
    version: 1, updateToken: `fixture-token-${index + 1}`, supersedesRecipeId: null, supersededByRecipeId: null,
    createdBy: "fixture-manager", createdAt: now, updatedBy: "fixture-manager", updatedAt: now,
    approvedBy: index % 3 === 1 ? "fixture-manager" : null, approvedAt: index % 3 === 1 ? now : null, supersededAt: index % 3 === 2 ? now : null,
    ingredients: [{ id: index + 4001, warehouseItemId: 8001, name: "دقيق تجريبي", quantity: 0.5, unit: "كيلو" }],
  }));
}