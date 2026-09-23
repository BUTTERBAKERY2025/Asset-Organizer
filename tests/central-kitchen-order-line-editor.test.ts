import { describe, expect, it, vi } from "vitest";
vi.mock("../client/src/lib/queryClient", () => ({ apiRequest: vi.fn(), getQueryFn: vi.fn() }));
import {
  addKitchenCatalogItem,
  filterKitchenCatalog,
  isKitchenOrderDraftValid,
  isValidKitchenOrderLine,
  kitchenCatalogSupplyLabel,
  normalizeKitchenCatalogSearch,
  normalizeReportedAvailableQuantity,
  type KitchenOrderDraftLine,
} from "../client/src/components/central-kitchen/order-line-editor";
import type { CentralKitchenCatalogItem } from "../shared/central-kitchen-catalog";

const product = (available = ""): KitchenOrderDraftLine => ({
  productId: 1, productName: "صنف اختبار", unit: "قطعة",
  requestedQuantity: "5", reportedAvailableQuantity: available, notes: "",
});
const material = (available = ""): KitchenOrderDraftLine => ({
  warehouseItemId: 1, productName: "مادة اختبار", unit: "كيلو",
  requestedQuantity: "0.5", reportedAvailableQuantity: available, notes: "",
});
describe("declared branch stock entry", () => {
  it("distinguishes an explicit zero from a blank or whitespace value", () => {
    expect(normalizeReportedAvailableQuantity("")).toBeNull();
    expect(normalizeReportedAvailableQuantity("  ")).toBeNull();
    expect(normalizeReportedAvailableQuantity("0")).toBe(0);
    expect(isValidKitchenOrderLine(product(""))).toBe(false);
    expect(isValidKitchenOrderLine(product("0"))).toBe(true);
  });
  it.each(["-1", "NaN", "Infinity"])("rejects unavailable or invalid numeric declaration %s", value => {
    expect(isValidKitchenOrderLine(product(value))).toBe(false);
  });
  it("requires whole-piece declarations for finished catalogue products", () => {
    expect(isValidKitchenOrderLine(product("1.5"))).toBe(false);
    expect(isValidKitchenOrderLine(product("15"))).toBe(true);
  });
  it("accepts fractional materials without requiring more stock than the order", () => {
    expect(isValidKitchenOrderLine(material("0.25"))).toBe(true);
    expect(isValidKitchenOrderLine(material("25"))).toBe(true);
  });
  it("matches server precision rather than accepting a value the API will reject", () => {
    expect(isValidKitchenOrderLine(material("0.123456"))).toBe(true);
    expect(isValidKitchenOrderLine(material("0.1234567"))).toBe(false);
    expect(isValidKitchenOrderLine({ ...material("0"), requestedQuantity: "0.1234567" })).toBe(false);
  });
  it("requires every line to have its own declaration", () => {
    expect(isKitchenOrderDraftValid([])).toBe(false);
    expect(isKitchenOrderDraftValid([product("0"), material("")])).toBe(false);
    expect(isKitchenOrderDraftValid([product("0"), material("1")])).toBe(true);
  });
  it("does not allow an empty or zero delivery quantity", () => {
    expect(isValidKitchenOrderLine({ ...product("0"), requestedQuantity: "" })).toBe(false);
    expect(isValidKitchenOrderLine({ ...product("0"), requestedQuantity: "0" })).toBe(false);
  });
  it("describes catalogue identity without implying direct main-warehouse supply", () => {
    expect(kitchenCatalogSupplyLabel(material("0"))).toBe("مادة مستودع · من مخزون المطبخ");
    expect(kitchenCatalogSupplyLabel(product("0"))).toBe("منتج مطبخ");
  });
});

describe("fast kitchen catalogue entry", () => {
  const catalog: CentralKitchenCatalogItem[] = [
    { id: 1, source: "product", name: "كعكة التمر", sku: "CK-101", unit: "قطعة" },
    { id: 2, source: "warehouse", name: "قِشطة طازجة", sku: "RM-22", unit: "كيلو" },
  ];

  it("normalizes common Arabic variants and diacritics for daily search", () => {
    expect(normalizeKitchenCatalogSearch("  قِشــطة  ")).toBe("قشطه");
    expect(normalizeKitchenCatalogSearch("إختيار")).toBe("اختيار");
    expect(filterKitchenCatalog(catalog, "قشطه", "all")).toEqual([catalog[1]]);
  });

  it("searches by code and respects source filters", () => {
    expect(filterKitchenCatalog(catalog, "ck-101", "all")).toEqual([catalog[0]]);
    expect(filterKitchenCatalog(catalog, "", "warehouse")).toEqual([catalog[1]]);
    expect(filterKitchenCatalog(catalog, "RM", "product")).toEqual([]);
  });

  it("replaces the initial blank row, retains nullable stock, and prevents duplicates", () => {
    const blank: KitchenOrderDraftLine = {
      productName: "", unit: "قطعة", requestedQuantity: "1", reportedAvailableQuantity: "", notes: "",
    };
    const once = addKitchenCatalogItem([blank], catalog[1]);
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({
      warehouseItemId: 2,
      requestedQuantity: "1",
      reportedAvailableQuantity: "",
    });
    expect(addKitchenCatalogItem(once, catalog[1])).toBe(once);
  });

  it("keeps product quantities integer-only while allowing material decimals", () => {
    const productLine = addKitchenCatalogItem([], catalog[0])[0];
    const materialLine = addKitchenCatalogItem([], catalog[1])[0];
    expect(isValidKitchenOrderLine({ ...productLine, requestedQuantity: "1.5", reportedAvailableQuantity: "0" })).toBe(false);
    expect(isValidKitchenOrderLine({ ...materialLine, requestedQuantity: "0.5", reportedAvailableQuantity: "0.25" })).toBe(true);
  });
});