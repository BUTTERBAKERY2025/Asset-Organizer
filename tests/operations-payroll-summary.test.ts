import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { computeSalaryClosing } from "../server/salary-closing-calc";
import {
  emptyPayrollFilters, filterOperationsPayroll, payrollNumber,
  type OperationsPayrollLine, type OperationsPayrollPayment, type OperationsPayrollReport,
} from "../client/src/lib/operations-payroll-report";
import {
  aggregateOperationsPayrollSummary, OperationsPayrollBranchSummary, OperationsPayrollFilteredSummary,
} from "../client/src/components/operations-hr/payroll-summary";

vi.stubGlobal("React", React);

function reportFixture(): OperationsPayrollReport {
  const branchId = "branch-summary";
  const month = "2025-09";
  const calculated = computeSalaryClosing({
    branchId, month,
    employees: [
      { id: 42, branchId, employeeName: "موظف الإنتاج", employeeNumber: "E-42", status: "active",
        jobTitle: "خباز", nationality: "سعودي", bankName: "بنك الاختبار", bankAccountNumber: "SA0042",
        salary: 6000.37, housingAllowance: 1500.01, transportAllowance: 700.02, socialInsuranceDeduction: 600.05 },
      { id: 99, branchId, employeeName: "موظف الإدارة", employeeNumber: "E-99", status: "inactive",
        jobTitle: "مشرف", nationality: "مصري", bankName: "", bankAccountNumber: "",
        salary: 4000.21, housingAllowance: 1000.02, transportAllowance: 300.04, socialInsuranceDeduction: 250.01 },
    ],
    attendance: [], schedules: [],
    signedTimesheets: [42, 99].map(branchEmployeeId => ({
      report: { id: branchEmployeeId, branchEmployeeId, branchId, status: "finalized" },
      entries: Array.from({ length: branchEmployeeId === 42 ? 29 : 30 }, (_, index) => ({
        date: `${month}-${String(index + 1).padStart(2, "0")}`,
        status: branchEmployeeId === 42 && index === 0 ? "absent" : "present",
        scheduledHours: 8, actualHours: 8,
      })),
    })),
    deductions: [
      { branchEmployeeId: 42, amount: 150.75, type: "advance" },
      { branchEmployeeId: 99, amount: 75.1, type: "advance" },
    ],
    leaveRequests: [{
      branchEmployeeId: 42, status: "approved", leaveType: "sick",
      startDate: `${month}-30`, endDate: `${month}-30`, sickTierBreakdown: { usedBefore: 30, year: 2025 },
    }],
  });
  return { ...calculated, isLocked: false, reviews: [] };
}

function payment(branchEmployeeId: number, amount: number | null): OperationsPayrollPayment {
  return { id: branchEmployeeId, branchEmployeeId, amount, branchId: "branch-summary", month: "2025-09",
    paymentMethod: "bank_transfer", paidAt: "2025-09-30T10:00:00.000Z", notes: null };
}

const branchMarkup = (report: OperationsPayrollReport, payments?: OperationsPayrollPayment[]) =>
  renderToStaticMarkup(React.createElement(OperationsPayrollBranchSummary, {
    report, branchName: "فرع الاختبار", month: "2025-09", payments,
  }));

const filteredMarkup = (lines: OperationsPayrollLine[], fullCount: number, payments?: OperationsPayrollPayment[]) =>
  renderToStaticMarkup(React.createElement(OperationsPayrollFilteredSummary, { lines, fullCount, payments }));

describe("operations payroll summary: authoritative totals and full/filtered scopes", () => {
  it("matches the HR server aggregation across every financial field without deriving net from gross", () => {
    const report = reportFixture();
    expect(report.lines).toHaveLength(2);
    expect(aggregateOperationsPayrollSummary(report.lines).totals).toEqual(report.totals);
    const expectedDeductions = Math.round((report.totals.totalAbsenceDeduction + report.totals.totalSickLeaveDeduction
      + report.totals.totalSocialInsurance + report.totals.totalManualDeductions) * 100) / 100;
    expect(aggregateOperationsPayrollSummary(report.lines).deductions).toBe(expectedDeductions);
    const saved = { ...report.lines[0], grossSalary: 5000, netSalary: 1234.56 };
    expect(aggregateOperationsPayrollSummary([saved]).totals.totalNet).toBe(1234.56);
  });

  it("preserves full server/snapshot totals even when line totals differ; filters cannot mutate the branch summary", () => {
    const report = reportFixture();
    const before = JSON.stringify(report);
    const filtered = filterOperationsPayroll(report.lines, { ...emptyPayrollFilters, search: " E-99 " });
    const full = aggregateOperationsPayrollSummary(report.lines, [], report.totals);
    const subset = aggregateOperationsPayrollSummary(filtered, []);
    expect(full.totals).toEqual(report.totals);
    expect(subset.totals).toMatchObject({
      employeeCount: 1, totalBase: filtered[0].baseSalary, totalAllowances: filtered[0].allowances,
      totalGross: filtered[0].grossSalary, totalNet: filtered[0].netSalary,
      totalAbsenceDeduction: filtered[0].absenceDeduction, totalSickLeaveDeduction: filtered[0].sickLeaveDeduction,
      totalSocialInsurance: filtered[0].socialInsurance, totalManualDeductions: filtered[0].manualDeductionsTotal,
    });
    expect(JSON.stringify(report)).toBe(before);
    const snapshot = { ...report, isLocked: true, totals: { ...report.totals, totalNet: 123456.78, totalGross: 234567.89 } };
    const html = branchMarkup(snapshot, []);
    expect(html).toContain("123,456.78");
    expect(html).toContain("234,567.89");
    expect(html).toContain("لقطة إغلاق محفوظة");
    expect(html).toContain("حالة الصرف من السجلات الحالية، وليست جزءًا من لقطة الإغلاق");
    expect(html).not.toContain("معاينة حية قابلة للتغير");
  });

  it.each([
    { search: "E-42" }, { status: "inactive" }, { jobTitle: "مشرف", nationality: "مصري", bank: "missing" },
    { payment: "paid" }, { payment: "unpaid" }, { paymentMethod: "bank_transfer" },
  ])("aggregates only the actual filtered rows for %j while keeping the full totals separate", change => {
    const report = reportFixture();
    const payments = [payment(42, 1000.11)];
    const lines = filterOperationsPayroll(report.lines, { ...emptyPayrollFilters, ...change }, payments);
    expect(lines).toHaveLength(1);
    const summary = aggregateOperationsPayrollSummary(lines, payments);
    expect(summary.totals.totalNet).toBe(lines[0].netSalary);
    expect(summary.totals.employeeCount).toBe(1);
    const html = filteredMarkup(lines, report.totals.employeeCount, payments);
    expect(html).toContain("ملخص الكشف المعروض بعد الفلاتر");
    expect(html).toContain(payrollNumber(lines[0].netSalary));
    expect(html).toContain(">1</bdi> من");
    expect(html).toContain(">2</bdi> موظف في كشف الفرع");
    expect(html).toContain("لا يغيّر ملخص الفرع الكامل أعلاه أو نطاق التصدير");
  });

  it("makes an empty filtered scope explicitly zero while leaving the full branch count/totals unchanged", () => {
    const report = reportFixture();
    const lines = filterOperationsPayroll(report.lines, { ...emptyPayrollFilters, search: "غير موجود" }, []);
    const subset = aggregateOperationsPayrollSummary(lines, []);
    expect(subset.totals).toEqual({
      employeeCount: 0, totalBase: 0, totalAllowances: 0, totalGross: 0, totalAbsenceDeduction: 0,
      totalSickLeaveDeduction: 0, totalSocialInsurance: 0, totalManualDeductions: 0, totalNet: 0,
    });
    expect(subset.settlement).toMatchObject({ paid: 0, remaining: 0, excess: 0, unknownCount: 0 });
    expect(aggregateOperationsPayrollSummary(report.lines, [], report.totals).totals.employeeCount).toBe(2);
    expect(filteredMarkup(lines, 2, [])).toContain(">0</bdi> من");
  });
});

describe("operations payroll summary: settlement amounts stay honest", () => {
  it("never turns unavailable queries, legacy amount-less markers, or unlinked snapshot identifiers into zero", () => {
    const report = reportFixture();
    expect(aggregateOperationsPayrollSummary(report.lines).settlement).toBeNull();
    const unavailable = branchMarkup(report);
    expect(unavailable).toContain("بيانات الصرف غير متاحة");
    expect(unavailable).toContain("غير متاح");
    const unlinked = { ...report.lines[1], id: 900, branchEmployeeId: null };
    const unknown = aggregateOperationsPayrollSummary([report.lines[0], unlinked], [payment(42, null), payment(900, 5000)]);
    expect(unknown.settlement).toEqual({ paid: null, remaining: null, excess: null, knownCount: 0, unknownCount: 2 });
    const html = branchMarkup({ ...report, lines: [report.lines[0], unlinked] }, [payment(42, null), payment(900, 5000)]);
    expect(html).toContain("غير معلوم");
    expect(html).toContain("مؤشر صرف دون مبلغ");
    expect(html).toContain("عدم وجود معرّف موظف مرتبط");
    expect(html).not.toContain('data-testid="payroll-settlement-excess"');
  });

  it("labels partial known sums and warning counts explicitly in both full and filtered summaries", () => {
    const report = reportFixture();
    const payments = [payment(42, null), payment(99, 1000.01)];
    const summary = aggregateOperationsPayrollSummary(report.lines, payments, report.totals);
    expect(summary.settlement).toMatchObject({ paid: 1000.01, knownCount: 1, unknownCount: 1 });
    for (const html of [branchMarkup(report, payments), filteredMarkup(report.lines, 2, payments)]) {
      expect(html).toContain("المصروف معلوم المبلغ");
      expect(html).toContain("المتبقي معلوم المبلغ");
      expect(html).toContain("1,000.01");
      expect(html).toContain("وليست إجمالي تسوية الكشف");
    }
  });

  it("sums remaining/excess per employee rather than netting one employee's overpayment against another", () => {
    const report = reportFixture();
    const payments = [payment(42, report.lines[0].netSalary + 250.13)];
    const summary = aggregateOperationsPayrollSummary(report.lines, payments);
    expect(summary.settlement).toMatchObject({ remaining: report.lines[1].netSalary, excess: 250.13, knownCount: 2, unknownCount: 0 });
    const html = branchMarkup(report, payments);
    expect(html).toContain('data-testid="payroll-settlement-excess"');
    expect(html).toContain("250.13");
    expect(html).toContain("لا تسوّي متبقي موظف آخر");
    expect(branchMarkup(report, [])).not.toContain('data-testid="payroll-settlement-excess"');
  });

  it("keeps missing snapshot financial fields unknown instead of silently defaulting to zero", () => {
    const line = { ...reportFixture().lines[0], sickLeaveDeduction: undefined } as unknown as OperationsPayrollLine;
    const summary = aggregateOperationsPayrollSummary([line], []);
    expect(summary.totals.totalSickLeaveDeduction).toBeNull();
    expect(summary.deductions).toBeNull();
    expect(filteredMarkup([line], 2, [])).toContain("غير مسجل");
  });
});

describe("operations payroll summary: readable scoped render", () => {
  it("renders financial cards, Latin-digit amounts, live state and operational-not-final advisory without a chart", () => {
    const report = reportFixture();
    const html = branchMarkup(report, []);
    for (const label of ["ملخص رواتب الفرع بالكامل", "لا يتأثر بفلاتر الكشف", "موظف في كشف الفرع", "فرع الاختبار",
      "صافي رواتب الفرع", "إجمالي الرواتب قبل الخصومات", "الراتب الأساسي", "إجمالي البدلات", "إجمالي الخصومات",
      "خصم الغياب", "خصم المرضية", "التأمينات (GOSI)", "سُلف / خصومات", "المصروف المسجل", "المتبقي للصرف",
      "معاينة حية قابلة للتغير", "ليس اعتمادًا نهائيًا من شؤون الموظفين", "دون إعادة احتساب الراتب في المتصفح"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<bdi dir="ltr"');
    expect(html).toContain("text-3xl");
    expect(html).toContain("sm:grid-cols-2 xl:grid-cols-4");
    expect(html).toContain("break-all tabular-nums");
    expect(html).toContain("from-violet-700");
    expect(html).not.toContain("min-w-max");
    expect(html).not.toContain("overflow-x");
    expect(html).not.toContain("<svg");
  });
});