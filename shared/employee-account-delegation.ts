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
   * Employee coverage is automatic within writable authorized branches, subject
   * to account/role guards; it never creates accounts or applies templates itself.
   * Withdrawing branch write access stops mutations there without changing
   * employee accounts. Explicitly reduce or suspend existing accounts.
   */
  enabled: boolean;
  permissions: DelegatedPermission[];
}

export interface DelegatedEmployeeAccount {
  /** Actual bound version, not the latest catalog version. Undefined = unavailable. */
  templateAssignment?: { templateId: number; name: string | null; version: number; approved: boolean } | null;
  employeeId: number;
  employeeName: string;
  branchId: string;
  branchName: string;
  hasAccount: boolean;
  /** Roster visibility never implies account-management authority. Account
   * details are omitted unless allowed; protected linked rows still haveAccount.
   */
  management: {
    branchTemplateAllowed?: boolean;
    allowed: boolean;
    reason: "allowed" | "not_selected" | "read_only_branch" | "protected_account";
    /** Safe authorization explanation only; never includes account credentials. */
    blocker?: { code: string; message: string };
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
  /** Missing on old/manual-selection services; the coverage UI requires this marker. */
  scopeMode?: "all_branch_employees";
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
  /** Compatibility read field: current eligible employees, not a selection gate. */
  selectedEmployeeIds: number[];
}

/** Deprecated manual-selection request; the endpoint rejects writes in automatic branch mode. */
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
  /** Read-only independent additions; currentPermissions is BASE only. */
  additions: AdminAccountAddition[];
}
export interface AdminAccountAddition {
  id: number;
  module: string;
  action: string;
  allow: boolean;
  scopeType: "global" | "branch";
  branchId: string | null;
  /** Non-null only if a legacy writer changed a managed row into an
   * unsupported department scope; such a row remains ops-protected. */
  departmentId?: number | null;
  startsAt: string | null;
  endsAt: string | null;
  reason: string;
  revision: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  integrity: "managed" | "changed";
}
export interface PilotPermissionSource {
  module: string;
  action: string;
  source: "direct" | "role" | "override_grant" | "override_deny" | "intrinsic";
  scopeType: string;
  branchId: string | null;
  departmentId: number | null;
  startsAt: string | null;
  endsAt: string | null;
  temporalState: "active" | "future" | "expired" | "inactive" | "invalid";
  allowed: boolean;
}
export interface PilotAuthority {
  sourceMode: "direct" | "inherit" | null;
  effectivePermissions: DelegatedPermission[];
  sources: PilotPermissionSource[];
}
export interface EmployeeTemplatePilotResponse {
  employeeId: number;
  branchId: string;
  templateId: number;
  version: number;
  comparisonStatus: "known" | "unknown";
  canApply: boolean;
  blockedReasons: Array<{ code: string; message: string }>;
  expectedComparisonRevision: string;
  capturedAt: string;
  nextDecisionBoundary: string | null;
  scope: { kind: "employee_branch"; branchId: string; limitations: string[] };
  /** Contextual, effective base tuples only; intrinsic role/job authority and
   * independent overlays are shown separately in before/after.sources. */
  currentBase: DelegatedPermission[];
  proposedBase: DelegatedPermission[] | null;
  before: PilotAuthority | null;
  after: PilotAuthority | null;
  differences: null | {
    additions: DelegatedPermission[];
    removals: DelegatedPermission[];
    retained: DelegatedPermission[];
    retainedDenies: PilotPermissionSource[];
  };
  extras: AdminAccountAddition[];
  assignment: EmployeeTemplateAssignment | null;
}
export interface AdminAccountAdditionsResponse {
  employeeId: number;
  branchId: string;
  userId: string;
  additions: AdminAccountAddition[];
  capabilities: {
    globalModules: DelegatedPermission[];
    branchModules: DelegatedPermission[];
    unsupportedScopes: string[];
    globalScopeLabel: string;
  };
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
  /** Approved latest entries excluded for this employee/context, never selectable. */
  excludedTemplates?: Array<{ templateId: number; version: number; name: string; reason: string; code: string }>;
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