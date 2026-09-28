import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { branchDeliveryScope, canAccessDeliveryWorkspace } from "../shared/delivery-workspace-access";

describe("standalone delivery desk eligibility", () => {
  it("admits admins, branch managers, warehouse keepers and employees whose job is delivery", () => {
    expect(canAccessDeliveryWorkspace({ role: "admin", jobTitle: null })).toBe(true);
    expect(canAccessDeliveryWorkspace({ role: "branch_manager", jobTitle: null })).toBe(true);
    expect(canAccessDeliveryWorkspace({ role: "warehouse_keeper", jobTitle: null })).toBe(true);
    expect(canAccessDeliveryWorkspace({ role: "employee", jobTitle: "delivery" })).toBe(true);
  });

  it("does not treat an old delivery job title or module grant as a manager/other-role bypass", () => {
    for (const role of ["operations_manager", "viewer", "hr_manager"]) {
      expect(canAccessDeliveryWorkspace({ role, jobTitle: "delivery" })).toBe(false);
    }
    expect(canAccessDeliveryWorkspace({ role: "employee", jobTitle: "driver" })).toBe(false);
    expect(canAccessDeliveryWorkspace({ role: "employee" })).toBe(false);
    expect(canAccessDeliveryWorkspace(null)).toBe(false);
  });

  it("applies the role gate to standalone route and navigation but not embedded receipt", () => {
    const route = readFileSync("client/src/App.tsx", "utf8");
    const sidebar = readFileSync("client/src/components/layout.tsx", "utf8");
    const home = readFileSync("client/src/pages/platform-home.tsx", "utf8");
    const desk = readFileSync("client/src/pages/driver-deliveries.tsx", "utf8");
    expect(route).toContain('<ModuleProtectedRoute module="delivery_tasks">');
    expect(route).toContain("canAccessDeliveryWorkspace(user)");
    expect(sidebar).toContain("canAccessDeliveryWorkspace(user) ? [{ href: \"/driver-deliveries\"");
    expect(home).toContain("canAccessDeliveryWorkspace(user) ? [{ title:");
    expect(desk).toContain("if (!canAccessDeliveryWorkspace(user))");
    expect(desk).toContain("export function DeliveryWorkspace({ embedded = false");
  });
});

describe("branch delivery recipient boundary", () => {
  const source = (sourceType: string, sourceBranchId: string | null, destinationBranchId: string | null, destinationWarehouseId: number | null = null) =>
    ({ sourceType, sourceBranchId, destinationBranchId, destinationWarehouseId });
  it("sees and receives only authorized destinations, even when the primary is null", () => {
    expect(branchDeliveryScope("branch-a", ["branch-a"], source("material_transfer", "main_warehouse", "branch-a")))
      .toEqual({ view: true, receive: true });
    expect(branchDeliveryScope("branch-a", ["branch-a", "branch-b"], source("kitchen", "branch-kitchen", "branch-b")))
      .toEqual({ view: true, receive: true });
    expect(branchDeliveryScope(null, ["branch-b"], source("kitchen", "branch-kitchen", "branch-b")))
      .toEqual({ view: true, receive: true });
    expect(branchDeliveryScope("branch-a", ["branch-a"], source("material_transfer", "branch-a", "branch-b")))
      .toEqual({ view: false, receive: false });
  });
  it("permits only own-origin warehouse returns for tracking, not receipt or other branches' returns", () => {
    expect(branchDeliveryScope("branch-a", ["branch-a"], source("reverse_movement", "branch-a", null, 4)))
      .toEqual({ view: true, receive: false });
    expect(branchDeliveryScope("branch-a", ["branch-a"], source("reverse_movement", "branch-b", null, 4)))
      .toEqual({ view: false, receive: false });
    expect(branchDeliveryScope("branch-a", ["branch-a", "branch-b"], source("reverse_movement", "branch-b", null, 4)))
      .toEqual({ view: true, receive: false });
    expect(branchDeliveryScope("branch-a", ["branch-a"], source("reverse_movement", "branch-a", "branch-b")))
      .toEqual({ view: false, receive: false });
  });
  it("fails closed for revoked/default branch and empty grants", () => {
    const incoming = source("kitchen", "kitchen", "branch-a");
    expect(branchDeliveryScope(null, ["branch-a"], incoming).view).toBe(true);
    expect(branchDeliveryScope("branch-a", [], incoming).receive).toBe(false);
    expect(branchDeliveryScope("branch-a", ["branch-b"], incoming).view).toBe(false);
    expect(branchDeliveryScope("branch-a", null, incoming).view).toBe(false);
  });
});