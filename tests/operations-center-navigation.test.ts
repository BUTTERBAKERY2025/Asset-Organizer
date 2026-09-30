import { describe, expect, it } from "vitest";
import { attachCenterContext, monthlyReturnIntent, operationsCenterReturnHref, salaryBranchIntent, withMonthlyReturn } from "../client/src/lib/operations-center-navigation";

describe("operations monthly sender/receiver navigation contract", () => {
  const origin = "https://bakery.test";
  it("salary receiver accepts both names and refuses conflicting or empty explicit intent", () => {
    expect(salaryBranchIntent("?branch=one").branch).toBe("one");
    expect(salaryBranchIntent("?branchId=one").branch).toBe("one");
    expect(salaryBranchIntent("?branch=one&branchId=one").conflict).toBe(false);
    expect(salaryBranchIntent("?branch=one&branchId=two")).toEqual({ branch: "", explicit: true, conflict: true });
    expect(salaryBranchIntent("?branch=")).toEqual({ branch: "", explicit: true, conflict: false });
    expect(salaryBranchIntent("")).toEqual({ branch: "", explicit: false, conflict: false });
  });
  it("sender sets the salary receiving branch and preserves month, without replacing conflicting scope", () => {
    const url = new URL("/salary-closing?month=2026-09", origin);
    attachCenterContext(url, "one", ["one", "two"]);
    expect(url.searchParams.get("branch")).toBe("one");
    expect(url.searchParams.get("branchId")).toBe("one");
    expect(url.searchParams.get("month")).toBe("2026-09");
    expect(() => attachCenterContext(new URL("/salary-closing?branch=two", origin), "one", ["one"])).toThrow();
    expect(() => attachCenterContext(new URL("/salary-closing?branch=one&branchId=two", origin), "one", ["one"])).toThrow();
  });
  it.each([
    ["/hr-hub?branchId=one&month=2026-09&tab=payroll", "payroll"],
    ["/salary-closing?branch=one&month=2026-09", "payroll"],
    ["/pnl-dashboard?branchId=one&month=2026-09", "expenses"],
    ["/branch-daily-closures/42?branchId=one", "closing"],
    ["/sales-analytics?branchId=one&month=2026-09", "sales"],
  ] as const)("roundtrips %s to the same monthly branch, scope, month and file", (href, file) => {
    const destination = new URL(withMonthlyReturn(href, "one", "2026-09", file, origin), origin);
    attachCenterContext(destination, "one", ["one", "two"]);
    const back = new URL(operationsCenterReturnHref(destination.search, ["one", "two"]), origin);
    expect(back.pathname).toBe("/operations-center");
    expect(back.searchParams.get("branchIds")).toBe("one,two");
    expect(monthlyReturnIntent(back.search, ["one", "two"])).toEqual({
      monthly: true, month: "2026-09", branchId: "one", file,
    });
    if (destination.pathname === "/hr-hub") expect(destination.searchParams.get("tab")).toBe("payroll");
  });
  it("filters revoked return scope and never restores a revoked month branch", () => {
    const search = "?from=operations-center&centerBranchIds=one,two&centerWorkspace=monthly&centerMonth=2026-09&centerMonthBranchId=one&centerMonthFile=payroll";
    expect(operationsCenterReturnHref(search, ["two"])).toBe("/operations-center?branchIds=two");
    expect(monthlyReturnIntent("?workspace=monthly&month=2026-09&monthBranchId=one", ["two"]).branchId).toBe("");
  });
  it("rejects external destinations and malformed return fields", () => {
    expect(() => withMonthlyReturn("https://evil.test/pnl-dashboard", "one", "2026-09", "expenses", origin)).toThrow();
    expect(operationsCenterReturnHref("?centerWorkspace=monthly&centerMonth=2026-99&centerMonthBranchId=one", ["one"])).toBe("/operations-center");
    expect(monthlyReturnIntent("?workspace=monthly&month=2026-09&monthBranchId=one&monthFile=unknown", ["one"]).file).toBeNull();
  });
});