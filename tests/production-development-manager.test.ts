import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("../server/storage", () => ({ storage: {
  getUserPermissions: vi.fn(async () => []),
  getUserBranchAccess: vi.fn(async () => []),
} }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));
import { ROLE_PERMISSION_TEMPLATES, SYSTEM_MODULES } from "../shared/schema";
import { canAccessBranch, getAllowedBranchIds, requirePermission, requireAnyPermission,
  requireProductWritePermission, PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS } from "../server/auth";
import { routingPermission } from "../server/central-kitchen-routing";
import { canReceiveCentralKitchenNotification } from "../server/central-kitchen-notifications";

const role = "production_development_manager";
const request = (method = "GET") => ({
  currentUser: { id: "fresh-production-manager", role, branchId: "one" },
  userBranchAccess: [{ branchId: "one" }], method, session: {},
});
async function authorized(handler: any, method = "GET") {
  const next = vi.fn();
  const response: any = { status: vi.fn(() => response), json: vi.fn() };
  await handler(request(method), response, next);
  return { next, response };
}

describe("production development management without stored permission rows", () => {
  it("uses real modules and grants no deletion or unrelated administration", () => {
    for (const permission of ROLE_PERMISSION_TEMPLATES[role]) {
      expect(SYSTEM_MODULES).toContain(permission.module);
      expect(permission.actions).not.toContain("delete");
    }
    for (const module of ["users", "settings", "rbac_management", "hr_management",
      "salary_closing", "cashier_journal", "sales_analytics", "reports", "operations", "payment_requests"]) {
      expect(PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS[module]).toBeUndefined();
    }
  });
  it("authorizes every template action in both middleware paths", async () => {
    for (const [module, actions] of Object.entries(PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS)) {
      for (const action of actions) {
        expect((await authorized(requirePermission(module, action))).next).toHaveBeenCalledOnce();
        expect((await authorized(requireAnyPermission(module, ["delete", action]))).next).toHaveBeenCalledOnce();
      }
      expect((await authorized(requirePermission(module, "delete"), "DELETE")).response.status).toHaveBeenCalledWith(403);
    }
  });
  it("denies finance HR settings and inferred deletion", async () => {
    for (const module of ["hr_management", "salary_closing", "settings", "users", "reports", "pnl_dashboard", "sales_analytics"]) {
      expect((await authorized(requirePermission(module, "view"))).response.status).toHaveBeenCalledWith(403);
      expect((await authorized(requireAnyPermission(module, ["create", "edit"]))).response.status).toHaveBeenCalledWith(403);
    }
    expect((await authorized(requirePermission("production"), "DELETE")).response.status).toHaveBeenCalledWith(403);
    expect((await authorized(requirePermission("production"), "POST")).next).toHaveBeenCalledOnce();
  });
  it("covers every branch unconditionally, even with explicit branch rows", async () => {
    expect(getAllowedBranchIds(request())).toBeNull();
    expect(await canAccessBranch(request(), "another-kitchen")).toBe(true);
    expect(await canAccessBranch(request(), "main_warehouse")).toBe(true);
  });
  it("allows catalog create/edit without granting operations or catalog deletion", async () => {
    for (const action of ["create", "edit"] as const) {
      expect((await authorized(requireProductWritePermission(action))).next).toHaveBeenCalledOnce();
    }
    expect((await authorized(requirePermission("operations", "create"))).response.status).toHaveBeenCalledWith(403);
  });
  it("permits kitchen approval/receiving via module action, not administrator rights", () => {
    for (const action of ["view", "create", "edit", "approve"]) expect(routingPermission(role, [], action)).toBe(true);
    expect(routingPermission(role, [], "delete")).toBe(false);
    expect(canReceiveCentralKitchenNotification(role, [])).toBe(true);
  });
  it("keeps admin-only assignment and actual production/warehouse creation guards", () => {
    const routes = readFileSync("server/routes.ts", "utf8");
    for (const name of ["PRIVILEGED_ROLES", "OP_PRIVILEGED_ROLES"]) {
      expect(routes.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]+)`))?.[1]).toContain(role);
    }
    expect(routes).toContain('PRIVILEGED_ROLES.has(requestedRole) && (req as any).currentUser?.role !== "admin"');
    expect(routes).toContain('OP_PRIVILEGED_ROLES.has(opRequestedRole) && !isUserAdmin(req)');
    for (const path of ["/api/daily-production/batches", "/api/warehouse/items", "/api/warehouse/material-transfers"]) {
      expect(routes.split("\n").find(line => line.includes(`app.post("${path}"`))).toContain('"create"');
    }
    const routing = readFileSync("server/central-kitchen-routing.ts", "utf8");
    expect(routing).toContain('eq(users.role, "production_development_manager")');
    expect(routing).toContain('routingPermission(currentActor.role, currentActor.actions || [], "edit")');
  });
});