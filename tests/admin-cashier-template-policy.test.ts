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
  const submissionTemplate = {
    ...content,
    permissions: [{ module: "cashier_journal", actions: ["create", "submit", "view"] }],
  };
  it("preserves explicit journal submission in admin and delegated approved templates", () => {
    const original = structuredClone(submissionTemplate);
    expect(eligibleAdminTemplatePermissions(submissionTemplate, null, "employee").permissions)
      .toEqual(submissionTemplate.permissions);
    expect(eligibleTemplatePermissions(submissionTemplate, { enabled: true, permissions: [] }).permissions)
      .toEqual(submissionTemplate.permissions);
    expect(submissionTemplate).toEqual(original);
  });
  it("does not manufacture create authority from a submit-only template", () => {
    const withoutCreate = { ...submissionTemplate, permissions: [{ module: "cashier_journal", actions: ["submit", "view"] }] };
    expect(() => eligibleAdminTemplatePermissions(withoutCreate, null, "employee"))
      .toThrow("إرسال يومية الكاشير يتطلب صلاحية إنشاء");
    expect(() => eligibleTemplatePermissions(withoutCreate, { enabled: true, permissions: [] }))
      .toThrow("إرسال يومية الكاشير يتطلب صلاحية إنشاء");
    expect(withoutCreate.permissions[0].actions).toEqual(["submit", "view"]);
  });
  it.each(["approve", "delete", "reject", "reopen", "post", "unpost"])("does not admit unrelated journal action %s", action => {
    const invalid = { ...submissionTemplate, permissions: [{ module: "cashier_journal", actions: ["create", "view", action] }] };
    expect(() => eligibleAdminTemplatePermissions(invalid, null, "employee")).toThrow();
    expect(() => eligibleTemplatePermissions(invalid, { enabled: true, permissions: [] })).toThrow();
  });
  it("preserves the complete reviewed cashier vocabulary without changing input or adding authority", () => {
    const complete = { ...content, permissions: [
      { module: "cashier_journal", actions: ["view", "view_list", "view_details", "create", "edit", "submit", "sign", "print", "export", "view_signatures"] },
      { module: "cashier", actions: ["view", "print", "export"] },
    ] };
    const original = structuredClone(complete);
    const expected = complete.permissions.map(p => ({ ...p, actions: [...p.actions].sort() })).sort((a,b) => a.module.localeCompare(b.module));
    expect(eligibleAdminTemplatePermissions(complete, null, "employee").permissions).toEqual(expected);
    expect(eligibleTemplatePermissions(complete, { enabled: true, permissions: [] }).permissions).toEqual(expected);
    expect(complete).toEqual(original);
  });
  it("reports all unsupported actions together rather than only the first", () => {
    try {
      eligibleAdminTemplatePermissions({ ...content, permissions: [{ module: "cashier_journal", actions: ["view", "approve", "delete", "reopen"] }] }, null, "employee");
      throw new Error("Expected rejection");
    } catch (error: any) {
      expect(error.code).toBe("ADMIN_TEMPLATE_PERMISSION_UNSUPPORTED");
      for (const action of ["approve", "delete", "reopen"]) expect(error.message).toContain(`cashier_journal:${action}`);
    }
  });
  it("does not turn signing into create authority or allow signing in other modules", () => {
    expect(() => eligibleAdminTemplatePermissions({ ...content, permissions: [{ module: "cashier_journal", actions: ["view", "sign"] }] }, null, "employee")).toThrow("يتطلب صلاحية إنشاء");
    expect(() => eligibleAdminTemplatePermissions({ ...content, permissions: [{ module: "smart_incentives_wallet", actions: ["view", "sign"] }] }, null, "employee")).toThrow();
  });
  it("does not authorize submission for unrelated modules", () => {
    expect(() => eligibleAdminTemplatePermissions({
      ...content, permissions: [{ module: "smart_incentives_wallet", actions: ["submit", "view"] }],
    }, null, "employee")).toThrow();
  });
  it("retains branch-scope, enabled-policy and view requirements for submission", () => {
    expect(() => eligibleAdminTemplatePermissions({ ...submissionTemplate, scopeType: "branches" }, null, "employee")).toThrow();
    expect(() => eligibleTemplatePermissions(submissionTemplate, { enabled: false, permissions: [] })).toThrow();
    expect(() => eligibleTemplatePermissions({ ...submissionTemplate, assignmentAuthority: "admin" }, { enabled: true, permissions: [] })).toThrow();
    expect(() => eligibleAdminTemplatePermissions({
      ...submissionTemplate, permissions: [{ module: "cashier_journal", actions: ["create", "submit"] }],
    }, null, "employee")).toThrow();
  });
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