import type { SalaryClosingLine, SalaryClosingTotals, SalaryClosingWarning } from "../server/salary-closing-calc";
import type { OperationsPayrollPayments, OperationsPayrollEnrichmentFailure } from "./operations-payroll-report";

export const OPERATIONS_PAYROLL_REVIEW_NOTICE = "نسخة مراجعة إدارة التشغيل فقط — ليست اعتماداً نهائياً من شؤون الموظفين ولا اعتماداً مالياً، ولا تعطل إغلاق الرواتب أو صرفها.";
export const OPERATIONS_PAYROLL_WATERMARK = "إدارة التشغيل — للمراجعة فقط";
export type OperationsPayrollExportFormat = "pdf" | "xlsx" | "csv";
export type OperationsPayrollExportLine = Omit<SalaryClosingLine, "housingAllowance" | "iqamaNumber"> & {
  housingAllowance?: number | null; iqamaNumber?: string | null;
};
export interface OperationsPayrollExport {
  version: 1;
  branchId: string;
  branchName: string;
  month: string;
  scope: "entire_branch_month";
  generatedAt: string;
  source: "live_calculation" | "closed_snapshot";
  snapshotClosedAt: string | null;
  paymentSource: "recorded_payments";
  disclaimer: string;
  lines: OperationsPayrollExportLine[];
  totals: SalaryClosingTotals;
  payments: OperationsPayrollPayments["payments"];
  settlements: Array<{ branchEmployeeId: number | null; paid: number | null; outstanding: number | null }>;
  paymentTotals: { paid: number | null; outstanding: number | null; recordedPaid: number | null; unmatchedPaymentCount: number; unknownSettlementCount: number };
  warnings: SalaryClosingWarning[];
  enrichmentFailures: OperationsPayrollEnrichmentFailure[];
  unlinkedSummary: { totalRecords: number; presentRecords: number; totalHours: number };
}

/** Logical RTL order, shared by CSV, XLSX and PDF. Never omit zero or missing snapshot fields. */
export const operationsPayrollExportColumns: Array<[keyof SalaryClosingLine, string]> = [
  ["branchEmployeeId", "معرف الموظف"], ["employeeNumber", "الرقم الوظيفي"], ["employeeName", "الموظف"],
  ["employeeStatus", "حالة الموظف"], ["jobTitle", "الوظيفة"], ["department", "الإدارة"],
  ["nationality", "الجنسية"], ["iqamaNumber", "الإقامة"], ["bankName", "البنك"], ["bankAccountNumber", "الحساب البنكي"],
  ["presentDays", "أيام الحضور"], ["originalPresentDays", "الحضور قبل التعديل"],
  ["attendanceAdjustmentReason", "سبب تعديل الحضور"], ["attendanceAdjustmentBy", "معدل الحضور"],
  ["absentDays", "أيام الغياب"], ["offDays", "أيام الراحة"], ["paidLeaveDays", "الإجازة المدفوعة"],
  ["unpaidLeaveDays", "الإجازة بدون أجر"], ["unpaidDays", "الأيام غير المدفوعة"],
  ["sickThreeQuarterDays", "أيام المرضية 75%"], ["sickUnpaidDays", "أيام المرضية بدون أجر"],
  ["scheduledWorkDays", "أيام العمل المجدولة"], ["scheduledHours", "الساعات المجدولة"],
  ["lateDays", "أيام التأخير"], ["totalHours", "ساعات العمل"],
  ["baseSalary", "الأساسي"], ["housingAllowance", "بدل السكن"], ["allowances", "إجمالي البدلات"], ["dailyRate", "قيمة اليوم"],
  ["absenceDeduction", "خصم الأيام غير المدفوعة"], ["sickLeaveDeduction", "خصم المرضية"],
  ["socialInsurance", "التأمينات"], ["manualDeductionsTotal", "إجمالي السلف والخصومات"],
  ["manualDeductions", "تفاصيل السلف والخصومات"], ["leaveBreakdown", "تفاصيل الإجازات"],
  ["presentDates", "تواريخ الحضور"], ["absentDates", "تواريخ الغياب"],
  ["absentDatesExplicit", "تواريخ الغياب الصريح"], ["absentDatesMissing", "تواريخ الأيام غير المسجلة"],
  ["offDates", "تواريخ الراحة"], ["dataSource", "مصدر الاحتساب"], ["noWorkAtAll", "بدون بيانات عمل"],
  ["grossSalary", "الإجمالي"], ["netSalary", "الصافي"],
];

export const operationsPayrollTotalColumns: Array<[keyof SalaryClosingTotals, string]> = [
  ["employeeCount", "عدد الموظفين"], ["totalBase", "إجمالي الأساسي"], ["totalAllowances", "إجمالي البدلات"],
  ["totalGross", "الإجمالي"], ["totalAbsenceDeduction", "خصم الأيام غير المدفوعة"], ["totalSickLeaveDeduction", "خصم المرضية"],
  ["totalSocialInsurance", "التأمينات"], ["totalManualDeductions", "السلف والخصومات"], ["totalNet", "الصافي"],
];
export const exportSourceLabel = (data: OperationsPayrollExport) =>
  data.source === "closed_snapshot" ? "لقطة إغلاق محفوظة — لا تجعل هذه النسخة اعتماداً نهائياً" : "احتساب حي على الخادم — قابل للتغير";
export const exportValue = (value: unknown): string | number =>
  value == null ? "غير مسجل" : Array.isArray(value) || typeof value === "object" ? JSON.stringify(value)
    : typeof value === "boolean" ? value ? "نعم" : "لا" : typeof value === "number" ? value : String(value);

export function operationsPayrollExportSummary(data: OperationsPayrollExport): Array<[string, string | number]> {
  return [
    ["تنبيه", data.disclaimer], ["نطاق التصدير", "كامل الفرع والشهر — لا يتأثر بفلاتر الجدول أو صفحته"],
    ["الفرع", data.branchName], ["معرف الفرع", data.branchId], ["الشهر", data.month],
    ["المصدر", exportSourceLabel(data)], ["تاريخ إنشاء النسخة (UTC)", data.generatedAt],
    ["تاريخ إنشاء النسخة (الرياض)", new Date(data.generatedAt).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" })],
    ["تاريخ إغلاق المصدر", exportValue(data.snapshotClosedAt)],
    ...operationsPayrollTotalColumns.map(([key, title]): [string, string | number] => [title, exportValue(data.totals[key])]),
    ["عدد سطور التقرير الكامل", data.lines.length], ["مصدر الصرف", "سجلات الصرف الحالية للفرع والشهر — ليست جزءاً من لقطة الإغلاق"],
    ["المصروف لموظفي التقرير", exportValue(data.paymentTotals.paid)], ["المتبقي لموظفي التقرير", exportValue(data.paymentTotals.outstanding)],
    ["إجمالي الصرف المسجل للفرع والشهر", exportValue(data.paymentTotals.recordedPaid)],
    ["سجلات صرف غير مرتبطة بسطور التقرير", data.paymentTotals.unmatchedPaymentCount],
    ["سطور لا يمكن تحديد تسويتها", data.paymentTotals.unknownSettlementCount],
    ["سجلات حضور غير مرتبطة", exportValue(data.unlinkedSummary)],
    ["تحذيرات التقرير", exportValue(data.warnings)], ["تعذر إثراء بيانات حالية", exportValue(data.enrichmentFailures)],
  ];
}

export function operationsPayrollExportRows(data: OperationsPayrollExport) {
  return data.lines.map((line, index) => {
    const settlement = data.settlements[index];
    const payment = data.payments.find(p => p.branchEmployeeId === line.branchEmployeeId);
    return [...operationsPayrollExportColumns.map(([key]) => exportValue(line[key])),
      exportValue(settlement?.paid), exportValue(settlement?.outstanding),
      exportValue(payment?.paymentMethod), exportValue(payment?.paidAt), exportValue(payment?.notes)];
  });
}
export const operationsPayrollExportHeaders = () =>
  [...operationsPayrollExportColumns.map(([, title]) => title), "المصروف", "المتبقي", "طريقة الصرف", "تاريخ الصرف", "ملاحظات الصرف"];

/** Quoting alone does not prevent Excel formula evaluation. Preserve negative numeric amounts. */
export function operationsPayrollCsvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = !/^-?\d+(?:\.\d+)?$/.test(text) && /^[\s]*[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function operationsPayrollFullCsv(data: OperationsPayrollExport) {
  const rows = [
    ...operationsPayrollExportSummary(data), [],
    operationsPayrollExportHeaders(), ...operationsPayrollExportRows(data), [],
    ["سجلات الصرف الحالية — كامل الفرع والشهر"],
    ["معرف السجل", "معرف الموظف", "المبلغ", "طريقة الصرف", "تاريخ الصرف", "ملاحظات"],
    ...data.payments.map(p => [p.id, p.branchEmployeeId, exportValue(p.amount), p.paymentMethod, p.paidAt, exportValue(p.notes)]),
  ];
  return "\uFEFF" + rows.map(row => row.map(operationsPayrollCsvCell).join(",")).join("\r\n");
}