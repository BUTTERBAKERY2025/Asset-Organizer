import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { apiCacheMiddleware } from "../server/api-cache";
import { shouldPersist } from "../client/src/lib/persistentCache";

describe("central kitchen order cache boundary", () => {
  it("reaches server authorization and fresh DB reads on every detail and list GET", () => {
    const paths = [
      "/api/central-kitchen-orders",
      "/api/central-kitchen-orders/21",
      "/api/central-kitchen-orders/21/items/5",
    ];
    for (const [index, path] of paths.entries()) {
      const req = { method: "GET", path, query: {}, headers: {}, session: { userId: `cache-boundary-test-${index}`, activeBranchId: "kitchen" } };
      let passed = 0;
      // A valid, large 200 response would be cached by the generic middleware.
      // Both calls must still reach the route and leave response writers intact.
      for (const status of ["approved", "prepared"]) {
        const res = responseStub();
        const originalJson = res.json;
        const originalSend = res.send;
        const result = apiCacheMiddleware(req as any, res as any, () => {
          passed++;
          return res.json({ status, padding: "x".repeat(1100) });
        });
        expect(res.json).toBe(originalJson);
        expect(res.send).toBe(originalSend);
        expect(result).toMatchObject({ status });
      }
      expect(passed).toBe(2);
    }
  });

  it("the same valid requests ARE cacheable outside the order prefix", () => {
    const req = {
      method: "GET", path: "/api/central-kitchen-orders-other",
      query: {}, headers: {}, session: { userId: "cache-boundary-control", activeBranchId: "kitchen" },
    };
    let passed = 0;
    for (const status of ["approved", "prepared"]) {
      const res = responseStub();
      let routeBody: any;
      const result = apiCacheMiddleware(req as any, res as any, () => {
        passed++;
        routeBody = res.json({ status, padding: "x".repeat(1100) });
      });
      const response = result ?? routeBody;
      const body = Buffer.isBuffer(response) ? JSON.parse(response.toString()) : response;
      expect(body.status).toBe("approved");
    }
    expect(passed).toBe(1);
  });

  it("does not let the service worker return an old approved detail on slow network or reload", () => {
    const listeners: Record<string, (event: any) => void> = {};
    runInNewContext(readFileSync("client/public/sw.js", "utf8"), {
      self: { addEventListener: (name: string, callback: (event: any) => void) => { listeners[name] = callback; } },
      URL,
      Set,
    });
    for (const path of ["/api/central-kitchen-orders/21", "/api/central-kitchen-orders?page=1"]) {
      let intercepted = false;
      listeners.fetch({
        request: { method: "GET", url: `https://example.test${path}` },
        respondWith: () => { intercepted = true; },
      });
      expect(intercepted).toBe(false);
    }
  });

  it("does not hydrate a kitchen order detail from persistentCache", () => {
    expect(shouldPersist("/api/central-kitchen-orders/21")).toBe(false);
    expect(shouldPersist("/api/central-kitchen-orders?page=1")).toBe(false);
  });
});

function responseStub() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    json(body: any) { return body; },
    send(body: any) { return body; },
    set(name: string, value: string) { headers.set(name.toLowerCase(), value); return this; },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    status(code: number) { this.statusCode = code; return this; },
  };
}