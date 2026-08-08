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
): Promise<void> {
  if (
    typeof sub.endpoint !== "string" ||
    !/^https:\/\//.test(sub.endpoint) ||
    sub.endpoint.length > 2000 ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string"
  ) {
    throw new Error("Invalid push subscription");
  }
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
}

// الحذف مقيَّد بمالك الجلسة — لا يمكن لمستخدم إلغاء اشتراك جهاز مستخدم آخر
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

// تحديد المستخدمين المستهدفين بنفس منطق getActiveNotificationsForUser
// الفرع: يُطابق فرع المستخدم الأساسي أو أي فرع لديه وصول له (user_branch_access)
async function resolveTargetUserIds(n: SystemNotification): Promise<string[]> {
  const targetUserIds = (n as any).targetUserIds as string[] | null | undefined;
  if (targetUserIds && targetUserIds.length > 0) return targetUserIds;

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
  return rows.map((r) => r.id);
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
    url: "/",
    tag: `sysnotif-${n.id}`,
  });

  await Promise.allSettled(
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
        }
      }
    })
  );
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

// يُستدعى بعد إنشاء إشعار نظام (fire-and-forget)
export async function sendPushForSystemNotification(n: SystemNotification): Promise<void> {
  try {
    if (!n.isActive) return;
    // المجدولة لوقت لاحق يتكفل بها المسح الدوري عند حلول موعدها
    if (n.startDate && new Date(n.startDate).getTime() > Date.now() + 60_000) return;
    if (!(await claimForPush(n.id))) return;
    await deliverPush(n);
  } catch (e) {
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
        await deliverPush(n).catch((e) => console.error("[push] sweep deliver failed:", e?.message || e));
      }
    }
  } catch (e) {
    console.error("[push] sweep failed:", (e as any)?.message || e);
  }
}
