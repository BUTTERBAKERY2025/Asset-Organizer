/**
 * Read-only contract for the production operations report. Quantities are
 * deliberately kept inside unit-specific rows; callers must not add values
 * from different units together.
 */

export type ProductionOperationsDateWindow = {
  startDate: string;
  endDate: string;
  daysInclusive: number;
};

export type ProductionOperationsQuantityByUnit = {
  unit: string;
  quantity: number;
};

export type ProductionOperationsProductionRow = {
  productId: number | null;
  productName: string;
  unit: string;
  branchIds: string[];
  finishedBatchCount: number;
  finishedQuantity: number;
  inProgressBatchCount: number;
  inProgressQuantity: number;
  batchIds: number[];
  recipeSourceRecipeIds: number[];
};

export type ProductionOperationsPlannedRow = {
  productId: number | null;
  productName: string;
  /** The current catalog unit is informational only; it is not a historical snapshot. */
  catalogUnit: string | null;
  sourceBranchIds: string[];
  targetBranchIds: string[];
  plannedQuantity: number;
  advancedOrderIds: number[];
  advancedOrderItemIds: number[];
  comparisonStatus: "unavailable_without_explicit_batch_link";
};

export type ProductionOperationsRequestRow = {
  kitchenId: string;
  requestBranchIds: string[];
  /** `unknown` is a legacy order with no immutable inventory-mode snapshot. */
  inventoryMode: "real" | "shadow" | "unknown";
  status: string;
  itemKind: "product" | "warehouse_item";
  itemId: number | null;
  itemName: string;
  unit: string;
  requestedQuantity: number;
  preparedQuantity: number;
  dispatchedQuantity: number;
  goodReceivedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  /**
   * Output directly linked through daily_production_batches.central_kitchen_order_item_id.
   * These values intentionally use the request cohort, not the report output-date cohort.
   */
  linkedFinishedQuantity: number;
  linkedInProgressQuantity: number;
  linkedBatchIds: number[];
  linkedProductionComparisonStatus:
    | "available_explicit_batch_order_item_fk"
    | "not_applicable_warehouse_item";
  orderIds: number[];
  orderItemIds: number[];
};

export type ProductionOperationsMaterialRow = {
  warehouseItemId: number;
  materialName: string;
  unit: string;
  consumedQuantity: number;
  movementIds: number[];
  batchIds: number[];
};

export type ProductionOperationsWasteRow = {
  productId: number;
  productName: string;
  /** Current product catalog unit; waste items have no immutable unit column. */
  catalogUnit: string | null;
  approvedQuantity: number;
  wasteReportIds: number[];
  wasteItemIds: number[];
};

export type ProductionOperationsCoverage = {
  finishedBatchCount: number;
  recipeBacked: number;
  nonRecipe: number;
  recipeStatusUnknown: number;
  linked: number;
  unlinked: number;
  materialPostingMissing: number;
  materialPostingUnknown: number;
  outputPostingProven: number;
  outputPostingMissing: number;
  outputPostingUnknown: number;
  recipeSnapshotMissing: number | null;
};

export type ProductionOperationsReport = {
  summary: {
    production: {
      finishedBatchCount: number;
      inProgressBatchCount: number;
      finishedQuantityByUnit: ProductionOperationsQuantityByUnit[];
      inProgressQuantityByUnit: ProductionOperationsQuantityByUnit[];
    };
    advancedPlans: {
      orderCount: number;
      itemCount: number;
      plannedQuantityByCatalogUnit: ProductionOperationsQuantityByUnit[];
      comparisonStatus: "unavailable_without_explicit_batch_link";
    };
    centralKitchen: {
      orderCount: number;
      activeOrderCount: number;
      inactiveOrderCount: number;
      /**
       * The authoritative quantity presentation. Each mode is deliberately
       * isolated: shadow is an operational projection, while real is a
       * physical-inventory workflow.
       */
      byInventoryMode: Array<{
        inventoryMode: "real" | "shadow" | "unknown";
        orderCount: number;
        activeOrderCount: number;
        inactiveOrderCount: number;
        requestedQuantityByUnit: ProductionOperationsQuantityByUnit[];
        preparedQuantityByUnit: ProductionOperationsQuantityByUnit[];
        dispatchedQuantityByUnit: ProductionOperationsQuantityByUnit[];
        goodReceivedQuantityByUnit: ProductionOperationsQuantityByUnit[];
        damagedQuantityByUnit: ProductionOperationsQuantityByUnit[];
        missingQuantityByUnit: ProductionOperationsQuantityByUnit[];
      }>;
      orderCountsByInventoryModeAndStatus: Array<{
        inventoryMode: "real" | "shadow" | "unknown";
        status: string;
        orderCount: number;
      }>;
      /** @deprecated Use byInventoryMode. These operational totals mix modes and are never physical stock. */
      combinedQuantitiesDeprecated: true;
      /** @deprecated Use byInventoryMode. */
      requestedQuantityByUnit: ProductionOperationsQuantityByUnit[];
      /** @deprecated Use byInventoryMode. */
      preparedQuantityByUnit: ProductionOperationsQuantityByUnit[];
      /** @deprecated Use byInventoryMode. */
      dispatchedQuantityByUnit: ProductionOperationsQuantityByUnit[];
      /** @deprecated Use byInventoryMode. */
      goodReceivedQuantityByUnit: ProductionOperationsQuantityByUnit[];
      /** @deprecated Use byInventoryMode. */
      damagedQuantityByUnit: ProductionOperationsQuantityByUnit[];
      /** @deprecated Use byInventoryMode. */
      missingQuantityByUnit: ProductionOperationsQuantityByUnit[];
    };
    materials: {
      movementCount: number;
      consumedQuantityByUnit: ProductionOperationsQuantityByUnit[];
    };
    approvedWaste: {
      reportCount: number;
      quantityByCatalogUnit: ProductionOperationsQuantityByUnit[];
    };
  };
  productionRows: ProductionOperationsProductionRow[];
  plannedRows: ProductionOperationsPlannedRow[];
  requestRows: ProductionOperationsRequestRow[];
  materialRows: ProductionOperationsMaterialRow[];
  wasteRows: ProductionOperationsWasteRow[];
  coverage: ProductionOperationsCoverage;
  metadata: {
    generatedAt: string;
    readConsistency: "repeatable_read_read_only_transaction";
    branchScope: {
      requestedBranchId: string;
      effectiveBranchIds: string[] | null;
      allConvention: "branchId=all";
    };
    dateWindow: ProductionOperationsDateWindow & {
      timezone: "Asia/Riyadh";
      bases: Array<{
        source: string;
        dateBasis: string;
        label: string;
      }>;
    };
    sources: Array<{
      source: string;
      status: "available" | "unavailable";
      label: string;
    }>;
    linkage: {
      centralKitchenOrderItemToBatch: {
        status: "available_explicit_batch_order_item_fk";
        dateBasis: "request needed_date cohort; linked batches are not filtered by production_date";
      };
      advancedPlanToBatch: {
        status: "unavailable_without_explicit_batch_link";
      };
    };
    costing: {
      status: "not_available";
      message: string;
    };
    rowLimit: {
      applied: false;
      totalRows: number;
    };
    warnings: string[];
  };
};

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** Validates an ISO calendar day without interpreting it in the server timezone. */
export function isRiyadhCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseProductionOperationsDateWindow(
  startDate: string,
  endDate: string,
): ProductionOperationsDateWindow {
  if (!isRiyadhCalendarDate(startDate) || !isRiyadhCalendarDate(endDate)) {
    throw new Error("يجب أن يكون التاريخ بالتنسيق YYYY-MM-DD ويمثل يوماً تقويمياً صالحاً");
  }
  const toUtcDay = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const daysInclusive = Math.floor((toUtcDay(endDate) - toUtcDay(startDate)) / 86_400_000) + 1;
  if (daysInclusive < 1) throw new Error("تاريخ البداية يجب أن يسبق أو يساوي تاريخ النهاية");
  if (daysInclusive > 366) throw new Error("المدى الزمني الأقصى للتقرير هو 366 يوماً");
  return { startDate, endDate, daysInclusive };
}