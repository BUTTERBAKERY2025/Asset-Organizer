import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { findAuthorizedJoiningNotification } from "../client/src/lib/onboarding-notification-navigation";

const state = vi.hoisted(() => ({
  entry: null as any, alerts: [] as any[], managers: [] as any[], grants: new Map<string, string[]>(),
  denied: new Set<string>(), failure: false, locks: [] as string[], queue: Promise.resolve(),
}));
vi.mock("../server/db", () => {
  const builder = (value: any) => {
    const result: any = { where: () => result, limit: async () => value, orderBy: () => result,
      innerJoin: () => result, leftJoin: () => result, then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject) };
    return result;
  };
  const tx: any = {
    execute: async () => { state.locks.push("row-lock"); },
    select: () => ({ from: (table: any) => builder(getTableName(table) === "users" ? state.managers : state.entry ? [state.entry] : []) }),
    update: () => ({ set: (values: any) => ({ where: () => ({ returning: async () => {
      Object.assign(state.entry.notification, values);
      return [state.entry.notification];
    } }) }) }),
    insert: () => ({ values: async (values: any) => {
      if (state.failure) throw new Error("notification write failed");
      state.alerts.push(values);
    } }),
  };
  return { db: { ...tx, transaction: async (callback: any) => {
    const previous = state.queue;
    let release!: () => void;
    state.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const saved = state.entry ? structuredClone(state.entry) : null;
    try { return await callback(tx); }
    catch (error) { state.entry = saved; throw error; }
    finally { release(); }
  } } };
});
vi.mock("../server/storage", () => ({ storage: {
  getUserPermissions: async (id: string) => state.denied.has(id) ? [] : [{ module: "hr_onboarding", actions: ["view"] }],
  getUserBranchAccess: async (id: string) => (state.grants.get(id) || []).map(branchId => ({ branchId })),
} }));
vi.mock("../server/twilio-service", () => ({ sendWhatsAppMessage: vi.fn(), isTwilioConfigured: () => false }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  getAllowedBranchIds: (req: any) => req.allowed,
  getEffectiveBranchFilter: (req: any, branch: string) => ({ hasAccess: req.userBranchAccess.some((grant: any) => grant.branchId === branch) }),
  requirePermission: (module: string, action: string) => async (req: any, res: any, next: any) => {
    const allowed = req.currentUser?.role === "hr_manager"
      ? req.authPermissions.some((permission: any) => permission.module === module && permission.actions.includes(action))
      : req.capabilities?.includes(`${module}:${action}`);
    return allowed ? next() : res.status(403).json({ error: "denied" });
  },
}));
import { registerOnboardingRoutes } from "../server/onboarding-routes";
const routes: Record<string, Function[]> = {};
registerOnboardingRoutes({
  get: (path: string, ...handlers: Function[]) => { routes[`GET ${path}`] = handlers; },
  post: (path: string, ...handlers: Function[]) => { routes[`POST ${path}`] = handlers; },
  patch: () => {}, put: () => {}, delete: () => {},
} as any);

async function confirm(overrides: any = {}) {
  const req: any = { method: "POST", params: { id: "12" }, body: { notes: "تم التحقق من المباشرة" },
    currentUser: { id: "operations-actor", role: "operations_manager" }, allowed: ["branch-a"],
    capabilities: ["operations_hr:view", "operations_joining:approve"], ...overrides };
  let status = 200, body: any;
  const res: any = { set() { return this; }, status(value: number) { status = value; return this; }, json(value: any) { body = value; return this; } };
  const list = routes["POST /api/operations-hr/joining/:id/confirm"];
  const run = async (index: number): Promise<void> => {
    let downstream: Promise<void> | undefined;
    await list[index]?.(req, res, () => { downstream = run(index + 1); });
    await downstream;
  };
  await run(0);
  return { status, body };
}

beforeEach(() => {
  state.entry = { notification: { id: 12, branchId: "branch-a", status: "signed",
    signedAt: new Date("2026-10-01T07:00:00Z"), actualStartDate: "2026-10-01", candidateName: "Private candidate" },
  offer: { id: 2, status: "accepted", hiredEmployeeId: null, branchId: "branch-a" } };
  state.alerts = []; state.failure = false; state.locks = []; state.queue = Promise.resolve();
  state.managers = [{ id: "hr-authorized", role: "hr_manager", isActive: "active" },
    { id: "hr-other-branch", role: "hr_manager", isActive: "active" },
    { id: "hr-denied-module", role: "hr_manager", isActive: "active" }];
  state.grants = new Map([["hr-authorized", ["branch-a"]], ["hr-other-branch", ["branch-b"]], ["hr-denied-module", ["branch-a"]]]);
  state.denied = new Set(["hr-denied-module"]);
});

describe("operations joining confirmation and real bell notification", () => {
  it("requires operations-specific approve and denies other roles", async () => {
    expect((await confirm({ capabilities: ["operations_hr:view"] })).status).toBe(403);
    expect((await confirm({ currentUser: { id: "hr", role: "hr_manager" } })).status).toBe(403);
    expect(state.alerts).toHaveLength(0);
  });
  it("rejects opposite branch, HQ, changed offer branch and converted/rejected offers", async () => {
    for (const patch of [
      { branchId: "branch-b" }, { branchId: "main_warehouse" },
    ]) {
      Object.assign(state.entry.notification, patch);
      expect((await confirm()).status).toBe(403);
    }
    state.entry.notification.branchId = "branch-a";
    state.entry.offer.branchId = "branch-b";
    expect((await confirm()).status).toBe(403);
    state.entry.offer.branchId = "branch-a";
    state.entry.offer.hiredEmployeeId = 9;
    expect((await confirm()).status).toBe(403);
    state.entry.offer.hiredEmployeeId = null; state.entry.offer.status = "rejected";
    expect((await confirm()).status).toBe(403);
    expect(state.alerts).toHaveLength(0);
  });
  it("refuses unsigned or missing-signature-evidence records", async () => {
    state.entry.notification.status = "sent";
    expect((await confirm()).status).toBe(409);
    state.entry.notification.status = "signed"; state.entry.notification.signedAt = null;
    expect((await confirm()).status).toBe(409);
    expect(state.alerts).toHaveLength(0);
  });
  it("uses server actor and targets only authorized HR managers in system notifications", async () => {
    const response = await confirm({ body: { notes: "verified", confirmedBy: "spoofed" } });
    expect(response.status).toBe(200);
    expect(state.entry.notification.confirmedBy).toBe("operations-actor");
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0]).toMatchObject({ targetUserIds: ["hr-authorized"], targetAllBranches: false,
      autoSource: "operations_joining_confirmed", buttonAction: "/hr/onboarding?notificationId=12" });
    expect(state.alerts[0].content).not.toContain("Private candidate");
    const authorizedRow = { notification: { id: state.entry.notification.id } };
    const sourceUrl = new URL(state.alerts[0].buttonAction, "https://app.test");
    expect(findAuthorizedJoiningNotification(sourceUrl.search, [authorizedRow])).toBe(authorizedRow);
    expect(findAuthorizedJoiningNotification(sourceUrl.search, [])).toBeNull();
    expect(state.entry.offer.hiredEmployeeId).toBeNull();
  });
  it("retries, including serialized simultaneous requests, do not duplicate the bell alert", async () => {
    const results = await Promise.all([confirm(), confirm()]);
    expect(results.every(result => result.status === 200)).toBe(true);
    expect(results.some(result => result.body.alreadyConfirmed)).toBe(true);
    expect(state.alerts).toHaveLength(1);
    expect((await confirm()).body.alreadyConfirmed).toBe(true);
    expect(state.alerts).toHaveLength(1);
    expect(state.locks).toHaveLength(3);
  });
  it("does not save approval when no permitted HR recipient exists or alert write fails", async () => {
    state.managers = [];
    expect((await confirm()).status).toBe(409);
    expect(state.entry.notification.status).toBe("signed");
    state.managers = [{ id: "hr-authorized", role: "hr_manager" }];
    state.failure = true;
    expect((await confirm()).status).toBe(500);
    expect(state.entry.notification.status).toBe("signed");
  });
  it("rejects malformed IDs and oversized notes without entering transaction", async () => {
    expect((await confirm({ params: { id: "0" } })).status).toBe(400);
    expect((await confirm({ body: { notes: "x".repeat(1001) } })).status).toBe(400);
    expect(state.locks).toHaveLength(0);
  });
});