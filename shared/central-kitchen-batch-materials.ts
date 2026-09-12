import { z } from "zod";

const EXACT_SCALE = 1_000_000n;

function decimalInputToScaled(value: number | string): bigint {
  const text = typeof value === "number"
    ? (() => {
        if (!Number.isFinite(value)) throw new Error("Quantity must be finite");
        const scaled = value * Number(EXACT_SCALE);
        if (Math.abs(scaled - Math.round(scaled)) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8) {
          throw new Error("Quantity may have at most 6 decimal places");
        }
        return (Math.round(scaled) / Number(EXACT_SCALE)).toFixed(6);
      })()
    : value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) {
    throw new Error("Quantity must be a decimal with at most 6 decimal places");
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * EXACT_SCALE + BigInt((fraction + "000000").slice(0, 6));
}

/** Formats an exact NUMERIC(18,6) value without using floating point arithmetic. */
export function formatExact6(value: bigint): string {
  if (value < 0n) throw new Error("Quantity cannot be negative");
  const whole = value / EXACT_SCALE;
  const fraction = (value % EXACT_SCALE).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

/**
 * Calculates ingredient * batch output / recipe output in integer micro-units.
 * A non-zero remainder is rejected rather than rounded because stock movements
 * must remain exactly representable by NUMERIC(18,6).
 */
export function scaleRecipeRequirementExact(
  ingredientQuantity: number | string,
  recipeOutputQuantity: number | string,
  batchOutputQuantity: number | string,
): string {
  const ingredient = decimalInputToScaled(ingredientQuantity);
  const output = decimalInputToScaled(recipeOutputQuantity);
  const batch = decimalInputToScaled(batchOutputQuantity);
  if (ingredient <= 0n || output <= 0n || batch <= 0n) {
    throw new Error("Quantity must be greater than zero");
  }
  const numerator = ingredient * batch;
  if (numerator % output !== 0n) {
    throw new Error("Scaled material quantity cannot be represented exactly with 6 decimal places");
  }
  const result = numerator / output;
  // NUMERIC(18,6) permits twelve digits before its decimal point.
  if (result > 999_999_999_999_999_999n) {
    throw new Error("Scaled material quantity is too large");
  }
  return formatExact6(result);
}

const decimalQuantity = z.union([
  z.number().finite().positive().refine((value) => {
    const scaled = value * 1_000_000;
    return Math.abs(scaled - Math.round(scaled))
      <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  }, "Quantity may have at most 6 decimal places"),
  z.string().trim().regex(/^\d+(?:\.\d{1,6})?$/, "Invalid decimal quantity"),
]).transform((value) => Number(value))
  .refine((value) => value > 0 && value <= 1_000_000_000, "Invalid quantity");

const idempotencyKey = z.string().trim().min(8).max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid idempotency key");

export const centralKitchenMaterialRequirementsQuerySchema = z.object({
  kitchenId: z.string().trim().min(1).max(255),
  productId: z.coerce.number().int().positive(),
  quantity: decimalQuantity,
}).strict();

export const centralKitchenBatchRequirementsParamsSchema = z.object({
  batchId: z.coerce.number().int().positive(),
}).strict();

/** Browser payload for a new linked central-kitchen production batch. */
export const centralKitchenRecipeBackedBatchCreateSchema = z.object({
  // daily_production_batches.quantity remains an integer. Ingredients and
  // recipe output are decimal; do not accept output this table cannot store.
  quantity: z.number().finite().int().positive().max(1_000_000),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipeBacked: z.boolean().default(false),
  idempotencyKey,
}).strict();

export type CentralKitchenMaterialRequirement = {
  warehouseItemId: number;
  materialName: string;
  unit: string;
  recipeQuantity: string;
  requiredQuantity: string;
  currentQuantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  shortageQuantity: string;
};

export type CentralKitchenRecipeSource = {
  recipeId: number;
  recipeVersion: number;
  source: "approved_recipe";
  outputQuantity: string;
  outputUnit: string;
};

export type CentralKitchenMaterialRequirementsContract = {
  kitchenId: string;
  productId: number;
  batchQuantity: string;
  recipeBacked: boolean;
  recipe: CentralKitchenRecipeSource | null;
  requirements: CentralKitchenMaterialRequirement[];
  /** Actual immutable-ledger state; never inferred from a batch status. */
  materialConsumptionStatus: "not_applicable" | "pending" | "consumed";
  consumedAt?: string;
  message?: string;
};

export type CentralKitchenRecipeBackedBatchCreateInput = z.infer<
  typeof centralKitchenRecipeBackedBatchCreateSchema
>;