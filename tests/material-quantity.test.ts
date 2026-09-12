import { describe, expect, it } from "vitest";
import {
  addMaterialQuantities,
  materialQuantitySchema,
  nonzeroMaterialQuantitySchema,
  nonnegativeMaterialQuantitySchema,
  normalizeMaterialQuantity,
  positiveMaterialQuantitySchema,
  subtractMaterialQuantities,
} from "../shared/material-quantity";
import {
  insertBranchStockSchema,
  insertMaterialTransferItemSchema,
} from "../shared/schema";

describe("material quantities", () => {
  it("normalizes binary floating-point additions to an exact six-decimal quantity", () => {
    expect(normalizeMaterialQuantity(0.1 + 0.2)).toBe(0.3);
    expect(addMaterialQuantities(0.1, 0.2)).toBe(0.3);
    expect(subtractMaterialQuantities(0.3, 0.1)).toBe(0.2);
  });

  it("rejects overprecision rather than rounding it", () => {
    expect(materialQuantitySchema.safeParse(1.1234567).success).toBe(false);
    expect(insertMaterialTransferItemSchema.safeParse({
      transferId: 1,
      itemId: 1,
      itemName: "دقيق",
      category: "raw",
      unit: "كجم",
      quantity: 1.1234567,
    }).success).toBe(false);
    expect(() => normalizeMaterialQuantity(1.1234567)).toThrow(
      "at most 6 decimal places",
    );
  });

  it("keeps zero and null semantics explicit", () => {
    expect(nonnegativeMaterialQuantitySchema.safeParse(0).success).toBe(true);
    expect(positiveMaterialQuantitySchema.safeParse(0).success).toBe(false);
    expect(nonzeroMaterialQuantitySchema.safeParse(-0.25).success).toBe(true);
    expect(nonzeroMaterialQuantitySchema.safeParse(0).success).toBe(false);
    expect(materialQuantitySchema.safeParse(null).success).toBe(false);
    expect(nonnegativeMaterialQuantitySchema.nullable().parse(null)).toBeNull();
    expect(insertBranchStockSchema.safeParse({
      branchId: "branch-1",
      itemId: 1,
      currentQuantity: null,
      dailyConsumption: null,
    }).success).toBe(true);
  });

  it("keeps material transfer schema quantities as normalized numbers", () => {
    const parsed = insertMaterialTransferItemSchema.parse({
      transferId: 1,
      itemId: 1,
      itemName: "دقيق",
      category: "raw",
      unit: "كجم",
      quantity: 0.1 + 0.2,
      receivedQuantity: 0,
    });
    expect(parsed.quantity).toBe(0.3);
    expect(parsed.receivedQuantity).toBe(0);
  });
});