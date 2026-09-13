/**
 * The daily production page can show records created by more than one
 * workflow.  Keep the source decision in one pure helper so the UI never
 * infers a central-kitchen relationship from a product name or a date.
 */
export type ProductionSource =
  | "linked_recipe"
  | "linked_without_recipe"
  | "linked_recipe_unknown"
  | "unlinked_legacy";

export type ProductionSourceFields = {
  centralKitchenOrderItemId?: number | null;
  recipeBacked?: boolean | null;
};

export type IndependentEntryAcknowledgementState = {
  normal: boolean;
  carryOver: boolean;
};

export type IndependentEntryAcknowledgementAction =
  | { type: "set_normal"; value: boolean }
  | { type: "set_carry_over"; value: boolean }
  | { type: "open_normal_entry" }
  | { type: "close_normal_entry" }
  | { type: "cancel_normal_entry" }
  | { type: "normal_submit_success" }
  | { type: "normal_submit_error" }
  | { type: "begin_in_progress" }
  | { type: "cancel_in_progress" }
  | { type: "open_carry_over" }
  | { type: "close_carry_over" }
  | { type: "carry_over_submit_success" }
  | { type: "carry_over_submit_error" };

export const initialIndependentEntryAcknowledgementState: IndependentEntryAcknowledgementState = {
  normal: false,
  carryOver: false,
};

/**
 * Acknowledgements are intent for one pending entry, not a user preference.
 * Opening/cancelling a normal entry clears only normal intent. Moving the
 * same entry through the in-progress choice deliberately keeps it until the
 * create request succeeds or fails. Carry-over is an entirely separate
 * request and never mutates normal intent.
 */
export function reduceIndependentEntryAcknowledgement(
  state: IndependentEntryAcknowledgementState,
  action: IndependentEntryAcknowledgementAction,
): IndependentEntryAcknowledgementState {
  switch (action.type) {
    case "set_normal":
      return { ...state, normal: action.value };
    case "set_carry_over":
      return { ...state, carryOver: action.value };
    case "open_normal_entry":
    case "close_normal_entry":
    case "cancel_normal_entry":
    case "normal_submit_success":
    case "normal_submit_error":
    case "cancel_in_progress":
      return { ...state, normal: false };
    case "begin_in_progress":
      return state;
    case "open_carry_over":
    case "close_carry_over":
    case "carry_over_submit_success":
    case "carry_over_submit_error":
      return { ...state, carryOver: false };
    default:
      return state;
  }
}

export function canEnterIndependentEntry(acknowledged: boolean): boolean {
  return acknowledged === true;
}

export function getProductionSource(batch: ProductionSourceFields): ProductionSource {
  if (batch.centralKitchenOrderItemId !== null && batch.centralKitchenOrderItemId !== undefined) {
    if (batch.recipeBacked === true) return "linked_recipe";
    if (batch.recipeBacked === false) return "linked_without_recipe";
    return "linked_recipe_unknown";
  }
  return "unlinked_legacy";
}

export function isCentralKitchenManagedBatch(batch: ProductionSourceFields): boolean {
  return batch.centralKitchenOrderItemId !== null
    && batch.centralKitchenOrderItemId !== undefined
    || batch.recipeBacked === true;
}

export function getProductionSourceLabel(source: ProductionSource): string {
  switch (source) {
    case "linked_recipe":
      return "مرتبط بطلب مركزي • بوصفة معتمدة";
    case "linked_without_recipe":
      return "مرتبط بطلب مركزي • بدون وصفة (لا استهلاك)";
    case "linked_recipe_unknown":
      return "مرتبط بطلب مركزي • حالة الوصفة غير معروفة";
    case "unlinked_legacy":
      return "غير مرتبط بطلب";
  }
}