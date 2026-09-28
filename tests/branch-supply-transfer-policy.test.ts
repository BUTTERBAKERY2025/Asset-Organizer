import { describe, expect, it } from "vitest";
import { branchSupplyTransferAllowed as allowed } from "../server/branch-supply-transfer-policy";

const transfer = (sourceBranchId: string, destinationBranchId: string, status: string) =>
  ({ sourceBranchId, destinationBranchId, status });

describe("branch manager warehouse material transfer lane", () => {
  it("accepts main warehouse requests only for an authorized receiving branch", () => {
    expect(allowed("create", transfer("main_warehouse", "own", "pending"), true)).toBe(true);
    expect(allowed("create", transfer("forged_source", "own", "pending"), true)).toBe(false);
    expect(allowed("create", transfer("main_warehouse", "other", "pending"), false)).toBe(false);
    expect(allowed("create", transfer("main_warehouse", "main_warehouse", "pending"), true)).toBe(false);
  });

  it("never treats source ownership as permission to read or edit another destination", () => {
    for (const action of ["view", "modify", "cancel", "receive"] as const) {
      expect(allowed(action, transfer("main_warehouse", "other", "in_transit"), false)).toBe(false);
      expect(allowed(action, transfer("other", "own", "in_transit"), true)).toBe(false);
    }
  });

  it("allows pending-only edits/cancellation and dispatched receipt", () => {
    for (const status of ["pending", "approved", "in_transit", "delivered", "cancelled"]) {
      const row = transfer("main_warehouse", "own", status);
      expect(allowed("modify", row, true)).toBe(status === "pending");
      expect(allowed("cancel", row, true)).toBe(status === "pending");
      expect(allowed("receive", row, true)).toBe(["in_transit", "delivered"].includes(status));
    }
  });

  it("never authorizes source actions, including when the manager has source branch access", () => {
    for (const action of ["approve", "reject", "dispatch"] as const)
      expect(allowed(action, transfer("main_warehouse", "own", "approved"), true)).toBe(false);
  });
});