import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("../client/src/lib/queryClient", () => ({ apiRequest: vi.fn(), getQueryFn: vi.fn() }));
vi.mock("../client/src/components/layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
import { createKitchenSubmitGuard, DispatchEditor, ReceiptEditor, RequestChangeControls } from "../client/src/pages/central-kitchen-orders";

const products = [
  { id: 1, productId: 10, productName: "خبز اختبار", unit: "قطعة", requestedQuantity: 4, preparedQuantity: 4, dispatchedQuantity: 4 },
  { id: 2, warehouseItemId: 11, productName: "طحين اختبار", unit: "كيلو", requestedQuantity: 1.5, preparedQuantity: 1.25, dispatchedQuantity: 1.25 },
];
describe("kitchen workflow mobile quantity evidence", () => {
  it("ignores immediate duplicate confirmations and only unlocks for an explicit failed retry", () => {
    const guard = createKitchenSubmitGuard();
    const submit = vi.fn();
    expect(guard.run(submit)).toBe(true);
    expect(guard.run(submit)).toBe(false);
    expect(submit).toHaveBeenCalledTimes(1);
    // An elapsed timer or success does not call resetAfterFailure.
    expect(guard.run(submit)).toBe(false);
    guard.resetAfterFailure();
    expect(guard.run(submit)).toBe(true);
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it("shows prepared and sent quantities with a review action, using matching numeric keyboards", () => {
    const html = renderToStaticMarkup(React.createElement(DispatchEditor, { items: products, pending: false, onSubmit: vi.fn() }));
    expect(html).toContain("مراجعة الإرسال");
    expect(html).toContain("الجاهز:");
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('step="0.000001"');
  });
  it("shows sent, healthy, damaged, missing with an explicit review action", () => {
    const html = renderToStaticMarkup(React.createElement(ReceiptEditor, { items: products, pending: false, onSubmit: vi.fn() }));
    expect(html).toContain("مراجعة الاستلام");
    expect(html).toContain("الناقص:");
    expect(html).toContain("التالف");
    expect(html).toContain("الملاحظة إلزامية");
    expect(html).toContain('inputMode="decimal"');
  });
  it("disables both review buttons during an in-flight transition", () => {
    for (const Editor of [DispatchEditor, ReceiptEditor]) {
      const html = renderToStaticMarkup(React.createElement(Editor, { items: products, pending: true, onSubmit: vi.fn() }));
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?مراجعة (الإرسال|الاستلام)<\/button>/s);
    }
  });
  it("only exposes branch request-change actions advertised by the server", () => {
    const base = { id: 9, orderNumber: "TEST-9", status: "requested", neededDate: "2026-11-20", items: products, events: [], allocations: [], linkedBatches: [], shadowInventoryEntries: [] };
    const render = (allowedActions: { edit?: boolean; cancel?: boolean }) => renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() }, React.createElement(RequestChangeControls, { order: { ...base, allowedActions } as Parameters<typeof RequestChangeControls>[0]["order"] })));
    expect(render({ edit: true, cancel: false })).toContain("تعديل الطلب");
    expect(render({ edit: true, cancel: false })).not.toContain(">إلغاء الطلب</button>");
    expect(render({ edit: false, cancel: true })).not.toContain(">تعديل الطلب</button>");
    expect(render({ edit: false, cancel: true })).toContain("إلغاء الطلب");
  });
});