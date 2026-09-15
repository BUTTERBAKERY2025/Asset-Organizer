import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APPROVED_SK_0950_NAME,
  CatalogueConflictError,
  UnknownCatalogueSourceError,
  buildCatalogueReconciliation,
  normalizeUnit,
  parseCategoriesWorkbook,
  parseProductsWorkbook,
  parseWarehouseWorkbook,
} from "../scripts/catalog-reconciliation";

const productsFile = "attached_assets/items_by_cod_1789494218526.xlsx";
const warehouseFile = "attached_assets/item_store_1789494218529.xlsx";
const categoriesFile = "attached_assets/items_by_category_1789494218529.xlsx";

describe("read-only catalogue reconciliation", () => {
  it("recognizes existing Arabic units without converting dimensions or stock", () => {
    expect(normalizeUnit("قطعة")).toBe(normalizeUnit("PC"));
    expect(normalizeUnit("كجم")).toBe(normalizeUnit("KG"));
    expect(normalizeUnit("لتر")).toBe(normalizeUnit("Ltr"));
    expect(normalizeUnit("KG")).not.toBe(normalizeUnit("LTR"));
    const result = buildCatalogueReconciliation({
      products: [],
      warehouse: [{ code: "100", name: "سكر", unit: "KG" }],
      categories: [],
      currentProducts: [],
      currentWarehouse: [{ id: 7, sku: "100", name: "سكر", unit: "كجم", current_stock: "12.500000" }],
    });
    expect(result.warehouseRows[0].currentBalance).toBe("12.500000");
    expect(result.warehouseRows[0].issues.some(issue => issue.code === "unit_mismatch")).toBe(false);
  });
  it("parses the approved workbooks and reports the source totals", () => {
    const products = parseProductsWorkbook(readFileSync(productsFile));
    const warehouse = parseWarehouseWorkbook(readFileSync(warehouseFile));
    const categories = parseCategoriesWorkbook(readFileSync(categoriesFile));
    const result = buildCatalogueReconciliation({
      products,
      warehouse,
      categories,
      currentProducts: [],
      currentWarehouse: [],
    });

    expect(products).toHaveLength(102);
    expect(warehouse).toHaveLength(269);
    expect(result.sourceTotals.products).toMatchObject({
      rows: 102,
      unique: 99,
      duplicateRows: 3,
    });
    expect(result.sourceTotals.warehouse).toMatchObject({
      rows: 269,
      unique: 267,
      duplicateRows: 2,
    });
  });

  it("collapses exact duplicates and keeps the approved sk-0950 alias", () => {
    const products = parseProductsWorkbook(readFileSync(productsFile));
    const result = buildCatalogueReconciliation({
      products,
      warehouse: [],
      categories: [],
      currentProducts: [],
      currentWarehouse: [],
    });
    const row = result.productRows.find((candidate) => candidate.canonicalSku === "sk-0950");

    expect(row?.sourceName).toBe(APPROVED_SK_0950_NAME);
    expect(row?.aliases).toContain("دانش شمر تشيز + الطماطم المجففة");
    expect(row?.sourceRecords).toHaveLength(2);
    expect(result.productRows).toHaveLength(99);
  });

  it("rejects a non-approved same-code name or unit conflict", () => {
    expect(() =>
      buildCatalogueReconciliation({
        products: [
          { code: "SKU-1", name: "One", unit: "PC" },
          { code: "sku-1", name: "Different", unit: "PC" },
        ],
        warehouse: [],
        categories: [],
        currentProducts: [],
        currentWarehouse: [],
      }),
    ).toThrow(CatalogueConflictError);
  });

  it("rejects an unknown source namespace instead of silently ignoring it", () => {
    expect(() =>
      buildCatalogueReconciliation({
        products: [],
        warehouse: [],
        categories: [],
        currentProducts: [],
        currentWarehouse: [],
        sources: {
          products: [],
          warehouse: [],
          categories: [],
          extra: [],
        },
      }),
    ).toThrow(UnknownCatalogueSourceError);
  });

  it("normalizes only dimension aliases and never converts dimensions", () => {
    expect(normalizeUnit("PC")).toBe("piece");
    expect(normalizeUnit("pc")).toBe("piece");
    expect(normalizeUnit("KG")).toBe("kg");
    expect(normalizeUnit("Ltr")).toBe("litre");
    expect(normalizeUnit("box")).toBe("box");
  });

  it("keeps product and warehouse namespaces separate even for equal SKUs", () => {
    const result = buildCatalogueReconciliation({
      products: [{ code: "shared-1", name: "Product", unit: "pc" }],
      warehouse: [{ code: "SHARED-1", name: "Material", unit: "KG" }],
      categories: [
        { category: "Finish bakery", name: "Product" },
        { category: "Bakery", name: "Material" },
      ],
      currentProducts: [{ id: 10, sku: "shared-1", name: "Product", unit: "piece" }],
      currentWarehouse: [{ id: 20, sku: "shared-1", name: "Material", unit: "kg" }],
    });

    expect(result.productRows[0]).toMatchObject({
      status: "exact_match",
      currentId: 10,
    });
    expect(result.warehouseRows[0]).toMatchObject({
      status: "exact_match",
      currentId: 20,
    });
  });

  it("preserves every exact category match, including many sections", () => {
    const result = buildCatalogueReconciliation({
      products: [{ code: "p-1", name: "Same name", unit: "PC" }],
      warehouse: [],
      categories: [
        { category: "Bakery", name: "Same name" },
        { category: "Salad and sandwi", name: "Same name" },
      ],
      currentProducts: [],
      currentWarehouse: [],
    });

    expect(result.productRows[0].categories.map((entry) => entry.category)).toEqual([
      "Bakery",
      "Salad and sandwi",
    ]);
    expect(result.productRows[0].status).toBe("add_candidate");
  });

  it("does not auto-merge a name collision and allows only a unique recode review", () => {
    const collision = buildCatalogueReconciliation({
      products: [{ code: "new-1", name: "Shared", unit: "PC" }],
      warehouse: [],
      categories: [{ category: "Bakery", name: "Shared" }],
      currentProducts: [
        { id: 1, sku: "old-1", name: "Shared", unit: "piece" },
        { id: 2, sku: "old-2", name: "shared", unit: "piece" },
      ],
      currentWarehouse: [],
    });
    expect(collision.productRows[0].status).toBe("review");
    expect(collision.productRows[0].matchMethod).toBe("name_collision");
    expect(collision.productRows[0].candidateCurrentId).toBeUndefined();

    const unique = buildCatalogueReconciliation({
      products: [{ code: "new-1", name: "Shared", unit: "PC" }],
      warehouse: [],
      categories: [{ category: "Bakery", name: "Shared" }],
      currentProducts: [{ id: 1, sku: "old-1", name: "Shared", unit: "piece" }],
      currentWarehouse: [],
    });
    expect(unique.productRows[0]).toMatchObject({
      status: "review",
      matchMethod: "name_recode_review",
      candidateCurrentId: 1,
    });
  });

  it("flags unit mismatch while preserving the current id, balance, and unit", () => {
    const current = {
      id: 42,
      sku: "sk-7",
      name: "Flour",
      unit: "kg",
      currentStock: 18.5,
    };
    const result = buildCatalogueReconciliation({
      products: [{ code: "SK-7", name: "Flour", unit: "PC" }],
      warehouse: [],
      categories: [{ category: "Bakery", name: "Flour" }],
      currentProducts: [current],
      currentWarehouse: [],
    });
    const row = result.productRows[0];

    expect(row.status).toBe("review");
    expect(row.issues.map((issue) => issue.code)).toContain("unit_mismatch");
    expect(row.currentId).toBe(42);
    expect(row.currentBalance).toBe(18.5);
    expect(row.currentUnit).toBe("kg");
    expect(row.currentRecord).toBe(current);
  });

  it("keeps numeric and string SKUs as business codes rather than ids", () => {
    const result = buildCatalogueReconciliation({
      products: [
        { code: 330010, name: "Numeric code", unit: "PC" },
        { code: "sk-1201", name: "String code", unit: "PC" },
      ],
      warehouse: [],
      categories: [
        { category: "Bakery", name: "Numeric code" },
        { category: "Bakery", name: "String code" },
      ],
      currentProducts: [
        { id: 700, sku: "330010", name: "Numeric code", unit: "piece" },
        { id: 701, sku: "sk-1201", name: "String code", unit: "piece" },
      ],
      currentWarehouse: [],
    });

    expect(result.productRows.map((row) => row.sku)).toEqual([330010, "sk-1201"]);
    expect(result.productRows.map((row) => row.currentId)).toEqual([700, 701]);
  });

  it("returns legacy rows for review and never proposes an immediate deletion", () => {
    const result = buildCatalogueReconciliation({
      products: [{ code: "new", name: "New item", unit: "PC" }],
      warehouse: [],
      categories: [{ category: "Bakery", name: "New item" }],
      currentProducts: [
        { id: 1, sku: "old", name: "Old item", unit: "piece", balance: 3 },
      ],
      currentWarehouse: [],
    });

    expect(result.legacyRows[0]).toMatchObject({
      status: "legacy_review",
      currentId: 1,
      currentBalance: 3,
      legacyDisposition: "review_required",
    });
    expect(result.legacyPolicy.requiredChecks).toContain("database_non_foreign_key_usage");
  });
});