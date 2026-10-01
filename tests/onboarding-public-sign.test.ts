import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  token: null as any, notification: null as any, queue: Promise.resolve(),
  locks: [] as string[], predicates: [] as string[], writes: [] as string[],
  beforeRead: null as (() => void) | null,
  failToken: false, tokenConflict: false, notificationConflict: false,
  failNotice: false, notices: [] as any[],
}));
vi.mock("../server/db", () => {
  const dialect = new PgDialect();
  const tx: any = {
    execute: async (query: any) => {
      state.locks.push(dialect.sqlToQuery(query).sql);
      if (state.beforeRead) { const callback = state.beforeRead; state.beforeRead = null; callback(); }
    },
    select: () => ({ from: (table: any) => ({ where: () => ({ limit: async () => {
      const name = getTableName(table);
      const row = name === "onboarding_tokens" ? state.token
        : name === "onboarding_notifications" ? state.notification : null;
      return row ? [structuredClone(row)] : [];
    } }) }) }),
    update: (table: any) => ({ set: (values: any) => ({ where: (predicate: any) => ({ returning: async () => {
      const name = getTableName(table);
      state.predicates.push(dialect.sqlToQuery(predicate).sql);
      if (name === "onboarding_tokens") {
        if (state.failToken) throw new Error("private database failure");
        if (state.tokenConflict) return [];
        Object.assign(state.token, values);
      } else {
        if (state.notificationConflict) return [];
        Object.assign(state.notification, values);
      }
      state.writes.push(name);
      return [{ id: name === "onboarding_tokens" ? state.token.id : state.notification.id }];
    } }) }) }),
  };
  return { db: { transaction: async (callback: any) => {
    const previous = state.queue;
    let release!: () => void;
    state.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const snapshot = structuredClone({ token: state.token, notification: state.notification });
    try { return await callback(tx); }
    catch (error) { state.token = snapshot.token; state.notification = snapshot.notification; throw error; }
    finally { release(); }
  } } };
});
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/hr-system-notifications", () => ({
  queueHrSourceNotification: async (source: string, id: number, executor: any) => {
    if (state.failNotice) throw new Error("private notice failure");
    state.notices.push({ source, id, transactional: !!executor?.update });
  },
}));
vi.mock("../server/twilio-service", () => ({ sendWhatsAppMessage: vi.fn(), isTwilioConfigured: () => false }));
vi.mock("../server/auth", () => ({
  isAuthenticated: () => {}, requirePermission: () => () => {},
  getEffectiveBranchFilter: () => ({ hasAccess: false }), getAllowedBranchIds: () => [],
}));
import { registerOnboardingRoutes } from "../server/onboarding-routes";

let signHandler: Function;
registerOnboardingRoutes({
  get() {}, patch() {}, put() {}, delete() {},
  post(path: string, ...handlers: Function[]) {
    if (path === "/api/public/onboarding/:token/sign") signHandler = handlers.at(-1)!;
  },
} as any);
async function sign(body: any = { signature: "test signature", selfiePhotoUrl: "/test-photo" }) {
  let status = 200, payload: any;
  const res: any = { status(value: number) { status = value; return this; }, json(value: any) { payload = value; return this; } };
  await signHandler({ params: { token: "test-token" }, body, headers: {}, ip: "127.0.0.1" }, res);
  return { status, payload };
}

beforeEach(() => {
  state.token = { id: 3, token: "test-token", notificationId: 12, usedAt: null, revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000) };
  state.notification = { id: 12, status: "sent", branchId: null, employeeSignature: null };
  state.locks = []; state.predicates = []; state.writes = []; state.queue = Promise.resolve();
  state.beforeRead = null; state.failToken = false; state.tokenConflict = false; state.notificationConflict = false;
  state.failNotice = false; state.notices = [];
});

describe("atomic public work-commencement signing", () => {
  it("locks notification before token (same order as resend), saves both, and preserves public response", async () => {
    expect(await sign()).toEqual({ status: 200, payload: { success: true, distanceM: null, withinRadius: null } });
    expect(state.locks[0]).toMatch(/FOR UPDATE OF n$/);
    expect(state.locks[1]).toMatch(/onboarding_tokens.*FOR UPDATE$/);
    expect(state.writes).toEqual(["onboarding_notifications", "onboarding_tokens"]);
    expect(state.notification.status).toBe("signed");
    expect(state.token.usedAt).toEqual(state.notification.signedAt);
    expect(state.predicates[0]).toContain('"status" in');
    expect(state.predicates[1]).toContain('"used_at" is null');
    expect(state.predicates[1]).toContain('"revoked_at" is null');
    expect(state.predicates[1]).toContain('"expires_at" > clock_timestamp()');
  });
  it("validates required inputs before entering a transaction", async () => {
    expect((await sign({ selfiePhotoUrl: "/test-photo" })).status).toBe(400);
    expect((await sign({ signature: "test" })).status).toBe(400);
    expect(state.locks).toHaveLength(0);
  });
  it("queues the signed joining notice in the source transaction once, and rolls back on insert failure", async () => {
    state.notification.branchId = "a";
    expect((await sign()).status).toBe(200);
    expect(state.notices).toEqual([{ source: "joining", id: 12, transactional: true }]);
    expect((await sign()).status).toBe(410);
    expect(state.notices).toHaveLength(1);
    state.notification.status = "sent"; state.notification.employeeSignature = null;
    state.token.usedAt = null; state.failNotice = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await sign();
      expect(result.status).toBe(500);
      expect(JSON.stringify(result.payload)).not.toContain("private notice failure");
      expect(state.notification.status).toBe("sent");
      expect(state.token.usedAt).toBeNull();
    } finally { log.mockRestore(); }
  });
  it("refuses absent, revoked, used and expired tokens without saving a signature", async () => {
    const original = structuredClone(state.token);
    state.token = null;
    expect((await sign()).status).toBe(404);
    for (const patch of [{ revokedAt: new Date() }, { usedAt: new Date() }, { expiresAt: new Date(0) }]) {
      state.token = { ...original, ...patch };
      expect((await sign()).status).toBe(410);
    }
    expect(state.writes).toHaveLength(0);
  });
  it("rechecks cancellation or revocation that happens before the locked reads", async () => {
    state.beforeRead = () => { state.notification.status = "cancelled"; };
    expect((await sign()).status).toBe(409);
    expect(state.notification.status).toBe("cancelled");
    state.notification.status = "sent";
    state.beforeRead = () => { state.token.revokedAt = new Date(); };
    expect((await sign()).status).toBe(410);
    expect(state.writes).toHaveLength(0);
  });
  it("never overwrites signed, confirmed, converted or cancelled records even with an unused token", async () => {
    for (const status of ["signed", "confirmed", "converted", "cancelled"]) {
      state.notification.status = status;
      state.notification.employeeSignature = "original";
      expect((await sign()).status).toBe(409);
      expect(state.notification).toMatchObject({ status, employeeSignature: "original" });
    }
    expect(state.token.usedAt).toBeNull();
    expect(state.writes).toHaveLength(0);
  });
  it("rejects repeat and serialized concurrent token use without replacing the first signature", async () => {
    const results = await Promise.all([sign(), sign({ signature: "replacement", selfiePhotoUrl: "/other" })]);
    expect(results.map(result => result.status)).toEqual([200, 410]);
    expect(state.notification.employeeSignature).toBe("test signature");
    expect((await sign()).status).toBe(410);
    expect(state.writes).toHaveLength(2);
  });
  it("rolls back the signature when token use fails, without exposing the database error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      state.failToken = true;
      const result = await sign();
      expect(result.status).toBe(500);
      expect(JSON.stringify(result.payload)).not.toContain("private database failure");
      expect(state.notification.status).toBe("sent");
      expect(state.token.usedAt).toBeNull();
    } finally { log.mockRestore(); }
  });
  it("rolls back on a rejected conditional write and returns an explicit state conflict", async () => {
    state.tokenConflict = true;
    expect((await sign()).status).toBe(409);
    expect(state.notification.status).toBe("sent");
    expect(state.token.usedAt).toBeNull();
    state.tokenConflict = false; state.notificationConflict = true;
    expect((await sign()).status).toBe(409);
    expect(state.token.usedAt).toBeNull();
  });
});