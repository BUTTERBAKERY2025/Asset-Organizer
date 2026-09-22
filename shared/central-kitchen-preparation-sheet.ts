export type PreparationSheetOrder = {
  id: string | number;
  orderNumber: string;
  status: string;
  requestBranchName?: string | null;
  items?: Array<{
    productId?: string | number | null;
    warehouseItemId?: string | number | null;
    productName: string;
    unit: string;
    requestedQuantity: number | string;
    preparedQuantity?: number | string | null;
    substituteQuantity?: number | string | null;
    substituteProductId?: string | number | null;
    substituteWarehouseItemId?: string | number | null;
    substituteProductName?: string | null;
    substituteUnit?: string | null;
  }>;
};

export const invalidPreparationSheetOrderIds = (orders: Array<Pick<PreparationSheetOrder, "id" | "status">>) =>
  orders.filter(order => ["cancelled", "received"].includes(order.status)).map(order => order.id);

export function groupPreparationSheet(orders: PreparationSheetOrder[]) {
  const groups = new Map<string, {
    identity: string;
    provenance: "original" | "substitute";
    productName: string;
    unit: string;
    requestedQuantity: number;
    approvedQuantity: number;
    preparedQuantity: number;
    orders: Array<{ id: string | number; orderNumber: string; branchName: string; requestedQuantity: number; preparedQuantity: number }>;
  }>();
  for (const order of orders) {
    if (["cancelled", "received"].includes(order.status)) continue;
    for (const item of order.items || []) {
      const identity = item.warehouseItemId != null
        ? `warehouse:${item.warehouseItemId}`
        : item.productId != null ? `product:${item.productId}` : `legacy:${item.productName.trim().toLowerCase()}`;
      const key = `original\u0000${identity}\u0000${item.unit.trim().toLowerCase()}`;
      const requested = Number(item.requestedQuantity) || 0;
      const prepared = Number(item.preparedQuantity) || 0;
      const group = groups.get(key) || {
        identity, provenance: "original" as const, productName: item.productName, unit: item.unit,
        requestedQuantity: 0, approvedQuantity: 0, preparedQuantity: 0, orders: [],
      };
      group.requestedQuantity += requested;
      if (["approved", "prepared", "dispatched"].includes(order.status)) group.approvedQuantity += requested;
      group.preparedQuantity += prepared;
      group.orders.push({
        id: order.id, orderNumber: order.orderNumber,
        branchName: order.requestBranchName || "—", requestedQuantity: requested, preparedQuantity: prepared,
      });
      groups.set(key, group);
      const substituteQuantity = Number(item.substituteQuantity) || 0;
      if (substituteQuantity > 0 && item.substituteProductName && item.substituteUnit) {
        const substituteIdentity = item.substituteWarehouseItemId != null
          ? `warehouse:${item.substituteWarehouseItemId}`
          : item.substituteProductId != null
            ? `product:${item.substituteProductId}`
            : `legacy:${item.substituteProductName.trim().toLowerCase()}`;
        const substituteKey = `substitute\u0000${substituteIdentity}\u0000${item.substituteUnit.trim().toLowerCase()}`;
        const substitute = groups.get(substituteKey) || {
          identity: substituteIdentity, provenance: "substitute" as const,
          productName: item.substituteProductName, unit: item.substituteUnit,
          requestedQuantity: 0, approvedQuantity: 0, preparedQuantity: 0, orders: [],
        };
        substitute.preparedQuantity += substituteQuantity;
        substitute.orders.push({
          id: order.id, orderNumber: order.orderNumber, branchName: order.requestBranchName || "—",
          requestedQuantity: 0, preparedQuantity: substituteQuantity,
        });
        groups.set(substituteKey, substitute);
      }
    }
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName, "ar") || a.unit.localeCompare(b.unit, "ar") || a.identity.localeCompare(b.identity));
}