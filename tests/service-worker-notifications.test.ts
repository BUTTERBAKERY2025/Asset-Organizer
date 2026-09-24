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
  it.each([
    ["https://app.example/my/notifications?id=7#latest", "/my/notifications?id=7#latest"],
    ["/my/notifications?id=7", "/my/notifications?id=7"],
    ["https://evil.example/my/notifications", "/"],
    ["//evil.example/my/notifications", "/"],
    ["javascript:alert(1)", "/"],
  ])("normalizes notification destination %s", (input, expected) => {
    const { context } = loadWorker();
    expect(vm.runInContext(`safeNotificationDestination(${JSON.stringify(input)})`, context))
      .toBe(expected);
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