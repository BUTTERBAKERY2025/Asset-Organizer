/**
 * The lifecycle guidance shown by the central-kitchen order screens.
 *
 * This is deliberately a pure, presentation-facing helper.  It does not
 * decide whether a user may perform a transition; those checks stay with the
 * existing server response and page permission guards.
 */

export type CentralKitchenInventoryMode = "real" | "shadow" | "unknown";
export type CentralKitchenInventoryModeFilter = CentralKitchenInventoryMode | "all";
export type CentralKitchenDiscrepancyStatus = "none" | "open" | "resolved";

export type CentralKitchenNextStepStage =
  | "approval"
  | "production_and_preparation"
  | "dispatch"
  | "receipt"
  | "discrepancy_review"
  | "complete"
  | "unknown";

export type CentralKitchenNextStep = {
  label: string;
  owner: string;
  stage: CentralKitchenNextStepStage;
  isComplete: boolean;
};

export type CentralKitchenNextStepInput = {
  status: string | null | undefined;
  inventoryMode?: CentralKitchenInventoryMode | string | null;
  discrepancyStatus?: CentralKitchenDiscrepancyStatus | string | null;
  damagedQuantity?: number | null;
  missingQuantity?: number | null;
};

const nextStep = (
  label: string,
  owner: string,
  stage: CentralKitchenNextStepStage,
  isComplete = false,
): CentralKitchenNextStep => ({ label, owner, stage, isComplete });

/**
 * Legacy rows predate the immutable inventory-mode snapshot.  They are
 * intentionally grouped as `unknown`, never silently grouped with shadow
 * (or real) inventory.
 */
export function parseCentralKitchenInventoryMode(value: unknown): CentralKitchenInventoryMode {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized === "real") return "real";
  if (normalized === "shadow") return "shadow";
  return "unknown";
}

/** Validates a URL/UI inventory-mode filter without treating bad input as unknown rows. */
export function parseCentralKitchenInventoryModeFilter(value: unknown): CentralKitchenInventoryModeFilter {
  if (typeof value !== "string") return "all";
  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized === "all") return "all";
  if (normalized === "real" || normalized === "shadow" || normalized === "unknown") return normalized;
  return "all";
}

export function filterCentralKitchenOrdersByInventoryMode<T extends { inventoryMode?: unknown | null }>(
  orders: readonly T[],
  filter: unknown,
): T[] {
  const normalizedFilter = parseCentralKitchenInventoryModeFilter(filter);
  if (normalizedFilter === "all") return [...orders];
  return orders.filter((order) => parseCentralKitchenInventoryMode(order.inventoryMode) === normalizedFilter);
}

/**
 * Returns the next operational responsibility for an order.
 *
 * `inventoryMode` is accepted as part of the shared contract so callers can
 * use one lifecycle function for both real and shadow orders.  Shadow mode
 * changes the inventory disclaimer in the page, not the responsible
 * lifecycle step; it must never be treated as physical stock movement here.
 *
 * Receipt quantities are historical evidence only.  Once the order carries
 * the authoritative `discrepancyStatus`, that status wins over old damaged or
 * missing quantities.  If the status is absent or unrecognized, the helper
 * stays indeterminate rather than inferring completion or an open review.
 */
export function getCentralKitchenNextStep({
  status,
  inventoryMode: _inventoryMode,
  discrepancyStatus,
}: CentralKitchenNextStepInput): CentralKitchenNextStep {
  const normalizedStatus = typeof status === "string"
    ? status.trim().toLowerCase()
    : "";
  const normalizedDiscrepancyStatus = typeof discrepancyStatus === "string"
    ? discrepancyStatus.trim().toLowerCase()
    : "";

  switch (normalizedStatus) {
    case "requested":
      return nextStep("اعتماد", "مصدر المطبخ", "approval");
    case "approved":
      return nextStep("الإنتاج ثم التجهيز", "المطبخ", "production_and_preparation");
    case "prepared":
      return nextStep("الإرسال", "المصدر", "dispatch");
    case "dispatched":
      return nextStep("الاستلام", "الفرع الطالب", "receipt");
    case "received":
      if (normalizedDiscrepancyStatus === "open") {
        return nextStep("مراجعة الفروقات", "الفرع الطالب", "discrepancy_review");
      }
      if (normalizedDiscrepancyStatus === "none" || normalizedDiscrepancyStatus === "resolved") {
        return nextStep("مكتمل", "—", "complete", true);
      }
      return nextStep("تم الاستلام — راجع حالة تسوية الفروقات في الطلب", "الفرع الطالب", "unknown");
    default:
      return nextStep("حالة غير معروفة", "غير محدد", "unknown");
  }
}