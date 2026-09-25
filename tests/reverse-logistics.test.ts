import { describe, expect, it } from "vitest";
import {
  reverseCanonical, reverseInspectionAllowed, reverseMicros,
  reverseQuantityAllowed, reverseReceiptAllowed, reverseWriteoffAllowed, reverseReleaseLots,
} from "../shared/reverse-logistics";

describe("reverse logistics stock invariants", () => {
  it("caps cumulative returns at confirmed receipt (including fractional materials)", () => {
    expect(reverseQuantityAllowed(reverseMicros("0.500000"),reverseMicros("1.250000"),reverseMicros("0.750000"))).toBe(true);
    expect(reverseQuantityAllowed(reverseMicros("0.500001"),reverseMicros("1.250000"),reverseMicros("0.750000"))).toBe(false);
    expect(reverseQuantityAllowed(reverseMicros("1"),reverseMicros("0"),reverseMicros("0"))).toBe(false);
  });
  it("never receives more than shipped; keeps shortages as a separate quantity", () => {
    const shipped = reverseMicros(5), received = reverseMicros(3);
    expect(reverseReceiptAllowed(received,shipped)).toBe(true);
    expect(shipped - received).toBe(reverseMicros(2));
    expect(reverseReceiptAllowed(reverseMicros(6),shipped)).toBe(false);
    expect(reverseReceiptAllowed(reverseMicros(-1),shipped)).toBe(false);
  });
  it("requires inspection to account for all received units", () => {
    expect(reverseInspectionAllowed(reverseMicros(2),reverseMicros(1),reverseMicros(3))).toBe(true);
    expect(reverseInspectionAllowed(reverseMicros(2),reverseMicros(0),reverseMicros(3))).toBe(false);
    expect(reverseInspectionAllowed(reverseMicros(4),reverseMicros(1),reverseMicros(3))).toBe(false);
  });
  it("writeoff consumes only remaining damaged quarantine", () => {
    expect(reverseWriteoffAllowed(reverseMicros(1),reverseMicros(3),reverseMicros(2))).toBe(true);
    expect(reverseWriteoffAllowed(reverseMicros(1.000001),reverseMicros(3),reverseMicros(2))).toBe(false);
    expect(reverseWriteoffAllowed(reverseMicros(0),reverseMicros(3),reverseMicros(0))).toBe(false);
  });
  it("compares retries after JSONB key normalization, rejecting changed payload", () => {
    const first = { carrierName: "A", vehicleNumber: "B", idempotencyKey: "request-123" };
    expect(reverseCanonical(first)).toBe(reverseCanonical({ idempotencyKey: "request-123", vehicleNumber: "B", carrierName: "A" }));
    expect(reverseCanonical(first)).not.toBe(reverseCanonical({ ...first, carrierName: "C" }));
  });
  it("credits only source production dates, never a fabricated fresh lot", () => {
    const lots = [{ quantity:2,productionDate:"2024-01-01" },{ quantity:3,productionDate:"2024-01-02" }];
    expect(reverseReleaseLots(lots,4)).toEqual([{quantity:2,productionDate:"2024-01-01"},{quantity:2,productionDate:"2024-01-02"}]);
    expect(() => reverseReleaseLots(lots,6)).toThrow();
    expect(() => reverseReleaseLots([{quantity:1,productionDate:"unknown"}],1)).toThrow();
  });
});