import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { Branch } from "@shared/schema";

// A manager's desk is their primary branch, not an arbitrary extra grant.
// The server's branch list is the authorization boundary: never synthesize
// the primary branch when it is absent from that list.
export function visibleBranchesForUser<T extends { id: string }>(
  assigned: readonly T[],
  role: string | null | undefined,
  primaryBranchId: string | null | undefined,
): T[] {
  return role === "branch_manager"
    ? assigned.filter(branch => !!primaryBranchId && branch.id === primaryBranchId)
    : [...assigned];
}

export function useBranches() {
  const { user, isAdmin } = useAuth();
  const hasIntrinsicAllBranchAccess = user?.role === "production_development_manager";
  const isWarehouseKeeper = user?.role === "warehouse_keeper";

  // Server now filters branches based on user role, so we get pre-filtered data
  const { data: assignedBranches = [], isLoading, isFetching, isError, error, refetch } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour - branches rarely change
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    // Auth init (or persisted data) may have seeded this key under an older
    // permission scope. Revalidate the manager's branch list on entry.
    refetchOnMount: user?.role === "branch_manager" ? "always" : false,
  });
  const managerRefreshing = user?.role === "branch_manager" && isFetching;
  // A failed request must not expose stale branches or look like a confirmed
  // empty authorization scope.
  const branches = isError || managerRefreshing
    ? []
    : visibleBranchesForUser(assignedBranches, user?.role, user?.branchId);

  // For non-admins with single branch access, use that branch
  // For non-admins with multiple branches, userBranchId should be null to allow selection
  const userBranchId = isWarehouseKeeper ? "main_warehouse" : isAdmin || hasIntrinsicAllBranchAccess ? null : (branches.length === 1 ? branches[0]?.id : null);

  // User can select branch if:
  // 1. They are admin, OR
  // 2. They have access to more than one branch
  const canSelectBranch = !isWarehouseKeeper && (isAdmin || hasIntrinsicAllBranchAccess || branches.length > 1);

  // defaultBranchId: For single-branch users, use their branch; otherwise null (allow "all")
  const defaultBranchId = isWarehouseKeeper ? "main_warehouse" : branches.length === 1 ? branches[0]?.id : null;

  return {
    branches, // Server-filtered: all for admins, allowed branches for non-admins
    isLoading: isLoading || managerRefreshing,
    isError,
    error,
    refetch,
    userBranchId,
    canSelectBranch,
    defaultBranchId,
  };
}
