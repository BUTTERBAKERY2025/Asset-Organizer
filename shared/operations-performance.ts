import { isOperationsInvestigationEvidence, operationsSalesSeries } from "./operations-center";
import type {
  OperationsObservation, OperationsPerformanceDays, OperationsPerformancePeriod,
  OperationsQueueItem, OperationsRegisteredSales, OperationsSalesState, OperationsSalesSummary, OperationsSourceRef,
} from "./operations-center";

export const REGISTERED_SALES_SOURCE = "cashier_sales_journals.total_sales";
export const REGISTERED_SALES_STATUSES = ["posted", "approved"] as const;
export const REGISTERED_SALES_DEFINITION = "إجمالي المبيعات المسجلة في اليوميات المرحلة والمعتمدة؛ نفس تحليلات المبيعات، وليس صافي المبيعات أو مبلغًا مصححًا بالمرتجعات. لا تُضاف لقطات الإغلاق.";

export function parseOperationsPerformanceDays(value: unknown): OperationsPerformanceDays {
  if (value === undefined) return 7;
  if (value === 7 || value === "7") return 7;
  if (value === 30 || value === "30") return 30;
  throw Object.assign(new Error("performanceDays must be 7 or 30"), { status: 400 });
}

export function riyadhBusinessDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Date-only arithmetic deliberately avoids the host timezone and DST. */
export function operationsDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let stamp = Date.parse(`${from}T00:00:00Z`); stamp <= Date.parse(`${to}T00:00:00Z`); stamp += 86400000)
    dates.push(new Date(stamp).toISOString().slice(0, 10));
  return dates;
}

export function operationsPerformancePeriod(now: Date, days: OperationsPerformanceDays): OperationsPerformancePeriod {
  const to = riyadhBusinessDate(now);
  return { from: new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10),
    to, days, timeZone: "Asia/Riyadh", kind: "rolling_inclusive" };
}

export function operationsMonthPeriod(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10) };
}

export function registeredSalesHref(branchId: string, fromDate: string, toDate: string): string {
  return `/sales-analytics?${new URLSearchParams({ branchId, fromDate, toDate })}`;
}

/** Rows are authorized branch/day aggregates, never cashier/journal details. */
export type RegisteredSalesRow = { date: string; branchId: string; sales: number; recordedCount: number };
export function projectRegisteredSales(branchIds: string[], dates: string[], rows: RegisteredSalesRow[],
  state: "available" | "unavailable" | "forbidden", lastDates: { branchId: string; date: string | null }[]): OperationsRegisteredSales {
  const available = state === "available";
  // Defense in depth: neither out-of-period nor out-of-scope rows enter an aggregate.
  const scoped = available ? rows.filter(row => branchIds.includes(row.branchId) && dates.includes(row.date)) : [];
  const latest = available ? lastDates.filter(row => branchIds.includes(row.branchId) && row.date && row.date <= dates[dates.length - 1]) : [];
  const summarize = (subset: RegisteredSalesRow[], ids: string[]): OperationsSalesSummary => {
    const salesState: OperationsSalesState = available ? subset.length ? "recorded" : "no_records" : state;
    const dayRows = operationsSalesSeries(dates, subset);
    return { state: salesState, total: subset.length ? subset.reduce((sum, row) => sum + row.sales, 0) : null,
      daily: dayRows.map(day => ({ ...day, recordedCount: available ? subset.filter(row => row.date === day.date).reduce((sum, row) => sum + row.recordedCount, 0) : null })),
      recordedCount: available ? subset.reduce((sum, row) => sum + row.recordedCount, 0) : null,
      recordedBranchDays: available ? new Set(subset.map(row => `${row.branchId}:${row.date}`)).size : null,
      lastRecordedDate: latest.filter(row => ids.includes(row.branchId)).map(row => row.date!).sort().at(-1) ?? null };
  };
  return { ...summarize(scoped, branchIds), source: REGISTERED_SALES_SOURCE, definition: REGISTERED_SALES_DEFINITION,
    coverage: available ? "partial" : "unavailable",
    byBranch: branchIds.map(branchId => ({ branchId, ...summarize(scoped.filter(row => row.branchId === branchId), [branchId]) })),
    hrefs: state === "forbidden" ? [] : branchIds.map(branchId => ({
      branchId, href: registeredSalesHref(branchId, dates[0], dates[dates.length - 1]),
    })) };
}

export function operationsSourceRef(item: Pick<OperationsQueueItem, "sourceType" | "sourceId" | "branchId" | "href">): OperationsSourceRef {
  return { sourceType: item.sourceType, sourceId: item.sourceId, branchId: item.branchId, href: item.href };
}

export function deduplicateOperationsRefs(refs: OperationsSourceRef[]): OperationsSourceRef[] {
  return [...new Map(refs.map(ref => [`${ref.branchId}:${ref.sourceType}:${ref.sourceId}`, ref])).values()];
}

/** All conclusions are branch-scoped loaded evidence; no invented deadlines or completion claims. */
export function buildOperationsObservations(branches: { id: string; name: string }[], queue: OperationsQueueItem[],
  sales: OperationsRegisteredSales, period: { from: string; to: string }, actorId: string): OperationsObservation[] {
  const result: OperationsObservation[] = [];
  const tasks = queue.filter(row => !isOperationsInvestigationEvidence(row));
  const backlog = branches.map(branch => ({ ...branch, rows: tasks.filter(row => row.branchId === branch.id) }))
    .sort((a, b) => b.rows.length - a.rows.length || a.id.localeCompare(b.id));
  const add = (branch: { id: string; name: string }, rows: OperationsQueueItem[], title: string, explanation: string, source: string,
    category: OperationsObservation["category"]) => {
    const sourceRefs = deduplicateOperationsRefs(rows.map(operationsSourceRef));
    if (sourceRefs.length) result.push({ kind: "evidence", category, title, explanation: `${branch.name}: ${explanation}`, source,
      branchId: branch.id, href: sourceRefs[0].href, sourceRefs });
  };
  if (backlog[0]?.rows.length) add(backlog[0], backlog[0].rows, "أكبر رصيد متابعة في القراءة الحالية",
    `${backlog[0].rows.length} سجل تشغيل محمّل لهذا الفرع؛ الأعلى بين الفروع المختارة ضمن حدود المسح، وليس عددًا مؤكدًا لكل العمل المتراكم.`,
    "المصادر المسموح بها؛ لقطة حالية محدودة", "backlog");
  for (const branch of branches) {
    const rows = tasks.filter(row => row.branchId === branch.id);
    const decisions = rows.filter(row => row.decision?.awaitingActor && row.decision.actorId === actorId);
    add(branch, decisions, "قرار متاح لك الآن",
      `${decisions.length} سجل محمّل في مرحلة تملك قرارها الآن؛ ابدأ بمراجعة ${decisions[0]?.title ?? "المصدر"}، ولا يعني الإسناد وحده سلطة القرار.`,
      "مرحلة المصدر وصلاحية الإجراء الحالية", "decision");
    const emergencies = rows.filter(row => row.priorityReason);
    add(branch, emergencies, "تصنيف عاجل مثبت في المصدر",
      `${emergencies.length} سجل محمّل مصنف عاجلًا من المصدر؛ راجع ${emergencies[0]?.title ?? "المصدر"}. لا يُستنتج التصنيف من التأخر.`,
      "تصنيف الأولوية المسجل", "emergency");
    const quality = queue.filter(row => row.branchId === branch.id && isOperationsInvestigationEvidence(row));
    add(branch, quality, "أدلة جودة تحتاج التحقيق",
      `${quality.length} فحص محمّل يحتاج التحقيق؛ المصدر لا يثبت معالجة أو إغلاقًا، ولا تُعد هذه مهامًا غير محلولة.`, "quality_checks.result؛ فحوص اليوم فقط", "quality");
    const recorded = sales.byBranch.find(row => row.branchId === branch.id);
    const days = recorded?.daily.filter(day => day.value !== null).slice(-2) ?? [];
    if (days.length === 2) {
      const href = sales.hrefs.find(row => row.branchId === branch.id)?.href;
      if (href) result.push({ kind: "evidence", category: "sales_comparison", title: `${branch.name}: مقارنة آخر يومين لهما مبيعات مسجلة`,
        explanation: `${days[0].date}: ${days[0].value!.toLocaleString("en-US")} ر.س · ${days[1].date}: ${days[1].value!.toLocaleString("en-US")} ر.س؛ المقارنة لليوميات المرحلة والمعتمدة فقط. الأيام بلا سجلات ليست صفراً ولا يثبت هذا اتجاه الفترة.`,
        source: REGISTERED_SALES_SOURCE, branchId: branch.id, href,
        sourceRefs: [{ sourceType: "sales_trend", sourceId: `${period.from}/${period.to}`, branchId: branch.id, href }] });
    }
  }
  return result;
}