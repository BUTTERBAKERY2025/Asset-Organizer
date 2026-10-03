import type { Express, Request } from "express";
import { db } from "./db";
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter, getAllowedBranchIds } from "./auth";
import {
  onboardingNotifications,
  onboardingTokens,
  jobOffers,
  employmentApplications,
  branches,
  users,
  branchEmployees,
  systemNotifications,
} from "@shared/schema";
import { storage } from "./storage";
import { queueHrSourceNotification } from "./hr-system-notifications";
import { sendWhatsAppMessage, isTwilioConfigured } from "./twilio-service";
import { operationsHrManagerOnly } from "./operations-hr-routes";
import {
  BLOCKED_JOINING_REASON, deliverOnboardingLink, generateNotificationNumber,
  isUniqueConflict, lockOnboardingCreation, prepareOnboardingSend,
} from "./onboarding-lifecycle";

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
  // Restricted operations-manager initiation of the EXISTING accepted-offer
  // commencement flow. No candidate offers from another branch, HQ, or generic
  // HR editing/confirmation powers are exposed through this capability.
  const operationsJoiningScope = operationsHrManagerOnly;
  const operationsJoiningBranches = (req: any): string[] => {
    const ids = getAllowedBranchIds(req);
    return Array.isArray(ids) ? ids.filter(id => id !== "main_warehouse") : [];
  };
  app.get("/api/operations-hr/joining", isAuthenticated, operationsJoiningScope, requirePermission("operations_hr", "view"), requirePermission("operations_joining", "view"), async (req, res) => {
    try {
      const allowed = operationsJoiningBranches(req);
      const selected = req.query.branchId;
      res.set("Cache-Control", "no-store");
      if (selected !== undefined && (typeof selected !== "string" || !selected.trim()))
        return res.status(400).json({ error: "حدد فرعاً صحيحاً" });
      if (typeof selected === "string" && !allowed.includes(selected))
        return res.status(403).json({ error: "الفرع خارج نطاق فروع التشغيل" });
      if (!allowed.length) return res.json([]);
      const offers = await db.select({
        id: jobOffers.id, candidateName: jobOffers.candidateName,
        branchId: jobOffers.branchId, position: jobOffers.position,
        hiredEmployeeId: jobOffers.hiredEmployeeId,
      }).from(jobOffers).where(and(eq(jobOffers.status, "accepted"), inArray(jobOffers.branchId, typeof selected === "string" ? [selected] : allowed))).orderBy(desc(jobOffers.id));
      if (!offers.length) return res.json([]);
      const notifications = await db.select({
        id: onboardingNotifications.id, jobOfferId: onboardingNotifications.jobOfferId,
        branchId: onboardingNotifications.branchId, status: onboardingNotifications.status,
        notificationNumber: onboardingNotifications.notificationNumber,
        actualStartDate: onboardingNotifications.actualStartDate,
        sentAt: onboardingNotifications.sentAt,
        expiresAt: onboardingNotifications.expiresAt,
        signedAt: onboardingNotifications.signedAt,
        confirmedAt: onboardingNotifications.confirmedAt,
        confirmedBy: onboardingNotifications.confirmedBy,
        confirmedNotes: onboardingNotifications.confirmedNotes,
        confirmedByName: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
      }).from(onboardingNotifications)
        .leftJoin(users, eq(onboardingNotifications.confirmedBy, users.id))
        .where(inArray(onboardingNotifications.jobOfferId, offers.map(o => o.id)));
      res.json(offers.map(({ hiredEmployeeId, ...offer }) => {
        const existing = notifications.find(n => n.jobOfferId === offer.id);
        const blockedExisting = !!existing && existing.branchId !== offer.branchId;
        const notification = existing && !blockedExisting ? existing : null;
        const status = hiredEmployeeId || notification?.status === "converted" ? "converted" : notification?.status || "pending";
        return {
          ...offer, status, blockedExisting,
          blockedReason: blockedExisting ? BLOCKED_JOINING_REASON : null,
          notification: notification ? { ...notification, status } : null,
        };
      }));
    } catch (error) {
      console.error("Operations joining list error:", error);
      res.status(500).json({ error: "تعذر تحميل عروض المباشرة" });
    }
  });
  app.post("/api/operations-hr/joining", isAuthenticated, operationsJoiningScope, requirePermission("operations_hr", "view"), requirePermission("operations_joining", "create"), async (req, res) => {
    try {
      const offerId = req.body?.offerId;
      const actualStartDate = req.body?.actualStartDate;
      const parsedDate = typeof actualStartDate === "string" ? Date.parse(`${actualStartDate}T00:00:00Z`) : NaN;
      if (!Number.isSafeInteger(offerId) || !/^\d{4}-\d{2}-\d{2}$/.test(actualStartDate ?? "")
          || !Number.isFinite(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== actualStartDate)
        return res.status(400).json({ error: "حدد عرضاً مقبولاً وتاريخ مباشرة صحيحاً" });
      const allowed = operationsJoiningBranches(req);
      const result = await db.transaction(async tx => {
        await lockOnboardingCreation(tx);
        // Serialize creation for this offer; re-check branch and conversion
        // after the lock so simultaneous requests cannot create two links.
        await tx.execute(sql`SELECT id FROM job_offers WHERE id = ${offerId} FOR UPDATE`);
        const [offer] = await tx.select().from(jobOffers).where(eq(jobOffers.id, offerId)).limit(1);
        if (!offer) return { error: "NOT_FOUND" };
        if (offer.status !== "accepted" || !offer.branchId || !allowed.includes(offer.branchId))
          return { error: "OUT_OF_SCOPE" };
        if (offer.hiredEmployeeId) return { error: "CONVERTED" };
        const [existing] = await tx.select({ id: onboardingNotifications.id, branchId: onboardingNotifications.branchId })
          .from(onboardingNotifications).where(eq(onboardingNotifications.jobOfferId, offer.id)).limit(1);
        if (existing) return existing.branchId === offer.branchId
          ? { error: "EXISTS", notificationId: existing.id }
          : { error: "BLOCKED_EXISTING" };
        const [created] = await tx.insert(onboardingNotifications).values({
          notificationNumber: await generateNotificationNumber(tx), jobOfferId: offer.id,
          candidateName: offer.candidateName, phone: offer.phone, position: offer.position,
          branchId: offer.branchId, branchName: offer.branchName, actualStartDate,
          workingHours: offer.workingHours || null, createdBy: req.currentUser!.id,
        }).returning();
        return { id: created.id, status: created.status };
      });
      if (result.error === "NOT_FOUND") return res.status(404).json({ error: "العرض غير موجود" });
      if (result.error === "OUT_OF_SCOPE") return res.status(403).json({ error: "العرض خارج نطاق فروع التشغيل أو غير مقبول" });
      if (result.error === "CONVERTED") return res.status(409).json({ error: "تم تحويل صاحب العرض إلى موظف ولا يمكن إنشاء إشعار جديد" });
      if (result.error === "BLOCKED_EXISTING") return res.status(409).json({ error: BLOCKED_JOINING_REASON, blockedExisting: true, blockedReason: BLOCKED_JOINING_REASON });
      if (result.error === "EXISTS") return res.status(409).json({ error: "إشعار المباشرة موجود بالفعل", notificationId: result.notificationId });
      res.status(201).json(result);
    } catch (error) {
      if (isUniqueConflict(error)) return res.status(409).json({ error: "تعارض مع إنشاء إشعار آخر؛ حدّث القائمة قبل المحاولة مجدداً" });
      console.error("Operations joining create error:", error);
      res.status(500).json({ error: "تعذر إنشاء إشعار المباشرة" });
    }
  });
  app.post("/api/operations-hr/joining/:id/send", isAuthenticated, operationsJoiningScope, requirePermission("operations_hr", "view"), requirePermission("operations_joining", "create"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "الإشعار غير صالح" });
      if (req.body?.replaceToken !== undefined && typeof req.body.replaceToken !== "boolean")
        return res.status(400).json({ error: "خيار استبدال الرابط يجب أن يكون صحيحاً أو خطأ" });
      const result = await prepareOnboardingSend(id, req.body?.replaceToken === true,
        (n, offer) => offer.status === "accepted" && !!n.branchId && n.branchId === offer.branchId && operationsJoiningBranches(req).includes(n.branchId));
      if ("error" in result) {
        if (result.error === "NOT_FOUND") return res.status(404).json({ error: "الإشعار غير موجود" });
        if (result.error === "OUT_OF_SCOPE") return res.status(403).json({ error: "الإشعار خارج نطاق فروع التشغيل" });
        return res.status(409).json({ error: "المباشرة موقعة أو منتهية ولا يمكن إعادة الإرسال" });
      }
      const n = result.notification;
      const token = result.token;
      const link = `${req.protocol}://${req.get("host")}/onboarding/${token}`;
      const whatsapp = await deliverOnboardingLink(isTwilioConfigured,
        () => sendWhatsAppMessage(n.phone, buildOnboardingMessage(n, link, n.branchName ?? undefined)));
      res.set("Cache-Control", "no-store").json({ link, phone: n.phone, whatsapp,
        notificationNumber: n.notificationNumber, sentAt: n.sentAt, expiresAt: n.expiresAt, tokenReused: result.tokenReused });
    } catch (error) {
      if (error instanceof Error && error.message === "JOINING_SEND_STATE_CHANGED")
        return res.status(409).json({ error: "المباشرة موقعة أو منتهية" });
      console.error("Operations joining send error:", error);
      res.status(500).json({ error: "تعذر إرسال رابط المباشرة" });
    }
  });
  app.post("/api/operations-hr/joining/:id/confirm", isAuthenticated, operationsJoiningScope, requirePermission("operations_hr", "view"), requirePermission("operations_joining", "approve"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const notes = req.body?.notes;
      if (!Number.isSafeInteger(id) || id < 1 || (notes != null && (typeof notes !== "string" || notes.length > 1000)))
        return res.status(400).json({ error: "حدد إشعاراً صحيحاً وملاحظة لا تتجاوز 1000 حرف" });
      const allowed = operationsJoiningBranches(req);
      const result = await db.transaction(async tx => {
        // Lock both offer and notification. Conversion/cancellation and a second
        // confirmation cannot race the state check or create duplicate bell alerts.
        await tx.execute(sql`SELECT id FROM onboarding_notifications WHERE id = ${id} FOR UPDATE`);
        await tx.execute(sql`SELECT id FROM job_offers WHERE id =
          (SELECT job_offer_id FROM onboarding_notifications WHERE id = ${id}) FOR UPDATE`);
        const [entry] = await tx.select({ notification: onboardingNotifications, offer: jobOffers })
          .from(onboardingNotifications).innerJoin(jobOffers, eq(onboardingNotifications.jobOfferId, jobOffers.id))
          .where(eq(onboardingNotifications.id, id)).limit(1);
        if (!entry) return { error: "NOT_FOUND" };
        const n = entry.notification;
        if (entry.offer.status !== "accepted" || entry.offer.hiredEmployeeId || !n.branchId
          || n.branchId !== entry.offer.branchId || !allowed.includes(n.branchId))
          return { error: "OUT_OF_SCOPE" };
        if (n.status === "confirmed") return { alreadyConfirmed: true, id: n.id, status: n.status, confirmedAt: n.confirmedAt, confirmedBy: n.confirmedBy };
        if (n.status !== "signed" || !n.signedAt) return { error: "NOT_SIGNED" };
        const managers = await tx.select().from(users).where(and(eq(users.role, "hr_manager"), eq(users.isActive, "active")));
        const recipients: string[] = [];
        for (const manager of managers) {
          // Resolve recipient scope and source permission freshly, not from a
          // job title or from the operations manager's branch grant.
          const [permissions, grants] = await Promise.all([
            storage.getUserPermissions(manager.id, { bypassCache: true }),
            storage.getUserBranchAccess(manager.id),
          ]);
          const recipientReq: any = { currentUser: manager, authPermissions: permissions, userBranchAccess: grants, method: "GET" };
          if (!getEffectiveBranchFilter(recipientReq, n.branchId).hasAccess) continue;
          let permitted = false;
          const recipientRes: any = { status() { return this; }, json() { return this; } };
          await requirePermission(PERMISSION_MODULE, "view")(recipientReq, recipientRes, () => { permitted = true; });
          if (permitted) recipients.push(manager.id);
        }
        if (!recipients.length) return { error: "NO_HR_RECIPIENT" };
        const at = new Date();
        const [confirmed] = await tx.update(onboardingNotifications).set({
          status: "confirmed", confirmedAt: at, confirmedBy: req.currentUser!.id,
          confirmedNotes: notes?.trim() || null, updatedAt: at,
        }).where(and(eq(onboardingNotifications.id, id), eq(onboardingNotifications.status, "signed"))).returning();
        if (!confirmed) throw new Error("CONFIRMATION_CHANGED");
        await tx.insert(systemNotifications).values({
          title: "اعتماد مباشرة عمل من إدارة التشغيل",
          // Historical exact-recipient alerts outlive grants. Keep their text
          // free of candidate/branch/offer details; the linked HR page rechecks
          // current permissions before revealing the actual personnel record.
          content: "اعتمد مدير التشغيل مباشرة عمل بعد توقيع الموظف. راجع سجل المباشرات المصرّح لك به لاستكمال إجراءات شؤون الموظفين.",
          messageType: "announcement", displayStyle: "banner", priority: 3,
          targetAllBranches: false, targetBranchIds: [n.branchId], targetRoleIds: ["hr_manager"],
          targetUserIds: recipients, createdBy: req.currentUser!.id,
          autoGenerated: true, autoSource: "operations_joining_confirmed",
          dedupeKey: `operations-joining-confirmed:${n.id}`,
          buttonText: "مراجعة المباشرة المعتمدة", buttonAction: `/hr/onboarding?notificationId=${n.id}`,
        });
        return { id: confirmed.id, status: confirmed.status, confirmedAt: confirmed.confirmedAt,
          confirmedBy: confirmed.confirmedBy, alreadyConfirmed: false, hrNotificationCreated: true };
      });
      if (result.error === "NOT_FOUND") return res.status(404).json({ error: "الإشعار غير موجود" });
      if (result.error === "OUT_OF_SCOPE") return res.status(403).json({ error: "المباشرة خارج نطاق فروعك أو تم تحويل صاحب العرض إلى موظف" });
      if (result.error === "NOT_SIGNED") return res.status(409).json({ error: "لا يمكن اعتماد المباشرة قبل توقيع الموظف عليها" });
      if (result.error === "NO_HR_RECIPIENT") return res.status(409).json({ error: "لا يوجد مدير شؤون موظفين نشط ومصرّح له بهذا الفرع لاستلام الإشعار؛ لم يُحفظ الاعتماد" });
      res.set("Cache-Control", "no-store").json(result);
    } catch (error) {
      console.error("Operations joining confirmation error:", error);
      res.status(500).json({ error: "تعذر اعتماد المباشرة وإشعار شؤون الموظفين؛ لم تُحفظ العملية جزئياً" });
    }
  });
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
        const offerId = Number(jobOfferId);
        if (!Number.isSafeInteger(offerId) || offerId < 1) return res.status(400).json({ error: "رقم العرض غير صالح" });
        const result = await db.transaction(async tx => {
          await lockOnboardingCreation(tx);
          await tx.execute(sql`SELECT id FROM job_offers WHERE id = ${offerId} FOR UPDATE`);
          const [offer] = await tx.select().from(jobOffers).where(eq(jobOffers.id, offerId)).limit(1);
          if (!offer) return { status: 404, error: "عرض العمل غير موجود" };
          if (offer.status !== "accepted") return { status: 400, error: "العرض لم يُقبل بعد" };

          // Preserve HR's existing branch selection and branch authorization.
          let effectiveBranchId: string | null = offer.branchId;
          let effectiveBranchName: string | null = offer.branchName;
          if (bodyBranchId) {
            const [b] = await tx.select().from(branches).where(eq(branches.id, String(bodyBranchId))).limit(1);
            if (!b) return { status: 400, error: "الفرع المحدد غير موجود" };
            effectiveBranchId = b.id;
            effectiveBranchName = b.name;
          }
          if (!effectiveBranchId) return { status: 400, error: "العرض بدون فرع — اختر الفرع في النموذج" };
          if (!checkBranchAccess(req, effectiveBranchId)) return { status: 403, error: "لا تملك صلاحية على هذا الفرع" };
          if (offer.hiredEmployeeId) return { status: 409, error: "تم تحويل صاحب العرض إلى موظف" };
          const [existing] = await tx.select().from(onboardingNotifications)
            .where(eq(onboardingNotifications.jobOfferId, offer.id)).limit(1);
          if (existing) return {
            status: 409, error: "يوجد إشعار مباشرة لهذا العرض مسبقاً",
            notification: checkBranchAccess(req, existing.branchId) ? existing : undefined,
          };
          const [created] = await tx.insert(onboardingNotifications).values({
            notificationNumber: await generateNotificationNumber(tx), jobOfferId: offer.id,
            candidateName: offer.candidateName, phone: offer.phone, position: offer.position,
            branchId: effectiveBranchId, branchName: effectiveBranchName, actualStartDate,
            workingHours: workingHours || offer.workingHours || null,
            reportingTo: reportingTo || null, notes: notes || null,
            validityDays: Number(validityDays) || 7, createdBy: (req as any).user?.id || null,
          }).returning();
          return { created };
        });
        if (result.error) return res.status(result.status).json({ error: result.error, notification: result.notification });
        res.status(201).json(result.created);
      } catch (e: any) {
        if (isUniqueConflict(e)) return res.status(409).json({ error: "تعارض مع إنشاء إشعار آخر؛ حدّث القائمة قبل المحاولة مجدداً" });
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
          .where(and(eq(onboardingNotifications.id, id), eq(onboardingNotifications.status, existing.status),
            existing.branchId ? eq(onboardingNotifications.branchId, existing.branchId) : isNull(onboardingNotifications.branchId)))
          .returning();
        if (!updated) return res.status(409).json({ error: "تغيرت حالة الإشعار ولا يمكن تعديله؛ حدّث الصفحة" });
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
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "الإشعار غير صالح" });
        if (req.body?.replaceToken !== undefined && typeof req.body.replaceToken !== "boolean")
          return res.status(400).json({ error: "خيار استبدال الرابط يجب أن يكون صحيحاً أو خطأ" });
        if (req.body?.deliveryMode !== undefined && !["whatsapp_link", "automatic"].includes(req.body.deliveryMode))
          return res.status(400).json({ error: "طريقة الإرسال غير صالحة" });
        const result = await prepareOnboardingSend(id, req.body?.replaceToken === true,
          n => checkBranchAccess(req, n.branchId));
        if ("error" in result) {
          if (result.error === "NOT_FOUND") return res.status(404).json({ error: "غير موجود" });
          if (result.error === "OUT_OF_SCOPE") return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
          return res.status(409).json({ error: "لا يمكن إرسال إشعار موقّع أو منتهٍ" });
        }
        const n = result.notification;
        const link = `${req.protocol}://${req.get("host")}/onboarding/${result.token}`;
        // The HR browser opens WhatsApp for a human to press Send. Do not also
        // deliver via Twilio, which would create an unexpected duplicate.
        const waResult = req.body?.deliveryMode === "whatsapp_link"
          ? { success: false, skipped: true, status: "manual" }
          : await deliverOnboardingLink(isTwilioConfigured, async () => {
          let branchName: string | undefined = n.branchName || undefined;
          if (n.branchId) {
            const [b] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, n.branchId)).limit(1);
            if (b) branchName = b.name;
          }
          const message = buildOnboardingMessage(n, link, branchName);
          return sendWhatsAppMessage(n.phone, message);
        });

        res.set("Cache-Control", "no-store").json({ link, phone: n.phone, whatsapp: waResult, channel: "whatsapp",
          notificationNumber: n.notificationNumber, sentAt: n.sentAt, expiresAt: n.expiresAt, tokenReused: result.tokenReused });
      } catch (e: any) {
        if (e instanceof Error && e.message === "JOINING_SEND_STATE_CHANGED")
          return res.status(409).json({ error: "تغيرت حالة المباشرة؛ حدّث الصفحة" });
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
          .where(and(eq(onboardingNotifications.id, id), eq(onboardingNotifications.status, "signed"),
            n.branchId ? eq(onboardingNotifications.branchId, n.branchId) : isNull(onboardingNotifications.branchId)))
          .returning();
        if (!updated) return res.status(409).json({ error: "تغيرت حالة المباشرة ولا يمكن تأكيدها؛ حدّث الصفحة" });
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

        const cancelled = await db.transaction(async tx => {
          // CAS the state that HR reviewed; a concurrent signature/conversion
          // must not be silently cancelled. Token revocation commits with it.
          const updated = await tx.update(onboardingNotifications)
            .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: req.body?.reason || null, updatedAt: new Date() })
            .where(and(eq(onboardingNotifications.id, id), eq(onboardingNotifications.status, n.status),
              n.branchId ? eq(onboardingNotifications.branchId, n.branchId) : isNull(onboardingNotifications.branchId)))
            .returning({ id: onboardingNotifications.id });
          if (!updated.length) return false;
          await tx.update(onboardingTokens).set({ revokedAt: new Date() })
            .where(and(eq(onboardingTokens.notificationId, id), isNull(onboardingTokens.revokedAt)));
          return true;
        });
        if (!cancelled) return res.status(409).json({ error: "تغيرت حالة المباشرة ولا يمكن إلغاؤها؛ حدّث الصفحة" });
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

      const result = await db.transaction<
        { status: number; error: string } | { success: true; distanceM: number | null; withinRadius: boolean | null }
      >(async tx => {
        // Send/resend locks the notification before revoking token rows.
        // Use the same order here, then re-read both states after the locks.
        await tx.execute(sql`SELECT n.id FROM onboarding_notifications n
          JOIN onboarding_tokens t ON t.notification_id = n.id
          WHERE t.token = ${token} FOR UPDATE OF n`);
        await tx.execute(sql`SELECT id FROM onboarding_tokens WHERE token = ${token} FOR UPDATE`);
        const [tk] = await tx.select().from(onboardingTokens).where(eq(onboardingTokens.token, token)).limit(1);
        if (!tk) return { status: 404, error: "الرابط غير صالح" };
        if (tk.revokedAt) return { status: 410, error: "تم إلغاء هذا الرابط" };
        if (tk.usedAt) return { status: 410, error: "تم استخدام هذا الرابط مسبقاً" };
        const now = new Date();
        if (new Date(tk.expiresAt) <= now) return { status: 410, error: "انتهت صلاحية هذا الرابط" };

        const [n] = await tx.select().from(onboardingNotifications).where(eq(onboardingNotifications.id, tk.notificationId)).limit(1);
        if (!n) return { status: 404, error: "الإشعار غير موجود" };
        if (!["pending", "sent"].includes(n.status))
          return { status: 409, error: "تم توقيع هذا الإشعار مسبقاً أو لم يعد قابلاً للتوقيع" };

        let distanceM: number | null = null;
        let withinRadius: boolean | null = null;
        if (n.branchId && typeof selfieLat === "number" && typeof selfieLng === "number") {
          const [b] = await tx.select().from(branches).where(eq(branches.id, n.branchId)).limit(1);
          if (b && b.latitude != null && b.longitude != null) {
            distanceM = haversineMeters(b.latitude, b.longitude, selfieLat, selfieLng);
            withinRadius = distanceM <= (b.locationRadius || 200);
          }
        }

        const signed = await tx.update(onboardingNotifications).set({
          status: "signed", employeeSignature: signature, selfiePhotoUrl,
          selfieLat: typeof selfieLat === "number" ? selfieLat : null,
          selfieLng: typeof selfieLng === "number" ? selfieLng : null,
          selfieAccuracy: typeof selfieAccuracy === "number" ? selfieAccuracy : null,
          selfieCapturedAt: now, distanceFromBranchM: distanceM, withinBranchRadius: withinRadius,
          signedAt: now,
          signedIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
          signedUserAgent: (req.headers["user-agent"] as string) || null, updatedAt: now,
        }).where(and(eq(onboardingNotifications.id, n.id), inArray(onboardingNotifications.status, ["pending", "sent"])))
          .returning({ id: onboardingNotifications.id });
        if (!signed.length) throw new Error("JOINING_SIGN_STATE_CHANGED");
        const used = await tx.update(onboardingTokens).set({ usedAt: now }).where(and(
          eq(onboardingTokens.id, tk.id), eq(onboardingTokens.notificationId, n.id),
          isNull(onboardingTokens.usedAt), isNull(onboardingTokens.revokedAt),
          sql`${onboardingTokens.expiresAt} > clock_timestamp()`,
        )).returning({ id: onboardingTokens.id });
        if (!used.length) throw new Error("JOINING_SIGN_STATE_CHANGED");
        if (n.branchId) await queueHrSourceNotification("joining", n.id, tx);
        return { success: true, distanceM, withinRadius };
      });
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      res.json(result);
    } catch (e: any) {
      if (e instanceof Error && e.message === "JOINING_SIGN_STATE_CHANGED")
        return res.status(409).json({ error: "تغيرت حالة رابط المباشرة؛ حدّث الصفحة قبل المحاولة مجدداً" });
      console.error("[onboarding] sign error:", e);
      res.status(500).json({ error: "تعذر حفظ توقيع المباشرة؛ لم يُحفظ التوقيع أو استخدام الرابط" });
    }
  });
}
