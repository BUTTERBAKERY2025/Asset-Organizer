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
  // PERF: raised from 15→30 to prevent pool exhaustion when many users hit hub-bundle
  // (20+ parallel queries per request). Supabase free tier supports 60 concurrent.
  max: isSupabase ? 30 : 25,
  min: isSupabase ? 5 : 8,
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
      // السلف: أعمدة الموافقة المبدئية (اعتماد على مرحلتين)
      `ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS pre_approved_by varchar REFERENCES users(id)`,
      `ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS pre_approved_at timestamp`,
      `ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS pre_approver_note text`,
      // Phase 8: GPS columns on daily-log photos
      `ALTER TABLE project_daily_log_photos ADD COLUMN IF NOT EXISTS gps_latitude real`,
      `ALTER TABLE project_daily_log_photos ADD COLUMN IF NOT EXISTS gps_longitude real`,
      `ALTER TABLE project_daily_log_photos ADD COLUMN IF NOT EXISTS gps_accuracy real`,
      `ALTER TABLE project_daily_log_photos ADD COLUMN IF NOT EXISTS captured_at timestamp`,
      `ALTER TABLE project_daily_log_photos ADD COLUMN IF NOT EXISTS device_info text`,
      // Phase 8: Field Checklist templates + items + instances
      `CREATE TABLE IF NOT EXISTS field_checklist_templates (
        id serial PRIMARY KEY,
        name text NOT NULL,
        description text,
        category text NOT NULL,
        trade text,
        is_active boolean DEFAULT true NOT NULL,
        created_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklist_templates_category ON field_checklist_templates(category)`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklist_templates_active ON field_checklist_templates(is_active)`,
      `CREATE TABLE IF NOT EXISTS field_checklist_template_items (
        id serial PRIMARY KEY,
        template_id integer NOT NULL REFERENCES field_checklist_templates(id) ON DELETE CASCADE,
        sequence integer NOT NULL,
        text text NOT NULL,
        is_required boolean DEFAULT true NOT NULL,
        requires_photo boolean DEFAULT false NOT NULL,
        notes text
      )`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklist_template_items_template ON field_checklist_template_items(template_id)`,
      `CREATE TABLE IF NOT EXISTS field_checklists (
        id serial PRIMARY KEY,
        template_id integer REFERENCES field_checklist_templates(id),
        title text NOT NULL,
        category text NOT NULL,
        project_id integer REFERENCES construction_projects(id) ON DELETE CASCADE,
        contract_id integer REFERENCES construction_contracts(id) ON DELETE SET NULL,
        daily_log_id integer REFERENCES project_daily_logs(id) ON DELETE SET NULL,
        branch_id varchar REFERENCES branches(id),
        assigned_to varchar REFERENCES users(id),
        due_date text,
        status text DEFAULT 'open' NOT NULL,
        completed_at timestamp,
        completed_by varchar REFERENCES users(id),
        pass_count integer DEFAULT 0 NOT NULL,
        fail_count integer DEFAULT 0 NOT NULL,
        na_count integer DEFAULT 0 NOT NULL,
        total_count integer DEFAULT 0 NOT NULL,
        notes text,
        created_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklists_project ON field_checklists(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklists_contract ON field_checklists(contract_id)`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklists_status ON field_checklists(status)`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklists_assigned ON field_checklists(assigned_to)`,
      `CREATE TABLE IF NOT EXISTS field_checklist_items (
        id serial PRIMARY KEY,
        checklist_id integer NOT NULL REFERENCES field_checklists(id) ON DELETE CASCADE,
        sequence integer NOT NULL,
        text text NOT NULL,
        is_required boolean DEFAULT true NOT NULL,
        requires_photo boolean DEFAULT false NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        notes text,
        photos jsonb,
        checked_by varchar REFERENCES users(id),
        checked_at timestamp
      )`,
      `CREATE INDEX IF NOT EXISTS idx_field_checklist_items_checklist ON field_checklist_items(checklist_id)`,
      // Phase 11: Report schedules + runs (WhatsApp automated monthly reports)
      `CREATE TABLE IF NOT EXISTS report_schedules (
        id serial PRIMARY KEY,
        name text NOT NULL,
        report_type text NOT NULL,
        branch_id varchar REFERENCES branches(id) ON DELETE SET NULL,
        recipients jsonb NOT NULL,
        day_of_month integer DEFAULT 1 NOT NULL,
        hour integer DEFAULT 8 NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        last_run_at timestamp,
        next_run_at timestamp,
        notes text,
        created_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at)`,
      `CREATE INDEX IF NOT EXISTS idx_report_schedules_branch ON report_schedules(branch_id)`,
      `CREATE TABLE IF NOT EXISTS report_runs (
        id serial PRIMARY KEY,
        schedule_id integer NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
        run_at timestamp DEFAULT now() NOT NULL,
        period_month text NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        summary jsonb,
        message_body text,
        recipients_count integer DEFAULT 0 NOT NULL,
        sent_count integer DEFAULT 0 NOT NULL,
        failed_count integer DEFAULT 0 NOT NULL,
        error_message text,
        triggered_by varchar REFERENCES users(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_report_runs_schedule ON report_runs(schedule_id)`,
      `CREATE INDEX IF NOT EXISTS idx_report_runs_run_at ON report_runs(run_at)`,
      `ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0 NOT NULL`,
      `ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS last_attempt_at timestamp`,
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
      `CREATE INDEX IF NOT EXISTS idx_accounting_exports_branch ON accounting_exports(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_quality_checks_branch ON quality_checks(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_ops_summary_branch ON daily_operations_summary(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_monthly_targets_branch ON branch_monthly_targets(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_monthly_targets_month ON branch_monthly_targets(year_month)`,
      `CREATE INDEX IF NOT EXISTS idx_incentive_awards_branch ON incentive_awards(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_daily_challenges_branch ON cashier_daily_challenges(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_product_commissions_branch ON product_commissions(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_achievement_bonus_branch ON branch_achievement_bonus(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_product_sales_branch ON cashier_product_sales(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_commission_calculations_branch ON commission_calculations(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_daily_sales_branch ON branch_daily_sales(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_shift_perf_branch ON cashier_shift_performance(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_production_ai_plans_branch ON production_ai_plans(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sales_data_uploads_branch ON sales_data_uploads(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_assignments_branch ON user_assignments(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_branch ON user_permission_overrides(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch ON user_branch_access(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_branch_access_user ON user_branch_access(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_shift_targets_branch ON cashier_shift_targets(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_avg_ticket_targets_branch ON average_ticket_targets(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_performance_alerts_branch ON performance_alerts(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shift_perf_tracking_branch ON shift_performance_tracking(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_campaign_budget_alloc_branch ON campaign_budget_allocations(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_campaign_expenses_branch ON campaign_expenses(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_marketing_perf_reports_branch ON marketing_performance_reports(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_marketing_assets_branch ON marketing_assets(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_schedule_templates_branch ON schedule_templates(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_influencer_contracts_branch ON influencer_contracts(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_travel_requests_branch ON travel_requests(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pos_invoice_settings_branch ON pos_invoice_settings(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pos_sales_branch ON pos_sales(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pos_sales_date ON pos_sales(sale_date)`,
      `CREATE INDEX IF NOT EXISTS idx_pos_sales_branch_date ON pos_sales(branch_id, sale_date)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_shifts_branch ON branch_shifts(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_daily_closures_branch ON branch_daily_closures(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_daily_closures_date ON branch_daily_closures(closure_date)`,
      `CREATE INDEX IF NOT EXISTS idx_branch_daily_closures_branch_date ON branch_daily_closures(branch_id, closure_date)`,
      `CREATE INDEX IF NOT EXISTS idx_visitor_logs_branch ON visitor_logs(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_exec_correspondence_branch ON exec_correspondence(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_branch ON documents(branch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_journals_cashier ON cashier_journals(cashier_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_journals_discrepancy ON cashier_journals(discrepancy_status)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_breakdowns_journal ON cashier_payment_breakdowns(journal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cashier_journals_branch_date ON cashier_sales_journals(branch_id, journal_date)`,
      // Construction enhancements: contractor link on payment_requests + new tables
      `ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS contractor_id integer REFERENCES contractors(id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_requests_contractor ON payment_requests(contractor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_requests_project ON payment_requests(project_id)`,
      `CREATE TABLE IF NOT EXISTS project_expenses (
        id SERIAL PRIMARY KEY,
        project_id integer NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
        contractor_id integer REFERENCES contractors(id),
        category_id integer REFERENCES construction_categories(id),
        expense_date text NOT NULL,
        amount real NOT NULL,
        description text NOT NULL,
        beneficiary_name text,
        payment_method text,
        reference_number text,
        invoice_number text,
        attachment_url text,
        notes text,
        created_by varchar REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON project_expenses(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_expenses_contractor ON project_expenses(contractor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_expenses_date ON project_expenses(expense_date)`,
      `CREATE TABLE IF NOT EXISTS project_daily_logs (
        id SERIAL PRIMARY KEY,
        project_id integer NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
        branch_id varchar REFERENCES branches(id),
        contractor_id integer REFERENCES contractors(id),
        log_date text NOT NULL,
        supervisor_name text NOT NULL,
        supervisor_role text,
        work_description text NOT NULL,
        progress_today integer DEFAULT 0,
        workers_count integer DEFAULT 0,
        equipment_used text,
        weather text,
        issues text,
        notes text,
        created_by varchar REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_project_daily_logs_project ON project_daily_logs(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_daily_logs_date ON project_daily_logs(log_date)`,
      `CREATE INDEX IF NOT EXISTS idx_project_daily_logs_project_date ON project_daily_logs(project_id, log_date)`,
      `CREATE INDEX IF NOT EXISTS idx_project_daily_logs_contractor ON project_daily_logs(contractor_id)`,
      // Daily logs v2: site-aware fields, multi-item, worker breakdown, draft status
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS work_location text`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS start_time text`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS end_time text`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS work_items jsonb`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS worker_breakdown jsonb`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS temperature text`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS safety_incidents text`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS next_day_plan text`,
      `ALTER TABLE project_daily_logs ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft'`,
      `CREATE TABLE IF NOT EXISTS project_daily_log_photos (
        id SERIAL PRIMARY KEY,
        daily_log_id integer NOT NULL REFERENCES project_daily_logs(id) ON DELETE CASCADE,
        photo_url text NOT NULL,
        caption text,
        photo_type text DEFAULT 'during',
        uploaded_by varchar REFERENCES users(id),
        uploaded_at timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_project_daily_log_photos_log ON project_daily_log_photos(daily_log_id)`,
      // Loyalty OTP: prove phone ownership before issuing/returning a card
      `CREATE TABLE IF NOT EXISTS loyalty_otp_codes (
        id serial PRIMARY KEY,
        phone text NOT NULL,
        campaign_id integer NOT NULL REFERENCES loyalty_campaigns(id) ON DELETE CASCADE,
        code_hash text NOT NULL,
        payload jsonb,
        attempts integer DEFAULT 0 NOT NULL,
        send_count integer DEFAULT 1 NOT NULL,
        expires_at timestamp NOT NULL,
        last_sent_at timestamp DEFAULT now() NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_otp_phone_campaign ON loyalty_otp_codes(phone, campaign_id)`,
      `CREATE INDEX IF NOT EXISTS idx_loyalty_otp_expires ON loyalty_otp_codes(expires_at)`,
      // Shareholder Portal Phase 5: OTP two-factor login + activity log
      `CREATE TABLE IF NOT EXISTS shareholder_otp_codes (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash text NOT NULL,
        channel text NOT NULL DEFAULT 'whatsapp',
        phone text,
        attempts integer NOT NULL DEFAULT 0,
        send_count integer NOT NULL DEFAULT 1,
        expires_at timestamp NOT NULL,
        consumed_at timestamp,
        last_sent_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_shareholder_otp_user ON shareholder_otp_codes(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shareholder_otp_expires ON shareholder_otp_codes(expires_at)`,
      `CREATE TABLE IF NOT EXISTS shareholder_activity_log (
        id serial PRIMARY KEY,
        shareholder_id integer NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
        user_id varchar REFERENCES users(id),
        action text NOT NULL,
        description text,
        metadata jsonb,
        ip_address text,
        user_agent text,
        created_at timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_shareholder_activity_shareholder ON shareholder_activity_log(shareholder_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shareholder_activity_created ON shareholder_activity_log(created_at)`,
      `ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false`,
      `ALTER TABLE shareholder_portal_settings ADD COLUMN IF NOT EXISTS require_two_factor boolean NOT NULL DEFAULT false`,
      `ALTER TABLE shareholder_portal_settings ADD COLUMN IF NOT EXISTS two_factor_channel text NOT NULL DEFAULT 'whatsapp'`,
    ];
    for (const mig of migrations) {
      try { await pool.query(mig); } catch (e) { /* index may already exist or table not found */ }
    }

    try {
      // STEP 1: Remove cross-group duplicates — old records with branch_employee_id IS NULL
      // that have a newer record with branch_employee_id IS NOT NULL for the same employee/date/branch.
      const crossDupResult = await pool.query(`
        DELETE FROM employee_schedules old_rec
        WHERE old_rec.branch_employee_id IS NULL
          AND old_rec.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM employee_schedules new_rec
            WHERE new_rec.branch_employee_id IS NOT NULL
              AND new_rec.branch_id = old_rec.branch_id
              AND new_rec.schedule_date = old_rec.schedule_date
              AND new_rec.id > old_rec.id
              AND (
                new_rec.employee_id = old_rec.employee_id
                OR old_rec.employee_id = 'branch_emp_' || new_rec.branch_employee_id::text
              )
          )
      `);
      if (crossDupResult.rowCount && crossDupResult.rowCount > 0) {
        console.log(`[SCHEDULE CLEANUP] Removed ${crossDupResult.rowCount} legacy cross-group duplicate records`);
      }

      // STEP 2: Remove within-group duplicates for branch_employee_id IS NOT NULL
      const dupCheck = await pool.query(`
        SELECT COUNT(*) as cnt FROM (
          SELECT branch_employee_id, schedule_date, branch_id, COUNT(*) as c
          FROM employee_schedules
          WHERE branch_employee_id IS NOT NULL AND branch_id IS NOT NULL
          GROUP BY branch_employee_id, schedule_date, branch_id
          HAVING COUNT(*) > 1
        ) sub
      `);
      const dupCount = parseInt(dupCheck.rows[0]?.cnt || '0', 10);
      if (dupCount > 0) {
        console.log(`[SCHEDULE CLEANUP] Found ${dupCount} duplicate schedule groups - cleaning...`);
        const cleaned = await pool.query(`
          DELETE FROM employee_schedules
          WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY branch_employee_id, schedule_date, branch_id
                ORDER BY id DESC
              ) as rn
              FROM employee_schedules
              WHERE branch_employee_id IS NOT NULL AND branch_id IS NOT NULL
            ) ranked
            WHERE rn > 1
          )
        `);
        console.log(`[SCHEDULE CLEANUP] Deleted ${cleaned.rowCount} duplicate schedule records`);
      }

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_schedule_per_employee_date_branch
        ON employee_schedules (branch_employee_id, schedule_date, branch_id)
        WHERE branch_employee_id IS NOT NULL AND branch_id IS NOT NULL
      `);

      const dupCheck2 = await pool.query(`
        SELECT COUNT(*) as cnt FROM (
          SELECT employee_id, schedule_date, branch_id, COUNT(*) as c
          FROM employee_schedules
          WHERE branch_employee_id IS NULL AND branch_id IS NOT NULL
          GROUP BY employee_id, schedule_date, branch_id
          HAVING COUNT(*) > 1
        ) sub
      `);
      const dupCount2 = parseInt(dupCheck2.rows[0]?.cnt || '0', 10);
      if (dupCount2 > 0) {
        console.log(`[SCHEDULE CLEANUP] Found ${dupCount2} employeeId-only duplicate groups - cleaning...`);
        await pool.query(`
          DELETE FROM employee_schedules
          WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY employee_id, schedule_date, branch_id
                ORDER BY id DESC
              ) as rn
              FROM employee_schedules
              WHERE branch_employee_id IS NULL AND branch_id IS NOT NULL
            ) ranked
            WHERE rn > 1
          )
        `);
      }

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_schedule_per_empid_date_branch
        ON employee_schedules (employee_id, schedule_date, branch_id)
        WHERE branch_employee_id IS NULL AND branch_id IS NOT NULL
      `);
      console.log("[SCHEDULE CLEANUP] Unique indexes on employee_schedules verified");
    } catch (schedErr: any) {
      console.error("[SCHEDULE CLEANUP] Error:", schedErr?.message);
    }

    console.log("Startup migrations completed successfully");
  } catch (err) {
    console.error("Startup migration error:", err);
  }
}
