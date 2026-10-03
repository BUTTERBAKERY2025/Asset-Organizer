import { storage } from "./storage";
import { db } from "./db";
import { branchComplaints, maintenanceTickets, materialTransfers, centralKitchenOrders,
  cashierDailyChallenges, productCommissions, branchAchievementBonus, cashierPointsLedger, cashierProductSales } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Explicitly reviewed routes whose handlers enforce getEffectiveBranchFilter
 * or canAccessBranch. Unknown routes get no manufactured resource context.
 */
export async function branchTemplateRouteContext(req: any, module: string, branches: string[]) {
  const path = req.path;
  const method = req.method;
  const incentiveResources = [
    ["smart_incentives_challenges", "challenges", cashierDailyChallenges],
    ["smart_incentives_commissions", "product-commissions", productCommissions],
    ["smart_incentives_commissions", "product-sales", cashierProductSales],
    ["smart_incentives_bonus", "branch-bonus", branchAchievementBonus],
    ["smart_incentives_wallet", "points-ledger", cashierPointsLedger],
  ] as const;
  for (const [permissionModule, segment, table] of incentiveResources) {
    if (module !== permissionModule) continue;
    const root = `/api/smart-incentives/${segment}`;
    if (path === root && method === "POST" && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    const match = path.match(new RegExp(`^${root}/([1-9]\\d*)(?:/[^/]+)?$`));
    if (match) {
      const [row] = await db.select({ branchId: table.branchId }).from(table)
        .where(eq(table.id, Number(match[1]))).limit(1);
      if (!row) return null;
      // Moving a record into another scope is not authorized by its old owner.
      if (req.body && Object.hasOwn(req.body, "branchId") && req.body.branchId !== row.branchId) return null;
      return row.branchId ? { kind: "resource" as const, branchId: row.branchId } : undefined;
    }
  }
  if (module === "smart_incentives_commissions" && method === "POST"
    && path === "/api/smart-incentives/product-commission-achievement") {
    const id = Number(req.body?.commissionId);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const row = await storage.getProductCommission(id);
    return row?.branchId ? { kind: "resource" as const, branchId: row.branchId } : null;
  }
  if (module === "smart_incentives_wallet" && method === "POST") {
    if (path === "/api/smart-incentives/calculate-batch" && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    const calculation = path.match(/^\/api\/smart-incentives\/calculate\/([1-9]\d*)$/);
    if (calculation) {
      const journal = await storage.getCashierJournal(Number(calculation[1]));
      return journal ? { kind: "resource" as const, branchId: journal.branchId } : null;
    }
  }
  if (module === "branch_supply") {
    if (path === "/api/warehouse/items" || /^\/api\/warehouse\/items\/[^/]+$/.test(path))
      return method === "GET" ? { kind: "collection" as const, branchIds: branches } : undefined;
    if (path === "/api/warehouse/material-transfers" && method === "GET")
      return { kind: "collection" as const, branchIds: branches };
    if (path === "/api/warehouse/material-transfers" && method === "POST"
      && typeof req.body?.destinationBranchId === "string")
      return { kind: "resource" as const, branchId: req.body.destinationBranchId };
    const transfer = path.match(/^\/api\/warehouse\/material-transfers\/([1-9]\d*)(?:\/[^/]+)?$/);
    if (transfer) {
      const [row] = await db.select({ branchId: materialTransfers.destinationBranchId })
        .from(materialTransfers).where(eq(materialTransfers.id, Number(transfer[1]))).limit(1);
      return row ? { kind: "resource" as const, branchId: row.branchId } : null;
    }
  }
  if (module === "central_kitchen_orders") {
    if (method === "POST" && path === "/api/central-kitchen-orders/preparation-sheet")
      return { kind: "collection" as const, branchIds: branches };
    const order = path.match(/^\/api\/central-kitchen-orders\/([1-9]\d*)(?:\/[^/]+)*$/);
    if (order) {
      const [row] = await db.select({ branchId: centralKitchenOrders.requestBranchId })
        .from(centralKitchenOrders).where(eq(centralKitchenOrders.id, Number(order[1]))).limit(1);
      return row ? { kind: "resource" as const, branchId: row.branchId } : null;
    }
    if (method === "POST" && path === "/api/central-kitchen-orders" && typeof req.body?.requestBranchId === "string")
      return { kind: "resource" as const, branchId: req.body.requestBranchId };
    if (method === "GET" && ["/api/central-kitchen-orders", "/api/central-kitchen-orders/pilot-metrics",
      "/api/central-kitchen-orders/kitchens", "/api/central-kitchen-orders/products",
      "/api/central-kitchen-orders/catalog-v2", "/api/central-kitchen-orders/availability",
      "/api/central-kitchen-orders/policy"].includes(path))
      return { kind: "collection" as const, branchIds: branches };
  }
  if (module === "branch_workforce") {
    if (method === "GET" && path === "/api/shift-management/bundle")
      return { kind: "collection" as const, branchIds: branches };
    if (method === "POST" && ["/api/employee-schedules/bulk", "/api/attendance/check-in-employee",
      "/api/attendance/check-out-employee"].includes(path)) {
      const branchId = req.body?.branchId ?? req.body?.schedules?.[0]?.branchId;
      if (typeof branchId === "string") return { kind: "resource" as const, branchId };
    }
  }
  const scopedTicket = module === "maintenance" ? "/api/maintenance-tickets"
    : module === "branch_complaints" ? "/api/branch-complaints" : null;
  if (scopedTicket && (path === scopedTicket || path.startsWith(scopedTicket + "/"))) {
    if (req.params.id) {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return null;
      const table = module === "maintenance" ? maintenanceTickets : branchComplaints;
      const [record] = await db.select({ branchId: table.branchId }).from(table).where(eq(table.id, id)).limit(1);
      return record ? { kind: "resource" as const, branchId: record.branchId } : null;
    }
    if (method === "POST" && path === scopedTicket && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    if (method === "GET") return { kind: "collection" as const, branchIds: branches };
  }
  const readCollections: Record<string, string[]> = {
    cashier_performance: ["/api/cashier-performance/bundle", "/api/cashier-performance-sales", "/api/performance-alerts",
      "/api/cashier-shift-targets", "/api/average-ticket-targets", "/api/average-ticket-targets/active"],
    smart_incentives_challenges: ["/api/smart-incentives/challenges", "/api/smart-incentives/challenges-as-targets"],
    smart_incentives_commissions: ["/api/smart-incentives/product-commissions", "/api/smart-incentives/product-sales"],
    smart_incentives_bonus: ["/api/smart-incentives/branch-bonus"],
    smart_incentives_wallet: ["/api/smart-incentives/points-ledger", "/api/smart-incentives/top-cashiers"],
  };
  if (method === "GET" && (readCollections[module]?.includes(path)
    || (module === "smart_incentives_wallet" && /^\/api\/smart-incentives\/points-summary\/[^/]+$/.test(path))))
    return { kind: "collection" as const, branchIds: branches };
  if (module === "cashier_performance" || module === "sales") {
    if (["POST", "PUT"].includes(method)
      && ["/api/shift-performance-tracking", "/api/shift-performance-tracking/upsert",
        "/api/performance-alerts", "/api/cashier-shift-targets", "/api/average-ticket-targets"].includes(path)
      && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    if (method === "GET" && /^\/api\/cashier-shift-targets\/cashier\/[^/]+$/.test(path))
      return { kind: "collection" as const, branchIds: branches };
    if (method === "GET" && /^\/api\/cashier-shift-targets\/branch\/[^/]+\/date\/[^/]+$/.test(path))
      return { kind: "resource" as const, branchId: req.params.branchId };
    const target = path.match(/^\/api\/(cashier-shift-targets|average-ticket-targets)\/([1-9]\d*)$/);
    if (target) {
      const row = target[1] === "cashier-shift-targets"
        ? await storage.getCashierShiftTarget(Number(target[2]))
        : await storage.getAverageTicketTarget(Number(target[2]));
      return row?.branchId ? { kind: "resource" as const, branchId: row.branchId } : undefined;
    }
    if (method === "POST" && path === "/api/performance-alerts/bulk-read")
      return { kind: "collection" as const, branchIds: branches };
    if (/^\/api\/performance-alerts\/unread\/[^/]+$/.test(path)
      || /^\/api\/shift-performance-tracking\/active\/[^/]+\/[^/]+\/[^/]+$/.test(path))
      return { kind: "resource" as const, branchId: req.params.branchId };
    const alert = path.match(/^\/api\/performance-alerts\/([1-9]\d*)(?:\/(?:read|acknowledge))?$/);
    const tracking = path.match(/^\/api\/shift-performance-tracking\/([1-9]\d*)$/);
    if (alert || tracking) {
      const record = alert ? await storage.getPerformanceAlert(Number(alert[1]))
        : await storage.getShiftPerformanceTracking(Number(tracking![1]));
      return record?.branchId ? { kind: "resource" as const, branchId: record.branchId } : null;
    }
  }
  if (module === "cashier_journal") {
    if (method === "GET" && ["/api/cashier-journals", "/api/cashier-journals/filters/cashiers",
      "/api/cashier-journals/stats/summary", "/api/cashier-payment-breakdowns",
      "/api/cashier-journals-report", "/api/reports/payment-mismatch-analysis"].includes(path))
      return { kind: "collection" as const, branchIds: branches };
    if (method === "POST" && path === "/api/cashier-journals" && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    const match = path.match(/^\/api\/cashier-journals\/([1-9]\d*)(?:\/(?:submit|post|approve|reject|audit-logs|attachments)(?:\/[1-9]\d*)?)?$/);
    if (match) {
      const journal = await storage.getCashierJournal(Number(match[1]));
      return journal ? { kind: "resource" as const, branchId: journal.branchId } : null;
    }
  }
  if (module === "quality_control") {
    if (method === "GET" && path === "/api/quality-checks")
      return { kind: "collection" as const, branchIds: branches };
    if (method === "POST" && path === "/api/quality-checks" && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    const match = path.match(/^\/api\/quality-checks\/([1-9]\d*)$/);
    if (match) {
      const check = await storage.getQualityCheck(Number(match[1]));
      return check ? { kind: "resource" as const, branchId: check.branchId } : null;
    }
  }
  if (module === "branch_stock" && method === "GET" && path === "/api/branch-stock-desk")
    return { kind: "collection" as const, branchIds: branches };
  if (module === "branch_stock" && method === "POST" && path === "/api/branch-stock-desk/count"
      && typeof req.body?.branchId === "string")
    return { kind: "resource" as const, branchId: req.body.branchId };
  return undefined;
}