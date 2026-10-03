import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { branchEmployees, employeeTransferRequests } from "@shared/schema";
import { resolvePayrollMembership } from "./payroll-historical-membership";
import type { SalaryClosingWarning } from "./salary-closing-calc";

/** All cross-branch reads are internal identity/history resolution. Only employees
 * proven to belong to the requested month/branch are returned to the calculator. */
export async function loadHistoricalPayrollEmployees(branchId: string, month: string, evidence: any[]) {
  const ids = new Set<number>();
  const linkedIds = new Set<string>();
  const employeeNumbers = new Set<string>();
  const employeeNames = new Set<string>();
  for (const row of evidence) {
    const identity = row.report ?? row;
    const canonical = Number(row.branchEmployeeId ?? row.report?.branchEmployeeId);
    if (Number.isSafeInteger(canonical) && canonical > 0) {
      ids.add(canonical);
      continue;
    }
    const legacy = String(row.employeeId ?? row.report?.employeeId ?? "");
    const match = /^branch_emp_(\d+)$/.exec(legacy);
    if (match) ids.add(Number(match[1]));
    else if (legacy) linkedIds.add(legacy);
    else if (identity.employeeNumber) employeeNumbers.add(String(identity.employeeNumber).trim());
    else if (identity.employeeName) employeeNames.add(String(identity.employeeName).trim());
  }
  const candidates = await db.select().from(branchEmployees).where(or(
    eq(branchEmployees.branchId, branchId),
    sql`${branchEmployees.id} IN (SELECT employee_id FROM employee_transfer_requests
      WHERE status = 'completed' AND (source_branch_id = ${branchId} OR destination_branch_id = ${branchId}))`,
    ids.size ? inArray(branchEmployees.id, [...ids]) : undefined,
    linkedIds.size ? inArray(branchEmployees.linkedUserId, [...linkedIds]) : undefined,
    employeeNumbers.size ? inArray(branchEmployees.employeeNumber, [...employeeNumbers]) : undefined,
    employeeNames.size ? inArray(branchEmployees.employeeName, [...employeeNames]) : undefined,
  ));
  const histories = candidates.length ? await db.select().from(employeeTransferRequests).where(and(
    inArray(employeeTransferRequests.employeeId, candidates.map(e => e.id)),
    eq(employeeTransferRequests.status, "completed"),
  )) : [];
  const employees: typeof candidates = [];
  const warnings: SalaryClosingWarning[] = [];
  for (const employee of candidates) {
    const history = histories.filter(t => t.employeeId === employee.id);
    const ownership = resolvePayrollMembership(employee.branchId, history, month);
    const hasEvidence = ids.has(employee.id) || (!!employee.linkedUserId && linkedIds.has(employee.linkedUserId)) ||
      (!!employee.employeeNumber && employeeNumbers.has(employee.employeeNumber.trim())) ||
      employeeNames.has(employee.employeeName.trim());
    const relevant = employee.branchId === branchId || hasEvidence || history.some(t =>
      (t.sourceBranchId === branchId || t.destinationBranchId === branchId) &&
      t.effectiveDate >= `${month}-01`);
    if ((!ownership.branchId && relevant) || (hasEvidence && ownership.branchId !== branchId)) {
      // Do not expose another branch's current personal/payroll data on ambiguity.
      warnings.push({
        branchEmployeeId: null, employeeName: "حالة تبعية تحتاج مراجعة",
        code: "historical_membership",
        message: `مرجع مراجعة الموظف #${employee.id}: ${ownership.reason ?? "توجد سجلات عمل لا تتطابق مع تبعية الفرع في الشهر؛ راجع سجل النقل قبل اعتماد الرواتب."}`,
      });
    } else if (ownership.branchId === branchId) {
      employees.push({ ...employee, branchId });
    }
  }
  for (const id of ids) {
    if (!candidates.some(e => e.id === id)) warnings.push({
      branchEmployeeId: null, employeeName: "سجل موظف غير متاح", code: "historical_membership",
      message: `مرجع مراجعة الموظف #${id}: توجد سجلات عمل لموظف غير متاح؛ يلزم مراجعة هويته وتبعيته قبل اعتماد الرواتب.`,
    });
  }
  return { employees, warnings };
}