import { branches } from "./fixtures";

const manager = { id: "preview-user", firstName: "حساب معاينة تجريبي", role: "branch_manager", branchId: branches[0].id, allowedBranches: branches.map(branch => branch.id) };
const keeper = { ...manager, role: "warehouse_keeper", branchId: "main_warehouse" };
export function useAuth() {
  const user = new URLSearchParams(window.location.search).get("role") === "keeper" ? keeper : manager;
  return { user, activeBranch: branches[0], activeBranchId: branches[0].id, allowedBranches: branches, isAuthenticated: true, isLoading: false, isAdmin: false, isLoggingOut: false, isSwitchingBranch: false };
}
export function useBranches() {
  const { user } = useAuth();
  return { branches, isLoading: false, isError: false, userBranchId: user.branchId, canSelectBranch: user.role !== "warehouse_keeper" && branches.length > 1, refetch: async () => ({ data: branches }) };
}
const modules = new Set(["warehouse", "branch_supply", "central_kitchen_orders", "delivery_tasks"]);
const canView = (module: string) => modules.has(module);
const canCreate = (module: string) => module === "branch_supply" || module === "warehouse";
const canEdit = canCreate;
const canExport = canCreate;
const cannot = (_module: string) => false;
const permissions = { canView, canCreate, canEdit, canExport, canApprove: cannot, canDelete: cannot, isLoading: false, isAdmin: false, isViewer: false, isEmployee: false, isAttendanceClerk: false };
export function usePermissions() { return permissions; }
export function useTranslation(_namespace?: string) {
  return { t: (key: string) => { throw new Error(`Translation fixture not provided: ${key}`); }, i18n: { language: "ar" } };
}