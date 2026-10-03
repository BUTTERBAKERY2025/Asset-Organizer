import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  permission: vi.fn(),
  decision: vi.fn(),
}));
vi.mock("../server/auth", () => ({ contextualActionAllowed: f.decision }));
vi.mock("../server/storage", () => ({ storage: { hasPermission: f.permission } }));
import { dashboardPermissionScope } from "../server/dashboard-permission-scope";

describe("dashboard branch permission projection", () => {
  const req = () => ({
    currentUser: { id: "synthetic" },
    authPermissionDecisionSnapshot: { branchTemplates: [{ branchId: "a", permissions: [] }] },
  });
  beforeEach(() => {
    f.permission.mockReset().mockResolvedValue(false);
    f.decision.mockReset().mockImplementation((_req, _snapshot, module, _action, context) =>
      module === "cashier_journal" && context.branchId === "b");
  });
  it("retains the other branch rather than consulting flattened permissions", async () => {
    expect(await dashboardPermissionScope(req(), ["cashier_journal"], ["a", "b"]))
      .toEqual({ branchIds: ["b"], canView: true });
    expect(f.permission).not.toHaveBeenCalled();
  });
  it("does not replace an explicit denied branch with a permitted other branch", async () => {
    expect(await dashboardPermissionScope(req(), ["cashier_journal"], ["a", "b"], "a"))
      .toEqual({ branchIds: [], canView: false });
  });
  it("keeps production separate from sales authority", async () => {
    expect(await dashboardPermissionScope(req(), ["production"], ["a", "b"]))
      .toEqual({ branchIds: [], canView: false });
  });
  it("checks newly bound candidates but does not grant them from membership alone", async () => {
    expect(await dashboardPermissionScope(req(), ["cashier_journal"], ["b"], "all"))
      .toEqual({ branchIds: ["b"], canView: true });
    expect(f.decision.mock.calls.some(call => call[4].branchId === "a")).toBe(true);
  });
  it("preserves the legacy permission gate without manufacturing global scope", async () => {
    f.permission.mockResolvedValue(true);
    expect(await dashboardPermissionScope({ currentUser: { id: "synthetic" } }, ["cashier_journal"], ["b"]))
      .toEqual({ branchIds: ["b"], canView: true });
    expect(f.decision).not.toHaveBeenCalled();
  });
});