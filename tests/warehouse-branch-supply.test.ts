import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  canReceiveBranchSupplyTransfer,
  consumeWarehouseCreateIntent,
  parseWarehouseSupplyIntent,
  resolveVisibleBranchFilter,
  resolveWarehouseCreateDestination,
} from "../client/src/lib/warehouse-branch-supply";
import { resolveNavigationBranch } from "../client/src/hooks/use-branch-navigation";

describe("warehouse branch supply navigation", () => {
  it("allows the exact-row receipt action only for an editable inbound transfer to the assigned branch", () => {
    const inbound = { status: "in_transit", sourceBranchId: "main_warehouse", destinationBranchId: "b1" };
    const assigned = [{ id: "b1" }, { id: "b2" }];
    expect(canReceiveBranchSupplyTransfer(inbound, true, true, assigned)).toBe(true);
    expect(canReceiveBranchSupplyTransfer({ ...inbound, destinationBranchId: "b2" }, true, true, assigned)).toBe(true);
    expect(canReceiveBranchSupplyTransfer(inbound, true, false, assigned)).toBe(false);
    expect(canReceiveBranchSupplyTransfer(inbound, false, true, assigned)).toBe(false);
    expect(canReceiveBranchSupplyTransfer(inbound, true, true, [{ id: "b2" }])).toBe(false);
    expect(canReceiveBranchSupplyTransfer({ ...inbound, status: "delivered" }, true, true, assigned)).toBe(false);
    expect(canReceiveBranchSupplyTransfer({ ...inbound, sourceBranchId: "other_branch" }, true, true, assigned)).toBe(false);
    const page = readFileSync(new URL("../client/src/pages/transfer-requests.tsx", import.meta.url), "utf8");
    expect(page).toContain("btn-receive-detail-");
    expect(page).toContain("void handleConfirmDelivery(selectedTransfer)");
    expect(page).toContain("canReceiveBranchSupplyTransfer(selectedTransfer, isBranchManager, canEdit(transferModule), branches)");
  });
  it("only accepts the explicit create intent", () => {
    expect(parseWarehouseSupplyIntent("?branchId=b1&create=1&from=branch-supply")).toEqual({
      shouldCreate: true,
      fromBranchSupply: true,
    });
    expect(parseWarehouseSupplyIntent("?branchId=b1&create=true")).toEqual({
      shouldCreate: false,
      fromBranchSupply: false,
    });
  });

  it("consumes create without losing branch or source", () => {
    expect(consumeWarehouseCreateIntent("?branchId=b1&create=1&from=branch-supply"))
      .toBe("?branchId=b1&from=branch-supply");
  });

  it("does not add or rewrite unrelated parameters", () => {
    expect(consumeWarehouseCreateIntent("?branchId=b1&from=branch-supply&tab=open"))
      .toBe("?branchId=b1&from=branch-supply&tab=open");
  });

  it("accepts an allowed scoped branch for admins", () => {
    expect(resolveNavigationBranch("?branchId=b2", [{ id: "b1" }, { id: "b2" }]))
      .toEqual({ hasBranchParam: true, branchId: "b2" });
  });

  it("never broadens an invalid scoped link to all branches", () => {
    expect(resolveNavigationBranch("?branchId=all", [{ id: "b1" }, { id: "b2" }], "b2"))
      .toEqual({ hasBranchParam: true, branchId: "b2" });
    expect(resolveNavigationBranch("?branchId=not-allowed", [{ id: "b1" }]))
      .toEqual({ hasBranchParam: true, branchId: "b1" });
  });

  it("uses only the current validated visible branch for cross-source links", () => {
    const branches = [{ id: "a" }, { id: "b" }];
    expect(resolveVisibleBranchFilter("b", branches)).toBe("b");
    expect(resolveVisibleBranchFilter("all", branches)).toBeNull();
    expect(resolveVisibleBranchFilter("main_warehouse", branches)).toBeNull();
    expect(resolveVisibleBranchFilter("not-allowed", branches)).toBeNull();
  });

  it("uses the visible branch for create and clears stale scope at all", () => {
    const branches = [{ id: "a" }, { id: "b" }];
    expect(resolveWarehouseCreateDestination("b", branches, null)).toBe("b");
    expect(resolveWarehouseCreateDestination("all", branches, null)).toBeNull();
    expect(resolveWarehouseCreateDestination("all", branches, "a")).toBe("a");
    expect(resolveWarehouseCreateDestination("all", branches, "stale")).toBeNull();
  });

  it("gates branch mutations with branch_supply while retaining warehouse controls for custodians", () => {
    const page = readFileSync(new URL("../client/src/pages/transfer-requests.tsx", import.meta.url), "utf8");
    expect(page).toContain('isBranchManager ? "branch_supply" : "warehouse"');
    expect(page).toContain("canCreate(transferModule)");
    expect(page).toContain("canEdit(transferModule)");
    expect(page).toContain('canEdit("warehouse")');
    expect(page).not.toMatch(/can(?:Create|Edit|Approve)\("transfer_requests"\)/);
    expect(page).not.toContain('<SelectItem value="main_warehouse">');
    expect(page).toContain("branchId={visibleBranchId}");
  });
});