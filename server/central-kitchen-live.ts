import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  branchStock,
  centralKitchenInventoryAllocations,
  centralKitchenInventoryMovements,
  centralKitchenOrderItems,
  centralKitchenOrders,
  centralKitchenRuntime,
  dailyProductionBatches,
  finishedGoodsInventory,
  products,
  warehouseItems,
} from "@shared/schema";
import type {
  CentralKitchenAvailabilityContract,
  CentralKitchenRuntimeContract,
  CentralKitchenRuntimeMode,
} from "@shared/central-kitchen-live";
import { formatExact6 } from "@shared/central-kitchen-batch-materials";
import { postProductionBatchToStock } from "./production-stock-posting";

export class CentralKitchenLiveError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = "CentralKitchenLiveError";
  }
}

type Transaction = any;
type PreparedLine = {
  itemId: number;
  preparedQuantity: number;
  substituteQuantity: number;
  substituteProductId?: number | null;
  substituteWarehouseItemId?: number | null;
  substituteUnit?: string | null;
};

function warehouseQuantityMicros(value: number | string, allowZero = false): bigint {
  let normalized: bigint;
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^\d+(?:\.\d{1,6})?$/.test(text)) {
      throw new CentralKitchenLiveError("كمية المادة تقبل ست منازل عشرية كحد أقصى", 400);
    }
    const [whole, fraction = ""] = text.split(".");
    normalized = BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
  } else {
    if (!Number.isFinite(value)) throw new CentralKitchenLiveError("كمية المادة يجب أن تكون رقماً صالحاً", 400);
    const micros = value * 1_000_000;
    if (Math.abs(micros - Math.round(micros)) > Number.EPSILON * Math.max(1, Math.abs(micros)) * 8) {
      throw new CentralKitchenLiveError("كمية المادة تقبل ست منازل عشرية كحد أقصى", 400);
    }
    normalized = BigInt(Math.round(micros));
  }
  if (normalized < 0n || (!allowZero && normalized === 0n)) {
    throw new CentralKitchenLiveError("كمية المادة يجب أن تكون أكبر من صفر", 400);
  }
  return normalized;
}

function warehouseQuantity(value: number | string, allowZero = false): string {
  return formatExact6(warehouseQuantityMicros(value, allowZero));
}

export type CentralKitchenDemandAllocation = {
  orderId: number;
  orderItemId: number;
  orderNumber: string;
  neededDate: string | null;
  createdAt: Date;
  productId: number | null;
  warehouseItemId: number | null;
  name: string;
  unit: string;
  targetQuantity: number;
  ownReservedQuantity: number;
  linkedUnfinishedQuantity: number;
  availableQuantity: number;
  uncoveredQuantity: number;
};

export function allocateSharedCentralKitchenAvailability(
  demands: Omit<CentralKitchenDemandAllocation, "availableQuantity" | "uncoveredQuantity">[],
  freeQuantity: number,
): CentralKitchenDemandAllocation[] {
  let free = Math.max(0, freeQuantity);
  return [...demands]
    .sort((left, right) =>
      (left.neededDate || "9999-12-31").localeCompare(right.neededDate || "9999-12-31")
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.orderId - right.orderId
      || left.orderItemId - right.orderItemId)
    .map((demand) => {
      const remaining = Math.max(
        0,
        demand.targetQuantity - demand.ownReservedQuantity - demand.linkedUnfinishedQuantity,
      );
      const availableQuantity = Math.min(remaining, free);
      free -= availableQuantity;
      return {
        ...demand,
        availableQuantity,
        uncoveredQuantity: remaining - availableQuantity,
      };
    });
}

export async function getAllocatedKitchenDemands(
  kitchenId: string,
  identity: { productId: number } | { warehouseItemId: number },
  tx: Transaction = db,
): Promise<CentralKitchenDemandAllocation[]> {
  const catalogCondition = "productId" in identity
    ? eq(centralKitchenOrderItems.productId, identity.productId)
    : eq(centralKitchenOrderItems.warehouseItemId, identity.warehouseItemId);
  const rows = await tx.select({
    orderId: centralKitchenOrders.id,
    orderItemId: centralKitchenOrderItems.id,
    orderNumber: centralKitchenOrders.orderNumber,
    neededDate: centralKitchenOrders.neededDate,
    createdAt: centralKitchenOrders.createdAt,
    productId: centralKitchenOrderItems.productId,
    warehouseItemId: centralKitchenOrderItems.warehouseItemId,
    name: centralKitchenOrderItems.productName,
    unit: centralKitchenOrderItems.unit,
    targetQuantity: centralKitchenOrderItems.requestedQuantity,
  }).from(centralKitchenOrderItems)
    .innerJoin(centralKitchenOrders, eq(centralKitchenOrderItems.orderId, centralKitchenOrders.id))
    .where(and(
      eq(centralKitchenOrders.centralKitchenId, kitchenId),
      eq(centralKitchenOrders.inventoryMode, "real"),
      eq(centralKitchenOrders.status, "approved"),
      catalogCondition,
    ));
  const demands = [];
  for (const row of rows) {
    const [[reservation], [linked]] = await Promise.all([
      tx.select({
        quantity: sql<number>`COALESCE(SUM(${centralKitchenInventoryAllocations.reservedQuantity}), 0)`,
      }).from(centralKitchenInventoryAllocations).where(and(
        eq(centralKitchenInventoryAllocations.orderItemId, row.orderItemId),
        eq(centralKitchenInventoryAllocations.status, "reserved"),
      )),
      tx.select({
        quantity: sql<number>`COALESCE(SUM(${dailyProductionBatches.quantity}), 0)::int`,
      }).from(dailyProductionBatches).where(and(
        eq(dailyProductionBatches.centralKitchenOrderItemId, row.orderItemId),
        eq(dailyProductionBatches.status, "in_progress"),
      )),
    ]);
    demands.push({
      ...row,
      targetQuantity: Number(row.targetQuantity),
      ownReservedQuantity: Number(reservation?.quantity || 0),
      linkedUnfinishedQuantity: Number(linked?.quantity || 0),
    });
  }
  const availability = await getKitchenAvailability(kitchenId, identity, tx);
  return allocateSharedCentralKitchenAvailability(demands, availability.availableQuantity);
}

export async function getKitchenRuntime(
  kitchenId: string,
  tx: Transaction = db,
): Promise<CentralKitchenRuntimeContract> {
  const [row] = await tx.select().from(centralKitchenRuntime)
    .where(eq(centralKitchenRuntime.kitchenId, kitchenId)).limit(1);
  return row || { kitchenId, mode: "shadow", activatedAt: null, activatedBy: null };
}

export async function setKitchenRuntime(
  kitchenId: string,
  mode: CentralKitchenRuntimeMode,
  userId: string,
) {
  const [row] = await db.insert(centralKitchenRuntime).values({
    kitchenId,
    mode,
    activatedAt: mode === "real" ? sql`now()` : null,
    activatedBy: userId,
    updatedAt: sql`now()`,
  }).onConflictDoUpdate({
    target: centralKitchenRuntime.kitchenId,
    set: {
      mode,
      activatedAt: mode === "real" ? sql`now()` : null,
      activatedBy: userId,
      updatedAt: sql`now()`,
    },
  }).returning();
  return row;
}

export async function assertRealOrderWritable(order: {
  inventoryMode: string | null;
  centralKitchenId: string;
}, tx: Transaction = db) {
  if (order.inventoryMode !== "real") return;
  const runtime = await getKitchenRuntime(order.centralKitchenId, tx);
  if (runtime.mode === "paused") {
    throw new CentralKitchenLiveError("عمليات المخزون الحقيقي لهذا المطبخ متوقفة مؤقتاً", 423);
  }
}

export async function getKitchenAvailability(
  kitchenId: string,
  identity: { productId: number } | { warehouseItemId: number },
  tx: Transaction = db,
): Promise<CentralKitchenAvailabilityContract> {
  if ("productId" in identity) {
    const [catalog] = await tx.select({ unit: products.unit, isActive: products.isActive }).from(products)
      .where(eq(products.id, identity.productId)).limit(1);
    if (!catalog) throw new CentralKitchenLiveError("المنتج غير موجود", 404);
    if (["false", "inactive", "0"].includes(String(catalog.isActive).toLowerCase())) {
      throw new CentralKitchenLiveError("المنتج غير مفعّل", 409);
    }
    const unit = catalog?.unit?.trim() || "قطعة";
    const [row] = await tx.select({
      quantity: sql<number>`COALESCE(SUM(${finishedGoodsInventory.quantity}), 0)::int`,
      reserved: sql<number>`COALESCE(SUM(${finishedGoodsInventory.reservedQuantity}), 0)::int`,
    }).from(finishedGoodsInventory).where(and(
      eq(finishedGoodsInventory.branchId, kitchenId),
      eq(finishedGoodsInventory.productId, identity.productId),
      eq(finishedGoodsInventory.unit, unit),
    ));
    return {
      kitchenId, kind: "product", catalogId: identity.productId, unit,
      availableQuantity: Number(row.quantity) - Number(row.reserved),
      reservedQuantity: Number(row.reserved),
    };
  }
  const [[catalog], [row]] = await Promise.all([
    tx.select({ unit: warehouseItems.unit, isActive: warehouseItems.isActive }).from(warehouseItems)
      .where(eq(warehouseItems.id, identity.warehouseItemId)).limit(1),
    tx.select({
      quantity: branchStock.currentQuantity,
      reserved: branchStock.reservedQuantity,
    }).from(branchStock)
      .where(and(eq(branchStock.branchId, kitchenId), eq(branchStock.itemId, identity.warehouseItemId)))
      .limit(1),
  ]);
  if (!catalog) throw new CentralKitchenLiveError("صنف المستودع غير موجود", 404);
  if (!catalog.isActive) throw new CentralKitchenLiveError("صنف المستودع غير مفعّل", 409);
  return {
    kitchenId, kind: "warehouse", catalogId: identity.warehouseItemId, unit: catalog?.unit || "",
    availableQuantity: Number(row?.quantity || 0) - Number(row?.reserved || 0),
    reservedQuantity: Number(row?.reserved || 0),
  };
}

async function reserveComponent(
  tx: Transaction,
  order: { id: number; centralKitchenId: string },
  itemId: number,
  component: "original" | "substitute",
  identity: { kind: "product" | "warehouse"; catalogId: number; unit: string },
  quantity: number,
) {
  if (identity.kind === "product" && (!Number.isInteger(quantity) || quantity < 0)) {
    throw new CentralKitchenLiveError("مخزون المنتجات الجاهزة يقبل كميات صحيحة فقط", 400);
  }
  const materialQuantity = identity.kind === "warehouse" ? warehouseQuantity(quantity, true) : quantity;
  if (identity.kind === "warehouse" ? materialQuantity === "0.000000" : !quantity) return;
  if (identity.kind === "warehouse") {
    const rows = await tx.execute(sql`
      SELECT bs.id, wi.unit
      FROM branch_stock bs JOIN warehouse_items wi ON wi.id = bs.item_id
      WHERE bs.branch_id = ${order.centralKitchenId} AND bs.item_id = ${identity.catalogId}
      FOR UPDATE OF bs
    `);
    const stock = rows.rows?.[0];
    if (!stock || stock.unit !== identity.unit) {
      throw new CentralKitchenLiveError("وحدة مخزون المادة لا تطابق وحدة الطلب", 400);
    }
    const reserved = await tx.execute(sql`
      UPDATE branch_stock SET reserved_quantity = reserved_quantity + ${materialQuantity}, last_updated = now()
      WHERE id = ${stock.id} AND current_quantity - reserved_quantity >= ${materialQuantity}
      RETURNING id
    `);
    if (!reserved.rows?.length) throw new CentralKitchenLiveError("مخزون مواد المطبخ غير كافٍ");
    await tx.insert(centralKitchenInventoryAllocations).values({
      orderId: order.id, orderItemId: itemId, component, kind: "warehouse",
      catalogId: identity.catalogId, sourceBranchStockId: stock.id, unit: identity.unit,
      reservedQuantity: materialQuantity as any,
    });
    return;
  }
  const stocks = await tx.select().from(finishedGoodsInventory).where(and(
    eq(finishedGoodsInventory.branchId, order.centralKitchenId),
    eq(finishedGoodsInventory.productId, identity.catalogId),
    eq(finishedGoodsInventory.unit, identity.unit),
  )).orderBy(asc(finishedGoodsInventory.productionDate), asc(finishedGoodsInventory.id))
    .for("update");
  let remaining = quantity;
  for (const stock of stocks) {
    const take = Math.min(remaining, Number(stock.quantity) - Number(stock.reservedQuantity));
    if (take <= 0) continue;
    await tx.update(finishedGoodsInventory).set({
      reservedQuantity: sql`${finishedGoodsInventory.reservedQuantity} + ${take}`,
      updatedAt: sql`now()`,
    }).where(eq(finishedGoodsInventory.id, stock.id));
    await tx.insert(centralKitchenInventoryAllocations).values({
      orderId: order.id, orderItemId: itemId, component, kind: "product",
      catalogId: identity.catalogId, sourceFinishedGoodsId: stock.id, unit: identity.unit,
      reservedQuantity: take,
    });
    remaining -= take;
    if (!remaining) break;
  }
  if (remaining) throw new CentralKitchenLiveError("مخزون المنتجات الجاهزة غير كافٍ");
}

export async function reserveRealPreparation(
  tx: Transaction,
  order: { id: number; centralKitchenId: string; inventoryMode: string | null },
  lines: PreparedLine[],
) {
  if (order.inventoryMode !== "real") return;
  await assertRealOrderWritable(order, tx);
  const existing = await tx.select({ id: centralKitchenInventoryAllocations.id })
    .from(centralKitchenInventoryAllocations)
    .where(eq(centralKitchenInventoryAllocations.orderId, order.id)).limit(1);
  if (existing.length) throw new CentralKitchenLiveError("تم حجز مخزون هذا الطلب مسبقاً");
  const items = await tx.select().from(centralKitchenOrderItems)
    .where(eq(centralKitchenOrderItems.orderId, order.id));
  const byId = new Map(items.map((item: any) => [item.id, item]));
  for (const line of lines) {
    const item: any = byId.get(line.itemId);
    if (!item) throw new CentralKitchenLiveError("بند الطلب غير موجود", 400);
    const original = item.productId
      ? { kind: "product" as const, catalogId: item.productId, unit: item.unit }
      : item.warehouseItemId
        ? { kind: "warehouse" as const, catalogId: item.warehouseItemId, unit: item.unit }
        : null;
    if (!original) throw new CentralKitchenLiveError("لا يمكن ترحيل بند تاريخي غير مرتبط بالكتالوج", 400);
    await reserveComponent(tx, order, item.id, "original", original, line.preparedQuantity);
    if (line.substituteQuantity) {
      const substitute = line.substituteProductId
        ? { kind: "product" as const, catalogId: line.substituteProductId, unit: line.substituteUnit! }
        : line.substituteWarehouseItemId
          ? { kind: "warehouse" as const, catalogId: line.substituteWarehouseItemId, unit: line.substituteUnit! }
          : null;
      if (!substitute || substitute.kind !== original.kind || substitute.unit !== original.unit) {
        throw new CentralKitchenLiveError("يجب أن يطابق البديل نوع ووحدة مخزون الصنف الأصلي", 400);
      }
      await reserveComponent(tx, order, item.id, "substitute", substitute, line.substituteQuantity);
    }
  }
}

export async function dispatchRealInventory(
  tx: Transaction,
  order: { id: number; centralKitchenId: string; inventoryMode: string | null },
  lines: Array<{ itemId: number; dispatchedQuantity: number }>,
  eventId: number,
  userId: string,
) {
  if (order.inventoryMode !== "real") return;
  await assertRealOrderWritable(order, tx);
  for (const line of lines) {
    const allocations = await tx.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderItemId, line.itemId))
      .orderBy(sql`CASE WHEN ${centralKitchenInventoryAllocations.component} = 'original' THEN 0 ELSE 1 END`, centralKitchenInventoryAllocations.id)
      .for("update");
    const warehouseSource = allocations[0]?.kind === "warehouse";
    if (allocations.some((allocation) => (allocation.kind === "warehouse") !== warehouseSource)) {
      throw new CentralKitchenLiveError("تخصيصات الشحنة تحتوي مصادر مخزون غير متجانسة", 409);
    }
    if (!warehouseSource && !Number.isInteger(line.dispatchedQuantity)) {
      throw new CentralKitchenLiveError("كمية المنتجات الجاهزة المرسلة يجب أن تكون عدداً صحيحاً", 400);
    }
    let remainingMaterial = warehouseSource ? warehouseQuantityMicros(line.dispatchedQuantity, true) : null;
    let remaining = line.dispatchedQuantity;
    for (const allocation of allocations) {
      const used = warehouseSource
        ? (remainingMaterial! < warehouseQuantityMicros(String(allocation.reservedQuantity), true)
          ? remainingMaterial!
          : warehouseQuantityMicros(String(allocation.reservedQuantity), true))
        : BigInt(Math.min(remaining, Number(allocation.reservedQuantity)));
      const reserved = warehouseSource
        ? warehouseQuantityMicros(String(allocation.reservedQuantity), true)
        : BigInt(Number(allocation.reservedQuantity));
      const released = reserved - used;
      const usedQuantity = warehouseSource ? formatExact6(used) : Number(used);
      const releasedQuantity = warehouseSource ? formatExact6(released) : Number(released);
      if (allocation.kind === "product") {
        await tx.update(finishedGoodsInventory).set({
          quantity: sql`${finishedGoodsInventory.quantity} - ${usedQuantity}`,
          reservedQuantity: sql`${finishedGoodsInventory.reservedQuantity} - ${allocation.reservedQuantity}`,
          updatedAt: sql`now()`,
        }).where(eq(finishedGoodsInventory.id, allocation.sourceFinishedGoodsId!));
      } else {
        await tx.update(branchStock).set({
          currentQuantity: sql`${branchStock.currentQuantity} - ${usedQuantity}`,
          reservedQuantity: sql`${branchStock.reservedQuantity} - ${allocation.reservedQuantity}`,
          lastUpdated: sql`now()`,
        }).where(eq(branchStock.id, allocation.sourceBranchStockId!));
      }
      await tx.update(centralKitchenInventoryAllocations).set({
        dispatchedQuantity: usedQuantity as any, releasedQuantity: releasedQuantity as any,
        status: used > 0n ? "dispatched" : "released", updatedAt: sql`now()`,
      }).where(eq(centralKitchenInventoryAllocations.id, allocation.id));
      if (used) await tx.insert(centralKitchenInventoryMovements).values({
        allocationId: allocation.id, orderId: order.id, orderItemId: line.itemId,
        movementType: "dispatch_debit", branchId: order.centralKitchenId,
        kind: allocation.kind, catalogId: allocation.catalogId, quantity: usedQuantity as any,
        unit: allocation.unit, eventId, actorId: userId,
      });
      if (released) await tx.insert(centralKitchenInventoryMovements).values({
        allocationId: allocation.id, orderId: order.id, orderItemId: line.itemId,
        movementType: "reservation_release", branchId: order.centralKitchenId,
        kind: allocation.kind, catalogId: allocation.catalogId, quantity: releasedQuantity as any,
        unit: allocation.unit, eventId, actorId: userId,
      });
      if (warehouseSource) remainingMaterial! -= used;
      else remaining -= Number(used);
    }
    if (warehouseSource ? remainingMaterial! !== 0n : remaining) {
      throw new CentralKitchenLiveError("الكمية المرسلة تتجاوز الكمية المحجوزة");
    }
  }
}

export async function receiveRealInventory(
  tx: Transaction,
  order: { id: number; requestBranchId: string; centralKitchenId: string; inventoryMode: string | null },
  lines: Array<{ itemId: number; receivedQuantity: number }>,
  receiptDate: string,
  userId: string,
  eventId: number,
) {
  if (order.inventoryMode !== "real") return;
  await assertRealOrderWritable(order, tx);
  for (const line of lines) {
    const allocations = await tx.select().from(centralKitchenInventoryAllocations)
      .where(eq(centralKitchenInventoryAllocations.orderItemId, line.itemId))
      .orderBy(sql`CASE WHEN ${centralKitchenInventoryAllocations.component} = 'original' THEN 0 ELSE 1 END`, centralKitchenInventoryAllocations.id);
    const warehouseSource = allocations[0]?.kind === "warehouse";
    if (allocations.some((allocation) => (allocation.kind === "warehouse") !== warehouseSource)) {
      throw new CentralKitchenLiveError("تخصيصات الاستلام تحتوي مصادر مخزون غير متجانسة", 409);
    }
    if (!warehouseSource && !Number.isInteger(line.receivedQuantity)) {
      throw new CentralKitchenLiveError("كمية المنتجات الجاهزة المستلمة يجب أن تكون عدداً صحيحاً", 400);
    }
    let remainingMaterial = warehouseSource ? warehouseQuantityMicros(line.receivedQuantity, true) : null;
    let remaining = line.receivedQuantity;
    for (const allocation of allocations) {
      const dispatched = warehouseSource
        ? warehouseQuantityMicros(String(allocation.dispatchedQuantity), true)
        : BigInt(Number(allocation.dispatchedQuantity));
      const quantity = warehouseSource
        ? (remainingMaterial! < dispatched ? remainingMaterial! : dispatched)
        : BigInt(Math.min(remaining, Number(dispatched)));
      if (quantity === 0n) continue;
      const receiptQuantity = warehouseSource ? formatExact6(quantity) : Number(quantity);
      if (allocation.kind === "warehouse") {
        await tx.insert(branchStock).values({
          branchId: order.requestBranchId, itemId: allocation.catalogId,
          currentQuantity: receiptQuantity as any, reservedQuantity: 0, updatedBy: userId,
        }).onConflictDoUpdate({
          target: [branchStock.branchId, branchStock.itemId],
          set: { currentQuantity: sql`${branchStock.currentQuantity} + ${receiptQuantity}`, lastUpdated: sql`now()`, updatedBy: userId },
        });
      } else {
        const [item] = await tx.select().from(centralKitchenOrderItems)
          .where(eq(centralKitchenOrderItems.id, line.itemId)).limit(1);
        const name = allocation.component === "original" ? item.productName : item.substituteProductName;
        await tx.execute(sql`
          INSERT INTO finished_goods_inventory
            (branch_id, product_id, product_name, product_name_normalized, quantity, reserved_quantity, unit, production_date, created_at, updated_at)
          VALUES (${order.requestBranchId}, ${allocation.catalogId}, ${name}, lower(btrim(${name})), ${receiptQuantity}, 0, ${allocation.unit}, ${receiptDate}, now(), now())
          ON CONFLICT (branch_id, product_id, production_date, unit) WHERE product_id IS NOT NULL
          DO UPDATE SET quantity = finished_goods_inventory.quantity + EXCLUDED.quantity, updated_at = now()
        `);
      }
      await tx.update(centralKitchenInventoryAllocations).set({
        receivedQuantity: sql`${centralKitchenInventoryAllocations.receivedQuantity} + ${receiptQuantity}`,
        updatedAt: sql`now()`,
      }).where(eq(centralKitchenInventoryAllocations.id, allocation.id));
      await tx.insert(centralKitchenInventoryMovements).values({
        allocationId: allocation.id, orderId: order.id, orderItemId: line.itemId,
        movementType: "receipt_credit", branchId: order.requestBranchId,
        kind: allocation.kind, catalogId: allocation.catalogId, quantity: receiptQuantity as any,
        unit: allocation.unit, eventId, actorId: userId,
      });
      if (warehouseSource) remainingMaterial! -= quantity;
      else remaining -= Number(quantity);
      if (warehouseSource ? remainingMaterial === 0n : !remaining) break;
    }
    if (warehouseSource ? remainingMaterial! !== 0n : remaining) {
      throw new CentralKitchenLiveError("الكمية المستلمة لا تطابق تخصيصات الشحنة", 400);
    }
  }
}

export async function postLinkedKitchenBatch(tx: Transaction, batch: any, userId: string) {
  if (!batch.centralKitchenOrderItemId) return false;
  const result = await postProductionBatchToStock(tx, batch.id, userId);
  return result.posted;
}

export { db as centralKitchenLiveDb };