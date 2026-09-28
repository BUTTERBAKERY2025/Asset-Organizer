import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../server/storage", () => ({ storage: { getUserPermissions: vi.fn(async () => []) } }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(), verifyOtpForUser: vi.fn(),
  logShareholderActivity: vi.fn(),
}));

import { ROLE_PERMISSION_TEMPLATES } from "../shared/schema";
import { requirePermission, requireAnyPermission, resolveBranchManagerPermissions } from "../server/auth";

const role = { id: "branch-manager-1", role: "branch_manager" };
const actions = (permissions: { module: string; actions: string[] }[], module: string) =>
  permissions.find((p) => p.module === module)?.actions ?? [];

async function allowed(
  permissions: { module: string; actions: string[] }[],
  module: string, action: string, any = false,
) {
  const next = vi.fn();
  const res: any = { status: vi.fn(() => res), json: vi.fn() };
  const req: any = { currentUser: role, authPermissions: permissions, method: "GET" };
  await (any ? requireAnyPermission(module, [action]) : requirePermission(module, action))(req, res, next);
  return next.mock.calls.length === 1;
}

describe("branch manager requester and recipient permissions", () => {
  it("grants only the four branch supply and kitchen actions and three delivery actions by default", async () => {
    const effective = resolveBranchManagerPermissions([], []);
    for (const module of ["branch_supply", "central_kitchen_orders"]) {
      expect(actions(effective, module)).toEqual(["view", "create", "edit", "export"]);
      for (const action of ["view", "create", "edit", "export"]) {
        expect(await allowed(effective, module, action)).toBe(true);
        expect(await allowed(effective, module, action, true)).toBe(true);
      }
      for (const action of ["approve", "delete", "transfer"]) {
        expect(await allowed(effective, module, action)).toBe(false);
      }
    }
    expect(actions(effective, "delivery_tasks")).toEqual(["view", "approve", "export"]);
    expect(await allowed(effective, "delivery_tasks", "approve", true)).toBe(true);
    expect(await allowed(effective, "delivery_tasks", "edit")).toBe(false);
    for (const module of ["warehouse", "production", "inventory", "material_requests", "transfer_requests"]) {
      expect(actions(effective, module)).toEqual([]);
      expect(await allowed(effective, module, "create")).toBe(false);
    }
  });

  it("replaces each module independently with an explicit row, even an empty row", async () => {
    const effective = resolveBranchManagerPermissions(
      [{ module: "branch_supply", actions: ["view", "create"] }],
      [{ module: "branch_supply", actions: ["view"] }, { module: "central_kitchen_orders", actions: [] },
        { module: "delivery_tasks", actions: ["export"] }],
    );
    expect(actions(effective, "branch_supply")).toEqual(["view"]);
    expect(actions(effective, "central_kitchen_orders")).toEqual([]);
    expect(actions(effective, "delivery_tasks")).toEqual(["export"]);
    expect(await allowed(effective, "branch_supply", "create")).toBe(false);
    expect(await allowed(effective, "central_kitchen_orders", "view", true)).toBe(false);
    expect(await allowed(effective, "delivery_tasks", "approve")).toBe(false);
    expect(await allowed(effective, "operations", "view")).toBe(true);
  });

  it("applies explicit deny and allow overrides after the role and direct selections", () => {
    const effective = resolveBranchManagerPermissions([], [{ module: "branch_supply", actions: [] }], [
      { module: "delivery_tasks", action: "approve", allow: false },
      { module: "branch_supply", action: "view", allow: true },
    ]);
    expect(actions(effective, "delivery_tasks")).toEqual(["view", "export"]);
    expect(actions(effective, "branch_supply")).toEqual(["view"]);
  });

  it("mirrors legacy module aliases only if the target was not explicitly selected", () => {
    const mirrored = resolveBranchManagerPermissions(
      [{ module: "pnl", actions: ["view"] }], [],
    );
    expect(actions(mirrored, "pnl_dashboard")).toEqual(["view"]);
    const revoked = resolveBranchManagerPermissions(
      [{ module: "pnl", actions: ["view"] }],
      [{ module: "pnl_dashboard", actions: [] }],
    );
    expect(actions(revoked, "pnl_dashboard")).toEqual([]);
  });

  it("does not change unrelated role templates", () => {
    const branch = ROLE_PERMISSION_TEMPLATES.branch_manager;
    expect(branch.find((p) => p.module === "inventory")).toBeUndefined();
    expect(branch.find((p) => p.module === "production")).toBeUndefined();
    expect(ROLE_PERMISSION_TEMPLATES.operations_manager.find((p) => p.module === "production")?.actions).toContain("create");
    expect(ROLE_PERMISSION_TEMPLATES.viewer.find((p) => p.module === "branch_supply")).toBeUndefined();
  });

  it("uses the same revocation-aware resolver on every effective-permissions route", () => {
    const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
    for (const [path, next] of [
      ["/api/my-permissions", "/api/rbac/users/:id/effective-permissions-detailed"],
      ["/api/rbac/users/:id/effective-permissions-detailed", "// Branches - Returns"],
      ["/api/rbac/users/:userId/effective-permissions", "// Current User Permissions"],
      ["/api/rbac/my-permissions", "// Check Permission (utility endpoint)"],
    ]) {
      const start = routes.indexOf(`app.get("${path}"`);
      const end = routes.indexOf(next, start);
      expect(start, path).toBeGreaterThan(-1);
      expect(end, path).toBeGreaterThan(start);
      expect(routes.slice(start, end), path).toContain("getBranchManagerEffectivePermissions");
    }
    const layout = readFileSync(new URL("../client/src/components/layout.tsx", import.meta.url), "utf8");
    expect(layout).toMatch(/href: "\/transfer-requests"[^}]+module: "branch_supply"/);
  });

  it("restricts branch supply operations to the manager's primary assigned branch", () => {
    const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
    expect(routes).toContain("(!isBranchSupplyManager(req) || req.currentUser.branchId === branchId)");
    const branchHook = readFileSync(new URL("../client/src/hooks/useBranches.ts", import.meta.url), "utf8");
    expect(branchHook).toContain('user?.role === "branch_manager"');
    expect(branchHook).toContain("branch.id === primaryBranchId");
    expect(branchHook).toContain("visibleBranchesForUser(assignedBranches, user?.role, user?.branchId)");
    const kitchen = readFileSync(new URL("../client/src/pages/central-kitchen-orders.tsx", import.meta.url), "utf8");
    expect(kitchen).toContain('canWarehouse={canView(user?.role === "branch_manager" ? "branch_supply" : "warehouse")}');
  });
});