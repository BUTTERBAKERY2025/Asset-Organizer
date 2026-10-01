import type { OperationsPayrollAttendanceDetail } from "@shared/operations-payroll-report";

export class PayrollSourceError extends Error {
  constructor(public readonly source: string, public readonly originalError: unknown) {
    super(`Payroll source unavailable: ${source}`);
    this.name = "PayrollSourceError";
  }
}

/** A required payroll input must fail explicitly, never become an empty dataset. */
export async function readPayrollSource<T>(source: string, read: () => PromiseLike<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    throw new PayrollSourceError(source, error);
  }
}

export function payrollReadError(error: unknown, message: string) {
  return error instanceof PayrollSourceError
    ? { error: message, code: "PAYROLL_SOURCE_UNAVAILABLE", source: error.source }
    : { error: message };
}

const normalizeName = (value: unknown) => String(value ?? "")
  .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
  .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
  .replace(/\u0629/g, "\u0647").replace(/\u0649/g, "\u064A")
  .replace(/\u0624/g, "\u0648").replace(/\u0626/g, "\u064A")
  .replace(/\s+/g, "").toLowerCase();

/**
 * Match all known identities, and uniquely imported names/numbers. Explicit
 * foreign employee identifiers never fall through to a coincidentally equal name.
 * The caller supplies branch-scoped candidates including historical snapshot ids.
 */
export function payrollEvidenceMatcher(employee: any, candidates: any[]) {
  const id = Number(employee.id);
  const ids = new Set([String(id), `branch_emp_${id}`, employee.linkedUserId].filter(Boolean));
  const unique = (field: string, value: unknown, normalize: (v: unknown) => string) => {
    const key = normalize(value);
    return !!key && new Set(candidates.filter(e => normalize(e[field]) === key).map(e => Number(e.id))).size === 1;
  };
  const trim = (v: unknown) => String(v ?? "").trim();
  return (row: any): boolean => {
    if (row.branchEmployeeId != null) return Number(row.branchEmployeeId) === id;
    if (row.employeeId && ids.has(String(row.employeeId))) return true;
    if (/^branch_emp_\d+$/.test(String(row.employeeId ?? ""))) return false;
    if (/^\d+$/.test(String(row.employeeId ?? ""))
      || /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(String(row.employeeId ?? ""))) return false;
    if (candidates.some(e => e.linkedUserId && e.linkedUserId === row.employeeId && Number(e.id) !== id)) return false;
    if (row.employeeNumber && trim(row.employeeNumber) === trim(employee.employeeNumber)
      && unique("employeeNumber", employee.employeeNumber, trim)) return true;
    return normalizeName(row.employeeName) === normalizeName(employee.employeeName)
      && unique("employeeName", employee.employeeName, normalizeName);
  };
}

export function payrollAttendanceEvidence(input: {
  branchId: string; month: string; employee: any; candidates: any[]; isLocked: boolean;
  attendance: any[]; schedules: any[]; signedTimesheets: Array<{ report: any; entries: any[] }>;
}): OperationsPayrollAttendanceDetail {
  const { branchId, month, employee, isLocked } = input;
  const matches = payrollEvidenceMatcher(employee, input.candidates);
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
  const inMonth = (date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && date >= monthStart && date <= monthEnd;
  // Filter scope BEFORE choosing the newest record of each date.
  const byDate = new Map<string, any>();
  for (const row of input.attendance) {
    if (row.branchId !== branchId || !inMonth(row.attendanceDate) || !matches(row)) continue;
    const prior = byDate.get(row.attendanceDate);
    if (!prior || Number(row.id) > Number(prior.id)) byDate.set(row.attendanceDate, row);
  }
  return {
    branchId, month, branchEmployeeId: Number(employee.id), employeeName: employee.employeeName, isLocked,
    evidenceSource: "live_records",
    attendance: Array.from(byDate.values()).sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate)).map(row => ({
      id: row.id, attendanceDate: row.attendanceDate, checkInTime: row.actualCheckIn ?? null,
      checkOutTime: row.actualCheckOut ?? null, workingHours: row.workingHours ?? null,
      status: row.status, isLate: row.status === "late" || Number(row.lateMinutes) > 0,
      lateMinutes: row.lateMinutes ?? null, earlyLeaveMinutes: row.earlyLeaveMinutes ?? null,
      overtimeMinutes: row.overtimeMinutes ?? null, scheduledStartTime: row.scheduledStartTime ?? null,
      scheduledEndTime: row.scheduledEndTime ?? null, notes: row.notes ?? null,
    })),
    schedules: input.schedules.filter(row => row.branchId === branchId && inMonth(row.scheduleDate) && matches(row))
      .sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate) || a.id - b.id).map(row => ({
        id: row.id, scheduleDate: row.scheduleDate, startTime: row.startTime ?? null,
        endTime: row.endTime ?? null, breakDuration: row.breakDuration ?? null, isOff: row.isOff === true,
        shiftType: row.shiftType ?? null, status: row.status, notes: row.notes ?? null,
      })),
    signedTimesheets: input.signedTimesheets.filter(({ report }) =>
      report?.branchId === branchId && report.status === "finalized" && matches(report)).map(({ report, entries }) => ({
        id: report.id, status: report.status,
        entries: entries.filter(row => inMonth(row.date)).map(row => ({
          date: row.date, status: row.status, isOff: row.isOff === true,
          scheduledHours: row.scheduledHours ?? null, actualHours: row.actualHours ?? null,
          checkInTime: row.actualStartTime ?? null, checkOutTime: row.actualEndTime ?? null, notes: row.notes ?? null,
        })),
      })),
  };
}