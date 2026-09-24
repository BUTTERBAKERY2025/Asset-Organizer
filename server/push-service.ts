// خدمة إشعارات الجوال (Web Push)
// - مفاتيح VAPID تُولَّد تلقائياً عند أول استخدام وتُخزَّن في قاعدة البيانات
//   (قفل استشاري يمنع توليد مفاتيح مكررة عند تشغيل أكثر من سيرفر، والجميع يقرأ أقدم صف)
// - عند إنشاء أي إشعار نظام يُرسَل Push لنفس المستهدفين بمنطق الاستهداف نفسه
//   (مستخدمون محددون، وإلا فرع + دور — ويشمل من لديه وصول للفرع عبر user_branch_access)
// - المجدولة مستقبلاً تُرسل عبر مسح دوري (sweepScheduledPush) مع منع الإرسال المزدوج push_sent_at
import webpush from "web-push";
import { db } from "./db";
import { sql, eq, inArray, and, or, lte, isNull, gte, asc } from "drizzle-orm";
import {
  pushNotificationDeliveries,
  pushSubscriptions,
  pushVapidConfig,
  systemNotifications,
  userBranchAccess,
  users,
  type SystemNotification,
} from "@shared/schema";
import { isKnownPushProviderEndpoint } from "./push-endpoint-security";
import { isWithinRiyadhDailyWindow, riyadhTimeShort } from "@shared/riyadh-time";

let vapidReady: Promise<string> | null = null;

// تحميل أو توليد مفاتيح VAPID (مرة واحدة لكل تشغيل، آمن ضد التزامن)
async function ensureVapid(): Promise<string> {
  if (!vapidReady) {
    vapidReady = (async () => {
      let [row] = await db.select().from(pushVapidConfig).orderBy(asc(pushVapidConfig.id)).limit(1);
      if (!row) {
        await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('push_vapid_config'))`);
          const existing = await tx.select().from(pushVapidConfig).orderBy(asc(pushVapidConfig.id)).limit(1);
          if (!existing.length) {
            const keys = webpush.generateVAPIDKeys();
            await tx.insert(pushVapidConfig).values({ publicKey: keys.publicKey, privateKey: keys.privateKey });
          }
        });
        // الجميع يقرأ الصف الأقدم — هوية VAPID واحدة لكل السيرفرات
        [row] = await db.select().from(pushVapidConfig).orderBy(asc(pushVapidConfig.id)).limit(1);
      }
      webpush.setVapidDetails("mailto:info@thebutterbakery.com", row.publicKey, row.privateKey);
      return row.publicKey;
    })().catch((e) => {
      vapidReady = null; // أعد المحاولة لاحقاً
      throw e;
    });
  }
  return vapidReady;
}

export async function getVapidPublicKey(): Promise<string> {
  return ensureVapid();
}

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<boolean> {
  if (
    typeof sub.endpoint !== "string" ||
    !/^https:\/\//.test(sub.endpoint) ||
    sub.endpoint.length > 2000 ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string" ||
    !isKnownPushProviderEndpoint(sub.endpoint)
  ) {
    throw new Error("Invalid push subscription endpoint");
  }
  const updated = await db
    .update(pushSubscriptions)
    .set({ p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .where(and(eq(pushSubscriptions.endpoint, sub.endpoint), eq(pushSubscriptions.userId, userId)))
    .returning({ id: pushSubscriptions.id });
  if (updated.length) return true;

  const inserted = await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoNothing({ target: pushSubscriptions.endpoint })
    .returning({ id: pushSubscriptions.id });
  // Never transfer an endpoint between accounts implicitly. A shared device
  // must revoke the old browser endpoint and create a new one after login.
  return inserted.length === 1;
}

// الحذف مقيَّد بمالك الجلسة — لا يمكن لمستخدم إلغاء اشتراك جهاز مستخدم آخر
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

export async function hasPushSubscription(userId: string, endpoint: string): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 2000) return false;
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .limit(1);
  return rows.length === 1;
}

// A deliberately narrow test path: the caller can only target an endpoint
// already owned by their authenticated account. Payload and destination are
// server-controlled, so this cannot become a broad-send or SSRF endpoint.
export async function sendTestPushToOwnedDevice(userId: string, endpoint: string): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 2000 || !isKnownPushProviderEndpoint(endpoint)) return false;
  await ensureVapid();
  const [sub] = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .limit(1);
  if (!sub) return false;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: "اختبار إشعارات BUTTER BAKERY",
        body: "هذا إشعار تجريبي لهذا الجهاز فقط.",
        url: "/",
        tag: `push-test-${userId}`,
        userId,
      }),
      { TTL: 60, urgency: "normal", timeout: 30_000 },
    );
    return true;
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await db.delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
        .catch(() => {});
      return false;
    }
    throw error;
  }
}

// تحديد المستخدمين المستهدفين بنفس منطق getActiveNotificationsForUser
// الفرع: يُطابق فرع المستخدم الأساسي أو أي فرع لديه وصول له (user_branch_access)
async function resolveTargetUserIds(n: SystemNotification): Promise<string[]> {
  const targetUserIds = (n as any).targetUserIds as string[] | null | undefined;
  if (targetUserIds && targetUserIds.length > 0) {
    const activeRows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, targetUserIds), eq(users.isActive, "active")));
    const activeIds = activeRows.map((row) => row.id);
    if (n.accessModule === "central_kitchen_orders") {
      const { filterAuthorizedCentralKitchenNotificationUsers } = await import("./central-kitchen-notifications");
      return filterAuthorizedCentralKitchenNotificationUsers(db, n, activeIds);
    }
    if (n.accessModule === "warehouse" && n.autoSource === "warehouse_material_transfer") {
      const { filterAuthorizedWarehouseTransferNotificationUsers } = await import("./warehouse-transfer-notifications");
      return filterAuthorizedWarehouseTransferNotificationUsers(db, n, activeIds);
    }
    return activeIds;
  }

  const conds = [];
  if (!n.targetAllBranches && n.targetBranchIds && n.targetBranchIds.length > 0) {
    const accessUsers = db
      .select({ uid: userBranchAccess.userId })
      .from(userBranchAccess)
      .where(inArray(userBranchAccess.branchId, n.targetBranchIds));
    conds.push(or(inArray(users.branchId, n.targetBranchIds), inArray(users.id, accessUsers)));
  }
  const roleIds = (n as any).targetRoleIds as string[] | null | undefined;
  if (roleIds && roleIds.length > 0) {
    conds.push(inArray(users.role, roleIds));
  }
  conds.push(eq(users.isActive, "active"));
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(conds.length ? and(...conds) : undefined);
  const userIds = rows.map((r) => r.id);
  if (n.accessModule === "central_kitchen_orders") {
    const { filterAuthorizedCentralKitchenNotificationUsers } = await import("./central-kitchen-notifications");
    return filterAuthorizedCentralKitchenNotificationUsers(db, n, userIds);
  }
  if (n.accessModule === "warehouse" && n.autoSource === "warehouse_material_transfer") {
    const { filterAuthorizedWarehouseTransferNotificationUsers } = await import("./warehouse-transfer-notifications");
    return filterAuthorizedWarehouseTransferNotificationUsers(db, n, userIds);
  }
  return userIds;
}

function providerErrorMessage(error: any): string {
  const status = Number(error?.statusCode);
  if (Number.isFinite(status)) return `push provider HTTP ${status}`;
  return String(error?.message || "push provider request failed").slice(0, 500);
}

async function recordDelivery(
  notificationId: number,
  subscriptionId: number,
  status: "delivered" | "pending",
  error?: unknown,
): Promise<void> {
  const deliveredAt = status === "delivered" ? new Date() : null;
  await db.insert(pushNotificationDeliveries).values({
    notificationId,
    subscriptionId,
    status,
    attempts: 1,
    lastError: error ? providerErrorMessage(error) : null,
    deliveredAt,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [pushNotificationDeliveries.notificationId, pushNotificationDeliveries.subscriptionId],
    set: {
      status,
      attempts: sql`${pushNotificationDeliveries.attempts} + 1`,
      lastError: error ? providerErrorMessage(error) : null,
      deliveredAt,
      updatedAt: new Date(),
    },
  });
}

async function deliverPush(n: SystemNotification): Promise<void> {
  await ensureVapid();
  const userIds = await resolveTargetUserIds(n);
  if (!userIds.length) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
  if (!subs.length) return;
  const receipts = await db
    .select({ subscriptionId: pushNotificationDeliveries.subscriptionId, status: pushNotificationDeliveries.status })
    .from(pushNotificationDeliveries)
    .where(eq(pushNotificationDeliveries.notificationId, n.id));
  const deliveredIds = new Set(receipts.filter((row) => row.status === "delivered").map((row) => row.subscriptionId));
  const pendingSubs = subs.filter((sub) => !deliveredIds.has(sub.id));
  if (!pendingSubs.length) return;

  const results = await Promise.allSettled(
    pendingSubs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: n.title || "إشعار جديد",
            body: (n.content || "").slice(0, 300),
            url: n.buttonAction || "/",
            tag: `sysnotif-${n.id}`,
            userId: s.userId,
          }),
          { timeout: 30_000 },
        );
        // Web Push has no provider idempotency key or acceptance lookup.
        // If the provider accepts and this DB write then fails, a later retry
        // can duplicate delivery. An outbox cannot atomically close that gap;
        // receipts minimize duplicates for every persisted acceptance.
        await recordDelivery(n.id, s.id, "delivered");
      } catch (err: any) {
        // اشتراك منتهي/محذوف من الجهاز → نظّفه
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint)).catch(() => {});
          return;
        }
        await recordDelivery(n.id, s.id, "pending", err).catch(() => {});
        throw err;
      }
    })
  );
  const transientFailure = results.find((result) => result.status === "rejected");
  if (transientFailure?.status === "rejected") {
    throw transientFailure.reason;
  }
}

const MAX_PUSH_ATTEMPTS = 5;

// A lease is separate from push_sent_at: a crash before provider completion
// becomes retryable after ten minutes rather than looking successfully sent.
async function claimForPush(id: number): Promise<Date | null> {
  const staleClaim = new Date(Date.now() - 10 * 60_000);
  const now = new Date();
  const claimed = await db
    .update(systemNotifications)
    .set({ pushClaimedAt: now })
    .where(and(
      eq(systemNotifications.id, id),
      isNull(systemNotifications.pushSentAt),
      isNull(systemNotifications.pushFailedAt),
      or(isNull(systemNotifications.pushClaimedAt), lte(systemNotifications.pushClaimedAt, staleClaim)),
      or(isNull(systemNotifications.pushNextRetryAt), lte(systemNotifications.pushNextRetryAt, now)),
      sql`${systemNotifications.pushAttemptCount} < ${MAX_PUSH_ATTEMPTS}`,
    ))
    .returning({ claimedAt: systemNotifications.pushClaimedAt });
  return claimed[0]?.claimedAt || null;
}

async function releasePushClaim(id: number, claimedAt: Date): Promise<void> {
  const [row] = await db.select({ attempts: systemNotifications.pushAttemptCount })
    .from(systemNotifications)
    .where(eq(systemNotifications.id, id))
    .limit(1);
  const attempts = (row?.attempts || 0) + 1;
  const exhausted = attempts >= MAX_PUSH_ATTEMPTS;
  const retryDelayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  await db.update(systemNotifications)
    .set({
      pushClaimedAt: null,
      pushAttemptCount: attempts,
      pushNextRetryAt: exhausted ? null : new Date(Date.now() + retryDelayMinutes * 60_000),
      // Keep push_sent_at truthful: exhaustion is a separate terminal state.
      // Device receipts retain the precise delivered/pending outcome.
      pushFailedAt: exhausted ? new Date() : null,
    })
    .where(and(eq(systemNotifications.id, id), eq(systemNotifications.pushClaimedAt, claimedAt)));
}

async function completePushClaim(id: number, claimedAt: Date): Promise<void> {
  await db.update(systemNotifications)
    .set({ pushSentAt: new Date(), pushClaimedAt: null, pushNextRetryAt: null, pushFailedAt: null })
    .where(and(eq(systemNotifications.id, id), eq(systemNotifications.pushClaimedAt, claimedAt)));
}

export function isPushVisibleNow(n: Pick<SystemNotification, "startDate" | "endDate" | "displayTimeStart" | "displayTimeEnd">, now = new Date()): boolean {
  if (n.startDate && new Date(n.startDate).getTime() > now.getTime()) return false;
  if (n.endDate && new Date(n.endDate).getTime() < now.getTime()) return false;
  return isWithinRiyadhDailyWindow(n.displayTimeStart, n.displayTimeEnd, now);
}

// يُستدعى بعد إنشاء إشعار نظام (fire-and-forget)
export async function sendPushForSystemNotification(n: SystemNotification): Promise<void> {
  let claimedAt: Date | null = null;
  try {
    if (!n.isActive) return;
    // The bell cannot show this row yet (or any more), so push must not either.
    if (!isPushVisibleNow(n)) return;
    claimedAt = await claimForPush(n.id);
    if (!claimedAt) return;
    await deliverPush(n);
    await completePushClaim(n.id, claimedAt);
  } catch (e) {
    if (claimedAt) await releasePushClaim(n.id, claimedAt).catch(() => {});
    console.error("[push] send failed:", (e as any)?.message || e);
  }
}

// مسح دوري: إرسال Push للإشعارات المجدولة التي حان وقتها ولم تُرسل بعد
export async function sweepScheduledPush(): Promise<void> {
  try {
    const now = new Date();
    const nowTime = riyadhTimeShort(now);
    const due = await db
      .select()
      .from(systemNotifications)
      .where(and(
        eq(systemNotifications.isActive, true),
        isNull(systemNotifications.pushSentAt),
        isNull(systemNotifications.pushFailedAt),
        or(isNull(systemNotifications.pushClaimedAt), lte(systemNotifications.pushClaimedAt, new Date(Date.now() - 10 * 60_000))),
        or(isNull(systemNotifications.pushNextRetryAt), lte(systemNotifications.pushNextRetryAt, now)),
        sql`${systemNotifications.pushAttemptCount} < ${MAX_PUSH_ATTEMPTS}`,
        or(isNull(systemNotifications.startDate), lte(systemNotifications.startDate, now)),
        or(isNull(systemNotifications.endDate), gte(systemNotifications.endDate, now)),
        // Keep this SQL prefilter equivalent to isWithinRiyadhDailyWindow: inclusive
        // daytime/overnight windows, open ends, and malformed HH:mm fail closed.
        sql`(${systemNotifications.displayTimeStart} IS NULL OR ${systemNotifications.displayTimeStart} ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$')`,
        sql`(${systemNotifications.displayTimeEnd} IS NULL OR ${systemNotifications.displayTimeEnd} ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$')`,
        sql`(
          (${systemNotifications.displayTimeStart} IS NULL AND (${systemNotifications.displayTimeEnd} IS NULL OR ${systemNotifications.displayTimeEnd} >= ${nowTime}))
          OR (${systemNotifications.displayTimeEnd} IS NULL AND ${systemNotifications.displayTimeStart} <= ${nowTime})
          OR (${systemNotifications.displayTimeStart} <= ${systemNotifications.displayTimeEnd}
            AND ${systemNotifications.displayTimeStart} <= ${nowTime}
            AND ${systemNotifications.displayTimeEnd} >= ${nowTime})
          OR (${systemNotifications.displayTimeStart} > ${systemNotifications.displayTimeEnd}
            AND (${systemNotifications.displayTimeStart} <= ${nowTime} OR ${systemNotifications.displayTimeEnd} >= ${nowTime}))
        )`,
      ))
      .orderBy(asc(systemNotifications.startDate), asc(systemNotifications.id))
      .limit(100);
    for (const n of due) {
      if (!isPushVisibleNow(n, now)) continue;
      const claimedAt = await claimForPush(n.id);
      if (claimedAt) {
        try {
          await deliverPush(n);
          await completePushClaim(n.id, claimedAt);
        } catch (e: any) {
          await releasePushClaim(n.id, claimedAt).catch(() => {});
          console.error("[push] sweep deliver failed:", e?.message || e);
        }
      }
    }
  } catch (e) {
    console.error("[push] sweep failed:", (e as any)?.message || e);
  }
}
