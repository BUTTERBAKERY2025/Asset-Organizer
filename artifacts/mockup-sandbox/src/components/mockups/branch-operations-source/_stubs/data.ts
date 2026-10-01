import { syntheticBranch, syntheticBranches } from "./fixtures";

const user = { id: "synthetic-preview-user", firstName: "حساب معاينة تجريبي", role: "branch_manager", branchId: syntheticBranch.id };
export function useAuth() {
  return {
    user, activeBranch: syntheticBranch, activeBranchId: syntheticBranch.id,
    allowedBranches: syntheticBranches, isAuthenticated: true, isLoading: false,
    isSwitchingBranch: false, isAdmin: false, isAttendanceClerk: false, isLoggingOut: false,
    switchBranch: async (id: string) => {
      if (id !== syntheticBranch.id) throw new Error("Synthetic sandbox branch only");
      return { activeBranchId: id, activeBranch: syntheticBranch };
    },
  };
}
export function useBranches() {
  return {
    branches: syntheticBranches, isLoading: false, isError: false,
    userBranchId: syntheticBranch.id, refetch: async () => ({ data: syntheticBranches }),
  };
}