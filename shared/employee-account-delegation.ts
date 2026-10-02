/** Narrow employee-account API. Never includes HR fields or stored credentials. */
export interface DelegatedPermission {
  module: string;
  actions: string[];
}

export interface EmployeeAccountPolicy {
  /** Prospective authority: disabling/narrowing does not silently revoke existing
   * account access. Directory and suspension remain available. Permission
   * reductions into the current ceiling remain allowed for individually selected
   * employees in writable branches; creation/reactivation require enabled approval.
   * Withdrawing employee selection stops every manager mutation without changing
   * the employee account itself. Explicitly reduce or suspend existing accounts.
   */
  enabled: boolean;
  permissions: DelegatedPermission[];
}

export interface DelegatedEmployeeAccount {
  employeeId: number;
  employeeName: string;
  branchId: string;
  branchName: string;
  hasAccount: boolean;
  /** Roster visibility never implies account-management authority. Account
   * details are omitted unless allowed; protected linked rows still haveAccount.
   */
  management: {
    allowed: boolean;
    reason: "allowed" | "not_selected" | "read_only_branch" | "protected_account";
  };
  account: null | {
    id: string;
    username: string | null;
    isActive: "active" | "inactive";
    permissions: DelegatedPermission[];
    canReactivate: boolean;
  };
}

export interface EmployeeAccountTemplate {
  id: string;
  name: string;
  permissions: DelegatedPermission[];
}

/** GET /api/operations/employee-accounts (admin or operations_manager). */
export interface EmployeeAccountsResponse {
  branches: Array<{ id: string; name: string }>;
  employees: DelegatedEmployeeAccount[];
  policy: EmployeeAccountPolicy;
  templates: EmployeeAccountTemplate[];
  /** Approved choices for ops (safe maximum for admin). When policy is disabled,
   * these are reduction-only choices, not permission to grant new access.
   */
  availablePermissions: DelegatedPermission[];
}

export interface EmployeeAccountManagersResponse {
  managers: Array<{
    id: string;
    name: string;
    branches: Array<{ id: string; name: string; canManage: boolean }>;
  }>;
}

export interface EmployeeAccountManagerSelectionResponse {
  managerId: string;
  revision: string;
  employees: Array<{
    employeeId: number;
    employeeName: string;
    branchId: string;
    branchName: string;
    hasAccount: boolean;
    eligible: boolean;
    reason: "allowed" | "read_only_branch" | "protected_account";
  }>;
  selectedEmployeeIds: number[];
}

export interface EmployeeAccountManagerSelectionInput {
  employeeIds: number[];
  revision: string;
}

/** POST .../:employeeId and PUT .../:employeeId/permissions. Strict: no other fields. */
export interface EmployeeAccountPermissionsInput {
  permissions: DelegatedPermission[];
}

/** PATCH .../:employeeId/status. */
export interface EmployeeAccountStatusInput {
  isActive: "active" | "inactive";
}

/** POST atomically generates + creates. Credentials appear ONLY in this response.
 * The UI button must say: توليد وإنشاء الحساب. No preview/edit/reset endpoint.
 * Other mutations return { employee }, policy PUT returns { policy }.
 * PUT /api/admin/employee-account-policy accepts EmployeeAccountPolicy.
 * Errors use { error: string, code?: string }.
 */
export interface EmployeeAccountCreatedResponse {
  employee: DelegatedEmployeeAccount;
  credentials: { username: string; password: string };
}

export interface EmployeeTemplateAssignmentInput {
  templateId: number;
  version: number;
  branchId: string;
  reason: string;
  expectedAssignmentRevision: string;
}
export interface EmployeeTemplateAssignment {
  templateId: number;
  version: number;
  branchId: string;
  revision: string;
  assignedAt: string;
  assignedBy: string;
  reason: string;
}
export interface EmployeeTemplateAssignmentResponse {
  employeeId: number;
  branchId: string;
  assignment: EmployeeTemplateAssignment | null;
  currentPermissions: DelegatedPermission[];
  expectedAssignmentRevision: string;
}
export interface EmployeeJobTemplateSummary {
  templateId: number;
  version: number;
  key: string;
  name: string;
  scopeType: "branch" | "self" | "assigned_tasks";
  permissions: DelegatedPermission[];
  approvedAt: string;
}
export interface EmployeeJobTemplatesResponse {
  templates: EmployeeJobTemplateSummary[];
}
export interface EmployeeTemplateAssignedResponse {
  employee: DelegatedEmployeeAccount;
  assignment: EmployeeTemplateAssignment;
}
export interface EmployeeTemplateAccountCreatedResponse extends EmployeeTemplateAssignedResponse {
  credentials: { username: string; password: string };
}

/** Immutable security ceiling. Admin policy and all templates are subsets. */
export const EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS: DelegatedPermission[] = [
  { module: "cashier_journal", actions: ["view", "create", "edit"] },
  { module: "quality_control", actions: ["view", "create"] },
  { module: "maintenance", actions: ["view", "create", "edit"] },
  { module: "branch_complaints", actions: ["view", "create", "edit"] },
  { module: "delivery_tasks", actions: ["view", "edit"] },
  { module: "branch_supply", actions: ["view", "create", "edit"] },
  { module: "central_kitchen_orders", actions: ["view", "create", "edit"] },
  { module: "branch_stock", actions: ["view", "edit"] },
  { module: "branch_workforce", actions: ["view", "create", "edit"] },
];

// Intentionally excluded: users/RBAC/security/settings, HR/payroll/attendance
// (PII/biometrics), inventory (global branch creation/import/accounting exports),
// shifts (global schedule templates), dashboard/operations (mixed broad APIs),
// production (mixed legacy/global source routes), warehouse, finance, approvals,
// deletion, exports and every unknown module. Expanding this ceiling requires
// reviewing *all* consumers of the module, not trusting its display label.
// branch_supply/central_kitchen_orders include physical receiving only at the
// destination (kitchen assigned-receiver rules still apply). branch_stock and
// branch_workforce are dedicated desks, not aliases for inventory/shifts/HR.