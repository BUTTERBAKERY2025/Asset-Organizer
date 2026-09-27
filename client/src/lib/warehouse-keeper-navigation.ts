// The keeper's warehouse module is broader than the main-warehouse API scope.
// Keep navigation aligned with endpoints that serve main stock/source records.
const keeperDestinations = new Set([
  "/my-portal",
  "/warehouse",
  "/warehouse-dashboard",
  "/warehouse-inventory",
  "/warehouse-movement-logs",
  "/transfer-requests",
  "/driver-deliveries",
]);

export function canShowWarehouseKeeperDestination(role: string | undefined, href: string): boolean {
  return role !== "warehouse_keeper" || keeperDestinations.has(href.split("?")[0]);
}