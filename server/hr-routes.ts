import type { Express } from "express";
import { db } from "./db";
import { eq, and, desc, sql, inArray, gte, lte, lt } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter } from "./auth";
import {
  employeeDocuments,
  leaveRequests,
  employeeWarnings,
  eosCalculations,
  salaryDeductions,
  branchEmployees,
  branches,
  users,
  jobOffers,
  employmentApplications,
  onboardingNotifications,
  attendanceRecords,
  financialPeriods,
  insertEmployeeDocumentSchema,
  insertLeaveRequestSchema,
  insertEmployeeWarningSchema,
  insertEosCalculationSchema,
  insertSalaryDeductionSchema,
} from "@shared/schema";
import { z } from "zod";

function getUserId(req: any): string | null {
  return (req as any).user?.id || (req as any).user?.claims?.sub || null;
}

function isAdmin(req: any): boolean {
  return (req as any).user?.role === "admin";
}

/**
 * Returns branch IDs the user can access, or null for all-access (admin).
 */
function getBranchScope(req: any): { branchIds: string[] | null; hasAccess: boolean } {
  const f = getEffectiveBranchFilter(req);
  return { branchIds: f.branchIds, hasAccess: f.hasAccess };
}

function applyBranchScope<T extends { branchId: any }>(table: T, branchIds: string[] | null) {
  if (branchIds === null) return undefined;
  if (branchIds.length === 0) return sql`false`;
  return inArray((table as any).branchId, branchIds);
}

export function registerHrRoutes(app: Express) {
  // ========================================================================
  // 1) وثائق الموظفين  /api/hr/documents
  // ========================================================================
  app.get("/api/hr/documents", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const docType = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;

      const conds: any[] = [];
      const scopeCond = applyBranchScope(employeeDocuments, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(employeeDocuments.branchEmployeeId, employeeId));
      if (docType) conds.push(eq(employeeDocuments.documentType, docType));
      if (status) conds.push(eq(employeeDocuments.status, status));

      const rows = await db
        .select({
          doc: employeeDocuments,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
        })
        .from(employeeDocuments)
        .leftJoin(branchEmployees, eq(employeeDocuments.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(employeeDocuments.branchId, branches.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(employeeDocuments.createdAt))
        .limit(1000);

      // Auto-update status based on expiry
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const enriched = rows.map((r) => {
        let computedStatus = r.doc.status;
        if (r.doc.expiryDate) {
          if (r.doc.expiryDate < today) computedStatus = "expired";
          else if (r.doc.expiryDate <= thirtyDaysOut) computedStatus = "expiring_soon";
        }
        return { ...r.doc, employeeName: r.employeeName, employeeJob: r.employeeJob, branchName: r.branchName, computedStatus };
      });

      res.json(enriched);
    } catch (e: any) {
      console.error("[hr/documents] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/documents", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const parsed = insertEmployeeDocumentSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      // Validate employee belongs to accessible branch
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية لإدارة وثائق هذا الموظف" });
      }
      const [created] = await db.insert(employeeDocuments).values({
        ...parsed,
        branchId: parsed.branchId || emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/documents] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/documents/:id", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, id));
      if (!existing) return res.status(404).json({ error: "الوثيقة غير موجودة" });
      if (branchIds !== null && (!existing.branchId || !branchIds.includes(existing.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const partial = insertEmployeeDocumentSchema.partial().parse(req.body);
      const [updated] = await db.update(employeeDocuments)
        .set({ ...partial, updatedAt: new Date() })
        .where(eq(employeeDocuments.id, id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/documents] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/documents/:id", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, id));
      if (!existing) return res.status(404).json({ error: "الوثيقة غير موجودة" });
      if (branchIds !== null && (!existing.branchId || !branchIds.includes(existing.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/documents] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إحصائيات الوثائق (للوحة HR)
  app.get("/api/hr/documents/stats", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(employeeDocuments, branchIds);
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const all = await db.select().from(employeeDocuments).where(scopeCond);
      const total = all.length;
      const expired = all.filter(d => d.expiryDate && d.expiryDate < today).length;
      const expiringSoon = all.filter(d => d.expiryDate && d.expiryDate >= today && d.expiryDate <= thirtyDaysOut).length;
      const byType: Record<string, number> = {};
      all.forEach(d => { byType[d.documentType] = (byType[d.documentType] || 0) + 1; });
      res.json({ total, expired, expiringSoon, byType });
    } catch (e: any) {
      console.error("[hr/documents/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 2) طلبات الإجازات  /api/hr/leaves
  // ========================================================================
  app.get("/api/hr/leaves", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const status = req.query.status as string | undefined;
      const leaveType = req.query.type as string | undefined;
      const branchId = req.query.branchId as string | undefined;

      const conds: any[] = [];
      const scopeCond = applyBranchScope(leaveRequests, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(leaveRequests.branchEmployeeId, employeeId));
      if (status) conds.push(eq(leaveRequests.status, status));
      if (leaveType) conds.push(eq(leaveRequests.leaveType, leaveType));
      if (branchId) conds.push(eq(leaveRequests.branchId, branchId));

      const rows = await db
        .select({
          leave: leaveRequests,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
          reviewerName: users.firstName,
        })
        .from(leaveRequests)
        .leftJoin(branchEmployees, eq(leaveRequests.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(leaveRequests.branchId, branches.id))
        .leftJoin(users, eq(leaveRequests.reviewedBy, users.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(leaveRequests.createdAt))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.leave,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
        reviewerName: r.reviewerName,
      })));
    } catch (e: any) {
      console.error("[hr/leaves] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/leaves", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const parsed = insertLeaveRequestSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      if (parsed.endDate < parsed.startDate) {
        return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      }
      const [created] = await db.insert(leaveRequests).values({
        ...parsed,
        branchId: emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // الموافقة/الرفض
  app.post("/api/hr/leaves/:id/review", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const decision = z.object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "pending") {
        return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });
      }
      const [updated] = await db.update(leaveRequests).set({
        status: decision.decision,
        reviewedBy: getUserId(req) || undefined,
        reviewedAt: new Date(),
        reviewerNote: decision.note,
        updatedAt: new Date(),
      }).where(eq(leaveRequests.id, id)).returning();
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] review error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/leaves/:id", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status === "approved" && !isAdmin(req)) {
        return res.status(400).json({ error: "لا يمكن تعديل طلب معتمد" });
      }
      const partial = insertLeaveRequestSchema.partial().parse(req.body);
      const [updated] = await db.update(leaveRequests)
        .set({ ...partial, updatedAt: new Date() })
        .where(eq(leaveRequests.id, id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/leaves/:id", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/leaves] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/leaves/stats", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(leaveRequests, branchIds);
      const all = await db.select().from(leaveRequests).where(scopeCond);
      const total = all.length;
      const pending = all.filter(l => l.status === "pending").length;
      const approved = all.filter(l => l.status === "approved").length;
      const rejected = all.filter(l => l.status === "rejected").length;
      const today = new Date().toISOString().slice(0, 10);
      const onLeaveToday = all.filter(l => l.status === "approved" && l.startDate <= today && l.endDate >= today).length;
      const byType: Record<string, number> = {};
      all.forEach(l => { byType[l.leaveType] = (byType[l.leaveType] || 0) + 1; });
      res.json({ total, pending, approved, rejected, onLeaveToday, byType });
    } catch (e: any) {
      console.error("[hr/leaves/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 3) الإنذارات والمخالفات  /api/hr/warnings
  // ========================================================================
  app.get("/api/hr/warnings", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const status = req.query.status as string | undefined;
      const level = req.query.level as string | undefined;
      const branchId = req.query.branchId as string | undefined;

      const conds: any[] = [];
      const scopeCond = applyBranchScope(employeeWarnings, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(employeeWarnings.branchEmployeeId, employeeId));
      if (status) conds.push(eq(employeeWarnings.status, status));
      if (level) conds.push(eq(employeeWarnings.level, level));
      if (branchId) conds.push(eq(employeeWarnings.branchId, branchId));

      const rows = await db
        .select({
          warning: employeeWarnings,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
          issuerName: users.firstName,
        })
        .from(employeeWarnings)
        .leftJoin(branchEmployees, eq(employeeWarnings.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(employeeWarnings.branchId, branches.id))
        .leftJoin(users, eq(employeeWarnings.issuedBy, users.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(employeeWarnings.issuedDate))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.warning,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
        issuerName: r.issuerName,
      })));
    } catch (e: any) {
      console.error("[hr/warnings] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/warnings", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const parsed = insertEmployeeWarningSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const safeBranchId = emp.branchId;
      const [created] = await db.insert(employeeWarnings).values({
        ...parsed,
        branchId: safeBranchId,
        issuedBy: parsed.issuedBy || getUserId(req) || undefined,
      }).returning();

      // إذا فيه deductionAmount → ينشئ خصم في salary_deductions تلقائياً (شهر إصدار الإنذار)
      if (parsed.deductionAmount && parsed.deductionAmount > 0) {
        const month = parsed.issuedDate.slice(0, 7);
        await db.insert(salaryDeductions).values({
          branchEmployeeId: parsed.branchEmployeeId,
          branchId: safeBranchId,
          month,
          type: "penalty",
          amount: parsed.deductionAmount,
          description: `جزاء على إنذار: ${parsed.reason}`,
          createdBy: getUserId(req) || undefined,
        });
      }

      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/warnings] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/warnings/:id", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const partial = insertEmployeeWarningSchema.partial().parse(req.body);
      const [updated] = await db.update(employeeWarnings)
        .set({ ...partial, updatedAt: new Date() })
        .where(eq(employeeWarnings.id, id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/warnings] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/warnings/:id/acknowledge", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const sig = z.object({ signature: z.string().optional() }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const [updated] = await db.update(employeeWarnings).set({
        acknowledgedAt: new Date(),
        acknowledgedSignature: sig.signature,
        updatedAt: new Date(),
      }).where(eq(employeeWarnings.id, id)).returning();
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/warnings] acknowledge error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/warnings/:id", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      await db.delete(employeeWarnings).where(eq(employeeWarnings.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/warnings] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/warnings/stats", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(employeeWarnings, branchIds);
      const all = await db.select().from(employeeWarnings).where(scopeCond);
      const total = all.length;
      const active = all.filter(w => w.status === "active").length;
      const byLevel: Record<string, number> = {};
      all.forEach(w => { byLevel[w.level] = (byLevel[w.level] || 0) + 1; });
      const totalDeductions = all.reduce((s, w) => s + (w.deductionAmount || 0), 0);
      res.json({ total, active, byLevel, totalDeductions });
    } catch (e: any) {
      console.error("[hr/warnings/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 4) السلف والقروض  /api/hr/advances  (يستخدم salary_deductions)
  // ========================================================================
  app.get("/api/hr/advances", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const month = req.query.month as string | undefined;
      const type = req.query.type as string | undefined;

      const conds: any[] = [
        inArray(salaryDeductions.type, ["advance", "loan_installment"]),
      ];
      const scopeCond = applyBranchScope(salaryDeductions, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(salaryDeductions.branchEmployeeId, employeeId));
      if (month) conds.push(eq(salaryDeductions.month, month));
      if (type) conds.push(eq(salaryDeductions.type, type));

      const rows = await db
        .select({
          d: salaryDeductions,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
        })
        .from(salaryDeductions)
        .leftJoin(branchEmployees, eq(salaryDeductions.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(salaryDeductions.branchId, branches.id))
        .where(and(...conds))
        .orderBy(desc(salaryDeductions.createdAt))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.d,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
      })));
    } catch (e: any) {
      console.error("[hr/advances] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/advances", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const parsed = insertSalaryDeductionSchema.parse(req.body);
      if (!["advance", "loan_installment"].includes(parsed.type)) {
        return res.status(400).json({ error: "النوع يجب أن يكون: سلفة أو قسط قرض" });
      }
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const [created] = await db.insert(salaryDeductions).values({
        ...parsed,
        branchId: emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/advances] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/advances/:id", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(salaryDeductions).where(eq(salaryDeductions.id, id));
      if (!existing) return res.status(404).json({ error: "السلفة غير موجودة" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      await db.delete(salaryDeductions).where(eq(salaryDeductions.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/advances] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/advances/stats", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(salaryDeductions, branchIds);
      const conds: any[] = [inArray(salaryDeductions.type, ["advance", "loan_installment"])];
      if (scopeCond !== undefined) conds.push(scopeCond);
      const all = await db.select().from(salaryDeductions).where(and(...conds));
      const total = all.length;
      const totalAmount = all.reduce((s, d) => s + (d.amount || 0), 0);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const thisMonthAmount = all.filter(d => d.month === thisMonth).reduce((s, d) => s + (d.amount || 0), 0);
      res.json({ total, totalAmount, thisMonthAmount });
    } catch (e: any) {
      console.error("[hr/advances/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 5) نهاية الخدمة (EOS)  /api/hr/eos
  // ========================================================================

  // محسب EOS (يحسب فقط بدون حفظ — للمعاينة)
  app.post("/api/hr/eos/calculate", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const schema = z.object({
        branchEmployeeId: z.number(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        terminationType: z.enum(["resignation", "termination", "end_of_contract", "retirement", "death"]),
        basicSalary: z.number().optional(),
        totalSalary: z.number().optional(),
        vacationBalance: z.number().optional(),
        otherDues: z.number().optional(),
        totalDeductions: z.number().optional(),
      });
      const input = schema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, input.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }

      const startDate = (emp as any).hireDate;
      if (!startDate) return res.status(400).json({ error: "تاريخ التعيين غير محدد للموظف" });
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(input.endDate).getTime();
      const years = Math.max(0, (endMs - startMs) / (365.25 * 24 * 60 * 60 * 1000));

      const basic = input.basicSalary ?? (emp as any).salary ?? 0;
      const total = input.totalSalary ?? (emp as any).totalSalary ?? (emp as any).salary ?? basic;

      // نظام العمل السعودي:
      // - الفصل/نهاية عقد/تقاعد/وفاة: نصف شهر لكل سنة من الـ5 الأولى، شهر كامل لكل سنة بعدها (بناءً على الراتب الكامل)
      // - الاستقالة: 1/3 إذا 2-5 سنوات، 2/3 إذا 5-10 سنوات، كامل إذا 10+ سنوات؛ لا شيء إذا أقل من سنتين
      let eosAmount = 0;
      const firstFive = Math.min(5, years);
      const afterFive = Math.max(0, years - 5);
      const fullEos = (basic * 0.5 * firstFive) + (basic * 1 * afterFive);

      if (input.terminationType === "resignation") {
        if (years < 2) eosAmount = 0;
        else if (years < 5) eosAmount = fullEos / 3;
        else if (years < 10) eosAmount = (fullEos * 2) / 3;
        else eosAmount = fullEos;
      } else {
        eosAmount = fullEos;
      }

      const dailyRate = total / 30;
      const vacationAmount = (input.vacationBalance || 0) * dailyRate;
      const netAmount = eosAmount + vacationAmount + (input.otherDues || 0) - (input.totalDeductions || 0);

      res.json({
        startDate,
        totalServiceYears: parseFloat(years.toFixed(3)),
        basicSalary: basic,
        totalSalary: total,
        eosAmount: parseFloat(eosAmount.toFixed(2)),
        vacationBalance: input.vacationBalance || 0,
        vacationAmount: parseFloat(vacationAmount.toFixed(2)),
        otherDues: input.otherDues || 0,
        totalDeductions: input.totalDeductions || 0,
        netAmount: parseFloat(netAmount.toFixed(2)),
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/eos/calculate] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/eos", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const status = req.query.status as string | undefined;
      const conds: any[] = [];
      const scopeCond = applyBranchScope(eosCalculations, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (status) conds.push(eq(eosCalculations.status, status));

      const rows = await db
        .select({
          eos: eosCalculations,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
        })
        .from(eosCalculations)
        .leftJoin(branchEmployees, eq(eosCalculations.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(eosCalculations.branchId, branches.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(eosCalculations.createdAt))
        .limit(500);

      res.json(rows.map(r => ({
        ...r.eos,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
      })));
    } catch (e: any) {
      console.error("[hr/eos] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/eos", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const parsed = insertEosCalculationSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const [created] = await db.insert(eosCalculations).values({
        ...parsed,
        branchId: emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/eos] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/eos/:id/approve", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(eosCalculations).where(eq(eosCalculations.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const [updated] = await db.update(eosCalculations).set({
        status: "approved",
        approvedBy: getUserId(req) || undefined,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(eosCalculations.id, id)).returning();
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/eos] approve error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/eos/:id/pay", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(eosCalculations).where(eq(eosCalculations.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (existing.status !== "approved") return res.status(400).json({ error: "يجب اعتماد المستحقات أولاً" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const [updated] = await db.update(eosCalculations).set({
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(eosCalculations.id, id)).returning();
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/eos] pay error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/eos/:id", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(eosCalculations).where(eq(eosCalculations.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status === "paid" && !isAdmin(req)) {
        return res.status(400).json({ error: "لا يمكن حذف مستحقات تم دفعها" });
      }
      await db.delete(eosCalculations).where(eq(eosCalculations.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/eos] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // HR HUB BUNDLE  /api/hr/hub-bundle
  // Consolidates all HR Hub KPIs into a single parallel query to replace
  // the 11+ separate network round-trips the page used to make on mount.
  // Each section is independently try/catch'd so one failure doesn't kill
  // the whole response. Scoped by user's effective branch filter.
  // ========================================================================
  app.get("/api/hr/hub-bundle", isAuthenticated, requirePermission("hr_management"), async (req, res) => {
    try {
      const queryBranchId = (req.query.branchId as string | undefined) || undefined;
      const filter = getEffectiveBranchFilter(req, queryBranchId);
      if (!filter.hasAccess) {
        return res.status(403).json({ error: "ليس لديك صلاحية الوصول" });
      }
      const branchIds = filter.branchIds; // null = all, [] = none
      const scopedBranchId = filter.singleBranchId || queryBranchId || null;
      const todayDate = new Date();
      const today = todayDate.toISOString().slice(0, 10);
      const thirtyOut = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7);
      // Previous month YYYY-MM (e.g., 2026-04 if today is 2026-05-23)
      const prevMonthDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
      const prevMonth = prevMonthDate.toISOString().slice(0, 7);
      const prevMonthNum = prevMonthDate.getMonth() + 1;
      const prevMonthYear = prevMonthDate.getFullYear();
      // Last 7 days range
      const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      // Current month start date (for hires-this-month vs prev-month)
      const thisMonthStart = `${thisMonth}-01`;
      const prevMonthStart = `${prevMonth}-01`;

      const empCond = applyBranchScope(branchEmployees, branchIds);
      const docCond = applyBranchScope(employeeDocuments, branchIds);
      const leaveCond = applyBranchScope(leaveRequests, branchIds);
      const warnCond = applyBranchScope(employeeWarnings, branchIds);
      const advCond = applyBranchScope(salaryDeductions, branchIds);
      const eosCond = applyBranchScope(eosCalculations, branchIds);
      const offerCond = applyBranchScope(jobOffers, branchIds);
      // employmentApplications uses targetBranchId (not branchId) — custom scope
      const appCond = branchIds === null
        ? undefined
        : (branchIds.length === 0 ? sql`false` : inArray(employmentApplications.targetBranchId, branchIds));
      // branches list scoped to user's accessible branches (admins see all)
      const branchListCond = branchIds === null
        ? undefined
        : (branchIds.length === 0 ? sql`false` : inArray(branches.id, branchIds));
      // attendance scoped by date + branch
      const attDateCond = eq(attendanceRecords.attendanceDate, today);
      const attCond = scopedBranchId
        ? and(attDateCond, eq(attendanceRecords.branchId, scopedBranchId))
        : (branchIds === null
            ? attDateCond
            : (branchIds.length === 0 ? sql`false` : and(attDateCond, inArray(attendanceRecords.branchId, branchIds))));

      // PERF: per-section timeout (12s) so a single slow query never blocks the
      // whole bundle. Fallback is returned + logged instead of failing the response.
      const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await Promise.race([
            p,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error("section_timeout_12s")), 12000)),
          ]);
        } catch (e: any) {
          console.error("[hub-bundle section]", e?.message);
          return fallback;
        }
      };

      const [
        employees, branchesList, docs, leaves, warns, advs, eosRows,
        attRows, applications, offers, acceptedOffers,
      ] = await Promise.all([
        safe(db.select().from(branchEmployees).where(empCond), [] as any[]),
        safe(db.select().from(branches).where(branchListCond), [] as any[]),
        safe(db.select().from(employeeDocuments).where(docCond), [] as any[]),
        safe(db.select().from(leaveRequests).where(leaveCond), [] as any[]),
        safe(db.select().from(employeeWarnings).where(warnCond), [] as any[]),
        safe(db.select().from(salaryDeductions).where(
          advCond ? and(advCond, inArray(salaryDeductions.type, ["advance", "loan_installment"]))
                  : inArray(salaryDeductions.type, ["advance", "loan_installment"]),
        ), [] as any[]),
        safe(db.select().from(eosCalculations).where(eosCond), [] as any[]),
        safe(db.select().from(attendanceRecords).where(attCond), [] as any[]),
        safe(db.select({ id: employmentApplications.id, status: employmentApplications.status }).from(employmentApplications).where(appCond), [] as any[]),
        safe(db.select({ id: jobOffers.id, status: jobOffers.status }).from(jobOffers).where(offerCond), [] as any[]),
        safe(db.select({ id: jobOffers.id }).from(jobOffers).where(offerCond ? and(offerCond, eq(jobOffers.status, "accepted")) : eq(jobOffers.status, "accepted")), [] as any[]),
      ]);

      // ── Comparisons & chart aggregations (parallel, additive — failures don't break the page) ──
      const attLast7Cond = and(
        gte(attendanceRecords.attendanceDate, sevenDaysAgo),
        lte(attendanceRecords.attendanceDate, today),
        scopedBranchId
          ? eq(attendanceRecords.branchId, scopedBranchId)
          : (branchIds === null ? sql`true` : (branchIds.length === 0 ? sql`false` : inArray(attendanceRecords.branchId, branchIds))),
      );
      const prevMonthAttCond = and(
        gte(attendanceRecords.attendanceDate, prevMonthStart),
        lte(attendanceRecords.attendanceDate, `${prevMonth}-31`),
        scopedBranchId
          ? eq(attendanceRecords.branchId, scopedBranchId)
          : (branchIds === null ? sql`true` : (branchIds.length === 0 ? sql`false` : inArray(attendanceRecords.branchId, branchIds))),
      );
      const thisMonthAttCond = and(
        gte(attendanceRecords.attendanceDate, thisMonthStart),
        lte(attendanceRecords.attendanceDate, today),
        scopedBranchId
          ? eq(attendanceRecords.branchId, scopedBranchId)
          : (branchIds === null ? sql`true` : (branchIds.length === 0 ? sql`false` : inArray(attendanceRecords.branchId, branchIds))),
      );

      const [
        weeklyAttRows,
        prevMonthAttAgg,
        thisMonthAttAgg,
        thisMonthHiresAgg,
        prevMonthHiresAgg,
        thisMonthAppsAgg,
        prevMonthAppsAgg,
        prevMonthAdvAgg,
        appsByStatusRows,
        thisMonthDeductionsByEmp,
        thisMonthAbsenceDaysByEmp,
      ] = await Promise.all([
        // Weekly attendance grouped by date + status
        safe(
          db.select({
            d: attendanceRecords.attendanceDate,
            status: attendanceRecords.status,
            c: sql<number>`count(*)::int`,
          }).from(attendanceRecords).where(attLast7Cond)
            .groupBy(attendanceRecords.attendanceDate, attendanceRecords.status),
          [] as any[],
        ),
        // Prev-month attendance rate (present vs total)
        safe(
          db.select({
            total: sql<number>`count(*)::int`,
            present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
          }).from(attendanceRecords).where(prevMonthAttCond),
          [{ total: 0, present: 0 }] as any[],
        ),
        // This-month attendance rate (month-to-date) — for fairer comparison
        safe(
          db.select({
            total: sql<number>`count(*)::int`,
            present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
          }).from(attendanceRecords).where(thisMonthAttCond),
          [{ total: 0, present: 0 }] as any[],
        ),
        // Hires created this month
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(branchEmployees)
            .where(and(empCond ?? sql`true`, gte(branchEmployees.createdAt, new Date(thisMonthStart)))),
          [{ c: 0 }] as any[],
        ),
        // Hires created prev month (half-open: [prevMonthStart, thisMonthStart) )
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(branchEmployees)
            .where(and(
              empCond ?? sql`true`,
              gte(branchEmployees.createdAt, new Date(prevMonthStart)),
              lt(branchEmployees.createdAt, new Date(thisMonthStart)),
            )),
          [{ c: 0 }] as any[],
        ),
        // Employment applications this month
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(employmentApplications)
            .where(and(appCond ?? sql`true`, gte(employmentApplications.createdAt, new Date(thisMonthStart)))),
          [{ c: 0 }] as any[],
        ),
        // Employment applications prev month (half-open: [prevMonthStart, thisMonthStart) )
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(employmentApplications)
            .where(and(
              appCond ?? sql`true`,
              gte(employmentApplications.createdAt, new Date(prevMonthStart)),
              lt(employmentApplications.createdAt, new Date(thisMonthStart)),
            )),
          [{ c: 0 }] as any[],
        ),
        // Prev-month advances total
        safe(
          db.select({ amt: sql<number>`coalesce(sum(${salaryDeductions.amount}),0)::numeric` })
            .from(salaryDeductions)
            .where(and(
              advCond ?? sql`true`,
              inArray(salaryDeductions.type, ["advance", "loan_installment"]),
              eq(salaryDeductions.month, prevMonth),
            )),
          [{ amt: 0 }] as any[],
        ),
        // Hiring funnel: applications grouped by status (current month)
        safe(
          db.select({
            status: employmentApplications.status,
            c: sql<number>`count(*)::int`,
          }).from(employmentApplications)
            .where(and(appCond ?? sql`true`, gte(employmentApplications.createdAt, new Date(thisMonthStart))))
            .groupBy(employmentApplications.status),
          [] as any[],
        ),
        // Current-month salary deductions of ALL types, summed per employee.
        // Used to deduct from the gross monthly salary invoice for active staff.
        safe(
          db.select({
            empId: salaryDeductions.branchEmployeeId,
            amt: sql<number>`coalesce(sum(${salaryDeductions.amount}),0)::numeric`,
          }).from(salaryDeductions)
            .where(and(
              advCond ?? sql`true`,
              eq(salaryDeductions.month, thisMonth),
            ))
            .groupBy(salaryDeductions.branchEmployeeId),
          [] as any[],
        ),
        // Current-month absent days per employee (status='absent') — used to
        // compute automatic absence deduction = absent_days × (gross / 30).
        safe(
          db.select({
            empId: attendanceRecords.branchEmployeeId,
            absentDays: sql<number>`count(*)::int`,
          }).from(attendanceRecords)
            .where(and(thisMonthAttCond, eq(attendanceRecords.status, "absent")))
            .groupBy(attendanceRecords.branchEmployeeId),
          [] as any[],
        ),
      ]);
      void prevMonthNum; void prevMonthYear;

      // Employees aggregates
      const totalEmployees = employees.length;
      const activeEmployeesList = employees.filter((e: any) => (e.status || "active") === "active");
      const activeEmployees = activeEmployeesList.length;
      const inactiveEmployees = totalEmployees - activeEmployees;
      const onLeaveCount = employees.filter((e: any) => e.status === "on_leave").length;
      const nationalitiesCount = new Set(employees.map((e: any) => e.nationality).filter(Boolean)).size;

      // ── Monthly Salary Invoice (active employees only, net after deductions) ──
      // gross = basic + housing + transport + food + other allowances
      // manualDeductions = sum of salary_deductions rows for current month
      //   (advance / loan_installment / deduction / penalty / other)
      // absenceDeduction = Σ (absent_days × gross_monthly / 30) for each active emp
      // net = max(0, gross − manualDeductions − absenceDeduction)
      const grossByEmp = new Map<number, number>();
      let salaryGross = 0;
      for (const e of activeEmployeesList) {
        const g = (Number(e.basicSalary ?? e.salary) || 0)
          + (Number(e.housingAllowance) || 0)
          + (Number(e.transportAllowance) || 0)
          + (Number(e.foodAllowance) || 0)
          + (Number(e.otherAllowances) || 0);
        grossByEmp.set(e.id, g);
        salaryGross += g;
      }
      const activeIdSet = new Set<number>(activeEmployeesList.map((e: any) => e.id));
      let salaryManualDeductions = 0;
      for (const r of thisMonthDeductionsByEmp as any[]) {
        if (r.empId != null && activeIdSet.has(Number(r.empId))) {
          salaryManualDeductions += Number(r.amt) || 0;
        }
      }
      let salaryAbsenceDeduction = 0;
      for (const r of thisMonthAbsenceDaysByEmp as any[]) {
        const eid = r.empId != null ? Number(r.empId) : null;
        if (eid != null && activeIdSet.has(eid)) {
          const gross = grossByEmp.get(eid) || 0;
          const days = Number(r.absentDays) || 0;
          salaryAbsenceDeduction += (gross / 30) * days;
        }
      }
      const salaryNet = Math.max(0, salaryGross - salaryManualDeductions - salaryAbsenceDeduction);
      // Backward-compat: `totalSalaries` now reflects the NET payable invoice
      // for active employees after all deductions (was: gross of all employees).
      const totalSalaries = Math.round(salaryNet);
      const salaryInvoice = {
        activeEmployees,
        gross: Math.round(salaryGross),
        manualDeductions: Math.round(salaryManualDeductions),
        absenceDeduction: Math.round(salaryAbsenceDeduction),
        net: Math.round(salaryNet),
      };
      const byNationalityMap: Record<string, number> = {};
      const byJobTitleMap: Record<string, number> = {};
      employees.forEach((e: any) => {
        if (e.nationality) byNationalityMap[e.nationality] = (byNationalityMap[e.nationality] || 0) + 1;
        if (e.jobTitle) byJobTitleMap[e.jobTitle] = (byJobTitleMap[e.jobTitle] || 0) + 1;
      });

      // Documents stats
      const docStats = {
        total: docs.length,
        expired: docs.filter((d: any) => d.expiryDate && d.expiryDate < today).length,
        expiringSoon: docs.filter((d: any) => d.expiryDate && d.expiryDate >= today && d.expiryDate <= thirtyOut).length,
        expiredIqama: docs.filter((d: any) => d.documentType === "iqama" && d.expiryDate && d.expiryDate < today).length,
        expiredHealth: docs.filter((d: any) => d.documentType === "health_certificate" && d.expiryDate && d.expiryDate < today).length,
      };

      // Leaves stats
      const leaveStats = {
        total: leaves.length,
        pending: leaves.filter((l: any) => l.status === "pending").length,
        approved: leaves.filter((l: any) => l.status === "approved").length,
        onLeaveToday: leaves.filter((l: any) => l.status === "approved" && l.startDate <= today && l.endDate >= today).length,
      };

      // Warnings stats
      const warningStats = {
        total: warns.length,
        active: warns.filter((w: any) => w.status === "active").length,
      };

      // Advances stats
      const advanceStats = {
        total: advs.length,
        totalAmount: advs.reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0),
        thisMonthAmount: advs.filter((d: any) => d.month === thisMonth).reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0),
      };

      // Onboarding stats (accepted offers + their notification status)
      let onboardingStats: any = { total: acceptedOffers.length, pending: 0, sent: 0, signed: 0, confirmed: 0, converted: 0 };
      if (acceptedOffers.length > 0) {
        const offerIds = acceptedOffers.map((o: any) => o.id);
        const grouped = await safe(
          db.select({ status: onboardingNotifications.status, c: sql<number>`count(*)::int` })
            .from(onboardingNotifications)
            .where(inArray(onboardingNotifications.jobOfferId, offerIds))
            .groupBy(onboardingNotifications.status),
          [] as any[],
        );
        let withNotif = 0;
        for (const g of grouped) {
          onboardingStats[g.status] = Number(g.c);
          withNotif += Number(g.c);
        }
        onboardingStats.pending = Math.max(0, acceptedOffers.length - withNotif) + (onboardingStats.pending || 0);
      }

      // Attendance today (already filtered)
      // `total` = attendance rows recorded today (any status)
      // `expectedToday` = active employees in scope (the realistic denominator
      //   for "كم حضر اليوم من أصل المتوقع"). Using `total` alone is
      //   misleading when many employees simply have no row yet today.
      // `attendanceRate` uses the larger of (expectedToday, total) so the
      //   percentage reflects coverage against the active workforce, not
      //   just the partial set that has any record.
      const attTotal = attRows.length;
      const attPresent = attRows.filter((r: any) => r.status === "present").length;
      const attLate = attRows.filter((r: any) => r.status === "late").length;
      const attAbsent = attRows.filter((r: any) => r.status === "absent").length;
      const attExpected = Math.max(activeEmployees, attTotal);
      const attendanceToday = {
        date: today,
        total: attTotal,
        expectedToday: attExpected,
        present: attPresent,
        late: attLate,
        absent: attAbsent,
        attendanceRate: attExpected > 0
          ? Math.round(((attPresent + attLate) / attExpected) * 100)
          : 0,
      };

      // EOS list (lightweight — count + draft count)
      const eosStats = {
        total: eosRows.length,
        draft: eosRows.filter((e: any) => e.status === "draft").length,
        pending: eosRows.filter((e: any) => e.status === "pending").length,
      };

      // Monthly Salary Closing — current month status across scoped branches
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curYear = now.getFullYear();
      const periodMonthCond = and(eq(financialPeriods.month, curMonth), eq(financialPeriods.year, curYear));
      const periodCond = branchIds === null
        ? periodMonthCond
        : (branchIds.length === 0 ? sql`false` : and(periodMonthCond, inArray(financialPeriods.branchId, branchIds)));
      const periods = await safe(
        db.select({
          id: financialPeriods.id,
          branchId: financialPeriods.branchId,
          status: financialPeriods.status,
          updatedAt: financialPeriods.updatedAt,
        }).from(financialPeriods).where(periodCond),
        [] as any[],
      );
      const totalScopedBranches = branchIds === null ? branchesList.length : branchIds.length;
      const openCount = periods.filter((p: any) => p.status === "draft" || p.status === "open").length;
      const closedCount = periods.filter((p: any) => p.status === "closed").length;
      const lockedCount = periods.filter((p: any) => p.status === "locked").length;
      const notStartedCount = Math.max(0, totalScopedBranches - periods.length);
      const lastUpdated = periods.reduce((acc: Date | null, p: any) => {
        const t = p.updatedAt ? new Date(p.updatedAt) : null;
        return !acc || (t && t > acc) ? t : acc;
      }, null as Date | null);
      // Monthly salary bill = sum from employees (basic + allowances)
      const totalMonthlySalaries = employees.reduce((s: number, e: any) =>
        s + (Number(e.basicSalary) || 0) + (Number(e.housingAllowance) || 0)
          + (Number(e.transportAllowance) || 0) + (Number(e.otherAllowances) || 0), 0);
      const salaryClosing = {
        month: curMonth,
        year: curYear,
        totalBranches: totalScopedBranches,
        openCount,
        closedCount,
        lockedCount,
        notStartedCount,
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        totalMonthlySalaries,
        employeesCount: employees.filter((e: any) => (e.status || "active") === "active").length,
        progressPercent: totalScopedBranches > 0
          ? Math.round(((closedCount + lockedCount) / totalScopedBranches) * 100)
          : 0,
      };

      // Branches list — minimal payload
      const branchesList2 = branchesList.map((b: any) => ({ id: b.id, name: b.name, nameAr: b.nameAr || null }));

      // Employees minimal payload (drop heavy/sensitive fields)
      const employeesLight = employees.map((e: any) => ({
        id: e.id,
        employeeName: e.employeeName,
        employeeNameEn: e.employeeNameEn,
        phoneNumber: e.phoneNumber,
        status: e.status,
        branchId: e.branchId,
        jobTitle: e.jobTitle,
        nationality: e.nationality,
      }));

      // ── Build comparisons (current vs prev period) ──
      const prevAttTotal = Number((prevMonthAttAgg[0] as any)?.total || 0);
      const prevAttPresent = Number((prevMonthAttAgg[0] as any)?.present || 0);
      const prevAttRate = prevAttTotal > 0 ? Math.round((prevAttPresent / prevAttTotal) * 100) : 0;
      const curAttTotal = Number((thisMonthAttAgg[0] as any)?.total || 0);
      const curAttPresent = Number((thisMonthAttAgg[0] as any)?.present || 0);
      const curAttRate = curAttTotal > 0 ? Math.round((curAttPresent / curAttTotal) * 100) : 0;
      const hiresThisMonth = Number((thisMonthHiresAgg[0] as any)?.c || 0);
      const hiresPrevMonth = Number((prevMonthHiresAgg[0] as any)?.c || 0);
      const appsThisMonth = Number((thisMonthAppsAgg[0] as any)?.c || 0);
      const appsPrevMonth = Number((prevMonthAppsAgg[0] as any)?.c || 0);
      const prevAdvancesAmount = Number((prevMonthAdvAgg[0] as any)?.amt || 0);

      const pctDelta = (cur: number, prev: number): number | null => {
        if (prev === 0) return cur > 0 ? 100 : null;
        return Math.round(((cur - prev) / prev) * 100);
      };

      const comparisons = {
        period: { current: thisMonth, previous: prevMonth },
        attendanceRate: {
          current: curAttRate,
          previous: prevAttRate,
          delta: curAttRate - prevAttRate,
          target: 90,
        },
        hires: {
          current: hiresThisMonth,
          previous: hiresPrevMonth,
          delta: hiresThisMonth - hiresPrevMonth,
          deltaPct: pctDelta(hiresThisMonth, hiresPrevMonth),
        },
        applications: {
          current: appsThisMonth,
          previous: appsPrevMonth,
          delta: appsThisMonth - appsPrevMonth,
          deltaPct: pctDelta(appsThisMonth, appsPrevMonth),
        },
        advances: {
          currentAmount: advanceStats.thisMonthAmount,
          previousAmount: prevAdvancesAmount,
          delta: advanceStats.thisMonthAmount - prevAdvancesAmount,
          deltaPct: pctDelta(advanceStats.thisMonthAmount, prevAdvancesAmount),
        },
      };

      // ── Build chart series ──
      // Weekly attendance: build last 7 days array with present/late/absent counts
      const weeklyAttendance: { date: string; present: number; late: number; absent: number; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const dayRows = weeklyAttRows.filter((r: any) => r.d === d);
        const present = dayRows.filter((r: any) => r.status === "present").reduce((s, r: any) => s + Number(r.c), 0);
        const late = dayRows.filter((r: any) => r.status === "late").reduce((s, r: any) => s + Number(r.c), 0);
        const absent = dayRows.filter((r: any) => r.status === "absent").reduce((s, r: any) => s + Number(r.c), 0);
        weeklyAttendance.push({ date: d, present, late, absent, total: present + late + absent });
      }

      // Cost breakdown: sum of salary components from employees (real schema fields)
      // branchEmployees.salary = الراتب الأساسي ; allowances are separate columns
      const basicTotal = employees.reduce((s: number, e: any) => s + (Number(e.salary) || 0), 0);
      const housingTotal = employees.reduce((s: number, e: any) => s + (Number(e.housingAllowance) || 0), 0);
      const transportTotal = employees.reduce((s: number, e: any) => s + (Number(e.transportAllowance) || 0), 0);
      const foodTotal = employees.reduce((s: number, e: any) => s + (Number(e.foodAllowance) || 0), 0);
      const otherTotal = employees.reduce((s: number, e: any) => s + (Number(e.otherAllowances) || 0), 0);
      const costBreakdown = [
        { name: "الراتب الأساسي", value: Math.round(basicTotal) },
        { name: "بدل السكن", value: Math.round(housingTotal) },
        { name: "بدل النقل", value: Math.round(transportTotal) },
        { name: "بدل الطعام", value: Math.round(foodTotal) },
        { name: "بدلات أخرى", value: Math.round(otherTotal) },
        { name: "سلف وأقساط (شهر حالي)", value: Math.round(advanceStats.thisMonthAmount) },
      ].filter((c) => c.value > 0);

      // Hiring funnel: applications by status this month + offers (sent/accepted) + onboarding
      // Real status taxonomy from employmentApplications: invited/submitted/under_review/shortlisted/interviewed/hired/rejected
      const appsStatusMap: Record<string, number> = {};
      appsByStatusRows.forEach((r: any) => { appsStatusMap[(r.status || "invited").toLowerCase()] = Number(r.c); });
      const totalAppsThisMonth = Object.values(appsStatusMap).reduce((s, n) => s + n, 0);
      const offersSent = offers.filter((o: any) => ["sent", "pending"].includes(o.status)).length;
      const offersAccepted = offers.filter((o: any) => o.status === "accepted").length;
      // Forecast: expected hires next month = avg(this+prev) ; conversion rate from apps to hires
      const conversionRate = appsPrevMonth > 0 ? Math.round((hiresPrevMonth / appsPrevMonth) * 100) : null;
      const forecastNextMonth = Math.round((hiresThisMonth + hiresPrevMonth) / 2);
      // Map real statuses (with legacy aliases) onto funnel stages
      const stageInvited     = (appsStatusMap["invited"] || 0) + (appsStatusMap["new"] || 0) + (appsStatusMap["pending"] || 0);
      const stageSubmitted   = (appsStatusMap["submitted"] || 0);
      const stageUnderReview = (appsStatusMap["under_review"] || 0) + (appsStatusMap["review"] || 0) + (appsStatusMap["shortlisted"] || 0);
      const stageInterviewed = (appsStatusMap["interviewed"] || 0) + (appsStatusMap["interview"] || 0);
      const hiringFunnel = {
        steps: [
          { name: "مدعوّون", value: stageInvited },
          { name: "طلبات مُقدَّمة", value: stageSubmitted },
          { name: "قيد المراجعة", value: stageUnderReview },
          { name: "تمت المقابلة", value: stageInterviewed },
          { name: "عروض مُرسلة", value: offersSent },
          { name: "عروض مقبولة", value: offersAccepted },
          { name: "مباشرة عمل", value: onboardingStats.total || 0 },
        ],
        totals: {
          applicationsThisMonth: totalAppsThisMonth,
          hiresThisMonth,
          hiresPrevMonth,
          conversionRate,
          forecastNextMonth,
        },
      };

      const charts = {
        weeklyAttendance,
        costBreakdown,
        hiringFunnel,
      };

      res.json({
        generatedAt: new Date().toISOString(),
        branchFilter: scopedBranchId || "all",
        employees: employeesLight,
        branches: branchesList2,
        applications,
        jobOffers: offers,
        stats: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees,
          onLeaveCount,
          nationalitiesCount,
          totalSalaries,
          salaryInvoice,
          byNationality: Object.entries(byNationalityMap).map(([nationality, count]) => ({ nationality, count })).sort((a, b) => b.count - a.count),
          byJobTitle: Object.entries(byJobTitleMap).map(([jobTitle, count]) => ({ jobTitle, count })).sort((a, b) => b.count - a.count),
        },
        docStats,
        leaveStats,
        warningStats,
        advanceStats,
        onboardingStats,
        attendanceToday,
        eosStats,
        salaryClosing,
        comparisons,
        charts,
      });
    } catch (e: any) {
      console.error("[hr/hub-bundle] error:", e);
      res.status(500).json({ error: e.message || "فشل في تحميل بيانات لوحة الموارد البشرية" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/hr/ai-insights — رؤى مولّدة بالذكاء الاصطناعي (OpenAI gpt-5)
  // يستقبل لقطة (snapshot) من بيانات الـ hub ويُعيد قائمة رؤى بالعربية
  // Blueprint reference: javascript_openai
  // ──────────────────────────────────────────────────────────────────────────
  // Strict snapshot schema — bounds size + shape, prevents token-cost abuse
  const aiSnapshotSchema = z.object({
    totals: z.object({
      totalEmployees: z.number().int().nonnegative().max(100000),
      activeEmployees: z.number().int().nonnegative().max(100000),
      inactiveEmployees: z.number().int().nonnegative().max(100000),
      totalSalaries: z.number().nonnegative().max(1e12),
      avgSalary: z.number().nonnegative().max(1e9),
    }),
    recruitment: z.object({
      pendingApplications: z.number().int().nonnegative().max(100000),
      pendingOffers: z.number().int().nonnegative().max(100000),
    }),
    documents: z.object({
      expired: z.number().int().nonnegative().max(100000),
      expiredIqama: z.number().int().nonnegative().max(100000),
      expiredHealth: z.number().int().nonnegative().max(100000),
      expiringSoon: z.number().int().nonnegative().max(100000),
    }),
    warnings: z.object({ active: z.number().int().nonnegative().max(100000) }),
    advances: z.object({ total: z.number().int().nonnegative().max(100000) }),
    leaves: z.object({ pending: z.number().int().nonnegative().max(100000) }),
    attendanceToday: z.object({
      attendanceRate: z.number().min(0).max(100),
      present: z.number().int().nonnegative().max(100000),
      absent: z.number().int().nonnegative().max(100000),
      late: z.number().int().nonnegative().max(100000),
      total: z.number().int().nonnegative().max(100000),
    }).nullable(),
    branches: z.array(z.object({
      name: z.string().max(100),
      employees: z.number().int().nonnegative().max(100000),
    })).max(20),
    comparisons: z.any().optional().nullable(),
    branchFilter: z.string().max(100).optional(),
    generatedAt: z.string().max(40).optional(),
  });

  // Allowed action hrefs returned by the AI (defense-in-depth against prompt-injected links)
  const ALLOWED_AI_HREFS = new Set([
    "/hr/applications", "/hr/job-offers", "/branch-employees", "/attendance-dashboard",
    "/hr/employee-documents", "/hr/warnings", "/employee-reports", "/organizational-structure",
    "/hr/leaves", "/hr/advances", "/hr/eos",
    "/hr/employee-documents?type=iqama&status=expired",
    "/hr/employee-documents?type=health_certificate&status=expired",
  ]);

  app.post("/api/hr/ai-insights", isAuthenticated, requirePermission("hr_management"), async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "AI_NOT_CONFIGURED",
          message: "ميزة المساعد الذكي غير مفعّلة — يلزم ضبط مفتاح OpenAI.",
        });
      }

      // Hard payload limit (≤ 30KB JSON) before Zod, to short-circuit huge bodies
      const rawBodyLen = JSON.stringify(req.body || {}).length;
      if (rawBodyLen > 30_000) {
        return res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "حجم البيانات كبير جداً" });
      }

      const parsedSnap = aiSnapshotSchema.safeParse(req.body?.snapshot);
      if (!parsedSnap.success) {
        return res.status(400).json({
          error: "INVALID_SNAPSHOT",
          message: "snapshot غير صالح",
          details: parsedSnap.error.issues.slice(0, 3),
        });
      }
      const snapshot = parsedSnap.data;

      const OpenAI = (await import("openai")).default;
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const openai = new OpenAI({ apiKey });

      const allowedIcons = [
        "AlertTriangle", "Briefcase", "UserCheck", "TrendingDown", "TrendingUp",
        "Clock", "ShieldAlert", "Wallet", "Building", "Lightbulb",
        "Users", "Calendar", "FileWarning", "Award", "Target",
      ];

      const systemPrompt = `أنت مستشار ذكي لإدارة الموارد البشرية في شركة "Butter Bakery" (مخبوزات) في المملكة العربية السعودية.
ستحلّل لقطة بيانات HR وتُولّد رؤى عملية مختصرة بالعربية الفصحى للإدارة.

الإخراج إلزامياً JSON بالشكل:
{
  "insights": [
    {
      "id": "kebab-case-id-قصير",
      "iconName": "<أحد القيم: ${allowedIcons.join(", ")}>",
      "tone": "warning" | "info" | "success",
      "title": "عنوان قصير (≤ 70 حرف) يتضمن الأرقام إن أمكن",
      "detail": "شرح مختصر (≤ 180 حرف) يفسّر السبب أو التأثير ويقترح إجراءً واضحاً",
      "action": { "label": "نص الزر", "href": "/path" }
    }
  ]
}

قواعد صارمة:
- 3 إلى 5 رؤى فقط، مرتّبة حسب الأولوية (الأخطر أولاً).
- "tone": warning للمخاطر/التأخّر، info للحياد/المتابعة، success للإنجازات.
- استخدم الأرقام الفعلية من اللقطة وقارن بالشهر السابق إن وُجد.
- لا تخترع أرقاماً غير موجودة في اللقطة.
- روابط الإجراءات يجب أن تكون من القائمة المسموحة:
  /hr/applications, /hr/job-offers, /branch-employees, /attendance-dashboard,
  /hr/employee-documents, /hr/warnings, /employee-reports, /organizational-structure,
  /hr/leaves, /hr/advances, /hr/eos
- اعتبر السياق السعودي: الإقامات والشهادات الصحية وامتثال البلدية أولوية قصوى.
- اللهجة: مهنية مباشرة، لا حشو، لا اعتذار، لا إيموجي.`;

      const userPrompt = `لقطة بيانات HR الحالية:\n${JSON.stringify(snapshot, null, 2)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(502).json({ error: "AI_PARSE_FAILED", message: "تعذّر تحليل ردّ المساعد الذكي." });
      }

      const insights = Array.isArray(parsed?.insights) ? parsed.insights : [];
      const cleaned = insights
        .filter((x: any) => x && typeof x.title === "string" && typeof x.detail === "string")
        .slice(0, 5)
        .map((x: any, i: number) => ({
          id: typeof x.id === "string" && x.id.trim() ? x.id : `ai-${i + 1}`,
          iconName: allowedIcons.includes(x.iconName) ? x.iconName : "Lightbulb",
          tone: ["warning", "info", "success"].includes(x.tone) ? x.tone : "info",
          title: String(x.title).slice(0, 140),
          detail: String(x.detail).slice(0, 300),
          action:
            x.action && typeof x.action?.label === "string" && typeof x.action?.href === "string"
              && ALLOWED_AI_HREFS.has(x.action.href)
              ? { label: x.action.label.slice(0, 60), href: x.action.href }
              : undefined,
        }));

      res.json({
        insights: cleaned,
        generatedAt: new Date().toISOString(),
        model: "gpt-5",
      });
    } catch (e: any) {
      console.error("[hr/ai-insights] error:", e);
      const msg = e?.message || "فشل توليد الرؤى بالذكاء الاصطناعي";
      const status = e?.status === 401 || e?.status === 403 ? 503 : 500;
      res.status(status).json({ error: "AI_FAILED", message: msg });
    }
  });
}
