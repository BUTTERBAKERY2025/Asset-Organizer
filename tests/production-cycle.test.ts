import { describe, expect, it, vi } from "vitest";
import { cycleMovements, cycleReadError, explicitPlanReferences, readCycleSource } from "../client/src/components/central-kitchen/production-cycle-model";
import { getProductionDashboardTab } from "../client/src/components/central-kitchen/production-dashboard-tabs";
import type { ProductionPlanningResponse } from "../shared/production-planning";
import { readFileSync } from "node:fs";

describe("unified production cycle boundaries", () => {
  it("defaults to the cycle but preserves all existing operational tabs", () => {
    expect(getProductionDashboardTab("", false)).toBe("cycle");
    for (const tab of ["operations", "workplan", "unified-planning", "settings-review", "legacy"] as const)
      expect(getProductionDashboardTab(`?tab=${tab}`, false)).toBe(tab);
  });
  it("never merges replenishment, finished shipments and reverse ledgers", () => {
    const rows = [
      { id: 1, destinationBranchId: "k", sourceBranchId: "warehouse", status: "approved" },
      { id: 2, source_branch_id: "k", status: "dispatched" },
      { id: 3, source_branch_id: "other", destination_branch_id: "k", status: "requested" },
    ];
    expect(cycleMovements(rows, "raw", "k", "2026-09-30").map(row => row.id)).toEqual([1]);
    expect(cycleMovements(rows, "shipments", "k", "2026-09-30").map(row => row.id)).toEqual([2]);
    expect(cycleMovements(rows, "returns", "k", "2026-09-30").map(row => row.id)).toEqual([2, 3]);
    expect(cycleMovements(rows, "raw", "unauthorized", "2026-09-30")).toEqual([]);
  });
  it("uses Riyadh creation date plus open backlog, not historical balance semantics", () => {
    const base = { destinationBranchId: "k" };
    const rows = [
      { ...base, id: 1, status: "delivered", createdAt: "2026-09-29T22:00:00Z" },
      { ...base, id: 2, status: "delivered", createdAt: "2026-09-28T12:00:00Z" },
      { ...base, id: 3, status: "approved", createdAt: "2026-09-28T12:00:00Z" },
      { ...base, id: 4, status: "approved", createdAt: "2026-10-01T12:00:00Z" },
    ];
    expect(cycleMovements(rows, "raw", "k", "2026-09-30").map(row => row.id)).toEqual([1, 3]);
  });
  it("joins plans only by explicit request-item references, never product/date", () => {
    const data = { rows: [
      { id: 1, source: "advanced_plan", directLink: "/advanced-production-orders/1", items: [{ id: 11, productId: 7 }] },
      { id: 2, source: "advanced_plan", directLink: "/advanced-production-orders/2", items: [{ id: 12, productId: 7, requestLink: { requestItemId: 44, allocatedQuantity: 3 } }] },
    ] } as unknown as ProductionPlanningResponse;
    expect(explicitPlanReferences(data, 44)).toEqual([{ planId: 2, itemId: 12, quantity: 3, href: "/advanced-production-orders/2" }]);
    expect(explicitPlanReferences(data, 45)).toEqual([]);
    expect(explicitPlanReferences(undefined, 44)).toEqual([]);
  });
  it("surfaces failed or forbidden sources rather than returning zero or cached rows", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetch);
    try {
      await expect(readCycleSource("/protected")).rejects.toThrow(cycleReadError(403));
      expect(fetch).toHaveBeenCalledWith("/protected", expect.objectContaining({ credentials: "include", cache: "no-store" }));
    } finally { vi.unstubAllGlobals(); }
  });
  it("keeps lane errors, limited data, source semantics and existing execution visible", () => {
    const source = readFileSync("client/src/components/central-kitchen/production-cycle.tsx", "utf8");
    expect(source).toContain("if (error)");
    expect(source).toContain("if (loading)");
    expect(source).toContain("if (empty)");
    expect(source).toContain("query.isError ? undefined : query.data");
    expect(source).toContain("قد تغيب سجلات أقدم");
    expect(source).toContain("<OperationsBoard");
    expect(source).toContain("<ProductionPlanning");
    expect(source).toContain("movementId=");
  });
});