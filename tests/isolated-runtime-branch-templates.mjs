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
  // Canonical employee belongs to A, while the linked account's old default is B.
  // Explicit branch binding must work without rewriting that account default.
  await client.query("UPDATE users SET branch_id=$2 WHERE id=$1", [user, B]);
  await client.query(`INSERT INTO user_branch_access(user_id,branch_id,access_level,is_default)
    VALUES ($1,$2,'full',true),($1,$3,'full',false);
    `.replace(/;\s*$/, ""), [user, A, B]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'cashier_journal',ARRAY['view','create'])`, [user]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'cashier_performance',ARRAY['view'])`, [user]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'warehouse',ARRAY['view'])`, [user]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'event_pos',ARRAY['view','create','edit'])`, [user]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'sales',ARRAY['view','create']),($1,'shifts',ARRAY['view'])`, [user]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'production',ARRAY['view','edit']),($1,'daily_closures',ARRAY['view','delete','approve'])`, [user]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'attendance',ARRAY['view','create','edit']),
      ($1,'branch_employees',ARRAY['view','create','edit'])`, [user]);
  await client.query(`INSERT INTO branch_employees
    (id,branch_id,employee_name,job_title,nationality,salary,status)
    VALUES (900011,$1,'Synthetic HR A','cashier','Saudi',1,'active'),
      (900012,$2,'Synthetic HR B','cashier','Saudi',1,'active')`, [A, B]);
  await client.query(`INSERT INTO attendance_records
    (id,employee_id,branch_employee_id,employee_name,branch_id,attendance_date,status)
    VALUES (900011,'branch_emp_900011',900011,'Synthetic HR A',$1,'2026-10-03','present'),
      (900012,'branch_emp_900012',900012,'Synthetic HR B',$2,'2026-10-03','present'),
      (900013,'branch_emp_900012',900012,'Synthetic HR B',$1,'2026-10-02','present')`, [A, B]);
  await client.query(`INSERT INTO attendance_records
    (employee_id,employee_name,branch_id,attendance_date,status)
    VALUES ($1,'Synthetic monthly',$2,'2026-10-01','present'),
      ($1,'Synthetic monthly',$3,'2026-10-02','present')`, [user, A, B]);
  await client.query(`INSERT INTO attendance_summary
    (employee_id,employee_name,branch_id,period_month,total_present_days)
    VALUES ($1,'Synthetic monthly',$2,'2026-10',2)`, [user, B]);
  await client.query(`INSERT INTO daily_production_batches
    (id,branch_id,product_name,quantity,destination,status)
    VALUES (900001,$1,'Synthetic A',1,'display_bar','in_progress'),
      (900002,$2,'Synthetic B',1,'display_bar','in_progress')`, [A, B]);
  await client.query(`INSERT INTO branch_daily_closures (id,branch_id,closure_date,total_sales)
    VALUES (900001,$1,'2026-10-03',900),(900002,$2,'2026-10-03',7)`, [A, B]);
  await client.query(`INSERT INTO shift_performance_tracking
    (branch_id,shift_type,tracking_date,total_sales)
    VALUES ($1,'morning','2026-10-03',900),($2,'morning','2026-10-03',7)`, [A, B]);
  await client.query(`INSERT INTO user_permissions(user_id,module,actions)
    VALUES ($1,'smart_incentives_commissions',ARRAY['view','create','edit'])`, [user]);
  await client.query(`INSERT INTO product_commissions
    (id,product_name,commission_type,branch_id,target_quantity,points_on_target,valid_from)
    VALUES (900001,'Synthetic A','weekly_product',$1,1,2,'2020-01-01'),
      (900002,'Synthetic B','weekly_product',$2,1,2,'2020-01-01')`, [A, B]);
  await client.query(`INSERT INTO material_transfers
    (id,transfer_number,source_type,source_branch_id,destination_branch_id,transfer_date)
    VALUES (900001,'SYNTHETIC-OUTSIDE-WAREHOUSE','branch',$2,$1,'2026-10-03'),
      (900002,'SYNTHETIC-RESTRICTED-WAREHOUSE','branch',$1,$1,'2026-10-03')`, [A, B]);
  await client.query(`INSERT INTO average_ticket_targets
    (id,branch_id,target_type,target_value,valid_from) VALUES
    (900001,$1,'branch',10,'2020-01-01'),(900002,$2,'branch',20,'2020-01-01')`, [A, B]);
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await client.query(`INSERT INTO cashier_sales_journals
    (branch_id,cashier_id,cashier_name,journal_date,total_sales)
    VALUES ($1,$3,'Synthetic',$4,900),($2,$3,'Synthetic',$4,7)`, [A, B, user, today]);
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
    permissions: ["branch_stock", "branch_workforce", "branch_supply", "central_kitchen_orders", "maintenance", "branch_complaints", "quality_control", "cashier_performance", "platform_home", "dashboard", "cashier", "incentives",
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
  const branchUiA = await request("/api/my-permissions?branchId=" + A, { cookie: employee });
  const branchUiB = await request("/api/my-permissions?branchId=" + B, { cookie: employee });
  check(branchUiA.status === 200 && branchUiA.json.some(p => p.module === "branch_supply")
    && !branchUiA.json.some(p => p.module === "warehouse"), "BT_UI_BRANCH_A_AUTHORITY");
  check(branchUiB.status === 200 && branchUiB.json.some(p => p.module === "warehouse")
    && !branchUiB.json.some(p => p.module === "branch_supply"), "BT_UI_BRANCH_B_AUTHORITY");
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
  for (const root of ["/api/branch-stock-desk", "/api/warehouse/branch-stock/" + A, "/api/warehouse/items", "/api/warehouse/material-transfers", "/api/central-kitchen-orders",
    "/api/shift-management/bundle"]) {
    const result = await request(`${root}?branchId=${A}&startDate=2026-10-01&endDate=2026-10-07`, { cookie: employee });
    check(result.status === 200, `BT_OPERATIONS_${root}_${result.status}`);
    if (root === "/api/central-kitchen-orders") {
      check(JSON.stringify(result.json).includes("SYNTHETIC-A") && !JSON.stringify(result.json).includes("SYNTHETIC-B"), "BT_KITCHEN_ROWS_FILTER");
    }
  }
  check((await request("/api/central-kitchen-orders/900002?branchId=" + A, { cookie: employee })).status === 403, "BT_KITCHEN_PERSISTED_BRANCH");
  check((await request(`/api/shift-management/bundle?branchId=${B}&startDate=2026-10-01&endDate=2026-10-07`, { cookie: employee })).status === 403, "BT_WORKFORCE_FOREIGN");
  const outsideTransfers = await request("/api/warehouse/material-transfers?branchId=" + B, { cookie: employee });
  check(outsideTransfers.status === 200 && outsideTransfers.json.some(t => t.id === 900001)
    && !outsideTransfers.json.some(t => t.id === 900002), "BT_WAREHOUSE_OUTSIDE_BASE_PRESERVED");
  check((await request("/api/warehouse/material-transfers/900001?branchId=" + A, { cookie: employee })).status === 200, "BT_WAREHOUSE_PERSISTED_SOURCE");
  check((await request("/api/warehouse/material-transfers/900002?branchId=" + B, { cookie: employee })).status === 403, "BT_WAREHOUSE_NO_SOURCE_AUTHORITY");
  check((await client.query("SELECT branch_id FROM users WHERE id=$1", [user])).rows[0].branch_id === B, "BT_ACCOUNT_DEFAULT_UNCHANGED");
  check((await request("/api/smart-incentives/product-commission-achievement", {
    method: "POST", cookie: employee, body: {
      cashierId: user, commissionId: 900001, date: "2026-10-03", quantitySold: 1,
    },
  })).status === 200, "BT_EXPLICIT_BRANCH_COMMISSION_WITHOUT_DEFAULT_CHANGE");
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
  const restrictedDraft = await request("/api/rbac/job-template-drafts", { method: "POST", cookie: admin, body: { content: {
    key: "isolated_restricted_base", name: "Synthetic restricted base", description: "Preserve other branch",
    reviewNotes: "Resource and collection parity", scopeType: "branch", assignmentAuthority: "delegated_operations",
    permissions: [{ module: "quality_control", actions: ["view"] }],
  } } });
  check(restrictedDraft.status === 201, "BT_RESTRICTED_DRAFT");
  check((await request(`/api/rbac/job-template-drafts/${restrictedDraft.json.id}/approvals`, { method: "POST", cookie: admin,
    body: { version: 1, expectedLatestVersion: 1, reason: "Synthetic restriction review", reviewed: true } })).status === 201, "BT_RESTRICTED_APPROVAL");
  check((await request(url, { method: "POST", cookie: manager, body: {
    templateId: restrictedDraft.json.id, version: 1, branchId: A, reason: "Remove only branch A performance",
    expectedAssignmentRevision: afterRollback.json.expectedAssignmentRevision,
  } })).status === 200, "BT_RESTRICTED_SAVE");
  employee = await login("employee");
  for (const root of ["/api/average-ticket-targets", "/api/average-ticket-targets/active"]) {
    const collection = await request(root, { cookie: employee });
    check(collection.status === 200 && collection.json.length === 1 && collection.json[0].branchId === B, `BT_OUTSIDE_FILTER_${root}`);
    check((await request(root + "?branchId=" + A, { cookie: employee })).status === 403, `BT_REMOVED_PERFORMANCE_${root}`);
  }
  for (const root of ["/api/branch-employees", "/api/attendance"]) {
    const list = await request(root, { cookie: employee });
    check(list.status === 200 && list.json.length > 0 && list.json.every(row => row.branchId === B),
      `BT_HR_LIST_${root}`);
    check((await request(`${root}/900012?branchId=${A}`, { cookie: employee })).status === 200,
      `BT_HR_OUTSIDE_RESOURCE_${root}`);
    check((await request(`${root}/900011?branchId=${B}`, { cookie: employee })).status === 403,
      `BT_HR_DENIED_RESOURCE_${root}`);
  }
  for (const [root, method] of [["/api/attendance", "PATCH"], ["/api/branch-employees", "PUT"]]) {
    check((await request(`${root}/900012`, { method, cookie: employee, body: { notes: "Synthetic allowed edit" } })).status === 200,
      `BT_HR_OUTSIDE_EDIT_${root}`);
    check((await request(`${root}/900011`, { method, cookie: employee, body: { notes: "Must not write" } })).status === 403,
      `BT_HR_DENIED_EDIT_${root}`);
    check((await request(`${root}/900012`, { method, cookie: employee, body: { branchId: A } })).status === 403,
      `BT_HR_DENIED_MOVE_${root}`);
  }
  const hrHistory = await request("/api/branch-employees/900012/attendance", { cookie: employee });
  const posEvent = await request("/api/pos/events", {
    method: "POST", cookie: employee, body: { branchId: B, name: "Synthetic POS", startDate: "2026-10-03", endDate: "2026-10-04" },
  });
  check(posEvent.status === 201, `BT_POS_OUTSIDE_CREATE_${posEvent.status}`);
  check((await request("/api/pos/events", {
    method: "POST", cookie: employee, body: { branchId: A, name: "Denied POS", startDate: "2026-10-03", endDate: "2026-10-04" },
  })).status === 403, "BT_POS_DENIED_CREATE");
  check((await request(`/api/pos/events/${posEvent.json.id}/report?branchId=${A}`, { cookie: employee })).status === 200,
    "BT_POS_PERSISTED_EVENT");
  check((await request(`/api/pos/events?branchId=${B}`, { cookie: employee })).status === 200, "BT_POS_OUTSIDE_LIST");
  check((await request(`/api/pos/events?branchId=${A}`, { cookie: employee })).status === 403, "BT_POS_DENIED_LIST");
  check(hrHistory.status === 200 && hrHistory.json.length === 1 && hrHistory.json[0].branchId === B,
    "BT_HR_TRANSFER_HISTORY_FILTER");
  check((await request(`/api/attendance-check/bundle?branchId=${A}&shiftType=morning&date=2026-10-03`,
    { cookie: employee })).status === 403, "BT_HR_ATTENDANCE_CHECK_DENIED_BRANCH");
  check((await client.query("SELECT notes FROM attendance_records WHERE id=900011")).rows[0].notes === null,
    "BT_HR_DENIED_ROW_UNCHANGED");
  check((await request(`/api/attendance-summary/${user}/2026-10`, { cookie: employee })).status === 403,
    "BT_HR_MONTHLY_MIXED_BRANCH_DENIED");
  check((await request(`/api/attendance-summary/calculate/${user}/2026-10`, {
    method: "POST", cookie: employee,
  })).status === 403, "BT_HR_MONTHLY_RECALC_DENIED");
  const summaryList = await request("/api/attendance-summary?month=2026-10", { cookie: employee });
  check(summaryList.status === 200 && !summaryList.json.some(row => row.employeeId === user),
    "BT_HR_MONTHLY_LIST_NO_MIXED_BRANCH_TOTALS");
  check(Number((await client.query("SELECT total_present_days FROM attendance_summary WHERE employee_id=$1", [user]))
    .rows[0].total_present_days) === 2, "BT_HR_MONTHLY_CACHE_UNCHANGED");
  for (const root of ["/api/daily-production/batches", "/api/daily-production/unfinished"]) {
    const result = await request(root, { cookie: employee });
    check(result.status === 200 && result.json.length === 1 && result.json[0].branchId === B,
      `BT_OUTSIDE_PRODUCTION_LIST_${root}`);
    check((await request(root + "?branchId=" + A, { cookie: employee })).status === 403,
      "BT_DENIED_PRODUCTION_LIST");
  }
  for (const root of ["/api/daily-production/batches", "/api/branch-daily-closures"]) {
    check((await request(`${root}/900002?branchId=${A}`, { cookie: employee })).status === 200,
      "BT_OUTSIDE_PERSISTED_OWNER");
    check((await request(`${root}/900001?branchId=${B}`, { cookie: employee })).status === 403,
      "BT_DENIED_PERSISTED_OWNER");
  }
  const closures = await request("/api/branch-daily-closures", { cookie: employee });
  check(closures.status === 200 && closures.json.closures.length === 1
    && closures.json.closures[0].branchId === B && Number(closures.json.totals.totalSales) === 7,
    "BT_CLOSURE_AGGREGATE_SCOPE");
  check((await request("/api/daily-production/batches/900002", {
    method: "PATCH", cookie: employee, body: { notes: "Other branch remains writable" },
  })).status === 200, "BT_OUTSIDE_PRODUCTION_EDIT");
  check((await request("/api/daily-production/batches/900001", {
    method: "PATCH", cookie: employee, body: { notes: "Must not change" },
  })).status === 403, "BT_DENIED_PRODUCTION_EDIT");
  check((await client.query("SELECT notes FROM daily_production_batches WHERE id=900001")).rows[0].notes === null,
    "BT_DENIED_PRODUCTION_UNCHANGED");
  check((await request("/api/branch-daily-closures/900001", {
    method: "DELETE", cookie: employee,
  })).status === 403, "BT_DENIED_CLOSURE_DELETE");
  check((await request("/api/branch-daily-closures/900002", {
    method: "DELETE", cookie: employee,
  })).status === 403, "BT_CLOSURE_DELETE_REMAINS_ADMIN_ONLY");
  check((await request("/api/branch-daily-closures/900002/close", {
    method: "POST", cookie: employee,
  })).status === 200, "BT_OUTSIDE_CLOSURE_APPROVE");
  check((await request("/api/branch-daily-closures/900001/close", {
    method: "POST", cookie: employee,
  })).status === 403, "BT_DENIED_CLOSURE_APPROVE");
  check((await request("/api/average-ticket-targets/900002?branchId=" + A, { cookie: employee })).status === 200, "BT_OUTSIDE_RESOURCE_PRESERVED");
  check((await request("/api/average-ticket-targets/900001?branchId=" + B, { cookie: employee })).status === 403, "BT_RESOURCE_BRANCH_NOT_QUERY");
  check((await request(`/api/cashier-shift-targets/branch/${B}/date/2026-10-03`, { cookie: employee })).status === 200, "BT_OUTSIDE_TARGETS_PRESERVED");
  const tracking = await request("/api/shift-performance-tracking", { cookie: employee });
  check(tracking.status === 200 && tracking.json.length === 1 && tracking.json[0].branchId === B,
    "BT_OUTSIDE_SHIFT_TRACKING_PRESERVED");
  check((await request("/api/shift-performance-tracking?branchId=" + A, { cookie: employee })).status === 403,
    "BT_SHIFT_TRACKING_RESTRICTED_BRANCH");
  const targetFor = branchId => ({
    cashierId: user, branchId, shiftType: "morning", cashierRole: "main", periodType: "daily",
    startDate: "2026-10-03", endDate: "2026-10-03", targetDate: "2026-10-03",
    totalTargetAmount: "10", targetAmount: "10",
  });
  const bulkTargets = await request("/api/cashier-shift-targets/bulk", {
    method: "POST", cookie: employee, body: { targets: [targetFor(B)] },
  });
  check(bulkTargets.status === 201 && bulkTargets.json.length === 1 && bulkTargets.json[0].branchId === B,
    `BT_OUTSIDE_BULK_TARGETS_${bulkTargets.status}`);
  const countTargets = async () => Number((await client.query("SELECT count(*) FROM cashier_shift_targets")).rows[0].count);
  const targetCount = await countTargets();
  for (const branchId of [A, "nonexistent-foreign"]) {
    check((await request("/api/cashier-shift-targets/bulk", {
      method: "POST", cookie: employee, body: { targets: [targetFor(B), targetFor(branchId)] },
    })).status === 403, "BT_BULK_TARGETS_MIXED_SCOPE_DENIED");
    check(await countTargets() === targetCount, "BT_BULK_TARGETS_NO_PARTIAL_INSERT");
  }
  const home = await request("/api/dashboard/stats", { cookie: employee });
  check(home.status === 200 && home.json.todaySales === 7, "BT_HOME_ONLY_AUTHORIZED_BRANCH_SALES");
  check((await request("/api/dashboard/stats?branchId=" + A, { cookie: employee })).json.todaySales === 0, "BT_HOME_RESTRICTED_BRANCH");
  const widgets = await request("/api/dashboard/widgets", { cookie: employee });
  check(widgets.status === 200 && widgets.json.weekSales.reduce((sum, day) => sum + day.total, 0) === 7, "BT_WIDGETS_BRANCH_PARITY");
  check(widgets.json.topBranchToday?.total === 7, "BT_TOP_BRANCH_NO_FOREIGN_SALES");
  check((await request("/api/smart-incentives/product-commissions/900002", {
    method: "PATCH", cookie: employee, body: { pointsOnTarget: 3 },
  })).status === 200, "BT_OUTSIDE_COMMISSION_EDIT");
  check((await request("/api/smart-incentives/product-commissions/900001?branchId=" + B, {
    method: "PATCH", cookie: employee, body: { pointsOnTarget: 3 },
  })).status === 403, "BT_DENIED_COMMISSION_EDIT");
  check((await request("/api/smart-incentives/product-commissions/900002", {
    method: "PATCH", cookie: employee, body: { branchId: A },
  })).status === 404, "BT_COMMISSION_CANNOT_MOVE_INTO_DENIED_BRANCH");
  const recorded = await request("/api/smart-incentives/product-commission-achievement", {
    method: "POST", cookie: employee, body: {
      cashierId: "isolated-fixture-manager", commissionId: 900002, date: "2026-10-03", quantitySold: 1,
    },
  });
  check(recorded.status === 200, `BT_OUTSIDE_COMMISSION_CUSTOM_GUARD_${recorded.status}`);
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
  // Multiple retained branches must still exclude the replaced branch. This
  // catches handlers that accidentally translate singleBranchId=null to all.
  const C = "isolated-fixture-extra-branch";
  await client.query("INSERT INTO branches(id,name) VALUES($1,'Synthetic C')", [C]);
  await client.query("INSERT INTO user_branch_access(user_id,branch_id,access_level) VALUES($1,$2,'full')", [user, C]);
  await client.query(`INSERT INTO daily_production_batches
    (branch_id,product_name,quantity,destination,status)
    VALUES ($1,'Synthetic C',1,'display_bar','in_progress')`, [C]);
  employee = await login("employee");
  for (const root of ["/api/daily-production/batches", "/api/daily-production/unfinished"]) {
    const result = await request(root, { cookie: employee });
    check(result.status === 200 && result.json.length === 2
      && result.json.every(row => [B, C].includes(row.branchId)), "BT_MULTIBRANCH_PRODUCTION_ISOLATION");
  }
  await client.query(`DELETE FROM user_branch_access WHERE user_id='isolated-fixture-manager'`);
  check((await request(url, { cookie: manager })).status === 403, "BT_MANAGER_WITHDRAWN");
  assert.deepEqual((await client.query("SELECT module,actions FROM user_permissions WHERE user_id=$1 ORDER BY module", [user])).rows, unchanged);
  check((await client.query("SELECT count(*)::int n FROM branch_employee_template_assignments WHERE user_id=$1", [user])).rows[0].n === 1, "BT_ONE_BRANCH_BINDING");
  console.log(`Branch template isolated HTTP/DB verification passed: ${count} assertions; original permissions unchanged.`);
} catch (error) {
  console.error(`Branch template isolated test failed: ${/^BT_/.test(error.message) ? error.message : guard.safeReason(error)}`);
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }