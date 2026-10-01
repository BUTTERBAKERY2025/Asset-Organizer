/** Entirely invented preview data: no customer, account, employee or production records. */
export const branches = [
  { id: "preview-north", name: "فرع الشمال التجريبي", nameAr: "فرع الشمال التجريبي", isCentralKitchen: false },
  { id: "preview-garden", name: "فرع الحديقة التجريبي — نقطة الاستلام", nameAr: "فرع الحديقة التجريبي — نقطة الاستلام", isCentralKitchen: false },
];
const base = {
  stockPostingPolicy: "on_receipt", requestId: 0,
  sourceBranchId: "main_warehouse", sourceBranchName: "المستودع الرئيسي",
  transferDate: "2026-10-01", driverName: "", vehicleNumber: "",
  departureTime: "", arrivalTime: "", receivedBy: "", receivedByName: "",
  receiverSignature: "", notes: "بيانات معاينة اصطناعية فقط",
  createdBy: "preview-user", createdByName: "حساب معاينة تجريبي", createdAt: "2026-10-01T08:00:00+03:00",
};
export const transfers = [
  { ...base, id: 9101, transferNumber: "PREVIEW-9101", destinationBranchId: branches[0].id, destinationBranchName: branches[0].name, status: "pending" },
  { ...base, id: 9102, transferNumber: "PREVIEW-9102", destinationBranchId: branches[0].id, destinationBranchName: branches[0].name, status: "in_transit", driverName: "ناقل تجريبي", vehicleNumber: "معاينة", departureTime: "2026-10-01T09:00:00+03:00" },
  { ...base, id: 9103, transferNumber: "PREVIEW-9103", destinationBranchId: branches[1].id, destinationBranchName: branches[1].name, status: "delivered", driverName: "ناقل تجريبي", vehicleNumber: "معاينة", receivedBy: "preview-receiver", receivedByName: "مستلم تجريبي", arrivalTime: "2026-10-01T10:00:00+03:00" },
];
export const warehouseItems = [
  { id: 9201, name: "دقيق مخبوزات تجريبي", nameEn: "Preview flour", sku: "PREVIEW-FLOUR", barcode: null, category: "raw_materials", unit: "كجم", quantity: 120, isActive: true },
  { id: 9202, name: "علب تغليف تجريبية", nameEn: "Preview packaging", sku: "PREVIEW-BOX", barcode: null, category: "packaging", unit: "قطعة", quantity: 300, isActive: true },
];
export function itemsFor(id: number) {
  if (!transfers.some(row => row.id === id)) throw new Error(`No synthetic transfer fixture: ${id}`);
  return warehouseItems.map((item, index) => ({
    id: id * 10 + index, transferId: id, itemId: item.id, itemName: item.name,
    category: item.category, unit: item.unit, quantity: index === 0 ? 12.5 : 24,
    originalQuantity: index === 0 ? 12.5 : 24,
    receivedQuantity: id === 9103 ? (index === 0 ? 12.5 : 24) : null,
    discrepancy: 0, discrepancyNotes: null, notes: null, availableQuantity: 4, isModified: false,
  }));
}
export const deliveryWorkspace = {
  deliveries: [], page: 1, pageSize: 25, total: 0, totalPages: 1,
  counts: { active: 0, assigned: 0, in_transit: 0, awaiting_receipt: 0, receipt_approved: 0, completed: 0, failed: 0, cancelled: 0 },
  filters: { sources: branches, destinations: branches },
};