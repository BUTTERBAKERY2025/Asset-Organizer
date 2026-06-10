import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, inArray, isNull, gt } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter } from "./auth";
import {
  employmentApplications,
  employmentApplicationTokens,
  employmentApplicationAuditLog,
  jobVacancies,
  insertEmploymentApplicationSchema,
  updateEmploymentApplicationSchema,
  insertJobVacancySchema,
  updateJobVacancySchema,
  branches,
  jobOffers,
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { sendWhatsAppMessage, isTwilioConfigured } from "./twilio-service";

const PERMISSION_MODULE = "hr_employment_applications" as const;

function checkBranchAccess(req: any, app: { targetBranchId: string | null }): boolean {
  const filter = getEffectiveBranchFilter(req);
  if (!filter.hasAccess) return false;
  if (filter.branchIds === null) return true;
  if (!app.targetBranchId) return true;
  return filter.branchIds.includes(app.targetBranchId);
}

function checkVacancyAccess(req: any, v: { branchId: string | null }): boolean {
  const filter = getEffectiveBranchFilter(req);
  if (!filter.hasAccess) return false;
  if (filter.branchIds === null) return true;
  if (!v.branchId) return true;
  return filter.branchIds.includes(v.branchId);
}

// تأكد أن البروتوكول آمن لروابط المرفقات (تجنّب javascript:/svg)
function sanitizeAttachmentUrl(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  // https فقط للروابط الخارجية، وأنواع صور آمنة فقط لـdata URLs (لا SVG)
  if (lower.startsWith("https://")) return trimmed;
  if (lower.startsWith("data:image/png") ||
      lower.startsWith("data:image/jpeg") ||
      lower.startsWith("data:image/jpg") ||
      lower.startsWith("data:image/webp") ||
      lower.startsWith("data:application/pdf")) {
    return trimmed;
  }
  return undefined;
}

async function logAudit(applicationId: number, action: string, req: Request, details?: any) {
  try {
    const user: any = (req as any).user;
    await db.insert(employmentApplicationAuditLog).values({
      applicationId,
      action,
      performedBy: user?.id || null,
      performedByName: user?.username || user?.fullName || null,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
      details: details || null,
    });
  } catch (e) {
    console.error("[emp-apps] audit log error:", e);
  }
}

async function generateAppNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `APP-${year}-`;
  const rows = await db
    .select({ n: employmentApplications.applicationNumber })
    .from(employmentApplications)
    .where(sql`${employmentApplications.applicationNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(employmentApplications.id))
    .limit(1);
  let next = 1;
  if (rows.length > 0) {
    const m = rows[0].n.match(/(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

async function generateUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  // محاولة حتى ١٠ مرات قبل العودة لـnonce عشوائي
  while (i < 10) {
    const exists = await db.select({ id: jobVacancies.id }).from(jobVacancies).where(eq(jobVacancies.slug, slug)).limit(1);
    if (exists.length === 0) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

function buildInviteMessage(app: any, link: string): string {
  return `السلام عليكم ورحمة الله وبركاته
${app.fullNameAr || ""} المحترم/ة

نشكر اهتمامك بالعمل لدى شركة الزبد الأفضل التجارية.
يرجى تعبئة طلب التوظيف من خلال الرابط التالي:
*${app.targetPosition || "وظيفة"}*

${link}

ملاحظة: الرابط ينتهي خلال 14 يوماً من تاريخ الإرسال.

مع تحياتنا،
إدارة الموارد البشرية
شركة الزبد الأفضل التجارية`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60) || crypto.randomBytes(4).toString("hex");
}

export function registerEmploymentApplicationRoutes(app: Express) {
  // ===== Vacancies (open positions) =====
  app.get(
    "/api/hr/vacancies",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const filter = getEffectiveBranchFilter(req);
        if (!filter.hasAccess) return res.json([]);
        const conds: any[] = [];
        // فلترة بالفرع: اعرض فقط ما يخصّ صلاحيات المستخدم + الوظائف العامة (بدون فرع)
        if (filter.branchIds && filter.branchIds.length > 0) {
          conds.push(sql`(${jobVacancies.branchId} IS NULL OR ${jobVacancies.branchId} IN (${sql.join(filter.branchIds.map((b) => sql`${b}`), sql`, `)}))`);
        }
        const rows = await db.select().from(jobVacancies)
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(jobVacancies.createdAt)).limit(500);
        res.json(rows);
      } catch (e: any) {
        console.error("[vacancies] list error:", e);
        res.status(500).json({ error: e.message || "فشل تحميل الوظائف" });
      }
    }
  );

  app.post(
    "/api/hr/vacancies",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const parsed = insertJobVacancySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "بيانات غير صحيحة", issues: parsed.error.issues });
        }
        // تحقق صلاحية الفرع
        if (parsed.data.branchId) {
          const filter = getEffectiveBranchFilter(req);
          if (!filter.hasAccess) return res.status(403).json({ error: "لا تملك صلاحية" });
          if (filter.branchIds !== null && !filter.branchIds.includes(parsed.data.branchId)) {
            return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
          }
        }
        const user: any = (req as any).user;
        let branchName = parsed.data.branchName;
        if (parsed.data.branchId && !branchName) {
          const [br] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, parsed.data.branchId)).limit(1);
          if (br) branchName = br.name;
        }
        const baseSlug = slugify(parsed.data.title);
        const slug = await generateUniqueSlug(baseSlug);
        // محاولة الإدراج مع إعادة المحاولة في حال تصادم slug النادر
        let created;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const tryslug = attempt === 0 ? slug : `${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;
            [created] = await db.insert(jobVacancies).values({
              ...parsed.data,
              slug: tryslug,
              branchName: branchName || null,
              createdBy: user?.id || null,
            } as any).returning();
            break;
          } catch (err: any) {
            if (attempt === 2) throw err;
          }
        }
        res.status(201).json(created);
      } catch (e: any) {
        console.error("[vacancies] create error:", e);
        res.status(500).json({ error: e.message || "فشل إنشاء الوظيفة" });
      }
    }
  );

  app.patch(
    "/api/hr/vacancies/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [existing] = await db.select().from(jobVacancies).where(eq(jobVacancies.id, id)).limit(1);
        if (!existing) return res.status(404).json({ error: "غير موجودة" });
        if (!checkVacancyAccess(req, existing)) return res.status(403).json({ error: "لا تملك صلاحية" });
        const parsed = updateJobVacancySchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "بيانات غير صحيحة" });
        // منع نقل الوظيفة لفرع لا يملك المستخدم صلاحية عليه
        if (parsed.data.branchId && parsed.data.branchId !== existing.branchId) {
          const filter = getEffectiveBranchFilter(req);
          if (filter.branchIds !== null && !filter.branchIds.includes(parsed.data.branchId)) {
            return res.status(403).json({ error: "لا تملك صلاحية على الفرع المختار" });
          }
        }
        const updates: any = { ...parsed.data, updatedAt: new Date() };
        if (parsed.data.isOpen === false) updates.closedAt = new Date();
        if (parsed.data.isOpen === true) updates.closedAt = null;
        const [updated] = await db.update(jobVacancies).set(updates).where(eq(jobVacancies.id, id)).returning();
        res.json(updated);
      } catch (e: any) {
        console.error("[vacancies] update error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  app.delete(
    "/api/hr/vacancies/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "delete"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [existing] = await db.select().from(jobVacancies).where(eq(jobVacancies.id, id)).limit(1);
        if (!existing) return res.status(404).json({ error: "غير موجودة" });
        if (!checkVacancyAccess(req, existing)) return res.status(403).json({ error: "لا تملك صلاحية" });
        await db.delete(jobVacancies).where(eq(jobVacancies.id, id));
        res.json({ success: true });
      } catch (e: any) {
        console.error("[vacancies] delete error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Internal (HR) Applications =====
  app.get(
    "/api/hr/applications",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const status = req.query.status as string | undefined;
        const source = req.query.source as string | undefined;
        const queryBranchId = req.query.branchId as string | undefined;
        const search = (req.query.search as string | undefined)?.trim();
        const filter = getEffectiveBranchFilter(req, queryBranchId);
        if (!filter.hasAccess) return res.json([]);

        const conds: any[] = [];
        if (status) conds.push(eq(employmentApplications.status, status));
        if (source) conds.push(eq(employmentApplications.source, source));
        if (filter.branchIds && filter.branchIds.length > 0) {
          conds.push(inArray(employmentApplications.targetBranchId, filter.branchIds));
        }
        if (search)
          conds.push(
            sql`(${employmentApplications.fullNameAr} ILIKE ${"%" + search + "%"}
              OR ${employmentApplications.phone} ILIKE ${"%" + search + "%"}
              OR ${employmentApplications.applicationNumber} ILIKE ${"%" + search + "%"}
              OR ${employmentApplications.email} ILIKE ${"%" + search + "%"})`
          );

        // PERF: only select the lightweight summary fields the list view
        // actually renders. The full row contains heavy JSONB (education,
        // experience, additionalData…) and base64 attachments (cv/photo/id)
        // that can be megabytes per record — fetching 500 of those was the
        // root cause of the slow load. Full details are fetched on demand
        // via GET /api/hr/applications/:id when the user opens a card.
        const rows = await db
          .select({
            id: employmentApplications.id,
            applicationNumber: employmentApplications.applicationNumber,
            source: employmentApplications.source,
            status: employmentApplications.status,
            rating: employmentApplications.rating,
            fullNameAr: employmentApplications.fullNameAr,
            phone: employmentApplications.phone,
            targetPosition: employmentApplications.targetPosition,
            targetBranchId: employmentApplications.targetBranchId,
            targetBranchName: employmentApplications.targetBranchName,
            convertedToOfferId: employmentApplications.convertedToOfferId,
            // email is included so the client-side search box can still
            // match by email without forcing a heavy column projection.
            email: employmentApplications.email,
            createdAt: employmentApplications.createdAt,
          })
          .from(employmentApplications)
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(employmentApplications.createdAt))
          .limit(500);
        res.json(rows);
      } catch (e: any) {
        console.error("[emp-apps] list error:", e);
        res.status(500).json({ error: e.message || "فشل تحميل الطلبات" });
      }
    }
  );

  app.get(
    "/api/hr/applications/stats",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const filter = getEffectiveBranchFilter(req);
        const empty = { total: 0, invited: 0, submitted: 0, under_review: 0, shortlisted: 0, interviewed: 0, accepted: 0, rejected: 0, withdrawn: 0, expired: 0, cancelled: 0 };
        if (!filter.hasAccess) return res.json(empty);
        const rows = await db
          .select({ status: employmentApplications.status, count: sql<number>`COUNT(*)::int` })
          .from(employmentApplications)
          .where(filter.branchIds && filter.branchIds.length > 0 ? inArray(employmentApplications.targetBranchId, filter.branchIds) : undefined)
          .groupBy(employmentApplications.status);
        const stats: Record<string, number> = { ...empty };
        for (const r of rows) {
          stats[r.status] = (stats[r.status] || 0) + r.count;
          stats.total += r.count;
        }
        res.json(stats);
      } catch (e: any) {
        console.error("[emp-apps] stats error:", e);
        res.status(500).json({ error: "فشل تحميل الإحصائيات" });
      }
    }
  );

  app.get(
    "/api/hr/applications/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [application] = await db.select().from(employmentApplications).where(eq(employmentApplications.id, id)).limit(1);
        if (!application) return res.status(404).json({ error: "الطلب غير موجود" });
        if (!checkBranchAccess(req, application)) return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
        const audit = await db.select().from(employmentApplicationAuditLog).where(eq(employmentApplicationAuditLog.applicationId, id)).orderBy(desc(employmentApplicationAuditLog.createdAt)).limit(100);
        res.json({ application, audit });
      } catch (e: any) {
        console.error("[emp-apps] get error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // إنشاء طلب موجّه (الـHR تنشئ سجلاً ثم ترسل رابطاً)
  app.post(
    "/api/hr/applications",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const parsed = insertEmploymentApplicationSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "بيانات غير صحيحة", issues: parsed.error.issues });
        }
        // تحقق صلاحية الفرع المستهدف
        if (parsed.data.targetBranchId) {
          const filter = getEffectiveBranchFilter(req);
          if (!filter.hasAccess) return res.status(403).json({ error: "لا تملك صلاحية" });
          if (filter.branchIds !== null && !filter.branchIds.includes(parsed.data.targetBranchId)) {
            return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
          }
        }
        const user: any = (req as any).user;

        let targetBranchName = parsed.data.targetBranchName;
        if (parsed.data.targetBranchId && !targetBranchName) {
          const [br] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, parsed.data.targetBranchId)).limit(1);
          if (br) targetBranchName = br.name;
        }

        // محاولة إدراج مع retry عند تصادم رقم الطلب (race condition)
        let created;
        let lastErr: any;
        for (let attempt = 0; attempt < 3; attempt++) {
          const applicationNumber = await generateAppNumber();
          try {
            [created] = await db.insert(employmentApplications).values({
              ...parsed.data,
              cvUrl: sanitizeAttachmentUrl(parsed.data.cvUrl as any),
              photoUrl: sanitizeAttachmentUrl(parsed.data.photoUrl as any),
              idCopyUrl: sanitizeAttachmentUrl(parsed.data.idCopyUrl as any),
              targetBranchName: targetBranchName || null,
              applicationNumber,
              createdBy: user?.id || null,
            } as any).returning();
            break;
          } catch (err: any) {
            lastErr = err;
            if (err?.code !== "23505") throw err; // ليس تصادم unique
          }
        }
        if (!created) throw lastErr || new Error("فشل إنشاء الطلب");
        await logAudit(created.id, "created", req, { applicationNumber: created.applicationNumber });
        res.status(201).json(created);
      } catch (e: any) {
        console.error("[emp-apps] create error:", e);
        res.status(500).json({ error: e.message || "فشل إنشاء الطلب" });
      }
    }
  );

  // إرسال رابط التعبئة للمتقدم (موجّه)
  app.post(
    "/api/hr/applications/:id/send",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [application] = await db.select().from(employmentApplications).where(eq(employmentApplications.id, id)).limit(1);
        if (!application) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, application)) return res.status(403).json({ error: "لا تملك صلاحية" });
        if (["accepted", "rejected"].includes(application.status))
          return res.status(400).json({ error: "لا يمكن إعادة إرسال طلب تم البت فيه" });

        const validityDays = 14;
        const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

        // إلغاء توكنات سابقة
        await db.update(employmentApplicationTokens)
          .set({ revokedAt: new Date() })
          .where(and(
            eq(employmentApplicationTokens.applicationId, id),
            isNull(employmentApplicationTokens.usedAt),
            isNull(employmentApplicationTokens.revokedAt),
          ));

        const token = crypto.randomBytes(32).toString("hex");
        await db.insert(employmentApplicationTokens).values({ applicationId: id, token, expiresAt });

        await db.update(employmentApplications).set({
          status: application.status === "submitted" ? application.status : "invited",
          invitedAt: application.invitedAt || new Date(),
          expiresAt,
          updatedAt: new Date(),
        }).where(eq(employmentApplications.id, id));

        const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        const link = `${proto}://${host}/apply/${token}`;

        let waResult: any = { success: false, error: "Twilio غير مكوّن" };
        if (isTwilioConfigured() && application.phone) {
          const message = buildInviteMessage(application, link);
          waResult = await sendWhatsAppMessage(application.phone, message);
        }
        await logAudit(id, "invited", req, { link, whatsapp: waResult });
        res.json({ success: true, link, token, expiresAt, whatsapp: waResult });
      } catch (e: any) {
        console.error("[emp-apps] send error:", e);
        res.status(500).json({ error: e.message || "فشل الإرسال" });
      }
    }
  );

  // تحديث حالة المراجعة (HR)
  const reviewSchema = z.object({
    status: z.enum(["under_review", "shortlisted", "interviewed", "accepted", "rejected", "withdrawn", "cancelled"]),
    rating: z.number().int().min(1).max(5).optional(),
    hrNotes: z.string().optional(),
    rejectionReason: z.string().optional(),
  });

  app.patch(
    "/api/hr/applications/:id/review",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [application] = await db.select().from(employmentApplications).where(eq(employmentApplications.id, id)).limit(1);
        if (!application) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, application)) return res.status(403).json({ error: "لا تملك صلاحية" });

        const parsed = reviewSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "بيانات غير صحيحة", issues: parsed.error.issues });

        const user: any = (req as any).user;
        const now = new Date();
        const isFinal = ["accepted", "rejected", "withdrawn", "cancelled"].includes(parsed.data.status);
        const updates: any = {
          status: parsed.data.status,
          rating: parsed.data.rating ?? application.rating,
          hrNotes: parsed.data.hrNotes ?? application.hrNotes,
          rejectionReason: parsed.data.rejectionReason ?? application.rejectionReason,
          reviewedAt: now,
          reviewedBy: user?.id || null,
          updatedAt: now,
        };
        if (isFinal) updates.decidedAt = now;

        await db.update(employmentApplications).set(updates).where(eq(employmentApplications.id, id));
        await logAudit(id, parsed.data.status, req, { rating: parsed.data.rating, notes: parsed.data.hrNotes });
        res.json({ success: true });
      } catch (e: any) {
        console.error("[emp-apps] review error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // تحويل طلب مقبول لعرض عمل (ذرّي - يمنع التكرار)
  app.post(
    "/api/hr/applications/:id/convert-to-offer",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [application] = await db.select().from(employmentApplications).where(eq(employmentApplications.id, id)).limit(1);
        if (!application) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, application)) return res.status(403).json({ error: "لا تملك صلاحية" });
        if (application.status !== "accepted") {
          return res.status(400).json({ error: "يجب قبول الطلب أولاً" });
        }
        const reconvert = req.body?.reconvert === true;
        const previousOfferId = application.convertedToOfferId;
        if (previousOfferId && !reconvert) {
          return res.status(409).json({ error: "تم تحويل الطلب مسبقاً", offerId: previousOfferId });
        }

        const user: any = (req as any).user;
        const { startDate, basicSalary, position, department, contractDurationMonths, probationDays } = req.body || {};

        // استخراج المؤهل من المؤهلات إن وجد
        const eduArr = Array.isArray(application.education) ? (application.education as any[]) : [];
        const qualification = eduArr[0]?.degree || "";

        let createdOffer;
        let lastErr: any;
        const result = await db.transaction(async (tx) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const year = new Date().getFullYear();
              const prefix = `JOB-${year}-`;
              const lastRows = await tx
                .select({ n: jobOffers.offerNumber })
                .from(jobOffers)
                .where(sql`${jobOffers.offerNumber} LIKE ${prefix + "%"}`)
                .orderBy(desc(jobOffers.id))
                .limit(1);
              let next = 1;
              if (lastRows.length > 0) {
                const m = lastRows[0].n.match(/(\d+)$/);
                if (m) next = parseInt(m[1], 10) + 1 + attempt;
              } else {
                next = 1 + attempt;
              }
              const offerNumber = `${prefix}${String(next).padStart(4, "0")}`;

              const [offer] = await tx.insert(jobOffers).values({
                offerNumber,
                candidateName: application.fullNameAr,
                candidateNameEn: application.fullNameEn || null,
                nationality: application.nationality || null,
                idNumber: application.idNumber || null,
                idExpiry: application.idExpiry || null,
                phone: application.phone,
                email: application.email || null,
                qualification,
                position: position || application.targetPosition || "غير محدد",
                department: department || null,
                branchId: application.targetBranchId || null,
                branchName: application.targetBranchName || null,
                startDate: startDate || application.availabilityDate || new Date().toISOString().slice(0, 10),
                contractDurationMonths: contractDurationMonths ?? 12,
                probationDays: probationDays ?? 180,
                basicSalary: basicSalary ?? application.expectedSalary ?? 0,
                createdBy: user?.id || null,
              } as any).returning();

              // ربط ذرّي - يمنع التكرار/السباق:
              // أول تحويل: نشترط أن convertedToOfferId لا يزال NULL.
              // إعادة تحويل: نشترط بقاء العرض السابق كما هو (تزامن متفائل).
              const linkGuard = previousOfferId
                ? eq(employmentApplications.convertedToOfferId, previousOfferId)
                : isNull(employmentApplications.convertedToOfferId);
              const linked = await tx.update(employmentApplications)
                .set({ convertedToOfferId: offer.id, updatedAt: new Date() })
                .where(and(eq(employmentApplications.id, id), linkGuard))
                .returning({ id: employmentApplications.id });

              if (linked.length === 0) {
                throw new Error("CONVERTED_RACE");
              }
              return offer;
            } catch (err: any) {
              lastErr = err;
              if (err?.message === "CONVERTED_RACE") throw err;
              if (err?.code !== "23505") throw err;
            }
          }
          throw lastErr;
        });
        createdOffer = result;

        await logAudit(id, reconvert ? "reconverted_to_offer" : "converted_to_offer", req, { offerId: createdOffer.id, offerNumber: createdOffer.offerNumber, previousOfferId: previousOfferId || null });
        res.json({ success: true, offer: createdOffer });
      } catch (e: any) {
        console.error("[emp-apps] convert error:", e);
        const msg = e?.message === "CONVERTED_RACE" ? "تم تحويل الطلب مسبقاً" : (e.message || "فشل التحويل");
        res.status(409).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/hr/applications/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "delete"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const [application] = await db.select().from(employmentApplications).where(eq(employmentApplications.id, id)).limit(1);
        if (!application) return res.status(404).json({ error: "غير موجود" });
        if (!checkBranchAccess(req, application)) return res.status(403).json({ error: "لا تملك صلاحية" });
        await db.delete(employmentApplications).where(eq(employmentApplications.id, id));
        res.json({ success: true });
      } catch (e: any) {
        console.error("[emp-apps] delete error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ===== Public — Directed token =====
  app.get("/api/public/applications/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const [tk] = await db.select().from(employmentApplicationTokens).where(eq(employmentApplicationTokens.token, token)).limit(1);
      if (!tk) return res.status(404).json({ error: "الرابط غير صالح" });
      if (tk.revokedAt) return res.status(410).json({ error: "تم إلغاء هذا الرابط" });
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية الرابط" });
      }

      const [application] = await db.select().from(employmentApplications).where(eq(employmentApplications.id, tk.applicationId)).limit(1);
      if (!application) return res.status(404).json({ error: "الطلب غير موجود" });

      const isReadOnly = !!tk.usedAt || ["accepted", "rejected", "withdrawn", "cancelled"].includes(application.status);

      const { createdBy, reviewedBy, hrNotes, rejectionReason, rating, ...safe } = application;
      res.json({
        application: safe,
        readOnly: isReadOnly,
        expiresAt: tk.expiresAt,
        company: { name: "شركة الزبد الأفضل التجارية", nameEn: "Butter Bakery Trading Co.", cr: "7026155296" },
      });
    } catch (e: any) {
      console.error("[emp-apps] public get error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Schema للإرسال من المتقدم — كل الحقول اختيارية إلا التوقيع والإقرار
  const submitSchema = z.object({
    fullNameAr: z.string().min(2),
    fullNameEn: z.string().optional(),
    nationality: z.string().optional(),
    idNumber: z.string().optional(),
    idType: z.string().optional(),
    idExpiry: z.string().optional(),
    dob: z.string().optional(),
    gender: z.string().optional(),
    maritalStatus: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().min(8),
    whatsapp: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    education: z.array(z.any()).optional(),
    experience: z.array(z.any()).optional(),
    skills: z.array(z.string()).optional(),
    languages: z.array(z.any()).optional(),
    references: z.array(z.any()).optional(),
    expectedSalary: z.number().int().nonnegative().optional(),
    availabilityDate: z.string().optional(),
    cvUrl: z.string().optional(),
    photoUrl: z.string().optional(),
    idCopyUrl: z.string().optional(),
    additionalData: z.record(z.any()).optional(),
    signature: z.string().min(50, "التوقيع مطلوب"),
    agreedToTerms: z.literal(true),
  });

  app.post("/api/public/applications/:token/submit", async (req, res) => {
    try {
      const token = req.params.token;
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير مكتملة", issues: parsed.error.issues });

      const [tk] = await db.select().from(employmentApplicationTokens).where(eq(employmentApplicationTokens.token, token)).limit(1);
      if (!tk || tk.revokedAt || tk.usedAt) return res.status(410).json({ error: "الرابط غير صالح" });
      if (tk.expiresAt && new Date(tk.expiresAt) < new Date()) return res.status(410).json({ error: "انتهت صلاحية الرابط" });

      const [application] = await db.select().from(employmentApplications).where(eq(employmentApplications.id, tk.applicationId)).limit(1);
      if (!application) return res.status(404).json({ error: "غير موجود" });
      if (["accepted", "rejected", "cancelled"].includes(application.status)) return res.status(400).json({ error: "تم البت في الطلب" });

      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || null;
      const ua = (req.headers["user-agent"] as string) || null;
      const now = new Date();

      const ok = await db.transaction(async (tx) => {
        const tokRows = await tx.update(employmentApplicationTokens)
          .set({ usedAt: now })
          .where(and(
            eq(employmentApplicationTokens.id, tk.id),
            isNull(employmentApplicationTokens.usedAt),
            isNull(employmentApplicationTokens.revokedAt),
            gt(employmentApplicationTokens.expiresAt, now)
          ))
          .returning({ id: employmentApplicationTokens.id });
        if (tokRows.length === 0) return false;

        await tx.update(employmentApplications).set({
          ...parsed.data,
          cvUrl: sanitizeAttachmentUrl(parsed.data.cvUrl),
          photoUrl: sanitizeAttachmentUrl(parsed.data.photoUrl),
          idCopyUrl: sanitizeAttachmentUrl(parsed.data.idCopyUrl),
          status: "submitted",
          submittedAt: now,
          applicantIp: ip,
          applicantUserAgent: ua,
          updatedAt: now,
        } as any).where(eq(employmentApplications.id, application.id));
        return true;
      }).catch((err) => { console.error(err); return false; });

      if (!ok) return res.status(409).json({ error: "تم استخدام الرابط من قبل" });

      await logAudit(application.id, "submitted", req, { ip });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[emp-apps] submit error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ===== Public — Open vacancies =====
  app.get("/api/public/vacancies", async (_req, res) => {
    try {
      const rows = await db.select({
        id: jobVacancies.id,
        slug: jobVacancies.slug,
        title: jobVacancies.title,
        titleEn: jobVacancies.titleEn,
        department: jobVacancies.department,
        branchName: jobVacancies.branchName,
        description: jobVacancies.description,
        requirements: jobVacancies.requirements,
        createdAt: jobVacancies.createdAt,
      }).from(jobVacancies).where(eq(jobVacancies.isOpen, true)).orderBy(desc(jobVacancies.createdAt)).limit(100);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/public/vacancies/:slug", async (req, res) => {
    try {
      const [v] = await db.select().from(jobVacancies).where(eq(jobVacancies.slug, req.params.slug)).limit(1);
      if (!v) return res.status(404).json({ error: "الوظيفة غير موجودة" });
      if (!v.isOpen) return res.status(410).json({ error: "تم إغلاق هذه الوظيفة" });
      const { createdBy, ...safe } = v;
      res.json({ vacancy: safe, company: { name: "شركة الزبد الأفضل التجارية", nameEn: "Butter Bakery Trading Co." } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // التقديم على وظيفة عامة (Open)
  app.post("/api/public/vacancies/:slug/apply", async (req, res) => {
    try {
      const [v] = await db.select().from(jobVacancies).where(eq(jobVacancies.slug, req.params.slug)).limit(1);
      if (!v) return res.status(404).json({ error: "الوظيفة غير موجودة" });
      if (!v.isOpen) return res.status(410).json({ error: "تم إغلاق هذه الوظيفة" });

      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير مكتملة", issues: parsed.error.issues });

      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || null;
      const ua = (req.headers["user-agent"] as string) || null;
      // إدراج مع retry لتصادم رقم الطلب
      let created;
      let lastErr: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        const applicationNumber = await generateAppNumber();
        try {
          [created] = await db.insert(employmentApplications).values({
            ...parsed.data,
            cvUrl: sanitizeAttachmentUrl(parsed.data.cvUrl),
            photoUrl: sanitizeAttachmentUrl(parsed.data.photoUrl),
            idCopyUrl: sanitizeAttachmentUrl(parsed.data.idCopyUrl),
            applicationNumber,
            source: "open",
            vacancyId: v.id,
            targetPosition: v.title,
            targetBranchId: v.branchId,
            targetBranchName: v.branchName,
            status: "submitted",
            submittedAt: new Date(),
            applicantIp: ip,
            applicantUserAgent: ua,
          } as any).returning();
          break;
        } catch (err: any) {
          lastErr = err;
          if (err?.code !== "23505") throw err;
        }
      }
      if (!created) throw lastErr || new Error("فشل التقديم");
      await logAudit(created.id, "submitted_open", req, { vacancyId: v.id, ip });
      res.status(201).json({ success: true, applicationNumber: created.applicationNumber });
    } catch (e: any) {
      console.error("[emp-apps] public apply error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
