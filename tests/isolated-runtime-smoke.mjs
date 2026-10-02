import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import guard from "../scripts/isolated-test/target.cjs";
import { runPermissionScopeSmoke } from "./isolated-runtime-permission-scopes.mjs";
import { runHrScopeSmoke } from "./isolated-runtime-hr-scope.mjs";
import { runJobTemplateSmoke } from "./isolated-runtime-job-templates.mjs";

const target = guard.assertRuntime();
const origin = `http://127.0.0.1:${target.appPort}`;
const credentialsFile = path.join(path.dirname(process.env.ISOLATED_TEST_REGISTRY), "credentials.json");
const metadata = await stat(credentialsFile);
assert.equal(metadata.mode & 0o077, 0, "SMOKE_CREDENTIAL_PERMISSIONS");
const { accounts } = JSON.parse(await readFile(credentialsFile, "utf8"));
const client = new pg.Client({ connectionString: target.url, ssl: false, connectionTimeoutMillis: 5000 });
let count = 0;
function check(value, code) {
  assert.ok(value, code);
  count++;
}
async function request(route, { method = "GET", cookie, body } = {}) {
  const response = await fetch(origin + route, {
    method, headers: {
      Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0], json };
}
async function loginCredentials(account) {
  const response = await request("/api/auth/login", { method: "POST", body: { username: account.username, password: account.password } });
  check(response.status === 200 && response.cookie, `SMOKE_LOGIN_${(account.role || "GENERATED").toUpperCase()}`);
  return response.cookie;
}
async function login(id) {
  return loginCredentials(accounts.find(value => value.id === id));
}
async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await request("/api/health");
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("SMOKE_SERVER_NOT_READY");
}
try {
  await client.connect();
  await guard.proveDatabase(client, target);
  await waitForServer();
  check((await request("/api/users")).status === 401, "SMOKE_ANONYMOUS_DENIED");
  const admin = await login("isolated-fixture-admin");
  const editor = await login("isolated-fixture-editor");
  const manager = await login("isolated-fixture-manager");
  check((await request("/api/users", { cookie: admin })).status === 200, "SMOKE_ADMIN_USERS_CONTROL");
  const permissions = [{ module: "cashier_journal", actions: ["view"] }];
  const writePath = "/api/users/isolated-fixture-employee/permissions";
  const before = (await client.query("SELECT module, actions FROM user_permissions WHERE user_id=$1 ORDER BY module", ["isolated-fixture-employee"])).rows;
  check((await request(writePath, { method: "PUT", cookie: editor, body: { permissions } })).status === 403, "G01_GLOBAL_PERMISSION_WRITER_DENIED");
  check((await request("/api/users/isolated-fixture-editor/permissions", {
    method: "PUT", cookie: editor, body: { permissions },
  })).status === 403, "G01_SELF_ESCALATION_DENIED");
  check(JSON.stringify((await client.query("SELECT module, actions FROM user_permissions WHERE user_id=$1 ORDER BY module", ["isolated-fixture-employee"])).rows) === JSON.stringify(before), "G01_DENIAL_NO_PERMISSION_MUTATION");
  check((await request(writePath, { method: "PUT", cookie: admin, body: { permissions } })).status === 200, "G01_ADMIN_PERMISSION_CONTROL");
  const assignmentRoute = "/api/rbac/users/isolated-fixture-viewer/assignments";
  const created = await request(assignmentRoute, {
    method: "POST", cookie: admin, body: { roleId: 900001, branchId: "isolated-fixture-b", scopeType: "branch" },
  });
  check(created.status === 201 && Number.isInteger(created.json?.id), "G02_ADMIN_ASSIGNMENT_CONTROL");
  const assignmentId = created.json.id;
  for (const method of ["PATCH", "DELETE"]) {
    check((await request(`${assignmentRoute}/${assignmentId}`, {
      method, cookie: editor, ...(method === "PATCH" ? { body: { isActive: false } } : {}),
    })).status === 403, `G02_NONADMIN_ASSIGNMENT_${method}_DENIED`);
  }
  check((await request(`/api/rbac/users/isolated-fixture-employee/assignments/${assignmentId}`, {
    method: "DELETE", cookie: admin,
  })).status === 404, "G02_ASSIGNMENT_TARGET_OWNERSHIP");
  check((await client.query("SELECT is_active FROM user_assignments WHERE id=$1", [assignmentId])).rows[0]?.is_active === true, "G02_DENIAL_NO_ASSIGNMENT_MUTATION");
  check((await request(`${assignmentRoute}/${assignmentId}`, { method: "DELETE", cookie: admin })).status === 204, "G02_ADMIN_ASSIGNMENT_DELETE_CONTROL");
  check((await request("/api/hr/documents", { cookie: editor })).status === 200, "G03_VIEW_ONLY_READ_CONTROL");
  for (const [method, route] of [
    ["POST", "/api/hr/documents"], ["PATCH", "/api/hr/documents/900001"], ["DELETE", "/api/hr/documents/900001"],
  ]) check((await request(route, { method, cookie: editor, body: {} })).status === 403, `G03_INFERRED_ACTION_${method}_DENIED`);
  check((await request("/api/admin/employee-account-policy", {
    method: "PUT", cookie: editor, body: { enabled: true, permissions },
  })).status === 403, "DELEGATION_NONADMIN_POLICY_DENIED");
  check((await request("/api/admin/employee-account-policy", {
    method: "PUT", cookie: admin, body: { enabled: true, permissions },
  })).status === 200, "DELEGATION_ADMIN_POLICY_CONTROL");
  const detail = await request("/api/admin/employee-account-managers/isolated-fixture-manager", { cookie: admin });
  check(detail.status === 200 && detail.json?.revision, "DELEGATION_MANAGER_REVISION");
  check((await request("/api/admin/employee-account-managers/isolated-fixture-manager", {
    method: "PUT", cookie: admin, body: { revision: detail.json.revision, employeeIds: [900003] },
  })).status === 403, "DELEGATION_CROSS_BRANCH_SELECTION_DENIED");
  check((await request("/api/admin/employee-account-managers/isolated-fixture-manager", {
    method: "PUT", cookie: admin, body: { revision: detail.json.revision, employeeIds: [900001, 900002] },
  })).status === 200, "DELEGATION_ADMIN_SELECTION_CONTROL");
  check((await request("/api/admin/employee-account-managers/isolated-fixture-manager", {
    method: "PUT", cookie: admin, body: { revision: detail.json.revision, employeeIds: [900001] },
  })).status === 409, "DELEGATION_STALE_SELECTION_REVISION_DENIED");
  check((await request("/api/operations/employee-accounts/900001/permissions", {
    method: "PUT", cookie: manager, body: { permissions },
  })).status === 200, "DELEGATION_SCOPED_MANAGER_CONTROL");
  check((await request("/api/operations/employee-accounts/900001/permissions", {
    method: "PUT", cookie: manager, body: { permissions: [{ module: "users", actions: ["view", "edit"] }] },
  })).status === 403, "DELEGATION_PRIVILEGED_CEILING_DENIED");
  check((await request("/api/operations/employee-accounts/900003/status", {
    method: "PATCH", cookie: manager, body: { isActive: "inactive" },
  })).status === 403, "DELEGATION_CROSS_BRANCH_MUTATION_DENIED");
  const generated = await request("/api/operations/employee-accounts/900002", {
    method: "POST", cookie: manager, body: { permissions },
  });
  check(generated.status === 201 && generated.json?.credentials?.username && generated.json?.credentials?.password, "DELEGATION_SCOPED_CREATE_CONTROL");
  const generatedCookie = await loginCredentials(generated.json.credentials);
  check((await request("/api/my-permissions", { cookie: generatedCookie })).status === 200, "DELEGATION_GENERATED_ACCOUNT_AUTHENTICATED");
  const generatedIdentity = await request("/api/auth/me", { cookie: generatedCookie });
  check(generatedIdentity.status === 200 && generatedIdentity.json?.role === "employee"
    && generatedIdentity.json?.branchId === "isolated-fixture-a", "DELEGATION_CREATED_IDENTITY_SCOPE");
  const employee = await login("isolated-fixture-employee");
  check((await request("/api/my-permissions", { cookie: employee })).status === 200, "DELEGATION_SESSION_BEFORE_SUSPENSION");
  check((await request("/api/operations/employee-accounts/900001/status", {
    method: "PATCH", cookie: manager, body: { isActive: "inactive" },
  })).status === 200, "DELEGATION_SUSPENSION_CONTROL");
  check([401, 403].includes((await request("/api/my-permissions", { cookie: employee })).status), "DELEGATION_SESSION_REVOKED");
  const signedOut = await request("/api/auth/me", { cookie: employee });
  check([401, 403].includes(signedOut.status) || signedOut.status === 200 && signedOut.json === null, "DELEGATION_AUTH_BOOTSTRAP_NO_IDENTITY");
  check((await client.query("SELECT is_active FROM users WHERE id=$1", ["isolated-fixture-employee"])).rows[0]?.is_active === "inactive", "DELEGATION_DATABASE_SUSPENSION");
  check((await request("/api/operations/employee-accounts/900001/status", {
    method: "PATCH", cookie: manager, body: { isActive: "active" },
  })).status === 200, "DELEGATION_REACTIVATION_CONTROL");
  check([401, 403].includes((await request("/api/my-permissions", { cookie: employee })).status), "DELEGATION_OLD_SESSION_NOT_REVIVED");
  const reactivated = await login("isolated-fixture-employee");
  check((await request("/api/my-permissions", { cookie: reactivated })).status === 200, "DELEGATION_FRESH_LOGIN_AFTER_REACTIVATION");
  // Keep every original smoke assertion above intact; phase2 mutates only the
  // existing runner's disposable fixtures, after the original baseline checks.
  await runPermissionScopeSmoke({ client, request, admin, editor, check });
  await runHrScopeSmoke({ client, request, admin, editor, check });
  await runJobTemplateSmoke({ client, request, admin, editor, manager, employee: reactivated, check });
  console.log(`Isolated HTTP smoke passed: ${count} real authenticated admin/delegation/G01/G02/G03/G04/G05/HR_SCOPE/JT assertions.`);
} catch (error) {
  console.error(`Isolated HTTP smoke failed [${guard.safeReason(error)}]: ${/^SMOKE_|^G0[12345]_|^DELEGATION_|^HR_SCOPE_|^JT_/.test(error.message) ? error.message : "see guarded runtime diagnostics"}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}