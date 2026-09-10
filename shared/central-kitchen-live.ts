export const CENTRAL_KITCHEN_INVENTORY_MODES = ["shadow", "real", "paused"] as const;
export type CentralKitchenRuntimeMode = (typeof CENTRAL_KITCHEN_INVENTORY_MODES)[number];
export type CentralKitchenOrderInventoryMode = Exclude<CentralKitchenRuntimeMode, "paused">;

export type CentralKitchenRuntimeContract = {
  kitchenId: string;
  mode: CentralKitchenRuntimeMode;
  activatedAt: string | Date | null;
  activatedBy: string | null;
};

export type CentralKitchenAvailabilityContract = {
  kitchenId: string;
  kind: "product" | "warehouse";
  catalogId: number;
  unit: string;
  availableQuantity: number;
  reservedQuantity: number;
};

export type CentralKitchenOperationDemand = {
  orderId: number;
  orderItemId: number;
  orderNumber: string;
  neededDate: string | null;
  kind: "product" | "warehouse";
  catalogId: number;
  name: string;
  unit: string;
  targetQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  linkedUnfinishedQuantity: number;
  uncoveredQuantity: number;
};

export type CentralKitchenOperationsResponse = {
  runtime: CentralKitchenRuntimeContract;
  demands: CentralKitchenOperationDemand[];
  totals: {
    byUnit: Array<{
      unit: string;
      targetQuantity: number;
      availableQuantity: number;
      reservedQuantity: number;
      linkedUnfinishedQuantity: number;
      uncoveredQuantity: number;
    }>;
  };
};

export type CentralKitchenInventoryAllocationContract = {
  id: number;
  orderItemId: number;
  component: "original" | "substitute";
  kind: "product" | "warehouse";
  catalogId: number;
  unit: string;
  reservedQuantity: number;
  dispatchedQuantity: number;
  releasedQuantity: number;
  receivedQuantity: number;
  status: "reserved" | "dispatched" | "released";
};

export type CentralKitchenLinkedBatchContract = {
  id: number;
  orderItemId: number;
  productId: number;
  quantity: number;
  productionDate: string | null;
  status: string | null;
};