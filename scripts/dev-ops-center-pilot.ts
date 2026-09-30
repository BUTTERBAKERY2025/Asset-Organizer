// Local heliumdb ONLY. The credential/ownership manifest never belongs in git.
// Usage: npx tsx scripts/dev-ops-center-pilot.ts [--setup|--status|--verify-login|--verify-center|--revoke-a|--restore-a|--cleanup]
import { Client } from "pg";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { openSync, writeFileSync, readFileSync, closeSync, unlinkSync, statSync, lstatSync } from "node:fs";

const file = "/tmp/ops-center-pilot-credentials.json";
const action = process.argv[2] || "--setup";
if (!["--setup", "--status", "--verify-login", "--verify-center", "--revoke-a", "--restore-a", "--cleanup"].includes(action) || process.argv.length > 3)
  throw new Error("Expected --setup, --status, --verify-login, --verify-center, --revoke-a, --restore-a or --cleanup");
const url = process.env.DATABASE_URL;
if (process.env.NODE_ENV === "production" || process.env.USE_SUPABASE === "true" || !url)
  throw new Error("Refusing non-local fixture environment");
let parsed: URL;
try { parsed = new URL(url); } catch { throw new Error("Invalid local database URL"); }
if (parsed.hostname !== "helium" || parsed.pathname !== "/heliumdb" ||
    (process.env.SUPABASE_DATABASE_URL && url === process.env.SUPABASE_DATABASE_URL))
  throw new Error("Refusing non-local heliumdb");

type Fixture = {
  version: 1;
  tag: string;
  branches: { A: string; B: string };
  accounts: Record<"A" | "B" | "zero", { id: string; username: string; password: string }>;
  grants: { A: number; B: number };
  orders: { A: number; B: number };
  items: { A: number; B: number };
};
const labels = ["A", "B"] as const;
const q = (c: Client, sql: string, args: unknown[] = []) => c.query(sql, args);
function readFixture(): Fixture {
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0)
    throw new Error("Manifest must be a private 0600 regular file owned by the current user");
  const f = JSON.parse(readFileSync(file, "utf8")) as Fixture;
  if (f.version !== 1 || !/^[a-f0-9]{16}$/.test(f.tag) ||
      labels.some(k => f.branches[k] !== `ops_pilot_${f.tag}_${k.toLowerCase()}` ||
        !Number.isSafeInteger(f.grants[k]) || !Number.isSafeInteger(f.orders[k]) ||
        !Number.isSafeInteger(f.items[k])) ||
      (["A", "B", "zero"] as const).some(k => !/^[a-f0-9-]{36}$/.test(f.accounts[k]?.id || "") ||
        f.accounts[k]?.username !== `ops_pilot_${f.tag}_${k.toLowerCase()}` ||
        !f.accounts[k]?.password))
    throw new Error("Invalid manifest; refusing to touch database");
  return f;
}
async function assertOwned(c: Client, f: Fixture) {
  for (const k of labels) {
    const b = (await q(c, "select id from branches where id=$1 and name=$2",
      [f.branches[k], `TEMP Ops Pilot ${f.tag} ${k}`])).rowCount;
    const other = f.branches[k === "A" ? "B" : "A"];
    const t = (await q(c, `select id from central_kitchen_orders
      where id=$1 and request_branch_id=$2 and central_kitchen_id=$3
      and order_number=$4 and created_by=$5 and idempotency_key=$6`,
      [f.orders[k], f.branches[k], other, `OPS-PILOT-${f.tag}-${k}`, f.accounts[k].id, `ops-pilot-${f.tag}-${k}`])).rowCount;
    const item = (await q(c, `select id from central_kitchen_order_items
      where id=$1 and order_id=$2 and product_name=$3`,
      [f.items[k], f.orders[k], `TEMP OPS PILOT ${f.tag} ${k}`])).rowCount;
    if (b !== 1 || t !== 1 || item !== 1) throw new Error(`Fixture ${k} provenance mismatch; refusing cleanup`);
  }
  for (const k of ["A", "B", "zero"] as const) {
    const u = (await q(c, `select id from users where id=$1 and username=$2
      and role='operations_manager' and is_active='active'`, [f.accounts[k].id, f.accounts[k].username])).rowCount;
    if (u !== 1) throw new Error(`Fixture account ${k} provenance mismatch; refusing cleanup`);
  }
  for (const k of labels) {
    const g = (await q(c, `select id from user_branch_access
      where id=$1 and user_id=$2 and branch_id=$3`, [f.grants[k], f.accounts[k].id, f.branches[k]])).rowCount;
    // A tester may explicitly revoke a fixture grant; absence is allowed. Never infer/delete other grants.
    if (g !== 1 && (await q(c, "select id from user_branch_access where id=$1", [f.grants[k]])).rowCount)
      throw new Error(`Fixture grant ${k} has changed ownership; refusing cleanup`);
  }
}
async function changeAGrant(c: Client, f: Fixture, restore: boolean) {
  await q(c, "BEGIN");
  try {
    await assertOwned(c, f);
    if (!restore) {
      await q(c, `delete from user_branch_access
        where id=$1 and user_id=$2 and branch_id=$3`,
        [f.grants.A, f.accounts.A.id, f.branches.A]);
    } else {
      const present = await q(c, `select id from user_branch_access
        where id=$1 and user_id=$2 and branch_id=$3`,
        [f.grants.A, f.accounts.A.id, f.branches.A]);
      if (!present.rowCount) {
        const other = await q(c, "select id from user_branch_access where user_id=$1", [f.accounts.A.id]);
        if (other.rowCount) throw new Error("Unexpected A grants; refusing restore");
        await q(c, `insert into user_branch_access(id,user_id,branch_id,access_level,is_default)
          values($1,$2,$3,'full',true)`, [f.grants.A, f.accounts.A.id, f.branches.A]);
      }
    }
    await q(c, "COMMIT");
  } catch (error) {
    await q(c, "ROLLBACK");
    throw error;
  }
}
async function verifyCenter(c: Client, f: Fixture) {
  const origin = "http://127.0.0.1:5000";
  const outcomes: string[] = [];
  const cookies: Record<string, string> = {};
  const controller = new AbortController();
  let revoked = false;
  const check = (ok: unknown, label: string) => {
    if (!ok) throw new Error(`Assertion failed: ${label}`);
    outcomes.push(label);
  };
  const request = async (who: "A" | "B" | "zero", method: string, path: string, body?: unknown) => {
    const res = await fetch(origin + path, {
      method, redirect: "manual", signal: AbortSignal.timeout(30000),
      headers: { Cookie: cookies[who], Origin: origin, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // Never log response bodies: some routes return other real local data.
    const data = await res.json().catch(() => null);
    if (res.status >= 500)
      throw new Error(`${who} ${method} ${path}: HTTP ${res.status}; server message: ${String(data?.message || data?.error || "(none)").slice(0, 250)}`);
    return { status: res.status, data };
  };
  try {
    for (const who of ["A", "B", "zero"] as const) {
      const a = f.accounts[who];
      const res = await fetch(origin + "/api/auth/login", {
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(15000),
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ username: a.username, password: a.password }),
      });
      const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
      if (res.status !== 200 || !cookie.startsWith("__btr_sid="))
        throw new Error(`${who}: real password login failed (HTTP ${res.status}, sessionCookie=${cookie.startsWith("__btr_sid=")})`);
      outcomes.push(`${who}: real password login`);
      cookies[who] = cookie;
      const me = await request(who, "GET", "/api/auth/me");
      check(me.status === 200 && me.data?.id === a.id, `${who}: independent authenticated session`);
    }
    for (const who of ["A", "B"] as const) {
      const own = f.branches[who], opposite = f.branches[who === "A" ? "B" : "A"];
      const center = await request(who, "GET", `/api/operations-center?branchIds=${own}`);
      check(center.status === 200 && center.data?.scope?.branchIds?.length === 1 &&
        center.data.scope.branchIds[0] === own, `${who}: own operations center scope`);
      const queue = center.data?.queue;
      const item = Array.isArray(queue) && queue.find((row: any) =>
        row.sourceType === "kitchen_order" && Number(row.sourceId) === f.orders[who] && row.branchId === own);
      check(item && !queue.some((row: any) => row.branchId !== own || Number(row.sourceId) === f.orders[who === "A" ? "B" : "A"]),
        `${who}: authoritative kitchen queue item and no opposite queue item`);
      const target = new URL(String(item?.href), origin);
      if (target.pathname !== "/central-kitchen-orders" || target.searchParams.get("stage") !== "requested" ||
          target.searchParams.get("branchId") !== own ||
          target.searchParams.get("orderId") !== String(f.orders[who]) ||
          !item?.actions?.some((link: any) => link.href === item.href))
        throw new Error(`${who}: fixture source link does not target exact order ID in authorized branch`);
      outcomes.push(`${who}: queue source link matches UI route`);
      const all = await request(who, "GET", "/api/operations-center?branchIds=all");
      check(all.status === 200 && all.data?.scope?.branchIds?.length === 1 &&
        all.data.scope.branchIds[0] === own, `${who}: all selector remains scoped`);
      const denied = await request(who, "GET", `/api/operations-center?branchIds=${opposite}`);
      check(denied.status === 403, `${who}: opposite branch denied`);
      const forged = await request(who, "PATCH", "/api/auth/active-branch", { branchId: opposite });
      check(forged.status === 403, `${who}: forged active branch denied`);
      const exported = await request(who, "GET", `/api/operations-center/export?branchIds=${own}`);
      check(exported.status === 200 && exported.data?.scope?.branchIds?.length === 1 &&
        exported.data.scope.branchIds[0] === own &&
        exported.data.queue?.every((row: any) => row.branchId === own),
      `${who}: export restricted to own branch`);
      const rejectedExport = await request(who, "GET", `/api/operations-center/export?branchIds=${opposite}`);
      check(rejectedExport.status === 403, `${who}: opposite branch export denied`);
      // The kitchen order is intentionally addressed to the *other fixture kitchen*.
      // This module grants both request and destination access; do not incorrectly
      // assert opposite detail is denied. Verify exact own detail and zero-grant denial.
      const detail = await request(who, "GET", `/api/central-kitchen-orders/${f.orders[who]}`);
      check(detail.status === 200 && detail.data?.id === f.orders[who] &&
        detail.data?.requestBranchId === own, `${who}: exact source detail by order ID`);
    }
    for (const path of [
      "/api/operations-center?branchIds=all",
      `/api/operations-center?branchIds=${f.branches.A}`,
      `/api/operations-center/export?branchIds=${f.branches.A}`,
      `/api/central-kitchen-orders/${f.orders.A}`,
    ]) {
      const res = await request("zero", "GET", path);
      check(res.status === 403, `zero: denied ${path.split("?")[0]}`);
    }
    const stream = await fetch(origin + `/api/operations-center/events?branchIds=${f.branches.A}`, {
      headers: { Cookie: cookies.A, Accept: "text/event-stream" }, signal: controller.signal,
    });
    check(stream.status === 200 && stream.headers.get("content-type")?.includes("text/event-stream"),
      "A: live stream accepted");
    const reader = stream.body?.getReader();
    if (!reader) throw new Error("SSE body unavailable");
    const decoder = new TextDecoder();
    let buffer = "";
    const nextEvent = async (timeout: number) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = frame.match(/^event: ([\w-]+)/m)?.[1];
          if (event) return event;
          continue; // heartbeat comment
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("SSE event timeout")), Math.max(1, deadline - Date.now()));
          }),
        ]).finally(() => { if (timer) clearTimeout(timer); });
        if (result.done) throw new Error("SSE closed before expected event");
        buffer += decoder.decode(result.value, { stream: true });
      }
      throw new Error("SSE event timeout");
    };
    check(await nextEvent(8000) === "ready", "A: SSE ready");
    await changeAGrant(c, f, false);
    revoked = true;
    const deniedAfter = await request("A", "GET", `/api/operations-center?branchIds=${f.branches.A}`);
    check(deniedAfter.status === 403, "A: same authenticated session denied after grant revocation");
    const exportedAfter = await request("A", "GET", `/api/operations-center/export?branchIds=${f.branches.A}`);
    check(exportedAfter.status === 403, "A: export denied after grant revocation");
    const forgedAfter = await request("A", "PATCH", "/api/auth/active-branch", { branchId: f.branches.A });
    check(forgedAfter.status === 403, "A: active-branch switch denied after grant revocation");
    // Heartbeat re-authorizes against current DB grants every 15 seconds.
    check(await nextEvent(22000) === "scope-invalidated", "A: existing SSE invalidated after revocation");
    await changeAGrant(c, f, true);
    revoked = false;
    const restored = await request("A", "GET", `/api/operations-center?branchIds=${f.branches.A}`);
    check(restored.status === 200 && restored.data?.scope?.branchIds?.[0] === f.branches.A,
      "A: same session restored after fixture grant re-add");
    console.log(JSON.stringify({ fixture: "ops-center-local-pilot", result: "PASS", assertions: outcomes }));
  } finally {
    controller.abort();
    if (revoked) {
      await changeAGrant(c, f, true);
      console.log("Fixture A grant restored in finally after failed journey.");
    }
  }
}
async function main() {
  const c = new Client({ connectionString: url });
  let wrote = false, committed = false;
  try {
    await c.connect();
    const db = (await q(c, "select current_database() db, inet_server_addr()::text host")).rows[0];
    if (db.db !== "heliumdb" || !(db.host === null || ["127.0.0.1", "::1"].includes(db.host) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(db.host || "")))
      throw new Error("Unexpected database/server address");
    if (action === "--setup" && !existsManifest()) {
      const tag = randomBytes(8).toString("hex");
      const f: Fixture = {
        version: 1, tag,
        branches: { A: `ops_pilot_${tag}_a`, B: `ops_pilot_${tag}_b` },
        accounts: Object.fromEntries((["A", "B", "zero"] as const).map(k => [k, {
          id: randomUUID(), username: `ops_pilot_${tag}_${k.toLowerCase()}`,
          password: randomBytes(36).toString("base64url"),
        }])) as Fixture["accounts"],
        grants: { A: 0, B: 0 }, orders: { A: 0, B: 0 }, items: { A: 0, B: 0 },
      };
      await q(c, "BEGIN");
      for (const k of labels)
        await q(c, "insert into branches(id,name) values($1,$2)", [f.branches[k], `TEMP Ops Pilot ${tag} ${k}`]);
      for (const k of ["A", "B", "zero"] as const) {
        const a = f.accounts[k];
        await q(c, `insert into users(id,username,password,first_name,last_name,role,branch_id,is_active)
          values($1,$2,$3,$4,'Pilot','operations_manager',$5,'active')`,
          [a.id, a.username, await bcrypt.hash(a.password, 10), `TEMP Ops ${k}`, k === "zero" ? null : f.branches[k]]);
      }
      for (const k of labels) {
        f.grants[k] = (await q(c, `insert into user_branch_access(user_id,branch_id,is_default)
          values($1,$2,true) returning id`, [f.accounts[k].id, f.branches[k]])).rows[0].id;
        f.orders[k] = (await q(c, `insert into central_kitchen_orders
          (order_number,request_branch_id,central_kitchen_id,order_date,status,inventory_mode,
           notes,idempotency_key,payload_fingerprint,created_by)
          values($1,$2,$3,current_date,'requested','shadow',$4,$5,$6,$7) returning id`,
          [`OPS-PILOT-${tag}-${k}`, f.branches[k], f.branches[k === "A" ? "B" : "A"],
            `TEMP OPS PILOT ${tag} ${k}`, `ops-pilot-${tag}-${k}`, `ops-pilot-${tag}-${k}`, f.accounts[k].id])).rows[0].id;
        f.items[k] = (await q(c, `insert into central_kitchen_order_items
          (order_id,product_name,requested_quantity,unit,reported_available_quantity)
          values($1,$2,1,'piece',0) returning id`, [f.orders[k], `TEMP OPS PILOT ${tag} ${k}`])).rows[0].id;
      }
      const fd = openSync(file, "wx", 0o600);
      wrote = true;
      try { writeFileSync(fd, JSON.stringify(f, null, 2)); } finally { closeSync(fd); }
      await q(c, "COMMIT");
      committed = true;
    } else if (!existsManifest()) {
      throw new Error("Fixture manifest missing; use --setup");
    }
    const f = readFixture();
    await assertOwned(c, f);
    if (action === "--revoke-a" || action === "--restore-a") {
      await changeAGrant(c, f, action === "--restore-a");
      console.log(`Ops pilot A fixture grant ${action === "--revoke-a" ? "revoked" : "restored"}: ${f.grants.A}`);
      return;
    }
    if (action === "--verify-center") {
      await verifyCenter(c, f);
      return;
    }
    if (action === "--cleanup") {
      await q(c, "BEGIN");
      await assertOwned(c, f);
      const userIds = (["A", "B", "zero"] as const).map(k => f.accounts[k].id);
      for (const k of labels) {
        // Event audit is append-only; refuse if tester changed orders rather than deleting audit history.
        const events = await q(c, "select id from central_kitchen_order_events where order_id=$1 limit 1", [f.orders[k]]);
        if (events.rowCount) throw new Error("Fixture order has event history; review manually before cleanup");
        await q(c, "delete from central_kitchen_order_items where id=$1 and order_id=$2", [f.items[k], f.orders[k]]);
        await q(c, "delete from central_kitchen_orders where id=$1 and request_branch_id=$2 and created_by=$3",
          [f.orders[k], f.branches[k], f.accounts[k].id]);
        await q(c, "delete from user_branch_access where id=$1 and user_id=$2 and branch_id=$3",
          [f.grants[k], f.accounts[k].id, f.branches[k]]);
      }
      // Only session and audit rows belonging to the three manifest account IDs.
      await q(c, `delete from sessions where sess->>'userId'=any($1::text[])
        or sess->'pendingTwoFactor'->>'userId'=any($1::text[])`, [userIds]);
      await q(c, "delete from user_sessions where user_id=any($1::varchar[])", [userIds]);
      await q(c, "delete from system_audit_logs where user_id=any($1::varchar[])", [userIds]);
      for (const k of ["A", "B", "zero"] as const) {
        // Other grants or other user-owned records are not ours to remove.
        await q(c, "delete from users where id=$1 and username=$2", [f.accounts[k].id, f.accounts[k].username]);
      }
      for (const k of labels)
        await q(c, "delete from branches where id=$1 and name=$2", [f.branches[k], `TEMP Ops Pilot ${f.tag} ${k}`]);
      await q(c, "COMMIT");
      unlinkSync(file);
      console.log("Ops pilot cleanup complete: 3 accounts, 2 branches, 2 orders, fixture grants only.");
      return;
    }
    if (action === "--verify-login") {
      for (const k of ["A", "B", "zero"] as const) {
        const response = await fetch("http://127.0.0.1:5000/api/auth/login", {
          method: "POST", redirect: "manual",
          headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:5000" },
          body: JSON.stringify({ username: f.accounts[k].username, password: f.accounts[k].password }),
        });
        const cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
        if (!response.ok || !cookie.startsWith("__btr_sid="))
          throw new Error(`Real local password login failed for ${k} (HTTP ${response.status}); no credentials logged`);
        const me = await fetch("http://127.0.0.1:5000/api/auth/me", { headers: { Cookie: cookie } });
        const identity = me.ok ? await me.json() : null;
        if (!me.ok || identity?.id !== f.accounts[k].id)
          throw new Error(`Real local session identity failed for ${k} (HTTP ${me.status}); no cookies logged`);
      }
    }
    console.log(JSON.stringify({
      fixture: "ops-center-local-pilot", manifest: file,
      branches: f.branches,
      users: Object.fromEntries((["A", "B", "zero"] as const).map(k => [k, {
        id: f.accounts[k].id, username: f.accounts[k].username,
        grantId: k === "zero" ? null : f.grants[k],
      }])),
      orders: f.orders, items: f.items, accountCount: 3, branchCount: 2, orderCount: 2,
      loginVerified: action === "--verify-login",
    }));
  } catch (error) {
    await q(c, "ROLLBACK").catch(() => {});
    if (wrote && !committed) { try { unlinkSync(file); } catch { /* preserve original failure */ } }
    const message = error instanceof Error ? error.message : "Unknown failure";
    console.error(`Ops pilot ${action} failed: ${message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-url]")}`);
    process.exitCode = 1;
  } finally { await c.end().catch(() => {}); }
}
function existsManifest() {
  try { statSync(file); return true; }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return false; throw err; }
}
void main();