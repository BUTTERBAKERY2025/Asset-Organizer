import { describe, expect, it } from "vitest";
import {
  aggregateStockByBranchAndUnit,
  filterTransfersForBranch,
  mapWithConcurrency,
  resolveWarehouseReportScope,
  warehouseBackHref,
  warehouseBundleUrl,
} from "../client/src/lib/warehouse-reports";

describe("warehouse report scope and query helpers", () => {
  const branches = [{ id: "north", name: "North" }, { id: "south", name: "South" }];

  it("only accepts branch scopes present in the authorized branch list", () => {
    expect(resolveWarehouseReportScope("north", branches)).toBe("north");
    expect(resolveWarehouseReportScope("other", branches)).toBe("all");
    expect(resolveWarehouseReportScope("../north", branches)).toBe("all");
    expect(resolveWarehouseReportScope(null, branches)).toBe("all");
  });

  it("explicitly sends a selected branch and preserves only validated back scopes", () => {
    expect(warehouseBundleUrl("north")).toBe("/api/warehouse/bundle?branchId=north");
    expect(warehouseBundleUrl("all")).toBe("/api/warehouse/bundle");
    expect(warehouseBackHref("north")).toBe("/warehouse?branchId=north");
    expect(warehouseBackHref("all")).toBe("/warehouse");
  });
});

describe("warehouse report filtering and aggregation", () => {
  const transfers = [
    { id: 1, sourceBranchId: "north", destinationBranchId: "south" },
    { id: 2, sourceBranchId: "west", destinationBranchId: "north" },
    { id: 3, sourceBranchId: "west", destinationBranchId: "south" },
  ];

  it("includes selected-branch transfers when it is either source or destination", () => {
    expect(filterTransfersForBranch(transfers, "north").map((row) => row.id)).toEqual([1, 2]);
  });

  it("never combines quantities with different units", () => {
    const result = aggregateStockByBranchAndUnit(
      [
        { branchId: "north", itemId: 1, currentQuantity: "2.5" },
        { branchId: "north", itemId: 2, currentQuantity: 3 },
        { branchId: "north", itemId: 3, currentQuantity: 4 },
      ],
      [
        { id: 1, unit: "kg" },
        { id: 2, unit: "piece" },
        { id: 3, unit: "kg" },
      ],
      [{ id: "north", name: "North" }],
    );
    expect(result).toEqual([
      { branchId: "north", branchName: "North", unit: "kg", quantity: 6.5 },
      { branchId: "north", branchName: "North", unit: "piece", quantity: 3 },
    ]);
  });

  it("bounds parallel work and rejects failures rather than replacing them with zero", async () => {
    let active = 0;
    let peak = 0;
    const output = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return value * 2;
    });
    expect(output).toEqual([2, 4, 6, 8]);
    expect(peak).toBeLessThanOrEqual(2);

    await expect(
      mapWithConcurrency([1, 2], 2, async (value) => {
        if (value === 2) throw new Error("stock unavailable");
        return value;
      }),
    ).rejects.toThrow("stock unavailable");
  });
});