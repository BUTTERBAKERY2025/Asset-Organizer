import type { OperationsPeopleRecord, OperationsPeopleResponse, OperationsPeopleSource } from "@shared/operations-people";
import { peopleReturnIntent } from "@/lib/operations-center-navigation";

export const peopleSources = [
  { id: "leaves", label: "طلبات الإجازة" },
  { id: "leave_movements", label: "حركات الإجازة" },
  { id: "advances", label: "السلف" },
  { id: "attendance", label: "سجلات الحضور" },
  { id: "joining", label: "المباشرات" },
] as const;
export type PeopleSource = "all" | OperationsPeopleSource;
export type PeopleRequest = { branchIds: string[]; source: PeopleSource; offset: number; limit: number };
export type PeopleFilters = { stage: string; search: string };
type PeopleTool = OperationsPeopleResponse["tools"][number];
const idPattern = /^[1-9]\d*$/;
const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/;
const safeId = (id: string) => idPattern.test(id) && Number.isSafeInteger(Number(id));

export function peopleSourceLabel(source: string): string {
  return peopleSources.find(item => item.id === source)?.label || "مصدر غير معروف";
}

export function peopleStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    pending: "بانتظار خطوة المصدر", draft: "مسودة", requested: "مطلوب", approved: "معتمد",
    pending_manager: "بانتظار المدير", pending_hr: "بانتظار شؤون الموظفين",
    pending_ops: "بانتظار التشغيل", manager_approved: "معتمد من المدير",
    hr_approved: "معتمد من شؤون الموظفين", awaiting_approval: "بانتظار الاعتماد",
    awaiting_operations_approval: "بانتظار اعتماد التشغيل", awaiting_signature: "بانتظار التوقيع",
    signed: "موقّع", accepted: "مقبول", sent: "مرسل", active: "نشط", late: "تأخر مسجل",
    incomplete: "سجل غير مكتمل", absent: "غياب مسجل في المصدر", on_leave: "إجازة مسجلة",
    early_leave: "خروج مبكر مسجل",
    present: "حضور مسجل", completed: "مكتمل في المصدر", rejected: "مرفوض", cancelled: "ملغى",
    pre_approved: "موافقة أولية · ليست اعتمادًا نهائيًا", unapproved: "اعتماد الحضور غير مسجل",
    attendance_review: "متابعة الحضور · ليست طلب اعتماد",
    confirm_exit: "متابعة تأكيد الخروج", confirm_return: "متابعة تأكيد العودة",
  };
  if (/^level_[1-9]\d*$/.test(stage)) return `مرحلة مراجعة الإجازة ${stage.slice(6)}`;
  return labels[stage] || (/[\u0600-\u06ff]/.test(stage) ? stage : "مرحلة غير معروفة؛ راجع المصدر");
}

/** Persisted source identity, not its current status, employee, or branch label. */
export function peopleRecordKey(record: Pick<OperationsPeopleRecord, "sourceType" | "sourceId">): string {
  return `${record.sourceType}:${record.sourceId}`;
}

/** Return context is intent only. A selected case must reappear in a fresh scoped GET. */
export function peopleSelectionIntent(search: string, allowedIds: readonly string[]): {
  branchId: string; source: PeopleSource; record: string | null; valid: boolean;
} {
  const restored = peopleReturnIntent(search, allowedIds);
  const empty = { branchId: "", source: "all" as PeopleSource, record: null, valid: restored.valid };
  // Invalid intent must remain invalid, never become an all-branches request.
  if (!restored.valid || !restored.people) return empty;
  if (!restored.record) return { ...empty, branchId: restored.branchId };
  const sourceType = restored.record.split(":")[0];
  const sources: Record<string, PeopleSource> = {
    // One persisted leave ID can currently be a request or exit/return follow-up.
    leave: "all", advance: "advances", attendance_record: "attendance",
    joining_offer: "joining", joining_notification: "joining",
  };
  return { branchId: restored.branchId, source: sources[sourceType], record: restored.record, valid: true };
}

export function peopleRequestParams(request: PeopleRequest): URLSearchParams {
  const ids = Array.from(new Set(request.branchIds)).sort();
  if (!ids.length || ids.length > 30 || ids.some(id => !id || id.toLowerCase() === "all" || /[,\s]/.test(id)) ||
    !["all", ...peopleSources.map(item => item.id)].includes(request.source) ||
    !Number.isSafeInteger(request.offset) || request.offset < 0 ||
    !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100) {
    throw new Error("نطاق متابعة الموظفين أو ترقيم الصفحة غير صالح.");
  }
  return new URLSearchParams({
    branchIds: ids.join(","), source: request.source, offset: String(request.offset), limit: String(request.limit),
  });
}

export function peopleScopeMatches(response: OperationsPeopleResponse, request: PeopleRequest): boolean {
  const ids = Array.from(new Set(request.branchIds));
  return response.scope.source === request.source && response.scope.offset === request.offset &&
    response.scope.limit === request.limit && response.scope.branchIds.length === ids.length &&
    ids.every(id => response.scope.branchIds.includes(id)) &&
    response.branches.every(branch => ids.includes(branch.id)) &&
    response.records.every(record => ids.includes(record.branchId) &&
      response.coverage.sources[record.domain]?.state === "complete" &&
      (request.source === "all" || record.domain === request.source)) &&
    response.tools.every(tool => ids.includes(tool.branchId));
}

export function peopleHasDecision(record: OperationsPeopleRecord, actorId?: string): boolean {
  return record.domain !== "attendance" && !!actorId && record.decision?.awaitingActor === true && record.decision.actorId === actorId;
}

export function peopleNextAction(record: OperationsPeopleRecord, actorId?: string): string {
  return peopleHasDecision(record, actorId) ? record.decision!.label :
    record.actions[0]?.label || "فتح السجل في المصدر للمتابعة";
}

/** Only branch/source are server filters; stage and search describe the loaded page. */
export function filterPeopleRecords(records: readonly OperationsPeopleRecord[], filters: PeopleFilters,
  branches: readonly { id: string; name: string }[] = []): OperationsPeopleRecord[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  return records.filter(record => (filters.stage === "all" || record.step === filters.stage) &&
    (!needle || [
      record.sourceId, record.title, record.employee?.name || "", record.employee?.number || "",
      record.employee?.jobTitle || "", peopleSourceLabel(record.domain), peopleStageLabel(record.status), peopleStageLabel(record.step),
      record.owner, record.reason || "", record.actions[0]?.label || "",
      branches.find(branch => branch.id === record.branchId)?.name || record.branchId,
    ].join(" ").toLocaleLowerCase().includes(needle)));
}

export function peoplePageFacts(records: readonly OperationsPeopleRecord[], actorId?: string) {
  const unique = Array.from(new Map(records.map(record => [peopleRecordKey(record), record])).values());
  return { count: unique.length, awaitingActor: unique.filter(record => peopleHasDecision(record, actorId)).length };
}

export function peopleCoverageText(response: OperationsPeopleResponse): string {
  const sources = peopleSources.filter(source => response.scope.source === "all" || source.id === response.scope.source);
  return sources.some(source => response.coverage.sources[source.id]?.state !== "complete") || response.coverage.total === null
    ? "تغطية غير مكتملة؛ الأعداد تخص الحالات المعروضة، والمصدر غير المتاح ليس صفرًا."
    : `حالات قابلة للعرض في نطاق الفروع والمصدر: ${response.coverage.total.toLocaleString("en-US")}؛ العدادات أدناه للصفحة فقط.`;
}

const destinations: Record<string, { path: string; parameter: string }> = {
  leave: { path: "/hr/leaves", parameter: "leaveId" },
  advance: { path: "/hr/advances", parameter: "advanceId" },
  attendance_record: { path: "/employee-attendance-report", parameter: "attendanceId" },
  joining_offer: { path: "/hr-hub", parameter: "offerId" },
  joining_notification: { path: "/hr-hub", parameter: "notificationId" },
};

/** Exact canonical source URL only, then the existing page go performs fresh authorization. */
export function peopleSourceHref(record: OperationsPeopleRecord, actorId: string | undefined, origin: string, businessDate?: string): {
  href: string | null; label: string; decision: boolean;
} {
  const decision = peopleHasDecision(record, actorId);
  const label = record.domain === "attendance" ? "عرض سجل الحضور" :
    decision ? `${record.decision!.label} في المصدر` : "فتح السجل للمتابعة في المصدر";
  try {
    const url = new URL(decision ? record.decision!.href : record.href, origin);
    const route = destinations[record.sourceType];
    if (!route || !safeId(record.sourceId) || url.origin !== origin || url.hash ||
      url.pathname !== route.path || url.searchParams.getAll(route.parameter).length !== 1 ||
      url.searchParams.get(route.parameter) !== record.sourceId ||
      url.searchParams.getAll("branchId").length !== 1 || url.searchParams.get("branchId") !== record.branchId) {
      return { href: null, label, decision };
    }
    const joining = record.domain === "joining";
    const attendance = record.domain === "attendance";
    const allowed = new Set(["branchId", route.parameter, ...(joining ? ["tab", "section", "offerId", "notificationId"] : []),
      ...(attendance ? ["startDate", "endDate"] : [])]);
    if (Array.from(url.searchParams.keys()).some(key => !allowed.has(key)) ||
      Array.from(allowed).some(key => url.searchParams.getAll(key).length > 1)) return { href: null, label, decision };
    if (attendance && (url.searchParams.has("startDate") || url.searchParams.has("endDate"))) {
      const date = url.searchParams.get("startDate") || "";
      if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ||
        url.searchParams.get("endDate") !== date || new Date(date).toISOString().slice(0, 10) !== date ||
        (businessDate && date !== businessDate)) return { href: null, label, decision };
    }
    if (joining) {
      if (url.searchParams.get("tab") !== "employees" || url.searchParams.get("section") !== "joining") return { href: null, label, decision };
      for (const [key, id] of [["offerId", record.offerId], ["notificationId", record.notificationId]] as const) {
        if (url.searchParams.has(key) && (!id || !safeId(String(id)) ||
          url.searchParams.get(key) !== String(id))) return { href: null, label, decision };
      }
    }
    url.searchParams.set("centerWorkspace", "people");
    url.searchParams.set("centerPeopleRecord", peopleRecordKey(record));
    url.searchParams.set("centerPeopleBranchId", record.branchId);
    return { href: `${url.pathname}${url.search}`, label, decision };
  } catch {
    return { href: null, label, decision };
  }
}

/** HR links come from server tools, never from client role guesses or employee edit endpoints. */
export function peopleToolHref(tool: PeopleTool, branchId: string, month: string, origin: string): string | null {
  const sections: Record<string, string> = { directory: "directory", joining: "joining", transfers: "transfers" };
  try {
    const url = new URL(tool.href, origin);
    const tab = tool.id === "payroll" ? "payroll" : sections[tool.id] ? "employees" : "";
    if (!branchId || branchId === "all" || tool.branchId !== branchId || !tab ||
      url.origin !== origin || url.pathname !== "/hr-hub" || url.hash ||
      url.searchParams.getAll("branchId").length !== 1 || url.searchParams.get("branchId") !== branchId ||
      url.searchParams.getAll("tab").length !== 1 || url.searchParams.get("tab") !== tab ||
      url.searchParams.getAll("section").length > 1 ||
      (tool.id !== "payroll" && (tool.id === "directory" && !url.searchParams.has("section") ? false :
        url.searchParams.get("section") !== sections[tool.id])) ||
      (tool.id === "payroll" && url.searchParams.has("section")) ||
      Array.from(url.searchParams.keys()).some(key => !["branchId", "tab", "section"].includes(key))) return null;
    if (tool.id === "payroll") {
      if (!monthPattern.test(month)) return null;
      url.searchParams.set("month", month);
    }
    url.searchParams.set("centerWorkspace", "people");
    url.searchParams.set("centerPeopleBranchId", branchId);
    return `${url.pathname}${url.search}`;
  } catch { return null; }
}

/** These read-only source tools remain reachable for an accessible zero-case source. */
export function peopleReadToolHref(source: string, branchId: string, response: OperationsPeopleResponse, origin: string): string | null {
  const routes: Record<string, string> = { attendance: "/employee-attendance-report", leaves: "/hr/leaves", advances: "/hr/advances" };
  const key = peopleSources.find(item => item.id === source)?.id;
  if (!key || !routes[source] || !branchId || branchId === "all" || !response.scope.branchIds.includes(branchId) ||
    response.coverage.sources[key]?.state !== "complete") return null;
  const url = new URL(routes[source], origin);
  url.searchParams.set("branchId", branchId);
  url.searchParams.set("centerWorkspace", "people");
  url.searchParams.set("centerPeopleBranchId", branchId);
  return `${url.pathname}${url.search}`;
}