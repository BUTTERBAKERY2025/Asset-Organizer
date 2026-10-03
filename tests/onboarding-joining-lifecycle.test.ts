import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  offers: [] as any[], notifications: [] as any[], tokens: [] as any[],
  queue: Promise.resolve(), locks: [] as string[], predicates: [] as string[],
  beforeRead: null as (() => void) | null, beforeUpdate: null as (() => void) | null,
  failInsert: false, failToken: false, updateConflict: false,
  configured: false, providerFailure: false, delivered: true, sends: 0,
}));

vi.mock("../server/db", () => {
  const dialect = new PgDialect();
  const camel = (name: string) => name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const data = (name: string): any[] => name === "job_offers" ? state.offers
    : name === "onboarding_notifications" ? state.notifications
    : name === "onboarding_tokens" ? state.tokens : [];
  const matches = (row: any, predicate: any) => {
    if (!predicate) return true;
    const { sql, params } = dialect.sqlToQuery(predicate);
    // Evaluate the actual simple AND predicates, not a preselected route result.
    const pattern = /"[^"]+"\."([^"]+)" (=|>|in|is null|~)(?: \$(\d+)| \(([^)]+)\))?/g;
    return [...sql.matchAll(pattern)].every(match => {
      const value = row[camel(match[1])];
      const parameter = params[Number(match[3]) - 1];
      if (match[2] === "is null") return value == null;
      if (match[2] === "=") return value === parameter;
      if (match[2] === ">") return new Date(value).getTime() > (match[3] ? new Date(parameter as any).getTime() : Date.now());
      if (match[2] === "~") return new RegExp(String(parameter)).test(value);
      return [...match[4].matchAll(/\$(\d+)/g)].some(item => value === params[Number(item[1]) - 1]);
    });
  };
  const tx: any = {
    execute: async (query: any) => {
      state.locks.push(dialect.sqlToQuery(query).sql);
      if (state.beforeRead) { const callback = state.beforeRead; state.beforeRead = null; callback(); }
    },
    select: (fields: any) => ({
      from(table: any) {
        const name = getTableName(table);
        let predicate: any, joined = false;
        const result = () => {
          const rows = data(name).filter(row => matches(row, predicate));
          if (fields?.n) return [{ n: String(Math.max(0, ...rows.map(row => Number(row.notificationNumber.match(/-(\d+)$/)?.[1] || 0)))) }];
          return rows.map(row => {
            if (joined && fields?.notification) return {
              notification: structuredClone(row),
              offer: structuredClone(state.offers.find(offer => offer.id === row.jobOfferId)),
            };
            if (!fields) return structuredClone(row);
            return Object.fromEntries(Object.entries(fields).map(([key, column]: any) =>
              [key, column?.name ? structuredClone(row[camel(column.name)]) : null]));
          });
        };
        const builder: any = {
          where(value: any) { predicate = value; return builder; },
          orderBy() { return builder; },
          leftJoin() { return builder; },
          innerJoin() { joined = true; return builder; },
          limit: async (count: number) => result().slice(0, count),
          then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
        };
        return builder;
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where(predicate: any) {
          const run = () => {
            if (state.beforeUpdate) { const callback = state.beforeUpdate; state.beforeUpdate = null; callback(); }
            const name = getTableName(table);
            state.predicates.push(dialect.sqlToQuery(predicate).sql);
            if (state.failToken && name === "onboarding_tokens") throw new Error("private token write failure");
            if (state.updateConflict && name === "onboarding_notifications") return [];
            const rows = data(name).filter(row => matches(row, predicate));
            rows.forEach(row => Object.assign(row, values));
            return structuredClone(rows);
          };
          return { returning: async () => run(), then: (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject) };
        },
      }),
    }),
    insert: (table: any) => ({
      values(values: any) {
        const run = () => {
          const name = getTableName(table);
          if (state.failInsert) throw Object.assign(new Error("private unique conflict"), { cause: { code: "23505" } });
          const rows = data(name);
          if (name === "onboarding_notifications" && rows.some(row =>
            row.jobOfferId === values.jobOfferId || row.notificationNumber === values.notificationNumber))
            throw Object.assign(new Error("duplicate"), { code: "23505" });
          const row = {
            id: Math.max(0, ...rows.map(row => row.id)) + 1,
            ...(name === "onboarding_notifications" ? { status: "pending", validityDays: 7,
              sentAt: null, expiresAt: null, convertedEmployeeId: null, convertedBranchEmployeeId: null }
              : { usedAt: null, revokedAt: null }),
            ...values,
          };
          rows.push(row);
          return [structuredClone(row)];
        };
        return { returning: async () => run(), then: (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject) };
      },
    }),
  };
  return { db: { ...tx, transaction: async (callback: any) => {
    const previous = state.queue;
    let release!: () => void;
    state.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const snapshot = structuredClone({ offers: state.offers, notifications: state.notifications, tokens: state.tokens });
    try { return await callback(tx); }
    catch (error) { Object.assign(state, snapshot); throw error; }
    finally { release(); }
  } } };
});
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/operations-hr-routes", () => ({
  operationsHrManagerOnly: (req: any, res: any, next: any) =>
    req.currentUser?.role === "operations_manager" ? next() : res.status(403).json({ error: "denied" }),
}));
vi.mock("../server/twilio-service", () => ({
  isTwilioConfigured: () => state.configured,
  sendWhatsAppMessage: async () => {
    state.sends++;
    if (state.providerFailure) throw new Error("private provider details");
    return state.delivered ? { success: true, messageId: "test-message" } : { success: false, error: "delivery rejected" };
  },
}));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  getAllowedBranchIds: (req: any) => req.allowed,
  getEffectiveBranchFilter: (req: any) => ({ hasAccess: !!req.allowed?.length, branchIds: req.allowed }),
  requirePermission: (module: string, action: string) => (req: any, res: any, next: any) =>
    req.capabilities?.includes(`${module}:${action}`) ? next() : res.status(403).json({ error: "denied" }),
}));
import { registerOnboardingRoutes } from "../server/onboarding-routes";

const routes: Record<string, Function[]> = {};
registerOnboardingRoutes({
  get: (path: string, ...handlers: Function[]) => { routes[`GET ${path}`] = handlers; },
  post: (path: string, ...handlers: Function[]) => { routes[`POST ${path}`] = handlers; },
  patch: (path: string, ...handlers: Function[]) => { routes[`PATCH ${path}`] = handlers; },
} as any);

async function request(path: string, overrides: any = {}) {
  const req: any = {
    method: path.split(" ")[0], params: { id: "12" }, query: {}, body: {},
    currentUser: { id: "ops", role: "operations_manager" }, user: { id: "hr" },
    allowed: ["branch-a", "branch-b"],
    capabilities: ["operations_hr:view", "operations_joining:view", "operations_joining:create",
      "hr_onboarding:create", "hr_onboarding:edit"],
    protocol: "https", get: () => "app.test", headers: {}, ip: "127.0.0.1", ...overrides,
  };
  let status = 200, payload: any;
  const headers: Record<string, string> = {};
  const res: any = {
    set(key: string, value: string) { headers[key] = value; return this; },
    status(value: number) { status = value; return this; },
    json(value: any) { payload = value; return this; },
  };
  const run = async (index: number): Promise<void> => {
    let downstream: Promise<void> | undefined;
    await routes[path][index]?.(req, res, () => { downstream = run(index + 1); });
    await downstream;
  };
  await run(0);
  return { status, payload, headers };
}

const operationsList = "GET /api/operations-hr/joining";
const operationsCreate = "POST /api/operations-hr/joining";
const hrCreate = "POST /api/hr/onboarding";
const operationsSend = "POST /api/operations-hr/joining/:id/send";
const hrSend = "POST /api/hr/onboarding/:id/send";
const createBody = { offerId: 2, jobOfferId: 2, actualStartDate: "2026-10-02" };

beforeEach(() => {
  state.offers = [
    { id: 2, candidateName: "Candidate A", phone: "+966500000000", position: "Baker", branchId: "branch-a",
      branchName: "Branch A", status: "accepted", hiredEmployeeId: null },
    { id: 3, candidateName: "Candidate B", phone: "+966500000001", position: "Baker", branchId: "branch-b",
      branchName: "Branch B", status: "accepted", hiredEmployeeId: null },
    { id: 4, candidateName: "Out of scope", branchId: "branch-c", status: "accepted", hiredEmployeeId: null },
  ];
  state.notifications = [{ id: 12, jobOfferId: 2, notificationNumber: `ONB-${new Date().getFullYear()}-0001`,
    branchId: "branch-a", branchName: "Branch A", candidateName: "Candidate A", phone: "+966500000000",
    position: "Baker", status: "pending", validityDays: 7, actualStartDate: "2026-10-02",
    sentAt: null, expiresAt: null, signedAt: null, confirmedAt: null, convertedEmployeeId: null, convertedBranchEmployeeId: null }];
  state.tokens = [];
  state.locks = []; state.predicates = []; state.queue = Promise.resolve();
  state.beforeRead = null; state.beforeUpdate = null; state.failInsert = false; state.failToken = false;
  state.updateConflict = false; state.configured = false; state.providerFailure = false; state.delivered = true; state.sends = 0;
});

describe("operations joining branch selection and privacy", () => {
  it("validates optional selected branch, excludes ungranted offers and requires existing capabilities", async () => {
    expect((await request(operationsList)).payload.map((row: any) => row.id)).toEqual([2, 3]);
    expect((await request(operationsList, { query: { branchId: "branch-b" } })).payload.map((row: any) => row.id)).toEqual([3]);
    for (const branchId of ["", [], { id: "branch-a" }]) expect((await request(operationsList, { query: { branchId } })).status).toBe(400);
    for (const branchId of ["branch-c", "main_warehouse"]) expect((await request(operationsList, { query: { branchId } })).status).toBe(403);
    expect((await request(operationsList, { capabilities: ["operations_hr:view"] })).status).toBe(403);
    expect((await request(operationsList, { currentUser: { role: "hr_manager" } })).status).toBe(403);
    expect((await request(operationsList, { allowed: [] })).payload).toEqual([]);
  });
  it("surfaces an existing wrong-branch blocker without leaking notification identity, branch, state or confirmation", async () => {
    Object.assign(state.notifications[0], { id: 9876, branchId: "secret-branch", status: "confirmed", confirmedNotes: "private notes" });
    const response = await request(operationsList, { query: { branchId: "branch-a" } });
    expect(response.payload[0]).toMatchObject({ notification: null, blockedExisting: true });
    expect(response.payload[0].blockedReason).toContain("شؤون الموظفين");
    expect(JSON.stringify(response.payload)).not.toMatch(/9876|secret-branch|confirmed|private notes/);
    const conflict = await request(operationsCreate, { body: createBody });
    expect(conflict.status).toBe(409);
    expect(conflict.payload).toMatchObject({ blockedExisting: true });
    expect(conflict.payload.notificationId).toBeUndefined();
  });
  it("exposes authorized reference/send dates and consistently shows converted offers without recreating", async () => {
    const sentAt = new Date("2026-10-01T08:00:00Z"), expiresAt = new Date("2026-10-08T08:00:00Z");
    Object.assign(state.notifications[0], { status: "sent", sentAt, expiresAt });
    expect((await request(operationsList)).payload[0].notification).toMatchObject({ notificationNumber: state.notifications[0].notificationNumber, sentAt, expiresAt });
    state.notifications[0].status = "converted";
    expect((await request(operationsList)).payload[0]).toMatchObject({ status: "converted", notification: { status: "converted" } });
    state.notifications[0].status = "confirmed"; state.offers[0].hiredEmployeeId = "hired-user";
    expect((await request(operationsList)).payload[0]).toMatchObject({ status: "converted", notification: { status: "converted" } });
    state.notifications = [];
    expect((await request(operationsList)).payload[0]).toMatchObject({ status: "converted", notification: null });
    expect((await request(operationsCreate, { body: createBody })).status).toBe(409);
    expect((await request(hrCreate, { body: createBody })).status).toBe(409);
  });
});

describe("serialized HR / operations notification creation", () => {
  it("takes the same global allocation lock before offer lock and assigns distinct numbers across offers", async () => {
    state.notifications = [];
    const results = await Promise.all([
      request(operationsCreate, { body: createBody }),
      request(hrCreate, { body: { ...createBody, jobOfferId: 3 } }),
    ]);
    expect(results.map(result => result.status)).toEqual([201, 201]);
    expect(new Set(state.notifications.map(row => row.notificationNumber)).size).toBe(2);
    expect(state.locks[0]).toContain("pg_advisory_xact_lock(1869505102, 1)");
    expect(state.locks[1]).toMatch(/job_offers.*FOR UPDATE/);
    expect(state.locks[2]).toBe(state.locks[0]);
    expect(state.locks[3]).toBe(state.locks[1]);
  });
  it("same-offer concurrent HR/operations create makes one notification and reports 409 for the other", async () => {
    state.notifications = [];
    const results = await Promise.all([request(hrCreate, { body: createBody }), request(operationsCreate, { body: createBody })]);
    expect(results.map(result => result.status)).toEqual([201, 409]);
    expect(state.notifications).toHaveLength(1);
  });
  it("uses the maximum existing number, not last id, and maps wrapped unique conflicts to 409", async () => {
    state.notifications[0].notificationNumber = `ONB-${new Date().getFullYear()}-9999`;
    expect((await request(hrCreate, { body: { ...createBody, jobOfferId: 3 } })).payload.notificationNumber).toMatch(/-10000$/);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      state.notifications = []; state.failInsert = true;
      for (const path of [operationsCreate, hrCreate]) {
        const response = await request(path, { body: createBody });
        expect(response.status).toBe(409);
        expect(JSON.stringify(response.payload)).not.toContain("private unique");
      }
      expect(state.notifications).toHaveLength(0);
    } finally { log.mockRestore(); }
  });
  it("checks offer acceptance and scope after locks and never reveals HR duplicate from an unauthorized branch", async () => {
    state.notifications = [];
    state.beforeRead = () => { state.offers[0].branchId = "branch-c"; };
    expect((await request(operationsCreate, { body: createBody })).status).toBe(403);
    expect(state.notifications).toHaveLength(0);
    state.offers[0].branchId = "branch-a"; state.offers[0].status = "rejected";
    expect((await request(hrCreate, { body: createBody })).status).toBe(400);
    state.offers[0].status = "accepted";
    state.notifications = [{ id: 9876, jobOfferId: 2, branchId: "branch-c", candidateName: "Secret" }];
    const response = await request(hrCreate, { body: createBody });
    expect(response.status).toBe(409);
    expect(JSON.stringify(response.payload)).not.toMatch(/9876|Secret|branch-c/);
  });
});

describe("shared HR / operations retry-safe sends", () => {
  it("reuses the still-valid saved token across sequential and concurrent sends without changing expiry or sentAt", async () => {
    const first = await request(operationsSend);
    const subsequent = await Promise.all([request(operationsSend), request(hrSend)]);
    expect(first.status).toBe(200);
    expect(first.payload.tokenReused).toBe(false);
    for (const response of subsequent) {
      expect(response.status).toBe(200);
      expect(response.payload).toMatchObject({ link: first.payload.link, tokenReused: true,
        sentAt: first.payload.sentAt, expiresAt: first.payload.expiresAt });
    }
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0].revokedAt).toBeNull();
    expect(state.locks[0]).toMatch(/onboarding_notifications.*FOR UPDATE/);
    expect(state.locks[1]).toMatch(/job_offers[\s\S]*FOR UPDATE/);
    expect(first.headers["Cache-Control"]).toBe("no-store");
    expect(first.payload.whatsapp).toMatchObject({ success: false, skipped: true, status: "skipped" });
    expect(state.sends).toBe(0);
  });
  it("renews only on explicit replacement or no remaining valid token, revoking the previous link", async () => {
    const first = await request(operationsSend);
    const replacement = await request(hrSend, { body: { replaceToken: true } });
    expect(replacement.payload.link).not.toBe(first.payload.link);
    expect(replacement.payload.tokenReused).toBe(false);
    expect(state.tokens[0].revokedAt).not.toBeNull();
    expect(state.tokens[1].revokedAt).toBeNull();
    expect((await request(operationsSend, { body: { replaceToken: "true" } })).status).toBe(400);
    state.tokens[1].expiresAt = new Date(0);
    const renewed = await request(operationsSend);
    expect(renewed.status).toBe(200);
    expect(renewed.payload.link).not.toBe(replacement.payload.link);
    expect(state.tokens).toHaveLength(3);
  });
  it("HR WhatsApp-link mode prepares a reusable link without sending a provider message", async () => {
    state.configured = true;
    const first = await request(hrSend, { body: { deliveryMode: "whatsapp_link" } });
    const again = await request(hrSend, { body: { deliveryMode: "whatsapp_link" } });
    expect(first.status).toBe(200);
    expect(first.payload.whatsapp.status).toBe("manual");
    expect(again.payload.link).toBe(first.payload.link);
    expect(state.sends).toBe(0);
    expect(state.tokens).toHaveLength(1);
    expect((await request(hrSend, { body: { deliveryMode: "invalid" } })).status).toBe(400);
  });
  it("returns saved link with truthful provider success/failure, including exception, never a post-commit 500", async () => {
    state.configured = true; state.providerFailure = true;
    const failure = await request(operationsSend);
    expect(failure.status).toBe(200);
    expect(failure.payload.whatsapp).toMatchObject({ success: false, skipped: false, status: "failed" });
    expect(failure.payload.link).toContain(state.tokens[0].token);
    expect(JSON.stringify(failure.payload)).not.toContain("private provider");
    state.providerFailure = false; state.delivered = false;
    expect((await request(hrSend)).payload.whatsapp).toMatchObject({ success: false, skipped: false, status: "failed" });
    state.delivered = true;
    const success = await request(operationsSend);
    expect(success.payload.whatsapp).toMatchObject({ success: true, skipped: false, status: "sent" });
    expect(success.payload.link).toBe(failure.payload.link);
  });
  it("rereads changed branch/acceptance/signature after locks and never overwrites any terminal state", async () => {
    state.beforeRead = () => { state.offers[0].branchId = "branch-c"; };
    expect((await request(operationsSend)).status).toBe(403);
    state.offers[0].branchId = "branch-a";
    state.beforeRead = () => { state.offers[0].status = "rejected"; };
    expect((await request(operationsSend)).status).toBe(403);
    state.offers[0].status = "accepted";
    state.beforeRead = () => { state.notifications[0].status = "signed"; };
    expect((await request(hrSend)).status).toBe(409);
    for (const status of ["signed", "confirmed", "converted", "cancelled"]) {
      state.notifications[0].status = status;
      for (const path of [operationsSend, hrSend]) expect((await request(path)).status).toBe(409);
      expect(state.notifications[0].status).toBe(status);
    }
    state.notifications[0].status = "sent"; state.offers[0].hiredEmployeeId = "hired";
    expect((await request(operationsSend)).status).toBe(409);
    expect(state.tokens).toHaveLength(0);
  });
  it("rolls token creation/revocation back with notification write conflict", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      state.updateConflict = true;
      expect((await request(operationsSend)).status).toBe(409);
      expect(state.tokens).toHaveLength(0);
      expect(state.notifications[0].status).toBe("pending");
    } finally { log.mockRestore(); }
  });
  it("serialized real route signing and retrying preserves the first token/signature and forbids later renewal", async () => {
    const first = await request(operationsSend);
    const sign = () => request("POST /api/public/onboarding/:token/sign", {
      params: { token: state.tokens[0].token }, body: { signature: "First signature", selfiePhotoUrl: "/test-photo" },
    });
    const results = await Promise.all([sign(), request(hrSend)]);
    expect(results.map(result => result.status)).toEqual([200, 409]);
    expect(state.notifications[0].status).toBe("signed");
    expect(state.notifications[0].employeeSignature).toBe("First signature");
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0].usedAt).not.toBeNull();
    expect(state.tokens[0].revokedAt).toBeNull();
    expect(first.payload.link).toContain(state.tokens[0].token);
    expect((await request(operationsSend, { body: { replaceToken: true } })).status).toBe(409);
  });
});

describe("minimal HR state-change CAS", () => {
  it("edit and confirmation reject concurrent signature/terminal changes without overwriting", async () => {
    state.beforeUpdate = () => { state.notifications[0].status = "signed"; };
    expect((await request("PATCH /api/hr/onboarding/:id", { body: { actualStartDate: "2026-10-03" } })).status).toBe(409);
    expect(state.notifications[0].actualStartDate).toBe("2026-10-02");
    state.beforeUpdate = () => { state.notifications[0].status = "converted"; };
    expect((await request("POST /api/hr/onboarding/:id/confirm")).status).toBe(409);
    expect(state.notifications[0].status).toBe("converted");
    expect(state.predicates.every(predicate => predicate.includes('"status" ='))).toBe(true);
  });
  it("cancel rejects a signature that raced HR's reviewed state, and rolls cancellation back on token failure", async () => {
    state.beforeUpdate = () => { state.notifications[0].status = "signed"; };
    expect((await request("POST /api/hr/onboarding/:id/cancel")).status).toBe(409);
    expect(state.notifications[0].status).toBe("signed");
    state.notifications[0].status = "sent"; state.failToken = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await request("POST /api/hr/onboarding/:id/cancel")).status).toBe(500);
      expect(state.notifications[0].status).toBe("sent");
    } finally { log.mockRestore(); }
  });
});