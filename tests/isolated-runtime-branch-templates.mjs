import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import guard from "../scripts/isolated-test/target.cjs";
const target = guard.assertRuntime();
const origin = `http://127.0.0.1:${target.appPort}`;
const file = path.join(path.dirname(process.env.ISOLATED_TEST_REGISTRY), "credentials.json");
assert.equal((await stat(file)).mode & 0o077, 0);
const { accounts } = JSON.parse(await readFile(file, "utf8"));
const client = new pg.Client({ connectionString: target.url, ssl: false });
let count = 0;
const check = (condition, name) => { assert.ok(condition, name); count++; };
async function request(route, { method = "GET", cookie, body } = {}) {
  const response = await fetch(origin + route, {
    method, headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch {}
  return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0], json };
}
async function login(id) {
  const account = accounts.find(a => a.id === `isolated-fixture-${id}`);
  const response = await request("/api/auth/login", { method: "POST", body: { username: account.username, password: account.password } });
  check(response.status === 200 && response.cookie, "BT_LOGIN"); return response.cookie;
}
try {
  await client.connect();
  await guard.proveDatabase(client, target);
  await client.query(await readFile("migrations/056_branch_employee_template_assignments.sql", "utf8"));
  // The offline baseline predates carrier metadata used by the delivery workspace.
  // This migration is applied only to the same ownership-attested test connection.
  for (const migration of ["kitchen_warehouse_product_shipping.sql", "delivery_assignments.sql",
    "delivery_source_extension.sql", "delivery_handover_reverse.sql", "delivery_external_carriers.sql"])
    await client.query(await readFile(`migrations/${migration}`, "utf8"));
  const A = "isolated-fixture-a", B = "isolated-fixture-b", user = "isolated-fixture-employee";
  await client.query(`INSERT INTO user_branch_access(user_id,branch_id,access_level,is_default)
    VALUES ($1,$2,'full',true),($1,$3,'full',false);
    `.replace(/;\s*$/, ""), [user, A, B]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'cashier_journal',ARRAY['view','create'])`, [user]);
  await client.query(`INSERT INTO cashier_points_ledger
    (cashier_id,branch_id,transaction_date,points_type,points_earned,point_value,amount_earned,status)
    VALUES ($1,$2,'2026-10-03','branch_bonus',8,1,8,'earned'),
      ($1,$3,'2026-10-03','branch_bonus',900,1,900,'earned')`, [user, A, B]);
  const unchanged = (await client.query("SELECT module,actions FROM user_permissions WHERE user_id=$1 ORDER BY module", [user])).rows;
  await client.query(`INSERT INTO central_kitchen_orders
    (id,order_number,request_branch_id,central_kitchen_id,order_date,idempotency_key,payload_fingerprint,created_by)
    VALUES (900001,'SYNTHETIC-A',$1,$2,'2026-10-03','synthetic-a',repeat('a',64),$3),
      (900002,'SYNTHETIC-B',$2,$1,'2026-10-03','synthetic-b',repeat('b',64),$3)`, [A, B, user]);
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try { if ((await request("/api/health")).status === 200) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  check(ready, "BT_READY");
  const admin = await login("admin"), manager = await login("manager");
  let employee = await login("employee");
  const policy = await request("/api/admin/employee-account-policy", { method: "PUT", cookie: admin,
    body: { enabled: true, permissions: [{ module: "cashier_journal", actions: ["view", "create"] }] } });
  check(policy.status === 200, `BT_POLICY_${policy.status}`);
  const draft = await request("/api/rbac/job-template-drafts", { method: "POST", cookie: admin, body: { content: {
    key: "isolated_branch_base", name: "Isolated branch base", description: "Synthetic", reviewNotes: "Isolation",
    scopeType: "branch", assignmentAuthority: "delegated_operations",
    permissions: ["branch_workforce", "branch_supply", "central_kitchen_orders", "maintenance", "branch_complaints", "quality_control", "cashier_performance", "platform_home", "dashboard", "cashier", "incentives",
      "smart_incentives_challenges", "smart_incentives_commissions", "smart_incentives_bonus", "smart_incentives_wallet"]
      .map(module => ({ module, actions: ["branch_workforce", "branch_supply", "central_kitchen_orders", "maintenance", "branch_complaints"].includes(module) ? ["view", "create", "edit"] : ["view"] })),
  } } });
  check(draft.status === 201, `BT_DRAFT_${draft.status}`);
  const approved = await request(`/api/rbac/job-template-drafts/${draft.json.id}/approvals`, { method: "POST", cookie: admin,
    body: { version: 1, expectedLatestVersion: 1, reason: "Synthetic review", reviewed: true } });
  check(approved.status === 201, `BT_APPROVAL_${approved.status}`);
  const url = "/api/operations/employee-accounts/900001/branch-template";
  const preview = await request(url, { cookie: manager });
  check(preview.status === 200, `BT_PREVIEW_${preview.status}`);
  const template = preview.json.templates.find(t => t.templateId === draft.json.id);
  check(template, "BT_TEMPLATE_INCLUDED");
  const body = { templateId: template.templateId, version: template.version, branchId: A,
    reason: "Synthetic isolated review", expectedAssignmentRevision: preview.json.expectedAssignmentRevision };
  check((await request(url, { method: "POST", cookie: manager, body: { ...body, branchId: B } })).status === 403, "BT_FOREIGN_BRANCH");
  const saved = await request(url, { method: "POST", cookie: manager, body });
  check(saved.status === 200, `BT_SAVE_${saved.status}_${saved.json?.code}`);
  check((await request(url, { method: "POST", cookie: manager, body })).status === 409, "BT_STALE_REVIEW");
  check((await request("/api/cashier-journals?branchId=" + A, { cookie: employee })).status === 401, "BT_SESSION_REVOKED");
  employee = await login("employee");
  check((await request("/api/cashier-journals?branchId=" + A, { cookie: employee })).status === 403, "BT_A_REMOVED");
  check((await request("/api/cashier-journals?branchId=" + B, { cookie: employee })).status === 200, "BT_B_PRESERVED");
  check((await request("/api/quality-checks?branchId=" + A, { cookie: employee })).status === 200, "BT_A_ADDED");
  check((await request("/api/quality-checks?branchId=" + B, { cookie: employee })).status === 403, "BT_B_NO_NEW_GRANT");
  const summary = await request(`/api/smart-incentives/points-summary/${user}?yearMonth=2026-10`, { cookie: employee });
  check(summary.status === 200 && summary.json.totalPoints === 8 && summary.json.totalAmount === 8, "BT_POINTS_SCOPE_BEFORE_SUM");
  const ledger = await request(`/api/smart-incentives/points-ledger?cashierId=${user}`, { cookie: employee });
  check(ledger.status === 200 && ledger.json.length === 1 && ledger.json[0].branchId === A, "BT_LEDGER_FILTER");
  check((await request(`/api/smart-incentives/points-ledger?branchId=${B}`, { cookie: employee })).status === 403, "BT_FOREIGN_LEDGER");
  for (const route of ["/api/cashier-performance-sales", "/api/smart-incentives/challenges",
    "/api/smart-incentives/product-commissions", "/api/smart-incentives/branch-bonus"]) {
    const response = await request(`${route}?branchId=${A}`, { cookie: employee });
    check(response.status === 200, `BT_EXTENDED_READ_${route}_${response.status}`);
  }
  const second = await request(url, { cookie: manager });
  for (const root of ["/api/warehouse/items", "/api/warehouse/material-transfers", "/api/central-kitchen-orders",
    "/api/shift-management/bundle"]) {
    const result = await request(`${root}?branchId=${A}&startDate=2026-10-01&endDate=2026-10-07`, { cookie: employee });
    check(result.status === 200, `BT_OPERATIONS_${root}_${result.status}`);
    if (root === "/api/central-kitchen-orders") {
      check(JSON.stringify(result.json).includes("SYNTHETIC-A") && !JSON.stringify(result.json).includes("SYNTHETIC-B"), "BT_KITCHEN_ROWS_FILTER");
    }
  }
  check((await request("/api/central-kitchen-orders/900002?branchId=" + A, { cookie: employee })).status === 403, "BT_KITCHEN_PERSISTED_BRANCH");
  check((await request(`/api/shift-management/bundle?branchId=${B}&startDate=2026-10-01&endDate=2026-10-07`, { cookie: employee })).status === 403, "BT_WORKFORCE_FOREIGN");
  for (const root of ["/api/maintenance-tickets", "/api/branch-complaints"]) {
    const payload = root.includes("maintenance")
      ? { branchId: A, description: "Synthetic scoped maintenance" }
      : { branchId: A, subject: "Synthetic scoped complaint", description: "Synthetic scoped complaint", category: "other" };
    const created = await request(root, { method: "POST", cookie: employee, body: payload });
    check(created.status === 201, `BT_CREATE_${root}_${created.status}`);
    check((await request(`${root}/${created.json.id}`, { cookie: employee })).status === 200, `BT_DETAIL_${root}`);
    check((await request(root, { method: "POST", cookie: employee, body: { ...payload, branchId: B } })).status === 403,
      `BT_FOREIGN_CREATE_${root}`);
    const foreign = await request(root, { method: "POST", cookie: admin, body: { ...payload, branchId: B } });
    check(foreign.status === 201, `BT_FIXTURE_${root}`);
    check((await request(`${root}/${foreign.json.id}?branchId=${A}`, { cookie: employee })).status === 403,
      `BT_PERSISTED_OWNER_${root}`);
  }
  const nextBody = { ...body, expectedAssignmentRevision: second.json.expectedAssignmentRevision };
  const concurrent = await Promise.all([request(url, { method: "POST", cookie: manager, body: nextBody }),
    request(url, { method: "POST", cookie: manager, body: nextBody })]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]); count++;
  const stable = await request(url, { cookie: manager });
  await client.query(`CREATE FUNCTION isolated_reject_branch_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action = 'branch_template_assignment' THEN RAISE EXCEPTION 'Synthetic atomic rollback'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER isolated_reject_branch_audit BEFORE INSERT ON system_audit_logs
    FOR EACH ROW EXECUTE FUNCTION isolated_reject_branch_audit();`);
  const failed = await request(url, { method: "POST", cookie: manager,
    body: { ...body, expectedAssignmentRevision: stable.json.expectedAssignmentRevision } });
  check(failed.status === 500, "BT_AUDIT_FAILURE");
  const afterRollback = await request(url, { cookie: manager });
  check(afterRollback.json.assignment.revision === stable.json.assignment.revision, "BT_ATOMIC_ROLLBACK");
  await client.query("DROP TRIGGER isolated_reject_branch_audit ON system_audit_logs; DROP FUNCTION isolated_reject_branch_audit()");
  const driverDraft = await request("/api/rbac/job-template-drafts", { method: "POST", cookie: admin, body: { content: {
    key: "isolated_driver_base", name: "Synthetic driver", description: "Assigned task identity",
    reviewNotes: "No identity mutation", scopeType: "assigned_tasks", assignmentAuthority: "delegated_operations",
    permissions: [{ module: "delivery_tasks", actions: ["view", "edit"] }],
  } } });
  check(driverDraft.status === 201, "BT_DRIVER_TEMPLATE");
  check((await request(`/api/rbac/job-template-drafts/${driverDraft.json.id}/approvals`, { method: "POST", cookie: admin,
    body: { version: 1, expectedLatestVersion: 1, reason: "Synthetic driver review", reviewed: true } })).status === 201, "BT_DRIVER_APPROVED");
  const notDriver = await request(url, { cookie: manager });
  check(!notDriver.json.templates.some(t => t.templateId === driverDraft.json.id), "BT_DRIVER_IDENTITY_REQUIRED");
  const driverIdentity = await request(`/api/users/${user}`, { method: "PATCH", cookie: admin, body: { jobTitle: "delivery" } });
  check(driverIdentity.status === 200, `BT_DRIVER_IDENTITY_${driverIdentity.status}`);
  const driverPreview = await request(url, { cookie: manager });
  check(driverPreview.json.templates.some(t => t.templateId === driverDraft.json.id), "BT_DRIVER_ELIGIBLE");
  const driverSave = await request(url, { method: "POST", cookie: manager, body: {
    templateId: driverDraft.json.id, version: 1, branchId: A, reason: "Synthetic driver branch",
    expectedAssignmentRevision: driverPreview.json.expectedAssignmentRevision,
  } });
  check(driverSave.status === 200, "BT_DRIVER_SAVED");
  employee = await login("employee");
  const ownTasks = await request("/api/deliveries/workspace", { cookie: employee });
  check(ownTasks.status === 200, `BT_DRIVER_OWN_TASKS_${ownTasks.status}_${ownTasks.json?.error ?? ownTasks.json?.message ?? "no_message"}`);
  check((await request("/api/deliveries/reports", { cookie: employee })).status === 403, "BT_DRIVER_NO_MANAGEMENT");
  await client.query(`DELETE FROM user_branch_access WHERE user_id='isolated-fixture-manager'`);
  check((await request(url, { cookie: manager })).status === 403, "BT_MANAGER_WITHDRAWN");
  assert.deepEqual((await client.query("SELECT module,actions FROM user_permissions WHERE user_id=$1 ORDER BY module", [user])).rows, unchanged);
  check((await client.query("SELECT count(*)::int n FROM branch_employee_template_assignments WHERE user_id=$1", [user])).rows[0].n === 1, "BT_ONE_BRANCH_BINDING");
  console.log(`Branch template isolated HTTP/DB verification passed: ${count} assertions; original permissions unchanged.`);
} catch (error) {
  console.error(`Branch template isolated test failed: ${/^BT_/.test(error.message) ? error.message : guard.safeReason(error)}`);
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }