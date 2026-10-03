const branches = [{ id: "fixture-branch", name: "فرع الاختبار" }];
export function useBranches() {
  return { branches, userBranchId: "fixture-branch", canSelectBranch: false, defaultBranchId: "fixture-branch", isLoading: false, isError: false };
}