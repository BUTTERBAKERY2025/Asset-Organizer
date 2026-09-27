import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import type { CentralKitchenWorkplan, CentralKitchenWorkplanOrder } from "../shared/central-kitchen-workplan";
import { DailyWorkplan, filterWorkplanOrders, formatWorkplanQuantity } from "../client/src/components/central-kitchen/daily-workplan";
import { planningPage, workplanStatusLabel } from "../client/src/components/central-kitchen/production-planning-model";

// Only the fields consumed by the pure filter are needed in these fixtures;
// the integration suite validates complete API rows.
const rows = [
  { id: 1, inventoryMode: "real", rawStatus: "approved", orderNumber: "CK-1", nextStep: { stage: "production_and_preparation", label: "الإنتاج", owner: "المطبخ" }, source: { requestingBranch: { name: "فرع الرياض" } }, items: [{ productName: "خبز" }] },
  { id: 2, inventoryMode: "shadow", rawStatus: "approved", orderNumber: "CK-2", nextStep: { stage: "production_and_preparation", label: "الإنتاج", owner: "المطبخ" }, source: { requestingBranch: { name: "فرع الرياض" } }, items: [{ productName: "خبز" }] },
  { id: 3, inventoryMode: "unknown", rawStatus: "dispatched", orderNumber: "CK-3", nextStep: { stage: "receipt", label: "الاستلام", owner: "الفرع" }, source: { requestingBranch: { name: "فرع جدة" } }, items: [{ productName: "دقيق" }] },
] as unknown as CentralKitchenWorkplanOrder[];
const all = { mode: "all" as const, status: "all", stage: "all", search: "" };

describe("daily workplan presentation", () => {
  it("localizes known persisted order and batch statuses and retains raw unknown values", () => {
    expect(workplanStatusLabel("approved")).toBe("معتمد");
    expect(workplanStatusLabel("in_progress")).toBe("قيد التنفيذ");
    expect(workplanStatusLabel("finished")).toBe("منتهية");
    expect(workplanStatusLabel("new_external_status")).toBe("new_external_status");
    expect(filterWorkplanOrders(rows, { ...all, status: "approved" }).map(row => row.id)).toEqual([1, 2]);
  });
  it("renders translated table status from cached workplan without changing raw filter data", () => {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const kitchenId = "k1";
    const order = { ...rows[0], cohort: "date", neededDate: date, items: [{ productName: "خبز" }], exceptions: [] } as CentralKitchenWorkplanOrder;
    const workplan = {
      kitchen: { id: kitchenId, name: "المطبخ المركزي" }, date, orders: [order], overdueEarlierOrders: [],
      summary: { dateCohortOrderCount: 1, overdueEarlierOrderCount: 0, exceptionCounts: {}, linkedBatchCount: 0 },
      metadata: { totalRowsTruncated: false, dateCohort: { truncated: false }, overdueEarlier: { truncated: false } },
    } as CentralKitchenWorkplan;
    const client = new QueryClient();
    client.setQueryData(["/api/central-kitchen-orders/workplan", kitchenId, date], workplan);
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(Router, { hook: (): [string, () => void] => ["/production-dashboard", () => {}] },
        React.createElement(DailyWorkplan, { kitchens: [{ id: kitchenId, name: "المطبخ المركزي" }], kitchenId, onKitchenChange: () => {} }))));
    expect(html).toContain("معتمد");
    expect(html).not.toContain(">approved<");
    expect(order.rawStatus).toBe("approved");
  });
  it("keeps list pagination within the returned dataset and leaves rows untouched", () => {
    expect(planningPage(rows, 2, 2)).toMatchObject({ currentPage: 2, totalPages: 2, pageItems: [rows[2]] });
    expect(planningPage(filterWorkplanOrders(rows, { ...all, mode: "real" }), 2, 2)).toMatchObject({ currentPage: 1, totalPages: 1 });
    expect(rows).toHaveLength(3);
  });
  it("preserves six-decimal material and historical shadow quantities", () => {
    expect(formatWorkplanQuantity(0.123456)).toBe("0.123456");
    expect(formatWorkplanQuantity(0.000001)).toBe("0.000001");
    expect(formatWorkplanQuantity(0)).toBe("0");
  });
  it("keeps unknown and shadow modes separate without changing input rows", () => {
    expect(filterWorkplanOrders(rows, { ...all, mode: "unknown" }).map(row => row.id)).toEqual([3]);
    expect(filterWorkplanOrders(rows, { ...all, mode: "shadow" }).map(row => row.id)).toEqual([2]);
    expect(rows).toHaveLength(3);
  });
  it("combines mode, status, stage and Arabic search", () => {
    expect(filterWorkplanOrders(rows, { mode: "real", status: "approved", stage: "production_and_preparation", search: "  خبز  " }).map(row => row.id)).toEqual([1]);
    expect(filterWorkplanOrders(rows, { ...all, search: "جدة" }).map(row => row.id)).toEqual([3]);
    expect(filterWorkplanOrders(rows, { ...all, search: "غير موجود" })).toEqual([]);
  });
});