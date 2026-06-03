// =====================================================
// Public wallet endpoints for loyalty cards.
// Apple .pkpass download + Google "Save to Wallet" link.
// Both return 503 when the provider is not configured so
// the web card keeps working without any credentials.
// =====================================================
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { loyaltyCampaigns, loyaltyCustomers, loyaltyMembers } from "@shared/schema";
import {
  isAppleWalletConfigured,
  isGoogleWalletConfigured,
  generateApplePass,
  buildGoogleSaveUrl,
  type WalletCardData,
} from "./wallet-service";

const CODE_RE = /^[A-Za-z0-9\-_]{3,50}$/;

// Per-IP rate limit shared by the wallet endpoints.
const RATE_LIMIT_WINDOW = 60 * 1000;
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

// Evict expired entries so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of Array.from(rateLimitMap.entries())) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

// Trusted public origin for absolute asset URLs embedded in signed
// wallet content. Derived from configured env only — never from request
// headers — to avoid host-header injection into signed passes.
function trustedLogoUrl(): string | undefined {
  const base = (
    process.env.WALLET_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    ""
  ).trim();
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}/butter-bakery-logo.png`;
}

function computeDiscountText(
  discountType: string,
  discountValue: string | null,
  description: string | null,
): string {
  if (discountType === "gift") return description || "هدية مجانية";
  if (discountType === "percentage") return `${Number(discountValue)}%`;
  return `${Number(discountValue).toLocaleString("en-US")} ر.س`;
}

async function loadCard(code: string): Promise<WalletCardData | null> {
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
      terms: loyaltyCampaigns.terms,
      validTo: loyaltyCampaigns.validTo,
    })
    .from(loyaltyMembers)
    .innerJoin(loyaltyCustomers, eq(loyaltyCustomers.id, loyaltyMembers.customerId))
    .innerJoin(loyaltyCampaigns, eq(loyaltyCampaigns.id, loyaltyMembers.campaignId))
    .where(eq(loyaltyMembers.code, code));

  if (!row) return null;

  const remainingUses = Math.max(0, row.maxUses - row.usedCount);
  return {
    code: row.code,
    customerName: row.customerName,
    campaignName: row.campaignName,
    discountText: computeDiscountText(row.discountType, row.discountValue, row.description),
    remainingUses,
    maxUses: row.maxUses,
    validTo: row.validTo,
    terms: row.terms,
  };
}

export function registerWalletRoutes(app: Express): void {
  // Apple Wallet — returns a signed .pkpass file
  app.get("/api/public/loyalty/card/:code/apple.pkpass", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "عدد الطلبات كثير جداً، حاول لاحقاً" });
      }
      if (!isAppleWalletConfigured()) {
        return res.status(503).json({ error: "محفظة آبل غير مفعّلة حالياً" });
      }
      const code = req.params.code;
      if (!code || !CODE_RE.test(code)) {
        return res.status(400).json({ error: "رمز غير صالح" });
      }

      const card = await loadCard(code);
      if (!card) return res.status(404).json({ error: "البطاقة غير موجودة" });

      const buffer = await generateApplePass(card);
      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="butter-${card.code}.pkpass"`,
      );
      res.setHeader("Cache-Control", "no-store");
      return res.send(buffer);
    } catch (error) {
      console.error("Error generating Apple Wallet pass:", error);
      return res.status(500).json({ error: "تعذّر إنشاء بطاقة آبل" });
    }
  });

  // Google Wallet — returns a Save-to-Google-Wallet link
  app.get("/api/public/loyalty/card/:code/google", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "عدد الطلبات كثير جداً، حاول لاحقاً" });
      }
      if (!isGoogleWalletConfigured()) {
        return res.status(503).json({ error: "محفظة جوجل غير مفعّلة حالياً" });
      }
      const code = req.params.code;
      if (!code || !CODE_RE.test(code)) {
        return res.status(400).json({ error: "رمز غير صالح" });
      }

      const card = await loadCard(code);
      if (!card) return res.status(404).json({ error: "البطاقة غير موجودة" });

      const saveUrl = buildGoogleSaveUrl(card, trustedLogoUrl());
      return res.json({ saveUrl });
    } catch (error) {
      console.error("Error generating Google Wallet link:", error);
      return res.status(500).json({ error: "تعذّر إنشاء رابط جوجل" });
    }
  });
}
