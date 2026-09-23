export type SupplySource = "kitchen" | "warehouse";

/** Separate authoritative workflows; this URL never creates a stock movement. */
export function branchSupplyUrl(source: SupplySource, branchId: string | null, create = false) {
  const params = new URLSearchParams({ from: "branch-supply" });
  if (branchId && branchId !== "all") params.set("branchId", branchId);
  if (create && source === "warehouse") params.set("create", "1");
  return `${source === "kitchen" ? "/central-kitchen-orders" : "/transfer-requests"}?${params}`;
}