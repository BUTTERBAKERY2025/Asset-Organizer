import { describe, expect, it } from "vitest";
import {
  actorMayManage, branchMayManage, DEFAULT_POLICY, delegationTemplates,
  generatedCredentials, isLegacyAccountPath, permissionsInput, policyInput,
  statusInput, targetMayManage, validatePermissions,
} from "../server/employee-account-delegation-policy";
import { EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS } from "../shared/employee-account-delegation";

const safe = [{ module: "cashier_journal", actions: ["view"] }];
const approved = { enabled: true, permissions: EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS };
const employee = { id: "employee", role: "employee", branchId: "a", jobTitle: null };
describe("employee account delegation security policy", () => {
  it("starts disabled and grants nothing", () => expect(DEFAULT_POLICY).toEqual({ enabled: false, permissions: [] }));
  it.each(["viewer", "employee", "branch_manager", "hr_manager", "financial_manager", "business_owner",
    "auditor", "external_auditor", "production_development_manager", "attendance_clerk", "warehouse_keeper"])(
    "does not elevate actor role %s", role => expect(() => actorMayManage({ role, isActive: "active" })).toThrow());
  it("only an active admin can edit the delegation policy", () => {
    expect(() => actorMayManage({ role: "operations_manager", isActive: "active" }, true)).toThrow();
    expect(() => actorMayManage({ role: "admin", isActive: "inactive" }, true)).toThrow();
    expect(() => actorMayManage({ role: "admin", isActive: "active" }, true)).not.toThrow();
  });
  it("does not substitute a default, active or global branch for an explicit grant", () => {
    expect(() => branchMayManage({ role: "operations_manager" }, "a", [])).toThrow();
    expect(() => branchMayManage({ role: "operations_manager" }, "a", ["all_branches"])).toThrow();
    expect(() => branchMayManage({ role: "operations_manager" }, "a", ["b"])).toThrow();
    expect(() => branchMayManage({ role: "operations_manager" }, "a", ["a"])).not.toThrow();
    expect(() => branchMayManage({ role: "admin" }, "main_warehouse", ["main_warehouse"])).toThrow();
  });
  it.each(["admin", "branch_manager", "operations_manager", "business_owner", "hr_specialist", "financial_manager",
    "warehouse_keeper", "attendance_clerk", "auditor", "delivery", "unknown"])("protects target %s", role => {
    expect(() => targetMayManage("operator", { ...employee, role }, "a", ["a"], 0, 0, safe, approved)).toThrow();
  });
  it("protects self, all extra branches, role inheritance, overrides, and effective elevated grants", () => {
    expect(() => targetMayManage("employee", employee, "a", ["a"], 0, 0, safe, approved)).toThrow();
    expect(() => targetMayManage("operator", employee, "a", ["a", "b"], 0, 0, safe, approved)).toThrow();
    expect(() => targetMayManage("operator", { ...employee, branchId: null }, "a", [], 0, 0, safe, approved)).toThrow();
    expect(() => targetMayManage("operator", employee, "a", ["a"], 1, 0, safe, approved)).toThrow();
    expect(() => targetMayManage("operator", employee, "a", ["a"], 0, 1, safe, approved)).toThrow();
    expect(() => targetMayManage("operator", employee, "a", ["a"], 0, 0, [{ module: "users", actions: ["view"] }], approved)).toThrow();
    expect(() => targetMayManage("operator", { ...employee, jobTitle: "delivery" }, "a", ["a"], 0, 0, safe,
      { enabled: true, permissions: safe })).not.toThrow();
  });
  it.each(["employee", "viewer"])("accepts only ordinary scoped %s targets", role => {
    expect(() => targetMayManage("operator", { ...employee, role }, "a", ["a"], 0, 0, safe, approved)).not.toThrow();
  });
  it.each(["users", "rbac_management", "settings", "security", "hr_management", "inventory", "shifts",
    "attendance", "production", "warehouse", "*", "unknown"])("rejects forbidden or unverified %s even in admin policies", module => {
    expect(() => validatePermissions([{ module, actions: ["view"] }])).toThrow();
  });
  it("rejects a forged action, escalation beyond approval, duplicates, and wildcard grants", () => {
    for (const actions of [["approve"], ["delete"], ["*"], ["export"]])
      expect(() => validatePermissions([{ module: "cashier_journal", actions }])).toThrow();
    expect(() => validatePermissions([{ module: "cashier_journal", actions: ["edit"] }], safe)).toThrow();
    expect(() => validatePermissions([...safe, ...safe])).toThrow();
    expect(() => validatePermissions([{ module: "cashier_journal", actions: ["view", "view"] }])).toThrow();
  });
  it("keeps presets inside the exact same ceiling as custom choices", () => {
    expect(delegationTemplates([])).toEqual([]);
    const templates = delegationTemplates(EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS);
    expect(templates.length).toBeGreaterThan(3);
    for (const template of templates) expect(validatePermissions(template.permissions)).toEqual(
      [...template.permissions].sort((a,b) => a.module.localeCompare(b.module)).map(p => ({ ...p, actions: [...p.actions].sort() })));
    expect(delegationTemplates(safe)).toEqual([{ id: "cashier", name: "كاشير", permissions: safe }]);
  });
  it.each(["username", "password", "role", "branchId", "linkedUserId", "firstName", "template", "userId"])(
    "rejects client-supplied %s", key => {
      expect(permissionsInput.safeParse({ permissions: safe, [key]: "forged" }).success).toBe(false);
      expect(policyInput.safeParse({ enabled: true, permissions: safe, [key]: "forged" }).success).toBe(false);
      expect(statusInput.safeParse({ isActive: "active", [key]: "forged" }).success).toBe(false);
    });
  it("generates short noneditable random usernames and strong unique secrets", () => {
    const credentials = Array.from({ length: 500 }, generatedCredentials);
    expect(new Set(credentials.map(c => c.username)).size).toBe(500);
    expect(new Set(credentials.map(c => c.password)).size).toBe(500);
    for (const c of credentials) {
      expect(c.username).toMatch(/^e[0-9a-f]{14}$/);
      expect(c.password.length).toBeGreaterThanOrEqual(32);
      expect(c.password).toMatch(/[A-Z]/);
      expect(c.password).toMatch(/[a-z]/);
      expect(c.password).toMatch(/\d/);
      expect(c.password).toContain("!");
    }
  });
  it.each([
    "/api/operations-employees", "/api/operations-employees/x/reapply-permissions",
    "/api/users", "/api/users/x/permissions", "/api/rbac/users/x/branches",
    "/api/rbac/users/x/overrides", "/api/rbac/roles/1/permissions", "/api/security/users/x/settings",
    "/api/admin/portal-accounts/bulk-generate", "/api/branch-employees/1/create-account",
    "/api/branch-employees/1/reset-password", "/api/branch-employees/1/link-user",
    "/api/branch-employees/1/unlink-user", "/API/USERS/", "/api/%75sers",
    "/api/hr/onboarding/1/convert", "/api/governance/shareholders/1/create-account",
    "/api/governance/shareholders/1/reset-password", "/api/audit/auditor-accounts",
    "/api/backups", "/api/backups/tables", "/api/backups/1/download", "/api/backups/1/restore",
  ])("guards legacy account path %s for reads as well as writes", path => {
    for (const method of ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"])
      expect(isLegacyAccountPath(path, method)).toBe(true);
  });
  it("blocks linkedUserId smuggling on generic employee writes but not the narrow route", () => {
    expect(isLegacyAccountPath("/api/branch-employees/1", "PUT", { linkedUserId: "admin" })).toBe(true);
    expect(isLegacyAccountPath("/api/operations/employee-accounts/1", "POST")).toBe(false);
    expect(isLegacyAccountPath("/api/auth/me", "GET")).toBe(false);
  });
});