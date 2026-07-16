import type { Express, Request } from "express";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter } from "./auth";
import {
  onboardingNotifications,
  onboardingTokens,
  jobOffers,
  employmentApplications,
  branches,
  users,
  branchEmployees,
} from "@shared/schema";
import crypto from "crypto";
import { storage } from "./storage";
import { sendWhatsAppMessage, isTwilioConfigured } from "./twilio-service";

const PERMISSION_MODULE = "hr_onboarding" as const;

function checkBranchAccess(req: any, branchId: string | null): boolean {
  const filter = getEffectiveBranchFilter(req);
  if (!filter.hasAccess) return false;
  if (filter.branchIds === null) return true; // admin / all branches
  if (!branchId) return false; // branch-scoped user MUST NOT access null-branch records
  return filter.branchIds.includes(branchId);
}

const ALLOWED_CONVERT_ROLES = ["employee", "viewer", "attendance_clerk"] as const;

function isAdmin(req: any): boolean {
  return (req as any).user?.role === "admin";
}

async function generateNotificationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ONB-${year}-`;
  const [last] = await db
    .select({ n: onboardingNotifications.notificationNumber })
    .from(onboardingNotifications)
    .where(sql`${onboardingNotifications.notificationNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(onboardingNotifications.id))
    .limit(1);
  let next = 1;
  if (last?.n) {
    const m = last.n.match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

function buildOnboardingMessage(n: any, link: string, branchName?: string): string {
  return `🥐 *BUTTER BAKERY* 🥐
🌟 *إشعار مباشرة العمل* | *Work Commencement Notice* 🌟
━━━━━━━━━━━━━━━━━━━━

السلام عليكم ورحمة الله وبركاته
_Peace be upon you,_

أهلاً وسهلاً *${n.candidateName}* 🎉
_Welcome ${n.candidateName}!_

━━━━━━━━━━━━━━━━━━━━
🎊 *مرحباً بك في عائلة باتر بيكري!*
🎊 _Welcome to the Butter Bakery family!_
━━━━━━━━━━━━━━━━━━━━

📋 *تفاصيل المباشرة | Commencement Details:*

💼 *الوظيفة | Position:* ${n.position}
🏢 *الفرع | Branch:* ${branchName || n.branchName || "-"}
📅 *تاريخ المباشرة | Start Date:* ${n.actualStartDate}
${n.workingHours ? `⏰ *الدوام | Working Hours:* ${n.workingHours}\n` : ""}${n.reportingTo ? `👤 *المسؤول المباشر | Reporting To:* ${n.reportingTo}\n` : ""}📄 *رقم الإشعار | Notice No.:* \`${n.notificationNumber}\`

━━━━━━━━━━━━━━━━━━━━
🔗 *الرجاء فتح الرابط من جوالك *داخل الفرع* لتأكيد المباشرة:*
🔗 _Please open the link from your phone *inside the branch* to confirm your commencement:_

${link}

📸 سيُطلب منك:
   • التقاط صورة لك في الفرع
   • تفعيل الموقع الجغرافي (GPS)
   • التوقيع الإلكتروني

📸 _You'll need to:_
   • _Take a photo at the branch_
   • _Enable GPS location_
   • _Sign electronically_

⏰ *صالح لمدة | Valid for:* ${n.validityDays} أيام / days
━━━━━━━━━━━━━━━━━━━━

نتمنى لك التوفيق في مسيرتك معنا 🌹
_Best wishes for a successful journey with us!_

مع أطيب التحيات،
_With our warmest regards,_

👥 *إدارة الموارد البشرية | HR Department*
*Butter Bakery* | باتر بيكري`;
}

export function registerOnboardingRoutes(app: Express) {
  // ===== List: accepted offers (مع ربط إشعار المباشرة إن وجد) =====
  app.get(
    "/api/hr/onboarding",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const filter = getEffectiveBranchFilter(req);
        if (!filter.hasAccess) return res.json([]);

        // 1. جميع عروض العمل المقبولة (مفلترة حسب الفرع)
        const offerConds: any[] = [eq(jobOffers.status, "accepted")];
        if (filter.branchIds !== null && filter.branchIds.length > 0) {
          offerConds.push(inArray(jobOffers.branchId, filter.branchIds));
        } else if (filter.branchIds !== null && filter.branchIds.length === 0) {
          return res.json([]);
        }

        const acceptedOffers = await db
          .select()
          .from(jobOffers)
          .where(and(...offerConds))
          .orderBy(desc(jobOffers.respondedAt));

        if (acceptedOffers.length === 0) return res.json([]);

        // 2. الإشعارات المرتبطة بهذه العروض
        const offerIds = acceptedOffers.map((o) => o.id);
        const notifs = await db
          .select()
          .from(onboardingNotifications)
          .where(inArray(onboardingNotifications.jobOfferId, offerIds));
        const notifMap = new Map(notifs.map((n) => [n.jobOfferId, n]));

        // 3. دمج النتائج
        const result = acceptedOffers.map((o) => ({
          offer: o,
          notification: notifMap.get(o.id) || null,
        }));
        res.json(result);
      } catch (e: any) {
        if (e?.code === "42P01") {
          // job_offers أو onboarding tables غير موجودة — قاعدة بيانات لم تتم ترقيتها بعد
          console.warn("[onboarding] list: missing table:", e.message);
          return res.json([]);
        }
        console.error("[onboarding] list error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Stats =====
  app.get(
    "/api/hr/onboarding/stats",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const filter = getEffectiveBranchFilter(req);
        if (!filter.hasAccess) return res.json({});

        const offerConds: any[] = [eq(jobOffers.status, "accepted")];
        if (filter.branchIds !== null && filter.branchIds.length > 0) {
          offerConds.push(inArray(jobOffers.branchId, filter.branchIds));
        } else if (filter.branchIds !== null && filter.branchIds.length === 0) {
          return res.json({});
        }

        const acceptedOffers = await db
          .select({ id: jobOffers.id })
          .from(jobOffers)
          .where(and(...offerConds));
        const offerIds = acceptedOffers.map((o) => o.id);

        let counts: Record<string, number> = { total: acceptedOffers.length, pending: 0, sent: 0, signed: 0, confirmed: 0, converted: 0 };
        if (offerIds.length > 0) {
          const grouped = await db
            .select({ status: onboardingNotifications.status, c: sql<number>`count(*)::int` })
            .from(onboardingNotifications)
            .where(inArray(onboardingNotifications.jobOfferId, offerIds))
            .groupBy(onboardingNotifications.status);
          let withNotif = 0;
          for (const g of grouped) {
            counts[g.status] = Number(g.c);
            withNotif += Number(g.c);
          }
          counts.pending = acceptedOffers.length - withNotif;
        }
        res.json(counts);
      } catch (e: any) {
        if (e?.code === "42P01") {
          console.warn("[onboarding] stats: missing table:", e.message);
          return res.json({ total: 0, pending: 0, sent: 0, signed: 0, confirmed: 0, converted: 0 });
        }
        console.error("[onboarding] stats error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Get single notification =====
  app.get(
    "/api/hr/onboarding/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!n) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, n.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });

        const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, n.jobOfferId)).limit(1);
        res.json({ notification: n, offer });
      } catch (e: any) {
        console.error("[onboarding] get error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Full consolidated employee file (application → offer → onboarding → employee) =====
  app.get(
    "/api/hr/onboarding/:id/full-file",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!n) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, n.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });

        const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, n.jobOfferId)).limit(1);

        // طلب التوظيف المرتبط بهذا العرض (إن وُجد)
        let application: any = null;
        if (offer) {
          const [app] = await db
            .select()
            .from(employmentApplications)
            .where(eq(employmentApplications.convertedToOfferId, offer.id))
            .limit(1);
          application = app || null;
        }

        // سجل الموظف النهائي في موظفي الفرع (إن تم التحويل)
        let employee: any = null;
        if (n.convertedBranchEmployeeId) {
          const [emp] = await db
            .select()
            .from(branchEmployees)
            .where(eq(branchEmployees.id, n.convertedBranchEmployeeId))
            .limit(1);
          employee = emp || null;
        }

        // حماية دفاعية: لا نُرجع سجلات مرتبطة تتبع فرعاً مختلفاً عن فرع الإشعار (منع تسريب بيانات بين الفروع)
        const safeOffer = offer && offer.branchId && offer.branchId !== n.branchId ? null : offer || null;
        const safeEmployee = employee && employee.branchId && employee.branchId !== n.branchId ? null : employee;
        const safeApplication =
          application && application.targetBranchId && application.targetBranchId !== n.branchId ? null : application;

        res.json({ application: safeApplication, offer: safeOffer, notification: n, employee: safeEmployee });
      } catch (e: any) {
        console.error("[onboarding] full-file error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Create notification from accepted offer =====
  app.post(
    "/api/hr/onboarding",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const { jobOfferId, actualStartDate, workingHours, reportingTo, notes, validityDays, branchId: bodyBranchId } = req.body;
        if (!jobOfferId || !actualStartDate) {
          return res.status(400).json({ error: "رقم العرض وتاريخ المباشرة مطلوبان" });
        }

        const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, Number(jobOfferId))).limit(1);
        if (!offer) return res.status(404).json({ error: "عرض العمل غير موجود" });
        if (offer.status !== "accepted") return res.status(400).json({ error: "العرض لم يُقبل بعد" });

        // الفرع: إن أُرسل فرع من النموذج نعتمده (يتيح تغيير الفرع قبل الإرسال)، وإلا نستخدم فرع العرض
        let effectiveBranchId: string | null = offer.branchId;
        let effectiveBranchName: string | null = offer.branchName;
        if (bodyBranchId) {
          const [b] = await db.select().from(branches).where(eq(branches.id, String(bodyBranchId))).limit(1);
          if (!b) return res.status(400).json({ error: "الفرع المحدد غير موجود" });
          effectiveBranchId = b.id;
          effectiveBranchName = b.name;
        }
        if (!effectiveBranchId) {
          return res.status(400).json({ error: "العرض بدون فرع — اختر الفرع في النموذج" });
        }

        if (!checkBranchAccess(req, effectiveBranchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });

        const [existing] = await db
          .select()
          .from(onboardingNotifications)
          .where(eq(onboardingNotifications.jobOfferId, offer.id))
          .limit(1);
        if (existing) return res.status(409).json({ error: "يوجد إشعار مباشرة لهذا العرض مسبقاً", notification: existing });

        const number = await generateNotificationNumber();
        const user: any = (req as any).user;
        const [created] = await db
          .insert(onboardingNotifications)
          .values({
            notificationNumber: number,
            jobOfferId: offer.id,
            candidateName: offer.candidateName,
            phone: offer.phone,
            position: offer.position,
            branchId: effectiveBranchId,
            branchName: effectiveBranchName,
            actualStartDate,
            workingHours: workingHours || offer.workingHours || null,
            reportingTo: reportingTo || null,
            notes: notes || null,
            validityDays: Number(validityDays) || 7,
            createdBy: user?.id || null,
          })
          .returning();
        res.status(201).json(created);
      } catch (e: any) {
        console.error("[onboarding] create error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Update draft notification =====
  app.patch(
    "/api/hr/onboarding/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [existing] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!existing) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, existing.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (!["pending", "sent"].includes(existing.status)) {
          return res.status(400).json({ error: "لا يمكن تعديل إشعار بعد التوقيع" });
        }

        const { actualStartDate, workingHours, reportingTo, notes, validityDays } = req.body;
        const [updated] = await db
          .update(onboardingNotifications)
          .set({
            ...(actualStartDate ? { actualStartDate } : {}),
            ...(workingHours !== undefined ? { workingHours } : {}),
            ...(reportingTo !== undefined ? { reportingTo } : {}),
            ...(notes !== undefined ? { notes } : {}),
            ...(validityDays !== undefined ? { validityDays: Number(validityDays) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(onboardingNotifications.id, id))
          .returning();
        res.json(updated);
      } catch (e: any) {
        console.error("[onboarding] update error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Send notification (generate token + WhatsApp) =====
  app.post(
    "/api/hr/onboarding/:id/send",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!n) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, n.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (!["pending", "sent"].includes(n.status)) {
          return res.status(400).json({ error: "لا يمكن إرسال إشعار في هذه الحالة" });
        }

        // إلغاء توكنات سابقة
        await db
          .update(onboardingTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(onboardingTokens.notificationId, n.id), sql`${onboardingTokens.usedAt} IS NULL`, sql`${onboardingTokens.revokedAt} IS NULL`));

        const token = crypto.randomBytes(24).toString("base64url");
        const expiresAt = new Date(Date.now() + n.validityDays * 24 * 60 * 60 * 1000);
        await db.insert(onboardingTokens).values({ notificationId: n.id, token, expiresAt });

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const link = `${baseUrl}/onboarding/${token}`;

        await db
          .update(onboardingNotifications)
          .set({ status: n.status === "pending" ? "sent" : n.status, sentAt: new Date(), expiresAt, updatedAt: new Date() })
          .where(eq(onboardingNotifications.id, n.id));

        // إرسال واتساب
        let waResult: any = { success: false, skipped: !isTwilioConfigured() };
        if (isTwilioConfigured()) {
          let branchName: string | undefined = n.branchName || undefined;
          if (n.branchId) {
            const [b] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, n.branchId)).limit(1);
            if (b) branchName = b.name;
          }
          const message = buildOnboardingMessage(n, link, branchName);
          waResult = await sendWhatsAppMessage(n.phone, message);
        }

        res.json({ link, phone: n.phone, whatsapp: waResult, channel: "whatsapp" });
      } catch (e: any) {
        console.error("[onboarding] send error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Confirm (admin/HR reviews and confirms commencement) =====
  app.post(
    "/api/hr/onboarding/:id/confirm",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!n) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, n.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (n.status !== "signed") return res.status(400).json({ error: "يجب أن يكون الموظف قد وقّع المباشرة أولاً" });

        const user: any = (req as any).user;
        const [updated] = await db
          .update(onboardingNotifications)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            confirmedBy: user?.id || null,
            confirmedNotes: req.body?.notes || null,
            updatedAt: new Date(),
          })
          .where(eq(onboardingNotifications.id, id))
          .returning();
        res.json(updated);
      } catch (e: any) {
        console.error("[onboarding] confirm error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Cancel notification =====
  app.post(
    "/api/hr/onboarding/:id/cancel",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!n) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, n.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (n.status === "converted") return res.status(400).json({ error: "لا يمكن إلغاء إشعار تم تحويله" });

        await db
          .update(onboardingNotifications)
          .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: req.body?.reason || null, updatedAt: new Date() })
          .where(eq(onboardingNotifications.id, id));
        await db
          .update(onboardingTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(onboardingTokens.notificationId, id), sql`${onboardingTokens.revokedAt} IS NULL`));
        res.json({ success: true });
      } catch (e: any) {
        console.error("[onboarding] cancel error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Convert to employee (creates user record) =====
  app.post(
    "/api/hr/onboarding/:id/convert",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const {
          // حساب الدخول (اختياري)
          createLogin,
          username,
          password,
          role,
          // بيانات HR — نفس حقول نموذج موظفي الفرع (employeeFormSchema)
          branchId: bodyBranchId,
          employeeName,
          employeeNameEn,
          jobTitle,
          department,
          nationality,
          salary,
          housingAllowance,
          transportAllowance,
          foodAllowance,
          otherAllowances,
          socialInsuranceDeduction,
          hireDate,
          healthCertificate,
          healthCertificateExpiry,
          iqamaNumber,
          iqamaExpiry,
          passportNumber,
          passportExpiry,
          phoneNumber,
          emergencyContact,
          bankName,
          bankAccountNumber,
          status,
          contractType,
          workPermitNumber,
          notes,
          // اختيارية — للتوافق مع نسخ سابقة من الـ client
          email,
          phone,
          basicSalary,
        } = req.body;

        // التحقق من حساب الدخول لو مطلوب
        if (createLogin) {
          if (!username || !password) return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان لإنشاء حساب دخول" });
          if (username.length < 3 || username.length > 50) return res.status(400).json({ error: "اسم المستخدم يجب أن يكون بين 3 و 50 حرفاً" });
          if (password.length < 8) return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
          if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: "كلمة المرور يجب أن تحتوي على حروف كبيرة وصغيرة وأرقام" });
          }
        }

        // SECURITY: enforce role allowlist (admins only can assign privileged roles)
        let effectiveRole: string = role || "employee";
        if (createLogin && !ALLOWED_CONVERT_ROLES.includes(effectiveRole as any)) {
          if (!isAdmin(req)) {
            return res.status(403).json({ error: `الدور '${effectiveRole}' غير مسموح. الأدوار المتاحة: ${ALLOWED_CONVERT_ROLES.join(", ")}` });
          }
        }

        const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!n) return res.status(404).json({ error: "الإشعار غير موجود" });
        if (!checkBranchAccess(req, n.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (n.status !== "confirmed") return res.status(400).json({ error: "يجب تأكيد المباشرة أولاً قبل التحويل لموظف" });
        if ((n as any).convertedBranchEmployeeId || n.convertedEmployeeId) {
          return res.status(409).json({
            error: "تم تحويل هذا الموظف مسبقاً",
            branchEmployeeId: (n as any).convertedBranchEmployeeId,
            userId: n.convertedEmployeeId,
          });
        }

        // الفرع قابل للتعديل من النموذج: نستخدم الفرع المُختار إن وُجد، وإلا فرع الإشعار
        let effectiveBranchId: string | null = n.branchId;
        if (bodyBranchId && String(bodyBranchId) !== n.branchId) {
          const [b] = await db.select().from(branches).where(eq(branches.id, String(bodyBranchId))).limit(1);
          if (!b) return res.status(400).json({ error: "الفرع المحدد غير موجود" });
          effectiveBranchId = b.id;
          // SECURITY: يجب أن يملك المستخدم صلاحية على الفرع الجديد المُختار أيضاً
          if (!checkBranchAccess(req, effectiveBranchId)) return res.status(403).json({ error: "لا تملك صلاحية على الفرع المحدد" });
        }
        if (!effectiveBranchId) return res.status(400).json({ error: "الإشعار بدون فرع مرتبط — اختر الفرع في النموذج" });

        // قراءة عرض العمل لجلب البيانات الافتراضية (الراتب، الجنسية، إلخ)
        const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, n.jobOfferId)).limit(1);
        if (!offer) return res.status(404).json({ error: "عرض العمل المرتبط غير موجود" });

        // التحقق من بيانات HR الأساسية
        const finalNationality = (nationality || offer.nationality || "").trim();
        if (!finalNationality) return res.status(400).json({ error: "الجنسية مطلوبة (غير موجودة في عرض العمل، يجب إدخالها يدوياً)" });

        // salary = نموذج موظفي الفرع، basicSalary = للتوافق مع نسخة سابقة
        const finalSalary = Number(salary ?? basicSalary ?? offer.basicSalary ?? 0);
        if (!finalSalary || finalSalary <= 0) return res.status(400).json({ error: "الراتب الأساسي مطلوب ويجب أن يكون أكبر من صفر" });

        // التحقق من اسم المستخدم لو حساب دخول مطلوب
        if (createLogin) {
          const existing = await storage.getUserByUsername(username);
          if (existing) return res.status(400).json({ error: "اسم المستخدم مسجل مسبقاً" });
        }

        const reqUser: any = (req as any).user;

        // معاملة ذرّية: إنشاء سجل HR + (اختياري) حساب الدخول + ربط الإشعار + ربط عرض العمل
        const result = await db.transaction(async (tx) => {
          // 1) إنشاء حساب الدخول (اختياري)
          let newUserId: string | null = null;
          if (createLogin) {
            const bcrypt = (await import("bcrypt")).default;
            const hashedPassword = await bcrypt.hash(password, 10);
            const nameForUser = (employeeName || n.candidateName || "").trim();
            const parts = nameForUser.split(/\s+/);
            const [newUser] = await tx
              .insert(users)
              .values({
                username,
                password: hashedPassword,
                firstName: parts[0] || nameForUser,
                lastName: parts.slice(1).join(" ") || "-",
                phone: phoneNumber || phone || n.phone,
                email: email || offer.email || null,
                branchId: effectiveBranchId,
                jobTitle: jobTitle || n.position,
                role: effectiveRole,
                isActive: "active",
              })
              .returning();
            newUserId = newUser.id;
          }

          // 2) إنشاء سجل HR كامل في branch_employees (دائماً)
          // ملاحظة: createBranchEmployee يحسب totalSalary + employeeNumber تلقائياً، لكنّه خارج tx
          // لذا نُنفّذ الإدراج المباشر داخل tx ثم نحسب القيم يدوياً
          const housing = Number(housingAllowance ?? offer.housingAllowance ?? 0);
          const transport = Number(transportAllowance ?? offer.transportAllowance ?? 0);
          const food = Number(foodAllowance ?? 0);
          const other = Number(otherAllowances ?? offer.otherAllowances ?? 0);
          // للسعوديين: نسبة التأمينات الاجتماعية 9.75% من الراتب الأساسي (نظام التأمينات السعودي)
          // يمكن تجاوزها يدوياً عبر socialInsuranceDeduction من الـ body
          const ssDeduction = Number(socialInsuranceDeduction ?? (finalNationality === "سعودي" ? Math.round(finalSalary * 0.0975) : 0));
          const grossSalary = finalSalary + housing + transport + food + other;
          const socialIns = finalNationality === "سعودي" ? ssDeduction : 0;
          const totalSalary = grossSalary - socialIns;

          // توليد رقم موظف
          const branchPrefixes: Record<string, string> = {
            medina: "MED", jeddah: "JED", riyadh: "RYD", makkah: "MAK", dammam: "DAM",
          };
          const prefix = branchPrefixes[effectiveBranchId!] || effectiveBranchId!.substring(0, 3).toUpperCase();
          const existingNumsRes: any = await tx.execute(sql`
            SELECT employee_number FROM branch_employees WHERE branch_id = ${effectiveBranchId}
          `);
          const rows = (existingNumsRes?.rows ?? existingNumsRes) as Array<{ employee_number: string | null }>;
          let maxNum = 0;
          for (const r of rows) {
            const m = r.employee_number?.match(/(\d+)$/);
            if (m) {
              const v = parseInt(m[1], 10);
              if (v > maxNum) maxNum = v;
            }
          }
          const employeeNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;
          const nowDate = new Date();

          const [newBranchEmployee] = await tx.insert(branchEmployees).values({
            branchId: effectiveBranchId!,
            linkedUserId: newUserId,
            employeeNumber,
            employeeName: (employeeName || n.candidateName || "").trim(),
            employeeNameEn: employeeNameEn || null,
            jobTitle: jobTitle || n.position,
            department: department || null,
            nationality: finalNationality,
            salary: finalSalary,
            housingAllowance: housing,
            transportAllowance: transport,
            foodAllowance: food,
            otherAllowances: other,
            socialInsuranceDeduction: socialIns,
            totalSalary,
            hireDate: hireDate || n.actualStartDate || offer.startDate || nowDate.toISOString().slice(0, 10),
            healthCertificate: healthCertificate || "none",
            healthCertificateExpiry: healthCertificateExpiry || null,
            iqamaNumber: iqamaNumber || offer.idNumber || null,
            iqamaExpiry: iqamaExpiry || null,
            passportNumber: passportNumber || null,
            passportExpiry: passportExpiry || null,
            phoneNumber: phoneNumber || phone || n.phone,
            emergencyContact: emergencyContact || null,
            bankName: bankName || null,
            bankAccountNumber: bankAccountNumber || null,
            status: status || "active",
            contractType: contractType || "full_time",
            workPermitNumber: workPermitNumber || null,
            notes: notes || null,
            statusChangedAt: nowDate,
            statusChangedBy: reqUser?.id ?? null,
          }).returning();

          // سجل تاريخ الحالة
          await tx.execute(sql`
            INSERT INTO employee_status_history (branch_employee_id, old_status, new_status, changed_by, reason)
            VALUES (${newBranchEmployee.id}, NULL, 'active', ${reqUser?.id ?? null}, 'Hired via onboarding conversion')
          `);

          // 3) تحديث الإشعار ذرياً (يمنع التحويل المزدوج)
          const updateRes: any = await tx.execute(sql`
            UPDATE onboarding_notifications
            SET status = 'converted',
                converted_at = NOW(),
                converted_by = ${reqUser?.id || null},
                converted_employee_id = ${newUserId},
                converted_branch_employee_id = ${newBranchEmployee.id},
                updated_at = NOW()
            WHERE id = ${id}
              AND converted_branch_employee_id IS NULL
              AND status = 'confirmed'
            RETURNING id
          `);
          const affected = updateRes?.rowCount ?? updateRes?.rows?.length ?? 0;
          if (affected === 0) {
            // علامة خاصة للتفريق بين خطأ السباق ومشاكل أخرى — يُترجم لـ 409 خارج المعاملة
            const err: any = new Error("تعذّر التحويل — قد يكون تم تحويله مسبقاً (race)");
            err.code = "ALREADY_CONVERTED";
            throw err;
          }

          // 4) ربط عرض العمل (hired_employee_id يربط بـ users — يُحدّث فقط إذا أُنشئ حساب دخول)
          if (newUserId) {
            await tx.execute(sql`
              UPDATE job_offers
              SET hired_employee_id = ${newUserId}, updated_at = NOW()
              WHERE id = ${n.jobOfferId}
            `);
          }

          return { newUserId, branchEmployee: newBranchEmployee };
        });

        // تطبيق صلاحيات المسمى الوظيفي (فقط لو أُنشئ user account)
        if (result.newUserId) {
          try {
            const { JOB_TITLES } = await import("@shared/permissions" as any).catch(() => ({ JOB_TITLES: [] as string[] }));
            const finalJobTitle = jobTitle || n.position;
            if (finalJobTitle && reqUser?.id && Array.isArray(JOB_TITLES) && JOB_TITLES.includes(finalJobTitle)) {
              await storage.applyJobRolePermissions(result.newUserId, finalJobTitle, reqUser.id);
            }
          } catch (permErr) {
            console.warn("[onboarding] applyJobRolePermissions skipped:", permErr);
          }
        }

        res.status(201).json({
          branchEmployee: result.branchEmployee,
          userId: result.newUserId,
          notificationId: id,
          message: result.newUserId
            ? "تم تسجيل الموظف في HR وإنشاء حساب دخول للنظام"
            : "تم تسجيل الموظف في HR (بدون حساب دخول)",
        });
      } catch (e: any) {
        console.error("[onboarding] convert error:", e);
        if (e?.code === "ALREADY_CONVERTED") {
          return res.status(409).json({ error: "تم تحويل هذا الموظف مسبقاً" });
        }
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ====================================================================
  // ===== PUBLIC ROUTES (employee signs commencement via token link) ====
  // ====================================================================

  // Public upload (gated by valid onboarding token)
  app.post("/api/public/onboarding/:token/upload", async (req, res) => {
    try {
      const token = req.params.token;
      const [tk] = await db.select().from(onboardingTokens).where(eq(onboardingTokens.token, token)).limit(1);
      if (!tk) return res.status(404).json({ error: "الرابط غير صالح" });
      if (tk.revokedAt) return res.status(410).json({ error: "تم إلغاء الرابط" });
      if (tk.usedAt) return res.status(410).json({ error: "تم استخدام الرابط مسبقاً" });
      if (new Date(tk.expiresAt) < new Date()) return res.status(410).json({ error: "انتهت صلاحية الرابط" });

      const multer = (await import("multer")).default;
      const path = await import("path");
      const { uploadToSupabase, isSupabaseAvailable } = await import("./supabase-storage");
      if (!isSupabaseAvailable()) return res.status(503).json({ error: "خدمة التخزين غير متاحة" });

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error("نوع الصورة غير مسموح (JPG/PNG/WebP فقط)") as any, false);
            return;
          }
          const ext = path.extname(file.originalname).toLowerCase();
          if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
            cb(new Error("امتداد الصورة غير مسموح") as any, false);
            return;
          }
          cb(null, true);
        },
      });

      upload.single("file")(req, res, async (err: any) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "حجم الصورة يتجاوز 10MB" });
          return res.status(400).json({ error: err.message || "فشل الرفع" });
        }
        const file = (req as any).file;
        if (!file) return res.status(400).json({ error: "لم يتم تحديد ملف" });
        try {
          const ext = path.extname(file.originalname).toLowerCase().replace(".", "") || "jpg";
          const uniq = Date.now() + "-" + Math.round(Math.random() * 1e9);
          const objectName = `onboarding/${tk.notificationId}/${uniq}.${ext}`;
          const result = await uploadToSupabase(file.buffer, objectName, file.mimetype);
          if (!result) throw new Error("upload failed");
          res.json({
            fileName: file.originalname,
            fileSize: file.size,
            filePath: objectName,
            mimeType: file.mimetype,
            downloadUrl: `/api/uploads/file/${objectName}`,
          });
        } catch (uErr: any) {
          console.error("[onboarding] public upload error:", uErr);
          res.status(500).json({ error: "فشل رفع الصورة" });
        }
      });
    } catch (e: any) {
      console.error("[onboarding] public upload outer error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/public/onboarding/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const [tk] = await db.select().from(onboardingTokens).where(eq(onboardingTokens.token, token)).limit(1);
      if (!tk) return res.status(404).json({ error: "الرابط غير صالح" });
      if (tk.revokedAt) return res.status(410).json({ error: "تم إلغاء هذا الرابط" });
      if (tk.usedAt) return res.status(410).json({ error: "تم استخدام هذا الرابط مسبقاً للتوقيع" });
      if (new Date(tk.expiresAt) < new Date()) return res.status(410).json({ error: "انتهت صلاحية هذا الرابط" });

      const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, tk.notificationId)).limit(1);
      if (!n) return res.status(404).json({ error: "الإشعار غير موجود" });

      let branch: any = null;
      if (n.branchId) {
        const [b] = await db.select().from(branches).where(eq(branches.id, n.branchId)).limit(1);
        if (b) branch = { id: b.id, name: b.name, latitude: b.latitude, longitude: b.longitude, locationRadius: b.locationRadius, address: b.address };
      }

      // جلب الصورة الشخصية للموظف من طلب التوظيف (مطابقة دقيقة لتفادي إظهار صورة شخص آخر)
      // ملاحظة: نستخدم photoUrl (الصورة الشخصية) فقط، وليس idCopyUrl (صورة الهوية/الإقامة)
      // الأولوية: رقم الهوية (مطابقة قاطعة) ثم الجوال مع تطابق الاسم كحارس أمان
      let personalPhotoUrl: string | null = null;
      try {
        const [offer] = await db
          .select({ idNumber: jobOffers.idNumber, phone: jobOffers.phone, candidateName: jobOffers.candidateName })
          .from(jobOffers)
          .where(eq(jobOffers.id, n.jobOfferId))
          .limit(1);
        const idNumber = offer?.idNumber?.trim() || null;
        const phone = (offer?.phone || n.phone)?.trim() || null;
        const expectedName = (offer?.candidateName || n.candidateName || "").replace(/\s+/g, " ").trim();
        const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim();

        // (1) المطابقة برقم الهوية أولاً — أدق معرّف
        if (idNumber) {
          const [app] = await db
            .select({ photoUrl: employmentApplications.photoUrl })
            .from(employmentApplications)
            .where(eq(employmentApplications.idNumber, idNumber))
            .orderBy(desc(employmentApplications.id))
            .limit(1);
          if (app?.photoUrl) personalPhotoUrl = app.photoUrl;
        }

        // (2) احتياط: المطابقة بالجوال + تطابق الاسم (لتفادي إظهار صورة شخص آخر يشارك نفس الرقم)
        if (!personalPhotoUrl && phone && expectedName) {
          const candidates = await db
            .select({ photoUrl: employmentApplications.photoUrl, fullNameAr: employmentApplications.fullNameAr })
            .from(employmentApplications)
            .where(eq(employmentApplications.phone, phone))
            .orderBy(desc(employmentApplications.id));
          const matched = candidates.find((c) => c.photoUrl && norm(c.fullNameAr) === expectedName);
          if (matched?.photoUrl) personalPhotoUrl = matched.photoUrl;
        }
      } catch (lookupErr) {
        console.error("[onboarding] personal photo lookup failed:", lookupErr);
      }

      res.json({
        notification: {
          notificationNumber: n.notificationNumber,
          candidateName: n.candidateName,
          position: n.position,
          branchName: n.branchName,
          actualStartDate: n.actualStartDate,
          workingHours: n.workingHours,
          reportingTo: n.reportingTo,
          notes: n.notes,
          status: n.status,
          personalPhotoUrl,
        },
        branch,
      });
    } catch (e: any) {
      console.error("[onboarding] public get error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/public/onboarding/:token/sign", async (req, res) => {
    try {
      const token = req.params.token;
      const { signature, selfiePhotoUrl, selfieLat, selfieLng, selfieAccuracy } = req.body;

      if (!signature) return res.status(400).json({ error: "التوقيع مطلوب" });
      if (!selfiePhotoUrl) return res.status(400).json({ error: "صورة الإثبات في الفرع مطلوبة" });

      const [tk] = await db.select().from(onboardingTokens).where(eq(onboardingTokens.token, token)).limit(1);
      if (!tk) return res.status(404).json({ error: "الرابط غير صالح" });
      if (tk.revokedAt) return res.status(410).json({ error: "تم إلغاء هذا الرابط" });
      if (tk.usedAt) return res.status(410).json({ error: "تم استخدام هذا الرابط مسبقاً" });
      if (new Date(tk.expiresAt) < new Date()) return res.status(410).json({ error: "انتهت صلاحية هذا الرابط" });

      const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, tk.notificationId)).limit(1);
      if (!n) return res.status(404).json({ error: "الإشعار غير موجود" });
      if (!["pending", "sent"].includes(n.status)) {
        return res.status(409).json({ error: "تم توقيع هذا الإشعار مسبقاً أو لم يعد قابلاً للتوقيع" });
      }

      // حساب المسافة من الفرع
      let distanceM: number | null = null;
      let withinRadius: boolean | null = null;
      if (n.branchId && typeof selfieLat === "number" && typeof selfieLng === "number") {
        const [b] = await db.select().from(branches).where(eq(branches.id, n.branchId)).limit(1);
        if (b && b.latitude != null && b.longitude != null) {
          distanceM = haversineMeters(b.latitude, b.longitude, selfieLat, selfieLng);
          withinRadius = distanceM <= (b.locationRadius || 200);
        }
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      const ua = (req.headers["user-agent"] as string) || null;

      await db
        .update(onboardingNotifications)
        .set({
          status: "signed",
          employeeSignature: signature,
          selfiePhotoUrl,
          selfieLat: typeof selfieLat === "number" ? selfieLat : null,
          selfieLng: typeof selfieLng === "number" ? selfieLng : null,
          selfieAccuracy: typeof selfieAccuracy === "number" ? selfieAccuracy : null,
          selfieCapturedAt: new Date(),
          distanceFromBranchM: distanceM,
          withinBranchRadius: withinRadius,
          signedAt: new Date(),
          signedIp: ip,
          signedUserAgent: ua,
          updatedAt: new Date(),
        })
        .where(eq(onboardingNotifications.id, n.id));

      await db.update(onboardingTokens).set({ usedAt: new Date() }).where(eq(onboardingTokens.id, tk.id));

      res.json({ success: true, distanceM, withinRadius });
    } catch (e: any) {
      console.error("[onboarding] sign error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
