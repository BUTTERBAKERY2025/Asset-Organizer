import { describe, expect, it } from "vitest";
import {
  canEnterIndependentEntry,
  getProductionSource,
  getProductionSourceLabel,
  initialIndependentEntryAcknowledgementState,
  isCentralKitchenManagedBatch,
  reduceIndependentEntryAcknowledgement,
} from "../client/src/components/central-kitchen/manual-production-ui";

describe("manual production source labels", () => {
  it("recognises an order item with an approved recipe", () => {
    expect(getProductionSource({ centralKitchenOrderItemId: 42, recipeBacked: true }))
      .toBe("linked_recipe");
    expect(isCentralKitchenManagedBatch({ centralKitchenOrderItemId: 42, recipeBacked: true }))
      .toBe(true);
  });

  it("keeps linked batches without a recipe explicit", () => {
    const source = getProductionSource({ centralKitchenOrderItemId: 42, recipeBacked: false });
    expect(source).toBe("linked_without_recipe");
    expect(getProductionSourceLabel(source)).toContain("لا استهلاك");
  });

  it("does not claim that historical unlinked rows fulfilled an order", () => {
    expect(getProductionSource({ centralKitchenOrderItemId: null, recipeBacked: null }))
      .toBe("unlinked_legacy");
    expect(getProductionSourceLabel("unlinked_legacy")).toBe("غير مرتبط بطلب");
    expect(isCentralKitchenManagedBatch({ centralKitchenOrderItemId: null, recipeBacked: null }))
      .toBe(false);
  });

  it("clears normal acknowledgement when an entry is cancelled or reopened", () => {
    const acknowledged = { normal: true, carryOver: true };
    const cancelled = reduceIndependentEntryAcknowledgement(acknowledged, { type: "cancel_normal_entry" });
    expect(cancelled).toEqual({ normal: false, carryOver: true });
    expect(reduceIndependentEntryAcknowledgement({ ...cancelled, normal: true }, { type: "open_normal_entry" }).normal)
      .toBe(false);
  });

  it("keeps the same normal entry acknowledged across the in-progress choice", () => {
    const state = reduceIndependentEntryAcknowledgement(
      { ...initialIndependentEntryAcknowledgementState, normal: true },
      { type: "begin_in_progress" },
    );
    expect(state.normal).toBe(true);
    expect(reduceIndependentEntryAcknowledgement(state, { type: "cancel_in_progress" }).normal)
      .toBe(false);
  });

  it("keeps carry-over acknowledgement isolated and never enters normal state", () => {
    const state = reduceIndependentEntryAcknowledgement(
      { ...initialIndependentEntryAcknowledgementState, normal: true },
      { type: "set_carry_over", value: true },
    );
    expect(state).toEqual({ normal: true, carryOver: true });
    expect(reduceIndependentEntryAcknowledgement(state, { type: "close_carry_over" }))
      .toEqual({ normal: true, carryOver: false });
  });

  it("cannot bypass the acknowledgement guard with a false or truthy non-boolean", () => {
    expect(canEnterIndependentEntry(false)).toBe(false);
    expect(canEnterIndependentEntry(Boolean("checked"))).toBe(true);
    expect(canEnterIndependentEntry(("true" as unknown) as boolean)).toBe(false);
  });
});