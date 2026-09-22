import { describe, expect, it, vi } from "vitest";
vi.mock("../client/src/lib/queryClient", () => ({ apiRequest: vi.fn(), getQueryFn: vi.fn() }));
import {
  isKitchenOrderDraftValid,
  isValidKitchenOrderLine,
  normalizeReportedAvailableQuantity,
  type KitchenOrderDraftLine,
} from "../client/src/components/central-kitchen/order-line-editor";

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
});