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
  pushSubscriptions,
  pushVapidConfig,
  systemNotifications,
  userBranchAccess,
  users,
  type SystemNotification,
} from "@shared/schema";
import { isKnownPushProviderEndpoint } from "./push-endpoint-security";

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
    typeof sub.keys?.auth !== "string"
  ) {
    throw new Error("Invalid push subscription");
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
      }),
      { TTL: 60, urgency: "normal" },
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
    if (n.accessModule === "central_kitchen_orders") {
      const { filterAuthorizedCentralKitchenNotificationUsers } = await import("./central-kitchen-notifications");
      return filterAuthorizedCentralKitchenNotificationUsers(db, n, targetUserIds);
    }
    return targetUserIds;
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
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(conds.length ? and(...conds) : undefined);
  const userIds = rows.map((r) => r.id);
  if (n.accessModule === "central_kitchen_orders") {
    const { filterAuthorizedCentralKitchenNotificationUsers } = await import("./central-kitchen-notifications");
    return filterAuthorizedCentralKitchenNotificationUsers(db, n, userIds);
  }
  return userIds;
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

  const payload = JSON.stringify({
    title: n.title || "إشعار جديد",
    body: (n.content || "").slice(0, 300),
    url: n.buttonAction || "/",
    tag: `sysnotif-${n.id}`,
  });

  const results = await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
      } catch (err: any) {
        // اشتراك منتهي/محذوف من الجهاز → نظّفه
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint)).catch(() => {});
          return;
        }
        // A transient provider/network failure must remain retryable. The
        // caller releases push_sent_at so the scheduled sweep can try again.
        throw err;
      }
    })
  );
  const transientFailure = results.find((result) => result.status === "rejected");
  // Release the notification-level claim only when no endpoint was delivered
  // (or permanently retired). Retrying after a partial success would duplicate
  // push on devices that already received it; per-user authorization is still
  // re-evaluated on the next wholly-unsent retry.
  if (
    transientFailure?.status === "rejected"
    && results.every((result) => result.status === "rejected")
  ) {
    throw transientFailure.reason;
  }
}

// «حجز» الإشعار للإرسال — UPDATE شرطي يمنع الإرسال المزدوج بين السيرفرات/المسارات
async function claimForPush(id: number): Promise<boolean> {
  const claimed = await db
    .update(systemNotifications)
    .set({ pushSentAt: new Date() })
    .where(and(eq(systemNotifications.id, id), isNull(systemNotifications.pushSentAt)))
    .returning({ id: systemNotifications.id });
  return claimed.length > 0;
}

async function releasePushClaim(id: number): Promise<void> {
  await db.update(systemNotifications)
    .set({ pushSentAt: null })
    .where(eq(systemNotifications.id, id));
}

// يُستدعى بعد إنشاء إشعار نظام (fire-and-forget)
export async function sendPushForSystemNotification(n: SystemNotification): Promise<void> {
  try {
    if (!n.isActive) return;
    // المجدولة لوقت لاحق يتكفل بها المسح الدوري عند حلول موعدها
    if (n.startDate && new Date(n.startDate).getTime() > Date.now() + 60_000) return;
    if (!(await claimForPush(n.id))) return;
    await deliverPush(n);
  } catch (e) {
    await releasePushClaim(n.id).catch(() => {});
    console.error("[push] send failed:", (e as any)?.message || e);
  }
}

// مسح دوري: إرسال Push للإشعارات المجدولة التي حان وقتها ولم تُرسل بعد
export async function sweepScheduledPush(): Promise<void> {
  try {
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const due = await db
      .select()
      .from(systemNotifications)
      .where(and(
        eq(systemNotifications.isActive, true),
        isNull(systemNotifications.pushSentAt),
        or(isNull(systemNotifications.startDate), lte(systemNotifications.startDate, now)),
        or(isNull(systemNotifications.endDate), gte(systemNotifications.endDate, now)),
        gte(systemNotifications.createdAt, weekAgo),
      ))
      .limit(20);
    for (const n of due) {
      if (await claimForPush(n.id)) {
        await deliverPush(n).catch(async (e) => {
          await releasePushClaim(n.id).catch(() => {});
          console.error("[push] sweep deliver failed:", e?.message || e);
        });
      }
    }
  } catch (e) {
    console.error("[push] sweep failed:", (e as any)?.message || e);
  }
}
