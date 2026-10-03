import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeSalaryClosing } from "../server/salary-closing-calc";
import {
  emptyPayrollFilters, filterOperationsPayroll, operationsReadState, payrollNumber, payrollPaymentFor,
  payrollSettlement, type OperationsPayrollAttendance, type OperationsPayrollLine, type OperationsPayrollPayment, type OperationsPayrollReport,
} from "../client/src/lib/operations-payroll-report";
import { OperationsPayrollReportTable } from "../client/src/components/operations-hr/payroll-report";
import { OperationsPayrollEvidenceTables } from "../client/src/components/operations-hr/payroll-attendance";
import { OperationsQueryFeedback } from "../client/src/components/operations-hr/query-feedback";

// The server-focused test config uses classic JSX for imported UI modules.
vi.stubGlobal("React", React);
const clients: QueryClient[] = [];
afterEach(() => { clients.splice(0).forEach(client => client.clear()); });
const client = () => {
  const instance = new QueryClient({ defaultOptions: { queries: { retry: false, placeholderData: previous => previous } } });
  clients.push(instance);
  return instance;
};
function reportFixture(): OperationsPayrollReport {
  const calculated = computeSalaryClosing({
    branchId: "branch-a", month: "2026-09",
    employees: [{
      id: 42, branchId: "branch-a", employeeNumber: "E-42", employeeName: "موظف الاختبار",
      status: "active", jobTitle: "خباز", department: "الإنتاج", nationality: "سعودي",
      iqamaNumber: "1234567890", bankName: "بنك الاختبار", bankAccountNumber: "SA001234",
      salary: 6000, housingAllowance: 1500, transportAllowance: 700, socialInsuranceDeduction: 600,
    }],
    attendance: [], schedules: [], signedTimesheets: [], deductions: [],
  });
  return { ...calculated, isLocked: false, reviews: [], enrichmentFailures: [] };
}
const payment = (amount: number | null, branchEmployeeId = 42): OperationsPayrollPayment => ({
  id: 1, branchEmployeeId, branchId: "branch-a", month: "2026-09",
  amount, paymentMethod: "bank_transfer", paidAt: "2026-09-30T10:00:00.000Z", notes: null,
});
const markup = (report: OperationsPayrollReport, payments?: OperationsPayrollPayment[]) =>
  renderToStaticMarkup(React.createElement(QueryClientProvider, { client: client() },
    React.createElement(OperationsPayrollReportTable, { report, branchId: "branch-a", branchName: "فرع الاختبار", month: "2026-09", payments })));

describe("operations full HR payroll report: authoritative values and read-only details", () => {
  it("renders actual HR salary, attendance, metadata and settlement columns, not a three-column replacement", () => {
    const report = reportFixture();
    // A saved server value is displayed as-is, never recomputed by the report UI.
    report.lines[0].netSalary = 7654.32;
    const html = markup(report, [payment(1000)]);
    for (const column of ["رقم الموظف", "حالة الموظف", "الوظيفة", "الإدارة", "الجنسية", "البنك / الآيبان", "أيام العمل",
      "الحضور", "الغياب", "الراحات الأسبوعية", "الإجازات", "إجازات مدفوعة", "إجازات بدون راتب", "أيام مخصومة", "أيام التأخير",
      "ساعات الجدول", "الساعات الفعلية", "الراتب الأساسي", "بدل السكن", "البدلات", "إجمالي الراتب", "قيمة اليوم",
      "خصم الغياب", "خصم المرضية", "التأمينات (GOSI)", "سُلف / خصومات", "الصافي", "حالة الدفع", "المصروف المسجل", "المتبقي"]) {
      expect(html).toContain(column);
    }
    expect(html).toContain("7,654.32");
    expect(html).toContain("6,654.32");
    expect(html).toContain("SA001234");
    expect(html).toContain("تفاصيل الحضور والانصراف موظف الاختبار");
    expect(html).toContain("أيام الغياب · موظف الاختبار");
    expect(html).toContain("السُلف والخصومات · موظف الاختبار");
    expect(html).toContain("overflow-auto");
    expect(html).toContain("sticky top-0");
    expect(html).not.toContain("تعديل الراتب");
  });
  it("distinguishes a legitimate empty report from failed/unavailable payment data", () => {
    const report = reportFixture();
    expect(markup({ ...report, lines: [] })).toContain("لا يوجد موظفون في تقرير الرواتب لهذا الفرع والشهر");
    const html = markup(report);
    expect(html).toContain("حالة الدفع غير متاحة");
    expect(html).not.toContain("لا يوجد مؤشر صرف</");
    expect(html).not.toContain("المصروف ذو المبلغ المسجل:");
  });
  it("preserves null snapshot fields and null legacy payment amounts instead of inventing zeros/full settlement", () => {
    const report = reportFixture();
    report.isLocked = true;
    delete report.lines[0].housingAllowance;
    delete report.lines[0].iqamaNumber;
    const html = markup(report, [payment(null)]);
    expect(html).toContain("لقطة إغلاق محفوظة");
    expect(html).toContain("غير مسجل");
    expect(html).toContain("مؤشر صرف");
    expect(html).toContain("المبلغ غير مسجل");
    expect(html).toContain("غير معلوم");
    expect(payrollNumber(undefined)).toBe("غير مسجل");
    expect(payrollNumber(null)).toBe("غير مسجل");
    expect(payrollNumber(0)).toBe("0");
  });
  it("uses branchEmployeeId only, never closure line.id, for payment/evidence identity", () => {
    const line = { ...reportFixture().lines[0], id: 900, branchEmployeeId: 42, netSalary: 3000 };
    expect(payrollPaymentFor(line, [payment(3000, 900)])).toBeUndefined();
    expect(payrollSettlement(line, [payment(null)])).toMatchObject({ paid: null, remaining: null });
    expect(payrollSettlement(line, [payment(1000)])).toMatchObject({ paid: 1000, remaining: 2000 });
    expect(payrollSettlement(line, [])).toMatchObject({ paid: 0, remaining: 3000 });
    expect(payrollSettlement({ ...line, branchEmployeeId: null }, [payment(3000, 900)])).toMatchObject({ paid: null, remaining: null });
  });
  it("renders attendance check-in/out, schedule and signed evidence, preserving missing times/hours", () => {
    const data: OperationsPayrollAttendance = {
      branchId: "branch-a", month: "2026-09", branchEmployeeId: 42, employeeName: "موظف الاختبار",
      isLocked: true, evidenceSource: "live_records",
      attendance: [{
        id: 5, attendanceDate: "2026-09-01", checkInTime: "08:14", checkOutTime: null, workingHours: null,
        status: "late", isLate: true, lateMinutes: 14, earlyLeaveMinutes: null, overtimeMinutes: null,
        scheduledStartTime: "08:00", scheduledEndTime: "16:00", notes: "خروج غير مسجل",
      }],
      schedules: [{
        id: 6, scheduleDate: "2026-09-01", startTime: "08:00", endTime: "16:00", breakDuration: 30,
        isOff: false, shiftType: "صباحي", status: "published", notes: null,
      }],
      signedTimesheets: [{
        id: 7, status: "finalized", entries: [{
          date: "2026-09-01", status: "present", isOff: false, scheduledHours: 7.5, actualHours: 7.25,
          checkInTime: "08:15", checkOutTime: "16:00", notes: "الجدول المعتمد",
        }],
      }],
    };
    const html = renderToStaticMarkup(React.createElement(OperationsPayrollEvidenceTables, { data }));
    for (const value of ["سجلات البصمة", "جدول العمل", "التايم شيت الموقّع", "08:14", "16:00", "7.25", "خروج غير مسجل", "الجدول المعتمد", "غير مسجل"])
      expect(html).toContain(value);
    expect(html).not.toContain("تعديل");
    const empty = renderToStaticMarkup(React.createElement(OperationsPayrollEvidenceTables, { data: { ...data, attendance: [], schedules: [], signedTimesheets: [] } }));
    expect(empty).toContain("لا توجد سجلات بصمة لهذا الموظف في الفرع والشهر المحددين");
    expect(empty).toContain("لا يوجد جدول عمل مسجل");
    expect(empty).toContain("لا يوجد تايم شيت موقّع");
  });
  it("filters actual employee metadata/source/status/bank and payment markers without treating an unavailable query as unpaid", () => {
    const first = reportFixture().lines[0];
    const second: OperationsPayrollLine = { ...first, id: 99, branchEmployeeId: 99, employeeName: "موظف آخر",
      employeeNumber: "E-99", employeeStatus: "inactive", jobTitle: "مشرف", nationality: "مصري",
      dataSource: "signed_timesheet", bankName: "", bankAccountNumber: "" };
    const lines = [first, second];
    const filter = (change: Partial<typeof emptyPayrollFilters>, payments?: OperationsPayrollPayment[]) =>
      filterOperationsPayroll(lines, { ...emptyPayrollFilters, ...change }, payments).map(line => line.branchEmployeeId);
    expect(filter({ search: "SA001234" })).toEqual([42]);
    expect(filter({ search: " E-99 " })).toEqual([99]);
    expect(filter({ source: "signed_timesheet", status: "inactive", jobTitle: "مشرف", nationality: "مصري", bank: "missing" })).toEqual([99]);
    expect(filter({ payment: "unpaid" })).toEqual([]);
    expect(filter({ payment: "paid" }, [payment(null)])).toEqual([42]);
    expect(filter({ payment: "unpaid" }, [payment(null)])).toEqual([99]);
    expect(filter({ paymentMethod: "bank_transfer" }, [payment(null)])).toEqual([42]);
  });
});

describe("current-scope settled rendering and explicit loading/error states", () => {
  const ready = { data: [], isPending: false, isFetching: false, isError: false, isPlaceholderData: false, fetchStatus: "idle" };
  it("hides prior data while loading, refetching, paused, denied or placeholder; empty is only ready on successful settlement", () => {
    expect(operationsReadState(true, ready)).toBe("ready");
    expect(operationsReadState(false, ready)).toBe("scope");
    for (const patch of [{ isPending: true }, { isFetching: true }, { isPlaceholderData: true }, { fetchStatus: "paused" }, { data: undefined }])
      expect(operationsReadState(true, { ...ready, ...patch })).toBe("loading");
    expect(operationsReadState(true, { ...ready, isError: true, data: [reportFixture()] })).toBe("error");
    expect(operationsReadState(true, { ...ready, isError: true, isFetching: true })).toBe("loading");
  });
  it.each(["/api/operations-hr/employees", "/api/operations-hr/payroll", "/api/operations-hr/payroll/payments"])("overrides the global previous-key placeholder for %s during branch/month navigation", async endpoint => {
    const instance = client();
    const observer = new QueryObserver(instance, {
      queryKey: [endpoint, "branch-a", "2026-09"], queryFn: async () => ["branch-a"],
      placeholderData: undefined, staleTime: 0, gcTime: 0,
    });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    expect(observer.getCurrentResult().data).toEqual(["branch-a"]);
    let finish!: (value: string[]) => void;
    observer.setOptions({
      queryKey: [endpoint, "branch-b", "2026-08"], queryFn: () => new Promise<string[]>(resolve => { finish = resolve; }),
      placeholderData: undefined, staleTime: 0, gcTime: 0,
    });
    const transitioning = observer.getCurrentResult();
    expect(transitioning.data).toBeUndefined();
    expect(transitioning.isPlaceholderData).toBe(false);
    expect(operationsReadState(true, transitioning)).toBe("loading");
    const fetched = observer.refetch();
    finish(["branch-b"]);
    await fetched;
    expect(observer.getCurrentResult().data).toEqual(["branch-b"]);
    observer.setOptions({
      queryKey: [endpoint, "branch-c", "2026-07"], queryFn: async () => { throw new Error("503: source unavailable"); },
      placeholderData: undefined, retry: false,
    });
    await observer.refetch();
    expect(operationsReadState(true, observer.getCurrentResult())).toBe("error");
    expect(observer.getCurrentResult().data).toBeUndefined();
    unsubscribe(); observer.destroy();
  });
  it("renders sanitized API source errors and an actual retry button, never empty/zero salaries", () => {
    const html = renderToStaticMarkup(React.createElement(OperationsQueryFeedback, {
      state: "error", loading: "جار التحميل", failure: "تعذر تحميل تقرير الرواتب.",
      error: new Error('503: {"error":"مصدر الحضور غير متاح","code":"PAYROLL_SOURCE_UNAVAILABLE"}'), onRetry: vi.fn(),
    }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("مصدر الحضور غير متاح");
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("PAYROLL_SOURCE_UNAVAILABLE");
    const loading = renderToStaticMarkup(React.createElement(OperationsQueryFeedback, { state: "loading", loading: "جار التحميل", failure: "خطأ", onRetry: vi.fn() }));
    expect(loading).toContain('role="status"');
    expect(loading).not.toContain("خطأ");
  });
  it("wires every real query to explicit no-placeholder/retry/fresh-mount options and only operations-scoped detail endpoints", () => {
    const page = readFileSync("client/src/pages/operations-hr.tsx", "utf8");
    const evidence = readFileSync("client/src/components/operations-hr/payroll-attendance.tsx", "utf8");
    const employees = readFileSync("client/src/components/operations-hr/employees-workspace.tsx", "utf8");
    const joining = readFileSync("client/src/components/operations-hr/joining-workspace.tsx", "utf8");
    const transfers = readFileSync("client/src/components/operations-hr/transfer-history.tsx", "utf8");
    const querySources = [page, evidence, employees, joining, transfers];
    for (const text of querySources) {
      const parsed = ts.createSourceFile("ui.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const queries: ts.CallExpression[] = [];
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && ["useQuery", "useInfiniteQuery"].includes(node.expression.getText(parsed))) queries.push(node);
        ts.forEachChild(node, visit);
      }
      visit(parsed);
      expect(queries.length).toBeGreaterThan(0);
      for (const query of queries) {
        const config = query.arguments[0].getText(parsed);
        expect(config).toContain("placeholderData: undefined");
        expect(config).toContain("retry: shouldRetryQuery");
        expect(config).toContain('refetchOnMount: "always"');
      }
    }
    expect(page).toContain('queryKey: ["/api/operations-hr/payroll", branch?.id, month]');
    expect(page).toContain("reportReady && branch && payroll.data");
    expect(page).toContain('key={`${branch.id}:${month}`}');
    expect(page).toContain('authorizedBranch && branch && activeTab === "employees"');
    expect(employees).toContain("enabled: employeesNeeded");
    expect(employees).toContain('employeesState === "ready" && employees.data');
    expect(joining).toContain('const authorizedRows = state === "ready"');
    expect(joining).toContain('const rows = focus.requested ? focus.row ? [focus.row] : [] : authorizedRows');
    expect(joining).toContain('queryKey: ["/api/operations-hr/joining", branch.id]');
    expect(joining).toContain("new URLSearchParams({ branchId: branch.id })");
    expect(transfers).toContain('const rows = state === "ready"');
    expect(transfers).toContain('queryKey: ["/api/operations-hr/transfers", branch.id, scope]');
    expect(transfers).toContain('new URLSearchParams({ branchId: branch.id, limit: "50" })');
    expect(evidence).toContain('queryKey: ["/api/operations-hr/payroll/attendance", branchId, month, branchEmployeeId]');
    expect(evidence).toContain("enabled: open");
    for (const path of ["/api/salary-closing", "/api/salary-payments", "/api/attendance-records"])
      expect(querySources.join("\n")).not.toContain(path);
    expect(evidence).toContain("ليست لقطة تاريخية مجمّدة");
    expect(evidence).not.toContain("useMutation");
    const table = readFileSync("client/src/components/operations-hr/payroll-report.tsx", "utf8");
    expect(table).not.toContain("useMutation");
    expect(table).not.toContain("PaymentStatusPopover");
    expect(table).not.toContain("AttendanceAdjustmentPopover");
    expect(table).not.toContain("line.branchEmployeeId ?? line.id");
  });
});