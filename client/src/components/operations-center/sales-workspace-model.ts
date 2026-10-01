import type { OperationsSalesRecord, OperationsSalesResponse } from "@shared/operations-sales";
import { salesReturnIntent, type SalesPageIntent } from "@/lib/operations-center-navigation";

export const salesSources = [
  { id: "journals", label: "اليوميات غير النهائية" },
  { id: "closures", label: "الإغلاقات اليومية المفتوحة" },
] as const;
export type SalesRequest = SalesPageIntent & { branchIds: string[]; limit: number };
export const salesSelectionIntent = salesReturnIntent;
export const salesRecordKey = (record: Pick<OperationsSalesRecord, "sourceType" | "sourceId">) => `${record.sourceType}:${record.sourceId}`;
export function salesStageLabel(stage: string) {
  const labels: Record<string, string> = {
    draft: "مسودة", submitted: "مقدمة للمراجعة", rejected: "مرفوضة", open: "إغلاق مفتوح",
    approved: "معتمدة", posted: "مرحّلة", closed: "إغلاق معتمد",
    journal_draft: "استكمال اليومية في المصدر", journal_review: "مراجعة اليومية المقدمة",
    journal_rejected: "مراجعة سبب الرفض ومسار التصحيح", closure_review: "مراجعة الإغلاق اليومي",
  };
  return labels[stage] || "مرحلة غير معروفة؛ راجع المصدر";
}
export function salesRequestParams(request: SalesRequest) {
  const ids = Array.from(new Set(request.branchIds)).sort();
  if (!ids.length || ids.length > 30 || ids.some(id => !id || /[,\s]/.test(id) || id.toLowerCase() === "all")
    || !["all", "journals", "closures"].includes(request.source)
    || !Number.isSafeInteger(request.offset) || request.offset < 0
    || !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100)
    throw new Error("نطاق متابعة اليوميات أو الصفحة غير صالح.");
  return new URLSearchParams({ branchIds: ids.join(","), source: request.source, offset: String(request.offset), limit: String(request.limit) });
}
export function salesScopeMatches(data: OperationsSalesResponse, request: SalesRequest) {
  const ids = Array.from(new Set(request.branchIds));
  return data.scope.source === request.source && data.scope.offset === request.offset && data.scope.limit === request.limit
    && ids.length === data.scope.branchIds.length && ids.every(id => data.scope.branchIds.includes(id))
    && data.branches.every(branch => ids.includes(branch.id))
    && data.records.every(record => ids.includes(record.branchId)
      && data.coverage.sources[record.domain]?.state === "complete"
      && (request.source === "all" || record.domain === request.source));
}
export function salesHasDecision(record: OperationsSalesRecord, actorId?: string) {
  return !!actorId && record.decision?.actorId === actorId && record.decision.awaitingActor === true;
}
export function filterSalesRecords(records: readonly OperationsSalesRecord[], search: string, stage: string,
  branches: readonly { id: string; name: string }[]) {
  const needle = search.trim().toLocaleLowerCase();
  return records.filter(record => (stage === "all" || record.step === stage) && (!needle || [
    record.sourceId, record.businessDate, record.creator.name, record.cashier?.name,
    branches.find(branch => branch.id === record.branchId)?.name, record.title, salesStageLabel(record.status),
    salesStageLabel(record.step),
  ].join(" ").toLocaleLowerCase().includes(needle)));
}
export function salesSourceHref(record: OperationsSalesRecord, actorId: string | undefined, origin: string) {
  const decision = salesHasDecision(record, actorId);
  const href = decision ? record.decision!.href : record.nextStep.href;
  try {
    const url = new URL(href, origin);
    const path = record.sourceType === "cashier_journal" ? "/cashier-journals" : record.sourceType === "daily_closure" ? "/branch-daily-closures" : null;
    if (!path || !/^[1-9]\d*$/.test(record.sourceId) || !Number.isSafeInteger(Number(record.sourceId))
      || url.origin !== origin || url.hash || url.username || url.password
      || url.pathname !== `${path}/${record.sourceId}`
      || url.searchParams.getAll("branchId").length !== 1 || url.searchParams.get("branchId") !== record.branchId
      || Array.from(url.searchParams.keys()).some(key => key !== "branchId")) return null;
    return `${url.pathname}${url.search}`;
  } catch { return null; }
}

/** A successful scoped refresh must still contain the exact persisted case
 * and decision; a stale snapshot is never a navigation authorization. */
export function salesNavigationMatches(fresh: OperationsSalesRecord, clicked: OperationsSalesRecord, actorId?: string) {
  return salesRecordKey(fresh) === salesRecordKey(clicked) && fresh.branchId === clicked.branchId
    && fresh.domain === clicked.domain && fresh.status === clicked.status && fresh.step === clicked.step
    && (!salesHasDecision(clicked, actorId) || (salesHasDecision(fresh, actorId)
      && fresh.decision!.permission.module === clicked.decision!.permission.module
      && fresh.decision!.permission.action === clicked.decision!.permission.action));
}