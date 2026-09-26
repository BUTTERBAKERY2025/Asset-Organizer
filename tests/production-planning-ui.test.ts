import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import type { ProductionPlanningResponse } from "@shared/production-planning";
import type { ProductionPlanningRow } from "@shared/production-planning";
import { getProductionDashboardTab } from "../client/src/components/central-kitchen/production-dashboard-tabs";
import { ProductionPlanning } from "../client/src/components/central-kitchen/production-planning";
import { filterPlanningRows, planningItemQuantities, planningIssueLabel, planningQuantity, planningStatusLabel } from "../client/src/components/central-kitchen/production-planning-model";

const rows: ProductionPlanningRow[] = [
  { key: "central_request:1", source: "central_request", id: 1, number: "REQ-1", status: "approved", date: "2026-01-01", cohort: "date",
    originLabel: "فرع الشرق", inventoryMode: "shadow", directLink: "/central-kitchen-orders?orderId=1", issues: ["historical_inventory_mode_unknown"], items: [
      { id: 1, productId: 1, productName: "خبز", unit: "قطعة", plannedQuantity: 5, completedQuantity: null, inProgressQuantity: null, remainingQuantity: null, issues: [], catalogMapping: "product", approvedRecipe: null },
    ] },
  { key: "advanced_plan:1", source: "advanced_plan", id: 1, number: "PLAN-1", status: "in_progress", date: "2025-12-31", cohort: "overdue",
    originLabel: "المطبخ المركزي", inventoryMode: null, directLink: "/advanced-production-orders/1", issues: [], items: [
      { id: 2, productId: 2, productName: "عجينة", unit: "كجم", plannedQuantity: 5, completedQuantity: 0, inProgressQuantity: 2, remainingQuantity: 3, issues: [], catalogMapping: "product", approvedRecipe: true },
    ] },
];
const staticHook = (): [string, () => void] => ["/production-dashboard", () => {}];

describe("production dashboard additive tabs", () => {
  it("keeps old tab URLs and operations default unchanged", () => {
    for (const tab of ["workplan", "operations", "legacy"] as const) expect(getProductionDashboardTab(`?tab=${tab}`, false)).toBe(tab);
    expect(getProductionDashboardTab("?tab=recipes", true)).toBe("recipes");
    expect(getProductionDashboardTab("?tab=recipes", false)).toBe("operations");
    expect(getProductionDashboardTab("", false)).toBe("operations");
    expect(getProductionDashboardTab("?tab=unexpected", false)).toBe("operations");
  });

  it("recognizes settings and unified planning URLs without recipe permission", () => {
    expect(getProductionDashboardTab("?tab=settings-review", false)).toBe("settings-review");
    expect(getProductionDashboardTab("?tab=unified-planning", false)).toBe("unified-planning");
  });
});

describe("planning filters and quantities", () => {
  it("filters by source, status, and search without merging different sources", () => {
    expect(filterPlanningRows(rows, { source: "central_request", status: "all", search: "خبز" }).map(row => row.key)).toEqual(["central_request:1"]);
    expect(filterPlanningRows(rows, { source: "advanced_plan", status: "in_progress", search: "PLAN-1" }).map(row => row.key)).toEqual(["advanced_plan:1"]);
    expect(filterPlanningRows(rows, { source: "all", status: "approved", search: "عجينة" })).toEqual([]);
    expect(filterPlanningRows(rows, { source: "all", status: "all", search: "" })).toHaveLength(2);
  });

  it("never turns unverified quantities into zero or sums across units", () => {
    expect(planningItemQuantities(rows[0].items[0])).toEqual({
      planned: "5 قطعة", completed: "غير متحقق", inProgress: "غير متحقق", remaining: "غير متحقق",
    });
    expect(planningItemQuantities(rows[1].items[0])).toEqual({
      planned: "5 كجم", completed: "0 كجم", inProgress: "2 كجم", remaining: "3 كجم",
    });
    expect(planningQuantity(null, "قطعة")).toBe("غير متحقق");
  });

  it("translates backend issue codes and statuses rather than rendering raw English codes", () => {
    expect(planningStatusLabel("in_progress")).toBe("قيد التنفيذ");
    expect(planningIssueLabel("historical_inventory_mode_unknown")).toBe("وضع مخزون الطلب التاريخي غير معروف");
    expect(planningIssueLabel("linked_production_exceeds_plan")).toContain("الإنتاج المرتبط");
    expect(planningIssueLabel("future_unrecognized_code")).toContain("غير معروفة");
    expect(planningIssueLabel("future_unrecognized_code")).not.toContain("future_");
  });
});

describe("planning authenticated-data render", () => {
  it("shows returned-only scope, historic request mode and Arabic issue text without a login or network call", () => {
    const date = "2026-01-01", kitchenId = "kitchen-1";
    const data: ProductionPlanningResponse = {
      kitchen: { id: kitchenId, name: "المطبخ المركزي", isCentralKitchen: true }, date, rows, checks: [],
      metadata: {
        timezone: "Asia/Riyadh", generatedAt: "2026-01-01T00:00:00.000Z", actualRiyadhToday: date,
        stateBasis: "current_persisted_state_not_historical_as_of", allocationReadiness: "unknown",
        quantitySemantics: { planned: "", completed: "", inProgress: "", remaining: "" },
        configuration: { inventoryMode: "real", source: "central_kitchen_runtime" },
        cohorts: {
          central_request: { date: { returned: 1, truncated: true }, overdue: { returned: 0, truncated: false, lookbackDays: 365 } },
          advanced_plan: { date: { returned: 0, truncated: false }, overdue: { returned: 1, truncated: false, lookbackDays: 365 } },
        },
        rowLimitPerSourceAndCohort: 250, truncated: true,
      },
      summary: { countsScope: "returned_rows_only", bySource: { central_request: { date: 1, overdue: 0 }, advanced_plan: { date: 0, overdue: 1 } } },
    };
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/production/planning", kitchenId, date], data);
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(Router, { hook: staticHook },
        React.createElement(ProductionPlanning, { mode: "planning", kitchens: [{ id: kitchenId, name: "المطبخ المركزي" }], kitchenId, onKitchenChange: () => {}, date, onDateChange: () => {} }))));
    expect(html).toContain("تشغيل ظلّي");
    expect(html).toContain("وضع الطلب");
    expect(html).toContain("وضع مخزون الطلب التاريخي غير معروف");
    expect(html).toContain("صف لكل مصدر وفترة");
    expect(html).not.toContain("historical_inventory_mode_unknown");
    expect(html).not.toContain(">in_progress<");
    expect(html).not.toContain("مخزون فعلي · وضع الطلب");
    queryClient.setQueryData(["/api/production/planning", kitchenId, date], {
      ...data, checks: [{ id: "configuration_mode", title: "وضع التشغيل", status: "pass", detail: "وضع التشغيل الحالي: real" }],
    } satisfies ProductionPlanningResponse);
    const settings = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(Router, { hook: staticHook },
        React.createElement(ProductionPlanning, { mode: "settings", kitchens: [{ id: kitchenId, name: "المطبخ المركزي" }], kitchenId, onKitchenChange: () => {}, date, onDateChange: () => {} }))));
    expect(settings).toContain("فحوص الأصناف والوصفات تخص البنود المُعادة فقط");
    expect(settings).toContain("مخزون فعلي");
    expect(settings).not.toContain("وضع التشغيل الحالي: real");
  });
});