import { describe, expect, it } from "vitest";
import { assignmentSnapshotRevision, eligibleTemplatePermissions, templateAssignmentInput } from "../server/employee-template-assignment-policy";
import { EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS } from "../shared/employee-account-delegation";
import { JOB_TEMPLATE_PROPOSALS } from "../shared/job-permission-templates";

const policy = { enabled: true, permissions: EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS };
const cashier = JOB_TEMPLATE_PROPOSALS.find(p => p.key === "cashier")!;
const driver = JOB_TEMPLATE_PROPOSALS.find(p => p.key === "driver")!;
const worker = JOB_TEMPLATE_PROPOSALS.find(p => p.key === "worker")!;
const body = { templateId: 1, version: 1, branchId: "A", reason: "Reviewed",
  expectedAssignmentRevision: "a".repeat(64) };

describe("approved employee template assignment boundary", () => {
  it("requires an observed revision and a reason", () => {
    expect(templateAssignmentInput.parse(body)).toEqual(body);
    for (const key of ["expectedAssignmentRevision", "reason", "branchId", "templateId", "version"]) {
      const invalid: any = { ...body }; delete invalid[key];
      expect(templateAssignmentInput.safeParse(invalid).success).toBe(false);
    }
  });
  it.each(["permissions", "role", "jobTitle", "employeeId", "username", "password", "applyAll"])(
    "rejects body-controlled %s", key => {
      expect(templateAssignmentInput.safeParse({ ...body, [key]: [] }).success).toBe(false);
    });
  it.each([0, -1, 1.2, 2147483648])("rejects invalid numeric references %s", value => {
    expect(templateAssignmentInput.safeParse({ ...body, templateId: value }).success).toBe(false);
    expect(templateAssignmentInput.safeParse({ ...body, version: value }).success).toBe(false);
  });
  it("allows safe branch templates and explicit empty self scope", () => {
    expect(eligibleTemplatePermissions(cashier, policy, null).permissions).toEqual([
      { module: "cashier_journal", actions: ["create", "view"] },
    ]);
    expect(eligibleTemplatePermissions(worker, policy, null).permissions).toEqual([]);
  });
  it("does not mutate immutable approved content while normalizing", () => {
    const raw = structuredClone(cashier);
    eligibleTemplatePermissions(raw, policy, null);
    expect(raw).toEqual(cashier);
  });
  it("requires enabled delegation but trusts approved template contents independently of legacy checkboxes", () => {
    expect(() => eligibleTemplatePermissions(cashier, { ...policy, enabled: false })).toThrow();
    expect(eligibleTemplatePermissions(cashier, { enabled: true, permissions: [] }).permissions).toEqual(eligibleTemplatePermissions(cashier, policy).permissions);
    expect(() => eligibleTemplatePermissions(cashier, { enabled: true,
      permissions: [{ module: "cashier_journal", actions: ["view"] }] })).not.toThrow();
  });
  it("rejects administrator-only and multibranch templates", () => {
    expect(() => eligibleTemplatePermissions({ ...cashier, assignmentAuthority: "admin" }, policy)).toThrow();
    expect(() => eligibleTemplatePermissions({ ...cashier, scopeType: "branches" }, policy)).toThrow();
  });
  it("does not use self or assigned-task labels to narrow broad grants", () => {
    expect(() => eligibleTemplatePermissions({ ...cashier, scopeType: "self" }, policy)).toThrow();
    expect(() => eligibleTemplatePermissions({ ...cashier, scopeType: "assigned_tasks" }, policy)).toThrow();
  });
  it("rejects unsafe actions, unknown modules and action-only grants", () => {
    for (const permissions of [
      [{ module: "users", actions: ["view"] }],
      [{ module: "cashier_journal", actions: ["delete"] }],
      [{ module: "cashier_journal", actions: ["create"] }],
    ]) expect(() => eligibleTemplatePermissions({ ...cashier, permissions }, policy)).toThrow();
  });
  it("defers intrinsic compatibility only when employee is unknown", () => {
    expect(eligibleTemplatePermissions(driver, policy).permissions).toEqual([
      { module: "delivery_tasks", actions: ["edit", "view"] },
    ]);
    expect(eligibleTemplatePermissions(driver, policy, "delivery").permissions).toEqual([
      { module: "delivery_tasks", actions: ["edit", "view"] },
    ]);
    expect(() => eligibleTemplatePermissions(driver, policy, null)).toThrow();
    expect(() => eligibleTemplatePermissions(driver, policy, "cashier")).toThrow();
    expect(() => eligibleTemplatePermissions(driver, policy, "delivery", "viewer")).toThrow();
  });
  it("never removes intrinsic delivery authority through an empty or different template", () => {
    expect(() => eligibleTemplatePermissions(worker, policy, "delivery")).toThrow();
    expect(() => eligibleTemplatePermissions(cashier, policy, "delivery")).toThrow();
    expect(() => eligibleTemplatePermissions({ ...driver, permissions: [
      { module: "delivery_tasks", actions: ["view"] },
    ] }, policy, "delivery")).toThrow();
  });
  it("ignores no-action vocabulary rows without turning them into grants", () => {
    expect(eligibleTemplatePermissions({ ...worker,
      permissions: [{ module: "users", actions: [] }] }, policy, null).permissions).toEqual([]);
  });
  it("canonical snapshot hashing ignores permission ordering, not permissions or account state", () => {
    const a = [{ module: "branch_stock", actions: ["edit", "view"] }, ...cashier.permissions];
    const b = [...cashier.permissions, { module: "branch_stock", actions: ["view", "edit"] }];
    expect(assignmentSnapshotRevision({ linkedUserId: "one", sourceMode: "direct" }, a))
      .toBe(assignmentSnapshotRevision({ linkedUserId: "one", sourceMode: "direct" }, b));
    const token = assignmentSnapshotRevision({ linkedUserId: "one", sourceMode: "direct" }, a);
    expect(token).not.toBe(assignmentSnapshotRevision({ linkedUserId: "two", sourceMode: "direct" }, a));
    expect(token).not.toBe(assignmentSnapshotRevision({ linkedUserId: "one", sourceMode: "inherit" }, a));
    expect(token).not.toBe(assignmentSnapshotRevision({ linkedUserId: "one", sourceMode: "direct" }, []));
  });
});