import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentLocalDestination,
  loginReturnDestination,
  safeLocalDestination,
} from "../client/src/lib/safe-navigation";

afterEach(() => vi.unstubAllGlobals());

describe("safe login and notification destinations", () => {
  it("preserves an internal path, query and hash", () => {
    expect(safeLocalDestination("/central-kitchen-orders?orderId=42#details")).toBe(
      "/central-kitchen-orders?orderId=42#details",
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "/login?returnUrl=%2Fsecret",
  ])("rejects unsafe or recursive destination %s", (value) => {
    expect(safeLocalDestination(value)).toBe("/");
  });

  it("retains the complete current deep link for an auth redirect", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://app.example",
        pathname: "/branch-operations",
        search: "?tab=daily",
        hash: "#priority",
      },
    });
    expect(currentLocalDestination()).toBe("/branch-operations?tab=daily#priority");
  });

  it("reads the encoded returnUrl used by protected routes", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://app.example",
        search: "?returnUrl=%2Fnotifications%3Ffilter%3Dmine%23new",
      },
    });
    expect(loginReturnDestination()).toBe("/notifications?filter=mine#new");
  });
});