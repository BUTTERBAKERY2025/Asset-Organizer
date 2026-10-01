import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  active: true, role: "operations_manager", branches: ["b"], denied: [] as string[],
  views: ["warehouse"] as string[], permissionChecks: [] as string[],
}));
vi.mock("../server/db", () => ({
  pool: { query: async (sql: string, args: unknown[]) => {
    if (sql.includes("FROM users")) return { rows: state.active
      ? [{ id: "recipient", role: state.role, branchId: "a", jobTitle: "manager", isActive: "active" }] : [] };
    if (sql.includes("FROM user_branch_access")) return { rows: state.branches.map(branchId => ({ branchId })) };
    if (sql.includes("user_permission_overrides")) return { rowCount: state.denied.includes(String(args[1])) ? 1 : 0 };
    throw new Error("Unexpected non-read access query");
  } },
}));
vi.mock("../server/auth", () => ({
  getAllowedBranchIds: (req: any) => req.currentUser.role === "admin" ? null
    : req.userBranchAccess.map((grant: any) => grant.branchId),
  requirePermission: (module: string, action: string) => (_req: unknown, res: any, next: () => void) => {
    state.permissionChecks.push(`${module}:${action}`);
    return state.views.includes(module) ? next() : res.status(403).json({ message: "Denied" });
  },
}));
import { sourceNoticeAccess } from "../server/source-notification-access";

beforeEach(() => {
  state.active = true; state.role = "operations_manager"; state.branches = ["b"];
  state.denied = []; state.views = ["warehouse"]; state.permissionChecks = [];
});
describe("live source notice permission/resource access", () => {
  it("uses fresh explicit grants, not the primary branch, for operations recipients", async () => {
    const access = await sourceNoticeAccess("recipient");
    expect(access?.branch("b")).toBe(true);
    expect(access?.branch("a")).toBe(false);
    state.branches = [];
    const revoked = await sourceNoticeAccess("recipient");
    expect(revoked?.allowed).toEqual([]);
    expect(revoked?.branch("b")).toBe(false);
    state.active = false;
    expect(await sourceNoticeAccess("recipient")).toBeNull();
  });
  it("runs the current view middleware and does not grant missing modules", async () => {
    const access = (await sourceNoticeAccess("recipient"))!;
    expect(await access.view("warehouse")).toBe(true);
    expect(await access.view("production")).toBe(false);
    expect(state.permissionChecks).toEqual(["warehouse:view", "production:view"]);
    // Memoization is confined to this projection, not persisted over a revoke.
    expect(await access.view("warehouse")).toBe(true);
    expect(state.permissionChecks).toHaveLength(2);
    state.views = [];
    expect(await (await sourceNoticeAccess("recipient"))!.view("warehouse")).toBe(false);
  });
  it("an explicit live revoke wins even if role middleware would auto-grant view", async () => {
    state.denied = ["warehouse"];
    expect(await (await sourceNoticeAccess("recipient"))!.view("warehouse")).toBe(false);
    expect(state.permissionChecks).toEqual([]);
  });
});