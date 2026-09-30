/**
 * Isolated synthetic API serving the REAL warehouse, transfer, delivery and user pages.
 * npx tsx tests/warehouse-role.browser.fixture.ts --serve
 * Nothing is proxied: unknown API requests and all unlisted writes fail closed.
 * Mutations below change only process memory; restart the fixture to reset state.
 */
import express from "express";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import type { DeliveryDTO, DeliverySource } from "../shared/delivery";
import type { DeliveryWorkspaceQuery, DeliveryWorkspaceResponse } from "../shared/delivery-workspace-list";
import { getOrderingPolicy } from "../shared/central-kitchen-ordering-policy";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
const roleNames = ["keeper", "branch", "branch-multi", "driver", "admin"] as const;
type Role = typeof roleNames[number];
const branches = [
  { id: "main_warehouse", name: "المستودع الرئيسي", nameAr: "المستودع الرئيسي", isCentralKitchen: false },
  { id: "fixture_branch", name: "فرع الاختبار", nameAr: "فرع الاختبار", isCentralKitchen: false },
  { id: "other_branch", name: "فرع آخر", nameAr: "فرع آخر", isCentralKitchen: false },
  { id: "fixture_kitchen", name: "المطبخ الاصطناعي", nameAr: "المطبخ الاصطناعي", isCentralKitchen: true },
];
const multiBranches = [
  { id: "allowedA", name: "الفرع المسموح أ", nameAr: "الفرع المسموح أ", isCentralKitchen: false },
  { id: "allowedB", name: "الفرع المسموح ب", nameAr: "الفرع المسموح ب", isCentralKitchen: false },
];
const actors = {
  keeper: { id: "fixture-keeper", username: "fixture-keeper", firstName: "أمين", lastName: "المستودع", name: "أمين المستودع", role: "warehouse_keeper", branchId: null, activeBranchId: null, allowedBranches: [] },
  branch: { id: "fixture-branch-manager", username: "fixture-branch-manager", firstName: "مدير", lastName: "الفرع", name: "مدير الفرع", role: "branch_manager", branchId: "fixture_branch", activeBranchId: "fixture_branch", allowedBranches: [{ id: 1, userId: "fixture-branch-manager", branchId: "fixture_branch", accessLevel: "manager", isDefault: true }] },
  "branch-multi": { id: "fixture-multi-manager", username: "fixture-multi-manager", firstName: "مدير", lastName: "فرعين", name: "مدير فرعين", role: "branch_manager", branchId: null, activeBranchId: null as string | null, allowedBranches: multiBranches.map((branch, index) => ({ id: 3 + index, userId: "fixture-multi-manager", branchId: branch.id, accessLevel: "manager", isDefault: false })) },
  driver: { id: "fixture-driver", username: "fixture-driver", firstName: "سائق", lastName: "التوصيل", name: "سائق التوصيل", role: "employee", jobTitle: "delivery", branchId: "fixture_branch", activeBranchId: "fixture_branch", allowedBranches: [{ id: 2, userId: "fixture-driver", branchId: "fixture_branch", accessLevel: "employee", isDefault: true }] },
  admin: { id: "fixture-admin", username: "fixture-admin", firstName: "مدير", lastName: "النظام", name: "مدير النظام", role: "admin", branchId: null, activeBranchId: null, allowedBranches: [] },
};
const today = new Date().toISOString();
const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single("file");
const evidenceBytes = new Map<number, Buffer>();
let nextEvidenceId = 1;
const catalog = Array.from({ length: 65 }, (_, i) => ({
  id: 8001 + i, name: `مادة تجريبية ${String(i + 1).padStart(2, "0")}`, nameEn: `Fixture material ${i + 1}`,
  sku: `FIX-MAT-${String(i + 1).padStart(3, "0")}`, barcode: null,
  category: i % 2 ? "مواد جافة" : "مواد غذائية", unit: i % 2 ? "كرتون" : "كيلو",
  quantity: 100 + i, isActive: true,
}));
type Transfer = {
  id: number; stockPostingPolicy: string; transferNumber: string; requestId: number;
  sourceBranchId: string; sourceBranchName: string; destinationBranchId: string; destinationBranchName: string;
  status: string; transferDate: string; driverName: string; vehicleNumber: string; departureTime: string;
  arrivalTime: string; receivedBy: string; receivedByName: string; receiverSignature: string;
  notes: string; createdBy: string; createdByName: string; createdAt: string;
};
const transfers: Transfer[] = Array.from({ length: 65 }, (_, i) => ({
  id: 4101 + i, stockPostingPolicy: "on_receipt", transferNumber: `FIX-WH-${String(i + 1).padStart(3, "0")}`,
  requestId: 6101 + i, sourceBranchId: "main_warehouse", sourceBranchName: "المستودع الرئيسي",
  destinationBranchId: i % 4 === 3 ? "other_branch" : "fixture_branch",
  destinationBranchName: i % 4 === 3 ? "فرع آخر" : "فرع الاختبار",
  status: i === 0 ? "pending" : i === 1 ? "approved" : i === 2 ? "in_transit" : i === 3 ? "delivered" : ["pending", "approved", "in_transit", "delivered"][i % 4],
  transferDate: "2035-06-09", driverName: i % 4 > 1 ? "سائق التوصيل" : "",
  vehicleNumber: i % 4 > 1 ? "FIX-123" : "", departureTime: "", arrivalTime: "",
  receivedBy: "", receivedByName: "", receiverSignature: "", notes: "بيانات اصطناعية للاختبار فقط",
  createdBy: "fixture-branch-manager", createdByName: "مدير الفرع", createdAt: today,
}));
// Workspace row FIX-DEL-073 needs a *real paired synthetic source*; unlike
// anonymous paginated rows it can proceed through independent branch receipt.
transfers.unshift({
  ...transfers[2], id: 10073, requestId: 16073, transferNumber: "FIX-DEL-073",
  destinationBranchId: "fixture_branch", destinationBranchName: branches[1].nameAr,
  status: "in_transit", receivedBy: "", receivedByName: "", receiverSignature: "",
});
const createdTransferItems = new Map<number, ReturnType<typeof legacyTransferItems>>();
const receivedTransferItems = new Map<number, ReturnType<typeof legacyTransferItems>>();
function legacyTransferItems(id: number) { return Array.from({ length: 3 }, (_, j) => {
  const item = catalog[(id - 4101 + j) % catalog.length];
  return { id: id * 10 + j, transferId: id, itemId: item.id, itemName: item.name,
    category: item.category, unit: item.unit, quantity: 3 + j, originalQuantity: null,
    receivedQuantity: null, discrepancy: null, discrepancyNotes: null, notes: null,
    availableQuantity: item.quantity, isModified: false };
}); }
const transferItems = (id: number) => receivedTransferItems.get(id) || createdTransferItems.get(id) || legacyTransferItems(id);
const deliveries: DeliveryDTO[] = [
  { id: 9201, sourceType: "material_transfer", sourceId: 4102, sourceStatus: "approved",
    sourceLabel: "FIX-WH-002", sourceBranchId: "main_warehouse", sourceBranchName: "المستودع الرئيسي",
    destinationBranchId: "fixture_branch", destinationBranchName: "فرع الاختبار",
    items: transferItems(4102).map(x => ({ id: x.itemId, name: x.itemName, quantity: x.quantity, unit: x.unit })),
    transportMode: "internal", driverId: "fixture-driver", driverName: "سائق التوصيل", vehicleNumber: "FIX-123",
    carrier: null, carrierName: null, waybill: null, trackingUrl: null, packageCount: null,
    attachments: [], exceptionReason: null, exceptionResolvedAt: null,
    scheduledAt: today, status: "assigned", receiverName: null, notes: null,
    proofPresent: false, proofAt: null, receiptApprovedBy: null, receiptApprovedAt: null,
    startedAt: null, completedAt: null, failedAt: null, failureReason: null,
    cancellationReason: null, createdAt: today, updatedAt: today,
    handoverRecordedAt: null, handoverAcknowledgedAt: null, handoverItems: null,
    handoverInvalidated: false, capabilities: { canRecordHandover: false, canAcknowledgeHandover: false,
      canStart: false, canSubmitProof: false, canApproveReceipt: false, canComplete: false,
      canFail: false, canReassign: false, canCancel: false, canResolveException: false } },
];
// Synthetic counterpart of the awaiting-receipt carrier dialog. The underlying
// transfer stays in_transit: no independent destination receipt has occurred.
const receiptPhoto = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9n1xZIoAAAAASUVORK5CYII=", "base64");
const receiptPdf = Buffer.from("%PDF-1.4\n%%EOF");
evidenceBytes.set(9001, receiptPhoto);
evidenceBytes.set(9002, receiptPdf);
deliveries.push({
  ...deliveries[0], id: 9301, sourceId: 4103, sourceStatus: "in_transit",
  sourceLabel: "MT-202609-0001", items: transferItems(4103).map(x => ({ id: x.itemId, name: x.itemName, quantity: x.quantity, unit: x.unit })),
  transportMode: "external", driverId: null, driverName: null, vehicleNumber: null,
  carrier: "other", carrierName: "ناقل اصطناعي", waybill: "FIX-RECEIPT-9301", packageCount: 2,
  trackingUrl: null, status: "awaiting_receipt", startedAt: today,
  handoverRecordedAt: today, handoverItems: transferItems(4103).map(x => ({ id: x.itemId, name: x.itemName, quantity: x.quantity, unit: x.unit })),
  attachments: [
    { id: 9001, kind: "shipment_photo", mimeType: "image/png", originalName: "synthetic-shipment.png", downloadUrl: "/api/deliveries/9301/attachments/9001" },
    { id: 9002, kind: "carrier_receipt", mimeType: "application/pdf", originalName: "synthetic-carrier.pdf", downloadUrl: "/api/deliveries/9301/attachments/9002" },
  ],
});
// A mostly read-only population exercises the paged workspace. FIX-DEL-073
// below is explicitly promoted to a mutable assignment paired with its source.
const workspaceDeliveries: DeliveryDTO[] = Array.from({ length: 84 }, (_, i) => {
  const external = i % 3 !== 0;
  const carrier = external ? (["road", "naqel", "other"] as const)[i % 3 === 1 ? (Math.floor(i / 3) % 2) : 2] : null;
  const status = (["assigned", "in_transit", "awaiting_receipt", "receipt_approved", "failed", "completed", "cancelled"] as const)[i % 7];
  const destination = i % 4 === 3 ? branches[2] : branches[1];
  const source = i % 5 === 0 ? branches[2] : branches[0];
  return {
    ...deliveries[0], id: 10001 + i, sourceId: 10001 + i,
    sourceLabel: `FIX-DEL-${String(i + 1).padStart(3, "0")}`,
    sourceBranchId: source.id, sourceBranchName: source.nameAr,
    destinationBranchId: destination.id, destinationBranchName: destination.nameAr,
    sourceStatus: "in_transit", status, transportMode: external ? "external" : "internal",
    driverId: external ? null : actors.driver.id, driverName: external ? null : actors.driver.name,
    vehicleNumber: external ? null : `FIX-${i + 1}`,
    carrier, carrierName: carrier === "other" ? "شركة الشحن التجريبية" : null,
    waybill: external ? `FIX-WAY-${String(i + 1).padStart(3, "0")}` : null,
    scheduledAt: new Date(Date.now() + ((i % 5) - 2) * 3600_000).toISOString(),
    packageCount: external ? 1 + i % 4 : null,
    completedAt: status === "completed" ? today : null,
    failureReason: status === "failed" ? "تعذر الوصول" : null,
    cancellationReason: status === "cancelled" ? "ألغيت المهمة" : null,
  };
});
const receiptWorkspaceIndex = workspaceDeliveries.findIndex(item => item.id === 10073);
const [receiptWorkspaceDelivery] = workspaceDeliveries.splice(receiptWorkspaceIndex, 1);
deliveries.push({
  ...receiptWorkspaceDelivery, sourceId: 10073, sourceType: "material_transfer",
  sourceStatus: "in_transit", status: "awaiting_receipt",
  proofPresent: true, proofAt: today, receiverName: "مستلم الفرع الاصطناعي",
  handoverRecordedAt: today, handoverAcknowledgedAt: today,
  handoverItems: receiptWorkspaceDelivery.items.map(item => ({ ...item })),
});
function role(req: express.Request): Role | null {
  const selected = req.query.role;
  return typeof selected === "string" && (roleNames as readonly string[]).includes(selected) ? selected as Role : null;
}
function deny(res: express.Response, message = "Synthetic fixture denies this operation") {
  return res.status(403).json({ error: message });
}
function scopedBranches(actor: Role) {
  if (actor === "branch-multi") return multiBranches;
  return actor === "branch" || actor === "driver" ? [branches[1]] : branches;
}
function perms(actor: Role) {
  const warehouse = actor === "keeper" ? ["view", "create", "edit", "approve", "export"] : ["branch", "branch-multi", "driver"].includes(actor) ? [] : ["view", "create", "edit", "approve", "export", "delete"];
  return [
    { module: "warehouse", actions: warehouse },
    { module: "branch_supply", actions: actor === "branch" || actor === "branch-multi" ? ["view", "create", "edit", "export"] : [] },
    { module: "central_kitchen_orders", actions: actor === "branch" ? ["view", "create", "edit", "export"] : [] },
    { module: "delivery_tasks", actions: actor === "branch" || actor === "branch-multi" ? ["view", "approve", "export"] : actor === "driver" ? ["view", "edit"] : ["view", "create", "edit"] },
    { module: "dashboard", actions: ["view"] },
  ];
}
function visibleTransfer(actor: Role, transfer: Transfer) {
  return actor === "admin" || actor === "keeper" && transfer.sourceBranchId === "main_warehouse"
    || actor === "branch" && transfer.destinationBranchId === "fixture_branch"
    || actor === "branch-multi" && multiBranches.some(branch => branch.id === transfer.destinationBranchId);
}
function getTransfer(req: express.Request, res: express.Response): Transfer | null {
  const id = Number(req.params.id);
  const transfer = transfers.find(x => x.id === id);
  if (!role(req) || !transfer || !visibleTransfer(role(req)!, transfer)) {
    res.status(404).json({ error: "Transfer unavailable" });
    return null;
  }
  return transfer;
}
function deliveryFor(actor: Role, delivery: DeliveryDTO) {
  const external = delivery.transportMode === "external";
  const own = !external && actor === "driver" && delivery.driverId === actors.driver.id;
   const source = actor === "admin" || actor === "keeper" && delivery.sourceBranchId === "main_warehouse";
  const receiver = actor === "branch" && delivery.destinationBranchId === "fixture_branch";
  if (!own && !source && !receiver) return null;
  const transfer = transfers.find(x => x.id === delivery.sourceId);
  const evidence = ["shipment_photo", "carrier_receipt"].every(kind => delivery.attachments.some(file => file.kind === kind));
   return { ...delivery, sourceStatus: transfer?.status || delivery.sourceStatus,
     attachments: delivery.attachments.map(file => ({ ...file, downloadUrl: `${file.downloadUrl}?role=${actor}` })),
     capabilities: {
    canRecordHandover: source && delivery.status === "assigned" && transfer?.status === "approved"
      && (external ? evidence : !delivery.handoverRecordedAt),
    canAcknowledgeHandover: !external && own && delivery.status === "assigned" && !!delivery.handoverRecordedAt && !delivery.handoverAcknowledgedAt,
    canStart: (external ? source && evidence && !!delivery.handoverRecordedAt : own && !!delivery.handoverAcknowledgedAt)
      && delivery.status === "assigned" && transfer?.status === "in_transit",
    canSubmitProof: own && delivery.status === "in_transit"
      && transfer?.status === "in_transit",
    canApproveReceipt: receiver && delivery.status === "awaiting_receipt"
      && (external ? evidence : delivery.proofPresent) && transfer?.status === "delivered" && transfer.receivedBy === actors.branch.id,
    canComplete: (external ? source && evidence && !delivery.exceptionReason : own) && delivery.status === "receipt_approved"
      && transfer?.status === "delivered" && transfer.receivedBy === delivery.receiptApprovedBy,
    canFail: (external ? source : own) && transfer?.status === "in_transit"
      && ["assigned", "in_transit", "awaiting_receipt"].includes(delivery.status),
    canReassign: !external && source && delivery.status !== "completed",
    canCancel: source && delivery.status === "assigned",
    canResolveException: external && source && !!delivery.exceptionReason && !delivery.exceptionResolvedAt,
  } };
}

// Require an explicit role on EVERY API request. Cookies and live authentication are never consulted.
app.use("/api", (req, res, next) => {
  res.setHeader("X-Synthetic-Warehouse-Fixture", "in-memory-only");
  if (!role(req)) return res.status(400).json({ error: "Supply ?role=keeper|branch|branch-multi|driver|admin on every fixture request" });
  next();
});
app.get("/api/auth/init", (req, res) => res.json({ user: actors[role(req)!], permissions: perms(role(req)!), branches: scopedBranches(role(req)!) }));
app.get("/api/auth/me", (req, res) => res.json(actors[role(req)!]));
app.get("/api/my-permissions", (req, res) => res.json(perms(role(req)!)));
app.get("/api/branches", (req, res) => res.json(scopedBranches(role(req)!)));
app.patch("/api/auth/active-branch", (req, res) => {
  if (role(req) !== "branch-multi") return deny(res);
  const branch = multiBranches.find(item => item.id === req.body?.branchId);
  if (!branch) return deny(res, "Branch is not in the synthetic allowed list");
  actors["branch-multi"].activeBranchId = branch.id;
  return res.json({ activeBranchId: branch.id, activeBranch: branch });
});
app.get("/api/branch-operations/summary", (req, res) => {
  if (role(req) !== "branch-multi") return deny(res);
  const branch = multiBranches.find(item => item.id === req.query.branchId);
  if (!branch) return deny(res, "Branch is not in the synthetic allowed list");
  return res.json({ branchId: branch.id, generatedAt: today, businessDate: today.slice(0, 10), cards: [
    { id: "warehouse", title: "طلبات المستودع", group: "orders",
      href: `/transfer-requests?branchId=${branch.id}`, state: "ready",
      metrics: [{ label: "طلبات الفرع", value: transfers.filter(item => item.destinationBranchId === branch.id).length }],
      alerts: [], quickActions: [{ label: "إنشاء طلب", href: `/transfer-requests?branchId=${branch.id}`, kind: "create" }] },
  ] });
});
// The kitchen is a discoverable source, not a branch to which a branch manager has been assigned.
app.get("/api/central-kitchen-orders/kitchens", (req, res) => res.json([{ id: "fixture_kitchen", name: "المطبخ الاصطناعي" }]));
app.get("/api/central-kitchen-orders/policy", (req, res) => res.json(getOrderingPolicy(new Date())));
app.get("/api/central-kitchen-orders/routing", (req, res) =>
  req.query.branchId === "fixture_branch" && role(req) === "branch"
    ? res.json({ branchId: "fixture_branch", receiverUserId: actors.branch.id,
      receiverName: actors.branch.name, receiverAssignmentSource: "branch_manager",
      hasKitchenResponsible: false, kitchenManagers: [] })
    : deny(res));
app.get("/api/central-kitchen-orders/catalog-v2", (req, res) => res.json({
  schemaVersion: 2, items: [{ id: 7001, source: "product", name: "منتج مطبخ اصطناعي", unit: "قطعة" },
    { id: 8001, source: "warehouse", name: catalog[0].name, unit: catalog[0].unit }],
}));
const kitchenOrders = [{
  id: 7201, orderNumber: "FIX-KITCHEN-001", requestBranchId: "fixture_branch",
  requestBranchName: branches[1].nameAr, centralKitchenId: "fixture_kitchen",
  centralKitchenName: "المطبخ الاصطناعي", status: "requested", neededDate: "2035-06-10",
  neededTime: "07:00", createdAt: today, createdBy: actors.branch.id, itemCount: 1,
  items: [{ id: 7210, productId: 7001, productName: "منتج مطبخ اصطناعي", unit: "قطعة",
    requestedQuantity: 2, reportedAvailableQuantity: 0 }], events: [],
  allowedActions: { approve: false, prepare: false, dispatch: false, receive: false, edit: true, cancel: true },
}];
app.get("/api/central-kitchen-orders", (req, res) => {
  if (!["branch", "admin"].includes(role(req)!)) return deny(res);
  if (req.query.branchId && req.query.branchId !== "fixture_branch") return deny(res);
  const stage = String(req.query.stage || "attention");
  const data = stage === "all" || stage === "requested" || stage === "attention" ? kitchenOrders : [];
  return res.json({ data, total: data.length, page: 1, pageSize: 25, totalPages: 1, serverNow: today,
    counts: { attention: kitchenOrders.length, requested: kitchenOrders.length, approved: 0, prepared: 0,
      dispatched: 0, archive: 0, all: kitchenOrders.length, new: kitchenOrders.length,
      overdue: 0, dueToday: 0, openDiscrepancies: 0 },
    arrival: { count: kitchenOrders.length, maxId: kitchenOrders[kitchenOrders.length - 1]?.id ?? null } });
});
app.post("/api/central-kitchen-orders", (req, res) => {
  const body = req.body;
  if (role(req) !== "branch" || body?.requestBranchId !== "fixture_branch" || body?.centralKitchenId !== "fixture_kitchen"
    || !Array.isArray(body?.items) || !body.items.length
    || body.items.some((line: { productId?: number; warehouseItemId?: number; requestedQuantity: number; reportedAvailableQuantity: number }) =>
      ![7001, 8001].includes(line.productId || line.warehouseItemId || 0)
      || !Number.isFinite(line.requestedQuantity) || line.requestedQuantity <= 0
      || !Number.isFinite(line.reportedAvailableQuantity) || line.reportedAvailableQuantity < 0))
    return deny(res, "Only assigned branch requests for the synthetic kitchen are accepted");
  const order = { ...kitchenOrders[0], id: 7300 + kitchenOrders.length,
    orderNumber: `FIX-KITCHEN-${kitchenOrders.length + 1}`, neededDate: body.neededDate,
    items: body.items.map((line: object, index: number) => ({ ...line, id: 7400 + index })),
    itemCount: body.items.length };
  kitchenOrders.unshift(order as typeof kitchenOrders[number]);
  res.status(201).json(order);
});
app.get("/api/central-kitchen-orders/:id", (req, res) => {
  const order = kitchenOrders.find(row => row.id === Number(req.params.id));
  return order && ["branch", "admin"].includes(role(req)!) ? res.json(order) : res.status(404).json({ error: "Order unavailable" });
});
// Reverse movement examples are scoped to the receiving branch. All writes below
// are explicitly synthetic process-memory transitions; no live API is forwarded.
const reverseMovements = [
  { id: 9601, kind: "material_return", status: "requested", item_name: catalog[0].name, unit: catalog[0].unit,
    quantity: "2", shipped_quantity: "0", received_quantity: "0", usable_quantity: "0",
    damaged_quantity: "0", written_off_quantity: "0", shortage_quantity: "0",
    quarantine_quantity: "0", source_branch_id: "fixture_branch", destination_branch_id: null,
    source_warehouse_id: null, destination_warehouse_id: null, carrier_name: null, vehicle_number: null },
  { id: 9602, kind: "product_return", status: "dispatched", item_name: "منتج مطبخ اصطناعي", unit: "قطعة",
    quantity: "1", shipped_quantity: "1", received_quantity: "0", usable_quantity: "0",
    damaged_quantity: "0", written_off_quantity: "0", shortage_quantity: "0",
    quarantine_quantity: "0", source_branch_id: "fixture_branch", destination_branch_id: "fixture_kitchen",
    source_warehouse_id: null, destination_warehouse_id: null, carrier_name: null, vehicle_number: null },
];
app.get("/api/reverse-logistics", (req, res) => role(req) === "branch" || role(req) === "admin"
  ? res.json(reverseMovements.filter(row => role(req) === "admin" || row.source_branch_id === "fixture_branch")) : deny(res));
app.get("/api/reverse-logistics/sources", (req, res) => role(req) === "branch" || role(req) === "admin"
  ? res.json({ materials: [{ id: 41020, reference: "FIX-WH-002", name: catalog[0].name, unit: catalog[0].unit, quantity: "3" }],
    products: [{ id: 70010, reference: "FIX-KITCHEN-001", name: "منتج مطبخ اصطناعي",
      unit: "قطعة", quantity: "2", substitute_product_id: null, substitute_product_name: null,
      substitute_unit: null, receipt_attribution_basis: null, original_good_received_quantity: "2",
      total_good_received_quantity: "2" }] }) : deny(res));
app.post("/api/reverse-logistics", (req, res) => {
  const { kind, originalTransferItemId, originalOrderItemId, quantity } = req.body || {};
  if (role(req) !== "branch" || !Number.isFinite(quantity) || quantity <= 0
    || !(kind === "material_return" && originalTransferItemId === 41020
      || kind === "product_return" && originalOrderItemId === 70010))
    return deny(res, "Only a branch return of its own received item is available");
  const row = { ...reverseMovements[0], id: 9700 + reverseMovements.length, kind,
    item_name: kind === "material_return" ? catalog[0].name : "منتج مطبخ اصطناعي",
    unit: kind === "material_return" ? catalog[0].unit : "قطعة", status: "draft", quantity: String(quantity) };
  reverseMovements.unshift(row);
  res.status(201).json(row);
});
app.post("/api/reverse-logistics/:id/:action", (req, res) => {
  const row = reverseMovements.find(item => item.id === Number(req.params.id));
  if (role(req) !== "branch" || !row || row.source_branch_id !== "fixture_branch"
    || !(row.status === "draft" && req.params.action === "request"
      || ["draft", "requested"].includes(row.status) && req.params.action === "cancel"))
    return deny(res, "No authorized synthetic return transition");
  row.status = req.params.action === "request" ? "requested" : "cancelled";
  res.json(row);
});
app.get("/api/users", (req, res) => role(req) === "admin"
  ? res.json(Object.values(actors).map(user => ({ ...user, isActive: "active", email: null }))) : deny(res));
app.get("/api/rbac/users/:id/branches", (req, res) => {
  if (role(req) !== "admin") return deny(res);
  const actor = Object.values(actors).find(user => user.id === req.params.id);
  return actor ? res.json(actor.allowedBranches) : res.status(404).json({ error: "User unavailable" });
});
app.get("/api/warehouse/items", (req, res) => role(req) === "driver" ? deny(res) : res.json(catalog));
app.post("/api/warehouse/material-transfers", (req, res) => {
  const actor = role(req)!;
  const body = req.body;
  if (!(actor === "branch" && body?.destinationBranchId === "fixture_branch"
    || actor === "branch-multi" && multiBranches.some(branch => branch.id === body?.destinationBranchId))
    || body?.sourceBranchId !== "main_warehouse"
    || !Array.isArray(body?.items) || !body.items.length
    || body.items.some((line: { itemId: number; quantity: number }) =>
      !catalog.some(item => item.id === line.itemId) || !Number.isFinite(line.quantity) || line.quantity <= 0))
    return deny(res, "Only an assigned branch may request catalog materials for itself");
  const transfer: Transfer = { ...transfers[0], id: 5000 + transfers.length,
    requestId: 7000 + transfers.length, transferNumber: `FIX-NEW-${transfers.length}`,
    destinationBranchId: body.destinationBranchId, destinationBranchName: [...branches, ...multiBranches].find(branch => branch.id === body.destinationBranchId)!.nameAr,
    status: "pending", driverName: "", vehicleNumber: "", receivedBy: "", receivedByName: "",
    createdBy: actors[actor].id, createdByName: actors[actor].name };
  createdTransferItems.set(transfer.id, body.items.map((line: { itemId: number; quantity: number }, index: number) => {
    const item = catalog.find(item => item.id === line.itemId)!;
    return { id: transfer.id * 10 + index, transferId: transfer.id, itemId: item.id,
      itemName: item.name, category: item.category, unit: item.unit, quantity: line.quantity,
      originalQuantity: null, receivedQuantity: null, discrepancy: null,
      discrepancyNotes: null, notes: null, availableQuantity: item.quantity, isModified: false };
  }));
  transfers.unshift(transfer);
  res.status(201).json(transfer);
});
app.get("/api/warehouse/material-transfers", (req, res) => {
  const actor = role(req)!;
  if (actor === "driver") return deny(res);
  if (actor === "keeper" && req.query.branchId !== "main_warehouse") return deny(res, "Keeper scope is main_warehouse only");
  if (actor === "branch" && req.query.branchId !== "fixture_branch") return deny(res, "Branch scope is fixture_branch only");
  if (actor === "branch-multi" && req.query.branchId && !multiBranches.some(branch => branch.id === req.query.branchId))
    return deny(res, "Branch scope is allowedA or allowedB only");
  res.json(transfers.filter(x => visibleTransfer(actor, x))
    .filter(x => !req.query.status || req.query.status === x.status)
    .filter(x => !req.query.branchId || req.query.branchId === "main_warehouse" && x.sourceBranchId === "main_warehouse"
      || req.query.branchId === x.sourceBranchId || req.query.branchId === x.destinationBranchId));
});
app.get("/api/warehouse/material-transfers/:id/items", (req, res) => {
  const transfer = getTransfer(req, res);
  if (transfer) res.json(transferItems(transfer.id));
});
app.get("/api/warehouse/material-transfers/:id", (req, res) => {
  const transfer = getTransfer(req, res);
  if (transfer) res.json({ transfer, items: transferItems(transfer.id) });
});
app.get("/api/warehouse/dashboard-stats", (req, res) => {
  const actor = role(req)!;
  if (actor === "driver" || actor === "keeper" && req.query.branchId !== "main_warehouse"
    || actor === "branch" && req.query.branchId !== "fixture_branch"
    || actor === "branch-multi" && !multiBranches.some(branch => branch.id === req.query.branchId)) return deny(res);
  const rows = transfers.filter(x => visibleTransfer(actor, x));
  res.json({ pendingRequests: rows.filter(x => x.status === "pending").length,
    approvedRequests: rows.filter(x => x.status === "approved").length,
    inTransitTransfers: rows.filter(x => x.status === "in_transit").length, lowStockItems: 0 });
});
app.get("/api/warehouse/notifications", (req, res) => role(req) === "driver" ? deny(res) : res.json([]));
app.get("/api/warehouse/notifications/unread-count", (req, res) => role(req) === "driver" ? deny(res) : res.json({ count: 0 }));
app.get("/api/deliveries/capabilities", (req, res) => res.json({
  canAssign: ["keeper", "admin"].includes(role(req)!), canReport: role(req) === "admin", canExport: role(req) === "admin",
}));
app.get("/api/deliveries/workspace", (req, res) => {
  const status = String(req.query.status || "active");
  const carrier = String(req.query.carrier || "all");
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 25);
  const q = String(req.query.q || "").trim().toLocaleLowerCase();
  const statuses = ["active", "all", "assigned", "in_transit", "awaiting_receipt", "receipt_approved", "failed", "completed", "cancelled"];
  if (!statuses.includes(status) || !["all", "internal", "road", "naqel", "other"].includes(carrier)
    || !Number.isSafeInteger(page) || page < 1 || ![25, 50, 100].includes(pageSize) || q.length > 160)
    return res.status(400).json({ error: "Invalid workspace filters" });
  const filters: DeliveryWorkspaceQuery = {
    q, status: status as DeliveryWorkspaceQuery["status"], carrier: carrier as DeliveryWorkspaceQuery["carrier"],
    sourceBranchId: typeof req.query.sourceBranchId === "string" ? req.query.sourceBranchId : undefined,
    destinationBranchId: typeof req.query.destinationBranchId === "string" ? req.query.destinationBranchId : undefined,
    page, pageSize: pageSize as DeliveryWorkspaceQuery["pageSize"],
  };
  const visible = [...deliveries, ...workspaceDeliveries].map(item => deliveryFor(role(req)!, item))
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((a, b) => b.id - a.id);
  const options = (key: "source" | "destination") => {
    const values = new Map<string, string>();
    for (const item of visible) values.set(key === "source" ? item.sourceBranchId : item.destinationBranchId,
      key === "source" ? item.sourceBranchName : item.destinationBranchName);
    return [...values].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  };
  const counts: DeliveryWorkspaceResponse["counts"] = {
    active: 0, assigned: 0, in_transit: 0, awaiting_receipt: 0,
    receipt_approved: 0, failed: 0, completed: 0, cancelled: 0,
  };
  const selected = visible.filter(item => {
    if (filters.carrier !== "all" && (filters.carrier === "internal" ? item.transportMode !== "internal"
      : item.transportMode !== "external" || item.carrier !== filters.carrier)) return false;
    if (filters.sourceBranchId && item.sourceBranchId !== filters.sourceBranchId) return false;
    if (filters.destinationBranchId && item.destinationBranchId !== filters.destinationBranchId) return false;
    if (q && ![item.sourceLabel, item.sourceId, item.waybill, item.carrier, item.carrierName, item.driverName,
      item.vehicleNumber].some(value => String(value ?? "").toLocaleLowerCase().includes(q))) return false;
    counts[item.status]++;
    if (item.status !== "completed" && item.status !== "cancelled") counts.active++;
    return true;
  }).filter(item => filters.status === "all" || (filters.status === "active"
    ? item.status !== "completed" && item.status !== "cancelled" : item.status === filters.status));
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    deliveries: selected.slice((page - 1) * pageSize, page * pageSize),
    total: selected.length, page, pageSize, counts,
    filters: { sources: options("source"), destinations: options("destination") },
  } satisfies DeliveryWorkspaceResponse);
});
// Synthetic report contract for the existing admin delivery tab; never queries live data.
function fixtureReport(query: Record<string, any>) {
  const dateType = String(query.dateType || "created");
  const carrier = String(query.carrier || "all");
  const from = String(query.from || "");
  const to = String(query.to || "");
  return deliveries.map(item => {
    const row = deliveryFor("admin", item);
    return row ? { ...row, reportDispatchedAt: transfers.find(t => t.id === item.sourceId)?.departureTime || null } : null;
  }).filter((item): item is NonNullable<typeof item> => !!item)
    .filter(item => {
      const time = dateType === "completed" ? item.completedAt : dateType === "dispatched" ? item.reportDispatchedAt : item.createdAt;
      const day = time ? new Date(new Date(time).getTime() + 3 * 3600000).toISOString().slice(0, 10) : null;
      return (!from || !!day && day >= from) && (!to || !!day && day <= to)
        && (carrier === "all" || carrier === "internal" && item.transportMode === "internal"
          || item.transportMode === "external" && item.carrier === carrier)
        && (!query.carrierName || item.carrierName === query.carrierName)
        && (!query.status || item.status === query.status)
        && (!query.sourceBranchId || item.sourceBranchId === query.sourceBranchId)
        && (!query.destinationBranchId || item.destinationBranchId === query.destinationBranchId);
    });
}
app.get("/api/deliveries/reports", (req, res) => {
  if (role(req) !== "admin") return deny(res);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const selected = fixtureReport(req.query);
  const summary = { total: selected.length, assigned: 0, in_transit: 0, awaiting_receipt: 0,
    receipt_approved: 0, completed: 0, failed: 0, cancelled: 0 };
  selected.forEach(item => { summary[item.status]++; });
  res.json({ deliveries: selected.slice((page - 1) * pageSize, page * pageSize), summary, page, pageSize });
});
app.get("/api/deliveries/reports/export", (req, res) => {
  if (role(req) !== "admin") return deny(res);
  const csv = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\s\x00-\x1f]*[=+\-@]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="delivery-report.csv"');
  res.send("\uFEFF" + [["المصدر", "شركة الشحن", "رقم البوليصة", "السائق الداخلي", "الإنشاء (السعودية +03:00)", "الإرسال من المصدر (السعودية +03:00)", "الإكمال (السعودية +03:00)"],
    ...fixtureReport(req.query).map(item => [item.sourceLabel, item.carrier === "other" ? item.carrierName : item.carrier,
      item.waybill, item.driverName, item.createdAt, item.reportDispatchedAt, item.completedAt])]
    .map(row => row.map(csv).join(",")).join("\r\n"));
});
app.get("/api/deliveries/sources", (req, res) => {
  if (!["keeper", "admin"].includes(role(req)!)) return deny(res);
  const sources: DeliverySource[] = transfers.filter(x => x.status === "approved" && !deliveries.some(d => d.sourceId === x.id)).map(x => ({
    sourceType: "material_transfer", sourceId: x.id, sourceStatus: x.status, sourceLabel: x.transferNumber,
    sourceBranchId: x.sourceBranchId, sourceBranchName: x.sourceBranchName, destinationBranchId: x.destinationBranchId,
    destinationBranchName: x.destinationBranchName, items: transferItems(x.id).map(item => ({
      id: item.itemId, name: item.itemName, quantity: item.quantity, unit: item.unit,
    })),
  }));
  res.json({ sources });
});
app.get("/api/deliveries/drivers", (req, res) => ["keeper", "admin"].includes(role(req)!)
  ? res.json({ drivers: [{ id: actors.driver.id, name: actors.driver.name, jobTitle: "delivery" }] }) : deny(res));
app.get("/api/deliveries", (req, res) => res.json({ deliveries: deliveries.map(x => deliveryFor(role(req)!, x)).filter(Boolean) }));
app.get("/api/deliveries/:id", (req, res) => {
  const item = [...deliveries, ...workspaceDeliveries].find(x => x.id === Number(req.params.id));
  const result = item && deliveryFor(role(req)!, item);
  return result ? res.json(result) : res.status(404).json({ error: "Delivery unavailable" });
});
app.get("/api/deliveries/:id/proof", (req, res) => {
  const item = deliveries.find(x => x.id === Number(req.params.id));
  if (!item?.proofPresent || !deliveryFor(role(req)!, item)) return res.status(404).json({ error: "Proof unavailable" });
  return res.json({ signatureData: null, receiverName: item.receiverName, proofAt: item.proofAt, receiptApprovedBy: item.receiptApprovedBy, receiptApprovedAt: item.receiptApprovedAt });
});
app.put("/api/warehouse/material-transfers/:id/status", (req, res) => {
  const transfer = getTransfer(req, res);
  if (!transfer) return;
  const actor = role(req)!;
  const { status } = req.body || {};
  const assignment = deliveries.find(x => x.sourceType === "material_transfer" && x.sourceId === transfer.id && x.status !== "cancelled");
  const dispatchIdentity = assignment?.transportMode === "external"
    ? req.body.driverName == null && req.body.vehicleNumber == null
      || typeof req.body.driverName === "string" && !!req.body.driverName.trim()
        && typeof req.body.vehicleNumber === "string" && !!req.body.vehicleNumber.trim()
    : typeof req.body.driverName === "string" && !!req.body.driverName.trim()
      && typeof req.body.vehicleNumber === "string" && !!req.body.vehicleNumber.trim();
  if (!["keeper", "admin"].includes(actor) || !(
    transfer.status === "pending" && status === "approved" ||
    transfer.status === "approved" && status === "in_transit" && dispatchIdentity
      && (!assignment || !!assignment.handoverRecordedAt && (assignment.transportMode === "external" ||
        !!assignment.handoverAcknowledgedAt))
  )) return deny(res, "Only keeper/admin may approve a pending transfer or dispatch an approved transfer with driver and vehicle");
  transfer.status = status;
  if (status === "in_transit") {
    transfer.driverName = assignment?.transportMode === "external" ? assignment.carrierName || assignment.carrier || "" : req.body.driverName;
    transfer.vehicleNumber = assignment?.transportMode === "external" ? assignment.waybill || "" : req.body.vehicleNumber;
    transfer.departureTime = today;
  }
  res.json(transfer);
});
app.post("/api/warehouse/material-transfers/:id/confirm-delivery", (req, res) => {
  const transfer = getTransfer(req, res);
  if (!transfer) return;
  if (role(req) !== "branch" || transfer.destinationBranchId !== "fixture_branch" || transfer.status !== "in_transit"
    || typeof req.body?.receiverSignature !== "string"
    || !req.body.receiverSignature.startsWith("data:image/png;base64,")
    || !Array.isArray(req.body?.receivedItems)
    || req.body.receivedItems.length !== transferItems(transfer.id).length
    || !transferItems(transfer.id).every(item => req.body.receivedItems.some((line: { itemId: number; receivedQuantity: number }) =>
      line.itemId === item.itemId && Number.isFinite(line.receivedQuantity) && line.receivedQuantity >= 0 && line.receivedQuantity <= item.quantity)))
    return deny(res, "Only destination receiver may confirm all dispatched quantities");
  receivedTransferItems.set(transfer.id, transferItems(transfer.id).map(item => {
    const line = req.body.receivedItems.find((entry: { itemId: number }) => entry.itemId === item.itemId);
    return { ...item, receivedQuantity: line.receivedQuantity,
      discrepancy: item.quantity - line.receivedQuantity,
      discrepancyNotes: line.discrepancyNotes || null };
  }));
  transfer.status = "delivered";
  transfer.receivedBy = actors[role(req)!].id;
  transfer.receivedByName = actors[role(req)!].name;
  transfer.receiverSignature = req.body.receiverSignature;
  transfer.arrivalTime = today;
  res.json(transfer);
});
app.post("/api/deliveries", (req, res) => {
  const external = req.body?.transportMode === "external";
  if (!["keeper", "admin"].includes(role(req)!) || (external
    ? !["road", "naqel", "other"].includes(req.body.carrier)
      || req.body.carrier === "other" && (typeof req.body.carrierName !== "string" || !req.body.carrierName.trim())
      || typeof req.body.waybill !== "string" || !req.body.waybill.trim()
      || !Number.isSafeInteger(req.body.packageCount) || req.body.packageCount < 1
      || req.body.trackingUrl && (typeof req.body.trackingUrl !== "string" || !/^https:\/\/[^ ]+$/i.test(req.body.trackingUrl))
      || req.body.driverId != null || req.body.vehicleNumber != null
    : req.body?.transportMode != null && req.body.transportMode !== "internal"
      || req.body?.driverId !== actors.driver.id
      || typeof req.body.vehicleNumber !== "string" || !req.body.vehicleNumber.trim())) return deny(res, "Invalid carrier or driver assignment");
  const source = transfers.find(x => x.id === Number(req.body.sourceId) && x.status === "approved");
  if (req.body.sourceType !== "material_transfer" || !source || deliveries.some(x => x.sourceId === source.id)) return deny(res, "Source must be an unassigned approved transfer");
  const added: DeliveryDTO = { ...deliveries[0], id: 9201 + deliveries.length, sourceId: source.id, sourceLabel: source.transferNumber,
    destinationBranchId: source.destinationBranchId, destinationBranchName: source.destinationBranchName,
    items: transferItems(source.id).map(x => ({ id: x.itemId, name: x.itemName, quantity: x.quantity, unit: x.unit })),
    transportMode: external ? "external" : "internal", driverId: external ? null : actors.driver.id,
    driverName: external ? null : actors.driver.name, vehicleNumber: external ? null : req.body.vehicleNumber.trim(),
    carrier: external ? req.body.carrier : null, carrierName: external && req.body.carrier === "other" ? req.body.carrierName.trim() : null,
    waybill: external ? req.body.waybill.trim() : null, trackingUrl: external ? req.body.trackingUrl || null : null,
    packageCount: external ? req.body.packageCount : null, attachments: [], exceptionReason: null, exceptionResolvedAt: null,
    status: "assigned", handoverRecordedAt: null, handoverAcknowledgedAt: null, handoverItems: null,
    proofPresent: false, proofAt: null, receiptApprovedBy: null, receiptApprovedAt: null, startedAt: null,
    completedAt: null, failedAt: null, failureReason: null };
  deliveries.push(added);
  res.status(201).json(deliveryFor(role(req)!, added));
});
app.post("/api/deliveries/:id/attachments", (req, res) => {
  evidenceUpload(req, res, error => {
    if (error) return res.status(400).json({ error: "Evidence file exceeds 10MB or upload is invalid" });
    const item = deliveries.find(x => x.id === Number(req.params.id));
    const transfer = item && transfers.find(x => x.id === item.sourceId);
    if (!item || !deliveryFor(role(req)!, item)) return res.status(404).json({ error: "Delivery unavailable" });
    if (!["keeper", "admin"].includes(role(req)!) || item.transportMode !== "external"
      || item.status !== "assigned" || item.handoverRecordedAt || transfer?.status !== "approved")
      return deny(res, "Carrier evidence upload is outside your source scope or state");
    const kind = req.body?.kind;
    const file = req.file;
    const data = file?.buffer;
    if (!data || !data.length || !["shipment_photo", "carrier_receipt"].includes(kind)) return res.status(400).json({ error: "File and kind are required" });
    const mime = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      && data.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130])) ? "image/png"
      : data[0] === 255 && data[1] === 216 && data[2] === 255 && data[data.length - 2] === 255 && data[data.length - 1] === 217 ? "image/jpeg"
      : data.subarray(0,4).toString() === "RIFF" && data.subarray(8,12).toString() === "WEBP"
        && data.length >= 12 && data.readUInt32LE(4) + 8 === data.length ? "image/webp"
      : data.subarray(0,5).toString() === "%PDF-" && data.subarray(-1024).toString("latin1").includes("%%EOF") ? "application/pdf" : null;
    if (!mime || file!.mimetype !== mime || kind === "shipment_photo" && mime === "application/pdf")
      return res.status(400).json({ error: "Unsupported file MIME/content" });
    const id = nextEvidenceId++;
    const attachment: DeliveryDTO["attachments"][number] = {
      id, kind, mimeType: mime, originalName: file!.originalname.slice(0, 200),
      downloadUrl: `/api/deliveries/${item.id}/attachments/${id}`,
    };
    evidenceBytes.set(id, data);
    item.attachments.push(attachment);
    res.status(201).json(attachment);
  });
});
app.get("/api/deliveries/:id/attachments/:attachmentId", (req, res) => {
  const item = deliveries.find(x => x.id === Number(req.params.id));
  if (!item || !deliveryFor(role(req)!, item)) return res.status(404).json({ error: "Delivery unavailable" });
  const file = item.attachments.find(x => x.id === Number(req.params.attachmentId));
  if (!file) return res.status(404).json({ error: "Attachment unavailable" });
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox");
  res.send(evidenceBytes.get(file.id));
});
app.post("/api/deliveries/:id/:action", (req, res) => {
  const delivery = deliveries.find(x => x.id === Number(req.params.id));
  if (!delivery) return res.status(404).json({ error: "Delivery unavailable" });
  const actor = role(req)!;
  const current = deliveryFor(actor, delivery);
  if (!current) return res.status(404).json({ error: "Delivery unavailable" });
  const action = req.params.action;
  if (action === "handover" && current.capabilities.canRecordHandover
    && Array.isArray(req.body?.items) && req.body.items.length === delivery.items.length
    && delivery.items.every(item => req.body.items.some((line: { id: number; quantity: number }) =>
      line.id === item.id && line.quantity === item.quantity))) {
    delivery.handoverRecordedAt = today; delivery.handoverItems = delivery.items.map(x => ({ ...x }));
  } else if (action === "acknowledge-handover" && current.capabilities.canAcknowledgeHandover) {
    delivery.handoverAcknowledgedAt = today;
  } else if (action === "start" && current.capabilities.canStart) {
    delivery.status = delivery.transportMode === "external" ? "awaiting_receipt" : "in_transit"; delivery.startedAt = today;
  } else if (action === "proof" && current.capabilities.canSubmitProof
    && typeof req.body?.receiverName === "string" && req.body.receiverName.trim()
    && typeof req.body.signatureData === "string" && req.body.signatureData.startsWith("data:image/")) {
    delivery.proofPresent = true; delivery.proofAt = today; delivery.receiverName = req.body.receiverName.trim();
    delivery.status = "awaiting_receipt";
  } else if (action === "approve-receipt" && current.capabilities.canApproveReceipt) {
    delivery.status = "receipt_approved"; delivery.receiptApprovedBy = actors[actor].id; delivery.receiptApprovedAt = today;
  } else if (action === "complete" && current.capabilities.canComplete) {
    delivery.status = "completed"; delivery.completedAt = today;
  } else if (action === "fail" && current.capabilities.canFail && delivery.transportMode === "external"
    && typeof req.body?.reason === "string" && req.body.reason.trim().length >= 3) {
    delivery.exceptionReason = req.body.reason.trim(); delivery.exceptionResolvedAt = null; delivery.failedAt = today;
  } else if (action === "resolve-exception" && current.capabilities.canResolveException
    && typeof req.body?.resolution === "string" && req.body.resolution.trim().length >= 3) {
    delivery.exceptionReason = null; delivery.exceptionResolvedAt = today;
  } else return deny(res, `Action ${action} is not permitted for ${actor} in ${delivery.status}`);
  delivery.updatedAt = today;
  return res.json(deliveryFor(actor, delivery));
});
app.use("/api", (req, res) => res.status(404).json({ error: `No synthetic fixture for ${req.method} ${req.originalUrl}` }));

app.get(["/users", "/transfer-requests", "/warehouse", "/driver-deliveries", "/central-kitchen-orders", "/reverse-logistics", "/branch-operations", "/production-dashboard"], (req, res) => {
  const saved = /(?:^|;\s*)fixture_role=(keeper|branch|branch-multi|driver|admin)(?:;|$)/.exec(req.headers.cookie || "")?.[1];
  const selected = role(req) || (saved as Role | undefined);
  if (!selected) return res.status(400).send("Choose ?role=keeper|branch|branch-multi|driver|admin");
  res.cookie("fixture_role", selected, { sameSite: "strict", httpOnly: true });
  const entry = resolve(process.cwd(), "tests/fixtures/warehouse-role-entry.tsx");
  res.type("html").send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNTHETIC Warehouse Role Fixture</title></head><body><div id="root"></div><script>const role=${JSON.stringify(selected)};const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input.url,location.href);if(url.origin!==location.origin)return Promise.reject(new Error("Synthetic fixture prohibits external requests"));if(url.pathname.startsWith("/api/")){url.searchParams.set("role",role);return nativeFetch(url,init)}return nativeFetch(input,init)};const preserveFixtureRole=()=>{document.querySelectorAll('#root a[target="_blank"][href]').forEach(link=>{const url=new URL(link.getAttribute("href"),location.href);if(url.origin===location.origin&&["/transfer-requests","/central-kitchen-orders","/driver-deliveries","/reverse-logistics"].includes(url.pathname)&&url.searchParams.get("role")!==role){url.searchParams.set("role",role);link.setAttribute("href",url.pathname+url.search+url.hash)}})};new MutationObserver(preserveFixtureRole).observe(document.getElementById("root"),{childList:true,subtree:true,attributes:true,attributeFilter:["href"]});</script><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${entry}"></script></body></html>`);
});
// Vite may serve assets, but it must never handle an unrecognized application write.
app.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : res.status(405).json({ error: "No synthetic fixture for this write" }));
async function main() {
  const vite = await createViteServer({ server: { middlewareMode: true, fs: { allow: [resolve(process.cwd())] } }, appType: "custom" });
  app.use(vite.middlewares);
  const port = Number(process.env.WAREHOUSE_ROLE_FIXTURE_PORT || 5058);
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  console.log(`SYNTHETIC in-memory warehouse fixture: http://127.0.0.1:${port}/transfer-requests?role=keeper · multi-branch: http://127.0.0.1:${port}/branch-operations?role=branch-multi`);
  const close = () => { server.close(); void vite.close(); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
  if (process.argv.includes("--verify")) {
    try {
      const call = async (path: string, actor: Role, method = "GET", body?: unknown) => {
        const response = await fetch(`http://127.0.0.1:${port}/api${path}${path.includes("?") ? "&" : "?"}role=${actor}`, {
          method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, json: await response.json() };
      };
      assert.equal((await call("/auth/init", "keeper")).json.user.branchId, null);
      const multi = (await call("/auth/init", "branch-multi")).json;
      assert.equal(multi.user.role, "branch_manager");
      assert.equal(multi.user.branchId, null);
      assert.equal(multi.user.activeBranchId, null);
      assert.deepEqual(multi.branches.map((branch: { id: string }) => branch.id), ["allowedA", "allowedB"]);
      assert.equal((await call("/branch-operations/summary?branchId=allowedA", "branch-multi")).json.branchId, "allowedA");
      assert.equal((await call("/branch-operations/summary?branchId=allowedB", "branch-multi")).json.branchId, "allowedB");
      assert.equal((await call("/branch-operations/summary?branchId=deniedC", "branch-multi")).status, 403);
      assert.equal((await call("/auth/active-branch", "branch-multi", "PATCH", { branchId: "deniedC" })).status, 403);
      assert.equal((await call("/auth/active-branch", "branch-multi", "PATCH", { branchId: "allowedB" })).json.activeBranchId, "allowedB");
      assert.equal((await call("/warehouse/material-transfers?branchId=deniedC", "branch-multi")).status, 403);
      assert.equal((await call("/warehouse/material-transfers?branchId=main_warehouse", "keeper")).json.length, 66);
      assert.equal((await call("/warehouse/items", "keeper")).json.length, 65);
      const branchPermissions = (await call("/auth/init", "branch")).json.permissions as { module: string; actions: string[] }[];
      assert.deepEqual(branchPermissions.find(p => p.module === "warehouse")?.actions, []);
      assert.ok(branchPermissions.find(p => p.module === "branch_supply")?.actions.includes("create"));
      assert.equal((await call("/warehouse/material-transfers", "branch", "POST", {
        sourceBranchId: "main_warehouse", destinationBranchId: "other_branch",
        items: [{ itemId: catalog[0].id, quantity: 2 }],
      })).status, 403);
      const requested = await call("/warehouse/material-transfers", "branch", "POST", {
        sourceBranchId: "main_warehouse", destinationBranchId: "fixture_branch",
        items: [{ itemId: catalog[0].id, quantity: 2.5 }],
      });
      assert.equal(requested.status, 201);
      assert.equal((await call(`/warehouse/material-transfers/${requested.json.id}/items`, "branch")).json[0].quantity, 2.5);
      assert.equal((await call("/reverse-logistics", "branch")).json.length, 2);
      assert.equal((await call("/reverse-logistics/sources", "branch")).json.products.length, 1);
      assert.equal((await call("/reverse-logistics", "branch", "POST", {
        kind: "material_return", originalTransferItemId: 41020, quantity: 1,
      })).status, 201);
      assert.equal((await call("/reverse-logistics", "driver")).status, 403);
      assert.equal((await call("/central-kitchen-orders", "branch")).json.data[0].requestBranchId, "fixture_branch");
      assert.equal((await call("/central-kitchen-orders/policy", "branch")).json.timeZone, "Asia/Riyadh");
      assert.equal((await call("/central-kitchen-orders", "branch", "POST", {
        requestBranchId: "other_branch", centralKitchenId: "fixture_kitchen",
        items: [{ productId: 7001, requestedQuantity: 2, reportedAvailableQuantity: 0 }],
      })).status, 403);
      assert.equal((await call("/central-kitchen-orders", "branch", "POST", {
        requestBranchId: "fixture_branch", centralKitchenId: "fixture_kitchen",
        items: [{ productId: 7001, productName: "منتج مطبخ اصطناعي",
          unit: "قطعة", requestedQuantity: 2, reportedAvailableQuantity: 0 }],
      })).status, 201);
      const reverseDraft = (await call("/reverse-logistics", "branch")).json[0];
      assert.equal((await call(`/reverse-logistics/${reverseDraft.id}/request`, "branch", "POST")).json.status, "requested");
      assert.equal((await call(`/reverse-logistics/${reverseDraft.id}/dispatch`, "branch", "POST")).status, 403);
      assert.equal((await call("/warehouse/material-transfers?branchId=fixture_branch", "keeper")).status, 403);
      assert.equal((await call("/warehouse/material-transfers?branchId=fixture_branch", "branch")).json.length, 51);
      for (const branchId of ["allowedA", "allowedB"]) {
        const created = await call("/warehouse/material-transfers", "branch-multi", "POST", {
          sourceBranchId: "main_warehouse", destinationBranchId: branchId,
          items: [{ itemId: catalog[0].id, quantity: 2 }],
        });
        assert.equal(created.status, 201);
        assert.equal(created.json.destinationBranchId, branchId);
        assert.equal((await call(`/warehouse/material-transfers?branchId=${branchId}`, "branch-multi")).json.length, 1);
      }
      assert.equal((await call("/warehouse/material-transfers", "branch-multi", "POST", {
        sourceBranchId: "main_warehouse", destinationBranchId: "deniedC",
        items: [{ itemId: catalog[0].id, quantity: 2 }],
      })).status, 403);
      assert.equal((await call("/warehouse/material-transfers/10073", "branch")).json.transfer.status, "in_transit");
      assert.equal((await call("/deliveries/10073", "branch")).json.capabilities.canApproveReceipt, false);
      assert.equal((await call("/warehouse/material-transfers/10073/confirm-delivery", "branch", "POST", {
        receivedItems: transferItems(10073).map(x => ({ itemId: x.itemId, receivedQuantity: x.quantity })),
      })).status, 403);
      assert.equal((await call("/warehouse/material-transfers/10073/confirm-delivery", "branch", "POST", {
        receivedItems: transferItems(10073).map(x => ({ itemId: x.itemId, receivedQuantity: x.quantity })),
        receiverSignature: `data:image/png;base64,${receiptPhoto.toString("base64")}`,
      })).status, 200);
      assert.equal((await call("/warehouse/material-transfers/10073", "branch")).json.transfer.receivedBy, actors.branch.id);
      assert.equal((await call("/deliveries/10073", "branch")).json.capabilities.canApproveReceipt, true);
      assert.equal((await call("/deliveries/10073/approve-receipt", "branch", "POST")).json.status, "receipt_approved");
      assert.equal((await call("/deliveries/10073/approve-receipt", "branch", "POST")).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4104", "branch")).status, 404);
      assert.equal((await call("/users", "branch")).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4101/status", "driver", "PUT", { status: "approved" })).status, 404);
      assert.equal((await call("/warehouse/material-transfers/4101/status", "branch", "PUT", { status: "approved" })).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4101/status", "keeper", "PUT", { status: "approved" })).status, 200);
      assert.equal((await call("/warehouse/material-transfers/4101/status", "keeper", "PUT", { status: "in_transit" })).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4101/status", "keeper", "PUT", {
        status: "in_transit", driverName: "سائق التوصيل", vehicleNumber: "FIX-123",
      })).status, 200);
      assert.equal((await call("/warehouse/material-transfers/4101/confirm-delivery", "keeper", "POST", { receivedItems: [] })).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4101/confirm-delivery", "branch", "POST", {
        receivedItems: transferItems(4101).map(x => ({ itemId: x.itemId, receivedQuantity: x.quantity })),
        receiverSignature: `data:image/png;base64,${receiptPhoto.toString("base64")}`,
      })).status, 200);
      assert.equal((await call("/deliveries", "driver")).json.deliveries.length, 2);
      assert.equal((await call("/deliveries/9201/handover", "driver", "POST", { items: [] })).status, 403);
      assert.equal((await call("/deliveries/9201/handover", "keeper", "POST", { items: deliveries[0].items })).status, 200);
      assert.equal((await call("/deliveries/9201/acknowledge-handover", "driver", "POST")).status, 200);
      assert.equal((await call("/deliveries/9201/start", "driver", "POST")).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4102/status", "keeper", "PUT", {
        status: "in_transit", driverName: "سائق التوصيل", vehicleNumber: "FIX-123",
      })).status, 200);
      assert.equal((await call("/deliveries/9201/start", "driver", "POST")).status, 200);
      assert.equal((await call("/not-implemented", "admin")).status, 404);
      assert.equal((await call("/users", "admin", "POST", { username: "no-write" })).status, 404);
      const external = (await call("/deliveries", "keeper", "POST", {
        sourceType: "material_transfer", sourceId: 4106, transportMode: "external",
        carrier: "other", carrierName: "ناقل تجريبي", waybill: "FIX-WAYBILL-006", packageCount: 2,
        trackingUrl: "https://example.invalid/fixture-waybill",
      }));
      assert.equal(external.status, 201);
      const externalId = external.json.id;
      assert.equal(external.json.driverId, null);
      assert.equal((await call(`/deliveries/${externalId}/start`, "keeper", "POST")).status, 403);
      assert.equal((await call(`/deliveries/${externalId}/handover`, "keeper", "POST", { items: external.json.items })).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4106/status", "keeper", "PUT", { status: "in_transit" })).status, 403);
      const upload = async (actor: Role, kind: string, filename: string, mime: string, data: Uint8Array) => {
        const form = new FormData();
        form.append("kind", kind);
        form.append("file", new Blob([data], { type: mime }), filename);
        const response = await fetch(`http://127.0.0.1:${port}/api/deliveries/${externalId}/attachments?role=${actor}`, { method: "POST", body: form });
        return { status: response.status, json: await response.json() };
      };
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9n1xZIoAAAAASUVORK5CYII=", "base64");
      assert.equal((await upload("branch", "shipment_photo", "shipment.png", "image/png", png)).status, 403);
      assert.equal((await upload("keeper", "shipment_photo", "fake.png", "image/png", Buffer.from("not an image"))).status, 400);
      assert.equal((await upload("keeper", "shipment_photo", "shipment.png", "image/png", png)).status, 201);
      assert.equal((await upload("keeper", "carrier_receipt", "receipt.pdf", "application/pdf", Buffer.from("%PDF-1.4\n%%EOF"))).status, 201);
      assert.equal((await call(`/deliveries/${externalId}/handover`, "keeper", "POST", {
        items: external.json.items.map((x: { id: number; quantity: number }, index: number) =>
          ({ id: x.id, quantity: index === 0 ? x.quantity + 1 : x.quantity })),
      })).status, 403);
      assert.equal((await call(`/deliveries/${externalId}/handover`, "keeper", "POST", { items: external.json.items })).status, 200);
      assert.equal((await upload("keeper", "carrier_receipt", "late.pdf", "application/pdf", Buffer.from("%PDF-1.4\n%%EOF"))).status, 403);
      assert.equal((await call(`/deliveries/${externalId}/acknowledge-handover`, "driver", "POST")).status, 404);
      assert.equal((await call("/warehouse/material-transfers/4106/status", "keeper", "PUT", { status: "in_transit" })).status, 200);
      assert.equal((await call(`/deliveries/${externalId}/start`, "keeper", "POST")).json.status, "awaiting_receipt");
      assert.equal((await call(`/deliveries/${externalId}/approve-receipt`, "branch", "POST")).status, 403);
      assert.equal((await call(`/deliveries/${externalId}/fail`, "keeper", "POST", { reason: "Delayed at carrier" })).json.status, "awaiting_receipt");
      assert.equal((await call(`/deliveries/${externalId}/complete`, "keeper", "POST")).status, 403);
      assert.equal((await call("/warehouse/material-transfers/4106/confirm-delivery", "branch", "POST", {
        receivedItems: transferItems(4106).map(x => ({ itemId: x.itemId, receivedQuantity: x.quantity })),
        receiverSignature: `data:image/png;base64,${receiptPhoto.toString("base64")}`,
      })).status, 200);
      assert.equal((await call(`/deliveries/${externalId}/approve-receipt`, "keeper", "POST")).status, 403);
      assert.equal((await call(`/deliveries/${externalId}/approve-receipt`, "branch", "POST")).json.status, "receipt_approved");
      assert.equal((await call(`/deliveries/${externalId}/complete`, "keeper", "POST")).status, 403);
      assert.equal((await call(`/deliveries/${externalId}/resolve-exception`, "keeper", "POST", { resolution: "Carrier delivered and branch received" })).status, 200);
      assert.equal((await call(`/deliveries/${externalId}/complete`, "keeper", "POST")).json.status, "completed");
      assert.equal((await call(`/deliveries/${externalId}/attachments/1`, "driver")).status, 404);
      const workspace = (await call("/deliveries/workspace", "admin")).json as DeliveryWorkspaceResponse;
      assert.equal(workspace.pageSize, 25);
      assert.ok(workspace.total > 50);
      assert.equal(workspace.deliveries.length, 25);
      assert.equal(workspace.counts.active, workspace.total);
      const second = (await call("/deliveries/workspace?page=2", "admin")).json as DeliveryWorkspaceResponse;
      assert.equal(second.deliveries.length, 25);
      assert.ok(!workspace.deliveries.some(item => second.deliveries.some(other => other.id === item.id)));
      const waybill = (await call("/deliveries/workspace?q=FIX-WAY-002&status=all", "admin")).json as DeliveryWorkspaceResponse;
      assert.equal(waybill.total, 1);
      assert.equal(waybill.deliveries[0].waybill, "FIX-WAY-002");
      const completed = (await call("/deliveries/workspace?status=completed", "admin")).json as DeliveryWorkspaceResponse;
      assert.equal(completed.total, completed.counts.completed);
      assert.ok(completed.total > 0);
      const branch = (await call("/deliveries/workspace?status=all&destinationBranchId=fixture_branch&carrier=internal", "branch")).json as DeliveryWorkspaceResponse;
      assert.ok(branch.total > 0);
      assert.ok(branch.deliveries.every(item => item.destinationBranchId === "fixture_branch" && item.transportMode === "internal"));
      assert.equal((await call("/deliveries/workspace?status=all&destinationBranchId=other_branch", "branch")).json.total, 0);
      assert.equal((await call("/deliveries/workspace?status=all", "driver")).json.deliveries.every((item: DeliveryDTO) => item.driverId === actors.driver.id), true);
      assert.equal((await call(`/deliveries/${waybill.deliveries[0].id}`, "admin")).json.waybill, "FIX-WAY-002");
      assert.equal((await call(`/deliveries/${waybill.deliveries[0].id}`, "driver")).status, 404);
      assert.equal((await call("/deliveries/workspace?pageSize=20", "admin")).status, 400);
      console.log("Synthetic internal and external API assertions passed. Browser UI not launched.");
    } finally { close(); }
  }
}
void main();