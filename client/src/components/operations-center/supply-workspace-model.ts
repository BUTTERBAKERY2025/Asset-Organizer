import type { OperationsSupplyRecord, OperationsSupplyResponse } from "@shared/operations-center";

export const supplySources = [
  { id: "kitchen", label: "طلبات المطبخ" },
  { id: "transfers", label: "التحويلات" },
  { id: "reverse", label: "المرتجعات" },
  { id: "delivery", label: "التوصيل" },
] as const;
export type SupplySource = "all" | typeof supplySources[number]["id"];
export type SupplyRequest = { branchIds: string[]; source: SupplySource; offset: number; limit: number };
export type SupplyFilters = { stage: string; search: string };

const stages: Record<string, string> = {
  draft: "مسودة", requested: "مطلوب", pending: "بانتظار الاعتماد", approved: "معتمد",
  preparing: "قيد التجهيز", in_progress: "قيد التنفيذ", prepared: "جاهز للإرسال",
  ready: "جاهز", ready_for_dispatch: "جاهز للإرسال", dispatched: "مرسل",
  in_transit: "في الطريق", received: "مستلم", delivered: "تم التسليم",
  inspected: "تم الفحص", assigned: "مسند", awaiting_receipt: "بانتظار تأكيد الاستلام",
  receipt_approved: "الاستلام معتمد", completed: "مكتمل", failed: "تعذر التسليم",
  cancelled: "ملغى", rejected: "مرفوض", open: "مفتوح", discrepancy_open: "فروقات استلام مفتوحة",
  received_discrepancy: "مستلم · فروقات مفتوحة", awaiting_inspection: "بانتظار الفحص",
  awaiting_writeoff: "تالف بانتظار التسوية", damage_awaiting_writeoff: "تالف بانتظار الشطب", partially_received: "استلام جزئي",
};

export function supplyStageLabel(stage: string): string {
  if (stages[stage]) return stages[stage];
  return /[\u0600-\u06ff]/.test(stage) ? stage : "مرحلة غير معروفة؛ راجع المصدر";
}

export function supplySourceLabel(source: string): string {
  return supplySources.find(item => item.id === source)?.label || "مصدر غير معروف";
}

export function supplyPriorityLabel(record: OperationsSupplyRecord): string {
  const priority = record.priority || record.priorityReason;
  if (!priority) return "غير مسجلة في المصدر";
  const labels: Record<string, string> = {
    critical: "حرجة", urgent: "عاجلة", high: "مرتفعة", normal: "عادية",
    medium: "متوسطة", low: "منخفضة",
  };
  return labels[priority] || (/[\u0600-\u06ff]/.test(priority) ? priority : "أولوية مسجلة؛ راجع المصدر");
}

export function supplyRecordKey(record: Pick<OperationsSupplyRecord, "sourceType" | "sourceId">): string {
  return `${record.sourceType}:${record.sourceId}`;
}

/** A return selection is navigation intent only; it must reappear in the scoped GET results. */
export function supplySelectionIntent(search: string, allowedIds: readonly string[]): {
  source: SupplySource; branchId: string; record: string | null;
} {
  const params = new URLSearchParams(search);
  const empty = { source: "all" as const, branchId: "", record: null };
  if (params.get("workspace") !== "production" || params.getAll("supplyRecord").length !== 1 ||
    params.getAll("supplyBranchId").length !== 1) return empty;
  const branchId = params.get("supplyBranchId") || "";
  const record = params.get("supplyRecord") || "";
  const match = /^(kitchen_order|transfer|reverse_movement|delivery_assignment):([1-9]\d*)$/.exec(record);
  const source: Record<string, SupplySource> = {
    kitchen_order: "kitchen", transfer: "transfers", reverse_movement: "reverse", delivery_assignment: "delivery",
  };
  return match && allowedIds.includes(branchId) ? { source: source[match[1]], branchId, record } : empty;
}

export function supplyRequestParams(request: SupplyRequest): URLSearchParams {
  const ids = [...new Set(request.branchIds)].sort();
  if (!ids.length || ids.length > 30 || ids.some(id => !id || id === "all" || id.includes(",")) ||
    !["all", ...supplySources.map(item => item.id)].includes(request.source) ||
    !Number.isSafeInteger(request.offset) || request.offset < 0 ||
    !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100) {
    throw new Error("نطاق متابعة التوريد أو ترقيم الصفحة غير صالح.");
  }
  return new URLSearchParams({
    branchIds: ids.join(","), source: request.source, offset: String(request.offset), limit: String(request.limit),
  });
}

export function supplyScopeMatches(response: OperationsSupplyResponse, request: SupplyRequest): boolean {
  const ids = [...new Set(request.branchIds)];
  return response.scope.source === request.source && response.scope.offset === request.offset &&
    response.scope.limit === request.limit && response.scope.branchIds.length === ids.length &&
    ids.every(id => response.scope.branchIds.includes(id)) &&
    response.records.every(record => ids.includes(record.branchId) &&
      record.branchIds.length > 0 && record.branchIds.every(id => ids.includes(id)) &&
      (request.source === "all" || record.domain === request.source));
}

/** Stage/search are intentionally page-local: the endpoint only supports branch/source filters. */
export function filterSupplyRecords(records: readonly OperationsSupplyRecord[], filters: SupplyFilters,
  branches: readonly { id: string; name: string }[] = []): OperationsSupplyRecord[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  return records.filter(record => (filters.stage === "all" || record.stage === filters.stage) &&
    (!needle || [
      record.sourceId, record.title, supplySourceLabel(record.domain), supplyStageLabel(record.stage),
      record.nextStep.label, record.responsibleRole || "", record.owner || "",
      ...record.branchIds.map(id => branches.find(branch => branch.id === id)?.name || id),
    ].join(" ").toLocaleLowerCase().includes(needle)));
}

/** Counts are page facts, not a sum of heterogeneous source summaries or invented SLAs. */
export function supplyPageFacts(records: readonly OperationsSupplyRecord[], actorId: string | undefined, asOf: string) {
  const seen = new Set<string>();
  const unique = records.filter(record => {
    const key = supplyRecordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const time = Date.parse(asOf);
  return {
    count: unique.length,
    awaitingActor: unique.filter(record => !!actorId && record.decision?.awaitingActor && record.decision.actorId === actorId).length,
    urgent: unique.filter(record => record.priorityReason === "urgent" || record.priorityReason === "critical" ||
      record.priority === "urgent" || record.priority === "critical").length,
    overdue: unique.filter(record => record.dueAt && Number.isFinite(time) &&
      Number.isFinite(Date.parse(record.dueAt)) && Date.parse(record.dueAt) < time).length,
  };
}

export function supplyCoverageText(response: OperationsSupplyResponse): string {
  const relevant = supplySources.filter(source => response.scope.source === "all" || source.id === response.scope.source);
  const missing = relevant.some(source => response.coverage.sources[source.id]?.state !== "complete");
  return missing || response.coverage.total === null
    ? "تغطية غير مكتملة؛ الأعداد للسجلات المعروضة فقط، والغياب ليس صفرًا."
    : `سجلات قابلة للعرض في نطاق المصدر والفروع: ${response.coverage.total.toLocaleString("en-US")} لترقيم الصفحات، وليست مجموع حركات مخزون؛ العدادات أدناه تخص الصفحة فقط.`;
}

/** Only exact canonical source links are passed on to the page's existing go validation. */
export function supplySourceHref(record: OperationsSupplyRecord, actorId: string | undefined, origin: string): {
  href: string | null; label: string; decision: boolean;
} {
  const decision = record.capabilityCoverage !== "unavailable" && !!actorId &&
    record.decision?.awaitingActor === true && record.decision.actorId === actorId;
  const href = decision ? record.decision!.href : record.href;
  const label = decision ? `${record.decision!.label} في المصدر` : "فتح السجل للمتابعة في المصدر";
  const destinations: Record<string, { path: string; parameter: string }> = {
    kitchen_order: { path: "/central-kitchen-orders", parameter: "orderId" },
    transfer: { path: "/transfer-requests", parameter: "transferId" },
    reverse_movement: { path: "/reverse-logistics", parameter: "movementId" },
    delivery_assignment: { path: "/delivery-management", parameter: "deliveryId" },
  };
  const deliverySources: Record<string, { path: string; parameter: string }> = {
    kitchen: { path: "/central-kitchen-orders", parameter: "orderId" },
    material_transfer: { path: "/transfer-requests", parameter: "transferId" },
    reverse_movement: { path: "/reverse-logistics", parameter: "movementId" },
    finished_goods_transfer: { path: "/finished-goods-inventory", parameter: "transferId" },
    kitchen_warehouse_shipment: { path: "/kitchen-warehouse-shipping", parameter: "shipmentId" },
  };
  try {
    const url = new URL(href, origin);
    // A delivery is a distinct persisted assignment, but its authorized CTA may
    // live in the underlying source rather than the standalone driver desk.
    const related = record.sourceType === "delivery_assignment" ? record.relatedSource : undefined;
    const destination = related ? deliverySources[related.sourceType] : destinations[record.sourceType];
    const targetId = related?.sourceId || record.sourceId;
    if (!destination || !/^[1-9]\d*$/.test(record.sourceId) || url.origin !== origin ||
      !/^[1-9]\d*$/.test(targetId) ||
      url.pathname !== destination.path || url.searchParams.getAll(destination.parameter).length !== 1 ||
      url.searchParams.get(destination.parameter) !== targetId ||
      (related && (url.searchParams.getAll("deliveryId").length !== 1 || url.searchParams.get("deliveryId") !== record.sourceId)) ||
      url.searchParams.getAll("branchId").length > 1 ||
      (url.searchParams.has("branchId") && url.searchParams.get("branchId") !== record.branchId)) {
      return { href: null, label, decision };
    }
    url.searchParams.set("centerWorkspace", "production");
    url.searchParams.set("centerSupplyRecord", supplyRecordKey(record));
    url.searchParams.set("centerSupplyBranchId", record.branchId);
    return { href: `${url.pathname}${url.search}${url.hash}`, label, decision };
  } catch {
    return { href: null, label, decision };
  }
}