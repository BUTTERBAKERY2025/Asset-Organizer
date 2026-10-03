import { eq } from "drizzle-orm";
import { materialTransfers } from "@shared/schema";
import { db } from "./db";
import { contextualActionAllowed, getAllowedBranchIds, requirePermission } from "./auth";

/** Choose authority for this request, never from another branch's template. */
export function branchTransferPermission(action: "view" | "create" | "edit", legacySupply: (req: any) => boolean) {
  return async (req: any, res: any, next: any) => {
    const snapshot = req.authPermissionDecisionSnapshot;
    if (!snapshot?.branchTemplates?.length)
      return requirePermission(legacySupply(req) ? "branch_supply" : "warehouse", action)(req, res, next);
    try {
      let source: string | undefined, destination: string | undefined;
      const resource = req.path.match(/^\/api\/warehouse\/material-transfers\/([1-9]\d*)(?:\/[^/]+)?$/);
      if (resource) {
        const [row] = await db.select({
          source: materialTransfers.sourceBranchId, destination: materialTransfers.destinationBranchId,
        }).from(materialTransfers).where(eq(materialTransfers.id, Number(resource[1]))).limit(1);
        if (!row) return res.status(404).json({ error: "التحويل غير موجود" });
        source = row.source ?? "main_warehouse";
        destination = row.destination;
      } else if (req.method === "POST" && req.path === "/api/warehouse/material-transfers") {
        source = req.body?.sourceBranchId ?? "main_warehouse";
        destination = req.body?.destinationBranchId;
      }
      const requested = req.params.branchId ?? req.query.branchId ?? req.query.destinationBranchId;
      const candidates = [...new Set([...(getAllowedBranchIds(req) ?? []),
        ...snapshot.branchTemplates.map((base: any) => base.branchId)])] as string[];
      const can = (module: string, branchId: string) =>
        contextualActionAllowed(req, snapshot, module, action, { branchId });
      const supplyCandidates = destination ? [destination]
        : typeof requested === "string" && requested !== "all" ? [requested] : candidates;
      const warehouseCandidates = destination
        ? req.path.endsWith("/confirm-delivery") ? [destination]
          : action === "view" ? [source!, destination] : [source!]
        : supplyCandidates;
      const warehouseBranches = warehouseCandidates.filter(id => can("warehouse", id));
      const supplyBranches = supplyCandidates.filter(id => can("branch_supply", id));
      // A branch request is not authority over an outbound branch shipment.
      const useSupply = supplyBranches.length > 0
        && (warehouseBranches.length === 0 || source === "main_warehouse");
      req.branchSupplyRouteMode = useSupply;
      const module = useSupply ? "branch_supply" : "warehouse";
      const authorized = useSupply ? supplyBranches : warehouseBranches;
      if (!authorized.length) return res.status(403).json({ error: "غير مصرح بهذا الإجراء في الفرع" });
      req.permissionResourceContext = destination || req.params.branchId
        ? { kind: "resource", branchId: authorized[0] }
        : { kind: "collection", branchIds: authorized };
      return requirePermission(module, action)(req, res, next);
    } catch {
      return res.status(500).json({ error: "تعذر التحقق من صلاحيات التحويل" });
    }
  };
}