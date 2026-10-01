import type { OperationsCenterResponse, OperationsDeskAnalytics, OperationsInsight, OperationsInsightsResponse } from "@shared/operations-center";

export type PerformanceDays = 7 | 30;
export type AnalyticsChart = "sales" | "followups";
export type AssistantInsight = OperationsInsight;
export type AssistantResponse = OperationsInsightsResponse;
export const analyticsMetadata = (analytics?: OperationsDeskAnalytics) => analytics;

export const finiteValue = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const analyticsNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
export const analyticsUnit = (unit?: string) => ({ SAR: "ر.س", count: "سجل", "%": "%", records: "سجل", days: "يوم" }[unit || ""] || (unit && /[\u0600-\u06ff]/.test(unit) ? unit : ""));
export const analyticsEvidencePeriod = (period: string) => period === "current" ? "لقطة حالية" : period;
/** Retain workflow snapshots during a range fetch, never old sales or assistant evidence. */
export function performanceDataForRange(data: OperationsCenterResponse, days: PerformanceDays): OperationsCenterResponse {
  if (!data.analytics || data.analytics.period.days === days) return data;
  const end = new Date(`${data.businessDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - (days - 1));
  return { ...data, analytics: { ...data.analytics,
    period: { ...data.analytics.period, from: end.toISOString().slice(0, 10), to: data.businessDate, days },
    evidenceRevision: "", observations: [],
    sales: { ...data.analytics.sales, daily: [], byBranch: [], total: null, hrefs: [], recordedCount: null,
      recordedBranchDays: null, state: "unavailable", coverage: "unavailable" },
  } };
}
export function coverageLabel(coverage?: string) {
  return ({ complete: "مكتملة للمصادر المحمّلة", partial: "جزئية", unavailable: "غير متاحة", forbidden: "غير مسموح بها", no_data: "لا سجلات", failed: "تعذر تحميلها" } as Record<string, string>)[coverage || ""] || "غير معروفة";
}
export function analyticsSource(source?: string) {
  if (!source) return "مصدر غير متاح";
  const labels: Record<string, string> = {
    "cashier_sales_journals.total_sales": "إجمالي المبيعات المسجل في يوميات الكاشير المعتمدة أو المرحلة",
    "cashier_sales_journals.recorded_total_sales": "إجمالي المبيعات المسجل في يوميات الكاشير المعتمدة أو المرحلة",
    cashier_sales_journals: "يوميات الكاشير المعتمدة أو المرحلة", cashier_journal: "يوميات الكاشير",
    recorded_total_sales: "إجمالي المبيعات المسجل (ليس صافي المبيعات)",
    "branch_daily_closures.total_sales": "المبيعات المسجلة في الإغلاقات اليومية",
    branch_daily_closures: "الإغلاقات اليومية", salary_closures: "لقطات إغلاق الرواتب",
    quality_check: "فحص الجودة", "quality_checks.result": "نتيجة فحوص الجودة", quality_checks: "فحوص الجودة",
    "pnl_monthly_inputs/rent/recurring_contracts": "مدخلات التكاليف الشهرية والإيجار والعقود المتكررة",
    sales_trend: "المبيعات المسجلة", payroll_month: "لقطة الرواتب الشهرية", expenses_month: "التكاليف الشهرية المسجلة",
    maintenance: "الصيانة", kitchen_order: "طلبات المطبخ", transfer: "تحويلات المواد",
    reverse_movement: "المرتجعات", delivery_assignment: "مهام التوصيل", leave: "الإجازات",
    attendance_record: "الحضور", advance: "السلف", branch_complaint: "شكاوى الفروع", daily_closure: "الإغلاق اليومي",
  };
  if (labels[source]) return labels[source];
  let text = source;
  for (const [key, label] of Object.entries(labels).sort((a, b) => b[0].length - a[0].length)) text = text.replaceAll(key, label);
  return /[\u0600-\u06ff]/.test(text) ? text : "السجلات التشغيلية المصرح بها";
}
export function periodLabel(period?: { from: string; to: string }) {
  return period ? `${period.from} — ${period.to} · توقيت السعودية` : "الفترة غير متاحة";
}
export function salesChartPoints(analytics?: OperationsDeskAnalytics) {
  return (analytics?.sales.daily || []).map(day => ({
    ...day, timestamp: Date.parse(`${day.date}T00:00:00+03:00`),
    value: finiteValue(day.value) ? day.value : null,
  })).filter(day => Number.isFinite(day.timestamp));
}
export function latestRecordedDate(analytics?: OperationsDeskAnalytics) {
  return analyticsMetadata(analytics)?.sales.lastRecordedDate ||
    salesChartPoints(analytics).filter(day => day.value !== null).map(day => day.date).sort().at(-1) || null;
}
export function followupChartPoints(data: OperationsCenterResponse) {
  return (data.analytics?.followups.byBranch || [])
    .filter(row => data.scope.branchIds.includes(row.branchId))
    .map(row => ({ ...row, name: data.branches.find(branch => branch.id === row.branchId)?.name || row.branchId,
      value: finiteValue(row.count) ? row.count : null }));
}
/** Refreshing evidence must hide even a still-in-flight answer from the old context. */
export function assistantContextKey(data: OperationsCenterResponse, actorId: string | undefined, days: PerformanceDays) {
  return JSON.stringify([actorId || "", [...data.scope.branchIds].sort(), days, data.generatedAt, data.analytics?.generatedAt, analyticsMetadata(data.analytics)?.evidenceRevision,
    data.analytics?.period, data.analytics?.sales, data.analytics?.followups, data.queue, data.coverage]);
}
export function assistantRequest(data: OperationsCenterResponse, days: PerformanceDays) {
  return { branchIds: [...data.scope.branchIds], performanceDays: days };
}
export function assistantResponseMatches(result: AssistantResponse, data: OperationsCenterResponse) {
  const period = data.analytics?.period;
  return !!period && result.period.from === period.from && result.period.to === period.to &&
    result.scope.branchIds.slice().sort().join(",") === data.scope.branchIds.slice().sort().join(",") &&
    !!data.analytics?.evidenceRevision && result.evidenceRevision === data.analytics.evidenceRevision;
}
export function assistantFailureLabel(status?: number) {
  if (status === 429) return "طلبات التحليل متقاربة؛ انتظر دقيقة قبل طلب تحليل جديد. لم يُعَد الطلب تلقائيًا.";
  if (status === 503) return "المساعد غير متاح أو الخدمة مشغولة الآن. الأدلة المسجلة ما زالت مستقلة عن المساعد؛ حاول لاحقًا.";
  if (status === 403) return "تغيرت صلاحية التحليل أو نطاق الفروع؛ حدّث صلاحيات النطاق قبل المحاولة.";
  return "تعذر تحليل الأدلة؛ لم نعرض إجابة قديمة ولم نُعِد الطلب تلقائيًا.";
}

const recordPaths: Record<string, [string, string]> = {
  maintenance: ["/maintenance", "ticketId"], branch_complaint: ["/branch-complaints", "complaintId"],
  kitchen_order: ["/central-kitchen-orders", "orderId"], transfer: ["/transfer-requests", "transferId"],
  reverse_movement: ["/reverse-logistics", "movementId"], delivery_assignment: ["/driver-deliveries", "deliveryId"],
  leave: ["/hr/leaves", "leaveId"], attendance_record: ["/employee-attendance-report", "attendanceId"],
  advance: ["/hr/advances", "advanceId"], quality_check: ["/quality-control", "checkId"],
};
function localUrl(href: string, origin: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  try { const url = new URL(href, origin); return url.origin === origin ? url : null; } catch { return null; }
}
/** Only server-attached, canonical record/period destinations in the current scope can be opened. */
export function validatedInsightHref(insight: Pick<AssistantInsight, "sourceType" | "sourceId" | "branchId" | "href"> & { evidence?: AssistantInsight["evidence"] }, data: OperationsCenterResponse, origin: string): string | null {
  if (!data.scope.branchIds.includes(insight.branchId)) return null;
  const url = localUrl(insight.href, origin);
  if (!url) return null;
  const scoped = url.searchParams.get("branchId") === insight.branchId;
  if (/^[1-9]\d*$/.test(insight.sourceId)) {
    if (insight.sourceType === "cashier_journal")
      return url.pathname === `/cashier-journals/${insight.sourceId}` && scoped ? insight.href : null;
    if (insight.sourceType === "daily_closure")
      return scoped && (url.pathname === `/branch-daily-closures/${insight.sourceId}` ||
        url.pathname === "/branch-daily-closing" && url.searchParams.get("closureId") === insight.sourceId)
        ? `/branch-daily-closures/${insight.sourceId}?${new URLSearchParams({ branchId: insight.branchId })}` : null;
    const route = recordPaths[insight.sourceType];
    return route && scoped && url.pathname === route[0] && url.searchParams.get(route[1]) === insight.sourceId ? insight.href : null;
  }
  if (insight.sourceType === "sales_trend") {
    const period = data.analytics?.period;
    const link = data.analytics?.sales.hrefs.find(row => row.branchId === insight.branchId && row.href === insight.href);
    return link && period && insight.sourceId === `${period.from}/${period.to}` && insight.evidence?.period === `${period.from}/${period.to}` &&
      scoped && url.pathname === "/sales-analytics" && url.searchParams.get("fromDate") === period.from &&
      url.searchParams.get("toDate") === period.to ? insight.href : null;
  }
  const month = insight.evidence?.period;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) return null;
  if (insight.sourceType === "payroll_month" && insight.sourceId === `snapshot-${month}`)
    return (url.pathname === "/hr-hub" && scoped && url.searchParams.get("tab") === "payroll" ||
      url.pathname === "/salary-closing" && url.searchParams.get("branch") === insight.branchId) &&
      url.searchParams.get("month") === month ? insight.href : null;
  if (insight.sourceType === "expenses_month" && insight.sourceId === `recorded-costs-${month}`)
    return url.pathname === "/pnl-dashboard" && scoped && url.searchParams.get("month") === month ? insight.href : null;
  return null;
}
export function validatedSalesHref(href: string, branchId: string, data: OperationsCenterResponse, origin: string) {
  return validatedInsightHref({ sourceType: "sales_trend", sourceId: `${data.analytics?.period.from}/${data.analytics?.period.to}`, branchId, href,
    evidence: { label: "", source: "", value: null, period: `${data.analytics?.period.from}/${data.analytics?.period.to}` } }, data, origin);
}