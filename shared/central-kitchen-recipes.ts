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

/**
 * Import values are deliberately kept separate from the normal recipe
 * payload.  A source row may be incomplete (or may contain a quantity which
 * needs a human acknowledgement), whereas the create/update schemas above
 * only accept a complete catalog recipe.
 */
export const CENTRAL_KITCHEN_RECIPE_IMPORT_UNRESOLVED_MARKER = "UNRESOLVED";

export type CentralKitchenRecipeImportSourceIngredient = {
  rawName: string;
  rawQuantity: string | null;
  rawUnit: string | null;
  issue?: string | null;
};

export type CentralKitchenRecipeImportSource = {
  sourceId: string;
  name: string;
  suggestedProductName: string;
  outputQuantity: number | null;
  outputUnit: string | null;
  rawSourceText: string;
  ingredients: CentralKitchenRecipeImportSourceIngredient[];
  issues?: string[];
};

export type CentralKitchenRecipeImportCatalogItem = {
  id: number;
  name: string;
  unit: string;
};

export type CentralKitchenRecipeImportIngredientContract = {
  sourceName: string;
  sourceQuantity: string;
  sourceUnit: string;
  warehouseItemId: number | null;
  quantity: number | null;
  unit: string | null;
  issue: string | null;
};

export type CentralKitchenRecipeImportContract = {
  sourceId: string;
  name: string;
  suggestedProductName: string;
  outputQuantity: number | null;
  outputUnit: string | null;
  rawSourceText: string;
  productId: number | null;
  ingredients: CentralKitchenRecipeImportIngredientContract[];
  issues: string[];
};

export type CentralKitchenRecipeImportCatalog = {
  products: CentralKitchenRecipeImportCatalogItem[];
  materials: CentralKitchenRecipeImportCatalogItem[];
};

/**
 * This is intentionally conservative.  It handles punctuation, casing and
 * accents only; it does not perform fuzzy matching or translate a product
 * into another product.
 */
export function normalizeCentralKitchenRecipeImportName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function containsCentralKitchenRecipeImportUnresolvedMarker(value: unknown): boolean {
  return typeof value === "string"
    && value.toLocaleUpperCase("en-US").includes(CENTRAL_KITCHEN_RECIPE_IMPORT_UNRESOLVED_MARKER);
}

export function findStrictCentralKitchenRecipeImportMatches(
  sourceName: string,
  catalog: CentralKitchenRecipeImportCatalogItem[],
  aliases: Record<string, string[]> = {},
): CentralKitchenRecipeImportCatalogItem[] {
  const sourceKey = normalizeCentralKitchenRecipeImportName(sourceName);
  const acceptedNames = new Set([
    sourceKey,
    ...(aliases[sourceKey] || []).map(normalizeCentralKitchenRecipeImportName),
  ]);
  return catalog.filter((item) => acceptedNames.has(
    normalizeCentralKitchenRecipeImportName(item.name),
  ));
}

