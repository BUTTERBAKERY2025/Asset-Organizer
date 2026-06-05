import type { Express } from "express";
import { db } from "./db";
import { eq, and, desc, inArray, like, isNotNull } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter, parseUserAgent } from "./auth";
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
  notifications,
  users,
  employmentApplications,
  PORTAL_SETTING_KEYS,
} from "@shared/schema";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { notifyEmployeeOfDecision, notifyHrOfRequest } from "./notify-helpers";
import {
  getWarningTemplate,
  getWarningReasonCategory,
  renderWarningBody,
  WARNING_LEGAL_NOTICE,
} from "@shared/warning-templates";

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

      // سجّل دخول الموظف إلى "بوابتي" مرة واحدة لكل جلسة (غير حاجب للطلب).
      if (!(req.session as any).portalAudited) {
        (req.session as any).portalAudited = true;
        const ua = (req.headers["user-agent"] as string) || "";
        const device = parseUserAgent(ua);
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || null;
        storage
          .createSystemAuditLog({
            module: "portal",
            entityId: String(emp.id),
            entityName: emp.employeeName,
            action: "portal_open",
            description: `دخول بوابتي — ${emp.employeeName}`,
            details: JSON.stringify({
              branchId: emp.branchId,
              browser: device.browser,
              os: device.os,
              device: device.device,
            }),
            userId: getUserId(req) || null,
            userName: emp.employeeName,
            ipAddress: ip,
            userAgent: ua,
          })
          .catch((err) => console.error("[my/profile] portal audit failed:", err));
      }

      const [branch] = await db.select().from(branches).where(eq(branches.id, emp.branchId));
      // الصورة: إن لم تكن محفوظة على ملف الموظف، نستعيدها من طلب التوظيف المطابق برقم الجوال.
      // مطابقة دقيقة على آخر 9 أرقام بعد التطبيع، ولا نستخدم الصورة إلا إذا كان هناك تطابق واحد لا لبس فيه
      // (لتفادي تسريب صورة موظف آخر بسبب تشابه الأرقام أو إعادة استخدامها).
      let photoUrl = emp.photoUrl;
      if (!photoUrl && emp.phoneNumber) {
        const last9 = String(emp.phoneNumber).replace(/\D/g, "").slice(-9);
        if (last9.length === 9) {
          const candidates = await db
            .select({ photoUrl: employmentApplications.photoUrl, phone: employmentApplications.phone })
            .from(employmentApplications)
            .where(and(isNotNull(employmentApplications.photoUrl), like(employmentApplications.phone, `%${last9}%`)))
            .orderBy(desc(employmentApplications.createdAt))
            .limit(10);
          const matched = candidates.filter(
            (c) => String(c.phone || "").replace(/\D/g, "").slice(-9) === last9,
          );
          const distinctPhotos = Array.from(new Set(matched.map((c) => c.photoUrl).filter(Boolean)));
          if (distinctPhotos.length === 1) photoUrl = distinctPhotos[0] as string;
        }
      }
      res.json({
        hasEmployee: true,
        employee: {
          id: emp.id,
          employeeName: emp.employeeName,
          employeeNameEn: emp.employeeNameEn,
          employeeNumber: emp.employeeNumber,
          jobTitle: emp.jobTitle,
          department: emp.department,
          branchId: emp.branchId,
          status: emp.status,
          hireDate: emp.hireDate,
          nationality: emp.nationality,
          phoneNumber: emp.phoneNumber,
          photoUrl,
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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.ALLOW_LEAVE_REQUESTS))) {
        return res.status(403).json({ error: "طلبات الإجازات غير مفعّلة حالياً" });
      }
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
      // Notify HR/branch managers of the new request (branch-level in-app) — non-blocking.
      await notifyHrOfRequest(emp, {
        title: "طلب إجازة جديد",
        message: `${emp.employeeName} قدّم طلب إجازة (${parsed.startDate} إلى ${parsed.endDate}).`,
        linkUrl: "/hr/leaves",
        relatedEntityId: created.id,
      });
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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.ALLOW_ADVANCE_REQUESTS))) {
        return res.status(403).json({ error: "طلبات السلف غير مفعّلة حالياً" });
      }
      const schema = z.object({
        amount: z.number().positive("المبلغ يجب أن يكون موجب"),
        requestedMonth: z.string().regex(/^\d{4}-\d{2}$/, "صيغة الشهر يجب أن تكون YYYY-MM"),
        installments: z.number().int().positive().optional(),
        reason: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const maxAdvance = Number(
        (await storage.getPortalSetting(PORTAL_SETTING_KEYS.MAX_ADVANCE_AMOUNT)) ?? "0",
      ) || 0;
      if (maxAdvance > 0 && parsed.amount > maxAdvance) {
        return res.status(400).json({ error: `الحد الأقصى المسموح للسلفة هو ${maxAdvance} ريال` });
      }
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
      // Notify HR/branch managers of the new request (branch-level in-app) — non-blocking.
      await notifyHrOfRequest(emp, {
        title: "طلب سلفة جديد",
        message: `${emp.employeeName} قدّم طلب سلفة بمبلغ ${parsed.amount} ر.س (شهر ${parsed.requestedMonth}).`,
        linkUrl: "/hr/advances",
        relatedEntityId: created.id,
      });
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
      const [
        showSalary, showSchedule, showAttendance, showLeaves, showAdvances,
        showWarnings, showDocuments, showIncentives, allowSelfCheckin,
        allowLeaveRequests, allowAdvanceRequests,
      ] = await Promise.all([
        portalFlag(PORTAL_SETTING_KEYS.SHOW_SALARY),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_SCHEDULE),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_ATTENDANCE),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_LEAVES),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_ADVANCES),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_WARNINGS),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_DOCUMENTS),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_INCENTIVES),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_SELF_CHECKIN),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_LEAVE_REQUESTS),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_ADVANCE_REQUESTS),
      ]);
      const maxAdvanceAmount = Number(
        (await storage.getPortalSetting(PORTAL_SETTING_KEYS.MAX_ADVANCE_AMOUNT)) ?? "0",
      ) || 0;
      const defaultLanguage =
        (await storage.getPortalSetting(PORTAL_SETTING_KEYS.DEFAULT_LANGUAGE)) === "en" ? "en" : "ar";
      res.json({
        showSalary, showSchedule, showAttendance, showLeaves, showAdvances,
        showWarnings, showDocuments, showIncentives, allowSelfCheckin,
        allowLeaveRequests, allowAdvanceRequests, maxAdvanceAmount, defaultLanguage,
      });
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

  // ========================================================================
  // تايم شيت الموظف الشهري — يطّلع الموظف على تقاريره ويوقّع عليها
  // التقارير تُربط بالموظف عبر employeeId (UUID الحساب أو صيغة branch_emp_X)
  // ========================================================================

  // قائمة تقاريري (أحدثها أولاً، بدون الإصدارات المُستبدَلة)
  app.get("/api/my/timesheet-reports", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      const userId = getUserId(req);
      if (!emp || !userId) return res.json([]);
      const candidateIds = [userId, `branch_emp_${emp.id}`];
      const lists = await Promise.all(candidateIds.map((eid) => storage.getTimesheetReports({ employeeId: eid })));
      const byId = new Map<number, any>();
      for (const r of lists.flat()) {
        if (!r.supersededBy) byId.set(r.id, r);
      }
      const reports = Array.from(byId.values()).sort((a, b) =>
        a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : b.id - a.id,
      );
      res.json(reports);
    } catch (e: any) {
      console.error("[my/timesheet-reports] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تفاصيل تقريري + سطوره اليومية (مع تحقق ملكية صارم)
  app.get("/api/my/timesheet-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      const userId = getUserId(req);
      if (!emp || !userId) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const report = await storage.getTimesheetReport(id);
      const owns = report && (report.employeeId === userId || report.employeeId === `branch_emp_${emp.id}`);
      if (!report || !owns) return res.status(404).json({ error: "التقرير غير موجود" });
      const entries = await storage.getTimesheetReportEntries(id);
      res.json({ report, entries });
    } catch (e: any) {
      console.error("[my/timesheet-reports/:id] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // توقيع الموظف على تقريره (لا يحتاج صلاحية وحدة — محصور على صاحب التقرير)
  app.post("/api/my/timesheet-reports/:id/sign", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      const userId = getUserId(req);
      if (!emp || !userId) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const { signature, acknowledgment } = req.body || {};
      if (!signature || typeof signature !== "string") {
        return res.status(400).json({ error: "التوقيع مطلوب" });
      }
      if (signature.length > 500000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }
      const report = await storage.getTimesheetReport(id);
      const owns = report && (report.employeeId === userId || report.employeeId === `branch_emp_${emp.id}`);
      if (!report || !owns) return res.status(404).json({ error: "التقرير غير موجود" });
      if (report.isLocked || report.status === "finalized") {
        return res.status(400).json({ error: "هذا التقرير مكتمل/مقفل ولا يمكن التوقيع عليه" });
      }
      if (report.status === "pending_manager_signature" && report.employeeSignature) {
        return res.status(400).json({ error: "سبق أن وقّعت على هذا التقرير، وهو الآن بانتظار توقيع المدير" });
      }

      const signed = await storage.signTimesheetReport(id, "employee", signature, userId, acknowledgment);
      if (!signed) return res.status(404).json({ error: "التقرير غير موجود" });

      const performerName = emp.employeeName || userId;
      try {
        await storage.createTimesheetAuditLog({
          reportId: id,
          action: "signed_employee",
          performedBy: userId,
          performedByName: performerName,
          ipAddress: (req.ip || (req.headers["x-forwarded-for"] as string) || "").toString().slice(0, 100),
          userAgent: (req.headers["user-agent"] || "").toString().slice(0, 500),
          notes: acknowledgment ? String(acknowledgment).slice(0, 500) : null,
        });
        const branchUsers = await storage.getAllUsers().catch(() => [] as any[]);
        const branchManagers = branchUsers.filter(
          (u: any) => u.branchId === signed.branchId && (u.role === "manager" || u.role === "admin"),
        );
        await Promise.all(
          branchManagers.map((m: any) =>
            storage.createSystemNotification({
              userId: m.id,
              branchId: signed.branchId,
              title: "تقرير دوام بانتظار توقيعك",
              message: `وقّع الموظف ${performerName} على تقرير دوام للفترة ${signed.startDate} - ${signed.endDate}`,
              type: "info",
              category: "system",
              priority: "normal",
              linkType: "meeting",
              linkId: id,
              linkUrl: `/timesheet?reportId=${id}`,
              createdBy: userId,
            }).catch(() => null),
          ),
        );
      } catch (auditErr) {
        console.error("[my/timesheet sign] side-effect failed (non-blocking):", auditErr);
      }

      res.json(signed);
    } catch (e: any) {
      console.error("[my/timesheet-reports/:id/sign] error:", e);
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

  // تفاصيل إنذار واحد للموظف الحالي — على ترويسة الشركة الرسمية
  app.get("/api/my/warnings/:id", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صحيح" });
      const [w] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      // Ownership guard: the warning must belong to the logged-in employee.
      if (!w || w.branchEmployeeId !== emp.id) {
        return res.status(404).json({ error: "الإنذار غير موجود" });
      }
      const [br] = w.branchId ? await db.select().from(branches).where(eq(branches.id, w.branchId)) : [null];
      const template = getWarningTemplate(w.templateId);
      const reason = getWarningReasonCategory(w.reasonCategory);
      const renderedBody = template
        ? renderWarningBody(template.body, { name: emp.employeeName, date: w.issuedDate })
        : null;
      res.json({
        warning: {
          id: w.id, level: w.level, reason: w.reason, description: w.description,
          issuedDate: w.issuedDate, deductionAmount: w.deductionAmount,
          templateId: w.templateId, reasonCategory: w.reasonCategory,
          attachments: w.attachments || [],
          signedAt: w.signedAt, signatureData: w.signatureData,
          status: w.status,
        },
        employee: {
          id: emp.id, employeeName: emp.employeeName, jobTitle: emp.jobTitle,
          nationalId: (emp as any).nationalId,
        },
        branch: br ? { id: br.id, name: br.name, nameAr: (br as any).nameAr } : null,
        template: template ? { id: template.id, label: template.label, body: renderedBody } : null,
        reasonCategoryLabel: reason?.label || null,
        legalNotice: WARNING_LEGAL_NOTICE,
      });
    } catch (e: any) {
      console.error("[my/warnings/:id] error:", e);
      res.status(500).json({ error: "تعذّر تحميل الإنذار" });
    }
  });

  // توقيع الموظف على إنذاره إلكترونيًا من داخل البوابة
  app.post("/api/my/warnings/:id/sign", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صحيح" });
      const body = z.object({
        signatureData: z.string().min(50, "التوقيع مطلوب").max(500_000, "التوقيع كبير جدًا"),
      }).parse(req.body);

      // Ownership guard before any write.
      const [w] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!w || w.branchEmployeeId !== emp.id) {
        return res.status(404).json({ error: "الإنذار غير موجود" });
      }
      // Only active warnings can be signed (not cancelled/expired/appealed).
      if (w.status !== "active") {
        return res.status(400).json({ error: "لا يمكن توقيع هذا الإنذار في حالته الحالية" });
      }

      const ip = String(req.ip || req.socket.remoteAddress || "").slice(0, 64);
      const ua = String(req.headers["user-agent"] || "").slice(0, 256);
      // Atomic single-sign guarantee: the WHERE clause also requires
      // signed_at IS NULL so two concurrent requests can never both succeed.
      const updated = await db.update(employeeWarnings).set({
        signedAt: new Date(),
        signatureData: body.signatureData,
        signedIp: ip || null,
        signedUserAgent: ua || null,
        acknowledgedAt: new Date(), // mirror for back-compat
        updatedAt: new Date(),
      } as any).where(
        and(
          eq(employeeWarnings.id, id),
          eq(employeeWarnings.branchEmployeeId, emp.id),
          eq(employeeWarnings.status, "active"),
          sql`${employeeWarnings.signedAt} IS NULL`,
        ),
      ).returning();
      if (updated.length === 0) {
        const [latest] = await db.select({ signedAt: employeeWarnings.signedAt, status: employeeWarnings.status })
          .from(employeeWarnings).where(eq(employeeWarnings.id, id));
        if (latest?.signedAt) return res.status(409).json({ error: "تم التوقيع على هذا الإنذار مسبقًا" });
        return res.status(400).json({ error: "لا يمكن توقيع هذا الإنذار في حالته الحالية" });
      }
      res.json({ success: true, signedAt: updated[0].signedAt });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0]?.message || "بيانات غير صحيحة" });
      console.error("[my/warnings/:id/sign] error:", e);
      res.status(500).json({ error: "تعذّر حفظ التوقيع" });
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

      // القرار يغيّر الحالة فقط — لا يُنشأ خصم راتب تلقائياً (قرار المستخدم).
      // الحارس الذري (status='pending') يمنع المعالجة المزدوجة عند التزامن.
      const [updated] = await db.update(advanceRequests).set({
        status: decision.decision,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewerNote: decision.note,
        updatedAt: new Date(),
      }).where(and(eq(advanceRequests.id, id), eq(advanceRequests.status, "pending"))).returning();
      if (!updated) {
        return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });
      }

      // إشعار الموظف بالقرار (داخل التطبيق + واتساب) — لا يعطّل الاستجابة.
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      if (emp) {
        const verb = decision.decision === "approved" ? "اعتماد" : "رفض";
        const noteLine = decision.note ? `\nملاحظة: ${decision.note}` : "";
        await notifyEmployeeOfDecision({
          emp,
          title: `تم ${verb} طلب السلفة`,
          message: `طلب السلفة بمبلغ ${existing.amount} ر.س (شهر ${existing.requestedMonth}) تم ${verb}ه.${noteLine}`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
        });
      }
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/advance-requests] review error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // إشعارات بوابة الموظف  /api/my/notifications
  // ========================================================================

  // قائمة إشعارات الموظف الحالي (المرسلة لحسابه عبر userId)
  app.get("/api/my/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "غير مصرح" });
      const rows = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isDismissed, false)))
        .orderBy(desc(notifications.createdAt))
        .limit(100);
      const unreadCount = rows.filter(n => !n.isRead).length;
      res.json({ notifications: rows, unreadCount });
    } catch (e: any) {
      console.error("[my/notifications] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تعليم إشعار كمقروء (يجب أن يكون مملوكاً للموظف الحالي)
  app.post("/api/my/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "غير مصرح" });
      const id = parseInt(req.params.id, 10);
      const [updated] = await db.update(notifications).set({
        isRead: true,
        readAt: new Date(),
      }).where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning();
      if (!updated) return res.status(404).json({ error: "الإشعار غير موجود" });
      res.json(updated);
    } catch (e: any) {
      console.error("[my/notifications] read error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تعليم كل الإشعارات كمقروءة
  app.post("/api/my/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "غير مصرح" });
      await db.update(notifications).set({
        isRead: true,
        readAt: new Date(),
      }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[my/notifications] read-all error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
