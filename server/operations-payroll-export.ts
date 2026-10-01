import {
  OPERATIONS_PAYROLL_REVIEW_NOTICE, type OperationsPayrollExport,
} from "@shared/operations-payroll-export";

/** Decimal addition/subtraction avoids binary floating-point drift; does not recalculate salaries. */
function decimalSum(values: number[]): number {
  const parts = values.map(value => {
    const [coefficient, exponent = "0"] = String(value).split("e");
    const [whole, fraction = ""] = coefficient.split(".");
    return { digits: BigInt(whole + fraction), scale: fraction.length - Number(exponent) };
  });
  const scale = Math.max(0, ...parts.map(part => part.scale));
  const sum = parts.reduce((total, part) =>
    total + part.digits * BigInt(`1${"0".repeat(scale - part.scale)}`), BigInt(0));
  return Number(sum) / 10 ** scale;
}
const totalKnown = (values: Array<number | null>) =>
  values.some(value => value == null || !Number.isFinite(value)) ? null : decimalSum(values as number[]);

export function buildOperationsPayrollExport(input: {
  branchId: string; branchName: string; month: string;
  report: Pick<OperationsPayrollExport, "lines" | "totals" | "warnings" | "unlinkedSummary" | "enrichmentFailures"> & {
    isLocked: boolean; closure?: { closedAt?: Date | string | null } | null;
  };
  payments: OperationsPayrollExport["payments"];
  generatedAt?: string;
}): OperationsPayrollExport {
  const { report, branchId, branchName, month } = input;
  // Ownership uses stored branch/month, not an employee's current branch after transfer.
  const payments = input.payments.filter(payment => payment.branchId === branchId && payment.month === month);
  const settlements = report.lines.map(line => {
    const payment = payments.find(row => row.branchEmployeeId === line.branchEmployeeId);
    const paid = line.branchEmployeeId == null ? null : payment ? payment.amount : 0;
    const outstanding = paid == null || !Number.isFinite(paid) || !Number.isFinite(line.netSalary)
      ? null : Math.max(0, decimalSum([line.netSalary, -paid]));
    return { branchEmployeeId: line.branchEmployeeId, paid, outstanding };
  });
  const closedAt = report.closure?.closedAt;
  return {
    version: 1, branchId, branchName, month, scope: "entire_branch_month",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: report.isLocked ? "closed_snapshot" : "live_calculation",
    snapshotClosedAt: closedAt instanceof Date ? closedAt.toISOString() : closedAt ?? null,
    paymentSource: "recorded_payments", disclaimer: OPERATIONS_PAYROLL_REVIEW_NOTICE,
    lines: report.lines, totals: report.totals, payments, settlements,
    paymentTotals: {
      paid: totalKnown(settlements.map(row => row.paid)),
      outstanding: totalKnown(settlements.map(row => row.outstanding)),
      recordedPaid: totalKnown(payments.map(row => row.amount)),
      unmatchedPaymentCount: payments.filter(payment => !report.lines.some(line => line.branchEmployeeId === payment.branchEmployeeId)).length,
      unknownSettlementCount: settlements.filter(row => row.paid == null || row.outstanding == null).length,
    },
    warnings: report.warnings, enrichmentFailures: report.enrichmentFailures, unlinkedSummary: report.unlinkedSummary,
  };
}