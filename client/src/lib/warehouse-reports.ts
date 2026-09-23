export type WarehouseReportBranch = {
  id: string;
  name?: string;
};

export type WarehouseReportTransfer = {
  sourceBranchId?: string | null;
  destinationBranchId?: string | null;
};

export type WarehouseReportStock = {
  branchId: string;
  itemId: number;
  currentQuantity?: number | string | null;
};

export type WarehouseReportItem = {
  id: number;
  unit?: string | null;
};

export function resolveWarehouseReportScope(
  requestedBranchId: string | null | undefined,
  authorizedBranches: readonly WarehouseReportBranch[],
): string {
  if (!requestedBranchId || requestedBranchId === "all") return "all";
  return authorizedBranches.some((branch) => branch.id === requestedBranchId)
    ? requestedBranchId
    : "all";
}

export function warehouseBundleUrl(branchId: string): string {
  const params = new URLSearchParams();
  if (branchId !== "all") params.set("branchId", branchId);
  const query = params.toString();
  return `/api/warehouse/bundle${query ? `?${query}` : ""}`;
}

export function warehouseBackHref(branchId: string): string {
  if (branchId === "all") return "/warehouse";
  return `/warehouse?branchId=${encodeURIComponent(branchId)}`;
}

export function filterTransfersForBranch<T extends WarehouseReportTransfer>(
  transfers: readonly T[],
  branchId: string,
): T[] {
  if (branchId === "all") return [...transfers];
  return transfers.filter(
    (transfer) =>
      transfer.sourceBranchId === branchId ||
      transfer.destinationBranchId === branchId,
  );
}

export type StockByBranchAndUnit = {
  branchId: string;
  branchName: string;
  unit: string;
  quantity: number;
};

/**
 * Quantities are only combined when both their branch and unit match.
 * Adding pieces, kilograms, and litres into one "total" is not meaningful.
 */
export function aggregateStockByBranchAndUnit(
  stock: readonly WarehouseReportStock[],
  items: readonly WarehouseReportItem[],
  branches: readonly WarehouseReportBranch[],
): StockByBranchAndUnit[] {
  const itemUnits = new Map(items.map((item) => [item.id, item.unit?.trim() || "—"]));
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name || branch.id]));
  const totals = new Map<string, StockByBranchAndUnit>();

  for (const row of stock) {
    const quantity = Number(row.currentQuantity ?? 0);
    if (!Number.isFinite(quantity)) continue;
    const unit = itemUnits.get(row.itemId) || "—";
    const key = `${row.branchId}\u0000${unit}`;
    const existing = totals.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      totals.set(key, {
        branchId: row.branchId,
        branchName: branchNames.get(row.branchId) || row.branchId,
        unit,
        quantity,
      });
    }
  }

  return Array.from(totals.values());
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }

  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}