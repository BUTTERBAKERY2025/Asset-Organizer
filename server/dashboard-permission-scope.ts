import { contextualActionAllowed } from "./auth";
import { storage } from "./storage";

/** Dashboard summaries must authorize each contributing branch before SUM. */
export async function dashboardPermissionScope(
  req: any, modules: string[], branches: string[] | null, requestedBranch?: string,
): Promise<{ branchIds: string[] | null; canView: boolean }> {
  const snapshot = req.authPermissionDecisionSnapshot;
  if (snapshot?.branchTemplates?.length) {
    const candidates = [...new Set([...(branches ?? []),
      ...snapshot.branchTemplates.map((base: any) => base.branchId)])];
    const branchIds = candidates.filter(branchId =>
      (!requestedBranch || requestedBranch === "all" || requestedBranch === branchId)
      && modules.some(module => contextualActionAllowed(req, snapshot, module, "view", { branchId })));
    return { branchIds, canView: branchIds.length > 0 };
  }
  const allowed = req.currentUser?.id && (await Promise.all(
    modules.map(module => storage.hasPermission(req.currentUser.id, module, "view")),
  )).some(Boolean);
  return { branchIds: branches, canView: !!allowed };
}