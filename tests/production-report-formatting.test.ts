import { describe, expect, it } from "vitest";
import { csvCell, formatQuantity6 } from "../client/src/components/production/operations-report";

describe("production report formatting", () => {
  it("preserves six-decimal quantities and distinguishes unavailable from zero", () => {
    expect(formatQuantity6(0.123456)).toBe("0.123456");
    expect(formatQuantity6(0)).toBe("0");
    expect(formatQuantity6(null)).toBe("غير متاح");
  });

  it.each(["=1+1", "+1+1", "-1+1", "@SUM(A1)", "\t=1+1", "\r\n@SUM(A1)", "  =1+1", "\u0000=1+1", "\uFEFF=1+1"])(
    "neutralizes spreadsheet formulas including hidden prefixes: %j",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );

  it("quotes commas, newlines and quotes without losing Arabic names", () => {
    expect(csvCell('دقيق، "فاخر"\nكيلو')).toBe('"دقيق، ""فاخر""\nكيلو"');
    expect(csvCell(0.123456)).toBe('"0.123456"');
  });
});