import { describe, expect, it, vi } from "vitest";

vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/db", () => ({ db: {} }));

import { branchTemplateRouteContext } from "../server/branch-template-context";

describe("reviewed legacy contexts with branch template assignments", () => {
  const branches = ["a", "b"];

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