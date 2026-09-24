import { and, eq, sql } from "drizzle-orm";
import { branchStock, warehouseItems, type BranchStock } from "@shared/schema";
import { isNewCatalogReferenceAllowed } from "@shared/catalog-activity";
import type { db } from "./db";

export class InactiveBranchStockReferenceError extends Error {
  readonly statusCode = 400;
  constructor() {
    super("لا يمكن إنشاء مخزون فرع لصنف مستودع غير متاح");
  }
}

/** The caller normalizes quantities; identity/activity and upsert are atomic. */
export async function updateCatalogueBranchStock(
  database: Pick<typeof db, "transaction">,
  branchId: string,
  itemId: number,
  quantity: number,
  dailyConsumption?: number,
  userId?: string,
): Promise<BranchStock> {
  if (!Number.isInteger(itemId) || itemId <= 0) throw new InactiveBranchStockReferenceError();
  return database.transaction(async (tx) => {
    // The item row serializes concurrent branch-stock inserts and deactivation.
    // Taking the lock before checking existence avoids a check/insert race.
    const [item] = await tx.select({ id: warehouseItems.id, isActive: warehouseItems.isActive })
      .from(warehouseItems).where(eq(warehouseItems.id, itemId)).for("update");
    if (!item) throw new InactiveBranchStockReferenceError();
    const [existing] = await tx.select().from(branchStock)
      .where(and(eq(branchStock.branchId, branchId), eq(branchStock.itemId, itemId)))
      .for("update");
    if (existing) {
      // Editing an established historical association does not create a link.
      const [updated] = await tx.update(branchStock).set({
        currentQuantity: quantity,
        dailyConsumption: dailyConsumption ?? existing.dailyConsumption,
        lastUpdated: new Date(),
        updatedBy: userId,
      }).where(and(
        eq(branchStock.id, existing.id),
        sql`${quantity} >= ${branchStock.reservedQuantity}`,
      )).returning();
      if (!updated) throw new Error("لا يمكن خفض مخزون المواد عن الكمية المحجوزة");
      return updated;
    }
    if (!isNewCatalogReferenceAllowed(item)) throw new InactiveBranchStockReferenceError();
    const [created] = await tx.insert(branchStock).values({
      branchId, itemId, currentQuantity: quantity, dailyConsumption, updatedBy: userId,
    }).returning();
    return created;
  });
}