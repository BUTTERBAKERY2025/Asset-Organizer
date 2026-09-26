import type { Express, Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { centralKitchenOrders, centralKitchenOrderItems } from "@shared/schema";
import { recipeExceptionDecisionSchema, recipeExceptionRequestSchema, type RecipeException } from "@shared/recipe-exceptions";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated, requirePermission, canAccessBranch } from "./auth";

export class RecipeExceptionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

const id = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const timestamp = (value: unknown): string | null =>
  value == null ? null : (value instanceof Date ? value : new Date(String(value))).toISOString();
export function serializeRecipeException(row: Record<string, any>): RecipeException {
  return {
    id: Number(row.id), orderId: Number(row.order_id), itemId: Number(row.item_id),
    kitchenId: row.kitchen_id, productId: Number(row.product_id), unit: row.unit,
    quantity: Number(row.quantity), productionDate: row.production_date,
    reason: row.reason, requestedBy: row.requested_by, requestedAt: timestamp(row.requested_at)!,
    status: row.status, reviewedBy: row.reviewed_by, reviewedAt: timestamp(row.reviewed_at),
    reviewReason: row.review_reason, consumedBatchId: row.consumed_batch_id == null ? null : Number(row.consumed_batch_id),
    consumedAt: timestamp(row.consumed_at),
  };
}
async function loadOrder(req: Request, orderId: number, itemId?: number) {
  const [order] = await db.select().from(centralKitchenOrders).where(eq(centralKitchenOrders.id, orderId)).limit(1);
  if (!order) throw new RecipeExceptionError("الطلب غير موجود", 404);
  if (!(await canAccessBranch(req, order.centralKitchenId))) throw new RecipeExceptionError("لا يمكن الوصول إلى هذا المطبخ", 403);
  let item: typeof centralKitchenOrderItems.$inferSelect | undefined;
  if (itemId) {
    [item] = await db.select().from(centralKitchenOrderItems)
      .where(and(eq(centralKitchenOrderItems.id, itemId), eq(centralKitchenOrderItems.orderId, orderId))).limit(1);
    if (!item) throw new RecipeExceptionError("بند الطلب غير موجود", 404);
  }
  return { order, item };
}
async function mayApprove(req: Request) {
  const user = req.currentUser!;
  // Requesting and approving by the same responsible person is intentionally
  // permitted: responsibility and live approval rights, not a role title alone,
  // determine eligibility. Ordinary production edit/create cannot approve.
  return (user.role === "admin" || user.role === "production_manager" || user.role === "production_development_manager")
    && (user.role === "admin" || user.role === "production_development_manager"
      || await storage.hasPermission(user.id, "production", "approve"));
}
function handled(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof RecipeExceptionError) return res.status(error.status).json({ error: error.message });
      console.error("Recipe exception request failed:", error);
      return res.status(500).json({ error: "تعذر معالجة استثناء الوصفة" });
    }
  };
}

export async function assertApprovedRecipeException(tx: any, input: {
  exceptionId: number; orderId: number; itemId: number; kitchenId: string;
  productId: number; unit: string; quantity: number; productionDate: string;
}) {
  const result = await tx.execute(sql`SELECT * FROM central_kitchen_recipe_exceptions WHERE id = ${input.exceptionId} FOR UPDATE`);
  const ex = result.rows[0];
  if (!ex || ex.status !== "approved" || !ex.reviewed_by ||
      Number(ex.order_id) !== input.orderId || Number(ex.item_id) !== input.itemId ||
      ex.kitchen_id !== input.kitchenId || Number(ex.product_id) !== input.productId ||
      ex.unit !== input.unit || Number(ex.quantity) !== input.quantity ||
      ex.production_date !== input.productionDate) {
    throw new RecipeExceptionError("الاستثناء غير معتمد أو لا يطابق الدفعة المطلوبة");
  }
}

export function registerRecipeExceptionRoutes(app: Express) {
  const base = "/api/central-kitchen-orders/:id";
  app.get(`${base}/recipe-exceptions`, isAuthenticated, requirePermission("production", "view"), handled(async (req, res) => {
    const orderId = id(req.params.id);
    if (!orderId) throw new RecipeExceptionError("معرف طلب غير صالح", 400);
    await loadOrder(req, orderId);
    const rows = await db.execute(sql`SELECT * FROM central_kitchen_recipe_exceptions WHERE order_id = ${orderId} ORDER BY id DESC`);
    res.set("Cache-Control", "private, no-store");
    res.json({ exceptions: rows.rows.map(serializeRecipeException), canApprove: await mayApprove(req) });
  }));
  app.post(`${base}/items/:itemId/recipe-exceptions`, isAuthenticated, requirePermission("production", "create"), handled(async (req, res) => {
    const orderId = id(req.params.id), itemId = id(req.params.itemId);
    const parsed = recipeExceptionRequestSchema.safeParse(req.body);
    if (!orderId || !itemId || !parsed.success) throw new RecipeExceptionError("بيانات الاستثناء غير صالحة", 400);
    const { order, item } = await loadOrder(req, orderId, itemId);
    if (order.status !== "approved" || order.inventoryMode !== "real" || !item?.productId || item.warehouseItemId) {
      throw new RecipeExceptionError("يجب أن يكون البند منتجاً ضمن طلب حقيقي معتمد");
    }
    const { quantity, productionDate, reason } = parsed.data;
    const result = await db.execute(sql`INSERT INTO central_kitchen_recipe_exceptions
      (order_id, item_id, kitchen_id, product_id, unit, quantity, production_date, reason, requested_by)
      VALUES (${orderId}, ${itemId}, ${order.centralKitchenId}, ${item.productId}, ${item.unit},
        ${quantity}, ${productionDate}, ${reason}, ${req.currentUser!.id}) RETURNING *`);
    res.status(201).json(serializeRecipeException(result.rows[0]));
  }));
  for (const decision of ["approve", "reject"] as const) {
    app.post(`${base}/recipe-exceptions/:exceptionId/${decision}`,
      isAuthenticated, requirePermission("production", "approve"), handled(async (req, res) => {
        const orderId = id(req.params.id), exceptionId = id(req.params.exceptionId);
        const parsed = recipeExceptionDecisionSchema.safeParse(req.body);
        if (!orderId || !exceptionId || !parsed.success) throw new RecipeExceptionError("بيانات القرار غير صالحة", 400);
        await loadOrder(req, orderId);
        if (!(await mayApprove(req))) throw new RecipeExceptionError("الاعتماد لمسؤول الإنتاج فقط", 403);
        const result = await db.execute(sql`UPDATE central_kitchen_recipe_exceptions
          SET status = ${decision === "approve" ? "approved" : "rejected"},
            reviewed_by = ${req.currentUser!.id}, reviewed_at = now(), review_reason = ${parsed.data.reason}
          WHERE id = ${exceptionId} AND order_id = ${orderId} AND status = 'pending' RETURNING *`);
        if (!result.rows.length) throw new RecipeExceptionError("الاستثناء غير موجود أو تمت مراجعته مسبقاً");
        res.json(serializeRecipeException(result.rows[0]));
      }));
  }
}