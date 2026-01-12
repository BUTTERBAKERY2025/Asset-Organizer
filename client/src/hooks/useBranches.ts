import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { Branch } from "@shared/schema";

export function useBranches() {
  const { user, isAdmin } = useAuth();

  const { data: allBranches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredBranches = (() => {
    if (isAdmin) {
      return allBranches;
    }
    if (user?.branchId) {
      return allBranches.filter((b) => b.id === user.branchId);
    }
    return [];
  })();

  const userBranchId = isAdmin ? null : (user?.branchId || null);

  const canSelectBranch = isAdmin;

  return {
    branches: filteredBranches,
    allBranches,
    isLoading,
    userBranchId,
    canSelectBranch,
    defaultBranchId: userBranchId || (filteredBranches[0]?.id ?? null),
  };
}
