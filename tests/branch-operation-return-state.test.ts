import { afterEach, describe, expect, it, vi } from "vitest";
import {
  branchDeskReturnUrl,
  captureBranchDeskReturn,
  readBranchDeskReturnState,
  resolveBranchDeskReturn,
  resolveBranchDeskReturnForCurrentSession,
  restoreBranchDeskScroll,
  saveBranchDeskReturnState,
} from "../client/src/lib/branch-operation-return-state";

afterEach(() => vi.unstubAllGlobals());

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("branch desk return state", () => {
  it("scopes exact positions to the session user, branch, and opaque token", () => {
    const storage = memoryStorage();
    const state = { userId: "u1", branchId: "b1", token: "t1", scrollX: 12, scrollY: 987 };
    saveBranchDeskReturnState(storage, state);
    expect(readBranchDeskReturnState(storage, "u1", "b1", "t1")).toEqual(state);
    expect(readBranchDeskReturnState(storage, "u2", "b1", "t1")).toBeNull();
    expect(readBranchDeskReturnState(storage, "u1", "b2", "t1")).toBeNull();
    expect(readBranchDeskReturnState(storage, "u1", "b1", "wrong")).toBeNull();
  });

  it("supports browser Back history markers and explicit return links", () => {
    const storage = memoryStorage();
    const state = { userId: "u1", branchId: "b1", token: "return-token", scrollX: 0, scrollY: 640 };
    saveBranchDeskReturnState(storage, state);
    expect(resolveBranchDeskReturn(storage, "u1", "b1", "", {
      __branchDeskReturn: { userId: "u1", branchId: "b1", token: "return-token" },
    })).toEqual(state);
    expect(branchDeskReturnUrl("b1", "/maintenance", "?branchReturn=return-token&status=open"))
      .toBe("/branch-operations?branchId=b1&branchReturn=return-token#branch-operation-card-maintenance");
  });

  it("updates the board entry and destination with the same latest token", () => {
    const storage = memoryStorage();
    let replacedUrl = "";
    vi.stubGlobal("document", {
      querySelector: () => ({ scrollLeft: 7, scrollTop: 432 }),
    });
    vi.stubGlobal("window", {
      scrollX: 0,
      scrollY: 432,
      sessionStorage: storage,
      location: {
        href: "https://app.test/branch-operations?branchId=b1&branchReturn=old",
        origin: "https://app.test",
      },
      history: {
        state: {},
        replaceState: (_state: unknown, _title: string, url: string) => { replacedUrl = url; },
      },
    });
    const destination = captureBranchDeskReturn("u1", "b1", "/maintenance?branchId=b1&from=branch-operations");
    const destinationToken = new URL(destination, "https://app.test").searchParams.get("branchReturn");
    expect(destinationToken).toBeTruthy();
    expect(new URL(replacedUrl, "https://app.test").searchParams.get("branchReturn")).toBe(destinationToken);
    expect(readBranchDeskReturnState(storage, "u1", "b1", destinationToken!))
      .toMatchObject({ scrollX: 7, scrollY: 432 });
  });

  it("restores the actual app scroll container rather than the window", () => {
    const calls: unknown[] = [];
    vi.stubGlobal("document", {
      querySelector: () => ({ scrollTo: (options: unknown) => calls.push(options) }),
    });
    vi.stubGlobal("window", { scrollTo: () => { throw new Error("window must not scroll"); } });
    restoreBranchDeskScroll({ scrollX: 3, scrollY: 876 });
    expect(calls).toEqual([{ left: 3, top: 876, behavior: "instant" }]);
  });

  it("keeps direct navigation working when session storage is disabled or full", () => {
    let historyCalls = 0;
    vi.stubGlobal("document", { querySelector: () => ({ scrollLeft: 0, scrollTop: 222 }) });
    vi.stubGlobal("window", {
      scrollX: 0,
      scrollY: 0,
      sessionStorage: { setItem: () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); } },
      location: { href: "https://app.test/branch-operations?branchId=b1", origin: "https://app.test" },
      history: { state: {}, replaceState: () => { historyCalls += 1; } },
    });
    const destination = "/maintenance?branchId=b1&from=branch-operations";
    expect(captureBranchDeskReturn("u1", "b1", destination)).toBe(destination);
    expect(historyCalls).toBe(0);
  });

  it("safely ignores a throwing sessionStorage getter", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    vi.stubGlobal("window", {
      scrollX: 0,
      scrollY: 0,
      get sessionStorage() { throw new DOMException("Blocked", "SecurityError"); },
      location: { href: "https://app.test/branch-operations?branchId=b1", origin: "https://app.test" },
      history: { state: {}, replaceState: () => { throw new Error("must not run"); } },
    });
    const destination = "/maintenance?branchId=b1&from=branch-operations";
    expect(captureBranchDeskReturn("u1", "b1", destination)).toBe(destination);
    expect(resolveBranchDeskReturnForCurrentSession("u1", "b1", "?branchReturn=t", null)).toBeNull();
  });

  it("does not override notification or ordinary deep links without a matching session token", () => {
    const storage = memoryStorage();
    expect(resolveBranchDeskReturn(storage, "u1", "b1", "?branchId=b1", null)).toBeNull();
    expect(resolveBranchDeskReturn(storage, "u1", "b1", "?branchReturn=untrusted", null)).toBeNull();
  });
});