import { getOrderSchedule, getOrderingPolicy } from "../_source/shared/central-kitchen-ordering-policy";
import { isOrderOverdue, matchesOrderQueueStage, saudiDateValue } from "../_source/client/src/components/central-kitchen/order-queue";

/** Deliberately synthetic data. No production user/order/branch data is read. */
export const now = new Date();
const today = saudiDateValue(now);
const shiftDay = (amount: number) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
export const branches = [
  { id: "medina", name: "فرع المدينة", nameAr: "فرع المدينة", isCentralKitchen: false },
];
export const operationsBranches = [
  ...branches,
  { id: "synthetic-kitchen", name: "المطبخ المركزي", nameAr: "المطبخ المركزي", isCentralKitchen: true },
];
/** Role switches only synthetic authority; all effect boundaries stay inert. */
export function isOperationsPreview() {
  return new URLSearchParams(window.location.search).get("role") === "operations";
}
const kitchens = [{ id: "synthetic-kitchen", name: "المطبخ المركزي" }];
const products = [
  { id: 9501, source: "product", name: "كرواسون الزبدة", unit: "قطعة", isActive: true, supplyMode: "production" },
  { id: 9502, source: "product", name: "كيكة التمر", unit: "قطعة", isActive: true, supplyMode: "production" },
  { id: 9503, source: "product", name: "ميني تارت الشوكولاتة", unit: "قطعة", isActive: true, supplyMode: "production" },
];
const base = {
  requestBranchId: "medina", requestBranchName: "فرع المدينة",
  centralKitchenId: "synthetic-kitchen", centralKitchenName: "المطبخ المركزي",
  neededTime: "07:00", createdBy: "synthetic-medina-manager",
  notes: "بيانات اصطناعية للتحقق البصري فقط", inventoryMode: "real",
  driverName: null, vehicleNumber: null, discrepancyStatus: "none",
  linkedBatches: [], allocations: [], shadowInventoryEntries: [],
};
export const orders = [
  { ...base, id: 9406, orderNumber: "CK-9406", status: "requested", neededDate: shiftDay(1), createdAt: `${today}T09:15:00+03:00`, itemCount: 3,
    allowedActions: { edit: true, cancel: true }, nextResponsible: { name: "مسؤول المطبخ", role: "production_manager", unassigned: false } },
  { ...base, id: 9405, orderNumber: "CK-9405", status: "approved", neededDate: shiftDay(-1), createdAt: `${shiftDay(-2)}T11:30:00+03:00`, itemCount: 2,
    allowedActions: {}, nextResponsible: { name: "مسؤول التجهيز", role: "production_manager", unassigned: false } },
  { ...base, id: 9404, orderNumber: "CK-9404", status: "prepared", neededDate: today, createdAt: `${shiftDay(-1)}T10:00:00+03:00`, itemCount: 3,
    allowedActions: {}, nextResponsible: { name: "مسؤول الإرسال", role: "production_manager", unassigned: false } },
  { ...base, id: 9403, orderNumber: "CK-9403", status: "dispatched", neededDate: shiftDay(-1), createdAt: `${shiftDay(-2)}T08:00:00+03:00`, itemCount: 2,
    allowedActions: { receive: true }, driverName: "سائق تجريبي", vehicleNumber: "معاينة ١٢٣", nextResponsible: { name: "مدير الفرع", role: "branch_manager", unassigned: false } },
  { ...base, id: 9402, orderNumber: "CK-9402", status: "received", discrepancyStatus: "open", neededDate: today, createdAt: `${shiftDay(-1)}T09:00:00+03:00`, itemCount: 2,
    allowedActions: { resolveDiscrepancy: true }, nextResponsible: { name: "مدير الفرع", role: "branch_manager", unassigned: false } },
  { ...base, id: 9401, orderNumber: "CK-9401", status: "received", neededDate: shiftDay(-2), createdAt: `${shiftDay(-3)}T12:00:00+03:00`, itemCount: 3,
    allowedActions: {}, nextResponsible: null },
].map(order => ({
  ...order,
  orderingSchedule: getOrderSchedule(order),
  items: products.slice(0, order.itemCount).map((product, index) => ({
    id: order.id * 10 + index, productId: product.id, productName: product.name,
    unit: product.unit, requestedQuantity: [48, 24, 36][index],
    reportedAvailableQuantity: [8, 4, 6][index],
    preparedQuantity: ["prepared", "dispatched", "received"].includes(order.status) ? [48, 24, 36][index] : null,
    dispatchedQuantity: ["dispatched", "received"].includes(order.status) ? [48, 24, 36][index] : null,
    receivedQuantity: order.status === "received" ? [48, 24, 36][index] : null,
    damagedQuantity: 0, missingQuantity: order.discrepancyStatus === "open" && index === 0 ? 2 : 0,
    notes: "",
  })),
  events: [{ id: order.id * 100, toStatus: order.status, eventType: "synthetic_preview", notes: "سجل اصطناعي للمعاينة", createdAt: order.createdAt }],
}));
const policy = getOrderingPolicy(now);
const operationsOrders = orders.map(order => ({
  ...order,
  allowedActions: {
    approve: order.status === "requested",
    prepare: order.status === "approved",
    dispatch: order.status === "prepared",
    receive: false, resolveDiscrepancy: false, edit: false, cancel: false,
  },
}));
const cache = new Map<string, unknown>();
export function fixture(key: readonly unknown[]): unknown {
  const cacheKey = `${isOperationsPreview() ? "operations" : "branch"}:${JSON.stringify(key)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const result = resolve(key);
  cache.set(cacheKey, result);
  return result;
}
function resolve(key: readonly unknown[]): unknown {
  const url = new URL(String(key[0]), "https://synthetic.invalid");
  const route = url.pathname;
  if (route === "/api/central-kitchen-orders/policy") return policy;
  if (route === "/api/central-kitchen-orders/kitchens") return kitchens;
  if (route === "/api/central-kitchen-orders/catalog-v2") return products;
  if (route === "/api/branches") return isOperationsPreview() ? operationsBranches : branches;
  if (route === "/api/central-kitchen-orders/routing") return {
    branchId: url.searchParams.get("branchId"), responsibleUserId: null, deputyUserId: null,
    receiverUserId: "synthetic-medina-manager", responsibleName: null, deputyName: null,
    receiverName: "مدير الفرع التجريبي", hasKitchenResponsible: true,
    receiverAssignmentSource: "branch_manager", receiverAssignmentConflict: false,
  };
  const detail = route.match(/^\/api\/central-kitchen-orders\/(\d+)$/);
  if (detail) {
    const order = (isOperationsPreview() ? operationsOrders : orders).find(value => value.id === Number(detail[1]));
    if (!order) throw new Error("Synthetic preview: no matching local order.");
    return order;
  }
  if (route === "/api/central-kitchen-orders") {
    const params = url.searchParams;
    const baseRows = (isOperationsPreview() ? operationsOrders : orders).filter(order =>
      (!params.has("branchId") || params.get("branchId") === order.requestBranchId)
      && (!params.has("kitchenId") || params.get("kitchenId") === order.centralKitchenId)
      && (!params.has("inventoryMode") || params.get("inventoryMode") === order.inventoryMode)
      && (!params.has("search") || `${order.orderNumber} ${order.requestBranchName} ${order.centralKitchenName}`.includes(params.get("search")!))
      && (!params.has("needed") || (params.get("needed") === "today" ? order.neededDate === today : params.get("needed") === "past" ? order.neededDate < today : order.neededDate > today)));
    const counts: Record<string, number> = Object.fromEntries(["attention", "requested", "approved", "prepared", "dispatched", "archive", "all"].map(stage =>
      [stage, baseRows.filter(order => matchesOrderQueueStage(order, stage as any, now)).length]));
    Object.assign(counts, {
      new: baseRows.filter(order => order.status === "requested").length,
      overdue: baseRows.filter(order => isOrderOverdue(order, now)).length,
      dueToday: baseRows.filter(order => order.neededDate === today).length,
      openDiscrepancies: baseRows.filter(order => order.discrepancyStatus === "open").length,
    });
    let rows = baseRows.filter(order => matchesOrderQueueStage(order, (params.get("stage") || "attention") as any, now));
    const focus = params.get("focus");
    if (focus) rows = rows.filter(order => focus === "new" ? order.status === "requested" : focus === "overdue" ? isOrderOverdue(order, now) : focus === "dueToday" ? order.neededDate === today : order.discrepancyStatus === "open");
    rows = [...rows].sort((a, b) => params.get("sort") === "oldest_waiting" ? a.id - b.id : b.id - a.id);
    const page = Number(params.get("page") || 1), pageSize = Number(params.get("pageSize") || 25);
    return { data: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, totalPages: Math.ceil(rows.length / pageSize), counts, serverNow: policy.serverNow, arrival: { count: orders.length, maxId: 9406 } };
  }
  if (route === "/api/central-kitchen-order-journey") {
    const id = Number(key[1]);
    return {
      orderId: id, destinationBranchId: "medina", inventoryMode: "real",
      sections: { production: false, delivery: false, inventory: false, bar: false },
      sectionState: { production: "restricted", delivery: "restricted", inventory: "restricted", bar: "restricted" },
      delivery: null, inventoryProductIds: [], warnings: [],
      stages: [
        { key: "order", label: "الطلب والاعتماد", status: "complete", summary: "طلب تجريبي مسجل", owner: null },
        { key: "production", label: "التجهيز", status: "current", summary: "متابعة تجهيز بنود الطلب", owner: "مسؤول المطبخ" },
        { key: "delivery", label: "التوصيل", status: "pending", summary: "يظهر هنا بعد الإرسال", owner: null },
        { key: "inventory", label: "استلام الفرع", status: "pending", summary: "التأكيد من مدير الفرع", owner: "مدير الفرع" },
      ],
    };
  }
  // No unrecognized query can fall through to a real service.
  throw new Error(`Synthetic preview: no local fixture for ${JSON.stringify(key)}; network disabled.`);
}