export type WarehouseListTransfer = {
  id: number;
  sourceBranchId: string;
  destinationBranchId: string;
  transferNumber: string;
  sourceBranchName?: string;
  destinationBranchName?: string;
  driverName?: string;
  status: string;
  stockPostingPolicy?: string;
};

export const WAREHOUSE_PAGE_SIZE = 20;

export function filterWarehouseTransfers<T extends WarehouseListTransfer>(
  transfers: T[],
  options: {
    keeper: boolean;
    status: string;
    branch: string;
    incomingOnly: boolean;
    kitchenRawMode: boolean;
    search: string;
  },
): T[] {
  const query = options.search.trim().toLocaleLowerCase();
  return transfers.filter(transfer => {
    if (options.keeper && transfer.sourceBranchId !== "main_warehouse") return false;
    if (options.status !== "all" && transfer.status !== options.status) return false;
    if (options.kitchenRawMode && transfer.stockPostingPolicy !== "on_dispatch") return false;
    if (options.incomingOnly && transfer.destinationBranchId !== options.branch) return false;
    if (options.branch !== "all" && transfer.destinationBranchId !== options.branch
      && (!options.keeper && transfer.sourceBranchId !== options.branch)) return false;
    if (!query) return true;
    return [transfer.transferNumber, transfer.sourceBranchName, transfer.destinationBranchName, transfer.driverName]
      .some(value => value?.toLocaleLowerCase().includes(query));
  });
}

export function pageWarehouseTransfers<T>(rows: T[], page: number, pageSize = WAREHOUSE_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)), pageCount);
  return { rows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), currentPage, pageCount };
}