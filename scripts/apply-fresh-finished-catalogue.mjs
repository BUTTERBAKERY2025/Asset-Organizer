// Manual, explicitly approved replacement only; never called during startup/build.
import pg from "pg";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const local = process.argv.includes("--development");
assert(process.argv.includes("--confirm-102-new-records"), "Explicit fresh-record confirmation is required");
const backupPath = process.argv.find(v => v.startsWith("--backup="))?.slice(9);
assert(backupPath?.startsWith(".local/backups/finished-catalogue-"), "Verified private backup is required");
const sha = v => createHash("sha256").update(v).digest("hex");
const manifest = JSON.parse(await readFile(`${backupPath}/manifest.json`, "utf8"));
const compressed = await readFile(`${backupPath}/catalogue.json.gz`);
assert.equal(sha(compressed), manifest.sha256, "Backup integrity mismatch");
const backup = JSON.parse(gunzipSync(compressed));
const target = local ? "development" : "supabase:irgeqdrdaejhedlcbvzz";
assert.equal(backup.target, target, "Backup target mismatch");
assert.equal(manifest.productCount, backup.products.length);
const sourceBytes = await readFile("server/catalogue-source/kitchen-finished-products.json");
const source = JSON.parse(sourceBytes);
const sourceSha = sha(sourceBytes);
assert.equal(source.length, 102);
assert.equal(new Set(source.map(r => r.code.toLowerCase())).size, 102);
for (const r of source) {
  assert(r.name?.trim() && r.cashier_alias?.trim());
  assert(["حبة", "قطعة", "كوب", "علبة", "بوكس"].includes(r.unit));
  assert(typeof r.category === "string" && r.category.length > 0);
}
const connectionString = local ? process.env.DATABASE_URL : process.env.SUPABASE_DATABASE_URL;
assert(connectionString, "Database connection is required");
const url = new URL(connectionString);
if (local) assert(["helium", "localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
else assert(url.hostname === "db.irgeqdrdaejhedlcbvzz.supabase.co"
  || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(".irgeqdrdaejhedlcbvzz")),
  "Production target mismatch");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='10s'");
  await client.query("SET LOCAL statement_timeout='60s'");
  await client.query("SELECT pg_advisory_xact_lock(582030102)");
  await client.query("LOCK TABLE products IN ACCESS EXCLUSIVE MODE");
  await client.query("LOCK TABLE warehouse_items IN SHARE MODE");
  await client.query(await readFile("migrations/finished_catalogue_replacement_audit.sql", "utf8"));
  const existing = await client.query("SELECT new_product_ids FROM catalogue_fresh_replacements WHERE source_sha256=$1", [sourceSha]);
  if (existing.rowCount) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ target, replayed: true, inserted: existing.rows[0].new_product_ids.length }));
  } else {
    const current = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb)::text) hash FROM products p")).rows[0].hash;
    assert.equal(current, backup.fingerprint, "Catalogue changed since backup; review and snapshot again");
    const warehouseBefore = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.id),'[]'::jsonb)::text) hash FROM warehouse_items w")).rows[0].hash;
    const conflict = await client.query("SELECT count(*)::int n FROM products WHERE lower(sku)=ANY($1::text[])", [source.map(r => r.code.toLowerCase())]);
    assert.equal(conflict.rows[0].n, 0, "Source codes already exist: fresh import refused");
    await client.query(await readFile("migrations/039_finished_products_operational_sale_gates.sql", "utf8"));
    const before = (await client.query("SELECT * FROM products ORDER BY id")).rows;
    const retired = await client.query("UPDATE products SET is_active='false',operations_enabled=false,sale_enabled=false,updated_at=now()");
    const ids = [];
    for (const r of source) {
      const inserted = await client.query(`INSERT INTO products
        (sku,name,name_en,category,unit,product_type,base_price,price_excl_vat,is_active,operations_enabled,sale_enabled,notes)
        VALUES ($1,$2,$3,$4,$5,'finish',NULL,NULL,'false',true,false,$6) RETURNING id`,
      [r.code, r.name, r.cashier_alias, r.category, r.unit,
        `القائمة النهائية للمطبخ المركزي — صفحة ${r.source.page} صف ${r.source.row}. سجل جديد دون نقل رصيد أو سعر سابق. بانتظار التسعير.`]);
      ids.push(inserted.rows[0].id);
    }
    const stats = (await client.query(`SELECT count(*)::int total,
      count(*) FILTER (WHERE operations_enabled)::int operational,
      count(*) FILTER (WHERE is_active='true')::int sale_active,
      count(*) FILTER (WHERE id=ANY($1::int[]) AND (sale_enabled OR base_price IS NOT NULL OR price_excl_vat IS NOT NULL))::int unsafe
      FROM products`, [ids])).rows[0];
    assert.equal(stats.operational, 102);
    assert.equal(stats.sale_active, 0);
    assert.equal(stats.unsafe, 0);
    assert.equal(stats.total, before.length + 102);
    const warehouseAfter = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.id),'[]'::jsonb)::text) hash FROM warehouse_items w")).rows[0].hash;
    assert.equal(warehouseBefore, warehouseAfter, "Warehouse catalogue changed");
    await client.query(`INSERT INTO catalogue_fresh_replacements
      (source_sha256,target,backup_sha256,previous_products,new_product_ids,source_rows)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,
    [sourceSha, target, manifest.sha256, JSON.stringify(before), JSON.stringify(ids), JSON.stringify(source)]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ target, replayed: false, archived: retired.rowCount, inserted: ids.length, warehouseUnchanged: true, ...stats }));
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Replacement rolled back:", e instanceof Error ? e.message : "unknown error");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}