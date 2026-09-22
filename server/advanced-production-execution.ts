import type { Express, Request } from "express";
import { createHash } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAuthenticated, requirePermission, canAccessBranch, isUserAdmin } from "./auth";
import { advancedProductionOrders, productionOrderItems, dailyProductionBatches, products } from "@shared/schema";
import { isManualProductionIdempotencyKey, canonicalManualProductionPayload } from "@shared/manual-production-operation";
import { snapshotRecipeBackedBatchMaterials, CentralKitchenBatchMaterialsError } from "./central-kitchen-batch-materials";
import { postProductionBatchToStock, ProductionStockPostingError } from "./production-stock-posting";

class ExecutionError extends Error {
  constructor(message: string, public status = 409, public code?: string) { super(message); }
}

const inputSchema = z.object({
  quantity: z.number().int().positive(),
  unit: z.string().trim().min(1),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
  destination: z.enum(["display_bar", "kitchen_trolley", "freezer", "refrigerator"]),
}).strict();

async function authorize(req: Request, order: any) {
  if (!order) throw new ExecutionError("أمر الإنتاج غير موجود", 404);
  if (!order.sourceBranchId) throw new ExecutionError("يجب تحديد فرع الإنتاج المصدر");
  if (!isUserAdmin(req) && !await canAccessBranch(req, order.sourceBranchId)) {
    throw new ExecutionError("تنفيذ الخطة متاح فقط للمصرح لهم في فرع الإنتاج المصدر", 403);
  }
}

// The order lock is first for every operation, followed by item then batch.
async function lockedItem(tx: any, req: Request, orderId: number, itemId: number) {
  const [order] = await tx.select().from(advancedProductionOrders).where(eq(advancedProductionOrders.id, orderId)).for("update");
  await authorize(req, order);
  const [item] = await tx.select().from(productionOrderItems).where(and(
    eq(productionOrderItems.id, itemId), eq(productionOrderItems.orderId, orderId),
  )).for("update");
  if (!item) throw new ExecutionError("بند الخطة غير موجود", 404);
  return { order, item };
}

function executable(order: any, item: any) {
  if (!["approved", "in_progress"].includes(order.status) || item.status === "cancelled") {
    throw new ExecutionError("حالة الخطة أو البند لا تسمح بالتنفيذ");
  }
}

export async function advancedExecutionRows(executor: any, orderId: number) {
  const result = await executor.execute(sql`
    SELECT i.id AS "itemId", i.product_id AS "productId", i.product_name AS "productName",
      i.target_quantity AS "plannedQuantity", COALESCE(i.execution_unit, p.unit) AS unit,
      CASE WHEN i.execution_unit IS NULL THEN 'unknown' ELSE 'linked' END AS "linkageStatus",
      CASE WHEN i.execution_unit IS NOT NULL THEN COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'finished'), 0) END AS "completedQuantity",
      CASE WHEN i.execution_unit IS NOT NULL THEN COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'in_progress'), 0) END AS "inProgressQuantity",
      CASE WHEN i.execution_unit IS NOT NULL THEN i.target_quantity - COALESCE(SUM(b.quantity) FILTER (WHERE b.status IN ('finished', 'in_progress')), 0) END AS "remainingQuantity",
      COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('id', b.id, 'quantity', b.quantity, 'status', b.status))
        FILTER (WHERE b.id IS NOT NULL), '[]'::jsonb) AS batches
    FROM production_order_items i
    LEFT JOIN products p ON p.id = i.product_id
    LEFT JOIN daily_production_batches b ON b.advanced_production_order_item_id = i.id
    WHERE i.order_id = ${orderId}
    GROUP BY i.id, p.unit ORDER BY i.id
  `);
  return result.rows;
}

export function registerAdvancedProductionExecutionRoutes(app: Express) {
  const base = "/api/advanced-production-orders/:orderId";
  const respondError = (res: any, error: any) => {
    if (error instanceof ExecutionError || error instanceof CentralKitchenBatchMaterialsError || error instanceof ProductionStockPostingError) {
      return res.status(error.status).json({
        error: error.message,
        safeToRevise: error.status === 409 && !(error instanceof ExecutionError && error.code === "IDEMPOTENCY_CONFLICT"),
      });
    }
    const code = error?.code || error?.cause?.code;
    if (["42P01", "42703"].includes(code)) return res.status(503).json({ error: "يلزم تطبيق ترحيل ربط خطط الإنتاج قبل التشغيل" });
    if (["23514", "23503", "23505"].includes(code)) return res.status(409).json({ error: "تعارض مع حماية خطة الإنتاج المرتبطة؛ حدّث البيانات وأعد المحاولة" });
    console.error("Advanced production execution failed", error);
    return res.status(500).json({ error: "تعذر تنفيذ عملية الإنتاج" });
  };
  app.get(`${base}/execution`, isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      if (!Number.isInteger(orderId) || orderId <= 0) throw new ExecutionError("معرف غير صالح", 400);
      const [order] = await db.select().from(advancedProductionOrders).where(eq(advancedProductionOrders.id, orderId));
      await authorize(req, order);
      res.set("Cache-Control", "no-store");
      res.json(await advancedExecutionRows(db, orderId));
    } catch (error) { respondError(res, error); }
  });
  app.post(`${base}/items/:itemId/batches`, isAuthenticated, requirePermission("production", "create"), async (req, res) => {
    try {
      const input = inputSchema.safeParse(req.body);
      const key = req.get("Idempotency-Key");
      const orderId = Number(req.params.orderId), itemId = Number(req.params.itemId);
      if (!input.success || !isManualProductionIdempotencyKey(key) || !Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
        throw new ExecutionError("يلزم بند صالح وكمية صحيحة ووحدة وتاريخ ووجهة ومفتاح Idempotency-Key", 400);
      }
      const actor = (req as any).currentUser || (req as any).user;
      if (!actor?.id) throw new ExecutionError("المستخدم غير مصرح", 403);
      const fingerprint = createHash("sha256").update(canonicalManualProductionPayload({ orderId, itemId, ...input.data })).digest("hex");
      const result = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(73033, hashtext(${`${actor.id}:${key}`}))`);
        const { order, item } = await lockedItem(tx, req, orderId, itemId);
        const [prior] = await tx.select().from(dailyProductionBatches).where(and(
          eq(dailyProductionBatches.recordedBy, actor.id), eq(dailyProductionBatches.advancedIdempotencyKey, key!),
        ));
        if (prior) {
          if (prior.advancedPayloadFingerprint !== fingerprint) {
            throw new ExecutionError("المفتاح مستخدم مع بيانات مختلفة", 409, "IDEMPOTENCY_CONFLICT");
          }
          return { batch: prior, replayed: true };
        }
        executable(order, item);
        const [product] = item.productId ? await tx.select().from(products).where(eq(products.id, item.productId)).for("share") : [];
        if (!product || product.productType !== "finish" || !["true", "active", "1"].includes(String(product.isActive).toLowerCase())) throw new ExecutionError("يجب ربط البند بمنتج نهائي معتمد نشط");
        const unit = product.unit?.trim() || "قطعة";
        if (input.data.unit !== unit || (item.executionUnit && item.executionUnit !== unit)) throw new ExecutionError("الوحدة لا تطابق هوية المنتج والخطة");
        if (input.data.productionDate < order.startDate || input.data.productionDate > order.endDate) throw new ExecutionError("تاريخ الدفعة خارج فترة الخطة");
        const [total] = await tx.select({ quantity: sql<number>`COALESCE(SUM(${dailyProductionBatches.quantity}) FILTER (WHERE ${dailyProductionBatches.status} IN ('finished', 'in_progress')), 0)` })
          .from(dailyProductionBatches).where(eq(dailyProductionBatches.advancedProductionOrderItemId, item.id));
        if (Number(total.quantity) + input.data.quantity > item.targetQuantity) throw new ExecutionError("مجموع الدفعات يتجاوز الكمية المخططة");
        await tx.execute(sql`SELECT set_config('app.advanced_execution_write', 'on', true)`);
        await tx.update(productionOrderItems).set({ executionUnit: unit }).where(eq(productionOrderItems.id, item.id));
        const [batch] = await tx.insert(dailyProductionBatches).values({
          branchId: order.sourceBranchId!, productId: product.id, productName: product.name,
          productCategory: product.category, unit, quantity: input.data.quantity,
          productionDate: input.data.productionDate, destination: input.data.destination,
          advancedProductionOrderItemId: item.id, productionOrderId: order.id,
          advancedIdempotencyKey: key, advancedPayloadFingerprint: fingerprint,
          // Existing immediate snapshot trigger forbids true until the immutable
          // snapshot exists. This false value is transaction-local only: the
          // deferred advanced constraint forbids committing without final proof.
          recipeBacked: false, status: "in_progress", recordedBy: actor.id,
        }).returning();
        // No manual/nonrecipe fallback: approved recipe and immutable snapshot are mandatory.
        await snapshotRecipeBackedBatchMaterials(tx, {
          batchId: batch.id, kitchenId: batch.branchId, productId: product.id,
          batchQuantity: batch.quantity, batchUnit: unit,
        });
        const [snapshottedBatch] = await tx.select().from(dailyProductionBatches)
          .where(eq(dailyProductionBatches.id, batch.id));
        if (!snapshottedBatch?.recipeBacked) throw new ExecutionError("تعذر إثبات لقطة وصفة الدفعة؛ أُلغيت عملية الإنشاء");
        return { batch: snapshottedBatch, replayed: false };
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { respondError(res, error); }
  });
  app.post(`${base}/items/:itemId/batches/:batchId/:action`, isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const { action } = req.params;
      const orderId = Number(req.params.orderId), itemId = Number(req.params.itemId), batchId = Number(req.params.batchId);
      if (!["finish", "cancel"].includes(action) || [orderId, itemId, batchId].some(id => !Number.isInteger(id) || id <= 0)) throw new ExecutionError("عملية غير صالحة", 400);
      const actor = (req as any).currentUser || (req as any).user;
      const result = await db.transaction(async tx => {
        const { order, item } = await lockedItem(tx, req, orderId, itemId);
        const [batch] = await tx.select().from(dailyProductionBatches).where(and(
          eq(dailyProductionBatches.id, batchId), eq(dailyProductionBatches.advancedProductionOrderItemId, itemId),
        )).for("update");
        if (!batch) throw new ExecutionError("الدفعة المرتبطة غير موجودة", 404);
        const target = action === "finish" ? "finished" : "cancelled";
        if (batch.status === target) return batch; // Durable state replay, no second stock posting.
        executable(order, item);
        if (batch.status !== "in_progress") throw new ExecutionError("لا يمكن تغيير دفعة مكتملة أو ملغاة");
        if (batch.branchId !== order.sourceBranchId || batch.productId !== item.productId || batch.unit !== item.executionUnit) throw new ExecutionError("هوية الدفعة لا تطابق الخطة");
        await tx.execute(sql`SELECT set_config('app.advanced_execution_write', 'on', true)`);
        const [updated] = await tx.update(dailyProductionBatches).set({
          status: target, ...(action === "finish" ? { finishedAt: new Date(), finishedById: actor.id } : {}),
        }).where(eq(dailyProductionBatches.id, batchId)).returning();
        if (action === "finish") await postProductionBatchToStock(tx, batchId, actor.id, actor.username, { allowInitialPosting: true });
        return updated;
      });
      res.json(result);
    } catch (error) { respondError(res, error); }
  });
}