// Real HTTP only; called by the guarded runner against its owned disposable DB.
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import guard from "../scripts/isolated-test/target.cjs";

export async function runJobTemplateSmoke({ client, request, admin, editor, manager, employee, check }) {
  await guard.proveDatabase(client, guard.assertRuntime());
  const base = "/api/rbac/job-template-drafts";
  const tables = [
    "users", "user_permissions", "user_permission_source_modes", "user_assignments",
    "user_permission_overrides", "user_branch_access", "roles", "permissions",
    "role_permissions", "role_templates", "employee_account_managers",
  ];
  // Account manager table naming is deliberately discovered only on the proved DB.
  const existing = (await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  )).rows.map(row => row.tablename);
  const protectedTables = [...new Set([
    ...tables.filter(table => existing.includes(table)),
    ...existing.filter(table => /employee_account|branch_employees/.test(table)),
  ])];
  const snapshot = async () => {
    const result = {};
    for (const table of protectedTables) {
      result[table] = (await client.query(
        `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows FROM "${table}" t`,
      )).rows[0].rows;
    }
    return result;
  };
  const before = await snapshot();
  const unchanged = async code => {
    assert.deepEqual(await snapshot(), before, code);
    check(true, code);
  };
  const write = async (suffix, body, code, status = 201, cookie = admin) => {
    const result = await request(base + suffix, { method: "POST", cookie, body });
    check(result.status === status, code);
    await unchanged(`${code}_NO_ACCOUNT_OR_LEGACY_MUTATION`);
    return result;
  };
  const persisted = async () => (await client.query(`
    SELECT
      (SELECT count(*)::int FROM job_permission_template_drafts) AS drafts,
      (SELECT count(*)::int FROM job_permission_template_draft_versions) AS versions,
      (SELECT count(*)::int FROM system_audit_logs WHERE module='job_template_drafts') AS audits
  `)).rows[0];
  const reject = async (suffix, body, code, status = 400, error = "invalid_request") => {
    const prior = await persisted();
    const result = await write(suffix, body, code, status);
    check(result.json?.error === error && typeof result.json?.message === "string",
      `${code}_ERROR_CONTRACT`);
    assert.deepEqual(await persisted(), prior, `${code}_NO_DRAFT_OR_AUDIT`);
    check(true, `${code}_NO_DRAFT_OR_AUDIT`);
  };
  const catalog = await request(`${base}/catalog`, { cookie: admin });
  check(catalog.status === 200 && catalog.json?.modules?.length > 0
    && catalog.json?.proposals?.length === 9, "JT_ADMIN_CATALOG_NINE_PROPOSALS");
  check(catalog.json.modules.every(module => typeof module.id === "string"
    && typeof module.label === "string" && Array.isArray(module.actions)), "JT_CATALOG_VOCABULARY");
  const initial = await request(base, { cookie: admin });
  check(initial.status === 200 && initial.json?.length === 0, "JT_EMPTY_LIST_NO_STARTUP_SEED");
  assert.deepEqual(await persisted(), { drafts: 0, versions: 0, audits: 0 }, "JT_CATALOG_NO_WRITES");
  check(true, "JT_CATALOG_NO_WRITES");
  check((await request(base)).status === 401, "JT_ANONYMOUS_DENIED");
  const content = {
    key: "isolated_http_draft", name: "Synthetic HTTP draft", description: "Disposable integration fixture",
    scopeType: "self", assignmentAuthority: "admin", permissions: [], reviewNotes: "Draft only",
  };
  for (const [role, cookie] of [["editor", editor], ["manager", manager], ["employee", employee]]) {
    for (const suffix of ["", "/catalog", "/1"]) {
      check((await request(base + suffix, { cookie })).status === 403, `JT_${role}_GET_${suffix || "LIST"}_DENIED`);
    }
    for (const [suffix, body] of [
      ["", { content }], ["/seed-proposals", {}],
      ["/1/versions", { expectedLatestVersion: 1, content, changeReason: "Denied" }],
    ]) {
      await write(suffix, body, `JT_${role}_POST_${suffix || "CREATE"}_DENIED`, 403, cookie);
    }
  }
  assert.deepEqual(await persisted(), { drafts: 0, versions: 0, audits: 0 }, "JT_DENIALS_NO_WRITES");
  check(true, "JT_DENIALS_NO_WRITES");

  // Force audit insertion failure only in this owned, guarded disposable cluster.
  // The test-only trigger is always removed; no application schema source changes.
  await guard.proveDatabase(client, guard.assertRuntime());
  const installAuditFailure = () => client.query(`CREATE FUNCTION public.isolated_jt_fail_audit() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.module = 'job_template_drafts' THEN
        RAISE EXCEPTION 'Synthetic audit failure' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER isolated_jt_fail_audit BEFORE INSERT ON system_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.isolated_jt_fail_audit()`);
  const removeAuditFailure = () => client.query(
    "DROP TRIGGER isolated_jt_fail_audit ON system_audit_logs; DROP FUNCTION public.isolated_jt_fail_audit()",
  );
  await installAuditFailure();
  try {
    await reject("", { content }, "JT_AUDIT_FAILURE_CREATE_ROLLBACK", 500, "draft_storage_error");
    await reject("/seed-proposals", {}, "JT_AUDIT_FAILURE_SEED_ROLLBACK", 500, "draft_storage_error");
  } finally {
    await removeAuditFailure();
  }

  const seed = await write("/seed-proposals", {}, "JT_EXPLICIT_SEED_NINE", 200);
  check(seed.json.length === 9 && seed.json.every(row => row.latestVersion === 1 && row.status === "draft"),
    "JT_SEED_ALL_VERSION_ONE_DRAFT");
  const seededState = await persisted();
  assert.deepEqual(seededState, { drafts: 9, versions: 9, audits: 9 }, "JT_SEED_EXACT_PERSISTENCE_AND_AUDIT");
  check(true, "JT_SEED_EXACT_PERSISTENCE_AND_AUDIT");
  const reseed = await write("/seed-proposals", {}, "JT_SEED_IDEMPOTENT", 200);
  assert.deepEqual(reseed.json, seed.json, "JT_SEED_SAME_IDS");
  assert.deepEqual(await persisted(), seededState, "JT_RESEED_NO_EXTRA_AUDIT");
  check(true, "JT_SEED_SAME_IDS_AND_NO_EXTRA_AUDIT");
  for (const proposal of catalog.json.proposals) {
    const summary = seed.json.find(row => row.key === proposal.key);
    check(summary && summary.permissionCount === proposal.permissions.reduce((n, p) => n + p.actions.length, 0),
      `JT_${proposal.key}_GRANT_COUNT`);
    const detail = await request(`${base}/${summary.id}`, { cookie: admin });
    check(detail.status === 200 && detail.json.versions.length === 1, `JT_${proposal.key}_DETAIL`);
    assert.deepEqual(detail.json.versions[0].content, proposal, `JT_${proposal.key}_EXACT_CONTENT`);
    check(true, `JT_${proposal.key}_EXACT_CONTENT`);
  }
  for (const key of ["barista", "worker"]) {
    const summary = seed.json.find(row => row.key === key);
    check(summary.scopeType === "self" && summary.permissionCount === 0, `JT_${key}_EMPTY_SELF`);
  }
  const created = await write("", { content }, "JT_CREATE_EMPTY_SELF");
  const id = created.json.id;
  check(Number.isInteger(id) && created.json.versions.length === 1
    && created.json.versions[0].status === "draft"
    && created.json.versions[0].createdBy === "isolated-fixture-admin", "JT_CREATE_VERSION_METADATA");
  const versionOne = structuredClone(created.json.versions[0]);
  assert.deepEqual(versionOne.content, content, "JT_CREATE_CONTENT");
  check(true, "JT_CREATE_CONTENT");
  const module = catalog.json.modules.find(row => row.actions.includes("view"));
  const versionTwoContent = {
    ...content, name: "Synthetic revised draft", scopeType: "branch",
    permissions: [{ module: module.id, actions: ["view"] }],
  };
  const versionBody = { expectedLatestVersion: 1, content: versionTwoContent, changeReason: "Explicit review revision" };
  await guard.proveDatabase(client, guard.assertRuntime());
  await installAuditFailure();
  try {
    await reject(`/${id}/versions`, versionBody, "JT_AUDIT_FAILURE_APPEND_ROLLBACK", 500, "draft_storage_error");
  } finally {
    await removeAuditFailure();
  }
  const appended = await write(`/${id}/versions`, versionBody, "JT_APPEND_VERSION_TWO");
  check(appended.json.versions.length === 2 && appended.json.versions[1].version === 2
    && appended.json.versions[1].changeReason === versionBody.changeReason, "JT_APPEND_METADATA");
  assert.deepEqual(appended.json.versions[0], versionOne, "JT_PREVIOUS_VERSION_IMMUTABLE");
  assert.deepEqual(appended.json.versions[1].content, versionTwoContent, "JT_APPEND_CONTENT");
  check(true, "JT_PREVIOUS_VERSION_IMMUTABLE_AND_NEW_CONTENT");
  await reject(`/${id}/versions`, versionBody, "JT_STALE_VERSION_409", 409, "stale_version");
  await reject("", { content }, "JT_DUPLICATE_KEY_409", 409, "key_conflict");
  await reject(`/${id}/versions`, {
    ...versionBody, expectedLatestVersion: 2, content: { ...content, key: "changed_key" },
  }, "JT_KEY_IMMUTABLE");
  for (const [label, body] of [
    ["UNKNOWN_MODULE", { content: { ...content, key: "invalid_module", permissions: [{ module: "not_a_module", actions: ["view"] }] } }],
    ["UNKNOWN_ACTION", { content: { ...content, key: "invalid_action", permissions: [{ module: module.id, actions: ["approve_templates"] }] } }],
    ["TOP_UNKNOWN_KEY", { content: { ...content, key: "invalid_top" }, activate: true }],
    ["CONTENT_UNKNOWN_KEY", { content: { ...content, key: "invalid_content", employeeId: 900001 } }],
    ["PERMISSION_UNKNOWN_KEY", { content: { ...content, key: "invalid_permission", permissions: [{ module: module.id, actions: ["view"], branchId: "isolated-fixture-a" }] } }],
    ["DUPLICATE_ACTION", { content: { ...content, key: "invalid_duplicate_action", permissions: [{ module: module.id, actions: ["view", "view"] }] } }],
    ["DUPLICATE_MODULE", { content: { ...content, key: "invalid_duplicate_module", permissions: [{ module: module.id, actions: ["view"] }, { module: module.id, actions: [] }] } }],
  ]) await reject("", body, `JT_VALIDATION_${label}`);
  await reject("/seed-proposals", { apply: true }, "JT_SEED_UNKNOWN_KEY");
  await reject(`/${id}/versions`, { ...versionBody, expectedLatestVersion: 2, approve: true }, "JT_VERSION_UNKNOWN_KEY");
  await reject(`/${id}/versions`, { ...versionBody, expectedLatestVersion: 2, changeReason: "" }, "JT_VERSION_REASON_REQUIRED");

  const priorRace = await persisted();
  const race = await Promise.all(["A", "B"].map(label => request(`${base}/${id}/versions`, {
    method: "POST", cookie: admin,
    body: { expectedLatestVersion: 2, content: { ...versionTwoContent, name: `Concurrent ${label}` }, changeReason: `Concurrent ${label}` },
  })));
  assert.deepEqual(race.map(row => row.status).sort(), [201, 409], "JT_CONCURRENT_VERSION_ONE_WINNER");
  check(true, "JT_CONCURRENT_VERSION_ONE_WINNER");
  check(race.find(row => row.status === 409).json?.error === "stale_version", "JT_CONCURRENT_LOSER_STALE");
  assert.deepEqual(await persisted(), {
    drafts: priorRace.drafts, versions: priorRace.versions + 1, audits: priorRace.audits + 1,
  }, "JT_CONCURRENT_EXACT_ONE_VERSION_AND_AUDIT");
  check(true, "JT_CONCURRENT_EXACT_ONE_VERSION_AND_AUDIT");
  await unchanged("JT_CONCURRENT_NO_ACCOUNT_OR_LEGACY_MUTATION");
  const final = await request(`${base}/${id}`, { cookie: admin });
  check(final.status === 200 && final.json.versions.map(row => row.version).join(",") === "1,2,3",
    "JT_VERSIONS_ASCENDING_NO_GAPS");
  assert.deepEqual(final.json.versions.slice(0, 2), appended.json.versions, "JT_RACE_PREVIOUS_VERSIONS_UNCHANGED");
  check(true, "JT_RACE_PREVIOUS_VERSIONS_UNCHANGED");
  for (const suffix of [`/${id}/approve`, `/${id}/activate`, `/${id}/assign`, `/${id}/apply`, "/approve", "/apply"]) {
    const prior = await persisted();
    await write(suffix, {}, `JT_NO_APPLICATION_ENDPOINT_${suffix}`, 404);
    assert.deepEqual(await persisted(), prior, "JT_NO_APPLICATION_ENDPOINT_NO_AUDIT");
  }
  const audits = (await client.query(`
    SELECT v.template_id, v.version, v.content, v.created_by,
      a.action, a.details, a.user_id
    FROM job_permission_template_draft_versions v
    LEFT JOIN system_audit_logs a ON a.module='job_template_drafts'
      AND a.entity_id=v.template_id::text AND (a.details::jsonb->>'version')::int=v.version
    ORDER BY v.template_id, v.version
  `)).rows;
  const state = await persisted();
  check(audits.length === state.versions && state.audits === state.versions, "JT_EVERY_VERSION_EXACTLY_ONE_AUDIT");
  check(audits.every(row => {
    const details = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
    return row.user_id === row.created_by && row.action === (row.version === 1 ? "create" : "append_version")
      && details?.status === "draft" && isDeepStrictEqual(details.content, row.content);
  }), "JT_AUDIT_ACTOR_ACTION_EXACT_CONTENT_DRAFT");
  await unchanged("JT_ALL_WRITES_NO_ACCOUNTS_PERMISSIONS_ASSIGNMENTS_OVERRIDES_OR_LEGACY_MUTATION");
  console.log("Job-template real HTTP checks passed: explicit nine-proposal idempotent seed; immutable versions; concurrent winner; audit rollback; no account or legacy writes.");
}