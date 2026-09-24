import { EventEmitter } from "events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCentralKitchenHttpDiagnostics,
  logCentralKitchenDiagnosticBoot,
} from "../server/central-kitchen-http-diagnostics";

function request(method: string, path: string) {
  return {
    method,
    path,
    originalUrl: `${path}?token=do-not-log&branchId=secret`,
    query: { token: "do-not-log" },
    body: { reason: "do-not-log" },
  } as any;
}

function response() {
  const emitter = new EventEmitter() as any;
  emitter.statusCode = 200;
  return emitter;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("central kitchen HTTP diagnostics", () => {
  it("logs a safe boot metric with the supplied process boot ID", () => {
    const records: any[] = [];
    logCentralKitchenDiagnosticBoot({
      bootId: "boot-test",
      logger: record => records.push(record),
      uptime: () => 12.4,
      rssBytes: () => 10 * 1_048_576,
    });
    expect(records).toEqual([expect.objectContaining({
      event: "boot",
      bootId: "boot-test",
      uptimeSec: 12,
      rssMiB: 10,
    })]);
  });

  it("records finish once, clears the stall timer, and never logs URL/query/body values", () => {
    vi.useFakeTimers();
    const records: any[] = [];
    let now = 100;
    const middleware = createCentralKitchenHttpDiagnostics({
      bootId: "boot-test",
      logger: record => records.push(record),
      monotonicNow: () => now,
      uptime: () => 7,
      rssBytes: () => 20 * 1_048_576,
      stallMs: 15_000,
    });
    const req = request("POST", "/api/central-kitchen-orders/16/request-change");
    const res = response();
    const next = vi.fn();

    middleware(req, res, next);
    now = 145;
    res.emit("finish");
    res.emit("close");
    vi.advanceTimersByTime(20_000);

    expect(next).toHaveBeenCalledOnce();
    expect(records.map(record => record.event)).toEqual(["start", "finished"]);
    expect(records[0].route).toBe("request-change");
    expect(records[1]).toEqual(expect.objectContaining({ elapsedMs: 45, status: 200 }));
    expect(vi.getTimerCount()).toBe(0);
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain("do-not-log");
    expect(serialized).not.toContain("branchId");
    expect(records.every(record => !("path" in record) && !("url" in record)
      && !("query" in record) && !("body" in record))).toBe(true);
  });

  it("records a stalled request once and an aborted terminal record once without leaking a timer", () => {
    vi.useFakeTimers();
    const records: any[] = [];
    let now = 0;
    const middleware = createCentralKitchenHttpDiagnostics({
      bootId: "boot-test",
      logger: record => records.push(record),
      monotonicNow: () => now,
      uptime: () => 1,
      rssBytes: () => 1_048_576,
      stallMs: 15_000,
    });
    const res = response();
    middleware(request("GET", "/api/central-kitchen-orders/operations"), res, vi.fn());

    now = 15_010;
    vi.advanceTimersByTime(15_000);
    vi.advanceTimersByTime(15_000);
    now = 15_025;
    res.emit("close");
    res.emit("finish");

    expect(records.map(record => record.event)).toEqual(["start", "stalled", "aborted"]);
    expect(records.filter(record => ["finished", "aborted"].includes(record.event))).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["GET", "/api/central-kitchen-orders", "list"],
    ["GET", "/api/central-kitchen-orders/16", "detail"],
    ["GET", "/api/central-kitchen-orders/operations", "operations"],
    ["GET", "/api/central-kitchen-orders/routing", "routing"],
  ])("uses the bounded label for %s %s", (method, path, label) => {
    vi.useFakeTimers();
    const records: any[] = [];
    const middleware = createCentralKitchenHttpDiagnostics({
      logger: record => records.push(record),
      stallMs: 15_000,
    });
    const res = response();
    middleware(request(method, path), res, vi.fn());
    res.emit("finish");
    expect(records[0].route).toBe(label);
    expect(records[0]).not.toHaveProperty("path");
    expect(records[0]).not.toHaveProperty("url");
  });

  it("does not log unrelated central-kitchen or non-kitchen endpoints", () => {
    const records: any[] = [];
    const next = vi.fn();
    const middleware = createCentralKitchenHttpDiagnostics({
      logger: record => records.push(record),
    });
    middleware(request("GET", "/api/central-kitchen-orders/catalog-v2"), response(), next);
    middleware(request("POST", "/api/other"), response(), next);
    expect(records).toEqual([]);
    expect(next).toHaveBeenCalledTimes(2);
  });
});