import type { Request } from "express";
import type { OperationsSupplyRecord, OperationsSupplyResponse, OperationsSupplySource, SupplyCoverage } from "@shared/operations-supply";
import { operationsSupplySources, supplyPagePlan, uniqueSupplyRecords } from "@shared/operations-supply";
import { makeOperationsQueueItem, operationsDecisionMetadata, validateOperationsBranches } from "@shared/operations-center";
import { receiptMatchesSource, type DeliverySourceType } from "@shared/delivery";
import { pool, db } from "./db";
import { getAllowedBranchIds } from "./auth";
import { hasEffectiveViewPermission } from "./branch-operations";
import { kitchenActionAllowed } from "./central-kitchen-routing";
import { branchSupplyTransferAllowed } from "./branch-supply-transfer-policy";
import {
  operationsSupplySql, supplyDestinationAuthority, supplyMainWarehouseAuthority, supplyTransferSourceAuthority,
  type SupplyActor, type SupplyGrants,
} from "./operations-supply-predicates";
import { deliveryTransitionAllowed } from "@shared/delivery";

export type SupplyRow = {
  id: string; status: string; source_branch_id: string | null; destination_branch_id: string | null;
  inventory_mode?: string | null; runtime_mode?: string | null;
  needed_date?: string | null; needed_time?: string | null; discrepancy_status?: string;
  kind?: string; source_warehouse_id?: number | null; destination_warehouse_id?: number | null;
  damaged_quantity?: number | string; written_off_quantity?: number | string;
  driver_id?: string | null; scheduled_at?: Date | string | null;
  source_type?: DeliverySourceType; source_id?: string; source_status?: string; received_by?: string | null;
  proof_present?: boolean; evidence_ready?: boolean; transport_mode?: string; can_receive?: boolean; can_manage?: boolean;
  handover_recorded_at?: Date | string | null; receipt_approved_by?: string | null; exception_reason?: string | null;
};
const descriptions: Record<OperationsSupplySource, { label: string; definition: string }> = {
  kitchen: { label: "طلبات المطبخ المفتوحة", definition: "طلبات فريدة للجهة الطالبة أو الموردة ضمن النطاق المسموح؛ مراحل requested/approved/prepared/dispatched أو received بفروق استلام مفتوحة؛ ليست كمية مخزون." },
  transfers: { label: "تحويلات مواد مفتوحة", definition: "تحويلات مواد فريدة pending/approved/in_transit ضمن الأطراف المسموح بها؛ التحويل بين فرعين مختارين يُحسب مرة واحدة؛ لا يشمل فروقاً بلا دورة تسوية." },
  reverse: { label: "مرتجعات ونقل مستودعات تحتاج متابعة", definition: "حركات فريدة draft/requested/dispatched/received، أو inspected بكمية تالفة أكبر من المشطوبة؛ نقل المستودعات يظهر ضمن نطاق مكتب المستودع الرئيسي المحدد صراحة لصاحب الصلاحية العامة، لا بوصفه حركة مرتبطة بفرع." },
  delivery: { label: "مهام نقل غير مكتملة", definition: "تكليفات توصيل فريدة assigned/in_transit/awaiting_receipt/receipt_approved/failed مرتبطة بمصدر قائم ومصرح؛ تكليف التوصيل ليس حركة مخزون إضافية ولا يُجمع مع أعداد الطلبات." },
};

/** A requested date without a valid time is context, never an invented midnight deadline. */
export function kitchenSupplyDeadline(row: Pick<SupplyRow, "needed_date" | "needed_time">): string | null {
  if (!row.needed_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.needed_date)
    || !row.needed_time || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(row.needed_time)) return null;
  const instant = new Date(`${row.needed_date}T${row.needed_time}+03:00`);
  return Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
}

/** An absolute, source-recorded delivery instant only; never localize a timezone-free string. */
export function supplyDeliveryDeadline(value: SupplyRow["scheduled_at"]): string | null {
  if (value == null || typeof value !== "string" && !(value instanceof Date)) return null;
  if (typeof value === "string" && !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function supplyGrants(req: Request, exportMode = false): Promise<SupplyGrants> {
  const has = (module: string, action = "view") => hasEffectiveViewPermission(req, module, action);
  const branch = req.currentUser?.role === "branch_manager";
  const [kitchenView, kitchenEdit, kitchenApprove, transferView, transferEdit, warehouseView, warehouseEdit,
    productionView, productionEdit, deliveryView, deliveryEdit, deliveryApprove] = await Promise.all([
    has("central_kitchen_orders"), has("central_kitchen_orders", "edit"), has("central_kitchen_orders", "approve"),
    has(branch ? "branch_supply" : "warehouse"), has(branch ? "branch_supply" : "warehouse", "edit"),
    has("warehouse"), has("warehouse", "edit"), has("production"), has("production", "edit"),
    has("delivery_tasks"), has("delivery_tasks", "edit"), has("delivery_tasks", "approve"),
  ]);
  // Reverse branchGrant checks authPermissions, not an inferred kitchen intrinsic grant.
  const current = (req as any).authPermissions as { module: string; actions: string[] }[] | undefined;
  const branchGrant = (module: string) => current?.some(p => p.module === module && p.actions.includes("view")) === true;
  const returnKinds = branch
    ? [...(branchGrant("branch_supply") ? ["material_return"] : []), ...(branchGrant("central_kitchen_orders") ? ["product_return"] : [])]
    : warehouseView ? ["material_return", "product_return", "warehouse_transfer"] : [];
  const result = { kitchenView, kitchenEdit, kitchenApprove, transferView, transferEdit, warehouseView, warehouseEdit,
    productionView, productionEdit, deliveryView, deliveryEdit, deliveryApprove, returnKinds };
  if (exportMode) {
    const [kitchen, transfer, warehouse, production, delivery] = await Promise.all([
      has("central_kitchen_orders", "export"), has(branch ? "branch_supply" : "warehouse", "export"),
      has("warehouse", "export"), has("production", "export"), has("delivery_tasks", "export"),
    ]);
    result.kitchenView &&= kitchen; result.kitchenEdit &&= kitchen;
    result.transferView &&= transfer; result.transferEdit &&= transfer;
    result.warehouseView &&= warehouse; result.warehouseEdit &&= warehouse;
    result.productionView &&= production; result.productionEdit &&= production;
    result.deliveryView &&= delivery; result.deliveryEdit &&= delivery; result.deliveryApprove &&= delivery;
    result.returnKinds = branch ? result.returnKinds.filter(kind => kind === "material_return" ? transfer : kitchen)
      : warehouse ? result.returnKinds : [];
  }
  return result;
}

function sourceEnabled(source: OperationsSupplySource, grants: SupplyGrants) {
  return source === "kitchen" ? grants.kitchenView : source === "transfers" ? grants.transferView
    : source === "reverse" ? grants.returnKinds.length > 0
    : grants.deliveryView && (grants.kitchenView || grants.transferView || grants.warehouseView || grants.productionView)
      || grants.deliveryApprove && (grants.kitchenEdit || grants.transferEdit || grants.warehouseEdit || grants.productionEdit);
}

/** Full counts and SQL offsets use exactly the same active and actor predicates as the page. */
export async function projectOperationsSupply(req: Request, requested: string[], source: OperationsSupplySource | "all",
  offset = 0, limit = 50, exportMode = false): Promise<OperationsSupplyResponse> {
  const allowed = getAllowedBranchIds(req);
  if (!requested.length || requested.length > 30 || requested.some(id => !id || id.toLowerCase() === "all")
    || new Set(requested).size !== requested.length)
    throw Object.assign(new Error("Select explicit unique branches"), { status: 400 });
  if (allowed !== null && requested.some(id => !allowed.includes(id)))
    throw Object.assign(new Error("Branch scope denied"), { status: 403 });
  const branchRows = (await pool.query<{ id: string; name: string }>(
    "SELECT id,name FROM branches WHERE id=ANY($1::varchar[]) ORDER BY id", [requested])).rows;
  if (!validateOperationsBranches(requested, allowed, branchRows.map(row => row.id)))
    throw Object.assign(new Error("Branch scope denied or branch does not exist"), { status: 403 });
  const actor: SupplyActor = { id: req.currentUser!.id, role: req.currentUser!.role, branchId: req.currentUser!.branchId, allowed };
  const grants = await supplyGrants(req, exportMode);
  const selected = source === "all" ? [...operationsSupplySources] : [source];
  const coverage = Object.fromEntries(operationsSupplySources.map(domain =>
    [domain, { state: "forbidden" as SupplyCoverage, reason: "Source not selected" }])) as OperationsSupplyResponse["coverage"]["sources"];
  const counts: { source: OperationsSupplySource; count: number }[] = [];
  await Promise.all(selected.map(async domain => {
    if (!sourceEnabled(domain, grants)) {
      coverage[domain] = { state: "forbidden", reason: "Current source permission denied" };
      return;
    }
    try {
      const query = operationsSupplySql(domain, requested, actor, grants);
      const result = await pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${query.from} WHERE ${query.where}`, query.values);
      const count = Number(result.rows[0].total);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid source cardinality");
      counts.push({ source: domain, count });
      coverage[domain] = { state: "complete", reason: null };
    } catch (error) {
      console.error(`Supply workspace ${domain} count unavailable`, error);
      coverage[domain] = { state: "unavailable", reason: "Source query failed; count and records unavailable" };
    }
  }));
  counts.sort((a, b) => operationsSupplySources.indexOf(a.source) - operationsSupplySources.indexOf(b.source));
  const records: OperationsSupplyRecord[] = [];
  const actionChecks = new Map<string, Promise<boolean>>();
  const kitchenCan = (row: SupplyRow, action: string) => {
    const operatingBranch = ["receive", "resolve_discrepancy"].includes(action) ? row.destination_branch_id : row.source_branch_id;
    const key = JSON.stringify([operatingBranch, action]);
    if (!actionChecks.has(key)) actionChecks.set(key, kitchenActionAllowed(db, actor.id,
      { requestBranchId: row.destination_branch_id, centralKitchenId: row.source_branch_id }, action));
    return actionChecks.get(key)!;
  };
  for (const page of supplyPagePlan(counts, offset, limit)) {
    try {
      const query = operationsSupplySql(page.source, requested, actor, grants);
      const rows = (await pool.query<SupplyRow>(
        `SELECT ${query.select} FROM ${query.from} WHERE ${query.where} ORDER BY ${query.order}
          LIMIT $${query.values.length + 1} OFFSET $${query.values.length + 2}`,
        [...query.values, page.limit, page.offset])).rows;
      for (const row of rows) records.push(await projectSupplyRecord(page.source, row, requested, actor, grants, kitchenCan));
    } catch (error) {
      console.error(`Supply workspace ${page.source} page unavailable`, error);
      coverage[page.source] = { state: "unavailable", reason: "Source page failed; count unavailable" };
    }
  }
  const generatedAt = new Date();
  const knownTotal = counts.reduce((total, item) => total + item.count, 0);
  return {
    generatedAt: generatedAt.toISOString(),
    businessDate: generatedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }),
    branches: branchRows, scope: { branchIds: requested, requested, source, offset, limit },
    records: uniqueSupplyRecords(records),
    summaries: selected.map(domain => ({
      source: domain, ...descriptions[domain], coverage: coverage[domain].state,
      value: coverage[domain].state === "complete" ? counts.find(item => item.source === domain)!.count : null,
    })),
    coverage: { sources: coverage, priorityCoverage: "unavailable",
      total: selected.every(domain => coverage[domain].state === "complete") ? knownTotal : null,
      nextOffset: knownTotal > offset + limit ? offset + limit : null },
  };
}

export async function projectSupplyRecord(domain: OperationsSupplySource, row: SupplyRow, selected: string[], actor: SupplyActor,
  grants: SupplyGrants, kitchenCan: (row: SupplyRow, action: string) => Promise<boolean>): Promise<OperationsSupplyRecord> {
  const warehouseDesk = row.kind === "warehouse_transfer"
    && (domain === "reverse" || domain === "delivery" && row.source_type === "reverse_movement")
    && ["admin", "operations_manager"].includes(actor.role) && actor.allowed === null
    && selected.includes("main_warehouse");
  const sourceBranch = row.source_branch_id;
  const destination = domain === "reverse" && row.kind === "material_return"
    && row.destination_branch_id === null && row.destination_warehouse_id == null ? "main_warehouse" : row.destination_branch_id;
  const visibleEndpoints = warehouseDesk ? ["main_warehouse"] : actor.role === "branch_manager" && domain !== "delivery"
    ? domain === "reverse" ? [sourceBranch] : [destination] : [sourceBranch, destination];
  const branchIds = Array.from(new Set(visibleEndpoints.filter((id): id is string => !!id && selected.includes(id))));
  if (!branchIds.length) throw new Error("Supply source has no selected endpoint");
  const branchId = actor.role === "branch_manager" && domain === "delivery" && row.source_type === "reverse_movement"
    && sourceBranch && branchIds.includes(sourceBranch) ? sourceBranch
    : destination && branchIds.includes(destination) ? destination : branchIds[0];
  const sourceType = { kitchen: "kitchen_order", transfers: "transfer", reverse: "reverse_movement", delivery: "delivery_assignment" }[domain];
  const module = domain === "kitchen" ? "central_kitchen_orders" : domain === "delivery" ? "delivery_tasks"
    : actor.role === "branch_manager" ? domain === "reverse" && row.kind === "product_return" ? "central_kitchen_orders" : "branch_supply" : "warehouse";
  const stage = domain === "kitchen" && row.status === "received" ? "discrepancy_open"
    : domain === "reverse" && row.status === "received" ? "awaiting_inspection"
    : domain === "reverse" && row.status === "inspected" ? "damage_awaiting_writeoff" : row.status;
  const role = domain === "kitchen" ? ["dispatched", "received"].includes(row.status) ? "مستلم الفرع المخول" : "مسؤول المطبخ المورد"
    : domain === "transfers" ? row.status === "in_transit" ? "مستلم الوجهة المخول" : "مسؤول مصدر التحويل"
    : domain === "reverse" ? row.status === "inspected" ? "مدير التشغيل المخول بالشطب" : row.status === "received" ? "مسؤول جهة الاستلام والفحص"
      : row.status === "dispatched" ? "مسؤول جهة الاستلام" : "مسؤول جهة الإرجاع"
    : row.status === "awaiting_receipt" ? "المستلم الذي أكد استلام المصدر" : row.status === "receipt_approved" ?
      row.transport_mode === "external" ? "مسؤول المصدر المخول بإغلاق نقل الناقل الخارجي" : "السائق المسند للمهمة"
      : row.status === "failed" ? "مسؤول المصدر لمعالجة التعثر" : row.status === "assigned" ? "مسؤول المصدر والسائق" : "السائق أو الناقل";
  const stepLabels: Record<string, string> = {
    requested: domain === "kitchen" ? "مراجعة طلب المطبخ لاعتماده" : "متابعة تجهيز وإرسال المرتجع",
    approved: domain === "kitchen" ? "متابعة تجهيز الطلب" : "متابعة إرسال التحويل",
    prepared: "متابعة إرسال الطلب المجهز", dispatched: "التحقق من الوصول ومراجعة الاستلام",
    discrepancy_open: "مراجعة فروق الاستلام المفتوحة", pending: "مراجعة اعتماد التحويل لدى المصدر",
    in_transit: "متابعة الوصول والاستلام لدى الوجهة", draft: "مراجعة طلب الإرجاع وتقديمه",
    awaiting_inspection: "فحص المستلم وتصنيف الصالح والتالف", damage_awaiting_writeoff: "مراجعة التلف المتبقي للشطب",
    assigned: "متابعة تسليم الشحنة للسائق", awaiting_receipt: "مراجعة إثبات الاستلام بعد تأكيد المصدر",
    receipt_approved: "متابعة إغلاق مهمة النقل", failed: "مراجعة سبب تعثر النقل",
  };
  let path = domain === "kitchen" ? `/central-kitchen-orders?stage=${row.status}`
    : domain === "transfers" ? `/transfer-requests?status=${row.status}` : "/reverse-logistics";
  const dueAt = domain === "kitchen" ? kitchenSupplyDeadline(row)
    : domain === "delivery" ? supplyDeliveryDeadline(row.scheduled_at) : null;
  const mode = domain === "kitchen" || domain === "delivery" && row.source_type === "kitchen"
    ? row.inventory_mode === "real" || row.inventory_mode === "shadow" ? row.inventory_mode : "unknown"
    : domain !== "delivery" || ["material_transfer", "reverse_movement"].includes(row.source_type || "") ? "real" : "unknown";
  let href: string | undefined;
  if (domain === "delivery") {
    // Operations managers are excluded from standalone delivery desk: navigate through the currently legal source.
    const sourceModule = row.source_type === "kitchen" ? "central_kitchen_orders" : row.source_type === "finished_goods_transfer" ? "production"
      : actor.role === "branch_manager" && ["material_transfer", "reverse_movement"].includes(row.source_type || "") ? "branch_supply" : "warehouse";
    let canViewSource = sourceModule === "central_kitchen_orders" ? grants.kitchenView : sourceModule === "production" ? grants.productionView
      : sourceModule === "branch_supply" ? grants.transferView : grants.warehouseView;
    const allowedEndpoint = (branch: string | null) => !!branch && (actor.allowed === null || actor.allowed.includes(branch));
    // Delivery recipient rights do not automatically grant the underlying page.
    // In particular branch_supply transfer reads require the main-warehouse
    // source, and branch reverse reads require its source-side kind grant.
    if (actor.role === "branch_manager") {
      if (row.source_type === "material_transfer")
        canViewSource &&= sourceBranch === "main_warehouse" && destination !== "main_warehouse" && allowedEndpoint(destination);
      if (row.source_type === "reverse_movement")
        canViewSource = (row.kind === "product_return" ? grants.kitchenView : grants.transferView)
          && allowedEndpoint(sourceBranch) && selected.includes(sourceBranch!) && grants.returnKinds.includes(row.kind || "");
      if (row.source_type === "kitchen") canViewSource &&= allowedEndpoint(destination);
    }
    const parameters: Record<string, [string, string]> = {
      kitchen: ["/central-kitchen-orders", "orderId"], material_transfer: ["/transfer-requests", "transferId"],
      reverse_movement: ["/reverse-logistics", "movementId"], finished_goods_transfer: ["/finished-goods-inventory", "transferId"],
      kitchen_warehouse_shipment: ["/kitchen-warehouse-shipping", "shipmentId"],
    };
    const target = row.source_type && parameters[row.source_type];
    const linkedBranch = actor.role === "branch_manager" && row.source_type === "reverse_movement" && sourceBranch
      ? sourceBranch : branchId;
    href = target && canViewSource ? `${target[0]}?${new URLSearchParams({
      branchId: linkedBranch, [target[1]]: String(row.source_id), deliveryId: row.id,
      ...(row.source_type === "kitchen" ? { stage: row.source_status || "" } : {}),
    })}` : "";
    path = target?.[0] || "";
  }
  const item = makeOperationsQueueItem(sourceType, row.id, stage, branchId, module, descriptions[domain].label,
    row.status, `${path}${path.includes("?") ? "&" : "?"}branchId=${encodeURIComponent(branchId)}`, role, dueAt,
    domain === "delivery" ? row.driver_id || null : null);
  if (href !== undefined) {
    item.href = href;
    item.actions = href ? [{ label: "عرض مصدر النقل", href, capability: "read" }] : [];
  }
  const record: OperationsSupplyRecord = {
    ...item, id: `${sourceType}:${row.id}`, branchIds, domain, stage, responsibleRole: role,
    nextStep: { label: stepLabels[stage] || "مراجعة حالة المصدر", href: item.href || null },
    inventoryMode: mode, deadlineLabel: dueAt
      ? domain === "delivery" ? "موعد التوصيل المجدول في المصدر" : "وقت الاحتياج المسجل؛ ليس موعد وصول مؤكداً" : null,
    priority: null, priorityCoverage: "unavailable",
    capabilityCoverage: "complete",
    reason: domain === "reverse" && row.status === "inspected"
      ? `التلف المسجل ${row.damaged_quantity} والمشطوب ${row.written_off_quantity}؛ المتبقي يحتاج مراجعة المخول، وليس مخزوناً صالحاً`
      : domain === "delivery" ? `تكليف نقل مرتبط بمصدر ${row.source_type} #${row.source_id}؛ لا يمثل حركة مخزون جديدة${
          warehouseDesk ? "؛ ضمن مكتب المستودعات المصرح به لا فرع حركة" : ""}`
        : warehouseDesk ? `نقل بين مستودعات ضمن مكتب المستودعات المصرح به؛ لا يرتبط بفرع؛ مرحلة المصدر: ${stage}`
        : `مرحلة المصدر المسجلة: ${stage}${mode === "unknown" ? "؛ وضع المخزون غير معروف" : mode === "shadow" ? "؛ وضع تجريبي لا يثبت حركة مخزون فعلية" : ""}`,
    ...(domain === "delivery" ? { relatedSource: { sourceType: row.source_type!, sourceId: String(row.source_id) } } : {}),
  };
  if (warehouseDesk && domain === "reverse" && row.status === "inspected")
    record.reason += "؛ نقل المستودعات لا يرتبط بفرع حركة؛ يظهر بموجب صلاحية مكتب المستودعات العامة";
  let canAct = false, action = "edit";
  if (domain === "kitchen") {
    const operation = { requested: "approve", approved: "prepare", prepared: "dispatch", dispatched: "receive", received: "resolve_discrepancy" }[row.status];
    action = operation === "approve" ? "approve" : "edit";
    const operatingBranch = ["dispatched", "received"].includes(row.status) ? destination : sourceBranch;
    const operatingScope = !!operatingBranch && (actor.allowed === null || actor.allowed.includes(operatingBranch));
    try {
      // Preparation/dispatch readiness involves stock, reservations and transport
      // evidence. This read adapter does not invent those capabilities from edit.
      const decisionStage = ["requested", "dispatched", "received"].includes(row.status);
      const paused = row.inventory_mode === "real" && row.runtime_mode === "paused";
      canAct = !paused && decisionStage && operatingScope && !!operation
        && (action === "approve" ? grants.kitchenApprove : grants.kitchenEdit) && await kitchenCan(row, operation!);
      if (paused) {
        record.capabilityCoverage = "unavailable";
        record.reason += "؛ عمليات المخزون الفعلي لهذا المطبخ متوقفة مؤقتًا ولا يُعلن إجراء متاحًا";
      } else if (!decisionStage) record.capabilityCoverage = "unavailable";
    } catch {
      record.capabilityCoverage = "unavailable";
      record.reason += "؛ تعذر التحقق من صلاحية هذه الخطوة";
    }
  } else if (domain === "transfers") {
    canAct = ["pending", "in_transit"].includes(row.status) && grants.transferEdit && (row.status === "in_transit"
      ? actor.role === "branch_manager" ? branchSupplyTransferAllowed("receive", {
        sourceBranchId: sourceBranch, destinationBranchId: destination, status: row.status,
      }, supplyDestinationAuthority(actor, destination)) : supplyDestinationAuthority(actor, destination)
      : supplyTransferSourceAuthority(actor, sourceBranch));
    if (row.status === "approved") record.capabilityCoverage = "unavailable";
  } else if (domain === "reverse") {
    const receiver = row.status === "dispatched" || row.status === "received" || row.status === "inspected";
    const target = receiver ? destination : sourceBranch;
    const mainAllowed = row.kind !== "material_return" || !receiver || supplyMainWarehouseAuthority(actor);
    const targetAllowed = target === null || actor.allowed === null || actor.allowed.includes(target);
    const warehouseAllowed = row.kind !== "warehouse_transfer" || warehouseDesk;
    canAct = receiver && actor.role !== "branch_manager" && grants.warehouseEdit && mainAllowed && targetAllowed && warehouseAllowed
      && (row.status !== "inspected" || ["admin", "operations_manager"].includes(actor.role));
    if (!receiver) record.capabilityCoverage = "unavailable";
  } else {
    action = row.status === "receipt_approved" ? "edit" : "approve";
    const external = row.transport_mode === "external";
    const handover = !!row.handover_recorded_at && !Number.isNaN(new Date(row.handover_recorded_at).getTime());
    const approvedReceipt = !!row.receipt_approved_by && receiptMatchesSource(
      row.source_type!, row.source_status!, row.received_by || null, row.receipt_approved_by);
    canAct = row.status === "awaiting_receipt" && row.can_receive === true && !!item.href
      && receiptMatchesSource(row.source_type!, row.source_status!, row.received_by || null, actor.id)
      && (external ? handover && row.evidence_ready === true : row.proof_present === true)
      || row.status === "receipt_approved" && external && row.can_manage === true && !!item.href
        && handover && row.evidence_ready === true && !row.exception_reason && approvedReceipt
        && deliveryTransitionAllowed(row.status, "complete");
  }
  if (record.capabilityCoverage === "unavailable")
    record.reason += "؛ جاهزية تنفيذ الخطوة غير مؤكدة في هذه اللقطة؛ تحقق منها في المصدر، ولا تعد قراراً على المستخدم";
  record.decision = operationsDecisionMetadata(record, actor.id, canAct, true, { module, action }, record.nextStep.label);
  return record;
}