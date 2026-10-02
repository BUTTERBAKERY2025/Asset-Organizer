// HTTP certification checks on the guarded runner's owned ephemeral cluster only.
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import guard from "../scripts/isolated-test/target.cjs";

export async function runJobTemplateApprovalSmoke({ client, request, admin, editor, manager, employee, check }) {
  await guard.proveDatabase(client, guard.assertRuntime());
  // Earlier smoke phases share this loopback IP. Respect the real 200/minute
  // API limiter rather than bypassing production middleware or retrying writes.
  await new Promise(resolve => setTimeout(resolve, 61000));
  const base = "/api/rbac/job-template-drafts";
  const tables = [
    "users", "user_permissions", "user_permission_source_modes", "user_assignments",
    "user_permission_overrides", "user_branch_access", "roles", "permissions", "role_permissions", "role_templates",
  ];
  const catalogTables = (await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  )).rows.map(row => row.tablename);
  const protectedTables = [...new Set([
    ...tables, ...catalogTables.filter(table => /employee_account|branch_employees/.test(table)),
  ])];
  const snapshot = async () => {
    const data = {};
    for (const table of protectedTables) {
      data[table] = (await client.query(
        `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows FROM "${table}" t`,
      )).rows[0].rows;
    }
    return data;
  };
  const before = await snapshot();
  const unchanged = async code => {
    assert.deepEqual(await snapshot(), before, code);
    check(true, code);
  };
  const storageSnapshot = async () => (await client.query(`SELECT
    (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY template_id,version), '[]'::jsonb)
      FROM job_permission_template_approvals t) AS approvals,
    (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY template_id,version), '[]'::jsonb)
      FROM job_permission_template_draft_versions t) AS versions,
    (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id), '[]'::jsonb)
      FROM system_audit_logs t WHERE module LIKE 'job_template%') AS audits
  `)).rows[0];
  const post = async (route, body, code, status = 201, cookie = admin) => {
    const response = await request(route, { method: "POST", cookie, body });
    check(response.status === status, code);
    await unchanged(`${code}_NO_ACCOUNT_OR_LEGACY_WRITES`);
    return response;
  };
  const rejected = async (route, body, code, status = 400, error = "invalid_request", cookie = admin) => {
    const prior = await storageSnapshot();
    const response = await post(route, body, code, status, cookie);
    if (error) check(response.json?.error === error && typeof response.json?.message === "string", `${code}_ERROR`);
    assert.deepEqual(await storageSnapshot(), prior, `${code}_NO_APPROVAL_VERSION_OR_AUDIT`);
    check(true, `${code}_NO_APPROVAL_VERSION_OR_AUDIT`);
  };
  const content = {
    key: "isolated_approval_http", name: "Synthetic approval draft", description: "Disposable certification fixture",
    scopeType: "self", assignmentAuthority: "admin", permissions: [], reviewNotes: "Not employee authority",
  };
  const created = await post(base, { content }, "JTA_CREATE_EMPTY_DRAFT");
  const id = created.json.id;
  const route = `${base}/${id}/approvals`;
  check(Array.isArray(created.json.approvals) && created.json.approvals.length === 0,
    "JTA_NO_AUTO_APPROVAL_ON_CREATE");
  const versionOne = structuredClone(created.json.versions[0]);
  const approvalBody = {
    version: 1, expectedLatestVersion: 1, reason: "  Explicit content review  ",
    reviewed: true, acknowledgeEmptyPermissions: true,
  };
  await rejected(route, approvalBody, "JTA_ANONYMOUS_DENIED", 401, null, null);
  for (const [role, cookie] of [["editor", editor], ["manager", manager], ["employee", employee]]) {
    await rejected(route, approvalBody, `JTA_${role}_ADMIN_ONLY`, 403, null, cookie);
  }
  for (const [name, body] of [
    ["MISSING_REASON", { version: 1, expectedLatestVersion: 1, reviewed: true, acknowledgeEmptyPermissions: true }],
    ["BLANK_REASON", { ...approvalBody, reason: " \t " }],
    ["LONG_REASON", { ...approvalBody, reason: "a".repeat(2001) }],
    ["MISSING_REVIEWED", { version: 1, expectedLatestVersion: 1, reason: "Review", acknowledgeEmptyPermissions: true }],
    ["REVIEWED_FALSE", { ...approvalBody, reviewed: false }],
    ["UNKNOWN_KEY", { ...approvalBody, apply: true }],
    ["NONINTEGER_VERSION", { ...approvalBody, version: 1.5 }],
    ["ZERO_EXPECTED", { ...approvalBody, expectedLatestVersion: 0 }],
    ["FALSE_ACKNOWLEDGEMENT", { ...approvalBody, acknowledgeEmptyPermissions: false }],
  ]) await rejected(route, body, `JTA_VALIDATION_${name}`);
  await rejected(route, {
    version: 1, expectedLatestVersion: 1, reason: "Review", reviewed: true,
  }, "JTA_EMPTY_ACK_REQUIRED", 400, "empty_permissions_acknowledgement_required");
  await rejected(route, { ...approvalBody, expectedLatestVersion: 2 }, "JTA_STALE_EXPECTATION", 409, "stale_version");
  await rejected(route, { ...approvalBody, version: 2 }, "JTA_NOT_LATEST_SELECTED", 409, "stale_version");
  await rejected(`${base}/2147483647/approvals`, approvalBody, "JTA_UNKNOWN_TEMPLATE", 404, "not_found");

  // Audit insert failure must roll back the certification itself, too.
  await guard.proveDatabase(client, guard.assertRuntime());
  await client.query(`CREATE FUNCTION public.isolated_jta_fail_audit() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.module LIKE 'job_template%' THEN
        RAISE EXCEPTION 'Synthetic approval audit failure' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER isolated_jta_fail_audit BEFORE INSERT ON system_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.isolated_jta_fail_audit()`);
  try {
    await rejected(route, approvalBody, "JTA_FAILED_AUDIT_ROLLBACK", 500, "draft_storage_error");
  } finally {
    await client.query("DROP TRIGGER isolated_jta_fail_audit ON system_audit_logs; DROP FUNCTION public.isolated_jta_fail_audit()");
  }
  const approved = await post(route, approvalBody, "JTA_ADMIN_APPROVAL_CONTROL");
  check(approved.json.approvals.length === 1 && approved.json.approvals[0].version === 1
    && approved.json.approvals[0].approvedBy === "isolated-fixture-admin"
    && approved.json.approvals[0].reason === approvalBody.reason.trim()
    && Number.isFinite(Date.parse(approved.json.approvals[0].approvedAt)), "JTA_APPROVAL_METADATA");
  assert.deepEqual(approved.json.versions, [versionOne], "JTA_APPROVAL_DOES_NOT_CHANGE_CONTENT");
  check(true, "JTA_APPROVAL_DOES_NOT_CHANGE_CONTENT");
  const firstApproval = structuredClone(approved.json.approvals[0]);
  const firstRow = (await client.query(
    "SELECT * FROM job_permission_template_approvals WHERE template_id=$1 AND version=1", [id],
  )).rows[0];
  check(firstRow.reviewed === true && firstRow.acknowledge_empty_permissions === true,
    "JTA_ACKNOWLEDGEMENT_AND_REVIEW_PERSISTED");
  const summary = (await request(base, { cookie: admin })).json.find(row => row.id === id);
  check(summary.latestVersionApproved === true && summary.status === "draft", "JTA_APPROVED_IS_STILL_DRAFT");
  await rejected(route, approvalBody, "JTA_ALREADY_APPROVED", 409, "already_approved");

  const catalog = (await request(`${base}/catalog`, { cookie: admin })).json;
  const module = catalog.modules.find(row => row.actions.includes("view"));
  const versionTwoContent = { ...content, permissions: [{ module: module.id, actions: ["view"] }] };
  const appended = await post(`${base}/${id}/versions`, {
    expectedLatestVersion: 1, content: versionTwoContent, changeReason: "Review grants separately",
  }, "JTA_NEW_DRAFT_AFTER_APPROVAL");
  assert.deepEqual(appended.json.approvals, [firstApproval], "JTA_OLD_APPROVAL_SURVIVES_APPEND");
  assert.deepEqual(appended.json.versions[0], versionOne, "JTA_OLD_APPROVED_CONTENT_IMMUTABLE");
  check(true, "JTA_OLD_APPROVAL_AND_CONTENT_SURVIVE_APPEND");
  const afterAppend = (await request(base, { cookie: admin })).json.find(row => row.id === id);
  check(afterAppend.latestVersion === 2 && afterAppend.latestVersionApproved === false
    && afterAppend.status === "draft", "JTA_NEW_LATEST_UNAPPROVED");
  await rejected(route, { ...approvalBody, expectedLatestVersion: 2 }, "JTA_OLD_VERSION_CANNOT_BE_APPROVED", 409, "stale_version");
  await rejected(route, { ...approvalBody, version: 2 }, "JTA_OLD_EXPECTATION_CANNOT_APPROVE_NEW", 409, "stale_version");
  const priorRace = await storageSnapshot();
  const bodyTwo = { version: 2, expectedLatestVersion: 2, reason: "Review version two grants", reviewed: true };
  const race = await Promise.all([1, 2].map(() => request(route, {
    method: "POST", cookie: admin, body: bodyTwo,
  })));
  assert.deepEqual(race.map(row => row.status).sort(), [201, 409], "JTA_CONCURRENT_ONE_WINNER");
  check(true, "JTA_CONCURRENT_ONE_WINNER");
  check(race.find(row => row.status === 409).json?.error === "already_approved", "JTA_CONCURRENT_LOSER_ALREADY_APPROVED");
  const afterRace = await storageSnapshot();
  check(afterRace.approvals.length === priorRace.approvals.length + 1
    && afterRace.audits.length === priorRace.audits.length + 1, "JTA_CONCURRENT_EXACT_ONE_APPROVAL_ONE_AUDIT");
  assert.deepEqual(afterRace.versions, priorRace.versions, "JTA_CONCURRENT_NO_CONTENT_MUTATION");
  check(true, "JTA_CONCURRENT_NO_CONTENT_MUTATION");
  await unchanged("JTA_CONCURRENT_NO_ACCOUNT_OR_LEGACY_WRITES");
  await rejected(route, bodyTwo, "JTA_REPEAT_NONEMPTY_APPROVAL", 409, "already_approved");
  const final = await request(`${base}/${id}`, { cookie: admin });
  check(final.status === 200 && final.json.approvals.map(row => row.version).join(",") === "1,2",
    "JTA_APPROVAL_HISTORY_ASCENDING");
  assert.deepEqual(final.json.approvals[0], firstApproval, "JTA_OLD_APPROVAL_EXACT_IMMUTABILITY");
  assert.deepEqual(final.json.versions, appended.json.versions, "JTA_ALL_VERSION_CONTENT_UNCHANGED");
  check(true, "JTA_HISTORY_AND_CONTENT_IMMUTABLE");
  const audits = (await client.query(
    "SELECT action,details,user_id FROM system_audit_logs WHERE module LIKE 'job_template%' AND entity_id=$1 ORDER BY id", [String(id)],
  )).rows;
  check(audits.length === 4, "JTA_TWO_VERSIONS_TWO_APPROVAL_AUDITS");
  const certificationAudits = audits.filter(row => row.action === "approve_content");
  check(certificationAudits.length === 2 && certificationAudits.every(row => row.user_id === "isolated-fixture-admin"),
    "JTA_APPROVAL_AUDIT_ACTOR_EXACT_ONCE");
  for (const version of final.json.versions) {
    const audit = certificationAudits.find(row => {
      const details = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
      const approval = final.json.approvals.find(item => item.version === version.version);
      return details.version === version.version && details.reason === approval.reason
        && details.reviewed === true && details.effectiveAuthority === false
        && details.acknowledgeEmptyPermissions === (version.version === 1)
        && isDeepStrictEqual(details.content, version.content);
    });
    check(!!audit, `JTA_VERSION_${version.version}_AUDIT_CERTIFIES_EXACT_IMMUTABLE_CONTENT`);
  }
  // Nonempty module list with no actions is still zero grants.
  const zeroActions = await post(base, {
    content: { ...content, key: "isolated_approval_zero_actions", permissions: [{ module: module.id, actions: [] }] },
  }, "JTA_CREATE_ZERO_ACTIONS");
  const zeroRoute = `${base}/${zeroActions.json.id}/approvals`;
  await rejected(zeroRoute, {
    version: 1, expectedLatestVersion: 1, reason: "No actions", reviewed: true,
  }, "JTA_ZERO_ACTIONS_ACK_REQUIRED", 400, "empty_permissions_acknowledgement_required");
  await post(zeroRoute, { ...approvalBody, reason: "Explicit zero-action acknowledgement" }, "JTA_ZERO_ACTIONS_ACK_CONTROL");
  for (const suffix of [`/${id}/activate`, `/${id}/assign`, `/${id}/apply`]) {
    await rejected(base + suffix, {}, `JTA_NO_AUTHORITY_ENDPOINT_${suffix}`, 404, null);
  }
  await unchanged("JTA_ALL_WRITES_NO_ACCOUNTS_DIRECT_ASSIGNMENTS_OVERRIDES_OR_LEGACY");
  console.log("Job-template approval HTTP checks passed: latest-only explicit certification; concurrent winner; audit rollback; immutable historical approval; no effective authority changes.");
}