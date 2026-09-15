import { z } from "zod";
import type { CentralKitchenNextStep } from "./central-kitchen-next-step";

export const CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT = 250;
export const CENTRAL_KITCHEN_WORKPLAN_OVERDUE_LOOKBACK_DAYS = 365;

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}, "Invalid calendar date");

export const centralKitchenWorkplanQuerySchema = z.object({
  kitchenId: z.string().trim().min(1).max(255),
  date: calendarDate.optional(),
}).strict();

export type CentralKitchenWorkplanQuery = z.infer<typeof centralKitchenWorkplanQuerySchema>;

export type CentralKitchenWorkplanCohort = "date" | "overdue";
export type CentralKitchenWorkplanInventoryMode = "real" | "shadow" | "unknown";
export type CentralKitchenWorkplanRecipeEvidence = "recipe_backed" | "legacy" | "unknown";
export type CentralKitchenWorkplanMaterialPosting = "consumed" | "pending" | "unknown";

export type CentralKitchenWorkplanQuantityGroup = {
  unit: string;
  status: string;
  batchCount: number;
  quantity: number;
};

export type CentralKitchenWorkplanBatch = {
  id: number;
  orderItemId: number;
  productId: number | null;
  productName: string;
  rawStatus: string;
  status: string;
  quantity: number;
  unit: string;
  finished: boolean;
  recipeBacked: boolean | null;
  recipeEvidence: CentralKitchenWorkplanRecipeEvidence;
  materialPosting: CentralKitchenWorkplanMaterialPosting;
  materialPostingEvidence: "recorded_movement_present" | "no_recorded_movement";
  directLink: string;
};

export type CentralKitchenWorkplanBatchSummary = {
  count: number;
  refs: Array<{ id: number; directLink: string }>;
  byUnitAndStatus: CentralKitchenWorkplanQuantityGroup[];
  recipeEvidence: {
    recipeBacked: number;
    legacy: number;
    unknown: number;
  };
  materialPosting: {
    consumed: number;
    pending: number;
    unknown: number;
  };
  batches: CentralKitchenWorkplanBatch[];
};

export type CentralKitchenWorkplanOrderItem = {
  id: number;
  productId: number | null;
  warehouseItemId: number | null;
  productName: string;
  unit: string;
  requestedQuantity: number;
  preparedQuantity: number | null;
  /** Persisted preparation-source split; never reconstructed from lifecycle state. */
  preparedFromStock: number | null;
  /** Persisted preparation-source split; never reconstructed from linked batches. */
  preparedFromProduction: number | null;
  preparationSourceStatus: "recorded" | "unknown";
  /** Persisted proof for this item only, if production supplied any quantity. */
  productionFulfillmentEvidence: unknown | null;
  dispatchedQuantity: number | null;
  receivedQuantity: number | null;
  damagedQuantity: number | null;
  missingQuantity: number | null;
  catalogMapping: "product" | "warehouse_item" | "none" | "ambiguous";
  approvedRecipe: boolean | null;
  approvedRecipeNote: string | null;
};

export type CentralKitchenWorkplanExceptionCode =
  | "overdue"
  | "no_catalog_mapping"
  | "unfinished_linked_batch";

export type CentralKitchenWorkplanException = {
  code: CentralKitchenWorkplanExceptionCode;
  objective: string;
  message: string;
  itemId?: number;
  batchIds?: number[];
};

export type CentralKitchenWorkplanOrder = {
  id: number;
  orderNumber: string;
  orderDate: string;
  neededDate: string;
  cohort: CentralKitchenWorkplanCohort;
  source: {
    requestingBranch: { id: string; name: string };
    kitchen: { id: string; name: string };
  };
  rawStatus: string;
  inventoryMode: CentralKitchenWorkplanInventoryMode;
  discrepancyStatus: string;
  nextStep: CentralKitchenNextStep;
  finished: boolean;
  directOrderLink: string;
  items: CentralKitchenWorkplanOrderItem[];
  linkedBatches: CentralKitchenWorkplanBatchSummary;
  readiness: {
    status: "unknown";
    reason: "allocated_stock_not_evaluated";
  };
  exceptions: CentralKitchenWorkplanException[];
};

export type CentralKitchenWorkplanSummary = {
  orderCount: number;
  dateCohortOrderCount: number;
  overdueEarlierOrderCount: number;
  unfinishedOrderCount: number;
  finishedOrderCount: number;
  byStatus: Array<{ status: string; orderCount: number }>;
  linkedBatchCount: number;
  byInventoryMode: Array<{
    inventoryMode: CentralKitchenWorkplanInventoryMode;
    orderCount: number;
    linkedBatchCount: number;
    linkedBatchQuantityByUnitAndStatus: CentralKitchenWorkplanQuantityGroup[];
    recipeEvidence: {
      recipeBacked: number;
      legacy: number;
      unknown: number;
    };
    materialPosting: {
      consumed: number;
      pending: number;
      unknown: number;
    };
  }>;
  recipeEvidence: {
    recipeBacked: number;
    legacy: number;
    unknown: number;
  };
  materialPosting: {
    consumed: number;
    pending: number;
    unknown: number;
  };
  exceptionCounts: Partial<Record<CentralKitchenWorkplanExceptionCode, number>>;
  countsScope: "returned_rows_only";
};

export type CentralKitchenWorkplanMetadata = {
  scope: "current_central_kitchen_orders";
  snapshotKind: "current_lifecycle_snapshot";
  stateBasis: "current_persisted_state_not_historical_as_of";
  currentState: true;
  historicalAsOf: null;
  excludedSources: ["advanced_production_orders"];
  timezone: "Asia/Riyadh";
  rowLimit: number;
  returnedOrderCount: number;
  totalReturnedOrderCount: number;
  totalRowsTruncated: boolean;
  dateCohort: {
    candidateRowLimit: number;
    candidateRowsReturned: number;
    truncated: boolean;
    countComplete: boolean;
  };
  overdueEarlier: {
    lookbackDays: number;
    candidateRowLimit: number;
    candidateRowsReturned: number;
    truncated: boolean;
    countComplete: boolean;
  };
  actualRiyadhToday: string;
  overdueRule: "needed_date_before_riyadh_today_and_order_not_finished";
  futureEarlierOrdersAreNotOverdue: true;
  allocationReadiness: "unknown";
  limitations: {
    reservedStock: "not_reported";
    materialShortages: "not_evaluated";
    completionIsNotReadinessPermission: true;
    readinessPermission: "not_evaluated";
    approvedRecipeIsInformational: true;
    materialPostingIsRecordedEvidenceNotReconciliation: true;
  };
  generatedAt: string;
};

export type CentralKitchenWorkplan = {
  kitchen: { id: string; name: string };
  date: string;
  generatedAt: string;
  orders: CentralKitchenWorkplanOrder[];
  overdueEarlierOrders: CentralKitchenWorkplanOrder[];
  summary: CentralKitchenWorkplanSummary;
  metadata: CentralKitchenWorkplanMetadata;
};