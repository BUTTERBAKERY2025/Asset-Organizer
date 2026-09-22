import { describe, expect, it } from "vitest";
import { centralKitchenRequestChangeBlock, centralKitchenRequestChangeSchema, canTransitionCentralKitchenOrder } from "../server/central-kitchen-orders";
import { getCentralKitchenNextStep } from "../shared/central-kitchen-next-step";

describe("request changes fail closed", () => {
  it("permits only uncommitted requested edits and early cancellation", () => {
    expect(centralKitchenRequestChangeBlock("requested", true, false)).toBeNull();
    expect(centralKitchenRequestChangeBlock("approved", false, false)).toBeNull();
    expect(centralKitchenRequestChangeBlock("approved", true, false)).toBeTruthy();
    for (const status of ["requested", "approved", "prepared", "dispatched", "received", "cancelled"]) {
      expect(centralKitchenRequestChangeBlock(status, false, true)).toBeTruthy();
    }
    for (const status of ["prepared", "dispatched", "received", "cancelled"]) {
      expect(centralKitchenRequestChangeBlock(status, false, false)).toBeTruthy();
    }
  });
  it("requires a revision, reason and valid exact quantities and dates", () => {
    const payload = { expectedEventId: 1, reason: "changed demand", edit: {
      neededDate: "2026-09-30", neededTime: null, notes: null,
      items: [{ itemId: 2, requestedQuantity: 0.5 }],
    } };
    expect(centralKitchenRequestChangeSchema.safeParse(payload).success).toBe(true);
    expect(centralKitchenRequestChangeSchema.safeParse({ ...payload, reason: " " }).success).toBe(false);
    expect(centralKitchenRequestChangeSchema.safeParse({ ...payload, expectedEventId: undefined }).success).toBe(false);
    expect(centralKitchenRequestChangeSchema.safeParse({ ...payload, edit: { ...payload.edit, neededDate: "2026-02-30" } }).success).toBe(false);
    for (const quantity of [0, -1, 0.0000001, Infinity]) {
      expect(centralKitchenRequestChangeSchema.safeParse({ ...payload, edit: { ...payload.edit, items: [{ itemId: 2, requestedQuantity: quantity }] } }).success).toBe(false);
    }
  });
  it("makes cancellation terminal, not active demand", () => {
    expect(canTransitionCentralKitchenOrder("cancelled", "approved")).toBe(false);
    expect(getCentralKitchenNextStep({ status: "cancelled" }).isComplete).toBe(true);
  });
});