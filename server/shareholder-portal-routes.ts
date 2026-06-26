import type { Express } from "express";
import crypto from "crypto";
import { db } from "./db";
import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { isAuthenticated, requirePermission } from "./auth";
import {
  shareholders,
  shareholderAnnouncements,
  shareholderNotifications,
  shareholderDocuments,
  governanceMeetings,
  meetingMinutes,
  dividendDistributions,
  assemblyResolutions,
  assemblyResolutionVotes,
  users,
  notificationQueue,
  insertShareholderAnnouncementSchema,
  branchOpeningInvitations,
  invitationRecipients,
  insertBranchOpeningInvitationSchema,
  shareholderPortalSettings,
  shareholderTickets,
  shareholderTicketMessages,
  shareholderProfileUpdateRequests,
  shareholderActivityLog,
} from "@shared/schema";
import { z } from "zod";
import { logShareholderActivity } from "./shareholder-security";

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

// إعدادات البوابة (سجل مفرد id=1) — يقرأها ويُنشئها إن لم تكن موجودة
const DEFAULT_PORTAL_SETTINGS = {
  welcomeTitle: null as string | null,
  welcomeMessage: null as string | null,
  showNews: true,
  showMeetings: true,
  showDividends: true,
  showVoting: true,
  showDocuments: true,
  showFinancials: true,
  showMessages: true,
  showProfileEdits: true,
  supportEmail: null as string | null,
  supportPhone: null as string | null,
  enableWhatsapp: true,
  requireTwoFactor: false,
  twoFactorChannel: "whatsapp",
};

async function getPortalSettings() {
  const [row] = await db.select().from(shareholderPortalSettings).where(eq(shareholderPortalSettings.id, 1)).limit(1);
  if (row) return row;
  try {
    const [created] = await db
      .insert(shareholderPortalSettings)
      .values({ id: 1, ...DEFAULT_PORTAL_SETTINGS } as any)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
  } catch {
    /* تجاهل سباق الإنشاء المتزامن */
  }
  const [again] = await db.select().from(shareholderPortalSettings).where(eq(shareholderPortalSettings.id, 1)).limit(1);
  return again || ({ id: 1, ...DEFAULT_PORTAL_SETTINGS, updatedBy: null, updatedAt: new Date() } as any);
}

// الحقول الظاهرة للمساهم فقط (بدون بيانات تدقيق)
function publicPortalSettings(s: any) {
  return {
    welcomeTitle: s.welcomeTitle ?? null,
    welcomeMessage: s.welcomeMessage ?? null,
    showNews: s.showNews ?? true,
    showMeetings: s.showMeetings ?? true,
    showDividends: s.showDividends ?? true,
    showVoting: s.showVoting ?? true,
    showDocuments: s.showDocuments ?? true,
    showFinancials: s.showFinancials ?? true,
    showMessages: s.showMessages ?? true,
    showProfileEdits: s.showProfileEdits ?? true,
    supportEmail: s.supportEmail ?? null,
    supportPhone: s.supportPhone ?? null,
  };
}

const updatePortalSettingsSchema = z.object({
  welcomeTitle: z.string().max(200).nullable().optional(),
  welcomeMessage: z.string().max(4000).nullable().optional(),
  showNews: z.boolean().optional(),
  showMeetings: z.boolean().optional(),
  showDividends: z.boolean().optional(),
  showVoting: z.boolean().optional(),
  showDocuments: z.boolean().optional(),
  showFinancials: z.boolean().optional(),
  showMessages: z.boolean().optional(),
  showProfileEdits: z.boolean().optional(),
  supportEmail: z.string().max(200).nullable().optional(),
  supportPhone: z.string().max(50).nullable().optional(),
  enableWhatsapp: z.boolean().optional(),
  requireTwoFactor: z.boolean().optional(),
  twoFactorChannel: z.enum(["whatsapp", "sms", "both"]).optional(),
});

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

// الحقول التي يُسمح للمساهم بطلب تعديلها ذاتياً (المرحلة 3) — مع التسميات العربية
const EDITABLE_PROFILE_FIELDS: { field: string; label: string }[] = [
  { field: "phone", label: "رقم الجوال" },
  { field: "email", label: "البريد الإلكتروني" },
  { field: "address", label: "العنوان" },
  { field: "bankName", label: "اسم البنك" },
  { field: "bankAccountNumber", label: "رقم الحساب البنكي" },
  { field: "iban", label: "الآيبان (IBAN)" },
];
const EDITABLE_FIELD_KEYS = EDITABLE_PROFILE_FIELDS.map((f) => f.field) as [string, ...string[]];
// حقول مالية حسّاسة: تُخفى وتُمنع من التحرير عند إيقاف عرض البيانات المالية (showFinancials)
const FINANCIAL_FIELD_KEYS = ["bankName", "bankAccountNumber", "iban"];

const profileUpdateRequestSchema = z.object({
  // قيم الحقول المطلوبة فقط — أي حقل خارج القائمة البيضاء يُرفض
  values: z.record(z.enum(EDITABLE_FIELD_KEYS), z.string().trim().max(500).nullable()),
  note: z.string().max(1000).optional(),
});

const profileReviewSchema = z.object({
  reviewNote: z.string().max(1000).optional(),
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
      // إخفاء البيانات المالية الحسّاسة من الحمولة عند إيقاف عرضها (تطبيق على مستوى الخادم لا الواجهة)
      const settings = await getPortalSettings();
      let shareholderOut: any = sh;
      if (!settings.showFinancials) {
        const { bankName, bankAccountNumber, iban, ...rest } = sh as any;
        shareholderOut = rest;
      }
      return res.json({
        hasShareholder: true,
        shareholder: shareholderOut,
        company: COMPANY_INFO,
        unreadNotifications: unread[0]?.c || 0,
      });
    } catch (error) {
      console.error("Error fetching shareholder profile:", error);
      res.status(500).json({ error: "فشل في جلب بيانات المساهم" });
    }
  });

  // إعدادات البوابة الظاهرة للمساهم (الأقسام المفعّلة + رسالة الترحيب + الدعم)
  // محصورة على حسابات المساهمين المرتبطة فقط (نفس سياسة باقي مسارات /api/shareholder)
  app.get("/api/shareholder/portal-settings", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const s = await getPortalSettings();
      return res.json(publicPortalSettings(s));
    } catch (error) {
      console.error("Error fetching portal settings:", error);
      // قيم افتراضية آمنة حتى لا تنهار البوابة
      return res.json(publicPortalSettings(DEFAULT_PORTAL_SETTINGS));
    }
  });

  // ===== إعدادات البوابة (إدارة) =====
  app.get("/api/governance/shareholder-portal-settings", isAuthenticated, requirePermission("governance_shareholders", "view"), async (_req, res) => {
    try {
      const s = await getPortalSettings();
      return res.json(s);
    } catch (error) {
      console.error("Error fetching portal settings (admin):", error);
      res.status(500).json({ error: "فشل في جلب إعدادات البوابة" });
    }
  });

  app.put("/api/governance/shareholder-portal-settings", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const parsed = updatePortalSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
      }
      await getPortalSettings(); // يضمن وجود السجل
      const userId = getUserId(req);
      const [updated] = await db
        .update(shareholderPortalSettings)
        .set({ ...parsed.data, updatedBy: userId, updatedAt: new Date() })
        .where(eq(shareholderPortalSettings.id, 1))
        .returning();
      return res.json(updated);
    } catch (error) {
      console.error("Error updating portal settings:", error);
      res.status(500).json({ error: "فشل في حفظ إعدادات البوابة" });
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

      // أرفق المحاضر المعتمدة/الموقّعة فقط (الرسمية وغير القابلة للتعديل) لكل اجتماع
      const meetingIds = rows.map((r) => r.id);
      let minutesByMeeting = new Map<number, any>();
      if (meetingIds.length > 0) {
        const mins = await db
          .select({
            id: meetingMinutes.id,
            meetingId: meetingMinutes.meetingId,
            minutesNumber: meetingMinutes.minutesNumber,
            content: meetingMinutes.content,
            summary: meetingMinutes.summary,
            attendanceList: meetingMinutes.attendanceList,
            discussionPoints: meetingMinutes.discussionPoints,
            decisions: meetingMinutes.decisions,
            votingResults: meetingMinutes.votingResults,
            status: meetingMinutes.status,
            isLocked: meetingMinutes.isLocked,
          })
          .from(meetingMinutes)
          .where(
            and(
              inArray(meetingMinutes.meetingId, meetingIds),
              sql`(${meetingMinutes.status} IN ('signed','archived') OR ${meetingMinutes.isLocked} = true)`,
            ),
          )
          .orderBy(desc(meetingMinutes.id));
        for (const m of mins) {
          if (!minutesByMeeting.has(m.meetingId)) minutesByMeeting.set(m.meetingId, m);
        }
      }
      res.json(rows.map((r) => ({ ...r, minutes: minutesByMeeting.get(r.id) || null })));
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

  // تسجيل اطلاع المساهم على وثيقة (لسجل النشاط)
  app.post("/api/shareholder/documents/:id/view", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صالح" });
      // تأكد أن الوثيقة تخص هذا المساهم (منع IDOR)
      const [doc] = await db
        .select()
        .from(shareholderDocuments)
        .where(and(eq(shareholderDocuments.id, id), eq(shareholderDocuments.shareholderId, sh.id)))
        .limit(1);
      if (!doc) return res.status(404).json({ error: "الوثيقة غير موجودة" });
      void logShareholderActivity({
        shareholderId: sh.id,
        userId: getUserId(req),
        action: "document_view",
        description: `اطّلاع على وثيقة: ${doc.documentName || `#${id}`}`,
        metadata: { documentId: id },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging document view:", error);
      res.status(500).json({ error: "فشل في تسجيل الاطلاع" });
    }
  });

  // سجل نشاط المساهم نفسه (يرى نشاطه فقط)
  app.get("/api/shareholder/activity", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 200);
      const rows = await db
        .select()
        .from(shareholderActivityLog)
        .where(eq(shareholderActivityLog.shareholderId, sh.id))
        .orderBy(desc(shareholderActivityLog.createdAt))
        .limit(limit);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching shareholder activity:", error);
      res.status(500).json({ error: "فشل في جلب سجل النشاط" });
    }
  });

  // سجل نشاط جميع المساهمين (للإدارة) — مع اسم المساهم وفلتر اختياري
  app.get(
    "/api/governance/shareholder-activity",
    isAuthenticated,
    requirePermission("governance_shareholders", "view"),
    async (req, res) => {
      try {
        const limit = Math.min(parseInt(String(req.query.limit ?? "200"), 10) || 200, 500);
        const shFilter = req.query.shareholderId ? parseInt(String(req.query.shareholderId), 10) : null;
        const conditions = shFilter && Number.isFinite(shFilter)
          ? eq(shareholderActivityLog.shareholderId, shFilter)
          : undefined;
        const rows = await db
          .select({
            id: shareholderActivityLog.id,
            shareholderId: shareholderActivityLog.shareholderId,
            shareholderName: shareholders.fullName,
            userId: shareholderActivityLog.userId,
            action: shareholderActivityLog.action,
            description: shareholderActivityLog.description,
            metadata: shareholderActivityLog.metadata,
            ipAddress: shareholderActivityLog.ipAddress,
            userAgent: shareholderActivityLog.userAgent,
            createdAt: shareholderActivityLog.createdAt,
          })
          .from(shareholderActivityLog)
          .leftJoin(shareholders, eq(shareholderActivityLog.shareholderId, shareholders.id))
          .where(conditions as any)
          .orderBy(desc(shareholderActivityLog.createdAt))
          .limit(limit);
        res.json(rows);
      } catch (error) {
        console.error("Error fetching all shareholder activity:", error);
        res.status(500).json({ error: "فشل في جلب سجل النشاط" });
      }
    },
  );

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
      void logShareholderActivity({
        shareholderId: sh.id,
        userId: getUserId(req),
        action: "vote",
        description: `تصويت على قرار رقم ${id}: ${parsed.data.vote === "for" ? "موافق" : parsed.data.vote === "against" ? "غير موافق" : "ممتنع"}`,
        metadata: { resolutionId: id, vote: parsed.data.vote },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error casting vote:", error);
      res.status(500).json({ error: "فشل في تسجيل التصويت" });
    }
  });

  // ======================================================================
  // المرحلة 2 — التواصل ثنائي الاتجاه (صندوق الرسائل/التذاكر)
  // ======================================================================
  const createTicketSchema = z.object({
    subject: z.string().trim().min(1, "الموضوع مطلوب").max(200),
    body: z.string().trim().min(1, "الرسالة مطلوبة").max(4000),
  });
  const ticketReplySchema = z.object({
    body: z.string().trim().min(1, "الرسالة مطلوبة").max(4000),
  });
  const ticketStatusSchema = z.object({
    status: z.enum(["new", "in_progress", "closed"]),
  });

  function adminDisplayName(req: any): string {
    const u = (req as any).currentUser || {};
    return u.fullName || u.name || u.username || "الإدارة";
  }

  // ---- جهة المساهم ----

  // قائمة تذاكر المساهم الحالي
  app.get("/api/shareholder/tickets", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select()
        .from(shareholderTickets)
        .where(eq(shareholderTickets.shareholderId, sh.id))
        .orderBy(desc(shareholderTickets.lastMessageAt));
      res.json(rows);
    } catch (error) {
      console.error("Error listing shareholder tickets:", error);
      res.status(500).json({ error: "فشل في جلب الرسائل" });
    }
  });

  // فتح استفسار جديد
  app.post("/api/shareholder/tickets", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });

      const userId = getUserId(req);
      const ticket = await db.transaction(async (tx) => {
        const [t] = await tx
          .insert(shareholderTickets)
          .values({
            shareholderId: sh.id,
            subject: parsed.data.subject,
            status: "new",
            unreadByAdmin: true,
            unreadByShareholder: false,
            createdBy: userId,
          })
          .returning();
        await tx.insert(shareholderTicketMessages).values({
          ticketId: t.id,
          senderType: "shareholder",
          senderUserId: userId,
          senderName: sh.fullName,
          body: parsed.data.body,
        });
        return t;
      });

      // إشعار جهة الدعم (إن وُجد رقم) بوجود استفسار جديد
      try {
        const settings = await getPortalSettings();
        if (settings.enableWhatsapp && settings.supportPhone) {
          await db.insert(notificationQueue).values({
            recipientPhone: settings.supportPhone,
            recipientName: "الدعم",
            channel: "whatsapp",
            message: `استفسار جديد من مساهم: ${sh.fullName}\nالموضوع: ${parsed.data.subject}`,
            relatedModule: "shareholder_ticket",
            relatedEntityId: String(ticket.id),
          });
        }
      } catch (e) {
        console.error("notify support failed:", e);
      }

      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating shareholder ticket:", error);
      res.status(500).json({ error: "فشل في إنشاء الاستفسار" });
    }
  });

  // تفاصيل تذكرة + رسائلها (يجب أن تخص المساهم الحالي)
  app.get("/api/shareholder/tickets/:id", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const [ticket] = await db
        .select()
        .from(shareholderTickets)
        .where(and(eq(shareholderTickets.id, id), eq(shareholderTickets.shareholderId, sh.id)))
        .limit(1);
      if (!ticket) return res.status(404).json({ error: "الاستفسار غير موجود" });
      const messages = await db
        .select({
          id: shareholderTicketMessages.id,
          ticketId: shareholderTicketMessages.ticketId,
          senderType: shareholderTicketMessages.senderType,
          senderName: shareholderTicketMessages.senderName,
          body: shareholderTicketMessages.body,
          createdAt: shareholderTicketMessages.createdAt,
        })
        .from(shareholderTicketMessages)
        .where(eq(shareholderTicketMessages.ticketId, id))
        .orderBy(shareholderTicketMessages.createdAt);
      if (ticket.unreadByShareholder) {
        await db
          .update(shareholderTickets)
          .set({ unreadByShareholder: false })
          .where(eq(shareholderTickets.id, id));
      }
      res.json({ ticket: { ...ticket, unreadByShareholder: false }, messages });
    } catch (error) {
      console.error("Error fetching shareholder ticket:", error);
      res.status(500).json({ error: "فشل في جلب الاستفسار" });
    }
  });

  // رد المساهم على تذكرته
  app.post("/api/shareholder/tickets/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = ticketReplySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });

      const [ticket] = await db
        .select()
        .from(shareholderTickets)
        .where(and(eq(shareholderTickets.id, id), eq(shareholderTickets.shareholderId, sh.id)))
        .limit(1);
      if (!ticket) return res.status(404).json({ error: "الاستفسار غير موجود" });

      const userId = getUserId(req);
      await db.transaction(async (tx) => {
        await tx.insert(shareholderTicketMessages).values({
          ticketId: id,
          senderType: "shareholder",
          senderUserId: userId,
          senderName: sh.fullName,
          body: parsed.data.body,
        });
        await tx
          .update(shareholderTickets)
          .set({
            // إعادة فتح التذكرة عند رد المساهم على تذكرة مغلقة
            status: ticket.status === "closed" ? "new" : ticket.status,
            unreadByAdmin: true,
            unreadByShareholder: false,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(shareholderTickets.id, id));
      });

      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Error adding shareholder ticket message:", error);
      res.status(500).json({ error: "فشل في إرسال الرسالة" });
    }
  });

  // ---- جهة الإدارة (governance_shareholders) ----

  // قائمة جميع التذاكر مع اسم المساهم وفلترة بالحالة
  app.get("/api/governance/shareholder-tickets", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : null;
      const conds = status && ["new", "in_progress", "closed"].includes(status)
        ? eq(shareholderTickets.status, status)
        : undefined;
      const rows = await db
        .select({
          id: shareholderTickets.id,
          shareholderId: shareholderTickets.shareholderId,
          shareholderName: shareholders.fullName,
          shareholderPhone: shareholders.phone,
          subject: shareholderTickets.subject,
          status: shareholderTickets.status,
          unreadByAdmin: shareholderTickets.unreadByAdmin,
          unreadByShareholder: shareholderTickets.unreadByShareholder,
          lastMessageAt: shareholderTickets.lastMessageAt,
          createdAt: shareholderTickets.createdAt,
        })
        .from(shareholderTickets)
        .leftJoin(shareholders, eq(shareholderTickets.shareholderId, shareholders.id))
        .where(conds as any)
        .orderBy(desc(shareholderTickets.lastMessageAt))
        .limit(300);
      res.json(rows);
    } catch (error) {
      console.error("Error listing admin shareholder tickets:", error);
      res.status(500).json({ error: "فشل في جلب التذاكر" });
    }
  });

  // تفاصيل تذكرة + رسائلها (إدارة)
  app.get("/api/governance/shareholder-tickets/:id", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const [ticket] = await db
        .select({
          id: shareholderTickets.id,
          shareholderId: shareholderTickets.shareholderId,
          shareholderName: shareholders.fullName,
          shareholderPhone: shareholders.phone,
          subject: shareholderTickets.subject,
          status: shareholderTickets.status,
          unreadByAdmin: shareholderTickets.unreadByAdmin,
          unreadByShareholder: shareholderTickets.unreadByShareholder,
          lastMessageAt: shareholderTickets.lastMessageAt,
          createdAt: shareholderTickets.createdAt,
        })
        .from(shareholderTickets)
        .leftJoin(shareholders, eq(shareholderTickets.shareholderId, shareholders.id))
        .where(eq(shareholderTickets.id, id))
        .limit(1);
      if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
      const messages = await db
        .select()
        .from(shareholderTicketMessages)
        .where(eq(shareholderTicketMessages.ticketId, id))
        .orderBy(shareholderTicketMessages.createdAt);
      if (ticket.unreadByAdmin) {
        await db
          .update(shareholderTickets)
          .set({ unreadByAdmin: false })
          .where(eq(shareholderTickets.id, id));
      }
      res.json({ ticket: { ...ticket, unreadByAdmin: false }, messages });
    } catch (error) {
      console.error("Error fetching admin shareholder ticket:", error);
      res.status(500).json({ error: "فشل في جلب التذكرة" });
    }
  });

  // رد الإدارة على التذكرة (+ إشعار واتساب للمساهم + إشعار داخل البوابة)
  app.post("/api/governance/shareholder-tickets/:id/messages", isAuthenticated, requirePermission("governance_shareholders", "create"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = ticketReplySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });

      const [ticket] = await db.select().from(shareholderTickets).where(eq(shareholderTickets.id, id)).limit(1);
      if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
      const [sh] = await db.select().from(shareholders).where(eq(shareholders.id, ticket.shareholderId)).limit(1);

      const userId = getUserId(req);
      const senderName = adminDisplayName(req);
      await db.transaction(async (tx) => {
        await tx.insert(shareholderTicketMessages).values({
          ticketId: id,
          senderType: "admin",
          senderUserId: userId,
          senderName,
          body: parsed.data.body,
        });
        await tx
          .update(shareholderTickets)
          .set({
            // رد الإدارة ينقل الحالة إلى "قيد المعالجة" ما لم تكن مغلقة عمداً
            status: ticket.status === "closed" ? "closed" : "in_progress",
            unreadByShareholder: true,
            unreadByAdmin: false,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(shareholderTickets.id, id));
      });

      // إشعار داخل البوابة (جرس المساهم) + واتساب
      let whatsappQueued = false;
      try {
        const settings = await getPortalSettings();
        await db.insert(shareholderNotifications).values({
          shareholderId: ticket.shareholderId,
          title: "رد جديد على استفسارك",
          body: `${ticket.subject}\n\n${parsed.data.body}`,
          sentWhatsapp: !!settings.enableWhatsapp && !!sh?.phone,
          createdBy: userId,
        });
        if (settings.enableWhatsapp && sh?.phone) {
          await db.insert(notificationQueue).values({
            recipientPhone: sh.phone,
            recipientName: sh.fullName,
            channel: "whatsapp",
            message: `لديك رد جديد على استفسارك: ${ticket.subject}\n\n${parsed.data.body}`,
            relatedModule: "shareholder_ticket",
            relatedEntityId: String(id),
          });
          whatsappQueued = true;
        }
      } catch (e) {
        console.error("notify shareholder of reply failed:", e);
      }

      res.status(201).json({ success: true, whatsappQueued });
    } catch (error) {
      console.error("Error adding admin ticket reply:", error);
      res.status(500).json({ error: "فشل في إرسال الرد" });
    }
  });

  // تغيير حالة التذكرة (إدارة)
  app.patch("/api/governance/shareholder-tickets/:id", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = ticketStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "حالة غير صالحة" });
      const [updated] = await db
        .update(shareholderTickets)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(shareholderTickets.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "التذكرة غير موجودة" });
      res.json({ success: true, status: updated.status });
    } catch (error) {
      console.error("Error updating ticket status:", error);
      res.status(500).json({ error: "فشل في تحديث الحالة" });
    }
  });

  // ======================================================================
  // طلبات تحديث البيانات الذاتية (المرحلة 3) — Self-service profile updates
  // ======================================================================

  // قائمة طلبات المساهم الحالي
  app.get("/api/shareholder/profile-requests", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });
      const rows = await db
        .select({
          id: shareholderProfileUpdateRequests.id,
          changes: shareholderProfileUpdateRequests.changes,
          note: shareholderProfileUpdateRequests.note,
          status: shareholderProfileUpdateRequests.status,
          reviewNote: shareholderProfileUpdateRequests.reviewNote,
          reviewedAt: shareholderProfileUpdateRequests.reviewedAt,
          createdAt: shareholderProfileUpdateRequests.createdAt,
        })
        .from(shareholderProfileUpdateRequests)
        .where(eq(shareholderProfileUpdateRequests.shareholderId, sh.id))
        .orderBy(desc(shareholderProfileUpdateRequests.createdAt));
      // أخفِ الحقول المالية من القائمة القابلة للتحرير عند إيقاف عرض البيانات المالية
      const settings = await getPortalSettings();
      const editableFields = settings.showFinancials
        ? EDITABLE_PROFILE_FIELDS
        : EDITABLE_PROFILE_FIELDS.filter((f) => !FINANCIAL_FIELD_KEYS.includes(f.field));
      res.json({ requests: rows, editableFields });
    } catch (error) {
      console.error("Error fetching profile requests:", error);
      res.status(500).json({ error: "فشل في جلب الطلبات" });
    }
  });

  // إنشاء طلب تحديث بيانات
  app.post("/api/shareholder/profile-requests", isAuthenticated, async (req, res) => {
    try {
      const sh = await getMyShareholder(req);
      if (!sh) return res.status(403).json({ error: "غير مرتبط بملف مساهم" });

      const settings = await getPortalSettings();
      if (!settings.showProfileEdits) return res.status(403).json({ error: "خدمة تحديث البيانات غير مفعّلة" });

      const parsed = profileUpdateRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });

      // امنع وجود طلب معلّق آخر لتجنّب التضارب
      const [pending] = await db
        .select({ id: shareholderProfileUpdateRequests.id })
        .from(shareholderProfileUpdateRequests)
        .where(and(eq(shareholderProfileUpdateRequests.shareholderId, sh.id), eq(shareholderProfileUpdateRequests.status, "pending")))
        .limit(1);
      if (pending) return res.status(409).json({ error: "لديك طلب قيد المراجعة بالفعل. الرجاء انتظار البت فيه." });

      // احسب الفروقات الفعلية فقط (تجاهل القيم غير المتغيّرة) من القائمة البيضاء
      const norm = (v: any) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
      const changes: { field: string; label: string; oldValue: string | null; newValue: string | null }[] = [];
      for (const { field, label } of EDITABLE_PROFILE_FIELDS) {
        if (!(field in parsed.data.values)) continue;
        // تجاهل الحقول المالية عند إيقاف عرض البيانات المالية (حماية على مستوى الخادم)
        if (!settings.showFinancials && FINANCIAL_FIELD_KEYS.includes(field)) continue;
        const newValue = norm((parsed.data.values as any)[field]);
        const oldValue = norm((sh as any)[field]);
        if (newValue !== oldValue) changes.push({ field, label, oldValue, newValue });
      }
      if (changes.length === 0) return res.status(400).json({ error: "لا توجد تغييرات على البيانات" });

      const userId = getUserId(req);
      const [created] = await db
        .insert(shareholderProfileUpdateRequests)
        .values({
          shareholderId: sh.id,
          changes,
          note: parsed.data.note || null,
          status: "pending",
          createdBy: userId,
        } as any)
        .returning();

      void logShareholderActivity({
        shareholderId: sh.id,
        userId,
        action: "profile_request",
        description: `طلب تحديث بيانات (${changes.length} حقل)`,
        metadata: { requestId: created?.id, fields: changes.map((c) => c.field) },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });

      res.status(201).json(created);
    } catch (error: any) {
      // حماية على مستوى قاعدة البيانات ضد التضارب (إنشاء طلبين معلّقين معًا)
      if (error?.code === "23505") {
        return res.status(409).json({ error: "لديك طلب قيد المراجعة بالفعل. الرجاء انتظار البت فيه." });
      }
      console.error("Error creating profile request:", error);
      res.status(500).json({ error: "فشل في إنشاء الطلب" });
    }
  });

  // ---- جهة الإدارة (governance_shareholders) ----

  // قائمة طلبات التحديث مع اسم المساهم + فلتر بالحالة
  app.get("/api/governance/profile-requests", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : null;
      const conds: any[] = [];
      if (status && ["pending", "approved", "rejected"].includes(status)) {
        conds.push(eq(shareholderProfileUpdateRequests.status, status));
      }
      const rows = await db
        .select({
          id: shareholderProfileUpdateRequests.id,
          shareholderId: shareholderProfileUpdateRequests.shareholderId,
          shareholderName: shareholders.fullName,
          shareholderPhone: shareholders.phone,
          changes: shareholderProfileUpdateRequests.changes,
          note: shareholderProfileUpdateRequests.note,
          status: shareholderProfileUpdateRequests.status,
          reviewNote: shareholderProfileUpdateRequests.reviewNote,
          reviewedAt: shareholderProfileUpdateRequests.reviewedAt,
          createdAt: shareholderProfileUpdateRequests.createdAt,
        })
        .from(shareholderProfileUpdateRequests)
        .innerJoin(shareholders, eq(shareholders.id, shareholderProfileUpdateRequests.shareholderId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(shareholderProfileUpdateRequests.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching admin profile requests:", error);
      res.status(500).json({ error: "فشل في جلب الطلبات" });
    }
  });

  // الموافقة على الطلب: يطبّق التغييرات على ملف المساهم ذرّياً + إشعار
  app.post("/api/governance/profile-requests/:id/approve", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = profileReviewSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

      const [reqRow] = await db.select().from(shareholderProfileUpdateRequests).where(eq(shareholderProfileUpdateRequests.id, id)).limit(1);
      if (!reqRow) return res.status(404).json({ error: "الطلب غير موجود" });
      if (reqRow.status !== "pending") return res.status(409).json({ error: "تمت مراجعة هذا الطلب مسبقاً" });

      const [sh] = await db.select().from(shareholders).where(eq(shareholders.id, reqRow.shareholderId)).limit(1);
      if (!sh) return res.status(404).json({ error: "المساهم غير موجود" });

      // ابنِ خريطة التحديث من القائمة البيضاء فقط (حماية إضافية)
      const changes = Array.isArray(reqRow.changes) ? (reqRow.changes as any[]) : [];
      const updateSet: Record<string, any> = {};
      for (const c of changes) {
        if (EDITABLE_FIELD_KEYS.includes(c.field)) updateSet[c.field] = c.newValue ?? null;
      }

      const userId = getUserId(req);
      try {
        await db.transaction(async (tx) => {
          // حارس ذرّي: لا يُحدّث إلا إذا كان الطلب لا يزال معلّقاً (يمنع مراجعة مزدوجة متزامنة)
          const guard = await tx
            .update(shareholderProfileUpdateRequests)
            .set({ status: "approved", reviewNote: parsed.data.reviewNote || null, reviewedBy: userId, reviewedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(shareholderProfileUpdateRequests.id, id), eq(shareholderProfileUpdateRequests.status, "pending")))
            .returning({ id: shareholderProfileUpdateRequests.id });
          if (guard.length === 0) throw new Error("__ALREADY_REVIEWED__");
          if (Object.keys(updateSet).length > 0) {
            await tx
              .update(shareholders)
              .set({ ...updateSet, updatedAt: new Date() })
              .where(eq(shareholders.id, reqRow.shareholderId));
          }
        });
      } catch (e: any) {
        if (e?.message === "__ALREADY_REVIEWED__") return res.status(409).json({ error: "تمت مراجعة هذا الطلب مسبقاً" });
        throw e;
      }

      // إشعار المساهم (بوابة + واتساب)
      let whatsappQueued = false;
      try {
        const settings = await getPortalSettings();
        await db.insert(shareholderNotifications).values({
          shareholderId: reqRow.shareholderId,
          title: "تم اعتماد طلب تحديث بياناتك",
          body: "تمت الموافقة على طلب تحديث بياناتك وتحديثها في النظام.",
          sentWhatsapp: !!settings.enableWhatsapp && !!sh.phone,
          createdBy: userId,
        });
        if (settings.enableWhatsapp && sh.phone) {
          await db.insert(notificationQueue).values({
            recipientPhone: sh.phone,
            recipientName: sh.fullName,
            channel: "whatsapp",
            message: "تمت الموافقة على طلب تحديث بياناتك وتحديثها في النظام.",
            relatedModule: "shareholder_profile_request",
            relatedEntityId: String(id),
          });
          whatsappQueued = true;
        }
      } catch (e) {
        console.error("notify shareholder of approval failed:", e);
      }

      res.json({ success: true, whatsappQueued });
    } catch (error) {
      console.error("Error approving profile request:", error);
      res.status(500).json({ error: "فشل في اعتماد الطلب" });
    }
  });

  // رفض الطلب
  app.post("/api/governance/profile-requests/:id/reject", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = profileReviewSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

      const [reqRow] = await db.select().from(shareholderProfileUpdateRequests).where(eq(shareholderProfileUpdateRequests.id, id)).limit(1);
      if (!reqRow) return res.status(404).json({ error: "الطلب غير موجود" });
      if (reqRow.status !== "pending") return res.status(409).json({ error: "تمت مراجعة هذا الطلب مسبقاً" });

      const [sh] = await db.select().from(shareholders).where(eq(shareholders.id, reqRow.shareholderId)).limit(1);

      const userId = getUserId(req);
      // حارس ذرّي: يمنع رفض طلب تمت مراجعته بالفعل بشكل متزامن
      const guard = await db
        .update(shareholderProfileUpdateRequests)
        .set({ status: "rejected", reviewNote: parsed.data.reviewNote || null, reviewedBy: userId, reviewedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(shareholderProfileUpdateRequests.id, id), eq(shareholderProfileUpdateRequests.status, "pending")))
        .returning({ id: shareholderProfileUpdateRequests.id });
      if (guard.length === 0) return res.status(409).json({ error: "تمت مراجعة هذا الطلب مسبقاً" });

      let whatsappQueued = false;
      try {
        const settings = await getPortalSettings();
        const reason = parsed.data.reviewNote ? `\nالسبب: ${parsed.data.reviewNote}` : "";
        await db.insert(shareholderNotifications).values({
          shareholderId: reqRow.shareholderId,
          title: "تم رفض طلب تحديث بياناتك",
          body: `لم تتم الموافقة على طلب تحديث بياناتك.${reason}`,
          sentWhatsapp: !!settings.enableWhatsapp && !!sh?.phone,
          createdBy: userId,
        });
        if (settings.enableWhatsapp && sh?.phone) {
          await db.insert(notificationQueue).values({
            recipientPhone: sh.phone,
            recipientName: sh.fullName,
            channel: "whatsapp",
            message: `لم تتم الموافقة على طلب تحديث بياناتك.${reason}`,
            relatedModule: "shareholder_profile_request",
            relatedEntityId: String(id),
          });
          whatsappQueued = true;
        }
      } catch (e) {
        console.error("notify shareholder of rejection failed:", e);
      }

      res.json({ success: true, whatsappQueued });
    } catch (error) {
      console.error("Error rejecting profile request:", error);
      res.status(500).json({ error: "فشل في رفض الطلب" });
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

  // إرسال بيانات الدخول للمساهم عبر واتساب (يُدرَج في طابور الإشعارات)
  app.post("/api/governance/shareholders/:id/send-credentials", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });

      const [shareholder] = await db.select().from(shareholders).where(eq(shareholders.id, id)).limit(1);
      if (!shareholder) return res.status(404).json({ error: "المساهم غير موجود" });
      if (!shareholder.linkedUserId) return res.status(400).json({ error: "هذا المساهم غير مرتبط بحساب" });
      if (!shareholder.phone) return res.status(400).json({ error: "لا يوجد رقم جوال مسجّل لهذا المساهم" });

      const message =
        `مرحباً ${shareholder.fullName}،\n\n` +
        `تم تفعيل حسابك في بوابة المساهمين الخاصة بـ ${COMPANY_INFO.name}.\n\n` +
        `بيانات الدخول:\n` +
        `اسم المستخدم: ${username}\n` +
        `كلمة المرور: ${password}\n\n` +
        `يُرجى تسجيل الدخول وتغيير كلمة المرور بعد أول دخول للحفاظ على أمان حسابك.`;

      await db.insert(notificationQueue).values({
        recipientPhone: shareholder.phone,
        recipientName: shareholder.fullName,
        channel: "whatsapp",
        message,
        relatedModule: "shareholder_credentials",
        relatedEntityId: String(shareholder.id),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending shareholder credentials:", error);
      res.status(500).json({ error: "فشل في إرسال بيانات الدخول" });
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

  // ======================================================================
  // دعوات افتتاح الفروع — روابط شخصية فاخرة لكل مساهم
  // Branch opening invitations — personalized luxury links per shareholder
  // ======================================================================

  // قائمة الدعوات مع عدد المستلمين والمشاهدات
  app.get("/api/governance/invitations", isAuthenticated, requirePermission("governance_shareholders", "view"), async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: branchOpeningInvitations.id,
          title: branchOpeningInvitations.title,
          branchName: branchOpeningInvitations.branchName,
          eventDate: branchOpeningInvitations.eventDate,
          eventTime: branchOpeningInvitations.eventTime,
          location: branchOpeningInvitations.location,
          locationUrl: branchOpeningInvitations.locationUrl,
          message: branchOpeningInvitations.message,
          imageUrl: branchOpeningInvitations.imageUrl,
          theme: branchOpeningInvitations.theme,
          isActive: branchOpeningInvitations.isActive,
          createdAt: branchOpeningInvitations.createdAt,
          recipientsCount: sql<number>`(SELECT count(*)::int FROM ${invitationRecipients} ir WHERE ir.invitation_id = ${branchOpeningInvitations.id})`,
          openedCount: sql<number>`(SELECT count(*)::int FROM ${invitationRecipients} ir WHERE ir.invitation_id = ${branchOpeningInvitations.id} AND ir.opened_at IS NOT NULL)`,
        })
        .from(branchOpeningInvitations)
        .orderBy(desc(branchOpeningInvitations.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ error: "فشل في جلب الدعوات" });
    }
  });

  // إنشاء دعوة جديدة
  app.post("/api/governance/invitations", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const parsed = insertBranchOpeningInvitationSchema.parse({ ...req.body, createdBy: getUserId(req) });
      const [created] = await db.insert(branchOpeningInvitations).values(parsed).returning();
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating invitation:", error);
      res.status(500).json({ error: "فشل في إنشاء الدعوة" });
    }
  });

  // تعديل دعوة
  app.patch("/api/governance/invitations/:id", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const parsed = insertBranchOpeningInvitationSchema.omit({ createdBy: true }).partial().parse(req.body);
      const [updated] = await db.update(branchOpeningInvitations).set(parsed).where(eq(branchOpeningInvitations.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "الدعوة غير موجودة" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating invitation:", error);
      res.status(500).json({ error: "فشل في تعديل الدعوة" });
    }
  });

  // حذف دعوة (يحذف معها روابط المستلمين تلقائياً)
  app.delete("/api/governance/invitations/:id", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      await db.delete(branchOpeningInvitations).where(eq(branchOpeningInvitations.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ error: "فشل في حذف الدعوة" });
    }
  });

  // توليد/جلب روابط المستلمين لدعوة (لكل المساهمين أو لمجموعة محددة)
  app.post("/api/governance/invitations/:id/recipients", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const [inv] = await db.select().from(branchOpeningInvitations).where(eq(branchOpeningInvitations.id, id)).limit(1);
      if (!inv) return res.status(404).json({ error: "الدعوة غير موجودة" });

      const bodySchema = z.object({ shareholderIds: z.array(z.number().int().positive()).optional() });
      const { shareholderIds } = bodySchema.parse(req.body || {});

      // المساهمون المستهدفون (محددون أو الجميع)
      const targets = shareholderIds && shareholderIds.length > 0
        ? await db.select().from(shareholders).where(inArray(shareholders.id, shareholderIds))
        : await db.select().from(shareholders);

      if (targets.length === 0) return res.json({ created: 0, recipients: [] });

      // المستلمون الموجودون مسبقاً لتفادي التكرار
      const existing = await db.select().from(invitationRecipients).where(eq(invitationRecipients.invitationId, id));
      const existingIds = new Set(existing.map((r) => r.shareholderId));

      const newRows = targets
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({
          invitationId: id,
          shareholderId: s.id,
          token: crypto.randomBytes(24).toString("hex"),
        }));

      if (newRows.length > 0) {
        await db.insert(invitationRecipients).values(newRows);
      }

      res.json({ created: newRows.length, total: existing.length + newRows.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error generating invitation recipients:", error);
      res.status(500).json({ error: "فشل في توليد الروابط" });
    }
  });

  // قائمة المستلمين مع الروابط الشخصية (اسم + جوال للمشاركة عبر واتساب)
  app.get("/api/governance/invitations/:id/recipients", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const rows = await db
        .select({
          id: invitationRecipients.id,
          shareholderId: invitationRecipients.shareholderId,
          token: invitationRecipients.token,
          openedAt: invitationRecipients.openedAt,
          viewCount: invitationRecipients.viewCount,
          fullName: shareholders.fullName,
          phone: shareholders.phone,
        })
        .from(invitationRecipients)
        .innerJoin(shareholders, eq(invitationRecipients.shareholderId, shareholders.id))
        .where(eq(invitationRecipients.invitationId, id))
        .orderBy(shareholders.fullName);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching invitation recipients:", error);
      res.status(500).json({ error: "فشل في جلب المستلمين" });
    }
  });

  // عام (بدون تسجيل دخول): فتح الدعوة الشخصية بواسطة الرمز
  // يعيد بيانات الدعوة + اسم المساهم فقط (لا جوال/بيانات حساسة) — حماية الخصوصية/IDOR
  app.get("/api/public/invite/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "");
      if (!token) return res.status(400).json({ error: "رمز غير صالح" });

      const [recipient] = await db
        .select({
          id: invitationRecipients.id,
          invitationId: invitationRecipients.invitationId,
          fullName: shareholders.fullName,
        })
        .from(invitationRecipients)
        .innerJoin(shareholders, eq(invitationRecipients.shareholderId, shareholders.id))
        .where(eq(invitationRecipients.token, token))
        .limit(1);

      if (!recipient) return res.status(404).json({ error: "الدعوة غير موجودة" });

      const [inv] = await db
        .select()
        .from(branchOpeningInvitations)
        .where(eq(branchOpeningInvitations.id, recipient.invitationId))
        .limit(1);

      if (!inv || !inv.isActive) return res.status(404).json({ error: "الدعوة غير متاحة" });

      // تسجيل المشاهدة (أول فتح + عداد)
      await db
        .update(invitationRecipients)
        .set({
          viewCount: sql`${invitationRecipients.viewCount} + 1`,
          openedAt: sql`COALESCE(${invitationRecipients.openedAt}, now())`,
        })
        .where(eq(invitationRecipients.id, recipient.id));

      res.json({
        guestName: recipient.fullName,
        invitation: {
          title: inv.title,
          branchName: inv.branchName,
          eventDate: inv.eventDate,
          eventTime: inv.eventTime,
          location: inv.location,
          locationUrl: inv.locationUrl,
          message: inv.message,
          imageUrl: inv.imageUrl,
          theme: inv.theme,
        },
        company: COMPANY_INFO,
      });
    } catch (error) {
      console.error("Error opening public invitation:", error);
      res.status(500).json({ error: "فشل في فتح الدعوة" });
    }
  });
}
