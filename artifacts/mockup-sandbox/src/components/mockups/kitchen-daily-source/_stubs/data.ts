import { branches, isOperationsPreview, operationsBranches } from "./fixtures";

const manager = {
  id: "synthetic-medina-manager", firstName: "مدير", lastName: "الفرع التجريبي",
  role: "branch_manager", branchId: "medina", jobTitle: "branch_manager",
  allowedBranches: ["medina"],
};
const operationsManager = {
  id: "synthetic-operations-manager", firstName: "مدير", lastName: "التشغيل التجريبي",
  role: "operations_manager", branchId: "synthetic-kitchen", jobTitle: "operations_manager",
  allowedBranches: operationsBranches.map(branch => branch.id),
};
export function useAuth() {
  const operations = isOperationsPreview();
  const user = operations ? operationsManager : manager;
  const allowedBranches = operations ? operationsBranches : branches;
  return {
    user, activeBranch: allowedBranches.find(branch => branch.id === user.branchId),
    activeBranchId: user.branchId, allowedBranches, isAuthenticated: true, isLoading: false,
    isAdmin: false, isLoggingOut: false, isSwitchingBranch: false,
  };
}
export function useBranches() {
  const operations = isOperationsPreview();
  const allowedBranches = operations ? operationsBranches : branches;
  return { branches: allowedBranches, userBranchId: operations ? "synthetic-kitchen" : "medina", canSelectBranch: operations, isLoading: false, isError: false, refetch: async () => ({ data: allowedBranches }) };
}
const visible = new Set(["branch_supply", "central_kitchen_orders", "delivery_tasks"]);
const canView = (module: string) => visible.has(module);
const canCreate = (module: string) => module === "central_kitchen_orders" || module === "branch_supply";
const canEdit = canCreate;
const canExport = (module: string) => module === "central_kitchen_orders";
const cannot = (_module: string) => false;
const permissions = {
  canView, canCreate, canEdit, canExport, canApprove: cannot, canDelete: cannot,
  hasPermission: (module: string, action: string) => action === "view" ? canView(module)
    : action === "create" ? canCreate(module) : action === "edit" ? canEdit(module)
      : action === "export" ? canExport(module) : false,
  isLoading: false, isAdmin: false, isViewer: false, isEmployee: false, isAttendanceClerk: false,
};
const operationsVisible = new Set(["central_kitchen_orders", "production", "delivery_tasks", "branch_supply", "warehouse"]);
const operationsCanView = (module: string) => operationsVisible.has(module);
const operationsCanCreate = (module: string) => ["central_kitchen_orders", "branch_supply", "warehouse"].includes(module);
const operationsCanEdit = (module: string) => operationsVisible.has(module);
const operationsCanApprove = (module: string) => module === "central_kitchen_orders";
const operationsCanExport = (module: string) => operationsVisible.has(module);
const operationsPermissions = {
  ...permissions,
  canView: operationsCanView, canCreate: operationsCanCreate, canEdit: operationsCanEdit,
  canApprove: operationsCanApprove, canExport: operationsCanExport,
  hasPermission: (module: string, action: string) => action === "view" ? operationsCanView(module)
    : action === "create" ? operationsCanCreate(module) : action === "edit" ? operationsCanEdit(module)
      : action === "approve" ? operationsCanApprove(module) : action === "export" ? operationsCanExport(module)
        : action === "print" ? module === "central_kitchen_orders" : false,
};
export function usePermissions() { return isOperationsPreview() ? operationsPermissions : permissions; }
export function useTranslation(_namespace?: string) {
  return { t: (key: string) => { throw new Error(`Missing synthetic translation: ${key}`); }, i18n: { language: "ar" } };
}