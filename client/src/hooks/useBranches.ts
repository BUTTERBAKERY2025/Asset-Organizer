import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { Branch } from "@shared/schema";

export function useBranches() {
  const { user, isAdmin } = useAuth();

  // Server now filters branches based on user role, so we get pre-filtered data
  const { data: branches = [], isLoading } = useQuery<Branch[]>({
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

  // For non-admins with single branch access, use that branch
  // For non-admins with multiple branches, userBranchId should be null to allow selection
  const userBranchId = isAdmin ? null : (branches.length === 1 ? branches[0]?.id : null);

  // User can select branch if:
  // 1. They are admin, OR
  // 2. They have access to more than one branch
  const canSelectBranch = isAdmin || branches.length > 1;

  // defaultBranchId: For single-branch users, use their branch; otherwise null (allow "all")
  const defaultBranchId = branches.length === 1 ? branches[0]?.id : null;

  return {
    branches, // Server-filtered: all for admins, allowed branches for non-admins
    isLoading,
    userBranchId,
    canSelectBranch,
    defaultBranchId,
  };
}
