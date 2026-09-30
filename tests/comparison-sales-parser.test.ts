import { describe, expect, it } from "vitest";
import { comparisonSalesFingerprint, parseComparisonSalesRows, SalesFileValidationError } from "../server/comparison-sales-parser";

const row = (overrides: Record<string, unknown> = {}) =>
  ({ Date: "2026-02-28", "Product Name": "Latte", Quantity: 2, "Sales Value": 20, ...overrides });

describe("comparison sales file validation", () => {
  it("rejects invalid dates rather than falling back to today", () => {
    expect(() => parseComparisonSalesRows([row({ Date: "2026-02-30" })], undefined)).toThrow(SalesFileValidationError);
    expect(() => parseComparisonSalesRows([row({ Date: null })], "2026-02-30")).toThrow();
    expect(() => parseComparisonSalesRows([row({ Date: "2026-02-28" })], "2026-02-30")).toThrow();
    expect(parseComparisonSalesRows([row({ Date: null })], "2026-03-01")[0].salesDate).toBe("2026-03-01");
  });

  it("rejects the entire file on any invalid row, including fractions, negatives and partial numerics", () => {
    for (const bad of [row({ Quantity: 1.5 }), row({ Quantity: "-1" }), row({ Quantity: "2pieces" }), row({ Quantity: null }), row({ "Sales Value": "Infinity" }), row({ "Product Name": "" })]) {
      expect(() => parseComparisonSalesRows([row(), bad], undefined)).toThrow(/صف 3/);
    }
  });

  it("treats reordering as a retry while preserving repeated lines", () => {
    const a = parseComparisonSalesRows([row(), row({ "Product Name": "Mocha" })], undefined);
    const b = parseComparisonSalesRows([row({ "Product Name": "Mocha" }), row()], undefined);
    expect(comparisonSalesFingerprint(a)).toBe(comparisonSalesFingerprint(b));
    expect(comparisonSalesFingerprint(a)).not.toBe(comparisonSalesFingerprint([...a, a[0]]));
  });
});