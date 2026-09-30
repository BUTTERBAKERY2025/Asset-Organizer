/** A monthly operations REVIEW, never a financial lock or payroll approval. */
export interface OperationsMonthWorkflow {
  branchId: string;
  month: string;
  generatedAt: string;
  payroll: {
    available: boolean; reason?: string;
    status: "closed" | "reopened" | "not_closed" | "unavailable";
    due: number | null; paid: number | null; remaining: number | null;
    overpaid: number | null; recordedPaid: number | null;
    settlementStatus: "unavailable" | "not_closed" | "unreconciled" | "unknown_amount" | "unpaid" | "partial" | "paid" | "overpaid";
    unreconciledPaymentCount: number; unreconciledPaymentAmount: number | null;
    unknownPaymentAmounts: number; sourceHref: string | null; canManage: boolean;
    employees: { employeeId: number; name: string; due: number; paid: number | null; remaining: number | null; overpaid: number | null }[];
    payments: { id: number; employeeId: number; amount: number | null; method: string; paidAt: string; actor: string | null; note: string | null; reconciled: boolean }[];
  };
  expenses: {
    available: boolean; reason?: string; recorded: number | null; paid: null;
    items: { label: string; amount: number }[]; sourceHref: string | null; canManage: boolean;
  };
  closing: {
    available: boolean; reason?: string;
    status: "open" | "closed" | "reopened"; ended: boolean; drifted: boolean;
    canClose: boolean; canReopen: boolean; canDeclare: boolean;
    revision: number; closedAt: string | null; closedBy: string | null;
    dailyRecords: { id: number; date: string; status: string; sales: number; href: string }[];
    missingDates: string[];
    declarations: { date: string; note: string; actor: string; at: string }[];
    blockers: string[]; sourceHref: string;
    history: { action: "close" | "reopen" | "declare" | "remove_declaration"; at: string; actor: string; note: string }[];
  };
  sales: { available: boolean; reason?: string; confirmed: number | null; closedDays: number; sourceHref: string | null };
}

/** POST /month-workflow/{close,reopen,declare,remove-declaration}.
 * close/reopen require revision; all require a nonempty note.
 * declare/remove-declaration additionally require date (YYYY-MM-DD).
 * Successful mutations return a freshly loaded OperationsMonthWorkflow.
 */
export interface OperationsMonthCommand {
  branchId: string; month: string; revision: number; note: string; date?: string;
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
  return {
    due: dueCents / 100,
    paid: confirmed ? paidCents / 100 : null,
    recordedPaid: unknown ? null : paidCents / 100,
    remaining: confirmed ? Math.max(0, dueCents - paidCents) / 100 : null,
    overpaid: confirmed ? Math.max(0, paidCents - dueCents) / 100 : null,
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
) {
  const dates = monthCalendar(month);
  const declared = new Set(declarations.map(d => d.date));
  const recorded = new Set(records.map(r => r.date));
  const missingDates = dates.filter(d => !recorded.has(d) && !declared.has(d));
  const conflictingDates = declarations.filter(d => recorded.has(d.date)).map(d => d.date);
  const openRecords = records.filter(r => r.status !== "closed");
  return { missingDates, conflictingDates, openRecords };
}