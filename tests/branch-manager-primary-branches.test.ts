import { describe, expect, it } from "vitest";
import { visibleBranchesForUser } from "../client/src/hooks/useBranches";
import { resolveBoardBranch } from "../client/src/lib/branch-operation-navigation";

const serverAllowed = [{ id: "secondary" }, { id: "primary" }];

describe("branch manager desk branch scope", () => {
  it("only exposes the primary branch when it is in the server-authorized list", () => {
    expect(visibleBranchesForUser(serverAllowed, "branch_manager", "primary")).toEqual([{ id: "primary" }]);
    expect(resolveBoardBranch(null, visibleBranchesForUser(serverAllowed, "branch_manager", "primary"), "secondary"))
      .toEqual({ branchId: "primary", invalidScope: false });
  });

  it("does not turn an extra grant or active branch into a substitute primary branch", () => {
    const visible = visibleBranchesForUser([{ id: "secondary" }], "branch_manager", "primary");
    expect(visible).toEqual([]);
    expect(resolveBoardBranch(null, visible, "secondary")).toEqual({ branchId: null, invalidScope: false });
    expect(resolveBoardBranch("secondary", visible, "secondary")).toEqual({ branchId: null, invalidScope: true });
  });

  it("does not infer a primary from the access row's isDefault or a null users.branchId", () => {
    expect(visibleBranchesForUser([{ id: "secondary", isDefault: true }], "branch_manager", null)).toEqual([]);
    expect(visibleBranchesForUser(serverAllowed, "operations_manager", null)).toEqual(serverAllowed);
  });
});