import { describe, expect, it, vi } from "vitest";

vi.mock("../server/storage", () => ({ storage: {
  getUserPermissions: vi.fn(async () => []),
  getUserBranchAccess: vi.fn(async () => []),
} }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(), verifyOtpForUser: vi.fn(),
  logShareholderActivity: vi.fn(),
}));

import { canAccessBranch, hasCrossBranchHrReadAccess, requirePermission } from "../server/auth";

async function check(module: string, role: string) {
  const req: any = { currentUser: { id: "u", role, branchId: "A" }, method: "GET", originalUrl: "/api/uploads/file/test" };
  const next = vi.fn();
  const res: any = { status: vi.fn(() => res), json: vi.fn() };
  await requirePermission(module, "view")(req, res, next);
  return { next, res };
}

describe("actual module and branch middleware used by upload route", () => {
  it("permits intrinsic HR read while withholding non-HR files", async () => {
    expect((await check("hr_documents", "hr_manager")).next).toHaveBeenCalledOnce();
    expect((await check("hr_leaves", "hr_manager")).next).toHaveBeenCalledOnce();
    expect((await check("cashier_journal", "hr_manager")).res.status).toHaveBeenCalledWith(403);
    expect(hasCrossBranchHrReadAccess({ currentUser: { id: "u", role: "hr_manager" } })).toBe(true);
  });
  it("restricts explicitly branch-limited operations managers, not admins", async () => {
    const req: any = { currentUser: { id: "u", role: "operations_manager", branchId: "A" }, userBranchAccess: [{ branchId: "A" }] };
    expect(await canAccessBranch(req, "A")).toBe(true);
    expect(await canAccessBranch(req, "B")).toBe(false);
    expect(await canAccessBranch({ currentUser: { id: "admin", role: "admin" } }, "B")).toBe(true);
  });
});