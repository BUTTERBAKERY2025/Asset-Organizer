// Real HTTP helper: only the runtime owner calls this on an attested disposable
// database/app. Never discovers environment targets or runs workflows.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import guard from "../scripts/isolated-test/target.cjs";

export async function runAdminAdditionsSmoke({ client, request, admin, manager, employee, loginCredentials, check, freshServer = false }) {
  const target = guard.assertRuntime();
  await guard.proveDatabase(client, target);
  if (!freshServer) await new Promise(resolve => setTimeout(resolve, 61000)); // Real shared API limiter.
  const employeeId = 900050, otherEmployeeId = 900051;
  const A = "isolated-fixture-a", B = "isolated-fixture-b";
  const managerId = "isolated-fixture-manager";
  const additions = `/api/admin/employee-account-additions/${employeeId}`;
  const accounts = "/api/operations/employee-accounts";
  const snapshotPath = `${accounts}/${employeeId}/template-assignment`;
  const drafts = "/api/rbac/job-template-drafts";
  const policy = [
    { module: "cashier_journal", actions: ["view", "create", "edit"] },
    { module: "maintenance", actions: ["view", "edit"] },
  ];
  const call = async (path, body, code, status = 200, cookie = admin, method = "POST") => {
    const response = await request(path, { cookie, method, ...(body === undefined ? {} : { body }) });
    check(response.status === status, code);
    return response;
  };
  const tables = ["users", "branch_employees", "user_permissions", "user_permission_source_modes",
    "user_assignments", "user_permission_overrides", "employee_account_additions", "employee_job_template_assignments",
    "permissions", "portal_settings", "sessions", "user_sessions", "system_audit_logs"];
  const state = async () => {
    const result = {};
    for (const table of tables) result[table] = (await client.query(
      `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM "${table}" t`,
    )).rows[0].rows;
    return result;
  };
  const reject = async (path, body, code, status, error, cookie = admin, method = "POST") => {
    const before = await state();
    const response = await call(path, body, code, status, cookie, method);
    if (error) check(response.json?.code === error, `${code}_ERROR`);
    // Request tracking may update sessions/user_sessions. Durable authority,
    // generation tombstones and audit must not change on rejected authority.
    const after = await state();
    for (const table of tables.filter(t => !["sessions", "user_sessions"].includes(t)))
      assert.deepEqual(after[table], before[table], `${code}_${table}_UNCHANGED`);
    const generations = rows => rows.filter(r => r.sid?.startsWith("__local_auth_generation__:"));
    assert.deepEqual(generations(after.sessions), generations(before.sessions), `${code}_SESSION_GENERATION_UNCHANGED`);
    check(true, `${code}_AUTHORITY_ROLLBACK`);
  };
  await client.query(`INSERT INTO branch_employees
    (id,branch_id,employee_name,job_title,nationality,salary,status) VALUES
    ($1,$3,'Synthetic phase5 employee','cashier','Synthetic',1000,'active'),
    ($2,$4,'Synthetic phase5 other branch','worker','Synthetic',1000,'active')`,
  [employeeId, otherEmployeeId, A, B]);
  await call("/api/admin/employee-account-policy", { enabled: true, permissions: policy }, "AA_POLICY", 200, admin, "PUT");
  const selectionPath = `/api/admin/employee-account-managers/${managerId}`;
  const selected = await call(selectionPath, undefined, "AA_SELECTION_READ", 200, admin, "GET");
  await call(selectionPath, { revision: selected.json.revision,
     employeeIds: [...selected.json.selectedEmployeeIds, employeeId] }, "AA_OBSOLETE_SELECTION_REFUSED", 409, admin, "PUT");
   check(selected.json.employees.some(e => e.employeeId === employeeId && e.eligible), "AA_AUTOMATIC_BRANCH_EMPLOYEE");
  const draft = async (key, permissions, scopeType = "branch") => {
    const content = { key: `isolated_phase5_${key}`, name: `Synthetic phase5 ${key}`, description: "Disposable fixture",
      reviewNotes: "Explicit reviewed base", scopeType, assignmentAuthority: "delegated_operations", permissions };
    const created = await call(drafts, { content }, `AA_DRAFT_${key}`, 201);
    await call(`${drafts}/${created.json.id}/approvals`, { version: 1, expectedLatestVersion: 1,
      reason: "Explicit synthetic review", reviewed: true, ...(permissions.length ? {} : { acknowledgeEmptyPermissions: true }) },
    `AA_APPROVAL_${key}`, 201);
    return created.json.id;
  };
  const baseTemplate = await draft("base", [{ module: "cashier_journal", actions: ["view"] }]);
  const emptyTemplate = await draft("empty", [], "self");
  const preview = async () => (await call(snapshotPath, undefined, "AA_BASE_PREVIEW", 200, manager, "GET")).json;
  const assignBody = (id, snapshot) => ({ templateId: id, version: 1, branchId: A,
    reason: "Explicit base replacement preserving extras", expectedAssignmentRevision: snapshot.expectedAssignmentRevision });
  const created = await call(`${accounts}/${employeeId}/template-account`, assignBody(baseTemplate, await preview()),
    "AA_TEMPLATE_ACCOUNT", 201, manager);
  const credentials = created.json.credentials;
  const userId = created.json.employee.account.id;
  const global = { module: "maintenance", action: "view", allow: true, scopeType: "global", branchId: null,
    startsAt: null, endsAt: null, reason: "Explicit GLOBAL independent synthetic addition" };
  const add = async body => (await call(additions, body, "AA_ADMIN_ADD", 201)).json.addition;
  const update = async (row, body) => (await call(`${additions}/${row.id}`, { ...body, expectedRevision: row.revision },
    "AA_ADMIN_PATCH", 200, admin, "PATCH")).json.addition;
  const remove = async row => call(`${additions}/${row.id}`, { reason: "Explicit synthetic removal", expectedRevision: row.revision },
    "AA_ADMIN_DELETE", 200, admin, "DELETE");
  await reject(additions, global, "AA_MANAGER_CANNOT_ADD", 403, "DELEGATION_FORBIDDEN", manager);
  await reject(additions, global, "AA_EMPLOYEE_CANNOT_ADD", 403, "DELEGATION_FORBIDDEN", employee);
  await reject(additions, global, "AA_ANONYMOUS_CANNOT_ADD", 401, null, null);
  await reject(additions, { ...global, scopeType: "branch", branchId: A }, "AA_OPERATIONAL_BRANCH_NOT_CONTEXTUAL",
    400, "UNSUPPORTED_ADDITION_SCOPE");
  await reject(additions, { ...global, branchId: A }, "AA_GLOBAL_NOT_FAKE_BRANCH", 400, "UNSUPPORTED_ADDITION_SCOPE");
  await reject(additions, { ...global, scopeType: "department" }, "AA_DEPARTMENT_UNSUPPORTED", 400, "INVALID_INPUT");
  await reject(additions, { ...global, module: "hr_documents", scopeType: "branch", branchId: B },
    "AA_BRANCH_PERSISTED_EMPLOYEE_ONLY", 403, "BRANCH_FORBIDDEN");
  const oldPreview = await preview();
  let extra = await add({ ...global, startsAt: "2099-01-01T00:00:00Z" });
  const read = await call(additions, undefined, "AA_ADMIN_GET", 200, admin, "GET");
  check(read.json.additions.some(row => row.id === extra.id && row.integrity === "managed")
    && read.json.capabilities.branchModules.every(p => ["hr_documents", "hr_evaluations"].includes(p.module)),
  "AA_EXACT_OWNED_DTO_CAPABILITIES");
  const managerPreview = await preview();
  assert.deepEqual(managerPreview.currentPermissions, [{ module: "cashier_journal", actions: ["view"] }]);
  check(managerPreview.additions.some(row => row.id === extra.id && row.startsAt === extra.startsAt),
    "AA_MANAGER_READONLY_EXTRAS_BASE_SEPARATE");
  const directory = await call(accounts, undefined, "AA_SAFE_EXTRAS_DIRECTORY", 200, manager, "GET");
  check(directory.json.employees.find(row => row.employeeId === employeeId)?.management.allowed === true,
    "AA_SAFE_MANAGED_EXTRAS_DIRECTORY_ELIGIBLE");
  await reject(snapshotPath, assignBody(emptyTemplate, oldPreview), "AA_STALE_BASE_CONFIRM_AFTER_EXTRA",
    409, "ASSIGNMENT_REVISION_CONFLICT", manager);
  let cookie = await loginCredentials(credentials);
  const mine = await call("/api/my-permissions", undefined, "AA_FUTURE_FLAT_PERMISSION_READ", 200, cookie, "GET");
  check(!mine.json.some(p => p.module === "maintenance" && p.actions.includes("view")), "AA_FUTURE_GLOBAL_NOT_EFFECTIVE");
  await call(`/api/maintenance-tickets/summary?branchId=${A}`, undefined, "AA_FUTURE_ACTUAL_ROUTE_DENIED", 403, cookie, "GET");

  // Losing provenance must NOT bypass the independent starts_at temporal check.
  await guard.proveDatabase(client, target);
  await client.query("ALTER TABLE public.employee_account_additions RENAME TO isolated_aa_hidden_metadata");
  try {
    await call(snapshotPath, undefined, "AA_MISSING_PROVENANCE_PROTECTS_OPS", 403, manager, "GET");
    await call(additions, undefined, "AA_MISSING_PROVENANCE_ADMIN_503", 503, admin, "GET");
    const flat = await call("/api/my-permissions", undefined, "AA_FUTURE_WITHOUT_METADATA", 200, cookie, "GET");
    check(!flat.json.some(p => p.module === "maintenance" && p.actions.includes("view")), "AA_NO_TEMPORAL_FALLBACK");
  } finally { await client.query("ALTER TABLE public.isolated_aa_hidden_metadata RENAME TO employee_account_additions"); }
  const future = extra;
  extra = await update(extra, { ...global, startsAt: "2020-01-01T00:00:00Z" });
  await reject(`${additions}/${extra.id}`, { ...global, expectedRevision: future.revision },
    "AA_STALE_ADDITION_REVISION", 409, "ADDITION_REVISION_CONFLICT", admin, "PATCH");
  await reject(`/api/admin/employee-account-additions/900001/${extra.id}`,
    { reason: "Wrong employee", expectedRevision: extra.revision }, "AA_WRONG_EMPLOYEE_NOT_OWNED",
    404, "ADDITION_NOT_FOUND", admin, "DELETE");
  cookie = await loginCredentials(credentials);
  await call(`/api/maintenance-tickets/summary?branchId=${A}`, undefined, "AA_ACTIVE_GLOBAL_ACTUAL_ROUTE_ALLOWED", 200, cookie, "GET");
  const rowsBefore = (await client.query("SELECT * FROM user_permission_overrides WHERE user_id=$1 ORDER BY id", [userId])).rows;
  await call(snapshotPath, assignBody(emptyTemplate, await preview()), "AA_BASE_REPLACEMENT", 200, manager);
  assert.deepEqual((await client.query("SELECT * FROM user_permission_overrides WHERE user_id=$1 ORDER BY id", [userId])).rows, rowsBefore);
  check(true, "AA_TEMPLATE_REPLACEMENT_PRESERVES_OVERRIDE_ROWS");
  const afterBase = await preview();
  assert.deepEqual(afterBase.currentPermissions, []);
  check(afterBase.additions.some(row => row.id === extra.id), "AA_EMPTY_BASE_KEEPS_INDEPENDENT_EXTRA");
  await reject(`${accounts}/${employeeId}/permissions`, { permissions: [{ module: "maintenance", actions: ["view"] }] },
    "AA_EXTRA_CANNOT_MOVE_INTO_OWNED_BASE", 403, "REDUCTION_ONLY", manager, "PUT");
  extra = await update(extra, { ...global, endsAt: "2000-01-01T00:00:00Z" });
  cookie = await loginCredentials(credentials);
  await call(`/api/maintenance-tickets/summary?branchId=${A}`, undefined, "AA_EXPIRED_GLOBAL_ACTUAL_ROUTE_DENIED", 403, cookie, "GET");
  await call(snapshotPath, assignBody(baseTemplate, await preview()), "AA_BASE_FOR_DENY_CONTROL", 200, manager);
  const deny = await add({ ...global, module: "cashier_journal", action: "view", allow: false });
  cookie = await loginCredentials(credentials);
  await call(`/api/cashier-journals?branchId=${A}`, undefined, "AA_MANAGED_GLOBAL_DENY_WINS_BASE", 403, cookie, "GET");
  const denialRows = (await client.query("SELECT * FROM user_permission_overrides WHERE id=$1", [deny.id])).rows;
  await call(snapshotPath, assignBody(emptyTemplate, await preview()), "AA_BASE_REPLACEMENT_WITH_DENY", 200, manager);
  assert.deepEqual((await client.query("SELECT * FROM user_permission_overrides WHERE id=$1", [deny.id])).rows, denialRows);
  check(true, "AA_BASE_REPLACEMENT_NEVER_ERASES_INDEPENDENT_DENY");
  await remove(deny);

  // Audit and session invalidation failures roll back every override/provenance/
  // catalog mutation, including real session generation tombstones.
  await guard.proveDatabase(client, target);
  await client.query(`CREATE FUNCTION public.isolated_aa_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.module='employee_account_delegation' AND NEW.action LIKE 'addition_%' THEN
      RAISE EXCEPTION 'Synthetic phase5 audit failure' USING ERRCODE='23514';
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER isolated_aa_fail_audit BEFORE INSERT ON system_audit_logs
      FOR EACH ROW EXECUTE FUNCTION public.isolated_aa_fail_audit()`);
  try {
    await reject(additions, { ...global, action: "edit" }, "AA_CREATE_AUDIT_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED");
    await reject(`${additions}/${extra.id}`, { ...global, expectedRevision: extra.revision },
      "AA_PATCH_AUDIT_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED", admin, "PATCH");
    await reject(`${additions}/${extra.id}`, { reason: "Removal", expectedRevision: extra.revision },
      "AA_DELETE_AUDIT_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED", admin, "DELETE");
  } finally {
    await client.query("DROP TRIGGER isolated_aa_fail_audit ON system_audit_logs; DROP FUNCTION public.isolated_aa_fail_audit()");
  }
  const sid = `__local_auth_generation__:${userId}`;
  await client.query(`CREATE FUNCTION public.isolated_aa_fail_session() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.sid=${`'${sid.replaceAll("'", "''")}'`} THEN
      RAISE EXCEPTION 'Synthetic phase5 session failure' USING ERRCODE='23514';
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER isolated_aa_fail_session BEFORE INSERT OR UPDATE ON sessions
      FOR EACH ROW EXECUTE FUNCTION public.isolated_aa_fail_session()`);
  try {
    await reject(additions, { ...global, action: "edit" }, "AA_SESSION_FAILURE_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED");
  } finally {
    await client.query("DROP TRIGGER isolated_aa_fail_session ON sessions; DROP FUNCTION public.isolated_aa_fail_session()");
  }
  await remove(extra);
  const privilege = await add({ ...global, module: "users", action: "view" });
  await call(snapshotPath, undefined, "AA_PRIVILEGED_MANAGED_EXTRA_PROTECTS_ACCOUNT", 403, manager, "GET");
  const protectedDirectory = await call(accounts, undefined, "AA_PRIVILEGED_EXTRA_DIRECTORY", 200, manager, "GET");
  check(protectedDirectory.json.employees.find(row => row.employeeId === employeeId)?.management.reason === "protected_account",
    "AA_PRIVILEGED_EXTRA_NEVER_BECOMES_OPS_AUTHORITY");
  await remove(privilege);
  const scoped = await add({ ...global, module: "hr_documents", scopeType: "branch", branchId: A });
  await call(snapshotPath, undefined, "AA_HR_EXTRA_STILL_PROTECTED_FROM_OPS", 403, manager, "GET");
  const docA = (await client.query(`INSERT INTO employee_documents
    (branch_employee_id,branch_id,document_type,document_number,status)
    VALUES ($1,$2,'other','isolated-phase5-doc-a','active') RETURNING id`, [employeeId, A])).rows[0].id;
  const docB = (await client.query(`INSERT INTO employee_documents
    (branch_employee_id,branch_id,document_type,document_number,status)
    VALUES ($1,$2,'other','isolated-phase5-doc-b','active') RETURNING id`, [otherEmployeeId, B])).rows[0].id;
  cookie = await loginCredentials(credentials);
  const docs = await call("/api/hr/documents?pageSize=500", undefined, "AA_CONTEXTUAL_BRANCH_COLLECTION", 200, cookie, "GET");
  // The shared HR read model intentionally projects real IDs as text, since
  // the same collection includes synthetic legacy-profile string IDs.
  const documentIds = docs.json.items.map(row => String(row.id));
  check(documentIds.includes(String(docA)) && !documentIds.includes(String(docB))
    && docs.json.items.every(row => row.branchId === A), "AA_SCOPED_HR_NOT_CROSS_BRANCH_OR_BODY_SCOPE");
  await call(`/api/hr/documents?branchId=${B}`, undefined, "AA_CONTEXTUAL_BRANCH_QUERY_NOT_AUTHORITY", 403, cookie, "GET");
  await remove(scoped);
  let legacyPermission = (await client.query("SELECT id FROM permissions WHERE module='cashier_journal' AND action='view' ORDER BY id LIMIT 1")).rows[0]?.id;
  if (!legacyPermission) legacyPermission = (await client.query(
    "INSERT INTO permissions(module,action,name) VALUES ('cashier_journal','view','Synthetic unknown legacy deny vocabulary') RETURNING id",
  )).rows[0].id;
  const legacy = (await client.query(`INSERT INTO user_permission_overrides
    (user_id,permission_id,allow,reason,granted_by) VALUES ($1,$2,false,'Unknown synthetic legacy deny','isolated-fixture-admin') RETURNING id`,
  [userId, legacyPermission])).rows[0].id;
  await call(snapshotPath, undefined, "AA_UNKNOWN_LEGACY_DENY_PROTECTED", 403, manager, "GET");
  const owned = await call(additions, undefined, "AA_NO_LEGACY_ADOPTION", 200, admin, "GET");
  check(!owned.json.additions.some(row => row.id === legacy), "AA_LEGACY_NOT_MANAGED");
  await reject(`${additions}/${legacy}`, { reason: "Cannot erase unknown deny", expectedRevision: randomUUID() },
    "AA_CANNOT_DELETE_LEGACY_DENY", 404, "ADDITION_NOT_FOUND", admin, "DELETE");
  check((await client.query("SELECT allow FROM user_permission_overrides WHERE id=$1", [legacy])).rows[0].allow === false,
    "AA_LEGACY_DENY_PRESERVED");
  check((await client.query("SELECT count(*)::int AS n FROM user_assignments WHERE user_id=$1", [userId])).rows[0].n === 0,
    "AA_NO_ROLE_ASSIGNMENT_OR_CONVERSION");
}