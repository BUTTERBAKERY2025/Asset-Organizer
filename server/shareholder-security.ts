// ======================================================================
// بوابة المساهمين — المرحلة 5
// أدوات الأمان: رموز التحقق بخطوتين (OTP) + تسجيل نشاط المساهم
// لا يعتمد هذا الملف على auth.ts أو shareholder-portal-routes.ts لتفادي
// الاستيراد الدائري — يعتمد فقط على db والمخطط.
// ======================================================================
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  shareholders,
  shareholderPortalSettings,
  shareholderOtpCodes,
  shareholderActivityLog,
  notificationQueue,
} from "@shared/schema";

const OTP_TTL_MS = 5 * 60 * 1000; // صلاحية الرمز: 5 دقائق
const MAX_ATTEMPTS = 5; // أقصى عدد محاولات خاطئة على نفس الرمز
const MAX_SENDS = 4; // أقصى عدد مرات إرسال خلال عمر التحدي
const RESEND_COOLDOWN_MS = 45 * 1000; // فترة الانتظار بين كل إرسال وآخر

function hashCode(code: string, userId: string): string {
  return crypto.createHash("sha256").update(`${code}:${userId}`).digest("hex");
}

function genCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\s+/g, "");
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}`;
}

export interface TwoFactorConfig {
  required: boolean;
  channel: string; // whatsapp | sms | both
  enableWhatsapp: boolean;
}

export async function getTwoFactorConfig(): Promise<TwoFactorConfig> {
  try {
    const [s] = await db
      .select()
      .from(shareholderPortalSettings)
      .where(eq(shareholderPortalSettings.id, 1))
      .limit(1);
    return {
      required: !!s?.requireTwoFactor,
      channel: s?.twoFactorChannel || "whatsapp",
      enableWhatsapp: s?.enableWhatsapp ?? true,
    };
  } catch {
    return { required: false, channel: "whatsapp", enableWhatsapp: true };
  }
}

async function enqueueOtpMessage(phone: string, name: string | null, code: string, cfg: TwoFactorConfig) {
  const message =
    `رمز الدخول لبوابة المساهمين: ${code}\n` +
    `صالح لمدة 5 دقائق. لا تشارك هذا الرمز مع أي شخص.`;
  // both → whatsapp + sms ؛ غير ذلك → القناة المحددة (مع احترام تعطيل واتساب)
  let channels: string[];
  if (cfg.channel === "both") channels = ["whatsapp", "sms"];
  else channels = [cfg.channel];
  if (!cfg.enableWhatsapp) channels = channels.filter((c) => c !== "whatsapp");
  if (channels.length === 0) channels = ["sms"]; // ضمان إرسال رمز على الأقل
  const rows = channels.map((channel) => ({
    recipientPhone: phone,
    recipientName: name,
    channel,
    message,
    relatedModule: "shareholder_otp",
  }));
  await db.insert(notificationQueue).values(rows);
}

export type IssueOtpResult =
  | { ok: true; phone: string; channel: string }
  | { ok: false; error: "no_phone" | "too_many_sends" | "cooldown" | "send_failed"; retryAfter?: number };

/**
 * يُنشئ رمز تحقق جديد لمستخدم مساهم ويرسله عبر قائمة الإشعارات.
 * عند resend=true يُطبّق ضوابط التكرار (مهلة + حد أقصى للإرسال).
 */
export async function issueOtpForUser(
  userId: string,
  opts?: { resend?: boolean }
): Promise<IssueOtpResult> {
  // اعثر على ملف المساهم المرتبط بهذا المستخدم للحصول على الجوال
  const [sh] = await db
    .select({ id: shareholders.id, phone: shareholders.phone, fullName: shareholders.fullName })
    .from(shareholders)
    .where(eq(shareholders.linkedUserId, userId))
    .limit(1);
  if (!sh || !sh.phone) return { ok: false, error: "no_phone" };

  const cfg = await getTwoFactorConfig();

  const [existing] = await db
    .select()
    .from(shareholderOtpCodes)
    .where(eq(shareholderOtpCodes.userId, userId))
    .limit(1);

  if (opts?.resend && existing) {
    if (existing.sendCount >= MAX_SENDS) return { ok: false, error: "too_many_sends" };
    const sinceLast = Date.now() - new Date(existing.lastSentAt).getTime();
    if (sinceLast < RESEND_COOLDOWN_MS) {
      return { ok: false, error: "cooldown", retryAfter: Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000) };
    }
  }

  const code = genCode();
  const codeHash = hashCode(code, userId);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const now = new Date();

  try {
    if (existing) {
      await db
        .update(shareholderOtpCodes)
        .set({
          codeHash,
          channel: cfg.channel === "both" ? "both" : cfg.channel,
          phone: sh.phone,
          attempts: 0,
          consumedAt: null,
          expiresAt,
          lastSentAt: now,
          sendCount: opts?.resend ? existing.sendCount + 1 : 1,
        })
        .where(eq(shareholderOtpCodes.id, existing.id));
    } else {
      await db.insert(shareholderOtpCodes).values({
        userId,
        codeHash,
        channel: cfg.channel === "both" ? "both" : cfg.channel,
        phone: sh.phone,
        expiresAt,
        lastSentAt: now,
      });
    }
    await enqueueOtpMessage(sh.phone, sh.fullName, code, cfg);
    return { ok: true, phone: maskPhone(sh.phone), channel: cfg.channel };
  } catch (e) {
    console.error("issueOtpForUser failed:", e);
    return { ok: false, error: "send_failed" };
  }
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: "no_challenge" | "expired" | "too_many_attempts" | "invalid" };

/**
 * يتحقق من رمز المستخدم مقابل التحدي المخزَّن (مقارنة بزمن ثابت)،
 * ويزيد عداد المحاولات عند الخطأ، ويعلّمه مُستهلَكاً عند النجاح.
 */
export async function verifyOtpForUser(userId: string, code: string): Promise<VerifyOtpResult> {
  const [row] = await db
    .select()
    .from(shareholderOtpCodes)
    .where(eq(shareholderOtpCodes.userId, userId))
    .limit(1);
  if (!row || row.consumedAt) return { ok: false, error: "no_challenge" };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false, error: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

  const actual = hashCode(String(code || ""), userId);
  let match = false;
  try {
    match =
      actual.length === row.codeHash.length &&
      crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(row.codeHash));
  } catch {
    match = false;
  }

  if (!match) {
    await db
      .update(shareholderOtpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(shareholderOtpCodes.id, row.id));
    return { ok: false, error: "invalid" };
  }

  await db
    .update(shareholderOtpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(shareholderOtpCodes.id, row.id));
  return { ok: true };
}

/**
 * يسجّل نشاطاً للمساهم بأسلوب "أفضل جهد" (لا يُفشل الطلب الأساسي أبداً).
 * يقبل shareholderId مباشرة، أو userId ليستنتج المساهم المرتبط.
 */
export async function logShareholderActivity(params: {
  shareholderId?: number;
  userId?: string | null;
  action: string;
  description?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    let shareholderId = params.shareholderId;
    if (!shareholderId && params.userId) {
      const [sh] = await db
        .select({ id: shareholders.id })
        .from(shareholders)
        .where(eq(shareholders.linkedUserId, params.userId))
        .limit(1);
      shareholderId = sh?.id;
    }
    if (!shareholderId) return; // لا يمكن نسب النشاط لأي مساهم → تجاهل بصمت
    await db.insert(shareholderActivityLog).values({
      shareholderId,
      userId: params.userId ?? null,
      action: params.action,
      description: params.description ?? null,
      metadata: (params.metadata ?? null) as any,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (e) {
    console.error("logShareholderActivity failed:", e);
  }
}
