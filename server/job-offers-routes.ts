import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, lt, inArray, isNull, gt } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter } from "./auth";
import {
  jobOffers,
  jobOfferTokens,
  jobOfferAuditLog,
  insertJobOfferSchema,
  updateJobOfferSchema,
  branches,
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { sendWhatsAppMessage, isTwilioConfigured } from "./twilio-service";

const PERMISSION_MODULE = "hr_management" as const;

function checkOfferBranchAccess(req: any, offer: { branchId: string | null }): boolean {
  const filter = getEffectiveBranchFilter(req);
  if (!filter.hasAccess) return false;
  if (filter.branchIds === null) return true;
  if (!offer.branchId) return true;
  return filter.branchIds.includes(offer.branchId);
}

async function logAudit(
  offerId: number,
  action: string,
  req: Request,
  details?: any
) {
  try {
    const user: any = (req as any).user;
    await db.insert(jobOfferAuditLog).values({
      offerId,
      action,
      performedBy: user?.id || null,
      performedByName: user?.username || user?.fullName || null,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
      details: details || null,
    });
  } catch (e) {
    console.error("[job-offers] audit log error:", e);
  }
}

async function generateOfferNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JOB-${year}-`;
  const rows = await db
    .select({ n: jobOffers.offerNumber })
    .from(jobOffers)
    .where(sql`${jobOffers.offerNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(jobOffers.id))
    .limit(1);
  let next = 1;
  if (rows.length > 0) {
    const m = rows[0].n.match(/(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function buildOfferMessage(offer: any, link: string): string {
  const positionLine = offer.positionEn
    ? `*${offer.position}* / _${offer.positionEn}_`
    : `*${offer.position}*`;
  const nameLine = offer.candidateNameEn
    ? `${offer.candidateName} / ${offer.candidateNameEn}`
    : offer.candidateName;

  return `🥐 *BUTTER BAKERY* 🥐
🌟 *عرض عمل رسمي* | *Official Job Offer* 🌟
━━━━━━━━━━━━━━━━━━━━

السلام عليكم ورحمة الله وبركاته
_Peace be upon you,_

عزيزي/عزيزتي *${nameLine}* المحترم/ة 🤝
_Dear ${offer.candidateNameEn || offer.candidateName},_

━━━━━━━━━━━━━━━━━━━━
🎉 *يسعدنا في باتر بيكري أن نرحّب بانضمامك إلى عائلتنا!*
🎉 _We at Butter Bakery are delighted to welcome you to our family!_
━━━━━━━━━━━━━━━━━━━━

📋 *تفاصيل العرض | Offer Details:*

💼 *الوظيفة | Position:*
${positionLine}

🏢 *الشركة | Company:*
شركة الزبد الأفضل التجارية
_Best Butter Trading Company_

📄 *رقم العرض | Offer No.:*
\`${offer.offerNumber}\`

━━━━━━━━━━━━━━━━━━━━
🔗 *رابط العرض الكامل | Full Offer Link:*
${link}

⏰ *صالح لمدة | Valid for:* ${offer.validityDays} ${offer.validityDays === 1 ? "يوم | day" : "أيام | days"}
✍️ يمكنك مراجعة جميع التفاصيل (الراتب، البدلات، المزايا) والرد بالقبول أو الرفض إلكترونياً.
✍️ _Please review all details (salary, allowances, benefits) and respond electronically._
━━━━━━━━━━━━━━━━━━━━

نتطلع لرؤيتك ضمن فريقنا قريباً 🌹
_Looking forward to seeing you on our team soon!_

مع أطيب التحيات،
_With our warmest regards,_

👥 *إدارة الموارد البشرية*
👥 _Human Resources Department_
*Butter Bakery* | باتر بيكري`;
}

export function registerJobOfferRoutes(app: Express) {
  // ===== Internal (HR) =====

  app.get(
    "/api/hr/job-offers",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const status = req.query.status as string | undefined;
        const queryBranchId = req.query.branchId as string | undefined;
        const search = (req.query.search as string | undefined)?.trim();

        const filter = getEffectiveBranchFilter(req, queryBranchId);
        if (!filter.hasAccess) return res.json([]);

        const conds: any[] = [];
        if (status) conds.push(eq(jobOffers.status, status));
        if (filter.branchIds && filter.branchIds.length > 0) {
          conds.push(inArray(jobOffers.branchId, filter.branchIds));
        }
        if (search)
          conds.push(
            sql`(${jobOffers.candidateName} ILIKE ${"%" + search + "%"} OR ${jobOffers.phone} ILIKE ${"%" + search + "%"} OR ${jobOffers.offerNumber} ILIKE ${"%" + search + "%"})`
          );

        const rows = await db
          .select()
          .from(jobOffers)
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(jobOffers.createdAt))
          .limit(500);

        // mark expired on the fly
        const now = new Date();
        for (const r of rows) {
          if (
            (r.status === "sent" || r.status === "viewed") &&
            r.expiresAt &&
            new Date(r.expiresAt) < now
          ) {
            await db
              .update(jobOffers)
              .set({ status: "expired", updatedAt: new Date() })
              .where(eq(jobOffers.id, r.id));
            await db.insert(jobOfferAuditLog).values({
              offerId: r.id,
              action: "expired",
              details: { auto: true, source: "list" },
            });
            r.status = "expired";
          }
        }

        res.json(rows);
      } catch (e: any) {
        console.error("[job-offers] list error:", e);
        res.status(500).json({ error: e.message || "فشل تحميل العروض" });
      }
    }
  );

  app.get(
    "/api/hr/job-offers/stats",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const filter = getEffectiveBranchFilter(req);
        if (!filter.hasAccess) return res.json({ total: 0, draft: 0, sent: 0, viewed: 0, accepted: 0, declined: 0, expired: 0, cancelled: 0 });
        const rows = await db
          .select({
            status: jobOffers.status,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(jobOffers)
          .where(filter.branchIds && filter.branchIds.length > 0 ? inArray(jobOffers.branchId, filter.branchIds) : undefined)
          .groupBy(jobOffers.status);
        const stats: Record<string, number> = {
          total: 0,
          draft: 0,
          sent: 0,
          viewed: 0,
          accepted: 0,
          declined: 0,
          expired: 0,
          cancelled: 0,
        };
        for (const r of rows) {
          stats[r.status] = r.count;
          stats.total += r.count;
        }
        res.json(stats);
      } catch (e: any) {
        console.error("[job-offers] stats error:", e);
        res.status(500).json({ error: "فشل تحميل الإحصائيات" });
      }
    }
  );

  app.get(
    "/api/hr/job-offers/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(eq(jobOffers.id, id))
          .limit(1);
        if (!offer) return res.status(404).json({ error: "العرض غير موجود" });
        if (!checkOfferBranchAccess(req, offer)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        const audit = await db
          .select()
          .from(jobOfferAuditLog)
          .where(eq(jobOfferAuditLog.offerId, id))
          .orderBy(desc(jobOfferAuditLog.createdAt))
          .limit(100);
        res.json({ offer, audit });
      } catch (e: any) {
        console.error("[job-offers] get error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/hr/job-offers",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const parsed = insertJobOfferSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "بيانات غير صحيحة", issues: parsed.error.issues });
        }
        const user: any = (req as any).user;
        const offerNumber = await generateOfferNumber();

        // resolve branch name if branchId provided
        let branchName = parsed.data.branchName;
        if (parsed.data.branchId && !branchName) {
          const [br] = await db
            .select({ name: branches.name })
            .from(branches)
            .where(eq(branches.id, parsed.data.branchId))
            .limit(1);
          if (br) branchName = br.name;
        }

        const [created] = await db
          .insert(jobOffers)
          .values({
            ...parsed.data,
            branchName: branchName || null,
            offerNumber,
            createdBy: user?.id || null,
          })
          .returning();
        await logAudit(created.id, "created", req, { offerNumber });
        res.status(201).json(created);
      } catch (e: any) {
        console.error("[job-offers] create error:", e);
        res
          .status(500)
          .json({ error: e.message || "فشل إنشاء العرض", code: e.code });
      }
    }
  );

  app.patch(
    "/api/hr/job-offers/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [existing] = await db
          .select()
          .from(jobOffers)
          .where(eq(jobOffers.id, id))
          .limit(1);
        if (!existing) return res.status(404).json({ error: "غير موجود" });
        if (!checkOfferBranchAccess(req, existing)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (existing.status !== "draft")
          return res
            .status(400)
            .json({ error: "لا يمكن تعديل عرض غير مسودة" });

        const parsed = updateJobOfferSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "بيانات غير صحيحة", issues: parsed.error.issues });
        }

        const [updated] = await db
          .update(jobOffers)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(jobOffers.id, id))
          .returning();
        await logAudit(id, "updated", req);
        res.json(updated);
      } catch (e: any) {
        console.error("[job-offers] update error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // حذف العرض — يتطلب صلاحية حذف على وحدة الموارد البشرية (RBAC)
  app.delete(
    "/api/hr/job-offers/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "delete"),
    async (req, res) => {
      try {
        const user: any = (req as any).user;
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صالح" });

        const [existing] = await db
          .select()
          .from(jobOffers)
          .where(eq(jobOffers.id, id))
          .limit(1);
        if (!existing) return res.status(404).json({ error: "غير موجود" });

        // إلغاء أي توكنات نشطة ثم حذف العرض (cascade على audit/tokens مفترض في الـ schema، نحذف يدوياً للأمان)
        await db.delete(jobOfferTokens).where(eq(jobOfferTokens.offerId, id));
        await db.delete(jobOfferAuditLog).where(eq(jobOfferAuditLog.offerId, id));
        await db.delete(jobOffers).where(eq(jobOffers.id, id));

        console.log(`[job-offers] DELETED by user=${user?.username || user?.id} role=${user?.role} offer=${existing.offerNumber}`);
        res.json({ success: true });
      } catch (e: any) {
        console.error("[job-offers] delete error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // إرسال العرض للمرشح: توليد توكن وحفظ، إرسال واتساب
  app.post(
    "/api/hr/job-offers/:id/send",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(eq(jobOffers.id, id))
          .limit(1);
        if (!offer) return res.status(404).json({ error: "غير موجود" });
        if (!checkOfferBranchAccess(req, offer)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (offer.status === "accepted" || offer.status === "declined")
          return res
            .status(400)
            .json({ error: "لا يمكن إعادة إرسال عرض تم الرد عليه" });

        const validityDays = offer.validityDays || 2;
        const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

        // إلغاء توكنات سابقة
        await db
          .update(jobOfferTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(jobOfferTokens.offerId, id),
              sql`${jobOfferTokens.usedAt} IS NULL`,
              sql`${jobOfferTokens.revokedAt} IS NULL`
            )
          );

        const token = crypto.randomBytes(32).toString("hex");
        await db
          .insert(jobOfferTokens)
          .values({ offerId: id, token, expiresAt });

        await db
          .update(jobOffers)
          .set({
            status: "sent",
            sentAt: new Date(),
            expiresAt,
            updatedAt: new Date(),
          })
          .where(eq(jobOffers.id, id));

        const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        const link = `${proto}://${host}/job-offer/${token}`;

        let waResult: any = { success: false, error: "Twilio غير مكوّن" };
        if (isTwilioConfigured() && offer.phone) {
          const message = buildOfferMessage(offer, link);
          waResult = await sendWhatsAppMessage(offer.phone, message);
        }

        await logAudit(id, "sent", req, {
          link,
          whatsapp: waResult,
          channel: "whatsapp",
        });

        res.json({
          success: true,
          link,
          token,
          expiresAt,
          whatsapp: waResult,
        });
      } catch (e: any) {
        console.error("[job-offers] send error:", e);
        res.status(500).json({ error: e.message || "فشل الإرسال" });
      }
    }
  );

  app.post(
    "/api/hr/job-offers/:id/extend",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const days = Math.max(1, Math.min(7, Number(req.body?.days) || 2));
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(eq(jobOffers.id, id))
          .limit(1);
        if (!offer) return res.status(404).json({ error: "غير موجود" });
        if (!checkOfferBranchAccess(req, offer)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (!["sent", "viewed", "expired"].includes(offer.status))
          return res
            .status(400)
            .json({ error: "لا يمكن تمديد عرض في هذه الحالة" });

        const base =
          offer.expiresAt && new Date(offer.expiresAt) > new Date()
            ? new Date(offer.expiresAt)
            : new Date();
        const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

        await db
          .update(jobOffers)
          .set({
            status: offer.status === "expired" ? "sent" : offer.status,
            expiresAt: newExpiry,
            updatedAt: new Date(),
          })
          .where(eq(jobOffers.id, id));
        await db
          .update(jobOfferTokens)
          .set({ expiresAt: newExpiry })
          .where(
            and(
              eq(jobOfferTokens.offerId, id),
              sql`${jobOfferTokens.usedAt} IS NULL`,
              sql`${jobOfferTokens.revokedAt} IS NULL`
            )
          );
        await logAudit(id, "extended", req, { days, newExpiry });
        res.json({ success: true, expiresAt: newExpiry });
      } catch (e: any) {
        console.error("[job-offers] extend error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/hr/job-offers/:id/cancel",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const reason = (req.body?.reason as string) || null;
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(eq(jobOffers.id, id))
          .limit(1);
        if (!offer) return res.status(404).json({ error: "غير موجود" });
        if (!checkOfferBranchAccess(req, offer)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        if (offer.status === "accepted")
          return res.status(400).json({ error: "لا يمكن إلغاء عرض مقبول" });

        const user: any = (req as any).user;
        await db
          .update(jobOffers)
          .set({
            status: "cancelled",
            cancelledBy: user?.id || null,
            cancelReason: reason,
            updatedAt: new Date(),
          })
          .where(eq(jobOffers.id, id));
        await db
          .update(jobOfferTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(jobOfferTokens.offerId, id),
              sql`${jobOfferTokens.usedAt} IS NULL`,
              sql`${jobOfferTokens.revokedAt} IS NULL`
            )
          );
        await logAudit(id, "cancelled", req, { reason });
        res.json({ success: true });
      } catch (e: any) {
        console.error("[job-offers] cancel error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Public (Candidate) =====

  app.get("/api/public/job-offers/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const [tk] = await db
        .select()
        .from(jobOfferTokens)
        .where(eq(jobOfferTokens.token, token))
        .limit(1);
      if (!tk) return res.status(404).json({ error: "الرابط غير صالح" });
      if (tk.revokedAt)
        return res.status(410).json({ error: "تم إلغاء هذا الرابط" });
      if (tk.usedAt)
        return res
          .status(410)
          .json({ error: "تم استخدام هذا الرابط مسبقاً" });

      const [offer] = await db
        .select()
        .from(jobOffers)
        .where(eq(jobOffers.id, tk.offerId))
        .limit(1);
      if (!offer)
        return res.status(404).json({ error: "العرض غير موجود" });

      // expire check
      const now = new Date();
      if (tk.expiresAt && new Date(tk.expiresAt) < now) {
        if (offer.status !== "expired") {
          await db
            .update(jobOffers)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(jobOffers.id, offer.id));
        }
        return res.status(410).json({ error: "انتهت صلاحية هذا العرض" });
      }

      if (
        offer.status !== "viewed" &&
        offer.status !== "accepted" &&
        offer.status !== "declined"
      ) {
        await db
          .update(jobOffers)
          .set({
            status: "viewed",
            viewedAt: offer.viewedAt || new Date(),
            updatedAt: new Date(),
          })
          .where(eq(jobOffers.id, offer.id));
        offer.status = "viewed";
        await logAudit(offer.id, "viewed", req);
      }

      // remove sensitive fields
      const { createdBy, cancelledBy, ...safe } = offer;
      res.json({
        offer: safe,
        expiresAt: tk.expiresAt,
        company: {
          name: "شركة الزبد الأفضل التجارية",
          nameEn: "Butter Bakery Trading Co.",
          cr: "7026155296",
        },
      });
    } catch (e: any) {
      console.error("[job-offers] public get error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  const acceptSchema = z.object({
    signature: z.string().min(50, "التوقيع مطلوب"),
    fullName: z.string().min(2),
    confirmStartDate: z.string().optional(),
  });

  app.post("/api/public/job-offers/:token/accept", async (req, res) => {
    try {
      const token = req.params.token;
      const parsed = acceptSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "بيانات غير مكتملة", issues: parsed.error.issues });

      const [tk] = await db
        .select()
        .from(jobOfferTokens)
        .where(eq(jobOfferTokens.token, token))
        .limit(1);
      if (!tk || tk.revokedAt || tk.usedAt)
        return res.status(410).json({ error: "الرابط غير صالح" });
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date())
        return res.status(410).json({ error: "انتهت صلاحية الرابط" });

      const [offer] = await db
        .select()
        .from(jobOffers)
        .where(eq(jobOffers.id, tk.offerId))
        .limit(1);
      if (!offer) return res.status(404).json({ error: "غير موجود" });
      if (["accepted", "declined", "cancelled"].includes(offer.status))
        return res.status(400).json({ error: "تم الرد على العرض مسبقاً" });

      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || null;
      const ua = (req.headers["user-agent"] as string) || null;

      const now = new Date();
      const accepted = await db.transaction(async (tx) => {
        const tokRows = await tx
          .update(jobOfferTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(jobOfferTokens.id, tk.id),
              isNull(jobOfferTokens.usedAt),
              isNull(jobOfferTokens.revokedAt),
              gt(jobOfferTokens.expiresAt, now)
            )
          )
          .returning({ id: jobOfferTokens.id });
        if (tokRows.length === 0) return false;
        const offerRows = await tx
          .update(jobOffers)
          .set({
            status: "accepted",
            respondedAt: now,
            acceptedAtSignature: now,
            candidateSignature: parsed.data.signature,
            candidateIp: ip,
            candidateUserAgent: ua,
            updatedAt: now,
          })
          .where(
            and(
              eq(jobOffers.id, offer.id),
              inArray(jobOffers.status, ["draft", "sent", "viewed"])
            )
          )
          .returning({ id: jobOffers.id });
        if (offerRows.length === 0) {
          throw new Error("conflict");
        }
        return true;
      }).catch((err) => {
        if (err?.message === "conflict") return false;
        throw err;
      });

      if (!accepted) {
        return res.status(409).json({ error: "تم استخدام الرابط أو الرد على العرض من قبل" });
      }

      await logAudit(offer.id, "accepted", req, {
        ip,
        confirmedName: parsed.data.fullName,
      });

      // Notify HR via WhatsApp (best-effort, non-blocking failure)
      if (isTwilioConfigured() && offer.phone) {
        try {
          await sendWhatsAppMessage(
            offer.phone,
            `تم استلام قبولك لعرض العمل (${offer.offerNumber}).\nسيتواصل معك فريق الموارد البشرية قريباً.\nشركة الزبد الأفضل التجارية`
          );
        } catch {}
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("[job-offers] accept error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  const declineSchema = z.object({
    reason: z.string().optional(),
    fullName: z.string().min(2),
  });

  app.post("/api/public/job-offers/:token/decline", async (req, res) => {
    try {
      const token = req.params.token;
      const parsed = declineSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "بيانات غير مكتملة", issues: parsed.error.issues });

      const [tk] = await db
        .select()
        .from(jobOfferTokens)
        .where(eq(jobOfferTokens.token, token))
        .limit(1);
      if (!tk || tk.revokedAt || tk.usedAt)
        return res.status(410).json({ error: "الرابط غير صالح" });
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date())
        return res.status(410).json({ error: "انتهت صلاحية الرابط" });

      const [offer] = await db
        .select()
        .from(jobOffers)
        .where(eq(jobOffers.id, tk.offerId))
        .limit(1);
      if (!offer) return res.status(404).json({ error: "غير موجود" });
      if (["accepted", "declined", "cancelled"].includes(offer.status))
        return res.status(400).json({ error: "تم الرد على العرض مسبقاً" });

      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || null;
      const ua = (req.headers["user-agent"] as string) || null;

      const now = new Date();
      const declined = await db.transaction(async (tx) => {
        const tokRows = await tx
          .update(jobOfferTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(jobOfferTokens.id, tk.id),
              isNull(jobOfferTokens.usedAt),
              isNull(jobOfferTokens.revokedAt),
              gt(jobOfferTokens.expiresAt, now)
            )
          )
          .returning({ id: jobOfferTokens.id });
        if (tokRows.length === 0) return false;
        const offerRows = await tx
          .update(jobOffers)
          .set({
            status: "declined",
            respondedAt: now,
            declineReason: parsed.data.reason || null,
            candidateIp: ip,
            candidateUserAgent: ua,
            updatedAt: now,
          })
          .where(
            and(
              eq(jobOffers.id, offer.id),
              inArray(jobOffers.status, ["draft", "sent", "viewed"])
            )
          )
          .returning({ id: jobOffers.id });
        if (offerRows.length === 0) throw new Error("conflict");
        return true;
      }).catch((err) => {
        if (err?.message === "conflict") return false;
        throw err;
      });

      if (!declined) {
        return res.status(409).json({ error: "تم استخدام الرابط أو الرد على العرض من قبل" });
      }

      await logAudit(offer.id, "declined", req, {
        ip,
        reason: parsed.data.reason,
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error("[job-offers] decline error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Background: mark expired (with audit logging)
  setInterval(async () => {
    try {
      const expired = await db
        .update(jobOffers)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            sql`${jobOffers.status} IN ('sent','viewed')`,
            lt(jobOffers.expiresAt, new Date())
          )
        )
        .returning({ id: jobOffers.id });
      if (expired.length > 0) {
        await db.insert(jobOfferAuditLog).values(
          expired.map((e) => ({
            offerId: e.id,
            action: "expired",
            details: { auto: true, source: "scheduler" } as any,
          }))
        );
      }
    } catch (e) {
      // silent
    }
  }, 5 * 60 * 1000);
}
