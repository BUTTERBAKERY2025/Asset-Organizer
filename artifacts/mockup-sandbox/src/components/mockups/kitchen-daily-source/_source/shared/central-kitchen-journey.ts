export type JourneySection = "available" | "restricted" | "absent" | "error";

export interface KitchenOrderJourney {
  orderId: number;
  stages: Array<{
    key: string;
    label: string;
    status: "complete" | "current" | "pending" | "blocked" | "unknown";
    summary: string;
    owner?: string;
  }>;
  delivery: { id: number; status: string } | null;
  destinationBranchId: string;
  inventoryProductIds: number[];
  inventoryMode: string | null;
  warnings: string[];
  sections: { production: boolean; delivery: boolean; inventory: boolean; bar: boolean };
  /** Restricted is not the same as no record; error is not the same as absence. */
  sectionState: Record<"production" | "delivery" | "inventory" | "bar", JourneySection>;
  /** Shared branch context only; neither lot nor handoff is attributed to this order. */
  sharedBranchContext?: { lotIds: number[]; handoffIds: number[] };
}