import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldPersist } from "../client/src/lib/persistentCache";

describe("maintenance ticket cache boundary", () => {
  it("does not persist ticket data or private photos", () => {
    for (const url of ["/api/maintenance-tickets?branchId=one", "/api/maintenance-tickets/1", "/api/maintenance-tickets/1/attachments/2"]) {
      expect(shouldPersist(url)).toBe(false);
    }
  });
  it("bypasses the service worker before generic API caching", () => {
    const source = readFileSync("client/public/sw.js", "utf8");
    const bypass = source.indexOf("url.pathname === '/api/maintenance-tickets'");
    expect(bypass).toBeGreaterThan(0);
    expect(bypass).toBeLessThan(source.indexOf("const SAFE_STALE_ENDPOINTS"));
    expect(source.slice(bypass, source.indexOf("const SAFE_STALE_ENDPOINTS"))).toContain("return;");
  });
});