// Imported by the runtime owner ONLY after disposable-target attestation.
// Fixtures: two active, non-delivery employees in manager's writable branch,
// selected independently for this manager; one linked, one unlinked. No overrides.
import assert from "node:assert/strict";
import guard from "../scripts/isolated-test/target.cjs";

export async function runEmployeeTemplateAssignmentSmoke({
  client, request, admin, manager, employee, linkedEmployeeId, unlinkedEmployeeId, check,
}) {
  await guard.proveDatabase(client, guard.assertRuntime());
  assert(Number.isSafeInteger(linkedEmployeeId) && Number.isSafeInteger(unlinkedEmployeeId),
    "Runtime owner must supply synthetic selected employee fixtures");
  const base = "/api/operations/employee-accounts";
  const drafts = "/api/rbac/job-template-drafts";
  const perms = [{ module: "cashier_journal", actions: ["view", "create"] }];
  const call = async (path, options, status, code) => {
    const response = await request(path, options);
    check(response.status === status, code);
    assert.equal(response.status, status, code);
    return response.json;
  };
  await call("/api/admin/employee-account-policy", {
    method: "PUT", cookie: admin, body: { enabled: true, permissions: perms },
  }, 200, "ETA_POLICY");
  const content = { key: "isolated_phase4_cashier", name: "Synthetic assignment cashier",
    description: "Disposable fixture", reviewNotes: "Explicit scope and permission review",
    scopeType: "branch", assignmentAuthority: "delegated_operations", permissions: perms };
  const draft = await call(drafts, { method: "POST", cookie: admin, body: { content } },
    201, "ETA_DRAFT");
  const approve = async (id, version, empty = false) => call(`${drafts}/${id}/approvals`, {
    method: "POST", cookie: admin, body: { version, expectedLatestVersion: version,
      reason: "Synthetic reviewed content", reviewed: true, ...(empty ? { acknowledgeEmptyPermissions: true } : {}) },
  }, 201, `ETA_APPROVE_${id}_${version}`);
  const snapshot = id => call(`${base}/${id}/template-assignment`, { cookie: manager },
    200, `ETA_SNAPSHOT_${id}`);
  const catalog = async id => call(`${base}/job-templates?employeeId=${id}`, { cookie: manager },
    200, `ETA_CATALOG_${id}`);
  check(!(await catalog(linkedEmployeeId)).templates.some(t => t.templateId === draft.id),
    "ETA_UNAPPROVED_NOT_ELIGIBLE");
  await approve(draft.id, 1);
  check((await catalog(linkedEmployeeId)).templates.some(t => t.templateId === draft.id && t.version === 1),
    "ETA_APPROVED_LATEST_ELIGIBLE");
  const linked = await snapshot(linkedEmployeeId);
  const body = { templateId: draft.id, version: 1, branchId: linked.branchId,
    reason: "Synthetic explicit reviewed assignment", expectedAssignmentRevision: linked.expectedAssignmentRevision };
  await call(`${base}/${linkedEmployeeId}/template-assignment`, { method: "POST", cookie: employee, body },
    403, "ETA_EMPLOYEE_CANNOT_ASSIGN");
  await call(`${base}/${linkedEmployeeId}/template-assignment`, { method: "POST", cookie: manager,
    body: { ...body, permissions: [] } }, 400, "ETA_CLIENT_PERMISSIONS_DENIED");
  await call(`${base}/${linkedEmployeeId}/template-assignment`, { method: "POST", cookie: manager,
    body: { ...body, branchId: "out_of_scope_synthetic" } }, 403, "ETA_NO_BRANCH_TRANSFER");
  const assigned = await call(`${base}/${linkedEmployeeId}/template-assignment`,
    { method: "POST", cookie: manager, body }, 200, "ETA_LINKED_ASSIGNMENT");
  check(assigned.assignment.templateId === draft.id && assigned.assignment.version === 1,
    "ETA_EXACT_VERSION_METADATA");
  check(!assigned.credentials, "ETA_ASSIGNMENT_NEVER_RETURNS_CREDENTIALS");
  await call(`${base}/${linkedEmployeeId}/template-assignment`, { method: "POST", cookie: manager, body },
    409, "ETA_STALE_ACCOUNT_SNAPSHOT");
  const unlinked = await snapshot(unlinkedEmployeeId);
  const created = await call(`${base}/${unlinkedEmployeeId}/template-account`, {
    method: "POST", cookie: manager, body: { ...body, branchId: unlinked.branchId,
      expectedAssignmentRevision: unlinked.expectedAssignmentRevision },
  }, 201, "ETA_UNLINKED_TEMPLATE_CREATE");
  assert(created.credentials?.username && created.credentials?.password);
  check(created.employee.account.id && created.employee.account.permissions.length === 1,
    "ETA_CREATION_LINK_AND_PERMISSIONS");
  const afterCreate = await snapshot(unlinkedEmployeeId);
  check(!afterCreate.credentials, "ETA_CREDENTIALS_ONE_SHOW");
  const persisted = (await client.query(`SELECT role, job_title, password,
    (SELECT source_mode FROM user_permission_source_modes m WHERE m.user_id=u.id) AS source_mode
    FROM users u WHERE id=$1`, [created.employee.account.id])).rows[0];
  check(persisted.role === "employee" && persisted.source_mode === "direct"
    && persisted.password !== created.credentials.password && persisted.password.startsWith("$2"),
  "ETA_SAFE_EMPLOYEE_BCRYPT_DIRECT_ONLY");
  const next = await call(`${drafts}/${draft.id}/versions`, { method: "POST", cookie: admin,
    body: { expectedLatestVersion: 1, content: { ...content, permissions: [{ module: "cashier_journal", actions: ["view"] }] },
      changeReason: "Synthetic narrower draft" } }, 201, "ETA_APPEND_NO_REAPPLICATION");
  assert(next.versions.length === 2);
  check(!(await catalog(linkedEmployeeId)).templates.some(t => t.templateId === draft.id),
    "ETA_OLDER_APPROVAL_NOT_LATEST");
  assert.deepEqual((await snapshot(unlinkedEmployeeId)).assignment, afterCreate.assignment);
  const latestSnapshot = await snapshot(linkedEmployeeId);
  await call(`${base}/${linkedEmployeeId}/template-assignment`, { method: "POST", cookie: manager,
    body: { ...body, expectedAssignmentRevision: latestSnapshot.expectedAssignmentRevision } },
  409, "ETA_STALE_TEMPLATE_VERSION");
  await approve(draft.id, 2);
  const beforeEmpty = await snapshot(linkedEmployeeId);
  const empty = await call(drafts, { method: "POST", cookie: admin,
    body: { content: { ...content, key: "isolated_phase4_self", scopeType: "self", permissions: [] } } },
  201, "ETA_EMPTY_DRAFT");
  await approve(empty.id, 1, true);
  const cleared = await call(`${base}/${linkedEmployeeId}/template-assignment`, { method: "POST", cookie: manager,
    body: { ...body, templateId: empty.id, expectedAssignmentRevision: beforeEmpty.expectedAssignmentRevision } },
  200, "ETA_EXPLICIT_EMPTY_ASSIGNMENT");
  assert.deepEqual(cleared.employee.account.permissions, []);
  const directMode = (await client.query("SELECT source_mode FROM user_permission_source_modes WHERE user_id=$1",
    [cleared.employee.account.id])).rows[0];
  check(directMode.source_mode === "direct", "ETA_EMPTY_DOES_NOT_RESTORE_INHERITANCE");
}