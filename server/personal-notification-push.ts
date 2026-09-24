import webpush from "web-push";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  notifications,
  personalNotificationPushDeliveries as receipts,
  personalNotificationPushOutbox as outbox,
  pushSubscriptions,
  users,
} from "@shared/schema";
import { getVapidPublicKey } from "./push-service";
import { isKnownPushProviderEndpoint } from "./push-endpoint-security";

const MAX_ATTEMPTS = 5;
const LEASE_MS = 10 * 60_000;
export const personalPushPayload = (id: number) => JSON.stringify({
  // Do not put notification titles/messages or HR links on a locked screen.
  title: "إشعار جديد",
  body: "لديك إشعار جديد. افتح بوابتك للاطلاع عليه.",
  url: "/my-portal",
  tag: `personal-notification-${id}`,
});

export function personalPushDue(
  n: { scheduledFor: Date | null; expiresAt: Date | null },
  now: Date,
): "due" | "scheduled" | "expired" {
  if (n.expiresAt && n.expiresAt <= now) return "expired";
  if (n.scheduledFor && n.scheduledFor > now) return "scheduled";
  return "due";
}

export function eligiblePersonalDevices<T extends { id: number; endpoint: string }>(
  subscriptions: T[],
  previous: { subscriptionId: number; status: string; attempts: number }[],
): T[] {
  const receiptsById = new Map(previous.map((r) => [r.subscriptionId, r]));
  return subscriptions.filter((s) => {
    const r = receiptsById.get(s.id);
    return (!r || (r.status !== "delivered" && r.attempts < MAX_ATTEMPTS)) && isKnownPushProviderEndpoint(s.endpoint);
  });
}

export async function deliverPersonalPushBatch<T extends { id: number; endpoint: string }>(
  notificationId: number,
  subscriptions: T[],
  previous: { subscriptionId: number; status: string; attempts: number }[],
  actions: {
    authorized: (device: T) => Promise<boolean>;
    send: (device: T, payload: string) => Promise<unknown>;
    receipt: (device: T, status: "delivered" | "pending", attempts: number, error?: unknown) => Promise<void>;
    revoke: (device: T) => Promise<void>;
  },
): Promise<void> {
  const byDevice = new Map(previous.map((r) => [r.subscriptionId, r]));
  const pending = eligiblePersonalDevices(subscriptions, previous);
  const results = await Promise.allSettled(pending.map(async (device) => {
    if (!await actions.authorized(device)) return;
    const attempts = (byDevice.get(device.id)?.attempts ?? 0) + 1;
    try {
      await actions.send(device, personalPushPayload(notificationId));
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await actions.revoke(device);
        return;
      }
      await actions.receipt(device, "pending", attempts, error);
      throw error;
    }
    // Provider acceptance cannot be atomic with the receipt write; receipt
    // failures must remain retryable, not silently masquerade as success.
    await actions.receipt(device, "delivered", attempts);
  }));
  if (results.some((result) => result.status === "rejected")) throw new Error("personal push provider failed");
}

async function claim(id: number, now: Date): Promise<Date | null> {
  const [row] = await db.update(outbox).set({ claimedAt: now })
    .where(and(
      eq(outbox.notificationId, id),
      isNull(outbox.deliveredAt), isNull(outbox.failedAt),
      sql`${outbox.attemptCount} < ${MAX_ATTEMPTS}`,
      or(isNull(outbox.claimedAt), lte(outbox.claimedAt, new Date(now.getTime() - LEASE_MS))),
      or(isNull(outbox.nextRetryAt), lte(outbox.nextRetryAt, now)),
      sql`EXISTS (SELECT 1 FROM notifications n WHERE n.id = ${outbox.notificationId}
        AND (n.scheduled_for IS NULL OR n.scheduled_for <= ${now})
        AND (n.expires_at IS NULL OR n.expires_at > ${now}))`,
    )).returning({ claimedAt: outbox.claimedAt });
  return row?.claimedAt ?? null;
}

async function finish(id: number, lease: Date, error?: unknown): Promise<void> {
  if (!error) {
    await db.update(outbox).set({ deliveredAt: new Date(), claimedAt: null, lastError: null })
      .where(and(eq(outbox.notificationId, id), eq(outbox.claimedAt, lease)));
    return;
  }
  const [current] = await db.select({ attempts: outbox.attemptCount })
    .from(outbox).where(and(eq(outbox.notificationId, id), eq(outbox.claimedAt, lease))).limit(1);
  if (!current) return;
  const attempts = current.attempts + 1;
  await db.update(outbox).set({
    claimedAt: null,
    attemptCount: attempts,
    nextRetryAt: attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + Math.min(60, 2 ** (attempts - 1)) * 60_000),
    failedAt: attempts >= MAX_ATTEMPTS ? new Date() : null,
    lastError: String(error instanceof Error ? error.message : error).slice(0, 500),
  }).where(and(eq(outbox.notificationId, id), eq(outbox.claimedAt, lease)));
}

async function record(id: number, subscriptionId: number, status: "delivered" | "pending", attempts: number, error?: unknown) {
  await db.insert(receipts).values({
    notificationId: id,
    subscriptionId,
    status,
    attempts,
    lastError: error ? `push provider HTTP ${Number((error as any)?.statusCode) || "unavailable"}` : null,
    deliveredAt: status === "delivered" ? new Date() : null,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [receipts.notificationId, receipts.subscriptionId],
    set: {
      status,
      attempts,
      lastError: error ? `push provider HTTP ${Number((error as any)?.statusCode) || "unavailable"}` : null,
      deliveredAt: status === "delivered" ? new Date() : null,
      updatedAt: new Date(),
    },
  });
}

async function dispatch(id: number, userId: string) {
  const now = new Date();
  const [n] = await db.select({ userId: notifications.userId, scheduledFor: notifications.scheduledFor, expiresAt: notifications.expiresAt })
    .from(notifications).where(eq(notifications.id, id)).limit(1);
  if (!n || n.userId !== userId || personalPushDue(n, now) === "expired") return;
  if (personalPushDue(n, now) !== "due") throw new Error("notification rescheduled");
  const [active] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, "active"))).limit(1);
  if (!active) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (!subs.length) return;
  const previous = await db.select().from(receipts).where(eq(receipts.notificationId, id));
  const pending = eligiblePersonalDevices(subs, previous);
  if (!pending.length) return;
  await getVapidPublicKey(); // shared persisted VAPID identity, never generate a second key
  await deliverPersonalPushBatch(id, subs, previous, {
    authorized: async () => {
      // Check expiry, exact recipient and active status again after VAPID setup.
      const [fresh] = await db.select({ expiresAt: notifications.expiresAt, scheduledFor: notifications.scheduledFor, userId: notifications.userId })
        .from(notifications).where(eq(notifications.id, id)).limit(1);
      const [stillActive] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.id, userId), eq(users.isActive, "active"))).limit(1);
      return !!stillActive && !!fresh && fresh.userId === userId && personalPushDue(fresh, new Date()) === "due";
    },
    send: (s, payload) => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload, { timeout: 30_000, TTL: 300 },
    ),
    receipt: (s, status, attempts, error) => record(id, s.id, status, attempts, error),
    revoke: async (s) => {
      await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, s.id), eq(pushSubscriptions.userId, userId)));
    },
  });
}

/** Called by the existing scheduler; INSERT trigger captures all direct writers. */
export async function sweepPersonalNotificationPush(): Promise<void> {
  try {
    const now = new Date();
    const candidates = await db.select({
      id: outbox.notificationId, userId: outbox.userId,
      claimedAt: outbox.claimedAt,
      scheduledFor: notifications.scheduledFor, expiresAt: notifications.expiresAt,
    }).from(outbox).innerJoin(notifications, eq(notifications.id, outbox.notificationId))
      .where(and(
        isNull(outbox.deliveredAt), isNull(outbox.failedAt),
        sql`${outbox.attemptCount} < ${MAX_ATTEMPTS}`,
        or(isNull(outbox.claimedAt), lte(outbox.claimedAt, new Date(now.getTime() - LEASE_MS))),
        or(isNull(outbox.nextRetryAt), lte(outbox.nextRetryAt, now)),
        or(isNull(notifications.scheduledFor), lte(notifications.scheduledFor, now)),
      )).orderBy(outbox.notificationId).limit(100);
    for (const row of candidates) {
      if (personalPushDue(row, new Date()) === "expired") {
        await db.update(outbox).set({ failedAt: new Date(), lastError: "notification expired" })
          .where(and(
            eq(outbox.notificationId, row.id),
            row.claimedAt ? eq(outbox.claimedAt, row.claimedAt) : isNull(outbox.claimedAt),
            isNull(outbox.deliveredAt),
            isNull(outbox.failedAt),
          ));
        continue;
      }
      const lease = await claim(row.id, new Date());
      if (!lease) continue;
      try {
        await dispatch(row.id, row.userId);
        await finish(row.id, lease);
      } catch (error) {
        await finish(row.id, lease, error);
        console.error("[personal-push] delivery failed:", error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.error("[personal-push] sweep failed:", error instanceof Error ? error.message : error);
  }
}