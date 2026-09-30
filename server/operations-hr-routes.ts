import type { Express } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
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

export function operationsPayrollCsv(lines: { branchEmployeeId?: number | null; employeeName: string; grossSalary: number; netSalary: number }[]) {
  const csvCell = (value: unknown) => {
    const text = String(value ?? "");
    // Spreadsheet programs interpret formulas even when cells are quoted.
    const safe = !/^-?\d+(?:\.\d+)?$/.test(text) && /^[\s]*[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = [
    ["رقم الموظف", "الموظف", "الإجمالي", "الصافي"],
    ...lines.map(line => [line.branchEmployeeId ?? "", line.employeeName, line.grossSalary, line.netSalary]),
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
    try {
      const ids = operationsHrBranches(req);
      if (!ids.length) return res.json([]);
      const transfers = await db.select({
        id: employeeTransferRequests.id, employeeId: employeeTransferRequests.employeeId,
        employeeName: branchEmployees.employeeName,
        sourceBranchId: employeeTransferRequests.sourceBranchId,
        destinationBranchId: employeeTransferRequests.destinationBranchId,
        requestedBy: employeeTransferRequests.requestedBy,
        requestedByName: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
        requestedAt: employeeTransferRequests.requestedAt,
        effectiveDate: employeeTransferRequests.effectiveDate,
        reason: employeeTransferRequests.reason,
        status: employeeTransferRequests.status,
      }).from(employeeTransferRequests)
        .innerJoin(branchEmployees, eq(employeeTransferRequests.employeeId, branchEmployees.id))
        .innerJoin(users, eq(employeeTransferRequests.requestedBy, users.id))
        .where(and(inArray(employeeTransferRequests.sourceBranchId, ids), inArray(employeeTransferRequests.destinationBranchId, ids)))
        .orderBy(desc(employeeTransferRequests.requestedAt)).limit(200);
      if (!transfers.length) return res.json([]);
      const history = await db.select({
        id: transferHistory.id, transferId: transferHistory.transferId,
        eventType: transferHistory.eventType, performedBy: transferHistory.performedBy,
        performedByName: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
        eventTimestamp: transferHistory.eventTimestamp, details: transferHistory.details,
      }).from(transferHistory)
        .leftJoin(users, eq(transferHistory.performedBy, users.id))
        .where(inArray(transferHistory.transferId, transfers.map(t => t.id)))
        .orderBy(desc(transferHistory.eventTimestamp));
      res.set("Cache-Control", "no-store").json(transfers.map(t => ({
        ...t, history: history.filter(h => h.transferId === t.id),
      })));
    } catch (error) {
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
        await tx.execute(sql`SELECT id FROM branch_employees WHERE id = ${employeeId} FOR UPDATE`);
        const [employee] = await tx.select().from(branchEmployees).where(eq(branchEmployees.id, employeeId)).limit(1);
        if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");
        if (employee.branchId !== sourceBranchId) throw new Error("STALE_SOURCE");
        if (!transferWithinOperationsScope(employee.branchId, destinationBranchId, allowed)) throw new Error("OUT_OF_SCOPE");
        if (employee.status !== "active") throw new Error("INACTIVE_EMPLOYEE");
        if (employee.linkedUserId) {
          const [account] = await tx.select({ role: users.role }).from(users).where(eq(users.id, employee.linkedUserId)).limit(1);
          if (!account || !["employee", "viewer"].includes(account.role)) throw new Error("LINKED_ACCOUNT_NEEDS_HR");
          const grants = await tx.select({ id: userBranchAccess.id }).from(userBranchAccess).where(eq(userBranchAccess.userId, employee.linkedUserId));
          if (grants.length) throw new Error("LINKED_ACCOUNT_NEEDS_HR");
          const assignments = await tx.select({ id: userAssignments.id }).from(userAssignments)
            .where(and(eq(userAssignments.userId, employee.linkedUserId), eq(userAssignments.isActive, true))).limit(1);
          if (assignments.length) throw new Error("LINKED_ACCOUNT_NEEDS_HR");
        }
        const [transfer] = await tx.insert(employeeTransferRequests).values({
          employeeId, sourceBranchId: employee.branchId, destinationBranchId,
          requestedBy: req.currentUser.id, effectiveDate: new Date().toISOString().slice(0, 10),
          reason: reason.trim(), status: "completed", currentApproverRole: null,
          completedAt: new Date(),
        }).returning();
        await tx.update(branchEmployees).set({ branchId: destinationBranchId, updatedAt: new Date() })
          .where(eq(branchEmployees.id, employeeId));
        if (employee.linkedUserId)
          await tx.update(users).set({ branchId: destinationBranchId }).where(eq(users.id, employee.linkedUserId));
        await tx.insert(transferHistory).values({
          transferId: transfer.id, eventType: "completed", performedBy: req.currentUser.id,
          details: { employeeId, sourceBranchId: employee.branchId, destinationBranchId, reason: reason.trim() },
        });
        return transfer;
      });
      res.status(201).json(result);
    } catch (error: any) {
      if (error?.message === "EMPLOYEE_NOT_FOUND") return res.status(404).json({ error: "الموظف غير موجود" });
      if (error?.message === "STALE_SOURCE") return res.status(409).json({ error: "تغير فرع الموظف منذ عرض الصفحة؛ حدّث القائمة قبل المحاولة مجدداً" });
      if (error?.message === "INACTIVE_EMPLOYEE") return res.status(409).json({ error: "لا يمكن نقل موظف غير نشط؛ راجع شؤون الموظفين" });
      if (error?.message === "OUT_OF_SCOPE") return res.status(403).json({ error: "فرع المصدر أو الوجهة خارج نطاق الصلاحية أو مطابق له" });
      if (error?.message === "LINKED_ACCOUNT_NEEDS_HR")
        return res.status(409).json({ error: "حساب الموظف مرتبط بصلاحيات فروع؛ يتطلب تنسيق النقل مع شؤون الموظفين لتحديث وصوله" });
      console.error("Operations HR transfer error:", error);
      res.status(500).json({ error: "تعذر إتمام النقل؛ لم تُحفظ تغييرات جزئية" });
    }
  });
}