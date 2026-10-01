import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPageLoader } from "../client/src/lib/pagePreloader";

const page = { default: () => null };
let registry: ReturnType<typeof createPageLoader>;
let loader: ReturnType<typeof vi.fn>;
let reload: ReturnType<typeof vi.fn>;
let storage: Map<string, string>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
  loader = vi.fn(() => Promise.resolve(page));
  reload = vi.fn();
  storage = new Map();
  vi.stubGlobal("window", { location: { reload } });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  registry = createPageLoader({
    "operations-hr": () => loader(),
    "hr-hub": () => Promise.resolve(page),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("page imports always settle or expose their failure", () => {
  it("shares the in-flight promise between preload and actual navigation", async () => {
    const pending = deferred<typeof page>();
    loader.mockImplementation(() => pending.promise);
    registry.preloadPage("operations-hr");
    const first = registry.preloadAndCache("operations-hr");
    const second = registry.preloadAndCache("operations-hr");
    expect(first).toBe(second);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
    pending.resolve(page);
    expect(await first).toBe(page);
    expect(await registry.preloadAndCache("operations-hr")).toBe(page);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers a stalled attempt through a bounded second import", async () => {
    const pending = deferred<typeof page>();
    loader.mockImplementationOnce(() => pending.promise);
    // Inspect the real React.lazy payload, as in the authenticated CDP trace.
    const lazy = registry.makeLazy("operations-hr") as unknown as {
      _payload: { _status: number; _result: unknown };
      _init: (payload: unknown) => unknown;
    };
    let suspended: unknown;
    try { lazy._init(lazy._payload); } catch (error) { suspended = error; }
    const request = registry.preloadAndCache("operations-hr");
    expect(suspended).toBe(request);
    expect(lazy._payload._status).toBe(0);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(8_000);
    // Matches the observed failure: the first import stays pending, but an
    // independent import of the same loaded module can resolve normally.
    expect(await request).toBe(page);
    expect(lazy._payload._status).toBe(1);
    expect(lazy._init(lazy._payload)).toBe(page.default);
    expect(loader).toHaveBeenCalledTimes(2);
    pending.resolve(page);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a permanently pending import before the 20-second page watchdog", async () => {
    const pending = deferred<typeof page>();
    loader.mockImplementation(() => pending.promise);
    const request = registry.preloadAndCache("operations-hr");
    const failure = expect(request).rejects.toMatchObject({
      name: "PageImportTimeout",
      message: "Timed out loading page module: operations-hr",
    });
    await vi.advanceTimersByTimeAsync(16_001);
    await failure;
    expect(reload).not.toHaveBeenCalled();
    expect(registry.preloadAndCache("operations-hr")).not.toBe(request);
    // Consume and finish the retry created above; no abandoned timer/request.
    pending.resolve(page);
    await registry.preloadAndCache("operations-hr");
  });

  it("never substitutes a pending forever promise when reload does not navigate", async () => {
    const error = new Error("Failed to fetch dynamically imported module");
    loader.mockRejectedValue(error);
    const request = registry.preloadAndCache("operations-hr");
    await expect(request).rejects.toBe(error);
    expect(reload).toHaveBeenCalledOnce();
    expect(storage.get("__chunk_reload_count")).toBe("1");
    // The subsequent request also settles; the shared reload cap still applies.
    await expect(registry.preloadAndCache("operations-hr")).rejects.toBe(error);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("preserves the import error when session storage is blocked", async () => {
    const error = new Error("Failed to fetch dynamically imported module");
    loader.mockRejectedValue(error);
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("Storage denied"); } });
    await expect(registry.preloadAndCache("operations-hr")).rejects.toBe(error);
    expect(reload).not.toHaveBeenCalled();
  });

  it("makes a failed background preload retryable and handles its rejection", async () => {
    const error = new Error("Page module unavailable");
    loader.mockRejectedValue(error);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    registry.preloadPage("operations-hr");
    await vi.waitFor(() => expect(warning).toHaveBeenCalledWith(
      "[page-preload] Failed to load operations-hr", error,
    ));
    loader.mockResolvedValue(page);
    registry.preloadPage("operations-hr");
    expect(await registry.preloadAndCache("operations-hr")).toBe(page);
  });

  it("keeps lazy component identity stable across render retries", async () => {
    const first = registry.makeLazy("operations-hr");
    expect(registry.makeLazy("operations-hr")).toBe(first);
    await registry.preloadAndCache("operations-hr");
    expect(registry.makeLazy("operations-hr")).toBe(first);
    expect(registry.makeLazy("hr-hub")).not.toBe(first);
  });
});