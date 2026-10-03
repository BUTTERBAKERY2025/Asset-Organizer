import assert from "node:assert/strict";
import guard from "../scripts/isolated-test/target.cjs";

export async function runTemplatePilotSmoke({ client, request, admin, manager, employee, credentials, loginCredentials, check }) {
  const target = guard.assertRuntime();
  await guard.proveDatabase(client, target);
  const A = "isolated-fixture-a", B = "isolated-fixture-b", id = 900001, userId = "isolated-fixture-employee";
  const root = `/api/admin/employee-template-pilot/${id}`;
  const additions = `/api/admin/employee-account-additions/${id}`;
  const policy = [{ module: "cashier_journal", actions: ["view", "edit"] },
    { module: "maintenance", actions: ["view"] }, { module: "quality_control", actions: ["view"] },
    { module: "delivery_tasks", actions: ["view", "edit"] }];
  const call = async (path, body, code, status = 200, cookie = admin, method = "POST") => {
    const response = await request(path, { cookie, method, ...(body === undefined ? {} : { body }) });
    check(response.status === status, code); return response;
  };
  const tables = ["users", "branch_employees", "user_permissions", "user_permission_source_modes", "user_assignments",
    "user_branch_access", "user_permission_overrides", "employee_account_additions",
    "employee_job_template_assignments", "portal_settings", "system_audit_logs", "sessions"];
  const state = async () => {
    const rows = {};
    for (const table of tables) rows[table] = (await client.query(
      `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM "${table}" t`,
    )).rows[0].rows;
    // Ordinary request/session tracking is not authority. Generation tombstones
    // ARE authority and must remain identical on rejected/readonly operations.
    rows.sessions = rows.sessions.filter(r => r.sid.startsWith("__local_auth_generation__:"));
    return rows;
  };
  const equal = (a,b,code) => { assert.deepEqual(a,b,code); check(true,code); };
  const reject = async (path, body, code, status, error, cookie = admin, method = "POST") => {
    const before = await state();
    const response = await call(path, body, code, status, cookie, method);
    if (error) check(response.json.code === error, `${code}_ERROR`);
    equal(await state(), before, `${code}_NO_AUTHORITY_MUTATION`);
    return response;
  };
  await call("/api/admin/employee-account-policy", { enabled: true, permissions: policy }, "TP_POLICY", 200, admin, "PUT");
  await call(`/api/operations/employee-accounts/${id}/permissions`,
    { permissions: [{ module: "cashier_journal", actions: ["view"] }] }, "TP_EXISTING_ACCOUNT_BASE_SETUP", 200, admin, "PUT");
  const content = { key: "isolated_phase6_cashier", name: "Synthetic explicitly reviewed pilot", description: "",
    reviewNotes: "Disposable comparison", scopeType: "branch", assignmentAuthority: "delegated_operations",
    permissions: [{ module: "cashier_journal", actions: ["view", "edit"] }] };
  const draft = await call("/api/rbac/job-template-drafts", { content }, "TP_DRAFT", 201);
  const templateId = draft.json.id;
  let currentVersion = 1;
  const approve = (tid, version) => call(`/api/rbac/job-template-drafts/${tid}/approvals`,
    { version, expectedLatestVersion: version, reason: "Explicit synthetic review", reviewed: true }, "TP_APPROVE", 201);
  await approve(templateId, 1);
  const preview = async (tid = templateId, version = currentVersion, employeeId = id) =>
    (await call(`/api/admin/employee-template-pilot/${employeeId}?templateId=${tid}&version=${version}`,
      undefined, "TP_PREVIEW", 200, admin, "GET")).json;
  const body = p => ({ templateId: p.templateId, version: p.version, branchId: p.branchId,
    reason: "Explicit single-account pilot after source review",
    expectedComparisonRevision: p.expectedComparisonRevision, acknowledgeChanges: true });
  const extraBody = { module: "maintenance", action: "view", allow: true, scopeType: "global", branchId: null,
    startsAt: null, endsAt: null, reason: "Independent explicitly global synthetic grant" };
  const add = async data => (await call(additions, data, "TP_ADD_INDEPENDENT", 201)).json.addition;
  const remove = row => call(`${additions}/${row.id}`, { reason: "Explicit synthetic removal", expectedRevision: row.revision },
    "TP_REMOVE_INDEPENDENT", 200, admin, "DELETE");
  const deny = await add({ ...extraBody, module: "cashier_journal", action: "edit", allow: false });
  const independent = await add(extraBody);
  const initialState = await state();
  const initial = await preview();
  equal(await state(), initialState, "TP_PREVIEW_READONLY_NO_PERMISSION_BINDING_AUDIT_SESSION_CHANGE");
  check(initial.canApply && initial.comparisonStatus === "known" && initial.scope.branchId === A, "TP_BOUND_CONTEXT_KNOWN");
  check(initial.before.sources.some(s => s.source === "override_deny" && s.action === "edit")
    && initial.differences.retainedDenies.length === 1, "TP_DENY_SOURCE_RETAINED");
  check(initial.before.effectivePermissions.some(p => p.module === "maintenance")
    && initial.after.effectivePermissions.some(p => p.module === "maintenance"), "TP_INDEPENDENT_GRANT_RETAINED");
  check(!initial.after.effectivePermissions.some(p => p.module === "cashier_journal" && p.actions.includes("edit")),
    "TP_PREDICTION_EXISTING_DENY_BEATS_REPLACED_BASE");
  equal((await preview()).expectedComparisonRevision, initial.expectedComparisonRevision, "TP_STABLE_TOKEN_WITHOUT_DECISION_CHANGE");
  await reject(`${root}?templateId=${templateId}&version=1`, undefined, "TP_MANAGER_PREVIEW_FORBIDDEN",
    403, "DELEGATION_FORBIDDEN", manager, "GET");
  // Initial setup/addition writes correctly revoke this same participant's
  // earlier session. Reauthenticate before checking real non-admin authority.
  const employeeCookie = await loginCredentials(credentials);
  await reject(root, body(initial), "TP_EMPLOYEE_APPLY_FORBIDDEN", 403, "DELEGATION_FORBIDDEN", employeeCookie);
  await reject(root, { ...body(initial), acknowledgeChanges: false }, "TP_ACK_REQUIRED", 400, "INVALID_INPUT");
  await reject(root, { ...body(initial), employeeIds: [id,900003] }, "TP_NO_BULK", 400, "INVALID_INPUT");
  await reject(root, { ...body(initial), branchId: B }, "TP_PERSISTED_BRANCH_NOT_CLAIMED", 403, "BRANCH_FORBIDDEN");
  const unlinked = await preview(templateId, 1, 900002);
  check(!unlinked.canApply && unlinked.blockedReasons.some(b => b.code === "ACCOUNT_NOT_LINKED")
    && unlinked.after === null, "TP_EXISTING_LINKED_ONLY_NO_CREATION");

  const before = await state();
  const applied = await call(root, body(initial), "TP_EXPLICIT_ONE_ACCOUNT_APPLY");
  const after = await state();
  for (const table of ["users", "branch_employees", "user_assignments", "user_branch_access", "user_permission_overrides",
    "employee_account_additions", "portal_settings"]) equal(after[table], before[table], `TP_${table}_PRESERVED`);
  for (const table of ["user_permissions", "user_permission_source_modes", "employee_job_template_assignments"]) {
    const isTarget = row => row.user_id === userId;
    equal(after[table].filter(r => !isTarget(r)), before[table].filter(r => !isTarget(r)), `TP_${table}_OTHER_ACCOUNTS_UNTOUCHED`);
  }
  check(applied.json.assignment.templateId === templateId && applied.json.employee.employeeId === id, "TP_EXACT_BOUND_ASSIGNMENT");
  const audits = after.system_audit_logs.filter(r => !before.system_audit_logs.some(old => old.id === r.id));
  check(audits.length === 3 && audits.every(a => a.user_id === "isolated-fixture-admin"
    && a.target_id === userId && a.entity_id === String(id)), "TP_EXACT_ACTOR_TARGET_AUDITS");
  const evidence = JSON.parse(audits.find(a => a.action === "pilot_apply").details);
  equal(evidence.before, initial.before, "TP_AUDIT_ACTUAL_REVIEWED_BEFORE_SOURCES");
  equal(evidence.after, initial.after, "TP_AUDIT_PREDICTED_AFTER_SOURCES");
  const generation = `__local_auth_generation__:${userId}`;
  equal(after.sessions.filter(r=>r.sid!==generation), before.sessions.filter(r=>r.sid!==generation),
    "TP_OTHER_ACCOUNT_SESSION_GENERATIONS_UNTOUCHED");
  check(after.sessions.find(r=>r.sid===generation).sess.localAuthGeneration !==
    before.sessions.find(r=>r.sid===generation).sess.localAuthGeneration, "TP_SELECTED_ACCOUNT_GENERATION_REVOKED");
  await reject(root, body(initial), "TP_REPLAY_STALE", 409, "COMPARISON_REVISION_CONFLICT");
  await call("/api/my-permissions", undefined, "TP_SELECTED_ACCOUNT_OLD_COOKIE_REVOKED", 401, employeeCookie, "GET");
  let cookie = await loginCredentials(credentials);
  const actual = await call("/api/my-permissions", undefined, "TP_ACTUAL_EFFECTIVE_HTTP", 200, cookie, "GET");
  const canonical = rows => rows.map(r => ({ module: r.module, actions: [...r.actions].sort() })).sort((a,b) => a.module.localeCompare(b.module));
  equal(canonical(actual.json), canonical(initial.after.effectivePermissions), "TP_PREDICTION_MATCHES_ACTUAL_RUNTIME");
  await call(`/api/maintenance-tickets/summary?branchId=${A}`, undefined, "TP_ACTUAL_INDEPENDENT_GRANT_ROUTE", 200, cookie, "GET");
  await call(`/api/cashier-journals?branchId=${A}`, undefined, "TP_ACTUAL_BASE_VIEW_ROUTE", 200, cookie, "GET");
  await call("/api/cashier-journals/900099", {}, "TP_ACTUAL_DENY_BEFORE_RESOURCE_LOOKUP", 403, cookie, "PATCH");

  // An independent second explicit review still affects only this same existing
  // participant. Prove actual additions/removals, not a deny-masked no-op.
  const secondContent = { ...content, name: "Synthetic explicit second single-account review",
    permissions: [{ module: "quality_control", actions: ["view"] }] };
  await call(`/api/rbac/job-template-drafts/${templateId}/versions`, {
    expectedLatestVersion: 1, content: secondContent, changeReason: "Explicit additions/removals review",
  }, "TP_SECOND_VERSION", 201);
  await approve(templateId, 2); currentVersion=2;
  const changed = await preview();
  equal(changed.differences.additions, [{ module:"quality_control",actions:["view"] }], "TP_EXPLICIT_EFFECTIVE_ADDITION");
  equal(changed.differences.removals, [{ module:"cashier_journal",actions:["view"] }], "TP_EXPLICIT_EFFECTIVE_REMOVAL");
  const extraRows = (await state()).user_permission_overrides;
  await call(root,body(changed),"TP_SECOND_EXPLICIT_SINGLE_EXISTING_ACCOUNT_APPLY");
  equal((await state()).user_permission_overrides,extraRows,"TP_SECOND_APPLY_RETAINS_ALL_INDEPENDENT_EXTRAS");
  cookie=await loginCredentials(credentials);
  equal(canonical((await call("/api/my-permissions",undefined,"TP_SECOND_RUNTIME_EFFECTIVE",200,cookie,"GET")).json),
    canonical(changed.after.effectivePermissions),"TP_SECOND_PREDICTION_ACTUAL_PARITY");
  await call(`/api/quality-checks?branchId=${A}`,undefined,"TP_ADDED_BASE_ACTUAL_ROUTE",200,cookie,"GET");
  await call(`/api/cashier-journals?branchId=${A}`,undefined,"TP_REMOVED_BASE_ACTUAL_ROUTE",403,cookie,"GET");

  for (const kind of ["start", "expiry"]) {
    const timed = await add({ ...extraBody, module: "cashier_journal",
      startsAt: new Date(Date.now() + (kind === "start" ? 1800 : -10000)).toISOString(),
      endsAt: kind === "expiry" ? new Date(Date.now() + 1800).toISOString() : null });
    const observed = await preview();
    check(observed.nextDecisionBoundary !== null && observed.before.sources.some(s =>
      s.module === "cashier_journal" && s.action === "view" && s.source === "override_grant"
        && s.temporalState === (kind === "start" ? "future" : "active")),
    `TP_${kind}_SOURCE_TEMPORAL_EVIDENCE`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await reject(root, body(observed), `TP_${kind}_BOUNDARY_STALE_NO_WRITE`, 409, "COMPARISON_REVISION_CONFLICT");
    await remove(timed);
  }
  const accountDrift = await preview();
  await client.query("UPDATE branch_employees SET job_title='worker' WHERE id=$1", [id]);
  await reject(root, body(accountDrift), "TP_EMPLOYEE_PROFILE_STALE", 409, "COMPARISON_REVISION_CONFLICT");
  await client.query("UPDATE branch_employees SET job_title='cashier' WHERE id=$1", [id]);
  for (const [kind, change, restore, code] of [
    ["branch", "branch_id='isolated-fixture-b'", "branch_id='isolated-fixture-a'", "EXTRA_BRANCH_AUTHORITY"],
    ["role", "role='admin'", "role='employee'", "PROTECTED_ACCOUNT"],
    ["job", "job_title='delivery'", "job_title=NULL", "INTRINSIC_AUTHORITY"],
    ["inactive", "is_active='inactive'", "is_active='active'", "ACCOUNT_INACTIVE"],
  ]) {
    await client.query(`UPDATE users SET ${change} WHERE id=$1`, [userId]);
    try {
      const blocked = await preview();
      check(!blocked.canApply && blocked.comparisonStatus === "unknown" && blocked.after === null
        && blocked.differences === null && blocked.blockedReasons.some(b => b.code === code), `TP_${kind}_HONEST_BLOCKED_UNKNOWN`);
      if (kind === "job") check(blocked.before.sources.some(s => s.source === "intrinsic"
        && s.module === "delivery_tasks" && s.allowed), "TP_DELIVERY_ACTUAL_INTRINSIC_SOURCE");
      await reject(root, body(blocked), `TP_${kind}_ADMIN_CANNOT_BYPASS_PILOT_GUARD`, 403, "PILOT_BLOCKED");
    } finally { await client.query(`UPDATE users SET ${restore} WHERE id=$1`, [userId]); }
  }
  const policyDrift = await preview();
  await call("/api/admin/employee-account-policy", { enabled: false, permissions: policy }, "TP_POLICY_DISABLE", 200, admin, "PUT");
  await reject(root, body(policyDrift), "TP_POLICY_STALE", 409, "COMPARISON_REVISION_CONFLICT");
  await call("/api/admin/employee-account-policy", { enabled: true, permissions: policy }, "TP_POLICY_RESTORE", 200, admin, "PUT");
  const extraDrift = await preview();
  const extraUpdate = (await call(`${additions}/${independent.id}`, { ...extraBody, reason: "Explicit changed source",
    expectedRevision: independent.revision }, "TP_EXTRA_UPDATE", 200, admin, "PATCH")).json.addition;
  await reject(root, body(extraDrift), "TP_EXTRA_SOURCE_STALE", 409, "COMPARISON_REVISION_CONFLICT");

  await guard.proveDatabase(client, target);
  await client.query(`CREATE FUNCTION public.isolated_tp_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='pilot_apply' THEN RAISE EXCEPTION 'Synthetic pilot audit failure' USING ERRCODE='23514';
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER isolated_tp_fail_audit BEFORE INSERT ON system_audit_logs
      FOR EACH ROW EXECUTE FUNCTION public.isolated_tp_fail_audit()`);
  try { await reject(root, body(await preview()), "TP_PILOT_AUDIT_WHOLE_ROLLBACK", 500, "ACCOUNT_OPERATION_FAILED"); }
  finally { await client.query("DROP TRIGGER isolated_tp_fail_audit ON system_audit_logs; DROP FUNCTION public.isolated_tp_fail_audit()"); }

  await guard.proveDatabase(client,target);
  await client.query(`CREATE FUNCTION public.isolated_tp_fail_session() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.sid='__local_auth_generation__:isolated-fixture-employee'
      THEN RAISE EXCEPTION 'Synthetic pilot session failure' USING ERRCODE='23514';
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER isolated_tp_fail_session BEFORE INSERT OR UPDATE ON sessions
      FOR EACH ROW EXECUTE FUNCTION public.isolated_tp_fail_session()`);
  try { await reject(root,body(await preview()),"TP_SESSION_INVALIDATION_WHOLE_ROLLBACK",500,"ACCOUNT_OPERATION_FAILED"); }
  finally { await client.query("DROP TRIGGER isolated_tp_fail_session ON sessions; DROP FUNCTION public.isolated_tp_fail_session()"); }

  const roleAssignment = (await client.query(`INSERT INTO user_assignments(user_id,role_id,scope_type,branch_id,is_active)
    VALUES ($1,900001,'branch',$2,true) RETURNING id`,[userId,A])).rows[0].id;
  try {
    const inherited = await preview();
    check(!inherited.canApply && inherited.after===null && inherited.blockedReasons.some(b=>b.code==="ELEVATED_ACCOUNT"),
      "TP_INHERITED_RBAC_PROTECTED_NO_CLAIMED_AFTER_PARITY");
    await reject(root,body(inherited),"TP_INHERITED_RBAC_ADMIN_PILOT_CANNOT_BYPASS",403,"PILOT_BLOCKED");
  } finally { await client.query("DELETE FROM user_assignments WHERE id=$1",[roleAssignment]); }

  const hr = await add({ ...extraBody, module: "hr_documents", scopeType: "branch", branchId: A });
  const permission = (await client.query("INSERT INTO permissions(module,action,name) VALUES ('hr_documents','delete','Synthetic other branch') RETURNING id")).rows[0].id;
  const legacy = (await client.query(`INSERT INTO user_permission_overrides(user_id,permission_id,allow,branch_id,reason,granted_by)
    VALUES ($1,$2,true,$3,'Unknown synthetic branch-B grant','isolated-fixture-admin') RETURNING id`, [userId, permission, B])).rows[0].id;
  const protectedCompare = await preview();
  check(!protectedCompare.canApply && protectedCompare.after === null && protectedCompare.comparisonStatus === "unknown",
    "TP_UNKNOWN_LEGACY_NOT_FALSE_FULL_PARITY");
  check(protectedCompare.before.effectivePermissions.some(p => p.module === "hr_documents" && p.actions.includes("view"))
    && !protectedCompare.before.effectivePermissions.some(p => p.module === "hr_documents" && p.actions.includes("delete")),
    "TP_CONTEXTUAL_HR_ACTION_BRANCH_PAIR_NOT_FLATTENED");
  check(protectedCompare.before.sources.some(s => s.module === "hr_documents" && s.branchId === B && !s.allowed),
    "TP_OUTSIDE_BRANCH_SOURCE_VISIBLE_NOT_GLOBAL_GRANT");
  await reject(root, body(protectedCompare), "TP_UNKNOWN_LEGACY_NO_PILOT_APPLICATION", 403, "PILOT_BLOCKED");
  await client.query("DELETE FROM user_permission_overrides WHERE id=$1", [legacy]);
  await remove(hr);
  const templateDrift = await preview();
  await call(`/api/rbac/job-template-drafts/${templateId}/versions`,
    { expectedLatestVersion: 2, content: { ...content, name: "Synthetic reviewed third version" },
      changeReason: "Explicit newer draft must not automatically migrate" }, "TP_TEMPLATE_APPEND", 201);
  await reject(root, body(templateDrift), "TP_LATEST_TEMPLATE_STALE", 409, "COMPARISON_REVISION_CONFLICT");
  const pending = await preview(templateId, 3);
  check(!pending.canApply && pending.blockedReasons.some(b => b.code === "TEMPLATE_NOT_APPROVED"), "TP_UNAPPROVED_LATEST_BLOCKED");
  const pinned = (await client.query("SELECT * FROM employee_job_template_assignments WHERE employee_id=$1",[id])).rows;
  await approve(templateId, 3);
  const fresh = await preview(templateId, 3);
  check(fresh.canApply, "TP_APPROVAL_RESTORES_PREVIEW_NOT_AUTO_APPLICATION");
  equal((await client.query("SELECT * FROM employee_job_template_assignments WHERE employee_id=$1",[id])).rows,pinned,
    "TP_NEW_APPROVAL_DOES_NOT_MIGRATE_EXISTING_ACCOUNT");
  await remove(extraUpdate);
  check((await client.query("SELECT allow FROM user_permission_overrides WHERE id=$1", [deny.id])).rows[0].allow === false,
    "TP_INDEPENDENT_DENY_SURVIVES_ALL_PILOT_CHECKS");
  const expandedContent = { ...content, key: "isolated_admin_cashier_expanded",
    permissions: [
      { module: "cashier_journal", actions: ["view", "create", "view_list"] },
      { module: "branch_complaints", actions: ["view", "create", "view_list", "view_details"] },
      ...["platform_home", "dashboard", "cashier", "cashier_performance", "incentives",
        "smart_incentives_challenges", "smart_incentives_commissions", "smart_incentives_bonus",
        "smart_incentives_wallet"].map(module => ({ module, actions: ["view", "view_list"] })),
    ] };
  const expanded = (await call("/api/rbac/job-template-drafts", { content: expandedContent }, "TP_ADMIN_EXPANDED_DRAFT", 201)).json.id;
  await approve(expanded, 1);
  const unsupported = (await call("/api/rbac/job-template-drafts", {
    content: { ...content, key: "isolated_admin_unsupported", permissions: [{ module: "users", actions: ["view"] }] },
  }, "TP_UNSUPPORTED_DRAFT", 201)).json.id;
  await approve(unsupported, 1);
  const catalogue = (await call("/api/admin/employee-template-pilot-catalog", undefined, "TP_ADMIN_ALL_APPROVED", 200, admin, "GET")).json;
  check([expanded, unsupported].every(tid => catalogue.templates.some(t => t.templateId === tid)), "TP_NO_SILENT_CATALOG_FILTER");
  await call("/api/admin/employee-template-pilot-catalog", undefined, "TP_MANAGER_NO_ADMIN_CATALOG", 403, manager, "GET");
  const delegated = (await call("/api/operations/employee-accounts/job-templates", undefined, "TP_OPS_CATALOG", 200, manager, "GET")).json;
  check(!delegated.templates.some(t => t.templateId === expanded), "TP_OPS_CEILING_UNCHANGED");
  const blocked = await preview(unsupported, 1);
  check(!blocked.canApply && blocked.blockedReasons.some(b => b.code === "ADMIN_TEMPLATE_PERMISSION_UNSUPPORTED"), "TP_EXPLICIT_UNSUPPORTED_REASON");
  await reject(root, body(blocked), "TP_UNSUPPORTED_WRITE_DENIED", 403, "PILOT_BLOCKED");
  const expandedPreview = await preview(expanded, 1);
  check(expandedPreview.canApply, "TP_EXPANDED_ADMIN_ELIGIBLE");
  await call(root, body(expandedPreview), "TP_EXPANDED_ADMIN_APPLY");
  const expandedAfter = await preview(expanded, 1);
  check(expandedAfter.canApply && expandedAfter.differences.additions.length === 0 && expandedAfter.differences.removals.length === 0,
    "TP_EXPANDED_ACCOUNT_REMAINS_REVIEWABLE");
  const stored = (await client.query("SELECT module,actions FROM user_permissions WHERE user_id=$1 ORDER BY module", [userId])).rows;
  equal(stored.map(p => ({ ...p, actions: [...p.actions].sort() })),
    [...expandedContent.permissions].sort((a,b)=>a.module.localeCompare(b.module)).map(p=>({...p,actions:[...p.actions].sort()})),
    "TP_ALL_CHOSEN_PERMISSIONS_PRESERVED");
  check((await client.query("SELECT allow FROM user_permission_overrides WHERE id=$1", [deny.id])).rows[0].allow === false,
    "TP_EXPANDED_PRESERVES_DENY");
  const expandedCookie = await loginCredentials(credentials);
  const actualPermissions = (await call("/api/my-permissions", undefined,
    "TP_EXPANDED_RUNTIME_READ", 200, expandedCookie, "GET")).json;
  check(expandedContent.permissions.every(p => actualPermissions.some(actual => actual.module === p.module
    && actual.actions.includes("view"))), "TP_EXPANDED_RUNTIME_HAS_EVERY_CHOSEN_MODULE");
}