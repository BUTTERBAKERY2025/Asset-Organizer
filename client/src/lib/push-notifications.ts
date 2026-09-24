// The permission prompt is only opened from an explicit user gesture. After
// permission was granted, the browser subscription may be restored and
// associated with the authenticated user silently.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type EnablePushResult = "enabled" | "denied" | "unsupported" | "not-installed" | "ownership-conflict" | "session-expired" | "provider-unsupported" | "server-error" | "error";
export type DisablePushResult = "disabled" | "server-error" | "unsupported";
export type PushNotificationStatus =
  | "checking"
  | "enabled"
  | "disabled"
  | "denied"
  | "unsupported"
  | "not-installed"
  | "ownership-conflict"
  | "session-expired"
  | "provider-unsupported"
  | "server-error";

let pushSessionGeneration = 0;
let logoutCleanupActive = false;
const activeSyncRequests = new Set<AbortController>();
let activeSessionUserId: string | null = null;
let syncInFlight: Promise<PushSyncResult> | null = null;
let retryAfter = 0;
let retryFailures = 0;
let accountChangeRevocation: Promise<void> = Promise.resolve();

export type PushSyncResult = "enabled" | "none" | "ownership-conflict" | "session-expired" | "provider-unsupported" | "server-error";

function abortStalePushOperations(): void {
  pushSessionGeneration += 1;
  activeSyncRequests.forEach((controller) => controller.abort());
  activeSyncRequests.clear();
  syncInFlight = null;
  retryAfter = 0;
  retryFailures = 0;
}

export function resumePushSubscriptionSync(): void {
  abortStalePushOperations();
  logoutCleanupActive = false;
}

/** Prevents delayed browser work from one account crossing into another. */
export function setPushSubscriptionSession(userId: string | null): void {
  if (activeSessionUserId === userId) return;
  // A newly observed account must never inherit the previous browser endpoint.
  // Explicit login paths revoke before swapping cookies; this also covers
  // external session changes where that pre-login hook could not run.
  if (activeSessionUserId && userId && pushSupported()) {
    accountChangeRevocation = (async () => {
      const registration = await navigator.serviceWorker.getRegistration?.();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    })().catch((error) => console.error("[push] account change revocation failed:", error));
  }
  activeSessionUserId = userId;
  abortStalePushOperations();
  logoutCleanupActive = userId === null;
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

async function classifyResponse(response: Response): Promise<Exclude<EnablePushResult, "enabled" | "denied" | "unsupported" | "not-installed" | "error">> {
  if (response.status === 401 || response.status === 403) return "session-expired";
  let code = "";
  try {
    code = String((await response.clone().json())?.code || "");
  } catch {
    // A proxy may return HTML; the HTTP status still remains useful below.
  }
  if (response.status === 409 || code === "endpoint_owned_by_another_user") return "ownership-conflict";
  if (code === "unsupported_push_provider") return "provider-unsupported";
  return "server-error";
}

async function getServerPublicKey(): Promise<string | null> {
  const response = await fetch("/api/push/vapid-public-key", { credentials: "include" });
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data?.publicKey === "string" && data.publicKey ? data.publicKey : null;
}

async function subscribeWithServerKey(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  const publicKey = await getServerPublicKey();
  if (!publicKey) return null;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

function subscriptionUsesKey(sub: PushSubscription, publicKey: string): boolean {
  const actual = sub.options?.applicationServerKey;
  if (!actual) return true; // Older implementations do not expose the key.
  const expected = urlBase64ToUint8Array(publicKey);
  const bytes = new Uint8Array(actual);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

export async function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  if (iosNeedsInstall()) return "not-installed";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "disabled";
  try {
    await accountChangeRevocation;
    const sub = await (await readyPushWorker()).pushManager.getSubscription();
    if (!sub) return "disabled";
    const response = await postSubscription("/api/push/status", sub);
    if (!response.ok) return await classifyResponse(response);
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
    await accountChangeRevocation;
    // This function must only be called directly from a click/tap handler.
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await readyPushWorker();
    let sub = await reg.pushManager.getSubscription();
    const publicKey = await getServerPublicKey();
    if (!publicKey) return "server-error";
    // A deployment must keep one VAPID identity. If a legacy subscription was
    // nevertheless created with another key, the browser cannot repair it by
    // merely POSTing the old endpoint; revoke and create a compatible one.
    if (sub && !subscriptionUsesKey(sub, publicKey)) {
      if (!await sub.unsubscribe()) return "error";
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const save = await postSubscription("/api/push/subscribe", sub);
    if (save.ok) return "enabled";
    const failure = await classifyResponse(save);
    if (failure === "ownership-conflict") {
      // The browser cannot keep offering an endpoint owned by another user.
      // Revoke locally only; never delete the other account's server record.
      if (!await sub.unsubscribe()) console.error("[push] conflicting endpoint revocation failed");
    }
    // Keep an existing endpoint on transient failures so retry does not
    // produce a new device record; ownership conflicts must stay isolated.
    return failure;
  } catch (error) {
    console.error("[push] enable failed:", error);
    return "error";
  }
}

// Permission itself is never requested here. Once the user has already granted
// it, a missing provider subscription can be restored without another gesture.
async function performPushSubscriptionSync(): Promise<PushSyncResult> {
  if (logoutCleanupActive || !pushSupported() || Notification.permission !== "granted") return "none";
  if (Date.now() < retryAfter) return "server-error";
  const generation = pushSessionGeneration;
  try {
    await accountChangeRevocation;
    if (logoutCleanupActive || generation !== pushSessionGeneration) return "none";
    const registration = await readyPushWorker();
    let sub = await registration.pushManager.getSubscription();
    if (logoutCleanupActive || generation !== pushSessionGeneration) return "none";
    if (!sub) {
      sub = await subscribeWithServerKey(registration);
      if (!sub) return "server-error";
      if (logoutCleanupActive || generation !== pushSessionGeneration) {
        void sub.unsubscribe().catch(() => false);
        return "none";
      }
    }
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
    const result = response.ok ? "enabled" : await classifyResponse(response);
    if (result === "server-error") {
      retryAfter = Date.now() + Math.min(60_000, 1000 * 2 ** retryFailures++);
    } else {
      retryAfter = 0;
      retryFailures = 0;
    }
    return result;
  } catch (error) {
    if (logoutCleanupActive || generation !== pushSessionGeneration || (error as Error)?.name === "AbortError") return "none";
    console.error("[push] sync failed:", error);
    retryAfter = Date.now() + Math.min(60_000, 1000 * 2 ** retryFailures++);
    return "server-error";
  }
}

// Start, foreground, and reconnect events may race. They all share one attempt.
export function syncPushSubscription(): Promise<PushSyncResult> {
  if (syncInFlight) return syncInFlight;
  const attempt = performPushSubscriptionSync();
  syncInFlight = attempt;
  void attempt.finally(() => {
    if (syncInFlight === attempt) syncInFlight = null;
  });
  return attempt;
}

// Repairs a stale/conflicting browser endpoint without ever transferring or
// deleting an endpoint owned by another account. The server delete is scoped
// to the authenticated owner; provider unsubscribe then forces a fresh endpoint.
export async function reinitializePushNotifications(): Promise<EnablePushResult> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission !== "granted") return "denied";
  try {
    await accountChangeRevocation;
    const reg = await readyPushWorker();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // A browser endpoint on a shared device can still belong to the prior
      // account. Only the account that currently owns it may revoke it.
      const ownership = await postSubscription("/api/push/status", sub);
      if (!ownership.ok) return await classifyResponse(ownership);
      const ownershipData = await ownership.json();
      if (ownershipData?.subscribed === true) {
        const response = await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (!response.ok) return await classifyResponse(response);
      }
      // When this belongs to another account, only revoke the local provider
      // endpoint. Never delete or transfer the other user's server record.
      if (!await sub.unsubscribe()) return "error";
    }
    return enablePushNotifications();
  } catch (error) {
    console.error("[push] reinitialize failed:", error);
    return "error";
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
    // If server deletion failed, retain the local endpoint for a retry.
    if (!serverResponse.ok) return "server-error";
    return await sub.unsubscribe() ? "disabled" : "server-error";
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
  activeSessionUserId = null;
  abortStalePushOperations();
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const registration = await Promise.race([
      typeof navigator.serviceWorker.getRegistration === "function"
        ? navigator.serviceWorker.getRegistration()
        : navigator.serviceWorker.ready,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 500)),
    ]);
    const sub = await Promise.race([
      registration?.pushManager.getSubscription(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 500)),
    ]);
    if (!sub) return;

    // Start both privacy barriers immediately: provider revocation and the
    // user-scoped server delete. Only the fetch can carry session cookies, so
    // it is explicitly aborted before this bounded cleanup returns.
    const revoke = sub.unsubscribe().catch((error) => {
      console.error("[push] provider revocation failed:", error);
      return false;
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 750);
    const serverCleanup = fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ endpoint: sub.endpoint }),
      signal: controller.signal,
    }).then((response) => {
      if (!response.ok) console.error("[push] account endpoint cleanup failed:", response.status);
    }).catch((error) => {
      if (controller.signal.aborted) console.error("[push] account endpoint cleanup timed out");
      else console.error("[push] account endpoint cleanup failed:", error);
    });
    try {
      await Promise.allSettled([
        Promise.race([serverCleanup, new Promise((resolve) => setTimeout(resolve, 750))]),
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