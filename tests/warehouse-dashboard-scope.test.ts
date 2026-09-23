import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  resolveWarehouseAllowedBranchIds,
  warehouseMovementIsInScope,
  warehouseTransferIsInScope,
} from "../server/warehouse-dashboard-scope";

describe("warehouse dashboard branch scope", () => {
  it("distinguishes unrestricted admin scope from an empty denied scope", () => {
    expect(resolveWarehouseAllowedBranchIds({ branchIds: null })).toBeNull();
    expect(resolveWarehouseAllowedBranchIds({ branchIds: [] })).toEqual([]);
  });

  it("makes an explicitly selected branch authoritative", () => {
    expect(resolveWarehouseAllowedBranchIds({
      singleBranchId: "branch-b",
      branchIds: ["branch-a", "branch-b"],
    })).toEqual(["branch-b"]);
  });

  it("preserves all allowed branches and removes duplicates", () => {
    expect(resolveWarehouseAllowedBranchIds({
      branchIds: ["branch-a", "branch-b", "branch-a"],
    })).toEqual(["branch-a", "branch-b"]);
  });

  it("includes transfers where an allowed branch is either endpoint", () => {
    const scope = ["branch-a", "branch-b"];
    expect(warehouseTransferIsInScope({
      sourceBranchId: "branch-a",
      destinationBranchId: "branch-z",
    }, scope)).toBe(true);
    expect(warehouseTransferIsInScope({
      sourceBranchId: "branch-z",
      destinationBranchId: "branch-b",
    }, scope)).toBe(true);
    expect(warehouseTransferIsInScope({
      sourceBranchId: "branch-z",
      destinationBranchId: "branch-y",
    }, scope)).toBe(false);
    expect(warehouseTransferIsInScope({
      sourceBranchId: "branch-a",
      destinationBranchId: "branch-b",
    }, [])).toBe(false);
  });

  it("fails closed for movement rows when the allowed list is empty", () => {
    expect(warehouseMovementIsInScope({ branchId: "branch-a" }, [])).toBe(false);
    expect(warehouseMovementIsInScope({ branchId: "branch-a" }, null)).toBe(true);
  });
});

describe("warehouse dashboard route contracts", () => {
  const routesSource = readFileSync(
    new URL("../server/routes.ts", import.meta.url),
    "utf8",
  );
  const storageSource = readFileSync(
    new URL("../server/storage.ts", import.meta.url),
    "utf8",
  );

  it("passes the complete allowed branch list into stats and bundle storage", () => {
    expect(routesSource).toContain(
      "storage.getWarehouseDashboardStats(allowedBranchIds)",
    );
    expect(routesSource).toContain(
      "transferFilters.branchIds = allowedBranchIds",
    );
  });

  it("does not silently turn bundle query failures into empty datasets", () => {
    const bundleRoute = routesSource.slice(
      routesSource.indexOf('app.get("/api/warehouse/bundle"'),
      routesSource.indexOf("// Warehouse Items", routesSource.indexOf('app.get("/api/warehouse/bundle"')),
    );
    expect(bundleRoute).not.toContain("catch (e) { return []; }");
  });

  it("scopes transfer counters by either endpoint and retains global low stock", () => {
    const statsMethod = storageSource.slice(
      storageSource.indexOf("async getWarehouseDashboardStats"),
      storageSource.indexOf("// Purchasing Requests", storageSource.indexOf("async getWarehouseDashboardStats")),
    );
    expect(statsMethod).toContain("materialTransfers.sourceBranchId");
    expect(statsMethod).toContain("materialTransfers.destinationBranchId");
    expect(statsMethod).toContain("This metric intentionally describes main-warehouse");
  });

  it("authorizes every warehouse report route before calling storage", () => {
    const reportRoutes = routesSource.slice(
      routesSource.indexOf('app.get("/api/warehouse/monthly-report"'),
      routesSource.indexOf("// ==================== Warehouse Notifications", routesSource.indexOf('app.get("/api/warehouse/monthly-report"')),
    );
    expect(reportRoutes.match(/getEffectiveBranchFilter\(req, branchId as string \| undefined\)/g))
      .toHaveLength(5);
    expect(reportRoutes.match(/resolveWarehouseAllowedBranchIds\(branchFilter\)/g))
      .toHaveLength(5);
    expect(reportRoutes.match(/return res\.status\(403\)/g)).toHaveLength(5);
  });

  it("applies branch arrays in SQL before warehouse report aggregation", () => {
    for (const methodName of [
      "getMonthlyMovementReport",
      "getItemAccountStatement",
      "getTopRequestedProducts",
      "getTopReceivedVsRequested",
      "getBranchPerformanceReport",
    ]) {
      const start = storageSource.indexOf(`async ${methodName}`);
      const nextMethod = storageSource.indexOf("\n  async ", start + 1);
      const method = storageSource.slice(start, nextMethod === -1 ? undefined : nextMethod);
      expect(method).toContain("allowedBranchIds");
      expect(method).toContain("inArray(materialTransfers.");
    }
  });

  it("makes movement-log storage honor multi-branch and empty scopes", () => {
    const start = storageSource.indexOf("async getWarehouseMovementLogs");
    const end = storageSource.indexOf("async createWarehouseMovementLog", start);
    const method = storageSource.slice(start, end);
    expect(method).toContain("branchIds?: string[]");
    expect(method).toContain("inArray(warehouseMovementLogs.branchId, filters.branchIds)");
  });

  it("scopes notification reads, unread counts, and read mutations", () => {
    const routes = routesSource.slice(
      routesSource.indexOf('app.get("/api/warehouse/notifications"'),
      routesSource.indexOf("// Executive", routesSource.indexOf('app.get("/api/warehouse/notifications"')),
    );
    expect(routes).toContain("storage.getUnreadNotificationCount(");
    expect(routes).toContain("storage.markNotificationAsRead(");
    expect(routes).toContain("resolveWarehouseAllowedBranchIds(branchFilter)");

    const notifications = storageSource.slice(
      storageSource.indexOf("async getWarehouseNotifications"),
      storageSource.indexOf("// ==========================================", storageSource.indexOf("async getWarehouseNotifications")),
    );
    expect(notifications).toContain("branchIds?: string[]");
    expect(notifications).toContain("inArray(warehouseNotifications.branchId");
    expect(notifications).toContain("inArray(warehouseNotifications.targetBranchId");
    expect(notifications).toContain("conditions: any[] = [eq(warehouseNotifications.id, id)]");
    expect(notifications).toContain("eq(warehouseNotifications.userId, userId)");
  });
});