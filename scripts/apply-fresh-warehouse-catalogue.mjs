// Manual confirmation only. Never run during startup/build or without a private snapshot.
import pg from "pg";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import XLSX from "xlsx";

const local = process.argv.includes("--development");
assert(process.argv.includes("--confirm-309-new-records"), "Explicit 309-record confirmation required");
const backupPath = process.argv.find(v => v.startsWith("--backup="))?.slice(9);
assert(/^\.local\/backups\/finished-catalogue-(development|production)-[^/]+$/.test(backupPath ?? ""), "Private snapshot required");
const target = local ? "development" : "supabase:irgeqdrdaejhedlcbvzz";
assert(backupPath.startsWith(`.local/backups/finished-catalogue-${local ? "development" : "production"}-`), "Snapshot environment mismatch");
const sha = v => createHash("sha256").update(v).digest("hex");
const manifest = JSON.parse(await readFile(`${backupPath}/manifest.json`, "utf8"));
const compressed = await readFile(`${backupPath}/catalogue.json.gz`);
assert.equal(sha(compressed), manifest.sha256, "Snapshot SHA-256 mismatch");
const backup = JSON.parse(gunzipSync(compressed));
assert.equal(backup.target, target, "Snapshot target mismatch");
assert.equal(manifest.target, local ? "development" : "production");
assert.equal(manifest.warehouseCount, backup.warehouse.length);
assert.equal(manifest.productCount, backup.products.length);
assert.equal(manifest.warehouseFingerprint, backup.warehouseFingerprint, "Warehouse fingerprint missing or mismatched; take a new snapshot");
assert.equal(manifest.fingerprint, backup.fingerprint);
const sourceBytes = await readFile("server/catalogue-source/warehouse-items-final.json");
const sourceDocument = JSON.parse(sourceBytes);
assert.deepEqual(sourceDocument.fields, ["sourceExcelRow", "sku", "name", "category", "unit"], "Unexpected source structure");
assert(Array.isArray(sourceDocument.rows), "Source rows missing");
const source = sourceDocument.rows.map(row => {
  assert(Array.isArray(row) && row.length === 5, "Invalid source row structure");
  const [sourceExcelRow, sku, name, category, unit] = row;
  assert(typeof name === "string", "Invalid source name");
  return { sourceExcelRow, sku, name, nameEn: name.match(/[A-Za-z][^\u0600-\u06ff]*/g)?.join(" ").replace(/^[\s/()-]+|[\s/()-]+$/g, "") || null, category, unit };
});
const sourceSha = sha(sourceBytes);
assert(Array.isArray(source) && source.length === 309, "Source must contain exactly 309 rows (exclude total)");
const excel = XLSX.read(await readFile("attached_assets/اصناف_المستودع_-9_1790345983778.xlsx"), { type: "buffer" });
assert.equal(excel.SheetNames.length, 1, "Unexpected Excel sheets");
const sheet = excel.Sheets[excel.SheetNames[0]];
assert.equal(sheet["!ref"], "A1:E314", "Excel source range changed");
const workbookRows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, blankrows: true });
assert.equal(workbookRows.length, 310, "Excel must have 309 items and one total row");
assert.deepEqual(workbookRows[309], ["-", "-", "الإجمالي", "-", "-"], "Excel footer must be explicitly excluded");
const normalizeUnit = { kg: "كجم", ltr: "لتر", pc: "قطعة" };
// Persist the application's five category keys; retain literal Excel labels in the source/audit.
const categoryKeys = {
  "raw material": "raw_materials",
  "packing items": "packaging",
  perishable: "perishables",
  "cleaning items": "cleaning",
  stationery: "stationery",
};
const categories = { "raw material": 180, "packing items": 55, perishable: 42, "cleaning items": 30, stationery: 2 };
const units = { "كجم": 178, "لتر": 37, "قطعة": 94 };
const categoryCounts = {}, unitCounts = {}, skus = new Set();
for (const [i, r] of source.entries()) {
  assert.equal(r.sourceExcelRow, i + 5, "Source row mismatch or footer included");
  const [ordinal, sku, name, category, unit] = workbookRows[i];
  assert.equal(ordinal, i + 1, "Excel item numbering changed");
  assert.deepEqual([r.sku, r.name, r.category, r.unit], [sku, name, category, normalizeUnit[String(unit).toLowerCase()]], `Excel mismatch at row ${i + 5}`);
  assert(/^\d{6}$/.test(r.sku) && !skus.has(r.sku), "Blank, invalid or duplicate source SKU");
  skus.add(r.sku);
  assert(typeof r.name === "string" && /[\u0600-\u06ff]/.test(r.name), "Source name required");
  assert(r.nameEn === null || /[A-Za-z]/.test(r.nameEn), "Invalid English name");
  assert(Object.hasOwn(categories, r.category), "Unexpected category");
  assert(Object.hasOwn(units, r.unit), "Unexpected unit");
  categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
  unitCounts[r.unit] = (unitCounts[r.unit] ?? 0) + 1;
}
assert.deepEqual(categoryCounts, categories, "Category counts mismatch");
assert.deepEqual(unitCounts, units, "Unit counts mismatch");
const connectionString = local ? process.env.DATABASE_URL : process.env.SUPABASE_DATABASE_URL;
assert(connectionString, "Database connection required");
const url = new URL(connectionString);
if (local) assert(["helium", "localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local target required");
else assert(url.hostname === "db.irgeqdrdaejhedlcbvzz.supabase.co"
  || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(".irgeqdrdaejhedlcbvzz")), "Production target mismatch");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='10s'");
  await client.query("SET LOCAL statement_timeout='120s'");
  await client.query("SELECT pg_advisory_xact_lock(582030309)");
  await client.query("LOCK TABLE warehouse_items IN ACCESS EXCLUSIVE MODE");
  await client.query("LOCK TABLE products IN SHARE MODE");
  await client.query(await readFile("migrations/warehouse_fresh_replacements.sql", "utf8"));
  const existing = await client.query("SELECT new_warehouse_ids,backup_sha256 FROM public.warehouse_fresh_replacements WHERE source_sha256=$1 AND target=$2", [sourceSha, target]);
  if (existing.rowCount) {
    const priorIds = existing.rows[0].new_warehouse_ids;
    assert(Array.isArray(priorIds) && priorIds.length === 309 && new Set(priorIds).size === 309, "Invalid prior audit record");
    const priorRows = (await client.query("SELECT id,sku,category,unit,is_active,current_stock,unit_price FROM public.warehouse_items WHERE id=ANY($1::int[]) ORDER BY id", [priorIds])).rows;
    assert.equal(priorRows.length, 309, "Previously inserted items are missing");
    for (const [i, row] of priorRows.entries()) {
      assert.equal(row.id, priorIds[i], "Previous import identities changed");
      assert.equal(row.sku, source[i].sku);
      assert.equal(row.category, categoryKeys[source[i].category]);
      assert.equal(row.unit, source[i].unit);
    }
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ target, replayed: true, inserted: 309 }));
  } else {
    const warehouseBefore = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.id),'[]'::jsonb)::text) hash FROM public.warehouse_items w")).rows[0].hash;
    const productsBefore = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb)::text) hash FROM public.products p")).rows[0].hash;
    assert.equal(warehouseBefore, backup.warehouseFingerprint, "Warehouse drift since snapshot; take a new snapshot");
    assert.equal(productsBefore, backup.fingerprint, "Products drift since snapshot; take a new snapshot");
    const previous = (await client.query("SELECT * FROM public.warehouse_items ORDER BY id")).rows;
    assert.equal(previous.length, backup.warehouse.length);
    // Historical SKUs intentionally stay on archived records; confirmed SKU index is non-unique.
    const retired = await client.query("UPDATE public.warehouse_items SET is_active=false,updated_at=now() WHERE is_active IS DISTINCT FROM false");
    // One network round trip keeps the exclusive catalogue lock short on remote DBs.
    const inserted = await client.query(
      `INSERT INTO public.warehouse_items (sku,name,name_en,category,unit,current_stock,unit_price,is_active)
       SELECT row->>'sku',row->>'name',row->>'nameEn',row->>'category',row->>'unit',0,NULL,true
       FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS s(row,ordinal)
       ORDER BY ordinal RETURNING id,sku`,
      [JSON.stringify(source.map(r => ({ ...r, category: categoryKeys[r.category] })))],
    );
    const insertedBySku = new Map(inserted.rows.map(row => [row.sku, row.id]));
    const ids = source.map(row => insertedBySku.get(row.sku));
    assert.equal(new Set(ids).size, 309);
    const insertedRows = (await client.query("SELECT id,sku,name,name_en,category,unit,current_stock,unit_price,is_active FROM public.warehouse_items WHERE id=ANY($1::int[]) ORDER BY id", [ids])).rows;
    assert.equal(insertedRows.length, 309);
    for (const [i, row] of insertedRows.entries()) {
      const r = source[i];
      assert.equal(row.id, ids[i]);
      assert.equal(row.sku, r.sku);
      assert.equal(row.name, r.name);
      assert.equal(row.name_en, r.nameEn);
      assert.equal(row.category, categoryKeys[r.category]);
      assert.equal(row.unit, r.unit);
      assert.equal(Number(row.current_stock), 0);
      assert.equal(row.unit_price, null);
      assert.equal(row.is_active, true);
    }
    const after = (await client.query("SELECT * FROM public.warehouse_items WHERE id=ANY($1::int[]) ORDER BY id", [previous.map(r => r.id)])).rows;
    assert.equal(after.length, previous.length);
    for (const [i, row] of after.entries()) {
      const original = previous[i];
      assert.equal(row.id, original.id);
      for (const key of Object.keys(original)) {
        if (key === "is_active" || key === "updated_at") continue;
        assert.deepEqual(row[key], original[key], `Historical warehouse row ${row.id} changed: ${key}`);
      }
      assert.equal(row.is_active, false);
      if (original.is_active === false) assert.deepEqual(row.updated_at, original.updated_at);
    }
    const productsAfter = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb)::text) hash FROM public.products p")).rows[0].hash;
    assert.equal(productsAfter, productsBefore, "Products changed");
    await client.query(`INSERT INTO public.warehouse_fresh_replacements
      (source_sha256,target,backup_sha256,previous_warehouse,new_warehouse_ids,source_rows)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,
    [sourceSha, target, manifest.sha256, JSON.stringify(previous), JSON.stringify(ids), JSON.stringify(source)]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ target, replayed: false, archived: retired.rowCount, inserted: ids.length, productsUnchanged: true }));
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Warehouse replacement rolled back:", e instanceof Error ? e.message : "unknown error");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}