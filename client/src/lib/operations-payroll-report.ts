import type { SalaryClosingLine, SalaryClosingTotals, SalaryClosingWarning } from "../../../server/salary-closing-calc";
import type { OperationsPayrollAttendanceDetail, OperationsPayrollPayments as PaymentsDto } from "@shared/operations-payroll-report";

/** Same server calculation / saved snapshot as HR. Snapshot-only missing fields stay missing. */
export type OperationsPayrollLine = Omit<SalaryClosingLine, "housingAllowance" | "iqamaNumber"> & {
  housingAllowance?: number | null;
  iqamaNumber?: string | null;
};

export type OperationsPayrollReport = {
  lines: OperationsPayrollLine[];
  totals: SalaryClosingTotals;
  isLocked: boolean;
  warnings: SalaryClosingWarning[];
  unlinkedSummary: { totalRecords: number; presentRecords: number; totalHours: number };
  enrichmentFailures?: { source: string; message: string }[];
  reviews: { id: number; reviewedBy: string; reviewedByName?: string; reviewedAt: string; note: string | null }[];
};

export type OperationsPayrollPayments = PaymentsDto;
export type OperationsPayrollPayment = PaymentsDto["payments"][number];
export type OperationsPayrollAttendance = OperationsPayrollAttendanceDetail;

export type OperationsReadState = "scope" | "loading" | "error" | "ready";
/** Never render previous-key placeholders, failed data, or unsettled background refreshes. */
export function operationsReadState(authorized: boolean, query: {
  isPending: boolean; isFetching: boolean; isError: boolean; isPlaceholderData: boolean; data: unknown; fetchStatus?: string;
}): OperationsReadState {
  if (!authorized) return "scope";
  if (query.isPending || query.isFetching || query.fetchStatus === "paused") return "loading";
  if (query.isError) return "error";
  if (query.isPlaceholderData || query.data === undefined) return "loading";
  return "ready";
}

export const payrollNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "غير مسجل";
export const payrollDateTime = (value: string) => new Date(value).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" });
export const payrollStatusLabels: Record<string, string> = {
  active: "نشط", inactive: "غير نشط", terminated: "منتهي الخدمة", on_leave: "في إجازة", unknown: "غير معروف",
};
export const payrollSourceLabels: Record<string, string> = {
  signed_timesheet: "تايم شيت موقّع", schedule_attendance: "جدول + بصمة", attendance_only: "بصمة فقط",
};

export type PayrollFilters = {
  search: string; status: string; source: string; jobTitle: string; nationality: string;
  payment: string; paymentMethod: string; bank: string;
};
export const emptyPayrollFilters: PayrollFilters = {
  search: "", status: "all", source: "all", jobTitle: "all", nationality: "all",
  payment: "all", paymentMethod: "all", bank: "all",
};

/** Only the real branch employee identifier joins evidence/payments; snapshot line.id is unrelated. */
export function payrollPaymentFor(line: OperationsPayrollLine, payments: OperationsPayrollPayment[]) {
  return line.branchEmployeeId == null ? undefined : payments.find(p => p.branchEmployeeId === line.branchEmployeeId);
}
export function payrollSettlement(line: OperationsPayrollLine, payments: OperationsPayrollPayment[]) {
  if (line.branchEmployeeId == null) return { payment: undefined, paid: null, remaining: null };
  const payment = payrollPaymentFor(line, payments);
  if (!payment) return { payment, paid: 0, remaining: line.netSalary };
  if (payment.amount === null || !Number.isFinite(payment.amount)) return { payment, paid: null, remaining: null };
  return { payment, paid: payment.amount, remaining: Math.max(0, Math.round((line.netSalary - payment.amount) * 100) / 100) };
}
export function filterOperationsPayroll(lines: OperationsPayrollLine[], filters: PayrollFilters, payments?: OperationsPayrollPayment[]) {
  const search = filters.search.trim().toLocaleLowerCase();
  return lines.filter(line => {
    if (search && ![line.employeeName, line.employeeNumber, line.jobTitle, line.department, line.nationality,
      line.iqamaNumber, line.bankName, line.bankAccountNumber].some(value => value?.toLocaleLowerCase().includes(search))) return false;
    if (filters.status !== "all" && line.employeeStatus !== filters.status) return false;
    if (filters.source !== "all" && line.dataSource !== filters.source) return false;
    if (filters.jobTitle !== "all" && line.jobTitle !== filters.jobTitle) return false;
    if (filters.nationality !== "all" && line.nationality !== filters.nationality) return false;
    if (filters.bank === "missing" && (line.bankName || line.bankAccountNumber)) return false;
    if (filters.bank === "available" && !line.bankName && !line.bankAccountNumber) return false;
    // A failed/not-yet-loaded payment query must not turn everyone into "unpaid".
    if (!payments && (filters.payment !== "all" || filters.paymentMethod !== "all")) return false;
    const payment = payments ? payrollPaymentFor(line, payments) : undefined;
    if (filters.payment === "paid" && !payment) return false;
    if (filters.payment === "unpaid" && payment) return false;
    return filters.paymentMethod === "all" || payment?.paymentMethod === filters.paymentMethod;
  });
}

export function operationsQueryError(error: unknown): string {
  if (!(error instanceof Error)) return "";
  const detail = error.message.replace(/^\d{3}:\s*/, "");
  try {
    const payload = JSON.parse(detail);
    return typeof payload.error === "string" ? payload.error : detail;
  } catch { return detail; }
}