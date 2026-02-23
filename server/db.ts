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
  connectionTimeoutMillis: isSupabase ? 15000 : 5000,
  idleTimeoutMillis: isSupabase ? 120000 : 30000,
  max: isSupabase ? 15 : 25,
  min: isSupabase ? 3 : 8,
  statement_timeout: isSupabase ? 45000 : 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

pool.on('connect', (client) => {
  if (isSupabase) {
    client.query('SET statement_timeout = 45000').catch(() => {});
    client.query('SET plan_cache_mode = force_generic_plan').catch(() => {});
  }
});

export const db = drizzle(pool, { schema });

export async function warmupPool() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    const warmupCount = isSupabase ? 4 : 3;
    const warmups = Array.from({ length: warmupCount }, async () => {
      const c = await pool.connect();
      await c.query('SELECT 1');
      c.release();
    });
    await Promise.all(warmups);
    console.log(`Database pool warmed up with ${warmupCount + 1} connections`);
  } catch (err) {
    console.error('Pool warmup failed:', err);
  }
}

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
      `ALTER TABLE advanced_production_orders ADD COLUMN IF NOT EXISTS mto_items jsonb`,
      `CREATE INDEX IF NOT EXISTS idx_adv_prod_orders_source_branch ON advanced_production_orders(source_branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_adv_prod_orders_target_branch ON advanced_production_orders(target_branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_adv_prod_orders_status ON advanced_production_orders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_adv_prod_orders_created ON advanced_production_orders(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_prod_batches_branch_date ON daily_production_batches(branch_id, production_date)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_prod_batches_status ON daily_production_batches(status)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_journals_date ON cashier_journals(journal_date)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_journals_branch ON cashier_journals(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_inventory_items_branch ON inventory_items(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status)`,
      `CREATE INDEX IF NOT EXISTS idx_waste_reports_branch_date ON waste_reports(branch_id, report_date)`,
      `CREATE INDEX IF NOT EXISTS idx_waste_items_report ON waste_items(waste_report_id)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(attendance_date)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_records_branch ON attendance_records(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_employees_branch ON branch_employees(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_display_bar_receipts_branch_date ON display_bar_receipts(branch_id, receipt_date)`,
      // Notifications indexes
      `CREATE INDEX IF NOT EXISTS idx_notifications_target ON system_notifications(target_type, is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON system_notifications(scheduled_at) WHERE scheduled_at IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id, notification_id)`,
      // Shifts and schedules
      `CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee ON shift_assignments(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shift_assignments_date ON shift_assignments(assignment_date)`,
      // Audit logs
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
      // Users
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
      `CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id)`,
      // Journal entries
      `CREATE INDEX IF NOT EXISTS idx_cashier_journals_branch_date ON cashier_journals(branch_id, journal_date)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_journals_status ON cashier_journals(status)`,
      // Material requests
      `CREATE INDEX IF NOT EXISTS idx_material_requests_branch ON material_requests(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status)`,
      // Documents
      `CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC)`,
      // Production
      `CREATE INDEX IF NOT EXISTS idx_daily_prod_batches_product ON daily_production_batches(product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_prod_batches_destination ON daily_production_batches(destination)`,
      // Employee attendance composite
      `CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON attendance_records(branch_id, attendance_date)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, attendance_date)`,
    ];
    for (const mig of migrations) {
      try { await pool.query(mig); } catch (e) { /* index may already exist or table not found */ }
    }
    console.log("Startup migrations completed successfully");
  } catch (err) {
    console.error("Startup migration error:", err);
  }
}
