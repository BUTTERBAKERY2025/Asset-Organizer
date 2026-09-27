import type { CentralKitchenOperationDemand } from "@shared/central-kitchen-live";

export type DemandFilter = "all" | "uncovered" | "production" | "inactive" | "covered";
export const OPERATIONS_PAGE_SIZE = 25;

/** Pure presentation transform: never aggregate quantities across units or mutate source demand. */
export function selectOperationsDemands(
  demands: CentralKitchenOperationDemand[],
  { search = "", filter = "all", unit = "all", page = 1 }: { search?: string; filter?: DemandFilter; unit?: string; page?: number },
) {
  const needle = search.trim().toLocaleLowerCase();
  const filtered = demands.filter(d =>
    (unit === "all" || d.unit === unit) &&
    (filter === "all" || filter === "uncovered" && d.uncoveredQuantity > 0 ||
      filter === "production" && d.linkedUnfinishedQuantity > 0 ||
      filter === "inactive" && d.catalogInactive ||
      filter === "covered" && d.uncoveredQuantity <= 0) &&
    (!needle || [d.orderNumber, d.name, String(d.orderId), String(d.orderItemId), d.neededDate || ""].some(value => value.toLocaleLowerCase().includes(needle)))
  ).sort((a, b) =>
    (a.neededDate || "9999-12-31").localeCompare(b.neededDate || "9999-12-31") ||
    a.orderId - b.orderId || a.orderItemId - b.orderItemId
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / OPERATIONS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return { filtered, pageItems: filtered.slice((currentPage - 1) * OPERATIONS_PAGE_SIZE, currentPage * OPERATIONS_PAGE_SIZE), currentPage, totalPages };
}