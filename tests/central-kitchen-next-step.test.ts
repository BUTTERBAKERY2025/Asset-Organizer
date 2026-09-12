import { describe, expect, it } from "vitest";
import {
  filterCentralKitchenOrdersByInventoryMode,
  getCentralKitchenNextStep,
  parseCentralKitchenInventoryMode,
  parseCentralKitchenInventoryModeFilter,
} from "../shared/central-kitchen-next-step";

describe("central kitchen next-step guidance", () => {
  it.each([
    ["requested", "اعتماد", "مصدر المطبخ", "approval"],
    ["approved", "الإنتاج ثم التجهيز", "المطبخ", "production_and_preparation"],
    ["prepared", "الإرسال", "المصدر", "dispatch"],
    ["dispatched", "الاستلام", "الفرع الطالب", "receipt"],
  ] as const)("maps %s to the responsible next step", (status, label, owner, stage) => {
    expect(getCentralKitchenNextStep({ status, inventoryMode: "real" })).toEqual({
      label,
      owner,
      stage,
      isComplete: false,
    });
  });

  it("keeps a clean received order complete", () => {
    expect(getCentralKitchenNextStep({
      status: "received",
      inventoryMode: "real",
      discrepancyStatus: "none",
      damagedQuantity: 0,
      missingQuantity: 0,
    })).toEqual({
      label: "مكتمل",
      owner: "—",
      stage: "complete",
      isComplete: true,
    });
  });

  it("routes received discrepancies to review rather than stock resolution", () => {
    for (const quantities of [
      { damagedQuantity: 1, missingQuantity: 0 },
      { damagedQuantity: 0, missingQuantity: 2 },
    ]) {
      expect(getCentralKitchenNextStep({
        status: "received",
        inventoryMode: "shadow",
        discrepancyStatus: "open",
        ...quantities,
      })).toEqual({
        label: "مراجعة الفروقات",
        owner: "الفرع الطالب",
        stage: "discrepancy_review",
        isComplete: false,
      });
    }
  });

  it("uses authoritative discrepancy status instead of historical quantities", () => {
    expect(getCentralKitchenNextStep({
      status: "approved",
      inventoryMode: "shadow",
      damagedQuantity: 0,
      missingQuantity: 0,
    }).stage).toBe("production_and_preparation");
    expect(getCentralKitchenNextStep({
      status: "received",
      inventoryMode: "real",
      discrepancyStatus: "resolved",
      damagedQuantity: 99,
      missingQuantity: 99,
    }).isComplete).toBe(true);
    expect(getCentralKitchenNextStep({
      status: "received",
      inventoryMode: "real",
      discrepancyStatus: "open",
      damagedQuantity: 0,
      missingQuantity: 0,
    }).stage).toBe("discrepancy_review");
  });

  it("keeps a received order indeterminate without authoritative discrepancy status", () => {
    expect(getCentralKitchenNextStep({
      status: "received",
      inventoryMode: "real",
      damagedQuantity: 0,
      missingQuantity: 0,
    })).toEqual({
      label: "تم الاستلام — راجع حالة تسوية الفروقات في الطلب",
      owner: "الفرع الطالب",
      stage: "unknown",
      isComplete: false,
    });
  });

  it("normalizes legacy inventory modes without grouping them with real or shadow", () => {
    expect(parseCentralKitchenInventoryMode("real")).toBe("real");
    expect(parseCentralKitchenInventoryMode("SHADOW")).toBe("shadow");
    expect(parseCentralKitchenInventoryMode(null)).toBe("unknown");
    expect(parseCentralKitchenInventoryMode("legacy-mode")).toBe("unknown");
    expect(parseCentralKitchenInventoryMode(undefined)).toBe("unknown");

    expect(parseCentralKitchenInventoryModeFilter("unknown")).toBe("unknown");
    expect(parseCentralKitchenInventoryModeFilter("invalid")).toBe("all");
    expect(parseCentralKitchenInventoryModeFilter(undefined)).toBe("all");

    const orders = [
      { id: "real", inventoryMode: "real" },
      { id: "shadow", inventoryMode: "shadow" },
      { id: "null", inventoryMode: null },
      { id: "legacy", inventoryMode: "legacy-mode" },
    ];
    expect(filterCentralKitchenOrdersByInventoryMode(orders, "unknown").map(order => order.id))
      .toEqual(["null", "legacy"]);
    expect(filterCentralKitchenOrdersByInventoryMode(orders, "all")).toEqual(orders);
    expect(filterCentralKitchenOrdersByInventoryMode(orders, "invalid")).toEqual(orders);
  });

  it("keeps unknown statuses unknown and not complete", () => {
    expect(getCentralKitchenNextStep({
      status: "pending",
      inventoryMode: "real",
    })).toEqual({
      label: "حالة غير معروفة",
      owner: "غير محدد",
      stage: "unknown",
      isComplete: false,
    });
  });
});