import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

type AllowedBranch = { id: string };

export function resolveNavigationBranch(
  search: string,
  branches: AllowedBranch[],
  activeBranchId?: string | null,
  userBranchId?: string | null,
): { hasBranchParam: boolean; branchId: string | null } {
  const params = new URLSearchParams(search);
  const hasBranchParam = params.has("branchId");
  if (!hasBranchParam) return { hasBranchParam: false, branchId: null };

  const requested = params.get("branchId")?.trim() || "";
  const allowed = new Set(branches.map((branch) => branch.id));
  if (requested && requested.toLowerCase() !== "all" && allowed.has(requested)) {
    return { hasBranchParam: true, branchId: requested };
  }

  // A linked, invalid scope must never broaden to "all".
  const safeBranch = [activeBranchId, userBranchId].find((id) => id && allowed.has(id))
    || branches[0]?.id
    || null;
  return { hasBranchParam: true, branchId: safeBranch };
}

export function useBranchNavigation(
  branches: AllowedBranch[],
  branchesLoading: boolean,
  userBranchId?: string | null,
) {
  const { activeBranchId } = useAuth();
  const search = typeof window === "undefined" ? "" : window.location.search;

  return useMemo(() => {
    const result = resolveNavigationBranch(search, branches, activeBranchId, userBranchId);
    return {
      ...result,
      isResolving: result.hasBranchParam && branchesLoading,
    };
  }, [search, branches, branchesLoading, activeBranchId, userBranchId]);
}