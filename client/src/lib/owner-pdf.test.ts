import { describe, expect, it } from "vitest";
import { ownerDelta, ownerMoney, ownerNumber } from "./owner-pdf";

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
});