import type { Express } from "express";
import { db } from "./db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { isAuthenticated, requirePermission } from "./auth";
import {
  shareholders,
  shareholderAnnouncements,
  shareholderNotifications,
  shareholderDocuments,
  governanceMeetings,
  dividendDistributions,
  assemblyResolutions,
  assemblyResolutionVotes,
  users,
  notificationQueue,
  insertShareholderAnnouncementSchema,
} from "@shared/schema";
import { z } from "zod";

// بيانات الكيان القانوني (تظهر للمساهم في البوابة)
const COMPANY_INFO = {
  nameAr: "شركة الزبد الأفضل التجارية",
  nameEn: "Butter Bakery Trading Co.",
  legalForm: "شركة مساهمة مقفلة",
  commercialRegister: "7026155296",
};

function getUserId(req: any): string | null {
  return (req as any).currentUser?.id || (req as any).user?.id || (req as any).user?.claims?.sub || null;
}

// المساهم المرتبط بحساب المستخدم الحالي
async function getMyShareholder(req: any) {
  const userId = getUserId(req);
  if (!userId) return null;
  // تعزيز أمني: بوابة المساهم محصورة على حسابات دور "shareholder" فقط
  const role = (req as any).currentUser?.role;
  if (role !== "shareholder") return null;
  const [sh] = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.linkedUserId, userId))
    .limit(1);
  return sh || null;
}

// تحقق صلاحية كلمة المرور (نفس قواعد بوابة الموظف)
function validatePassword(password: string): string | null {
  if (!password || password.length < 8 || password.length > 128) {
    return "كلمة المرور يجب أن تكون بين 8 و 128 حرفاً";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حروف كبيرة وصغيرة وأرقام";
  }
  return null;
}

const sendNotificationSchema = z.object({
  target: z.enum(["all", "one"]),
  shareholderId: z.number().int().positive().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  sendWhatsapp: z.boolean().optional().default(false),
});

const voteSchema = z.object({
  vote: z.enum(["for", "against", "abstain"]),
  comments: z.string().max(1000).optional(),
});

export function registerShareholderPortalRoutes(app: Express) {
  // ======================================================================
  // بوابة المساهم — Shareholder Self-Service Portal
  // كل المسارات هنا محصورة على ملف المساهم المرتبط بحساب المستخدم الحالي.
  // ======================================================================

  // ملف المساهم الخاص بالمستخدم الحالي + بيانات الشركة
  app.get("/api/shareholder/me", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.json({ hasShareholder: false, shareholder: null, company: COMPANY_INFO });
      const unread = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(shareholderNotifications)
        .where(and(eq(shareholderNotifications.shareholderId, sh.id), isNull(shareholderNotifications.readAt)));
      return res.json({
        hasShareholder: true,
        shareholder: sh,
        company: COMPANY_INFO,
        unreadNotifications: unread[0]?.c || 0,
      });
    } catch (error) {
      console.error("Error fetching shareholder profile:", error);
      res.status(500).json({ error: "فشل في جلب بيانات المساهم" });
    }
  });

  // الأخبار والإعلانات المنشورة
  app.get("/api/shareholder/announcements", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select()
        .from(shareholderAnnouncements)
        .where(eq(shareholderAnnouncements.isPublished, true))
        .orderBy(desc(shareholderAnnouncements.publishedAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ error: "فشل في جلب الأخبار" });
    }
  });

  // اجتماعات الجمعية العمومية / المجلس (الجدول والمواعيد)
  app.get("/api/shareholder/meetings", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select({
          id: governanceMeetings.id,
          meetingNumber: governanceMeetings.meetingNumber,
          meetingType: governanceMeetings.meetingType,
          title: governanceMeetings.title,
          description: governanceMeetings.description,
          meetingDate: governanceMeetings.meetingDate,
          startTime: governanceMeetings.startTime,
          endTime: governanceMeetings.endTime,
          location: governanceMeetings.location,
          locationType: governanceMeetings.locationType,
          virtualMeetingLink: governanceMeetings.virtualMeetingLink,
          agenda: governanceMeetings.agenda,
          status: governanceMeetings.status,
        })
        .from(governanceMeetings)
        .orderBy(desc(governanceMeetings.meetingDate));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "فشل في جلب الاجتماعات" });
    }
  });

  // توزيعات الأرباح + حساب نصيب المساهم
  app.get("/api/shareholder/dividends", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select()
        .from(dividendDistributions)
        .orderBy(desc(dividendDistributions.paymentDate));
      const myShares = sh.numberOfShares || 0;
      const enriched = rows.map((d) => {
        const perShare = parseFloat(d.amountPerShare as any) || 0;
        return {
          ...d,
          myShares,
          myAmount: +(perShare * myShares).toFixed(2),
        };
      });
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching dividends:", error);
      res.status(500).json({ error: "فشل في جلب التوزيعات" });
    }
  });

  // وثائق المساهم الخاصة به فقط
  app.get("/api/shareholder/documents", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select()
        .from(shareholderDocuments)
        .where(eq(shareholderDocuments.shareholderId, sh.id))
        .orderBy(desc(shareholderDocuments.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching shareholder documents:", error);
      res.status(500).json({ error: "فشل في جلب الوثائق" });
    }
  });

  // إشعارات المساهم الخاصة به
  app.get("/api/shareholder/notifications", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select()
        .from(shareholderNotifications)
        .where(eq(shareholderNotifications.shareholderId, sh.id))
        .orderBy(desc(shareholderNotifications.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching shareholder notifications:", error);
      res.status(500).json({ error: "فشل في جلب الإشعارات" });
    }
  });

  // تعليم إشعار كمقروء (محصور على إشعارات المساهم نفسه)
  app.post("/api/shareholder/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const [updated] = await db
        .update(shareholderNotifications)
        .set({ readAt: new Date() })
        .where(and(eq(shareholderNotifications.id, id), eq(shareholderNotifications.shareholderId, sh.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: "الإشعار غير موجود" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "فشل في تحديث الإشعار" });
    }
  });

  // القرارات المطروحة للتصويت + تصويت المساهم الحالي
  app.get("/api/shareholder/resolutions", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select({
          id: assemblyResolutions.id,
          resolutionNumber: assemblyResolutions.resolutionNumber,
          title: assemblyResolutions.title,
          description: assemblyResolutions.description,
          assemblyType: assemblyResolutions.assemblyType,
          resolutionType: assemblyResolutions.resolutionType,
          status: assemblyResolutions.status,
          votingRequired: assemblyResolutions.votingRequired,
          votingDeadline: assemblyResolutions.votingDeadline,
          proposedAt: assemblyResolutions.proposedAt,
        })
        .from(assemblyResolutions)
        .where(eq(assemblyResolutions.votingRequired, true))
        .orderBy(desc(assemblyResolutions.proposedAt));

      const myVotes = await db
        .select({ resolutionId: assemblyResolutionVotes.resolutionId, vote: assemblyResolutionVotes.vote })
        .from(assemblyResolutionVotes)
        .where(eq(assemblyResolutionVotes.shareholderId, sh.id));
      const voteMap = new Map(myVotes.map((v) => [v.resolutionId, v.vote]));

      const enriched = rows.map((r) => ({
        ...r,
        myVote: voteMap.get(r.id) || null,
        canVote: !!sh.votingRights && r.status === "voting",
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching resolutions:", error);
      res.status(500).json({ error: "فشل في جلب القرارات" });
    }
  });

  // الإدلاء بصوت على قرار (مرجّح بعدد الأسهم)
  app.post("/api/shareholder/resolutions/:id/vote", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      if (!sh.votingRights) return res.status(403).json({ error: "لا تملك حق التصويت" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = voteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

      const result = await db.transaction(async (tx) => {
        const [resolution] = await tx
          .select()
          .from(assemblyResolutions)
          .where(eq(assemblyResolutions.id, id))
          .limit(1);
        if (!resolution) return { error: "القرار غير موجود", code: 404 };
        if (resolution.status !== "voting") return { error: "التصويت غير مفتوح على هذا القرار", code: 400 };

        const [existing] = await tx
          .select()
          .from(assemblyResolutionVotes)
          .where(and(eq(assemblyResolutionVotes.resolutionId, id), eq(assemblyResolutionVotes.shareholderId, sh.id)))
          .limit(1);
        if (existing) return { error: "لقد قمت بالتصويت على هذا القرار مسبقاً", code: 400 };

        const shares = sh.numberOfShares || 0;
        await tx.insert(assemblyResolutionVotes).values({
          resolutionId: id,
          shareholderId: sh.id,
          voterName: sh.fullName,
          vote: parsed.data.vote,
          sharesVoted: String(shares),
          voteMethod: "online_portal",
          comments: parsed.data.comments || null,
          ipAddress: req.ip || null,
        });

        // حدّث المجاميع (الأصوات بالرؤوس + الأسهم)
        const voteCol =
          parsed.data.vote === "for" ? "for_votes" : parsed.data.vote === "against" ? "against_votes" : "abstain_votes";
        const shareCol =
          parsed.data.vote === "for" ? "for_shares" : parsed.data.vote === "against" ? "against_shares" : "abstain_shares";
        await tx.execute(sql`
          UPDATE assembly_resolutions
          SET ${sql.raw(voteCol)} = COALESCE(${sql.raw(voteCol)}, 0) + 1,
              total_votes = COALESCE(total_votes, 0) + 1,
              ${sql.raw(shareCol)} = COALESCE(${sql.raw(shareCol)}, 0) + ${shares}
          WHERE id = ${id}
        `);
        return { ok: true };
      });

      if ((result as any).error) return res.status((result as any).code).json({ error: (result as any).error });
      res.json({ success: true });
    } catch (error) {
      console.error("Error casting vote:", error);
      res.status(500).json({ error: "فشل في تسجيل التصويت" });
    }
  });

  // ======================================================================
  // لوحة التحكم والتواصل (للإدارة) — محمية بصلاحية governance_shareholders
  // ======================================================================

  // مؤشرات لوحة التحكم
  app.get("/api/governance/investor-dashboard", isAuthenticated, requirePermission("governance_shareholders", "view"), async (_req, res) => {
    try {
      const allShareholders = await db.select().from(shareholders);
      const active = allShareholders.filter((s) => s.status === "active");
      const totalShares = active.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);
      const withAccount = active.filter((s) => s.linkedUserId).length;
      const boardMembersCount = active.filter((s) => s.isBoardMember).length;

      const byType: Record<string, number> = {};
      for (const s of active) {
        byType[s.shareholderType] = (byType[s.shareholderType] || 0) + 1;
      }

      // أكبر المساهمين
      const topShareholders = [...active]
        .sort((a, b) => (b.numberOfShares || 0) - (a.numberOfShares || 0))
        .slice(0, 8)
        .map((s) => ({
          id: s.id,
          fullName: s.fullName,
          numberOfShares: s.numberOfShares,
          sharePercentage: s.sharePercentage,
          shareholderType: s.shareholderType,
        }));

      const [meetingsCount] = await db.select({ c: sql<number>`count(*)::int` }).from(governanceMeetings);
      const upcomingMeetings = await db
        .select({
          id: governanceMeetings.id,
          title: governanceMeetings.title,
          meetingDate: governanceMeetings.meetingDate,
          status: governanceMeetings.status,
          meetingType: governanceMeetings.meetingType,
        })
        .from(governanceMeetings)
        .where(eq(governanceMeetings.status, "scheduled"))
        .orderBy(governanceMeetings.meetingDate)
        .limit(5);

      res.json({
        totalShareholders: active.length,
        totalShares,
        withAccount,
        withoutAccount: active.length - withAccount,
        boardMembersCount,
        byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
        topShareholders,
        meetingsCount: meetingsCount?.c || 0,
        upcomingMeetings,
        company: COMPANY_INFO,
      });
    } catch (error) {
      console.error("Error building investor dashboard:", error);
      res.status(500).json({ error: "فشل في جلب لوحة التحكم" });
    }
  });

  // ---- الأخبار والإعلانات: CRUD ----
  app.get("/api/governance/shareholder-announcements", isAuthenticated, requirePermission("governance_shareholders", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(shareholderAnnouncements).orderBy(desc(shareholderAnnouncements.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("Error listing announcements:", error);
      res.status(500).json({ error: "فشل في جلب الإعلانات" });
    }
  });

  app.post("/api/governance/shareholder-announcements", isAuthenticated, requirePermission("governance_shareholders", "create"), async (req, res) => {
    try {
      const parsed = insertShareholderAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });
      const [row] = await db
        .insert(shareholderAnnouncements)
        .values({ ...parsed.data, createdBy: getUserId(req) })
        .returning();
      res.status(201).json(row);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ error: "فشل في إنشاء الإعلان" });
    }
  });

  app.patch("/api/governance/shareholder-announcements/:id", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = insertShareholderAnnouncementSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const [row] = await db
        .update(shareholderAnnouncements)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(shareholderAnnouncements.id, id))
        .returning();
      if (!row) return res.status(404).json({ error: "الإعلان غير موجود" });
      res.json(row);
    } catch (error) {
      console.error("Error updating announcement:", error);
      res.status(500).json({ error: "فشل في تحديث الإعلان" });
    }
  });

  app.delete("/api/governance/shareholder-announcements/:id", isAuthenticated, requirePermission("governance_shareholders", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      await db.delete(shareholderAnnouncements).where(eq(shareholderAnnouncements.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ error: "فشل في حذف الإعلان" });
    }
  });

  // ---- إشعارات المساهمين: إرسال (واحد/الكل) + سجل ----
  app.post("/api/governance/shareholder-notifications", isAuthenticated, requirePermission("governance_shareholders", "create"), async (req, res) => {
    try {
      const parsed = sendNotificationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });
      const { target, shareholderId, title, body, sendWhatsapp } = parsed.data;

      // حدّد المستلمين من قاعدة البيانات (لا تثق بأي بيانات من العميل)
      let recipients: typeof shareholders.$inferSelect[];
      if (target === "one") {
        if (!shareholderId) return res.status(400).json({ error: "معرف المساهم مطلوب" });
        recipients = await db.select().from(shareholders).where(eq(shareholders.id, shareholderId));
      } else {
        recipients = await db.select().from(shareholders).where(eq(shareholders.status, "active"));
      }
      if (recipients.length === 0) return res.status(404).json({ error: "لا يوجد مستلمون" });

      const createdBy = getUserId(req);
      const notifRows = recipients.map((s) => ({
        shareholderId: s.id,
        title,
        body,
        sentWhatsapp: !!sendWhatsapp && !!s.phone,
        createdBy,
      }));
      await db.insert(shareholderNotifications).values(notifRows);

      // أدرج رسائل واتساب في طابور الإشعارات (يعالجها المجدول مع إعادة المحاولة)
      let queued = 0;
      if (sendWhatsapp) {
        const queueRows = recipients
          .filter((s) => s.phone)
          .map((s) => ({
            recipientPhone: s.phone as string,
            recipientName: s.fullName,
            channel: "whatsapp",
            message: `${title}\n\n${body}`,
            relatedModule: "shareholder_notification",
            relatedEntityId: String(s.id),
          }));
        if (queueRows.length > 0) {
          await db.insert(notificationQueue).values(queueRows);
          queued = queueRows.length;
        }
      }

      res.status(201).json({ success: true, sent: recipients.length, whatsappQueued: queued });
    } catch (error) {
      console.error("Error sending shareholder notifications:", error);
      res.status(500).json({ error: "فشل في إرسال الإشعارات" });
    }
  });

  // سجل آخر الإشعارات المرسلة (مجمّعة بالعنوان/التاريخ)
  app.get("/api/governance/shareholder-notifications", isAuthenticated, requirePermission("governance_shareholders", "view"), async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: shareholderNotifications.id,
          shareholderId: shareholderNotifications.shareholderId,
          shareholderName: shareholders.fullName,
          title: shareholderNotifications.title,
          body: shareholderNotifications.body,
          sentWhatsapp: shareholderNotifications.sentWhatsapp,
          readAt: shareholderNotifications.readAt,
          createdAt: shareholderNotifications.createdAt,
        })
        .from(shareholderNotifications)
        .leftJoin(shareholders, eq(shareholderNotifications.shareholderId, shareholders.id))
        .orderBy(desc(shareholderNotifications.createdAt))
        .limit(200);
      res.json(rows);
    } catch (error) {
      console.error("Error listing shareholder notifications:", error);
      res.status(500).json({ error: "فشل في جلب سجل الإشعارات" });
    }
  });

  // ---- حسابات بوابة المساهمين ----
  app.get("/api/governance/shareholder-portal-accounts", isAuthenticated, requirePermission("governance_shareholders", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(shareholders).orderBy(desc(shareholders.numberOfShares));
      const linkedIds = rows.map((s) => s.linkedUserId).filter(Boolean) as string[];
      const userRows = linkedIds.length
        ? await db.select({ id: users.id, username: users.username }).from(users)
        : [];
      const usernameById = new Map(userRows.map((u) => [u.id, u.username]));
      res.json(
        rows.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          shareholderType: s.shareholderType,
          numberOfShares: s.numberOfShares,
          sharePercentage: s.sharePercentage,
          phone: s.phone,
          email: s.email,
          hasAccount: !!s.linkedUserId,
          username: s.linkedUserId ? usernameById.get(s.linkedUserId) || null : null,
        })),
      );
    } catch (error) {
      console.error("Error listing portal accounts:", error);
      res.status(500).json({ error: "فشل في جلب حسابات البوابة" });
    }
  });

  // إنشاء حساب دخول للمساهم وربطه به (ذرّي)
  app.post("/api/governance/shareholders/:id/create-account", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const { username, password } = req.body || {};
      if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({ error: "اسم المستخدم يجب أن يكون بين 3 و 50 حرفاً" });
      }
      const pwErr = validatePassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });

      const [shareholder] = await db.select().from(shareholders).where(eq(shareholders.id, id)).limit(1);
      if (!shareholder) return res.status(404).json({ error: "المساهم غير موجود" });
      if (shareholder.linkedUserId) return res.status(400).json({ error: "هذا المساهم مرتبط بحساب بالفعل" });

      const [existingUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existingUser) return res.status(400).json({ error: "اسم المستخدم مسجل مسبقاً" });

      const fullName = (shareholder.fullName || "").trim();
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || fullName || username;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ username, password: hashedPassword, firstName, lastName, role: "shareholder" })
          .returning();
        const [updated] = await tx
          .update(shareholders)
          .set({ linkedUserId: user.id, updatedAt: new Date() })
          .where(and(eq(shareholders.id, id), isNull(shareholders.linkedUserId)))
          .returning();
        if (!updated) throw new Error("هذا المساهم مرتبط بحساب بالفعل");
        return user;
      });

      const { password: _pw, ...safeUser } = result as any;
      res.status(201).json({ user: safeUser });
    } catch (error: any) {
      console.error("Error creating shareholder account:", error);
      if (error?.message === "هذا المساهم مرتبط بحساب بالفعل") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "فشل في إنشاء حساب المساهم" });
    }
  });

  // إعادة تعيين كلمة المرور
  app.post("/api/governance/shareholders/:id/reset-password", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const { password } = req.body || {};
      const pwErr = validatePassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });

      const [shareholder] = await db.select().from(shareholders).where(eq(shareholders.id, id)).limit(1);
      if (!shareholder) return res.status(404).json({ error: "المساهم غير موجود" });
      if (!shareholder.linkedUserId) return res.status(400).json({ error: "هذا المساهم غير مرتبط بحساب" });

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, shareholder.linkedUserId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting shareholder password:", error);
      res.status(500).json({ error: "فشل في إعادة تعيين كلمة المرور" });
    }
  });

  // فك ارتباط المساهم بحسابه (لا يحذف الحساب)
  app.post("/api/governance/shareholders/:id/unlink-account", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const [shareholder] = await db.select().from(shareholders).where(eq(shareholders.id, id)).limit(1);
      if (!shareholder) return res.status(404).json({ error: "المساهم غير موجود" });
      await db.update(shareholders).set({ linkedUserId: null, updatedAt: new Date() }).where(eq(shareholders.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking shareholder account:", error);
      res.status(500).json({ error: "فشل في فك الارتباط" });
    }
  });
}
