import { z } from "zod";

export const PRODUCTION_PLANNING_ROW_LIMIT = 250;
export const PRODUCTION_PLANNING_OVERDUE_LOOKBACK_DAYS = 365;

export const productionPlanningQuerySchema = z.object({
  kitchenId: z.string().trim().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }),
}).strict();

export type ProductionPlanningSource = "central_request" | "advanced_plan";
export type ProductionPlanningCohort = "date" | "overdue";
export type ProductionPlanningItem = {
  id: number;
  productName: string;
  productId: number | null;
  unit: string;
  plannedQuantity: number;
  /** Produced quantity only, from explicitly linked finished batches; never dispatched/prepared quantity. */
  completedQuantity: number | null;
  /** Produced quantity only, from explicitly linked in-progress batches. */
  inProgressQuantity: number | null;
  /** Unknown unless completion is comparable and explicitly linked; null is not zero. */
  remainingQuantity: number | null;
  issues: string[];
  catalogMapping: "product" | "warehouse_item" | "none" | "ambiguous" | "inactive_product" | "unknown";
  approvedRecipe: boolean | null;
};
export type ProductionPlanningRow = {
  key: string;
  source: ProductionPlanningSource;
  /** Frozen order mode for central requests; advanced plans have no order inventory mode. Never infer it from current runtime. */
  inventoryMode: "real" | "shadow" | "unknown" | null;
  id: number;
  number: string;
  status: string;
  date: string;
  cohort: ProductionPlanningCohort;
  originLabel: string;
  directLink: string;
  items: ProductionPlanningItem[];
  issues: string[];
};
export type ProductionPlanningCheck = {
  id: string;
  title: string;
  status: "pass" | "warning" | "unknown";
  detail: string;
  actionHref?: string;
};
export type ProductionPlanningResponse = {
  kitchen: { id: string; name: string; isCentralKitchen: boolean };
  date: string;
  rows: ProductionPlanningRow[];
  checks: ProductionPlanningCheck[];
  metadata: {
    timezone: "Asia/Riyadh";
    generatedAt: string;
    actualRiyadhToday: string;
    stateBasis: "current_persisted_state_not_historical_as_of";
    allocationReadiness: "unknown";
    quantitySemantics: {
      planned: string;
      completed: string;
      inProgress: string;
      remaining: string;
    };
    configuration: { inventoryMode: "real" | "shadow" | "paused" | "unknown"; source: string };
    cohorts: Record<ProductionPlanningSource, {
      date: { returned: number; truncated: boolean };
      overdue: { returned: number; truncated: boolean; lookbackDays: number };
    }>;
    rowLimitPerSourceAndCohort: number;
    truncated: boolean;
  };
  summary: {
    countsScope: "returned_rows_only";
    bySource: Record<ProductionPlanningSource, { date: number; overdue: number }>;
  };
};