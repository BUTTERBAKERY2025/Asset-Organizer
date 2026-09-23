import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  consumeWarehouseCreateIntent,
  parseWarehouseSupplyIntent,
  resolveVisibleBranchFilter,
  resolveWarehouseCreateDestination,
} from "../client/src/lib/warehouse-branch-supply";
import { resolveNavigationBranch } from "../client/src/hooks/use-branch-navigation";

describe("warehouse branch supply navigation", () => {
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

  it("gates mutation controls with the warehouse route actions", () => {
    const page = readFileSync(new URL("../client/src/pages/transfer-requests.tsx", import.meta.url), "utf8");
    expect(page).toContain('canCreate("warehouse")');
    expect(page).toContain('canEdit("warehouse")');
    expect(page).not.toMatch(/can(?:Create|Edit|Approve)\("transfer_requests"\)/);
    expect(page).not.toContain('<SelectItem value="main_warehouse">');
    expect(page).toContain("branchId={visibleBranchId}");
  });
});