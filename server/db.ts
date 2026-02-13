import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use local DATABASE_URL first, then Supabase if local is not available
// To use Supabase: set USE_SUPABASE=true in environment variables
const useSupabase = process.env.USE_SUPABASE === 'true';
const connectionString = useSupabase 
  ? (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL)
  : (process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);

if (!connectionString) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Auto-detect Supabase from connection string (contains 'supabase' in URL)
const isSupabaseUrl = connectionString.includes('supabase');
const isSupabase = useSupabase || isSupabaseUrl;

// Log connection info for debugging (without password)
const sanitizedUrl = connectionString.replace(/:([^:@]+)@/, ':***@');
console.log(`Database connection: ${sanitizedUrl.substring(0, 50)}...`);
console.log(`SSL enabled: ${isSupabase}`);

export const pool = new Pool({ 
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
  min: 2,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const db = drizzle(pool, { schema });

export async function runStartupMigrations() {
  try {
    const migrations = [
      `ALTER TABLE backups ADD COLUMN IF NOT EXISTS table_count integer`,
      `ALTER TABLE backups ADD COLUMN IF NOT EXISTS row_count integer`,
      `ALTER TABLE backups ADD COLUMN IF NOT EXISTS backup_data text`,
      `ALTER TABLE backups ADD COLUMN IF NOT EXISTS error_message text`,
      `ALTER TABLE backups ADD COLUMN IF NOT EXISTS restored_at timestamp`,
      `ALTER TABLE backups ADD COLUMN IF NOT EXISTS restored_by varchar`,
      `INSERT INTO display_bar_receipts (branch_id, product_id, receipt_date, receipt_time, quantity, production_batch, notes)
       SELECT dpb.branch_id, dpb.product_id, dpb.production_date, '08:00', dpb.quantity, 'PROD-' || dpb.id,
         'استلام تلقائي من الإنتاج الفعلي اليومي - ' || dpb.product_name
       FROM daily_production_batches dpb
       WHERE dpb.destination = 'display_bar' AND dpb.status = 'finished' AND dpb.product_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM display_bar_receipts dbr WHERE dbr.production_batch = 'PROD-' || dpb.id)`,
    ];
    for (const mig of migrations) {
      await pool.query(mig);
    }
    console.log("Startup migrations completed successfully");
  } catch (err) {
    console.error("Startup migration error:", err);
  }
}
