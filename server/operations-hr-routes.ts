import type { Express } from "express";
import type { SalaryClosingLine } from "./salary-closing-calc";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "./db";
import { getAllowedBranchIds, isAuthenticated, requirePermission } from "./auth";
import {
  branchEmployees, branches, employeeTransferRequests, transferHistory, userAssignments, userBranchAccess, users,
} from "@shared/schema";

export function operationsHrBranches(req: any): string[] {
  const allowed = getAllowedBranchIds(req);
  // Only the operations manager uses this surface; never permit the HQ row even
  // if an administrator accidentally assigned it as an operations branch.
  return Array.isArray(allowed) ? allowed.filter(id => id !== "main_warehouse") : [];
}

export function transferWithinOperationsScope(source: string, destination: string, allowed: string[]): boolean {
  return source !== destination && source !== "main_warehouse" && destination !== "main_warehouse"
    && allowed.includes(source) && allowed.includes(destination);
}

export function operationsHrManagerOnly(req: any, res: any, next: any) {
  return req.currentUser?.role === "operations_manager" ? next() : res.status(403).json({ error: "هذه المساحة مخصصة لمدير التشغيل" });
}

type TransferTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const OPEN_TRANSFER_STATUSES = ["pending", "source_approved", "dest_approved", "hr_approved"];

/** Read-only readiness probe. Never create tables, convert identifiers, or migrate on a request. */
export async function assertEmployeeTransferSchemaReady(client: Pick<typeof db, "execute"> = db): Promise<void> {
  await client.execute(sql`
    SELECT t.id, t.employee_id, t.source_branch_id, t.destination_branch_id,
      t.requested_by, t.requested_at, t.effective_date, t.reason, t.status,
      t.current_approver_role, t.rejection_reason, t.completed_at, t.notes, t.created_at, t.updated_at,
      h.id, h.transfer_id, h.event_type, h.performed_by, h.details, h.event_timestamp
    FROM employee_transfer_requests t LEFT JOIN transfer_history h ON h.transfer_id = t.id
    WHERE false
  `);
}

export function employeeTransferSchemaNotReady(error: unknown): boolean {
  let current: any = error;
  for (let depth = 0; current && depth < 6; depth++, current = current.cause) {
    if (["42P01", "42703", "42804"].includes(current.code)) return true;
  }
  return false;
}

export const EMPLOYEE_TRANSFER_SCHEMA_ERROR = {
  code: "TRANSFER_SCHEMA_NOT_READY",
  error: "بنية سجل نقل الموظفين غير جاهزة؛ اطلب من مسؤول النظام التحقق من جداول employee_transfer_requests و transfer_history وأعمدتها وتطبيق التحديث المعتمد قبل إعادة المحاولة. لم تُحفظ تغييرات ولم تُنفذ ترقية تلقائية.",
};

async function lockTransferEmployee(tx: TransferTransaction, employeeId: number) {
  await tx.execute(sql`SELECT id FROM branch_employees WHERE id = ${employeeId} FOR UPDATE`);
  const [employee] = await tx.select().from(branchEmployees).where(eq(branchEmployees.id, employeeId)).limit(1);
  if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");
  return employee;
}

async function validateTransferAccount(tx: TransferTransaction, employee: typeof branchEmployees.$inferSelect) {
  if (employee.status !== "active") throw new Error("INACTIVE_EMPLOYEE");
  if (!employee.linkedUserId) return;
  await tx.execute(sql`SELECT id FROM users WHERE id = ${employee.linkedUserId} FOR UPDATE`);
  const [account] = await tx.select({ role: users.role }).from(users).where(eq(users.id, employee.linkedUserId)).limit(1);
  if (!account || !["employee", "viewer"].includes(account.role)) throw new Error("LINKED_ACCOUNT_NEEDS_HR");
  const grants = await tx.select({ id: userBranchAccess.id }).from(userBranchAccess).where(eq(userBranchAccess.userId, employee.linkedUserId));
  if (grants.length) throw new Error("LINKED_ACCOUNT_NEEDS_HR");
  const assignments = await tx.select({ id: userAssignments.id }).from(userAssignments)
    .where(and(eq(userAssignments.userId, employee.linkedUserId), eq(userAssignments.isActive, true))).limit(1);
  if (assignments.length) throw new Error("LINKED_ACCOUNT_NEEDS_HR");
}

async function moveTransferEmployee(tx: TransferTransaction, employee: typeof branchEmployees.$inferSelect, destinationBranchId: string, now: Date) {
  await tx.update(branchEmployees).set({ branchId: destinationBranchId, updatedAt: now })
    .where(eq(branchEmployees.id, employee.id));
  if (employee.linkedUserId)
    await tx.update(users).set({ branchId: destinationBranchId }).where(eq(users.id, employee.linkedUserId));
}

/** Legacy HR completion must share the employee lock with operations transfers. */
export async function completeHrEmployeeTransfer(transferId: number, actorId: string) {
  return db.transaction(async tx => {
    await assertEmployeeTransferSchemaReady(tx);
    const [initial] = await tx.select().from(employeeTransferRequests).where(eq(employeeTransferRequests.id, transferId)).limit(1);
    if (!initial) throw new Error("TRANSFER_NOT_FOUND");
    const employee = await lockTransferEmployee(tx, initial.employeeId);
    await tx.execute(sql`SELECT id FROM employee_transfer_requests WHERE id = ${transferId} FOR UPDATE`);
    const [transfer] = await tx.select().from(employeeTransferRequests).where(eq(employeeTransferRequests.id, transferId)).limit(1);
    if (!transfer) throw new Error("TRANSFER_NOT_FOUND");
    // A completed request is an idempotent retry, not another move or audit entry.
    if (transfer.status === "completed") return transfer;
    if (transfer.status !== "hr_approved") throw new Error("TRANSFER_NOT_APPROVED");
    if (transfer.employeeId !== employee.id || employee.branchId !== transfer.sourceBranchId) throw new Error("STALE_SOURCE");
    if (transfer.sourceBranchId === transfer.destinationBranchId) throw new Error("INVALID_DESTINATION");
    await validateTransferAccount(tx, employee);
    const now = new Date();
    await moveTransferEmployee(tx, employee, transfer.destinationBranchId, now);
    const [updated] = await tx.update(employeeTransferRequests)
      .set({ status: "completed", currentApproverRole: null, completedAt: now, updatedAt: now })
      .where(eq(employeeTransferRequests.id, transferId)).returning();
    await tx.insert(transferHistory).values({
      transferId, eventType: "completed", performedBy: actorId,
      details: { message: "تم تنفيذ النقل", fromBranch: transfer.sourceBranchId, toBranch: transfer.destinationBranchId },
    });
    return updated;
  });
}

type TransferCursor = { at: string; id: number; branchId: string | null };
function parseTransferCursor(value: unknown, branchId: string | undefined): TransferCursor {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,1024}$/.test(value)) throw new Error("INVALID_CURSOR");
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsedAt = typeof cursor?.at === "string" ? new Date(`${cursor.at}Z`) : new Date(NaN);
    if (typeof cursor.at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(cursor.at)
        || cursor.at.startsWith("0000") || !Number.isFinite(parsedAt.getTime())
        || parsedAt.toISOString().slice(0, 19) !== cursor.at.slice(0, 19)
        || !Number.isSafeInteger(cursor.id) || cursor.id < 1 || cursor.id > 2_147_483_647
        || cursor.branchId !== (branchId ?? null)) throw new Error("INVALID_CURSOR");
    return cursor;
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}

export function operationsPayrollCsv(lines: (Partial<SalaryClosingLine> & Pick<SalaryClosingLine, "employeeName" | "grossSalary" | "netSalary">)[]) {
  const csvCell = (value: unknown) => {
    const text = String(value ?? "");
    // Spreadsheet programs interpret formulas even when cells are quoted.
    const safe = !/^-?\d+(?:\.\d+)?$/.test(text) && /^[\s]*[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const columns: Array<[keyof SalaryClosingLine, string]> = [
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
  const rows = [
    columns.map(([, title]) => title),
    ...lines.map(line => columns.map(([key]) => {
      const value = line[key];
      return Array.isArray(value) ? JSON.stringify(value) : value ?? "";
    })),
  ];
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function registerOperationsHrRoutes(app: Express) {
  const managerOnly = operationsHrManagerOnly;

  app.get("/api/operations-hr/branches", isAuthenticated, managerOnly, requirePermission("operations_hr", "view"), async (req, res) => {
    try {
      const ids = operationsHrBranches(req);
      if (!ids.length) return res.json([]);
      const rows = await db.select({ id: branches.id, name: branches.name }).from(branches).where(inArray(branches.id, ids));
      res.set("Cache-Control", "no-store").json(rows);
    } catch (error) {
      console.error("Operations HR branches error:", error);
      res.status(500).json({ error: "تعذر تحميل الفروع" });
    }
  });

  app.get("/api/operations-hr/employees", isAuthenticated, managerOnly, requirePermission("operations_hr", "view"), async (req, res) => {
    try {
      const ids = operationsHrBranches(req);
      const branchId = req.query.branchId;
      if (branchId != null && (typeof branchId !== "string" || !ids.includes(branchId)))
        return res.status(403).json({ error: "الفرع خارج نطاق الصلاحية" });
      if (!ids.length) return res.json([]);
      const rows = await db.select({
        id: branchEmployees.id, employeeName: branchEmployees.employeeName,
        employeeNumber: branchEmployees.employeeNumber, jobTitle: branchEmployees.jobTitle,
        status: branchEmployees.status, branchId: branchEmployees.branchId,
      }).from(branchEmployees).where(
        inArray(branchEmployees.branchId, branchId ? [branchId] : ids),
      ).orderBy(branchEmployees.employeeName);
      res.set("Cache-Control", "no-store").json(rows);
    } catch (error) {
      console.error("Operations HR employees error:", error);
      res.status(500).json({ error: "تعذر تحميل الموظفين" });
    }
  });

  app.get("/api/operations-hr/transfers", isAuthenticated, managerOnly, requirePermission("operations_hr", "view"), requirePermission("operations_employee_transfer", "view"), async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const ids = operationsHrBranches(req);
      const query = req.query ?? {};
      const branchId = query.branchId;
      if (branchId !== undefined && (typeof branchId !== "string" || !branchId))
        return res.status(400).json({ error: "معرف الفرع غير صالح" });
      if (branchId !== undefined && !ids.includes(branchId as string))
        return res.status(403).json({ error: "الفرع خارج نطاق الصلاحية" });
      const paginated = branchId !== undefined || query.limit !== undefined || query.cursor !== undefined;
      const limit = query.limit === undefined ? (paginated ? 50 : 200) : Number(query.limit);
      if (query.limit !== undefined && (typeof query.limit !== "string" || !/^\d+$/.test(query.limit)
          || !Number.isSafeInteger(limit) || limit < 1 || limit > 200))
        return res.status(400).json({ error: "حجم الصفحة يجب أن يكون بين 1 و200" });
      const cursor = query.cursor === undefined ? undefined : parseTransferCursor(query.cursor, branchId as string | undefined);
      const respond = (transfers: any[], hasMore: boolean, nextCursor: string | null) => {
        res.set("X-Transfers-Truncated", String(hasMore));
        return res.json(paginated ? { transfers, nextCursor, hasMore, truncated: hasMore, limit } : transfers);
      };
      if (!ids.length) return respond([], false, null);
      await assertEmployeeTransferSchemaReady();
      const rows = await db.select({
        id: employeeTransferRequests.id, employeeId: employeeTransferRequests.employeeId,
        employeeName: branchEmployees.employeeName,
        employeeNumber: branchEmployees.employeeNumber, jobTitle: branchEmployees.jobTitle,
        sourceBranchId: employeeTransferRequests.sourceBranchId,
        destinationBranchId: employeeTransferRequests.destinationBranchId,
        requestedBy: employeeTransferRequests.requestedBy,
        requestedByName: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
        requestedAt: employeeTransferRequests.requestedAt,
        // Preserve PostgreSQL microseconds in the cursor; JS Date would lose ties.
        cursorTimestamp: sql<string>`to_char(${employeeTransferRequests.requestedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US')`,
        effectiveDate: employeeTransferRequests.effectiveDate,
        completedAt: employeeTransferRequests.completedAt,
        reason: employeeTransferRequests.reason,
        status: employeeTransferRequests.status,
      }).from(employeeTransferRequests)
        .innerJoin(branchEmployees, eq(employeeTransferRequests.employeeId, branchEmployees.id))
        .leftJoin(users, eq(employeeTransferRequests.requestedBy, users.id))
        .where(and(
          inArray(employeeTransferRequests.sourceBranchId, ids), inArray(employeeTransferRequests.destinationBranchId, ids),
          branchId === undefined ? undefined : or(eq(employeeTransferRequests.sourceBranchId, branchId as string), eq(employeeTransferRequests.destinationBranchId, branchId as string)),
          cursor ? or(sql`${employeeTransferRequests.requestedAt} < ${cursor.at}::timestamp`,
            and(sql`${employeeTransferRequests.requestedAt} = ${cursor.at}::timestamp`, lt(employeeTransferRequests.id, cursor.id))) : undefined,
        ))
        .orderBy(desc(employeeTransferRequests.requestedAt), desc(employeeTransferRequests.id)).limit(limit + 1);
      const hasMore = rows.length > limit;
      const transfers = rows.slice(0, limit);
      if (!transfers.length) return respond([], false, null);
      const history = await db.select({
        id: transferHistory.id, transferId: transferHistory.transferId,
        eventType: transferHistory.eventType, performedBy: transferHistory.performedBy,
        performedByName: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
        eventTimestamp: transferHistory.eventTimestamp, details: transferHistory.details,
      }).from(transferHistory)
        .leftJoin(users, eq(transferHistory.performedBy, users.id))
        .where(inArray(transferHistory.transferId, transfers.map(t => t.id)))
        .orderBy(desc(transferHistory.eventTimestamp), desc(transferHistory.id));
      const last = transfers[transfers.length - 1];
      const nextCursor = hasMore ? Buffer.from(JSON.stringify({
        at: last.cursorTimestamp, id: last.id, branchId: branchId ?? null,
      })).toString("base64url") : null;
      respond(transfers.map(({ cursorTimestamp: _cursorTimestamp, ...transfer }) => ({
        ...transfer, history: history.filter(h => h.transferId === transfer.id),
      })), hasMore, nextCursor);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR")
        return res.status(400).json({ error: "مؤشر الصفحة غير صالح؛ أعد تحميل سجل النقل" });
      if (employeeTransferSchemaNotReady(error)) return res.status(503).json(EMPLOYEE_TRANSFER_SCHEMA_ERROR);
      console.error("Operations HR transfers error:", error);
      res.status(500).json({ error: "تعذر تحميل سجل النقل" });
    }
  });

  app.post("/api/operations-hr/transfers", isAuthenticated, managerOnly, requirePermission("operations_hr", "view"), requirePermission("operations_employee_transfer", "create"), async (req, res) => {
    const { employeeId, sourceBranchId, destinationBranchId, reason } = req.body ?? {};
    if (!Number.isSafeInteger(employeeId) || employeeId < 1 || typeof sourceBranchId !== "string" || typeof destinationBranchId !== "string"
        || typeof reason !== "string" || !reason.trim() || reason.length > 500)
      return res.status(400).json({ error: "حدد الموظف وفرع النقل وسبباً لا يتجاوز 500 حرف" });
    const allowed = operationsHrBranches(req);
    if (!allowed.includes(sourceBranchId) || !allowed.includes(destinationBranchId)) return res.status(403).json({ error: "فرع المصدر أو الوجهة خارج نطاق الصلاحية" });
    try {
      const result = await db.transaction(async tx => {
        // Serialize simultaneous transfers of the same employee; validate the
        // source after acquiring the lock, not against an old UI selection.
        await assertEmployeeTransferSchemaReady(tx);
        const employee = await lockTransferEmployee(tx, employeeId);
        if (employee.branchId !== sourceBranchId) throw new Error("STALE_SOURCE");
        if (!transferWithinOperationsScope(employee.branchId, destinationBranchId, allowed)) throw new Error("OUT_OF_SCOPE");
        const [pending] = await tx.select({ id: employeeTransferRequests.id }).from(employeeTransferRequests)
          .where(and(eq(employeeTransferRequests.employeeId, employeeId), inArray(employeeTransferRequests.status, OPEN_TRANSFER_STATUSES))).limit(1);
        if (pending) throw new Error("TRANSFER_ALREADY_PENDING");
        await validateTransferAccount(tx, employee);
        const now = new Date();
        const [transfer] = await tx.insert(employeeTransferRequests).values({
          employeeId, sourceBranchId: employee.branchId, destinationBranchId,
          requestedBy: req.currentUser.id, effectiveDate: now.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }),
          reason: reason.trim(), status: "completed", currentApproverRole: null,
          completedAt: now,
        }).returning();
        await moveTransferEmployee(tx, employee, destinationBranchId, now);
        await tx.insert(transferHistory).values({
          transferId: transfer.id, eventType: "completed", performedBy: req.currentUser.id,
          details: { employeeId, sourceBranchId: employee.branchId, destinationBranchId, reason: reason.trim() },
        });
        return transfer;
      });
      res.status(201).json(result);
    } catch (error: any) {
      if (employeeTransferSchemaNotReady(error)) return res.status(503).json(EMPLOYEE_TRANSFER_SCHEMA_ERROR);
      if (error?.message === "EMPLOYEE_NOT_FOUND") return res.status(404).json({ error: "الموظف غير موجود" });
      if (error?.message === "STALE_SOURCE") return res.status(409).json({ error: "تغير فرع الموظف منذ عرض الصفحة؛ حدّث القائمة قبل المحاولة مجدداً" });
      if (error?.message === "INACTIVE_EMPLOYEE") return res.status(409).json({ error: "لا يمكن نقل موظف غير نشط؛ راجع شؤون الموظفين" });
      if (error?.message === "TRANSFER_ALREADY_PENDING")
        return res.status(409).json({ code: "TRANSFER_ALREADY_PENDING", error: "للموظف طلب نقل قيد المعالجة لدى شؤون الموظفين؛ يجب إكماله أو إلغاؤه قبل تنفيذ نقل آخر" });
      if (error?.message === "OUT_OF_SCOPE") return res.status(403).json({ error: "فرع المصدر أو الوجهة خارج نطاق الصلاحية أو مطابق له" });
      if (error?.message === "LINKED_ACCOUNT_NEEDS_HR")
        return res.status(409).json({ error: "حساب الموظف مرتبط بصلاحيات فروع؛ يتطلب تنسيق النقل مع شؤون الموظفين لتحديث وصوله" });
      console.error("Operations HR transfer error:", error);
      res.status(500).json({ error: "تعذر إتمام النقل؛ لم تُحفظ تغييرات جزئية" });
    }
  });
}