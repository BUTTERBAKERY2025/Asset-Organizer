import { and, eq, sql } from "drizzle-orm";
import {
  centralKitchenOrderItems,
  centralKitchenOrders,
  centralKitchenRuntime,
  dailyProductionBatches,
  finishedGoodsInventory,
  productionInventoryLogs,
  products,
  type FinishedGoodsInventory,
} from "@shared/schema";

type Transaction = any;

export class ProductionStockPostingError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = "ProductionStockPostingError";
  }
}

export async function postProductionBatchToStock(
  tx: Transaction,
  batchId: number,
  userId?: string,
  userName?: string,
  options: { allowInitialPosting?: boolean } = {},
): Promise<{ inventory: FinishedGoodsInventory; posted: boolean }> {
  const [batch] = await tx.select().from(dailyProductionBatches)
    .where(eq(dailyProductionBatches.id, batchId))
    .for("update");
  if (!batch) throw new ProductionStockPostingError(`دفعة الإنتاج ${batchId} غير موجودة`);
  if (batch.status !== "finished") {
    throw new ProductionStockPostingError("لا يمكن ترحيل دفعة إنتاج غير مكتملة إلى المخزون");
  }
  if (!Number.isInteger(batch.productId) || !batch.productId) {
    throw new ProductionStockPostingError("يجب ربط دفعة الإنتاج بمنتج صالح قبل ترحيلها إلى المخزون");
  }
  if (!Number.isInteger(batch.quantity) || batch.quantity <= 0) {
    throw new ProductionStockPostingError("كمية دفعة الإنتاج يجب أن تكون عدداً صحيحاً أكبر من صفر");
  }
  if (!batch.productionDate) {
    throw new ProductionStockPostingError("يجب تحديد تاريخ الإنتاج قبل ترحيل الدفعة إلى المخزون");
  }
  const [validProduct] = await tx.select({
    id: products.id,
    name: products.name,
    unit: products.unit,
    isActive: products.isActive,
  }).from(products)
    .where(eq(products.id, batch.productId)).limit(1);
  if (!validProduct) {
    throw new ProductionStockPostingError(`منتج دفعة الإنتاج ${batch.productId} غير موجود`);
  }
  if (!["true", "active", "1"].includes(String(validProduct.isActive).toLowerCase())) {
    throw new ProductionStockPostingError("لا يمكن ترحيل إنتاج لمنتج غير نشط");
  }
  const unit = validProduct.unit?.trim() || "قطعة";
  if ((batch.unit?.trim() || "قطعة") !== unit) {
    throw new ProductionStockPostingError(`وحدة دفعة الإنتاج لا تطابق وحدة المنتج المعتمدة (${unit})`);
  }
  const productName = validProduct.name.trim();
  const normalizedName = productName.toLowerCase();

  const [runtime] = await tx.select({ mode: centralKitchenRuntime.mode })
    .from(centralKitchenRuntime)
    .where(eq(centralKitchenRuntime.kitchenId, batch.branchId))
    .limit(1);
  if (runtime?.mode === "paused") {
    throw new ProductionStockPostingError("عمليات المخزون الحقيقي لهذا المطبخ متوقفة مؤقتاً", 423);
  }
  if (batch.centralKitchenOrderItemId) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(73029, ${batch.centralKitchenOrderItemId})`);
    const [linked] = await tx.select({
      itemId: centralKitchenOrderItems.id,
      productId: centralKitchenOrderItems.productId,
      unit: centralKitchenOrderItems.unit,
      requestedQuantity: centralKitchenOrderItems.requestedQuantity,
      centralKitchenId: centralKitchenOrders.centralKitchenId,
      inventoryMode: centralKitchenOrders.inventoryMode,
      orderStatus: centralKitchenOrders.status,
    }).from(centralKitchenOrderItems)
      .innerJoin(centralKitchenOrders, eq(centralKitchenOrderItems.orderId, centralKitchenOrders.id))
      .where(eq(centralKitchenOrderItems.id, batch.centralKitchenOrderItemId))
      .limit(1);
    if (!linked) throw new ProductionStockPostingError("بند طلب المطبخ المركزي المرتبط غير موجود");
    if (linked.inventoryMode !== "real") {
      throw new ProductionStockPostingError("لا يمكن ترحيل دفعة مرتبطة بطلب ليس في وضع المخزون الحقيقي");
    }
    // Runtime shadow affects new orders only; an existing real order keeps
    // its posting contract unless the kitchen is explicitly paused above.
    if (linked.centralKitchenId !== batch.branchId) {
      throw new ProductionStockPostingError("فرع الدفعة لا يطابق المطبخ المركزي صاحب الطلب");
    }
    if (linked.orderStatus !== "approved") {
      throw new ProductionStockPostingError("حالة طلب المطبخ لا تسمح بترحيل دفعة إنتاج مرتبطة");
    }
    if (linked.productId !== batch.productId || linked.unit.trim() !== unit) {
      throw new ProductionStockPostingError("هوية المنتج أو وحدته لا تطابق بند طلب المطبخ المرتبط");
    }
    const [linkedTotal] = await tx.select({
      quantity: sql<number>`COALESCE(SUM(${dailyProductionBatches.quantity}), 0)`,
    }).from(dailyProductionBatches)
      .where(eq(dailyProductionBatches.centralKitchenOrderItemId, linked.itemId));
    if (Number(linkedTotal.quantity) > Number(linked.requestedQuantity)) {
      throw new ProductionStockPostingError("إجمالي دفعات الإنتاج المرتبطة يتجاوز احتياج بند الطلب");
    }
  }

  const canonicalWhere = and(
    eq(finishedGoodsInventory.branchId, batch.branchId),
    eq(finishedGoodsInventory.productId, batch.productId),
    eq(finishedGoodsInventory.productionDate, batch.productionDate),
    eq(finishedGoodsInventory.unit, unit),
  );
  const [priorLog] = await tx.select({ id: productionInventoryLogs.id })
    .from(productionInventoryLogs)
    .where(eq(productionInventoryLogs.batchId, batch.id))
    .limit(1);
  if (priorLog) {
    const [inventory] = await tx.select().from(finishedGoodsInventory)
      .where(canonicalWhere).limit(1);
    if (!inventory) {
      throw new ProductionStockPostingError(
        `سجل ترحيل دفعة الإنتاج ${batch.id} موجود لكن رصيد المنتج المرتبط غير موجود`,
      );
    }
    return { inventory, posted: false };
  }
  const [legacyLog] = await tx.select({ id: productionInventoryLogs.id })
    .from(productionInventoryLogs)
    .where(and(
      eq(productionInventoryLogs.referenceType, "batch"),
      eq(productionInventoryLogs.referenceId, batch.id),
    ))
    .limit(1);
  if (legacyLog) {
    throw new ProductionStockPostingError(
      `دفعة الإنتاج ${batch.id} لها سجل ترحيل تاريخي ولا يمكن إعادة ترحيلها تلقائياً`,
    );
  }
  if (!options.allowInitialPosting) {
    throw new ProductionStockPostingError(
      `دفعة الإنتاج ${batch.id} مكتملة بلا إثبات ترحيل حديث؛ رُفضت إعادة ترحيلها لحماية الرصيد`,
    );
  }

  // The old name/date unique index is broader than canonical product identity.
  // Reject instead of silently merging different products or units.
  const legacyCollision = await tx.select().from(finishedGoodsInventory).where(and(
    eq(finishedGoodsInventory.branchId, batch.branchId),
    eq(finishedGoodsInventory.productNameNormalized, normalizedName),
    eq(finishedGoodsInventory.productionDate, batch.productionDate),
  )).for("update");
  const incompatible = legacyCollision.find((row: FinishedGoodsInventory) =>
    row.productId !== batch.productId || (row.unit || "قطعة") !== unit
  );
  if (incompatible) {
    throw new ProductionStockPostingError(
      "تعذر ترحيل الإنتاج: يوجد رصيد بالاسم والتاريخ نفسيهما لهوية منتج أو وحدة مختلفة",
    );
  }

  const result = await tx.execute(sql`
    INSERT INTO finished_goods_inventory
      (branch_id, product_id, product_name, product_name_normalized, product_category,
       quantity, reserved_quantity, unit, production_date, last_batch_id, created_at, updated_at)
    VALUES
      (${batch.branchId}, ${batch.productId}, ${productName}, ${normalizedName},
       ${batch.productCategory}, ${batch.quantity}, 0, ${unit}, ${batch.productionDate},
       ${batch.id}, NOW(), NOW())
    ON CONFLICT (branch_id, product_id, production_date, unit) WHERE product_id IS NOT NULL
    DO UPDATE SET
      quantity = finished_goods_inventory.quantity + EXCLUDED.quantity,
      last_batch_id = EXCLUDED.last_batch_id,
      updated_at = NOW()
    RETURNING *
  `) as { rows: any[] };
  const row = result.rows[0];
  const inventory: FinishedGoodsInventory = {
    id: row.id,
    branchId: row.branch_id,
    productId: row.product_id,
    productName: row.product_name,
    productNameNormalized: row.product_name_normalized,
    productCategory: row.product_category,
    quantity: row.quantity,
    reservedQuantity: row.reserved_quantity,
    unit: row.unit,
    productionDate: row.production_date,
    lastBatchId: row.last_batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const balanceAfter = Number(inventory.quantity);

  await tx.insert(productionInventoryLogs).values({
    branchId: batch.branchId,
    productId: batch.productId,
    productName,
    movementType: "production_in",
    quantity: batch.quantity,
    balanceBefore: balanceAfter - batch.quantity,
    balanceAfter,
    referenceType: "batch",
    referenceId: batch.id,
    batchId: batch.id,
    notes: `ترحيل من دفعة الإنتاج #${batch.id}`,
    createdBy: userId,
    createdByName: userName,
  });
  return { inventory, posted: true };
}