import { beforeEach, describe, expect, it, vi } from "vitest";
import { operationsNoticeScopeAllowed, publicRecipientNotice } from "../shared/notification-recipient";

const state = vi.hoisted(() => ({
  denied: [] as { module: string; action: string }[],
  grants: ["a", "b"],
  query: vi.fn(),
}));
vi.mock("../server/storage", () => ({ storage: {
  getUserPermissions: async () => [{ module: "operations", actions: ["view", "edit"] }],
  getUserBranchAccess: async () => state.grants.map(branchId => ({ branchId })),
  getBranch: async (branchId: string) => branchId === "a" ? { id: "a" } : undefined,
} }));
vi.mock("../server/db", () => ({ db: {}, pool: {
  query: async (...args: unknown[]) => { state.query(...args); return { rows: state.denied }; },
} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(), verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import { requirePermission, requireAnyPermission } from "../server/auth";
import { notificationRecipientBranches } from "../server/notification-receiver-access";

const request = (extra: Record<string, unknown> = {}) => ({
  method: "GET", session: {}, currentUser: { id: "u", role: "operations_manager", branchId: "a" },
  userBranchAccess: state.grants.map(branchId => ({ branchId })), ...extra,
}) as any;
const response = () => {
  const res: any = { status: vi.fn(() => res), json: vi.fn() };
  return res;
};
beforeEach(() => { state.denied = []; state.grants = ["a", "b"]; state.query.mockClear(); });

describe("recipient backend presentation and scope", () => {
  const scope = (extra: Record<string, unknown> = {}) => ({
    targetAllBranches: false, targetBranchIds: ["a", "b"], accessBranchIds: null, ...extra,
  }) as any;
  it("requires full multi-branch grants, including for push/per-person notices, but preserves global announcements", () => {
    expect(operationsNoticeScopeAllowed(scope(), new Set(["a"]))).toBe(false);
    expect(operationsNoticeScopeAllowed(scope(), new Set(["a", "b"]))).toBe(true);
    expect(operationsNoticeScopeAllowed(scope({ targetAllBranches: true }), new Set(["a"]))).toBe(true);
    expect(operationsNoticeScopeAllowed(scope({ targetAllBranches: true, accessBranchIds: ["b"] }), new Set(["a"]))).toBe(false);
    expect(operationsNoticeScopeAllowed(scope({ targetAllBranches: true }), new Set())).toBe(false);
  });
  it("projects only recipient display fields, not routing IDs, creator, dedupe or push metadata", () => {
    const dto = publicRecipientNotice({
      id: 1, title: "Title", content: "Body", buttonAction: "/source", sourceState: "history",
      targetUserIds: ["SECRET"], targetRoleIds: ["SECRET"], targetBranchIds: ["SECRET"],
      accessBranchIds: ["SECRET"], accessModule: "SECRET", createdBy: "SECRET",
      dedupeKey: "SECRET", pushAttemptCount: 99, designConfig: { accent: "violet" },
    } as any);
    expect(dto).toMatchObject({ id: 1, title: "Title", content: "Body", buttonAction: "/source", sourceState: "history" });
    expect(JSON.stringify(dto)).not.toContain("SECRET");
    expect(dto).not.toHaveProperty("pushAttemptCount");
  });
  it("uses the session's authorized branch and fails closed on revocation instead of falling back", async () => {
    expect(await notificationRecipientBranches(request({ session: { activeBranchId: "b" } }))).toEqual(["b"]);
    state.grants = ["a"];
    await expect(notificationRecipientBranches(request({ session: { activeBranchId: "b" } }))).rejects.toMatchObject({ status: 403 });
    expect(await notificationRecipientBranches(request({ currentUser: { id: "u", role: "operations_manager", branchId: null } }))).toEqual(["a"]);
    await expect(notificationRecipientBranches(request({
      session: { activeBranchId: "missing" },
      currentUser: { id: "admin", role: "admin", branchId: null },
    }))).rejects.toMatchObject({ status: 403 });
  });
});

describe("operations explicit revocation precedes role auto-grants", () => {
  it("denies view immediately on a fresh request and applies expiry in the live query", async () => {
    const req = request(), res = response(), next = vi.fn();
    await requirePermission("operations", "view")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    state.denied = [{ module: "operations", action: "view" }];
    const deniedRes = response(), deniedNext = vi.fn();
    await requirePermission("operations", "view")(request(), deniedRes, deniedNext);
    expect(deniedNext).not.toHaveBeenCalled();
    expect(deniedRes.status).toHaveBeenCalledWith(403);
    expect(state.query.mock.calls.at(-1)?.[0]).toContain("o.expires_at > NOW()");
    expect(state.query.mock.calls.at(-1)?.[1]).toEqual(["u"]);
  });
  it("filters denied OR-actions without mutating the middleware's shared actions array", async () => {
    const middleware = requireAnyPermission("operations", ["view", "edit"]);
    state.denied = [{ module: "operations", action: "view" }, { module: "operations", action: "edit" }];
    const next = vi.fn(), res = response();
    await middleware(request(), res, next);
    expect(next).not.toHaveBeenCalled();
    state.denied = [{ module: "operations", action: "view" }];
    await middleware(request(), response(), next);
    expect(next).toHaveBeenCalledOnce();
    state.denied = [];
    await middleware(request(), response(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});