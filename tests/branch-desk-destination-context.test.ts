import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveNavigationBranch } from "../client/src/hooks/use-branch-navigation";

const cashierSource = readFileSync(
  new URL("../client/src/pages/cashier-journals.tsx", import.meta.url),
  "utf8",
);
const attendanceSource = readFileSync(
  new URL("../client/src/pages/employee-attendance-report.tsx", import.meta.url),
  "utf8",
);

describe("branch desk destination context", () => {
  it("resolves an authorized board branch and fails closed for an invalid branch", () => {
    const allowed = [{ id: "branch-a" }, { id: "branch-b" }];
    expect(resolveNavigationBranch(
      "?branchId=branch-b&from=branch-operations",
      allowed,
      "branch-a",
      null,
    )).toEqual({ hasBranchParam: true, branchId: "branch-b" });
    expect(resolveNavigationBranch(
      "?branchId=unauthorized&from=branch-operations",
      allowed,
      "branch-a",
      null,
    )).toEqual({ hasBranchParam: true, branchId: "branch-a" });
  });

  it("blocks cashier data, stats, and filter queries until branch scope resolves", () => {
    expect(cashierSource).toContain(
      'const isBranchFilterReady = branchFilter !== "" && !navigationBranch.isResolving;',
    );
    expect(cashierSource.match(/enabled: isBranchFilterReady/g)).toHaveLength(3);
    expect(cashierSource).toContain('params.set("branchId", branch)');
    expect(cashierSource).toContain('params.set("branchId", branchFilter)');
  });

  it("keeps the cashier manual selector while applying linked branch changes", () => {
    expect(cashierSource).toContain("useBranchNavigation(branches, branchesLoading, userBranchId)");
    expect(cashierSource).toContain("if (navigationBranch.hasBranchParam)");
    expect(cashierSource).toContain("onValueChange={setBranchFilter}");
  });

  it("scopes attendance employee choices, report, and print data to the resolved branch", () => {
    expect(attendanceSource).toContain("useBranchNavigation(branches, branchesLoading, userBranchId)");
    expect(attendanceSource).toContain("isAuthenticated && isBranchScopeReady");
    expect(attendanceSource).toContain("/api/branch-employees?branchId=");
    expect(attendanceSource).toContain("&branchId=${encodeURIComponent(branchFilter)}");
    expect(attendanceSource).toContain(
      "rawReport.rows.filter((row) => row.branchId === branchFilter)",
    );
    expect(attendanceSource).toContain('data-testid="select-branch"');
  });
});