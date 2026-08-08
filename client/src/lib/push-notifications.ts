// تفعيل إشعارات الجوال (Web Push) لهذا الجهاز
// يعمل على أندرويد وكروم/إيدج، وعلى آيفون iOS 16.4+ بشرط حفظ التطبيق على الشاشة الرئيسية

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// على الآيفون: الإشعارات تعمل فقط من داخل التطبيق المحفوظ على الشاشة الرئيسية
export function iosNeedsInstall(): boolean {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  return isIOS && !standalone;
}

export type EnablePushResult = "enabled" | "denied" | "unsupported" | "error";

export async function enablePushNotifications(): Promise<EnablePushResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch("/api/push/vapid-public-key", { credentials: "include" });
      if (!res.ok) return "error";
      const { publicKey } = await res.json();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const save = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return save.ok ? "enabled" : "error";
  } catch (e) {
    console.error("[push] enable failed:", e);
    return "error";
  }
}

// إعادة مزامنة صامتة عند فتح التطبيق (لو الإذن ممنوح مسبقاً نتأكد أن الاشتراك مسجَّل للمستخدم الحالي)
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } else {
      await enablePushNotifications();
    }
  } catch {
    /* صامت */
  }
}
