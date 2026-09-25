// Local-only, short-lived real-account fixture. Run `node scripts/local-reverse-e2e-fixture.cjs seed`
// or `node scripts/local-reverse-e2e-fixture.cjs cleanup /tmp/reverse-e2e-....json`.
// Never commit the credential file. No authentication middleware is changed.
const { Client } = require("pg");
const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const url = process.env.DATABASE_URL;
if (!url || process.env.USE_SUPABASE === "true") throw Error("Refusing non-local DB");
let parsed;
try { parsed = new URL(url); } catch { throw Error("Refusing invalid DB URL"); }
if (parsed.hostname !== "helium" || parsed.pathname !== "/heliumdb" ||
    (process.env.SUPABASE_DATABASE_URL && url === process.env.SUPABASE_DATABASE_URL))
  throw Error("Refusing non-local heliumdb");

const action = process.argv[2];
if (!["seed", "cleanup"].includes(action)) throw Error("Expected seed or cleanup");
const q = (c, sql, args = []) => c.query(sql, args);
const one = async (c, sql, args) => (await q(c, sql, args)).rows[0];
const uid = () => crypto.randomUUID();

async function main() {
  const c = new Client({ connectionString: url });
  try {
    await c.connect();
    const db = await one(c, "select current_database() db, inet_server_addr()::text host");
    if (db.db !== "heliumdb" || ![null, "127.0.0.1", "::1"].includes(db.host) &&
        !(db.host && /^172\.(1[6-9]|2[0-9]|3[01])\./.test(db.host)))
      throw Error("Refusing unexpected database/server address");
    await q(c, "BEGIN");
    if (action === "seed") {
      const tag = crypto.randomBytes(7).toString("hex");
      const source = `e2e_rev_${tag}`, warehouse = "main_warehouse";
      if (!(await one(c, "select id from branches where id=$1", [warehouse])))
        throw Error("Required existing main_warehouse destination missing");
      const file = path.join(os.tmpdir(), `reverse-e2e-${tag}.json`);
      const ids = {};
      await q(c, "insert into branches(id,name) values($1,$2)", [source, `TEMP reverse E2E ${tag}`]);
      const roles = {
        source: { role: "branch_manager", branch: source, job: null },
        driver: { role: "employee", branch: source, job: "delivery" },
        receiver: { role: "branch_manager", branch: warehouse, job: null },
        settlement: { role: "operations_manager", branch: null, job: null },
      };
      const credentials = {};
      for (const [role, spec] of Object.entries(roles)) {
        const id = uid(), username = `rev_${role}_${tag}`;
        const password = crypto.randomBytes(36).toString("base64url");
        const hash = await bcrypt.hash(password, 10);
        await q(c, `insert into users(id,username,password,first_name,last_name,role,branch_id,job_title,is_active)
          values($1,$2,$3,$4,'Fixture',$5,$6,$7,'active')`,
          [id, username, hash, `TEMP ${role}`, spec.role, spec.branch, spec.job]);
        if (spec.branch)
          await q(c, `insert into user_branch_access(user_id,branch_id,is_default)
            values($1,$2,true)`, [id, spec.branch]);
        // Delivery sourceModule(reverse_movement) is warehouse, while the
        // reverse-logistics module for branch managers is central_kitchen_orders.
        // Give only the module actions the delivery route additionally checks.
        if (role === "source" || role === "receiver")
          await q(c, `insert into user_permissions(user_id,module,actions) values
            ($1,'warehouse',ARRAY['view','edit']::text[])`, [id]);
        if (role === "source")
          await q(c, `insert into user_permissions(user_id,module,actions) values
            ($1,'delivery_tasks',ARRAY['view','create','edit']::text[])`, [id]);
        ids[role] = id;
        credentials[role] = { username, password };
      }
      const name = `TEMP return material ${tag}`;
      const item = await one(c, `insert into warehouse_items(name,category,unit,sku,current_stock,is_active)
        values($1,'raw','كجم',$2,0,true) returning id`, [name, `REV-${tag}`]);
      const stock = await one(c, `insert into branch_stock(branch_id,item_id,current_quantity,reserved_quantity)
        values($1,$2,12,0) returning id`, [source, item.id]);
      const transfer = await one(c, `insert into material_transfers
        (transfer_number,source_type,source_branch_id,destination_branch_id,transfer_date,delivery_date,status,
         created_by,received_by,stock_posting_policy)
        values($1,'warehouse',$2,$3,current_date::text,current_date::text,'delivered',$4,$5,'on_receipt')
        returning id`, [`REV-ORIGIN-${tag}`, warehouse, source, ids.source, ids.source]);
      const line = await one(c, `insert into material_transfer_items
        (transfer_id,item_id,item_name,category,unit,quantity,received_quantity)
        values($1,$2,$3,'raw','كجم',12,12) returning id`, [transfer.id, item.id, name]);
      // Write credentials outside git before committing the fixture. Never log them.
      const fixture = { tag, source, warehouse, ids, itemId: item.id, stockId: stock.id,
        transferId: transfer.id, transferItemId: line.id, baseline: { source: 12, destination: 0 },
        credentials };
      fs.writeFileSync(file, JSON.stringify(fixture, null, 2), { mode: 0o600, flag: "wx" });
      await q(c, "COMMIT");
      console.log(JSON.stringify({ file, sourceBranchId: source, destinationBranchId: warehouse,
        accountIds: ids, itemId: item.id, stockId: stock.id, transferId: transfer.id,
        transferItemId: line.id, baseline: fixture.baseline }));
    } else {
      const file = process.argv[3];
      if (!file || !path.resolve(file).startsWith(os.tmpdir() + path.sep))
        throw Error("Cleanup requires /tmp fixture path");
      const f = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!/^e2e_rev_[a-f0-9]{14}$/.test(f.source) || f.warehouse !== "main_warehouse" ||
          !Object.keys(f.ids).length || !Object.values(f.ids).every(id => /^[a-f0-9-]{36}$/.test(id)))
        throw Error("Invalid fixture identity");
      const match = await one(c, `select id from material_transfers
        where id=$1 and transfer_number=$2 and destination_branch_id=$3`, [
        f.transferId, `REV-ORIGIN-${f.tag}`, f.source]);
      if (!match) throw Error("Fixture provenance mismatch; refusing cleanup");
      const users = Object.values(f.ids);
      const movements = (await q(c, `select id from reverse_movements
        where original_transfer_item_id=$1 and created_by=any($2::varchar[])`, [f.transferItemId, users])).rows.map(r => r.id);
      const deliveries = (await q(c, `select id from delivery_assignments
        where source_type='reverse_movement' and source_id=any($1::bigint[])`, [movements])).rows.map(r => r.id);
      const outbox = (await q(c, `select id from delivery_notification_outbox
        where assignment_id=any($1::bigint[])`, [deliveries])).rows.map(r => r.id);
      await q(c, `delete from sessions where sess->>'userId'=any($1::text[]) or sess->'pendingTwoFactor'->>'userId'=any($1::text[])`, [users]);
      await q(c, `delete from system_notifications where
        auto_source='delivery_task' and split_part(dedupe_key,':',2)=any($1::text[])
        and created_by=any($2::varchar[])`, [outbox.map(String), users]);
      await q(c, `delete from notification_reads where user_id=any($1::varchar[])`, [users]);
      await q(c, `delete from delivery_notification_outbox where assignment_id=any($1::bigint[])`, [deliveries]);
      await q(c, `delete from delivery_assignment_events where assignment_id=any($1::bigint[])`, [deliveries]);
      await q(c, `delete from delivery_assignments where id=any($1::bigint[])`, [deliveries]);
      await q(c, `delete from reverse_movement_events where movement_id=any($1::bigint[])`, [movements]);
      await q(c, `delete from reverse_product_reservations where movement_id=any($1::bigint[])`, [movements]);
      await q(c, `delete from warehouse_movement_logs where item_id=$1 and (reference_type='reverse_movement' and reference_id=any($2::int[]) or created_by=any($3::varchar[]))`, [f.itemId, movements, users]);
      await q(c, `delete from reverse_movements where id=any($1::bigint[])`, [movements]);
      await q(c, `delete from material_transfer_items where id=$1 and transfer_id=$2`, [f.transferItemId, f.transferId]);
      await q(c, `delete from material_transfers where id=$1`, [f.transferId]);
      await q(c, `delete from branch_stock where id=$1 and branch_id=$2 and item_id=$3`, [f.stockId, f.source, f.itemId]);
      await q(c, `delete from warehouse_items where id=$1 and sku=$2`, [f.itemId, `REV-${f.tag}`]);
      // Only notifications addressed exclusively to the four fixture accounts.
      await q(c, `delete from notifications where user_id=any($1::varchar[])`, [users]);
      await q(c, `delete from warehouse_notifications where user_id=any($1::varchar[])`, [users]);
      await q(c, `delete from system_audit_logs where user_id=any($1::varchar[])`, [users]);
      await q(c, `delete from user_permissions where user_id=any($1::varchar[])`, [users]);
      await q(c, `delete from user_branch_access where user_id=any($1::varchar[])`, [users]);
      await q(c, `delete from users where id=any($1::varchar[])`, [users]);
      await q(c, `delete from branches where id=$1`, [f.source]);
      await q(c, "COMMIT");
      fs.unlinkSync(file);
      console.log(JSON.stringify({ cleaned: true, sourceBranchId: f.source, transferItemId: f.transferItemId }));
    }
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    // Suppress connection-string details; keep fixture file on cleanup failure.
    console.error(`Fixture ${action} failed: ${err.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted-url]")}`);
    process.exitCode = 1;
  } finally { await c.end().catch(() => {}); }
}
main();