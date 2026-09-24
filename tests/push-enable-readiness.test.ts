import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disablePushNotifications,
  detachPushSubscriptionFromCurrentUser,
  enablePushNotifications,
  reinitializePushNotifications,
  resumePushSubscriptionSync,
  syncPushSubscription,
} from "../client/src/lib/push-notifications";

afterEach(() => {
  resumePushSubscriptionSync();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function environment(ready: Promise<unknown>, permission = "granted") {
  vi.stubGlobal("window", { PushManager: class {}, Notification: {} });
  vi.stubGlobal("navigator", { serviceWorker: { ready } });
  const requestPermission = vi.fn(async () => permission);
  vi.stubGlobal("Notification", { permission, requestPermission });
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
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ publicKey: "AQ" }) } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    expect(await enablePushNotifications()).toBe("enabled");
    expect(fetch).toHaveBeenCalledWith("/api/push/subscribe", expect.objectContaining({
      method: "POST", credentials: "include", body: JSON.stringify({ subscription }),
    }));
  });
  it("does not report enabled when subscription registration fails", async () => {
    environment(Promise.resolve({
      pushManager: { getSubscription: async () => ({ toJSON: () => ({}) }) },
    }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ publicKey: "AQ" }) } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        clone: () => ({ json: async () => ({ code: "push_storage_unavailable" }) }),
      } as unknown as Response);
    expect(await enablePushNotifications()).toBe("server-error");
  });
  it("surfaces an endpoint ownership conflict instead of blaming the network", async () => {
    const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/device", toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/device" }) };
    environment(Promise.resolve({ pushManager: { getSubscription: async () => subscription } }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ publicKey: "AQ" }) } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        clone: () => ({ json: async () => ({ code: "endpoint_owned_by_another_user" }) }),
      } as unknown as Response);
    expect(await enablePushNotifications()).toBe("ownership-conflict");
  });
  it("does not revoke a shared-device endpoint owned by another account", async () => {
    const unsubscribe = vi.fn(async () => true);
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/prior-account",
      toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/prior-account" }),
      unsubscribe,
    };
    environment(Promise.resolve({ pushManager: { getSubscription: async () => subscription } }));
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      clone: () => ({ json: async () => ({ code: "endpoint_owned_by_another_user" }) }),
    } as unknown as Response);

    expect(await reinitializePushNotifications()).toBe("ownership-conflict");
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalledWith("/api/push/unsubscribe", expect.anything());
  });
  it("never requests permission during silent subscription sync", async () => {
    const requestPermission = environment(Promise.resolve({
      pushManager: { getSubscription: async () => null },
    }), "default");
    expect(await syncPushSubscription()).toBe("none");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("silently restores a missing subscription after permission was previously granted", async () => {
    const subscription = {
      endpoint: "https://push.example/restored",
      toJSON: () => ({ endpoint: "https://push.example/restored" }),
      unsubscribe: vi.fn(async () => true),
    };
    const subscribe = vi.fn(async () => subscription);
    const requestPermission = environment(Promise.resolve({
      pushManager: { getSubscription: async () => null, subscribe },
    }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ publicKey: "AQ" }) } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    expect(await syncPushSubscription()).toBe("enabled");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenLastCalledWith("/api/push/subscribe", expect.objectContaining({
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    }));
  });
  it("coalesces overlapping automatic sync attempts", async () => {
    let resolveSave!: (response: Response) => void;
    const subscription = {
      endpoint: "https://push.example/device",
      toJSON: () => ({ endpoint: "https://push.example/device" }),
    };
    environment(Promise.resolve({ pushManager: { getSubscription: async () => subscription } }));
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>((resolve) => {
      resolveSave = resolve;
    }));

    const first = syncPushSubscription();
    const second = syncPushSubscription();
    expect(first).toBe(second);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    resolveSave({ ok: true } as Response);
    expect(await first).toBe("enabled");
    expect(await second).toBe("enabled");
  });
  it("disables only the current browser endpoint", async () => {
    const unsubscribe = vi.fn(async () => true);
    environment(Promise.resolve({
      pushManager: {
        getSubscription: async () => ({
          endpoint: "https://push.example/device",
          unsubscribe,
        }),
      },
    }));
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    expect(await disablePushNotifications()).toBe("disabled");
    expect(fetch).toHaveBeenCalledWith("/api/push/unsubscribe", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ endpoint: "https://push.example/device" }),
    }));
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("revokes the browser endpoint and aborts an in-flight sync before logout", async () => {
    const unsubscribe = vi.fn(async () => true);
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/device",
      toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/device" }),
      unsubscribe,
    };
    const registration = { pushManager: { getSubscription: async () => subscription } };
    environment(Promise.resolve(registration));
    Object.assign(navigator.serviceWorker, { getRegistration: async () => registration });
    let syncSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === "/api/push/subscribe") {
        syncSignal = init?.signal || undefined;
        return new Promise<Response>((_resolve, reject) => {
          syncSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      return { ok: true } as Response;
    });

    const syncing = syncPushSubscription();
    await vi.waitFor(() => expect(syncSignal).toBeDefined());
    await detachPushSubscriptionFromCurrentUser();

    expect(syncSignal?.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(await syncing).toBe("none");
    expect(await syncPushSubscription()).toBe("none");
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/push/subscribe")).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/api/push/unsubscribe", expect.objectContaining({
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }));
  });

  it("aborts bounded server cleanup instead of leaving a request for a later session", async () => {
    vi.useFakeTimers();
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/device",
      unsubscribe: vi.fn(async () => true),
    };
    const registration = { pushManager: { getSubscription: async () => subscription } };
    environment(Promise.resolve(registration));
    Object.assign(navigator.serviceWorker, { getRegistration: async () => registration });
    let cleanupSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      cleanupSignal = init?.signal || undefined;
      return new Promise<Response>((_resolve, reject) => {
        cleanupSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });

    const cleanup = detachPushSubscriptionFromCurrentUser();
    await vi.advanceTimersByTimeAsync(750);
    await cleanup;
    expect(cleanupSignal?.aborted).toBe(true);
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });
});