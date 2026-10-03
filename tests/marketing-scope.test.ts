import { describe, it, expect, vi } from "vitest";
import { checkPermissionDecision } from "../server/permission-decision";
vi.mock("../server/db", () => ({ db: {} }));
vi.mock("../server/auth", () => ({
  getAllowedBranchIds: () => ["a", "b"],
  contextualActionAllowed: (_req: any, snapshot: any, module: string, action: string, context: any) =>
    checkPermissionDecision(snapshot, module, action, context),
}));
import { marketingScopeAllowed } from "../server/marketing-scope";

const tuple = (branchId: string | null, deny = false) => ({
  module: "marketing_campaigns", action: "view", branchId, departmentId: null,
  scopeType: branchId ? "branch" : "global", deny, source: deny ? "override_deny" : "direct",
  startDate: null, endDate: null, expiresAt: null, isActive: true,
});
const request = (tuples: any[]) => ({
  currentUser: { id: "test", role: "employee" },
  authPermissionDecisionSnapshot: { userId: "test", sourceMode: "direct", resolvedSourceMode: "direct",
    directPermissions: [], capturedAt: Date.now(), tuples },
});
describe("central versus branch marketing authority", () => {
  it("does not apply a branch-specific deny to an explicitly central campaign", () => {
    const req = request([tuple(null), tuple("a", true)]);
    expect(marketingScopeAllowed(req, "marketing_campaigns", "view", null)).toBe(true);
    expect(marketingScopeAllowed(req, "marketing_campaigns", "view", "a")).toBe(false);
    expect(marketingScopeAllowed(req, "marketing_campaigns", "view", "b")).toBe(true);
  });
  it("does not turn a branch grant into central access", () => {
    expect(marketingScopeAllowed(request([tuple("b")]), "marketing_campaigns", "view", null)).toBe(false);
  });
  it("retains global denies", () => {
    expect(marketingScopeAllowed(request([tuple(null), tuple(null, true)]),
      "marketing_campaigns", "view", null)).toBe(false);
  });
});