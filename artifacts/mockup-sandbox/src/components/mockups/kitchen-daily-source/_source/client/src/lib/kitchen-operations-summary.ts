import { addMaterialQuantities, normalizeMaterialQuantity } from "../../../shared/material-quantity.ts";

type KitchenSummaryItem = {
  id?: string | number | null;
  productId?: string | number | null;
  warehouseItemId?: string | number | null;
  productName: string;
  unit: string;
  requestedQuantity?: number | null;
};

export type KitchenSummaryOrder = {
  id: string | number;
  status: string;
  items?: KitchenSummaryItem[] | null;
};

export type KitchenOperationsSummaryRow = {
  identityType: "product" | "warehouse";
  identityId: string;
  productName: string;
  unit: string;
  requestedQuantity: number;
  orderCount: number;
};

/**
 * طلبات بانتظار التجهيز: only the requested/approved items supplied by the caller.
 * Pass the currently visible, filtered, loaded orders with their items; this is
 * NOT a cross-page total, remaining stock, net demand, or fulfillment forecast.
 * Items without a single canonical catalog identity are omitted rather than
 * merging manual names or guessing equivalence between catalogs.
 */
export function summarizeKitchenOperations(
  orders: readonly KitchenSummaryOrder[],
): KitchenOperationsSummaryRow[] {
  const groups = new Map<string, KitchenOperationsSummaryRow>();
  const seenItems = new Set<string>();
  const groupOrders = new Map<string, Set<string>>();

  for (const order of orders) {
    if (order.status !== "requested" && order.status !== "approved") continue;
    if (order.id === null || order.id === undefined || !String(order.id).trim()) continue;
    const orderId = String(order.id);

    for (const item of order.items ?? []) {
      // An ambiguous row with both source IDs cannot be assigned safely.
      const productId = item.productId == null ? "" : String(item.productId).trim();
      const warehouseItemId = item.warehouseItemId == null ? "" : String(item.warehouseItemId).trim();
      if (Boolean(productId) === Boolean(warehouseItemId)) continue;
      const unit = item.unit?.trim();
      if (!unit || typeof item.requestedQuantity !== "number"
        || !Number.isFinite(item.requestedQuantity) || item.requestedQuantity <= 0) continue;

      let quantity: number;
      try {
        quantity = normalizeMaterialQuantity(item.requestedQuantity);
      } catch {
        // Invalid precision/range is not silently rounded into another demand.
        continue;
      }
      const identityType = productId ? "product" : "warehouse";
      const identityId = productId || warehouseItemId;
      const groupKey = JSON.stringify([identityType, identityId, unit]);
      // The item ID identifies a row within its order. For older rows lacking
      // one, suppress identical repeated snapshots without merging unlike rows.
      const itemKey = item.id != null && String(item.id).trim()
        ? JSON.stringify([orderId, "item", String(item.id)])
        : JSON.stringify([orderId, "snapshot", groupKey, item.productName, quantity]);
      if (seenItems.has(itemKey)) continue;
      seenItems.add(itemKey);

      const group = groups.get(groupKey);
      if (group) {
        group.requestedQuantity = addMaterialQuantities(group.requestedQuantity, quantity);
      } else {
        groups.set(groupKey, {
          identityType, identityId, productName: item.productName, unit,
          requestedQuantity: quantity, orderCount: 0,
        });
      }
      const seenOrders = groupOrders.get(groupKey) ?? new Set<string>();
      if (!seenOrders.has(orderId)) {
        seenOrders.add(orderId);
        groups.get(groupKey)!.orderCount++;
      }
      groupOrders.set(groupKey, seenOrders);
    }
  }
  return [...groups.values()];
}