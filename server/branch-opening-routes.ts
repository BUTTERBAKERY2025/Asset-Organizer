import type { Express } from "express";
import { db } from "./db";
import { branchOpeningCampaigns, branchOpeningGuests, insertBranchOpeningCampaignSchema, updateBranchOpeningCampaignSchema, insertBranchOpeningGuestSchema } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { isAuthenticated, requirePermission } from "./auth";
import { apiRateLimiter } from "./security";
import { z } from "zod";

const PERMISSION_MODULE = "marketing" as const;

// تحويل النص إلى slug آمن
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "campaign";
}

// توليد رقم تذكرة فريد
function generateTicketNumber(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  let out = "";
  for (let i = 0; i < 2; i++) out += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 5; i++) out += nums[Math.floor(Math.random() * nums.length)];
  return out;
}

const PUBLIC_REGISTER_SCHEMA = z.object({
  name: z.string().min(2, "الاسم مطلوب").max(80),
  phone: z.string().min(8, "رقم الجوال مطلوب").max(20),
  gender: z.enum(["male", "female"], { errorMap: () => ({ message: "اختر النوع" }) }),
  city: z.string().min(2, "المدينة مطلوبة").max(60),
  district: z.string().min(2, "الحي مطلوب").max(80),
});

export function registerBranchOpeningRoutes(app: Express) {
  // ============= LOWERED: ADMIN/MARKETING ENDPOINTS =============

  // قائمة كل الحملات (مع عدد الضيوف)
  app.get(
    "/api/marketing/opening-campaigns",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (_req, res) => {
      try {
        const rows = await db.execute(sql`
          SELECT c.*, COUNT(g.id)::int AS guests_count
          FROM branch_opening_campaigns c
          LEFT JOIN branch_opening_guests g ON g.campaign_id = c.id
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);
        res.json(rows.rows);
      } catch (e: any) {
        console.error("[opening-campaigns] list error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // إنشاء حملة
  app.post(
    "/api/marketing/opening-campaigns",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "create"),
    async (req, res) => {
      try {
        const user: any = (req as any).user;
        const body = insertBranchOpeningCampaignSchema.parse({
          ...req.body,
          createdBy: user?.id ?? null,
        });
        // ضمان slug فريد
        let baseSlug = slugify(`${body.branchName}-${body.branchCity}`);
        let finalSlug = baseSlug;
        let i = 1;
        while (true) {
          const [exists] = await db.select({ id: branchOpeningCampaigns.id })
            .from(branchOpeningCampaigns).where(eq(branchOpeningCampaigns.slug, finalSlug)).limit(1);
          if (!exists) break;
          i++;
          finalSlug = `${baseSlug}-${i}`;
        }
        const [created] = await db.insert(branchOpeningCampaigns).values({ ...body, slug: finalSlug }).returning();
        res.status(201).json(created);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
        console.error("[opening-campaigns] create error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // تعديل حملة
  app.patch(
    "/api/marketing/opening-campaigns/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صالح" });
        const body = updateBranchOpeningCampaignSchema.parse(req.body);
        const [updated] = await db.update(branchOpeningCampaigns)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(branchOpeningCampaigns.id, id))
          .returning();
        if (!updated) return res.status(404).json({ error: "غير موجود" });
        res.json(updated);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
        console.error("[opening-campaigns] update error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // حذف حملة
  app.delete(
    "/api/marketing/opening-campaigns/:id",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "delete"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صالح" });
        await db.delete(branchOpeningCampaigns).where(eq(branchOpeningCampaigns.id, id));
        res.json({ success: true });
      } catch (e: any) {
        console.error("[opening-campaigns] delete error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // جلب ضيوف حملة
  app.get(
    "/api/marketing/opening-campaigns/:id/guests",
    isAuthenticated,
    requirePermission(PERMISSION_MODULE, "view"),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صالح" });
        const guests = await db.select().from(branchOpeningGuests)
          .where(eq(branchOpeningGuests.campaignId, id))
          .orderBy(desc(branchOpeningGuests.createdAt));
        res.json(guests);
      } catch (e: any) {
        console.error("[opening-campaigns] guests error:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ============= PUBLIC ENDPOINTS (لا تتطلب تسجيل دخول) =============

  // معلومات الحملة العامة عبر الـ slug
  app.get("/api/public/opening/:slug", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim();
      const [c] = await db.select().from(branchOpeningCampaigns)
        .where(and(eq(branchOpeningCampaigns.slug, slug), eq(branchOpeningCampaigns.isActive, true)))
        .limit(1);
      if (!c) return res.status(404).json({ error: "الحملة غير موجودة أو منتهية" });
      // لا نُعيد معرّف منشئ الحملة ولا أي بيانات حساسة
      res.json({
        id: c.id,
        slug: c.slug,
        title: c.title,
        branchName: c.branchName,
        branchCity: c.branchCity,
        branchAddress: c.branchAddress,
        openingDate: c.openingDate,
        headline: c.headline,
        description: c.description,
        prizesJson: c.prizesJson,
      });
    } catch (e: any) {
      console.error("[public-opening] info error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تسجيل ضيف جديد + توليد رقم تذكرة + اختيار جائزة عشوائية
  app.post("/api/public/opening/:slug/register", apiRateLimiter, async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim();
      const data = PUBLIC_REGISTER_SCHEMA.parse(req.body);

      const [c] = await db.select().from(branchOpeningCampaigns)
        .where(and(eq(branchOpeningCampaigns.slug, slug), eq(branchOpeningCampaigns.isActive, true)))
        .limit(1);
      if (!c) return res.status(404).json({ error: "الحملة غير موجودة أو منتهية" });

      // حد أقصى للتسجيلات
      if (c.maxGuests) {
        const [{ count }] = await db.execute<any>(sql`
          SELECT COUNT(*)::int AS count FROM branch_opening_guests WHERE campaign_id = ${c.id}
        `).then((r: any) => r.rows ?? r);
        if (count >= c.maxGuests) {
          return res.status(409).json({ error: "اكتمل عدد الضيوف لهذه الحملة" });
        }
      }

      // منع تكرار التسجيل بنفس الجوال
      const normalizedPhone = data.phone.replace(/\D/g, "");
      const [existing] = await db.select({ id: branchOpeningGuests.id, ticketNumber: branchOpeningGuests.ticketNumber, prizeWon: branchOpeningGuests.prizeWon })
        .from(branchOpeningGuests)
        .where(and(eq(branchOpeningGuests.campaignId, c.id), eq(branchOpeningGuests.phone, normalizedPhone)))
        .limit(1);
      if (existing) {
        return res.status(200).json({
          alreadyRegistered: true,
          ticketNumber: existing.ticketNumber,
          prizeWon: existing.prizeWon,
          message: "أنت مسجّل مسبقاً بهذا الرقم",
        });
      }

      // اختيار جائزة عشوائية من قائمة الحملة
      let prizes: string[] = [];
      try {
        prizes = c.prizesJson ? JSON.parse(c.prizesJson) : [];
        if (!Array.isArray(prizes)) prizes = [];
      } catch { prizes = []; }
      if (prizes.length === 0) {
        prizes = ["وجبة مجانية", "خصم 20%", "كوب قهوة هدية", "حلويات بالمناسبة", "خصم 10%", "بطاقة شكر"];
      }
      const prizeWon = prizes[Math.floor(Math.random() * prizes.length)];

      // توليد رقم تذكرة فريد
      let ticketNumber = generateTicketNumber();
      for (let i = 0; i < 5; i++) {
        const [dup] = await db.select({ id: branchOpeningGuests.id }).from(branchOpeningGuests)
          .where(eq(branchOpeningGuests.ticketNumber, ticketNumber)).limit(1);
        if (!dup) break;
        ticketNumber = generateTicketNumber();
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
      const ua = (req.headers["user-agent"] as string) || null;

      const [guest] = await db.insert(branchOpeningGuests).values({
        campaignId: c.id,
        name: data.name.trim(),
        phone: normalizedPhone,
        gender: data.gender,
        city: data.city.trim(),
        district: data.district.trim(),
        ticketNumber,
        prizeWon,
        ipAddress: ip,
        userAgent: ua,
      }).returning();

      res.status(201).json({
        ticketNumber: guest.ticketNumber,
        prizeWon: guest.prizeWon,
        prizes, // لتدوير عجلة الحظ على العميل
        guestName: guest.name,
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[public-opening] register error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
