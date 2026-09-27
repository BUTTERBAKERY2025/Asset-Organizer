import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canAccessDeliveryWorkspace } from "../shared/delivery-workspace-access";

describe("standalone delivery desk eligibility", () => {
  it("admits admins, warehouse keepers and employees whose job is delivery", () => {
    expect(canAccessDeliveryWorkspace({ role: "admin", jobTitle: null })).toBe(true);
    expect(canAccessDeliveryWorkspace({ role: "warehouse_keeper", jobTitle: null })).toBe(true);
    expect(canAccessDeliveryWorkspace({ role: "employee", jobTitle: "delivery" })).toBe(true);
  });

  it("does not treat an old delivery job title or module grant as a manager/other-role bypass", () => {
    for (const role of ["branch_manager", "operations_manager", "viewer", "hr_manager"]) {
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