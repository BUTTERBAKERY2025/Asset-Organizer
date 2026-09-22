export type KitchenOrderStatus = "requested" | "approved" | "prepared" | "dispatched" | "received" | "cancelled";
export type InventoryMode = "real" | "shadow" | "unknown";

export type KitchenOrderFixture = {
  id: number;
  orderNumber: string;
  requestBranchId: string;
  requestBranchName: string;
  centralKitchenName: string;
  neededDate: string;
  neededTime: string;
  itemCount: number;
  status: KitchenOrderStatus;
  inventoryMode: InventoryMode;
  discrepancyStatus?: "none" | "open" | "resolved";
  isLate?: boolean;
  notes?: string;
};

export const BRANCHES = [
  { id: "nakheel", name: "فرع النخيل" },
  { id: "olaya", name: "فرع العليا" },
  { id: "malqa", name: "فرع الملقا" },
  { id: "qurtubah", name: "فرع قرطبة" },
  { id: "yasmin", name: "فرع الياسمين" },
  { id: "rimal", name: "فرع الرمال" },
  { id: "rawabi", name: "فرع الروابي" },
  { id: "kharj", name: "فرع الخرج" },
] as const;

export const KITCHEN_ORDERS: KitchenOrderFixture[] = [
  { id: 24091, orderNumber: "CK-2026-0091", requestBranchId: "nakheel", requestBranchName: "فرع النخيل", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-04-02", neededTime: "07:00", itemCount: 8, status: "requested", inventoryMode: "real", notes: "أولوية للكرواسون قبل افتتاح الفرع." },
  { id: 24090, orderNumber: "CK-2026-0090", requestBranchId: "olaya", requestBranchName: "فرع العليا", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-04-02", neededTime: "07:30", itemCount: 5, status: "approved", inventoryMode: "real" },
  { id: 24089, orderNumber: "CK-2026-0089", requestBranchId: "malqa", requestBranchName: "فرع الملقا", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-04-01", neededTime: "06:45", itemCount: 11, status: "prepared", inventoryMode: "real" },
  { id: 24088, orderNumber: "CK-2026-0088", requestBranchId: "qurtubah", requestBranchName: "فرع قرطبة", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-04-01", neededTime: "07:00", itemCount: 6, status: "dispatched", inventoryMode: "real" },
  { id: 24087, orderNumber: "CK-2026-0087", requestBranchId: "yasmin", requestBranchName: "فرع الياسمين", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-03-31", neededTime: "07:00", itemCount: 9, status: "received", inventoryMode: "real", discrepancyStatus: "open" },
  { id: 24086, orderNumber: "CK-2026-0086", requestBranchId: "rimal", requestBranchName: "فرع الرمال", centralKitchenName: "مطبخ الشرق المركزي", neededDate: "2026-03-31", neededTime: "08:00", itemCount: 4, status: "received", inventoryMode: "shadow", discrepancyStatus: "resolved" },
  { id: 24085, orderNumber: "CK-2026-0085", requestBranchId: "rawabi", requestBranchName: "فرع الروابي", centralKitchenName: "مطبخ الشرق المركزي", neededDate: "2026-03-30", neededTime: "07:00", itemCount: 7, status: "cancelled", inventoryMode: "shadow", isLate: true },
  { id: 24084, orderNumber: "CK-2026-0084", requestBranchId: "kharj", requestBranchName: "فرع الخرج", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-04-02", neededTime: "09:00", itemCount: 13, status: "requested", inventoryMode: "unknown", isLate: true },
  { id: 24083, orderNumber: "CK-2026-0083", requestBranchId: "nakheel", requestBranchName: "فرع النخيل", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-03-29", neededTime: "07:00", itemCount: 3, status: "received", inventoryMode: "real" },
  { id: 24082, orderNumber: "CK-2026-0082", requestBranchId: "olaya", requestBranchName: "فرع العليا", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-03-29", neededTime: "07:30", itemCount: 10, status: "received", inventoryMode: "real", discrepancyStatus: "resolved" },
];

export const PILOT_METRICS = {
  totalOrders: 42,
  overdueOrders: 3,
  openDiscrepancies: 2,
  fulfillmentRate: 94,
  discrepancyRate: 7,
  averageStageHours: { approval: 1.4, preparation: 5.8, dispatch: 0.7, delivery: 1.2 },
  shadowLedger: { entryCount: 18, summary: "خصم 146 قطعة · إضافة 132 قطعة · خصم 24.5 كجم · إضافة 23 كجم" },
} as const;
