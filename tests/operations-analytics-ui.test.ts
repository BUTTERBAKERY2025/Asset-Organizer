import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OperationsCenterResponse, OperationsInsightsResponse } from "../shared/operations-center";
import {
  analyticsEvidencePeriod, analyticsSource, analyticsUnit, assistantContextKey, assistantFailureLabel,
  assistantRequest, assistantResponseMatches, coverageLabel, finiteValue, followupChartPoints, latestRecordedDate,
  performanceDataForRange, salesChartPoints, validatedInsightHref, validatedSalesHref,
} from "../client/src/components/operations-center/analytics-model";
import { PerformanceChart, PerformanceDetail, PerformancePanel, PerformanceSummary } from "../client/src/components/operations-center/performance-panels";
import { AnalyticsAssistant } from "../client/src/components/operations-center/analytics-assistant";

const origin = "https://bakery.example";
function fixture(values: (number | null)[] = [null, 0, 20]): OperationsCenterResponse {
  const daily = values.map((value, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, value,
    recordedBranches: value === null ? 0 : 1, recordedCount: value === null ? 0 : 1 }));
  const recorded = values.filter(finiteValue);
  const sales = { state: recorded.length ? "recorded" as const : "no_records" as const,
    total: recorded.length ? recorded.reduce((sum, value) => sum + value, 0) : null, daily, recordedCount: recorded.length,
    recordedBranchDays: recorded.length, lastRecordedDate: recorded.length ? daily.filter(day => day.value !== null).at(-1)!.date : "2026-09-20" };
  return {
    generatedAt: "2026-10-03T09:00:00Z", businessDate: "2026-10-03",
    scope: { branchIds: ["b1"], requested: ["b1"], limit: 50 }, branches: [{ id: "b1", name: "فرع النخيل الطويل" }],
    modules: [], cards: [], metrics: [], queue: [], daily: [], weekly: [],
    coverage: { queue: {}, truncated: false, nextOffset: null },
    analytics: {
      generatedAt: "2026-10-03T09:00:00Z", evidenceRevision: "revision1", scope: { branchIds: ["b1"] },
      period: { from: "2026-09-27", to: "2026-10-03", days: 7, timeZone: "Asia/Riyadh", kind: "rolling_inclusive" },
      observations: [],
      sales: { ...sales, source: "cashier_sales_journals.total_sales", definition: "إجمالي المبيعات المسجل",
        coverage: "partial", byBranch: [{ ...sales, branchId: "b1" }],
        hrefs: [{ branchId: "b1", href: "/sales-analytics?branchId=b1&fromDate=2026-09-27&toDate=2026-10-03" }] },
      followups: { source: "المصادر المسموح بها", coverage: "partial", period: "current",
        scan: { sourceLimit: 100, truncated: false, unavailableSources: [] },
        byBranch: [{ branchId: "b1", count: 0, awaitingDecision: 0, emergency: 0 }] },
    },
  };
}
const render = (component: Parameters<typeof createElement>[0], props: any) => renderToStaticMarkup(createElement(component, props));
const answer = (data: OperationsCenterResponse): OperationsInsightsResponse => ({
  kind: "ai", status: "no_evidence", generatedAt: data.generatedAt, evidenceRevision: data.analytics!.evidenceRevision,
  period: data.analytics!.period, scope: { branchIds: [...data.scope.branchIds] }, insights: [],
});

describe("compact operations analytics evidence", () => {
  it("all-null nonempty arrays show a truthful no-data message, not a blank successful chart", () => {
    const data = fixture([null, null, null]);
    expect(salesChartPoints(data.analytics)).toHaveLength(3);
    expect(salesChartPoints(data.analytics).some(day => day.value !== null)).toBe(false);
    expect(render(PerformanceChart, { chart: "sales", data })).toContain("لا توجد مبيعات مسجلة قابلة للرسم");
    expect(latestRecordedDate(data.analytics)).toBe("2026-09-20");
  });
  it("keeps genuine recorded zero in the chart, total, and latest date", () => {
    const data = fixture([null, 0, null]);
    expect(salesChartPoints(data.analytics).map(day => day.value)).toEqual([null, 0, null]);
    expect(render(PerformanceSummary, { data })).toContain("0 ر.س");
    expect(latestRecordedDate(data.analytics)).toBe("2026-10-02");
    const element = PerformanceChart({ chart: "sales", data });
    const responsive = element.props.children;
    const chart = responsive.props.children;
    const area = chart.props.children.at(-1);
    expect(area.props.dot.r).toBeGreaterThan(0);
    expect(area.props.connectNulls).toBe(false);
    expect(area.props.type).toBe("linear");
  });
  it("preserves sparse null gaps, real elapsed-date spacing, and finite-only plotting", () => {
    const data = fixture([12, null, 0, Number.NaN, Infinity, 19]);
    const points = salesChartPoints(data.analytics);
    expect(points.map(day => day.value)).toEqual([12, null, 0, null, null, 19]);
    expect(points[2].timestamp - points[0].timestamp).toBe(2 * 86400000);
    expect(finiteValue("0")).toBe(false);
    expect(finiteValue(-Infinity)).toBe(false);
  });
  it("distinguishes forbidden and failed sources from missing records", () => {
    const data = fixture([null]);
    data.analytics!.sales.state = "forbidden";
    data.analytics!.sales.coverage = "unavailable";
    expect(render(PerformanceChart, { chart: "sales", data })).toContain("لا تملك صلاحية");
    data.analytics!.sales.state = "unavailable";
    expect(render(PerformanceChart, { chart: "sales", data })).toContain("تعذر تحميل دليل المبيعات");
  });
  it("keeps branch zero counts and interactive chart separate from the expand button", () => {
    const data = fixture();
    expect(followupChartPoints(data)[0]).toMatchObject({ value: 0, name: "فرع النخيل الطويل" });
    const markup = render(PerformancePanel, { chart: "followups", data, onExpand: () => {} });
    expect(markup).not.toContain("pointer-events-none");
    expect(markup).toContain("تكبير المتابعات");
    expect(markup).toContain("ليست إجمالي كل المهام");
  });
  it("translates partial coverage, technical sources, currency, and current snapshot labels", () => {
    expect(coverageLabel("partial")).toBe("جزئية");
    expect(analyticsSource("cashier_sales_journals.total_sales")).not.toContain("total_sales");
    expect(analyticsSource("quality_checks.result؛ فحوص اليوم")).not.toContain("quality_checks");
    expect(analyticsUnit("SAR")).toBe("ر.س");
    expect(analyticsEvidencePeriod("current")).toBe("لقطة حالية");
  });
  it("range transition retains workflow snapshots but clears all old sales/assistant evidence", () => {
    const previous = fixture();
    const pending = performanceDataForRange(previous, 30);
    expect(pending.queue).toBe(previous.queue);
    expect(pending.daily).toBe(previous.daily);
    expect(pending.analytics!.followups).toBe(previous.analytics!.followups);
    expect(pending.analytics!.sales.daily).toEqual([]);
    expect(pending.analytics!.sales.total).toBeNull();
    expect(pending.analytics!.sales.lastRecordedDate).toBe("2026-10-03");
    expect(pending.analytics!.evidenceRevision).toBe("");
    expect(pending.analytics!.period).toMatchObject({ days: 30, from: "2026-09-04", to: "2026-10-03" });
    expect(performanceDataForRange(previous, 7)).toBe(previous);
  });
  it("bounds narrow analytics details, wraps provenance and source buttons, and confines horizontal scrolling to tables", () => {
    vi.stubGlobal("window", { location: { origin } });
    try {
      const data = fixture();
      data.branches[0].name = "فرع ذو اسم طويل جدًا لمراجعة مبيعات الفترة المسجلة";
      const markup = render(PerformanceDetail, { chart: "sales", data, open: () => {} });
      expect(markup).toContain("oc-performance-detail");
      expect(markup).toContain("oc-performance-title");
      expect(markup).toContain("oc-performance-period");
      expect(markup).toContain("oc-performance-provenance");
      expect(markup).toContain("whitespace-normal");
      expect(markup).toContain("oc-evidence-table");
      expect(markup).toContain("2026-09-27");
      expect(markup).toContain("2026-10-03");
      const css = readFileSync(new URL("../client/src/components/operations-center/decision-board.css", import.meta.url), "utf8");
      expect(css).toMatch(/\.oc-analytics-workspace \.oc-workspace-grid \{[^}]*min-width:0[^}]*max-width:100%/);
      expect(css).toMatch(/\.oc-analytics-workspace \.oc-workspace-detail \{[^}]*min-width:0[^}]*overflow-x:hidden/);
      expect(css).toMatch(/\.oc-performance-provenance \{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
      expect(css).toMatch(/\.oc-evidence-table \{[^}]*min-width:0[^}]*max-width:100%[^}]*overflow-x:auto/);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("assistant context, statuses and canonical navigation", () => {
  it("sends the selected rolling period and invalidates actor, scope, period, revision and evidence refresh", () => {
    const data = fixture();
    const context = assistantContextKey(data, "actor1", 7);
    expect(assistantRequest(data, 30)).toEqual({ branchIds: ["b1"], performanceDays: 30 });
    expect(assistantContextKey(data, "actor2", 7)).not.toBe(context);
    expect(assistantContextKey(data, "actor1", 30)).not.toBe(context);
    expect(assistantContextKey({ ...data, scope: { ...data.scope, branchIds: ["b2"] } }, "actor1", 7)).not.toBe(context);
    expect(assistantContextKey({ ...data, generatedAt: "2026-10-03T09:01:00Z" }, "actor1", 7)).not.toBe(context);
    expect(assistantResponseMatches(answer(data), data)).toBe(true);
    expect(assistantResponseMatches({ ...answer(data), evidenceRevision: "old" }, data)).toBe(false);
    expect(assistantResponseMatches({ ...answer(data), scope: { branchIds: ["b2"] } }, data)).toBe(false);
    expect(assistantResponseMatches({ ...answer(data), period: { ...data.analytics!.period, from: "2026-10-01" } }, data)).toBe(false);
    expect(assistantFailureLabel(429)).toContain("انتظر");
    expect(assistantFailureLabel(503)).toContain("المساعد غير متاح");
    expect(assistantFailureLabel(403)).toContain("صلاحية");
  });
  it("renders no-evidence and failures visibly as assistant messages, not deterministic observations", () => {
    const data = fixture();
    const state = { result: answer(data), staleEvidence: false, error: null, loading: false, refreshing: false, request: () => {} };
    const empty = render(AnalyticsAssistant, { data, assistant: state, open: () => {} });
    expect(empty).toContain("استجابة المساعد");
    expect(empty).toContain("لا توجد أدلة مؤهلة كافية");
    expect(empty).toContain("نص المساعد ليس حقيقة تشغيلية");
    expect(empty).toContain("طلب تحليل مساعد للفترة");
    const failed = render(AnalyticsAssistant, { data, assistant: { ...state, result: null, error: assistantFailureLabel(503) }, open: () => {} });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("المساعد غير متاح");
  });
  it("renders the returned suggestion visibly with translated units and snapshot period", () => {
    const data = fixture();
    const result = { ...answer(data), status: "ready" as const, insights: [{
      title: "مراجعة الدليل", explanation: "راجع السجلات قبل القرار", sourceType: "maintenance", sourceId: "9",
      branchId: "b1", href: "/maintenance?branchId=b1&ticketId=9", sourceRefs: [],
      evidence: { label: "الدليل المسجل", source: "maintenance", value: 0, unit: "SAR", period: "current" },
    }] };
    const markup = render(AnalyticsAssistant, { data, assistant: {
      result, staleEvidence: false, error: null, loading: false, refreshing: false, request: () => {},
    }, open: () => {} });
    expect(markup).toContain("راجع السجلات قبل القرار");
    expect(markup).toContain("اقتراح المساعد");
    expect(markup).toContain("0 ر.س");
    expect(markup).toContain("لقطة حالية");
    expect(markup).not.toContain("SAR");
  });
  it("accepts canonical off-page record links without requiring membership in the current queue slice", () => {
    const data = fixture();
    const ref = { sourceType: "maintenance", sourceId: "999", branchId: "b1", href: "/maintenance?branchId=b1&ticketId=999" };
    expect(data.queue).toEqual([]);
    expect(validatedInsightHref(ref, data, origin)).toBe(ref.href);
    expect(validatedInsightHref({ ...ref, href: "/maintenance?branchId=b1&ticketId=998" }, data, origin)).toBeNull();
    expect(validatedInsightHref({ ...ref, branchId: "b2" }, data, origin)).toBeNull();
    expect(validatedInsightHref({ ...ref, href: "https://evil.example/maintenance?branchId=b1&ticketId=999" }, data, origin)).toBeNull();
    expect(validatedInsightHref({ ...ref, href: "//evil.example/maintenance" }, data, origin)).toBeNull();
    expect(validatedInsightHref({ ...ref, href: "/unknown?branchId=b1&ticketId=999" }, data, origin)).toBeNull();
  });
  it("resolves off-page daily closure evidence to its real detail route, not the creation screen", () => {
    const data = fixture();
    expect(validatedInsightHref({ sourceType: "daily_closure", sourceId: "19", branchId: "b1",
      href: "/branch-daily-closing?branchId=b1&closureId=19&date=2026-10-01" }, data, origin))
      .toBe("/branch-daily-closures/19?branchId=b1");
  });
  it("requires exact authorized fromDate/toDate on sales provenance, even across months", () => {
    const data = fixture();
    const href = data.analytics!.sales.hrefs[0].href;
    expect(validatedSalesHref(href, "b1", data, origin)).toBe(href);
    expect(validatedSalesHref("/sales-analytics?branchId=b1&month=2026-10", "b1", data, origin)).toBeNull();
    expect(validatedSalesHref(href.replace("2026-09-27", "2026-10-01"), "b1", data, origin)).toBeNull();
    expect(validatedSalesHref(href, "b2", data, origin)).toBeNull();
  });
});