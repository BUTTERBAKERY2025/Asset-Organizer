import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const grants = vi.hoisted(() => ({ rows: [] as { branchId: string }[] }));
vi.mock("../server/storage", () => ({ storage: {
  getUserPermissions: vi.fn(async () => []),
  getUserBranchAccess: vi.fn(async () => grants.rows),
} }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import { canAccessBranch, getActiveBranchFilter, getAllowedBranchIds,
  getEffectiveBranchFilter, getMandatoryBranchFilter, requireBranchAccess } from "../server/auth";

const request = (rows: { branchId: string }[], activeBranchId?: string) => ({
  currentUser: { id: "ops", role: "operations_manager", branchId: "ungranted-primary" },
  // isAuthenticated loaded these on this request; session/default may be stale.
  userBranchAccess: rows, session: { activeBranchId }, body: {}, query: {},
});

describe("PHASE1 operations_manager explicit branch scope", () => {
  beforeEach(() => { grants.rows = []; });

  it.each([
    [[], false],
    [[{ branchId: "A" }], true],
    [[{ branchId: "A" }, { branchId: "B" }], true],
  ])("requires live persisted grants (rows=%j)", async (rows, hasA) => {
    grants.rows = rows;
    const req = request(rows);
    expect(getAllowedBranchIds(req)).toEqual(rows.map(row => row.branchId));
    expect(getEffectiveBranchFilter(req).hasAccess).toBe(hasA);
    expect(getEffectiveBranchFilter(req, "EVENT-BB").hasAccess).toBe(false);
    expect(await canAccessBranch(req, "A")).toBe(hasA);
    expect(await canAccessBranch(req, "EVENT-BB")).toBe(false);
    expect(await canAccessBranch(req, "ungranted-primary")).toBe(false);
  });

  it("stale request/session grants do not authorize detail or mutation", async () => {
    const req = request([{ branchId: "A" }], "A");
    grants.rows = []; // revoked in database after a previous request
    expect(await canAccessBranch(req, "A")).toBe(false);
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await requireBranchAccess(req as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    const nextReq = request([], "A");
    expect(getEffectiveBranchFilter(nextReq, "A").hasAccess).toBe(false);
    expect(getActiveBranchFilter(nextReq)).toBe("__no_authorized_branch__");
    expect(getMandatoryBranchFilter(nextReq)).toBe("__no_authorized_branch__");
  });

  it("many grants stay bounded even when session points to an ungranted branch", () => {
    const req = request([{ branchId: "A" }, { branchId: "B" }], "EVENT-BB");
    expect(getEffectiveBranchFilter(req, "all").branchIds).toEqual(["A", "B"]);
    expect(getEffectiveBranchFilter(req, "B").branchIds).toEqual(["B"]);
    expect(getMandatoryBranchFilter(req)).toBe("__no_authorized_branch__");
  });

  it("route contracts cannot turn zero grants or an omitted command-center branch into global", () => {
    const routes = readFileSync("server/routes.ts", "utf8");
    const auth = readFileSync("server/auth.ts", "utf8");
    const storage = readFileSync("server/storage.ts", "utf8");
    expect(routes).toContain("const allowedIds = new Set(opsAccess.map");
    expect(routes).toContain('req.currentUser?.role === "operations_manager" && (!req.query.branchId');
    expect(auth).toContain("filteredBranches = allBranches.filter((b: any) => userBranches.some");
    expect(routes).toContain("storage.getDailyProductionStats(id, today)");
    expect(routes).toContain("qualityPassRate: filteredChecks.length > 0 ? ((passedChecks / filteredChecks.length) * 100).toFixed(1) : 0");
    expect(storage).toContain("let qualityPassRate = 0");
  });
});