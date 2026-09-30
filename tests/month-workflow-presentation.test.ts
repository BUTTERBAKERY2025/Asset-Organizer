import { describe, expect, it } from "vitest";
import { lastCompletedOperationsMonth, monthMoney, validMonthSource } from "../client/src/components/operations-center/month-workflow-presentation";

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
  });
});