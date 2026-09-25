import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("../client/src/lib/queryClient", () => ({ apiRequest: vi.fn(), getQueryFn: vi.fn() }));
vi.mock("../client/src/components/central-kitchen/availability-snapshot", () => ({ AvailabilitySnapshot: () => null }));
import {
  addKitchenCatalogItem,
  getKitchenDraftInvalidTarget,
  isKitchenOrderDraftValid,
  OrderLineEditor,
  type KitchenOrderDraftLine,
} from "../client/src/components/central-kitchen/order-line-editor";
import type { CentralKitchenCatalogItem } from "../shared/central-kitchen-catalog";

const product: CentralKitchenCatalogItem = { id: 11, name: "منتج", unit: "قطعة", source: "product" };
const material: CentralKitchenCatalogItem = { id: 12, name: "طحين", unit: "كيلو", source: "warehouse" };
const blank: KitchenOrderDraftLine = {
  productName: "", unit: "قطعة", requestedQuantity: "1", reportedAvailableQuantity: "", notes: "",
};
const manual: KitchenOrderDraftLine = {
  manualMode: true, productName: "", unit: "", requestedQuantity: "", reportedAvailableQuantity: "", notes: "",
};
const target = (index: number, selector: string, mobileView: "choose" | "selected" = "selected") =>
  ({ index, selector, mobileView });

describe("kitchen item selection and completion flow", () => {
  it("treats the initial blank row as an advance blocker, not a selected item", () => {
    expect(getKitchenDraftInvalidTarget([])).toEqual(target(0, "#kitchen-catalog-search", "choose"));
    expect(getKitchenDraftInvalidTarget([blank])).toEqual(target(0, "#kitchen-catalog-search", "choose"));
    const html = renderToStaticMarkup(React.createElement(OrderLineEditor, { items: [blank], products: [product], kitchenId: "1", catalogLoading: false, catalogError: false, onRetryCatalog: vi.fn(), onChange: vi.fn() }));
    expect(html).toContain("0 مختار · 0 ناقص الإكمال");
    expect(html).toContain("إدخال الكميات");
  });

  it("targets manual name, unit, requested, then reported in the exact input order", () => {
    expect(getKitchenDraftInvalidTarget([manual])).toEqual(target(0, "#manual-name-0"));
    expect(getKitchenDraftInvalidTarget([{ ...manual, productName: "خاص" }])).toEqual(target(0, "#manual-unit-0"));
    expect(getKitchenDraftInvalidTarget([{ ...manual, productName: "خاص", unit: "كيلو" }])).toEqual(target(0, "#request-qty-0"));
    expect(getKitchenDraftInvalidTarget([{ ...manual, productName: "خاص", unit: "كيلو", requestedQuantity: "0.5" }])).toEqual(target(0, "#reported-stock-0"));
  });

  it("keeps declarations empty after rapid additions; accepts explicit zero and material decimals", () => {
    const first = addKitchenCatalogItem([blank], product);
    const both = addKitchenCatalogItem(first, material);
    expect(both.map(line => line.reportedAvailableQuantity)).toEqual(["", ""]);
    expect(getKitchenDraftInvalidTarget(both)).toEqual(target(0, "#reported-stock-0"));
    expect(addKitchenCatalogItem(both, product)).toBe(both);
    expect(getKitchenDraftInvalidTarget([{ ...both[0], reportedAvailableQuantity: "0" }, both[1]])).toEqual(target(1, "#reported-stock-1"));
    const valid = [{ ...both[0], reportedAvailableQuantity: "0" }, { ...both[1], requestedQuantity: "0.5", reportedAvailableQuantity: "0.25" }];
    expect(isKitchenOrderDraftValid(valid)).toBe(true);
    expect(getKitchenDraftInvalidTarget(valid)).toBeNull();
    expect(getKitchenDraftInvalidTarget([{ ...valid[0], requestedQuantity: "1.5" }, valid[1]])).toEqual(target(0, "#request-qty-0"));
  });

  it("renders a sticky explicit quantity mode, missing count and actual manual unit focus target without early error spam", () => {
    const items = [{ ...manual, productName: "خاص", requestedQuantity: "1", reportedAvailableQuantity: "0" }, addKitchenCatalogItem([], product)[0]];
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() },
      React.createElement(OrderLineEditor, { mobileView: "selected", items, products: [product], kitchenId: "1", catalogLoading: false, catalogError: false, onRetryCatalog: vi.fn(), onChange: vi.fn() })));
    expect(html).toContain("2 مختار · 2 ناقص الإكمال");
    expect(html).toContain("إكمال الناقص (2)");
    expect(html).toContain('id="manual-unit-0"');
    expect(html).toContain('id="reported-stock-1"');
    expect(html).toContain('value="0"');
    expect(html).not.toContain("راجع كمية التوريد والرصيد المعلن قبل الإرسال");
    expect(html).toMatch(/class="[^"]*sticky top-0[^"]*"/);
  });
});