import { afterEach, describe, expect, it, vi } from "vitest";
import { enablePushNotifications } from "../client/src/lib/push-notifications";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function environment(ready: Promise<unknown>, permission = "granted") {
  vi.stubGlobal("window", { PushManager: class {}, Notification: {} });
  vi.stubGlobal("navigator", { serviceWorker: { ready } });
  const requestPermission = vi.fn(async () => permission);
  vi.stubGlobal("Notification", { requestPermission });
  vi.stubGlobal("fetch", vi.fn());
  return requestPermission;
}

describe("explicit mobile push activation", () => {
  it("reports a worker failure instead of leaving the activation button pending forever", async () => {
    vi.useFakeTimers();
    environment(new Promise(() => {}));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = enablePushNotifications();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBe("error");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("honors denied permission without attempting a subscription", async () => {
    const permission = environment(new Promise(() => {}), "denied");
    expect(await enablePushNotifications()).toBe("denied");
    expect(permission).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("saves an existing device subscription using the existing endpoint", async () => {
    const subscription = { endpoint: "https://example.test/push" };
    environment(Promise.resolve({
      pushManager: { getSubscription: async () => ({ toJSON: () => subscription }) },
    }));
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    expect(await enablePushNotifications()).toBe("enabled");
    expect(fetch).toHaveBeenCalledWith("/api/push/subscribe", expect.objectContaining({
      method: "POST", credentials: "include", body: JSON.stringify({ subscription }),
    }));
  });
  it("does not report enabled when subscription registration fails", async () => {
    environment(Promise.resolve({
      pushManager: { getSubscription: async () => ({ toJSON: () => ({}) }) },
    }));
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    expect(await enablePushNotifications()).toBe("error");
  });
});