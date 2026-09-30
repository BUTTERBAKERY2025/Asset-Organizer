import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { isAuthoritativeAuthReady } from "./auth-readiness";
import { assertOwnerAccessGeneration, getOwnerAccessGeneration, ownerAccessRevoked, ownerGet, restoreOwnerAccess, revokeOwnerAccess, OwnerAccessError } from "../hooks/use-owner-portal";

afterEach(() => { restoreOwnerAccess(); queryClient.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function browser() {
  vi.stubGlobal("window", { location: { origin: "https://example.test", assign: vi.fn() },
    localStorage: { setItem: vi.fn() } });
}

describe("owner access revocation", () => {
  it("purges active AND inactive cached owner data on 403, leaves a denied UI state, and revalidates auth", () => {
    const activeKey = ["owner", "sales", "branch-a"];
    const inactiveKey = ["owner", "shareholders", 2];
    queryClient.setQueryData(activeKey, { sales: 124.5 });
    queryClient.setQueryData(inactiveKey, { name: "Private" });
    queryClient.setQueryData(["/api/auth/me"], { role: "business_owner" });
    const observer = new QueryObserver(queryClient, { queryKey: activeKey, queryFn: async () => ({ sales: 124.5 }), enabled: false });
    const unsubscribe = observer.subscribe(() => {});
    const refresh = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    revokeOwnerAccess(403);
    expect(ownerAccessRevoked()).toBe(true);
    expect(queryClient.getQueryData(activeKey)).toBeUndefined();
    expect(queryClient.getQueryData(inactiveKey)).toBeUndefined();
    expect(queryClient.getQueryData(["/api/auth/me"])).toBeNull();
    expect(refresh).toHaveBeenCalledWith({ queryKey: ["/api/auth/me"], refetchType: "all" });
    unsubscribe();
  });

  it("keeps cached identity behind the gate until /me was freshly resolved", () => {
    const auth = { fetchedAfterMount: true, fetching: false, error: false, role: "business_owner", hasUser: true, legacyLoading: false };
    expect(isAuthoritativeAuthReady({ ...auth, fetchedAfterMount: false })).toBe(false);
    expect(isAuthoritativeAuthReady({ ...auth, fetching: true })).toBe(false);
    expect(isAuthoritativeAuthReady({ ...auth, error: true })).toBe(false);
    expect(isAuthoritativeAuthReady(auth)).toBe(true);
    expect(isAuthoritativeAuthReady({ ...auth, role: "employee", legacyLoading: true })).toBe(false);
    expect(isAuthoritativeAuthReady({ ...auth, role: "employee" })).toBe(true);
  });

  it("rejects a response delivered after revocation, even after an explicit restore", async () => {
    browser();
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const old = getOwnerAccessGeneration();
    const request = ownerGet("/api/owner/branches");
    revokeOwnerAccess(403);
    restoreOwnerAccess();
    pending.resolve({ ok: true, status: 200, json: async () => ({ secret: true }) } as Response);
    await expect(request).rejects.toBeInstanceOf(OwnerAccessError);
    expect(() => assertOwnerAccessGeneration(old)).toThrow(OwnerAccessError);
    expect(ownerAccessRevoked()).toBe(false);
    expect(queryClient.getQueryData(["owner", "branches"])).toBeUndefined();
  });

  it("rejects decoded data when revocation happens while response.json is pending", async () => {
    browser();
    const decoded = deferred<{ secret: boolean }>();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: () => decoded.promise })));
    const request = ownerGet("/api/owner/assets");
    await Promise.resolve();
    revokeOwnerAccess(403);
    restoreOwnerAccess();
    decoded.resolve({ secret: true });
    await expect(request).rejects.toBeInstanceOf(OwnerAccessError);
  });

  it("fails closed for requests made during revocation and permits only new-generation requests after restore", async () => {
    browser();
    const fetcher = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => ({ safe: true }) }));
    vi.stubGlobal("fetch", fetcher);
    revokeOwnerAccess(403);
    await expect(ownerGet("/api/owner/branches")).rejects.toBeInstanceOf(OwnerAccessError);
    expect(fetcher.mock.calls.every(call => call[0] !== "/api/owner/branches")).toBe(true);
    restoreOwnerAccess();
    await expect(ownerGet("/api/owner/branches")).resolves.toEqual({ safe: true });
  });

  it("accepts cross-window invalidation without disclosing data or restoring from another tab", async () => {
    const events = new EventTarget();
    const setItem = vi.fn();
    const channels: Array<{ onmessage?: () => void; postMessage: ReturnType<typeof vi.fn> }> = [];
    class FakeChannel {
      onmessage?: () => void;
      postMessage = vi.fn();
      constructor() { channels.push(this); }
    }
    vi.stubGlobal("window", { location: { origin: "https://example.test" }, localStorage: { setItem },
      addEventListener: events.addEventListener.bind(events) });
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    vi.resetModules();
    const access = await import("../hooks/use-owner-portal");
    access.revokeOwnerAccess(403);
    expect(channels[0].postMessage).toHaveBeenCalledWith("revoked");
    expect(setItem.mock.calls[0][0]).toBe("owner-access-revoked");
    expect(setItem.mock.calls[0][1]).not.toContain("secret");
    access.restoreOwnerAccess();
    channels[0].onmessage?.();
    expect(access.ownerAccessRevoked()).toBe(true);
    expect(channels[0].postMessage).toHaveBeenCalledTimes(1);
    access.restoreOwnerAccess();
    const event = new Event("storage");
    Object.defineProperties(event, { key: { value: "owner-access-revoked" }, newValue: { value: "1" } });
    events.dispatchEvent(event);
    expect(access.ownerAccessRevoked()).toBe(true);
    expect(channels[0].postMessage).toHaveBeenCalledTimes(1);
  });
});