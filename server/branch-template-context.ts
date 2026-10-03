import { storage } from "./storage";

/**
 * Explicitly reviewed routes whose handlers enforce getEffectiveBranchFilter
 * or canAccessBranch. Unknown routes get no manufactured resource context.
 */
export async function branchTemplateRouteContext(req: any, module: string, branches: string[]) {
  const path = req.path;
  const method = req.method;
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