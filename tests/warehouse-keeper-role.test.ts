import { describe, expect, it, vi } from "vitest";

vi.mock("../server/storage", () => ({ storage: { getUserPermissions: vi.fn(async () => []) } }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(), verifyOtpForUser: vi.fn(),
  logShareholderActivity: vi.fn(),
}));

import { ROLE_PERMISSION_TEMPLATES, JOB_ROLE_PERMISSION_TEMPLATES } from "../shared/schema";
import {
  getAllowedBranchIds, getActiveBranchFilter, getMandatoryBranchFilter,
  canAccessBranch, resolveWarehouseKeeperPermissions, requirePermission, requireAnyPermission,
} from "../server/auth";

// No branches row exists for main_warehouse; the stored users.branch_id is NULL.
const keeper = { id: "warehouse-1", role: "warehouse_keeper", branchId: null };
const request = {
  currentUser: keeper,
  userBranchAccess: [{ branchId: "BR-1" }, { branchId: "BR-2" }],
  session: { activeBranchId: "BR-2" },
};

describe("warehouse keeper branch isolation", () => {
  it("never expands a warehouse scope through default or explicit branch grants", async () => {
    expect(getAllowedBranchIds(request)).toEqual(["main_warehouse"]);
    expect(getMandatoryBranchFilter(request)).toBe("main_warehouse");
    expect(getActiveBranchFilter(request)).toBe("main_warehouse");
    expect(await canAccessBranch(request, "main_warehouse")).toBe(true);
    expect(await canAccessBranch(request, "BR-1")).toBe(false);
    expect(await canAccessBranch(request, "BR-2")).toBe(false);
    expect(await canAccessBranch(request, "EVENT-BB")).toBe(false);
  });
});

describe("warehouse keeper effective actions", () => {
  it("maps role and job templates to only warehouse operations", () => {
    expect(JOB_ROLE_PERMISSION_TEMPLATES.warehouse_keeper).toEqual([]);
    expect(ROLE_PERMISSION_TEMPLATES.warehouse_keeper.length).toBeGreaterThan(0);
    const effective = resolveWarehouseKeeperPermissions([], false, []);
    expect(effective.find(p => p.module === "warehouse")?.actions).toEqual(["view", "create", "edit", "export"]);
    expect(effective.find(p => p.module === "transfer_requests")?.actions).toContain("approve");
    expect(effective.find(p => p.module === "delivery_tasks")?.actions).not.toContain("export");
    for (const unrelated of ["sales_analytics", "inventory", "asset_transfers", "hr_management", "reports", "users"]) {
      expect(effective.find(p => p.module === unrelated)).toBeUndefined();
    }
  });

  it("respects custom revocations and explicit deny, never inherited unrelated exports", async () => {
    const effective = resolveWarehouseKeeperPermissions([
      { module: "warehouse", actions: ["view", "export"] },
      { module: "sales_analytics", actions: ["view", "export"] },
    ], true, [{ module: "warehouse", action: "export" }]);
    expect(effective).toEqual([{ module: "warehouse", actions: ["view"] }]);
    const next = vi.fn();
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const scopedReq: any = { ...request, authPermissions: effective, method: "GET" };
    await requirePermission("warehouse", "view")(scopedReq, res, next);
    expect(next).toHaveBeenCalledOnce();
    for (const [module, action] of [["warehouse", "export"], ["sales_analytics", "export"], ["inventory", "export"]]) {
      await requirePermission(module, action)(scopedReq, res, next);
      expect(res.status).toHaveBeenLastCalledWith(403);
    }
    await requireAnyPermission("material_requests", ["export", "view"])(scopedReq, res, next);
    expect(res.status).toHaveBeenLastCalledWith(403);
    expect(next).toHaveBeenCalledOnce();
  });
});