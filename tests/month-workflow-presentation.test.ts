import { describe, expect, it } from "vitest";
import { lastCompletedOperationsMonth, monthMoney, monthWorkspaceKey, operationsMonthPeriod, validMonthSource } from "../client/src/components/operations-center/month-workflow-presentation";

describe("monthly workspace presentation boundaries", () => {
  it("starts with the completed month in Saudi time, including year rollover", () => {
    expect(lastCompletedOperationsMonth(new Date("2026-09-30T21:00:00Z"))).toBe("2026-09");
    expect(lastCompletedOperationsMonth(new Date("2026-09-30T20:59:00Z"))).toBe("2026-08");
    expect(lastCompletedOperationsMonth(new Date("2026-01-01T00:00:00Z"))).toBe("2025-12");
  });
  it("keeps absence different from a proven zero and preserves negative balances", () => {
    expect(monthMoney(null)).toBe("غير متاح");
    expect(monthMoney(0)).toBe("0 ر.س");
    expect(monthMoney(-120)).toBe("-120 ر.س");
  });
  it("requires exact month, selected branch and source route", () => {
    const origin = "https://example.test";
    expect(validMonthSource("/salary-closing?branch=one&month=2026-09", "one", "2026-09", origin)).toBe(true);
    expect(validMonthSource("/salary-closing?branchId=one&month=2026-09", "one", "2026-09", origin)).toBe(false);
    expect(validMonthSource("/pnl-dashboard?branchId=two&month=2026-09", "one", "2026-09", origin)).toBe(false);
    expect(validMonthSource("/sales-analytics?branchId=one&month=2026-08", "one", "2026-09", origin)).toBe(false);
    expect(validMonthSource("https://evil.test/salary-closing?branch=one&month=2026-09", "one", "2026-09", origin)).toBe(false);
    expect(validMonthSource("/hr-hub?branchId=one&month=2026-09", "one", "2026-09", origin)).toBe(false);
    expect(validMonthSource("/hr-hub?branchId=one&month=2026-09&tab=payroll", "one", "2026-09", origin)).toBe(true);
    expect(validMonthSource("/hr-hub?branchId=two&month=2026-09&tab=payroll", "one", "2026-09", origin)).toBe(false);
    expect(validMonthSource("/hr-hub?branchId=one&month=2026-08&tab=payroll", "one", "2026-09", origin)).toBe(false);
    expect(validMonthSource("/salary-closing?branch=one&branchId=two&month=2026-09", "one", "2026-09", origin)).toBe(false);
  });
  it("constrains the sales source to the real inclusive calendar dates, not only a month hint", () => {
    const origin = "https://example.test";
    const href = "/sales-analytics?branchId=one&month=2024-02&fromDate=2024-02-01&toDate=2024-02-29";
    expect(operationsMonthPeriod("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(operationsMonthPeriod("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(operationsMonthPeriod("2026-13")).toBeNull();
    expect(validMonthSource(href, "one", "2024-02", origin)).toBe(true);
    for (const unsafe of [
      href.replace("2024-02-29", "2024-02-28"),
      href.replace("2024-02-01", "2024-01-31"),
      href.replace("fromDate=2024-02-01&", ""),
      href.replace("toDate=2024-02-29", "toDate=2024-02-30"),
      `${href}&branchId=two`, `${href}&month=2024-03`, `${href}&fromDate=2024-01-01`,
      `${href}&toDate=2024-03-01`, `${href}&branch=two`,
    ]) expect(validMonthSource(unsafe, "one", "2024-02", origin)).toBe(false);
    expect(validMonthSource(href.replace("branchId=one", "branchId=all"), "all", "2024-02", origin)).toBe(false);
  });
  it("isolates actor, mode, complete authorization scope and month without order-sensitive keys", () => {
    const key = monthWorkspaceKey("actor-a", "all", "2026-09", ["b", "a"]);
    expect(key).toEqual(monthWorkspaceKey("actor-a", "all", "2026-09", ["a", "b"]));
    expect(key).not.toEqual(monthWorkspaceKey("actor-b", "all", "2026-09", ["a", "b"]));
    expect(key).not.toEqual(monthWorkspaceKey("actor-a", "a", "2026-09", ["a", "b"]));
    expect(key).not.toEqual(monthWorkspaceKey("actor-a", "all", "2026-09", ["a"]));
    expect(key).not.toEqual(monthWorkspaceKey("actor-a", "all", "2026-08", ["a", "b"]));
  });
});