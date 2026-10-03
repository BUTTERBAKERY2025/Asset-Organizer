import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { and, eq, or, isNull, inArray } from "drizzle-orm";
import { branchStock, warehouseItems, employeeSchedules } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated, requirePermission, getAllowedBranchIds, contextualActionAllowed } from "./auth";
import { updateCatalogueBranchStock } from "./catalogue-branch-stock";

/** Limited desks never borrow authority from the assigned branches list. */
export function delegatedBranchAllowed(user: { branchId?: string | null }, allowed: string[] | null, branchId: unknown) {
  return typeof branchId === "string" && branchId !== "main_warehouse"
    && branchId === user.branchId && allowed !== null && allowed.includes(branchId);
}
function requestBranchAllowed(req: any, branchId: unknown) {
  const bound = req.authPermissionDecisionSnapshot?.branchTemplates?.some((base: any) => base.branchId === branchId);
  return delegatedBranchAllowed(bound ? { branchId: branchId as string } : req.currentUser,
    getAllowedBranchIds(req), branchId);
}

export const operationalRoster = (e: any) => ({
  id: e.id, employeeName: e.employeeName, branchId: e.branchId,
  linkedUserId: e.linkedUserId, status: e.status,
});
export const operationalAttendance = (r: any) => ({
  id: r.id, employeeId: r.employeeId, branchEmployeeId: r.branchEmployeeId,
  branchId: r.branchId, attendanceDate: r.attendanceDate,
  actualCheckIn: r.actualCheckIn, actualCheckOut: r.actualCheckOut, status: r.status,
});

/** Only the explicitly registered scheduling/clock routes call this guard.
 * The normal module remains authoritative for existing consumers. No aliases,
 * fake permissions, role changes, personnel writes or biometric endpoints.
 */
export function workforcePermission(module: "shifts" | "attendance_check", action: "view" | "create" | "edit"): RequestHandler {
  return async (req, res, next) => {
    let grants = (req as any).authPermissions?.find((p: any) => p.module === "branch_workforce")?.actions ?? [];
    const snapshot = (req as any).authPermissionDecisionSnapshot;
    const requestedBranch = req.method === "GET" ? req.query.branchId
      : req.body?.branchId ?? req.body?.schedules?.[0]?.branchId;
    if (snapshot?.branchTemplates?.length && typeof requestedBranch === "string")
      grants = ["view", "create", "edit"].filter(a =>
        contextualActionAllowed(req, snapshot, "branch_workforce", a, { branchId: requestedBranch }));
    const bulk = req.path === "/api/employee-schedules/bulk";
    const narrow = grants.includes(action) || (bulk && grants.includes("edit"));
    if (!narrow || req.currentUser?.role === "admin") {
      return requirePermission(module, action)(req, res, next);
    }
    try {
      let authorized = false;
      await requirePermission("branch_workforce", bulk && !grants.includes("create") ? "edit" : action)(
        req, res, () => { authorized = true; });
      if (!authorized) return;
      if (req.currentUser?.role === "viewer" && req.method !== "GET")
        return res.status(403).json({ error: "حساب المشاهدة لا يمكنه تعديل بيانات التشغيل" });
      const rows = req.path === "/api/employee-schedules/bulk" ? req.body?.schedules : [req.body];
      const branchId = req.method === "GET" ? req.query.branchId : req.body?.branchId;
      if (req.method === "GET") {
        if (!requestBranchAllowed(req, branchId))
          return res.status(403).json({ error: "الفرع خارج نطاق التفويض" });
        const start = String(req.query.startDate ?? ""), end = String(req.query.endDate ?? "");
        const span = Date.parse(end) - Date.parse(start);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)
          || !Number.isFinite(span) || span < 0 || span > 31 * 86400000)
          return res.status(400).json({ error: "اختر فترة تشغيل صحيحة لا تتجاوز 31 يوماً" });
      } else {
        if (!Array.isArray(rows) || !rows.length || rows.length > 500)
          return res.status(400).json({ error: "بيانات التشغيل غير صالحة" });
        for (const row of rows) {
          const employee = row.branchEmployeeId
            ? await storage.getBranchEmployee(Number(row.branchEmployeeId))
            : typeof row.employeeId === "string" && /^branch_emp_\d+$/.test(row.employeeId)
              ? await storage.getBranchEmployee(Number(row.employeeId.slice(11)))
              : typeof row.employeeId === "string" ? await storage.getBranchEmployeeByLinkedUserId(row.employeeId) : undefined;
          const targetBranch = row.branchId ?? employee?.branchId;
          if (!employee || employee.status !== "active" || employee.branchId !== targetBranch
            || !requestBranchAllowed(req, targetBranch))
            return res.status(403).json({ error: "الموظف أو الفرع خارج نطاق التفويض" });
          const identity = employee.linkedUserId || `branch_emp_${employee.id}`;
          if (row.employeeId !== identity && row.employeeId !== `branch_emp_${employee.id}`)
            return res.status(400).json({ error: "هوية الموظف لا تطابق السجل" });
          if (row.scheduleId) {
            const [schedule] = await db.select().from(employeeSchedules).where(eq(employeeSchedules.id, Number(row.scheduleId)));
            if (!schedule || schedule.branchId !== employee.branchId
              || (schedule.branchEmployeeId ? schedule.branchEmployeeId !== employee.id
                : ![identity, `branch_emp_${employee.id}`].includes(schedule.employeeId))
              || (row.attendanceDate && row.attendanceDate !== schedule.scheduleDate))
              return res.status(403).json({ error: "الجدول لا يخص موظف الفرع" });
            if (!bulk) {
              row.scheduledStartTime = schedule.startTime;
              row.scheduledEndTime = schedule.endTime;
            }
          } else if (!bulk) {
            delete row.scheduledStartTime;
            delete row.scheduledEndTime;
          }
          row.employeeName = employee.employeeName;
          if (req.path === "/api/employee-schedules/bulk") {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(row.scheduleDate ?? "")
              || !row.branchEmployeeId || Number(row.branchEmployeeId) !== employee.id
              || (row.status && row.status !== "scheduled") || req.body.force === true)
              return res.status(400).json({ error: "بيانات الجدول غير صالحة أو تتجاوز التفويض" });
            const existing = await db.select({ id: employeeSchedules.id }).from(employeeSchedules).where(and(
              eq(employeeSchedules.branchId, targetBranch),
              eq(employeeSchedules.scheduleDate, row.scheduleDate),
              or(eq(employeeSchedules.branchEmployeeId, employee.id),
                and(isNull(employeeSchedules.branchEmployeeId), inArray(employeeSchedules.employeeId, [identity, `branch_emp_${employee.id}`]))),
            ));
            if (existing.length && !grants.includes("edit"))
              return res.status(403).json({ error: "تعديل جدول موجود يتطلب صلاحية التعديل" });
            if (!existing.length && !grants.includes("create"))
              return res.status(403).json({ error: "إنشاء جدول يتطلب صلاحية الإنشاء" });
          }
          // Clocking dates/times, geofence, signatures, locks, rest caps and
          // approved leaves remain enforced by the original workflow below.
        }
      }
      res.set("Cache-Control", "private, no-store");
      res.locals.branchWorkforce = true;
      return next();
    } catch {
      return res.status(500).json({ error: "تعذر التحقق من نطاق موظفي الفرع" });
    }
  };
}

export function registerBranchStockDesk(app: Express) {
  app.get("/api/branch-stock-desk", isAuthenticated, requirePermission("branch_stock", "view"), async (req, res) => {
    if (!req.currentUser || !requestBranchAllowed(req, req.query.branchId))
      return res.status(403).json({ error: "الفرع خارج نطاق التفويض" });
    try {
      const rows = await db.select({
        id: branchStock.id, itemId: branchStock.itemId, quantity: branchStock.currentQuantity,
        reservedQuantity: branchStock.reservedQuantity, lastUpdated: branchStock.lastUpdated,
        name: warehouseItems.name, unit: warehouseItems.unit, isActive: warehouseItems.isActive,
      }).from(branchStock).innerJoin(warehouseItems, eq(branchStock.itemId, warehouseItems.id))
        .where(eq(branchStock.branchId, String(req.query.branchId)));
      res.set("Cache-Control", "private, no-store");
      res.json(rows);
    } catch { res.status(500).json({ error: "تعذر تحميل مخزون الفرع" }); }
  });
  const count = z.object({
    branchId: z.string().min(1), itemId: z.number().int().positive(),
    quantity: z.number().finite().nonnegative().refine(n => Math.abs(n * 1e6 - Math.round(n * 1e6)) < 0.001),
    expectedQuantity: z.number().finite().nonnegative(),
  }).strict();
  app.post("/api/branch-stock-desk/count", isAuthenticated, requirePermission("branch_stock", "edit"), async (req, res) => {
    const parsed = count.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "أدخل كمية جرد صحيحة (حتى ست منازل عشرية)" });
    const { branchId, itemId, quantity, expectedQuantity } = parsed.data;
    if (!req.currentUser || !requestBranchAllowed(req, branchId))
      return res.status(403).json({ error: "الفرع خارج نطاق التفويض" });
    try {
      // Use the authoritative stock row and existing audited reconciliation.
      // Serialize the count against receipt/reservation, never create a ledger.
      const result = await updateCatalogueBranchStock(db, branchId, itemId, quantity,
        undefined, req.currentUser.id, { expectedQuantity });
      res.json(result);
    } catch (error: any) {
      const reserved = error.message?.includes("المحجوزة");
      res.status(error.message === "STALE_COUNT" || reserved ? 409 : 500).json({
        error: error.message === "STALE_COUNT" ? "تغير المخزون؛ أعد تحميله قبل اعتماد الجرد"
          : reserved ? "الكمية أقل من المخزون المحجوز"
            : "تعذر اعتماد جرد الفرع",
      });
    }
  });
}