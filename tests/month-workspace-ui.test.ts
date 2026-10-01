import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { monthCoverage, monthMetric, type OperationsMonthAllWorkflow, type OperationsMonthWorkflow } from "../shared/operations-month-workflow";
import { MonthWorkflowComparison } from "../client/src/components/operations-center/month-workflow-comparison";
import { MonthSalesLedger } from "../client/src/components/operations-center/month-sales-ledger";
import { OperationsMonthWorkspace } from "../client/src/components/operations-center/month-workflow";
import { monthFileState, monthNextStep, monthWorkspaceKey, type MonthFileId } from "../client/src/components/operations-center/month-workflow-presentation";

vi.stubGlobal("React", React);
const origin = "https://example.test";
vi.stubGlobal("window", { location: { origin, search: "" } });

function workflow(branchId = "a"): OperationsMonthWorkflow {
  return {
    mode: "single", branchId, month: "2026-09", generatedAt: "2026-10-01T10:00:00Z", sourceFailures: [],
    sourceStates: { payroll: "available", expenses: "available", daily: "available", review: "available", sales: "available" },
    payroll: { available: true, status: "closed", due: 200, paid: 200, remaining: 100, overpaid: 100,
      recordedPaid: 200, settlementStatus: "overpaid", unknownPaymentAmounts: 0, unreconciledPaymentCount: 0,
      unreconciledPaymentAmount: 0, sourceHref: `/salary-closing?branch=${branchId}&month=2026-09`, canManage: true,
      employees: [{ employeeId: 1, name: "الموظف الأول", due: 100, paid: 200, remaining: 0, overpaid: 100 },
        { employeeId: 2, name: "الموظف الثاني", due: 100, paid: 0, remaining: 100, overpaid: 0 }], payments: [] },
    expenses: { available: true, recorded: 0, paid: null, items: [{ label: "رسوم مسجلة", amount: 0 }],
      sourceHref: `/pnl-dashboard?branchId=${branchId}&month=2026-09`, canManage: true },
    closing: { available: true, status: "open", ended: true, drifted: false, dailyEvidenceAvailable: true,
      reviewEvidenceAvailable: true, canClose: false, canReopen: false, canDeclare: true, revision: 7,
      closedAt: null, closedBy: null, dailyRecords: [{ id: 15, date: "2026-09-01", status: "open", sales: 55,
        href: `/branch-daily-closures/15?branchId=${branchId}` }],
      missingDates: ["2026-09-02"], declarations: [], blockers: ["السجل اليومي 2026-09-01 غير مغلق", "اليوم 2026-09-02 بلا سجل"],
      sourceHref: `/branch-daily-closures?branchId=${branchId}&month=2026-09`, history: [] },
    sales: { available: true, state: "recorded", confirmed: 42, closedDays: null, recordedCount: 2,
      recordedBranchDays: 1, lastRecordedDate: "2026-09-03", coverage: "partial", isNet: false,
      source: "cashier_journals", definition: "إجمالي يوميات الكاشير المعتمدة أو المرحلة",
      sourceHref: `/sales-analytics?branchId=${branchId}&month=2026-09&fromDate=2026-09-01&toDate=2026-09-30` },
  };
}

function comparison(): OperationsMonthAllWorkflow {
  const a = workflow(), b = workflow("b");
  b.payroll.due = null; b.payroll.paid = null; b.payroll.remaining = null; b.payroll.overpaid = null;
  b.payroll.recordedPaid = null; b.payroll.available = false;
  b.sourceFailures = ["payroll"]; b.sourceStates!.payroll = "unavailable";
  b.payroll.reason = "تعذر تحميل أدلة الرواتب";
  const metrics = {
    payroll: { due: monthMetric([200, null]), paid: monthMetric([200, null]), remaining: monthMetric([100, null]),
      overpaid: monthMetric([100, null]), recordedPaid: monthMetric([200, null]) },
    expenses: { recorded: monthMetric([0, 0]) },
    sales: { confirmed: monthMetric([42, 42]), recordedCount: monthMetric([2, 2]), recordedBranchDays: monthMetric([1, 1]) },
    closing: { closedCount: monthMetric([0, 0]), openCount: monthMetric([1, 1]), reopenedCount: monthMetric([0, 0]), driftedCount: monthMetric([0, 0]) },
  };
  return { mode: "all", branchId: "all", month: "2026-09", generatedAt: a.generatedAt, readOnly: true,
    scope: { branchIds: ["a", "b"], branchCount: 2 },
    branches: [{ branchId: "a", branchName: "الفرع الأول", workflow: a }, { branchId: "b", branchName: "الفرع الثاني", workflow: b }],
    totals: {
      payroll: { coverage: monthCoverage(["complete", "unavailable"]), due: 200, paid: 200, remaining: 100, overpaid: 100, recordedPaid: 200 },
      expenses: { coverage: monthCoverage(["complete", "complete"]), recorded: 0, paid: null },
      sales: { coverage: monthCoverage(["partial", "partial"]), confirmed: 84, recordedCount: 4, recordedBranchDays: 2,
        lastRecordedDate: "2026-09-03", source: "cashier_journals", definition: "إجمالي يوميات الكاشير المعتمدة أو المرحلة", isNet: false },
      closing: { coverage: monthCoverage(["complete", "complete"]), closedCount: 0, openCount: 2, reopenedCount: 0, driftedCount: 0 }, metrics,
    } };
}

function renderComparison(file: MonthFileId, data = comparison()) {
  return renderToStaticMarkup(React.createElement(MonthWorkflowComparison, {
    data, file, busy: false, origin, selectBranch: vi.fn(), openSource: vi.fn(),
  }));
}

describe("mounted monthly workspace and all-branch source evidence", () => {
  it("defaults to actual all-scope GET even when the outer center has only one branch", () => {
    window.location.search = "?workspace=monthly&month=2026-09";
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(monthWorkspaceKey("actor", "all", "2026-09", ["a"]), comparison());
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(OperationsMonthWorkspace, { branches: [{ id: "a", name: "الفرع الأول" }], actorId: "actor", open: vi.fn() })));
    expect(markup).toContain('value="all" selected=""');
    expect(markup).toContain("كل الفروع المصرح بها");
    expect(markup).toContain('data-testid="month-all-comparison"');
    expect(markup).toContain("الفرع الثاني");
    expect(markup).not.toContain('aria-label="تأكيد إجراء الشهر"');
    window.location.search = "";
  });
  it("does not replace invalid explicit return selections with another branch or month", () => {
    window.location.search = "?workspace=monthly&monthBranchId=revoked&month=2026-13&monthFile=payroll";
    const client = new QueryClient();
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(OperationsMonthWorkspace, { branches: [{ id: "a", name: "الفرع الأول" }], actorId: "actor", open: vi.fn() })));
    expect(markup).toContain("لم نحمّل فرعًا أو شهرًا بديلًا");
    expect(markup).toContain('value="" disabled="" selected=""');
    expect(markup).not.toContain('data-testid="month-all-comparison"');
    window.location.search = "";
  });
  it("restores an explicitly authorized single return instead of changing it to all", () => {
    window.location.search = "?workspace=monthly&monthBranchId=a&month=2026-09&monthFile=closing";
    const client = new QueryClient();
    client.setQueryData(monthWorkspaceKey("actor", "a", "2026-09", ["a", "b"]), workflow());
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(OperationsMonthWorkspace, { branches: [{ id: "a", name: "الفرع الأول" }, { id: "b", name: "الفرع الثاني" }], actorId: "actor", open: vi.fn() })));
    expect(markup).toContain('value="a" selected=""');
    expect(markup).not.toContain('data-testid="month-all-comparison"');
    expect(markup).toContain("سجل #15");
    expect(markup).toContain("2026-09-02");
    expect(markup).toContain("إغلاق مراجعة تشغيلية محفوظ");
    window.location.search = "";
  });
  it("hides cached details during revalidation of authorization rather than presenting stale branch evidence", () => {
    window.location.search = "?workspace=monthly&month=2026-09";
    const client = new QueryClient();
    client.setQueryData(monthWorkspaceKey("actor", "all", "2026-09", ["a"]), comparison());
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(OperationsMonthWorkspace, { branches: [{ id: "a", name: "الفرع الأول" }], actorId: "actor", ready: false, open: vi.fn() })));
    expect(markup).not.toContain('data-testid="month-all-comparison"');
    expect(markup).not.toContain("الفرع الثاني");
    expect(markup).toContain("التفاصيل السابقة مخفية");
    window.location.search = "";
  });
  it.each(["payroll", "expenses", "closing", "sales"] as const)("makes %s comparison read-only even when a branch projection claims write authority", file => {
    const markup = renderComparison(file);
    expect(markup).toContain("مقارنة للقراءة فقط");
    expect(markup).toContain("الفرع الأول");
    expect(markup).toContain("الفرع الثاني");
    expect(markup).toContain("تفاصيل الفرع ومراجعته");
    expect(markup).not.toContain("<form");
    for (const action of ["إغلاق الشهر التشغيلي", "إعادة فتح الشهر", "توثيق يوم غير تشغيلي", "إلغاء التوثيق", "تأكيد وحفظ"])
      expect(markup).not.toContain(`>${action}<`);
  });
  it("shows known partial subtotals with unknown branch counts, not an invented complete zero", () => {
    const markup = renderComparison("payroll");
    expect(markup).toContain("مجموع جزئي فقط");
    expect(markup).toContain("غير معروف 1");
    expect(markup).toContain("تعذر تحميل المصدر");
    expect(markup).toContain("عجز استحقاق الموظفين");
    expect(markup).toContain("زيادة صرف تحتاج مطابقة");
    expect(markup).toContain("سداد زائد لموظف لا يسدد موظفًا آخر");
    expect(renderComparison("expenses")).toContain("0 ر.س");
    expect(renderComparison("expenses")).toContain("المدفوع نقديًا");
    expect(renderComparison("expenses")).toContain("غير متاح");
  });
  it("does not render a source button when sales source dates or source branch do not match", () => {
    const all = comparison();
    all.branches = [all.branches[0]];
    expect(renderComparison("sales", all)).toContain("فتح مصدر هذا الفرع");
    all.branches[0].workflow.sales.sourceHref = "/sales-analytics?branchId=b&month=2026-09&fromDate=2026-09-01&toDate=2026-09-30";
    expect(renderComparison("sales", all)).not.toContain("فتح مصدر هذا الفرع");
    all.branches[0].workflow.sales.sourceHref = "/sales-analytics?branchId=a&month=2026-09";
    expect(renderComparison("sales", all)).not.toContain("فتح مصدر هذا الفرع");
  });
  it("keeps unavailable sources independent, distinguishes no records and denied evidence", () => {
    const data = workflow();
    data.sourceStates!.payroll = "forbidden"; data.payroll.available = false;
    expect(monthFileState(data, "payroll")).toBe("denied");
    data.sourceFailures.push("payroll"); data.sourceStates!.payroll = "unavailable";
    expect(monthFileState(data, "payroll")).toBe("failed");
    expect(monthFileState(data, "expenses")).toBe("ready");
    data.expenses.recorded = null; data.expenses.items = [];
    expect(monthFileState(data, "expenses")).toBe("no_records");
    data.sales.state = "no_records"; data.sales.confirmed = null;
    expect(monthFileState(data, "sales")).toBe("no_records");
    data.sourceFailures.push("review"); data.closing.reviewEvidenceAvailable = false;
    expect(monthFileState(data, "closing")).toBe("partial");
    expect(monthNextStep(data, "closing")).toContain("استكمل تحميل");
  });
  it("states payroll next steps from entitlement, unknown amounts, reconciliation and excess rather than a payment count", () => {
    const data = workflow();
    data.payroll.status = "not_closed";
    expect(monthNextStep(data, "payroll")).toContain("أغلق لقطة");
    data.payroll.status = "closed"; data.payroll.unknownPaymentAmounts = 1;
    expect(monthNextStep(data, "payroll")).toContain("مبالغ الدفعات غير المعروفة");
    data.payroll.unknownPaymentAmounts = 0; data.payroll.unreconciledPaymentCount = 1;
    expect(monthNextStep(data, "payroll")).toContain("طابق الدفعات");
    data.payroll.unreconciledPaymentCount = 0;
    expect(monthNextStep(data, "payroll")).toContain("لا تخصمها من عجز موظف آخر");
  });
  it("shows precise blocker dates and records, not a guessed completed month", () => {
    const markup = renderComparison("closing");
    expect(markup).toContain("2026-09-01");
    expect(markup).toContain("2026-09-02");
    expect(markup).toContain("غير مغلق");
    expect(markup).toContain("لقطة تشغيلية يومية محفوظة");
  });
  it("renders recorded journal daily values and counts without treating an unknown date as zero or closure sales as journal sales", () => {
    const sales = { ...workflow().sales, daily: [
      { date: "2026-09-01", value: null, recordedCount: null, recordedBranches: 0 },
      { date: "2026-09-02", value: 0, recordedCount: 1, recordedBranches: 1 },
      { date: "2026-10-01", value: 1000, recordedCount: 4, recordedBranches: 1 },
    ] };
    const markup = renderToStaticMarkup(React.createElement(MonthSalesLedger, { sales, month: "2026-09" }));
    expect(markup).toContain("اليوميات المعتمدة أو المرحلة");
    expect(markup).toContain("تغطية جزئية");
    expect(markup).toContain("2026-09-01</th><td>غير متاح</td><td>غير متاح");
    expect(markup).toContain("2026-09-02</th><td>0 ر.س</td><td>1");
    expect(markup).not.toContain("1,000");
    expect(markup).toContain("ليس الصافي");
  });
});