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
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour - branches rarely change
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const userBranchId = isAdmin ? null : (user?.branchId || null);

  const canSelectBranch = isAdmin;

  // defaultBranchId: For non-admins, use their assigned branch; for admins, use null (allow "all")
  const defaultBranchId = userBranchId || (branches[0]?.id ?? null);

  return {
    branches, // Server-filtered: all for admins, only user's branch for non-admins
    isLoading,
    userBranchId,
    canSelectBranch,
    defaultBranchId,
  };
}
