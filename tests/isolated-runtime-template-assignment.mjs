// Phase 4: registered HTTP routes on the launcher's proved, owned local cluster.
// This helper never discovers a configured DB, launches an app, or alters schema sources.
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import guard from "../scripts/isolated-test/target.cjs";

export async function runTemplateAssignmentSmoke({ client, request, admin, editor, manager, employee, loginCredentials, check }) {
  const target = guard.assertRuntime();
  await guard.proveDatabase(client, target);
  // All phases use the same real loopback limiter. Do not bypass or retry writes.
  await new Promise(resolve => setTimeout(resolve, 61000));
  const base = "/api/operations/employee-accounts";
  const drafts = "/api/rbac/job-template-drafts";
  const branch = "isolated-fixture-a";
  const linked = 900040, unlinked = 900041, delivery = 900042, unselected = 900043, inactive = 900044;
  const linkedId = "isolated-phase4-linked";
  const managerId = "isolated-fixture-manager";
  const policyKey = "employee_account_delegation.policy.v1";
  const grants = [
    { module: "cashier_journal", actions: ["view", "edit"] },
    { module: "maintenance", actions: ["view"] },
    { module: "delivery_tasks", actions: ["view", "edit"] },
  ];
  const equal = (actual, expected, code) => {
    assert.deepEqual(actual, expected, code);
    check(true, code);
  };
  const canonical = permissions => permissions.map(p => ({ module: p.module, actions: [...p.actions].sort() }))
    .sort((a, b) => a.module.localeCompare(b.module));
  const call = async (route, body, code, status = 200, cookie = manager, method = "POST") => {
    const result = await request(route, { method, cookie, ...(body === undefined ? {} : { body }) });
    check(result.status === status, code);
    return result;
  };
  const tables = [
    "users", "branch_employees", "user_permissions", "user_permission_source_modes",
    "user_assignments", "user_permission_overrides", "user_branch_access", "portal_settings",
    "roles", "permissions", "role_permissions", "role_templates", "branches",
    "job_permission_template_drafts", "job_permission_template_draft_versions",
    "job_permission_template_approvals", "employee_job_template_assignments", "system_audit_logs",
  ];
  const snapshot = async () => {
    const state = {};
    for (const table of tables) state[table] = (await client.query(
      `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM "${table}" t`,
    )).rows[0].rows;
    return state;
  };
  const reject = async (route, body, code, status, errorCode, cookie = manager, method = "POST") => {
    const prior = await snapshot();
    const response = await call(route, body, code, status, cookie, method);
    if (errorCode) check(response.json?.code === errorCode && typeof response.json?.error === "string", `${code}_ERROR`);
    equal(await snapshot(), prior, `${code}_ALL_ROWS_UNCHANGED`);
    return response;
  };
  const policy = async (enabled = true, permissions = grants) => call("/api/admin/employee-account-policy",
    { enabled, permissions }, "TA_POLICY_CONTROL", 200, admin, "PUT");
  const select = async ids => {
    const detail = await call(`/api/admin/employee-account-managers/${managerId}`, undefined,
      "TA_SELECTION_SNAPSHOT", 200, admin, "GET");
    check(detail.json.scopeMode === "all_branch_employees", "TA_AUTOMATIC_BRANCH_SCOPE");
    return call(`/api/admin/employee-account-managers/${managerId}`,
      { revision: detail.json.revision, employeeIds: ids }, "TA_OBSOLETE_SELECTION_REFUSED", 409, admin, "PUT");
  };
  // Dedicated synthetic fixtures avoid clearing assignments/overrides on earlier
  // phase accounts. Only the fixture transaction writes rows directly.
  await guard.proveDatabase(client, target);
  await client.query("BEGIN");
  try {
    await client.query(`INSERT INTO users (id,username,password,role,branch_id,is_active)
      SELECT $1,'isolated_phase4_linked',password,'employee',$2,'active'
      FROM users WHERE id='isolated-fixture-employee'`, [linkedId, branch]);
    await client.query(`INSERT INTO branch_employees
      (id,branch_id,linked_user_id,employee_name,job_title,nationality,salary,status) VALUES
      ($1,$6,$7,'Synthetic phase4 linked','cashier','Synthetic',1000,'active'),
      ($2,$6,NULL,'Synthetic phase4 unlinked','cashier','Synthetic',1000,'active'),
      ($3,$6,NULL,'Synthetic phase4 delivery','delivery','Synthetic',1000,'active'),
      ($4,$6,NULL,'Synthetic phase4 unselected','cashier','Synthetic',1000,'active'),
      ($5,$6,NULL,'Synthetic phase4 inactive','cashier','Synthetic',1000,'inactive')`,
    [linked, unlinked, delivery, unselected, inactive, branch, linkedId]);
    await client.query(`INSERT INTO user_permissions (user_id,module,actions)
      VALUES ($1,'maintenance',ARRAY['view'])`, [linkedId]);
    await client.query(`INSERT INTO user_permission_source_modes(user_id,source_mode) VALUES ($1,'inherit')`, [linkedId]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  await policy();
  await select([linked, unlinked, delivery]);

  const makeDraft = async (key, permissions, scopeType = "branch", assignmentAuthority = "delegated_operations", approve = true) => {
    const content = { key: `isolated_phase4_${key}`, name: `Synthetic phase4 ${key}`,
      description: "Owned ephemeral HTTP fixture", scopeType, assignmentAuthority, permissions, reviewNotes: "Explicit test review" };
    const created = await call(drafts, { content }, `TA_DRAFT_${key}`, 201, admin);
    if (approve) await call(`${drafts}/${created.json.id}/approvals`, {
      version: 1, expectedLatestVersion: 1, reason: "Explicit fixture review", reviewed: true,
      ...(permissions.every(p => !p.actions.length) ? { acknowledgeEmptyPermissions: true } : {}),
    }, `TA_APPROVE_${key}`, 201, admin);
    return { id: created.json.id, content };
  };
  const ordinary = await makeDraft("cashier", [grants[0]]);
  const empty = await makeDraft("empty", [], "self");
  const courier = await makeDraft("delivery", [grants[2]], "assigned_tasks");
  const unapproved = await makeDraft("unapproved", [grants[0]], "branch", "delegated_operations", false);
  const adminOnly = await makeDraft("admin", [], "self", "admin");
  const multi = await makeDraft("multi", [grants[0]], "branches");
  const selfActions = await makeDraft("self_actions", [grants[0]], "self");
  const wrongTasks = await makeDraft("wrong_tasks", [grants[0]], "assigned_tasks");
  const privileged = await makeDraft("privileged", [{ module: "users", actions: ["view"] }]);
  const actionOnly = await makeDraft("action_only", [{ module: "cashier_journal", actions: ["edit"] }]);
  const catalog = async (id = linked, cookie = manager) => call(`${base}/job-templates${id == null ? "" : `?employeeId=${id}`}`,
    undefined, "TA_CATALOG_CONTROL", 200, cookie, "GET");
  const preview = async (id = linked, cookie = manager) => (await call(`${base}/${id}/template-assignment`,
    undefined, "TA_PREVIEW_CONTROL", 200, cookie, "GET")).json;
  const bodyFor = (draft, state, version = 1) => ({
    templateId: draft.id, version, branchId: state.branchId,
    reason: "  Confirm exact reviewed template  ", expectedAssignmentRevision: state.expectedAssignmentRevision,
  });
  let state = await preview();
  check(state.employeeId === linked && state.branchId === branch && state.assignment === null
    && /^[a-f0-9]{64}$/.test(state.expectedAssignmentRevision), "TA_PREVIEW_OPAQUE_SNAPSHOT");
  equal(state.currentPermissions, [], "TA_PREVIEW_EXPLICIT_INHERIT_NOT_DORMANT_DIRECT_ROWS");
  equal(canonical((await client.query("SELECT module,actions FROM user_permissions WHERE user_id=$1", [linkedId])).rows),
    canonical([grants[1]]), "TA_DORMANT_DIRECT_FIXTURE_EXISTS_FOR_REPLACEMENT");
  const validBody = bodyFor(ordinary, state);
  const eligible = (await catalog()).json.templates;
  check(eligible.some(t => t.templateId === ordinary.id && t.version === 1)
    && eligible.some(t => t.templateId === empty.id && t.scopeType === "self"), "TA_CATALOG_LATEST_APPROVED_CONTROLS");
  for (const draft of [unapproved, adminOnly, multi, selfActions, wrongTasks, privileged, actionOnly, courier])
    check(!eligible.some(t => t.templateId === draft.id), `TA_CATALOG_EXCLUDES_${draft.content.key}`);
  check((await catalog(delivery)).json.templates.some(t => t.templateId === courier.id), "TA_DELIVERY_CATALOG_CONTROL");
  check(!(await catalog(delivery)).json.templates.some(t => t.templateId === ordinary.id), "TA_DELIVERY_NO_INTRINSIC_REMOVAL");
  check((await catalog(null)).json.templates.some(t => t.templateId === courier.id), "TA_GENERIC_CATALOG_DEFERS_JOB_CHECK");
  equal((await catalog(linked, admin)).json, (await catalog()).json, "TA_ADMIN_REGISTERED_CATALOG_CONTROL");

  const route = `${base}/${linked}/template-assignment`;
  await reject(route, validBody, "TA_ANONYMOUS_WRITE", 401, null, null);
  for (const [name, cookie] of [["editor", editor], ["employee", employee]]) {
    await reject(route, validBody, `TA_${name}_WRITE_FORBIDDEN`, 403, null, cookie);
    await reject(`${base}/job-templates`, undefined, `TA_${name}_CATALOG_FORBIDDEN`, 403, null, cookie, "GET");
    await reject(route, undefined, `TA_${name}_PREVIEW_FORBIDDEN`, 403, null, cookie, "GET");
  }
  for (const [name, extra] of [
    ["PERMISSIONS", { permissions: [{ module: "users", actions: ["view", "edit"] }] }],
    ["ACTIONS", { actions: ["edit"] }], ["ROLE", { role: "admin" }],
    ["JOB_TITLE", { jobTitle: "delivery" }], ["USER_ID", { userId: "isolated-fixture-admin" }],
    ["EMPLOYEE_ID", { employeeId: 900003 }], ["EMPTY_REASON", { reason: " " }],
    ["BAD_VERSION", { version: 1.5 }], ["FORGED_REVISION", { expectedAssignmentRevision: "forged" }],
  ]) await reject(route, { ...validBody, ...extra }, `TA_STRICT_${name}`, 400, "INVALID_INPUT");
  const missingRevision = { ...validBody }; delete missingRevision.expectedAssignmentRevision;
  await reject(route, missingRevision, "TA_REVISION_REQUIRED", 400, "INVALID_INPUT");
  await reject(route, { ...validBody, branchId: "isolated-fixture-b" }, "TA_FORGED_BRANCH", 403);
  await reject(`${base}/900003/template-assignment`, validBody, "TA_WRONG_BRANCH_EMPLOYEE", 403);
  await call(`${base}/${unselected}/template-assignment`, undefined, "TA_UNSELECTED_BRANCH_EMPLOYEE_INCLUDED", 200, manager, "GET");
  await reject(`${base}/${unselected}/template-account`, validBody, "TA_OTHER_EMPLOYEE_REVISION_DENIED", 409);
  await reject(`${base}/${inactive}/template-account`, validBody, "TA_INACTIVE", 403);
  await reject(`${base}/2147483647/template-assignment`, validBody, "TA_MISSING_EMPLOYEE", 404, "EMPLOYEE_NOT_FOUND");
  await reject(route, { ...validBody, templateId: 2147483647 }, "TA_MISSING_TEMPLATE", 404, "TEMPLATE_NOT_FOUND");
  await reject(route, { ...validBody, templateId: unapproved.id }, "TA_NOT_APPROVED", 409, "TEMPLATE_NOT_APPROVED");
  for (const draft of [adminOnly, multi, selfActions, wrongTasks, privileged])
    await reject(route, { ...validBody, templateId: draft.id }, `TA_SCOPE_OR_CEILING_${draft.content.key}`, 403);
  await reject(route, { ...validBody, templateId: actionOnly.id }, "TA_VIEW_REQUIRED", 400, "VIEW_REQUIRED");
  await reject(route, { ...validBody, templateId: courier.id }, "TA_NONDRIVER_CANNOT_CLAIM_TASKS", 403, "TEMPLATE_SCOPE_FORBIDDEN");
  await reject(`${base}/${linked}/template-account`, validBody, "TA_LINKED_CANNOT_CREATE", 409, "ACCOUNT_ALREADY_LINKED");
  const unlinkedState = await preview(unlinked);
  await reject(`${base}/${unlinked}/template-assignment`, bodyFor(ordinary, unlinkedState),
    "TA_UNLINKED_CANNOT_REPLACE", 409, "ACCOUNT_NOT_LINKED");
  await reject(`${base}/${unlinked}`, { permissions: [grants[0]] },
    "TA_ELIGIBLE_UNLINKED_RAW_CREATE_NO_BYPASS", 403, "APPROVED_TEMPLATE_REQUIRED");

  // A dormant legacy role and an independent deny are protected, not silently erased.
  for (const kind of ["assignment", "override"]) {
    await guard.proveDatabase(client, target);
    const inserted = kind === "assignment"
      ? await client.query(`INSERT INTO user_assignments(user_id,role_id,scope_type,branch_id,is_active)
          VALUES ($1,900001,'branch',$2,false) RETURNING id`, [linkedId, branch])
      : await client.query(`INSERT INTO user_permission_overrides(user_id,permission_id,allow,branch_id,reason)
          SELECT $1,id,false,$2,'isolated-phase4-independent-deny' FROM permissions ORDER BY id LIMIT 1 RETURNING id`, [linkedId, branch]);
    check(inserted.rows.length === 1, `TA_PROTECTED_${kind}_FIXTURE`);
    try {
      await reject(route, validBody, `TA_PROTECTED_${kind}_NO_ERASE`, 403, "ELEVATED_ACCOUNT");
    } finally {
      await client.query(`DELETE FROM ${kind === "assignment" ? "user_assignments" : "user_permission_overrides"} WHERE id=$1`,
        [inserted.rows[0].id]);
    }
  }
  await client.query("UPDATE users SET role='admin' WHERE id=$1", [linkedId]);
  try { await reject(route, validBody, "TA_PERSISTED_PRIVILEGED_ROLE", 403, "PROTECTED_ACCOUNT"); }
  finally { await client.query("UPDATE users SET role='employee' WHERE id=$1", [linkedId]); }
  await select([]);
  await call(`${base}/${linked}/template-assignment`, undefined, "TA_OBSOLETE_SELECTION_CANNOT_WITHDRAW_SCOPE", 200, manager, "GET");
  await select([linked, unlinked, delivery]);
  await client.query("UPDATE user_branch_access SET access_level='view_only' WHERE user_id=$1 AND branch_id=$2", [managerId, branch]);
  try { await reject(route, validBody, "TA_READ_ONLY_BRANCH_DENIED", 403, "BRANCH_FORBIDDEN"); }
  finally { await client.query("UPDATE user_branch_access SET access_level='limited' WHERE user_id=$1 AND branch_id=$2", [managerId, branch]); }
  // Existing explicit full AND limited grants are writable; invent no new policy.
  state = await preview();

  const assertWrite = async (id, draft, response, prior, actorId, version = 1, creation = false) => {
    const accountId = response.json?.employee?.account?.id;
    check(typeof accountId === "string", "TA_SUCCESS_ACCOUNT_DTO");
    const after = await snapshot();
    const binding = after.employee_job_template_assignments.find(row => row.employee_id === id);
    check(binding?.user_id === accountId && binding.template_id === draft.id && binding.version === version
      && binding.branch_id === branch && binding.assigned_by === actorId
      && binding.reason === "Confirm exact reviewed template"
      && binding.revision === response.json.assignment.revision, "TA_ACTUAL_ROW_BINDING");
    equal(canonical(after.user_permissions.filter(row => row.user_id === accountId)),
      canonical(draft.content.permissions.filter(p => p.actions.length)), "TA_EXACT_DIRECT_ROWS_NOT_MERGED");
    check(after.user_permission_source_modes.find(row => row.user_id === accountId)?.source_mode === "direct", "TA_DIRECT_MODE_EVEN_EMPTY");
    const account = after.users.find(row => row.id === accountId);
    check(account.role === "employee" && account.branch_id === branch, "TA_NO_SECURITY_ROLE_ESCALATION");
    if (!creation) {
      equal(account, prior.users.find(row => row.id === accountId), "TA_EXISTING_CREDENTIALS_ROLE_TITLE_STATE_UNCHANGED");
      equal(after.user_branch_access.filter(row => row.user_id === accountId),
        prior.user_branch_access.filter(row => row.user_id === accountId), "TA_EXISTING_BRANCH_GRANTS_UNCHANGED");
    } else {
      const access = after.user_branch_access.filter(row => row.user_id === accountId);
      check(access.length === 1 && access[0].branch_id === branch && access[0].access_level === "limited",
        "TA_CREATED_SINGLE_LIMITED_BRANCH_GRANT");
    }
    const audits = after.system_audit_logs.filter(row => !prior.system_audit_logs.some(old => old.id === row.id));
    check(audits.length === 2 && audits.every(row => row.user_id === actorId && row.entity_id === String(id)
      && row.branch_id === branch && row.target_id === accountId && row.module === "employee_account_delegation"),
    "TA_EXACT_ACCOUNT_AND_BINDING_ACTOR_AUDITS");
    equal(audits.map(row => row.action).sort(),
      creation ? ["account_create", "template_account_create"] : ["permissions_update", "template_assignment_update"],
      "TA_AUDIT_ACTIONS_EXACT_ONCE");
    const bindingAudit = audits.find(row => row.action.startsWith("template_"));
    const details = typeof bindingAudit.details === "string" ? JSON.parse(bindingAudit.details) : bindingAudit.details;
    equal(details.after, response.json.assignment, "TA_AUDIT_EXACT_IMMUTABLE_VERSION_BINDING");
    equal(canonical(details.permissionsAfter), canonical(draft.content.permissions.filter(p => p.actions.length)),
      "TA_AUDIT_EXACT_SERVER_RESOLVED_PERMISSIONS");
    check(audits.every(row => !JSON.stringify(row.details).includes(response.json.credentials?.password || "impossible-secret-marker")),
      "TA_AUDITS_NEVER_CREDENTIALS");
    const project = data => Object.fromEntries(tables.map(table => [table, data[table].filter(row => {
      if (table === "users") return row.id !== accountId;
      if (["user_permissions", "user_permission_source_modes", "user_branch_access"].includes(table)) return row.user_id !== accountId;
      if (table === "branch_employees") return row.id !== id;
      if (table === "employee_job_template_assignments") return row.employee_id !== id;
      if (table === "system_audit_logs") return !audits.some(a => a.id === row.id);
      if (table === "portal_settings" && creation) return row.key !== selectionKey;
      return true;
    })]));
    equal(project(after), project(prior), "TA_NO_UNRELATED_ACCOUNT_OR_LEGACY_OR_TEMPLATE_WRITES");
    const row = after.branch_employees.find(e => e.id === id);
    const oldRow = prior.branch_employees.find(e => e.id === id);
    check(row.linked_user_id === accountId && row.job_title === oldRow.job_title, "TA_LINK_AND_JOB_TITLE_PERSISTED");
    if (!creation) equal(row, oldRow, "TA_LINKED_EMPLOYEE_ROW_NOT_REWRITTEN");
    const fresh = await preview(id);
    equal(fresh.assignment, response.json.assignment, "TA_GET_BINDING_MATCHES_WRITE");
    equal(canonical(fresh.currentPermissions), canonical(draft.content.permissions.filter(p => p.actions.length)), "TA_PREVIEW_AFTER_WRITE_MATCHES_ROWS");
    check(fresh.expectedAssignmentRevision !== response.json.assignment.revision
      && /^[a-f0-9]{64}$/.test(fresh.expectedAssignmentRevision), "TA_STATE_HASH_NOT_METADATA_REVISION");
    check(!("credentials" in fresh) && !("password" in fresh), "TA_GET_NEVER_CREDENTIALS");
    return account;
  };
  const assign = async (id, draft, cookie = manager, actorId = managerId, version = 1, creation = false) => {
    const current = await preview(id, cookie);
    const prior = await snapshot();
    const response = await call(`${base}/${id}/${creation ? "template-account" : "template-assignment"}`,
      bodyFor(draft, current, version), "TA_CONFIRMED_WRITE", creation ? 201 : 200, cookie);
    const account = await assertWrite(id, draft, response, prior, actorId, version, creation);
    return { response, account, current };
  };

  // Whole-transaction rollback includes linkage, generated account, direct mode,
  // binding and audit. Trigger exists only in the proved disposable DB.
  await guard.proveDatabase(client, target);
  await client.query(`CREATE FUNCTION public.isolated_ta_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.module='employee_account_delegation' AND NEW.action LIKE 'template_%' THEN
      RAISE EXCEPTION 'Synthetic phase4 audit failure' USING ERRCODE='23514';
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER isolated_ta_fail_audit BEFORE INSERT ON system_audit_logs
      FOR EACH ROW EXECUTE FUNCTION public.isolated_ta_fail_audit()`);
  try {
    await reject(route, bodyFor(ordinary, await preview()), "TA_REPLACE_AUDIT_FAILURE_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED");
    await reject(`${base}/${unlinked}/template-account`, bodyFor(empty, await preview(unlinked)),
      "TA_CREATE_AUDIT_FAILURE_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED");
  } finally {
    await client.query("DROP TRIGGER isolated_ta_fail_audit ON system_audit_logs; DROP FUNCTION public.isolated_ta_fail_audit()");
  }
  const first = await assign(linked, ordinary);
  await reject(route, bodyFor(empty, first.current), "TA_STALE_CONFIRMATION_NO_OVERWRITE", 409, "ASSIGNMENT_REVISION_CONFLICT");
  const old = await preview();
  // Admin's independent permission edit changes the hash even with unchanged binding.
  await call(`/api/users/${linkedId}/permissions`, { permissions: [grants[1]] },
    "TA_ADMIN_DIRECT_DRIFT", 200, admin, "PUT");
  const drift = await preview();
  check(drift.expectedAssignmentRevision !== old.expectedAssignmentRevision
    && drift.assignment.revision === old.assignment.revision, "TA_CURRENT_PERMISSIONS_BOUND_TO_HASH");
  await reject(route, bodyFor(ordinary, old), "TA_PERMISSION_DRIFT_NO_LOST_UPDATE", 409, "ASSIGNMENT_REVISION_CONFLICT");
  for (const [name, mutate, restore] of [
    ["SOURCE_MODE",
      () => client.query("UPDATE user_permission_source_modes SET source_mode='inherit' WHERE user_id=$1", [linkedId]),
      () => client.query("UPDATE user_permission_source_modes SET source_mode='direct' WHERE user_id=$1", [linkedId])],
    ["JOB_TITLE",
      () => client.query("UPDATE branch_employees SET job_title='worker' WHERE id=$1", [linked]),
      () => client.query("UPDATE branch_employees SET job_title='cashier' WHERE id=$1", [linked])],
    ["ACCOUNT_STATE",
      () => client.query("UPDATE users SET is_active='inactive' WHERE id=$1", [linkedId]),
      () => client.query("UPDATE users SET is_active='active' WHERE id=$1", [linkedId])],
  ]) {
    const beforeDrift = await preview();
    await guard.proveDatabase(client, target);
    await mutate();
    try {
      check((await preview()).expectedAssignmentRevision !== beforeDrift.expectedAssignmentRevision, `TA_HASH_BINDS_${name}`);
      await reject(route, bodyFor(empty, beforeDrift), `TA_${name}_DRIFT_NO_OVERWRITE`, 409, "ASSIGNMENT_REVISION_CONFLICT");
    } finally { await restore(); }
  }
  const cleared = await assign(linked, empty, admin, "isolated-fixture-admin");
  check(cleared.account.job_title === first.account.job_title, "TA_LINKED_REPLACE_NO_JOB_TITLE_CHANGE");
  equal((await preview()).currentPermissions, [], "TA_EMPTY_SELF_EXPLICIT_NO_INHERITED_ROWS");

  const created = await assign(unlinked, empty, manager, managerId, 1, true);
  const credentials = created.response.json.credentials;
  check(typeof credentials?.username === "string" && typeof credentials?.password === "string", "TA_CREATE_ONE_TIME_CREDENTIALS");
  check(created.account.password !== credentials.password && await bcrypt.compare(credentials.password, created.account.password),
    "TA_CREATED_PASSWORD_HASHED");
  const cookie = await loginCredentials(credentials);
  const identity = await call("/api/auth/me", undefined, "TA_CREATED_ACCOUNT_AUTHENTICATES", 200, cookie, "GET");
  check(identity.json.role === "employee" && identity.json.branchId === branch, "TA_CREATED_IDENTITY_BRANCH_ROLE");
  const mine = await call("/api/my-permissions", undefined, "TA_EMPTY_CREATED_PERMISSIONS_AUTHENTICATED", 200, cookie, "GET");
  equal(mine.json, [], "TA_EMPTY_CREATED_EFFECTIVE_PERMISSIONS_NO_INHERITANCE");
  await reject(`${base}/${unlinked}/template-account`, bodyFor(empty, await preview(unlinked)),
    "TA_REPEAT_CREATE_NO_NEW_CREDENTIALS", 409, "ACCOUNT_ALREADY_LINKED");
  await assign(unlinked, ordinary);
  await reject("/api/my-permissions", undefined, "TA_REPLACEMENT_REVOKES_OLD_EMPLOYEE_SESSION",
    401, null, cookie, "GET");
  const driver = await assign(delivery, courier, manager, managerId, 1, true);
  check(driver.account.job_title === "delivery", "TA_CREATION_COPIES_ONLY_PERSISTED_DELIVERY_TITLE");
  await reject(`${base}/${delivery}/template-assignment`, bodyFor(empty, await preview(delivery)),
    "TA_DELIVERY_INTRINSIC_REMOVAL_BLOCKED", 403, "INTRINSIC_AUTHORITY");
  // No driver other than the selected account may be changed by this assignment.
  await assign(delivery, courier);

  const pinned = await snapshot();
  await call(`${drafts}/${ordinary.id}/versions`, {
    expectedLatestVersion: 1, content: { ...ordinary.content, permissions: [grants[1]] },
    changeReason: "New draft must not automatically reapply",
  }, "TA_APPEND_NO_AUTO_REAPPLY", 201, admin);
  const afterDraft = await snapshot();
  for (const table of ["users", "user_permissions", "user_permission_source_modes", "employee_job_template_assignments",
    "user_assignments", "user_permission_overrides", "branch_employees"])
    equal(afterDraft[table], pinned[table], `TA_NEW_DRAFT_NO_EMPLOYEE_MUTATION_${table}`);
  equal(afterDraft.job_permission_template_draft_versions.filter(row => row.version === 1),
    pinned.job_permission_template_draft_versions.filter(row => row.version === 1), "TA_APPROVED_VERSION_CONTENT_IMMUTABLE");
  check(!(await catalog()).json.templates.some(t => t.templateId === ordinary.id), "TA_OLD_APPROVAL_NOT_LATEST_ELIGIBLE");
  await reject(route, bodyFor(ordinary, await preview()), "TA_OLD_APPROVED_VERSION_BLOCKED", 409, "STALE_TEMPLATE_VERSION");
  await reject(route, bodyFor(ordinary, await preview(), 2), "TA_NEW_UNAPPROVED_VERSION_BLOCKED", 409, "TEMPLATE_NOT_APPROVED");
  await call(`${drafts}/${ordinary.id}/approvals`, { version: 2, expectedLatestVersion: 2, reason: "New version review", reviewed: true },
    "TA_APPROVE_REPLACEMENT_VERSION", 201, admin);
  const revised = { ...ordinary, content: { ...ordinary.content, permissions: [grants[1]] } };
  await assign(linked, revised, manager, managerId, 2);
  const raced = await preview();
  const priorRace = await snapshot();
  const responses = await Promise.all([empty, revised].map(draft => request(route, {
    method: "POST", cookie: manager, body: bodyFor(draft, raced, draft === revised ? 2 : 1),
  })));
  equal(responses.map(r => r.status).sort(), [200, 409], "TA_CONCURRENT_CONFIRMATION_ONE_WINNER");
  check(responses.find(r => r.status === 409).json?.code === "ASSIGNMENT_REVISION_CONFLICT", "TA_CONCURRENT_LOSER_CONFLICT");
  const winner = responses.find(r => r.status === 200);
  const winningDraft = winner.json.assignment.templateId === empty.id ? empty : revised;
  await assertWrite(linked, winningDraft, winner, priorRace, managerId, winner.json.assignment.version);

  const approvalRaceState = await preview();
  const approvalRaceBefore = await snapshot();
  const approvalRace = await Promise.all([
    request(`${drafts}/${unapproved.id}/approvals`, { method: "POST", cookie: admin, body: {
      version: 1, expectedLatestVersion: 1, reason: "Concurrent explicit certification", reviewed: true,
    } }),
    request(route, { method: "POST", cookie: manager, body: bodyFor(unapproved, approvalRaceState) }),
  ]);
  check(approvalRace[0].status === 201 && [200, 409].includes(approvalRace[1].status), "TA_APPROVAL_ASSIGNMENT_RACE_SERIALIZED");
  const approvalRaceAfter = await snapshot();
  equal(approvalRaceAfter.job_permission_template_draft_versions, approvalRaceBefore.job_permission_template_draft_versions,
    "TA_APPROVAL_RACE_CONTENT_IMMUTABLE");
  const newApprovals = approvalRaceAfter.job_permission_template_approvals
    .filter(row => !approvalRaceBefore.job_permission_template_approvals.some(old => old.template_id === row.template_id && old.version === row.version));
  check(newApprovals.length === 1 && newApprovals[0].template_id === unapproved.id && newApprovals[0].version === 1,
    "TA_APPROVAL_RACE_EXACT_LATEST_CERTIFICATION");
  if (approvalRace[1].status === 200) {
    // Account verification baseline includes only the independently committed
    // approval and its audit, never the assignment's writes.
    const baseline = { ...approvalRaceBefore,
      job_permission_template_approvals: approvalRaceAfter.job_permission_template_approvals,
      system_audit_logs: approvalRaceAfter.system_audit_logs.filter(row =>
        approvalRaceBefore.system_audit_logs.some(old => old.id === row.id)
        || row.module === "job_template_drafts" && row.action === "approve_content" && row.entity_id === String(unapproved.id)),
    };
    await assertWrite(linked, unapproved, approvalRace[1], baseline, managerId);
  } else {
    check(approvalRace[1].json?.code === "TEMPLATE_NOT_APPROVED", "TA_APPROVAL_RACE_LOSER_MUST_REFRESH_CONFIRM");
    for (const table of tables.filter(table => !["job_permission_template_approvals", "system_audit_logs"].includes(table)))
      equal(approvalRaceAfter[table], approvalRaceBefore[table], `TA_APPROVAL_RACE_REJECT_NO_WRITE_${table}`);
  }

  // Deterministic races, not timing guesses: wait until the real HTTP transaction
  // is blocked behind our owned fixture lock, commit a legacy writer's change,
  // then prove it is re-read and cannot be overwritten by stale confirmation.
  const blockedWrite = async (lock, mutate, submitted, code, status, errorCode) => {
    await guard.proveDatabase(client, target);
    await client.query("BEGIN");
    let pending;
    try {
      await client.query(lock);
      pending = request(route, { method: "POST", cookie: manager, body: submitted });
      let waiting = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        waiting = (await client.query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a
          WHERE a.datname=current_database() AND a.pid<>pg_backend_pid()
            AND pg_backend_pid()=ANY(pg_blocking_pids(a.pid))) AS waiting`)).rows[0].waiting;
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      check(waiting, `${code}_ACTUAL_LOCK_WAITER`);
      await mutate();
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (pending) await pending.catch(() => {});
      throw error;
    }
    const changed = await snapshot();
    const result = await pending;
    check(result.status === status && result.json?.code === errorCode, code);
    equal(await snapshot(), changed, `${code}_NO_LOST_UPDATE_OR_PARTIAL_WRITE`);
  };
  await blockedWrite("LOCK TABLE portal_settings IN SHARE ROW EXCLUSIVE MODE",
    () => client.query("UPDATE portal_settings SET value=$2 WHERE key=$1",
      [policyKey, JSON.stringify({ enabled: false, permissions: grants })]),
    bodyFor(empty, await preview()), "TA_POLICY_WITHDRAWAL_RACE", 403, "DELEGATION_DISABLED");
  await policy();
  await blockedWrite("LOCK TABLE user_branch_access IN SHARE ROW EXCLUSIVE MODE",
    () => client.query("UPDATE user_branch_access SET access_level='view_only' WHERE user_id=$1 AND branch_id=$2",
      [managerId, branch]),
    bodyFor(empty, await preview()), "TA_BRANCH_WITHDRAWAL_RACE", 403, "BRANCH_FORBIDDEN");
  await client.query("UPDATE user_branch_access SET access_level='limited' WHERE user_id=$1 AND branch_id=$2", [managerId, branch]);
  await blockedWrite(`SELECT id FROM job_permission_template_drafts WHERE id=${ordinary.id} FOR UPDATE`,
    () => client.query(`INSERT INTO job_permission_template_draft_versions
      (template_id,version,content,change_reason,created_by)
      VALUES ($1,3,$2,'Owned concurrent fixture append','isolated-fixture-admin')`,
    [ordinary.id, { ...ordinary.content, permissions: [grants[1]] }]),
    bodyFor(revised, await preview(), 2), "TA_LATEST_APPROVAL_APPEND_RACE", 409, "STALE_TEMPLATE_VERSION");
  // The approval itself is still required after a race: no old certification
  // may authorize the now-latest content.
  await reject(route, bodyFor(revised, await preview(), 3), "TA_RACED_NEW_VERSION_UNAPPROVED",
    409, "TEMPLATE_NOT_APPROVED");

  await policy(false);
  check((await catalog()).json.templates.length === 0, "TA_DISABLED_POLICY_NO_TEMPLATE_CHOICES");
  await reject(route, bodyFor(empty, await preview()), "TA_DISABLED_POLICY_WRITE_BLOCKED", 403, "DELEGATION_DISABLED");
  await policy(true, [grants[1]]);
  await reject(route, bodyFor(courier, await preview()), "TA_DELIVERY_TITLE_REQUIRED", 403);
  await call(`/api/users/${linkedId}/permissions`, { permissions: [grants[0], grants[1]] },
    "TA_OUTSIDE_NARROWED_POLICY_FIXTURE", 200, admin, "PUT");
  // Explicit synthetic legacy fixture, not a stale binding bypass.
  await client.query("DELETE FROM employee_job_template_assignments WHERE employee_id=$1", [linked]);
  const addition = await makeDraft("not_reduction", [{ module: "maintenance", actions: ["view", "edit"] }]);
  await policy(true, [{ module: "maintenance", actions: ["view", "edit"] }]);
  await call(route, bodyFor(addition, await preview()), "TA_APPROVED_TEMPLATE_INDEPENDENT_OF_RAW_CEILING", 200);
  await assign(linked, empty);
  await policy();
  await client.query("UPDATE user_branch_access SET access_level='full' WHERE user_id=$1 AND branch_id=$2", [managerId, branch]);
  // Separate limiter window for legacy-path anti-bypass certification. The
  // backend retains raw admin setup, but ops can only preserve/reduce *effective*
  // current authority, never bypass immutable approved-template assignment.
  await new Promise(resolve => setTimeout(resolve, 61000));
  await guard.proveDatabase(client, target);
  const rawPath = `${base}/${linked}/permissions`;
  const rawSuccess = async (id, permissions, code, cookie = manager) => {
    const before = await snapshot();
    const result = await call(`${base}/${id}/permissions`, { permissions }, code, 200, cookie, "PUT");
    const after = await snapshot();
    const accountId = result.json.employee.account.id;
    equal(canonical(after.user_permissions.filter(row => row.user_id === accountId)),
      canonical(permissions), `${code}_EXACT_DIRECT_ROWS`);
    check(after.user_permission_source_modes.find(row => row.user_id === accountId)?.source_mode === "direct",
      `${code}_DIRECT_MODE`);
    const audits = after.system_audit_logs.filter(row => !before.system_audit_logs.some(old => old.id === row.id));
    check(audits.length === 1 && audits.every(row => row.action === "permissions_update"
      && row.user_id === (cookie === admin ? "isolated-fixture-admin" : managerId)
      && row.entity_id === String(id) && row.target_id === accountId
      && row.module === "employee_account_delegation"), `${code}_AUDIT_ACTOR_EMPLOYEE_TARGET`);
    const oldBinding = before.employee_job_template_assignments.find(row => row.employee_id === id);
    const newBinding = after.employee_job_template_assignments.find(row => row.employee_id === id);
    if (oldBinding && !newBinding) {
      const detach = audits.filter(row => {
        const details = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
        return row.action === "permissions_update" && details.removedTemplateBinding;
      });
      check(detach.length === 1, `${code}_BINDING_DETACH_AUDIT_EXACT_ONCE`);
      const details = typeof detach[0].details === "string" ? JSON.parse(detach[0].details) : detach[0].details;
      equal(details.removedTemplateBinding, {
        templateId: oldBinding.template_id, version: oldBinding.version, branchId: oldBinding.branch_id,
        revision: oldBinding.revision, assignedAt: new Date(oldBinding.assigned_at).toISOString(),
        assignedBy: oldBinding.assigned_by, reason: oldBinding.reason,
      }, `${code}_DETACH_AUDIT_PRESERVES_EXACT_PROVENANCE`);
      check(typeof details.reason === "string" && details.reason.length > 0, `${code}_DETACH_AUDIT_REASON`);
    } else if (oldBinding && newBinding) {
      equal(newBinding, oldBinding, `${code}_EQUAL_SAVE_PRESERVES_BINDING`);
    }
    const project = data => Object.fromEntries(tables.map(table => [table, data[table].filter(row => {
      if (["user_permissions", "user_permission_source_modes"].includes(table)) return row.user_id !== accountId;
      if (table === "employee_job_template_assignments") return row.employee_id !== id;
      if (table === "system_audit_logs") return !audits.some(a => a.id === row.id);
      return true;
    })]));
    equal(project(after), project(before), `${code}_NO_UNRELATED_OR_CREDENTIAL_OR_HISTORY_MUTATION`);
    return { result, oldBinding, newBinding, audits };
  };
  const rawGrant = [grants[0]];
  await assign(linked, unapproved);
  await reject(rawPath, { permissions: [...rawGrant, grants[1]] }, "TA_RAW_BOUND_ADDITION_BLOCKED",
    403, "REDUCTION_ONLY", manager, "PUT");
  await reject(rawPath, { permissions: [grants[1]] }, "TA_RAW_BOUND_EXCHANGE_BLOCKED",
    403, "REDUCTION_ONLY", manager, "PUT");
  await rawSuccess(linked, rawGrant, "TA_RAW_BOUND_EQUAL_ALLOWED");
  // Refresh/reconfirm the approved binding independently of equal-save metadata
  // policy so the next assertion specifically proves a genuine reduction detach.
  await assign(linked, unapproved);
  const reduction = [{ module: "cashier_journal", actions: ["view"] }];
  const beforeDetach = await preview();
  const rollbackSession = await loginCredentials(created.response.json.credentials);
  await guard.proveDatabase(client, target);
  await client.query(`CREATE FUNCTION public.isolated_ta_fail_detach() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.module='employee_account_delegation' AND NEW.action='permissions_update'
      AND NEW.details::jsonb->'removedTemplateBinding' IS NOT NULL
      AND NEW.details::jsonb->'removedTemplateBinding' <> 'null'::jsonb THEN
      RAISE EXCEPTION 'Synthetic binding detach audit failure' USING ERRCODE='23514';
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER isolated_ta_fail_detach BEFORE INSERT ON system_audit_logs
      FOR EACH ROW EXECUTE FUNCTION public.isolated_ta_fail_detach()`);
  try {
    await reject(rawPath, { permissions: reduction }, "TA_RAW_DETACH_AUDIT_FAILURE_WHOLE_ROLLBACK",
      500, "ACCOUNT_OPERATION_FAILED", manager, "PUT");
    equal((await preview()).assignment, beforeDetach.assignment, "TA_RAW_FAILED_DETACH_RETAINS_BINDING");
    await reject(`${base}/${unlinked}/permissions`, { permissions: reduction },
      "TA_RAW_DETACH_AUDIT_FAILURE_SESSION_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED", manager, "PUT");
    const retainedSession = await call("/api/my-permissions", undefined,
      "TA_RAW_FAILED_DETACH_AUTHENTICATED_SESSION_RETAINED", 200, rollbackSession, "GET");
    equal(canonical(retainedSession.json), canonical(rawGrant), "TA_RAW_FAILED_DETACH_EFFECTIVE_GRANTS_RETAINED");
  } finally {
    await client.query("DROP TRIGGER isolated_ta_fail_detach ON system_audit_logs; DROP FUNCTION public.isolated_ta_fail_detach()");
  }
  const reduced = await rawSuccess(linked, reduction, "TA_RAW_BOUND_REDUCTION_ALLOWED");
  check(reduced.oldBinding && !reduced.newBinding, "TA_RAW_TRUE_REDUCTION_REMOVES_STALE_BINDING");
  check((await preview()).assignment === null, "TA_RAW_DETACHED_GET_NO_FALSE_TEMPLATE_PROVENANCE");
  await reject(route, bodyFor(empty, beforeDetach), "TA_RAW_DETACH_INVALIDATES_OLD_TEMPLATE_CONFIRMATION",
    409, "ASSIGNMENT_REVISION_CONFLICT");
  await reject(rawPath, { permissions: rawGrant }, "TA_RAW_UNBOUND_ADDITION_BLOCKED",
    403, "REDUCTION_ONLY", manager, "PUT");
  await reject(rawPath, { permissions: [grants[1]] }, "TA_RAW_UNBOUND_EXCHANGE_BLOCKED",
    403, "REDUCTION_ONLY", manager, "PUT");
  await rawSuccess(linked, reduction, "TA_RAW_UNBOUND_EQUAL_ALLOWED");
  await rawSuccess(linked, [], "TA_RAW_UNBOUND_EMPTY_REDUCTION_ALLOWED");
  await rawSuccess(linked, [grants[1]], "TA_RAW_ADMIN_SETUP_UNCHANGED", admin);
  await client.query("UPDATE user_permission_source_modes SET source_mode='inherit' WHERE user_id=$1", [linkedId]);
  check((await preview()).currentPermissions.length === 0, "TA_RAW_EXPLICIT_INHERIT_EFFECTIVE_BASE_EMPTY");
  await reject(rawPath, { permissions: [grants[1]] }, "TA_RAW_INHERIT_CANNOT_RESURRECT_DORMANT_DIRECT",
    403, "REDUCTION_ONLY", manager, "PUT");
  await rawSuccess(linked, [], "TA_RAW_INHERIT_EMPTY_REDUCTION_ALLOWED");
  await reject(`${base}/${delivery}/permissions`, { permissions: [{ module: "delivery_tasks", actions: ["view"] }] },
    "TA_RAW_DELIVERY_INTRINSIC_GUARD_RETAINED", 403, "INTRINSIC_AUTHORITY", manager, "PUT");
  await rawSuccess(delivery, [grants[2]], "TA_RAW_DELIVERY_EFFECTIVE_EQUAL_ALLOWED");
  await rawSuccess(linked, [grants[1]], "TA_RAW_ADMIN_GRANT_FOR_WITHDRAWAL_FIXTURE", admin);
  await policy(false);
  await rawSuccess(linked, [grants[1]], "TA_RAW_DISABLED_POLICY_EQUAL_ALLOWED");
  await rawSuccess(linked, [], "TA_RAW_DISABLED_POLICY_REDUCTION_ALLOWED");
  await reject(rawPath, { permissions: [grants[1]] }, "TA_RAW_DISABLED_POLICY_NO_ADDITION",
    403, "REDUCTION_ONLY", manager, "PUT");
  await policy();
  console.log("Approved-template assignment HTTP checks passed: authoritative latest approval; opaque state hash; direct replacement; protected legacy data; one-time safe creation; concurrency and whole audit rollback.");
}