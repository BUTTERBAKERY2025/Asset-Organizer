let currentBadgeUser: string | null = null;
let generation = 0;
const ownerKey = "app-badge-owner";

async function setBadge(count: number): Promise<void> {
  try {
    if (count === 0 && typeof navigator.clearAppBadge === "function") {
      await navigator.clearAppBadge();
    } else if (count > 0 && typeof navigator.setAppBadge === "function") {
      await navigator.setAppBadge(count);
    }
  } catch {
    // Badging is optional and may be disabled by the OS.
  }
}

export function setBadgeAccount(userId: string | null): void {
  if (currentBadgeUser === userId) return;
  let previousOwner = currentBadgeUser;
  try {
    previousOwner ||= localStorage.getItem(ownerKey);
    if (userId) localStorage.setItem(ownerKey, userId);
    else localStorage.removeItem(ownerKey);
  } catch {
    // Storage may be disabled; rely on this page's account identity instead.
  }
  currentBadgeUser = userId;
  generation++;
  // A shared device must not continue showing the previous account's count.
  // Do not clear merely because the same account reopened the app offline.
  if (previousOwner && previousOwner !== userId) void setBadge(0);
}

export async function syncAppBadge(): Promise<void> {
  if (!currentBadgeUser) return;
  const userId = currentBadgeUser;
  const request = ++generation;
  try {
    const response = await fetch("/api/push/unread-badge", {
      credentials: "include",
      cache: "no-store",
    });
    if (request !== generation || currentBadgeUser !== userId) return;
    if (response.status === 401 || response.status === 403) {
      await setBadge(0);
      return;
    }
    if (!response.ok) return;
    const state = await response.json();
    if (request === generation && currentBadgeUser === userId
      && state.userId === userId && Number.isSafeInteger(state.count) && state.count >= 0) {
      await setBadge(state.count);
    }
  } catch {
    // Offline: do not replace an accurate last-known count with a guess.
  }
}