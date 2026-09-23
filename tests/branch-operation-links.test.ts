import { describe, expect, it } from "vitest";
import { BRANCH_OPERATION_ROUTES, branchOperationDestination, branchOperationUrl, branchBoardUrl } from "../client/src/lib/branch-operation-navigation";
import { resolveNavigationBranch } from "../client/src/hooks/use-branch-navigation";

describe("branch operation round-trip navigation", () => {
  it.each(BRANCH_OPERATION_ROUTES)("round trips $path to its original branch and card", (route) => {
    const destination = new URL(branchOperationUrl(route.path, "branch & 2"), "https://app.test");
    expect(destination.searchParams.get("branchId")).toBe("branch & 2");
    expect(destination.searchParams.get("from")).toBe("branch-operations");
    const back = new URL(branchBoardUrl("branch & 2", route.path), "https://app.test");
    expect(back.pathname).toBe("/branch-operations");
    expect(back.hash).toBe(`#branch-operation-card-${route.id === "warehouse" ? "kitchen" : route.id}`);
    expect(resolveNavigationBranch(back.search, [{ id: "branch & 2" }, { id: "other" }], "other").branchId).toBe("branch & 2");
  });

  it("preserves alert filters while replacing the branch scope", () => {
    const url = new URL(branchOperationUrl("/hr/employee-documents?status=expired&branchId=old", "new"), "https://app.test");
    expect(url.searchParams.get("status")).toBe("expired");
    expect(url.searchParams.getAll("branchId")).toEqual(["new"]);
  });

  it.each(["https://evil.test/maintenance", "//evil.test/maintenance", "javascript:alert(1)", "/unregistered-page"])("rejects unapproved destination %s", (href) => {
    expect(() => branchOperationUrl(href, "b1")).toThrow();
  });

  it("never interprets a source path as a redirect", () => {
    expect(branchBoardUrl(null, "https://evil.test")).toBe("/branch-operations");
    expect(branchOperationDestination("/maintenance-unrelated")).toBeUndefined();
  });

  it("does not restore a branch after access is removed", () => {
    const back = new URL(branchBoardUrl("removed", "/maintenance"), "https://app.test");
    expect(resolveNavigationBranch(back.search, [{ id: "allowed" }], "allowed").branchId).toBe("allowed");
    expect(resolveNavigationBranch(back.search, [], "removed").branchId).toBeNull();
  });
});