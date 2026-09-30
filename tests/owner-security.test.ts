import { describe, expect, it, vi } from "vitest";
import { createOwnerApiLockdown, isOwnerRequestAllowed, isOwnerSessionValid, validateOwnerBranches, validateOwnerExitBranches } from "../server/owner-security";

describe("owner explicit branch assignments", () => {
  const available = ["riyadh", "tabuk"];
  it("validates every submitted ID rather than filtering invalid IDs", () => {
    for (const ids of [[], ["unknown"], ["riyadh", "unknown"], ["all_branches"], [null], "riyadh"]) {
      expect(() => validateOwnerBranches(ids, undefined, ["tabuk"], available)).toThrow();
    }
  });
  it("requires an explicit grant on creation and conversion from a no-grant account", () => {
    expect(() => validateOwnerBranches(undefined, undefined, [], available)).toThrow(/واحداً على الأقل/);
    for (const legacy of [null, "", "none", "unknown", "all_branches"]) {
      expect(() => validateOwnerBranches(undefined, legacy, [], available)).toThrow();
    }
  });
  it("preserves valid existing explicit grants on a role-only edit", () => {
    expect(validateOwnerBranches(undefined, undefined, ["tabuk", "riyadh"], available))
      .toEqual({ ids: ["tabuk", "riyadh"], replace: false });
  });
  it("accepts valid selections and explicit single legacy branch grants", () => {
    expect(validateOwnerBranches(["riyadh", "riyadh", "tabuk"], undefined, [], available))
      .toEqual({ ids: ["riyadh", "tabuk"], replace: true });
    expect(validateOwnerBranches(undefined, "tabuk", [], available))
      .toEqual({ ids: ["tabuk"], replace: true });
  });
});

describe("owner to operational-role branch transition", () => {
  const available = ["riyadh", "tabuk"];
  it("requires a fresh explicit selection, not owner grants or legacy branch projection", () => {
    expect(() => validateOwnerExitBranches(undefined, undefined, available)).toThrow(/صراحةً/);
  });
  it("preserves exactly the newly selected, authorized branches", () => {
    expect(validateOwnerExitBranches(["tabuk", "tabuk"], undefined, available)).toEqual({ ids: ["tabuk"], all: false });
    expect(validateOwnerExitBranches(undefined, "riyadh", available)).toEqual({ ids: ["riyadh"], all: false });
    expect(validateOwnerExitBranches([], undefined, available)).toEqual({ ids: [], all: false });
    expect(validateOwnerExitBranches(undefined, "all_branches", available)).toEqual({ ids: [], all: true });
  });
  it("rejects ambiguous, malformed, and unknown selections rather than silently filtering", () => {
    for (const [ids, id] of [
      [["tabuk"], "riyadh"], [["tabuk", "unknown"], undefined],
      ["tabuk", undefined], [undefined, "unknown"], [[null], undefined],
    ]) expect(() => validateOwnerExitBranches(ids, id, available)).toThrow();
  });
});

describe("owner session row validation", () => {
  const row = { sessionId: "session-1", isActive: true, expiresAt: new Date(2000) };
  it("requires matching session ID, strict active flag and future expiry", () => {
    expect(isOwnerSessionValid(row, "session-1", 1000)).toBe(true);
    expect(isOwnerSessionValid({ ...row, isActive: false }, "session-1", 1000)).toBe(false);
    expect(isOwnerSessionValid(row, "other-session", 1000)).toBe(false);
    expect(isOwnerSessionValid(row, "session-1", 2000)).toBe(false);
    expect(isOwnerSessionValid({ ...row, expiresAt: "invalid" }, "session-1", 1000)).toBe(false);
  });
  it("rejects an inactive row even when storage returns it with a matching unexpired ID", async () => {
    const gate = createOwnerApiLockdown(
      async () => ({ role: "business_owner", isActive: "active" }),
      async (_id, sessionId) => [{ ...row, isActive: false }].some(s => isOwnerSessionValid(s, sessionId, 1000)),
    );
    const ctx = request("/api/owner/summary");
    Object.assign(ctx.req, { sessionID: "session-1" });
    await gate(ctx.req as any, ctx.res as any, ctx.next);
    expect(ctx.res.status).toHaveBeenCalledWith(401);
    expect(ctx.next).not.toHaveBeenCalled();
  });
});

describe("owner API allowlist", () => {
  it.each(["GET", "HEAD"])("permits only dedicated reads with %s", method => {
    expect(isOwnerRequestAllowed(method, "/api/owner/summary?branchId=x")).toBe(true);
    expect(isOwnerRequestAllowed(method, "/api/owner/summary/")).toBe(true);
    expect(isOwnerRequestAllowed(method, "/api/auth/me/")).toBe(true);
    for (const path of [
      "/api/users", "/api/auth/init", "/api/my-permissions", "/api/branches",
      "/api/shareholder/me", "/api/shareholder-portal/dashboard", "/api/audit/files",
      "/api/notifications", "/api/operations/stats", "/api/security/sessions",
      "/api/health", "/api/reports/export", "/api/owner-other/summary",
      "/api/owner/../users", "/api/owner/%2e%2e/users", "/api/%6fwner/summary",
      "/api/owner//summary", "/api/owner\\summary", "/api/owner/summary%2f",
      "/API/OWNER/summary", "/api/owner/./summary", "/api/owner/summary\0",
    ]) expect(isOwnerRequestAllowed(method, path), path).toBe(false);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])("rejects operational writes (%s)", method => {
    for (const path of ["/api/owner/summary", "/api/users", "/api/batch", "/api/auth/switch-branch"]) {
      expect(isOwnerRequestAllowed(method, path)).toBe(false);
    }
  });

  it("allows only the exact logout mutation", () => {
    expect(isOwnerRequestAllowed("POST", "/api/auth/logout")).toBe(true);
    expect(isOwnerRequestAllowed("POST", "/api/auth/logout/")).toBe(true);
    expect(isOwnerRequestAllowed("GET", "/api/auth/logout")).toBe(false);
    expect(isOwnerRequestAllowed("POST", "/api/auth/logout/extra")).toBe(false);
  });
});

function request(url: string, method = "GET", userId: string | undefined = "user-1") {
  const req = {
    path: url.split("?")[0], originalUrl: url, method,
    session: { userId, destroy: vi.fn((callback: () => void) => callback()) },
  };
  const res = { set: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.set.mockReturnValue(res);
  const next = vi.fn();
  return { req, res, next };
}

describe("owner global hard gate", () => {
  it("reads authoritative identity on every request; stale broad grants cannot bypass role changes", async () => {
    let role = "admin";
    const lookup = vi.fn(async () => ({ role, isActive: "active" }));
    const gate = createOwnerApiLockdown(lookup);
    const call = async (url: string) => {
      const ctx = request(url);
      Object.assign(ctx.req, { currentUser: { role: "admin" }, authPermissions: [{ module: "users", actions: ["view", "edit"] }] });
      await gate(ctx.req as any, ctx.res as any, ctx.next);
      return ctx;
    };
    expect((await call("/api/users")).next).toHaveBeenCalledOnce();
    role = "business_owner";
    expect((await call("/api/users")).res.status).toHaveBeenCalledWith(403);
    expect((await call("/api/owner/summary")).next).toHaveBeenCalledOnce();
    role = "employee";
    // Owner endpoint's own role guard now denies; this global gate does not grant access.
    expect((await call("/api/owner/summary")).next).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledTimes(4);
  });

  it("marks admin preview and anonymous owner responses no-store too", async () => {
    const gate = createOwnerApiLockdown(async () => ({ role: "admin", isActive: "active" }));
    for (const userId of ["user-1", undefined]) {
      const ctx = request("/api/owner/summary");
      ctx.req.session.userId = userId;
      await gate(ctx.req as any, ctx.res as any, ctx.next);
      expect(ctx.res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(ctx.next).toHaveBeenCalledOnce();
    }
  });

  it("preserves public auth and legacy role handling without sessions", async () => {
    const lookup = vi.fn();
    const gate = createOwnerApiLockdown(lookup);
    for (const url of ["/api/auth/me", "/api/auth/login", "/login"]) {
      const ctx = request(url);
      ctx.req.session.userId = undefined;
      await gate(ctx.req as any, ctx.res as any, ctx.next);
      expect(ctx.next).toHaveBeenCalledOnce();
    }
    expect(lookup).not.toHaveBeenCalled();
  });

  it("fails closed on lookup failure", async () => {
    const gate = createOwnerApiLockdown(async () => { throw new Error("database unavailable"); });
    const ctx = request("/api/owner/summary");
    await gate(ctx.req as any, ctx.res as any, ctx.next);
    expect(ctx.res.status).toHaveBeenCalledWith(503);
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it("preserves auth/me missing-account and inactive responses in its existing handler", async () => {
    for (const user of [undefined, { role: "business_owner", isActive: "inactive" }, { role: "employee", isActive: "inactive" }]) {
      const gate = createOwnerApiLockdown(async () => user);
      const ctx = request("/api/auth/me");
      await gate(ctx.req as any, ctx.res as any, ctx.next);
      expect(ctx.next).toHaveBeenCalledOnce();
      expect(ctx.res.status).not.toHaveBeenCalled();
    }
  });

  it("blocks deactivated owners immediately", async () => {
    const gate = createOwnerApiLockdown(async () => ({ role: "business_owner", isActive: "inactive" }));
    const ctx = request("/api/owner/summary");
    await gate(ctx.req as any, ctx.res as any, ctx.next);
    expect(ctx.res.status).toHaveBeenCalledWith(401);
    expect(ctx.req.session.destroy).toHaveBeenCalled();
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it("honors session revocation while retaining logout cleanup", async () => {
    let active = true;
    const gate = createOwnerApiLockdown(
      async () => ({ role: "business_owner", isActive: "active" }),
      async () => active,
    );
    const initial = request("/api/owner/summary");
    await gate(initial.req as any, initial.res as any, initial.next);
    expect(initial.next).toHaveBeenCalledOnce();
    active = false;
    for (const url of ["/api/owner/summary", "/api/auth/me"]) {
      const ctx = request(url);
      await gate(ctx.req as any, ctx.res as any, ctx.next);
      expect(ctx.res.status).toHaveBeenCalledWith(401);
      expect(ctx.next).not.toHaveBeenCalled();
    }
    const logout = request("/api/auth/logout", "POST");
    await gate(logout.req as any, logout.res as any, logout.next);
    expect(logout.next).toHaveBeenCalledOnce();
  });
});