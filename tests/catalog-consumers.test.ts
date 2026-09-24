import { describe, expect, it } from "vitest";
import {
  canReactivatePendingPriceCatalogRecord,
  getEffectiveSalePrice,
  getSelectableCatalogRecords,
  isExplicitCatalogActivation,
  isExplicitCatalogActivityValue,
  isNewCatalogReferenceAllowed,
} from "../shared/catalog-activity";

type CatalogRecord = {
  id: number;
  name: string;
  isActive?: boolean | string | null;
};

describe("catalog consumer activity boundaries", () => {
  const activeProduct: CatalogRecord = { id: 10, name: "Active pastry", isActive: "true" };
  const inactiveProduct: CatalogRecord = { id: 11, name: "Retired pastry", isActive: "inactive" };
  const inactiveWarehouseItem: CatalogRecord = { id: 20, name: "Retired flour", isActive: false };

  it("keeps inactive catalog records out of POS and product selection", () => {
    const branchProducts = [
      { isActive: true, product: activeProduct },
      { isActive: true, product: inactiveProduct },
      { isActive: false, product: activeProduct },
    ];

    const selectableProducts = getSelectableCatalogRecords([activeProduct, inactiveProduct]);
    const posProducts = branchProducts.filter(
      item => item.isActive && isNewCatalogReferenceAllowed(item.product),
    );

    expect(selectableProducts).toEqual([activeProduct]);
    expect(posProducts).toEqual([{ isActive: true, product: activeProduct }]);
  });

  it("excludes unpriced POS products and never derives a zero sale price", () => {
    const priced = getEffectiveSalePrice(null, 12.5);
    const overridden = getEffectiveSalePrice(9, 12.5);
    const posProducts = [
      { isActive: true, priceOverride: null, product: { ...activeProduct, basePrice: 12.5 } },
      { isActive: true, priceOverride: null, product: { ...activeProduct, id: 12, basePrice: null } },
      { isActive: true, priceOverride: 0, product: { ...activeProduct, id: 13, basePrice: 12.5 } },
    ].filter(item =>
      item.isActive
      && isNewCatalogReferenceAllowed(item.product)
      && getEffectiveSalePrice(item.priceOverride, item.product.basePrice) !== null,
    );

    expect(priced).toBe(12.5);
    expect(overridden).toBe(9);
    expect(posProducts.map(item => item.product.id)).toEqual([10]);
    expect(getEffectiveSalePrice(null, null)).toBeNull();
    expect(getEffectiveSalePrice(undefined, 0)).toBeNull();
    expect(getEffectiveSalePrice("not-a-price", 12.5)).toBeNull();
    expect(getEffectiveSalePrice(Number.POSITIVE_INFINITY, 12.5)).toBeNull();
  });

  it("allows a pending-price import to activate only with an existing or supplied positive price", () => {
    expect(canReactivatePendingPriceCatalogRecord(null, undefined)).toBe(false);
    expect(canReactivatePendingPriceCatalogRecord(0, 0)).toBe(false);
    expect(canReactivatePendingPriceCatalogRecord(7.5, undefined)).toBe(true);
    expect(canReactivatePendingPriceCatalogRecord(null, 7.5)).toBe(true);
  });

  it("does not treat missing or malformed status values as an activation request", () => {
    expect(isExplicitCatalogActivation(true)).toBe(true);
    expect(isExplicitCatalogActivation("active")).toBe(true);
    expect(isExplicitCatalogActivation(false)).toBe(false);
    expect(isExplicitCatalogActivityValue(null)).toBe(false);
    expect(isExplicitCatalogActivityValue("pending")).toBe(false);
  });

  it("rejects inactive products for new production records", () => {
    expect(isNewCatalogReferenceAllowed(activeProduct)).toBe(true);
    expect(isNewCatalogReferenceAllowed(inactiveProduct)).toBe(false);
    expect(isNewCatalogReferenceAllowed(undefined)).toBe(false);
  });

  it("rejects inactive warehouse items for new material transfers", () => {
    expect(isNewCatalogReferenceAllowed(inactiveWarehouseItem)).toBe(false);
    expect(isNewCatalogReferenceAllowed({ ...inactiveWarehouseItem, isActive: true })).toBe(true);
  });

  it("does not remove inactive references from the historical source collection", () => {
    const historicalRecords = [activeProduct, inactiveProduct, inactiveWarehouseItem];
    const selectable = getSelectableCatalogRecords(historicalRecords);

    expect(selectable.map(item => item.id)).toEqual([10]);
    expect(historicalRecords.find(item => item.id === inactiveProduct.id)).toBe(inactiveProduct);
    expect(historicalRecords.find(item => item.id === inactiveWarehouseItem.id)).toBe(inactiveWarehouseItem);
  });
});