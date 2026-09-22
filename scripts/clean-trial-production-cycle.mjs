// One-off, snapshot-bound maintenance. Default is a transactionally rolled-back
// cleanup AND full restore rehearsal against the real schema. --apply requires
// the successful rehearsal certificate and the identical approved snapshot.
// Never use TRUNCATE CASCADE, disable FK triggers, or reset sequences.
import pg from "pg";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const [mode = "--rehearse", directory] = process.argv.slice(2);
assert(["--rehearse", "--apply"].includes(mode));
assert(directory?.startsWith(".local/backups/") && !directory.includes(".."));
const hash = data => createHash("sha256").update(data).digest("hex");
const q = name => {
  assert(/^[a-z_][a-z_0-9]*$/.test(name));
  return `"${name}"`;
};
const tableRef = name => `public.${q(name)}`;
const manifestBytes = await readFile(`${directory}/manifest.json`);
const manifest = JSON.parse(manifestBytes);
assert(manifest.verificationCompleted);
const schemaBytes = await readFile(`${directory}/schema-metadata.json`);
const schema = JSON.parse(schemaBytes).metadata;
const snapshots = new Map();
for (const entry of manifest.tables) {
  const bytes = await readFile(`${directory}/${entry.filename}`);
  assert.equal(hash(bytes), entry.gzipSha256);
  const json = gunzipSync(bytes).toString();
  assert.equal(hash(json), entry.sha256);
  snapshots.set(entry.table, { ...entry, json, ids: JSON.parse(json).map(row => row.id) });
}

const removeBeforeBatches = [
  "production_inventory_logs", "central_kitchen_batch_material_movements",
  "central_kitchen_inventory_movements", "central_kitchen_shadow_inventory_entries",
  "central_kitchen_inventory_allocations", "finished_goods_transfers",
  "material_transfer_items", "material_transfers",
  "central_kitchen_batch_materials", "central_kitchen_batch_recipe_snapshots",
  "manual_production_operations",
];
const removeAfterBalances = [
  "daily_production_batches", "central_kitchen_order_events", "central_kitchen_order_items",
  "central_kitchen_orders", "production_order_schedules", "production_order_items",
  "advanced_production_orders", "production_ai_plans", "production_orders",
];
const deletedTables = [...removeBeforeBatches, ...removeAfterBalances];
const immutableExceptions = [
  ["central_kitchen_order_events", "trg_central_kitchen_events_immutable"],
  ["central_kitchen_shadow_inventory_entries", "trg_central_kitchen_shadow_inventory_immutable"],
  ["central_kitchen_inventory_movements", "trg_central_kitchen_inventory_movements_immutable"],
];
// This run is authorized for the inventoried legacy data, not future recipe
// consumption or newer execution records. Abort rather than broaden scope.
for (const table of [
  "central_kitchen_batch_recipe_snapshots", "central_kitchen_batch_materials",
  "central_kitchen_batch_material_movements", "manual_production_operations",
  "production_orders", "production_order_schedules", "branch_stock",
]) assert.equal(snapshots.get(table)?.rows, 0, `Unexpected nonempty boundary: ${table}`);
for (const [table, trigger] of immutableExceptions) {
  assert(schema[table].triggers.some(t => t.tgname === trigger && t.tgenabled === "O"));
}
const batchIds = new Set(snapshots.get("daily_production_batches").ids);
const receipts = JSON.parse(snapshots.get("display_bar_receipts").json);
const receiptIds = receipts.filter(row => /^PROD-[0-9]+$/.test(row.production_batch || "")
  && batchIds.has(Number(row.production_batch.slice(5)))).map(row => row.id);
assert.equal(receiptIds.length, 46, "Approved receipt scope changed");
assert.equal(receipts.length - receiptIds.length, 10, "Preserved receipt scope changed");
const expectedBalanceIds = snapshots.get("finished_goods_inventory").ids;
const certificatePath = `${directory}/cleanup-rehearsal.json`;
const certificate = mode === "--apply" ? JSON.parse(await readFile(certificatePath)) : null;
const connection = process.env.SUPABASE_DATABASE_URL;
assert(connection, "External database connection required");
const identity = new URL(connection);
const targetFingerprint = hash(`${identity.hostname}:${identity.port}${identity.pathname}`);
const binding = {
  snapshotHash: hash(manifestBytes), schemaHash: hash(schemaBytes), targetFingerprint,
  scriptHash: hash(await readFile(new URL(import.meta.url))),
};
if (certificate) {
  assert(certificate.fullRestoreVerified && certificate.rolledBack);
  assert.deepEqual(certificate.binding, binding, "Rehearsal is not for this target/script/snapshot");
}

const client = new pg.Client({
  connectionString: connection, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
});
let output;
let committed = false;
const report = { mode, binding, startedAt: new Date().toISOString(), deleted: {}, zeroedStockRows: 0, preservedReceiptRows: 10 };
async function rowsJson(table, where = "", params = []) {
  const result = await client.query(
    `SELECT row_to_json(t)::text AS document FROM ${tableRef(table)} t ${where} ORDER BY row_to_json(t)::text`, params);
  return `[${result.rows.map(row => row.document).join(",")}]`;
}
async function assertSnapshotUnchanged() {
  for (const entry of snapshots.values()) {
    assert.equal(hash(await rowsJson(entry.table)), entry.sha256, `Snapshot changed: ${entry.table}`);
  }
}
async function triggerStates() {
  return (await client.query(`
    SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition,
           pg_get_functiondef(t.tgfoid) AS function_definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal
    ORDER BY c.relname,t.tgname`, [[...snapshots.keys()]])).rows;
}
async function setExceptions(enabled) {
  for (const [table, trigger] of immutableExceptions) {
    await client.query(`ALTER TABLE ${tableRef(table)} ${enabled ? "ENABLE" : "DISABLE"} TRIGGER ${q(trigger)}`);
  }
}
async function remove(table) {
  const snapshot = snapshots.get(table);
  if (!snapshot.rows) { report.deleted[table] = 0; return; }
  assert(snapshot.ids.every(Number.isSafeInteger), `Unsupported deletion identity: ${table}`);
  const result = await client.query(`DELETE FROM ${tableRef(table)} WHERE id=ANY($1::integer[])`, [snapshot.ids]);
  assert.equal(result.rowCount, snapshot.rows, `Deletion count mismatch: ${table}`);
  report.deleted[table] = result.rowCount;
}
async function cleanup() {
  await setExceptions(false);
  const result = await client.query("DELETE FROM public.display_bar_receipts WHERE id=ANY($1::integer[])", [receiptIds]);
  assert.equal(result.rowCount, receiptIds.length);
  report.deleted.display_bar_receipts = result.rowCount;
  for (const table of removeBeforeBatches) await remove(table);
  const stock = await client.query(`
    UPDATE public.finished_goods_inventory SET quantity=0,reserved_quantity=0,last_batch_id=NULL,updated_at=now()
    WHERE id=ANY($1::integer[])`, [expectedBalanceIds]);
  assert.equal(stock.rowCount, expectedBalanceIds.length);
  report.zeroedStockRows = stock.rowCount;
  for (const table of removeAfterBalances) await remove(table);
  await setExceptions(true);
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
}
async function verifyClean() {
  for (const table of deletedTables) {
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${tableRef(table)}`)).rows[0].n, 0, `Remaining rows: ${table}`);
  }
  const balance = (await client.query(`SELECT count(*)::int AS n,
    count(*) FILTER (WHERE quantity<>0 OR reserved_quantity<>0 OR last_batch_id IS NOT NULL)::int AS invalid
    FROM public.finished_goods_inventory`)).rows[0];
  assert.equal(balance.n, expectedBalanceIds.length);
  assert.equal(balance.invalid, 0);
  // Stock rows keep their identity and all descriptive/catalog fields.
  const stockUnchanged = (await client.query(`SELECT NOT EXISTS (
    (SELECT value - ARRAY['quantity','reserved_quantity','last_batch_id','updated_at']::text[]
       FROM jsonb_array_elements($1::jsonb)
     EXCEPT ALL SELECT to_jsonb(t) - ARRAY['quantity','reserved_quantity','last_batch_id','updated_at']::text[]
       FROM public.finished_goods_inventory t)
    UNION ALL
    (SELECT to_jsonb(t) - ARRAY['quantity','reserved_quantity','last_batch_id','updated_at']::text[]
       FROM public.finished_goods_inventory t
     EXCEPT ALL SELECT value - ARRAY['quantity','reserved_quantity','last_batch_id','updated_at']::text[]
       FROM jsonb_array_elements($1::jsonb))
  ) AS identical`, [snapshots.get("finished_goods_inventory").json])).rows[0].identical;
  assert(stockUnchanged);
  const expectedReceipts = await client.query(
    "SELECT value FROM jsonb_array_elements($1::jsonb) WHERE NOT ((value->>'id')::int=ANY($2::int[]))",
    [snapshots.get("display_bar_receipts").json, receiptIds]);
  const actual = JSON.parse(await rowsJson("display_bar_receipts"));
  assert.equal(actual.length, 10);
  // IDs and exact original rows are verified in PostgreSQL (not JS floats).
  assert.equal((await client.query(`SELECT NOT EXISTS (
      (SELECT to_jsonb(t) AS value FROM public.display_bar_receipts t EXCEPT ALL
       SELECT value FROM jsonb_array_elements($1::jsonb) WHERE NOT ((value->>'id')::int=ANY($2::int[])))
      UNION ALL
      (SELECT value FROM jsonb_array_elements($1::jsonb) WHERE NOT ((value->>'id')::int=ANY($2::int[]))
       EXCEPT ALL SELECT to_jsonb(t) FROM public.display_bar_receipts t)
    ) AS identical`, [snapshots.get("display_bar_receipts").json, receiptIds])).rows[0].identical, true);
  assert.equal(expectedReceipts.rowCount, 10);
  for (const entry of snapshots.values()) {
    if (!deletedTables.includes(entry.table) && !["finished_goods_inventory", "display_bar_receipts"].includes(entry.table)) {
      assert.equal(hash(await rowsJson(entry.table)), entry.sha256, `Protected snapshot changed: ${entry.table}`);
    }
  }
}
async function restoreRows(table, json = snapshots.get(table).json) {
  const result = await client.query(`INSERT INTO ${tableRef(table)}
    SELECT * FROM json_populate_recordset(NULL::${tableRef(table)},$1::json)`, [json]);
  return result.rowCount;
}
async function restore() {
  for (const table of [
    "production_ai_plans", "advanced_production_orders", "production_orders",
    "central_kitchen_orders", "central_kitchen_order_items",
    "production_order_items", "production_order_schedules", "daily_production_batches",
  ]) await restoreRows(table);
  const columns = schema.finished_goods_inventory.columns.map(column => column.name).filter(name => name !== "id");
  await client.query(`UPDATE public.finished_goods_inventory t
    SET ${columns.map(name => `${q(name)}=r.${q(name)}`).join(",")}
    FROM json_populate_recordset(NULL::public.finished_goods_inventory,$1::json) r WHERE t.id=r.id`,
  [snapshots.get("finished_goods_inventory").json]);
  for (const table of [
    "finished_goods_transfers", "material_transfers", "material_transfer_items",
    "central_kitchen_order_events", "central_kitchen_inventory_allocations",
    "central_kitchen_inventory_movements", "central_kitchen_shadow_inventory_entries",
    "production_inventory_logs", "central_kitchen_batch_recipe_snapshots",
    "central_kitchen_batch_materials", "central_kitchen_batch_material_movements", "manual_production_operations",
  ]) await restoreRows(table);
  await client.query(`INSERT INTO public.display_bar_receipts
    SELECT * FROM json_populate_recordset(NULL::public.display_bar_receipts,$1::json) r WHERE r.id=ANY($2::int[])`,
  [snapshots.get("display_bar_receipts").json, receiptIds]);
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  await assertSnapshotUnchanged();
}
async function protectionDigest() {
  const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND (tablename IN ('products','branches','users','chart_of_accounts','journal_entry_lines')
      OR tablename ~ '^(pos_|cashier_|accounting_|branch_daily_|daily_sales_data$|financial_sales$|sales_data_uploads$|journal_attachments$)')
    ORDER BY tablename`)).rows.map(row => row.tablename);
  const result = {};
  for (const table of tables) {
    const columns = (await client.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table])).rows
      .map(row => row.column_name)
      .filter(name => !/(password|secret|token|signature|file_data|image_data|private_key)/i.test(name));
    // Sensitive and potentially multi-GB blob fields are not fetched or hashed.
    result[table] = (await client.query(`SELECT count(*)::text AS rows,
      md5(coalesce(string_agg(h,',' ORDER BY h),'')) AS content_hash
      FROM (SELECT md5(row(${columns.map(q).join(",")})::text) AS h FROM ${tableRef(table)}) d`)).rows[0];
  }
  return result;
}
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='8s'");
  await client.query("SET LOCAL statement_timeout='60s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout='90s'");
  // Sorted ACCESS EXCLUSIVE locks also stop old app receipt reconciliation and
  // prevent writes between the fresh snapshot and committed cleanup.
  await client.query(`LOCK TABLE ${[...snapshots.keys()].sort().map(tableRef).join(",")} IN ACCESS EXCLUSIVE MODE`);
  await assertSnapshotUnchanged();
  const beforeTriggers = await triggerStates();
  const expectedTriggers = Object.entries(schema).flatMap(([table_name, value]) => value.triggers
    .map(({ tgname, tgenabled, definition, function_definition }) => ({ table_name, tgname, tgenabled, definition, function_definition })));
  assert.deepEqual([...beforeTriggers].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    expectedTriggers.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), "Trigger/schema drift");
  // Check columns and every constraint too: do not apply an old cleanup against
  // a newly migrated schema or a new FK dependency.
  const relations = (await client.query(`SELECT c.conname,c.conrelid::regclass::text AS child_table,
    c.confrelid::regclass::text AS parent_table,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c WHERE c.contype='f' AND
      (c.conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[]))
       OR c.confrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[])))
    ORDER BY child_table,c.conname`, [[...snapshots.keys()]])).rows;
  assert.deepEqual(relations, JSON.parse(schemaBytes).dependencies, "Foreign-key dependency drift");
  const protectedBefore = await protectionDigest();
  output = `${directory}/${mode === "--apply" ? "commit" : "rehearsal"}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(output, { recursive: true, mode: 0o700 });
  for (const entry of snapshots.values()) {
    const raw = await rowsJson(entry.table);
    const compressed = gzipSync(raw);
    await writeFile(`${output}/${entry.filename}`, compressed, { mode: 0o600 });
    assert.equal(hash(gunzipSync(await readFile(`${output}/${entry.filename}`))), entry.sha256);
  }
  await writeFile(`${output}/schema-metadata.json`, schemaBytes, { mode: 0o600 });
  await writeFile(`${output}/manifest.json`, manifestBytes, { mode: 0o600 });
  await cleanup();
  await verifyClean();
  assert.deepEqual(await triggerStates(), beforeTriggers, "Trigger states were not restored");
  assert.deepEqual(await protectionDigest(), protectedBefore, "Protected business data changed; abort");
  if (mode === "--rehearse") {
    await restore();
    assert.deepEqual(await triggerStates(), beforeTriggers);
    assert.deepEqual(await protectionDigest(), protectedBefore);
    report.fullRestoreVerified = true;
    await client.query("ROLLBACK");
    report.rolledBack = true;
    await writeFile(certificatePath, JSON.stringify(report, null, 2), { mode: 0o600 });
  } else {
    await writeFile(`${output}/precommit-verification.json`, JSON.stringify({ ...report, protectedBefore, verified: true }, null, 2), { mode: 0o600 });
    await client.query("COMMIT");
    committed = true;
    report.committed = true;
  }
  report.completedAt = new Date().toISOString();
  await writeFile(`${output}/result.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
} catch (error) {
  if (!committed) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({ mode, committed, output,
    code: error.code, message: error instanceof assert.AssertionError ? error.message : "Maintenance failed; inspect safely before retrying" }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}