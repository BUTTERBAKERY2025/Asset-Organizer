import type { Express } from "express";
import { db } from "./db";
import { eq, and, desc, inArray, like } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter } from "./auth";
import { storage } from "./storage";
import {
  branchEmployees,
  branches,
  leaveRequests,
  advanceRequests,
  salaryDeductions,
  employeeSchedules,
  attendanceRecords,
  employeeWarnings,
  employeeDocuments,
  incentiveAwards,
  users,
  PORTAL_SETTING_KEYS,
} from "@shared/schema";
import { z } from "zod";

// الشهر الحالي بتوقيت السعودية بصيغة YYYY-MM
function saudiMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit" }).format(new Date());
}
function saudiDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function isValidMonth(m: unknown): m is string {
  return typeof m === "string" && /^\d{4}-\d{2}$/.test(m);
}
async function portalFlag(key: string): Promise<boolean> {
  try {
    return (await storage.getPortalSetting(key)) === "true";
  } catch {
    return false;
  }
}

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
  // بوابة الموظف (للقراءة فقط) — Phase 2
  // ========================================================================

  // إعدادات البوابة المرئية للموظف (هل تظهر صفحة الراتب / هل يسمح بتسجيل الحضور الذاتي)
  app.get("/api/my/portal-config", isAuthenticated, async (req, res) => {
    try {
      const [showSalary, allowSelfCheckin] = await Promise.all([
        portalFlag(PORTAL_SETTING_KEYS.SHOW_SALARY),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_SELF_CHECKIN),
      ]);
      res.json({ showSalary, allowSelfCheckin });
    } catch (e: any) {
      console.error("[my/portal-config] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // نظرة عامة: ملخص الحضور للشهر + التنبيهات + العدادات
  app.get("/api/my/overview", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json({ hasEmployee: false });
      const month = saudiMonth();
      const today = saudiDate();

      const [monthAttendance, todaySchedule, pendingLeaves, pendingAdvances, activeWarnings] = await Promise.all([
        db.select().from(attendanceRecords)
          .where(and(eq(attendanceRecords.branchEmployeeId, emp.id), like(attendanceRecords.attendanceDate, `${month}%`))),
        db.select().from(employeeSchedules)
          .where(and(eq(employeeSchedules.branchEmployeeId, emp.id), eq(employeeSchedules.scheduleDate, today)))
          .limit(1),
        db.select().from(leaveRequests)
          .where(and(eq(leaveRequests.branchEmployeeId, emp.id), eq(leaveRequests.status, "pending"))),
        db.select().from(advanceRequests)
          .where(and(eq(advanceRequests.branchEmployeeId, emp.id), eq(advanceRequests.status, "pending"))),
        db.select().from(employeeWarnings)
          .where(and(eq(employeeWarnings.branchEmployeeId, emp.id), eq(employeeWarnings.status, "active"))),
      ]);

      const attendanceSummary = {
        present: monthAttendance.filter(a => a.status === "present").length,
        late: monthAttendance.filter(a => a.status === "late").length,
        absent: monthAttendance.filter(a => a.status === "absent").length,
        onLeave: monthAttendance.filter(a => a.status === "on_leave").length,
        total: monthAttendance.length,
      };

      // تنبيهات انتهاء الوثائق (الإقامة / الشهادة الصحية)
      const alerts: Array<{ type: string; label: string; date: string }> = [];
      const daysUntil = (d?: string | null) => {
        if (!d) return null;
        const diff = Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / 86400000);
        return diff;
      };
      const iqamaDays = daysUntil(emp.iqamaExpiry);
      if (iqamaDays !== null && iqamaDays <= 60) alerts.push({ type: "iqama", label: "انتهاء الإقامة", date: emp.iqamaExpiry! });
      const healthDays = daysUntil(emp.healthCertificateExpiry);
      if (healthDays !== null && healthDays <= 60) alerts.push({ type: "health", label: "انتهاء الشهادة الصحية", date: emp.healthCertificateExpiry! });

      res.json({
        hasEmployee: true,
        month,
        todayShift: todaySchedule[0] ? {
          isOff: todaySchedule[0].isOff,
          startTime: todaySchedule[0].startTime,
          endTime: todaySchedule[0].endTime,
          shiftType: todaySchedule[0].shiftType,
          status: todaySchedule[0].status,
        } : null,
        attendanceSummary,
        counts: {
          pendingLeaves: pendingLeaves.length,
          pendingAdvances: pendingAdvances.length,
          activeWarnings: activeWarnings.length,
        },
        alerts,
      });
    } catch (e: any) {
      console.error("[my/overview] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // جدولي (الشهر الحالي أو شهر محدد)
  app.get("/api/my/schedule", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      const month = isValidMonth(req.query.month) ? req.query.month : saudiMonth();
      const rows = await db.select().from(employeeSchedules)
        .where(and(eq(employeeSchedules.branchEmployeeId, emp.id), like(employeeSchedules.scheduleDate, `${month}%`)))
        .orderBy(employeeSchedules.scheduleDate)
        .limit(400);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/schedule] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // حضوري (الشهر الحالي أو شهر محدد)
  app.get("/api/my/attendance", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      const month = isValidMonth(req.query.month) ? req.query.month : saudiMonth();
      const rows = await db.select().from(attendanceRecords)
        .where(and(eq(attendanceRecords.branchEmployeeId, emp.id), like(attendanceRecords.attendanceDate, `${month}%`)))
        .orderBy(desc(attendanceRecords.attendanceDate))
        .limit(400);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/attendance] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إنذاراتي
  app.get("/api/my/warnings", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      const rows = await db.select({
        id: employeeWarnings.id,
        level: employeeWarnings.level,
        reason: employeeWarnings.reason,
        description: employeeWarnings.description,
        reasonCategory: employeeWarnings.reasonCategory,
        issuedDate: employeeWarnings.issuedDate,
        status: employeeWarnings.status,
        acknowledgedAt: employeeWarnings.acknowledgedAt,
        signedAt: employeeWarnings.signedAt,
        deductionAmount: employeeWarnings.deductionAmount,
        attachmentUrl: employeeWarnings.attachmentUrl,
        expiresAt: employeeWarnings.expiresAt,
      }).from(employeeWarnings)
        .where(eq(employeeWarnings.branchEmployeeId, emp.id))
        .orderBy(desc(employeeWarnings.issuedDate))
        .limit(200);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/warnings] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // وثائقي + تواريخ انتهاء من ملف الموظف
  app.get("/api/my/documents", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json({ documents: [], expiry: null });
      const documents = await db.select().from(employeeDocuments)
        .where(eq(employeeDocuments.branchEmployeeId, emp.id))
        .orderBy(desc(employeeDocuments.createdAt))
        .limit(200);
      res.json({
        documents,
        expiry: {
          iqamaExpiry: emp.iqamaExpiry,
          healthCertificateExpiry: emp.healthCertificateExpiry,
        },
      });
    } catch (e: any) {
      console.error("[my/documents] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // حوافزي (مرتبطة بحساب المستخدم كـ كاشير)
  app.get("/api/my/incentives", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.json([]);
      const rows = await db.select().from(incentiveAwards)
        .where(eq(incentiveAwards.cashierId, userId))
        .orderBy(desc(incentiveAwards.periodEnd))
        .limit(200);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/incentives] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // راتبي — محجوب خلف إعداد show_salary
  app.get("/api/my/salary", isAuthenticated, async (req, res) => {
    try {
      const showSalary = await portalFlag(PORTAL_SETTING_KEYS.SHOW_SALARY);
      if (!showSalary) return res.status(403).json({ error: "عرض الراتب غير مفعّل", disabled: true });
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const month = isValidMonth(req.query.month) ? req.query.month : saudiMonth();
      const deductions = await db.select().from(salaryDeductions)
        .where(and(eq(salaryDeductions.branchEmployeeId, emp.id), eq(salaryDeductions.month, month)))
        .orderBy(desc(salaryDeductions.createdAt));
      const totalDeductions = deductions.reduce((s, d) => s + (d.amount || 0), 0);
      res.json({
        month,
        components: {
          salary: emp.salary,
          housingAllowance: emp.housingAllowance || 0,
          transportAllowance: emp.transportAllowance || 0,
          foodAllowance: emp.foodAllowance || 0,
          otherAllowances: emp.otherAllowances || 0,
          socialInsuranceDeduction: emp.socialInsuranceDeduction || 0,
          totalSalary: emp.totalSalary,
        },
        deductions: deductions.map(d => ({ id: d.id, type: d.type, amount: d.amount, description: d.description, month: d.month })),
        totalDeductions,
      });
    } catch (e: any) {
      console.error("[my/salary] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // تسجيل الحضور الذاتي من الجوال — Phase 3
  // ========================================================================

  // حالة اليوم: سجل الحضور + جدول اليوم + هل مسموح التسجيل الذاتي
  app.get("/api/my/attendance/today", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json({ hasEmployee: false });
      const allowSelfCheckin = await portalFlag(PORTAL_SETTING_KEYS.ALLOW_SELF_CHECKIN);
      const today = saudiDate();
      const empId = `branch_emp_${emp.id}`;

      const [todaySchedule] = await db.select().from(employeeSchedules)
        .where(and(eq(employeeSchedules.branchEmployeeId, emp.id), eq(employeeSchedules.scheduleDate, today)))
        .limit(1);

      const [record] = await db.select().from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, empId), eq(attendanceRecords.attendanceDate, today)))
        .limit(1);

      const [branch] = await db.select().from(branches).where(eq(branches.id, emp.branchId));

      res.json({
        hasEmployee: true,
        allowSelfCheckin,
        today,
        schedule: todaySchedule ? {
          id: todaySchedule.id,
          isOff: todaySchedule.isOff,
          startTime: todaySchedule.startTime,
          endTime: todaySchedule.endTime,
          shiftType: todaySchedule.shiftType,
        } : null,
        attendance: record ? {
          id: record.id,
          actualCheckIn: record.actualCheckIn,
          actualCheckOut: record.actualCheckOut,
          status: record.status,
          lateMinutes: record.lateMinutes,
        } : null,
        branch: branch ? {
          name: branch.name,
          hasLocation: !!(branch.latitude && branch.longitude),
          locationRadius: branch.locationRadius || 200,
        } : null,
      });
    } catch (e: any) {
      console.error("[my/attendance/today] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  const selfCheckinSchema = z.object({
    signature: z.string().min(100, "التوقيع مطلوب").max(500000, "التوقيع كبير جداً"),
    userLatitude: z.number({ required_error: "الموقع مطلوب" }),
    userLongitude: z.number({ required_error: "الموقع مطلوب" }),
    biometricVerified: z.boolean().optional(),
  });

  // مسافة Haversine بالأمتار
  function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // تسجيل حضوري
  app.post("/api/my/attendance/check-in", isAuthenticated, async (req, res) => {
    try {
      const allowSelfCheckin = await portalFlag(PORTAL_SETTING_KEYS.ALLOW_SELF_CHECKIN);
      if (!allowSelfCheckin) return res.status(403).json({ error: "تسجيل الحضور الذاتي غير مفعّل" });

      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      if (!emp.branchId) return res.status(400).json({ error: "ملف الموظف غير مرتبط بفرع" });

      const parsed = selfCheckinSchema.parse(req.body);

      const [branch] = await db.select().from(branches).where(eq(branches.id, emp.branchId));
      if (!branch) return res.status(400).json({ error: "الفرع غير موجود" });
      if (!branch.latitude || !branch.longitude) {
        return res.status(400).json({ error: "لم يتم تحديد موقع الفرع. تواصل مع الإدارة." });
      }
      const allowedRadius = branch.locationRadius || 200;
      const distance = distanceMeters(parsed.userLatitude, parsed.userLongitude, branch.latitude, branch.longitude);
      if (distance > allowedRadius) {
        return res.status(400).json({
          error: `الموقع خارج النطاق المسموح (${Math.round(distance)} متر من الفرع، المسموح: ${allowedRadius} متر)`,
        });
      }

      const today = saudiDate();
      const [todaySchedule] = await db.select().from(employeeSchedules)
        .where(and(eq(employeeSchedules.branchEmployeeId, emp.id), eq(employeeSchedules.scheduleDate, today)))
        .limit(1);

      const record = await storage.checkInEmployee(
        `branch_emp_${emp.id}`,
        emp.branchId,
        parsed.signature,
        todaySchedule?.id,
        todaySchedule?.startTime || undefined,
        todaySchedule?.endTime || undefined,
        emp.employeeName,
        today,
      );

      if (parsed.biometricVerified && record?.id) {
        try {
          await storage.updateAttendanceRecord(record.id, { biometricVerified: true, biometricCheckIn: true });
        } catch {}
      }

      res.status(201).json(record);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0]?.message || "بيانات غير صحيحة" });
      const msg = e?.message || "فشل تسجيل الحضور";
      console.error("[my/attendance/check-in] error:", msg);
      res.status(400).json({ error: msg });
    }
  });

  // تسجيل انصرافي
  app.post("/api/my/attendance/check-out", isAuthenticated, async (req, res) => {
    try {
      const allowSelfCheckin = await portalFlag(PORTAL_SETTING_KEYS.ALLOW_SELF_CHECKIN);
      if (!allowSelfCheckin) return res.status(403).json({ error: "تسجيل الحضور الذاتي غير مفعّل" });

      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });

      const parsed = selfCheckinSchema.parse(req.body);

      if (emp.branchId) {
        const [branch] = await db.select().from(branches).where(eq(branches.id, emp.branchId));
        if (branch?.latitude && branch?.longitude) {
          const allowedRadius = branch.locationRadius || 200;
          const distance = distanceMeters(parsed.userLatitude, parsed.userLongitude, branch.latitude, branch.longitude);
          if (distance > allowedRadius) {
            return res.status(400).json({
              error: `الموقع خارج النطاق المسموح (${Math.round(distance)} متر من الفرع، المسموح: ${allowedRadius} متر)`,
            });
          }
        }
      }

      const today = saudiDate();
      const [todaySchedule] = await db.select().from(employeeSchedules)
        .where(and(eq(employeeSchedules.branchEmployeeId, emp.id), eq(employeeSchedules.scheduleDate, today)))
        .limit(1);

      const record = await storage.checkOutEmployee(`branch_emp_${emp.id}`, parsed.signature, todaySchedule?.id, today);
      if (!record) return res.status(400).json({ error: "لا يوجد تسجيل حضور لهذا اليوم" });
      res.json(record);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0]?.message || "بيانات غير صحيحة" });
      const msg = e?.message || "فشل تسجيل الانصراف";
      console.error("[my/attendance/check-out] error:", msg);
      res.status(400).json({ error: msg });
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
