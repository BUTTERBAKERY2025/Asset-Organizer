import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createOperationsHrCommandGuard, operationsHrSelectionHref, operationsHrSelectionIntent, operationsPayrollReportReady, validOperationsPayrollMonth } from "../client/src/lib/operations-hr-state";
import { operationsCenterReturnHref } from "../client/src/lib/operations-center-navigation";

describe("operations HR selection and fresh-command boundaries", () => {
  const search = "?branchId=a&month=2026-09&tab=payroll&from=operations-center&centerBranchIds=a,b&centerWorkspace=monthly&centerMonth=2026-09&centerMonthBranchId=a&centerMonthFile=payroll";
  it("updates the actual receiving URL and existing breadcrumb, preserving the explicit center scope", () => {
    const url = new URL(operationsHrSelectionHref("/hr-hub", search, "b", "2026-08", "payroll", ["a", "b"]), "https://app.test");
    expect(url.searchParams.get("branchId")).toBe("b");
    expect(url.searchParams.get("month")).toBe("2026-08");
    expect(url.searchParams.get("centerBranchIds")).toBe("a,b");
    expect(operationsCenterReturnHref(url.search, ["a", "b"]))
      .toBe("/operations-center?branchIds=a%2Cb&workspace=monthly&month=2026-08&monthBranchId=b&monthFile=payroll");
    const employees = new URL(operationsHrSelectionHref(url.pathname, url.search, "b", "2026-08", "employees", ["a", "b"]), url.origin);
    expect(employees.searchParams.get("tab")).toBe("employees");
    expect(employees.searchParams.get("centerMonthFile")).toBe("payroll");
  });
  it("never substitutes a denied requested branch and clears invalid monthly-return detail", () => {
    const url = new URL(operationsHrSelectionHref("/hr-hub", search, "denied", "", "payroll", ["a"]), "https://app.test");
    expect(url.searchParams.get("branchId")).toBe("denied");
    expect(url.searchParams.get("month")).toBe("");
    expect(url.searchParams.has("centerMonthBranchId")).toBe(false);
    expect(operationsCenterReturnHref(url.search, ["a"])).toBe("/operations-center?branchIds=a");
  });
  it("does not manufacture center context for direct HR navigation", () => {
    const url = new URL(operationsHrSelectionHref("/hr-hub", "", "a", "2026-09", "payroll", ["a"]), "https://app.test");
    expect(url.searchParams.has("from")).toBe(false);
    expect(url.searchParams.has("centerWorkspace")).toBe(false);
  });
  it("uses incoming external URL intent immediately, instead of writing the previous mounted selection back", () => {
    const first = operationsHrSelectionIntent("?branchId=a&month=2026-09&tab=employees", "2026-10");
    expect(first).toEqual({ branchId: "a", month: "2026-09", tab: "employees" });
    const external = "?branchId=b&month=2026-08&tab=payroll&from=operations-center&centerWorkspace=monthly";
    const next = operationsHrSelectionIntent(external, "2026-10");
    expect(next).toEqual({ branchId: "b", month: "2026-08", tab: "payroll" });
    const href = operationsHrSelectionHref("/hr-hub", external, next.branchId, next.month, next.tab, ["a", "b"]);
    expect(operationsHrSelectionIntent(new URL(href, "https://app.test").search, "2026-10")).toEqual(next);
    const denied = operationsHrSelectionIntent("?branchId=denied&month=&tab=payroll", "2026-10");
    expect(denied).toEqual({ branchId: "denied", month: "", tab: "payroll" });
    expect(operationsHrSelectionIntent(new URL(operationsHrSelectionHref("/hr-hub", "", denied.branchId, denied.month, denied.tab, ["a"]), "https://app.test").search, "2026-10")).toEqual(denied);
  });
  it("user selectors write URL intent without competing with external navigation or losing center scope", () => {
    const href = operationsHrSelectionHref("/hr-hub", search, "b", "2026-07", "employees", ["a", "b"]);
    const nextSearch = new URL(href, "https://app.test").search;
    expect(operationsHrSelectionIntent(nextSearch, "2026-10")).toEqual({ branchId: "b", month: "2026-07", tab: "employees" });
    expect(new URLSearchParams(nextSearch).get("centerBranchIds")).toBe("a,b");
  });
  it.each(["", "2026-00", "2026-13", "2026-1", "2026-09-x", "2026-09-01", "NaN"])("rejects invalid payroll month %s", month => {
    expect(validOperationsPayrollMonth(month)).toBe(false);
  });
  it("requires the current authorized valid report to finish fetching before export/review", () => {
    const fresh = { authorizedBranch: true, month: "2026-09", fetching: false, error: false, hasData: true };
    expect(operationsPayrollReportReady(fresh)).toBe(true);
    for (const patch of [{ month: "" }, { authorizedBranch: false }, { fetching: true }, { error: true }, { hasData: false }]) {
      expect(operationsPayrollReportReady({ ...fresh, ...patch })).toBe(false);
    }
  });
  it("ignores late success/error/link/download results after branch/month/tab changes, even A→B→A", () => {
    const guard = createOperationsHrCommandGuard();
    guard.update("a:2026-09:payroll");
    const first = guard.capture();
    expect(guard.isCurrent(first)).toBe(true);
    guard.update("b:2026-09:payroll");
    guard.update("a:2026-09:payroll");
    expect(guard.isCurrent(first)).toBe(false);
    const second = guard.capture();
    guard.update("a:2026-08:payroll");
    expect(guard.isCurrent(second)).toBe(false);
    const third = guard.capture();
    guard.update("a:2026-08:employees");
    expect(guard.isCurrent(third)).toBe(false);
    const fourth = guard.capture();
    guard.invalidate();
    expect(guard.isCurrent(fourth)).toBe(false);
  });
  it("wires URL sync and freshness guards into the actual page, with a monthly return affordance", () => {
    const source = readFileSync("client/src/pages/operations-hr.tsx", "utf8");
    expect(source).toContain("operationsHrSelectionHref(pathname, search");
    expect(source).toContain("operationsHrSelectionIntent(search, defaultMonth)");
    expect(source).not.toContain("[branchSelection, setBranchSelection] = useState");
    expect(source).toContain("navigate(next, { replace: true })");
    expect(source).toContain('if (!branch || !reportReady || !canApprove("operations_payroll")');
    expect(source).toContain('if (!branch || !reportReady || !canExport("operations_payroll")');
    expect(source).toContain("enabled: authorizedBranch && validMonth");
    expect(source).toContain("peopleSourceIntent(sourceUrl, authorizedIds)");
    expect(source).toContain("preserveMonthlyAllReturn(");
    expect(source).not.toContain('data-testid="return-to-month-workspace"');
  });
});