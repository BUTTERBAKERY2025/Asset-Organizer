import { describe, expect, it } from "vitest";
import type { CentralKitchenWorkplanOrder } from "../shared/central-kitchen-workplan";
import { filterWorkplanOrders, formatWorkplanQuantity } from "../client/src/components/central-kitchen/daily-workplan";

// Only the fields consumed by the pure filter are needed in these fixtures;
// the integration suite validates complete API rows.
const rows = [
  { id: 1, inventoryMode: "real", rawStatus: "approved", orderNumber: "CK-1", nextStep: { stage: "production_and_preparation", label: "الإنتاج", owner: "المطبخ" }, source: { requestingBranch: { name: "فرع الرياض" } }, items: [{ productName: "خبز" }] },
  { id: 2, inventoryMode: "shadow", rawStatus: "approved", orderNumber: "CK-2", nextStep: { stage: "production_and_preparation", label: "الإنتاج", owner: "المطبخ" }, source: { requestingBranch: { name: "فرع الرياض" } }, items: [{ productName: "خبز" }] },
  { id: 3, inventoryMode: "unknown", rawStatus: "dispatched", orderNumber: "CK-3", nextStep: { stage: "receipt", label: "الاستلام", owner: "الفرع" }, source: { requestingBranch: { name: "فرع جدة" } }, items: [{ productName: "دقيق" }] },
] as unknown as CentralKitchenWorkplanOrder[];
const all = { mode: "all" as const, status: "all", stage: "all", search: "" };

describe("daily workplan presentation", () => {
  it("preserves six-decimal material and historical shadow quantities", () => {
    expect(formatWorkplanQuantity(0.123456)).toBe("0.123456");
    expect(formatWorkplanQuantity(0.000001)).toBe("0.000001");
    expect(formatWorkplanQuantity(0)).toBe("0");
  });
  it("keeps unknown and shadow modes separate without changing input rows", () => {
    expect(filterWorkplanOrders(rows, { ...all, mode: "unknown" }).map(row => row.id)).toEqual([3]);
    expect(filterWorkplanOrders(rows, { ...all, mode: "shadow" }).map(row => row.id)).toEqual([2]);
    expect(rows).toHaveLength(3);
  });
  it("combines mode, status, stage and Arabic search", () => {
    expect(filterWorkplanOrders(rows, { mode: "real", status: "approved", stage: "production_and_preparation", search: "  خبز  " }).map(row => row.id)).toEqual([1]);
    expect(filterWorkplanOrders(rows, { ...all, search: "جدة" }).map(row => row.id)).toEqual([3]);
    expect(filterWorkplanOrders(rows, { ...all, search: "غير موجود" })).toEqual([]);
  });
});