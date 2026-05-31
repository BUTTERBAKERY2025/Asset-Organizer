import type { Express } from "express";
import { db } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter } from "./auth";
import {
  branchEmployees,
  branches,
  leaveRequests,
  advanceRequests,
  salaryDeductions,
  users,
} from "@shared/schema";
import { z } from "zod";

function getUserId(req: any): string | null {
  return (req as any).currentUser?.id || (req as any).user?.id || (req as any).user?.claims?.sub || null;
}

// Find the employee record linked to the currently logged-in user account.
async function getMyEmployee(req: any) {
  const userId = getUserId(req);
  if (!userId) return null;
  const [emp] = await db
    .select()
    .from(branchEmployees)
    .where(eq(branchEmployees.linkedUserId, userId))
    .limit(1);
  return emp || null;
}

export function registerSelfServiceRoutes(app: Express) {
  // ========================================================================
  // بوابة الموظف الذاتية — Employee Self-Service
  // كل المسارات هنا محصورة على ملف الموظف المرتبط بحساب المستخدم الحالي فقط.
  // ========================================================================

  // ملف الموظف الخاص بالمستخدم الحالي
  app.get("/api/my/profile", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json({ hasEmployee: false, employee: null, branch: null });
      const [branch] = await db.select().from(branches).where(eq(branches.id, emp.branchId));
      res.json({
        hasEmployee: true,
        employee: {
          id: emp.id,
          employeeName: emp.employeeName,
          employeeNumber: emp.employeeNumber,
          jobTitle: emp.jobTitle,
          department: emp.department,
          branchId: emp.branchId,
          status: emp.status,
          hireDate: emp.hireDate,
          iqamaExpiry: emp.iqamaExpiry,
          healthCertificateExpiry: emp.healthCertificateExpiry,
        },
        branch: branch ? { id: branch.id, name: branch.name } : null,
      });
    } catch (e: any) {
      console.error("[my/profile] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ---- إجازاتي (تستخدم نفس جدول leave_requests) ----
  app.get("/api/my/leaves", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      const rows = await db
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.branchEmployeeId, emp.id))
        .orderBy(desc(leaveRequests.createdAt))
        .limit(500);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/leaves] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/my/leaves", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const schema = z.object({
        leaveType: z.enum(["annual", "sick", "emergency", "maternity", "paternity", "unpaid", "hajj", "marriage", "bereavement", "other"]),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
        totalDays: z.number().positive("عدد الأيام يجب أن يكون موجباً"),
        reason: z.string().optional(),
        attachmentUrl: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      if (parsed.endDate < parsed.startDate) {
        return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      }
      const [created] = await db.insert(leaveRequests).values({
        branchEmployeeId: emp.id,
        branchId: emp.branchId,
        leaveType: parsed.leaveType,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        totalDays: parsed.totalDays,
        reason: parsed.reason,
        attachmentUrl: parsed.attachmentUrl,
        status: "pending",
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[my/leaves] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/my/leaves/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id, 10);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing || existing.branchEmployeeId !== emp.id) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }
      // Atomic guard: only cancel when still pending AND owned by this employee.
      const updated = await db.update(leaveRequests)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(
          eq(leaveRequests.id, id),
          eq(leaveRequests.branchEmployeeId, emp.id),
          eq(leaveRequests.status, "pending"),
        ))
        .returning();
      if (updated.length === 0) {
        return res.status(400).json({ error: "لا يمكن إلغاء طلب تمت معالجته" });
      }
      res.json(updated[0]);
    } catch (e: any) {
      console.error("[my/leaves] cancel error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ---- طلبات السلف الخاصة بي ----
  app.get("/api/my/advance-requests", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      const rows = await db
        .select()
        .from(advanceRequests)
        .where(eq(advanceRequests.branchEmployeeId, emp.id))
        .orderBy(desc(advanceRequests.createdAt))
        .limit(500);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/advance-requests] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/my/advance-requests", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const schema = z.object({
        amount: z.number().positive("المبلغ يجب أن يكون موجب"),
        requestedMonth: z.string().regex(/^\d{4}-\d{2}$/, "صيغة الشهر يجب أن تكون YYYY-MM"),
        installments: z.number().int().positive().optional(),
        reason: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const [created] = await db.insert(advanceRequests).values({
        branchEmployeeId: emp.id,
        branchId: emp.branchId,
        amount: parsed.amount,
        requestedMonth: parsed.requestedMonth,
        installments: parsed.installments ?? 1,
        reason: parsed.reason,
        status: "pending",
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[my/advance-requests] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/my/advance-requests/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id, 10);
      const [existing] = await db.select().from(advanceRequests).where(eq(advanceRequests.id, id));
      if (!existing || existing.branchEmployeeId !== emp.id) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }
      // Atomic guard: only cancel when still pending AND owned by this employee.
      const updated = await db.update(advanceRequests)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(
          eq(advanceRequests.id, id),
          eq(advanceRequests.branchEmployeeId, emp.id),
          eq(advanceRequests.status, "pending"),
        ))
        .returning();
      if (updated.length === 0) {
        return res.status(400).json({ error: "لا يمكن إلغاء طلب تمت معالجته" });
      }
      res.json(updated[0]);
    } catch (e: any) {
      console.error("[my/advance-requests] cancel error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // مراجعة طلبات السلف (للمدير) — محمية بصلاحية hr_advances
  // ========================================================================
  app.get("/api/hr/advance-requests", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const f = getEffectiveBranchFilter(req);
      const branchIds = f.branchIds;
      const status = req.query.status as string | undefined;

      const conds: any[] = [];
      if (branchIds !== null) {
        if (branchIds.length === 0) return res.json([]);
        conds.push(inArray(advanceRequests.branchId, branchIds));
      }
      if (status) conds.push(eq(advanceRequests.status, status));

      const rows = await db
        .select({
          r: advanceRequests,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
          reviewerName: users.firstName,
        })
        .from(advanceRequests)
        .leftJoin(branchEmployees, eq(advanceRequests.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(advanceRequests.branchId, branches.id))
        .leftJoin(users, eq(advanceRequests.reviewedBy, users.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(advanceRequests.createdAt))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.r,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
        reviewerName: r.reviewerName,
      })));
    } catch (e: any) {
      console.error("[hr/advance-requests] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/advance-requests/:id/review", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const decision = z.object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      }).parse(req.body);

      const f = getEffectiveBranchFilter(req);
      const branchIds = f.branchIds;

      const [existing] = await db.select().from(advanceRequests).where(eq(advanceRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع هذا الطلب" });
      }
      if (existing.status !== "pending") {
        return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });
      }

      const reviewerId = getUserId(req) || undefined;

      if (decision.decision === "rejected") {
        // Atomic guard: only reject if still pending.
        const updated = await db.update(advanceRequests).set({
          status: "rejected",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewerNote: decision.note,
          updatedAt: new Date(),
        }).where(and(eq(advanceRequests.id, id), eq(advanceRequests.status, "pending"))).returning();
        if (updated.length === 0) {
          return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });
        }
        return res.json(updated[0]);
      }

      // approved — أنشئ خصم راتب مرتبط داخل معاملة ذرية.
      // نبدأ بتحديث محروس (status='pending') لضمان عدم اعتماد الطلب مرتين
      // وإنشاء خصم مكرر عند المعالجة المتزامنة.
      const result = await db.transaction(async (tx) => {
        const claimed = await tx.update(advanceRequests).set({
          status: "approved",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewerNote: decision.note,
          updatedAt: new Date(),
        }).where(and(eq(advanceRequests.id, id), eq(advanceRequests.status, "pending"))).returning();

        if (claimed.length === 0) return null; // عُولج بالفعل من طلب آخر متزامن

        const [deduction] = await tx.insert(salaryDeductions).values({
          branchEmployeeId: existing.branchEmployeeId,
          branchId: existing.branchId,
          month: existing.requestedMonth,
          type: "advance",
          amount: existing.amount,
          description: `سلفة معتمدة من بوابة الموظف${existing.reason ? ` — ${existing.reason}` : ""}`,
          createdBy: reviewerId,
        }).returning();

        const [linked] = await tx.update(advanceRequests).set({
          linkedDeductionId: deduction.id,
        }).where(eq(advanceRequests.id, id)).returning();

        return linked;
      });

      if (!result) {
        return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });
      }
      res.json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/advance-requests] review error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
