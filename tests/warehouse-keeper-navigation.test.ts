import { describe, expect, it } from "vitest";
import { canShowWarehouseKeeperDestination } from "../client/src/lib/warehouse-keeper-navigation";

describe("keeper navigation matches main-warehouse backend scope", () => {
  it("retains main stock, transfers, own delivery and personal portal", () => {
    for (const href of ["/warehouse", "/warehouse-dashboard", "/warehouse-inventory", "/warehouse-movement-logs", "/transfer-requests?branchId=main_warehouse", "/driver-deliveries", "/my-portal"]) {
      expect(canShowWarehouseKeeperDestination("warehouse_keeper", href)).toBe(true);
    }
  });

  it("hides forbidden branch stock, managed warehouse receiving, reports and unrelated destinations", () => {
    for (const href of ["/", "/branch-operations", "/branch-stock", "/kitchen-warehouse-shipping", "/warehouse-reports", "/purchasing-requests", "/reverse-logistics", "/production-dashboard", "/central-kitchen-orders"]) {
      expect(canShowWarehouseKeeperDestination("warehouse_keeper", href)).toBe(false);
      expect(canShowWarehouseKeeperDestination("admin", href)).toBe(true);
    }
  });
});