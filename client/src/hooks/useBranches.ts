import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { Branch } from "@shared/schema";

export function useBranches() {
  const { user, isAdmin } = useAuth();
  const hasIntrinsicAllBranchAccess = user?.role === "production_development_manager";
  const isWarehouseKeeper = user?.role === "warehouse_keeper";

  // Server now filters branches based on user role, so we get pre-filtered data
  const { data: assignedBranches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour - branches rarely change
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  // The branch manager's active desk is the primary assigned branch. Extra
  // RBAC branch grants must not offer a second request/receiving destination.
  const branches = user?.role === "branch_manager"
    ? assignedBranches.filter(branch => !!user.branchId && branch.id === user.branchId)
    : assignedBranches;

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
    isLoading,
    userBranchId,
    canSelectBranch,
    defaultBranchId,
  };
}
