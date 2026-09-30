import { describe, expect, it, vi, beforeEach } from "vitest";
import { noticeInSelectedScope, parseNoticeAction, publicCenterNotice } from "../shared/operations-center-notifications";

const state = vi.hoisted(() => ({
  grants: ["a"] as string[], rows: ["a", "b"] as string[],
  lookup: [] as string[],
  notices: {} as Record<string, any[]>, reads: [] as number[],
  bulkLookups: [] as string[][],
  marked: [] as number[], dismissed: [] as number[],
}));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAllowedBranchIds: () => state.grants,
}));
vi.mock("../server/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => Promise.resolve(state.lookup.map(id => ({ id }))) }) }) },
  pool: {},
}));
vi.mock("../server/storage", () => ({
  storage: {
    getActiveNotificationsForUserInBranches: async (_user: string, branches: string[]) => {
      state.bulkLookups.push(branches);
      return [...new Map(branches.flatMap(branch => state.notices[branch] || []).map(row => [row.id, row])).values()];
    },
    getNotificationReadsByUser: async () => state.reads.map(notificationId => ({ notificationId })),
    markNotificationRead: async (id: number) => { state.marked.push(id); },
    dismissNotification: async (id: number) => { state.dismissed.push(id); },
  },
}));
import { registerOperationsCenterRoutes } from "../server/operations-center";

const notice = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, title: "title", content: "message", messageType: "announcement", priority: 3,
  createdAt: new Date(), targetAllBranches: false, targetBranchIds: ["a"],
  accessBranchIds: null, targetUserIds: ["viewer"], buttonAction: "/maintenance",
  buttonText: "Open", ...overrides,
});
const handlers: Record<string, (...args: any[]) => Promise<any>> = {};
registerOperationsCenterRoutes({
  get: (path: string, ...fns: any[]) => { handlers[`GET ${path}`] = fns.at(-1); },
  post: (path: string, ...fns: any[]) => { handlers[`POST ${path}`] = fns.at(-1); },
} as any);
async function call(method: "GET" | "POST", scope: string | undefined, id?: string, action?: string) {
  state.lookup = state.rows.filter(row => scope?.split(",").includes(row));
  const path = method === "GET" ? "/api/operations-center/notifications" : "/api/operations-center/notifications/:id/:action";
  const req = { query: scope === undefined ? {} : { branchIds: scope }, params: { id, action }, currentUser: { id: "viewer" } };
  const res: any = { code: 200, body: undefined,
    set: () => res, status: (code: number) => { res.code = code; return res; },
    json: (body: unknown) => { res.body = body; return res; } };
  await handlers[`${method} ${path}`](req, res, (error: unknown) => { throw error; });
  return res;
}

describe("selected operations notifications", () => {
  beforeEach(() => {
    state.grants = ["a"]; state.rows = ["a", "b"]; state.notices = {};
    state.reads = []; state.marked = []; state.dismissed = []; state.bulkLookups = [];
  });
  it("denies unauthorized branches and empty grants without fetching recipient rows", async () => {
    expect((await call("GET", "a,b")).code).toBe(403);
    state.grants = [];
    expect((await call("GET", "a")).code).toBe(403);
    expect((await call("GET", undefined)).code).toBe(400);
    expect(state.bulkLookups).toEqual([]);
  });
  it("fetches selected notifications once in bulk, without widening branch scope", async () => {
    state.grants = ["a", "b"];
    state.notices = { a: [notice(1)], b: [notice(2, { targetBranchIds: ["b"] })] };
    expect((await call("GET", "a,b")).body).toHaveLength(2);
    expect(state.bulkLookups).toEqual([["a", "b"]]);
  });
  it("deduplicates visible notices, only emits safe fields and own read status", async () => {
    state.notices = { a: [notice(1, { targetUserIds: ["viewer"], createdBy: "secret", targetRoleIds: ["admin"] })] };
    state.reads = [1];
    const response = await call("GET", "a");
    expect(response.code).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ id: 1, read: true, kind: "branch", branchIds: ["a"] });
    for (const key of ["targetUserIds", "targetRoleIds", "createdBy", "targetBranchIds", "accessBranchIds"])
      expect(response.body[0]).not.toHaveProperty(key);
  });
  it("rejects cross-branch writes and forged recipients; rechecks visibility on each write", async () => {
    state.notices = { a: [notice(1)] };
    expect((await call("POST", "b", "1", "read")).code).toBe(403);
    expect((await call("POST", "a", "2", "dismiss")).code).toBe(403);
    expect((await call("POST", "a", "1", "read")).code).toBe(200);
    state.notices.a = []; // removed by canonical targeting or revocation
    expect((await call("POST", "a", "1", "dismiss")).code).toBe(403);
    expect(state.marked).toEqual([1]);
    expect(state.dismissed).toEqual([]);
  });
  it("does not let a grant to two branches authorize an unselected branch's notification", async () => {
    state.grants = ["a", "b"];
    state.notices = { b: [notice(7, { targetBranchIds: ["b"], accessBranchIds: ["b"] })] };
    expect((await call("POST", "a", "7", "read")).code).toBe(403);
    expect((await call("POST", "b", "7", "read")).code).toBe(200);
    expect(state.marked).toEqual([7]);
  });
  it("rejects malformed actions and unselected multi-branch notices", async () => {
    state.notices = { a: [notice(1, { accessBranchIds: ["a", "b"] })] };
    expect((await call("GET", "a")).body).toEqual([]);
    expect((await call("POST", "a", "1", "read")).code).toBe(403);
    expect((await call("POST", "a", "1foo", "read")).code).toBe(400);
    expect((await call("POST", "a", "1", "erase")).code).toBe(400);
  });
});

describe("notice display boundary", () => {
  it("keeps broadcasts distinct and fails closed for unknown scope", () => {
    expect(noticeInSelectedScope(notice(1, { targetAllBranches: true, targetBranchIds: null }), ["a"])).toEqual({ kind: "general", branchIds: [] });
    expect(noticeInSelectedScope(notice(2, { targetAllBranches: false, targetBranchIds: null }), ["a"])).toBeNull();
    expect(noticeInSelectedScope(notice(3, { accessBranchIds: ["a", "b"] }), ["a"])).toBeNull();
  });
  it("rejects external, protocol-relative and malformed navigation", () => {
    expect(parseNoticeAction("/maintenance?branchId=a", "https://app.test")).toBe("/maintenance?branchId=a");
    for (const href of ["https://other.test", "//other.test", "/\\other.test", "javascript:alert(1)", "/hello\nworld"])
      expect(parseNoticeAction(href, "https://app.test")).toBeNull();
  });
  it("never serializes recipient identifiers", () => {
    const result = publicCenterNotice(notice(1, { targetUserIds: ["private"] }) as any, { kind: "general", branchIds: [] }, false);
    expect(JSON.stringify(result)).not.toContain("private");
  });
});