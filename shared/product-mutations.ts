import { z } from "zod";

const optionalNullableText = z.string().trim().max(500).nullable().optional();
const optionalPrice = z.number().finite().nonnegative().nullable().optional();

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(250).optional(),
  nameEn: optionalNullableText,
  sku: z.string().trim().min(1).max(100).nullable().optional(),
  category: z.string().trim().min(1).max(100).optional(),
  productType: z.enum(["finish", "inventory"]).optional(),
  unit: z.string().trim().min(1).max(100).optional(),
  basePrice: optionalPrice,
  priceExclVat: optionalPrice,
  vatAmount: optionalPrice,
  vatRate: z.number().finite().min(0).max(1).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  operationsEnabled: z.boolean().optional(),
  saleEnabled: z.boolean().optional(),
  description: optionalNullableText,
  notes: optionalNullableText,
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one mutable product field is required",
});

export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export function normalizeProductMutationInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const normalized = { ...(input as Record<string, unknown>) };
  if (typeof normalized.isActive === "boolean") {
    normalized.isActive = normalized.isActive ? "true" : "false";
  }
  if (typeof normalized.sku === "string") {
    normalized.sku = normalized.sku.trim() || null;
  }
  return normalized;
}

export function isProductConflictError(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}