import { describe, expect, it } from "vitest";
import { normalizePermissionDecisionSnapshot, checkPermissionDecision, evaluatePermissionDecision } from "../server/permission-decision";
import { branchTemplateSnapshot, checkBranchTemplateDecision } from "../server/branch-template-decision";

const original = () => normalizePermissionDecisionSnapshot({
  userId: "fixture", sourceMode: "direct",
  direct: [{ module: "cashier_journal", actions: ["view", "create"] }],
  roles: [], overrides: [],
});
const bases = [{ branchId: "a", permissions: [{ module: "cashier_journal", actions: ["view"] }] }];
describe("independent branch template decisions", () => {
  it("uses scoped bases through the production decision entry point and includes new navigation keys", () => {
    const snapshot = { ...original(), branchTemplates: [{ branchId: "a", permissions: [{ module: "quality_control", actions: ["view"] }] }] };
    expect(checkPermissionDecision(snapshot, "quality_control", "view", { branchId: "a" })).toBe(true);
    expect(checkPermissionDecision(snapshot, "quality_control", "view", { branchId: "b" })).toBe(false);
    expect(checkPermissionDecision(snapshot, "cashier_journal", "create", { branchId: "b" })).toBe(true);
    expect(evaluatePermissionDecision(snapshot, { branchId: "a" })).toContainEqual({ module: "quality_control", action: "view", allowed: true });
  });
  it("removes create only in the assigned branch and preserves other branches", () => {
    const source = original();
    expect(checkBranchTemplateDecision(source, bases, "cashier_journal", "create", { branchId: "a" })).toBe(false);
    expect(checkBranchTemplateDecision(source, bases, "cashier_journal", "create", { branchId: "b" })).toBe(true);
    expect(checkBranchTemplateDecision(source, bases, "cashier_journal", "view", { branchId: "a" })).toBe(true);
    expect(source.tuples).toHaveLength(2);
  });
  it("does not promote a scoped addition into other branches or unknown scope", () => {
    const selected = [{ branchId: "a", permissions: [{ module: "quality_control", actions: ["view"] }] }];
    expect(checkBranchTemplateDecision(original(), selected, "quality_control", "view", { branchId: "a" })).toBe(true);
    expect(checkBranchTemplateDecision(original(), selected, "quality_control", "view", { branchId: "b" })).toBe(false);
    expect(checkBranchTemplateDecision(original(), selected, "quality_control", "view", {})).toBe(false);
    expect(checkBranchTemplateDecision(original(), bases, "cashier_journal", "create", {})).toBe(false);
  });
  it("preserves independent denies and grants", () => {
    const source = normalizePermissionDecisionSnapshot({
      userId: "fixture", sourceMode: "direct", direct: [], roles: [],
      overrides: [
        { module: "cashier_journal", action: "view", permissionId: 1, allow: false, branchId: "a", departmentId: null, expiresAt: null },
        { module: "quality_control", action: "view", permissionId: 2, allow: true, branchId: "b", departmentId: null, expiresAt: null },
      ],
    });
    expect(checkBranchTemplateDecision(source, bases, "cashier_journal", "view", { branchId: "a" })).toBe(false);
    expect(checkBranchTemplateDecision(source, bases, "quality_control", "view", { branchId: "b" })).toBe(true);
  });
  it("supports independent bases and intentional empty replacement", () => {
    const selected = [...bases, { branchId: "b", permissions: [] }];
    expect(checkBranchTemplateDecision(original(), selected, "cashier_journal", "view", { branchId: "a" })).toBe(true);
    expect(checkBranchTemplateDecision(original(), selected, "cashier_journal", "view", { branchId: "b" })).toBe(false);
    expect(checkBranchTemplateDecision(original(), selected, "cashier_journal", "create", { branchId: "c" })).toBe(true);
  });
  it("rejects ambiguous scope and leaves accounts without assignments untouched", () => {
    const source = original();
    expect(branchTemplateSnapshot(source, [], {})).toBe(source);
    expect(() => branchTemplateSnapshot(source, [...bases, ...bases], {})).toThrow("Ambiguous");
  });
});