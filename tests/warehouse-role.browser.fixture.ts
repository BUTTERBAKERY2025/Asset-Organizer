/**
 * Isolated synthetic API serving the REAL warehouse, transfer, delivery and user pages.
 * npx tsx tests/warehouse-role.browser.fixture.ts --serve
 * Nothing is proxied: unknown API requests and all unlisted writes fail closed.
 * Mutations below change only process memory; restart the fixture to reset state.
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import type { DeliveryDTO, DeliverySource } from "../shared/delivery";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
const roleNames = ["keeper", "branch", "driver", "admin"] as const;
type Role = typeof roleNames[number];
const branches = [
  { id: "main_warehouse", name: "المستودع الرئيسي", nameAr: "المستودع الرئيسي", isCentralKitchen: false },
  { id: "fixture_branch", name: "فرع الاختبار", nameAr: "فرع الاختبار", isCentralKitchen: false },
  { id: "other_branch", name: "فرع آخر", nameAr: "فرع آخر", isCentralKitchen: false },
];
const actors = {
  keeper: { id: "fixture-keeper", username: "fixture-keeper", firstName: "أمين", lastName: "المستودع", name: "أمين المستودع", role: "warehouse_keeper", branchId: null, activeBranchId: null, allowedBranches: [] },
  branch: { id: "fixture-branch-manager", username: "fixture-branch-manager", firstName: "مدير", lastName: "الفرع", name: "مدير الفرع", role: "branch_manager", branchId: "fixture_branch", activeBranchId: "fixture_branch", allowedBranches: [{ id: 1, userId: "fixture-branch-manager", branchId: "fixture_branch", accessLevel: "manager", isDefault: true }] },
  driver: { id: "fixture-driver", username: "fixture-driver", firstName: "سائق", lastName: "التوصيل", name: "سائق التوصيل", role: "employee", jobTitle: "delivery", branchId: "fixture_branch", activeBranchId: "fixture_branch", allowedBranches: [{ id: 2, userId: "fixture-driver", branchId: "fixture_branch", accessLevel: "employee", isDefault: true }] },
  admin: { id: "fixture-admin", username: "fixture-admin", firstName: "مدير", lastName: "النظام", name: "مدير النظام", role: "admin", branchId: null, activeBranchId: null, allowedBranches: [] },
};
const today = "2035-06-09T09:00:00.000Z";
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
const transferItems = (id: number) => Array.from({ length: 3 }, (_, j) => {
  const item = catalog[(id - 4101 + j) % catalog.length];
  return { id: id * 10 + j, transferId: id, itemId: item.id, itemName: item.name,
    category: item.category, unit: item.unit, quantity: 3 + j, originalQuantity: null,
    receivedQuantity: null, discrepancy: null, discrepancyNotes: null, notes: null,
    availableQuantity: item.quantity, isModified: false };
});
const deliveries: DeliveryDTO[] = [
  { id: 9201, sourceType: "material_transfer", sourceId: 4102, sourceStatus: "approved",
    sourceLabel: "FIX-WH-002", sourceBranchId: "main_warehouse", sourceBranchName: "المستودع الرئيسي",
    destinationBranchId: "fixture_branch", destinationBranchName: "فرع الاختبار",
    items: transferItems(4102).map(x => ({ id: x.itemId, name: x.itemName, quantity: x.quantity, unit: x.unit })),
    driverId: "fixture-driver", driverName: "سائق التوصيل", vehicleNumber: "FIX-123",
    scheduledAt: today, status: "assigned", receiverName: null, notes: null,
    proofPresent: false, proofAt: null, receiptApprovedBy: null, receiptApprovedAt: null,
    startedAt: null, completedAt: null, failedAt: null, failureReason: null,
    cancellationReason: null, createdAt: today, updatedAt: today,
    handoverRecordedAt: null, handoverAcknowledgedAt: null, handoverItems: null,
    handoverInvalidated: false, capabilities: { canRecordHandover: false, canAcknowledgeHandover: false,
      canStart: false, canSubmitProof: false, canApproveReceipt: false, canComplete: false,
      canFail: false, canReassign: false, canCancel: false } },
];
function role(req: express.Request): Role | null {
  const selected = req.query.role;
  return typeof selected === "string" && (roleNames as readonly string[]).includes(selected) ? selected as Role : null;
}
function deny(res: express.Response, message = "Synthetic fixture denies this operation") {
  return res.status(403).json({ error: message });
}
function scopedBranches(actor: Role) {
  return actor === "branch" || actor === "driver" ? [branches[1]] : branches;
}
function perms(actor: Role) {
  const actions = actor === "keeper" ? ["view", "create", "edit", "approve", "export"] : actor === "branch" ? ["view", "create", "edit"] : actor === "driver" ? [] : ["view", "create", "edit", "approve", "export", "delete"];
  return ["warehouse", "delivery_tasks", "dashboard"].map(module => ({ module, actions: module === "warehouse" ? actions : module === "delivery_tasks" ? actor === "branch" ? ["view"] : ["view", "create", "edit"] : ["view"] }));
}
function visibleTransfer(actor: Role, transfer: Transfer) {
  return actor === "admin" || actor === "keeper" && transfer.sourceBranchId === "main_warehouse"
    || actor === "branch" && transfer.destinationBranchId === "fixture_branch";
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
  const own = actor === "driver" && delivery.driverId === actors.driver.id;
  const source = actor === "keeper" || actor === "admin";
  const receiver = actor === "branch" && delivery.destinationBranchId === "fixture_branch";
  if (!own && !source && !receiver) return null;
  return { ...delivery, sourceStatus: transfers.find(x => x.id === delivery.sourceId)?.status || delivery.sourceStatus, capabilities: {
    canRecordHandover: source && delivery.status === "assigned" && !delivery.handoverRecordedAt,
    canAcknowledgeHandover: own && delivery.status === "assigned" && !!delivery.handoverRecordedAt && !delivery.handoverAcknowledgedAt,
    canStart: own && delivery.status === "assigned" && !!delivery.handoverAcknowledgedAt
      && transfers.find(x => x.id === delivery.sourceId)?.status === "in_transit",
    canSubmitProof: own && delivery.status === "in_transit"
      && transfers.find(x => x.id === delivery.sourceId)?.status === "in_transit",
    canApproveReceipt: receiver && delivery.status === "awaiting_receipt" && delivery.proofPresent && transfers.find(x => x.id === delivery.sourceId)?.status === "delivered",
    canComplete: own && delivery.status === "receipt_approved",
    canFail: own && ["assigned", "in_transit", "awaiting_receipt"].includes(delivery.status),
    canReassign: source && delivery.status !== "completed",
    canCancel: source && delivery.status === "assigned",
  } };
}

// Require an explicit role on EVERY API request. Cookies and live authentication are never consulted.
app.use("/api", (req, res, next) => {
  res.setHeader("X-Synthetic-Warehouse-Fixture", "in-memory-only");
  if (!role(req)) return res.status(400).json({ error: "Supply ?role=keeper|branch|driver|admin on every fixture request" });
  next();
});
app.get("/api/auth/init", (req, res) => res.json({ user: actors[role(req)!], permissions: perms(role(req)!), branches: scopedBranches(role(req)!) }));
app.get("/api/auth/me", (req, res) => res.json(actors[role(req)!]));
app.get("/api/my-permissions", (req, res) => res.json(perms(role(req)!)));
app.get("/api/branches", (req, res) => res.json(scopedBranches(role(req)!)));
app.get("/api/users", (req, res) => role(req) === "admin"
  ? res.json(Object.values(actors).map(user => ({ ...user, isActive: "active", email: null }))) : deny(res));
app.get("/api/rbac/users/:id/branches", (req, res) => {
  if (role(req) !== "admin") return deny(res);
  const actor = Object.values(actors).find(user => user.id === req.params.id);
  return actor ? res.json(actor.allowedBranches) : res.status(404).json({ error: "User unavailable" });
});
app.get("/api/warehouse/items", (req, res) => role(req) === "driver" ? deny(res) : res.json(catalog));
app.get("/api/warehouse/material-transfers", (req, res) => {
  const actor = role(req)!;
  if (actor === "driver") return deny(res);
  if (actor === "keeper" && req.query.branchId !== "main_warehouse") return deny(res, "Keeper scope is main_warehouse only");
  if (actor === "branch" && req.query.branchId !== "fixture_branch") return deny(res, "Branch scope is fixture_branch only");
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
    || actor === "branch" && req.query.branchId !== "fixture_branch") return deny(res);
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
  const item = deliveries.find(x => x.id === Number(req.params.id));
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
  if (!["keeper", "admin"].includes(actor) || !(
    transfer.status === "pending" && status === "approved" ||
    transfer.status === "approved" && status === "in_transit" && typeof req.body.driverName === "string" && !!req.body.driverName.trim()
      && typeof req.body.vehicleNumber === "string" && !!req.body.vehicleNumber.trim()
  )) return deny(res, "Only keeper/admin may approve a pending transfer or dispatch an approved transfer with driver and vehicle");
  transfer.status = status;
  if (status === "in_transit") {
    transfer.driverName = req.body.driverName;
    transfer.vehicleNumber = req.body.vehicleNumber;
    transfer.departureTime = today;
  }
  res.json(transfer);
});
app.post("/api/warehouse/material-transfers/:id/confirm-delivery", (req, res) => {
  const transfer = getTransfer(req, res);
  if (!transfer) return;
  if (!["branch", "admin"].includes(role(req)!) || transfer.status !== "in_transit"
    || !Array.isArray(req.body?.receivedItems)
    || req.body.receivedItems.length !== transferItems(transfer.id).length
    || !transferItems(transfer.id).every(item => req.body.receivedItems.some((line: { itemId: number; receivedQuantity: number }) =>
      line.itemId === item.itemId && Number.isFinite(line.receivedQuantity) && line.receivedQuantity >= 0 && line.receivedQuantity <= item.quantity)))
    return deny(res, "Only destination receiver may confirm all dispatched quantities");
  transfer.status = "delivered";
  transfer.receivedBy = actors[role(req)!].id;
  transfer.receivedByName = actors[role(req)!].name;
  transfer.arrivalTime = today;
  res.json(transfer);
});
app.post("/api/deliveries", (req, res) => {
  if (!["keeper", "admin"].includes(role(req)!) || req.body?.driverId !== actors.driver.id
    || typeof req.body.vehicleNumber !== "string" || !req.body.vehicleNumber.trim()) return deny(res);
  const source = transfers.find(x => x.id === Number(req.body.sourceId) && x.status === "approved");
  if (req.body.sourceType !== "material_transfer" || !source || deliveries.some(x => x.sourceId === source.id)) return deny(res, "Source must be an unassigned approved transfer");
  const added: DeliveryDTO = { ...deliveries[0], id: 9201 + deliveries.length, sourceId: source.id, sourceLabel: source.transferNumber,
    destinationBranchId: source.destinationBranchId, destinationBranchName: source.destinationBranchName,
    items: transferItems(source.id).map(x => ({ id: x.itemId, name: x.itemName, quantity: x.quantity, unit: x.unit })),
    vehicleNumber: req.body.vehicleNumber.trim(), status: "assigned", handoverRecordedAt: null,
    handoverAcknowledgedAt: null, handoverItems: null, proofPresent: false, proofAt: null };
  deliveries.push(added);
  res.status(201).json(deliveryFor(role(req)!, added));
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
    delivery.handoverRecordedAt = today; delivery.handoverItems = delivery.items;
  } else if (action === "acknowledge-handover" && current.capabilities.canAcknowledgeHandover) {
    delivery.handoverAcknowledgedAt = today;
  } else if (action === "start" && current.capabilities.canStart) {
    delivery.status = "in_transit"; delivery.startedAt = today;
  } else if (action === "proof" && current.capabilities.canSubmitProof
    && typeof req.body?.receiverName === "string" && req.body.receiverName.trim()
    && typeof req.body.signatureData === "string" && req.body.signatureData.startsWith("data:image/")) {
    delivery.proofPresent = true; delivery.proofAt = today; delivery.receiverName = req.body.receiverName.trim();
    delivery.status = "awaiting_receipt";
  } else if (action === "approve-receipt" && current.capabilities.canApproveReceipt) {
    delivery.status = "receipt_approved"; delivery.receiptApprovedBy = actors[actor].id; delivery.receiptApprovedAt = today;
  } else if (action === "complete" && current.capabilities.canComplete) {
    delivery.status = "completed"; delivery.completedAt = today;
  } else return deny(res, `Action ${action} is not permitted for ${actor} in ${delivery.status}`);
  delivery.updatedAt = today;
  return res.json(deliveryFor(actor, delivery));
});
app.use("/api", (req, res) => res.status(404).json({ error: `No synthetic fixture for ${req.method} ${req.originalUrl}` }));

app.get(["/users", "/transfer-requests", "/warehouse", "/driver-deliveries"], (req, res) => {
  const saved = /(?:^|;\s*)fixture_role=(keeper|branch|driver|admin)(?:;|$)/.exec(req.headers.cookie || "")?.[1];
  const selected = role(req) || (saved as Role | undefined);
  if (!selected) return res.status(400).send("Choose ?role=keeper|branch|driver|admin");
  res.cookie("fixture_role", selected, { sameSite: "strict", httpOnly: true });
  const entry = resolve(process.cwd(), "tests/fixtures/warehouse-role-entry.tsx");
  res.type("html").send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNTHETIC Warehouse Role Fixture</title></head><body><div id="root"></div><script>const role=${JSON.stringify(selected)};const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input.url,location.href);if(url.origin!==location.origin)return Promise.reject(new Error("Synthetic fixture prohibits external requests"));if(url.pathname.startsWith("/api/")){url.searchParams.set("role",role);return nativeFetch(url,init)}return nativeFetch(input,init)};</script><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${entry}"></script></body></html>`);
});
// Vite may serve assets, but it must never handle an unrecognized application write.
app.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : res.status(405).json({ error: "No synthetic fixture for this write" }));
async function main() {
  const vite = await createViteServer({ server: { middlewareMode: true, fs: { allow: [resolve(process.cwd())] } }, appType: "custom" });
  app.use(vite.middlewares);
  const port = Number(process.env.WAREHOUSE_ROLE_FIXTURE_PORT || 5058);
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  console.log(`SYNTHETIC in-memory warehouse fixture: http://127.0.0.1:${port}/transfer-requests?role=keeper`);
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
      assert.equal((await call("/warehouse/material-transfers?branchId=main_warehouse", "keeper")).json.length, 65);
      assert.equal((await call("/warehouse/items", "keeper")).json.length, 65);
      assert.equal((await call("/warehouse/material-transfers?branchId=fixture_branch", "keeper")).status, 403);
      assert.equal((await call("/warehouse/material-transfers?branchId=fixture_branch", "branch")).json.length, 49);
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
      })).status, 200);
      assert.equal((await call("/deliveries", "driver")).json.deliveries.length, 1);
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
      console.log("Synthetic API assertions passed. Browser UI not launched.");
    } finally { close(); }
  }
}
void main();