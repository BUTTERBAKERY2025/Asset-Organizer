import { describe, expect, it } from "vitest";
import { adjacentOrderId, isKitchenOperationsPresentation } from "./operations-workspace";

describe("kitchen operations presentation", () => {
  it("keeps requester presentation when branch manager can edit receipts but cannot approve", () => {
    const requester = { role: "employee", jobTitle: "branch_manager" };
    const canEditReceipts = true;
    const canApproveOrders = false;
    expect(canEditReceipts).toBe(true);
    expect(isKitchenOperationsPresentation(requester, canApproveOrders)).toBe(false);
  });
  it("shows the operations presentation for production manager, admin, and module approver", () => {
    expect(isKitchenOperationsPresentation({ role: "employee", jobTitle: "production_manager" }, false)).toBe(true);
    expect(isKitchenOperationsPresentation({ role: "admin" }, false)).toBe(true);
    expect(isKitchenOperationsPresentation({ role: "employee", jobTitle: "operations_manager" }, true)).toBe(true);
    expect(isKitchenOperationsPresentation({ role: "employee", jobTitle: "operations_manager" }, false)).toBe(false);
  });
  it("navigates only within visible ids", () => {
    expect(adjacentOrderId([12, 31, 56], "31", -1)).toBe(12);
    expect(adjacentOrderId([12, 31, 56], 56, 1)).toBeNull();
    expect(adjacentOrderId([12], 87, -1)).toBeNull();
  });
});