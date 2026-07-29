import type { Express } from "express";
import { db } from "./db";
import { eq, and, or, desc, inArray, like, isNotNull, isNull } from "drizzle-orm";
import { isAuthenticated, requirePermission, requireAnyPermission, getEffectiveBranchFilter, parseUserAgent, getCachedPermissionsForUser, HR_SPECIALIST_PERMISSIONS } from "./auth";
import { storage } from "./storage";
import {
  branchEmployees,
  branches,
  leaveRequests,
  leaveSettlements,
  advanceRequests,
  salaryDeductions,
  employeeSchedules,
  attendanceRecords,
  employeeWarnings,
  employeeEvaluations,
  employeeDocuments,
  incentiveAwards,
  notifications,
  users,
  employmentApplications,
  salaryClosures,
  salaryClosureLines,
  PORTAL_SETTING_KEYS,
} from "@shared/schema";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { notifyEmployeeOfDecision, notifyHrOfRequest } from "./notify-helpers";
import { computeLeaveDays, computeLeaveDaysWithHolidays, findOverlappingLeave, getApplicableLeaveChain } from "./leave-helpers";
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
// نافذة السماح للورديات الليلية العابرة لمنتصف الليل (بالساعات).
const OVERNIGHT_GRACE_HOURS = 16;
// تاريخ أمس بتوقيت السعودية (YYYY-MM-DD).
function saudiYesterday(): string {
  const d = new Date(`${saudiDate()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
// وقت السعودية الحالي (التاريخ + الوقت) للمقارنة مع وقت الحضور.
function saudiNowParts(): { date: string; time: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
  return { date, time };
}
// هل ما زال الوقت ضمن نافذة السماح منذ تسجيل الحضور؟
function withinGraceHours(recordDate: string, checkInHHMM: string | null | undefined, hours: number): boolean {
  if (!checkInHHMM) return false;
  const norm = (t: string) => (t.length === 5 ? `${t}:00` : t);
  const np = saudiNowParts();
  const ci = new Date(`${recordDate}T${norm(checkInHHMM)}Z`).getTime();
  const co = new Date(`${np.date}T${norm(np.time)}Z`).getTime();
  if (isNaN(ci) || isNaN(co)) return false;
  const diff = co - ci;
  return diff >= 0 && diff <= hours * 3600 * 1000;
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

// طابق سجلات الحضور بأي من صيغ هوية الموظف الثلاث: النص (branch_emp_<id>) من البوابة،
// أو الرقم (branch_employee_id)، أو معرّف حساب المستخدم المرتبط (UUID) عندما يسجّله المدير
// من صفحة الوردية. دالة موحّدة تُستخدم في كل قراءات الحضور حتى لا تختلف نتائج البوابة عن الوردية.
function attendanceIdentityMatch(branchEmployeeId: number, linkedUserId?: string | null) {
  const forms = [
    eq(attendanceRecords.employeeId, `branch_emp_${branchEmployeeId}`),
    eq(attendanceRecords.branchEmployeeId, branchEmployeeId),
  ];
  // عند تسجيل الحضور من صفحة الوردية قد يُخزَّن employeeId كمعرّف حساب المستخدم
  // المرتبط (UUID) بدل صيغة branch_emp_<id>؛ نطابقه أيضاً (وهو معرّف يخصّ هذا الموظف).
  if (linkedUserId) forms.push(eq(attendanceRecords.employeeId, linkedUserId));
  return or(...forms);
}

// أبقِ سجلاً واحداً لكل يوم (الأحدث = أعلى id) لمنع ازدواج العدّ عند وجود سجلين
// لنفس اليوم (واحد من البوابة وآخر سجّله المدير).
function dedupeAttendanceByDate<T extends { attendanceDate: string; id: number }>(rows: T[]): T[] {
  const byDate = new Map<string, T>();
  for (const r of rows) {
    const ex = byDate.get(r.attendanceDate);
    if (!ex || (r.id ?? 0) > (ex.id ?? 0)) byDate.set(r.attendanceDate, r);
  }
  return Array.from(byDate.values());
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
      if (emp.status === "terminated" || emp.status === "inactive") {
        return res.status(403).json({ error: "لا يمكن تقديم طلب إجازة — الملف الوظيفي غير نشط" });
      }
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
      // منع التداخل مع إجازة أخرى لنفس الموظف
      const overlap = await findOverlappingLeave(emp.id, parsed.startDate, parsed.endDate);
      if (overlap) {
        return res.status(409).json({
          error: `لديك طلب إجازة متداخل مع هذه الفترة (${overlap.startDate} إلى ${overlap.endDate})`,
        });
      }
      // إعادة احتساب الأيام على الخادم (لا نثق بالعميل) — مع استثناء العطلات الرسمية
      const { totalDays, workingDays } = await computeLeaveDaysWithHolidays(parsed.startDate, parsed.endDate);
      // نظام الموافقات والاعتمادات: تطبيق سلسلة الفرع (أو الافتراضية) عند الإنشاء
      const chain = await getApplicableLeaveChain(emp.branchId);
      const [created] = await db.insert(leaveRequests).values({
        branchEmployeeId: emp.id,
        branchId: emp.branchId,
        leaveType: parsed.leaveType,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        totalDays,
        workingDays,
        reason: parsed.reason,
        attachmentUrl: parsed.attachmentUrl,
        status: "pending",
        currentLevel: 1,
        requiredLevels: chain ? chain.length : 1,
        approvalChain: chain ?? null,
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
          inArray(advanceRequests.status, ["pending", "pre_approved", "awaiting_signature"]),
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

  // توقيع الموظف على نموذج السلفة الرسمي (إقرار + توقيع مرسوم)
  app.post("/api/my/advance-requests/:id/sign", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id, 10);
      const body = z.object({
        signatureData: z.string().min(50, "التوقيع مطلوب").regex(/^data:image\/(png|jpeg);base64,/, "صيغة التوقيع غير صحيحة"),
        acknowledged: z.literal(true, { errorMap: () => ({ message: "يجب الإقرار بالموافقة على الاستقطاع" }) }),
      }).parse(req.body);
      if (body.signatureData.length > 500_000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }
      const [existing] = await db.select().from(advanceRequests).where(eq(advanceRequests.id, id));
      if (!existing || existing.branchEmployeeId !== emp.id) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }
      // Atomic guard: sign only while awaiting signature and owned by this employee.
      const updated = await db.update(advanceRequests)
        .set({ status: "signed", signatureData: body.signatureData, signedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(advanceRequests.id, id),
          eq(advanceRequests.branchEmployeeId, emp.id),
          eq(advanceRequests.status, "awaiting_signature"),
        ))
        .returning();
      if (updated.length === 0) {
        return res.status(400).json({ error: "هذا الطلب غير متاح للتوقيع" });
      }
      await notifyHrOfRequest(emp, {
        title: "موظف وقّع نموذج سلفة",
        message: `${emp.employeeName} وقّع نموذج السلفة (${existing.approvedAmount ?? existing.amount} ر.س على ${existing.installmentMonths ?? 1} قسطاً). الطلب جاهز للاعتماد النهائي من إدارة شؤون الموظفين.`,
        linkUrl: "/hr/advances",
        relatedEntityId: id,
      });
      res.json(updated[0]);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[my/advance-requests] sign error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ===== تصفيات الإجازات الخاصة بالموظف (للتوقيع والإقرار بالاستلام) =====
  app.get("/api/my/leave-settlements", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      const rows = await db
        .select({
          id: leaveSettlements.id,
          settledDays: leaveSettlements.settledDays,
          finalAmount: leaveSettlements.finalAmount,
          dailyRate: leaveSettlements.dailyRate,
          settlementDate: leaveSettlements.settlementDate,
          workflowStatus: leaveSettlements.workflowStatus,
          signedAt: leaveSettlements.signedAt,
          disbursedAt: leaveSettlements.disbursedAt,
          leaveStart: leaveRequests.startDate,
          leaveEnd: leaveRequests.endDate,
        })
        .from(leaveSettlements)
        .leftJoin(leaveRequests, eq(leaveSettlements.leaveRequestId, leaveRequests.id))
        .where(and(
          eq(leaveSettlements.branchEmployeeId, emp.id),
          eq(leaveSettlements.status, "active"),
          inArray(leaveSettlements.workflowStatus, ["awaiting_signature", "signed", "disbursed"]),
        ))
        .orderBy(desc(leaveSettlements.id))
        .limit(20);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/leave-settlements] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // توقيع الموظف على تصفية الإجازة + الإقرار بالاستلام
  app.post("/api/my/leave-settlements/:id/sign", isAuthenticated, async (req, res) => {
    try {
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(403).json({ error: "حسابك غير مرتبط بملف موظف" });
      const id = parseInt(req.params.id, 10);
      const body = z.object({
        signatureData: z.string().min(50, "التوقيع مطلوب").regex(/^data:image\/(png|jpeg);base64,/, "صيغة التوقيع غير صحيحة"),
        acknowledged: z.literal(true, { errorMap: () => ({ message: "يجب الإقرار بالاستلام" }) }),
      }).parse(req.body);
      if (body.signatureData.length > 500_000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }
      const [existing] = await db.select().from(leaveSettlements).where(eq(leaveSettlements.id, id));
      if (!existing || existing.branchEmployeeId !== emp.id) {
        return res.status(404).json({ error: "التصفية غير موجودة" });
      }
      // Atomic guard: sign only while awaiting signature and owned by this employee.
      const updated = await db.update(leaveSettlements)
        .set({
          workflowStatus: "signed",
          signatureData: body.signatureData,
          signedAt: new Date(),
          acknowledgedAt: new Date(),
        })
        .where(and(
          eq(leaveSettlements.id, id),
          eq(leaveSettlements.branchEmployeeId, emp.id),
          eq(leaveSettlements.workflowStatus, "awaiting_signature"),
          eq(leaveSettlements.status, "active"),
        ))
        .returning();
      if (updated.length === 0) {
        return res.status(400).json({ error: "هذه التصفية غير متاحة للتوقيع" });
      }
      await notifyHrOfRequest(emp, {
        title: "موظف وقّع تصفية إجازة",
        message: `${emp.employeeName} وقّع تصفية الإجازة (${existing.settledDays} يوم / ${existing.finalAmount} ر.س) وأقرّ بالاستلام. جاهزة لتأكيد الصرف وحفظها ضمن التصفيات المصروفة.`,
        linkUrl: "/hr/leaves",
        relatedEntityId: id,
      });
      res.json({ ...updated[0], signatureData: undefined });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[my/leave-settlements] sign error:", e);
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
        showWarnings, showDocuments, showIncentives, showEvaluations, allowSelfCheckin,
        allowLeaveRequests, allowAdvanceRequests, allowEvaluationAck,
      ] = await Promise.all([
        portalFlag(PORTAL_SETTING_KEYS.SHOW_SALARY),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_SCHEDULE),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_ATTENDANCE),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_LEAVES),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_ADVANCES),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_WARNINGS),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_DOCUMENTS),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_INCENTIVES),
        portalFlag(PORTAL_SETTING_KEYS.SHOW_EVALUATIONS),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_SELF_CHECKIN),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_LEAVE_REQUESTS),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_ADVANCE_REQUESTS),
        portalFlag(PORTAL_SETTING_KEYS.ALLOW_EVALUATION_ACK),
      ]);
      const maxAdvanceAmount = Number(
        (await storage.getPortalSetting(PORTAL_SETTING_KEYS.MAX_ADVANCE_AMOUNT)) ?? "0",
      ) || 0;
      const defaultLanguage =
        (await storage.getPortalSetting(PORTAL_SETTING_KEYS.DEFAULT_LANGUAGE)) === "en" ? "en" : "ar";
      res.json({
        showSalary, showSchedule, showAttendance, showLeaves, showAdvances,
        showWarnings, showDocuments, showIncentives, showEvaluations, allowSelfCheckin,
        allowLeaveRequests, allowAdvanceRequests, allowEvaluationAck, maxAdvanceAmount, defaultLanguage,
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

      const [monthAttendanceRaw, todaySchedule, pendingLeaves, pendingAdvances, activeWarnings] = await Promise.all([
        db.select().from(attendanceRecords)
          .where(and(attendanceIdentityMatch(emp.id, emp.linkedUserId), like(attendanceRecords.attendanceDate, `${month}%`))),
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

      const monthAttendance = dedupeAttendanceByDate(monthAttendanceRaw);

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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_SCHEDULE))) return res.status(403).json({ error: "عرض الجدول غير مفعّل", disabled: true });
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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_ATTENDANCE))) return res.status(403).json({ error: "عرض الحضور غير مفعّل", disabled: true });
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      const month = isValidMonth(req.query.month) ? req.query.month : saudiMonth();
      const rows = await db.select().from(attendanceRecords)
        .where(and(attendanceIdentityMatch(emp.id, emp.linkedUserId), like(attendanceRecords.attendanceDate, `${month}%`)))
        .orderBy(desc(attendanceRecords.attendanceDate))
        .limit(400);
      const deduped = dedupeAttendanceByDate(rows).sort((a, b) =>
        a.attendanceDate < b.attendanceDate ? 1 : a.attendanceDate > b.attendanceDate ? -1 : 0,
      );
      res.json(deduped);
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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_WARNINGS))) return res.status(403).json({ error: "عرض الإنذارات غير مفعّل", disabled: true });
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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_WARNINGS))) return res.status(403).json({ error: "عرض الإنذارات غير مفعّل", disabled: true });
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
          nationalId: emp.iqamaNumber,
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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_DOCUMENTS))) return res.status(403).json({ error: "عرض الوثائق غير مفعّل", disabled: true });
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
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_INCENTIVES))) return res.status(403).json({ error: "عرض الحوافز غير مفعّل", disabled: true });
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

  // تقييماتي المعتمدة — محجوبة خلف إعداد show_evaluations
  app.get("/api/my/evaluations", isAuthenticated, async (req, res) => {
    try {
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_EVALUATIONS))) return res.status(403).json({ error: "عرض التقييمات غير مفعّل", disabled: true });
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      // المعتمدة فقط — المسودات وما ينتظر الاعتماد لا يظهر للموظف
      const rows = await db.select().from(employeeEvaluations)
        .where(and(eq(employeeEvaluations.branchEmployeeId, emp.id), eq(employeeEvaluations.status, "approved")))
        .orderBy(desc(employeeEvaluations.periodStart))
        .limit(50);
      res.json(rows);
    } catch (e: any) {
      console.error("[my/evaluations] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إقرار الموظف بالاطلاع على تقييمه المعتمد
  app.post("/api/my/evaluations/:id/acknowledge", isAuthenticated, async (req, res) => {
    try {
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_EVALUATIONS))) return res.status(403).json({ error: "عرض التقييمات غير مفعّل", disabled: true });
      if (!(await portalFlag(PORTAL_SETTING_KEYS.ALLOW_EVALUATION_ACK))) return res.status(403).json({ error: "الإقرار على التقييم غير مفعّل", disabled: true });
      const emp = await getMyEmployee(req);
      if (!emp) return res.status(404).json({ error: "لا يوجد ملف موظف مرتبط بحسابك" });
      const id = parseInt(req.params.id, 10);
      const comment = typeof req.body?.comment === "string" ? req.body.comment.slice(0, 1000) : null;
      // تحديث ذري: تقييم الموظف نفسه، معتمد، ولم يُقر عليه سابقاً
      const [row] = await db.update(employeeEvaluations)
        .set({ employeeAckAt: new Date(), employeeAckComment: comment, updatedAt: new Date() })
        .where(and(
          eq(employeeEvaluations.id, id),
          eq(employeeEvaluations.branchEmployeeId, emp.id),
          eq(employeeEvaluations.status, "approved"),
          isNull(employeeEvaluations.employeeAckAt),
        ))
        .returning();
      if (!row) return res.status(409).json({ error: "التقييم غير موجود أو سبق الإقرار عليه" });
      await notifyHrOfRequest(emp, {
        title: "موظف اطّلع على تقييمه",
        message: `${emp.employeeName} أقرّ بالاطلاع على تقييم أدائه (${row.periodStart} → ${row.periodEnd})${comment ? ` — تعليقه: ${comment}` : ""}`,
        linkUrl: "/hr/evaluations",
        relatedEntityId: id,
      });
      res.json(row);
    } catch (e: any) {
      console.error("[my/evaluations] acknowledge error:", e);
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

  // قسائم رواتبي المعتمدة (من لقطات إقفال الرواتب المغلقة) — محجوبة خلف إعداد show_salary
  app.get("/api/my/payslips", isAuthenticated, async (req, res) => {
    try {
      if (!(await portalFlag(PORTAL_SETTING_KEYS.SHOW_SALARY))) return res.status(403).json({ error: "عرض الراتب غير مفعّل", disabled: true });
      const emp = await getMyEmployee(req);
      if (!emp) return res.json([]);
      // فقط الإقفالات المغلقة (closed) — المعاد فتحها ليست قسيمة معتمدة
      const rows = await db
        .select({ line: salaryClosureLines, month: salaryClosures.month, closedAt: salaryClosures.closedAt, closureStatus: salaryClosures.status })
        .from(salaryClosureLines)
        .innerJoin(salaryClosures, eq(salaryClosureLines.closureId, salaryClosures.id))
        .where(and(eq(salaryClosureLines.branchEmployeeId, emp.id), eq(salaryClosures.status, "closed")))
        .orderBy(desc(salaryClosures.month))
        .limit(24);
      res.json(rows.map(r => ({
        month: r.month,
        closedAt: r.closedAt,
        presentDays: r.line.presentDays,
        absentDays: r.line.absentDays,
        offDays: r.line.offDays,
        paidLeaveDays: r.line.paidLeaveDays,
        unpaidLeaveDays: r.line.unpaidLeaveDays,
        baseSalary: r.line.baseSalary,
        allowances: r.line.allowances,
        grossSalary: r.line.grossSalary,
        absenceDeduction: r.line.absenceDeduction,
        sickLeaveDeduction: r.line.sickLeaveDeduction || 0,
        socialInsurance: r.line.socialInsurance,
        manualDeductionsTotal: r.line.manualDeductionsTotal,
        manualDeductions: r.line.manualDeductions || [],
        netSalary: r.line.netSalary,
      })));
    } catch (e: any) {
      console.error("[my/payslips] error:", e);
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

      // طابق سجل الحضور بأي من صيغتي هوية الموظف (دالة موحّدة) — والأحدث يفوز.
      let [record] = await db.select().from(attendanceRecords)
        .where(and(eq(attendanceRecords.attendanceDate, today), attendanceIdentityMatch(emp.id, emp.linkedUserId)))
        .orderBy(desc(attendanceRecords.id))
        .limit(1);

      // عبور منتصف الليل: لو ما فيه سجل لليوم، قد تكون هناك وردية ليلية بدأت أمس ولم
      // يُسجَّل انصرافها. أظهرها (ضمن نافذة السماح) ليبقى زر الانصراف فعّالاً بدل أن
      // تُحتسب يوماً جديداً ويحتار الموظف.
      let isOvernightFromYesterday = false;
      let overnightDate: string | null = null;
      if (!record) {
        const yday = saudiYesterday();
        const [y] = await db.select().from(attendanceRecords)
          .where(and(eq(attendanceRecords.attendanceDate, yday), attendanceIdentityMatch(emp.id, emp.linkedUserId)))
          .orderBy(desc(attendanceRecords.id))
          .limit(1);
        if (y && y.actualCheckIn && !y.actualCheckOut &&
            withinGraceHours(y.attendanceDate, y.actualCheckIn, OVERNIGHT_GRACE_HOURS)) {
          record = y;
          isOvernightFromYesterday = true;
          overnightDate = yday;
        }
      }

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
          // true إذا أنشأ السجلَّ الموظف نفسه من البوابة (employeeId=branch_emp_<id>)؛
          // false عندما سجّله المدير من صفحة الوردية بصيغة هوية مختلفة.
          recordedBySelf: record.employeeId === empId,
          isOvernightFromYesterday,
          overnightDate,
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
          bankName: branchEmployees.bankName,
          bankAccountNumber: branchEmployees.bankAccountNumber,
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
        bankName: r.bankName,
        bankAccountNumber: r.bankAccountNumber,
        branchName: r.branchName,
        reviewerName: r.reviewerName,
      })));
    } catch (e: any) {
      console.error("[hr/advance-requests] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // هل يملك المستخدم صلاحية القرار النهائي على السلف؟
  // القرار النهائي محصور في: الأدمن + مدير الموارد البشرية + اختصاصي الموارد البشرية (بصلاحية edit) — فقط.
  // مدير التشغيل وغيرهم = موافقة مبدئية فقط مهما كانت صلاحياتهم.
  async function hasAdvanceFinalAuthority(req: any): Promise<boolean> {
    const user = req.currentUser;
    if (!user) return false;
    if (user.role === "admin" || user.role === "super_admin" || user.role === "hr_manager") return true;
    if (user.role === "hr_specialist") {
      return (HR_SPECIALIST_PERMISSIONS["hr_advances"] || []).includes("edit");
    }
    return false;
  }

  // إضافة أشهر لصيغة YYYY-MM
  function addMonths(month: string, add: number): string {
    const [y, m] = month.split("-").map((v) => parseInt(v, 10));
    const total = y * 12 + (m - 1) + add;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${String(nm).padStart(2, "0")}`;
  }

  // تقسيم متساوٍ: قسط شهري مقرّب لهللتين، والقسط الأخير يمتص الفرق
  function buildInstallmentPlan(amount: number, months: number, startMonth: string) {
    const monthly = Math.round((amount / months) * 100) / 100;
    const plan: Array<{ month: string; amount: number }> = [];
    let allocated = 0;
    for (let i = 0; i < months; i++) {
      const isLast = i === months - 1;
      const a = isLast ? Math.round((amount - allocated) * 100) / 100 : monthly;
      allocated = Math.round((allocated + a) * 100) / 100;
      plan.push({ month: addMonths(startMonth, i), amount: a });
    }
    return { monthly, plan };
  }

  // إرسال الطلب لتوقيع الموظف بعد مراجعة شؤون الموظفين (تعديل القيمة + عدد الأشهر)
  app.post("/api/hr/advance-requests/:id/send-for-signature", isAuthenticated, requireAnyPermission("hr_advances", ["approve", "edit"]), async (req, res) => {
    try {
      if (!(await hasAdvanceFinalAuthority(req))) {
        return res.status(403).json({ error: "مراجعة السلفة وإرسالها للتوقيع من صلاحية إدارة شؤون الموظفين فقط" });
      }
      const id = parseInt(req.params.id, 10);
      const body = z.object({
        approvedAmount: z.number().positive("القيمة المعتمدة يجب أن تكون موجبة"),
        installmentMonths: z.number().int().min(1, "عدد الأشهر يجب أن يكون 1 على الأقل").max(60, "الحد الأقصى 60 شهراً"),
        startMonth: z.string().regex(/^\d{4}-\d{2}$/, "صيغة الشهر يجب أن تكون YYYY-MM"),
        note: z.string().optional(),
      }).parse(req.body);

      const f = getEffectiveBranchFilter(req);
      const [existing] = await db.select().from(advanceRequests).where(eq(advanceRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (f.branchIds !== null && !f.branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع هذا الطلب" });
      }

      const { monthly } = buildInstallmentPlan(body.approvedAmount, body.installmentMonths, body.startMonth);
      const reviewerId = getUserId(req) || undefined;
      const [updated] = await db.update(advanceRequests).set({
        status: "awaiting_signature",
        approvedAmount: body.approvedAmount,
        installmentMonths: body.installmentMonths,
        monthlyInstallment: monthly,
        startMonth: body.startMonth,
        sentForSignatureBy: reviewerId,
        sentForSignatureAt: new Date(),
        reviewerNote: body.note ?? existing.reviewerNote,
        // إعادة الإرسال بعد تعديل تُلغي أي توقيع سابق
        signatureData: null,
        signedAt: null,
        updatedAt: new Date(),
      }).where(and(eq(advanceRequests.id, id), inArray(advanceRequests.status, ["pending", "pre_approved", "awaiting_signature", "signed"]))).returning();
      if (!updated) return res.status(400).json({ error: "لا يمكن إرسال هذا الطلب للتوقيع في حالته الحالية" });

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      if (emp) {
        await notifyEmployeeOfDecision({
          emp,
          title: "طلب السلفة بانتظار توقيعك",
          message: `تمت مراجعة طلب السلفة واعتماد مبلغ ${body.approvedAmount} ر.س على ${body.installmentMonths} قسطاً شهرياً (${monthly} ر.س شهرياً) بدءاً من ${body.startMonth}. الرجاء الدخول لبوابة الموظف وتوقيع نموذج الموافقة.`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
        });
      }
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/advance-requests] send-for-signature error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تحويل السلفة المعتمدة للصرف المالي (الإدارة المالية / الأدمن)
  app.post("/api/hr/advance-requests/:id/disburse", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const user = (req as any).currentUser;
      const allowedRoles = ["admin", "super_admin", "financial_manager", "finance_manager", "hr_manager"];
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "صرف السلفة من صلاحية الإدارة المالية أو الأدمن فقط" });
      }
      const id = parseInt(req.params.id, 10);
      const f = getEffectiveBranchFilter(req);
      const [existing] = await db.select().from(advanceRequests).where(eq(advanceRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (f.branchIds !== null && !f.branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع هذا الطلب" });
      }
      const [updated] = await db.update(advanceRequests).set({
        status: "disbursed",
        disbursedBy: getUserId(req) || undefined,
        disbursedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(advanceRequests.id, id), eq(advanceRequests.status, "approved"))).returning();
      if (!updated) return res.status(400).json({ error: "الصرف متاح فقط للسلف المعتمدة نهائياً" });

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      if (emp) {
        await notifyEmployeeOfDecision({
          emp,
          title: "تم صرف السلفة",
          message: `تم صرف سلفتك بمبلغ ${existing.approvedAmount ?? existing.amount} ر.س من الإدارة المالية.`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
        });
      }
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/advance-requests] disburse error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إدخال سلفة سابقة (قديمة): تُسجل معتمدة مباشرة بدون توقيع، مع خطة أقساط للمتبقي
  app.post("/api/hr/advance-requests/legacy", isAuthenticated, requireAnyPermission("hr_advances", ["create", "edit"]), async (req, res) => {
    try {
      if (!(await hasAdvanceFinalAuthority(req))) {
        return res.status(403).json({ error: "إدخال السلف السابقة من صلاحية إدارة شؤون الموظفين فقط" });
      }
      const body = z.object({
        branchEmployeeId: z.number().int().positive(),
        totalAmount: z.number().positive("قيمة السلفة يجب أن تكون موجبة"),
        repaidAmount: z.number().min(0).default(0),
        installmentMonths: z.number().int().min(1).max(60),
        startMonth: z.string().regex(/^\d{4}-\d{2}$/, "صيغة الشهر يجب أن تكون YYYY-MM"),
        reason: z.string().trim().min(5, "سبب الإدخال إلزامي (5 أحرف على الأقل) — السلف السابقة تُسجَّل بدون توقيع الموظف"),
      }).parse(req.body);
      // ضابط تجاوز التوقيع: السلفة السابقة يجب أن تكون قائمة فعلاً قبل النظام —
      // لا يُسمح ببدء الخصم بعد أكثر من شهرين من الآن (السلفة الجديدة تمر بمسار التوقيع الإلزامي)
      {
        const now = new Date();
        const [sy, sm] = body.startMonth.split("-").map((v) => parseInt(v, 10));
        const diff = (sy * 12 + sm) - (now.getFullYear() * 12 + now.getMonth() + 1);
        if (diff > 2) {
          return res.status(400).json({ error: "شهر بداية الخصم بعيد جداً — السلف السابقة تبدأ خصمها خلال شهرين كحد أقصى. السلف الجديدة تُسجَّل عبر مسار الطلب والتوقيع الإلكتروني" });
        }
      }

      const remaining = Math.round((body.totalAmount - body.repaidAmount) * 100) / 100;
      if (remaining <= 0) return res.status(400).json({ error: "المبلغ المتبقي يجب أن يكون أكبر من صفر" });

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, body.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      const f = getEffectiveBranchFilter(req);
      if (f.branchIds !== null && !f.branchIds.includes(emp.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع هذا الموظف" });
      }

      const { monthly, plan } = buildInstallmentPlan(remaining, body.installmentMonths, body.startMonth);
      const reviewerId = getUserId(req) || undefined;

      const created = await db.transaction(async (tx) => {
        const [row] = await tx.insert(advanceRequests).values({
          branchEmployeeId: emp.id,
          branchId: emp.branchId,
          amount: body.totalAmount,
          reason: body.reason || "سلفة سابقة (إدخال يدوي)",
          requestedMonth: body.startMonth,
          installments: body.installmentMonths,
          status: "approved",
          isLegacy: true,
          legacyRepaidAmount: body.repaidAmount,
          approvedAmount: remaining,
          installmentMonths: body.installmentMonths,
          monthlyInstallment: monthly,
          startMonth: body.startMonth,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewerNote: "سلفة سابقة معتمدة مباشرة (بدون توقيع)",
          createdBy: reviewerId,
        }).returning();

        let firstDeductionId: number | null = null;
        for (const p of plan) {
          const [d] = await tx.insert(salaryDeductions).values({
            branchEmployeeId: emp.id,
            branchId: emp.branchId,
            month: p.month,
            type: "advance",
            amount: p.amount,
            description: `قسط سلفة سابقة (طلب رقم ${row.id})${body.reason ? ` — ${body.reason}` : ""}`,
            advanceRequestId: row.id,
            createdBy: reviewerId,
          }).returning();
          if (firstDeductionId === null) firstDeductionId = d.id;
        }
        const [linked] = await tx.update(advanceRequests)
          .set({ linkedDeductionId: firstDeductionId })
          .where(eq(advanceRequests.id, row.id))
          .returning();
        return linked;
      });

      await notifyEmployeeOfDecision({
        emp,
        title: "تسجيل سلفة سابقة باسمك",
        message: `تم تسجيل سلفة سابقة بقيمة ${body.totalAmount} ر.س (المتبقي ${remaining} ر.س) على ${body.installmentMonths} قسطاً شهرياً (${monthly} ر.س) بدءاً من ${body.startMonth}، وستُخصم تلقائياً من راتبك الشهري.`,
        linkUrl: "/my-portal",
        relatedEntityId: created.id,
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/advance-requests] legacy error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/advance-requests/:id/review", isAuthenticated, requireAnyPermission("hr_advances", ["approve", "edit"]), async (req, res) => {
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
      const REVIEWABLE = ["pending", "pre_approved", "awaiting_signature", "signed"];
      if (!REVIEWABLE.includes(existing.status)) {
        return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });
      }

      const reviewerId = getUserId(req) || undefined;
      const isFinal = await hasAdvanceFinalAuthority(req);

      // مرحلتان: الموافقة المبدئية (مدير التشغيل) ثم القرار النهائي (شؤون الموظفين).
      if (!isFinal && existing.status !== "pending") {
        return res.status(403).json({ error: "هذا الطلب بانتظار إجراءات إدارة شؤون الموظفين" });
      }

      // الرفض ينهي الطلب من أي مرحلة.
      if (decision.decision === "rejected") {
        const [updated] = await db.update(advanceRequests).set({
          status: "rejected",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewerNote: decision.note,
          updatedAt: new Date(),
        }).where(and(eq(advanceRequests.id, id), inArray(advanceRequests.status, REVIEWABLE))).returning();
        if (!updated) return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });

        const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
        if (emp) {
          const noteLine = decision.note ? `\nملاحظة: ${decision.note}` : "";
          await notifyEmployeeOfDecision({
            emp,
            title: "تم رفض طلب السلفة",
            message: `طلب السلفة بمبلغ ${existing.amount} ر.س (شهر ${existing.requestedMonth}) تم رفضه.${noteLine}`,
            linkUrl: "/my-portal",
            relatedEntityId: id,
          });
        }
        return res.json(updated);
      }

      // الموافقة المبدئية (مستخدم بصلاحية approve فقط، والطلب pending)
      if (!isFinal) {
        const [updated] = await db.update(advanceRequests).set({
          status: "pre_approved",
          preApprovedBy: reviewerId,
          preApprovedAt: new Date(),
          preApproverNote: decision.note,
          updatedAt: new Date(),
        }).where(and(eq(advanceRequests.id, id), eq(advanceRequests.status, "pending"))).returning();
        if (!updated) return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });

        const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
        if (emp) {
          await notifyEmployeeOfDecision({
            emp,
            title: "موافقة مبدئية على طلب السلفة",
            message: `طلب السلفة بمبلغ ${existing.amount} ر.س (شهر ${existing.requestedMonth}) حصل على موافقة مبدئية، وهو الآن بانتظار الاعتماد النهائي من إدارة شؤون الموظفين.`,
            linkUrl: "/my-portal",
            relatedEntityId: id,
          });
        }
        return res.json(updated);
      }

      // الاعتماد النهائي: لا يتم إلا بعد توقيع الموظف على النموذج الرسمي.
      if (existing.status !== "signed") {
        return res.status(400).json({
          error: existing.status === "awaiting_signature"
            ? "الطلب بانتظار توقيع الموظف — لا يمكن الاعتماد النهائي قبل التوقيع"
            : "يجب أولاً مراجعة الطلب وإرساله لتوقيع الموظف (تحديد القيمة المعتمدة وعدد الأقساط)",
        });
      }
      const advAmount = existing.approvedAmount ?? existing.amount;
      const advMonths = existing.installmentMonths ?? 1;
      const advStart = existing.startMonth ?? existing.requestedMonth;
      const { monthly, plan } = buildInstallmentPlan(advAmount, advMonths, advStart);

      // داخل معاملة ذرّية — إنشاء أقساط الخصم الشهرية وربطها بالطلب،
      // فتدخل في إغلاق الرواتب الشهري تلقائياً دون تسجيل يدوي.
      const result = await db.transaction(async (tx) => {
        const [updated] = await tx.update(advanceRequests).set({
          status: "approved",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewerNote: decision.note,
          updatedAt: new Date(),
        }).where(and(eq(advanceRequests.id, id), eq(advanceRequests.status, "signed"))).returning();
        if (!updated) return null;

        let firstDeductionId: number | null = null;
        for (let i = 0; i < plan.length; i++) {
          const p = plan[i];
          const [d] = await tx.insert(salaryDeductions).values({
            branchEmployeeId: existing.branchEmployeeId,
            branchId: existing.branchId,
            month: p.month,
            type: "advance",
            amount: p.amount,
            description: `قسط سلفة ${i + 1}/${plan.length} (طلب رقم ${existing.id})${existing.reason ? ` — ${existing.reason}` : ""}`,
            advanceRequestId: existing.id,
            createdBy: reviewerId,
          }).returning();
          if (firstDeductionId === null) firstDeductionId = d.id;
        }

        const [linked] = await tx.update(advanceRequests)
          .set({ linkedDeductionId: firstDeductionId })
          .where(eq(advanceRequests.id, id))
          .returning();
        return linked;
      });
      if (!result) return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      if (emp) {
        const noteLine = decision.note ? `\nملاحظة: ${decision.note}` : "";
        await notifyEmployeeOfDecision({
          emp,
          title: "تم اعتماد طلب السلفة نهائياً",
          message: `طلب السلفة بمبلغ ${advAmount} ر.س تم اعتماده نهائياً وتحويله للإدارة المالية للصرف. سيُخصم على ${advMonths} قسطاً شهرياً (${monthly} ر.س) بدءاً من شهر ${advStart}.${noteLine}`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
        });
      }
      res.json(result);
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
      const emp = await getMyEmployee(req);

      // (أ) الإشعارات الشخصية الموجّهة لحساب المستخدم (قرارات الإجازات/السلف…)
      const personalRows = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isDismissed, false)))
        .orderBy(desc(notifications.createdAt))
        .limit(100);
      const personalItems = personalRows.map((n) => ({
        id: n.id,
        source: "personal" as const,
        title: n.title,
        message: n.message,
        isRead: !!n.isRead,
        createdAt: n.createdAt,
        linkUrl: n.linkUrl || null,
      }));

      // (ب) إشعارات النظام العامة/الموجّهة (نفس ما يظهر في الجرس الرئيسي: بث، رسائل موجّهة…)
      let systemItems: Array<any> = [];
      try {
        const active = await storage.getActiveNotificationsForUser(userId, emp?.branchId || "");
        const reads = await storage.getNotificationReadsByUser(userId);
        const readIds = new Set(reads.map((r: any) => r.notificationId));
        systemItems = active.map((n: any) => ({
          id: n.id,
          source: "system" as const,
          title: n.title,
          message: n.content,
          isRead: readIds.has(n.id),
          createdAt: n.createdAt,
          linkUrl: n.buttonAction || null,
        }));
      } catch (err) {
        console.error("[my/notifications] system merge failed (non-blocking):", err);
      }

      const merged = [...personalItems, ...systemItems].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      const unreadCount = merged.filter((n) => !n.isRead).length;
      res.json({ notifications: merged, unreadCount });
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
      const source = (req.body?.source === "system") ? "system" : "personal";
      // إشعارات النظام: حالة المقروء محفوظة في جدول notification_reads لكل مستخدم.
      // نتحقق أولاً أن الإشعار ظاهر فعلاً لهذا المستخدم قبل كتابة سجل القراءة (منع تلويث الحالة).
      if (source === "system") {
        const emp = await getMyEmployee(req);
        const active = await storage.getActiveNotificationsForUser(userId, emp?.branchId || "");
        if (!active.some((n: any) => n.id === id)) {
          return res.status(404).json({ error: "الإشعار غير موجود" });
        }
        await storage.markNotificationRead(id, userId);
        return res.json({ ok: true });
      }
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
      const emp = await getMyEmployee(req);
      // (أ) الإشعارات الشخصية
      await db.update(notifications).set({
        isRead: true,
        readAt: new Date(),
      }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      // (ب) إشعارات النظام الظاهرة حالياً لهذا المستخدم
      try {
        const active = await storage.getActiveNotificationsForUser(userId, emp?.branchId || "");
        await Promise.all(
          active.map((n: any) => storage.markNotificationRead(n.id, userId).catch(() => null)),
        );
      } catch (err) {
        console.error("[my/notifications] read-all system merge failed (non-blocking):", err);
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[my/notifications] read-all error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
