// Read-only external snapshot. Verification writes only temporary development
// tables, then rolls back. This script never deletes or restores live records.
import pg from "pg";
import { mkdir, writeFile, readFile, chmod } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const TABLES = [
  "central_kitchen_orders", "central_kitchen_order_items", "central_kitchen_order_events",
  "central_kitchen_shadow_inventory_config", "central_kitchen_shadow_inventory_entries",
  "central_kitchen_runtime", "central_kitchen_inventory_allocations", "central_kitchen_inventory_movements",
  "central_kitchen_batch_recipe_snapshots", "central_kitchen_batch_materials",
  "central_kitchen_batch_material_movements", "central_kitchen_recipes",
  "central_kitchen_recipe_ingredients", "central_kitchen_recipe_operations",
  "advanced_production_orders", "production_order_items", "production_order_schedules",
  "production_ai_plans", "production_orders", "daily_production_batches",
  "manual_production_operations", "finished_goods_inventory", "finished_goods_transfers",
  "production_inventory_logs", "branch_stock", "material_transfers", "material_transfer_items",
  "warehouse_requests", "warehouse_request_items", "warehouse_movement_logs",
  "warehouse_items", "display_bar_receipts", "display_bar_daily_summary",
];
const quote = value => {
  assert(/^[a-z_][a-z_0-9]*$/.test(value), "Unexpected SQL identifier");
  return `"${value}"`;
};
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
assert(process.env.SUPABASE_DATABASE_URL, "External connection is required");
assert(process.env.DATABASE_URL, "Local verification connection is required");
assert(["localhost", "127.0.0.1", "helium", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname),
  "Verification must target local development only");
assert(process.env.DATABASE_URL !== process.env.SUPABASE_DATABASE_URL);

const source = new pg.Client({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
});
const verification = new pg.Client({ connectionString: process.env.DATABASE_URL });
const output = `.local/backups/production-trial-inventory-${new Date().toISOString().replace(/[:.]/g, "-")}`;
let verified = false;
try {
  await mkdir(output, { recursive: true, mode: 0o700 });
  await chmod(output, 0o700);
  await source.connect();
  await verification.connect();
  await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await source.query("SET LOCAL statement_timeout = '60s'");
  await verification.query("BEGIN");
  const manifest = {
    format: "lossless-postgresql-json-array-gzip-v1",
    exportedAt: new Date().toISOString(),
    sourceReadOnly: true, verificationScope: "local temporary table row/type roundtrip; not a full restore",
    tables: [], missingTables: [],
  };
  const existing = (await source.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])", [TABLES],
  )).rows.map(row => row.tablename);
  const metadata = {};
  for (const table of TABLES) {
    if (!existing.includes(table)) { manifest.missingTables.push(table); continue; }
    const columns = (await source.query(`
      SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
             a.attnotnull AS not_null, pg_get_expr(d.adbin,d.adrelid) AS default_expression,
             a.attidentity AS identity, a.attgenerated AS generated
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped
      ORDER BY a.attnum`, [table])).rows;
    const constraints = (await source.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid=$1::regclass`, [`public.${table}`])).rows;
    const triggers = (await source.query(`
      SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition,
             pg_get_functiondef(t.tgfoid) AS function_definition
      FROM pg_trigger t WHERE t.tgrelid=$1::regclass AND NOT t.tgisinternal`, [`public.${table}`])).rows;
    const indexes = (await source.query(
      "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1", [table],
    )).rows;
    const sequences = [];
    for (const column of columns.filter(col => col.identity || col.default_expression?.includes("nextval"))) {
      const sequence = (await source.query("SELECT pg_get_serial_sequence($1,$2) AS name", [`public.${table}`, column.name])).rows[0].name;
      if (sequence && /^public\.[a-z_][a-z_0-9]*$/.test(sequence)) {
        const state = (await source.query(`SELECT last_value::text,is_called FROM public.${quote(sequence.slice(7))}`)).rows[0];
        sequences.push({ name: sequence, ...state });
      }
    }
    metadata[table] = { columns, constraints, triggers, indexes, sequences };
    // Keep PostgreSQL's JSON text untouched: JS number parsing loses precision.
    const rawRows = (await source.query(
      `SELECT row_to_json(t)::text AS document FROM public.${quote(table)} t ORDER BY row_to_json(t)::text`,
    )).rows.map(row => row.document);
    const raw = Buffer.from(`[${rawRows.join(",")}]`);
    const compressed = gzipSync(raw);
    const filename = `${table}.json.gz`;
    await writeFile(`${output}/${filename}`, compressed, { mode: 0o600 });
    const recovered = gunzipSync(await readFile(`${output}/${filename}`));
    assert.equal(sha(recovered), sha(raw));

    // Use the source's exact column types, independent of dev schema drift.
    const declarations = columns.map(column => {
      assert(/^(?:smallint|integer|bigint|real|double precision|boolean|text|date|jsonb?|uuid|numeric(?:\(\d+(?:,\d+)?\))?|character varying(?:\(\d+\))?|timestamp(?:\(\d+\))? (?:with|without) time zone|time(?:\(\d+\))? (?:with|without) time zone)(?:\[\])?$/.test(column.type),
        `Unsupported type in ${table}`);
      return `${quote(column.name)} ${column.type}`;
    });
    const temp = quote(`verify_${table}`);
    await verification.query(`CREATE TEMP TABLE ${temp} (${declarations.join(",")}) ON COMMIT DROP`);
    await verification.query(`INSERT INTO ${temp} SELECT * FROM json_populate_recordset(NULL::${temp},$1::json)`, [recovered.toString()]);
    const roundtrip = (await verification.query(`SELECT
      (SELECT count(*)::int FROM ${temp}) AS count,
      NOT EXISTS (
        (SELECT value FROM jsonb_array_elements($1::jsonb) EXCEPT ALL SELECT to_jsonb(t) FROM ${temp} t)
        UNION ALL
        (SELECT to_jsonb(t) FROM ${temp} t EXCEPT ALL SELECT value FROM jsonb_array_elements($1::jsonb))
      ) AS identical`, [recovered.toString()])).rows[0];
    assert.equal(roundtrip.count, rawRows.length);
    assert.equal(roundtrip.identical, true, `Roundtrip mismatch: ${table}`);
    await verification.query(`DROP TABLE ${temp}`);
    manifest.tables.push({ table, rows: rawRows.length, filename, sha256: sha(raw), gzipSha256: sha(compressed), restoredRowsVerified: true });
  }
  const dependencies = (await source.query(`
    SELECT c.conname, c.conrelid::regclass::text AS child_table,
           c.confrelid::regclass::text AS parent_table, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c WHERE c.contype='f' AND
      (c.conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[]))
       OR c.confrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[])))
    ORDER BY child_table,c.conname`, [existing])).rows;
  await writeFile(`${output}/schema-metadata.json`, JSON.stringify({ metadata, dependencies }, null, 2), { mode: 0o600 });
  await source.query("ROLLBACK");
  await verification.query("ROLLBACK");
  manifest.verificationCompleted = true;
  await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await writeFile(`${output}/RESTORE-NOTES.txt`,
    "Selective operational backup, NOT a complete database backup.\n"
    + "No credentials or users/authentication tables are included.\n"
    + "Each gzip expands to an exact PostgreSQL JSON array. Check manifest SHA256 before use.\n"
    + "Every table passed local temporary-table restore and exact JSONB multiset equality.\n"
    + "Full foreign-key/trigger-aware restore has NOT been rehearsed. Do not perform live cleanup until it is.\n"
    + "Restore must preserve parent product/recipe/branch/user identities, use a reviewed dependency order,\n"
    + "handle immutable ledger triggers under maintenance authorization, and verify quantities and sequence positions.\n"
    + "Do not overwrite shared warehouse/catalog/receipt tables indiscriminately or use TRUNCATE CASCADE.\n"
    + "A fresh final backup and stopped concurrent writes are required immediately before any later cleanup.\n",
    { mode: 0o600 });
  verified = true;
  console.log(JSON.stringify({ directory: output, tableCount: manifest.tables.length,
    rows: manifest.tables.reduce((sum,t) => sum+t.rows,0),
    verified, tables: manifest.tables.map(({table,rows})=>({table,rows})), missingTables: manifest.missingTables }));
} catch (error) {
  await source.query("ROLLBACK").catch(() => {});
  await verification.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({ verified, directory: output,
    code: error?.code || null, message: error instanceof assert.AssertionError ? error.message : "Backup/verification failed; no live writes performed" }));
  process.exitCode = 1;
} finally {
  await source.end().catch(() => {});
  await verification.end().catch(() => {});
}