// Called only by the guarded real-HTTP smoke runner against its owned /tmp DB.
// No standalone launch, configured target discovery, or production operations.
import guard from "../scripts/isolated-test/target.cjs";

export async function runPermissionScopeSmoke({ client, request, admin, editor, check }) {
  await guard.proveDatabase(client, guard.assertRuntime());
  const userId = "isolated-fixture-editor";
  const branchA = "isolated-fixture-a";
  const branchB = "isolated-fixture-b";
  const list = (cookie = editor) => request("/api/hr/documents?pageSize=500", { cookie });
  const ids = response => response.json?.items?.map(item => String(item.id)) || [];
  const branches = response => [...new Set(response.json?.items?.map(item => item.branchId) || [])].sort();
  const permission = async action => (await client.query(
    "INSERT INTO permissions (module, action, name) VALUES ('hr_documents',$1,$2) RETURNING id",
    [action, `isolated-phase2-${action}`],
  )).rows[0].id;
  const role = async (slug, permissionId) => {
    const roleId = (await client.query(
      "INSERT INTO roles (name, slug, hierarchy_level) VALUES ($1,$2,50) RETURNING id", [slug, slug],
    )).rows[0].id;
    await client.query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2)", [roleId, permissionId]);
    return roleId;
  };
  const assign = async (roleId, branchId, scopeType = "branch") => (await client.query(
    `INSERT INTO user_assignments (user_id, role_id, scope_type, branch_id, is_primary, is_active, start_date)
     VALUES ($1,$2,$3,$4,false,true,now()-interval '1 hour') RETURNING id`,
    [userId, roleId, scopeType, branchId],
  )).rows[0].id;
  const document = async (employeeId, branchId, marker) => (await client.query(
    `INSERT INTO employee_documents (branch_employee_id, branch_id, document_type, document_number, status)
     VALUES ($1,$2,'other',$3,'active') RETURNING id`, [employeeId, branchId, marker],
  )).rows[0].id;
  const setInherit = () => client.query(
    `INSERT INTO user_permission_source_modes (user_id, source_mode) VALUES ($1,'inherit')
     ON CONFLICT (user_id) DO UPDATE SET source_mode='inherit', updated_at=now()`, [userId],
  );
  const viewId = await permission("view");
  const deleteId = await permission("delete");
  const createId = await permission("create");
  // A different catalog ID for the same module/action protects our assertions
  // from an implementation accidentally treating IDs as authorization scopes.
  const globalViewId = await permission("view");
  const viewRole = await role("isolated-phase2-reader", viewId);
  const deleteRole = await role("isolated-phase2-deleter", deleteId);
  const globalRole = await role("isolated-phase2-global-reader", globalViewId);
  await setInherit();
  for (const branchId of [branchA, branchB]) {
    await client.query(
      `INSERT INTO user_branch_access (user_id, branch_id, access_level, is_default)
       SELECT $1::varchar,$2::varchar,'full',false WHERE NOT EXISTS
       (SELECT 1 FROM user_branch_access WHERE user_id=$1::varchar AND branch_id=$2::varchar)`, [userId, branchId],
    );
  }
  const viewAssignmentA = await assign(viewRole, branchA);
  const deleteAssignmentB = await assign(deleteRole, branchB);
  const documentA = await document(900001, branchA, "isolated-phase2-document-a");
  let documentB = await document(900003, branchB, "isolated-phase2-document-b");

  let response = await list();
  check(response.status === 200 && ids(response).includes(String(documentA)), "G04_ACTIVE_SCOPED_VIEW_A_ALLOWED");
  check(!ids(response).includes(String(documentB)) && branches(response).every(id => id === branchA),
    "G04_COLLECTION_ACTION_BRANCH_FILTER_NO_UNION");
  check((await request(`/api/hr/documents/${documentA}?branchId=${branchB}`, {
    method: "DELETE", cookie: editor, body: { branchId: branchB },
  })).status === 403, "G04_DELETE_A_CANNOT_BORROW_DELETE_B_OR_CLAIMED_BRANCH");
  check((await client.query("SELECT id FROM employee_documents WHERE id=$1", [documentA])).rowCount === 1,
    "G04_DENIED_DELETE_A_PERSISTS");
  check((await request(`/api/hr/documents/${documentB}?branchId=${branchA}`, {
    method: "DELETE", cookie: editor, body: { branchId: branchA },
  })).status === 200, "G04_DELETE_B_PERSISTED_EMPLOYEE_CONTEXT_CONTROL");
  check((await client.query("SELECT id FROM employee_documents WHERE id=$1", [documentB])).rowCount === 0,
    "G04_DELETE_B_DATABASE_CONTROL");
  documentB = await document(900003, branchB, "isolated-phase2-document-b-restored");

  await client.query("UPDATE user_assignments SET start_date=now()+interval '1 hour' WHERE id=$1", [viewAssignmentA]);
  check((await list()).status === 403, "G04_FUTURE_ASSIGNMENT_NEXT_REQUEST_DENIED");
  await client.query(
    "UPDATE user_assignments SET start_date=now()-interval '2 hours', end_date=now()-interval '1 second' WHERE id=$1",
    [viewAssignmentA],
  );
  check((await list()).status === 403, "G04_EXPIRED_ASSIGNMENT_NEXT_REQUEST_DENIED");
  await client.query(
    "UPDATE user_assignments SET start_date=now()-interval '1 hour', end_date=NULL WHERE id=$1", [viewAssignmentA],
  );
  response = await list();
  check(response.status === 200 && ids(response).includes(String(documentA)), "G04_ASSIGNMENT_TIME_RESTORED_WITHOUT_RELOGIN");
  await client.query("UPDATE user_assignments SET is_active=false WHERE id=$1", [viewAssignmentA]);
  check((await list()).status === 403, "G04_REVOKED_ASSIGNMENT_IMMEDIATE_NEXT_REQUEST_DENIED");
  await client.query("UPDATE user_assignments SET is_active=true WHERE id=$1", [viewAssignmentA]);
  check((await list()).status === 200, "G04_ASSIGNMENT_REACTIVATED_WITHOUT_RELOGIN");

  const viewAssignmentB = await assign(viewRole, branchB);
  const scopedDenyId = (await client.query(
    `INSERT INTO user_permission_overrides (user_id, permission_id, allow, branch_id, expires_at, reason)
     VALUES ($1,$2,false,$3,now()+interval '1 hour','isolated-phase2-scoped-deny') RETURNING id`,
    [userId, viewId, branchA],
  )).rows[0].id;
  response = await list();
  check(response.status === 200 && ids(response).includes(String(documentB)), "G04_SCOPED_DENY_A_DOES_NOT_BLOCK_VIEW_B");
  check(!ids(response).includes(String(documentA)) && branches(response).every(id => id === branchB),
    "G04_SCOPED_DENY_A_REMOVES_ONLY_A");
  check((await request(`/api/hr/documents?branchId=${branchA}`, { cookie: editor })).status === 403,
    "G04_SCOPED_DENIED_BRANCH_QUERY_CANNOT_REOPEN_A");
  await client.query("UPDATE user_permission_overrides SET expires_at=now()-interval '1 second' WHERE id=$1", [scopedDenyId]);
  response = await list();
  check(response.status === 200 && ids(response).includes(String(documentA)) && ids(response).includes(String(documentB)),
    "G04_EXPIRED_SCOPED_DENY_NEXT_REQUEST_RESTORES_A_AND_B");

  // Admin must retain its full bypass even with no direct/role document grants,
  // and even when a current explicit denial names admin itself.
  const adminDenyId = (await client.query(
    `INSERT INTO user_permission_overrides (user_id, permission_id, allow, branch_id, reason)
     VALUES ('isolated-fixture-admin',$1,false,$2,'isolated-phase2-admin-bypass') RETURNING id`, [viewId, branchA],
  )).rows[0].id;
  response = await list(admin);
  check(response.status === 200 && ids(response).includes(String(documentA)) && ids(response).includes(String(documentB)),
    "G04_ADMIN_FULL_READ_BYPASS_WITH_EXPLICIT_DENY");
  await client.query("DELETE FROM user_permission_overrides WHERE id=$1", [adminDenyId]);

  // Test the intentional direct replacement over an active GLOBAL inherited
  // grant, with an independent CREATE denial that must survive every save.
  await client.query("UPDATE user_assignments SET is_active=false WHERE id=ANY($1::int[])",
    [[viewAssignmentA, viewAssignmentB, deleteAssignmentB]]);
  const globalAssignment = await assign(globalRole, null, "global");
  const independentDenyId = (await client.query(
    `INSERT INTO user_permission_overrides (user_id, permission_id, allow, branch_id, reason)
     VALUES ($1,$2,false,$3,'isolated-phase2-independent-deny') RETURNING id`, [userId, createId, branchA],
  )).rows[0].id;
  response = await list();
  check(response.status === 200 && ids(response).includes(String(documentA)) && ids(response).includes(String(documentB)),
    "G05_INHERITED_GLOBAL_VIEW_BEFORE_EMPTY_REPLACEMENT");
  const writePath = `/api/users/${userId}/permissions`;
  check((await request(writePath, { method: "PUT", cookie: admin, body: { permissions: [] } })).status === 200,
    "G05_ADMIN_INTENTIONAL_EMPTY_REPLACEMENT_CONTROL");
  check((await client.query("SELECT source_mode FROM user_permission_source_modes WHERE user_id=$1", [userId]))
    .rows[0]?.source_mode === "direct", "G05_EMPTY_REPLACEMENT_TRANSACTIONALLY_STAMPS_DIRECT");
  check((await client.query("SELECT id FROM user_permissions WHERE user_id=$1", [userId])).rowCount === 0,
    "G05_EMPTY_REPLACEMENT_PERSISTS_EMPTY_ROWS");
  check((await client.query("SELECT is_active FROM user_assignments WHERE id=$1", [globalAssignment]))
    .rows[0]?.is_active === true, "G05_GLOBAL_INHERITED_ASSIGNMENT_STILL_ACTIVE");
  check((await list()).status === 403, "G05_EMPTY_DIRECT_CANNOT_RESURRECT_GLOBAL_INHERITANCE");
  check((await client.query(
    "SELECT allow, branch_id, permission_id, reason FROM user_permission_overrides WHERE id=$1", [independentDenyId],
  )).rows[0]?.allow === false, "G05_INDEPENDENT_DENY_PRESERVED_AFTER_EMPTY_REPLACEMENT");
  check((await request(writePath, {
    method: "PUT", cookie: admin, body: { permissions: [{ module: "hr_documents", actions: ["view"] }] },
  })).status === 200, "G05_ADMIN_EXPLICIT_DIRECT_RESTORE_CONTROL");
  response = await list();
  check(response.status === 200 && ids(response).includes(String(documentA)) && ids(response).includes(String(documentB)),
    "G05_EXPLICIT_DIRECT_RESTORE_WORKS_WITHOUT_RELOGIN");
  const preserved = (await client.query(
    "SELECT allow, branch_id, permission_id, reason FROM user_permission_overrides WHERE id=$1", [independentDenyId],
  )).rows[0];
  check(preserved?.allow === false && preserved.branch_id === branchA && preserved.permission_id === createId
    && preserved.reason === "isolated-phase2-independent-deny", "G05_INDEPENDENT_DENY_TUPLE_PRESERVED_AFTER_RESTORE");
  check((await client.query("SELECT source_mode FROM user_permission_source_modes WHERE user_id=$1", [userId]))
    .rows[0]?.source_mode === "direct", "G05_RESTORED_GRANTS_REMAIN_EXPLICIT_DIRECT");
  check((await request("/api/hr/documents", {
    method: "POST", cookie: editor,
    body: { branchEmployeeId: 900001, branchId: branchB, documentType: "other" },
  })).status === 403, "G05_INDEPENDENT_CREATE_DENY_STILL_EFFECTIVE");
  check((await request(`/api/hr/documents/${documentA}`, { method: "DELETE", cookie: admin })).status === 200,
    "G05_ADMIN_FULL_DELETE_CONTROL_AFTER_POLICY_TRANSITIONS");
  check((await client.query("SELECT id FROM employee_documents WHERE id=$1", [documentA])).rowCount === 0,
    "G05_ADMIN_DELETE_PERSISTED_CONTROL");
}