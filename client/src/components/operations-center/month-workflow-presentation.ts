import type { OperationsMonthWorkflow } from "@shared/operations-month-workflow";

/** Saudi business month, defaulting to the last completed month rather than today's open month. */
export function lastCompletedOperationsMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  return `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
}

export const monthMoney = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ر.س`
    : "غير متاح";

export const monthFileLabels = {
  payroll: "الرواتب والصرف", expenses: "المصروفات",
  closing: "المراجعة والإغلاقات اليومية", sales: "المبيعات المسجلة",
} as const;
export type MonthFileId = keyof typeof monthFileLabels;

export const monthSourceLabels = {
  ready: "متاح", denied: "لا توجد صلاحية", no_records: "لا توجد سجلات",
  failed: "تعذر تحميل المصدر", partial: "أدلة جزئية",
} as const;
export type MonthSourceState = keyof typeof monthSourceLabels;

/** These are presentation states, not permission or lifecycle decisions. */
export function monthFileState(workflow: OperationsMonthWorkflow, file: MonthFileId): MonthSourceState {
  const section = workflow[file];
  if (file === "closing") {
    if (workflow.sourceFailures.includes("daily") || workflow.sourceFailures.includes("review"))
      return section.available ? "partial" : "failed";
    if (!section.available) return "denied";
    if (!workflow.closing.dailyEvidenceAvailable || !workflow.closing.reviewEvidenceAvailable) return "partial";
    return workflow.closing.dailyRecords.length || workflow.closing.declarations.length || workflow.closing.history.length ? "ready" : "no_records";
  }
  if (workflow.sourceFailures.includes(file) || workflow.sourceStates?.[file] === "unavailable") return "failed";
  if (workflow.sourceStates?.[file] === "forbidden" || (file === "sales" && workflow.sales.state === "forbidden")) return "denied";
  if (!section.available) return "denied";
  if (file === "payroll") {
    const payroll = workflow.payroll;
    if (payroll.unknownPaymentAmounts || payroll.unreconciledPaymentCount || payroll.snapshotMismatch) return "partial";
    return payroll.status === "not_closed" && !payroll.payments.length ? "no_records" : "ready";
  }
  if (file === "expenses") return workflow.expenses.recorded === null ? "no_records" : "ready";
  if (workflow.sales.state === "unavailable") return "failed";
  return workflow.sales.state === "no_records" || workflow.sales.confirmed === null ? "no_records" : "partial";
}

export function monthNextStep(workflow: OperationsMonthWorkflow, file: MonthFileId): string {
  const state = monthFileState(workflow, file);
  if (state === "denied") return "اطلب صلاحية المصدر من المسؤول؛ العرض لا يمنح صلاحية إضافية.";
  if (state === "failed") return "أعد تحميل المصدر قبل اتخاذ قرار؛ غياب الأدلة ليس صفرًا.";
  if (file === "payroll") {
    const payroll = workflow.payroll;
    if (payroll.status !== "closed") return "راجع وأغلق لقطة استحقاق الرواتب في المصدر أولًا؛ الصرف المسجل لا يعتمد الاستحقاق.";
    if (payroll.snapshotMismatch) return "راجع اختلاف إجمالي لقطة الرواتب عن بنود الموظفين قبل إثبات الاستحقاق والتسوية.";
    if (payroll.unknownPaymentAmounts) return "حدّد مبالغ الدفعات غير المعروفة في سجل الصرف قبل إثبات المتبقي.";
    if (payroll.unreconciledPaymentCount) return "طابق الدفعات مع موظفي لقطة الاستحقاق المغلقة.";
    if ((payroll.overpaid ?? 0) > 0) return "راجع زيادة الصرف لكل موظف؛ لا تخصمها من عجز موظف آخر.";
    if ((payroll.remaining ?? 0) > 0) return "راجع استحقاقات الموظفين المتبقية وسجّل الصرف المصرح به في المصدر.";
    return "راجع لقطة الاستحقاق وسجل الدفعات؛ المطابقة لا تنفّذ دفعة جديدة.";
  }
  if (file === "expenses") return state === "no_records"
    ? "راجع سجلات المصروفات للشهر في المصدر؛ لا توجد قيود تثبت إجماليًا هنا."
    : "راجع بنود التكاليف في المصدر. المسجل ليس المدفوع؛ دليل الدفع غير متاح هنا.";
  if (file === "sales") return "راجع اليوميات المعتمدة أو المرحلة ضمن أيام الشهر؛ هذه مبيعات مسجلة جزئيًا وليست صافي المبيعات.";
  const closing = workflow.closing;
  if (closing.drifted) return "أعد فتح المراجعة الشهرية ثم راجع الأدلة المتغيرة قبل إغلاقها مجددًا.";
  if (state === "partial") return "استكمل تحميل أدلة الأيام والمراجعة؛ لا تستخدم حالة محفوظة لإثبات اكتمال المصدر المتعطل.";
  if (closing.blockers.length) return "عالج عوائق الأيام المحددة أدناه: راجع السجل أو وثّق سبب عدم التشغيل.";
  if (!closing.ended) return "راجع السجلات الحالية؛ لا يُغلق الشهر قبل انتهائه بتوقيت السعودية.";
  return closing.status === "closed" ? "راجع سجل الإغلاق المحفوظ؛ أعد الفتح بسبب موثق عند الحاجة."
    : "راجع الأدلة ثم أغلق المراجعة التشغيلية للشهر بصلاحيتك الحالية.";
}

export function monthWorkspaceKey(actorId: string | undefined, branchId: string, month: string, authorizedIds: readonly string[]) {
  return ["/api/operations-center/month-workflow", actorId ?? "", branchId === "all" ? "all" : "single",
    [...authorizedIds].sort().join(","), branchId, month] as const;
}

export function operationsMonthPeriod(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(days).padStart(2, "0")}` };
}

/** The server owns provenance; never let a source link change the selected branch/month.
 * In particular month alone does not constrain the sales analytics date filter. */
export function validMonthSource(href: string, branchId: string, month: string, origin: string): boolean {
  try {
    const url = new URL(href, origin);
    const branchParameter = url.pathname === "/salary-closing" ? "branch" : "branchId";
    const exact = (key: string, expected: string) => url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === expected;
    const period = operationsMonthPeriod(month);
    return url.origin === origin &&
      ["/salary-closing", "/hr-hub", "/pnl-dashboard", "/branch-daily-closures", "/sales-analytics"].includes(url.pathname) &&
      !!branchId && branchId !== "all" && !!period &&
      (url.pathname !== "/hr-hub" || exact("tab", "payroll")) &&
      (!url.searchParams.has("branch") || exact("branch", branchId)) &&
      (!url.searchParams.has("branchId") || exact("branchId", branchId)) &&
      exact(branchParameter, branchId) && exact("month", month) &&
      (url.pathname !== "/sales-analytics" || (exact("fromDate", period.from) && exact("toDate", period.to)));
  } catch { return false; }
}