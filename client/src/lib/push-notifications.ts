// Web Push is always activated from an explicit user gesture. Existing
// subscriptions may be re-associated with the authenticated user silently.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type EnablePushResult = "enabled" | "denied" | "unsupported" | "not-installed" | "server-error" | "error";
export type DisablePushResult = "disabled" | "server-error" | "unsupported";
export type PushNotificationStatus =
  | "checking"
  | "enabled"
  | "disabled"
  | "denied"
  | "unsupported"
  | "not-installed"
  | "server-error";

let pushSessionGeneration = 0;
let logoutCleanupActive = false;
const activeSyncRequests = new Set<AbortController>();

export function resumePushSubscriptionSync(): void {
  pushSessionGeneration += 1;
  logoutCleanupActive = false;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined"
    && typeof navigator !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

// iOS/iPadOS Web Push only works when launched as an installed PWA.
export function iosNeedsInstall(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

async function readyPushWorker(): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("تعذر تجهيز إشعارات الجهاز؛ أعد المحاولة بعد تحديث الصفحة.")), 10_000);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function postSubscription(path: string, sub: PushSubscription, signal?: AbortSignal): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ subscription: sub.toJSON() }),
    signal,
  });
}

export async function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  if (iosNeedsInstall()) return "not-installed";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "disabled";
  try {
    const sub = await (await readyPushWorker()).pushManager.getSubscription();
    if (!sub) return "disabled";
    const response = await postSubscription("/api/push/status", sub);
    if (!response.ok) return "server-error";
    const data = await response.json();
    return data?.subscribed === true ? "enabled" : "disabled";
  } catch (error) {
    console.error("[push] status failed:", error);
    return "server-error";
  }
}

export async function enablePushNotifications(): Promise<EnablePushResult> {
  if (iosNeedsInstall()) return "not-installed";
  if (!pushSupported()) return "unsupported";
  try {
    // This function must only be called directly from a click/tap handler.
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await readyPushWorker();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch("/api/push/vapid-public-key", { credentials: "include" });
      if (!res.ok) return "server-error";
      const { publicKey } = await res.json();
      if (typeof publicKey !== "string" || !publicKey) return "server-error";
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const save = await postSubscription("/api/push/subscribe", sub);
    return save.ok ? "enabled" : "server-error";
  } catch (error) {
    console.error("[push] enable failed:", error);
    return "error";
  }
}

// Re-associate only an already-existing browser subscription. This never asks
// for permission and never creates a subscription without a user gesture.
export async function syncPushSubscription(): Promise<"enabled" | "none" | "server-error"> {
  if (logoutCleanupActive || !pushSupported() || Notification.permission !== "granted") return "none";
  const generation = pushSessionGeneration;
  try {
    const sub = await (await readyPushWorker()).pushManager.getSubscription();
    if (!sub || logoutCleanupActive || generation !== pushSessionGeneration) return "none";
    const controller = new AbortController();
    activeSyncRequests.add(controller);
    if (logoutCleanupActive || generation !== pushSessionGeneration) {
      controller.abort();
      activeSyncRequests.delete(controller);
      return "none";
    }
    let response: Response;
    try {
      response = await postSubscription("/api/push/subscribe", sub, controller.signal);
    } finally {
      activeSyncRequests.delete(controller);
    }
    if (generation !== pushSessionGeneration) return "none";
    return response.ok ? "enabled" : "server-error";
  } catch (error) {
    if (logoutCleanupActive || generation !== pushSessionGeneration || (error as Error)?.name === "AbortError") return "none";
    console.error("[push] sync failed:", error);
    return "server-error";
  }
}

export async function disablePushNotifications(): Promise<DisablePushResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const sub = await (await readyPushWorker()).pushManager.getSubscription();
    if (!sub) return "disabled";
    const serverResponse = await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    const removedLocally = await sub.unsubscribe();
    return serverResponse.ok && removedLocally ? "disabled" : "server-error";
  } catch (error) {
    console.error("[push] disable failed:", error);
    return "server-error";
  }
}

// Logout permanently revokes this browser endpoint before the session changes.
// The server delete is abortable and endpoint+user scoped; no request is left
// running that could execute under a later account on a shared device.
export async function detachPushSubscriptionFromCurrentUser(): Promise<void> {
  logoutCleanupActive = true;
  pushSessionGeneration += 1;
  activeSyncRequests.forEach((controller) => controller.abort());
  activeSyncRequests.clear();
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const registration = await Promise.race([
      typeof navigator.serviceWorker.getRegistration === "function"
        ? navigator.serviceWorker.getRegistration()
        : navigator.serviceWorker.ready,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 500)),
    ]);
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return;

    // Start both privacy barriers immediately: provider revocation and the
    // user-scoped server delete. Only the fetch can carry session cookies, so
    // it is explicitly aborted before this bounded cleanup returns.
    const revoke = sub.unsubscribe().catch(() => false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 750);
    const serverCleanup = fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ endpoint: sub.endpoint }),
      signal: controller.signal,
    }).catch(() => undefined);
    try {
      await Promise.allSettled([
        serverCleanup,
        Promise.race([
          revoke,
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 750)),
        ]),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Logout remains available if the browser/provider is already unreachable.
  }
}

export async function sendTestPushToCurrentDevice(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const sub = await (await readyPushWorker()).pushManager.getSubscription();
    if (!sub) return false;
    const response = await fetch("/api/push/test-current-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    return response.ok;
  } catch {
    return false;
  }
}