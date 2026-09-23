import { describe, expect, it } from "vitest";
import { resolveNavigationBranch } from "../client/src/hooks/use-branch-navigation";

const branches = [{ id: "riyadh" }, { id: "jeddah" }];

describe("branch navigation scope", () => {
  it("initializes a linked page with the requested allowed branch", () => {
    expect(resolveNavigationBranch("?branchId=jeddah", branches, "riyadh", null))
      .toEqual({ hasBranchParam: true, branchId: "jeddah" });
  });

  it("does not broaden a malicious branch parameter to all branches", () => {
    expect(resolveNavigationBranch("?branchId=other-company", branches, "riyadh", null))
      .toEqual({ hasBranchParam: true, branchId: "riyadh" });
    expect(resolveNavigationBranch("?branchId=all", branches, null, null))
      .toEqual({ hasBranchParam: true, branchId: "riyadh" });
  });

  it("keeps standalone page defaults when no branch parameter exists", () => {
    expect(resolveNavigationBranch("", branches, "riyadh", null))
      .toEqual({ hasBranchParam: false, branchId: null });
  });

  it("returns no cross-branch create default when no branch is allowed", () => {
    expect(resolveNavigationBranch("?branchId=jeddah", [], "riyadh", "riyadh"))
      .toEqual({ hasBranchParam: true, branchId: null });
  });
});