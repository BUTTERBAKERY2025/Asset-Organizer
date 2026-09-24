import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../client/public/sw.js", import.meta.url),
  "utf8",
);

function loadWorker() {
  const listeners = new Map<string, (event: any) => void>();
  const clients = {
    matchAll: vi.fn(),
    openWindow: vi.fn(),
  };
  const context = vm.createContext({
    AbortController,
    Promise,
    Response,
    Set,
    URL,
    clearTimeout,
    console,
    fetch: vi.fn(),
    setTimeout,
    clients,
    caches: {
      keys: vi.fn(async () => []),
      delete: vi.fn(),
      match: vi.fn(),
      open: vi.fn(async () => ({
        addAll: vi.fn(),
        keys: vi.fn(async () => []),
        match: vi.fn(),
        put: vi.fn(),
      })),
    },
    self: {
      location: { origin: "https://app.example" },
      navigator: { setAppBadge: vi.fn(), clearAppBadge: vi.fn() },
      registration: { showNotification: vi.fn() },
      clients,
      skipWaiting: vi.fn(),
      addEventListener: (name: string, handler: (event: any) => void) => {
        listeners.set(name, handler);
      },
    },
  });
  vm.runInContext(source, context);
  return { clients, context, listeners };
}

describe("service worker notification safety", () => {
  it("shows push and refreshes the authenticated recipient badge without caching", async () => {
    const { context, listeners } = loadWorker();
    context.fetch.mockResolvedValue({ ok: true, json: async () => ({ userId: "alice", count: 4 }) });
    let done: Promise<unknown> | undefined;
    listeners.get("push")!({
      data: { json: () => ({ title: "تنبيه", userId: "alice", url: "/my-portal" }) },
      waitUntil: (promise: Promise<unknown>) => { done = promise; },
    });
    await done;
    expect(context.self.registration.showNotification).toHaveBeenCalledTimes(1);
    expect(context.fetch).toHaveBeenCalledWith("/api/push/unread-badge", { credentials: "include", cache: "no-store" });
    expect(context.self.navigator.setAppBadge).toHaveBeenCalledWith(4);
  });

  it("clears at zero, but never applies another account's count", async () => {
    const { context, listeners } = loadWorker();
    let done: Promise<unknown> | undefined;
    context.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ userId: "alice", count: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: "bob", count: 20 }) });
    for (const _ of [1, 2]) {
      listeners.get("push")!({ data: { json: () => ({ userId: "alice" }) }, waitUntil: (p: Promise<unknown>) => { done = p; } });
      await done;
    }
    expect(context.self.navigator.clearAppBadge).toHaveBeenCalledTimes(1);
    expect(context.self.navigator.setAppBadge).not.toHaveBeenCalled();
    expect(context.self.registration.showNotification).toHaveBeenCalledTimes(2);
  });

  it.each(["denied", "offline", "expired", "unsupported"])("keeps notification delivery on %s", async (condition) => {
    const { context, listeners } = loadWorker();
    if (condition === "unsupported") context.self.navigator = {};
    if (condition === "denied") context.self.navigator.setAppBadge.mockRejectedValue(new Error("denied"));
    if (condition === "offline") context.fetch.mockRejectedValue(new Error("offline"));
    else context.fetch.mockResolvedValue({ ok: condition !== "expired", status: 401, json: async () => ({ userId: "alice", count: 8 }) });
    let done: Promise<unknown> | undefined;
    listeners.get("push")!({ data: { json: () => ({ userId: "alice" }) }, waitUntil: (p: Promise<unknown>) => { done = p; } });
    await expect(done).resolves.toBeDefined();
    expect(context.self.registration.showNotification).toHaveBeenCalledTimes(1);
    if (condition === "expired" || condition === "offline") expect(context.self.navigator.setAppBadge).not.toHaveBeenCalled();
  });

  it.each([
    ["https://app.example/my/notifications?id=7#latest", "/my/notifications?id=7#latest"],
    ["/my/notifications?id=7", "/my/notifications?id=7"],
    ["https://evil.example/my/notifications", "/"],
    ["//evil.example/my/notifications", "/"],
    ["javascript:alert(1)", "/"],
    ["/\\evil.example", "/"],
    ["https://app.example@evil.example/", "/"],
  ])("normalizes notification destination %s", (input, expected) => {
    const { context } = loadWorker();
    expect(vm.runInContext(`safeNotificationDestination(${JSON.stringify(input)})`, context))
      .toBe(expected);
  });
  it("renders branded push with readable fallback when payload is missing or malformed", async () => {
    const { context, listeners } = loadWorker();
    for (const payload of [undefined, { json: () => { throw new Error("bad JSON"); } }, { json: () => null }]) {
      let completion: Promise<unknown> | undefined;
      listeners.get("push")!({
        data: payload,
        waitUntil: (promise: Promise<unknown>) => { completion = promise; },
      });
      await completion;
    }
    expect(context.self.registration.showNotification).toHaveBeenCalledTimes(3);
    expect(context.self.registration.showNotification).toHaveBeenCalledWith(
      "إشعار جديد من BUTTER BAKERY",
      expect.objectContaining({
        body: "لديك تحديث جديد. افتح التطبيق للاطلاع عليه.",
        icon: "/butter-bakery-logo.png",
        badge: "/push-badge.svg",
        data: { url: "/" },
      }),
    );
  });
  it("does not navigate to an external URL even if notification data was tampered with", async () => {
    const { clients, listeners } = loadWorker();
    clients.matchAll.mockResolvedValue([]);
    clients.openWindow.mockResolvedValue(undefined);
    let completion: Promise<unknown> | undefined;
    listeners.get("notificationclick")!({
      notification: { close: vi.fn(), data: { url: "https://evil.example/phish" } },
      waitUntil: (promise: Promise<unknown>) => { completion = promise; },
    });
    await completion;
    expect(clients.openWindow).toHaveBeenCalledWith("https://app.example/");
  });

  it("focuses only an existing exact destination without navigating another tab", async () => {
    const { clients, listeners } = loadWorker();
    const unrelated = {
      url: "https://app.example/unsaved-form",
      focus: vi.fn(),
      navigate: vi.fn(),
    };
    const exact = {
      url: "https://app.example/my/notifications?id=7",
      focus: vi.fn(async () => exact),
      navigate: vi.fn(),
    };
    clients.matchAll.mockResolvedValue([unrelated, exact]);
    let completion: Promise<unknown> | undefined;

    listeners.get("notificationclick")!({
      notification: {
        close: vi.fn(),
        data: { url: "https://app.example/my/notifications?id=7" },
      },
      waitUntil: (promise: Promise<unknown>) => { completion = promise; },
    });
    await completion;

    expect(exact.focus).toHaveBeenCalledOnce();
    expect(exact.navigate).not.toHaveBeenCalled();
    expect(unrelated.navigate).not.toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new exact destination instead of navigating an unrelated tab", async () => {
    const { clients, listeners } = loadWorker();
    const unrelated = {
      url: "https://app.example/unsaved-form",
      focus: vi.fn(),
      navigate: vi.fn(),
    };
    clients.matchAll.mockResolvedValue([unrelated]);
    clients.openWindow.mockResolvedValue(undefined);
    let completion: Promise<unknown> | undefined;

    listeners.get("notificationclick")!({
      notification: {
        close: vi.fn(),
        data: { url: "/my/notifications?id=8" },
      },
      waitUntil: (promise: Promise<unknown>) => { completion = promise; },
    });
    await completion;

    expect(unrelated.navigate).not.toHaveBeenCalled();
    expect(unrelated.focus).not.toHaveBeenCalled();
    expect(clients.openWindow).toHaveBeenCalledWith(
      "https://app.example/my/notifications?id=8",
    );
  });

  it.each([
    "/api/push/vapid-public-key",
    "/api/notifications",
    "/api/system-notifications/my-reads",
    "/api/my/notifications",
    "/api/warehouse/notifications/unread-count",
  ])("leaves notification API %s network-only", (url) => {
    const { listeners } = loadWorker();
    const respondWith = vi.fn();

    listeners.get("fetch")!({
      request: {
        method: "GET",
        mode: "cors",
        url: `https://app.example${url}`,
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it("preserves JS network-error and navigation refresh protections", () => {
    expect(source).toContain("const timeoutId = setTimeout(() => controller.abort(), 10000)");
    expect(source).toContain("return Response.error()");
    expect(source).toMatch(/event\.waitUntil\(\s*caches\.open\(STATIC_CACHE\).*c\.put\('\/'/s);
  });
});