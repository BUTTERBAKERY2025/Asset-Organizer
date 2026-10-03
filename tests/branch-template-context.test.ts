import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ batch: vi.fn(), rows: vi.fn() }));
vi.mock("../server/storage", () => ({ storage: { getDailyProductionBatch: mocks.batch } }));
vi.mock("../server/db", () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: mocks.rows }) }) }),
} }));

import { branchTemplateRouteContext } from "../server/branch-template-context";

describe("reviewed legacy contexts with branch template assignments", () => {
  const branches = ["a", "b"];
  it("uses stored owners for production and closures despite a forged branch", async () => {
    mocks.batch.mockResolvedValue({ branchId: "b" });
    mocks.rows.mockResolvedValue([{ branchId: "b" }]);
    for (const [path, module] of [
      ["/api/daily-production/batches/12/finish", "production"],
      ["/api/branch-daily-closures/12/close", "daily_closures"],
    ]) {
      expect(await branchTemplateRouteContext({
        path, method: "POST", body: { branchId: "a" }, query: { branchId: "a" },
      }, module, branches)).toEqual({ kind: "resource", branchId: "b" });
    }
  });

  it("does not invent an owner for missing production or closure records", async () => {
    mocks.batch.mockResolvedValue(undefined);
    mocks.rows.mockResolvedValue([]);
    for (const [path, module] of [
      ["/api/daily-production/batches/12", "production"],
      ["/api/branch-daily-closures/12", "daily_closures"],
    ]) {
      expect(await branchTemplateRouteContext({ path, method: "GET" }, module, branches)).toBeNull();
    }
  });

  it("constrains reviewed production and closure lists to authorized candidates", async () => {
    for (const [path, module] of [
      ["/api/daily-production/batches", "production"],
      ["/api/daily-production/unfinished", "production"],
      ["/api/branch-daily-closures", "daily_closures"],
      ["/api/branch-daily-closures/journals-preview", "daily_closures"],
    ]) {
      expect(await branchTemplateRouteContext({ path, method: "GET" }, module, branches))
        .toEqual({ kind: "collection", branchIds: branches });
    }
  });

  it("uses authorized candidates, not submitted targets, for a bulk write", async () => {
    const req = {
      path: "/api/cashier-shift-targets/bulk", method: "POST",
      body: { targets: [{ branchId: "foreign" }] }, query: { branchId: "foreign" },
    };
    expect(await branchTemplateRouteContext(req, "sales", branches))
      .toEqual({ kind: "collection", branchIds: branches });
  });

  it("lets the shift collection enforce the permission-filtered branch set", async () => {
    expect(await branchTemplateRouteContext({
      path: "/api/shift-performance-tracking", method: "GET", query: { branchId: "foreign" },
    }, "shifts", branches)).toEqual({ kind: "collection", branchIds: branches });
  });

  it("does not extend the reviewed rules to other methods or modules", async () => {
    for (const [path, method, module] of [
      ["/api/cashier-shift-targets/bulk", "GET", "sales"],
      ["/api/cashier-shift-targets/bulk", "POST", "cashier_performance"],
      ["/api/shift-performance-tracking", "DELETE", "shifts"],
      ["/api/shift-performance-tracking", "GET", "sales"],
    ]) {
      expect(await branchTemplateRouteContext({ path, method }, module, branches)).toBeUndefined();
    }
  });
});