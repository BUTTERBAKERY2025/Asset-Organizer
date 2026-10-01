import pg from "pg";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: null as any, client: null as any }));
vi.mock("../server/db", () => ({
  db: new Proxy({}, { get: (_target, key) => {
    const value = state.db?.[key];
    return typeof value === "function" ? value.bind(state.db) : value;
  } }),
  pool: { query: (...args: any[]) => state.client.query(...args) },
}));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import { storage } from "../server/storage";
import { createLocalSessionStore, validateLocalSession, isAuthenticated, setupAuth } from "../server/auth";
import { isLoginBlocked } from "../server/security";
import { verifyOtpForUser } from "../server/shareholder-security";

// Only temporary tables on the explicitly local database: never seed, alter or
// truncate application tables, and never connect to a production/Supabase DB.
describe("local auth revocation against PostgreSQL and the real session store", () => {
  let connection: pg.Pool;
  let client: pg.PoolClient;
  let sessionStore: ReturnType<typeof createLocalSessionStore>;
  let passwordHash: string;
  const cookie = () => ({ expires: new Date(Date.now() + 60 * 60 * 1000), httpOnly: true });
  const sessionData = (userId = "worker") => ({ cookie: cookie(), userId });
  const save = (sid: string, data: any) => new Promise<void>((resolve, reject) =>
    sessionStore.set(sid, data, error => error ? reject(error) : resolve()));
  const load = (sid: string) => new Promise<any>((resolve, reject) =>
    sessionStore.get(sid, (error, data) => error ? reject(error) : resolve(data)));
  const destroy = (sid: string) => new Promise<void>((resolve, reject) =>
    sessionStore.destroy(sid, error => error ? reject(error) : resolve()));
  async function check(sid: string, data?: any) {
    const req: any = {
      sessionID: sid, session: { ...(data ?? await load(sid)), destroy: vi.fn((cb) => cb()) },
      method: "GET", path: "/api/auth/me", originalUrl: "/api/auth/me", headers: {},
    };
    const res: any = {
      status: vi.fn(() => res), json: vi.fn(() => res),
      clearCookie: vi.fn(), set: vi.fn(),
    };
    const next = vi.fn();
    await validateLocalSession(req, res, next);
    return { req, res, next };
  }
  async function track(sid: string, userId = "worker", active = true) {
    await client.query(`INSERT INTO user_sessions(session_id,user_id,is_active)
      VALUES ($1,$2,$3)`, [sid, userId, active]);
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw Error("Session tests require local heliumdb; remote writes refused");
    connection = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    client = await connection.connect();
    state.client = client;
    await client.query("SET search_path TO pg_temp");
    await client.query(`CREATE TEMP TABLE sessions (sid text PRIMARY KEY, sess json NOT NULL, expire timestamp NOT NULL);
      CREATE TEMP TABLE user_sessions (id serial PRIMARY KEY, session_id text UNIQUE, user_id text, is_active boolean,
        device_info jsonb, ip_address text, user_agent text,
        last_activity_at timestamp DEFAULT NOW(), expires_at timestamp DEFAULT NOW() + INTERVAL '1 hour',
        created_at timestamp DEFAULT NOW());
      CREATE TEMP TABLE users (id text PRIMARY KEY, role text, is_active text, username text, password text,
        phone text, email text, first_name text, last_name text, profile_image_url text,
        branch_id text, job_title text, created_at timestamp, updated_at timestamp);`);
    state.db = drizzle(client);
    sessionStore = createLocalSessionStore();
    passwordHash = await bcrypt.hash("original-password", 4);
    vi.spyOn(storage, "getUser").mockImplementation(async (id) => {
      const result = await client.query(`SELECT id,role,is_active AS "isActive" FROM users WHERE id=$1`, [id]);
      return result.rows[0];
    });
    vi.spyOn(storage, "getUserBranchAccess").mockResolvedValue([]);
    vi.spyOn(storage, "getUserPermissions").mockResolvedValue([]);
  });
  beforeEach(async () => {
    await client.query("TRUNCATE sessions,user_sessions,users");
    await client.query(`INSERT INTO users(id,username,password,role,is_active)
      VALUES ('worker','worker',$1,'employee','active'),('other','other',$1,'employee','active')`, [passwordHash]);
  });
  afterAll(async () => {
    sessionStore?.close();
    vi.restoreAllMocks();
    client?.release();
    await connection?.end();
  });

  it.each(["employee", "admin", "business_owner"])(
    "does not resurrect a %s's legacy/untracked or tracked session after disable/re-enable",
    async role => {
      await client.query("UPDATE users SET role=$1 WHERE id='worker'", [role]);
      await save("legacy", sessionData());
      await save("tracked", sessionData());
      await track("tracked");
      expect((await check("legacy")).next).toHaveBeenCalledOnce();
      const alreadyLoaded = await load("legacy");
      await client.query("UPDATE users SET is_active='inactive' WHERE id='worker'");
      await storage.invalidateAllUserSessions("worker");
      await client.query("UPDATE users SET is_active='active' WHERE id='worker'");
      // Simulate a request that loaded its session before the revocation.
      expect((await check("legacy", alreadyLoaded)).res.status).toHaveBeenCalledWith(401);
      await expect(save("legacy", alreadyLoaded)).rejects.toMatchObject({ code: "LOCAL_SESSION_REVOKED" });
      expect(await load("legacy")).toMatchObject({ localAuthRevoked: true });
      expect((await load("legacy")).userId).toBeUndefined();
      expect(await storage.isLocalSessionValid("worker", "tracked")).toBe(false);
      expect((await client.query("SELECT is_active FROM user_sessions")).rows[0].is_active).toBe(false);
      // A new login regenerates its SID and is accepted without any epoch reset.
      await save("fresh-login", {
        ...sessionData(),
        localAuthGeneration: (await load("__local_auth_generation__:worker")).localAuthGeneration,
      });
      await track("fresh-login");
      expect((await check("fresh-login")).next).toHaveBeenCalledOnce();
    },
  );

  it("password-reset revocation covers pending OTP sessions and leaves unrelated users alone", async () => {
    await save("old", sessionData());
    await save("otp", { cookie: cookie(), pendingTwoFactor: { userId: "worker", at: Date.now() } });
    await save("other", sessionData("other"));
    await storage.invalidateAllUserSessions("worker");
    expect(await storage.isLocalSessionValid("worker", "old")).toBe(false);
    expect((await load("otp")).pendingTwoFactor).toBeUndefined();
    expect((await check("other")).next).toHaveBeenCalledOnce();
  });

  it.each(["employee", "business_owner"])("a real %s login handler establishes a fresh valid session after revocation", async role => {
    await client.query("UPDATE users SET role=$1 WHERE id='worker'", [role]);
    await save("old-login", sessionData());
    const stale = await load("old-login");
    await storage.invalidateAllUserSessions("worker");
    const routes = new Map<string, any>();
    const app: any = {
      set: vi.fn(), use: vi.fn(), patch: vi.fn(),
      get: (path: string, ...handlers: any[]) => routes.set(`GET ${path}`, handlers.at(-1)),
      post: (path: string, ...handlers: any[]) => routes.set(`POST ${path}`, handlers.at(-1)),
    };
    vi.stubEnv("SESSION_SECRET", "integration-test-only-session-secret");
    await setupAuth(app);
    vi.unstubAllEnvs();
    vi.mocked(isLoginBlocked).mockReturnValue({ blocked: false });
    const audit = vi.spyOn(storage, "createSystemAuditLog").mockResolvedValue({} as any);
    let complete!: () => void;
    const finished = new Promise<void>(resolve => { complete = resolve; });
    const req: any = {
      body: { username: "worker", password: "original-password" },
      headers: {}, ip: "127.0.0.1", socket: {}, sessionID: "old-login",
      session: {
        ...stale,
        regenerate: (callback: any) => {
          req.sessionID = "new-login";
          req.session = {
            cookie: cookie(),
            save: (saved: any) => save(req.sessionID, req.session).then(() => saved(), saved),
          };
          callback();
        },
      },
    };
    const res: any = {
      set: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => { complete(); return res; }),
    };
    try {
      await routes.get("POST /api/auth/login")(req, res);
      await finished;
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: "worker", role }));
      expect(await storage.isLocalSessionValid("worker", "old-login")).toBe(false);
      const authenticated = await check("new-login");
      expect(authenticated.next).toHaveBeenCalledOnce();
      const next = vi.fn();
      await isAuthenticated(authenticated.req, authenticated.res, next);
      expect(next).toHaveBeenCalledOnce();
    } finally {
      audit.mockRestore();
    }
  });

  it("single-session revocation also revokes the authoritative store", async () => {
    await save("old", sessionData());
    await save("kept", sessionData());
    await storage.invalidateSession("old");
    expect(await storage.isLocalSessionValid("worker", "old")).toBe(false);
    expect(await storage.isLocalSessionValid("worker", "kept")).toBe(true);
  });

  it.each(["password", "otp"])(
    "rejects a paused %s authentication completing after reset, but accepts a fresh login",
    async mode => {
      const routes = new Map<string, any>();
      const app: any = {
        set: vi.fn(), use: vi.fn(), patch: vi.fn(),
        get: (path: string, ...handlers: any[]) => routes.set(`GET ${path}`, handlers.at(-1)),
        post: (path: string, ...handlers: any[]) => routes.set(`POST ${path}`, handlers.at(-1)),
      };
      vi.stubEnv("SESSION_SECRET", "integration-test-only-session-secret");
      try { await setupAuth(app); } finally { vi.unstubAllEnvs(); }
      vi.mocked(isLoginBlocked).mockReturnValue({ blocked: false });
      const audit = vi.spyOn(storage, "createSystemAuditLog").mockResolvedValue({} as any);
      const originalVerify = storage.verifyLocalLoginPassword.bind(storage);
      let paused!: () => void, resume!: () => void;
      const reachedBoundary = new Promise<void>(resolve => { paused = resolve; });
      const continueAuthentication = new Promise<void>(resolve => { resume = resolve; });
      const verify = mode === "password"
        ? vi.spyOn(storage, "verifyLocalLoginPassword").mockImplementation(async (username, password) => {
          const credentials = await originalVerify(username, password);
          paused();
          await continueAuthentication;
          return credentials;
        }) : null;
      if (mode === "otp") {
        vi.mocked(verifyOtpForUser).mockImplementationOnce(async () => {
          paused();
          await continueAuthentication;
          return { ok: true } as any;
        });
      }
      function request(sid: string, password: string) {
        let complete!: () => void;
        const finished = new Promise<void>(resolve => { complete = resolve; });
        const req: any = {
          body: { username: "worker", password, code: "123456" },
          headers: {}, ip: "127.0.0.1", socket: {}, sessionID: "pending",
          session: {
            localAuthGeneration: "legacy",
            pendingTwoFactor: { userId: "worker", rememberMe: false, at: Date.now() },
            regenerate: (callback: any) => {
              req.sessionID = sid;
              req.session = {
                cookie: cookie(),
                save: (saved: any) => save(sid, req.session).then(() => saved(), saved),
                destroy: (destroyed: any) => destroy(sid).then(() => destroyed(), destroyed),
              };
              callback();
            },
          },
        };
        const res: any = {
          set: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => { complete(); return res; }),
        };
        return { req, res, finished };
      }
      try {
        // The old password was valid when verification started. Revoke before
        // either the password or OTP path has created its authenticated SID.
        const old = request("racing-login", "original-password");
        const pending = routes.get(mode === "password" ? "POST /api/auth/login" : "POST /api/auth/verify-otp")(old.req, old.res);
        await reachedBoundary;
        const newHash = await bcrypt.hash("replacement-password", 4);
        await state.db.transaction(async (tx: any) => {
          await tx.execute(sql`UPDATE users SET password = ${newHash} WHERE id = 'worker'`);
          await storage.invalidateAllUserSessions("worker", tx);
        });
        resume();
        await pending;
        await old.finished;
        expect(old.res.status).toHaveBeenCalledWith(401);
        expect(await load("racing-login")).toBeUndefined();
        expect(await storage.isLocalSessionValid("worker", "racing-login")).toBe(false);
        expect(await originalVerify("worker", "original-password")).toBeNull();

        const fresh = request("fresh-after-race", "replacement-password");
        await routes.get("POST /api/auth/login")(fresh.req, fresh.res);
        await fresh.finished;
        expect(fresh.res.status).not.toHaveBeenCalled();
        expect((await check("fresh-after-race")).next).toHaveBeenCalledOnce();
      } finally {
        resume();
        verify?.mockRestore();
        audit.mockRestore();
      }
    },
  );

  it("validation rejects a late stale-generation SID even if a concurrent writer persisted it", async () => {
    const credentials = await storage.verifyLocalLoginPassword("worker", "original-password");
    expect(credentials?.generation).toBe("legacy");
    await storage.invalidateAllUserSessions("worker");
    // Models a statement that took its PostgreSQL snapshot before the reset
    // committed but inserted its previously-unseen SID after the revoker scan.
    await client.query("INSERT INTO sessions VALUES ($1,$2,NOW()+INTERVAL '1 hour')",
      ["late", JSON.stringify({ ...sessionData(), localAuthGeneration: credentials!.generation })]);
    expect((await check("late")).res.status).toHaveBeenCalledWith(401);
    // The generation sentinel cannot be expired by ordinary pruning or logout.
    await destroy("__local_auth_generation__:worker");
    await client.query("DELETE FROM sessions WHERE expire < NOW()");
    expect((await load("__local_auth_generation__:worker")).localAuthGeneration).not.toBe("legacy");
  });

  it("login's except-current helper preserves the newly regenerated SID", async () => {
    await save("old", sessionData());
    await save("current", sessionData());
    await track("old");
    await track("current");
    await storage.invalidateAllUserSessionsExcept("worker", "current");
    expect(await storage.isLocalSessionValid("worker", "old")).toBe(false);
    expect((await check("current")).next).toHaveBeenCalledOnce();
  });

  it("joins an account transaction and rolls back both store and tracking revocation", async () => {
    await save("old", sessionData());
    await track("old");
    await expect(state.db.transaction(async (tx: any) => {
      await storage.invalidateAllUserSessions("worker", tx);
      expect(await storage.isLocalSessionValid("worker", "old")).toBe(false);
      throw Error("account mutation failed");
    })).rejects.toThrow("account mutation failed");
    expect(await storage.isLocalSessionValid("worker", "old")).toBe(true);
    await state.db.transaction((tx: any) => storage.invalidateAllUserSessions("worker", tx));
    expect(await storage.isLocalSessionValid("worker", "old")).toBe(false);
  });

  it("neither destroy nor a stale touch/save removes or shortens the revocation guard", async () => {
    await save("old", sessionData());
    const stale = await load("old");
    await storage.invalidateAllUserSessions("worker");
    const before = (await client.query("SELECT expire FROM sessions WHERE sid='old'")).rows[0].expire;
    await destroy("old");
    await new Promise<void>(resolve => sessionStore.touch("old", stale, resolve));
    await expect(save("old", stale)).rejects.toMatchObject({ code: "LOCAL_SESSION_REVOKED" });
    const after = (await client.query("SELECT expire FROM sessions WHERE sid='old'")).rows[0].expire;
    expect(after).toEqual(before);
    expect(await storage.isLocalSessionValid("worker", "old")).toBe(false);
  });

  it("checks fresh active state on every request even for handlers without isAuthenticated", async () => {
    await save("old", sessionData());
    expect((await check("old")).next).toHaveBeenCalledOnce();
    await client.query("UPDATE users SET is_active='inactive' WHERE id='worker'");
    const denied = await check("old");
    expect(denied.next).not.toHaveBeenCalled();
    expect(denied.res.status).toHaveBeenCalledWith(403);
    const next = vi.fn();
    await isAuthenticated(denied.req, denied.res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("honors inactive historical tracking rows while allowing missing legacy tracking", async () => {
    await save("tracked", sessionData());
    await save("legacy", sessionData());
    await track("tracked", "worker", false);
    expect((await check("tracked")).res.status).toHaveBeenCalledWith(401);
    expect((await check("legacy")).next).toHaveBeenCalledOnce();
  });

  it("fails closed on validation errors and does not affect unauthenticated/Clerk-only requests", async () => {
    const valid = vi.spyOn(storage, "isLocalSessionValid").mockRejectedValueOnce(Error("DB unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await check("unread", sessionData())).res.status).toHaveBeenCalledWith(503);
    valid.mockRestore();
    log.mockRestore();
    const request = await check("anonymous", { cookie: cookie(), clerkSessionId: "external" });
    expect(request.next).toHaveBeenCalledOnce();
  });
});