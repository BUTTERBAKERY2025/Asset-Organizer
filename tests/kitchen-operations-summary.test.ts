import { describe, expect, it } from "vitest";
import { summarizeKitchenOperations, type KitchenSummaryOrder } from "../client/src/lib/kitchen-operations-summary";

const order = (
  id: number,
  status: string,
  items: NonNullable<KitchenSummaryOrder["items"]>,
): KitchenSummaryOrder => ({ id, status, items });

describe("summarizeKitchenOperations (loaded visible orders only)", () => {
  it("sums six-decimal kilogram requests exactly and counts distinct orders, not rows", () => {
    const first = order(1, "requested", [
      { id: 10, productId: 3, productName: "سكر", unit: "kg", requestedQuantity: 0.1 },
      { id: 11, productId: 3, productName: "سكر", unit: "kg", requestedQuantity: 0.2 },
    ]);
    expect(summarizeKitchenOperations([
      first, first,
      order(2, "approved", [{ id: 12, productId: "3", productName: "سكر", unit: "kg", requestedQuantity: 0.000001 }]),
    ])).toEqual([{
      identityType: "product", identityId: "3", productName: "سكر",
      unit: "kg", requestedQuantity: 0.300001, orderCount: 2,
    }]);
  });

  it("isolates catalog source and unit even if ID and name match", () => {
    const items = [
      { id: 1, productId: 5, productName: "حليب", unit: "kg", requestedQuantity: 0.5 },
      { id: 2, warehouseItemId: 5, productName: "حليب", unit: "kg", requestedQuantity: 2 },
      { id: 3, productId: 5, productName: "حليب", unit: "قطعة", requestedQuantity: 3 },
      { id: 4, productId: 6, productName: "حليب", unit: "kg", requestedQuantity: 4 },
    ];
    expect(summarizeKitchenOperations([order(1, "approved", items)]).map(
      ({ identityType, identityId, unit, requestedQuantity }) => [identityType, identityId, unit, requestedQuantity],
    )).toEqual([
      ["product", "5", "kg", 0.5],
      ["warehouse", "5", "kg", 2],
      ["product", "5", "قطعة", 3],
      ["product", "6", "kg", 4],
    ]);
  });

  it("excludes stages other than requested and approved", () => {
    const item = { id: 1, productId: 5, productName: "حليب", unit: "kg", requestedQuantity: 2 };
    expect(summarizeKitchenOperations(["draft", "pending", "prepared", "dispatched", "received", "cancelled"]
      .map((status, index) => order(index + 1, status, [item])))).toEqual([]);
  });

  it("skips zero, missing, negative, nonfinite and imprecise quantities and unknown/ambiguous IDs", () => {
    const base = { productId: 1, productName: "دقيق", unit: "kg" };
    const invalid = [0, undefined, -1, NaN, Infinity, -Infinity, 0.1234567];
    const items: NonNullable<KitchenSummaryOrder["items"]> =
      invalid.map((requestedQuantity, id) => ({ ...base, id, requestedQuantity }));
    items.push({ ...base, id: 20, requestedQuantity: 0.5 });
    expect(summarizeKitchenOperations([order(1, "requested", [
      ...items,
      { id: 21, productName: "دقيق", unit: "kg", requestedQuantity: 5 },
      { id: 22, productId: 1, warehouseItemId: 2, productName: "دقيق", unit: "kg", requestedQuantity: 5 },
    ])])).toMatchObject([{ requestedQuantity: 0.5, orderCount: 1 }]);
  });

  it("does not double count repeated item IDs or identical ID-less snapshots in one order", () => {
    const identified = { id: 10, warehouseItemId: 7, productName: "زيت", unit: "kg", requestedQuantity: 0.25 };
    const old = { warehouseItemId: 7, productName: "زيت", unit: "kg", requestedQuantity: 0.125 };
    expect(summarizeKitchenOperations([order(1, "requested", [
      identified, { ...identified, requestedQuantity: 99 }, old, { ...old },
    ])])).toMatchObject([{ requestedQuantity: 0.375, orderCount: 1 }]);
  });
});