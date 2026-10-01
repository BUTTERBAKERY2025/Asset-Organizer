import { monthCoverage, monthMetric, type OperationsMonthAllWorkflow,
  type OperationsMonthBranch, type OperationsMonthCoverage, type OperationsMonthSourceState } from "@shared/operations-month-workflow";
import { REGISTERED_SALES_SOURCE, REGISTERED_SALES_DEFINITION } from "@shared/operations-performance";

/** Sources may be fully loaded while their financial evidence is incomplete. */
function sectionState(available: boolean, state: OperationsMonthSourceState | undefined, complete: boolean) {
  return !available ? state === "forbidden" ? "forbidden" : "unavailable" : complete ? "complete" : "partial";
}

export function summarizeOperationsMonth(month: string, branches: OperationsMonthBranch[]): OperationsMonthAllWorkflow {
  const rows = branches.map(branch => branch.workflow);
  const payroll = {
    due: monthMetric(rows.map(row => row.payroll.due)),
    paid: monthMetric(rows.map(row => row.payroll.paid)),
    remaining: monthMetric(rows.map(row => row.payroll.remaining)),
    overpaid: monthMetric(rows.map(row => row.payroll.overpaid)),
    recordedPaid: monthMetric(rows.map(row => row.payroll.recordedPaid)),
  };
  const expenses = { recorded: monthMetric(rows.map(row => row.expenses.recorded)) };
  const sales = {
    confirmed: monthMetric(rows.map(row => row.sales.confirmed)),
    recordedCount: monthMetric(rows.map(row => row.sales.recordedCount)),
    recordedBranchDays: monthMetric(rows.map(row => row.sales.recordedBranchDays)),
  };
  const reviewCount = (status: string) => monthMetric(rows.map(row =>
    row.closing.reviewEvidenceAvailable ? Number(row.closing.status === status) : null));
  const closing = {
    closedCount: reviewCount("closed"), openCount: reviewCount("open"), reopenedCount: reviewCount("reopened"),
    driftedCount: monthMetric(rows.map(row => row.closing.drifted === null ? null : Number(row.closing.drifted))),
  };
  const coverage: Record<"payroll" | "expenses" | "sales" | "closing", OperationsMonthCoverage> = {
    payroll: monthCoverage(rows.map(row => sectionState(row.payroll.available, row.sourceStates?.payroll,
      row.payroll.status === "closed" && !row.payroll.snapshotMismatch &&
      [row.payroll.due, row.payroll.paid, row.payroll.remaining, row.payroll.overpaid].every(value => value !== null)))),
    expenses: monthCoverage(rows.map(row => sectionState(row.expenses.available, row.sourceStates?.expenses,
      row.expenses.recorded !== null))),
    sales: monthCoverage(rows.map(row => sectionState(row.sales.available, row.sourceStates?.sales,
      row.sales.state === "recorded"))),
    closing: monthCoverage(rows.map(row => sectionState(row.closing.available, row.sourceStates?.daily,
      row.closing.dailyEvidenceAvailable && row.closing.reviewEvidenceAvailable))),
  };
  return {
    mode: "all", branchId: "all", month, generatedAt: new Date().toISOString(), readOnly: true,
    scope: { branchIds: branches.map(branch => branch.branchId), branchCount: branches.length }, branches,
    totals: {
      payroll: { coverage: coverage.payroll, due: payroll.due.value, paid: payroll.paid.value,
        remaining: payroll.remaining.value, overpaid: payroll.overpaid.value, recordedPaid: payroll.recordedPaid.value },
      expenses: { coverage: coverage.expenses, recorded: expenses.recorded.value, paid: null },
      sales: { coverage: coverage.sales, confirmed: sales.confirmed.value, recordedCount: sales.recordedCount.value,
        recordedBranchDays: sales.recordedBranchDays.value,
        lastRecordedDate: rows.map(row => row.sales.lastRecordedDate).filter((date): date is string => !!date).sort().at(-1) ?? null,
        source: REGISTERED_SALES_SOURCE, definition: REGISTERED_SALES_DEFINITION, isNet: false },
      closing: { coverage: coverage.closing, closedCount: closing.closedCount.value, openCount: closing.openCount.value,
        reopenedCount: closing.reopenedCount.value, driftedCount: closing.driftedCount.value },
      metrics: { payroll, expenses, sales, closing },
    },
  };
}