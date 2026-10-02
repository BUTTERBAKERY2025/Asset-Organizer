import pg from "pg";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import guard from "../scripts/isolated-test/target.cjs";

const runtime = vi.hoisted(() => ({ db: null as any, pool: null as any, queries: [] as string[] }));
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
import * as delegationPolicy from "../server/employee-account-delegation-policy";
import { storage } from "../server/storage";

const routes: any[] = [];
const middleware: any[] = [];
const app: any = { use: (fn: any) => middleware.push(fn) };
for (const method of ["get", "put", "post", "patch", "delete"])
  app[method] = (path: string, ...handlers: any[]) => routes.push({ method, path, handlers });
registerEmployeeAccountDelegation(app);
const base = "/api/operations/employee-accounts";
const permissions = [{ module: "cashier_journal", actions: ["view", "create"] }];
const policyKey = "employee_account_delegation.policy.v1";
const managerKey = (id = "ops") => `employee_account_delegation.manager.${id}.v1`;

async function invoke(method: string, suffix = "", body: unknown = {}, actor = "ops", options: any = {}) {
  const path = suffix === "policy" ? "/api/admin/employee-account-policy"
    : suffix === "managers" ? "/api/admin/employee-account-managers"
    : suffix === "selection" ? "/api/admin/employee-account-managers/:managerId" : `${base}${suffix}`;
  const handlers = routes.find(r => r.method === method && r.path === path)?.handlers;
  if (!handlers) throw Error(`Unknown route ${method} ${path}`);
  const req: any = { session: { userId: actor }, body, params: { employeeId: "1", managerId: "ops" },
    method: method.toUpperCase(), path, ...options };
  const response: any = { statusCode: 200, headers: {}, status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; } };
  let index = 0;
  const next: any = async (error?: any) => { if (error) throw error; if (handlers[index]) await handlers[index++](req, response, next); };
  await next();
  return response;
}

describe.skipIf(!process.env.ISOLATED_TEST_REGISTRY)("employee account delegation atomic PostgreSQL API", () => {
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
  async function select(employeeIds: number[], managerId = "ops", revision?: string) {
    const current = await invoke("get", "selection", {}, "admin", { params: { managerId } });
    expect(current.statusCode).toBe(200);
    return invoke("put", "selection", { employeeIds, revision: revision ?? current.body.revision },
      "admin", { params: { managerId } });
  }
  beforeAll(async () => {
    // A local hostname alone is NOT proof of a disposable database. The
    // registered runtime owner must attest its exact target before any writes.
    const target = guard.assertRuntime();
    root = new pg.Pool({ connectionString: target.url, max: 1 });
    const proof = await root.connect();
    try { await guard.proveDatabase(proof, target); } finally { proof.release(); }
    await root.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ connectionString: target.url, max: 6, options: `-c search_path=${schema}` });
    runtime.pool = pool;
    runtime.db = drizzle(pool, { logger: { logQuery: (text: string) => runtime.queries.push(text) } });
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
    // Existing write scenarios explicitly start with an administrator-selected
    // employee. Missing-selection behavior is tested separately below.
    await query("INSERT INTO portal_settings(key,value) VALUES ($1,$2)", [
      managerKey(), JSON.stringify({ revision: "fixture", selections: [{ employeeId: 1, branchId: "a", linkedUserId: null }] }),
    ]);
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
    expect(result.body.employees).toEqual([{ employeeId: 1, employeeName: "موظف مسجل", branchId: "a", branchName: "الفرع أ",
      hasAccount: false, management: { allowed: true, reason: "allowed" }, account: null }]);
    expect(result.body.branches).toEqual([{ id: "a", name: "الفرع أ" }]);
    expect(JSON.stringify(result.body)).not.toMatch(/salary|iqama|bank|secret-|9000/);
    expect(result.headers["Cache-Control"]).toContain("no-store");
  });
  it("uses a constant bounded number of minimal snapshot reads for large linked/unlinked directories", async () => {
    await configure();
    runtime.queries = [];
    expect((await invoke("get")).statusCode).toBe(200);
    const smallCount = runtime.queries.length;
    await query(`
      INSERT INTO users(id,username,password,role,branch_id)
        SELECT 'scale-'||n, 'u-'||n, 'sensitive-hash', CASE WHEN n > 400 THEN 'admin' ELSE 'employee' END, 'a'
        FROM generate_series(1,420) n;
      INSERT INTO branch_employees(branch_id,employee_name,linked_user_id)
        SELECT 'a', 'linked-'||n, 'scale-'||n FROM generate_series(1,420) n;
      INSERT INTO branch_employees(branch_id,employee_name)
        SELECT 'a', 'unlinked-'||n FROM generate_series(1,400) n;
      INSERT INTO user_branch_access(user_id,branch_id)
        SELECT 'scale-'||n,'a' FROM generate_series(1,420) n;
      INSERT INTO user_permissions(user_id,module,actions)
        SELECT 'scale-'||n,'cashier_journal',ARRAY['view'] FROM generate_series(1,420) n;
      INSERT INTO user_assignments(user_id) VALUES ('scale-1');
      INSERT INTO user_permission_overrides(user_id) VALUES ('scale-2');
      INSERT INTO user_branch_access(user_id,branch_id) VALUES ('scale-3','b');
      UPDATE users SET is_active='frozen' WHERE id='scale-4';
      INSERT INTO user_permissions(user_id,module,actions) VALUES ('scale-5','users',ARRAY['view']);
    `);
    const eligible = (await invoke("get", "selection", {}, "admin")).body.employees
      .filter((e: any) => e.eligible).map((e: any) => e.employeeId);
    expect((await select(eligible)).statusCode).toBe(200);
    runtime.queries = [];
    const result = await invoke("get");
    expect(result.statusCode).toBe(200);
    expect(result.body.employees).toHaveLength(821);
    expect(result.body.employees.filter((e: any) => e.account)).toHaveLength(395);
    expect(runtime.queries.length).toBe(smallCount);
    expect(runtime.queries.length).toBeLessThanOrEqual(30);
    expect(runtime.queries.join("\n")).not.toMatch(/lock table|password|first_name|profile_image|select \*/i);
    expect(runtime.queries.join("\n")).toMatch(/repeatable read read only/i);
    expect(JSON.stringify(result.body)).not.toMatch(/sensitive-hash|scale-(?:[1-5]|40[1-9]|41\d|420)"/);
    // No cache: a subsequent write is visible on the very next request.
    await query("UPDATE users SET role='admin' WHERE id='scale-6'");
    const refreshed = (await invoke("get")).body.employees;
    expect(refreshed).toHaveLength(821);
    expect(refreshed.find((e: any) => e.employeeName === "linked-6")).toMatchObject({
      hasAccount: true, account: null, management: { allowed: false, reason: "protected_account" },
    });
  });
  it("matches locked mutation DTOs for owned suspension, admin refreeze and policy withdrawal", async () => {
    await configure();
    const created = await create();
    const directoryEmployee = async (actor = "ops") =>
      (await invoke("get", "", {}, actor)).body.employees.find((e: any) => e.employeeId === 1);
    expect(await directoryEmployee()).toEqual(created.body.employee);
    const suspended = await invoke("patch", "/:employeeId/status", { isActive: "inactive" });
    expect(suspended.body.employee.account.canReactivate).toBe(true);
    expect(await directoryEmployee()).toEqual(suspended.body.employee);
    await invoke("patch", "/:employeeId/status", { isActive: "inactive" }, "admin");
    expect((await directoryEmployee()).account.canReactivate).toBe(false);
    expect((await directoryEmployee("admin")).account.canReactivate).toBe(true);
    await configure(false);
    expect((await directoryEmployee("admin")).account.canReactivate).toBe(false);
  });
  it("reports only sanitized SQLSTATE, operation and elapsed time on database timeouts", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(runtime.db, "transaction").mockRejectedValueOnce({
      cause: { code: "57014", message: "secret-password", parameters: ["secret-user-id"] },
    });
    const result = await invoke("get");
    expect(result.statusCode).toBe(503);
    expect(result.body.code).toBe("ACCOUNT_OPERATION_TIMEOUT");
    expect(logged).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logged.mock.calls[0][0])).toEqual({
      operation: "employee_account_directory", sqlstate: "57014", elapsedMs: expect.any(Number),
    });
  });
  it("does not take write-blocking table locks and respects delivery authority and invalid suspension markers", async () => {
    await configure();
    await create();
    const accountId = await id();
    await invoke("patch", "/:employeeId/status", { isActive: "inactive" });
    const client = await pool.connect();
    try {
      // Compatible with snapshot reads, incompatible with the former directory
      // SHARE ROW EXCLUSIVE lock. No uncommitted data should leak into GET.
      await client.query("BEGIN");
      await client.query("UPDATE users SET role='admin' WHERE id=$1", [accountId]);
      const result = await invoke("get");
      expect(result.statusCode).toBe(200);
      expect(result.body.employees[0].account.canReactivate).toBe(true);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    await query("UPDATE portal_settings SET value='invalid-json' WHERE key=$1",
      [`employee_account_delegation.suspension.${accountId}`]);
    expect((await invoke("get")).body.employees[0].account.canReactivate).toBe(false);
    await query("UPDATE users SET job_title='delivery' WHERE id=$1", [accountId]);
    // Even admin cannot reactivate intrinsic delivery rights outside approval.
    const result = await invoke("get", "", {}, "admin");
    expect(result.body.employees.find((e: any) => e.employeeId === 1).account.canReactivate).toBe(false);
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
    expect(created.body.credentials.username).toHaveLength(8);
    expect(created.body.credentials.password).toHaveLength(12);
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
  it("rejects empty creation and action-only grants without writes, while retaining empty revocation", async () => {
    await configure();
    expect((await invoke("post", "/:employeeId", { permissions: [] })).statusCode).toBe(400);
    expect((await invoke("post", "/:employeeId", { permissions: [{ module: "cashier_journal", actions: ["create"] }] })).body.code).toBe("VIEW_REQUIRED");
    expect(await id()).toBeNull();
    expect((await query("SELECT count(*)::int AS n FROM users")).rows[0].n).toBe(2);
    await create();
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).statusCode).toBe(200);
  });
  it("recovers a username collision under the table lock and returns only the committed name", async () => {
    await configure();
    await query("INSERT INTO users(id,username,role,branch_id) VALUES ('collision','Abc234xy','viewer','b')");
    vi.spyOn(delegationPolicy, "generatedCredentials").mockReturnValue({ username: "Abc234xy", password: "AbcdefGH2345" });
    const created = await create();
    expect(created.body.credentials.username).not.toBe("Abc234xy");
    expect(created.body.credentials.username).toHaveLength(8);
    const account = (await query("SELECT username,password FROM users WHERE id=$1", [await id()])).rows[0];
    expect(account.username).toBe(created.body.credentials.username);
    expect(await bcrypt.compare(created.body.credentials.password, account.password)).toBe(true);
    expect((await query("SELECT username FROM users WHERE id='collision'")).rows[0].username).toBe("Abc234xy");
  });
  it("keeps a legacy action-only policy readable for safety suspension and complete reduction", async () => {
    await configure();
    await create();
    await query("UPDATE portal_settings SET value=$1 WHERE key=$2", [
      JSON.stringify({ enabled: false, permissions: [{ module: "cashier_journal", actions: ["create"] }] }), policyKey,
    ]);
    const listed = await invoke("get");
    expect(listed.statusCode).toBe(200);
    expect(listed.body.employees).toHaveLength(1);
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).statusCode).toBe(200);
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).statusCode).toBe(200);
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
    expect((await invoke("get")).body.employees).toMatchObject([
      { employeeId: 1, account: null, management: { allowed: false, reason: "read_only_branch" } },
    ]);
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("BRANCH_FORBIDDEN");
  });
  it.each(["admin", "branch_manager", "operations_manager", "business_owner", "hr_manager", "financial_manager"])(
    "does not expose or mutate linked protected %s accounts", async role => {
      await configure();
      const created = await create();
      await query("UPDATE users SET role=$1 WHERE id=$2", [role, created.body.employee.account.id]);
       expect((await invoke("get")).body.employees).toMatchObject([
         { employeeId: 1, hasAccount: true, account: null, management: { allowed: false, reason: "protected_account" } },
       ]);
      expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).body.code).toBe("PROTECTED_ACCOUNT");
      expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).statusCode).toBe(403);
    });
  it.each(["user_assignments", "user_permission_overrides"])("rejects all inherited/override rights via %s", async table => {
    await configure(); await create();
    await query(`INSERT INTO ${table}(user_id) VALUES ($1)`, [await id()]);
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).body.code).toBe("ELEVATED_ACCOUNT");
    expect((await invoke("get")).body.employees).toMatchObject([
      { employeeId: 1, hasAccount: true, account: null, management: { allowed: false, reason: "protected_account" } },
    ]);
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
    expect((await invoke("get")).body.employees).toMatchObject([
      { employeeId: 1, hasAccount: true, account: null, management: { allowed: false, reason: "protected_account" } },
    ]);
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
   it.each(["employee_move", "grant_revocation", "individual_revocation", "policy_revocation", "target_elevation", "actor_demotion"])(
    "rechecks %s after a concurrent legacy transaction commits", async race => {
      await configure(); await create();
      const target = await id();
      const concurrent = await pool.connect();
      try {
        await concurrent.query("BEGIN");
        if (race === "employee_move") await concurrent.query("UPDATE branch_employees SET branch_id='b' WHERE id=1");
        if (race === "grant_revocation") await concurrent.query("DELETE FROM user_branch_access WHERE user_id='ops'");
         if (race === "individual_revocation") await concurrent.query("DELETE FROM portal_settings WHERE key=$1", [managerKey()]);
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
  it("missing individual selection grants nothing while showing the complete active branch roster", async () => {
    await configure();
    await query("DELETE FROM portal_settings WHERE key=$1", [managerKey()]);
    await query(`INSERT INTO user_branch_access(user_id,branch_id,access_level) VALUES ('ops','b','view_only');
      INSERT INTO branches VALUES ('empty','فرع بلا موظفين');
      INSERT INTO user_branch_access(user_id,branch_id,access_level) VALUES ('ops','empty','view_only');
      INSERT INTO branch_employees(branch_id,employee_name,status) VALUES ('a','موظف غير نشط','inactive');`);
    const listed = await invoke("get");
    expect(listed.body.employees.map((e: any) => e.employeeId).sort()).toEqual([1, 2]);
    expect(listed.body.branches.map((b: any) => b.id).sort()).toEqual(["a", "b", "empty"]);
    expect(listed.body.employees.find((e: any) => e.employeeId === 1).management)
      .toEqual({ allowed: false, reason: "not_selected" });
    expect(listed.body.employees.find((e: any) => e.employeeId === 2).management.reason).toBe("read_only_branch");
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("EMPLOYEE_NOT_SELECTED");
    // Admin bypasses employee selection, never the protected-account checks.
    expect((await invoke("post", "/:employeeId", { permissions }, "admin")).statusCode).toBe(201);
    expect((await invoke("get")).body.employees.find((e: any) => e.employeeId === 1))
      .toMatchObject({ hasAccount: true, account: null, management: { reason: "not_selected" } });
  });
  it("keeps selections independent per manager and saving has no employee-account/session side effects", async () => {
    await configure(); await create();
    const target = await id();
    await query(`INSERT INTO users(id,role,first_name,last_name) VALUES ('ops2','operations_manager','مدير','ثانٍ');
      INSERT INTO user_branch_access(user_id,branch_id) VALUES ('ops2','a');
      INSERT INTO user_branch_access(user_id,branch_id,access_level) VALUES ('ops2','b','view_only');`);
    await query("INSERT INTO sessions VALUES ('employee-session',$1,now()+interval '1 hour')", [
      JSON.stringify({ userId: target, cookie: {} }),
    ]);
    const beforeAccount = (await query("SELECT * FROM users WHERE id=$1", [target])).rows[0];
    const beforePermissions = (await query("SELECT * FROM user_permissions WHERE user_id=$1", [target])).rows;
    expect((await invoke("get", "", {}, "ops2")).body.employees.find((e: any) => e.employeeId === 1))
      .toMatchObject({ hasAccount: true, account: null, management: { reason: "not_selected" } });
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" }, "ops2")).body.code)
      .toBe("EMPLOYEE_NOT_SELECTED");
    expect((await select([1], "ops2")).statusCode).toBe(200);
    expect((await select([], "ops")).statusCode).toBe(200);
    expect((await invoke("get", "", {}, "ops2")).body.employees.find((e: any) => e.employeeId === 1).management.allowed).toBe(true);
    expect((await invoke("get")).body.employees[0].management.reason).toBe("not_selected");
    expect((await query("SELECT * FROM users WHERE id=$1", [target])).rows[0]).toEqual(beforeAccount);
    expect((await query("SELECT * FROM user_permissions WHERE user_id=$1", [target])).rows).toEqual(beforePermissions);
    expect((await query("SELECT sess FROM sessions WHERE sid='employee-session'")).rows[0].sess.userId).toBe(target);
    const managers = (await invoke("get", "managers", {}, "admin")).body.managers;
    expect(managers.find((m: any) => m.id === "ops2")).toEqual({
      id: "ops2", name: "مدير ثانٍ", branches: [
        { id: "a", name: "الفرع أ", canManage: true }, { id: "b", name: "الفرع ب", canManage: false },
      ],
    });
    expect(JSON.stringify(managers)).not.toMatch(/username|password|permissions/);
  });
  it("individual withdrawal blocks even safety reductions/freezing, unlike disabled permission policy", async () => {
    await configure(); await create(); await configure(false);
    expect((await invoke("put", "/:employeeId/permissions", { permissions: [] })).statusCode).toBe(200);
    expect((await select([])).statusCode).toBe(200);
    for (const [method, suffix, body] of [
      ["put", "/:employeeId/permissions", { permissions: [] }],
      ["patch", "/:employeeId/status", { isActive: "inactive" }],
    ] as const) {
      expect((await invoke(method, suffix, body)).body.code).toBe("EMPLOYEE_NOT_SELECTED");
    }
    expect((await query("SELECT is_active FROM users WHERE id=$1", [await id()])).rows[0].is_active).toBe("active");
    expect((await invoke("get")).body.employees[0]).toMatchObject({
      hasAccount: true, account: null, management: { reason: "not_selected" },
    });
  });
  it("rejects duplicate, forged, protected, inactive, HQ and read-only employee selections", async () => {
    await configure(); await create();
    await query("UPDATE users SET role='admin',username='private-protected-name' WHERE id=$1", [await id()]);
    await query(`INSERT INTO user_branch_access(user_id,branch_id,access_level) VALUES ('ops','b','view_only');
      INSERT INTO branch_employees(branch_id,employee_name,status) VALUES ('a','غير نشط','inactive');`);
    const current = (await invoke("get", "selection", {}, "admin")).body;
    expect(current.selectedEmployeeIds).toEqual([]);
    expect(current.employees.find((e: any) => e.employeeId === 1))
      .toMatchObject({ hasAccount: true, eligible: false, reason: "protected_account" });
    expect(current.employees.find((e: any) => e.employeeId === 2))
      .toMatchObject({ eligible: false, reason: "read_only_branch" });
    expect(JSON.stringify(current)).not.toMatch(/private-protected-name|username|permissions|linkedUserId/);
    expect(JSON.stringify((await invoke("get")).body)).not.toContain("private-protected-name");
    for (const employeeIds of [[1], [2], [3], [4], [999]]) {
      expect((await select(employeeIds)).statusCode).toBe(403);
    }
    expect((await select([1, 1])).statusCode).toBe(400);
    for (const body of [
      { employeeIds: ["1"], revision: current.revision },
      { employeeIds: [1] },
      { employeeIds: [], revision: current.revision, managerId: "ops2" },
    ]) expect((await invoke("put", "selection", body, "admin")).statusCode).toBe(400);
    expect((await select([])).statusCode).toBe(200);
  });
  it("hides stale selections after branch transfer, never carries them to new targets, and prunes on save", async () => {
    await configure(); await create();
    const oldRevision = (await invoke("get", "selection", {}, "admin")).body.revision;
    await query("UPDATE branch_employees SET branch_id='b' WHERE id=1");
    expect((await invoke("get", "selection", {}, "admin")).body.selectedEmployeeIds).toEqual([]);
    expect((await select([], "ops", oldRevision)).statusCode).toBe(409);
    expect((await select([])).statusCode).toBe(200);
    const stored = JSON.parse((await query("SELECT value FROM portal_settings WHERE key=$1", [managerKey()])).rows[0].value);
    expect(stored.selections).toEqual([]);
    await query("UPDATE branch_employees SET branch_id='a' WHERE id=1");
    expect((await select([1])).statusCode).toBe(200);
    const original = await id();
    await query(`INSERT INTO users(id,username,role,branch_id) VALUES ('replacement','replacement-user','employee','a');
      UPDATE branch_employees SET linked_user_id='replacement' WHERE id=1;`);
    expect((await invoke("get")).body.employees[0]).toMatchObject({ hasAccount: true, account: null, management: { reason: "not_selected" } });
    expect((await invoke("patch", "/:employeeId/status", { isActive: "inactive" })).body.code).toBe("EMPLOYEE_NOT_SELECTED");
    expect((await query("SELECT is_active FROM users WHERE id=$1", [original])).rows[0].is_active).toBe("active");
    expect((await invoke("get", "selection", {}, "admin")).body.selectedEmployeeIds).toEqual([]);
  });
  it("transfer to another currently authorized branch still requires new individual approval", async () => {
    await configure();
    await query(`INSERT INTO user_branch_access(user_id,branch_id) VALUES ('ops','b');
      UPDATE branch_employees SET branch_id='b' WHERE id=1;`);
    expect((await invoke("get")).body.employees.find((e: any) => e.employeeId === 1).management.reason).toBe("not_selected");
    expect((await invoke("post", "/:employeeId", { permissions })).body.code).toBe("EMPLOYEE_NOT_SELECTED");
    expect((await select([1])).statusCode).toBe(200);
    expect((await invoke("post", "/:employeeId", { permissions })).statusCode).toBe(201);
  });
  it("allows clearing grants of demoted/inactive managers without exposing former employee scope", async () => {
    await configure();
    await query("UPDATE users SET role='employee' WHERE id='ops'");
    expect((await invoke("get", "managers", {}, "admin")).body.managers).toEqual([]);
    const detail = (await invoke("get", "selection", {}, "admin")).body;
    expect(detail).toMatchObject({ managerId: "ops", employees: [], selectedEmployeeIds: [] });
    expect((await select([1])).statusCode).toBe(403);
    expect((await select([])).statusCode).toBe(200);
    await query("UPDATE users SET role='operations_manager',is_active='inactive' WHERE id='ops'");
    expect((await invoke("get", "selection", {}, "admin")).body.employees).toEqual([]);
    expect((await select([])).statusCode).toBe(200);
  });
  it("admin endpoints re-read the actor and cannot be accessed by ops with forged users permissions", async () => {
    await configure();
    await query("INSERT INTO user_permissions(user_id,module,actions) VALUES ('ops','users',ARRAY['view','create','edit'])");
    const revision = (await invoke("get", "selection", {}, "admin")).body.revision;
    for (const [method, suffix, body] of [
      ["get", "managers", {}], ["get", "selection", {}],
      ["put", "selection", { employeeIds: [], revision }],
    ] as const) expect((await invoke(method, suffix, body, "ops")).statusCode).toBe(403);
    await query("UPDATE users SET role='employee' WHERE id='admin'");
    expect((await invoke("get", "managers", {}, "admin")).statusCode).toBe(403);
    expect((await invoke("get", "selection", {}, "admin")).statusCode).toBe(403);
    expect((await invoke("put", "selection", { employeeIds: [], revision }, "admin")).statusCode).toBe(403);
    await query("UPDATE users SET role='admin',is_active='inactive' WHERE id='admin'");
    expect((await invoke("get", "selection", {}, "admin")).statusCode).toBe(403);
  });
  it("serializes concurrent administrator selections with an optimistic 409 and minimal no-secret audit", async () => {
    const revision = (await invoke("get", "selection", {}, "admin")).body.revision;
    const responses = await Promise.all([
      invoke("put", "selection", { employeeIds: [], revision }, "admin"),
      invoke("put", "selection", { employeeIds: [1], revision }, "admin"),
    ]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 409]);
    const winner = responses.find(r => r.statusCode === 200)!;
    expect((await invoke("get", "selection", {}, "admin")).body).toEqual(winner.body);
    const logs = (await query("SELECT action,details,target_id FROM system_audit_logs")).rows;
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("manager_selection_update");
    expect(logs[0].target_id).toBe("ops");
    expect(JSON.stringify(logs)).not.toMatch(/username|password|secret-|permissions|salary|iqama|bank/);
  });
  it("selection save locks block concurrent legacy elevation before authoritative eligibility reads", async () => {
    await configure(); await create();
    const revision = (await invoke("get", "selection", {}, "admin")).body.revision;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET role='admin' WHERE id=$1", [await id()]);
      const pending = invoke("put", "selection", { employeeIds: [1], revision }, "admin");
      await new Promise(resolve => setTimeout(resolve, 60));
      await client.query("COMMIT");
      expect((await pending).statusCode).toBe(409);
      expect((await select([1])).statusCode).toBe(403);
    } finally { await client.query("ROLLBACK"); client.release(); }
  });
});