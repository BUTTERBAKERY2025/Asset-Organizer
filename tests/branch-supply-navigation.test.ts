import { describe, expect, it } from "vitest";
import { branchSupplyUrl } from "../client/src/lib/branch-supply-navigation";
import { branchBoardUrl } from "../client/src/lib/branch-operation-navigation";

describe("branch supply sources", () => {
  it("keeps kitchen and warehouse on distinct existing workflows with the same branch", () => {
    for (const source of ["kitchen", "warehouse"] as const) {
      const url = new URL(branchSupplyUrl(source, "فرع & 2"), "https://example.test");
      expect(url.pathname).toBe(source === "kitchen" ? "/central-kitchen-orders" : "/transfer-requests");
      expect(url.searchParams.get("branchId")).toBe("فرع & 2");
      expect(url.searchParams.get("from")).toBe("branch-supply");
    }
  });
  it("does not manufacture a branch or kitchen when viewing all branches", () => {
    expect(new URL(branchSupplyUrl("kitchen", "all"), "https://example.test").searchParams.has("branchId")).toBe(false);
    expect(branchSupplyUrl("kitchen", null, true)).not.toContain("create=");
  });
  it("opens a warehouse request only on an explicit creation intent", () => {
    expect(branchSupplyUrl("warehouse", "a")).not.toContain("create=");
    expect(branchSupplyUrl("warehouse", "a", true)).toContain("create=1");
  });
  it("returns warehouse visitors to the supply entry on the branch board", () => {
    expect(branchBoardUrl("a", "/transfer-requests")).toBe("/branch-operations?branchId=a#branch-operation-card-kitchen");
  });
});