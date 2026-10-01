import type { OperationsSalesDay, OperationsSalesState } from "./operations-center";

export type OperationsMonthSource = "payroll" | "expenses" | "daily" | "review" | "sales";
export type OperationsMonthSourceState = "available" | "unavailable" | "forbidden";
export type OperationsMonthFailure = {
  source: OperationsMonthSource; state: "unavailable" | "forbidden";
  kind: "schema_not_ready" | "query_failed" | "forbidden"; message: string;
};

/** A monthly operations REVIEW, never a financial lock or payroll approval. */
export interface OperationsMonthWorkflow {
  mode?: "single";
  branchId: string;
  month: string;
  generatedAt: string;
  sourceFailures: OperationsMonthSource[];
  sourceStates?: Record<OperationsMonthSource, OperationsMonthSourceState>;
  sourceFailureDetails?: OperationsMonthFailure[];
  provenance?: { financialMetrics: "live_source_metrics"; review: "operational_daily_review_snapshot"; financialApproval: false };
  payroll: {
    available: boolean; reason?: string;
    status: "closed" | "reopened" | "not_closed" | "unavailable";
    due: number | null; paid: number | null; remaining: number | null;
    overpaid: number | null; recordedPaid: number | null;
    settlementStatus: "unavailable" | "not_closed" | "unreconciled" | "unknown_amount" | "unpaid" | "partial" | "paid" | "overpaid";
    unreconciledPaymentCount: number | null; unreconciledPaymentAmount: number | null;
    unknownPaymentAmounts: number | null; sourceHref: string | null; canManage: boolean;
    snapshotMismatch?: boolean | null; snapshotHeaderDue?: number | null; snapshotLinesDue?: number | null;
    employees: { employeeId: number; name: string; due: number; paid: number | null; remaining: number | null; overpaid: number | null }[];
    payments: { id: number; employeeId: number; amount: number | null; method: string; paidAt: string; actor: string | null; note: string | null; reconciled: boolean }[];
  };
  expenses: {
    available: boolean; reason?: string; recorded: number | null; paid: null;
    items: { label: string; amount: number }[]; sourceHref: string | null; canManage: boolean;
  };
  closing: {
    available: boolean; reason?: string;
    status: "open" | "closed" | "reopened" | "unavailable"; ended: boolean; drifted: boolean | null;
    dailyEvidenceAvailable: boolean; reviewEvidenceAvailable: boolean;
    canClose: boolean; canReopen: boolean; canDeclare: boolean;
    revision: number | null; closedAt: string | null; closedBy: string | null;
    dailyRecords: { id: number; date: string; status: string; sales: number | null; href: string }[];
    snapshotRecords?: { id: number; date: string; status: string; sales: number | null }[] | null;
    missingDates: string[];
    declarations: { date: string; note: string; actor: string; at: string }[];
    blockers: string[]; sourceHref: string;
    history: { action: "close" | "reopen" | "declare" | "remove_declaration"; at: string; actor: string; note: string }[];
  };
  sales: {
    available: boolean; reason?: string; confirmed: number | null;
    /** Legacy closure metric; always null for journal sales. */
    closedDays: number | null; sourceHref: string | null;
    state?: OperationsSalesState; recordedCount?: number | null; recordedBranchDays?: number | null;
    lastRecordedDate?: string | null; source?: string; definition?: string;
    daily?: OperationsSalesDay[];
    coverage?: "partial" | "unavailable"; isNet?: false;
  };
}

export type OperationsMonthCoverage = {
  state: "complete" | "partial" | "unavailable"; branchCount: number; availableCount: number;
  completeCount: number; partialCount: number; unavailableCount: number; forbiddenCount: number; unknownCount: number;
};
export type OperationsMonthMetric = {
  value: number | null; knownCount: number; unknownCount: number; state: OperationsMonthCoverage["state"];
};
export type OperationsMonthBranch = { branchId: string; branchName: string; workflow: OperationsMonthWorkflow };
export interface OperationsMonthAllWorkflow {
  mode: "all"; branchId: "all"; month: string; generatedAt: string; readOnly: true;
  scope: { branchIds: string[]; branchCount: number };
  branches: OperationsMonthBranch[];
  totals: {
    payroll: { coverage: OperationsMonthCoverage; due: number | null; paid: number | null; remaining: number | null;
      overpaid: number | null; recordedPaid: number | null };
    expenses: { coverage: OperationsMonthCoverage; recorded: number | null; paid: null };
    sales: { coverage: OperationsMonthCoverage; confirmed: number | null; recordedCount: number | null;
      recordedBranchDays: number | null; lastRecordedDate: string | null; source: string; definition: string; isNet: false };
    closing: { coverage: OperationsMonthCoverage; closedCount: number | null; openCount: number | null;
      reopenedCount: number | null; driftedCount: number | null };
    metrics: {
      payroll: Record<"due" | "paid" | "remaining" | "overpaid" | "recordedPaid", OperationsMonthMetric>;
      expenses: { recorded: OperationsMonthMetric };
      sales: Record<"confirmed" | "recordedCount" | "recordedBranchDays", OperationsMonthMetric>;
      closing: Record<"closedCount" | "openCount" | "reopenedCount" | "driftedCount", OperationsMonthMetric>;
    };
  };
}
export type OperationsMonthResponse = OperationsMonthWorkflow | OperationsMonthAllWorkflow;

/** A partial total is a known subtotal, never a claim that unknown branches owe zero. */
export function monthMetric(values: (number | null | undefined)[]): OperationsMonthMetric {
  const known = values.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return { value: known.length ? Math.round(known.reduce((sum, n) => sum + n, 0) * 100) / 100 : null,
    knownCount: known.length, unknownCount: values.length - known.length,
    state: !known.length ? "unavailable" : known.length === values.length ? "complete" : "partial" };
}

export function monthCoverage(states: ("complete" | "partial" | "unavailable" | "forbidden")[]): OperationsMonthCoverage {
  const count = (state: string) => states.filter(value => value === state).length;
  const completeCount = count("complete"), partialCount = count("partial");
  return { state: !completeCount && !partialCount ? "unavailable" : completeCount === states.length ? "complete" : "partial",
    branchCount: states.length, availableCount: completeCount + partialCount, completeCount, partialCount,
    unavailableCount: count("unavailable"), forbiddenCount: count("forbidden"), unknownCount: states.length - completeCount };
}

/** POST /month-workflow/{close,reopen,declare,remove-declaration}.
 * close/reopen require revision; all require a nonempty note.
 * declare/remove-declaration additionally require date (YYYY-MM-DD).
 * Once committed, a command returns OperationsMonthCommandResult even when
 * loading the fresh workflow fails. Never treat a refresh failure as rollback.
 */
export interface OperationsMonthCommand {
  branchId: string; month: string; revision: number; note: string; date?: string;
}

export type OperationsMonthAction = "close" | "reopen" | "declare" | "remove-declaration";

export interface OperationsMonthCommit {
  committed: true;
  branchId: string;
  month: string;
  action: OperationsMonthAction;
  revision: number;
  changed: boolean;
}

export interface OperationsMonthCommandResult {
  command: OperationsMonthCommit;
  refresh: "available" | "partial" | "unavailable";
  message: string;
  workflow: OperationsMonthWorkflow | null;
}

export function monthCalendar(month: string): string[] {
  if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
  const [year, number] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function payrollBalance(
  lines: { employeeId: number; due: number }[],
  payments: { employeeId: number; amount: number | null }[],
) {
  const cents = (n: number) => Math.round(n * 100);
  const membership = new Set(lines.map(line => line.employeeId));
  const unmatched = payments.filter(payment => !membership.has(payment.employeeId));
  const unknown = payments.filter(p => p.amount === null || !Number.isFinite(p.amount)).length;
  const paidCents = payments.reduce((s, p) => s + (p.amount === null || !Number.isFinite(p.amount) ? 0 : cents(p.amount)), 0);
  const dueCents = lines.reduce((s, l) => s + cents(l.due), 0);
  const confirmed = !unknown && !unmatched.length;
  // Employee entitlements cannot offset each other: paying A twice does
  // not discharge B's unpaid salary. Keep deficits and excesses separate.
  const paidByEmployee = new Map<number, number>();
  for (const payment of payments) {
    if (payment.amount !== null && Number.isFinite(payment.amount))
      paidByEmployee.set(payment.employeeId, (paidByEmployee.get(payment.employeeId) || 0) + cents(payment.amount));
  }
  const balances = lines.map(line => cents(line.due) - (paidByEmployee.get(line.employeeId) || 0));
  return {
    due: dueCents / 100,
    paid: confirmed ? paidCents / 100 : null,
    recordedPaid: unknown ? null : paidCents / 100,
    remaining: confirmed ? balances.reduce((sum, balance) => sum + Math.max(0, balance), 0) / 100 : null,
    overpaid: confirmed ? balances.reduce((sum, balance) => sum + Math.max(0, -balance), 0) / 100 : null,
    unknownPaymentAmounts: unknown,
    unreconciledPaymentCount: unmatched.length,
    unreconciledPaymentAmount: unmatched.some(p => p.amount === null || !Number.isFinite(p.amount)) ? null
      : unmatched.reduce((sum, p) => sum + cents(p.amount!), 0) / 100,
  };
}

export function monthlyEvidence(
  month: string,
  records: { date: string; status: string }[],
  declarations: { date: string }[],
  elapsedThrough?: string,
) {
  const dates = monthCalendar(month);
  const declared = new Set(declarations.map(d => d.date));
  const recorded = new Set(records.map(r => r.date));
  const missingDates = dates.filter(d => (!elapsedThrough || d <= elapsedThrough) && !recorded.has(d) && !declared.has(d));
  const conflictingDates = declarations.filter(d => recorded.has(d.date)).map(d => d.date);
  const openRecords = records.filter(r => r.status !== "closed");
  return { missingDates, conflictingDates, openRecords };
}