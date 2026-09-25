// Real HTTP, four independent password-authenticated sessions. LOCAL fixture ONLY.
// Run once while the existing dev server is running:
// node scripts/local-reverse-e2e-journey.cjs /tmp/reverse-e2e-<tag>.json
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { deflateSync } = require("node:zlib");
const { Client } = require("pg");

const filename = process.argv[2];
const url = process.env.DATABASE_URL;
if (!filename || !path.resolve(filename).startsWith(os.tmpdir() + path.sep) ||
    !url || process.env.USE_SUPABASE === "true") throw Error("LOCAL fixture path required");
const pgUrl = new URL(url);
if (pgUrl.hostname !== "helium" || pgUrl.pathname !== "/heliumdb" ||
    (process.env.SUPABASE_DATABASE_URL && url === process.env.SUPABASE_DATABASE_URL))
  throw Error("Refusing non-local database");
const f = JSON.parse(fs.readFileSync(filename, "utf8"));
if (!/^e2e_rev_[a-f0-9]{14}$/.test(f.source) || f.warehouse !== "main_warehouse" ||
    !f.ids || Object.keys(f.credentials || {}).sort().join(",") !== "driver,receiver,settlement,source")
  throw Error("Invalid fixture");
const origin = "http://127.0.0.1:5000";
const report = path.join("reports", "real-delivery-four-role-test.md");
const evidence = [];
let movement, assignment;
const assert = (ok, msg) => { if (!ok) throw Error(msg); };
const key = () => `journey-${randomUUID()}`;

// Draw a unique, valid, opaque RGBA PNG (200x80), rather than forging a data URL.
function signature() {
  const chunk = (type, data) => {
    const bytes = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(bytes.length + 8);
    result.writeUInt32BE(data.length);
    bytes.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length + 4);
    return result;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(200, 0); ihdr.writeUInt32BE(80, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const pixels = Buffer.alloc(80 * (1 + 200 * 4), 255);
  for (let y = 0; y < 80; y++) pixels[y * 801] = 0;
  // Simple dark pen stroke across the PNG; image is test evidence, not a real signature.
  for (let x = 18; x < 180; x++) {
    const y = 38 + Math.round(13 * Math.sin(x / 19));
    const p = y * 801 + 1 + x * 4;
    pixels[p] = 25; pixels[p + 1] = 45; pixels[p + 2] = 85; pixels[p + 3] = 255;
  }
  return "data:image/png;base64," + Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

async function main() {
  const db = new Client({ connectionString: url });
  const cookies = {};
  try {
    await db.connect();
    const dbInfo = (await db.query("select current_database() db, inet_server_addr()::text host")).rows[0];
    assert(dbInfo.db === "heliumdb" && (dbInfo.host === null ||
      ["127.0.0.1", "::1"].includes(dbInfo.host) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(dbInfo.host)), "Database is not local heliumdb");
    const own = (await db.query(`select t.id from material_transfers t join material_transfer_items i on i.transfer_id=t.id
      join warehouse_items w on w.id=i.item_id where t.id=$1 and i.id=$2 and w.id=$3 and
      t.transfer_number=$4 and w.sku=$5 and t.destination_branch_id=$6`,
      [f.transferId, f.transferItemId, f.itemId, `REV-ORIGIN-${f.tag}`, `REV-${f.tag}`, f.source])).rows;
    assert(own.length === 1, "Fixture provenance mismatch");
    const balances = async () => {
      const row = (await db.query(`select s.current_quantity source,s.reserved_quantity reserved,
        w.current_stock destination from branch_stock s join warehouse_items w on w.id=s.item_id
        where s.id=$1 and s.branch_id=$2 and w.id=$3`,
        [f.stockId, f.source, f.itemId])).rows[0];
      assert(row, "Fixture balance missing");
      return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
    };
    const expectBalance = async (source, reserved, destination, label) => {
      const b = await balances();
      assert(b.source === source && b.reserved === reserved && b.destination === destination,
        `${label}: wrong balance ${JSON.stringify(b)}`);
      evidence.push(`${label}: source ${b.source}, reserved ${b.reserved}, main ${b.destination} kg`);
    };
    await expectBalance(12, 0, 0, "Initial baseline");
    const request = async (role, method, endpoint, body, expected) => {
      const resp = await fetch(origin + endpoint, {
        method, redirect: "manual", headers: {
          Origin: origin, "Content-Type": "application/json",
          ...(cookies[role] ? { Cookie: cookies[role] } : {}),
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // Never log session identifiers, credentials, proof bytes or auth response.
      const data = await resp.json().catch(() => ({}));
      if (endpoint === "/api/auth/login" && resp.ok) {
        const sid = resp.headers.get("set-cookie")?.split(";")[0];
        assert(sid && sid.startsWith("__btr_sid="), `${role}: login session cookie absent`);
        cookies[role] = sid;
      }
      const descriptor = `${role} ${method} ${endpoint} -> ${resp.status}`;
      if (resp.status !== expected) {
        const safe = String(data.message || data.error || "unexpected response").slice(0, 300);
        throw Error(`${descriptor} expected ${expected}: ${safe}`);
      }
      evidence.push(`${descriptor} (expected)`);
      return data;
    };
    for (const role of ["source", "driver", "receiver", "settlement"]) {
      await request(role, "POST", "/api/auth/login",
        { username: f.credentials[role].username, password: f.credentials[role].password }, 200);
      const me = await request(role, "GET", "/api/auth/me", undefined, 200);
      assert((me.user?.id ?? me.id) === f.ids[role], `${role} session does not belong to fixture account`);
    }
    movement = (await request("source", "POST", "/api/reverse-logistics",
      { kind: "material_return", originalTransferItemId: f.transferItemId, quantity: 7, idempotencyKey: key() }, 200)).id;
    assert(Number.isSafeInteger(Number(movement)), "Movement ID missing");
    const rev = `/api/reverse-logistics/${movement}`;
    const requestKey = key();
    await request("source", "POST", `${rev}/request`, { idempotencyKey: requestKey }, 200);
    await expectBalance(12, 7, 0, "Requested and reserved");
    await request("source", "POST", `${rev}/dispatch`, { idempotencyKey: key() }, 409);
    await expectBalance(12, 7, 0, "Pre-assignment dispatch rejected");
    const assigned = await request("source", "POST", "/api/deliveries",
      { sourceType: "reverse_movement", sourceId: Number(movement),
        driverId: f.ids.driver, vehicleNumber: `E2E-${f.tag}` }, 201);
    assignment = assigned.id;
    assert(Number.isSafeInteger(Number(assignment)), "Delivery assignment ID missing");
    const task = `/api/deliveries/${assignment}`;
    await request("source", "POST", `${task}/handover`, { items: [{ id: Number(movement), quantity: 7 }] }, 200);
    await request("receiver", "POST", `${task}/acknowledge-handover`, {}, 403);
    await request("driver", "POST", `${task}/acknowledge-handover`, {}, 200);
    await request("source", "POST", `${rev}/dispatch`, { idempotencyKey: key() }, 200);
    await expectBalance(5, 0, 0, "Dispatched after driver acknowledged");
    await request("driver", "POST", `${task}/start`, {}, 200);
    const receiptKey = key();
    await request("receiver", "POST", `${rev}/receive`, { idempotencyKey: receiptKey, receivedQuantity: 7 }, 200);
    await expectBalance(5, 0, 0, "Receiver actual receipt, quarantine before inspection");
    await request("driver", "POST", `${task}/proof`,
      { signatureData: signature(), receiverName: "TEMP E2E receiver", notes: "LOCAL fixture proof after receipt" }, 200);
    await request("source", "POST", `${task}/approve-receipt`, {}, 403);
    await request("receiver", "POST", `${task}/approve-receipt`, {}, 200);
    await request("driver", "POST", `${task}/complete`, {}, 200);
    await request("receiver", "POST", `${rev}/receive`, { idempotencyKey: receiptKey, receivedQuantity: 7 }, 200);
    await expectBalance(5, 0, 0, "Repeated receipt has no duplicate credit");
    await request("receiver", "POST", `${rev}/inspect`,
      { idempotencyKey: key(), usableQuantity: 5, damagedQuantity: 2 }, 200);
    await expectBalance(5, 0, 5, "Inspection releases only usable");
    await request("receiver", "POST", `${rev}/writeoff`,
      { idempotencyKey: key(), damagedQuantity: 2, notes: "TEMP damaged material" }, 403);
    const writeoffKey = key(), writeoff = { idempotencyKey: writeoffKey, damagedQuantity: 2, notes: "TEMP damaged material" };
    await request("settlement", "POST", `${rev}/writeoff`, writeoff, 200);
    await request("settlement", "POST", `${rev}/writeoff`, writeoff, 200);
    await expectBalance(5, 0, 5, "Final usable stock after idempotent writeoff");
    const observed = (await db.query(`select m.kind,m.status,m.quantity,m.shipped_quantity,m.received_quantity,
      m.usable_quantity,m.damaged_quantity,m.written_off_quantity,
      a.status delivery_status,a.driver_id,a.receipt_approved_by,a.handover_acknowledged_at,
      (select count(*)::int from reverse_movement_events e where e.movement_id=m.id and e.action='receive') receive_events,
      (select count(*)::int from reverse_movement_events e where e.movement_id=m.id and e.action='writeoff') writeoff_events
      from reverse_movements m join delivery_assignments a on a.source_type='reverse_movement'
      and a.source_id=m.id where m.id=$1 and a.id=$2`, [movement, assignment])).rows[0];
    assert(observed && observed.kind === "material_return" && observed.status === "inspected" &&
      observed.delivery_status === "completed" && observed.driver_id === f.ids.driver &&
      observed.receipt_approved_by === f.ids.receiver && !!observed.handover_acknowledged_at &&
      +observed.quantity === 7 && +observed.shipped_quantity === 7 && +observed.received_quantity === 7 &&
      +observed.usable_quantity === 5 && +observed.damaged_quantity === 2 &&
      +observed.written_off_quantity === 2 && observed.receive_events === 1 &&
      observed.writeoff_events === 1, `Unexpected final state: ${JSON.stringify(observed)}`);
    evidence.push(`Final DB read-only verification: movement ${movement} inspected, delivery ${assignment} completed, receiver ${f.ids.receiver}; received 7, usable 5, damaged 2, written off 2; receive events 1, writeoff events 1.`);
    // Let the existing scheduler claim these fixture jobs. Never invoke a global
    // outbox drain here; that could deliver unrelated real-user notifications.
    let outbox;
    for (let i = 0; i < 17; i++) {
      outbox = (await db.query(`select o.id,o.event_type,o.attempts,
        o.published_at is not null published,o.last_error,n.target_user_ids
        from delivery_notification_outbox o left join system_notifications n
          on n.dedupe_key like 'delivery:'||o.id::text||':%'
        where o.assignment_id=$1 order by o.id`, [assignment])).rows;
      if (outbox.length >= 3 && outbox.every(row => row.attempts > 0)) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    const targets = outbox.flatMap(row => row.target_user_ids || []);
    assert(targets.every(id => Object.values(f.ids).includes(id)),
      "A delivery notice addressed a non-fixture account");
    evidence.push(`Notification outbox ${outbox.length} rows; published target users ${targets.length}, all fixture accounts (no real-user target).`);
    evidence.push(...outbox.map(row => `Outbox ${row.id} ${row.event_type}: attempts ${row.attempts}, published ${row.published}, last_error ${row.last_error || "none"}.`));
    assert(outbox.length >= 3 && outbox.every(row => row.published),
      "Reverse-movement notification delivery FAILED: fixture outbox has unpublished jobs");
    finish("PASS");
  } catch (err) {
    evidence.push(`Stopped: ${String(err.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted-url]")}`);
    finish("FAIL");
    process.exitCode = 1;
  } finally { await db.end().catch(() => {}); }
}
function finish(result) {
  fs.mkdirSync(path.dirname(report), { recursive: true });
  const lines = [
    "# Four-role real-account material-return HTTP journey",
    "", `Result: **${result}**. This is real HTTP against the running local server, not browser E2E; the UI was blocked by App-level Suspense.`,
    "Existing `/api/auth/login` username/password was used separately for each fixture role with normal session cookies and matching Origin. No auth bypass/mock/session forgery. All operational writes went through HTTP; SQL used only for preconditions and read-only verification.",
    `Fixture: ${f.source}, original transfer ${f.transferId} / line ${f.transferItemId}, material ${f.itemId}. Movement: ${movement ?? "not created"}, delivery: ${assignment ?? "not created"}.`,
    "Quantity plan: baseline source 12 kg/main 0; request 7; dispatch source 5; receipt 7 quarantine; inspection 5 usable/2 damaged; operations writeoff 2.",
    "", "## Evidence", ...evidence.map(line => `- ${line}`),
    "", "Fixture and sessions intentionally retained. Cleanup only after parent approval: `node scripts/local-reverse-e2e-fixture.cjs cleanup /tmp/reverse-e2e-<tag>.json` (use existing credential fixture path; do not publish its contents).",
  ];
  fs.writeFileSync(report, lines.join("\n") + "\n");
  console.log(`${result}: ${report}; movement=${movement ?? "none"} assignment=${assignment ?? "none"}`);
}
main();