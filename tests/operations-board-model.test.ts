import { describe, expect, it } from "vitest";
import type { CentralKitchenOperationDemand } from "../shared/central-kitchen-live";
import { OPERATIONS_PAGE_SIZE, selectOperationsDemands } from "../client/src/components/central-kitchen/operations-board-model";

const lines: CentralKitchenOperationDemand[] = Array.from({ length: 79 }, (_, i) => ({
  orderId: 100 + Math.floor(i / 3), orderItemId: i + 1, orderNumber: `CK-${100 + Math.floor(i / 3)}`,
  requestBranchId: `branch-${i % 3 + 1}`, requestBranchName: `فرع الاختبار ${i % 3 + 1}`, orderStatus: "approved",
  neededDate: `2026-07-${String(i % 28 + 1).padStart(2, "0")}`,
  kind: i % 8 === 0 ? "warehouse" : "product", catalogId: 300 + i, catalogInactive: i % 11 === 0,
  name: `صنف ${i + 1}`, unit: i % 2 ? "كيلو" : "قطعة", targetQuantity: i % 2 ? .5 : 3,
  availableQuantity: 0, reservedQuantity: 0, linkedUnfinishedQuantity: i % 5 === 0 ? 1 : 0,
  uncoveredQuantity: i % 4 === 0 ? 0 : i % 2 ? .5 : 3,
}));
describe("operations demand presentation", () => {
  it("bounds 79 lines and sorts deterministically by due date, order, then item", () => {
    const result = selectOperationsDemands([...lines].reverse(), {});
    expect(result.pageItems).toHaveLength(OPERATIONS_PAGE_SIZE);
    expect(result.totalPages).toBe(4);
    expect(result.filtered.map(d => d.orderItemId)).toEqual(selectOperationsDemands(lines, {}).filtered.map(d => d.orderItemId));
    expect(selectOperationsDemands(lines, { page: 4 }).pageItems).toHaveLength(4);
    expect(selectOperationsDemands(lines, { page: 50 }).currentPage).toBe(4);
  });
  it("keeps units separate and respects search and filters without changing any quantity", () => {
    const original = JSON.stringify(lines);
    const kilo = selectOperationsDemands(lines, { unit: "كيلو", filter: "uncovered" });
    expect(kilo.filtered.every(d => d.unit === "كيلو" && d.uncoveredQuantity > 0)).toBe(true);
    expect(kilo.filtered.every(d => d.targetQuantity === .5)).toBe(true);
    expect(selectOperationsDemands(lines, { search: "صنف 17" }).filtered.map(d => d.orderItemId)).toEqual([17]);
    expect(selectOperationsDemands(lines, { filter: "inactive" }).filtered.every(d => d.catalogInactive)).toBe(true);
    expect(JSON.stringify(lines)).toBe(original);
  });
});