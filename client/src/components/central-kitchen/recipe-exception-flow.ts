import type { RecipeException } from "@shared/recipe-exceptions";
import { recipeExceptionDecisionSchema, recipeExceptionRequestSchema } from "@shared/recipe-exceptions";

export type ExceptionBinding = {
  orderId: number;
  itemId: number;
  kitchenId: string;
  productId: number;
  unit: string;
  quantity: number;
  productionDate: string;
};

export function normalizeException(row: Record<string, unknown>): RecipeException {
  // Explicit API nulls (notably "not consumed") must survive normalization.
  const field = (camel: string, snake: string) => row[camel] !== undefined ? row[camel] : row[snake];
  return {
    id: Number(row.id),
    orderId: Number(field("orderId", "order_id")),
    itemId: Number(field("itemId", "item_id")),
    kitchenId: String(field("kitchenId", "kitchen_id")),
    productId: Number(field("productId", "product_id")),
    unit: String(row.unit),
    quantity: Number(row.quantity),
    productionDate: String(field("productionDate", "production_date")).slice(0, 10),
    reason: String(row.reason),
    requestedBy: String(field("requestedBy", "requested_by")),
    requestedAt: String(field("requestedAt", "requested_at")),
    status: row.status as RecipeException["status"],
    reviewedBy: field("reviewedBy", "reviewed_by") as string | null,
    reviewedAt: field("reviewedAt", "reviewed_at") as string | null,
    reviewReason: field("reviewReason", "review_reason") as string | null,
    consumedBatchId: field("consumedBatchId", "consumed_batch_id") as number | null,
    consumedAt: field("consumedAt", "consumed_at") as string | null,
  };
}

export function matchingApprovedException(exceptions: RecipeException[], binding: ExceptionBinding): RecipeException | undefined {
  return exceptions.find(exception =>
    exception.status === "approved"
    && !!exception.reviewedBy
    && exception.consumedBatchId === null
    && exception.orderId === binding.orderId
    && exception.itemId === binding.itemId
    && exception.kitchenId === binding.kitchenId
    && exception.productId === binding.productId
    && exception.unit === binding.unit
    && exception.quantity === binding.quantity
    && exception.productionDate === binding.productionDate
  );
}

export function exceptionRequestPayload(binding: ExceptionBinding, reason: string) {
  return recipeExceptionRequestSchema.parse({ quantity: binding.quantity, productionDate: binding.productionDate, reason: reason.trim() });
}

export function exceptionDecisionPayload(reason: string) {
  return recipeExceptionDecisionSchema.parse({ reason: reason.trim() });
}

export function linkedBatchPayload(binding: ExceptionBinding, recipeBacked: boolean, exceptions: RecipeException[], idempotencyKey: string) {
  if (!Number.isInteger(binding.quantity) || binding.quantity < 1 || !binding.productionDate) throw new Error("أدخل كمية صحيحة وتاريخ إنتاج.");
  if (recipeBacked) return { quantity: binding.quantity, productionDate: binding.productionDate, recipeBacked: true as const, idempotencyKey };
  const approved = matchingApprovedException(exceptions, binding);
  if (!approved) throw new Error("لا يوجد استثناء معتمد مطابق للبند والكمية والوحدة وتاريخ الإنتاج؛ اطلب اعتماداً جديداً.");
  return { quantity: binding.quantity, productionDate: binding.productionDate, recipeBacked: false as const, recipeExceptionId: approved.id, idempotencyKey };
}