// Real HTTP only on the smoke runner's proven, owned disposable database.
import guard from "../scripts/isolated-test/target.cjs";

export async function runHrScopeSmoke({ client, request, admin, editor, check }) {
  await guard.proveDatabase(client, guard.assertRuntime());
  const userId = "isolated-fixture-editor";
  const A = "isolated-fixture-a";
  const B = "isolated-fixture-b";
  const path = "/api/hr/evaluations";
  const criteria = [{ key: "quality", label: "Quality", weight: 75, score: 4 },
    { key: "team", label: "Team", weight: 25, score: 2 }];
  const body = (employeeId, branchId, date = "2030-01-01") => ({
    branchEmployeeId: employeeId, branchId, periodType: "quarterly",
    periodStart: date, periodEnd: "2030-12-31", criteria,
    overallScore: 5, status: "approved", approvedBy: userId,
  });
  const call = (route, method = "GET", data, cookie = editor) =>
    request(route, { method, cookie, ...(data === undefined ? {} : { body: data }) });
  const seed = async (employeeId, branchId, date, status = "draft") => (await client.query(
    `INSERT INTO employee_evaluations
     (branch_employee_id,branch_id,period_type,period_start,period_end,criteria,status)
     VALUES ($1,$2,'quarterly',$3,'2030-12-31',$4::jsonb,$5) RETURNING id`,
    [employeeId, branchId, date, JSON.stringify(criteria), status],
  )).rows[0].id;
  const row = async id => (await client.query("SELECT * FROM employee_evaluations WHERE id=$1", [id])).rows[0];
  // Reset only this disposable fixture's preceding smoke policy. No real-account
  // mapping, configured database discovery, or implicit login bypass is involved.
  await client.query("UPDATE user_assignments SET is_active=false WHERE user_id=$1", [userId]);
  await client.query("DELETE FROM user_permission_overrides WHERE user_id=$1", [userId]);
  await client.query("UPDATE user_permission_source_modes SET source_mode='inherit' WHERE user_id=$1", [userId]);
  const assignments = {};
  const permissions = {};
  for (const [module, action, branchId] of [
    ["hr_documents", "view", A],
    ["hr_evaluations", "view", A], ["hr_evaluations", "create", A],
    ["hr_evaluations", "edit", B], ["hr_evaluations", "approve", B], ["hr_evaluations", "delete", B],
  ]) {
    const key = `${module}_${action}`;
    const permissionId = (await client.query(
      "INSERT INTO permissions (module,action,name) VALUES ($1,$2,$3) RETURNING id",
      [module, action, `isolated-hr-${key}`],
    )).rows[0].id;
    permissions[key] = permissionId;
    const roleId = (await client.query(
      "INSERT INTO roles (name,slug,hierarchy_level) VALUES ($1,$2,50) RETURNING id",
      [`isolated-hr-${key}`, `isolated-hr-${key}`],
    )).rows[0].id;
    await client.query("INSERT INTO role_permissions (role_id,permission_id) VALUES ($1,$2)", [roleId, permissionId]);
    assignments[key] = (await client.query(
      `INSERT INTO user_assignments (user_id,role_id,scope_type,branch_id,is_primary,is_active,start_date)
       VALUES ($1,$2,'branch',$3,false,true,now()-interval '1 hour') RETURNING id`, [userId, roleId, branchId],
    )).rows[0].id;
  }
  const draftA = await seed(900001, A, "2030-02-01");
  const submittedA = await seed(900001, A, "2030-03-01", "submitted");
  const draftB = await seed(900003, B, "2030-02-01");
  const submittedB = await seed(900003, B, "2030-03-01", "submitted");
  const deleteB = await seed(900003, B, "2030-04-01");
  let response = await call(path);
  check(response.status === 200 && response.json.some(item => item.id === draftA)
    && response.json.every(item => item.branchId === A), "HR_SCOPE_VIEW_A_ALLOWED_B_FILTERED");
  check((await call(`${path}?branchId=${B}`)).status === 403, "HR_SCOPE_VIEW_B_QUERY_DENIED");
  check((await call(`${path}?branchId=all`)).status === 200, "HR_SCOPE_VIEW_ALL_STILL_BOUNDED");
  check((await call(`${path}?employeeId=900003`)).json?.length === 0, "HR_SCOPE_EMPLOYEE_FILTER_NO_B_LEAK");
  for (const [method, route, data] of [
    ["PATCH", `${path}/${draftA}`, { notes: "denied", branchId: B, branchEmployeeId: 900003 }],
    ["POST", `${path}/${submittedA}/approve`, { branchId: B }],
    ["DELETE", `${path}/${draftA}`, { branchId: B }],
  ]) {
    check((await call(`${route}?branchId=${B}`, method, data)).status === 403,
      `HR_SCOPE_CROSSPRODUCT_${method}_${route.endsWith("approve") ? "APPROVE" : "CONTENT"}_A_DENIED`);
  }
  check((await row(draftA)).notes === null && (await row(submittedA)).status === "submitted",
    "HR_SCOPE_DENIED_A_MUTATIONS_PERSIST_UNCHANGED");
  check((await call(`${path}?branchId=${A}`, "POST", body(900003, A))).status === 403,
    "HR_SCOPE_CREATE_B_EMPLOYEE_CANNOT_CLAIM_A");
  check((await call(path, "POST", body(900001, B))).status === 400,
    "HR_SCOPE_CREATE_EMPLOYEE_BRANCH_MISMATCH_RULE");
  response = await call(path, "POST", body(900001, A));
  check(response.status === 201 && response.json.branchId === A && response.json.overallScore === 3.5
    && response.json.status === "draft" && response.json.approvedBy === null, "HR_SCOPE_CREATE_A_SERVER_FIELDS_CONTROL");
  const createdA = response.json.id;
  check((await call(path, "POST", body(900001, A))).status === 409, "HR_SCOPE_DUPLICATE_PERIOD_RULE");
  check((await call(path, "POST", { ...body(900001, A, "2030-05-01"), periodEnd: "2029-01-01" })).status === 400,
    "HR_SCOPE_CREATE_DATE_ORDER_RULE");
  response = await call(`${path}/${draftB}?branchId=${A}`, "PATCH",
    { notes: "allowed B", branchId: A, branchEmployeeId: 900001, status: "approved", overallScore: 5, submit: true });
  check(response.status === 200 && response.json.branchId === B && response.json.branchEmployeeId === 900003
    && response.json.status === "submitted" && response.json.overallScore === 0, "HR_SCOPE_EDIT_B_PERSISTED_CONTEXT_IMMUTABLE_FIELDS");
  check((await call(`${path}/${submittedB}/approve?branchId=${A}`, "POST", { branchId: A })).status === 200,
    "HR_SCOPE_APPROVE_B_CONTROL");
  check((await row(submittedB)).status === "approved" && (await row(submittedB)).approved_by === userId,
    "HR_SCOPE_APPROVE_B_PERSISTED_ACTOR");
  check((await call(`${path}/${deleteB}?branchId=${A}`, "DELETE", { branchId: A })).status === 200
    && !await row(deleteB), "HR_SCOPE_DELETE_B_CONTROL");
  for (const method of ["PATCH", "DELETE"]) check((await call(`${path}/${submittedB}`, method, { notes: "locked" })).status === 423,
    `HR_SCOPE_APPROVED_${method}_LOCK_RULE`);
  check((await call(`${path}/${submittedB}/approve`, "POST", {})).status === 409, "HR_SCOPE_APPROVE_REPEAT_RULE");

  // Same session: move each action's grant to A, proving successful A controls
  // and denied B writes independently of VIEW and of client-supplied branches.
  for (const action of ["edit", "approve", "delete"]) {
    await client.query("UPDATE user_assignments SET branch_id=$1 WHERE id=$2", [A, assignments[`hr_evaluations_${action}`]]);
  }
  for (const [method, route] of [
    ["PATCH", `${path}/${draftB}`], ["POST", `${path}/${draftB}/approve`], ["DELETE", `${path}/${draftB}`],
  ]) check((await call(`${route}?branchId=${A}`, method, { branchId: A, notes: "denied B" })).status === 403,
    `HR_SCOPE_A_GRANTS_${method}_${route.endsWith("approve") ? "APPROVE" : "CONTENT"}_B_DENIED`);
  check((await row(draftB)).notes === "allowed B" && (await row(draftB)).status === "submitted",
    "HR_SCOPE_DENIED_B_MUTATIONS_UNCHANGED");
  response = await call(`${path}/${draftA}`, "PATCH", { criteria, submit: true });
  check(response.status === 200 && response.json.overallScore === 3.5 && response.json.status === "submitted",
    "HR_SCOPE_EDIT_A_CONTROL_RECALCULATED_SCORE");
  check((await call(`${path}/${createdA}`, "PATCH", { periodEnd: "2029-01-01" })).status === 400,
    "HR_SCOPE_PATCH_MERGED_DATE_ORDER_RULE");
  check((await call(`${path}/${createdA}/approve`, "POST", {})).status === 409, "HR_SCOPE_DRAFT_APPROVAL_RULE");
  check((await call(`${path}/${draftA}/approve`, "POST", {})).status === 200, "HR_SCOPE_APPROVE_A_CONTROL");
  check((await call(`${path}/${createdA}`, "DELETE")).status === 200 && !await row(createdA), "HR_SCOPE_DELETE_A_CONTROL");

  // Evaluation ownership is historical/persisted, unlike document ownership.
  await client.query("UPDATE branch_employees SET branch_id=$1 WHERE id=900001", [B]);
  response = await call(`${path}/${submittedA}`, "PATCH", { notes: "persisted A after transfer" });
  check(response.status === 200 && response.json.branchId === A, "HR_SCOPE_EVALUATION_BRANCH_SURVIVES_EMPLOYEE_TRANSFER");
  await client.query("UPDATE branch_employees SET branch_id=$1 WHERE id=900001", [A]);

  // Each action expires and revokes on the next request, with no new login.
  for (const action of ["view", "create", "edit", "approve", "delete"]) {
    const assignmentId = assignments[`hr_evaluations_${action}`];
    const probe = () => action === "view" ? call(path)
      : action === "create" ? call(path, "POST", body(900001, A, "2030-06-01"))
      : call(`${path}/${submittedA}${action === "approve" ? "/approve" : ""}`,
        action === "edit" ? "PATCH" : action === "delete" ? "DELETE" : "POST", { notes: "must not write" });
    await client.query("UPDATE user_assignments SET end_date=now()-interval '1 second' WHERE id=$1", [assignmentId]);
    check((await probe()).status === 403, `HR_SCOPE_EXPIRED_${action.toUpperCase()}_NEXT_REQUEST`);
    await client.query("UPDATE user_assignments SET end_date=NULL,is_active=false WHERE id=$1", [assignmentId]);
    check((await probe()).status === 403, `HR_SCOPE_REVOKED_${action.toUpperCase()}_SAME_SESSION`);
    await client.query("UPDATE user_assignments SET is_active=true WHERE id=$1", [assignmentId]);
  }
  check((await call(path)).status === 200, "HR_SCOPE_VIEW_RESTORED_SAME_SESSION");

  // Statistics must match the exact authorized metadata collection, including
  // status buckets; compare full structures, not merely non-empty totals.
  const statsPath = "/api/hr/documents/stats";
  const statsA = await call(`${statsPath}?branchId=${A}`, "GET", undefined, admin);
  const statsB = await call(`${statsPath}?branchId=${B}`, "GET", undefined, admin);
  response = await call(statsPath);
  check(statsA.status === 200 && statsB.status === 200 && response.status === 200
    && JSON.stringify(response.json) === JSON.stringify(statsA.json), "HR_SCOPE_STATS_A_ONLY_EXACT_ADMIN_A_PARITY");
  const documentsA = await call("/api/hr/documents?pageSize=500");
  check(JSON.stringify(response.json) === JSON.stringify(documentsA.json?.stats), "HR_SCOPE_STATS_LIST_PARITY");
  check((await call(`${statsPath}?branchId=${B}`)).status === 403, "HR_SCOPE_STATS_DENIED_B_QUERY");
  const statsAll = await call(statsPath, "GET", undefined, admin);
  check(statsB.json.total > 0 && statsAll.json.total === statsA.json.total + statsB.json.total
    && statsAll.json.total > response.json.total, "HR_SCOPE_STATS_ADMIN_ALL_CONTROL_NO_B_AGGREGATE_LEAK");
  const docsAssignment = assignments.hr_documents_view;
  await client.query("UPDATE user_assignments SET end_date=now()-interval '1 second' WHERE id=$1", [docsAssignment]);
  check((await call(statsPath)).status === 403, "HR_SCOPE_STATS_EXPIRED_VIEW_NEXT_REQUEST");
  await client.query("UPDATE user_assignments SET end_date=NULL,is_active=false WHERE id=$1", [docsAssignment]);
  check((await call(statsPath)).status === 403, "HR_SCOPE_STATS_REVOKED_VIEW_SAME_SESSION");
  await client.query("UPDATE user_assignments SET is_active=true WHERE id=$1", [docsAssignment]);
  const denyId = (await client.query(
    `INSERT INTO user_permission_overrides (user_id,permission_id,allow,branch_id,expires_at,reason)
     VALUES ($1,$2,false,$3,now()+interval '1 hour','isolated-hr-deny') RETURNING id`,
    [userId, permissions.hr_documents_view, A],
  )).rows[0].id;
  check((await call(statsPath)).status === 403, "HR_SCOPE_STATS_EXPLICIT_SCOPED_DENY");
  await client.query("UPDATE user_permission_overrides SET expires_at=now()-interval '1 second' WHERE id=$1", [denyId]);
  check((await call(statsPath)).status === 200, "HR_SCOPE_STATS_EXPIRED_DENY_RESTORES_SAME_SESSION");

  // Admin stays unrestricted despite explicit current denies on every action.
  for (const [key, permissionId] of Object.entries(permissions)) {
    await client.query(
      `INSERT INTO user_permission_overrides (user_id,permission_id,allow,branch_id,reason)
       VALUES ('isolated-fixture-admin',$1,false,$2,$3)`, [permissionId, B, `isolated-hr-admin-${key}`],
    );
  }
  response = await call(path, "GET", undefined, admin);
  check(response.status === 200 && response.json.some(item => item.branchId === A)
    && response.json.some(item => item.branchId === B), "HR_SCOPE_ADMIN_VIEW_BYPASS");
  check((await call(statsPath, "GET", undefined, admin)).json.total === statsAll.json.total,
    "HR_SCOPE_ADMIN_STATS_DENY_BYPASS");
  response = await call(path, "POST", body(900003, B, "2030-07-01"), admin);
  check(response.status === 201, "HR_SCOPE_ADMIN_CREATE_B_BYPASS");
  const adminCreated = response.json.id;
  check((await call(`${path}/${adminCreated}`, "PATCH", { submit: true }, admin)).status === 200,
    "HR_SCOPE_ADMIN_EDIT_B_BYPASS");
  check((await call(`${path}/${adminCreated}/approve`, "POST", {}, admin)).status === 200,
    "HR_SCOPE_ADMIN_APPROVE_B_BYPASS");
  check((await call(`${path}/${draftB}`, "DELETE", undefined, admin)).status === 200 && !await row(draftB),
    "HR_SCOPE_ADMIN_DELETE_B_BYPASS");
  check((await call(`${path}/${adminCreated}`, "DELETE", undefined, admin)).status === 423,
    "HR_SCOPE_ADMIN_PRESERVES_APPROVED_LOCK");
}