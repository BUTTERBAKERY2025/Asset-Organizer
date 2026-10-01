import type { Express, Request } from "express";
import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { pnlMonthlyInputs } from "@shared/schema";
import { monthlyEvidence, monthCalendar, payrollBalance, type OperationsMonthWorkflow,
  type OperationsMonthCommit, type OperationsMonthCommandResult, type OperationsMonthSource,
  type OperationsMonthFailure, type OperationsMonthAllWorkflow, type OperationsMonthBranch } from "@shared/operations-month-workflow";
import { REGISTERED_SALES_SOURCE, REGISTERED_SALES_DEFINITION, operationsMonthPeriod,
  registeredSalesHref, projectRegisteredSales } from "@shared/operations-performance";
import { loadOperationsRegisteredSales } from "./operations-performance";
import { summarizeOperationsMonth } from "./operations-month-summary";
import { db, pool } from "./db";
import { storage } from "./storage";
import { getAllowedBranchIds, isAuthenticated, requirePermission } from "./auth";

type Queryable = Pick<PoolClient, "query">;
const error = (status: number, message: string) => Object.assign(new Error(message), { status });
const iso = (date: Date | string) => new Date(date).toISOString();
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
const href = (path: string, branchId: string, month: string, key = "branchId") =>
  `${path}?${new URLSearchParams({ [key]: branchId, month, from: "operations-center" })}`;
const fingerprint = (rows: unknown, declarations: unknown) =>
  createHash("sha256").update(JSON.stringify({ rows, declarations })).digest("hex");

// Reuse the exact source endpoint authorization (including role hard-denials
// and the request-fresh permissions loaded by isAuthenticated).
async function hasEffectiveViewPermission(req: Request, module: string, action = "view"): Promise<boolean> {
  let denied = false;
  let allowed = false;
  let responseStatus = 200;
  let failure: unknown;
  const response = { status: (status: number) => { responseStatus = status; return response; },
    json: () => { denied = true; return response; } };
  try {
    await requirePermission(module, action)(req, response as any, (cause?: unknown) => {
      if (cause) failure = cause; else allowed = true;
    });
  } catch (cause) { failure = cause; }
  if (failure || responseStatus >= 500) throw error(503, "تعذر التحقق من صلاحية المصدر؛ لم نعرض بيانات غير مؤكدة");
  return allowed && !denied;
}

async function scope(req: Request): Promise<{ branchId: string; month: string; branches?: { id: string; name: string }[] }> {
  const input = req.method === "GET" ? req.query : req.body;
  const branchId = input?.branchId;
  const month = input?.month;
  if (typeof branchId !== "string" || !branchId || branchId.length > 100 ||
      typeof month !== "string") throw error(400, "اختر فرعاً واحداً وشهراً صحيحاً");
  try { monthCalendar(month); } catch { throw error(400, "صيغة الشهر غير صحيحة"); }
  if (branchId === "all" && req.method !== "GET") throw error(400, "عرض كل الفروع للقراءة فقط؛ اختر فرعاً واحداً لحفظ إجراء");
  const allowed = getAllowedBranchIds(req);
  if (branchId === "all") {
    if (allowed !== null && !allowed.length) throw error(403, "لا توجد فروع مسموحة لحسابك");
    let branches: { id: string; name: string }[];
    try {
      branches = (await pool.query(
        `SELECT id,name FROM branches WHERE id NOT IN ('hq','main_warehouse')
         AND ($1::text[] IS NULL OR id=ANY($1::text[])) ORDER BY id`, [allowed])).rows;
    } catch {
      throw error(503, "تعذر التحقق من نطاق الفروع المسموح؛ لم نعرض بيانات غير مؤكدة");
    }
    // Defense in depth; never use the client's current board selection as scope.
    branches = branches.filter(branch => !["hq", "main_warehouse"].includes(branch.id) &&
      (allowed === null || allowed.includes(branch.id)));
    if (!branches.length) throw error(403, "لا توجد فروع تشغيل مسموحة لحسابك");
    return { branchId, month, branches };
  }
  if (allowed !== null && !allowed.includes(branchId)) throw error(403, "الفرع خارج صلاحياتك");
  let branch;
  try { branch = await pool.query("SELECT id FROM branches WHERE id=$1", [branchId]); }
  catch { throw error(503, "تعذر التحقق من وجود الفرع؛ لم نعرض بيانات غير مؤكدة"); }
  if (!branch.rowCount) throw error(404, "الفرع غير موجود");
  // Keep operations-manager employee/financial scope consistent with operations HR.
  if (req.currentUser?.role === "operations_manager" && ["hq", "main_warehouse"].includes(branchId))
    throw error(403, "هذا الموقع خارج نطاق موارد التشغيل");
  return { branchId, month };
}

async function dailyEvidence(q: Queryable, branchId: string, month: string) {
  const dates = monthCalendar(month);
  const records = await q.query(
    `SELECT id, closure_date::text AS date, status, total_sales AS sales,
      updated_at::text AS updated FROM branch_daily_closures
      WHERE branch_id=$1 AND closure_date BETWEEN $2 AND $3 ORDER BY closure_date,id`,
    [branchId, dates[0], dates[dates.length - 1]]);
  return records.rows;
}

async function reviewEvidence(q: Queryable, branchId: string, month: string) {
  return (await q.query("SELECT * FROM operations_month_reviews WHERE branch_id=$1 AND month=$2", [branchId, month])).rows[0];
}

async function evidence(q: Queryable, branchId: string, month: string) {
  const records = await dailyEvidence(q, branchId, month);
  const state = await reviewEvidence(q, branchId, month);
  const declarations: OperationsMonthWorkflow["closing"]["declarations"] = state?.declarations || [];
  const checks = monthlyEvidence(month, records, declarations);
  const sourceHash = fingerprint(records, declarations);
  return { state, declarations, records, checks, sourceHash };
}

function sourceUnavailable(source: string, sourceError: unknown, message: string) {
  const failure = sourceError as { code?: string; cause?: { code?: string } };
  const sourceCode = failure?.code || failure?.cause?.code;
  console.error(`[operations-month-workflow] ${source} source unavailable`, sourceCode || "unknown");
  return sourceCode === "42P01" || sourceCode === "42703"
    ? `${message} المصدر غير مهيأ في قاعدة البيانات.`
    : message;
}

function failureDetail(source: OperationsMonthSource, sourceError: unknown, message: string): OperationsMonthFailure {
  const failure = sourceError as { code?: string; cause?: { code?: string } };
  const code = failure?.code || failure?.cause?.code;
  return { source, state: "unavailable", kind: code === "42P01" || code === "42703" ? "schema_not_ready" : "query_failed", message };
}

function recordFailure(output: OperationsMonthWorkflow, source: OperationsMonthSource, cause: unknown, message: string) {
  output.sourceFailures.push(source);
  output.sourceStates![source] = "unavailable";
  output.sourceFailureDetails!.push(failureDetail(source, cause, message));
}

function finiteAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

async function load(req: Request, branchId: string, month: string): Promise<OperationsMonthWorkflow> {
  const permissionErrors = new Map<OperationsMonthSource, unknown>();
  const sourcePermission = async (source: OperationsMonthSource, module: string) => {
    try { return await hasEffectiveViewPermission(req, module); }
    catch (cause) { permissionErrors.set(source, cause); return false; }
  };
  const canDaily = await sourcePermission("daily", "daily_closures");
  if (permissionErrors.has("daily")) permissionErrors.set("review", permissionErrors.get("daily"));
  const canEdit = await hasEffectiveViewPermission(req, "operations", "edit");
  const isOperationsManager = req.currentUser?.role === "operations_manager";
  const canPayroll = isOperationsManager
    ? await sourcePermission("payroll", "operations_payroll") && await sourcePermission("payroll", "operations_hr")
    : await sourcePermission("payroll", "salary_closing");
  const canSalaryView = !isOperationsManager && canPayroll;
  const canSalaryEdit = canSalaryView && await hasEffectiveViewPermission(req, "salary_closing", "edit");
  const canCosts = await sourcePermission("expenses", "pnl_dashboard") && await sourcePermission("expenses", "pnl");
  const canSales = await sourcePermission("sales", "sales_analytics");
  const unavailable = "لا تملك صلاحية عرض المصدر؛ لم نمنح صلاحيات إضافية";
  const output: OperationsMonthWorkflow = {
    mode: "single", branchId, month, generatedAt: new Date().toISOString(), sourceFailures: [],
    sourceStates: { payroll: "forbidden", expenses: "forbidden", daily: "forbidden", review: "forbidden", sales: "forbidden" },
    sourceFailureDetails: [],
    provenance: { financialMetrics: "live_source_metrics", review: "operational_daily_review_snapshot", financialApproval: false },
    payroll: { available: false, reason: unavailable, status: "unavailable", due: null, paid: null, remaining: null,
      overpaid: null, recordedPaid: null, settlementStatus: "unavailable", unreconciledPaymentCount: null, unreconciledPaymentAmount: null,
      unknownPaymentAmounts: null, snapshotMismatch: null, snapshotHeaderDue: null, snapshotLinesDue: null,
      sourceHref: null, canManage: false, employees: [], payments: [] },
    expenses: { available: false, reason: unavailable, recorded: null, paid: null, items: [], sourceHref: null, canManage: false },
    closing: { available: false, reason: unavailable, status: "unavailable", ended: month < today().slice(0, 7),
      drifted: null, dailyEvidenceAvailable: false, reviewEvidenceAvailable: false,
      canClose: false, canReopen: false, canDeclare: false, revision: null,
      closedAt: null, closedBy: null, dailyRecords: [], missingDates: [], declarations: [], blockers: [],
      snapshotRecords: null, sourceHref: href("/branch-daily-closures", branchId, month), history: [] },
    sales: { available: false, reason: unavailable, confirmed: null, closedDays: null,
      state: "forbidden", recordedCount: null, recordedBranchDays: null, lastRecordedDate: null,
      source: REGISTERED_SALES_SOURCE, definition: REGISTERED_SALES_DEFINITION, coverage: "unavailable", isNet: false,
      daily: projectRegisteredSales([branchId], monthCalendar(month), [], "forbidden", []).daily,
      sourceHref: canSales ? `${registeredSalesHref(branchId, operationsMonthPeriod(month).from, operationsMonthPeriod(month).to)}&month=${month}` : null },
  };
  const permitted: Record<OperationsMonthSource, boolean> = {
    payroll: canPayroll, expenses: canCosts, daily: canDaily, review: canDaily, sales: canSales,
  };
  for (const source of Object.keys(permitted) as OperationsMonthSource[]) {
    if (permissionErrors.has(source)) {
      const reason = "تعذر التحقق من صلاحية المصدر؛ البيانات غير متاحة مؤقتاً، وليس رفض صلاحية أو مبلغاً صفرياً";
      recordFailure(output, source, permissionErrors.get(source), reason);
      if (source === "daily" || source === "review") output.closing.reason = reason;
      else output[source].reason = reason;
      if (source === "sales") output.sales.state = "unavailable";
    } else if (!permitted[source]) {
      output.sourceFailureDetails!.push({ source, state: "forbidden", kind: "forbidden", message: unavailable });
    }
  }
  if (canPayroll) {
    try {
      const closures = await pool.query("SELECT id,status,total_net FROM salary_closures WHERE branch_id=$1 AND month=$2", [branchId, month]);
      const closure = closures.rows[0];
      const lines = closure?.status === "closed" ? (await pool.query(
        `SELECT branch_employee_id AS "employeeId", employee_name AS name, net_salary AS due
         FROM salary_closure_lines WHERE closure_id=$1 ORDER BY branch_employee_id`, [closure.id])).rows.map(row => {
          const due = finiteAmount(row.due);
          if (due === null) throw new Error("Invalid salary snapshot amount");
          return { ...row, due };
        }) : [];
      const payments = (await pool.query(
        `SELECT id,branch_employee_id AS "employeeId",amount,payment_method AS method,paid_at AS "paidAt",
         created_by_name AS actor,note FROM salary_payments WHERE branch_id=$1 AND month=$2 ORDER BY paid_at,id`,
         [branchId, month])).rows.map(row => ({ ...row, amount: finiteAmount(row.amount), paidAt: iso(row.paidAt) }));
      const balance = payrollBalance(lines, payments);
      const snapshotAvailable = closure?.status === "closed";
      const headerDue = snapshotAvailable ? finiteAmount(closure.total_net) : null;
      const mismatch = snapshotAvailable && (headerDue === null || Math.round(headerDue * 100) !== Math.round(balance.due * 100));
      const remaining = snapshotAvailable && !mismatch ? balance.remaining : null;
      const overpaid = snapshotAvailable && !mismatch ? balance.overpaid : null;
      const membership = new Set(lines.map(line => line.employeeId));
      output.payroll = { available: true, status: closure?.status || "not_closed", ...balance,
        due: headerDue, snapshotHeaderDue: headerDue, snapshotLinesDue: snapshotAvailable ? balance.due : null,
        snapshotMismatch: snapshotAvailable ? mismatch : null,
        paid: snapshotAvailable && !mismatch ? balance.paid : null, remaining, overpaid,
        settlementStatus: !snapshotAvailable ? "not_closed" : mismatch || balance.unreconciledPaymentCount ? "unreconciled"
          : balance.unknownPaymentAmounts ? "unknown_amount" : overpaid! > 0 ? "overpaid"
          : remaining === 0 ? "paid" : balance.paid === 0 ? "unpaid" : "partial",
        sourceHref: isOperationsManager
          ? `${href("/hr-hub", branchId, month)}&tab=payroll`
          : canSalaryView ? href("/salary-closing", branchId, month, "branch") : null, canManage: canSalaryEdit,
        employees: lines.map(line => { const sum = payrollBalance([line], payments.filter(p => p.employeeId === line.employeeId));
          return { ...line, paid: sum.paid, remaining: sum.remaining, overpaid: sum.overpaid }; }),
        payments: payments.map(payment => ({ ...payment, reconciled: snapshotAvailable && membership.has(payment.employeeId) })) };
      output.sourceStates!.payroll = "available";
      if (mismatch) output.payroll.reason = "إجمالي رأس إغلاق الرواتب لا يطابق مجموع سطور الموظفين؛ اللقطة غير متطابقة ولا تثبت تسوية الرواتب";
      else if (balance.unreconciledPaymentCount && snapshotAvailable) output.payroll.reason = "توجد دفعات لا تطابق موظفي لقطة الإغلاق المحفوظة؛ يلزم تسويتها قبل إثبات المتبقي";
      else if (balance.unknownPaymentAmounts) output.payroll.reason = "توجد سجلات صرف بلا مبلغ؛ لا يمكن إثبات مجموع المصروف أو المتبقي";
      else if (closure?.status !== "closed") output.payroll.reason = "لم تُعتمد لقطة رواتب مغلقة؛ لا نعرض راتباً مستحقاً تقديرياً";
    } catch (sourceError) {
      output.payroll.reason = sourceUnavailable("Payroll", sourceError,
        "تعذر تحميل أدلة الرواتب والصرف؛ المستحق والمصروف والمتبقي غير متاحين، وليست صفراً.");
      recordFailure(output, "payroll", sourceError, output.payroll.reason);
    }
  }
  if (canCosts) {
    try {
      const [year, number] = month.split("-").map(Number);
      // These storage readers intentionally tolerate missing legacy tables.
      // Validate readiness first so their []/missing fallback cannot become a complete monthly total.
      await pool.query(`SELECT branch_id,monthly_amount,effective_from,effective_to,is_active FROM pnl_recurring_expenses WHERE false`);
      await pool.query(`SELECT branch_id,monthly_amount,effective_from,effective_to FROM pnl_rent_history WHERE false`);
      const [inputs, rent, recurring] = await Promise.all([
        db.select().from(pnlMonthlyInputs).where(and(eq(pnlMonthlyInputs.branchId, branchId), eq(pnlMonthlyInputs.year, year), eq(pnlMonthlyInputs.month, number))),
        storage.getRentEvidenceForPeriod(branchId, year, number), storage.getRecurringExpensesForPeriod(branchId, year, number),
      ]);
      const labels = { electricityCost: "كهرباء", waterCost: "مياه", utilitiesOther: "مرافق أخرى", internetCost: "إنترنت",
        governmentFees: "رسوم حكومية", insuranceCost: "تأمين", subscriptionsCost: "اشتراكات", securityCost: "أمن",
        bankFees: "رسوم بنكية", fuelCost: "وقود", maintenanceCost: "صيانة", marketingCost: "تسويق", suppliesCost: "مستلزمات", otherCosts: "تكاليف أخرى" };
      const input = inputs[0];
      const items = Object.entries(labels).filter(([key]) => input && (input as any)[key] !== null)
        .map(([key, label]) => ({ label, amount: finiteAmount((input as any)[key]) }));
      if (rent.found) items.push({ label: "إيجار", amount: finiteAmount(rent.amount) });
      for (const row of recurring) items.push({ label: "عقد متكرر مسجل", amount: finiteAmount(row.monthlyAmount) });
      if (items.some(item => item.amount === null)) throw new Error("Invalid recorded expense amount");
      const knownItems = items as { label: string; amount: number }[];
      output.expenses = { available: true, recorded: input || rent.found || recurring.length ? Math.round(knownItems.reduce((s, i) => s + i.amount, 0) * 100) / 100 : null,
        paid: null, items: knownItems, sourceHref: href("/pnl-dashboard", branchId, month),
        canManage: await hasEffectiveViewPermission(req, "pnl", "edit"), reason: "تكاليف مسجلة؛ المصدر لا يثبت الدفع النقدي. لا تشمل الرواتب أو تكلفة البضاعة." };
      output.sourceStates!.expenses = "available";
    } catch (sourceError) {
      // A missing optional financial source must not break payroll or the
      // operational workflow, nor turn an incomplete total into a real zero.
      output.expenses.reason = sourceUnavailable("Expense", sourceError,
        "تعذر تحميل مصادر المصروفات؛ لم نعرض إجمالياً ناقصاً أو بيانات قديمة.");
      recordFailure(output, "expenses", sourceError, output.expenses.reason);
    }
  }
  if (canSales) {
    try {
      const period = operationsMonthPeriod(month);
      const registered = await loadOperationsRegisteredSales([branchId], period.from, period.to);
      output.sales = { ...output.sales, available: true, reason: undefined, state: registered.state,
        confirmed: registered.total, recordedCount: registered.recordedCount,
        recordedBranchDays: registered.recordedBranchDays, lastRecordedDate: registered.lastRecordedDate,
        source: registered.source, definition: registered.definition, coverage: registered.coverage, daily: registered.daily };
      output.sourceStates!.sales = "available";
    } catch (sourceError) {
      output.sales.state = "unavailable";
      output.sales.reason = sourceUnavailable("Registered sales", sourceError,
        "تعذر تحميل المبيعات المسجلة في اليوميات المرحلة والمعتمدة؛ المبلغ غير متاح وليس صفراً.");
      recordFailure(output, "sales", sourceError, output.sales.reason);
    }
  }
  if (canDaily) {
    // Operational daily review evidence is independent of live journal sales.
    const [daily, review] = await Promise.allSettled([
      dailyEvidence(pool, branchId, month),
      reviewEvidence(pool, branchId, month),
    ]);
    const records = daily.status === "fulfilled" ? daily.value : null;
    const state = review.status === "fulfilled" ? review.value : undefined;
    const dailyReason = daily.status === "rejected" ? sourceUnavailable("Daily", daily.reason,
      "تعذر تحميل أدلة الأيام؛ اكتمال الأيام غير مؤكد ولا يمكن إغلاق المراجعة التشغيلية.") : undefined;
    const reviewReason = review.status === "rejected" ? sourceUnavailable("Review", review.reason,
      "تعذر تحميل ملف المراجعة الشهرية وإصداره؛ لا يمكن إثبات حالة الشهر أو حفظ إجراء عليه.") : undefined;
    if (dailyReason && daily.status === "rejected") recordFailure(output, "daily", daily.reason, dailyReason);
    else output.sourceStates!.daily = "available";
    if (reviewReason && review.status === "rejected") recordFailure(output, "review", review.reason, reviewReason);
    else output.sourceStates!.review = "available";
    if (canDaily) {
      const declarations = review.status === "fulfilled" ? state?.declarations || [] : [];
      const checks = records && review.status === "fulfilled" ? monthlyEvidence(month, records, declarations, today()) : null;
      const blockers = [
        ...(dailyReason ? [dailyReason] : []), ...(reviewReason ? [reviewReason] : []),
        ...(checks?.openRecords.map(r => `السجل اليومي ${r.date} غير مغلق`) || []),
        ...(checks?.missingDates.map(date => `اليوم ${date} بلا سجل أو إقرار توقف تشغيل`) || []),
        ...(checks?.conflictingDates.map(date => `اليوم ${date} له سجل وإقرار توقف؛ احذف الإقرار`) || []),
      ];
      if (!output.closing.ended) blockers.unshift("لا يُغلق شهر قبل انتهائه بتوقيت السعودية");
      const drifted = checks && records ? state?.status === "closed" && state.fingerprint !== fingerprint(records, declarations) : null;
      if (drifted) blockers.unshift("تغيرت أدلة الأيام بعد الإغلاق؛ أعد فتح المراجعة الشهرية");
      output.closing = { ...output.closing, available: records !== null || review.status === "fulfilled",
        dailyEvidenceAvailable: records !== null, reviewEvidenceAvailable: review.status === "fulfilled",
        reason: [dailyReason, reviewReason].filter(Boolean).join(" ") || undefined,
        status: review.status === "fulfilled" ? state?.status || "open" : "unavailable",
        revision: review.status === "fulfilled" ? state?.revision || 0 : null,
        closedAt: state?.closed_at ? iso(state.closed_at) : null, closedBy: state?.closed_by_name || state?.closed_by || null,
        snapshotRecords: state?.snapshot?.map((r: any) => ({ id: r.id, date: r.date, status: r.status, sales: finiteAmount(r.sales) })) || null,
        drifted: drifted === null ? null : !!drifted, declarations, missingDates: checks?.missingDates || [], blockers,
        canClose: canEdit && !!checks && state?.status !== "closed" && !blockers.length,
        canReopen: canEdit && !!checks && state?.status === "closed",
        canDeclare: canEdit && !!checks && state?.status !== "closed" && output.closing.ended,
        dailyRecords: (records || []).map(r => ({ id: r.id, date: r.date, status: r.status, sales: finiteAmount(r.sales),
          href: `/branch-daily-closures/${r.id}?branchId=${encodeURIComponent(branchId)}` })), history: state?.history || [] };
    }
  }
  return output;
}

async function loadAll(req: Request, month: string, branches: { id: string; name: string }[]): Promise<OperationsMonthAllWorkflow> {
  const projections: OperationsMonthBranch[] = new Array(branches.length);
  let cursor = 0;
  // No branch scan cap: resolve the entire authorized scope, but never fan out
  // an unbounded number of payroll/financial/evidence queries.
  await Promise.all(Array.from({ length: Math.min(3, branches.length) }, async () => {
    while (cursor < branches.length) {
      const index = cursor++;
      const branch = branches[index];
      const workflow = await load(req, branch.id, month);
      workflow.payroll.canManage = false;
      workflow.expenses.canManage = false;
      workflow.closing.canClose = false;
      workflow.closing.canReopen = false;
      workflow.closing.canDeclare = false;
      workflow.closing.revision = null;
      projections[index] = { branchId: branch.id, branchName: branch.name, workflow };
    }
  }));
  return summarizeOperationsMonth(month, projections);
}

const savedRefreshUnavailable = "تم حفظ الإجراء؛ تعذر تحديث ملف الشهر الآن. لا تُعد إرسال الإجراء، وحدّث الملف للتحقق من الحالة المحفوظة.";

export async function refreshCommittedMonth(
  command: OperationsMonthCommit,
  reload: () => Promise<OperationsMonthWorkflow>,
): Promise<OperationsMonthCommandResult> {
  try {
    const workflow = await reload();
    const partial = workflow.sourceFailures.length > 0;
    return { command, workflow, refresh: partial ? "partial" : "available",
      message: partial
        ? "تم حفظ الإجراء؛ تعذر تحديث بعض مصادر الشهر. الإجراء محفوظ، ولا حاجة لإعادة إرساله. حدّث الملفات غير المتاحة."
        : command.changed ? "تم حفظ الإجراء وتحديث ملف الشهر." : "الإجراء محفوظ مسبقاً؛ تم تحديث ملف الشهر دون تكرار الحفظ." };
  } catch (refreshError) {
    sourceUnavailable("Postcommit refresh", refreshError, savedRefreshUnavailable);
    return { command, workflow: null, refresh: "unavailable", message: savedRefreshUnavailable };
  }
}

export function registerOperationsMonthWorkflow(app: Express) {
  app.get("/api/operations-center/month-workflow", isAuthenticated, requirePermission("operations", "view"), async (req, res, next) => {
    try {
      const { branchId, month, branches } = await scope(req);
      res.setHeader("Cache-Control", "no-store");
      res.json(branchId === "all" ? await loadAll(req, month, branches!) : await load(req, branchId, month));
    }
    catch (e) { next(e); }
  });
  for (const action of ["close", "reopen", "declare", "remove-declaration"] as const) {
    app.post(`/api/operations-center/month-workflow/${action}`, isAuthenticated,
      requirePermission("operations", "view"), requirePermission("operations", "edit"), async (req, res, next) => {
        let client: PoolClient | undefined;
        let committed: OperationsMonthCommit | undefined;
        try {
          const { branchId, month } = await scope(req);
          if (!await hasEffectiveViewPermission(req, "daily_closures")) throw error(403, "لا تملك صلاحية الإغلاقات اليومية");
          const { revision, note, date } = req.body || {};
          if (!Number.isSafeInteger(revision) || revision < 0 || typeof note !== "string" || note.trim().length < 3 || note.length > 1000)
            throw error(400, "اكتب سبباً واضحاً وأرسل إصدار الملف الحالي");
          if (month >= today().slice(0, 7)) throw error(409, "الشهر لم ينته بعد");
          const finish = async (savedRevision: number, changed: boolean) => {
            await client!.query("COMMIT");
            // Record commitment before release or refresh: neither can undo it.
            committed = { committed: true, branchId, month, action, revision: savedRevision, changed };
            const completedClient = client!;
            client = undefined;
            completedClient.release();
            const result = await refreshCommittedMonth(committed, () => load(req, branchId, month));
            res.setHeader("Cache-Control", "no-store");
            return res.json(result);
          };
          client = await pool.connect();
          await client.query("BEGIN");
          await client.query("SET LOCAL lock_timeout = '3s'");
          await client.query("SET LOCAL statement_timeout = '10s'");
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`operations-month:${branchId}:${month}`]);
          // Daily writers do not participate in the review advisory lock.
          // SHARE briefly excludes inserts/updates/deletes until our close commits;
          // afterwards sources remain editable and subsequent drift is reported.
          if (action === "close") await client.query("LOCK TABLE branch_daily_closures IN SHARE MODE");
          await client.query("INSERT INTO operations_month_reviews(branch_id,month) VALUES($1,$2) ON CONFLICT(branch_id,month) DO NOTHING", [branchId, month]);
          const ev = await evidence(client, branchId, month).catch(sourceError => {
            const code = (sourceError as { code?: string })?.code;
            if (code === "55P03" || code === "57014") throw sourceError;
            throw error(503, sourceUnavailable("Required review evidence", sourceError,
              "تعذر تحميل أدلة الأيام أو المراجعة الشهرية؛ لم نحفظ الإجراء. حدّث الملف قبل المتابعة."));
          });
          const state = ev.state;
          // Safe repeated close/open is idempotent; stale changes never overwrite newer evidence.
          if (action === "close" && state.status === "closed" && state.fingerprint === ev.sourceHash ||
              action === "reopen" && state.status === "reopened") {
            return await finish(state.revision, false);
          }
          if (action === "declare" && monthCalendar(month).includes(date) &&
              state.status !== "closed" && !ev.records.some(r => r.date === date) &&
              ev.declarations.some(d => d.date === date && d.note === note.trim()) ||
              action === "remove-declaration" && monthCalendar(month).includes(date) &&
              state.status !== "closed" && !ev.declarations.some(d => d.date === date)) {
            return await finish(state.revision, false);
          }
          if (state.revision !== revision) throw error(409, "تغير الملف؛ حدّثه قبل المتابعة");
          const declarations = [...ev.declarations];
          if (action === "close") {
            if (state.status === "closed") throw error(409, "تغيرت الأدلة؛ أعد فتح الشهر أولاً");
            if (ev.checks.openRecords.length || ev.checks.missingDates.length || ev.checks.conflictingDates.length)
              throw error(409, "توجد أيام غير محسومة؛ أغلق السجلات أو وثّق توقف التشغيل");
          } else if (action === "reopen") {
            if (state.status !== "closed") throw error(409, "الشهر غير مغلق");
          } else {
            if (state.status === "closed") throw error(409, "أعد فتح الشهر قبل تغيير إقرارات الأيام");
            if (!monthCalendar(month).includes(date)) throw error(400, "اليوم خارج الشهر أو غير صحيح");
            if (action === "declare") {
              if (ev.records.some(r => r.date === date)) throw error(409, "لهذا اليوم سجل تشغيل؛ لا يمكن اعتباره توقفاً");
              if (declarations.some(d => d.date === date)) throw error(409, "إقرار اليوم موجود؛ احذفه قبل تعديله");
              declarations.push({ date, note: note.trim(), actor: req.currentUser!.id, at: new Date().toISOString() });
            } else {
              const index = declarations.findIndex(d => d.date === date);
              if (index < 0) throw error(409, "إقرار اليوم غير موجود");
              declarations.splice(index, 1);
            }
          }
          const actor = req.currentUser!.id;
          const event = { action, at: new Date().toISOString(), actor,
            note: action === "declare" || action === "remove-declaration" ? `${date}: ${note.trim()}` : note.trim() };
          await client.query(
            `UPDATE operations_month_reviews SET status=$3,revision=revision+1,declarations=$4::jsonb,
             history=history || $5::jsonb, fingerprint=CASE WHEN $6 THEN $7 ELSE fingerprint END,
             snapshot=CASE WHEN $6 THEN $8::jsonb ELSE snapshot END,
             closed_at=CASE WHEN $6 THEN now() ELSE closed_at END,
             closed_by=CASE WHEN $6 THEN $9 ELSE closed_by END,
             closed_by_name=CASE WHEN $6 THEN $9 ELSE closed_by_name END,updated_at=now()
             WHERE branch_id=$1 AND month=$2`,
            [branchId, month, action === "close" ? "closed" : action === "reopen" ? "reopened" : state.status,
              JSON.stringify(declarations), JSON.stringify([event]), action === "close", ev.sourceHash,
              JSON.stringify(ev.records), actor]);
          return await finish(state.revision + 1, true);
        } catch (e) {
          if (committed) {
            sourceUnavailable("Postcommit response", e, savedRefreshUnavailable);
            res.setHeader("Cache-Control", "no-store");
            return res.json({ command: committed, workflow: null, refresh: "unavailable",
              message: savedRefreshUnavailable } satisfies OperationsMonthCommandResult);
          }
          if (client) { await client.query("ROLLBACK").catch(() => {}); client.release(); }
          const code = (e as { code?: string })?.code;
          next(code === "55P03" || code === "57014" ? error(409, "مصدر الأيام مشغول؛ لم نحفظ إغلاقاً. حدّث الملف وأعد المحاولة") : e);
        }
      });
  }
}