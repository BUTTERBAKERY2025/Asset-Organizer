import pg from "pg";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ db: null as any, pool: null as any }));
vi.mock("../server/db", () => ({
  db: new Proxy({}, { get: (_object, key) => {
    const value = runtime.db?.[key];
    return typeof value === "function" ? value.bind(runtime.db) : value;
  } }),
  pool: new Proxy({}, { get: (_object, key) => {
    const value = runtime.pool?.[key];
    return typeof value === "function" ? value.bind(runtime.pool) : value;
  } }),
}));
vi.mock("../server/auth", () => ({
  isAuthenticated: async (req: any, res: any, next: any) => {
    if (!req.session.userId) return res.status(401).json({ error: "unauthenticated" });
    const result = await runtime.pool.query("SELECT id, role, is_active AS \"isActive\" FROM users WHERE id=$1", [req.session.userId]);
    req.currentUser = result.rows[0];
    return next();
  },
  invalidateAuthCache: vi.fn(),
}));

import { registerEmployeeAccountDelegation } from "../server/employee-account-delegation";
import { storage } from "../server/storage";

const routes: any[] = [];
const middleware: any[] = [];
const app: any = { use: (fn: any) => middleware.push(fn) };
for (const method of ["get", "put", "post", "patch"])
  app[method] = (path: string, ...handlers: any[]) => routes.push({ method, path, handlers });
registerEmployeeAccountDelegation(app);
const base = "/api/operations/employee-accounts";
const permissions = [{ module: "cashier_journal", actions: ["view", "create"] }];
const policyKey = "employee_account_delegation.policy.v1";

async function invoke(method: string, suffix = "", body: unknown = {}, actor = "ops", options: any = {}) {
  const path = suffix === "policy" ? "/api/admin/employee-account-policy" : `${base}${suffix}`;
  const handlers = routes.find(r => r.method === method && r.path === path)?.handlers;
  if (!handlers) throw Error(`Unknown route ${method} ${path}`);
  const req: any = { session: { userId: actor }, body, params: { employeeId: "1" },
    method: method.toUpperCase(), path, ...options };
  const response: any = { statusCode: 200, headers: {}, status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; } };
  let index = 0;
  const next: any = async (error?: any) => { if (error) throw error; if (handlers[index]) await handlers[index++](req, response, next); };
  await next();
  return response;
}

describe("employee account delegation atomic PostgreSQL API", () => {
  let root: pg.Pool;
  let pool: pg.Pool;
  const schema = `delegation_test_${randomUUID().replace(/-/g, "")}`;
  const query = (text: string, values?: unknown[]) => pool.query(text, values);
  async function configure(enabled = true) {
    return invoke("put", "policy", { enabled, permissions }, "admin");
  }
  async function create() {
    const result = await invoke("post", "/:employeeId", { permissions });
    expect(result.statusCode).toBe(201);
    return result;
  }
  async function id() {
    return (await query("SELECT linked_user_id FROM branch_employees WHERE id=1")).rows[0].linked_user_id;
  }
  beforeAll(async () => {
    // Explicit local-only namespace, independent sequences, never public-table
    // writes. A multi-connection pool lets these tests exercise actual PG locks.
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/");
    if (url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw Error("Delegation integration tests require local heliumdb; remote writes refused");
    root = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    await root.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6, options: `-c search_path=${schema}` });
    runtime.pool = pool;
    runtime.db = drizzle(pool);
    await query(`
      CREATE TABLE branches (id varchar PRIMARY KEY, name text NOT NULL);
      CREATE TABLE users (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), username varchar UNIQUE, password varchar,
        phone varchar, email varchar, first_name varchar, last_name varchar, profile_image_url varchar,
        role varchar NOT NULL DEFAULT 'viewer', branch_id varchar REFERENCES branches(id), job_title varchar,
        is_active text DEFAULT 'active', created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      );
      CREATE TABLE branch_employees (
        id serial PRIMARY KEY, branch_id varchar NOT NULL REFERENCES branches(id), employee_name text NOT NULL,
        linked_user_id varchar UNIQUE REFERENCES users(id), status text NOT NULL DEFAULT 'active',
        job_title text NOT NULL DEFAULT 'cashier', updated_at timestamp DEFAULT now(),
        salary real, iqama_number text, bank_account_number text
      );
      CREATE TABLE user_branch_access (
        id serial PRIMARY KEY, user_id varchar REFERENCES users(id), branch_id varchar REFERENCES branches(id),
        access_level varchar DEFAULT 'full', is_default boolean DEFAULT false, created_at timestamp DEFAULT now()
      );
      CREATE TABLE user_permissions (
        id serial PRIMARY KEY, user_id varchar REFERENCES users(id), module text, actions text[],
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      );
      CREATE TABLE user_assignments (id serial PRIMARY KEY, user_id varchar REFERENCES users(id));
      CREATE TABLE user_permission_overrides (id serial PRIMARY KEY, user_id varchar REFERENCES users(id));
      CREATE TABLE portal_settings (id serial PRIMARY KEY, key text UNIQUE, value text, updated_at timestamp DEFAULT now());
      CREATE TABLE system_audit_logs (
        id serial PRIMARY KEY, module text, entity_id text, entity_name text, action text, details text,
        user_id varchar, user_name text, branch_id varchar, target_id text, description text,
        ip_address text, user_agent text, created_at timestamp DEFAULT now()
      );
      CREATE TABLE sessions (sid text PRIMARY KEY, sess json NOT NULL, expire timestamp NOT NULL);
      CREATE TABLE user_sessions (session_id text PRIMARY KEY, user_id text, is_active boolean);
    `);
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await query(`TRUNCATE users,branches,branch_employees,user_branch_access,user_permissions,user_assignments,
      user_permission_overrides,portal_settings,system_audit_logs,sessions,user_sessions RESTART IDENTITY CASCADE;
      INSERT INTO branches VALUES ('a','الفرع أ'),('b','الفرع ب'),('main_warehouse','المركز الرئيسي');
      INSERT INTO users(id,role,branch_id) VALUES ('ops','operations_manager','b'),('admin','admin',NULL);
      INSERT INTO user_branch_access(user_id,branch_id) VALUES ('ops','a');
      INSERT INTO branch_employees(branch_id,employee_name,salary,iqama_number,bank_account_number)
        VALUES ('a','موظف مسجل',9000,'secret-id','secret-bank'),('b','خارج النطاق',1,'x','y'),
        ('main_warehouse','المركز الرئيسي',1,'x','y');
    `);
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await pool?.end();
    if (root) {
      await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await root.end();
    }
  });

  it("defaults disabled/empty, only admin can enable it, and scopes minimal GET data", async () => {
    let result = await invoke("get");
    expect(result.body).toMatchObject({ policy: { enabled: false, permissions: [] }, availablePermissions: [] });
    expect(result.body.employees.map((e: any) => e.employeeId)).toEqual([1]);
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("DELEGATION_DISABLED");
    expect((await invoke("put", "policy", { enabled: true, permissions })).statusCode).toBe(403);
    expect((await configure()).statusCode).toBe(200);
    result = await invoke("get");
    expect(result.body.employees).toEqual([{ employeeId: 1, employeeName: "موظف مسجل", branchId: "a", branchName: "الفرع أ", account: null }]);
    expect(JSON.stringify(result.body)).not.toMatch(/salary|iqama|bank|secret-|9000/);
    expect(result.headers["Cache-Control"]).toContain("no-store");
  });
  it("atomically creates one linked branch account, hashes the one-time secret, and audits no secrets", async () => {
    await configure();
    const created = await create();
    expect(created.headers["Cache-Control"]).toContain("no-store");
    const account = (await query("SELECT * FROM users WHERE id=$1", [await id()])).rows[0];
    expect(account.role).toBe("employee");
    expect(account.first_name).toBe("موظف مسجل");
    expect(account.branch_id).toBe("a");
    expect(account.password).not.toBe(created.body.credentials.password);
    expect(await bcrypt.compare(created.body.credentials.password, account.password)).toBe(true);
    expect((await query("SELECT branch_id FROM user_branch_access WHERE user_id=$1", [account.id])).rows).toEqual([{ branch_id: "a" }]);
    const logs = JSON.stringify((await query("SELECT * FROM system_audit_logs")).rows);
    expect(logs).not.toContain(created.body.credentials.password);
    expect(logs).not.toContain(account.password);
    const listed = JSON.stringify((await invoke("get")).body);
    expect(listed).not.toContain("password");
    expect(listed).not.toContain("credentials");
    expect((await invoke("post", "/:employeeId", { permissions })).statusCode).toBe(409);
  });
  it.each(["role", "branchId", "username", "password", "linkedUserId", "firstName"])("rejects forged %s with zero writes", async key => {
    await configure();
    expect((await invoke("post", "/:employeeId", { permissions, [key]: "admin" })).statusCode).toBe(400);
    expect(await id()).toBeNull();
    expect((await query("SELECT count(*)::int AS n FROM users")).rows[0].n).toBe(2);
  });
  it("rejects missing/inactive employees, HQ, default branches, and forged privileged permissions", async () => {
    await configure();
    for (const employeeId of ["2", "3"]) expect((await invoke("post", "/:employeeId", { permissions }, "ops",
      { params: { employeeId } })).statusCode).toBe(403);
    expect((await invoke("post", "/:employeeId", { permissions }, "admin", { params: { employeeId: "3" } })).statusCode).toBe(403);
    expect((await invoke("post", "/:employeeId", { permissions }, "ops", { params: { employeeId: "999" } })).statusCode).toBe(404);
    expect((await invoke("post", "/:employeeId", { permissions: [{ module: "users", actions: ["create"] }] })).statusCode).toBe(403);
    await query("UPDATE branch_employees SET status='inactive' WHERE id=1");
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("EMPLOYEE_INACTIVE");
    await query("UPDATE branch_employees SET status='active' WHERE id=1; DELETE FROM user_branch_access WHERE user_id='ops'");
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("BRANCH_FORBIDDEN");
  });
  it("does not use read-only branch access as delegation authority", async () => {
    await configure();
    await query("UPDATE user_branch_access SET access_level='view_only' WHERE user_id='ops'");
    expect((await invoke("get")).body.employees).toEqual([]);
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("BRANCH_FORBIDDEN");
  });
  it.each(["admin", "branch_manager", "operations_manager", "business_owner", "hr_manager", "financial_manager"])(
    "does not expose or mutate linked protected %s accounts", async role => {
      await configure();
      const created = await create();
      await query("UPDATE users SET role=$1 WHERE id=$2", [role, created.body.employee.account.id]);
      expect((await invoke("get")).body.employees).toEqual([]);
      expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).body.code).toBe("PROTECTED_ACCOUNT");
      expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).statusCode).toBe(403);
    });
  it.each(["user_assignments", "user_permission_overrides"])("rejects all inherited/override rights via %s", async table => {
    await configure(); await create();
    await query(`INSERT INTO ${table}(user_id) VALUES ($1)`, [await id()]);
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).body.code).toBe("ELEVATED_ACCOUNT");
    expect((await invoke("get")).body.employees).toEqual([]);
  });
  it("protects self, multi-branch/global accounts and elevated direct permissions", async () => {
    await configure();
    await query("UPDATE branch_employees SET linked_user_id='ops' WHERE id=1");
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.code).toBe("PROTECTED_ACCOUNT");
    await query("UPDATE branch_employees SET linked_user_id=NULL WHERE id=1");
    await create();
    const target = await id();
    await query("INSERT INTO user_branch_access(user_id,branch_id) VALUES ($1,'b')", [target]);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.code).toBe("EXTRA_BRANCH_AUTHORITY");
    await query("DELETE FROM user_branch_access WHERE user_id=$1 AND branch_id='b';", [target]);
    await query("UPDATE users SET branch_id=NULL WHERE id=$1", [target]);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).statusCode).toBe(403);
    await query("UPDATE users SET branch_id='a' WHERE id=$1", [target]);
    await query("INSERT INTO user_permissions(user_id,module,actions) VALUES ($1,'users',ARRAY['view'])", [target]);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.code).toBe("ELEVATED_ACCOUNT");
  });
  it("allows permission updates on eligible existing viewer accounts and revokes real stored sessions", async () => {
    await configure(); await create();
    const target = await id();
    await query("UPDATE users SET role='viewer' WHERE id=$1", [target]);
    await query("INSERT INTO sessions VALUES ('old',$1,now()+interval '1 hour')", [JSON.stringify({ userId: target, cookie: {} })]);
    await query("INSERT INTO user_sessions VALUES ('old',$1,true)", [target]);
    const response = await invoke("put", "/:employeeId/permissions", { permissions: [] });
    expect(response.statusCode).toBe(200);
    expect(response.body.employee.account.permissions).toEqual([]);
    expect(response.body).not.toHaveProperty("credentials");
    expect((await query("SELECT sess FROM sessions")).rows[0].sess).toEqual({ cookie: {}, localAuthRevoked: true });
    expect((await query("SELECT is_active FROM user_sessions")).rows[0].is_active).toBe(false);
  });
  it("requires managed suspension ownership, revokes sessions before reactivation, and respects admin refreezes", async () => {
    await configure(); await create();
    const target = await id();
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.employee.account.canReactivate).toBe(true);
    await query("INSERT INTO sessions VALUES ('legacy',$1,now()+interval '1 hour')", [JSON.stringify({ userId: target, cookie: {} })]);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).statusCode).toBe(200);
    expect((await query("SELECT sess FROM sessions")).rows[0].sess.userId).toBeUndefined();
    await invoke("patch", "/:employeeId/status", { isActive: "inactive" });
    await query("UPDATE users SET is_active='inactive',updated_at=updated_at+interval '1 second' WHERE id=$1", [target]);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).body.code).toBe("ADMIN_FROZEN_ACCOUNT");
    // Idempotent ops deactivation cannot adopt an admin freeze.
    await invoke("patch", "/:employeeId/status", { isActive: "inactive" });
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).statusCode).toBe(403);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" }, "admin")).statusCode).toBe(200);
    await invoke("patch", "/:employeeId/status", { isActive: "inactive" });
    await invoke("patch", "/:employeeId/status", { isActive: "inactive" }, "admin");
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).statusCode).toBe(403);
  });
  it("rolls the complete creation back if audit insertion fails", async () => {
    await configure();
    await query("ALTER TABLE system_audit_logs ADD CONSTRAINT no_creation CHECK(action <> 'account_create')");
    try {
      expect((await invoke("post", "/:employeeId", { permissions })).statusCode).toBe(500);
      expect(await id()).toBeNull();
      expect((await query("SELECT count(*)::int AS n FROM users")).rows[0].n).toBe(2);
      expect((await query("SELECT count(*)::int AS n FROM user_permissions")).rows[0].n).toBe(0);
      expect((await query("SELECT count(*)::int AS n FROM user_branch_access")).rows[0].n).toBe(1);
    } finally { await query("ALTER TABLE system_audit_logs DROP CONSTRAINT no_creation"); }
  });
  it("does not reactivate or update permissions if session invalidation fails", async () => {
    await configure(); await create();
    await invoke("patch", "/:employeeId/status", { isActive: "inactive" });
    vi.spyOn(storage, "invalidateAllUserSessions").mockRejectedValue(new Error("session store unavailable"));
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).statusCode).toBe(500);
    expect((await query("SELECT is_active FROM users WHERE id=$1", [await id()])).rows[0].is_active).toBe("inactive");
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).statusCode).toBe(500);
    expect((await query("SELECT count(*)::int AS n FROM user_permissions")).rows[0].n).toBe(1);
  });
  it("policy disable is prospective: directory and safety suspension/reduction remain, new grants do not", async () => {
    await configure(); await create();
    expect((await configure(false)).statusCode).toBe(200);
    const listed = await invoke("get");
    expect(listed.body.employees).toHaveLength(1);
    expect(listed.body.availablePermissions).toEqual([{ module: "cashier_journal", actions: ["create", "view"] }]);
    expect(listed.body.templates).toEqual([]);
    expect(listed.body.employees[0].account.permissions[0].actions).toEqual(["create", "view"]);
    expect((await query("SELECT is_active FROM users WHERE id=$1", [await id()])).rows[0].is_active).toBe("active");
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("DELEGATION_DISABLED");
    const frozen = await invoke("patch", "/:employeeId/status", { isActive: "inactive" });
    expect(frozen.statusCode).toBe(200);
    expect(frozen.body.employee.account.canReactivate).toBe(false);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).body.code).toBe("DELEGATION_DISABLED");
    const reduced = await invoke("put", "/:employeeId/permissions", { permissions: [{ module: "cashier_journal", actions: ["view"] }] });
    expect(reduced.statusCode).toBe(200);
    expect((await invoke("put", "/:employeeId/permissions", { permissions })).body.code).toBe("REDUCTION_ONLY");
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).statusCode).toBe(200);
  });
  it("narrowing preserves existing access for explicit reduction/freezing but never permits elevation of an over-ceiling account", async () => {
    await configure(); await create();
    const reduced = [{ module: "cashier_journal", actions: ["view"] }];
    const extra = { module: "quality_control", actions: ["view"] };
    expect((await invoke("put", "policy", { enabled: true, permissions: [...reduced, extra] }, "admin")).statusCode).toBe(200);
    const listed = (await invoke("get")).body.employees;
    expect(listed).toHaveLength(1);
    expect(listed[0].account.permissions[0].actions).toEqual(["create", "view"]);
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [...reduced, extra] })).body.code).toBe("REDUCTION_ONLY");
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).statusCode).toBe(200);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).body.code).toBe("PERMISSION_NOT_APPROVED");
    expect((await invoke("put", "/:employeeId/permissions", { permissions: reduced })).statusCode).toBe(200);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "active" })).statusCode).toBe(200);
  });
  it("disabled safety operations still reject protected roles, inherited rights and unsafe permissions", async () => {
    await configure(); await create(); await configure(false);
    const target = await id();
    await query("UPDATE users SET role='admin' WHERE id=$1", [target]);
    expect((await invoke("get")).body.employees).toEqual([]);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.code).toBe("PROTECTED_ACCOUNT");
    await query("UPDATE users SET role='employee' WHERE id=$1", [target]);
    await query("INSERT INTO user_assignments(user_id) VALUES ($1)", [target]);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.code).toBe("ELEVATED_ACCOUNT");
    await query("DELETE FROM user_assignments WHERE user_id=$1", [target]);
    await query("INSERT INTO user_permissions(user_id,module,actions) VALUES ($1,'users',ARRAY['view'])", [target]);
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).body.code).toBe("ELEVATED_ACCOUNT");
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.code).toBe("ELEVATED_ACCOUNT");
  });
  it("serializes duplicate concurrent generation, committing only one account and one audit", async () => {
    await configure();
    const responses = await Promise.all([
      invoke("post", "/:employeeId", { permissions }),
      invoke("post", "/:employeeId", { permissions }),
    ]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([201, 409]);
    expect(responses.filter(r => r.body.credentials)).toHaveLength(1);
    expect((await query("SELECT count(*)::int AS n FROM users")).rows[0].n).toBe(3);
    expect((await query("SELECT count(*)::int AS n FROM system_audit_logs WHERE action='account_create'")).rows[0].n).toBe(1);
  });
  it.each(["employee_move", "grant_revocation", "policy_revocation", "target_elevation", "actor_demotion"])(
    "rechecks %s after a concurrent legacy transaction commits", async race => {
      await configure(); await create();
      const target = await id();
      const concurrent = await pool.connect();
      try {
        await concurrent.query("BEGIN");
        if (race === "employee_move") await concurrent.query("UPDATE branch_employees SET branch_id='b' WHERE id=1");
        if (race === "grant_revocation") await concurrent.query("DELETE FROM user_branch_access WHERE user_id='ops'");
        if (race === "policy_revocation") await concurrent.query("UPDATE portal_settings SET value=$1 WHERE key=$2",
          [JSON.stringify({ enabled: false, permissions: [] }), policyKey]);
        if (race === "target_elevation") await concurrent.query("INSERT INTO user_assignments(user_id) VALUES ($1)", [target]);
        if (race === "actor_demotion") await concurrent.query("UPDATE users SET role='employee' WHERE id='ops'");
        const pending = invoke("put", "/:employeeId/permissions", { permissions: [] });
        await new Promise(resolve => setTimeout(resolve, 60));
        await concurrent.query("COMMIT");
        // A revoked policy now permits safe reductions but never new grants.
        expect((await pending).statusCode).toBe(race === "policy_revocation" ? 200 : 403);
        const remaining = (await query("SELECT actions FROM user_permissions WHERE user_id=$1", [target])).rows;
        if (race === "policy_revocation") expect(remaining).toEqual([]);
        else expect(remaining[0].actions).toEqual(["create", "view"]);
      } finally { await concurrent.query("ROLLBACK"); concurrent.release(); }
    });
  it("legacy guards ignore manually granted users/RBAC permissions and protect reads too", async () => {
    await query("INSERT INTO user_permissions(user_id,module,actions) VALUES ('ops','users',ARRAY['view','create','edit'])");
    for (const path of ["/api/users", "/api/rbac/users/admin/branches", "/api/operations-employees",
      "/api/operations-employees/admin/reapply-permissions", "/api/branch-employees/1/create-account",
      "/api/branch-employees/1/reset-password", "/api/admin/portal-accounts/bulk-generate",
      "/api/backups", "/api/backups/tables", "/api/backups/1/download", "/api/backups/1/restore"]) {
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
        const next = vi.fn();
        const req: any = { session: { userId: "ops" }, path, method, body: {} };
        const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
        await middleware[0](req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      }
    }
  });
});