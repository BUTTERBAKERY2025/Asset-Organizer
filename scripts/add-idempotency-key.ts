// إضافة عمود مفتاح التمييز لجدول مبيعات POS (آمنة وقابلة للتكرار)
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS idempotency_key text`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_sales_idempotency ON pos_sales (branch_id, idempotency_key) WHERE idempotency_key IS NOT NULL`);
  console.log("done");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
