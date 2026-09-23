import { describe, expect, it } from "vitest";
import { MaterialTransferCreationError } from "../server/material-transfer-creation";
import {
  resolveMaterialTransferCatalogItems,
  type MaterialTransferCatalogItem,
} from "../server/material-transfer-catalog";

const catalogItem = (
  overrides: Partial<MaterialTransferCatalogItem> = {},
): MaterialTransferCatalogItem => ({
  id: 11,
  name: "دقيق معتمد",
  category: "raw",
  unit: "كجم",
  isActive: true,
  ...overrides,
});

interface TestTransferItem {
  itemId: number;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  originalQuantity: number;
  availableQuantity: number;
  notes: string;
}

const transferItem = (overrides: Partial<TestTransferItem> = {}): TestTransferItem => ({
  itemId: 11,
  itemName: "اسم مزيف",
  category: "packaging",
  unit: "كجم",
  quantity: 2.5,
  originalQuantity: 3,
  availableQuantity: 8,
  notes: "ملاحظة السطر",
  ...overrides,
});

describe("material transfer catalogue snapshots", () => {
  it("rejects a nonexistent item with a creation 400", () => {
    expect(() => resolveMaterialTransferCatalogItems([transferItem()], []))
      .toThrowError(expect.objectContaining({
        name: "MaterialTransferCreationError",
        status: 400,
      }));
  });

  it("rejects an inactive item", () => {
    expect(() => resolveMaterialTransferCatalogItems(
      [transferItem()],
      [catalogItem({ isActive: false })],
    )).toThrow(MaterialTransferCreationError);
  });

  it("rejects a mismatched unit rather than reinterpreting quantity", () => {
    expect(() => resolveMaterialTransferCatalogItems(
      [transferItem({ unit: "لتر", quantity: 2.5 })],
      [catalogItem()],
    )).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it("persists canonical identity while preserving line data", () => {
    const [resolved] = resolveMaterialTransferCatalogItems(
      [transferItem()],
      [catalogItem()],
    );

    expect(resolved).toEqual({
      itemId: 11,
      itemName: "دقيق معتمد",
      category: "raw",
      unit: "كجم",
      quantity: 2.5,
      originalQuantity: 3,
      availableQuantity: 8,
      notes: "ملاحظة السطر",
    });
  });

  it("resolves duplicate lines deterministically from one canonical item", () => {
    const resolved = resolveMaterialTransferCatalogItems(
      [
        transferItem({ quantity: 1, notes: "الأول" }),
        transferItem({ quantity: 4, notes: "الثاني" }),
      ],
      [catalogItem()],
    );

    expect(resolved.map(({ itemName, category, unit, quantity, notes }) => ({
      itemName,
      category,
      unit,
      quantity,
      notes,
    }))).toEqual([
      { itemName: "دقيق معتمد", category: "raw", unit: "كجم", quantity: 1, notes: "الأول" },
      { itemName: "دقيق معتمد", category: "raw", unit: "كجم", quantity: 4, notes: "الثاني" },
    ]);
  });
});