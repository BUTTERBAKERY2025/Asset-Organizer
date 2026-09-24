import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setBadgeAccount, syncAppBadge } from "../client/src/lib/app-badge";

describe("foreground app badge", () => {
  const setAppBadge = vi.fn();
  const clearAppBadge = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("navigator", { setAppBadge, clearAppBadge });
    vi.stubGlobal("fetch", vi.fn());
    setBadgeAccount(null);
    setAppBadge.mockClear();
    clearAppBadge.mockClear();
  });
  afterEach(() => {
    setBadgeAccount(null);
    vi.unstubAllGlobals();
  });

  it("uses authenticated fresh unread count, and clears only on zero/read", async () => {
    setBadgeAccount("alice");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ userId: "alice", count: 3 }),
    } as Response).mockResolvedValueOnce({
      ok: true, json: async () => ({ userId: "alice", count: 0 }),
    } as Response);
    await syncAppBadge();
    expect(setAppBadge).toHaveBeenCalledWith(3);
    await syncAppBadge();
    expect(clearAppBadge).toHaveBeenCalledTimes(1); // read, not app launch
    expect(fetch).toHaveBeenCalledWith("/api/push/unread-badge", { credentials: "include", cache: "no-store" });
  });

  it("does not apply a prior account's in-flight response after switching", async () => {
    let resolve!: (response: Response) => void;
    const deferred = new Promise<Response>((done) => { resolve = done; });
    vi.mocked(fetch).mockReturnValueOnce(deferred);
    setBadgeAccount("alice");
    const pending = syncAppBadge();
    setBadgeAccount("bob");
    resolve({ ok: true, json: async () => ({ userId: "alice", count: 100 }) } as Response);
    await pending;
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it("keeps last count on network failure but clears on expired authentication", async () => {
    setBadgeAccount("alice");
    clearAppBadge.mockClear();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ status: 401, ok: false } as Response);
    await syncAppBadge();
    expect(clearAppBadge).not.toHaveBeenCalled();
    await syncAppBadge();
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it("ignores mismatched accounts and unsupported badging API", async () => {
    setBadgeAccount("alice");
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ userId: "bob", count: 99 }) } as Response);
    await syncAppBadge();
    expect(setAppBadge).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", {});
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ userId: "alice", count: 5 }) } as Response);
    await expect(syncAppBadge()).resolves.toBeUndefined();
  });
});