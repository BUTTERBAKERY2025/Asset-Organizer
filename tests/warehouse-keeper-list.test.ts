import { describe, expect, it } from "vitest";
import { filterWarehouseTransfers, pageWarehouseTransfers } from "../client/src/lib/warehouse-keeper-list";

const rows = [
  { id: 1, sourceBranchId: "main_warehouse", destinationBranchId: "branch_a", transferNumber: "M-001", status: "pending", destinationBranchName: "North" },
  { id: 2, sourceBranchId: "main_warehouse", destinationBranchId: "kitchen", transferNumber: "M-002", status: "approved", stockPostingPolicy: "on_dispatch", destinationBranchName: "Central kitchen" },
  { id: 3, sourceBranchId: "branch_a", destinationBranchId: "main_warehouse", transferNumber: "M-003", status: "pending" },
  { id: 4, sourceBranchId: "other", destinationBranchId: "branch_a", transferNumber: "M-004", status: "pending" },
];
const base = { keeper: true, status: "all", branch: "all", incomingOnly: false, kitchenRawMode: false, search: "" };

describe("warehouse operational list", () => {
  it("keeps only main-warehouse source, including kitchen destinations", () => {
    expect(filterWarehouseTransfers(rows, base).map(row => row.id)).toEqual([1, 2]);
  });
  it("filters status, destination and search within the same authorized list", () => {
    expect(filterWarehouseTransfers(rows, { ...base, status: "approved", branch: "kitchen", search: "central" }).map(row => row.id)).toEqual([2]);
    expect(filterWarehouseTransfers(rows, { ...base, branch: "branch_a", search: "M-004" })).toEqual([]);
  });
  it("clamps stale pages and does not duplicate rows", () => {
    const list = Array.from({ length: 43 }, (_, index) => index + 1);
    expect(pageWarehouseTransfers(list, 2).rows).toEqual(list.slice(20, 40));
    expect(pageWarehouseTransfers(list, 7)).toEqual({ rows: [41, 42, 43], currentPage: 3, pageCount: 3 });
    expect(pageWarehouseTransfers([], 4)).toEqual({ rows: [], currentPage: 1, pageCount: 1 });
  });
});