import { describe, expect, it } from "vitest";
import { ownerComparison, ownerCoverageWarning, ownerDelta, ownerMoney, ownerNumber, ownerRiyadhDate } from "./owner-pdf";
import type { OwnerSalesResponse } from "@shared/owner-portal";

const sales = (totals: OwnerSalesResponse["totals"]): OwnerSalesResponse => ({
  latestReportDate: null, sourceLabel: "يوميات", generatedAt: "", dateFrom: "", dateTo: "", totals, branches: [],
});

describe("owner reporting labels", () => {
  it("does not treat a missing branch report as zero sales", () => {
    expect(ownerMoney(null)).toBe("لا يوجد تقرير");
    expect(ownerMoney(0)).not.toBe(ownerMoney(null));
  });
  it("does not invent a comparison without a previous period", () => {
    expect(ownerDelta(215, null)).toContain("لا تتوفر");
    expect(ownerDelta(215, 0)).toContain("لا يمكن");
    expect(ownerDelta(215, 200)).toContain("+");
  });
  it("formats fractional monetary data without rounding it to an integer", () => {
    expect(ownerNumber(87.5)).toContain("87");
    expect(ownerMoney(87.5)).toContain("ر.س");
  });
  it("only compares complete, explicitly comparable coverage and warns on gaps", () => {
    const totals = { sales: 215, previousSales: 200, branchCount: 3, reportedBranches: 2, previousReportedBranches: 1, journalCount: 2, comparisonComparable: false };
    expect(ownerComparison(sales(totals))).not.toContain("+");
    expect(ownerCoverageWarning(sales(totals))).toContain("السابقة");
    expect(ownerComparison(sales({ ...totals, comparisonComparable: true }))).toContain("+");
    expect(ownerComparison(sales({ ...totals, comparisonComparable: undefined }))).not.toContain("+");
  });
  it("uses Riyadh dates at the UTC day boundary", () => {
    expect(ownerRiyadhDate(new Date("2026-02-01T21:30:00Z"))).toBe("2026-02-02");
  });
});