import type { Express, Request } from "express";
import { createHash } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAuthenticated, requirePermission, canAccessBranch, isUserAdmin } from "./auth";
import { advancedProductionOrders, productionOrderItems, dailyProductionBatches, products, advancedProductionRequestLinks, centralKitchenOrderItems, centralKitchenOrders } from "@shared/schema";
import { isManualProductionIdempotencyKey, canonicalManualProductionPayload } from "@shared/manual-production-operation";
import { snapshotRecipeBackedBatchMaterials, CentralKitchenBatchMaterialsError } from "./central-kitchen-batch-materials";
import { postProductionBatchToStock, ProductionStockPostingError } from "./production-stock-posting";
import { isNewCatalogReferenceAllowed } from "@shared/catalog-activity";
import { validateFinishedProductionTarget } from "./finished-production-target";

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
      COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('id', b.id, 'quantity', b.quantity, 'status', b.status,
        'requestItemId', b.advanced_request_item_id))
        FILTER (WHERE b.id IS NOT NULL), '[]'::jsonb) AS batches,
      CASE WHEN l.plan_item_id IS NOT NULL THEN JSONB_BUILD_OBJECT(
        'requestItemId', l.request_item_id, 'requestOrderId', ri.order_id,
        'requestedQuantity', ri.requested_quantity, 'allocatedQuantity', i.target_quantity, 'reason', l.reason
      ) ELSE NULL END AS "requestLink"
    FROM production_order_items i
    LEFT JOIN products p ON p.id = i.product_id
    LEFT JOIN daily_production_batches b ON b.advanced_production_order_item_id = i.id
    LEFT JOIN advanced_production_request_links l ON l.plan_item_id = i.id
    LEFT JOIN central_kitchen_order_items ri ON ri.id = l.request_item_id
    WHERE i.order_id = ${orderId}
    GROUP BY i.id, p.unit, l.plan_item_id, l.request_item_id, l.reason, ri.order_id, ri.requested_quantity ORDER BY i.id
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
      const rows = await advancedExecutionRows(db, orderId);
      const requestItemIds = [...new Set(rows.flatMap((row: any) => [
        row.requestLink?.requestItemId,
        ...(Array.isArray(row.batches) ? row.batches.map((batch: any) => batch.requestItemId) : []),
      ]).filter((id: unknown): id is number => Number.isSafeInteger(Number(id)) && Number(id) > 0).map(Number))];
      for (const requestItemId of requestItemIds) {
        const [scope] = await db.select({ kitchenId: centralKitchenOrders.centralKitchenId })
          .from(centralKitchenOrderItems)
          .innerJoin(centralKitchenOrders, eq(centralKitchenOrders.id, centralKitchenOrderItems.orderId))
          .where(eq(centralKitchenOrderItems.id, requestItemId));
        if (!scope || !await canAccessBranch(req, scope.kitchenId))
          throw new ExecutionError("يلزم نطاق المطبخ صاحب الطلب المرتبط", 403);
      }
      res.set("Cache-Control", "no-store");
      res.json(rows);
    } catch (error) { respondError(res, error); }
  });
  const linkPath = `${base}/items/:itemId/request-link`;
  const linkInput = z.object({ requestItemId: z.number().int().positive(), reason: z.string().trim().min(1).max(500) }).strict();
  app.get(`${linkPath}/candidates`, isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId), itemId = Number(req.params.itemId);
      const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
      const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
      if (![orderId, itemId].every(id => Number.isSafeInteger(id) && id > 0)
        || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
        || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
        throw new ExecutionError("معرف أو نطاق صفحات غير صالح (limit 1-100, offset 0-10000)", 400);
      const [order] = await db.select().from(advancedProductionOrders).where(eq(advancedProductionOrders.id, orderId));
      await authorize(req, order);
      const [item] = await db.select().from(productionOrderItems).where(and(
        eq(productionOrderItems.id, itemId), eq(productionOrderItems.orderId, orderId),
      ));
      if (!item) throw new ExecutionError("بند الخطة غير موجود", 404);
      const [product] = item.productId ? await db.select().from(products).where(eq(products.id, item.productId)) : [];
      if (!["approved", "in_progress"].includes(order.status) || item.status === "cancelled"
        || !item.productId || !Number.isSafeInteger(item.targetQuantity) || item.targetQuantity <= 0
        || !isNewCatalogReferenceAllowed(product) || product?.productType !== "finish"
        || item.executionUnit && item.executionUnit !== product.unit
        || order.startDate > order.endDate)
        throw new ExecutionError("بند الخطة لا يقبل ربط طلب حالياً");
      const [batch] = await db.select({ id: dailyProductionBatches.id }).from(dailyProductionBatches)
        .where(eq(dailyProductionBatches.advancedProductionOrderItemId, item.id)).limit(1);
      if (batch) {
        const [linked] = await db.select().from(advancedProductionRequestLinks)
          .where(eq(advancedProductionRequestLinks.planItemId, item.id));
        if (!linked) throw new ExecutionError("بند منفذ سابقاً لا يقبل طلباً جديداً");
      }
      // This is a scoped candidate search, not a planning-row projection.
      // The PUT route and DB row lock revalidate at commit time.
      const result = await db.execute(sql`
        SELECT i.id AS "requestItemId", o.id AS "requestOrderId", o.order_number AS "requestNumber",
          o.request_branch_id AS "requestBranchId", o.central_kitchen_id AS "kitchenId",
          o.needed_date AS "neededDate", i.product_id AS "productId", i.unit,
          i.requested_quantity AS "requestedQuantity",
          i.requested_quantity - COALESCE(direct.quantity, 0) - COALESCE(plans.quantity, 0) AS "availableQuantity",
          (l.plan_item_id IS NOT NULL) AS "alreadyLinked"
        FROM central_kitchen_order_items i
        JOIN central_kitchen_orders o ON o.id = i.order_id
        LEFT JOIN advanced_production_request_links l ON l.request_item_id = i.id AND l.plan_item_id = ${item.id}
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(b.quantity),0) AS quantity FROM daily_production_batches b
          WHERE b.central_kitchen_order_item_id = i.id AND b.status IN ('in_progress','finished')
        ) direct ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(pi.target_quantity),0) AS quantity
          FROM advanced_production_request_links al JOIN production_order_items pi ON pi.id = al.plan_item_id
          WHERE al.request_item_id = i.id
        ) plans ON true
        WHERE o.central_kitchen_id = ${order.sourceBranchId!}
          AND o.request_branch_id = ${order.targetBranchId}
          AND o.inventory_mode = 'real' AND o.status = 'approved'
          AND o.needed_date >= ${order.endDate}
          AND (${item.scheduledDate}::text IS NULL OR o.needed_date >= ${item.scheduledDate}::date)
          AND i.product_id = ${item.productId} AND i.warehouse_item_id IS NULL
          AND i.unit = ${product!.unit} AND i.prepared_quantity IS NULL AND i.substitute_quantity IS NULL
          AND i.requested_quantity = TRUNC(i.requested_quantity)
          AND (i.requested_quantity - COALESCE(direct.quantity,0) - COALESCE(plans.quantity,0) >= ${item.targetQuantity}
            OR l.plan_item_id IS NOT NULL)
        ORDER BY o.needed_date, o.id, i.id
        LIMIT ${limit + 1} OFFSET ${offset}
      `);
      res.set("Cache-Control", "no-store");
      res.json({ candidates: result.rows.slice(0, limit).map(raw => ({
        ...raw, requestedQuantity: Number((raw as any).requestedQuantity),
        availableQuantity: Number((raw as any).availableQuantity),
      })), limit, offset, truncated: result.rows.length > limit,
        nextOffset: result.rows.length > limit && offset + limit <= 10000 ? offset + limit : null,
        availabilityBasis: "current_direct_active_plus_full_explicit_plan_targets_not_stock_reservation" });
    } catch (error) { respondError(res, error); }
  });
  app.put(linkPath, isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId), itemId = Number(req.params.itemId);
      const parsed = linkInput.safeParse(req.body);
      if (!parsed.success || !Number.isSafeInteger(orderId) || orderId < 1 || !Number.isSafeInteger(itemId) || itemId < 1)
        throw new ExecutionError("معرف وسبب وبند طلب صالح مطلوب", 400);
      const actor = (req as any).currentUser || (req as any).user;
      if (!actor?.id) throw new ExecutionError("المستخدم غير مصرح", 403);
      const outcome = await db.transaction(async tx => {
        const { order, item } = await lockedItem(tx, req, orderId, itemId);
        // Check scope even on replay, before exposing persisted request details.
        const [requestItem] = await tx.select().from(centralKitchenOrderItems)
          .where(eq(centralKitchenOrderItems.id, parsed.data.requestItemId));
        if (!requestItem) throw new ExecutionError("بند الطلب غير موجود", 404);
        const [request] = await tx.select().from(centralKitchenOrders)
          .where(eq(centralKitchenOrders.id, requestItem.orderId));
        if (!request || !await canAccessBranch(req, request.centralKitchenId))
          throw new ExecutionError("يلزم نطاق المطبخ صاحب الطلب", 403);
        const [prior] = await tx.select().from(advancedProductionRequestLinks)
          .where(eq(advancedProductionRequestLinks.planItemId, item.id));
        if (prior) {
          if (prior.requestItemId !== requestItem.id || prior.reason !== parsed.data.reason)
            throw new ExecutionError("بند الخطة مرتبط بطلب مختلف؛ أزل الربط قبل التنفيذ أولاً");
          return { link: prior, replayed: true, requestOrderId: request.id, allocatedQuantity: item.targetQuantity };
        }
        if (!["approved", "in_progress"].includes(order.status) || item.status === "cancelled"
          || request.status !== "approved" || request.inventoryMode !== "real"
          || order.sourceBranchId !== request.centralKitchenId || order.targetBranchId !== request.requestBranchId
          || order.startDate > order.endDate
          || !request.neededDate || order.endDate > request.neededDate
          || item.scheduledDate && item.scheduledDate > request.neededDate
          || !item.productId || item.productId !== requestItem.productId || requestItem.warehouseItemId
          || !Number.isSafeInteger(item.targetQuantity) || item.targetQuantity <= 0
          || !Number.isSafeInteger(Number(requestItem.requestedQuantity))
          || requestItem.preparedQuantity != null || requestItem.substituteQuantity != null)
          throw new ExecutionError("الخطة والطلب غير مؤهلين للربط أو الهوية/التاريخ/الكمية غير متطابقة");
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (!isNewCatalogReferenceAllowed(product) || product?.productType !== "finish" || product.unit !== requestItem.unit
          || item.executionUnit && item.executionUnit !== requestItem.unit)
          throw new ExecutionError("هوية المنتج النهائي والوحدة غير متطابقة");
        const [existingBatch] = await tx.select({ id: dailyProductionBatches.id }).from(dailyProductionBatches)
          .where(eq(dailyProductionBatches.advancedProductionOrderItemId, item.id)).limit(1);
        if (existingBatch) throw new ExecutionError("لا يمكن ربط بند بدأ تنفيذه ولو ألغيت دفعته");
        // AFTER INSERT guard locks request demand and checks full target + direct
        // active batches + all other linked targets in the same transaction.
        const [link] = await tx.insert(advancedProductionRequestLinks).values({
          planItemId: item.id, requestItemId: requestItem.id, reason: parsed.data.reason, createdBy: actor.id,
        }).returning();
        return { link, replayed: false, requestOrderId: request.id, allocatedQuantity: item.targetQuantity };
      });
      res.status(outcome.replayed ? 200 : 201).json(outcome);
    } catch (error) { respondError(res, error); }
  });
  app.delete(linkPath, isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId), itemId = Number(req.params.itemId);
      if (![orderId, itemId].every(id => Number.isSafeInteger(id) && id > 0)) throw new ExecutionError("معرف غير صالح", 400);
      await db.transaction(async tx => {
        const { item } = await lockedItem(tx, req, orderId, itemId);
        const [link] = await tx.select().from(advancedProductionRequestLinks)
          .where(eq(advancedProductionRequestLinks.planItemId, item.id));
        if (!link) return;
        const [requestItem] = await tx.select().from(centralKitchenOrderItems).where(eq(centralKitchenOrderItems.id, link.requestItemId));
        const [request] = await tx.select().from(centralKitchenOrders).where(eq(centralKitchenOrders.id, requestItem.orderId));
        if (!await canAccessBranch(req, request.centralKitchenId)) throw new ExecutionError("يلزم نطاق المطبخ صاحب الطلب", 403);
        // Database refuses removal while any batch is active or finished;
        // cancelled-only execution has no output and may release the link.
        await tx.delete(advancedProductionRequestLinks).where(eq(advancedProductionRequestLinks.planItemId, item.id));
      });
      res.status(204).end();
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
        if (!isNewCatalogReferenceAllowed(product)) throw new ExecutionError("المنتج غير متاح للتشغيل");
        const targetError = validateFinishedProductionTarget(product, item.targetQuantity, input.data.unit);
        if (targetError) throw new ExecutionError(targetError);
        const unit = product!.unit!.trim();
        if (input.data.unit !== unit || (item.executionUnit && item.executionUnit !== unit)) throw new ExecutionError("الوحدة لا تطابق هوية المنتج والخطة");
        if (input.data.productionDate < order.startDate || input.data.productionDate > order.endDate) throw new ExecutionError("تاريخ الدفعة خارج فترة الخطة");
        const [total] = await tx.select({ quantity: sql<number>`COALESCE(SUM(${dailyProductionBatches.quantity}) FILTER (WHERE ${dailyProductionBatches.status} IN ('finished', 'in_progress')), 0)` })
          .from(dailyProductionBatches).where(eq(dailyProductionBatches.advancedProductionOrderItemId, item.id));
        if (Number(total.quantity) + input.data.quantity > item.targetQuantity) throw new ExecutionError("مجموع الدفعات يتجاوز الكمية المخططة");
        await tx.execute(sql`SELECT set_config('app.advanced_execution_write', 'on', true)`);
        await tx.update(productionOrderItems).set({ executionUnit: unit }).where(eq(productionOrderItems.id, item.id));
        const [requestLink] = await tx.select().from(advancedProductionRequestLinks)
          .where(eq(advancedProductionRequestLinks.planItemId, item.id));
        const [batch] = await tx.insert(dailyProductionBatches).values({
          branchId: order.sourceBranchId!, productId: product.id, productName: product.name,
          productCategory: product.category, unit, quantity: input.data.quantity,
          productionDate: input.data.productionDate, destination: input.data.destination,
          advancedProductionOrderItemId: item.id, productionOrderId: order.id,
          advancedRequestItemId: requestLink?.requestItemId ?? null,
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