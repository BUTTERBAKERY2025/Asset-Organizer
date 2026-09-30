import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

let grant = ["a"];
let active = true;
let permission = true;

vi.mock("../server/auth", () => ({
  getAllowedBranchIds: (req: any) =>
    req.userBranchAccess?.map((row: { branchId: string }) => row.branchId) ??
    (req.currentUser?.id === "user-1" ? grant : ["a"]),
  isAuthenticated: (req: any, res: any, next: () => void) => {
    req.userBranchAccess = (req.currentUser?.id === "user-1" ? grant : ["a"])
      .map(branchId => ({ branchId }));
    return active ? next() : res.status(403).json({ error: "inactive" });
  },
  requirePermission: () => (_req: unknown, res: any, next: () => void) =>
    permission ? next() : res.status(403).json({ error: "denied" }),
}));
vi.mock("../server/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => Promise.resolve([{ id: "a" }]) }) }) },
}));
vi.mock("../server/storage", () => ({
  storage: {
    getUser: async (id: string) => ({ id, isActive: "active", role: "employee" }),
    getUserBranchAccess: async (id: string) =>
      (id === "unrelated" ? ["b"] : id === "user-1" ? grant : ["a"])
        .map(branchId => ({ branchId })),
  },
}));
import { isOperationsCenterWrite, parseOperationsCenterScope, registerOperationsCenterLive, scopesOverlap } from "../server/operations-center-live";

class FakeResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  headersSent = false;
  chunks: string[] = [];
  status(code: number) { this.statusCode = code; return this; }
  set() { return this; }
  json(value: unknown) { this.chunks.push(JSON.stringify(value)); return this; }
  flushHeaders() { this.headersSent = true; }
  write(value: string) { this.chunks.push(value); return true; }
  end() { this.writableEnded = true; this.emit("close"); return this; }
}

function makeFixture() {
  let writeMiddleware: any;
  let route: any;
  const app = {
    use(fn: unknown) { writeMiddleware = fn; },
    get(_path: string, ...handlers: unknown[]) { route = handlers.at(-1); },
  };
  registerOperationsCenterLive(app as any);
  const req: any = Object.assign(new EventEmitter(), {
    query: { branchIds: "a" },
    headers: { "last-event-id": "arbitrary-replay-id" },
    currentUser: { id: "user-1" },
    session: { reload(callback: (error?: Error) => void) { callback(); } },
  });
  const res = new FakeResponse();
  return { req, res, route, writeMiddleware };
}

afterEach(() => {
  grant = ["a"];
  active = true;
  permission = true;
  vi.useRealTimers();
});

describe("Operations Center SSE input and mutation filters", () => {
  it("requires explicit bounded, syntactically valid branch selections", () => {
    expect(parseOperationsCenterScope(undefined)).toBeNull();
    expect(parseOperationsCenterScope("all")).toBeNull();
    expect(parseOperationsCenterScope("a,b,a")).toEqual(["a", "b"]);
    expect(parseOperationsCenterScope(["a", "b"])).toEqual(["a", "b"]);
    expect(parseOperationsCenterScope("a,")).toBeNull();
    expect(parseOperationsCenterScope("a\nb")).toBeNull();
    expect(parseOperationsCenterScope(Array(26).fill("a"))).toBeNull();
    expect(parseOperationsCenterScope("a?branchId=other")).toBeNull();
  });

  it("only signals for successful writes on explicitly allowlisted routes", () => {
    // These are paths registered by actual operational write handlers, not
    // frontend navigation links (e.g. /api/purchasing/requests, NOT
    // /api/purchasing-requests).
    const routes: Array<[string, string]> = [
      ["PATCH", "/api/branch-complaints/1"],
      ["POST", "/api/maintenance-tickets/1/transition"],
      ["POST", "/api/hr/leaves/1/review"],
      ["PATCH", "/api/hr/advances/1"],
      ["POST", "/api/hr/documents"],
      ["POST", "/api/quality-checks"],
      ["PATCH", "/api/attendance/1"],
      ["POST", "/api/attendance-summary/calculate/123/2026-03"],
      ["POST", "/api/shifts"],
      ["PATCH", "/api/shift-employees/1"],
      ["POST", "/api/employee-schedules/bulk"],
      ["POST", "/api/branch-shifts/1/responses"],
      ["POST", "/api/time-entries"],
      ["POST", "/api/timesheet-reports/1/sign"],
      ["POST", "/api/reverse-logistics/1/dispatch"],
      ["POST", "/api/deliveries/1/complete"],
      ["POST", "/api/central-kitchen-orders/1/receive"],
      ["POST", "/api/central-kitchen-demand/1/actions"],
      ["POST", "/api/kitchen-warehouse-shipping/1/dispatch"],
      ["PUT", "/api/warehouse/material-transfers/1/status"],
      ["POST", "/api/warehouse/kitchen-raw-requests"],
      ["PUT", "/api/purchasing/requests/1/status"],
      ["POST", "/api/waste-reports/1/items"],
      ["POST", "/api/display-bar/receipts"],
      ["POST", "/api/production-orders"],
      ["POST", "/api/advanced-production-orders"],
      ["POST", "/api/cashier-journals/1/approve"],
      ["POST", "/api/branch-daily-closures/1/close"],
      ["PUT", "/api/branch-employees/1"],
      ["PATCH", "/api/targets/monthly/1"],
      ["POST", "/api/analytics/compute-daily-sales"],
    ];
    for (const [method, path] of routes) {
      expect(isOperationsCenterWrite(method, path), `${method} ${path}`).toBe(true);
      expect(isOperationsCenterWrite("GET", path), `GET ${path}`).toBe(false);
    }
    for (const path of [
      "/api/branch-complaints-foreign",
      "/api/maintenance-tickets-export",
      "/api/hr/leaves-export",
      "/api/hr/advances-extra",
      "/api/hr/documents-export",
      "/api/quality-checks-v2",
      "/api/attendance-log",
      "/api/shift-profiles-other",
      "/api/timesheet-reports-old",
      "/api/timesheet-reports/generate-branch-pdf",
      "/api/timesheet-reports/1/generate-pdf",
      "/api/reverse-logistics-history",
      "/api/deliveries-archive",
      "/api/central-kitchen-orders-pilot",
      "/api/warehouse/material-transfers-export",
      "/api/purchasing-requests", // navigational alias is not a write route
      "/api/material-transfers",
      "/api/users/1",
      "/api/operations-center/events",
      "/api/branch-operations",
      "/api/targets-history",
      "/api/analytics/compute-daily-sales-report",
    ]) expect(isOperationsCenterWrite("POST", path), path).toBe(false);
    expect(scopesOverlap(["a"], ["a"])).toBe(true);
    expect(scopesOverlap(["b"], ["a"])).toBe(false);
    expect(scopesOverlap(null, ["a"])).toBe(true);
  });
});

describe("Operations Center stream lifecycle", () => {
  it("rejects unauthorized selected branches before opening a stream", async () => {
    grant = ["b"];
    const { req, res, route } = makeFixture();
    await route(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.headersSent).toBe(false);
  });

  it("closes on a grant revoke, account deactivation or permission revoke at keepalive", async () => {
    vi.useFakeTimers();
    for (const revoke of [
      () => { grant = []; },
      () => { active = false; },
      () => { permission = false; },
    ]) {
      grant = ["a"]; active = true; permission = true;
      const { req, res, route } = makeFixture();
      await route(req, res);
      expect(res.chunks.join("")).toContain("event: ready");
      revoke();
      await vi.advanceTimersByTimeAsync(15_001);
      expect(res.writableEnded).toBe(true);
      expect(res.chunks.join("")).toContain("event: scope-invalidated");
    }
  });

  it("fans out to another authorized viewer in the same branch, but not unrelated scope, and cleans up", async () => {
    vi.useFakeTimers();
    const { req, res, route, writeMiddleware } = makeFixture();
    const second = makeFixture();
    second.req.currentUser = { id: "user-2" };
    await route(req, res);
    await second.route(second.req, second.res);
    expect(res.chunks.join("")).not.toContain("id:");
    expect(res.chunks.join("")).not.toContain("event: invalidate");
    const write = (userId: string, statusCode: number) => {
      const writeReq = { method: "PATCH", path: "/api/branch-complaints/1", currentUser: { id: userId } };
      const writeRes = new FakeResponse();
      writeRes.statusCode = statusCode;
      writeMiddleware(writeReq, writeRes, () => {});
      writeRes.emit("finish");
    };
    write("unrelated", 200);
    for (const status of [400, 403, 409, 500]) write("user-1", status);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(res.chunks.join("")).not.toContain("event: invalidate");
    write("user-1", 200);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(res.chunks.filter(value => value.includes("event: invalidate"))).toHaveLength(1);
    expect(second.res.chunks.filter(value => value.includes("event: invalidate"))).toHaveLength(1);
    res.end();
    second.res.end();
    write("user-1", 200);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(res.chunks.filter(value => value.includes("event: invalidate"))).toHaveLength(1);
    expect(second.res.chunks.filter(value => value.includes("event: invalidate"))).toHaveLength(1);
  });

  it("does not send a hint to a freshly revoked second viewer", async () => {
    vi.useFakeTimers();
    const actor = makeFixture();
    const viewer = makeFixture();
    viewer.req.currentUser = { id: "user-2" };
    await actor.route(actor.req, actor.res);
    await viewer.route(viewer.req, viewer.res);
    permission = false;
    const writeRes = new FakeResponse();
    actor.writeMiddleware(
      { method: "PATCH", path: "/api/branch-complaints/1", currentUser: { id: "user-1" } },
      writeRes,
      () => {},
    );
    writeRes.emit("finish");
    await vi.advanceTimersByTimeAsync(1_001);
    expect(viewer.res.writableEnded).toBe(true);
    expect(viewer.res.chunks.join("")).not.toContain("event: invalidate");
    actor.res.end();
  });
});