import { describe, expect, it } from "vitest";
import { groupPreparationSheet, invalidPreparationSheetOrderIds } from "../shared/central-kitchen-preparation-sheet";
import { matchesOrderQueueStage, queueOrderNeedsAttention } from "../client/src/components/central-kitchen/order-queue";
import { buildCentralKitchenCounts, centralKitchenPageMeta } from "../shared/central-kitchen-list";

describe("central kitchen actionable inbox", () => {
  const now = new Date("2026-03-10T09:00:00.000Z");

  it("includes new requests, overdue active work, and received open discrepancies only", () => {
    const cases = [
      [{ status: "requested", neededDate: "2026-03-12" }, true],
      [{ status: "approved", neededDate: "2026-03-10", neededTime: "10:00" }, true],
      [{ status: "received", discrepancyStatus: "open" }, true],
      [{ status: "received", discrepancyStatus: "resolved" }, false],
      [{ status: "cancelled", neededDate: "2026-03-01" }, false],
    ] as const;
    for (const [order, expected] of cases) {
      expect(queueOrderNeedsAttention(order, now)).toBe(expected);
      expect(matchesOrderQueueStage(order, "attention", now)).toBe(expected);
    }
  });

  it("keeps facet counts independent from page slices and selected stages", () => {
    expect(buildCentralKitchenCounts({
      all: 83, requested: 9, approved: 20, prepared: 11, dispatched: 7,
      overdue: 4, discrepancies: 3, dueToday: 8, archive: 33,
    })).toEqual({
      attention: 16, requested: 9, approved: 20, prepared: 11, dispatched: 7,
      archive: 33, all: 83, new: 9, overdue: 4, dueToday: 8, openDiscrepancies: 3,
    });
  });

  it("calculates stable server page bounds without changing the whole-set total", () => {
    expect(centralKitchenPageMeta(51, 2, 25)).toEqual({ page: 2, pageSize: 25, total: 51, totalPages: 3 });
    expect(centralKitchenPageMeta(0, 99, 25)).toEqual({ page: 99, pageSize: 25, total: 0, totalPages: 1 });
  });
});

describe("consolidated preparation sheet", () => {
  it("identifies terminal selections for a conflict response after authorization", () => {
    expect(invalidPreparationSheetOrderIds([
      { id: 1, status: "approved" }, { id: 2, status: "received" }, { id: 3, status: "cancelled" },
    ])).toEqual([2, 3]);
  });

  it("groups only matching identities and units and keeps quantity meanings separate", () => {
    const groups = groupPreparationSheet([
      {
        id: 1, orderNumber: "CK-1", status: "approved", requestBranchName: "A",
        items: [{ productId: 7, productName: "دقيق", unit: "كجم", requestedQuantity: 1.5, preparedQuantity: 0.5,
          substituteProductId: 9, substituteProductName: "دقيق بديل", substituteUnit: "كجم", substituteQuantity: 0.25 }],
      },
      {
        id: 2, orderNumber: "CK-2", status: "prepared", requestBranchName: "B",
        items: [{ productId: 7, productName: "دقيق", unit: "كجم", requestedQuantity: 2.25, preparedQuantity: 2 }],
      },
      {
        id: 3, orderNumber: "CK-3", status: "requested", requestBranchName: "C",
        items: [{ productId: 7, productName: "دقيق", unit: "عبوة", requestedQuantity: 3 }],
      },
      {
        id: 4, orderNumber: "CK-4", status: "approved", requestBranchName: "D",
        items: [{ warehouseItemId: 7, productName: "دقيق", unit: "كجم", requestedQuantity: 8 }],
      },
      {
        id: 5, orderNumber: "CK-5", status: "cancelled", requestBranchName: "E",
        items: [{ productId: 7, productName: "دقيق", unit: "كجم", requestedQuantity: 100 }],
      },
    ]);

    expect(groups).toHaveLength(4);
    expect(groups.find(group => group.identity === "product:7" && group.unit === "كجم")).toMatchObject({
      requestedQuantity: 3.75,
      approvedQuantity: 3.75,
      preparedQuantity: 2.5,
    });
    expect(groups.find(group => group.identity === "product:9")).toMatchObject({
      provenance: "substitute",
      requestedQuantity: 0,
      approvedQuantity: 0,
      preparedQuantity: 0.25,
    });
    expect(groups.find(group => group.unit === "عبوة")).toMatchObject({
      requestedQuantity: 3,
      approvedQuantity: 0,
      preparedQuantity: 0,
    });
    expect(groups.find(group => group.identity === "warehouse:7")?.requestedQuantity).toBe(8);
  });
});