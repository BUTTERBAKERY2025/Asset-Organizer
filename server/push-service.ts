// خدمة إشعارات الجوال (Web Push)
// - مفاتيح VAPID تُولَّد تلقائياً عند أول استخدام وتُخزَّن في قاعدة البيانات
//   (تعمل في التطوير والإنتاج بدون أي إعداد يدوي أو متغيرات بيئة)
// - عند إنشاء أي إشعار نظام يُرسَل Push لنفس المستهدفين بمنطق الاستهداف نفسه
//   (مستخدمون محددون، وإلا فرع + دور)
import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, pushVapidConfig, users, type SystemNotification } from "@shared/schema";
import { eq, inArray, and, or, isNull } from "drizzle-orm";

let vapidReady: Promise<string> | null = null;

// تحميل أو توليد مفاتيح VAPID (مرة واحدة لكل تشغيل)
async function ensureVapid(): Promise<string> {
  if (!vapidReady) {
    vapidReady = (async () => {
      let [row] = await db.select().from(pushVapidConfig).limit(1);
      if (!row) {
        const keys = webpush.generateVAPIDKeys();
        try {
          [row] = await db
            .insert(pushVapidConfig)
            .values({ publicKey: keys.publicKey, privateKey: keys.privateKey })
            .returning();
        } catch {
          // سباق بين سيرفرين — اقرأ الموجود
          [row] = await db.select().from(pushVapidConfig).limit(1);
        }
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
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

// تحديد المستخدمين المستهدفين بنفس منطق getActiveNotificationsForUser
async function resolveTargetUserIds(n: SystemNotification): Promise<string[]> {
  const targetUserIds = (n as any).targetUserIds as string[] | null | undefined;
  if (targetUserIds && targetUserIds.length > 0) return targetUserIds;

  const conds = [];
  if (!n.targetAllBranches && n.targetBranchIds && n.targetBranchIds.length > 0) {
    conds.push(inArray(users.branchId, n.targetBranchIds));
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

// إرسال Push لإشعار نظام — يُستدعى بعد الإنشاء (fire-and-forget)
export async function sendPushForSystemNotification(n: SystemNotification): Promise<void> {
  try {
    if (!n.isActive) return;
    // لا نرسل الإشعارات المجدولة لوقت لاحق
    if (n.startDate && new Date(n.startDate).getTime() > Date.now() + 60_000) return;

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
  } catch (e) {
    console.error("[push] send failed:", (e as any)?.message || e);
  }
}
