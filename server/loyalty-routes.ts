import type { Express, Request } from "express";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { isAuthenticated, requirePermission } from "./auth";
import {
  loyaltyCampaigns,
  loyaltyCustomers,
  loyaltyMembers,
  loyaltyRedemptions,
  insertLoyaltyCampaignSchema,
} from "@shared/schema";
import { z } from "zod";
import { randomInt } from "crypto";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "./wallet-service";

const LOYALTY_MODULE = "marketing";

// ---- Rate limiting for public endpoints (per IP) ----
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of Array.from(rateLimitMap.entries())) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

// Normalize Saudi phone numbers to a canonical form for dedupe
function normalizePhone(raw: string): string {
  let cleaned = (raw || "").replace(/\D/g, "");
  if (cleaned.startsWith("00966")) cleaned = cleaned.slice(5);
  else if (cleaned.startsWith("966")) cleaned = cleaned.slice(3);
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  // Saudi mobiles are 9 digits starting with 5
  return cleaned;
}

function isValidSaudiPhone(normalized: string): boolean {
  return /^5\d{8}$/.test(normalized);
}

// Unambiguous alphabet (no 0/O/1/I/L) for a hard-to-guess, easy-to-read code body.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCodeBody(len: number): string {
  let body = "";
  for (let i = 0; i < len; i++) {
    body += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return body;
}

// Generate a unique member code: PREFIX-XXXXXXXX (8 random unambiguous chars).
// 31^8 ≈ 8.5e11 combinations → effectively unguessable even with rate limiting.
async function generateUniqueCode(prefix: string): Promise<string> {
  const clean = (prefix || "BB").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "BB";
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = `${clean}-${randomCodeBody(8)}`;
    const [existing] = await db
      .select({ id: loyaltyMembers.id })
      .from(loyaltyMembers)
      .where(eq(loyaltyMembers.code, code));
    if (!existing) return code;
  }
  throw new Error("تعذر توليد رمز فريد، حاول مرة أخرى");
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// Returns null if campaign is currently usable, otherwise an Arabic error string
function campaignAvailabilityError(campaign: typeof loyaltyCampaigns.$inferSelect): string | null {
  if (campaign.status !== "active") return "الحملة غير مفعّلة حالياً";
  const today = todayStr();
  if (campaign.validFrom && campaign.validFrom > today) return "الحملة لم تبدأ بعد";
  if (campaign.validTo && campaign.validTo < today) return "انتهت صلاحية الحملة";
  return null;
}

// Atomically upsert the customer + issue (or reuse) the member code for a
// campaign. Shared by the public registration route. Returns the member + customer.
async function issueCardForVerifiedPhone(params: {
  campaign: typeof loyaltyCampaigns.$inferSelect;
  storedPhone: string;
  name: string;
  gender: string;
  city: string;
}): Promise<{ code: string; name: string; alreadyRegistered: boolean }> {
  const { campaign, storedPhone, name, gender, city } = params;
  // Pre-generate a candidate code outside the transaction (cheap uniqueness scan)
  const candidateCode = await generateUniqueCode(campaign.codePrefix || "BB");

  const result = await db.transaction(async (tx) => {
    const customerInfo = { name, gender, city };
    let [customer] = await tx
      .select()
      .from(loyaltyCustomers)
      .where(eq(loyaltyCustomers.phone, storedPhone));
    if (!customer) {
      [customer] = await tx
        .insert(loyaltyCustomers)
        .values({ phone: storedPhone, ...customerInfo })
        .onConflictDoUpdate({ target: loyaltyCustomers.phone, set: customerInfo })
        .returning();
    } else {
      [customer] = await tx
        .update(loyaltyCustomers)
        .set(customerInfo)
        .where(eq(loyaltyCustomers.id, customer.id))
        .returning();
    }

    // Idempotent: reuse existing membership for this campaign if present
    const [existingMember] = await tx
      .select()
      .from(loyaltyMembers)
      .where(
        and(
          eq(loyaltyMembers.campaignId, campaign.id),
          eq(loyaltyMembers.customerId, customer.id)
        )
      );
    if (existingMember) {
      return { member: existingMember, customer, created: false };
    }

    // Race-safe insert: if a concurrent request already created the membership
    // (unique campaignId+customerId), do nothing and re-select.
    const inserted = await tx
      .insert(loyaltyMembers)
      .values({
        campaignId: campaign.id,
        customerId: customer.id,
        code: candidateCode,
        maxUses: campaign.maxUsesPerCustomer,
        status: "active",
      })
      .onConflictDoNothing({
        target: [loyaltyMembers.campaignId, loyaltyMembers.customerId],
      })
      .returning();

    if (inserted.length > 0) {
      return { member: inserted[0], customer, created: true };
    }

    const [racedMember] = await tx
      .select()
      .from(loyaltyMembers)
      .where(
        and(
          eq(loyaltyMembers.campaignId, campaign.id),
          eq(loyaltyMembers.customerId, customer.id)
        )
      );
    return { member: racedMember, customer, created: false };
  });

  return {
    code: result.member.code,
    name: result.customer.name,
    alreadyRegistered: !result.created,
  };
}

export function registerLoyaltyRoutes(app: Express) {
  // =====================================================
  // Admin: Campaign CRUD (gated on marketing permission)
  // =====================================================

  app.get(
    "/api/loyalty/campaigns",
    isAuthenticated,
    requirePermission(LOYALTY_MODULE, "view"),
    async (_req, res) => {
      try {
        const campaigns = await db
          .select()
          .from(loyaltyCampaigns)
          .orderBy(desc(loyaltyCampaigns.createdAt));

        // Aggregate member + redemption counts per campaign
        const memberCounts = await db
          .select({
            campaignId: loyaltyMembers.campaignId,
            members: sql<number>`COUNT(*)::int`,
            totalUses: sql<number>`COALESCE(SUM(${loyaltyMembers.usedCount}), 0)::int`,
          })
          .from(loyaltyMembers)
          .groupBy(loyaltyMembers.campaignId);

        const countMap = new Map(
          memberCounts.map((m) => [m.campaignId, { members: m.members, totalUses: m.totalUses }])
        );

        // Total discount actually given per campaign (from redemptions log)
        const discountSums = await db
          .select({
            campaignId: loyaltyRedemptions.campaignId,
            totalDiscount: sql<number>`COALESCE(SUM(${loyaltyRedemptions.discountAmount}), 0)::float8`,
          })
          .from(loyaltyRedemptions)
          .groupBy(loyaltyRedemptions.campaignId);

        const discountMap = new Map(discountSums.map((d) => [d.campaignId, d.totalDiscount]));

        res.json(
          campaigns.map((c) => ({
            ...c,
            memberCount: countMap.get(c.id)?.members ?? 0,
            totalRedemptions: countMap.get(c.id)?.totalUses ?? 0,
            totalDiscount: discountMap.get(c.id) ?? 0,
          }))
        );
      } catch (error) {
        console.error("Error fetching loyalty campaigns:", error);
        res.status(500).json({ error: "فشل في جلب الحملات" });
      }
    }
  );

  app.get(
    "/api/loyalty/campaigns/:id",
    isAuthenticated,
    requirePermission(LOYALTY_MODULE, "view"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
        const [campaign] = await db
          .select()
          .from(loyaltyCampaigns)
          .where(eq(loyaltyCampaigns.id, id));
        if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
        res.json(campaign);
      } catch (error) {
        console.error("Error fetching loyalty campaign:", error);
        res.status(500).json({ error: "فشل في جلب الحملة" });
      }
    }
  );

  const slugSchema = z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "الرابط يجب أن يحتوي حروف إنجليزية صغيرة وأرقام وشرطات فقط");

  app.post(
    "/api/loyalty/campaigns",
    isAuthenticated,
    requirePermission(LOYALTY_MODULE, "create"),
    async (req, res) => {
      try {
        const userId = (req as any).currentUser?.id || (req as any).user?.id;
        const data = insertLoyaltyCampaignSchema.parse({
          ...req.body,
          createdBy: userId,
        });

        // Validate slug shape explicitly for clearer errors
        slugSchema.parse(data.slug);

        const [existing] = await db
          .select({ id: loyaltyCampaigns.id })
          .from(loyaltyCampaigns)
          .where(eq(loyaltyCampaigns.slug, data.slug));
        if (existing) {
          return res.status(409).json({ error: "هذا الرابط مستخدم بالفعل، اختر رابطاً آخر" });
        }

        const [campaign] = await db.insert(loyaltyCampaigns).values(data).returning();
        res.status(201).json(campaign);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
        }
        console.error("Error creating loyalty campaign:", error);
        res.status(500).json({ error: "فشل في إنشاء الحملة" });
      }
    }
  );

  app.patch(
    "/api/loyalty/campaigns/:id",
    isAuthenticated,
    requirePermission(LOYALTY_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

        // Slug is immutable after creation to keep public links stable
        const { slug, createdBy, ...rest } = req.body ?? {};
        const updateSchema = insertLoyaltyCampaignSchema.partial().omit({ slug: true, createdBy: true });
        const data = updateSchema.parse(rest);

        const [campaign] = await db
          .update(loyaltyCampaigns)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(loyaltyCampaigns.id, id))
          .returning();
        if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
        res.json(campaign);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
        }
        console.error("Error updating loyalty campaign:", error);
        res.status(500).json({ error: "فشل في تحديث الحملة" });
      }
    }
  );

  // =====================================================
  // Admin: Members of a campaign (customers + their codes)
  // =====================================================

  app.get(
    "/api/loyalty/campaigns/:id/members",
    isAuthenticated,
    requirePermission(LOYALTY_MODULE, "view"),
    async (req, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        if (isNaN(campaignId)) return res.status(400).json({ error: "معرف غير صالح" });

        const members = await db
          .select({
            id: loyaltyMembers.id,
            code: loyaltyMembers.code,
            maxUses: loyaltyMembers.maxUses,
            usedCount: loyaltyMembers.usedCount,
            status: loyaltyMembers.status,
            createdAt: loyaltyMembers.createdAt,
            customerName: loyaltyCustomers.name,
            customerPhone: loyaltyCustomers.phone,
          })
          .from(loyaltyMembers)
          .innerJoin(loyaltyCustomers, eq(loyaltyCustomers.id, loyaltyMembers.customerId))
          .where(eq(loyaltyMembers.campaignId, campaignId))
          .orderBy(desc(loyaltyMembers.createdAt));

        res.json(members);
      } catch (error) {
        console.error("Error fetching loyalty members:", error);
        res.status(500).json({ error: "فشل في جلب الأعضاء" });
      }
    }
  );

  // Enable / disable a member's card
  app.patch(
    "/api/loyalty/members/:id/status",
    isAuthenticated,
    requirePermission(LOYALTY_MODULE, "edit"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
        const status = req.body?.status;
        if (!["active", "disabled"].includes(status)) {
          return res.status(400).json({ error: "حالة غير صالحة" });
        }
        const [member] = await db
          .update(loyaltyMembers)
          .set({ status })
          .where(eq(loyaltyMembers.id, id))
          .returning();
        if (!member) return res.status(404).json({ error: "العضو غير موجود" });
        res.json(member);
      } catch (error) {
        console.error("Error updating member status:", error);
        res.status(500).json({ error: "فشل في تحديث الحالة" });
      }
    }
  );

  // Redemption log for a campaign
  app.get(
    "/api/loyalty/campaigns/:id/redemptions",
    isAuthenticated,
    requirePermission(LOYALTY_MODULE, "view"),
    async (req, res) => {
      try {
        const campaignId = parseInt(req.params.id);
        if (isNaN(campaignId)) return res.status(400).json({ error: "معرف غير صالح" });

        const redemptions = await db
          .select({
            id: loyaltyRedemptions.id,
            code: loyaltyMembers.code,
            customerName: loyaltyCustomers.name,
            customerPhone: loyaltyCustomers.phone,
            branchId: loyaltyRedemptions.branchId,
            orderAmount: loyaltyRedemptions.orderAmount,
            discountAmount: loyaltyRedemptions.discountAmount,
            posSaleId: loyaltyRedemptions.posSaleId,
            redeemedAt: loyaltyRedemptions.redeemedAt,
          })
          .from(loyaltyRedemptions)
          .innerJoin(loyaltyMembers, eq(loyaltyMembers.id, loyaltyRedemptions.memberId))
          .innerJoin(loyaltyCustomers, eq(loyaltyCustomers.id, loyaltyMembers.customerId))
          .where(eq(loyaltyRedemptions.campaignId, campaignId))
          .orderBy(desc(loyaltyRedemptions.redeemedAt))
          .limit(500);

        res.json(redemptions);
      } catch (error) {
        console.error("Error fetching redemptions:", error);
        res.status(500).json({ error: "فشل في جلب سجل الاستخدام" });
      }
    }
  );

  // =====================================================
  // Public: Campaign info + registration (rate limited, no auth)
  // =====================================================

  // Public campaign info for the /join/:slug landing page
  app.get("/api/public/loyalty/campaign/:slug", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "عدد الطلبات كثير جداً، حاول لاحقاً" });
      }
      const slug = req.params.slug;
      if (!slug || !/^[a-z0-9-]{2,60}$/.test(slug)) {
        return res.status(400).json({ error: "رابط غير صالح" });
      }
      const [campaign] = await db
        .select({
          name: loyaltyCampaigns.name,
          description: loyaltyCampaigns.description,
          discountType: loyaltyCampaigns.discountType,
          discountValue: loyaltyCampaigns.discountValue,
          maxUsesPerCustomer: loyaltyCampaigns.maxUsesPerCustomer,
          minimumOrder: loyaltyCampaigns.minimumOrder,
          terms: loyaltyCampaigns.terms,
          status: loyaltyCampaigns.status,
          validFrom: loyaltyCampaigns.validFrom,
          validTo: loyaltyCampaigns.validTo,
        })
        .from(loyaltyCampaigns)
        .where(eq(loyaltyCampaigns.slug, slug));

      if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
      const availErr = campaignAvailabilityError(campaign as any);
      if (availErr) return res.status(410).json({ error: availErr });

      res.json(campaign);
    } catch (error) {
      console.error("Error fetching public campaign:", error);
      res.status(500).json({ error: "فشل في جلب الحملة" });
    }
  });

  // Public registration — issues (or returns) the member card immediately.
  // Phone messaging/verification is intentionally NOT used here (postponed).
  const registerSchema = z.object({
    name: z.string().trim().min(2, "الاسم قصير جداً").max(100),
    phone: z.string().trim().min(7).max(20),
    gender: z.enum(["male", "female"], {
      errorMap: () => ({ message: "الرجاء اختيار الجنس (ذكر / أنثى)" }),
    }),
    city: z.string().trim().min(2, "الرجاء إدخال اسم المدينة").max(50),
  });

  app.post("/api/public/loyalty/:slug/register", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "عدد الطلبات كثير جداً، حاول لاحقاً" });
      }

      const slug = req.params.slug;
      if (!slug || !/^[a-z0-9-]{2,60}$/.test(slug)) {
        return res.status(400).json({ error: "رابط غير صالح" });
      }

      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "بيانات غير صالحة" });
      }

      const normalizedPhone = normalizePhone(parsed.data.phone);
      if (!isValidSaudiPhone(normalizedPhone)) {
        return res.status(400).json({ error: "رقم الجوال غير صحيح، أدخل رقم جوال سعودي صحيح" });
      }
      const storedPhone = `0${normalizedPhone}`; // canonical local format e.g. 05XXXXXXXX

      const [campaign] = await db
        .select()
        .from(loyaltyCampaigns)
        .where(eq(loyaltyCampaigns.slug, slug));
      if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
      const availErr = campaignAvailabilityError(campaign);
      if (availErr) return res.status(410).json({ error: availErr });

      const issued = await issueCardForVerifiedPhone({
        campaign,
        storedPhone,
        name: parsed.data.name,
        gender: parsed.data.gender,
        city: parsed.data.city,
      });

      res.json(issued);
    } catch (error) {
      console.error("Error registering loyalty member:", error);
      res.status(500).json({ error: "فشل في التسجيل، حاول مرة أخرى" });
    }
  });

  // Public: fetch a personal card by code (for /card/:code page)
  app.get("/api/public/loyalty/card/:code", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "عدد الطلبات كثير جداً، حاول لاحقاً" });
      }
      const code = req.params.code;
      if (!code || !/^[A-Za-z0-9\-_]{3,50}$/.test(code)) {
        return res.status(400).json({ error: "رمز غير صالح" });
      }

      const [row] = await db
        .select({
          code: loyaltyMembers.code,
          maxUses: loyaltyMembers.maxUses,
          usedCount: loyaltyMembers.usedCount,
          status: loyaltyMembers.status,
          customerName: loyaltyCustomers.name,
          campaignName: loyaltyCampaigns.name,
          description: loyaltyCampaigns.description,
          discountType: loyaltyCampaigns.discountType,
          discountValue: loyaltyCampaigns.discountValue,
          minimumOrder: loyaltyCampaigns.minimumOrder,
          terms: loyaltyCampaigns.terms,
          validTo: loyaltyCampaigns.validTo,
          campaignStatus: loyaltyCampaigns.status,
        })
        .from(loyaltyMembers)
        .innerJoin(loyaltyCustomers, eq(loyaltyCustomers.id, loyaltyMembers.customerId))
        .innerJoin(loyaltyCampaigns, eq(loyaltyCampaigns.id, loyaltyMembers.campaignId))
        .where(eq(loyaltyMembers.code, code));

      if (!row) return res.status(404).json({ error: "البطاقة غير موجودة" });

      const remainingUses = Math.max(0, row.maxUses - row.usedCount);
      res.json({
        ...row,
        remainingUses,
        appleWalletAvailable: isAppleWalletConfigured(),
        googleWalletAvailable: isGoogleWalletConfigured(),
      });
    } catch (error) {
      console.error("Error fetching loyalty card:", error);
      res.status(500).json({ error: "فشل في جلب البطاقة" });
    }
  });

  // =====================================================
  // POS: validate a loyalty code before applying (authenticated)
  // =====================================================
  app.post(
    "/api/loyalty/validate",
    isAuthenticated,
    requirePermission("event_pos", "create"),
    async (req, res) => {
      try {
        const { code, orderAmount, branchId } = req.body ?? {};
        if (!code || typeof code !== "string") {
          return res.status(400).json({ valid: false, error: "أدخل رمز البطاقة" });
        }

        const [row] = await db
          .select({
            memberId: loyaltyMembers.id,
            maxUses: loyaltyMembers.maxUses,
            usedCount: loyaltyMembers.usedCount,
            memberStatus: loyaltyMembers.status,
            customerName: loyaltyCustomers.name,
            customerPhone: loyaltyCustomers.phone,
            campaign: loyaltyCampaigns,
          })
          .from(loyaltyMembers)
          .innerJoin(loyaltyCustomers, eq(loyaltyCustomers.id, loyaltyMembers.customerId))
          .innerJoin(loyaltyCampaigns, eq(loyaltyCampaigns.id, loyaltyMembers.campaignId))
          .where(eq(loyaltyMembers.code, code.trim()));

        if (!row) return res.status(404).json({ valid: false, error: "رمز البطاقة غير صحيح" });

        const campaign = row.campaign;
        const availErr = campaignAvailabilityError(campaign);
        if (availErr) return res.status(400).json({ valid: false, error: availErr });

        if (row.memberStatus === "disabled") {
          return res.status(400).json({ valid: false, error: "البطاقة موقوفة" });
        }
        if (row.usedCount >= row.maxUses) {
          return res.status(400).json({ valid: false, error: "تم استنفاد عدد مرات الاستخدام" });
        }

        // Branch restriction — enforced unconditionally (defense in depth).
        // Redemption re-checks this server-side, but the preview must not be
        // bypassable by omitting branchId.
        if (campaign.applicableBranches && campaign.applicableBranches.length > 0) {
          if (!branchId || !campaign.applicableBranches.includes(branchId)) {
            return res.status(400).json({ valid: false, error: "البطاقة غير صالحة في هذا الفرع" });
          }
        }

        const amount = Number(orderAmount) || 0;
        if (campaign.minimumOrder && amount > 0 && amount < parseFloat(campaign.minimumOrder)) {
          return res
            .status(400)
            .json({ valid: false, error: `الحد الأدنى للطلب ${campaign.minimumOrder} ر.س` });
        }

        let discountAmount = 0;
        if (campaign.discountType === "percentage") {
          discountAmount = (amount * parseFloat(campaign.discountValue)) / 100;
          if (campaign.maximumDiscount && discountAmount > parseFloat(campaign.maximumDiscount)) {
            discountAmount = parseFloat(campaign.maximumDiscount);
          }
        } else if (campaign.discountType === "gift") {
          // Gift campaigns carry no monetary discount; the reward is the gift itself
          discountAmount = 0;
        } else {
          discountAmount = parseFloat(campaign.discountValue);
        }

        res.json({
          valid: true,
          member: {
            memberId: row.memberId,
            code: code.trim(),
            customerName: row.customerName,
            customerPhone: row.customerPhone,
            discountType: campaign.discountType,
            discountValue: parseFloat(campaign.discountValue),
            discountAmount: Math.round(discountAmount * 100) / 100,
            remainingUses: row.maxUses - row.usedCount,
          },
        });
      } catch (error) {
        console.error("Error validating loyalty code:", error);
        res.status(500).json({ valid: false, error: "فشل في التحقق من البطاقة" });
      }
    }
  );
}

// =====================================================
// Shared helper: atomically record a loyalty redemption within a POS sale
// transaction. Re-validates server-side (never trusts client) and increments
// the member's usedCount, auto-expiring the card when the limit is reached.
// Throws an Error (Arabic message) if the code cannot be redeemed.
// =====================================================
export async function redeemLoyaltyInTx(
  tx: any,
  params: {
    memberId: number;
    posSaleId: number;
    branchId: string;
    orderAmount: number;
    redeemedBy: string;
  }
): Promise<void> {
  // Lock the member row to prevent concurrent over-use
  const [member] = await tx
    .select()
    .from(loyaltyMembers)
    .where(eq(loyaltyMembers.id, params.memberId))
    .for("update");

  if (!member) throw new Error("بطاقة الولاء غير موجودة");
  if (member.status === "disabled") throw new Error("بطاقة الولاء موقوفة");
  if (member.usedCount >= member.maxUses) throw new Error("تم استنفاد عدد مرات استخدام البطاقة");

  const [campaign] = await tx
    .select()
    .from(loyaltyCampaigns)
    .where(eq(loyaltyCampaigns.id, member.campaignId));
  if (!campaign) throw new Error("حملة الولاء غير موجودة");
  const availErr = campaignAvailabilityError(campaign);
  if (availErr) throw new Error(availErr);

  if (
    campaign.applicableBranches &&
    campaign.applicableBranches.length > 0 &&
    !campaign.applicableBranches.includes(params.branchId)
  ) {
    throw new Error("بطاقة الولاء غير صالحة في هذا الفرع");
  }

  const amount = Number(params.orderAmount) || 0;
  if (campaign.minimumOrder && amount > 0 && amount < parseFloat(campaign.minimumOrder)) {
    throw new Error(`الحد الأدنى للطلب لاستخدام البطاقة ${campaign.minimumOrder} ر.س`);
  }

  let discountAmount = 0;
  if (campaign.discountType === "percentage") {
    discountAmount = (amount * parseFloat(campaign.discountValue)) / 100;
    if (campaign.maximumDiscount && discountAmount > parseFloat(campaign.maximumDiscount)) {
      discountAmount = parseFloat(campaign.maximumDiscount);
    }
  } else if (campaign.discountType === "gift") {
    // Gift campaigns carry no monetary discount; the reward is the gift itself
    discountAmount = 0;
  } else {
    discountAmount = parseFloat(campaign.discountValue);
  }

  const newUsedCount = member.usedCount + 1;
  await tx
    .update(loyaltyMembers)
    .set({
      usedCount: newUsedCount,
      status: newUsedCount >= member.maxUses ? "exhausted" : member.status,
    })
    .where(eq(loyaltyMembers.id, member.id));

  await tx.insert(loyaltyRedemptions).values({
    memberId: member.id,
    campaignId: member.campaignId,
    posSaleId: params.posSaleId,
    branchId: params.branchId,
    orderAmount: String(Math.round(amount * 100) / 100),
    discountAmount: String(Math.round(discountAmount * 100) / 100),
    redeemedBy: params.redeemedBy,
  });
}
