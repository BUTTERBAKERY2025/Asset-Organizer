import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { selectOperationsDemands } from "./operations-board-model";
import { getProductionDashboardTab } from "./production-dashboard-tabs";

const source = (name: string) => readFileSync(`client/src/components/central-kitchen/${name}`, "utf8");
describe("production workspace redesign", () => {
  it("keeps execution unfiltered by the tracking date and preserves historical deep links", () => {
    const cycle = source("production-cycle.tsx");
    expect(cycle).toContain('if (view === "execution")');
    expect(cycle).toContain('view === "tracking" && !!kitchenId');
    expect(cycle).toContain("<OperationsBoard key={kitchenId}");
    expect(cycle).toContain("movementId=");
    expect(getProductionDashboardTab("?tab=tracking", false)).toBe("tracking");
    for (const tab of ["operations", "workplan", "unified-planning", "settings-review", "legacy"] as const)
      expect(getProductionDashboardTab(`?tab=${tab}`, false)).toBe(tab);
    expect(getProductionDashboardTab("?tab=recipes", false)).toBe("cycle");
  });
  it("bounds execution rows while retaining every demand in the all-deadline scope", () => {
    const demands = Array.from({ length: 31 }, (_, i) => ({
      orderId: i + 1, orderItemId: i + 1, orderNumber: `CK-${i}`, name: `صنف ${i}`,
      neededDate: `2026-08-${String(i % 28 + 1).padStart(2, "0")}`,
      unit: "قطعة", uncoveredQuantity: i % 3 ? 2 : 0, linkedUnfinishedQuantity: 0, catalogInactive: false,
    }));
    const result = selectOperationsDemands(demands as Parameters<typeof selectOperationsDemands>[0], {});
    expect(result.filtered).toHaveLength(31);
    expect(result.pageItems).toHaveLength(10);
    expect(result.totalPages).toBe(4);
    expect(selectOperationsDemands(demands as Parameters<typeof selectOperationsDemands>[0], { page: 4 }).pageItems).toHaveLength(1);
  });
  it("keeps tracking bounded, settings secondary and the responsive tabs on one row", () => {
    const cycle = source("production-cycle.tsx");
    const page = readFileSync("client/src/pages/production-dashboard.tsx", "utf8");
    const css = source("production-workspace.css");
    expect(cycle).toContain("orders.slice(0, visibleOrders)");
    expect(cycle).toContain("rows.slice(0, visibleCount)");
    expect(cycle).toContain("<details className=\"rounded bg-muted/40");
    expect(page).toContain('value="tracking"');
    expect(page).toContain('value="settings-review"');
    expect(page).toContain("<RecipeModeControl");
    expect(source("operations-board.tsx")).toContain('data-testid="execution-recipe-mode"');
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).not.toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });
});