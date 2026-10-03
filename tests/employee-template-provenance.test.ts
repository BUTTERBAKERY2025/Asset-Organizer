import { describe, expect, it } from "vitest";
import { matchesVerifiedTemplateBase } from "../server/employee-template-provenance";
const permissions = [{ module: "cashier_journal", actions: ["view", "create"] },
  { module: "dashboard", actions: ["view", "view_list"] }];
const employee = { id: 1, branchId: "A" };
const base = { employeeId: 1, branchId: "A", permissions };
describe("approved template provenance is not a generic direct-grant bypass", () => {
  it("recognizes exactly the bound base independently of module/action order", () => {
    expect(matchesVerifiedTemplateBase(base, employee,
      [...permissions].reverse().map(p => ({ ...p, actions: [...p.actions].reverse() })))).toBe(true);
  });
  it("rejects missing approval/binding evidence", () => {
    expect(matchesVerifiedTemplateBase(undefined, employee, permissions)).toBe(false);
  });
  it.each([{ id: 2, branchId: "A" }, { id: 1, branchId: "B" }])("rejects a changed target", target => {
    expect(matchesVerifiedTemplateBase(base, target, permissions)).toBe(false);
  });
  it("rejects extra and removed actions rather than treating stale bindings as authority", () => {
    expect(matchesVerifiedTemplateBase(base, employee, [...permissions, { module: "users", actions: ["view"] }])).toBe(false);
    expect(matchesVerifiedTemplateBase(base, employee, permissions.slice(0, 1))).toBe(false);
  });
});