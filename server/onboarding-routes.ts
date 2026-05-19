import type { Express, Request } from "express";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter } from "./auth";
import {
  onboardingNotifications,
  onboardingTokens,
  jobOffers,
  branches,
  users,
} from "@shared/schema";
import crypto from "crypto";
import { storage } from "./storage";
import { sendWhatsAppMessage, isTwilioConfigured } from "./twilio-service";

const PERMISSION_MODULE = "hr_management" as const;

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

        // إذا كان العرض بدون فرع، نقبل الفرع من نموذج الإنشاء
        let effectiveBranchId: string | null = offer.branchId;
        let effectiveBranchName: string | null = offer.branchName;
        if (!effectiveBranchId) {
          if (!bodyBranchId) {
            return res.status(400).json({ error: "العرض بدون فرع — اختر الفرع في النموذج" });
          }
          const [b] = await db.select().from(branches).where(eq(branches.id, String(bodyBranchId))).limit(1);
          if (!b) return res.status(400).json({ error: "الفرع المحدد غير موجود" });
          effectiveBranchId = b.id;
          effectiveBranchName = b.name;
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

        res.json({ link, whatsapp: waResult, channel: "whatsapp" });
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
        const { username, password, firstName, lastName, jobTitle, role, email, phone } = req.body;

        if (!username || !password) return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
        if (username.length < 3 || username.length > 50) return res.status(400).json({ error: "اسم المستخدم يجب أن يكون بين 3 و 50 حرفاً" });
        if (password.length < 8) return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
          return res.status(400).json({ error: "كلمة المرور يجب أن تحتوي على حروف كبيرة وصغيرة وأرقام" });
        }

        // SECURITY: enforce role allowlist (admins only can assign privileged roles)
        let effectiveRole: string = role || "employee";
        if (!ALLOWED_CONVERT_ROLES.includes(effectiveRole as any)) {
          if (!isAdmin(req)) {
            return res.status(403).json({ error: `الدور '${effectiveRole}' غير مسموح. الأدوار المتاحة: ${ALLOWED_CONVERT_ROLES.join(", ")}` });
          }
        }

        const [n] = await db.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, id)).limit(1);
        if (!n) return res.status(404).json({ error: "الإشعار غير موجود" });
        if (!checkBranchAccess(req, n.branchId)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (n.status !== "confirmed") return res.status(400).json({ error: "يجب تأكيد المباشرة أولاً قبل التحويل لموظف" });
        if (n.convertedEmployeeId) return res.status(409).json({ error: "تم تحويل هذا الموظف مسبقاً", employeeId: n.convertedEmployeeId });
        if (!n.branchId) return res.status(400).json({ error: "الإشعار بدون فرع مرتبط" });

        // اسم المستخدم فريد
        const existing = await storage.getUserByUsername(username);
        if (existing) return res.status(400).json({ error: "اسم المستخدم مسجل مسبقاً" });

        const reqUser: any = (req as any).user;
        const bcrypt = (await import("bcrypt")).default;
        const hashedPassword = await bcrypt.hash(password, 10);

        // إنشاء الموظف + ربط الإشعار + ربط عرض العمل — كله داخل معاملة واحدة ذرّية
        const created = await db.transaction(async (tx) => {
          const [newUser] = await tx
            .insert(users)
            .values({
              username,
              password: hashedPassword,
              firstName: firstName || n.candidateName.split(" ")[0] || n.candidateName,
              lastName: lastName || n.candidateName.split(" ").slice(1).join(" ") || "-",
              phone: phone || n.phone,
              email: email || null,
              branchId: n.branchId,
              jobTitle: jobTitle || n.position,
              role: effectiveRole,
              isActive: "active",
            })
            .returning();

          // قفل صف الإشعار + التحديث الذرّي (يمنع التحويل المزدوج عند تنفيذ متوازٍ)
          const updateRes: any = await tx.execute(sql`
            UPDATE onboarding_notifications
            SET status = 'converted',
                converted_at = NOW(),
                converted_by = ${reqUser?.id || null},
                converted_employee_id = ${newUser.id},
                updated_at = NOW()
            WHERE id = ${id} AND converted_employee_id IS NULL AND status = 'confirmed'
            RETURNING id
          `);
          const affected = updateRes?.rowCount ?? updateRes?.rows?.length ?? 0;
          if (affected === 0) {
            throw new Error("تعذّر التحويل — قد يكون تم تحويله مسبقاً");
          }

          // ربط عرض العمل بالموظف الجديد (hired_employee_id الآن varchar UUID)
          await tx.execute(sql`
            UPDATE job_offers
            SET hired_employee_id = ${newUser.id}, updated_at = NOW()
            WHERE id = ${n.jobOfferId}
          `);

          // تطبيق صلاحيات المسمى الوظيفي (خارج جدول users — لا حاجة لـ tx)
          return newUser;
        });

        // تطبيق صلاحيات المسمى الوظيفي بعد نجاح المعاملة
        try {
          const { JOB_TITLES } = await import("@shared/permissions" as any).catch(() => ({ JOB_TITLES: [] as string[] }));
          const finalJobTitle = jobTitle || n.position;
          if (finalJobTitle && reqUser?.id && Array.isArray(JOB_TITLES) && JOB_TITLES.includes(finalJobTitle)) {
            await storage.applyJobRolePermissions(created.id, finalJobTitle, reqUser.id);
          }
        } catch (permErr) {
          console.warn("[onboarding] applyJobRolePermissions skipped:", permErr);
        }

        const { password: _, ...safe } = created;
        res.status(201).json({ employee: safe, notificationId: id });
      } catch (e: any) {
        console.error("[onboarding] convert error:", e);
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
