import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createElement } from "react";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest, getQueryFn, portalQueryOptions, queryClient, resetAuthRequests,
} from "../client/src/lib/queryClient";
import {
  clearPersistentCache, getCachedData, setCachedData, shouldPersist, setCurrentUser,
} from "../client/src/lib/persistentCache";
import { useAuth } from "../client/src/hooks/useAuth";

vi.mock("../client/src/lib/push-notifications", () => ({
  detachPushSubscriptionFromCurrentUser: vi.fn(async () => {}),
  resumePushSubscriptionSync: vi.fn(),
}));
vi.mock("../client/src/lib/app-badge", () => ({
  setBadgeAccount: vi.fn(), syncAppBadge: vi.fn(async () => {}),
}));

const endpoints = ["documents", "salary", "payslips", "incentives"].map(name => `/api/my/${name}`);
const json = (data: unknown, headers?: Record<string, string>) =>
  new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", ...headers } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function read(url: string, signal = new AbortController().signal) {
  return getQueryFn({ on401: "throw" })({ queryKey: [url], signal } as any);
}

beforeEach(() => {
  resetAuthRequests();
  queryClient.clear();
  clearPersistentCache();
});
afterEach(() => {
  resetAuthRequests();
  queryClient.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("portal requests cannot outlive their authentication epoch", () => {
  it("deduplicates only within an epoch and rejects old responses even when fetch ignores abort", async () => {
    const old = deferred<Response>();
    const fetch = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue(json({ owner: "B" }));
    vi.stubGlobal("fetch", fetch);
    const first = read(endpoints[0]);
    const second = read(endpoints[0]);
    const rejected = Promise.all([
      expect(first).rejects.toMatchObject({ name: "AbortError" }),
      expect(second).rejects.toMatchObject({ name: "AbortError" }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const signal = fetch.mock.calls[0][1].signal;
    resetAuthRequests();
    expect(signal.aborted).toBe(true);
    expect(await read(endpoints[0])).toEqual({ owner: "B" });
    old.resolve(json({ owner: "A" }));
    await rejected;
    expect(await read(endpoints[0])).toEqual({ owner: "B" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"] as const)("old %s cleanup cannot delete the replacement entry", async outcome => {
    vi.useFakeTimers();
    const old = deferred<Response>();
    const replacement = deferred<Response>();
    const fetch = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => replacement.promise);
    vi.stubGlobal("fetch", fetch);
    const oldRead = read(endpoints[1]);
    const rejected = expect(oldRead).rejects.toBeInstanceOf(Error);
    resetAuthRequests();
    const next = read(endpoints[1]);
    if (outcome === "resolve") old.resolve(json({ owner: "A" }));
    else old.reject(new Error("old network failure"));
    await rejected;
    await vi.advanceTimersByTimeAsync(60);
    const shared = read(endpoints[1]);
    expect(fetch).toHaveBeenCalledTimes(2);
    replacement.resolve(json({ owner: "B" }));
    expect(await next).toEqual({ owner: "B" });
    expect(await shared).toEqual({ owner: "B" });
  });

  it("cancels one deduplicated consumer without poisoning another", async () => {
    const network = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => network.promise));
    const controller = new AbortController();
    const cancelled = read(endpoints[2], controller.signal);
    const other = read(endpoints[2]);
    const rejected = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    network.resolve(json({ owner: "A" }));
    expect(await other).toEqual({ owner: "A" });
  });

  it("does not retain completed no-store responses in the 50ms reuse window", async () => {
    const fetch = vi.fn(async () => json({ owner: "A" }, { "Cache-Control": "private, no-store" }));
    vi.stubGlobal("fetch", fetch);
    await read(endpoints[0]);
    await read(endpoints[0]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].cache).toBe("no-store");
  });

  it("rejects apiRequest JSON whose parsing finishes after logout", async () => {
    const body = deferred<unknown>();
    const response = json({});
    response.json = () => body.promise;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const res = await apiRequest("GET", endpoints[3]);
    const parsed = res.json();
    const rejected = expect(parsed).rejects.toMatchObject({ name: "AbortError" });
    resetAuthRequests();
    body.resolve({ owner: "A" });
    await rejected;
    await expect(res.json()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("revokes a late apiRequest response without relying on transport abort", async () => {
    const network = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => network.promise));
    const pending = apiRequest("GET", endpoints[0]);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    resetAuthRequests();
    network.resolve(json({ owner: "A" }));
    await rejected;
  });
});

describe("auth mutation wiring", () => {
  it.each(["login", "verifyOtp", "logout"] as const)("%s prevents an older /auth/me body from restoring A", async operation => {
    const rendererPackage = "react-test-renderer";
    const { act, create } = await import(rendererPackage);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    queryClient.setQueryData(["/api/auth/me"], { id: "A", role: "employee" });
    const oldBody = deferred<unknown>();
    let session: string | null = "A";
    const oldResponse = json({});
    oldResponse.json = () => oldBody.promise;
    let identityReads = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url === "/api/auth/me") {
        if (identityReads++ === 0) return oldResponse;
        return session ? json({ id: session, role: "employee" }) : new Response("", { status: 401 });
      }
      session = operation === "logout" ? null : "B";
      return json(session ? { id: session, role: "employee" } : { success: true });
    });
    vi.stubGlobal("fetch", fetch);
    let auth!: ReturnType<typeof useAuth>;
    function Harness() { auth = useAuth(true); return null; }
    let root: any;
    await act(async () => {
      root = create(createElement(QueryClientProvider, { client: queryClient }, createElement(Harness)));
    });
    expect(fetch).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await act(async () => {
      if (operation === "login") await auth.login({ username: "B", password: "test-only" });
      else if (operation === "verifyOtp") await auth.verifyOtp({ code: "123456" });
      else await auth.logout();
    });
    await act(async () => { oldBody.resolve({ id: "A", role: "employee" }); });
    expect(queryClient.getQueryData<any>(["/api/auth/me"])?.id).not.toBe("A");
    if (operation !== "logout") expect(queryClient.getQueryData<any>(["/api/auth/me"])?.id).toBe("B");
    await act(async () => { root.unmount(); });
  });
});

describe("private portal query identity and invalidations", () => {
  it.each(endpoints)("never uses previous-account placeholder data for %s", async endpoint => {
    const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
    const a = portalQueryOptions(endpoint, "A");
    client.setQueryData(a.queryKey, { owner: "A" });
    const network = deferred<{ owner: string }>();
    const fetch = vi.fn(() => network.promise);
    const observer = new QueryObserver(client, { ...a, queryFn: fetch });
    const stop = observer.subscribe(() => {});
    observer.setOptions({ ...portalQueryOptions(endpoint, "B"), queryFn: fetch });
    expect(observer.getCurrentResult().data).toBeUndefined();
    network.resolve({ owner: "B" });
    await observer.refetch();
    expect(observer.getCurrentResult().data).toEqual({ owner: "B" });
    expect(fetch).toHaveBeenCalledTimes(2); // one mount fetch per identity, not a render loop
    const before = fetch.mock.calls.length;
    for (let i = 0; i < 10; i++) observer.getCurrentResult();
    expect(fetch).toHaveBeenCalledTimes(before);
    await client.invalidateQueries({ queryKey: [endpoint] });
    expect(fetch).toHaveBeenCalledTimes(before + 1);
    stop();
    client.clear();
  });

  it("observed identity changes remove only portal caches, not public/admin queries", () => {
    queryClient.setQueryData(["/api/auth/me"], { id: "A" });
    for (const endpoint of endpoints) queryClient.setQueryData(portalQueryOptions(endpoint, "A").queryKey, { owner: "A" });
    queryClient.setQueryData(["/api/branches"], ["public"]);
    queryClient.setQueryData(["/api/users"], ["admin"]);
    queryClient.setQueryData(["/api/auth/me"], { id: "B" });
    for (const endpoint of endpoints) expect(queryClient.getQueryData(portalQueryOptions(endpoint, "A").queryKey)).toBeUndefined();
    expect(queryClient.getQueryData(["/api/branches"])).toEqual(["public"]);
    expect(queryClient.getQueryData(["/api/users"])).toEqual(["admin"]);
    queryClient.setQueryData(portalQueryOptions(endpoints[0], "B").queryKey, { owner: "B" });
    queryClient.setQueryData(["/api/auth/me"], { id: "B", updatedAt: "new" });
    expect(queryClient.getQueryData(portalQueryOptions(endpoints[0], "B").queryKey)).toEqual({ owner: "B" });
  });

  it("page scopes profile/config and all four tabs, while auth transitions revoke requests", () => {
    const page = readFileSync(new URL("../client/src/pages/my-portal.tsx", import.meta.url), "utf8");
    for (const endpoint of [...endpoints, "/api/my/profile", "/api/my/portal-config"]) {
      expect(page).toContain(`...portalQueryOptions("${endpoint}", portalUserId)`);
    }
    const auth = readFileSync(new URL("../client/src/hooks/useAuth.ts", import.meta.url), "utf8");
    expect(auth.match(/resetAuthRequests\(\)/g)).toHaveLength(6);
    expect(auth).toContain("assertAuthRequestEpoch(epoch, signal)");
    expect(auth).toContain('await queryClient.cancelQueries({ queryKey: ["/api/auth/me"] })');
  });
});

describe("private portal offline cache exclusion", () => {
  it.each(endpoints)("rejects persistent writes and legacy reads for %s", endpoint => {
    const storage = new Map<string, string>();
    storage.set("btr_qc_A", JSON.stringify({ v: 5, e: { [endpoint]: { d: { owner: "legacy" }, t: Date.now(), ttl: 100000 } } }));
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) });
    setCurrentUser("A");
    expect(shouldPersist(endpoint)).toBe(false);
    expect(getCachedData(endpoint)).toBeUndefined();
    setCachedData(endpoint, { owner: "new" }, 100000);
    expect(getCachedData(endpoint)).toBeUndefined();
    setCurrentUser(null);
  });

  it("service worker bypasses old cached portal downloads, honors no-store and purges legacy entries", async () => {
    const callbacks = new Map<string, (event: any) => void>();
    const cache = {
      keys: vi.fn(async () => [
        new Request("https://app.test/api/my/documents"),
        new Request("https://app.test/api/my/payslips/file.pdf"),
        new Request("https://app.test/api/branches"),
      ]),
      delete: vi.fn(async () => true),
    };
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const match = vi.fn(async () => json({ owner: "legacy" }));
    vm.runInNewContext(readFileSync(new URL("../client/public/sw.js", import.meta.url), "utf8"), {
      self: { addEventListener: (name: string, callback: any) => callbacks.set(name, callback), clients: { claim: vi.fn() } },
      caches: { keys: async () => ["butter-api-v10"], open: async () => cache, match, delete: vi.fn() },
      fetch, URL, Response, setTimeout, clearTimeout, console,
    });
    let activation!: Promise<unknown>;
    callbacks.get("activate")!({ waitUntil: (promise: Promise<unknown>) => { activation = promise; } });
    await activation;
    expect(cache.delete).toHaveBeenCalledTimes(2);
    for (const endpoint of [...endpoints, "/api/my/payslips/file.pdf"]) {
      let response!: Promise<Response>;
      const request = new Request(`https://app.test${endpoint}`);
      callbacks.get("fetch")!({ request, respondWith: (promise: Promise<Response>) => { response = promise; } });
      await expect(response).rejects.toThrow("offline");
      expect(fetch).toHaveBeenLastCalledWith(request, { cache: "no-store" });
    }
    expect(match).not.toHaveBeenCalled();
  });
});