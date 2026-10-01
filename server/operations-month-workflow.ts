import type { Express, Request } from "express";
import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { pnlMonthlyInputs } from "@shared/schema";
import { monthlyEvidence, monthCalendar, payrollBalance, type OperationsMonthWorkflow,
  type OperationsMonthCommit, type OperationsMonthCommandResult } from "@shared/operations-month-workflow";
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
  const response = { status: () => response, json: () => { denied = true; return response; } };
  await requirePermission(module, action)(req, response as any, () => { allowed = true; });
  return allowed && !denied;
}

async function scope(req: Request) {
  const input = req.method === "GET" ? req.query : req.body;
  const branchId = input?.branchId;
  const month = input?.month;
  if (typeof branchId !== "string" || !branchId || branchId === "all" || branchId.length > 100 ||
      typeof month !== "string") throw error(400, "اختر فرعاً واحداً وشهراً صحيحاً");
  try { monthCalendar(month); } catch { throw error(400, "صيغة الشهر غير صحيحة"); }
  const allowed = getAllowedBranchIds(req);
  if (allowed !== null && !allowed.includes(branchId)) throw error(403, "الفرع خارج صلاحياتك");
  const branch = await pool.query("SELECT id FROM branches WHERE id=$1", [branchId]);
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

async function load(req: Request, branchId: string, month: string): Promise<OperationsMonthWorkflow> {
  const canDaily = await hasEffectiveViewPermission(req, "daily_closures");
  const canEdit = await hasEffectiveViewPermission(req, "operations", "edit");
  const isOperationsManager = req.currentUser?.role === "operations_manager";
  const canPayroll = isOperationsManager
    ? await hasEffectiveViewPermission(req, "operations_payroll") && await hasEffectiveViewPermission(req, "operations_hr")
    : await hasEffectiveViewPermission(req, "salary_closing");
  const canSalaryView = !isOperationsManager && await hasEffectiveViewPermission(req, "salary_closing");
  const canSalaryEdit = canSalaryView && await hasEffectiveViewPermission(req, "salary_closing", "edit");
  const canCosts = await hasEffectiveViewPermission(req, "pnl_dashboard") && await hasEffectiveViewPermission(req, "pnl");
  const canSales = await hasEffectiveViewPermission(req, "sales_analytics");
  const unavailable = "لا تملك صلاحية عرض المصدر؛ لم نمنح صلاحيات إضافية";
  const output: OperationsMonthWorkflow = {
    branchId, month, generatedAt: new Date().toISOString(), sourceFailures: [],
    payroll: { available: false, reason: unavailable, status: "unavailable", due: null, paid: null, remaining: null,
      overpaid: null, recordedPaid: null, settlementStatus: "unavailable", unreconciledPaymentCount: null, unreconciledPaymentAmount: null,
      unknownPaymentAmounts: null, sourceHref: null, canManage: false, employees: [], payments: [] },
    expenses: { available: false, reason: unavailable, recorded: null, paid: null, items: [], sourceHref: null, canManage: false },
    closing: { available: false, reason: unavailable, status: "unavailable", ended: month < today().slice(0, 7),
      drifted: null, dailyEvidenceAvailable: false, reviewEvidenceAvailable: false,
      canClose: false, canReopen: false, canDeclare: false, revision: null,
      closedAt: null, closedBy: null, dailyRecords: [], missingDates: [], declarations: [], blockers: [],
      sourceHref: href("/branch-daily-closures", branchId, month), history: [] },
    sales: { available: false, reason: unavailable, confirmed: null, closedDays: null,
      sourceHref: canSales ? href("/sales-analytics", branchId, month) : null },
  };
  if (canPayroll) {
    try {
      const closures = await pool.query("SELECT id,status,total_net FROM salary_closures WHERE branch_id=$1 AND month=$2", [branchId, month]);
      const closure = closures.rows[0];
      const lines = closure?.status === "closed" ? (await pool.query(
        `SELECT branch_employee_id AS "employeeId", employee_name AS name, net_salary AS due
         FROM salary_closure_lines WHERE closure_id=$1 ORDER BY branch_employee_id`, [closure.id])).rows : [];
      const payments = (await pool.query(
        `SELECT id,branch_employee_id AS "employeeId",amount,payment_method AS method,paid_at AS "paidAt",
         created_by_name AS actor,note FROM salary_payments WHERE branch_id=$1 AND month=$2 ORDER BY paid_at,id`,
        [branchId, month])).rows.map(row => ({ ...row, paidAt: iso(row.paidAt) }));
      const balance = payrollBalance(lines, payments);
      const snapshotAvailable = closure?.status === "closed";
      const remaining = snapshotAvailable ? balance.remaining : null;
      const overpaid = snapshotAvailable ? balance.overpaid : null;
      const membership = new Set(lines.map(line => line.employeeId));
      output.payroll = { available: true, status: closure?.status || "not_closed", ...balance,
        due: snapshotAvailable ? Number(closure.total_net) : null,
        paid: snapshotAvailable ? balance.paid : null, remaining, overpaid,
        settlementStatus: !snapshotAvailable ? "not_closed" : balance.unreconciledPaymentCount ? "unreconciled"
          : balance.unknownPaymentAmounts ? "unknown_amount" : overpaid! > 0 ? "overpaid"
          : remaining === 0 ? "paid" : balance.paid === 0 ? "unpaid" : "partial",
        sourceHref: isOperationsManager
          ? `${href("/hr-hub", branchId, month)}&tab=payroll`
          : canSalaryView ? href("/salary-closing", branchId, month, "branch") : null, canManage: canSalaryEdit,
        employees: lines.map(line => { const sum = payrollBalance([line], payments.filter(p => p.employeeId === line.employeeId));
          return { ...line, paid: sum.paid, remaining: sum.remaining, overpaid: sum.overpaid }; }),
        payments: payments.map(payment => ({ ...payment, reconciled: snapshotAvailable && membership.has(payment.employeeId) })) };
      if (balance.unreconciledPaymentCount && snapshotAvailable) output.payroll.reason = "توجد دفعات لا تطابق موظفي لقطة الإغلاق المحفوظة؛ يلزم تسويتها قبل إثبات المتبقي";
      else if (balance.unknownPaymentAmounts) output.payroll.reason = "توجد سجلات صرف بلا مبلغ؛ لا يمكن إثبات مجموع المصروف أو المتبقي";
      else if (closure?.status !== "closed") output.payroll.reason = "لم تُعتمد لقطة رواتب مغلقة؛ لا نعرض راتباً مستحقاً تقديرياً";
    } catch (sourceError) {
      output.sourceFailures.push("payroll");
      output.payroll.reason = sourceUnavailable("Payroll", sourceError,
        "تعذر تحميل أدلة الرواتب والصرف؛ المستحق والمصروف والمتبقي غير متاحين، وليست صفراً.");
    }
  }
  if (canCosts) {
    try {
      const [year, number] = month.split("-").map(Number);
      const [inputs, rent, recurring] = await Promise.all([
        db.select().from(pnlMonthlyInputs).where(and(eq(pnlMonthlyInputs.branchId, branchId), eq(pnlMonthlyInputs.year, year), eq(pnlMonthlyInputs.month, number))),
        storage.getRentEvidenceForPeriod(branchId, year, number), storage.getRecurringExpensesForPeriod(branchId, year, number),
      ]);
      const labels = { electricityCost: "كهرباء", waterCost: "مياه", utilitiesOther: "مرافق أخرى", internetCost: "إنترنت",
        governmentFees: "رسوم حكومية", insuranceCost: "تأمين", subscriptionsCost: "اشتراكات", securityCost: "أمن",
        bankFees: "رسوم بنكية", fuelCost: "وقود", maintenanceCost: "صيانة", marketingCost: "تسويق", suppliesCost: "مستلزمات", otherCosts: "تكاليف أخرى" };
      const input = inputs[0];
      const items = Object.entries(labels).filter(([key]) => input && (input as any)[key] !== null)
        .map(([key, label]) => ({ label, amount: Number((input as any)[key] || 0) }));
      if (rent.found) items.push({ label: "إيجار", amount: Number(rent.amount) });
      for (const row of recurring) items.push({ label: "عقد متكرر مسجل", amount: Number(row.monthlyAmount || 0) });
      output.expenses = { available: true, recorded: input || rent.found || recurring.length ? Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100 : null,
        paid: null, items, sourceHref: href("/pnl-dashboard", branchId, month),
        canManage: await hasEffectiveViewPermission(req, "pnl", "edit"), reason: "تكاليف مسجلة؛ المصدر لا يثبت الدفع النقدي. لا تشمل الرواتب أو تكلفة البضاعة." };
    } catch (sourceError) {
      // A missing optional financial source must not break payroll or the
      // operational workflow, nor turn an incomplete total into a real zero.
      output.sourceFailures.push("expenses");
      output.expenses.reason = sourceUnavailable("Expense", sourceError,
        "تعذر تحميل مصادر المصروفات؛ لم نعرض إجمالياً ناقصاً أو بيانات قديمة.");
    }
  }
  if (canDaily || canSales) {
    // Financial results need daily records, not the review table. A failed
    // review read must not hide daily evidence or invent an empty month.
    const [daily, review] = await Promise.allSettled([
      dailyEvidence(pool, branchId, month),
      canDaily ? reviewEvidence(pool, branchId, month) : Promise.resolve(undefined),
    ]);
    const records = daily.status === "fulfilled" ? daily.value : null;
    const state = review.status === "fulfilled" ? review.value : undefined;
    const dailyReason = daily.status === "rejected" ? sourceUnavailable("Daily", daily.reason,
      "تعذر تحميل أدلة الأيام؛ المبيعات واكتمال الأيام غير مؤكدين، ولا يمكن إغلاق الشهر.") : undefined;
    const reviewReason = review.status === "rejected" ? sourceUnavailable("Review", review.reason,
      "تعذر تحميل ملف المراجعة الشهرية وإصداره؛ لا يمكن إثبات حالة الشهر أو حفظ إجراء عليه.") : undefined;
    if (dailyReason) output.sourceFailures.push("daily");
    if (reviewReason) output.sourceFailures.push("review");
    if (canSales && records) {
      const closed = records.filter(r => r.status === "closed");
      output.sales.available = true;
      output.sales.reason = undefined;
      output.sales.confirmed = closed.length ? Math.round(closed.reduce((s, r) => s + Number(r.sales), 0) * 100) / 100 : null;
      output.sales.closedDays = new Set(closed.map(r => r.date)).size;
    } else if (canSales) {
      output.sales.reason = dailyReason;
    }
    if (canDaily) {
      const declarations = review.status === "fulfilled" ? state?.declarations || [] : [];
      const checks = records && review.status === "fulfilled" ? monthlyEvidence(month, records, declarations) : null;
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
        drifted: drifted === null ? null : !!drifted, declarations, missingDates: checks?.missingDates || [], blockers,
        canClose: canEdit && !!checks && state?.status !== "closed" && !blockers.length,
        canReopen: canEdit && !!checks && state?.status === "closed",
        canDeclare: canEdit && !!checks && state?.status !== "closed" && output.closing.ended,
        dailyRecords: (records || []).map(r => ({ id: r.id, date: r.date, status: r.status, sales: Number(r.sales),
          href: `/branch-daily-closures/${r.id}?branchId=${encodeURIComponent(branchId)}` })), history: state?.history || [] };
    }
  }
  return output;
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
    try { const { branchId, month } = await scope(req); res.setHeader("Cache-Control", "no-store"); res.json(await load(req, branchId, month)); }
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