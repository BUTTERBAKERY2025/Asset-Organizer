import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  getSelectableCatalogRecords,
  isCatalogRecordActive,
  isNewCatalogReferenceAllowed,
  isProductSaleEnabled,
} from "../shared/catalog-activity";

describe("catalog activity", () => {
  it.each([false, 0, "false", "inactive", "0", "f", " no "])(
    "recognizes explicit inactive value %p",
    (value) => {
      expect(isCatalogRecordActive(value)).toBe(false);
    },
  );

  it.each([true, 1, "true", "active", "1", undefined, null])(
    "keeps active and legacy values selectable: %p",
    (value) => {
      expect(isCatalogRecordActive(value)).toBe(true);
    },
  );

  it("excludes both archived catalogues, but permits operational-only finished goods without enabling sales", () => {
    const oldWarehouse = { id: 267, isActive: false };
    const newWarehouse = { id: 309, isActive: true };
    const oldProduct = { id: 196, isActive: "false", operationsEnabled: false, saleEnabled: false };
    const newProduct = { id: 102, isActive: "false", operationsEnabled: true, saleEnabled: false };
    expect(getSelectableCatalogRecords([oldWarehouse, newWarehouse])).toEqual([newWarehouse]);
    expect(getSelectableCatalogRecords([oldProduct, newProduct])).toEqual([newProduct]);
    expect(isNewCatalogReferenceAllowed(oldProduct)).toBe(false);
    expect(isProductSaleEnabled(newProduct)).toBe(false);
  });

  it("keeps history queries separate from new stock transfers, recipe selection and production posting", () => {
    const storage = readFileSync(new URL("../server/storage.ts", import.meta.url), "utf8");
    const recipes = readFileSync(new URL("../server/central-kitchen-recipes.ts", import.meta.url), "utf8");
    const posting = readFileSync(new URL("../server/production-stock-posting.ts", import.meta.url), "utf8");
    const inventoryPage = readFileSync(new URL("../client/src/pages/finished-goods-inventory.tsx", import.meta.url), "utf8");
    expect(storage).toMatch(/async transferFinishedGoods[\s\S]*?catalog\.operations_enabled = true[\s\S]*?catalog\.is_active/);
    expect(storage).toMatch(/async transferFinishedGoods[\s\S]*?isNewCatalogReferenceAllowed\(catalogProduct\)/);
    expect(storage).toMatch(/async createPurchasingRequest[\s\S]*?eq\(warehouseItems\.isActive, true\)/);
    expect(recipes.match(/to_jsonb\(p\)->>'operations_enabled'/g)).toHaveLength(3);
    expect(posting).toContain("isNewCatalogReferenceAllowed(validProduct)");
    expect(inventoryPage).toContain("selectableProductIds.has(item.productId)");
  });
});