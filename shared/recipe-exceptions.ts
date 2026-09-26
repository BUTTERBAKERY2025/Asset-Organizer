import { z } from "zod";

export const recipeExceptionIdSchema = z.number().int().positive();
export const recipeExceptionRequestSchema = z.object({
  quantity: z.number().int().positive().max(1_000_000),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }),
  reason: z.string().trim().min(1).max(2000),
}).strict();
export const recipeExceptionDecisionSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
}).strict();
export type RecipeExceptionStatus = "pending" | "approved" | "rejected" | "consumed";
export type RecipeException = {
  id: number;
  orderId: number;
  itemId: number;
  kitchenId: string;
  productId: number;
  unit: string;
  quantity: number;
  productionDate: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: RecipeExceptionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  consumedBatchId: number | null;
  consumedAt: string | null;
};
// Responses return RecipeException in camelCase.
// GET /api/central-kitchen-orders/:id/recipe-exceptions -> { exceptions, canApprove }
// POST /api/central-kitchen-orders/:id/items/:itemId/recipe-exceptions
//   body: recipeExceptionRequestSchema -> RecipeException (201)
// POST /api/central-kitchen-orders/:id/recipe-exceptions/:exceptionId/approve|reject
//   body: recipeExceptionDecisionSchema -> RecipeException
// POST /api/central-kitchen-orders/:id/items/:itemId/production-batches
//   nonrecipe body: { recipeBacked: false, recipeExceptionId, quantity, productionDate, idempotencyKey }