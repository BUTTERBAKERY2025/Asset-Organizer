import { describe, it, expect } from "vitest";
import { ADMIN_CASHIER_PERMISSIONS, eligibleAdminTemplatePermissions, eligibleTemplatePermissions } from "../server/employee-template-assignment-policy";

const content = {
  key: "cashier", name: "كاشير", description: "", reviewNotes: "",
  scopeType: "branch", assignmentAuthority: "delegated_operations",
  permissions: [
    { module: "cashier_journal", actions: ["create", "view", "view_list"] },
    { module: "dashboard", actions: ["view", "view_list"] },
    { module: "smart_incentives_wallet", actions: ["view", "view_list"] },
  ],
};
describe("independent admin cashier template authority", () => {
  it("preserves the chosen permissions without using the operations ceiling", () => {
    expect(eligibleAdminTemplatePermissions(content, null, "employee").permissions).toEqual(content.permissions);
    expect(eligibleTemplatePermissions(content, { enabled: true, permissions: [] }).permissions).toEqual(content.permissions);
  });
  it("supports expressly admin-assigned templates", () => {
    expect(eligibleAdminTemplatePermissions({ ...content, assignmentAuthority: "admin" }, null, "employee").permissions).toEqual(content.permissions);
  });
  it.each(["users", "hr_salaries", "smart_incentives_settings"])("rejects unreviewed %s without silently deleting it", module => {
    expect(() => eligibleAdminTemplatePermissions({ ...content, permissions: [{ module, actions: ["view"] }] }, null, "employee")).toThrow();
  });
  it("does not turn read-only incentives into payout authority", () => {
    expect(() => eligibleAdminTemplatePermissions({ ...content, permissions: [{ module: "smart_incentives_wallet", actions: ["view", "approve"] }] }, null, "employee")).toThrow();
  });
  it.each(["self", "branches", "assigned_tasks"])("does not pretend unsupported %s confines these grants", scopeType => {
    expect(() => eligibleAdminTemplatePermissions({ ...content, scopeType }, null, "employee")).toThrow();
  });
});