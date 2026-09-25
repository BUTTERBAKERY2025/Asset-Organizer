// Read-only snapshot before a reviewed catalogue replacement.
import pg from "pg";
import assert from "node:assert/strict";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const local = process.argv.includes("--development");
const connectionString = local ? process.env.DATABASE_URL : process.env.SUPABASE_DATABASE_URL;
assert(connectionString, "Configured database connection is required");
const url = new URL(connectionString);
if (local) {
  assert(["helium", "localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local target required");
} else {
  const ref = "irgeqdrdaejhedlcbvzz";
  assert(url.hostname === `db.${ref}.supabase.co`
    || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(`.${ref}`)),
  "Connection does not match the reviewed production project");
}
const client = new pg.Client({
  connectionString, connectionTimeoutMillis: 15000,
  ...(local ? {} : { ssl: { rejectUnauthorized: false } }),
});
const directory = `.local/backups/finished-catalogue-${local ? "development" : "production"}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '60s'");
  const products = (await client.query("SELECT * FROM public.products ORDER BY id")).rows;
  const warehouse = (await client.query("SELECT * FROM public.warehouse_items ORDER BY id")).rows;
  const fingerprint = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb)::text) hash FROM public.products p")).rows[0].hash;
  const warehouseFingerprint = (await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.id),'[]'::jsonb)::text) hash FROM public.warehouse_items w")).rows[0].hash;
  const data = Buffer.from(JSON.stringify({ target: local ? "development" : "supabase:irgeqdrdaejhedlcbvzz", createdAt: new Date().toISOString(), fingerprint, warehouseFingerprint, products, warehouse }));
  const compressed = gzipSync(data);
  assert(gunzipSync(compressed).equals(data), "Snapshot verification failed");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(`${directory}/catalogue.json.gz`, compressed, { mode: 0o600 });
  const manifest = { directory, target: local ? "development" : "production", productCount: products.length, warehouseCount: warehouse.length, fingerprint, warehouseFingerprint, sha256: createHash("sha256").update(compressed).digest("hex") };
  await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await client.query("COMMIT");
  console.log(JSON.stringify(manifest));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Snapshot failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}