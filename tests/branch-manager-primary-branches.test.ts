import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { visibleBranchesForUser } from "../client/src/hooks/useBranches";
import { resolveBoardBranch } from "../client/src/lib/branch-operation-navigation";

const serverAllowed = [{ id: "A" }, { id: "B" }];

describe("branch manager desk branch scope", () => {
  it("exposes every canonical server grant, preferring the current authorized branch", () => {
    expect(visibleBranchesForUser(serverAllowed, "branch_manager", "B")).toEqual(serverAllowed);
    expect(resolveBoardBranch(null, serverAllowed, "B"))
      .toEqual({ branchId: "B", invalidScope: false });
    expect(resolveBoardBranch(null, serverAllowed, null))
      .toEqual({ branchId: null, invalidScope: false });
  });

  it("allows the sole grant without a primary, but rejects a denied deep link", () => {
    const visible = visibleBranchesForUser([{ id: "B" }], "branch_manager", null);
    expect(visible).toEqual([{ id: "B" }]);
    expect(resolveBoardBranch(null, visible, null)).toEqual({ branchId: "B", invalidScope: false });
    expect(resolveBoardBranch("deniedC", visible, "B")).toEqual({ branchId: null, invalidScope: true });
  });

  it("retains both grants with null primary and fails closed on revocation or errors", () => {
    expect(visibleBranchesForUser(serverAllowed, "branch_manager", null)).toEqual(serverAllowed);
    expect(resolveBoardBranch("B", [{ id: "A" }], "B")).toEqual({ branchId: null, invalidScope: true });
    expect(resolveBoardBranch(null, [], "B")).toEqual({ branchId: null, invalidScope: false });
    expect(visibleBranchesForUser(serverAllowed, "operations_manager", null)).toEqual(serverAllowed);
    const hook = readFileSync(new URL("../client/src/hooks/useBranches.ts", import.meta.url), "utf8");
    expect(hook).toContain("isError || managerRefreshing");
    expect(hook).toContain("refetchOnMount: user?.role === \"branch_manager\" ? \"always\" : false");
  });
});