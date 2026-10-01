import crypto from "crypto";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { jobOffers, onboardingNotifications, onboardingTokens } from "@shared/schema";
import { db } from "./db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Notification = typeof onboardingNotifications.$inferSelect;
type Offer = typeof jobOffers.$inferSelect;

export const BLOCKED_JOINING_REASON = "يوجد إشعار مباشرة مرتبط بهذا العرض خارج نطاق المباشرة الحالية؛ يرجى التنسيق مع شؤون الموظفين";

export function isUniqueConflict(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

// Shared by HR and operations creation. Take this before the offer row lock and
// hold it until commit: allocation and insert must be in the same transaction.
export async function lockOnboardingCreation(tx: Transaction): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(1869505102, 1)`);
}

export async function generateNotificationNumber(tx: Transaction): Promise<string> {
  const prefix = `ONB-${new Date().getFullYear()}-`;
  const [last] = await tx.select({
    n: sql<string>`coalesce(max(substring(${onboardingNotifications.notificationNumber} from '[0-9]+$')::bigint), 0)::text`,
  }).from(onboardingNotifications)
    .where(sql`${onboardingNotifications.notificationNumber} ~ ${"^" + prefix + "[0-9]+$"}`);
  return `${prefix}${String(BigInt(last?.n || "0") + BigInt(1)).padStart(4, "0")}`;
}

type PreparedSend =
  | { error: "NOT_FOUND" | "OUT_OF_SCOPE" | "COMPLETED" }
  | { notification: Notification; token: string; tokenReused: boolean };

// Sign locks notification -> token. Confirm/conversion lock notification ->
// offer. Send uses notification -> offer -> token, and checks only locked data.
export async function prepareOnboardingSend(
  id: number,
  replaceToken: boolean,
  authorize: (notification: Notification, offer: Offer) => boolean,
): Promise<PreparedSend> {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM onboarding_notifications WHERE id = ${id} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM job_offers WHERE id =
      (SELECT job_offer_id FROM onboarding_notifications WHERE id = ${id}) FOR UPDATE`);
    const [entry] = await tx.select({ notification: onboardingNotifications, offer: jobOffers })
      .from(onboardingNotifications).innerJoin(jobOffers, eq(onboardingNotifications.jobOfferId, jobOffers.id))
      .where(eq(onboardingNotifications.id, id)).limit(1);
    if (!entry) return { error: "NOT_FOUND" };
    const n = entry.notification;
    if (!authorize(n, entry.offer)) return { error: "OUT_OF_SCOPE" };
    if (!["pending", "sent"].includes(n.status) || entry.offer.hiredEmployeeId
        || n.convertedEmployeeId || n.convertedBranchEmployeeId)
      return { error: "COMPLETED" };

    const now = new Date();
    const [existing] = await tx.select().from(onboardingTokens).where(and(
      eq(onboardingTokens.notificationId, n.id),
      isNull(onboardingTokens.usedAt), isNull(onboardingTokens.revokedAt),
      gt(onboardingTokens.expiresAt, now),
    )).orderBy(desc(onboardingTokens.id)).limit(1);
    const tokenReused = !!existing && !replaceToken;
    const token = tokenReused ? existing.token : crypto.randomBytes(24).toString("base64url");
    const expiresAt = tokenReused ? existing.expiresAt : new Date(now.getTime() + n.validityDays * 86400000);
    if (!tokenReused) {
      await tx.update(onboardingTokens).set({ revokedAt: now }).where(and(
        eq(onboardingTokens.notificationId, n.id),
        isNull(onboardingTokens.usedAt), isNull(onboardingTokens.revokedAt),
      ));
      await tx.insert(onboardingTokens).values({ notificationId: n.id, token, expiresAt });
    }
    const [updated] = await tx.update(onboardingNotifications).set({
      status: "sent", sentAt: tokenReused ? n.sentAt || now : now, expiresAt, updatedAt: now,
    }).where(and(eq(onboardingNotifications.id, n.id), inArray(onboardingNotifications.status, ["pending", "sent"]))).returning();
    if (!updated) throw new Error("JOINING_SEND_STATE_CHANGED");
    return { notification: updated, token, tokenReused };
  });
}

// Sending is deliberately after commit. A provider exception must not hide a
// saved usable link behind a 500 or claim delivery succeeded.
export async function deliverOnboardingLink(
  configured: () => boolean,
  send: () => Promise<{ success: boolean; [key: string]: unknown }>,
) {
  try {
    if (!configured()) return { success: false, skipped: true, status: "skipped" };
    const result = await send();
    // Provider failure strings may include phone numbers or credentials.
    if (!result.success) return {
      success: false, skipped: false, status: "failed",
      error: "لم يُرسل واتساب؛ رابط المباشرة محفوظ ويمكن مشاركته يدوياً",
    };
    return { ...result, skipped: false, status: "sent" };
  } catch {
    return { success: false, skipped: false, status: "failed", error: "تعذر إرسال واتساب؛ رابط المباشرة محفوظ ويمكن مشاركته يدوياً" };
  }
}