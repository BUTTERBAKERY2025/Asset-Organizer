import { z } from "zod";

export const CENTRAL_KITCHEN_RECIPE_STATUSES = [
  "draft",
  "approved",
  "superseded",
] as const;

export type CentralKitchenRecipeStatus =
  (typeof CENTRAL_KITCHEN_RECIPE_STATUSES)[number];

const hasAtMostSixDecimalPlaces = (value: number): boolean => {
  const scaled = value * 1_000_000;
  return Math.abs(scaled - Math.round(scaled))
    <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
};

const positiveDecimal = z
  .union([
    z.number().finite().refine(
      hasAtMostSixDecimalPlaces,
      "Quantity may have at most 6 decimal places",
    ),
    z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,6})?$/, "Must be a decimal quantity"),
  ])
  .transform((value) => (typeof value === "number" ? value : Number(value)))
  .refine((value) => Number.isFinite(value) && value > 0, "Must be greater than zero")
  .refine((value) => value <= 1_000_000_000, "Quantity is too large");

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

export const centralKitchenRecipeIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid idempotency key");

export const centralKitchenRecipeIngredientSchema = z
  .object({
    warehouseItemId: z.number().int().positive(),
    quantity: positiveDecimal,
    unit: nonEmptyText(50),
  })
  .strict();

const centralKitchenRecipePayloadObject = z
  .object({
    kitchenId: nonEmptyText(255),
    productId: z.number().int().positive(),
    outputQuantity: positiveDecimal,
    outputUnit: nonEmptyText(50),
    notes: z.string().trim().max(2000).optional().nullable(),
    ingredients: z
      .array(centralKitchenRecipeIngredientSchema)
      .min(1)
      .max(500),
  }).strict();

function withUniqueIngredients<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value: z.infer<T>, ctx) => {
    const seen = new Set<number>();
    const ingredients = (value as {
      ingredients: Array<{ warehouseItemId: number }>;
    }).ingredients;
    ingredients.forEach((ingredient: { warehouseItemId: number }, index: number) => {
      if (seen.has(ingredient.warehouseItemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ingredients", index, "warehouseItemId"],
          message: "Each material may only appear once",
        });
      }
      seen.add(ingredient.warehouseItemId);
    });
  });
}

export const centralKitchenRecipePayloadSchema = withUniqueIngredients(
  centralKitchenRecipePayloadObject,
);

export const createCentralKitchenRecipeSchema = withUniqueIngredients(
  centralKitchenRecipePayloadObject.extend({
    idempotencyKey: centralKitchenRecipeIdempotencyKeySchema.optional(),
  }),
);

export const centralKitchenRecipeRevisionGuardSchema = z
  .object({
    version: z.number().int().positive(),
    updateToken: z.string().trim().min(16).max(128),
  })
  .strict();

export const updateCentralKitchenRecipeSchema = withUniqueIngredients(
  centralKitchenRecipePayloadObject
    .merge(centralKitchenRecipeRevisionGuardSchema)
    .extend({
      idempotencyKey: centralKitchenRecipeIdempotencyKeySchema.optional(),
    }),
);

export const centralKitchenRecipeActionSchema =
  centralKitchenRecipeRevisionGuardSchema.extend({
    idempotencyKey: centralKitchenRecipeIdempotencyKeySchema.optional(),
  });

export const centralKitchenRecipeListQuerySchema = z
  .object({
    kitchenId: nonEmptyText(255),
  })
  .strict();

export const centralKitchenRecipeCatalogQuerySchema = centralKitchenRecipeListQuerySchema;

export type CentralKitchenRecipePayload = z.infer<
  typeof centralKitchenRecipePayloadSchema
>;
export type CreateCentralKitchenRecipeInput = z.infer<
  typeof createCentralKitchenRecipeSchema
>;
export type UpdateCentralKitchenRecipeInput = z.infer<
  typeof updateCentralKitchenRecipeSchema
>;
export type CentralKitchenRecipeActionInput = z.infer<
  typeof centralKitchenRecipeActionSchema
>;

export type CentralKitchenRecipeIngredientContract = {
  id: number;
  warehouseItemId: number;
  name: string;
  quantity: number;
  unit: string;
};

export type CentralKitchenRecipeContract = {
  id: number;
  kitchenId: string;
  productId: number;
  productName: string;
  outputQuantity: number;
  outputUnit: string;
  notes: string | null;
  status: CentralKitchenRecipeStatus;
  version: number;
  updateToken: string;
  supersedesRecipeId: number | null;
  supersededByRecipeId: number | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  supersededAt: string | null;
  ingredients: CentralKitchenRecipeIngredientContract[];
};

export type CentralKitchenRecipeCatalogContract = {
  products: Array<{ id: number; name: string; unit: string }>;
  materials: Array<{ id: number; name: string; unit: string }>;
};

