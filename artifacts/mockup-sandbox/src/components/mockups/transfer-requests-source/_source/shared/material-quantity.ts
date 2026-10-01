import { z } from "zod";

/**
 * Material balances are stored as NUMERIC(18, 6).  Keeping the boundary here
 * avoids passing binary floating-point tails (for example, 0.1 + 0.2) to SQL
 * while rejecting input that would require a database-side rounding.
 */
export const MATERIAL_QUANTITY_SCALE = 1_000_000;
export const MATERIAL_QUANTITY_MAX = 1_000_000_000;

const SCALE_EPSILON = 0.0000001;

export function materialQuantityToScaled(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("Material quantity must be finite");
  }
  if (Math.abs(value) > MATERIAL_QUANTITY_MAX) {
    throw new RangeError("Material quantity is too large");
  }

  const scaled = value * MATERIAL_QUANTITY_SCALE;
  const rounded = Math.round(scaled);
  if (
    !Number.isSafeInteger(rounded)
    || Math.abs(scaled - rounded) > SCALE_EPSILON
  ) {
    throw new RangeError("Material quantity may have at most 6 decimal places");
  }
  return rounded;
}

export function normalizeMaterialQuantity(value: number): number {
  return materialQuantityToScaled(value) / MATERIAL_QUANTITY_SCALE;
}

export function addMaterialQuantities(left: number, right: number): number {
  const total = materialQuantityToScaled(left) + materialQuantityToScaled(right);
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("Material quantity is too large");
  }
  return total / MATERIAL_QUANTITY_SCALE;
}

export function subtractMaterialQuantities(left: number, right: number): number {
  const difference = materialQuantityToScaled(left) - materialQuantityToScaled(right);
  if (!Number.isSafeInteger(difference)) {
    throw new RangeError("Material quantity is too large");
  }
  return difference / MATERIAL_QUANTITY_SCALE;
}

const materialQuantityBaseSchema = z
  .number()
  .finite("Material quantity must be finite")
  .refine(
    (value) => {
      try {
        materialQuantityToScaled(value);
        return true;
      } catch {
        return false;
      }
    },
    "Material quantity may have at most 6 decimal places and must be within range",
  )
  .transform(normalizeMaterialQuantity);

export const materialQuantitySchema = materialQuantityBaseSchema;

export const nonnegativeMaterialQuantitySchema = materialQuantityBaseSchema.refine(
  (value) => value >= 0,
  "Material quantity must not be negative",
);

export const positiveMaterialQuantitySchema = materialQuantityBaseSchema.refine(
  (value) => value > 0,
  "Material quantity must be greater than zero",
);

// Adjustment rows may carry a signed delta.  Zero is not a movement and is
// deliberately omitted from delivery audit posting.
export const nonzeroMaterialQuantitySchema = materialQuantityBaseSchema.refine(
  (value) => value !== 0,
  "Material movement quantity must not be zero",
);