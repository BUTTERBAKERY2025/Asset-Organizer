import { describe, expect, it } from "vitest";
import { resolveHrBranchScope } from "../server/hr-routes";

describe("HR branch read scope", () => {
  const limited = { branchIds: ["branch-a", "branch-b"], hasAccess: true };
  const inaccessible = { branchIds: [], hasAccess: false };

  it("preserves the existing cross-branch scope when branchId is omitted", () => {
    expect(resolveHrBranchScope(limited, undefined, true, true)).toEqual({
      branchIds: null,
      hasAccess: true,
    });
  });

  it("constrains cross-branch HR reads to the requested branch", () => {
    expect(resolveHrBranchScope(limited, "branch-b", true, true)).toEqual({
      branchIds: ["branch-b"],
      hasAccess: true,
    });
  });

  it("fails closed for an inaccessible requested branch", () => {
    expect(resolveHrBranchScope(inaccessible, "branch-z", true, false)).toEqual({
      branchIds: [],
      hasAccess: false,
    });
  });

  it("does not elevate write scope", () => {
    expect(resolveHrBranchScope(inaccessible, "branch-z", false, true)).toEqual({
      branchIds: [],
      hasAccess: false,
    });
  });

  it("gives list, report, and aggregate the same single-branch dataset", () => {
    const rows = [
      { id: 1, branchId: "branch-a", amount: 100 },
      { id: 2, branchId: "branch-b", amount: 250 },
      { id: 3, branchId: "branch-a", amount: 50 },
    ];
    const scope = resolveHrBranchScope(limited, "branch-a", true, true);
    const scopedRows = rows.filter((row) => scope.branchIds?.includes(row.branchId));
    const listIds = scopedRows.map((row) => row.id);
    const reportIds = scopedRows.map((row) => row.id);
    const aggregate = {
      count: scopedRows.length,
      amount: scopedRows.reduce((sum, row) => sum + row.amount, 0),
    };

    expect(listIds).toEqual([1, 3]);
    expect(reportIds).toEqual(listIds);
    expect(aggregate).toEqual({ count: 2, amount: 150 });
    expect(scopedRows.some((row) => row.branchId === "branch-b")).toBe(false);
  });
});