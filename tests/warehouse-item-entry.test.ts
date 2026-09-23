import { describe, expect, it } from "vitest";
import {
  addWarehouseCatalogItem,
  filterWarehouseCatalog,
  isValidWarehouseDraftItem,
  normalizeWarehouseCatalogSearch,
  type WarehouseCatalogEntry,
} from "../client/src/components/warehouse-entry/warehouse-item-entry-helpers";
import { WarehouseItemEntry } from "../client/src/components/warehouse-entry/warehouse-item-entry";

const catalog: WarehouseCatalogEntry[] = [
  { id: 1, name: "أكياس قهوة", nameEn: "Coffee bags", sku: "PKG-01", barcode: "1001", category: "تغليف", unit: "كرتون" },
  { id: 2, name: "طحين", sku: "RAW-02", category: "مواد خام", unit: "كجم" },
];

describe("warehouse fast item entry", () => {
  it("exports the split catalog-and-cart editor", () => {
    expect(typeof WarehouseItemEntry).toBe("function");
  });
  it("normalizes Arabic variants and searches name or code", () => {
    expect(normalizeWarehouseCatalogSearch("  أَكيـاس  ")).toBe("اكياس");
    expect(filterWarehouseCatalog(catalog, "اكياس", "all").map(item => item.id)).toEqual([1]);
    expect(filterWarehouseCatalog(catalog, "pkg-01", "all").map(item => item.id)).toEqual([1]);
    expect(filterWarehouseCatalog(catalog, "1001", "all").map(item => item.id)).toEqual([1]);
  });

  it("filters categories without altering catalog identity", () => {
    expect(filterWarehouseCatalog(catalog, "", "مواد خام")).toEqual([catalog[1]]);
  });

  it("prevents duplicates without incrementing or resetting declarations", () => {
    const added = addWarehouseCatalogItem([], catalog[0]);
    expect(added[0]).toMatchObject({ itemId: 1, quantity: "1", availableQuantity: null });
    const declared = [{ ...added[0], quantity: "2.5", availableQuantity: "0" }];
    expect(addWarehouseCatalogItem(declared, catalog[0])).toBe(declared);
    expect(addWarehouseCatalogItem(declared, catalog[0])[0]).toMatchObject({ quantity: "2.5", availableQuantity: "0" });
  });

  it("requires explicit on-hand while accepting declared zero and six decimals", () => {
    const base = addWarehouseCatalogItem([], catalog[1])[0];
    expect(isValidWarehouseDraftItem(base)).toBe(false);
    expect(isValidWarehouseDraftItem({ ...base, availableQuantity: "0" })).toBe(true);
    expect(isValidWarehouseDraftItem({ ...base, quantity: "1.123456", availableQuantity: "0.000001" })).toBe(true);
    expect(isValidWarehouseDraftItem({ ...base, quantity: "1.1234567", availableQuantity: "0" })).toBe(false);
  });
});