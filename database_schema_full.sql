-- =====================================================
-- نظام باتر - جميع جداول قاعدة البيانات
-- تاريخ التصدير: 2026-02-18
-- عدد الجداول: 214
-- =====================================================

-- ----- accounting_exports -----
CREATE TABLE IF NOT EXISTS "accounting_exports" (
  "id" SERIAL NOT NULL,
  "export_type" TEXT NOT NULL,
  "date_from" TEXT,
  "date_to" TEXT,
  "branch_id" VARCHAR,
  "data" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "synced_at" TIMESTAMP,
  "exported_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- accounting_journal_entries -----
CREATE TABLE IF NOT EXISTS "accounting_journal_entries" (
  "id" SERIAL NOT NULL,
  "entry_number" TEXT NOT NULL,
  "entry_date" TEXT NOT NULL,
  "entry_type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "branch_id" VARCHAR,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "total_debit" NUMERIC DEFAULT '0'::numeric,
  "total_credit" NUMERIC DEFAULT '0'::numeric,
  "vat_amount" NUMERIC DEFAULT '0'::numeric,
  "currency" TEXT DEFAULT 'SAR'::text,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "reconciliation_status" TEXT DEFAULT 'pending'::text,
  "reconciliation_notes" TEXT,
  "posted_by" VARCHAR,
  "posted_at" TIMESTAMP,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- accounting_reconciliations -----
CREATE TABLE IF NOT EXISTS "accounting_reconciliations" (
  "id" SERIAL NOT NULL,
  "reconciliation_date" TEXT NOT NULL,
  "period_from" TEXT NOT NULL,
  "period_to" TEXT NOT NULL,
  "branch_id" VARCHAR,
  "total_system_sales" NUMERIC DEFAULT '0'::numeric,
  "total_actual_deposits" NUMERIC DEFAULT '0'::numeric,
  "total_variance" NUMERIC DEFAULT '0'::numeric,
  "total_waste_value" NUMERIC DEFAULT '0'::numeric,
  "total_purchases" NUMERIC DEFAULT '0'::numeric,
  "vat_collected" NUMERIC DEFAULT '0'::numeric,
  "vat_paid" NUMERIC DEFAULT '0'::numeric,
  "net_vat" NUMERIC DEFAULT '0'::numeric,
  "entries_count" INTEGER DEFAULT 0,
  "matched_count" INTEGER DEFAULT 0,
  "discrepancy_count" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "notes" TEXT,
  "prepared_by" VARCHAR,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- advanced_production_orders -----
CREATE TABLE IF NOT EXISTS "advanced_production_orders" (
  "id" SERIAL NOT NULL,
  "order_number" TEXT NOT NULL,
  "order_type" TEXT NOT NULL DEFAULT 'daily'::text,
  "source_branch_id" VARCHAR NOT NULL,
  "target_branch_id" VARCHAR NOT NULL,
  "target_department" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "priority" TEXT NOT NULL DEFAULT 'normal'::text,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "target_sales_value" REAL,
  "estimated_cost" REAL DEFAULT 0,
  "actual_cost" REAL DEFAULT 0,
  "total_items" INTEGER DEFAULT 0,
  "completed_items" INTEGER DEFAULT 0,
  "completion_percent" REAL DEFAULT 0,
  "is_ai_generated" BOOLEAN DEFAULT false,
  "ai_plan_id" INTEGER,
  "notes" TEXT,
  "created_by" VARCHAR,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "source_sales_value" REAL,
  "mto_items" JSONB,
  PRIMARY KEY ("id")
);

-- ----- asset_transfer_events -----
CREATE TABLE IF NOT EXISTS "asset_transfer_events" (
  "id" SERIAL NOT NULL,
  "transfer_id" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor_id" VARCHAR,
  "note" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- asset_transfers -----
CREATE TABLE IF NOT EXISTS "asset_transfers" (
  "id" SERIAL NOT NULL,
  "transfer_number" TEXT NOT NULL,
  "item_id" VARCHAR NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "from_branch_id" VARCHAR NOT NULL,
  "to_branch_id" VARCHAR NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "reason" TEXT,
  "notes" TEXT,
  "requested_by" VARCHAR,
  "requested_at" TIMESTAMP NOT NULL DEFAULT now(),
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "received_by" VARCHAR,
  "received_at" TIMESTAMP,
  "receiver_name" TEXT,
  "receiver_signature" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- attendance_records -----
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" SERIAL NOT NULL,
  "employee_id" VARCHAR NOT NULL,
  "employee_name" TEXT NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "schedule_id" INTEGER,
  "attendance_date" TEXT NOT NULL,
  "scheduled_start_time" TEXT,
  "scheduled_end_time" TEXT,
  "actual_check_in" TEXT,
  "actual_check_out" TEXT,
  "check_in_signature" TEXT,
  "check_out_signature" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "late_minutes" INTEGER DEFAULT 0,
  "early_leave_minutes" INTEGER DEFAULT 0,
  "overtime_minutes" INTEGER DEFAULT 0,
  "working_hours" REAL DEFAULT 0,
  "device_info" TEXT,
  "location_info" TEXT,
  "notes" TEXT,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "branch_employee_id" INTEGER,
  "biometric_verified" BOOLEAN DEFAULT false,
  "biometric_check_in" BOOLEAN DEFAULT false,
  "biometric_check_out" BOOLEAN DEFAULT false,
  PRIMARY KEY ("id")
);

-- ----- attendance_summary -----
CREATE TABLE IF NOT EXISTS "attendance_summary" (
  "id" SERIAL NOT NULL,
  "employee_id" VARCHAR NOT NULL,
  "employee_name" TEXT NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "period_month" TEXT NOT NULL,
  "total_scheduled_days" INTEGER DEFAULT 0,
  "total_present_days" INTEGER DEFAULT 0,
  "total_absent_days" INTEGER DEFAULT 0,
  "total_late_days" INTEGER DEFAULT 0,
  "total_early_leave_days" INTEGER DEFAULT 0,
  "total_leave_days" INTEGER DEFAULT 0,
  "total_working_hours" REAL DEFAULT 0,
  "total_overtime_hours" REAL DEFAULT 0,
  "total_late_minutes" INTEGER DEFAULT 0,
  "total_early_leave_minutes" INTEGER DEFAULT 0,
  "attendance_rate" REAL DEFAULT 0,
  "punctuality_rate" REAL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- audit_logs -----
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" SERIAL NOT NULL,
  "item_id" VARCHAR NOT NULL,
  "action" TEXT NOT NULL,
  "field_name" TEXT,
  "old_value" TEXT,
  "new_value" TEXT,
  "changed_by" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- average_ticket_targets -----
CREATE TABLE IF NOT EXISTS "average_ticket_targets" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR,
  "cashier_id" VARCHAR,
  "shift_type" TEXT,
  "target_type" TEXT NOT NULL,
  "target_value" REAL NOT NULL,
  "min_acceptable" REAL,
  "bonus_threshold" REAL,
  "bonus_per_riyal" REAL,
  "valid_from" TEXT NOT NULL,
  "valid_to" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- backups -----
CREATE TABLE IF NOT EXISTS "backups" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "file_size" INTEGER,
  "file_path" TEXT,
  "tables" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMP,
  "table_count" INTEGER,
  "row_count" INTEGER,
  "backup_data" TEXT,
  "error_message" TEXT,
  "restored_at" TIMESTAMP,
  "restored_by" VARCHAR,
  PRIMARY KEY ("id")
);

-- ----- beneficiary_organizations -----
CREATE TABLE IF NOT EXISTS "beneficiary_organizations" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "organization_type" TEXT NOT NULL,
  "category" TEXT,
  "contact_person" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "registration_number" TEXT,
  "tax_number" TEXT,
  "website" TEXT,
  "logo_url" TEXT,
  "description" TEXT,
  "partnership_type" TEXT,
  "discount_percentage" NUMERIC,
  "status" TEXT DEFAULT 'active'::text,
  "valid_from" DATE,
  "valid_to" DATE,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- biometric_credentials -----
CREATE TABLE IF NOT EXISTS "biometric_credentials" (
  "id" SERIAL NOT NULL,
  "employee_id" VARCHAR NOT NULL,
  "employee_name" TEXT NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "credential_id" TEXT NOT NULL,
  "public_key" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "device_info" TEXT,
  "registered_by" VARCHAR,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "device_type" TEXT,
  "device_model" TEXT,
  "registration_method" TEXT DEFAULT 'fingerprint'::text,
  "registered_by_name" TEXT,
  "deactivated_at" TIMESTAMP,
  "deactivated_by" VARCHAR,
  "deactivation_reason" TEXT,
  "usage_count" INTEGER DEFAULT 0,
  "verification_pin" TEXT,
  PRIMARY KEY ("id")
);

-- ----- board_committees -----
CREATE TABLE IF NOT EXISTS "board_committees" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "description" TEXT,
  "committee_type" TEXT NOT NULL,
  "chairman_id" INTEGER,
  "secretary_id" INTEGER,
  "formation_date" DATE NOT NULL,
  "term_end_date" DATE,
  "mandate_document" TEXT,
  "meeting_frequency" TEXT DEFAULT 'quarterly'::text,
  "quorum_required" INTEGER DEFAULT 2,
  "status" TEXT DEFAULT 'active'::text,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- board_member_training -----
CREATE TABLE IF NOT EXISTS "board_member_training" (
  "id" SERIAL NOT NULL,
  "board_member_id" INTEGER NOT NULL,
  "training_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "provider" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "duration" INTEGER,
  "certificate_number" TEXT,
  "certificate_url" TEXT,
  "expiry_date" DATE,
  "status" TEXT DEFAULT 'completed'::text,
  "score" NUMERIC,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- board_members -----
CREATE TABLE IF NOT EXISTS "board_members" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR,
  "full_name" TEXT NOT NULL,
  "national_id" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "position" TEXT NOT NULL,
  "member_type" TEXT DEFAULT 'executive'::text,
  "nationality" TEXT,
  "date_of_birth" DATE,
  "qualifications" TEXT,
  "experience" TEXT,
  "current_employer" TEXT,
  "other_board_memberships" TEXT,
  "appointment_date" DATE NOT NULL,
  "term_end_date" DATE,
  "term_number" INTEGER DEFAULT 1,
  "status" TEXT DEFAULT 'active'::text,
  "resignation_date" DATE,
  "resignation_reason" TEXT,
  "photo_url" TEXT,
  "signature_url" TEXT,
  "committees" TEXT[],
  "voting_power" NUMERIC DEFAULT 1.00,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- board_resolutions -----
CREATE TABLE IF NOT EXISTS "board_resolutions" (
  "id" SERIAL NOT NULL,
  "resolution_number" TEXT NOT NULL,
  "meeting_id" INTEGER,
  "resolution_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "priority" TEXT DEFAULT 'normal'::text,
  "proposed_by" VARCHAR,
  "proposed_at" TIMESTAMP NOT NULL,
  "voting_required" BOOLEAN DEFAULT true,
  "voting_deadline" TIMESTAMP,
  "for_votes" INTEGER DEFAULT 0,
  "against_votes" INTEGER DEFAULT 0,
  "abstain_votes" INTEGER DEFAULT 0,
  "total_votes" INTEGER DEFAULT 0,
  "required_majority" NUMERIC DEFAULT 50.00,
  "status" TEXT DEFAULT 'draft'::text,
  "approved_at" TIMESTAMP,
  "implementation_deadline" DATE,
  "implementation_status" TEXT DEFAULT 'pending'::text,
  "implemented_at" TIMESTAMP,
  "responsible_person" VARCHAR,
  "financial_impact" NUMERIC,
  "attachments" JSONB,
  "related_resolutions" INTEGER[],
  "expiry_date" DATE,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_achievement_bonus -----
CREATE TABLE IF NOT EXISTS "branch_achievement_bonus" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "year_month" TEXT NOT NULL,
  "bonus_pool" REAL NOT NULL,
  "target_amount" REAL NOT NULL,
  "distribution_method" TEXT NOT NULL DEFAULT 'contribution_ratio'::text,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "bonus_tiers" TEXT,
  "calculation_status" TEXT DEFAULT 'pending'::text,
  "actual_sales" REAL,
  "achievement_percent" REAL,
  "matched_tier_amount" REAL,
  "calculation_details" TEXT,
  "calculated_at" TIMESTAMP,
  "calculated_by" VARCHAR,
  PRIMARY KEY ("id")
);

-- ----- branch_custom_checklist_items -----
CREATE TABLE IF NOT EXISTS "branch_custom_checklist_items" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "template_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "description" TEXT,
  "display_order" INTEGER DEFAULT 100,
  "requires_photo" BOOLEAN DEFAULT false,
  "requires_note" BOOLEAN DEFAULT false,
  "is_critical" BOOLEAN DEFAULT false,
  "is_active" BOOLEAN DEFAULT true,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_daily_closure_journals -----
CREATE TABLE IF NOT EXISTS "branch_daily_closure_journals" (
  "id" SERIAL NOT NULL,
  "closure_id" INTEGER NOT NULL,
  "journal_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_daily_closure_payments -----
CREATE TABLE IF NOT EXISTS "branch_daily_closure_payments" (
  "id" SERIAL NOT NULL,
  "closure_id" INTEGER NOT NULL,
  "payment_method" TEXT NOT NULL,
  "total_amount" REAL NOT NULL DEFAULT 0,
  "total_pos_amount" REAL DEFAULT 0,
  "total_terminal_amount" REAL DEFAULT 0,
  "total_bank_discrepancy" REAL DEFAULT 0,
  "bank_discrepancy_type" TEXT DEFAULT 'balanced'::text,
  "total_transaction_count" INTEGER DEFAULT 0,
  "total_terminal_transaction_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_daily_closures -----
CREATE TABLE IF NOT EXISTS "branch_daily_closures" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "closure_date" TEXT NOT NULL,
  "total_sales" REAL NOT NULL DEFAULT 0,
  "cash_total" REAL NOT NULL DEFAULT 0,
  "network_total" REAL NOT NULL DEFAULT 0,
  "delivery_total" REAL NOT NULL DEFAULT 0,
  "total_opening_balance" REAL NOT NULL DEFAULT 0,
  "total_expected_cash" REAL NOT NULL DEFAULT 0,
  "total_actual_cash" REAL NOT NULL DEFAULT 0,
  "total_cash_discrepancy" REAL NOT NULL DEFAULT 0,
  "cash_discrepancy_status" TEXT NOT NULL DEFAULT 'balanced'::text,
  "total_bank_pos_amount" REAL DEFAULT 0,
  "total_bank_terminal_amount" REAL DEFAULT 0,
  "total_bank_discrepancy" REAL DEFAULT 0,
  "bank_discrepancy_status" TEXT DEFAULT 'balanced'::text,
  "total_customer_count" INTEGER DEFAULT 0,
  "total_transaction_count" INTEGER DEFAULT 0,
  "average_ticket" REAL DEFAULT 0,
  "journals_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'open'::text,
  "closed_by" VARCHAR,
  "closed_at" TIMESTAMP,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_daily_sales -----
CREATE TABLE IF NOT EXISTS "branch_daily_sales" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "sales_date" TEXT NOT NULL,
  "total_sales" REAL NOT NULL DEFAULT 0,
  "transactions_count" INTEGER DEFAULT 0,
  "average_ticket" REAL DEFAULT 0,
  "cashier_count" INTEGER DEFAULT 0,
  "target_amount" REAL DEFAULT 0,
  "achievement_amount" REAL DEFAULT 0,
  "achievement_percent" REAL DEFAULT 0,
  "morning_shift_sales" REAL DEFAULT 0,
  "evening_shift_sales" REAL DEFAULT 0,
  "night_shift_sales" REAL DEFAULT 0,
  "journal_ids" JSONB,
  "computed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_employees -----
CREATE TABLE IF NOT EXISTS "branch_employees" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "employee_name" TEXT NOT NULL,
  "employee_name_en" TEXT,
  "job_title" TEXT NOT NULL,
  "department" TEXT,
  "nationality" TEXT NOT NULL,
  "salary" REAL NOT NULL,
  "housing_allowance" REAL DEFAULT 0,
  "transport_allowance" REAL DEFAULT 0,
  "food_allowance" REAL DEFAULT 0,
  "other_allowances" REAL DEFAULT 0,
  "total_salary" REAL,
  "hire_date" TEXT,
  "health_certificate" TEXT DEFAULT 'none'::text,
  "health_certificate_expiry" TEXT,
  "iqama_number" TEXT,
  "iqama_expiry" TEXT,
  "passport_number" TEXT,
  "passport_expiry" TEXT,
  "phone_number" TEXT,
  "emergency_contact" TEXT,
  "bank_name" TEXT,
  "bank_account_number" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active'::text,
  "contract_type" TEXT DEFAULT 'full_time'::text,
  "work_permit_number" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "linked_user_id" VARCHAR,
  "default_schedule_template_id" INTEGER,
  "employee_number" TEXT,
  "social_insurance_deduction" REAL DEFAULT 0,
  PRIMARY KEY ("id")
);

-- ----- branch_monthly_targets -----
CREATE TABLE IF NOT EXISTS "branch_monthly_targets" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "year_month" TEXT NOT NULL,
  "target_amount" REAL NOT NULL,
  "profile_id" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "notes" TEXT,
  "created_by" VARCHAR,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_shift_profiles -----
CREATE TABLE IF NOT EXISTS "branch_shift_profiles" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "shift_code" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "break_minutes" INTEGER DEFAULT 60,
  "grace_minutes_before" INTEGER DEFAULT 15,
  "grace_minutes_after" INTEGER DEFAULT 15,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- branch_shifts -----
CREATE TABLE IF NOT EXISTS "branch_shifts" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "shift_type" TEXT NOT NULL,
  "shift_date" DATE NOT NULL,
  "status" TEXT DEFAULT 'in_progress'::text,
  "supervisor_id" VARCHAR,
  "supervisor_name" TEXT,
  "employee_count" INTEGER,
  "opening_time" TIMESTAMP,
  "closing_time" TIMESTAMP,
  "total_sales" NUMERIC,
  "cash_sales" NUMERIC,
  "card_sales" NUMERIC,
  "transaction_count" INTEGER,
  "cash_variance" NUMERIC,
  "waste_amount" NUMERIC,
  "supervisor_notes" TEXT,
  "customer_feedback" TEXT,
  "team_performance" TEXT,
  "improvements" TEXT,
  "issues" TEXT,
  "opening_completed" BOOLEAN DEFAULT false,
  "closing_completed" BOOLEAN DEFAULT false,
  "opening_completed_at" TIMESTAMP,
  "closing_completed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "opening_gps_latitude" NUMERIC,
  "opening_gps_longitude" NUMERIC,
  "closing_gps_latitude" NUMERIC,
  "closing_gps_longitude" NUMERIC,
  PRIMARY KEY ("id")
);

-- ----- branch_stock -----
CREATE TABLE IF NOT EXISTS "branch_stock" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "item_id" INTEGER NOT NULL,
  "current_quantity" INTEGER DEFAULT 0,
  "daily_consumption" INTEGER DEFAULT 0,
  "last_updated" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_by" VARCHAR,
  PRIMARY KEY ("id")
);

-- ----- branches -----
CREATE TABLE IF NOT EXISTS "branches" (
  "id" VARCHAR NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "location_radius" INTEGER DEFAULT 200,
  "address" TEXT,
  PRIMARY KEY ("id")
);

-- ----- campaign_budget_allocations -----
CREATE TABLE IF NOT EXISTS "campaign_budget_allocations" (
  "id" SERIAL NOT NULL,
  "campaign_id" INTEGER NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "allocated_budget" REAL NOT NULL,
  "spent_amount" REAL NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- campaign_expenses -----
CREATE TABLE IF NOT EXISTS "campaign_expenses" (
  "id" SERIAL NOT NULL,
  "campaign_id" INTEGER,
  "influencer_id" INTEGER,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'SAR'::text,
  "expense_date" TEXT NOT NULL,
  "payment_method" TEXT,
  "reference_number" TEXT,
  "invoice_number" TEXT,
  "vendor" TEXT,
  "attachment_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branch_id" INTEGER,
  "branch_name" TEXT,
  "expense_month" TEXT,
  PRIMARY KEY ("id")
);

-- ----- campaign_goals -----
CREATE TABLE IF NOT EXISTS "campaign_goals" (
  "id" SERIAL NOT NULL,
  "campaign_id" INTEGER NOT NULL,
  "goal_type" TEXT NOT NULL,
  "target_value" REAL NOT NULL,
  "current_value" REAL NOT NULL DEFAULT 0,
  "unit" TEXT,
  "description" TEXT,
  "deadline" TEXT,
  "is_achieved" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- capital_transactions -----
CREATE TABLE IF NOT EXISTS "capital_transactions" (
  "id" SERIAL NOT NULL,
  "transaction_number" TEXT NOT NULL,
  "transaction_type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "previous_capital" NUMERIC NOT NULL,
  "new_capital" NUMERIC NOT NULL,
  "change_amount" NUMERIC NOT NULL,
  "previous_shares" INTEGER NOT NULL,
  "new_shares" INTEGER NOT NULL,
  "share_change" INTEGER NOT NULL,
  "price_per_share" NUMERIC,
  "effective_date" DATE NOT NULL,
  "board_resolution_id" INTEGER,
  "assembly_approval_required" BOOLEAN DEFAULT true,
  "assembly_meeting_id" INTEGER,
  "regulatory_approval_date" DATE,
  "regulatory_approval_number" TEXT,
  "registration_date" DATE,
  "status" TEXT DEFAULT 'pending'::text,
  "attachments" JSONB,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- cashier_daily_challenges -----
CREATE TABLE IF NOT EXISTS "cashier_daily_challenges" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "challenge_type" TEXT NOT NULL,
  "branch_id" VARCHAR,
  "target_value" REAL NOT NULL,
  "base_points" INTEGER NOT NULL,
  "bonus_points_per_unit" REAL DEFAULT 0,
  "unit_label" TEXT,
  "shift_type" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TEXT NOT NULL,
  "valid_to" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "cashier_id" VARCHAR,
  PRIMARY KEY ("id")
);

-- ----- cashier_incentive_statements -----
CREATE TABLE IF NOT EXISTS "cashier_incentive_statements" (
  "id" SERIAL NOT NULL,
  "statement_number" TEXT NOT NULL,
  "cashier_id" VARCHAR NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "period_from" TEXT NOT NULL,
  "period_to" TEXT NOT NULL,
  "total_points" INTEGER NOT NULL DEFAULT 0,
  "total_amount" REAL NOT NULL DEFAULT 0,
  "daily_challenge_points" INTEGER DEFAULT 0,
  "product_commission_points" INTEGER DEFAULT 0,
  "branch_bonus_points" INTEGER DEFAULT 0,
  "manual_adjustment_points" INTEGER DEFAULT 0,
  "entries_count" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "notes" TEXT,
  "created_by" VARCHAR,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "rejected_by" VARCHAR,
  "rejected_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "paid_by" VARCHAR,
  "paid_at" TIMESTAMP,
  "statement_data" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- cashier_payment_breakdowns -----
CREATE TABLE IF NOT EXISTS "cashier_payment_breakdowns" (
  "id" SERIAL NOT NULL,
  "journal_id" INTEGER NOT NULL,
  "payment_method" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "transaction_count" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "pos_amount" REAL DEFAULT 0,
  "terminal_amount" REAL DEFAULT 0,
  "bank_discrepancy" REAL DEFAULT 0,
  "bank_discrepancy_type" TEXT DEFAULT 'balanced'::text,
  "terminal_transaction_count" INTEGER DEFAULT 0,
  PRIMARY KEY ("id")
);

-- ----- cashier_points_ledger -----
CREATE TABLE IF NOT EXISTS "cashier_points_ledger" (
  "id" SERIAL NOT NULL,
  "cashier_id" VARCHAR NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "transaction_date" TEXT NOT NULL,
  "shift_type" TEXT,
  "points_type" TEXT NOT NULL,
  "source_id" INTEGER,
  "source_name" TEXT,
  "points_earned" INTEGER NOT NULL,
  "point_value" REAL NOT NULL,
  "amount_earned" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'earned'::text,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- cashier_product_sales -----
CREATE TABLE IF NOT EXISTS "cashier_product_sales" (
  "id" SERIAL NOT NULL,
  "cashier_id" VARCHAR NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "commission_id" INTEGER NOT NULL,
  "sales_date" TEXT NOT NULL,
  "shift_type" TEXT,
  "quantity_sold" INTEGER NOT NULL DEFAULT 0,
  "target_quantity" INTEGER NOT NULL,
  "is_target_met" BOOLEAN DEFAULT false,
  "points_awarded" INTEGER DEFAULT 0,
  "recorded_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- cashier_sales_journals -----
CREATE TABLE IF NOT EXISTS "cashier_sales_journals" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "shift_id" INTEGER,
  "cashier_id" VARCHAR NOT NULL,
  "cashier_name" TEXT NOT NULL,
  "journal_date" TEXT NOT NULL,
  "shift_type" TEXT,
  "shift_start_time" TEXT,
  "shift_end_time" TEXT,
  "total_sales" REAL NOT NULL DEFAULT 0,
  "cash_total" REAL NOT NULL DEFAULT 0,
  "network_total" REAL NOT NULL DEFAULT 0,
  "delivery_total" REAL NOT NULL DEFAULT 0,
  "expected_cash" REAL NOT NULL DEFAULT 0,
  "actual_cash_drawer" REAL NOT NULL DEFAULT 0,
  "discrepancy_amount" REAL NOT NULL DEFAULT 0,
  "discrepancy_status" TEXT NOT NULL DEFAULT 'balanced'::text,
  "customer_count" INTEGER DEFAULT 0,
  "transaction_count" INTEGER DEFAULT 0,
  "average_ticket" REAL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "submitted_at" TIMESTAMP,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "opening_balance" REAL NOT NULL DEFAULT 0,
  "total_bank_pos_amount" REAL DEFAULT 0,
  "total_bank_terminal_amount" REAL DEFAULT 0,
  "bank_discrepancy_total" REAL DEFAULT 0,
  "bank_discrepancy_status" TEXT DEFAULT 'balanced'::text,
  "is_input_error" BOOLEAN DEFAULT false,
  "input_error_amount" REAL DEFAULT 0,
  "net_discrepancy" REAL DEFAULT 0,
  "return_amount" REAL DEFAULT 0,
  "return_payment_method" TEXT,
  "return_reason" TEXT,
  "return_reference" TEXT,
  "has_return" BOOLEAN DEFAULT false,
  PRIMARY KEY ("id")
);

-- ----- cashier_shift_performance -----
CREATE TABLE IF NOT EXISTS "cashier_shift_performance" (
  "id" SERIAL NOT NULL,
  "journal_id" INTEGER,
  "cashier_id" VARCHAR NOT NULL,
  "cashier_name" TEXT NOT NULL,
  "shift_id" INTEGER,
  "shift_type" TEXT NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "performance_date" TEXT NOT NULL,
  "sales_amount" REAL NOT NULL DEFAULT 0,
  "transactions_count" INTEGER DEFAULT 0,
  "average_ticket" REAL DEFAULT 0,
  "customer_count" INTEGER DEFAULT 0,
  "target_share" REAL DEFAULT 0,
  "achievement_percent" REAL DEFAULT 0,
  "discrepancy_amount" REAL DEFAULT 0,
  "discrepancy_status" TEXT DEFAULT 'balanced'::text,
  "branch_rank" INTEGER,
  "shift_rank" INTEGER,
  "computed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- cashier_shift_targets -----
CREATE TABLE IF NOT EXISTS "cashier_shift_targets" (
  "id" SERIAL NOT NULL,
  "cashier_id" VARCHAR(255) NOT NULL,
  "branch_id" VARCHAR(255) NOT NULL,
  "shift_type" VARCHAR(50) NOT NULL,
  "cashier_role" VARCHAR(50) NOT NULL,
  "target_amount" NUMERIC NOT NULL DEFAULT 0,
  "target_transactions" INTEGER NOT NULL DEFAULT 0,
  "target_ticket_value" NUMERIC NOT NULL DEFAULT 0,
  "target_date" DATE NOT NULL,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now(),
  "period_type" VARCHAR NOT NULL DEFAULT 'daily'::character varying,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "total_target_amount" NUMERIC NOT NULL,
  "total_target_transactions" INTEGER,
  PRIMARY KEY ("id")
);

-- ----- cashier_signatures -----
CREATE TABLE IF NOT EXISTS "cashier_signatures" (
  "id" SERIAL NOT NULL,
  "journal_id" INTEGER NOT NULL,
  "signature_type" TEXT NOT NULL,
  "signer_name" TEXT NOT NULL,
  "signer_id" VARCHAR,
  "signature_data" TEXT NOT NULL,
  "signed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "ip_address" TEXT,
  "notes" TEXT,
  PRIMARY KEY ("id")
);

-- ----- chart_of_accounts -----
CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
  "id" SERIAL NOT NULL,
  "account_code" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "account_name_en" TEXT,
  "account_type" TEXT NOT NULL,
  "parent_code" TEXT,
  "level" INTEGER DEFAULT 1,
  "is_active" TEXT DEFAULT 'true'::text,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- checklist_items -----
CREATE TABLE IF NOT EXISTS "checklist_items" (
  "id" SERIAL NOT NULL,
  "template_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "description" TEXT,
  "display_order" INTEGER DEFAULT 0,
  "requires_photo" BOOLEAN DEFAULT false,
  "requires_note" BOOLEAN DEFAULT false,
  "is_critical" BOOLEAN DEFAULT false,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- checklist_templates -----
CREATE TABLE IF NOT EXISTS "checklist_templates" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "display_order" INTEGER DEFAULT 0,
  "is_active" BOOLEAN DEFAULT true,
  "requires_photo" BOOLEAN DEFAULT false,
  "requires_note" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- commission_calculations -----
CREATE TABLE IF NOT EXISTS "commission_calculations" (
  "id" SERIAL NOT NULL,
  "cashier_id" VARCHAR,
  "branch_id" VARCHAR,
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "total_sales" REAL NOT NULL,
  "target_amount" REAL,
  "achievement_percent" REAL,
  "rate_id" INTEGER,
  "calculated_commission" REAL NOT NULL,
  "adjusted_commission" REAL,
  "final_commission" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "journal_ids" JSONB,
  "notes" TEXT,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "paid_at" TIMESTAMP,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- commission_rates -----
CREATE TABLE IF NOT EXISTS "commission_rates" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "min_sales_amount" REAL DEFAULT 0,
  "max_sales_amount" REAL,
  "commission_type" TEXT NOT NULL,
  "fixed_amount" REAL,
  "percentage_rate" REAL,
  "applicable_to" TEXT NOT NULL DEFAULT 'cashier'::text,
  "applicable_branches" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TEXT,
  "valid_to" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- committee_memberships -----
CREATE TABLE IF NOT EXISTS "committee_memberships" (
  "id" SERIAL NOT NULL,
  "committee_id" INTEGER NOT NULL,
  "board_member_id" INTEGER NOT NULL,
  "role" TEXT DEFAULT 'member'::text,
  "appointment_date" DATE NOT NULL,
  "end_date" DATE,
  "status" TEXT DEFAULT 'active'::text,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- community_discounts -----
CREATE TABLE IF NOT EXISTS "community_discounts" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "discount_type" TEXT NOT NULL,
  "discount_value" NUMERIC NOT NULL,
  "minimum_order" NUMERIC,
  "maximum_discount" NUMERIC,
  "beneficiary_organization_id" INTEGER,
  "initiative_id" INTEGER,
  "valid_from" DATE NOT NULL,
  "valid_to" DATE NOT NULL,
  "usage_limit" INTEGER,
  "usage_count" INTEGER DEFAULT 0,
  "usage_limit_per_user" INTEGER,
  "applicable_branches" TEXT[],
  "applicable_products" TEXT[],
  "status" TEXT DEFAULT 'active'::text,
  "terms" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- comparison_status_history -----
CREATE TABLE IF NOT EXISTS "comparison_status_history" (
  "id" SERIAL NOT NULL,
  "comparison_id" INTEGER NOT NULL,
  "previous_status" TEXT,
  "new_status" TEXT NOT NULL,
  "reason" TEXT,
  "changed_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- comparison_summaries -----
CREATE TABLE IF NOT EXISTS "comparison_summaries" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "period_type" TEXT NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "total_produced" INTEGER DEFAULT 0,
  "total_sold" INTEGER DEFAULT 0,
  "total_waste" INTEGER DEFAULT 0,
  "total_shortage" INTEGER DEFAULT 0,
  "production_value" REAL DEFAULT 0,
  "sales_value" REAL DEFAULT 0,
  "waste_value" REAL DEFAULT 0,
  "waste_percent" REAL DEFAULT 0,
  "shortage_percent" REAL DEFAULT 0,
  "efficiency_score" REAL DEFAULT 0,
  "top_waste_products" JSONB,
  "top_shortage_products" JSONB,
  "category_breakdown" JSONB,
  "recommendations" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- comparison_uploads -----
CREATE TABLE IF NOT EXISTS "comparison_uploads" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_type" TEXT DEFAULT 'excel'::text,
  "data_type" TEXT NOT NULL,
  "period_start" DATE,
  "period_end" DATE,
  "total_records" INTEGER DEFAULT 0,
  "total_value" REAL DEFAULT 0,
  "unique_products" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'pending'::text,
  "error_message" TEXT,
  "uploaded_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- compliance_history -----
CREATE TABLE IF NOT EXISTS "compliance_history" (
  "id" SERIAL NOT NULL,
  "requirement_id" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "action_date" TIMESTAMP NOT NULL,
  "previous_status" TEXT,
  "new_status" TEXT,
  "document_number" TEXT,
  "document_url" TEXT,
  "valid_from" DATE,
  "valid_until" DATE,
  "cost" NUMERIC,
  "penalty_amount" NUMERIC,
  "notes" TEXT,
  "performed_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- compliance_requirements -----
CREATE TABLE IF NOT EXISTS "compliance_requirements" (
  "id" SERIAL NOT NULL,
  "requirement_code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "regulatory_body" TEXT NOT NULL,
  "applicable_law" TEXT,
  "frequency" TEXT NOT NULL,
  "is_recurring" BOOLEAN DEFAULT true,
  "current_status" TEXT DEFAULT 'pending'::text,
  "valid_from" DATE,
  "valid_until" DATE,
  "last_renewal_date" DATE,
  "next_due_date" DATE,
  "reminder_days" INTEGER DEFAULT 30,
  "document_number" TEXT,
  "document_url" TEXT,
  "cost" NUMERIC,
  "responsible_person" VARCHAR,
  "priority" TEXT DEFAULT 'normal'::text,
  "penalty_for_non_compliance" TEXT,
  "notes" TEXT,
  "attachments" JSONB,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- construction_categories -----
CREATE TABLE IF NOT EXISTS "construction_categories" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "icon" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- construction_contracts -----
CREATE TABLE IF NOT EXISTS "construction_contracts" (
  "id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "contractor_id" INTEGER NOT NULL,
  "contract_number" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "contract_type" TEXT NOT NULL DEFAULT 'fixed_price'::text,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "total_amount" REAL NOT NULL DEFAULT 0,
  "paid_amount" REAL DEFAULT 0,
  "start_date" TEXT,
  "end_date" TEXT,
  "payment_terms" TEXT,
  "warranty_period" TEXT,
  "notes" TEXT,
  "attachment_url" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- construction_projects -----
CREATE TABLE IF NOT EXISTS "construction_projects" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned'::text,
  "budget" REAL,
  "actual_cost" REAL,
  "start_date" TEXT,
  "target_completion_date" TEXT,
  "actual_completion_date" TEXT,
  "progress_percent" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- contract_items -----
CREATE TABLE IF NOT EXISTS "contract_items" (
  "id" SERIAL NOT NULL,
  "contract_id" INTEGER NOT NULL,
  "category_id" INTEGER,
  "description" TEXT NOT NULL,
  "unit" TEXT DEFAULT 'قطعة'::text,
  "quantity" REAL NOT NULL DEFAULT 1,
  "unit_price" REAL NOT NULL DEFAULT 0,
  "total_price" REAL NOT NULL DEFAULT 0,
  "completed_quantity" REAL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- contract_payments -----
CREATE TABLE IF NOT EXISTS "contract_payments" (
  "id" SERIAL NOT NULL,
  "contract_id" INTEGER NOT NULL,
  "payment_request_id" INTEGER,
  "amount" REAL NOT NULL,
  "payment_date" TEXT NOT NULL,
  "payment_method" TEXT,
  "reference_number" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- contractors -----
CREATE TABLE IF NOT EXISTS "contractors" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "specialization" TEXT,
  "notes" TEXT,
  "rating" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- daily_comparisons -----
CREATE TABLE IF NOT EXISTS "daily_comparisons" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "comparison_date" DATE NOT NULL,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "produced_quantity" INTEGER DEFAULT 0,
  "sold_quantity" INTEGER DEFAULT 0,
  "difference" INTEGER DEFAULT 0,
  "difference_percent" REAL DEFAULT 0,
  "production_value" REAL DEFAULT 0,
  "sales_value" REAL DEFAULT 0,
  "value_difference" REAL DEFAULT 0,
  "is_storable" BOOLEAN DEFAULT false,
  "storage_notes" TEXT,
  "status" TEXT DEFAULT 'normal'::text,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "waste_value" REAL DEFAULT 0,
  "status_changed_by" VARCHAR,
  "status_changed_at" TIMESTAMP,
  "status_reason" TEXT,
  PRIMARY KEY ("id")
);

-- ----- daily_operations_summary -----
CREATE TABLE IF NOT EXISTS "daily_operations_summary" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "date" TEXT NOT NULL,
  "total_orders" INTEGER DEFAULT 0,
  "completed_orders" INTEGER DEFAULT 0,
  "total_produced" INTEGER DEFAULT 0,
  "total_wasted" INTEGER DEFAULT 0,
  "waste_percentage" REAL DEFAULT 0,
  "quality_score" REAL,
  "shifts_count" INTEGER DEFAULT 0,
  "employees_present" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- daily_production_batches -----
CREATE TABLE IF NOT EXISTS "daily_production_batches" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "product_id" INTEGER,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "quantity" INTEGER NOT NULL,
  "unit" TEXT DEFAULT 'قطعة'::text,
  "destination" TEXT NOT NULL,
  "shift_id" INTEGER,
  "production_order_id" INTEGER,
  "produced_at" TIMESTAMP NOT NULL DEFAULT now(),
  "recorded_by" VARCHAR,
  "recorder_name" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "status" TEXT DEFAULT 'finished'::text,
  "chef_id" VARCHAR,
  "chef_name" TEXT,
  "source_batch_id" INTEGER,
  "finished_at" TIMESTAMP,
  "finished_by_id" VARCHAR,
  "finished_by_name" TEXT,
  "production_date" TEXT,
  PRIMARY KEY ("id")
);

-- ----- daily_sales_data -----
CREATE TABLE IF NOT EXISTS "daily_sales_data" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "sales_date" DATE NOT NULL,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "quantity_sold" INTEGER DEFAULT 0,
  "sales_value" REAL DEFAULT 0,
  "unit_price" REAL,
  "upload_id" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- daily_waste_log -----
CREATE TABLE IF NOT EXISTS "daily_waste_log" (
  "id" SERIAL NOT NULL,
  "shift_id" INTEGER NOT NULL,
  "product_name" TEXT NOT NULL,
  "quantity" NUMERIC NOT NULL,
  "unit" TEXT DEFAULT 'piece'::text,
  "reason" TEXT NOT NULL,
  "estimated_cost" NUMERIC,
  "photo_url" TEXT,
  "notes" TEXT,
  "recorded_by" VARCHAR,
  "recorded_by_name" TEXT,
  "recorded_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- data_import_jobs -----
CREATE TABLE IF NOT EXISTS "data_import_jobs" (
  "id" SERIAL NOT NULL,
  "source_system" TEXT NOT NULL,
  "target_module" TEXT NOT NULL,
  "file_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "total_records" INTEGER DEFAULT 0,
  "processed_records" INTEGER DEFAULT 0,
  "failed_records" INTEGER DEFAULT 0,
  "error_log" TEXT,
  "imported_by" VARCHAR,
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- departments -----
CREATE TABLE IF NOT EXISTS "departments" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- disclosures -----
CREATE TABLE IF NOT EXISTS "disclosures" (
  "id" SERIAL NOT NULL,
  "disclosure_number" TEXT NOT NULL,
  "disclosure_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fiscal_year" TEXT,
  "fiscal_quarter" TEXT,
  "reporting_period_start" DATE,
  "reporting_period_end" DATE,
  "due_date" DATE,
  "submission_date" TIMESTAMP,
  "publish_date" TIMESTAMP,
  "regulatory_body" TEXT,
  "reference_number" TEXT,
  "category" TEXT,
  "priority" TEXT DEFAULT 'normal'::text,
  "status" TEXT DEFAULT 'draft'::text,
  "content" TEXT,
  "attachments" JSONB,
  "financial_statements" JSONB,
  "reviewed_by" VARCHAR,
  "reviewed_at" TIMESTAMP,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "is_confidential" BOOLEAN DEFAULT false,
  "publish_url" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- discount_usage_logs -----
CREATE TABLE IF NOT EXISTS "discount_usage_logs" (
  "id" SERIAL NOT NULL,
  "discount_id" INTEGER NOT NULL,
  "branch_id" VARCHAR,
  "order_id" TEXT,
  "order_amount" NUMERIC,
  "discount_amount" NUMERIC,
  "customer_name" TEXT,
  "customer_phone" TEXT,
  "used_by" VARCHAR,
  "used_at" TIMESTAMP DEFAULT now(),
  "notes" TEXT,
  PRIMARY KEY ("id")
);

-- ----- display_bar_daily_summary -----
CREATE TABLE IF NOT EXISTS "display_bar_daily_summary" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "product_id" INTEGER NOT NULL,
  "summary_date" TEXT NOT NULL,
  "opening_quantity" INTEGER NOT NULL DEFAULT 0,
  "received_quantity" INTEGER NOT NULL DEFAULT 0,
  "sold_quantity" INTEGER NOT NULL DEFAULT 0,
  "wasted_quantity" INTEGER NOT NULL DEFAULT 0,
  "closing_quantity" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- display_bar_receipts -----
CREATE TABLE IF NOT EXISTS "display_bar_receipts" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "product_id" INTEGER NOT NULL,
  "receipt_date" TEXT NOT NULL,
  "receipt_time" TEXT NOT NULL,
  "shift_id" INTEGER,
  "quantity" INTEGER NOT NULL,
  "received_by" VARCHAR,
  "production_batch" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- dividend_distributions -----
CREATE TABLE IF NOT EXISTS "dividend_distributions" (
  "id" SERIAL NOT NULL,
  "distribution_number" TEXT NOT NULL,
  "fiscal_year" TEXT NOT NULL,
  "distribution_type" TEXT NOT NULL,
  "description" TEXT,
  "total_amount" NUMERIC NOT NULL,
  "amount_per_share" NUMERIC NOT NULL,
  "eligible_shares" INTEGER NOT NULL,
  "record_date" DATE NOT NULL,
  "payment_date" DATE NOT NULL,
  "board_resolution_id" INTEGER,
  "assembly_meeting_id" INTEGER,
  "status" TEXT DEFAULT 'announced'::text,
  "paid_amount" NUMERIC DEFAULT 0,
  "withholding_tax_rate" NUMERIC DEFAULT 0,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- document_access_logs -----
CREATE TABLE IF NOT EXISTS "document_access_logs" (
  "id" SERIAL NOT NULL,
  "document_id" INTEGER NOT NULL,
  "user_id" VARCHAR,
  "user_name" TEXT,
  "action" TEXT NOT NULL,
  "action_details" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "version_number" INTEGER,
  "accessed_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----- document_categories -----
CREATE TABLE IF NOT EXISTS "document_categories" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "description" TEXT,
  "color" TEXT DEFAULT '#6B7280'::text,
  "icon" TEXT DEFAULT 'folder'::text,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----- document_folders -----
CREATE TABLE IF NOT EXISTS "document_folders" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "description" TEXT,
  "parent_id" INTEGER,
  "path" TEXT DEFAULT '/'::text,
  "access_level" TEXT DEFAULT 'internal'::text,
  "is_locked" BOOLEAN DEFAULT false,
  "owner_id" VARCHAR,
  "owner_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----- document_shares -----
CREATE TABLE IF NOT EXISTS "document_shares" (
  "id" SERIAL NOT NULL,
  "document_id" INTEGER NOT NULL,
  "folder_id" INTEGER,
  "shared_with_user_id" VARCHAR,
  "shared_with_user_name" TEXT,
  "shared_with_branch_id" VARCHAR,
  "share_type" TEXT DEFAULT 'user'::text,
  "permission" TEXT DEFAULT 'view'::text,
  "expires_at" TIMESTAMP,
  "share_link" TEXT,
  "share_password" TEXT,
  "access_count" INTEGER DEFAULT 0,
  "max_access_count" INTEGER,
  "is_active" BOOLEAN DEFAULT true,
  "shared_by" VARCHAR,
  "shared_by_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----- document_versions -----
CREATE TABLE IF NOT EXISTS "document_versions" (
  "id" SERIAL NOT NULL,
  "document_id" INTEGER NOT NULL,
  "version_number" INTEGER NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "file_path" TEXT NOT NULL,
  "mime_type" TEXT,
  "checksum" TEXT,
  "change_notes" TEXT,
  "changed_by" VARCHAR,
  "changed_by_name" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----- documents -----
CREATE TABLE IF NOT EXISTS "documents" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR,
  "folder_id" INTEGER,
  "category_id" INTEGER,
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "description" TEXT,
  "description_en" TEXT,
  "document_number" TEXT,
  "document_date" TIMESTAMP,
  "file_name" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "file_path" TEXT NOT NULL,
  "mime_type" TEXT,
  "checksum" TEXT,
  "current_version" INTEGER DEFAULT 1,
  "access_level" TEXT DEFAULT 'internal'::text,
  "status" TEXT NOT NULL DEFAULT 'active'::text,
  "tags" TEXT[],
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "expiry_date" TIMESTAMP,
  "retention_period" INTEGER,
  "is_template" BOOLEAN DEFAULT false,
  "template_for" TEXT,
  "related_type" TEXT,
  "related_id" INTEGER,
  "owner_id" VARCHAR,
  "owner_name" TEXT,
  "last_accessed_at" TIMESTAMP,
  "last_accessed_by" VARCHAR,
  "download_count" INTEGER DEFAULT 0,
  "view_count" INTEGER DEFAULT 0,
  "is_locked" BOOLEAN DEFAULT false,
  "locked_by" VARCHAR,
  "locked_at" TIMESTAMP,
  "archived_at" TIMESTAMP,
  "archived_by" VARCHAR,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----- employee_schedules -----
CREATE TABLE IF NOT EXISTS "employee_schedules" (
  "id" SERIAL NOT NULL,
  "period_id" INTEGER,
  "employee_id" VARCHAR NOT NULL,
  "employee_name" TEXT NOT NULL,
  "schedule_date" TEXT NOT NULL,
  "day_of_week" TEXT NOT NULL,
  "shift_type" TEXT,
  "start_time" TEXT,
  "end_time" TEXT,
  "is_off" BOOLEAN NOT NULL DEFAULT false,
  "break_duration" INTEGER DEFAULT 60,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "branch_id" VARCHAR(255),
  "status" TEXT NOT NULL DEFAULT 'scheduled'::text,
  "branch_employee_id" INTEGER,
  PRIMARY KEY ("id")
);

-- ----- employee_settings -----
CREATE TABLE IF NOT EXISTS "employee_settings" (
  "id" SERIAL NOT NULL,
  "category" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label_ar" TEXT NOT NULL,
  "label_en" TEXT,
  "color" TEXT,
  "icon" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- employee_transfer_requests -----
CREATE TABLE IF NOT EXISTS "employee_transfer_requests" (
  "id" SERIAL NOT NULL,
  "employee_id" INTEGER NOT NULL,
  "source_branch_id" VARCHAR NOT NULL,
  "destination_branch_id" VARCHAR NOT NULL,
  "requested_by" VARCHAR NOT NULL,
  "requested_at" TIMESTAMP NOT NULL DEFAULT now(),
  "effective_date" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "current_approver_role" TEXT DEFAULT 'source_manager'::text,
  "rejection_reason" TEXT,
  "completed_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- exec_correspondence -----
CREATE TABLE IF NOT EXISTS "exec_correspondence" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR(255),
  "ref_number" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'incoming'::text,
  "subject" TEXT NOT NULL,
  "subject_en" TEXT,
  "body" TEXT,
  "body_en" TEXT,
  "sender_name" TEXT,
  "sender_organization" TEXT,
  "sender_email" TEXT,
  "sender_phone" TEXT,
  "receiver_name" TEXT,
  "receiver_organization" TEXT,
  "receiver_email" TEXT,
  "receiver_phone" TEXT,
  "category" TEXT DEFAULT 'general'::text,
  "priority" TEXT DEFAULT 'normal'::text,
  "status" TEXT NOT NULL DEFAULT 'received'::text,
  "received_at" TIMESTAMP,
  "sent_at" TIMESTAMP,
  "response_deadline" TIMESTAMP,
  "responded_at" TIMESTAMP,
  "response_ref_number" TEXT,
  "attachments" JSONB DEFAULT '[]'::jsonb,
  "owner_id" VARCHAR(255),
  "owner_name" TEXT,
  "assigned_to" VARCHAR(255),
  "assigned_to_name" TEXT,
  "is_confidential" BOOLEAN DEFAULT false,
  "notes" TEXT,
  "created_by" VARCHAR(255),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- exec_meeting_attendees -----
CREATE TABLE IF NOT EXISTS "exec_meeting_attendees" (
  "id" SERIAL NOT NULL,
  "meeting_id" INTEGER NOT NULL,
  "user_id" VARCHAR(255),
  "attendee_name" TEXT NOT NULL,
  "attendee_email" TEXT,
  "attendee_phone" TEXT,
  "role" TEXT DEFAULT 'attendee'::text,
  "is_external" BOOLEAN DEFAULT false,
  "external_organization" TEXT,
  "attendance_status" TEXT DEFAULT 'invited'::text,
  "attended_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- exec_meetings -----
CREATE TABLE IF NOT EXISTS "exec_meetings" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR(255),
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "agenda" TEXT,
  "agenda_en" TEXT,
  "meeting_type" TEXT DEFAULT 'regular'::text,
  "start_at" TIMESTAMP NOT NULL,
  "end_at" TIMESTAMP,
  "location" TEXT,
  "location_en" TEXT,
  "is_virtual" BOOLEAN DEFAULT false,
  "virtual_meeting_link" TEXT,
  "organizer_id" VARCHAR(255),
  "organizer_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'scheduled'::text,
  "notes" TEXT,
  "minutes" TEXT,
  "decisions" TEXT,
  "reminder_sent" BOOLEAN DEFAULT false,
  "created_by" VARCHAR(255),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- exec_notifications -----
CREATE TABLE IF NOT EXISTS "exec_notifications" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR(255),
  "branch_id" VARCHAR(255),
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "body" TEXT,
  "body_en" TEXT,
  "entity_type" TEXT,
  "entity_id" INTEGER,
  "priority" TEXT DEFAULT 'normal'::text,
  "is_read" BOOLEAN DEFAULT false,
  "read_at" TIMESTAMP,
  "scheduled_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- exec_task_comments -----
CREATE TABLE IF NOT EXISTS "exec_task_comments" (
  "id" SERIAL NOT NULL,
  "task_id" INTEGER NOT NULL,
  "user_id" VARCHAR(255),
  "user_name" TEXT,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- exec_tasks -----
CREATE TABLE IF NOT EXISTS "exec_tasks" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR(255),
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "description" TEXT,
  "description_en" TEXT,
  "task_type" TEXT DEFAULT 'general'::text,
  "assigned_to" VARCHAR(255),
  "assigned_to_name" TEXT,
  "created_by" VARCHAR(255),
  "created_by_name" TEXT,
  "related_type" TEXT,
  "related_id" INTEGER,
  "due_date" TIMESTAMP,
  "start_date" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "priority" TEXT NOT NULL DEFAULT 'medium'::text,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "progress" INTEGER DEFAULT 0,
  "notes" TEXT,
  "reminder_sent" BOOLEAN DEFAULT false,
  "reminder_date" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- external_integrations -----
CREATE TABLE IF NOT EXISTS "external_integrations" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" JSONB,
  "is_active" TEXT DEFAULT 'true'::text,
  "last_sync_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- financial_cogs -----
CREATE TABLE IF NOT EXISTS "financial_cogs" (
  "id" SERIAL NOT NULL,
  "period_id" INTEGER NOT NULL,
  "item_type" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "waste_amount" REAL DEFAULT 0,
  "waste_pct" REAL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- financial_fixed_costs -----
CREATE TABLE IF NOT EXISTS "financial_fixed_costs" (
  "id" SERIAL NOT NULL,
  "period_id" INTEGER NOT NULL,
  "cost_type" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- financial_metrics -----
CREATE TABLE IF NOT EXISTS "financial_metrics" (
  "id" SERIAL NOT NULL,
  "period_id" INTEGER NOT NULL,
  "total_revenue" REAL DEFAULT 0,
  "total_cogs" REAL DEFAULT 0,
  "total_operating_expenses" REAL DEFAULT 0,
  "total_fixed_costs" REAL DEFAULT 0,
  "gross_profit" REAL DEFAULT 0,
  "net_profit" REAL DEFAULT 0,
  "gross_margin_pct" REAL DEFAULT 0,
  "net_margin_pct" REAL DEFAULT 0,
  "break_even_sales" REAL DEFAULT 0,
  "salary_to_sales_pct" REAL DEFAULT 0,
  "rent_to_revenue_pct" REAL DEFAULT 0,
  "waste_pct" REAL DEFAULT 0,
  "invoice_count" INTEGER DEFAULT 0,
  "avg_invoice_value" REAL DEFAULT 0,
  "ebitda" REAL DEFAULT 0,
  "ebitda_margin_pct" REAL DEFAULT 0,
  "contribution_margin" REAL DEFAULT 0,
  "contribution_margin_pct" REAL DEFAULT 0,
  "labor_productivity" REAL DEFAULT 0,
  "revenue_per_employee" REAL DEFAULT 0,
  "employee_count" INTEGER DEFAULT 0,
  "operating_profit" REAL DEFAULT 0,
  "operating_margin_pct" REAL DEFAULT 0,
  "rating" TEXT DEFAULT 'average'::text,
  "rating_reasons" JSONB,
  "recommendations" JSONB,
  "calculated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- financial_operating_expenses -----
CREATE TABLE IF NOT EXISTS "financial_operating_expenses" (
  "id" SERIAL NOT NULL,
  "period_id" INTEGER NOT NULL,
  "expense_type" TEXT NOT NULL,
  "amount" REAL NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- financial_periods -----
CREATE TABLE IF NOT EXISTS "financial_periods" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "period_type" TEXT NOT NULL DEFAULT 'monthly'::text,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "target_revenue" REAL DEFAULT 0,
  "target_gross_margin" REAL DEFAULT 0,
  "target_net_margin" REAL DEFAULT 0,
  "status" TEXT DEFAULT 'draft'::text,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- financial_sales -----
CREATE TABLE IF NOT EXISTS "financial_sales" (
  "id" SERIAL NOT NULL,
  "period_id" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "category" TEXT,
  "shift" TEXT,
  "total_amount" REAL NOT NULL DEFAULT 0,
  "invoice_count" INTEGER DEFAULT 0,
  "avg_invoice_value" REAL DEFAULT 0,
  "date" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- finished_goods_inventory -----
CREATE TABLE IF NOT EXISTS "finished_goods_inventory" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "product_id" INTEGER,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "unit" TEXT DEFAULT 'قطعة'::text,
  "production_date" TEXT NOT NULL,
  "last_batch_id" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "product_name_normalized" TEXT,
  PRIMARY KEY ("id")
);

-- ----- finished_goods_transfers -----
CREATE TABLE IF NOT EXISTS "finished_goods_transfers" (
  "id" SERIAL NOT NULL,
  "inventory_id" INTEGER NOT NULL,
  "source_branch_id" VARCHAR NOT NULL,
  "destination_type" TEXT NOT NULL,
  "destination_branch_id" VARCHAR,
  "product_id" INTEGER,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "quantity" INTEGER NOT NULL,
  "unit" TEXT DEFAULT 'قطعة'::text,
  "transfer_date" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed'::text,
  "created_by" VARCHAR,
  "created_by_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- governance_meetings -----
CREATE TABLE IF NOT EXISTS "governance_meetings" (
  "id" SERIAL NOT NULL,
  "meeting_number" TEXT NOT NULL,
  "meeting_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "meeting_date" TIMESTAMP NOT NULL,
  "start_time" TEXT,
  "end_time" TEXT,
  "location" TEXT,
  "location_type" TEXT DEFAULT 'in_person'::text,
  "virtual_meeting_link" TEXT,
  "agenda" TEXT,
  "agenda_items" JSONB,
  "quorum_required" NUMERIC DEFAULT 50.00,
  "quorum_achieved" BOOLEAN,
  "attendance_count" INTEGER DEFAULT 0,
  "total_eligible_votes" INTEGER,
  "status" TEXT DEFAULT 'scheduled'::text,
  "postponed_to" TIMESTAMP,
  "cancellation_reason" TEXT,
  "invitation_sent_at" TIMESTAMP,
  "reminder_sent_at" TIMESTAMP,
  "minutes_status" TEXT DEFAULT 'pending'::text,
  "minutes_approved_at" TIMESTAMP,
  "minutes_approved_by" VARCHAR,
  "fiscal_year" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- incentive_awards -----
CREATE TABLE IF NOT EXISTS "incentive_awards" (
  "id" SERIAL NOT NULL,
  "award_type" TEXT NOT NULL,
  "branch_id" VARCHAR,
  "cashier_id" VARCHAR,
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "target_amount" REAL NOT NULL,
  "achieved_amount" REAL NOT NULL,
  "achievement_percent" REAL NOT NULL,
  "tier_id" INTEGER,
  "calculated_reward" REAL NOT NULL,
  "adjusted_reward" REAL,
  "final_reward" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "notes" TEXT,
  "journal_ids" JSONB,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "paid_at" TIMESTAMP,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- incentive_tiers -----
CREATE TABLE IF NOT EXISTS "incentive_tiers" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "min_achievement_percent" REAL NOT NULL,
  "max_achievement_percent" REAL,
  "reward_type" TEXT NOT NULL,
  "fixed_amount" REAL,
  "percentage_rate" REAL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "applicable_to" TEXT NOT NULL DEFAULT 'all'::text,
  "sort_order" INTEGER DEFAULT 0,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- influencer_campaign_links -----
CREATE TABLE IF NOT EXISTS "influencer_campaign_links" (
  "id" SERIAL NOT NULL,
  "influencer_id" INTEGER NOT NULL,
  "campaign_id" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "contract_amount" REAL,
  "deliverables" JSONB,
  "deliverables_done" JSONB,
  "start_date" TEXT,
  "end_date" TEXT,
  "performance_score" REAL,
  "sales_impact" REAL,
  "engagement_generated" INTEGER,
  "impressions_generated" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- influencer_contacts -----
CREATE TABLE IF NOT EXISTS "influencer_contacts" (
  "id" SERIAL NOT NULL,
  "influencer_id" INTEGER NOT NULL,
  "contact_type" TEXT NOT NULL,
  "contact_date" TEXT NOT NULL,
  "contact_time" TEXT,
  "subject" TEXT,
  "notes" TEXT,
  "outcome" TEXT,
  "next_follow_up" TEXT,
  "contacted_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- influencer_contracts -----
CREATE TABLE IF NOT EXISTS "influencer_contracts" (
  "id" SERIAL NOT NULL,
  "contract_number" TEXT NOT NULL,
  "influencer_id" INTEGER,
  "influencer_name" TEXT NOT NULL,
  "influencer_phone" TEXT,
  "influencer_email" TEXT,
  "national_id" TEXT,
  "bank_name" TEXT,
  "bank_account_number" TEXT,
  "bank_account_holder" TEXT,
  "iban" TEXT,
  "campaign_name" TEXT NOT NULL,
  "campaign_description" TEXT,
  "branch_id" VARCHAR,
  "branch_name" TEXT,
  "coverage_location" TEXT,
  "coverage_date" TEXT,
  "coverage_time" TEXT,
  "contract_amount" REAL NOT NULL,
  "currency" TEXT DEFAULT 'SAR'::text,
  "payment_terms" TEXT,
  "deliverables" TEXT[],
  "content_requirements" TEXT,
  "exclusivity_clause" BOOLEAN DEFAULT false,
  "contract_start_date" TEXT NOT NULL,
  "contract_end_date" TEXT,
  "influencer_signature" TEXT,
  "influencer_signed_at" TIMESTAMP,
  "company_signature" TEXT,
  "company_signed_at" TIMESTAMP,
  "company_signed_by" VARCHAR,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "finance_approved" BOOLEAN DEFAULT false,
  "finance_approved_by" VARCHAR,
  "finance_approved_at" TIMESTAMP,
  "finance_notes" TEXT,
  "payment_status" TEXT DEFAULT 'pending'::text,
  "payment_date" TEXT,
  "payment_reference" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- influencer_payments -----
CREATE TABLE IF NOT EXISTS "influencer_payments" (
  "id" SERIAL NOT NULL,
  "influencer_id" INTEGER NOT NULL,
  "campaign_id" INTEGER,
  "payment_type" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SAR'::text,
  "payment_date" TEXT NOT NULL,
  "payment_method" TEXT,
  "reference_number" TEXT,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed'::text,
  "invoice_number" TEXT,
  "attachment_url" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "approved_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- interest_declarations -----
CREATE TABLE IF NOT EXISTS "interest_declarations" (
  "id" SERIAL NOT NULL,
  "declaration_number" TEXT NOT NULL,
  "board_member_id" INTEGER NOT NULL,
  "declaration_type" TEXT NOT NULL,
  "declaration_date" DATE NOT NULL,
  "fiscal_year" TEXT,
  "related_party_name" TEXT,
  "relationship_type" TEXT,
  "description" TEXT NOT NULL,
  "transaction_type" TEXT,
  "transaction_value" NUMERIC,
  "action_taken" TEXT,
  "board_decision" TEXT,
  "status" TEXT DEFAULT 'pending'::text,
  "reviewed_by" VARCHAR,
  "reviewed_at" TIMESTAMP,
  "attachments" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- inventory_items -----
CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id" VARCHAR NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "price" REAL,
  "status" TEXT,
  "last_check" TEXT,
  "notes" TEXT,
  "serial_number" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "image_url" TEXT,
  "next_inspection_date" TEXT,
  "inspection_interval_days" INTEGER,
  PRIMARY KEY ("id")
);

-- ----- job_role_permissions -----
CREATE TABLE IF NOT EXISTS "job_role_permissions" (
  "id" SERIAL NOT NULL,
  "job_title" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "actions" TEXT[] NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- journal_attachments -----
CREATE TABLE IF NOT EXISTS "journal_attachments" (
  "id" SERIAL NOT NULL,
  "journal_id" INTEGER NOT NULL,
  "attachment_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_data" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER,
  "notes" TEXT,
  "uploaded_by" VARCHAR,
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- journal_entry_lines -----
CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
  "id" SERIAL NOT NULL,
  "journal_entry_id" INTEGER NOT NULL,
  "line_number" INTEGER NOT NULL,
  "account_code" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "description" TEXT,
  "debit_amount" NUMERIC DEFAULT '0'::numeric,
  "credit_amount" NUMERIC DEFAULT '0'::numeric,
  "cost_center" TEXT,
  "vat_code" TEXT,
  "vat_rate" NUMERIC,
  PRIMARY KEY ("id")
);

-- ----- marketing_alerts -----
CREATE TABLE IF NOT EXISTS "marketing_alerts" (
  "id" SERIAL NOT NULL,
  "alert_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "campaign_id" INTEGER,
  "task_id" INTEGER,
  "target_user_id" VARCHAR,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "acknowledged_by" VARCHAR,
  "acknowledged_at" TIMESTAMP,
  "scheduled_for" TIMESTAMP,
  "sent_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- marketing_assets -----
CREATE TABLE IF NOT EXISTS "marketing_assets" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "asset_type" TEXT NOT NULL,
  "file_url" TEXT,
  "thumbnail_url" TEXT,
  "campaign_id" INTEGER,
  "category" TEXT,
  "tags" TEXT[],
  "file_size" INTEGER,
  "dimensions" TEXT,
  "duration" INTEGER,
  "usage_count" INTEGER DEFAULT 0,
  "uploaded_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "branch_id" VARCHAR,
  "location" TEXT,
  "quantity" INTEGER DEFAULT 1,
  "description" TEXT,
  PRIMARY KEY ("id")
);

-- ----- marketing_calendar_events -----
CREATE TABLE IF NOT EXISTS "marketing_calendar_events" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "event_type" TEXT NOT NULL,
  "campaign_id" INTEGER,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT,
  "start_time" TEXT,
  "end_time" TEXT,
  "is_all_day" BOOLEAN NOT NULL DEFAULT false,
  "color" TEXT,
  "assigned_to" VARCHAR,
  "reminder_minutes" INTEGER,
  "is_recurring" BOOLEAN NOT NULL DEFAULT false,
  "recurring_pattern" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- marketing_campaigns -----
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_ar" TEXT,
  "description" TEXT,
  "objective" TEXT NOT NULL,
  "season" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "total_budget" REAL NOT NULL DEFAULT 0,
  "spent_budget" REAL NOT NULL DEFAULT 0,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "target_audience" TEXT,
  "channels" TEXT[],
  "kpis" JSONB,
  "owner_id" VARCHAR,
  "created_by" VARCHAR,
  "notes" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- marketing_influencers -----
CREATE TABLE IF NOT EXISTS "marketing_influencers" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_ar" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "profile_image_url" TEXT,
  "specialty" TEXT NOT NULL,
  "platforms" TEXT[],
  "content_types" TEXT[],
  "follower_count" INTEGER DEFAULT 0,
  "engagement_rate" REAL,
  "avg_views" INTEGER DEFAULT 0,
  "price_per_post" REAL,
  "price_per_story" REAL,
  "price_per_video" REAL,
  "city" TEXT,
  "region" TEXT,
  "social_handles" JSONB,
  "best_collaboration_times" TEXT,
  "notes" TEXT,
  "rating" REAL,
  "total_collaborations" INTEGER DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "ai_insights" JSONB,
  "last_contact_date" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "account_url" TEXT,
  "coverage_url" TEXT,
  "follower_count_text" TEXT,
  "view_rating" INTEGER,
  "bank_account_number" TEXT,
  "bank_account_holder" TEXT,
  "bank_name" TEXT,
  PRIMARY KEY ("id")
);

-- ----- marketing_performance_reports -----
CREATE TABLE IF NOT EXISTS "marketing_performance_reports" (
  "id" SERIAL NOT NULL,
  "report_type" TEXT NOT NULL,
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "campaign_id" INTEGER,
  "branch_id" VARCHAR,
  "total_spend" REAL DEFAULT 0,
  "total_reach" INTEGER DEFAULT 0,
  "total_impressions" INTEGER DEFAULT 0,
  "total_engagement" INTEGER DEFAULT 0,
  "engagement_rate" REAL DEFAULT 0,
  "estimated_sales_impact" REAL DEFAULT 0,
  "actual_sales_impact" REAL DEFAULT 0,
  "roi" REAL DEFAULT 0,
  "cost_per_engagement" REAL DEFAULT 0,
  "cost_per_impression" REAL DEFAULT 0,
  "previous_period_sales" REAL,
  "sales_growth" REAL,
  "top_performing_content" JSONB,
  "top_influencers" JSONB,
  "recommendations" JSONB,
  "generated_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- marketing_task_activities -----
CREATE TABLE IF NOT EXISTS "marketing_task_activities" (
  "id" SERIAL NOT NULL,
  "task_id" INTEGER NOT NULL,
  "activity_type" TEXT NOT NULL,
  "description" TEXT,
  "old_value" TEXT,
  "new_value" TEXT,
  "user_id" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- marketing_tasks -----
CREATE TABLE IF NOT EXISTS "marketing_tasks" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "campaign_id" INTEGER,
  "assigned_to" VARCHAR,
  "assigned_by" VARCHAR,
  "priority" TEXT NOT NULL DEFAULT 'medium'::text,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "due_date" TEXT,
  "completed_at" TIMESTAMP,
  "estimated_hours" REAL,
  "actual_hours" REAL,
  "category" TEXT,
  "attachments" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- marketing_team_members -----
CREATE TABLE IF NOT EXISTS "marketing_team_members" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR,
  "role" TEXT NOT NULL,
  "specialization" TEXT,
  "is_team_lead" BOOLEAN NOT NULL DEFAULT false,
  "assigned_branches" TEXT[],
  "weekly_hours_capacity" REAL DEFAULT 40,
  "current_workload" REAL DEFAULT 0,
  "join_date" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  PRIMARY KEY ("id")
);

-- ----- material_transfer_items -----
CREATE TABLE IF NOT EXISTS "material_transfer_items" (
  "id" SERIAL NOT NULL,
  "transfer_id" INTEGER NOT NULL,
  "item_id" INTEGER NOT NULL,
  "item_name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "received_quantity" INTEGER,
  "notes" TEXT,
  "available_quantity" INTEGER,
  "discrepancy" INTEGER,
  "discrepancy_notes" TEXT,
  "original_quantity" INTEGER,
  "is_modified" BOOLEAN DEFAULT false,
  "modified_by" TEXT,
  "modified_by_name" TEXT,
  "modified_at" TIMESTAMP,
  "modification_notes" TEXT,
  PRIMARY KEY ("id")
);

-- ----- material_transfers -----
CREATE TABLE IF NOT EXISTS "material_transfers" (
  "id" SERIAL NOT NULL,
  "transfer_number" TEXT NOT NULL,
  "request_id" INTEGER,
  "source_type" TEXT NOT NULL DEFAULT 'warehouse'::text,
  "source_branch_id" VARCHAR,
  "destination_branch_id" VARCHAR NOT NULL,
  "transfer_date" TEXT NOT NULL,
  "delivery_date" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "driver_name" TEXT,
  "vehicle_number" TEXT,
  "departure_time" TIMESTAMP,
  "arrival_time" TIMESTAMP,
  "received_by" VARCHAR,
  "received_by_name" TEXT,
  "receiver_signature" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_by_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "approved_by" VARCHAR,
  "approved_by_name" TEXT,
  "approved_at" TIMESTAMP,
  "rejected_by" VARCHAR,
  "rejected_by_name" TEXT,
  "rejected_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "delivery_notes" TEXT,
  "has_discrepancy" BOOLEAN DEFAULT false,
  "has_quantity_modifications" BOOLEAN DEFAULT false,
  PRIMARY KEY ("id")
);

-- ----- meeting_attendance -----
CREATE TABLE IF NOT EXISTS "meeting_attendance" (
  "id" SERIAL NOT NULL,
  "meeting_id" INTEGER NOT NULL,
  "attendee_type" TEXT NOT NULL,
  "board_member_id" INTEGER,
  "shareholder_id" INTEGER,
  "attendee_name" TEXT NOT NULL,
  "attendee_role" TEXT,
  "represented_shares" INTEGER,
  "voting_power" NUMERIC,
  "attendance_status" TEXT DEFAULT 'expected'::text,
  "arrival_time" TIMESTAMP,
  "departure_time" TIMESTAMP,
  "attendance_method" TEXT DEFAULT 'in_person'::text,
  "proxy_holder_name" TEXT,
  "proxy_document_url" TEXT,
  "signature_url" TEXT,
  "signed_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- meeting_minutes -----
CREATE TABLE IF NOT EXISTS "meeting_minutes" (
  "id" SERIAL NOT NULL,
  "meeting_id" INTEGER NOT NULL,
  "minutes_number" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "summary" TEXT,
  "attendance_list" JSONB,
  "discussion_points" JSONB,
  "decisions" JSONB,
  "voting_results" JSONB,
  "next_meeting_date" TIMESTAMP,
  "attachments" JSONB,
  "status" TEXT DEFAULT 'draft'::text,
  "prepared_by" VARCHAR,
  "prepared_at" TIMESTAMP,
  "reviewed_by" VARCHAR,
  "reviewed_at" TIMESTAMP,
  "signed_by" JSONB,
  "archived_at" TIMESTAMP,
  "archive_reference" TEXT,
  "pdf_url" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- meeting_rsvps -----
CREATE TABLE IF NOT EXISTS "meeting_rsvps" (
  "id" SERIAL NOT NULL,
  "meeting_id" INTEGER NOT NULL,
  "shareholder_id" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT DEFAULT 'pending'::text,
  "confirmed_at" TIMESTAMP,
  "declined_at" TIMESTAMP,
  "response_note" TEXT,
  "shareholder_name" TEXT NOT NULL,
  "shareholder_phone" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- notification_queue -----
CREATE TABLE IF NOT EXISTS "notification_queue" (
  "id" SERIAL NOT NULL,
  "recipient_phone" TEXT NOT NULL,
  "recipient_name" TEXT,
  "channel" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "error_message" TEXT,
  "related_module" TEXT,
  "related_entity_id" TEXT,
  "sent_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- notification_reads -----
CREATE TABLE IF NOT EXISTS "notification_reads" (
  "id" SERIAL NOT NULL,
  "notification_id" INTEGER NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "read_at" TIMESTAMP NOT NULL DEFAULT now(),
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("id")
);

-- ----- notification_templates -----
CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "is_active" TEXT DEFAULT 'true'::text,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- notifications -----
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR,
  "user_id" VARCHAR,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT DEFAULT 'info'::text,
  "category" TEXT,
  "priority" TEXT DEFAULT 'normal'::text,
  "link_type" TEXT,
  "link_id" INTEGER,
  "link_url" TEXT,
  "is_read" BOOLEAN DEFAULT false,
  "read_at" TIMESTAMP,
  "is_dismissed" BOOLEAN DEFAULT false,
  "dismissed_at" TIMESTAMP,
  "scheduled_for" TIMESTAMP,
  "expires_at" TIMESTAMP,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- org_job_roles -----
CREATE TABLE IF NOT EXISTS "org_job_roles" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "parent_id" INTEGER,
  "level" INTEGER NOT NULL DEFAULT 1,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "title_ar" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "summary_ar" TEXT,
  "summary_en" TEXT,
  "responsibilities_ar" JSONB DEFAULT '[]'::jsonb,
  "responsibilities_en" JSONB DEFAULT '[]'::jsonb,
  "qualifications_ar" JSONB DEFAULT '[]'::jsonb,
  "qualifications_en" JSONB DEFAULT '[]'::jsonb,
  "icon" TEXT DEFAULT 'user'::text,
  "color" TEXT DEFAULT 'bg-amber-500'::text,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- payment_requests -----
CREATE TABLE IF NOT EXISTS "payment_requests" (
  "id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "contract_id" INTEGER,
  "request_number" TEXT,
  "request_type" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "description" TEXT NOT NULL,
  "beneficiary_name" TEXT,
  "beneficiary_bank" TEXT,
  "beneficiary_iban" TEXT,
  "category_id" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "priority" TEXT DEFAULT 'normal'::text,
  "request_date" TEXT,
  "due_date" TEXT,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "paid_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "attachment_url" TEXT,
  "invoice_number" TEXT,
  "notes" TEXT,
  "requested_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- performance_alerts -----
CREATE TABLE IF NOT EXISTS "performance_alerts" (
  "id" SERIAL NOT NULL,
  "cashier_id" VARCHAR(255),
  "branch_id" VARCHAR(255) NOT NULL,
  "shift_type" VARCHAR(50) NOT NULL,
  "alert_type" VARCHAR(50) NOT NULL,
  "alert_level" VARCHAR(20) NOT NULL,
  "message" TEXT NOT NULL,
  "current_value" NUMERIC,
  "target_value" NUMERIC,
  "percentage" NUMERIC,
  "is_read" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- permission_audit_logs -----
CREATE TABLE IF NOT EXISTS "permission_audit_logs" (
  "id" SERIAL NOT NULL,
  "target_user_id" VARCHAR NOT NULL,
  "changed_by_user_id" VARCHAR NOT NULL,
  "action" TEXT NOT NULL,
  "module" TEXT,
  "old_actions" TEXT[],
  "new_actions" TEXT[],
  "template_applied" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- permission_check_logs -----
CREATE TABLE IF NOT EXISTS "permission_check_logs" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "module" VARCHAR(100) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "resource_id" TEXT,
  "branch_id" VARCHAR,
  "allowed" BOOLEAN NOT NULL,
  "denial_reason" TEXT,
  "ip_address" TEXT,
  "request_path" TEXT,
  "request_method" VARCHAR(10),
  "response_time" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- permissions -----
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" SERIAL NOT NULL,
  "module" VARCHAR(100) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- pnl_branch_settings -----
CREATE TABLE IF NOT EXISTS "pnl_branch_settings" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "monthly_rent" REAL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- pnl_monthly_inputs -----
CREATE TABLE IF NOT EXISTS "pnl_monthly_inputs" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "electricity_cost" REAL DEFAULT 0,
  "water_cost" REAL DEFAULT 0,
  "utilities_other" REAL DEFAULT 0,
  "cogs_cost" REAL DEFAULT 0,
  "cogs_notes" TEXT,
  "maintenance_cost" REAL DEFAULT 0,
  "marketing_cost" REAL DEFAULT 0,
  "supplies_cost" REAL DEFAULT 0,
  "other_costs" REAL DEFAULT 0,
  "other_costs_details" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- point_settings -----
CREATE TABLE IF NOT EXISTS "point_settings" (
  "id" SERIAL NOT NULL,
  "point_value" REAL NOT NULL DEFAULT 0.5,
  "max_daily_points" INTEGER,
  "max_monthly_points" INTEGER,
  "seasonal_multiplier" REAL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "updated_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- product_commissions -----
CREATE TABLE IF NOT EXISTS "product_commissions" (
  "id" SERIAL NOT NULL,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "commission_type" TEXT NOT NULL,
  "branch_id" VARCHAR,
  "target_quantity" INTEGER NOT NULL,
  "points_on_target" INTEGER NOT NULL,
  "bonus_points_per_extra" REAL DEFAULT 0,
  "shift_type" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TEXT NOT NULL,
  "valid_to" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "cashier_id" VARCHAR,
  PRIMARY KEY ("id")
);

-- ----- product_prices -----
CREATE TABLE IF NOT EXISTS "product_prices" (
  "id" SERIAL NOT NULL,
  "product_name" TEXT NOT NULL,
  "branch_id" VARCHAR,
  "price" REAL NOT NULL,
  "cost_price" REAL,
  "currency" VARCHAR(3) DEFAULT 'SAR'::character varying,
  "effective_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "source" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_by" VARCHAR,
  PRIMARY KEY ("id")
);

-- ----- product_sales_analytics -----
CREATE TABLE IF NOT EXISTS "product_sales_analytics" (
  "id" SERIAL NOT NULL,
  "upload_id" INTEGER NOT NULL,
  "product_id" INTEGER,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "total_quantity_sold" INTEGER DEFAULT 0,
  "total_revenue" REAL DEFAULT 0,
  "average_daily_sales" REAL DEFAULT 0,
  "sales_velocity" REAL DEFAULT 0,
  "profit_margin" REAL DEFAULT 0,
  "peak_hours" TEXT,
  "weekday_pattern" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- product_storage_settings -----
CREATE TABLE IF NOT EXISTS "product_storage_settings" (
  "id" SERIAL NOT NULL,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "is_storable" BOOLEAN DEFAULT false,
  "max_storage_days" INTEGER DEFAULT 0,
  "storage_type" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_by" VARCHAR,
  "suggested_category" TEXT,
  "confidence_score" INTEGER DEFAULT 0,
  "is_verified" BOOLEAN DEFAULT false,
  "verified_by" VARCHAR,
  "verified_at" TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----- production_ai_plans -----
CREATE TABLE IF NOT EXISTS "production_ai_plans" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "plan_name" TEXT NOT NULL,
  "target_sales_value" REAL NOT NULL,
  "plan_date" TEXT NOT NULL,
  "dataset_id" INTEGER,
  "algorithm_version" TEXT DEFAULT 'v1.0'::text,
  "confidence_score" REAL DEFAULT 0,
  "recommended_products" JSONB,
  "total_estimated_value" REAL DEFAULT 0,
  "total_estimated_cost" REAL DEFAULT 0,
  "profit_margin" REAL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'generated'::text,
  "applied_to_order_id" INTEGER,
  "reviewed_by" VARCHAR,
  "reviewed_at" TIMESTAMP,
  "review_notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- production_inventory_logs -----
CREATE TABLE IF NOT EXISTS "production_inventory_logs" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "product_id" INTEGER,
  "product_name" TEXT NOT NULL,
  "movement_type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "balance_before" INTEGER DEFAULT 0,
  "balance_after" INTEGER DEFAULT 0,
  "reference_type" TEXT,
  "reference_id" INTEGER,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_by_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- production_order_items -----
CREATE TABLE IF NOT EXISTS "production_order_items" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER NOT NULL,
  "product_id" INTEGER,
  "product_name" TEXT NOT NULL,
  "product_category" TEXT,
  "target_quantity" INTEGER NOT NULL,
  "produced_quantity" INTEGER DEFAULT 0,
  "wasted_quantity" INTEGER DEFAULT 0,
  "unit_price" REAL DEFAULT 0,
  "total_value" REAL DEFAULT 0,
  "scheduled_date" TEXT,
  "scheduled_shift" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "assigned_to" TEXT,
  "priority" INTEGER DEFAULT 0,
  "sales_velocity" REAL,
  "notes" TEXT,
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "original_quantity" INTEGER,
  PRIMARY KEY ("id")
);

-- ----- production_order_schedules -----
CREATE TABLE IF NOT EXISTS "production_order_schedules" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER NOT NULL,
  "scheduled_date" TEXT NOT NULL,
  "day_of_week" TEXT,
  "shift" TEXT,
  "target_quantity" INTEGER DEFAULT 0,
  "completed_quantity" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "assigned_department" TEXT,
  "assigned_employees" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- production_orders -----
CREATE TABLE IF NOT EXISTS "production_orders" (
  "id" SERIAL NOT NULL,
  "order_number" TEXT,
  "branch_id" VARCHAR NOT NULL,
  "shift_id" INTEGER,
  "product_id" INTEGER NOT NULL,
  "target_quantity" INTEGER NOT NULL,
  "produced_quantity" INTEGER DEFAULT 0,
  "wasted_quantity" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "priority" TEXT DEFAULT 'normal'::text,
  "scheduled_date" TEXT,
  "scheduled_time" TEXT,
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "assigned_to" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- products -----
CREATE TABLE IF NOT EXISTS "products" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unit" TEXT DEFAULT 'قطعة'::text,
  "base_price" REAL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "sku" TEXT,
  "price_excl_vat" REAL,
  "vat_amount" REAL,
  "vat_rate" REAL DEFAULT 0.15,
  "product_type" TEXT DEFAULT 'finish'::text,
  "name_en" TEXT,
  PRIMARY KEY ("id")
);

-- ----- project_budget_allocations -----
CREATE TABLE IF NOT EXISTS "project_budget_allocations" (
  "id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "category_id" INTEGER,
  "planned_amount" REAL NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- project_work_items -----
CREATE TABLE IF NOT EXISTS "project_work_items" (
  "id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "category_id" INTEGER,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "cost_estimate" REAL,
  "actual_cost" REAL,
  "contractor_id" INTEGER,
  "scheduled_start" TEXT,
  "scheduled_end" TEXT,
  "completed_at" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- proxy_votes -----
CREATE TABLE IF NOT EXISTS "proxy_votes" (
  "id" SERIAL NOT NULL,
  "proxy_number" TEXT NOT NULL,
  "meeting_id" INTEGER NOT NULL,
  "principal_shareholder_id" INTEGER NOT NULL,
  "proxy_holder_shareholder_id" INTEGER,
  "proxy_holder_name" TEXT NOT NULL,
  "proxy_holder_national_id" TEXT,
  "shares_represented" INTEGER NOT NULL,
  "voting_power" NUMERIC NOT NULL,
  "proxy_type" TEXT NOT NULL,
  "voting_instructions" JSONB,
  "document_url" TEXT,
  "valid_from" TIMESTAMP NOT NULL,
  "valid_until" TIMESTAMP NOT NULL,
  "status" TEXT DEFAULT 'pending'::text,
  "verified_by" VARCHAR,
  "verified_at" TIMESTAMP,
  "used_at" TIMESTAMP,
  "revoked_at" TIMESTAMP,
  "revocation_reason" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- purchasing_request_items -----
CREATE TABLE IF NOT EXISTS "purchasing_request_items" (
  "id" SERIAL NOT NULL,
  "purchasing_request_id" INTEGER NOT NULL,
  "item_id" INTEGER,
  "item_name" TEXT NOT NULL,
  "category" TEXT,
  "unit" TEXT,
  "requested_quantity" INTEGER NOT NULL DEFAULT 0,
  "approved_quantity" INTEGER DEFAULT 0,
  "ordered_quantity" INTEGER DEFAULT 0,
  "received_quantity" INTEGER DEFAULT 0,
  "unit_price" NUMERIC,
  "total_price" NUMERIC,
  "notes" TEXT,
  PRIMARY KEY ("id")
);

-- ----- purchasing_requests -----
CREATE TABLE IF NOT EXISTS "purchasing_requests" (
  "id" SERIAL NOT NULL,
  "request_number" TEXT NOT NULL,
  "source_material_request_id" INTEGER,
  "branch_id" VARCHAR NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "priority" TEXT DEFAULT 'normal'::text,
  "total_estimated_cost" NUMERIC DEFAULT 0,
  "approved_budget" NUMERIC,
  "vendor_id" INTEGER,
  "vendor_name" TEXT,
  "expected_delivery_date" TEXT,
  "actual_delivery_date" TEXT,
  "notes" TEXT,
  "requested_by" VARCHAR,
  "requested_by_name" TEXT,
  "approved_by" VARCHAR,
  "approved_by_name" TEXT,
  "approved_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- quality_checks -----
CREATE TABLE IF NOT EXISTS "quality_checks" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "shift_id" INTEGER,
  "production_order_id" INTEGER,
  "check_type" TEXT NOT NULL,
  "check_date" TEXT NOT NULL,
  "check_time" TEXT,
  "result" TEXT NOT NULL,
  "score" INTEGER,
  "temperature" REAL,
  "checked_by" TEXT NOT NULL,
  "details" TEXT,
  "issues" TEXT,
  "corrective_action" TEXT,
  "attachment_url" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- quorum_calculations -----
CREATE TABLE IF NOT EXISTS "quorum_calculations" (
  "id" SERIAL NOT NULL,
  "meeting_id" INTEGER NOT NULL,
  "calculation_type" TEXT NOT NULL,
  "resolution_id" INTEGER,
  "calculated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "total_eligible_shares" INTEGER NOT NULL,
  "total_eligible_votes" INTEGER NOT NULL,
  "present_shares" INTEGER NOT NULL,
  "present_votes" INTEGER NOT NULL,
  "proxy_shares" INTEGER DEFAULT 0,
  "proxy_votes" INTEGER DEFAULT 0,
  "total_represented_shares" INTEGER NOT NULL,
  "total_represented_votes" INTEGER NOT NULL,
  "percentage_represented" NUMERIC NOT NULL,
  "required_quorum" NUMERIC NOT NULL,
  "quorum_met" BOOLEAN NOT NULL,
  "notes" TEXT,
  "calculated_by" VARCHAR,
  PRIMARY KEY ("id")
);

-- ----- resolution_signatures -----
CREATE TABLE IF NOT EXISTS "resolution_signatures" (
  "id" SERIAL NOT NULL,
  "resolution_id" INTEGER NOT NULL,
  "board_member_id" INTEGER,
  "signature_token" TEXT NOT NULL,
  "signature_data" TEXT,
  "signature_type" TEXT DEFAULT 'draw'::text,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "signed_at" TIMESTAMP,
  "declined_at" TIMESTAMP,
  "decline_reason" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMP,
  "reminder_sent_at" TIMESTAMP,
  "reminder_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "shareholder_id" INTEGER,
  "signer_name" TEXT,
  "signer_type" TEXT DEFAULT 'board_member'::text,
  PRIMARY KEY ("id")
);

-- ----- resolution_votes -----
CREATE TABLE IF NOT EXISTS "resolution_votes" (
  "id" SERIAL NOT NULL,
  "resolution_id" INTEGER NOT NULL,
  "voter_type" TEXT NOT NULL,
  "board_member_id" INTEGER,
  "shareholder_id" INTEGER,
  "voter_name" TEXT NOT NULL,
  "vote" TEXT NOT NULL,
  "voting_power" NUMERIC DEFAULT 1.00,
  "weighted_vote" NUMERIC,
  "voted_at" TIMESTAMP NOT NULL DEFAULT now(),
  "vote_method" TEXT DEFAULT 'in_meeting'::text,
  "ip_address" TEXT,
  "device_info" TEXT,
  "signature_url" TEXT,
  "comments" TEXT,
  "is_valid" BOOLEAN DEFAULT true,
  "invalidation_reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- role_permissions -----
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" SERIAL NOT NULL,
  "role_id" INTEGER NOT NULL,
  "permission_id" INTEGER NOT NULL,
  "scope" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- role_templates -----
CREATE TABLE IF NOT EXISTS "role_templates" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "permissions" JSONB NOT NULL,
  "department_id" INTEGER,
  "is_system_default" BOOLEAN NOT NULL DEFAULT false,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- roles -----
CREATE TABLE IF NOT EXISTS "roles" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" VARCHAR(50) NOT NULL,
  "hierarchy_level" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "is_system_default" BOOLEAN NOT NULL DEFAULT false,
  "inherits_from_role_id" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- sales_data_uploads -----
CREATE TABLE IF NOT EXISTS "sales_data_uploads" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_type" TEXT DEFAULT 'excel'::text,
  "file_size" INTEGER,
  "period_start" TEXT,
  "period_end" TEXT,
  "total_records" INTEGER DEFAULT 0,
  "total_sales_value" REAL DEFAULT 0,
  "unique_products" INTEGER DEFAULT 0,
  "parsed_data" JSONB,
  "product_velocity" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "error_message" TEXT,
  "uploaded_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- saved_filters -----
CREATE TABLE IF NOT EXISTS "saved_filters" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "filter_config" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- schedule_change_audit -----
CREATE TABLE IF NOT EXISTS "schedule_change_audit" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "week_start_date" TEXT NOT NULL,
  "employee_id" VARCHAR,
  "employee_name" TEXT,
  "change_type" TEXT NOT NULL,
  "schedule_date" TEXT,
  "old_value" JSONB,
  "new_value" JSONB,
  "changed_by" VARCHAR,
  "changed_by_name" TEXT,
  "change_reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- schedule_periods -----
CREATE TABLE IF NOT EXISTS "schedule_periods" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "period_type" TEXT NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "template_id" INTEGER,
  "required_staff_per_day" JSONB,
  "notes" TEXT,
  "published_by" VARCHAR,
  "published_at" TIMESTAMP,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- schedule_templates -----
CREATE TABLE IF NOT EXISTS "schedule_templates" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "branch_id" VARCHAR,
  "is_default" BOOLEAN DEFAULT false,
  "weekly_pattern" JSONB,
  "created_by" VARCHAR,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- seasons_holidays -----
CREATE TABLE IF NOT EXISTS "seasons_holidays" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "weight_multiplier" REAL NOT NULL DEFAULT 1.0,
  "applicable_branches" JSONB,
  "description" TEXT,
  "is_recurring" BOOLEAN DEFAULT false,
  "recurring_pattern" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "category" TEXT,
  "color" TEXT DEFAULT '#f59e0b'::text,
  "icon" TEXT,
  PRIMARY KEY ("id")
);

-- ----- security_violation_alerts -----
CREATE TABLE IF NOT EXISTS "security_violation_alerts" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR,
  "violation_type" VARCHAR(50) NOT NULL,
  "severity" VARCHAR(20) NOT NULL DEFAULT 'warning'::character varying,
  "module" VARCHAR(100),
  "action" VARCHAR(50),
  "ip_address" TEXT,
  "user_agent" TEXT,
  "details" JSONB,
  "description" TEXT,
  "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolved_by" VARCHAR,
  "resolved_at" TIMESTAMP,
  "resolution_notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- sessions -----
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" VARCHAR NOT NULL,
  "sess" JSONB NOT NULL,
  "expire" TIMESTAMP NOT NULL,
  PRIMARY KEY ("sid")
);

-- ----- share_transfers -----
CREATE TABLE IF NOT EXISTS "share_transfers" (
  "id" SERIAL NOT NULL,
  "transfer_number" TEXT NOT NULL,
  "from_shareholder_id" INTEGER NOT NULL,
  "to_shareholder_id" INTEGER NOT NULL,
  "number_of_shares" INTEGER NOT NULL,
  "price_per_share" NUMERIC NOT NULL,
  "total_value" NUMERIC NOT NULL,
  "transfer_date" DATE NOT NULL,
  "transfer_type" TEXT NOT NULL,
  "approval_status" TEXT DEFAULT 'pending'::text,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "board_resolution_id" INTEGER,
  "certificate_old_number" TEXT,
  "certificate_new_number" TEXT,
  "attachment_url" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shareholder_dividends -----
CREATE TABLE IF NOT EXISTS "shareholder_dividends" (
  "id" SERIAL NOT NULL,
  "distribution_id" INTEGER NOT NULL,
  "shareholder_id" INTEGER NOT NULL,
  "shares_held" INTEGER NOT NULL,
  "gross_amount" NUMERIC NOT NULL,
  "withholding_tax" NUMERIC DEFAULT 0,
  "net_amount" NUMERIC NOT NULL,
  "payment_method" TEXT DEFAULT 'bank_transfer'::text,
  "payment_reference" TEXT,
  "payment_date" DATE,
  "status" TEXT DEFAULT 'pending'::text,
  "failure_reason" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shareholder_documents -----
CREATE TABLE IF NOT EXISTS "shareholder_documents" (
  "id" SERIAL NOT NULL,
  "shareholder_id" INTEGER NOT NULL,
  "document_type" TEXT NOT NULL,
  "document_name" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_size" INTEGER,
  "mime_type" TEXT,
  "expiry_date" DATE,
  "notes" TEXT,
  "uploaded_by" VARCHAR,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shareholders -----
CREATE TABLE IF NOT EXISTS "shareholders" (
  "id" SERIAL NOT NULL,
  "shareholder_type" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "national_id" TEXT,
  "commercial_register" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "nationality" TEXT,
  "number_of_shares" INTEGER NOT NULL,
  "share_percentage" NUMERIC NOT NULL,
  "share_class" TEXT DEFAULT 'common'::text,
  "acquisition_date" DATE NOT NULL,
  "acquisition_price" NUMERIC,
  "certificate_number" TEXT,
  "bank_name" TEXT,
  "bank_account_number" TEXT,
  "iban" TEXT,
  "is_board_member" BOOLEAN DEFAULT false,
  "board_member_id" INTEGER,
  "voting_rights" BOOLEAN DEFAULT true,
  "dividend_rights" BOOLEAN DEFAULT true,
  "status" TEXT DEFAULT 'active'::text,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shift_audit_log -----
CREATE TABLE IF NOT EXISTS "shift_audit_log" (
  "id" SERIAL NOT NULL,
  "shift_id" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "field_name" TEXT,
  "old_value" TEXT,
  "new_value" TEXT,
  "performed_by" VARCHAR,
  "performed_by_name" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "gps_latitude" NUMERIC,
  "gps_longitude" NUMERIC,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shift_checklist_responses -----
CREATE TABLE IF NOT EXISTS "shift_checklist_responses" (
  "id" SERIAL NOT NULL,
  "shift_id" INTEGER NOT NULL,
  "item_id" INTEGER NOT NULL,
  "checklist_type" TEXT NOT NULL,
  "is_completed" BOOLEAN DEFAULT false,
  "completed_at" TIMESTAMP,
  "completed_by" VARCHAR,
  "completed_by_name" TEXT,
  "notes" TEXT,
  "photo_url" TEXT,
  "status" TEXT DEFAULT 'pending'::text,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shift_employees -----
CREATE TABLE IF NOT EXISTS "shift_employees" (
  "id" SERIAL NOT NULL,
  "shift_id" INTEGER NOT NULL,
  "employee_name" TEXT NOT NULL,
  "role" TEXT,
  "check_in_time" TEXT,
  "check_out_time" TEXT,
  "status" TEXT NOT NULL DEFAULT 'expected'::text,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shift_performance_tracking -----
CREATE TABLE IF NOT EXISTS "shift_performance_tracking" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR(255) NOT NULL,
  "shift_type" VARCHAR(50) NOT NULL,
  "tracking_date" DATE NOT NULL,
  "total_sales" NUMERIC DEFAULT 0,
  "total_transactions" INTEGER DEFAULT 0,
  "average_ticket" NUMERIC DEFAULT 0,
  "target_sales" NUMERIC DEFAULT 0,
  "target_transactions" INTEGER DEFAULT 0,
  "achievement_percentage" NUMERIC DEFAULT 0,
  "status" VARCHAR(50) DEFAULT 'pending'::character varying,
  "updated_at" TIMESTAMP DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shift_photos -----
CREATE TABLE IF NOT EXISTS "shift_photos" (
  "id" SERIAL NOT NULL,
  "shift_id" INTEGER NOT NULL,
  "checklist_response_id" INTEGER,
  "photo_type" TEXT NOT NULL,
  "category" TEXT,
  "photo_url" TEXT NOT NULL,
  "thumbnail_url" TEXT,
  "caption" TEXT,
  "uploaded_by" VARCHAR,
  "uploaded_by_name" TEXT,
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shift_reminders -----
CREATE TABLE IF NOT EXISTS "shift_reminders" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "reminder_type" TEXT NOT NULL,
  "shift_date" DATE NOT NULL,
  "shift_type" TEXT NOT NULL,
  "reminder_time" TIMESTAMP NOT NULL,
  "is_sent" BOOLEAN DEFAULT false,
  "sent_at" TIMESTAMP,
  "notification_channels" TEXT[] DEFAULT ARRAY['system'::text],
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- shift_signatures -----
CREATE TABLE IF NOT EXISTS "shift_signatures" (
  "id" SERIAL NOT NULL,
  "shift_id" INTEGER NOT NULL,
  "signature_type" TEXT NOT NULL,
  "signature_data" TEXT NOT NULL,
  "signed_by" VARCHAR,
  "signer_name" TEXT NOT NULL,
  "signer_role" TEXT,
  "signed_at" TIMESTAMP NOT NULL DEFAULT now(),
  "ip_address" TEXT,
  PRIMARY KEY ("id")
);

-- ----- shifts -----
CREATE TABLE IF NOT EXISTS "shifts" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "name" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled'::text,
  "supervisor_name" TEXT,
  "employee_count" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- social_accounts -----
CREATE TABLE IF NOT EXISTS "social_accounts" (
  "id" SERIAL NOT NULL,
  "platform" TEXT NOT NULL,
  "account_id" TEXT,
  "account_name" TEXT NOT NULL,
  "account_handle" TEXT,
  "page_id" TEXT,
  "profile_image_url" TEXT,
  "followers_count" INTEGER DEFAULT 0,
  "following_count" INTEGER DEFAULT 0,
  "posts_count" INTEGER DEFAULT 0,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "token_expires_at" TIMESTAMP,
  "branch_id" VARCHAR,
  "is_connected" BOOLEAN NOT NULL DEFAULT false,
  "last_sync_at" TIMESTAMP,
  "connection_error" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "profile_url" TEXT,
  PRIMARY KEY ("id")
);

-- ----- social_content_templates -----
CREATE TABLE IF NOT EXISTS "social_content_templates" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "content_ar" TEXT,
  "default_hashtags" TEXT[],
  "default_media_type" TEXT,
  "placeholder_fields" TEXT[],
  "suitable_platforms" TEXT[],
  "usage_count" INTEGER DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- social_initiatives -----
CREATE TABLE IF NOT EXISTS "social_initiatives" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "initiative_type" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "objectives" TEXT,
  "target_audience" TEXT,
  "start_date" DATE,
  "end_date" DATE,
  "budget" NUMERIC,
  "actual_cost" NUMERIC,
  "beneficiary_organization_id" INTEGER,
  "partners_names" TEXT,
  "channels" TEXT[],
  "status" TEXT DEFAULT 'planned'::text,
  "impact_metrics" TEXT,
  "beneficiaries_count" INTEGER,
  "media_links" TEXT[],
  "attachments" TEXT[],
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- social_post_metrics -----
CREATE TABLE IF NOT EXISTS "social_post_metrics" (
  "id" SERIAL NOT NULL,
  "post_id" INTEGER NOT NULL,
  "platform" TEXT NOT NULL,
  "platform_post_id" TEXT,
  "impressions" INTEGER DEFAULT 0,
  "reach" INTEGER DEFAULT 0,
  "engagements" INTEGER DEFAULT 0,
  "likes" INTEGER DEFAULT 0,
  "comments" INTEGER DEFAULT 0,
  "shares" INTEGER DEFAULT 0,
  "saves" INTEGER DEFAULT 0,
  "clicks" INTEGER DEFAULT 0,
  "video_views" INTEGER DEFAULT 0,
  "engagement_rate" REAL DEFAULT 0,
  "fetched_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- social_posts -----
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" SERIAL NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "content_ar" TEXT,
  "media_urls" TEXT[],
  "media_types" TEXT[],
  "hashtags" TEXT[],
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "platforms" TEXT[] NOT NULL,
  "scheduled_at" TIMESTAMP,
  "published_at" TIMESTAMP,
  "failed_reason" TEXT,
  "campaign_id" INTEGER,
  "calendar_event_id" INTEGER,
  "created_by" VARCHAR,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "post_type" TEXT DEFAULT 'regular'::text,
  "link_url" TEXT,
  "call_to_action" TEXT,
  "target_audience" TEXT,
  "is_promoted" BOOLEAN DEFAULT false,
  "promotion_budget" REAL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "influencer_id" INTEGER,
  PRIMARY KEY ("id")
);

-- ----- social_schedule_slots -----
CREATE TABLE IF NOT EXISTS "social_schedule_slots" (
  "id" SERIAL NOT NULL,
  "platform" TEXT NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "time_slot" TEXT NOT NULL,
  "priority" INTEGER DEFAULT 1,
  "engagement_score" REAL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- system_audit_logs -----
CREATE TABLE IF NOT EXISTS "system_audit_logs" (
  "id" SERIAL NOT NULL,
  "module" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "entity_name" TEXT,
  "action" TEXT NOT NULL,
  "details" TEXT,
  "user_id" VARCHAR,
  "user_name" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- system_notifications -----
CREATE TABLE IF NOT EXISTS "system_notifications" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "message_type" TEXT NOT NULL DEFAULT 'announcement'::text,
  "display_style" TEXT NOT NULL DEFAULT 'modal'::text,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "target_all_branches" BOOLEAN NOT NULL DEFAULT true,
  "target_branch_ids" TEXT[],
  "start_date" TIMESTAMP,
  "end_date" TIMESTAMP,
  "display_time_start" TEXT,
  "display_time_end" TEXT,
  "sound_enabled" BOOLEAN NOT NULL DEFAULT false,
  "sound_type" TEXT DEFAULT 'default'::text,
  "background_color" TEXT DEFAULT '#ffffff'::text,
  "text_color" TEXT DEFAULT '#1a1a1a'::text,
  "accent_color" TEXT DEFAULT '#d4a017'::text,
  "animation_type" TEXT DEFAULT 'fade'::text,
  "effect_type" TEXT,
  "emoji" TEXT,
  "image_url" TEXT,
  "button_text" TEXT,
  "button_action" TEXT,
  "show_once" BOOLEAN NOT NULL DEFAULT false,
  "auto_close_seconds" INTEGER,
  "design_config" JSONB,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- target_daily_allocations -----
CREATE TABLE IF NOT EXISTS "target_daily_allocations" (
  "id" SERIAL NOT NULL,
  "monthly_target_id" INTEGER NOT NULL,
  "target_date" TEXT NOT NULL,
  "weight_percent" REAL NOT NULL,
  "daily_target" REAL NOT NULL,
  "is_holiday" BOOLEAN DEFAULT false,
  "is_manual_override" BOOLEAN DEFAULT false,
  "override_reason" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- target_shift_allocations -----
CREATE TABLE IF NOT EXISTS "target_shift_allocations" (
  "id" SERIAL NOT NULL,
  "daily_allocation_id" INTEGER NOT NULL,
  "shift_type" TEXT NOT NULL,
  "shift_target" REAL NOT NULL,
  "shift_weight_percent" REAL NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- target_weight_profiles -----
CREATE TABLE IF NOT EXISTS "target_weight_profiles" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sunday_weight" REAL NOT NULL DEFAULT 100,
  "monday_weight" REAL NOT NULL DEFAULT 100,
  "tuesday_weight" REAL NOT NULL DEFAULT 100,
  "wednesday_weight" REAL NOT NULL DEFAULT 100,
  "thursday_weight" REAL NOT NULL DEFAULT 130,
  "friday_weight" REAL NOT NULL DEFAULT 130,
  "saturday_weight" REAL NOT NULL DEFAULT 100,
  "seasonal_adjustments" JSONB,
  "holiday_overrides" JSONB,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- time_entries -----
CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" SERIAL NOT NULL,
  "attendance_id" INTEGER,
  "employee_id" VARCHAR NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "entry_type" TEXT NOT NULL,
  "entry_time" TIMESTAMP NOT NULL DEFAULT now(),
  "signature" TEXT,
  "signature_type" TEXT,
  "device_id" TEXT,
  "ip_address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "is_verified" BOOLEAN DEFAULT false,
  "verified_by" VARCHAR,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- timesheet_report_entries -----
CREATE TABLE IF NOT EXISTS "timesheet_report_entries" (
  "id" SERIAL NOT NULL,
  "report_id" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "day_of_week" TEXT NOT NULL,
  "scheduled_start_time" TEXT,
  "scheduled_end_time" TEXT,
  "actual_start_time" TEXT,
  "actual_end_time" TEXT,
  "is_off" BOOLEAN DEFAULT false,
  "status" TEXT DEFAULT 'pending'::text,
  "scheduled_hours" REAL DEFAULT 0,
  "actual_hours" REAL DEFAULT 0,
  "overtime_minutes" INTEGER DEFAULT 0,
  "late_minutes" INTEGER DEFAULT 0,
  "notes" TEXT,
  "check_in_signature" TEXT,
  "check_out_signature" TEXT,
  PRIMARY KEY ("id")
);

-- ----- timesheet_reports -----
CREATE TABLE IF NOT EXISTS "timesheet_reports" (
  "id" SERIAL NOT NULL,
  "employee_id" VARCHAR NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "generated_by" VARCHAR,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "total_scheduled_days" INTEGER DEFAULT 0,
  "total_present_days" INTEGER DEFAULT 0,
  "total_absent_days" INTEGER DEFAULT 0,
  "total_late_days" INTEGER DEFAULT 0,
  "total_scheduled_hours" REAL DEFAULT 0,
  "total_actual_hours" REAL DEFAULT 0,
  "total_overtime_minutes" INTEGER DEFAULT 0,
  "total_late_minutes" INTEGER DEFAULT 0,
  "employee_signature" TEXT,
  "employee_signed_at" TIMESTAMP,
  "employee_acknowledgment" TEXT,
  "manager_signature" TEXT,
  "manager_id" VARCHAR,
  "manager_signed_at" TIMESTAMP,
  "manager_acknowledgment" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "branch_employee_id" INTEGER,
  PRIMARY KEY ("id")
);

-- ----- transfer_approval_steps -----
CREATE TABLE IF NOT EXISTS "transfer_approval_steps" (
  "id" SERIAL NOT NULL,
  "transfer_id" INTEGER NOT NULL,
  "step_order" INTEGER NOT NULL,
  "approver_role" TEXT NOT NULL,
  "approver_id" VARCHAR,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "action_taken_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- transfer_history -----
CREATE TABLE IF NOT EXISTS "transfer_history" (
  "id" SERIAL NOT NULL,
  "transfer_id" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "performed_by" VARCHAR,
  "details" JSONB,
  "event_timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- travel_expenses -----
CREATE TABLE IF NOT EXISTS "travel_expenses" (
  "id" SERIAL NOT NULL,
  "travel_request_id" INTEGER NOT NULL,
  "expense_type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" NUMERIC NOT NULL,
  "currency" TEXT DEFAULT 'SAR'::text,
  "expense_date" TIMESTAMP NOT NULL,
  "receipt_number" TEXT,
  "receipt_url" TEXT,
  "vendor" TEXT,
  "status" TEXT DEFAULT 'pending'::text,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- travel_requests -----
CREATE TABLE IF NOT EXISTS "travel_requests" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR,
  "request_number" TEXT,
  "requester_id" VARCHAR,
  "requester_name" TEXT,
  "requester_department" TEXT,
  "requester_job_title" TEXT,
  "trip_title" TEXT NOT NULL,
  "trip_purpose" TEXT NOT NULL,
  "trip_type" TEXT DEFAULT 'business'::text,
  "departure_city" TEXT NOT NULL,
  "destination_city" TEXT NOT NULL,
  "destination_country" TEXT,
  "departure_date" TIMESTAMP NOT NULL,
  "return_date" TIMESTAMP NOT NULL,
  "trip_duration" INTEGER,
  "needs_flight" BOOLEAN DEFAULT true,
  "needs_hotel" BOOLEAN DEFAULT true,
  "needs_transportation" BOOLEAN DEFAULT false,
  "needs_visa" BOOLEAN DEFAULT false,
  "estimated_flight_cost" NUMERIC,
  "estimated_hotel_cost" NUMERIC,
  "estimated_transport_cost" NUMERIC,
  "estimated_meals_cost" NUMERIC,
  "estimated_other_cost" NUMERIC,
  "total_estimated_cost" NUMERIC,
  "currency" TEXT DEFAULT 'SAR'::text,
  "status" TEXT DEFAULT 'draft'::text,
  "manager_approval" TEXT DEFAULT 'pending'::text,
  "manager_approval_date" TIMESTAMP,
  "manager_approval_by" VARCHAR,
  "manager_approval_notes" TEXT,
  "finance_approval" TEXT DEFAULT 'pending'::text,
  "finance_approval_date" TIMESTAMP,
  "finance_approval_by" VARCHAR,
  "finance_approval_notes" TEXT,
  "actual_flight_cost" NUMERIC,
  "actual_hotel_cost" NUMERIC,
  "actual_transport_cost" NUMERIC,
  "actual_meals_cost" NUMERIC,
  "actual_other_cost" NUMERIC,
  "total_actual_cost" NUMERIC,
  "flight_details" JSONB,
  "hotel_details" JSONB,
  "transport_details" JSONB,
  "attachments" JSONB,
  "notes" TEXT,
  "trip_report" TEXT,
  "trip_report_date" TIMESTAMP,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- user_assignments -----
CREATE TABLE IF NOT EXISTS "user_assignments" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "role_id" INTEGER NOT NULL,
  "branch_id" VARCHAR,
  "department_id" INTEGER,
  "scope_type" VARCHAR(20) NOT NULL DEFAULT 'branch'::character varying,
  "is_primary" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "start_date" TIMESTAMP DEFAULT now(),
  "end_date" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- user_branch_access -----
CREATE TABLE IF NOT EXISTS "user_branch_access" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "access_level" VARCHAR(20) NOT NULL DEFAULT 'full'::character varying,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- user_permission_overrides -----
CREATE TABLE IF NOT EXISTS "user_permission_overrides" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "permission_id" INTEGER NOT NULL,
  "allow" BOOLEAN NOT NULL,
  "branch_id" VARCHAR,
  "department_id" INTEGER,
  "reason" TEXT,
  "granted_by" VARCHAR,
  "expires_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- user_permissions -----
CREATE TABLE IF NOT EXISTS "user_permissions" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "module" TEXT NOT NULL,
  "actions" TEXT[] NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- user_security_settings -----
CREATE TABLE IF NOT EXISTS "user_security_settings" (
  "id" SERIAL NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  "two_factor_secret" TEXT,
  "two_factor_backup_codes" TEXT[],
  "ip_whitelist" TEXT[],
  "ip_restriction_enabled" BOOLEAN NOT NULL DEFAULT false,
  "session_timeout" INTEGER DEFAULT 480,
  "max_concurrent_sessions" INTEGER DEFAULT 3,
  "password_changed_at" TIMESTAMP,
  "password_expiry_days" INTEGER DEFAULT 90,
  "force_password_change" BOOLEAN NOT NULL DEFAULT false,
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP,
  "last_login_at" TIMESTAMP,
  "last_login_ip" TEXT,
  "last_login_device" TEXT,
  "trusted_devices" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- user_sessions -----
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" SERIAL NOT NULL,
  "session_id" VARCHAR(255) NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "device_info" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_activity_at" TIMESTAMP NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- users -----
CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR,
  "first_name" VARCHAR,
  "last_name" VARCHAR,
  "profile_image_url" VARCHAR,
  "role" VARCHAR NOT NULL DEFAULT 'viewer'::character varying,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  "phone" VARCHAR,
  "password" VARCHAR,
  "username" VARCHAR,
  "branch_id" VARCHAR,
  "job_title" VARCHAR,
  "is_active" TEXT DEFAULT 'active'::text,
  PRIMARY KEY ("id")
);

-- ----- visitor_logs -----
CREATE TABLE IF NOT EXISTS "visitor_logs" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR,
  "visitor_id" INTEGER,
  "visit_number" TEXT,
  "visit_date" TIMESTAMP NOT NULL DEFAULT now(),
  "visit_purpose" TEXT NOT NULL,
  "visit_type" TEXT DEFAULT 'business'::text,
  "host_id" VARCHAR,
  "host_name" TEXT,
  "host_department" TEXT,
  "check_in_time" TIMESTAMP,
  "check_out_time" TIMESTAMP,
  "expected_duration" INTEGER,
  "actual_duration" INTEGER,
  "status" TEXT DEFAULT 'checked_in'::text,
  "badge_number" TEXT,
  "badge_issued" BOOLEAN DEFAULT false,
  "badge_returned" BOOLEAN DEFAULT false,
  "vehicle_plate" TEXT,
  "items_carried" TEXT,
  "access_areas" TEXT[],
  "escort_required" BOOLEAN DEFAULT false,
  "escort_name" TEXT,
  "notes" TEXT,
  "visitor_signature" TEXT,
  "host_signature" TEXT,
  "security_notes" TEXT,
  "registered_by" VARCHAR,
  "registered_by_name" TEXT,
  "checked_out_by" VARCHAR,
  "checked_out_by_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- visitors -----
CREATE TABLE IF NOT EXISTS "visitors" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR,
  "full_name" TEXT NOT NULL,
  "national_id" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "company" TEXT,
  "nationality" TEXT,
  "id_type" TEXT DEFAULT 'national_id'::text,
  "photo_url" TEXT,
  "notes" TEXT,
  "is_blacklisted" BOOLEAN DEFAULT false,
  "blacklist_reason" TEXT,
  "visit_count" INTEGER DEFAULT 0,
  "last_visit_at" TIMESTAMP,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- voting_audit_log -----
CREATE TABLE IF NOT EXISTS "voting_audit_log" (
  "id" SERIAL NOT NULL,
  "resolution_id" INTEGER,
  "meeting_id" INTEGER,
  "action" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL,
  "actor_id" VARCHAR,
  "actor_name" TEXT,
  "vote_id" INTEGER,
  "proxy_id" INTEGER,
  "previous_value" TEXT,
  "new_value" TEXT,
  "voting_power" NUMERIC,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "device_fingerprint" TEXT,
  "session_id" TEXT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  "is_valid" BOOLEAN DEFAULT true,
  "validation_notes" TEXT,
  PRIMARY KEY ("id")
);

-- ----- voting_tokens -----
CREATE TABLE IF NOT EXISTS "voting_tokens" (
  "id" SERIAL NOT NULL,
  "resolution_id" INTEGER NOT NULL,
  "shareholder_id" INTEGER NOT NULL,
  "vote_token" TEXT NOT NULL,
  "vote" TEXT,
  "vote_weight" INTEGER DEFAULT 1,
  "comments" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending'::text,
  "voted_at" TIMESTAMP,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMP,
  "reminder_sent_at" TIMESTAMP,
  "reminder_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "signature_data" TEXT,
  PRIMARY KEY ("id")
);

-- ----- warehouse_items -----
CREATE TABLE IF NOT EXISTS "warehouse_items" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "category" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'كجم'::text,
  "sku" TEXT,
  "barcode" TEXT,
  "min_stock_level" INTEGER DEFAULT 0,
  "max_stock_level" INTEGER,
  "reorder_point" INTEGER,
  "current_stock" INTEGER DEFAULT 0,
  "unit_price" TEXT,
  "supplier_id" INTEGER,
  "is_active" BOOLEAN DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- warehouse_movement_logs -----
CREATE TABLE IF NOT EXISTS "warehouse_movement_logs" (
  "id" SERIAL NOT NULL,
  "item_id" INTEGER NOT NULL,
  "branch_id" VARCHAR,
  "movement_type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "balance_before" INTEGER DEFAULT 0,
  "balance_after" INTEGER DEFAULT 0,
  "reference_type" TEXT,
  "reference_id" INTEGER,
  "notes" TEXT,
  "created_by" VARCHAR,
  "created_by_name" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- warehouse_notifications -----
CREATE TABLE IF NOT EXISTS "warehouse_notifications" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "body" TEXT NOT NULL,
  "body_en" TEXT,
  "branch_id" VARCHAR,
  "target_branch_id" VARCHAR,
  "user_id" VARCHAR,
  "entity_type" TEXT,
  "entity_id" INTEGER,
  "priority" TEXT DEFAULT 'normal'::text,
  "is_read" BOOLEAN DEFAULT false,
  "read_at" TIMESTAMP,
  "read_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- waste_items -----
CREATE TABLE IF NOT EXISTS "waste_items" (
  "id" SERIAL NOT NULL,
  "waste_report_id" INTEGER NOT NULL,
  "product_id" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" REAL DEFAULT 0,
  "total_value" REAL DEFAULT 0,
  "waste_reason" TEXT NOT NULL,
  "reason_details" TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- waste_reports -----
CREATE TABLE IF NOT EXISTS "waste_reports" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "report_date" TEXT NOT NULL,
  "shift_id" INTEGER,
  "reported_by" VARCHAR,
  "reporter_name" TEXT,
  "total_items" INTEGER NOT NULL DEFAULT 0,
  "total_value" REAL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft'::text,
  "approved_by" VARCHAR,
  "approved_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "shift_name" TEXT,
  PRIMARY KEY ("id")
);

-- ----- waste_risk_alerts -----
CREATE TABLE IF NOT EXISTS "waste_risk_alerts" (
  "id" SERIAL NOT NULL,
  "rule_id" INTEGER NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "alert_date" DATE NOT NULL,
  "product_name" TEXT,
  "category" TEXT,
  "current_value" REAL NOT NULL,
  "threshold_value" REAL NOT NULL,
  "severity" TEXT DEFAULT 'medium'::text,
  "status" TEXT DEFAULT 'open'::text,
  "acknowledged_by" VARCHAR,
  "acknowledged_at" TIMESTAMP,
  "resolved_by" VARCHAR,
  "resolved_at" TIMESTAMP,
  "resolution_notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- waste_risk_rules -----
CREATE TABLE IF NOT EXISTS "waste_risk_rules" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "branch_id" VARCHAR,
  "category" TEXT,
  "product_name" TEXT,
  "threshold_type" TEXT NOT NULL,
  "threshold_value" REAL NOT NULL,
  "period_days" INTEGER DEFAULT 1,
  "severity" TEXT DEFAULT 'medium'::text,
  "is_active" BOOLEAN DEFAULT true,
  "created_by" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- ----- weekly_schedule_locks -----
CREATE TABLE IF NOT EXISTS "weekly_schedule_locks" (
  "id" SERIAL NOT NULL,
  "branch_id" VARCHAR NOT NULL,
  "week_start_date" TEXT NOT NULL,
  "locked_at" TIMESTAMP NOT NULL DEFAULT now(),
  "locked_by" VARCHAR,
  "locked_by_name" TEXT,
  "shift_profile" TEXT,
  "notes" TEXT,
  PRIMARY KEY ("id")
);


-- =====================================================
-- الفهارس (Indexes)
-- =====================================================

CREATE INDEX idx_journal_entry_branch ON public.accounting_journal_entries USING btree (branch_id);
CREATE INDEX idx_journal_entry_date ON public.accounting_journal_entries USING btree (entry_date);
CREATE INDEX idx_journal_entry_status ON public.accounting_journal_entries USING btree (status);
CREATE INDEX idx_journal_entry_type ON public.accounting_journal_entries USING btree (entry_type);
CREATE INDEX idx_journal_reconciliation ON public.accounting_journal_entries USING btree (reconciliation_status);
CREATE INDEX idx_reconciliation_branch ON public.accounting_reconciliations USING btree (branch_id);
CREATE INDEX idx_reconciliation_date ON public.accounting_reconciliations USING btree (reconciliation_date);
CREATE INDEX idx_reconciliation_status ON public.accounting_reconciliations USING btree (status);
CREATE UNIQUE INDEX advanced_production_orders_order_number_key ON public.advanced_production_orders USING btree (order_number);
CREATE INDEX idx_adv_prod_orders_created ON public.advanced_production_orders USING btree (created_at DESC);
CREATE INDEX idx_adv_prod_orders_source_branch ON public.advanced_production_orders USING btree (source_branch_id);
CREATE INDEX idx_adv_prod_orders_status ON public.advanced_production_orders USING btree (status);
CREATE INDEX idx_adv_prod_orders_target_branch ON public.advanced_production_orders USING btree (target_branch_id);
CREATE UNIQUE INDEX asset_transfers_transfer_number_key ON public.asset_transfers USING btree (transfer_number);
CREATE INDEX idx_attendance_branch ON public.attendance_records USING btree (branch_id);
CREATE INDEX idx_attendance_branch_date ON public.attendance_records USING btree (branch_id, attendance_date);
CREATE INDEX idx_attendance_branch_employee ON public.attendance_records USING btree (branch_employee_id);
CREATE INDEX idx_attendance_date ON public.attendance_records USING btree (attendance_date);
CREATE INDEX idx_attendance_employee ON public.attendance_records USING btree (employee_id);
CREATE INDEX idx_attendance_employee_date ON public.attendance_records USING btree (employee_id, attendance_date);
CREATE INDEX idx_attendance_records_branch ON public.attendance_records USING btree (branch_id);
CREATE INDEX idx_attendance_records_date ON public.attendance_records USING btree (attendance_date);
CREATE INDEX idx_attendance_status ON public.attendance_records USING btree (status);
CREATE INDEX idx_attendance_summary_branch ON public.attendance_summary USING btree (branch_id);
CREATE INDEX idx_attendance_summary_employee ON public.attendance_summary USING btree (employee_id);
CREATE INDEX idx_attendance_summary_month ON public.attendance_summary USING btree (period_month);
CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_beneficiary_org_partnership ON public.beneficiary_organizations USING btree (partnership_type);
CREATE INDEX idx_beneficiary_org_status ON public.beneficiary_organizations USING btree (status);
CREATE INDEX idx_beneficiary_org_type ON public.beneficiary_organizations USING btree (organization_type);
CREATE INDEX idx_biometric_branch ON public.biometric_credentials USING btree (branch_id);
CREATE INDEX idx_biometric_credential ON public.biometric_credentials USING btree (credential_id);
CREATE INDEX idx_biometric_employee ON public.biometric_credentials USING btree (employee_id);
CREATE INDEX idx_board_committees_status ON public.board_committees USING btree (status);
CREATE INDEX idx_board_committees_type ON public.board_committees USING btree (committee_type);
CREATE INDEX idx_board_member_training_member ON public.board_member_training USING btree (board_member_id);
CREATE INDEX idx_board_member_training_status ON public.board_member_training USING btree (status);
CREATE INDEX idx_board_member_training_type ON public.board_member_training USING btree (training_type);
CREATE INDEX idx_board_members_position ON public.board_members USING btree ("position");
CREATE INDEX idx_board_members_status ON public.board_members USING btree (status);
CREATE INDEX idx_board_members_type ON public.board_members USING btree (member_type);
CREATE UNIQUE INDEX board_resolutions_resolution_number_key ON public.board_resolutions USING btree (resolution_number);
CREATE INDEX idx_board_resolutions_category ON public.board_resolutions USING btree (category);
CREATE INDEX idx_board_resolutions_implementation ON public.board_resolutions USING btree (implementation_status);
CREATE INDEX idx_board_resolutions_meeting ON public.board_resolutions USING btree (meeting_id);
CREATE INDEX idx_board_resolutions_status ON public.board_resolutions USING btree (status);
CREATE INDEX idx_board_resolutions_type ON public.board_resolutions USING btree (resolution_type);
CREATE INDEX idx_branch_custom_items_branch ON public.branch_custom_checklist_items USING btree (branch_id);
CREATE INDEX idx_branch_custom_items_template ON public.branch_custom_checklist_items USING btree (template_id);
CREATE INDEX idx_closure_journal_closure ON public.branch_daily_closure_journals USING btree (closure_id);
CREATE INDEX idx_closure_journal_journal ON public.branch_daily_closure_journals USING btree (journal_id);
CREATE UNIQUE INDEX idx_closure_journal_unique ON public.branch_daily_closure_journals USING btree (journal_id);
CREATE INDEX idx_daily_closure_branch_date ON public.branch_daily_closures USING btree (branch_id, closure_date);
CREATE INDEX idx_daily_closure_status ON public.branch_daily_closures USING btree (status);
CREATE INDEX idx_branch_daily_sales_branch_date ON public.branch_daily_sales USING btree (branch_id, sales_date);
CREATE INDEX idx_branch_employees_branch ON public.branch_employees USING btree (branch_id);
CREATE INDEX idx_branch_employees_job ON public.branch_employees USING btree (job_title);
CREATE INDEX idx_branch_employees_linked_user ON public.branch_employees USING btree (linked_user_id);
CREATE INDEX idx_branch_employees_nationality ON public.branch_employees USING btree (nationality);
CREATE INDEX idx_branch_employees_status ON public.branch_employees USING btree (status);
CREATE INDEX idx_branch_shift_profiles_branch ON public.branch_shift_profiles USING btree (branch_id);
CREATE INDEX idx_branch_shift_profiles_code ON public.branch_shift_profiles USING btree (branch_id, shift_code);
CREATE INDEX idx_branch_shifts_branch ON public.branch_shifts USING btree (branch_id);
CREATE INDEX idx_branch_shifts_date ON public.branch_shifts USING btree (shift_date);
CREATE INDEX idx_branch_shifts_status ON public.branch_shifts USING btree (status);
CREATE UNIQUE INDEX branch_stock_unique ON public.branch_stock USING btree (branch_id, item_id);
CREATE INDEX idx_branch_stock_branch ON public.branch_stock USING btree (branch_id);
CREATE INDEX idx_branch_stock_branch_item ON public.branch_stock USING btree (branch_id, item_id);
CREATE INDEX idx_branch_stock_item ON public.branch_stock USING btree (item_id);
CREATE UNIQUE INDEX capital_transactions_transaction_number_key ON public.capital_transactions USING btree (transaction_number);
CREATE INDEX idx_capital_transactions_date ON public.capital_transactions USING btree (effective_date);
CREATE INDEX idx_capital_transactions_status ON public.capital_transactions USING btree (status);
CREATE INDEX idx_capital_transactions_type ON public.capital_transactions USING btree (transaction_type);
CREATE INDEX idx_incentive_stmt_branch ON public.cashier_incentive_statements USING btree (branch_id);
CREATE INDEX idx_incentive_stmt_cashier ON public.cashier_incentive_statements USING btree (cashier_id);
CREATE INDEX idx_incentive_stmt_status ON public.cashier_incentive_statements USING btree (status);
CREATE INDEX idx_points_branch_date ON public.cashier_points_ledger USING btree (branch_id, transaction_date);
CREATE INDEX idx_points_cashier_date ON public.cashier_points_ledger USING btree (cashier_id, transaction_date);
CREATE INDEX idx_points_status ON public.cashier_points_ledger USING btree (status);
CREATE INDEX idx_product_sales_cashier ON public.cashier_product_sales USING btree (cashier_id, sales_date);
CREATE INDEX idx_cashier_journals_branch_date ON public.cashier_sales_journals USING btree (branch_id, journal_date);
CREATE INDEX idx_cashier_journals_created ON public.cashier_sales_journals USING btree (created_at DESC);
CREATE INDEX idx_cashier_journals_status ON public.cashier_sales_journals USING btree (status);
CREATE INDEX idx_cashier_shift_perf_branch ON public.cashier_shift_performance USING btree (branch_id, performance_date);
CREATE INDEX idx_cashier_shift_perf_cashier ON public.cashier_shift_performance USING btree (cashier_id, performance_date);
CREATE UNIQUE INDEX chart_of_accounts_account_code_key ON public.chart_of_accounts USING btree (account_code);
CREATE INDEX idx_checklist_items_template ON public.checklist_items USING btree (template_id);
CREATE INDEX idx_checklist_templates_category ON public.checklist_templates USING btree (category);
CREATE INDEX idx_checklist_templates_type ON public.checklist_templates USING btree (type);
CREATE INDEX idx_committee_memberships_committee ON public.committee_memberships USING btree (committee_id);
CREATE INDEX idx_committee_memberships_member ON public.committee_memberships USING btree (board_member_id);
CREATE INDEX idx_committee_memberships_status ON public.committee_memberships USING btree (status);
CREATE UNIQUE INDEX community_discounts_code_key ON public.community_discounts USING btree (code);
CREATE INDEX idx_community_discount_code ON public.community_discounts USING btree (code);
CREATE INDEX idx_community_discount_org ON public.community_discounts USING btree (beneficiary_organization_id);
CREATE INDEX idx_community_discount_status ON public.community_discounts USING btree (status);
CREATE INDEX idx_community_discount_validity ON public.community_discounts USING btree (valid_from, valid_to);
CREATE INDEX idx_status_history_comparison ON public.comparison_status_history USING btree (comparison_id);
CREATE INDEX idx_status_history_date ON public.comparison_status_history USING btree (created_at);
CREATE INDEX idx_comparison_summaries_branch ON public.comparison_summaries USING btree (branch_id);
CREATE INDEX idx_comparison_summaries_dates ON public.comparison_summaries USING btree (period_start, period_end);
CREATE INDEX idx_comparison_summaries_period ON public.comparison_summaries USING btree (period_type);
CREATE INDEX idx_comparison_uploads_branch ON public.comparison_uploads USING btree (branch_id);
CREATE INDEX idx_comparison_uploads_status ON public.comparison_uploads USING btree (status);
CREATE INDEX idx_comparison_uploads_type ON public.comparison_uploads USING btree (data_type);
CREATE INDEX idx_compliance_history_action ON public.compliance_history USING btree (action);
CREATE INDEX idx_compliance_history_date ON public.compliance_history USING btree (action_date);
CREATE INDEX idx_compliance_history_requirement ON public.compliance_history USING btree (requirement_id);
CREATE UNIQUE INDEX compliance_requirements_requirement_code_key ON public.compliance_requirements USING btree (requirement_code);
CREATE INDEX idx_compliance_requirements_category ON public.compliance_requirements USING btree (category);
CREATE INDEX idx_compliance_requirements_due_date ON public.compliance_requirements USING btree (next_due_date);
CREATE INDEX idx_compliance_requirements_frequency ON public.compliance_requirements USING btree (frequency);
CREATE INDEX idx_compliance_requirements_status ON public.compliance_requirements USING btree (current_status);
CREATE UNIQUE INDEX construction_categories_slug_key ON public.construction_categories USING btree (slug);
CREATE UNIQUE INDEX construction_contracts_contract_number_key ON public.construction_contracts USING btree (contract_number);
CREATE INDEX idx_daily_comparisons_branch ON public.daily_comparisons USING btree (branch_id);
CREATE INDEX idx_daily_comparisons_category ON public.daily_comparisons USING btree (product_category);
CREATE INDEX idx_daily_comparisons_date ON public.daily_comparisons USING btree (comparison_date);
CREATE INDEX idx_daily_comparisons_product ON public.daily_comparisons USING btree (product_name);
CREATE INDEX idx_daily_comparisons_status ON public.daily_comparisons USING btree (status);
CREATE INDEX idx_daily_prod_batches_branch_date ON public.daily_production_batches USING btree (branch_id, production_date);
CREATE INDEX idx_daily_prod_batches_destination ON public.daily_production_batches USING btree (destination);
CREATE INDEX idx_daily_prod_batches_product ON public.daily_production_batches USING btree (product_id);
CREATE INDEX idx_daily_prod_batches_status ON public.daily_production_batches USING btree (status);
CREATE INDEX idx_daily_production_branch_date ON public.daily_production_batches USING btree (branch_id, production_date);
CREATE INDEX idx_daily_production_created ON public.daily_production_batches USING btree (created_at DESC);
CREATE INDEX idx_daily_production_status ON public.daily_production_batches USING btree (status);
CREATE INDEX idx_daily_sales_branch ON public.daily_sales_data USING btree (branch_id);
CREATE INDEX idx_daily_sales_date ON public.daily_sales_data USING btree (sales_date);
CREATE INDEX idx_daily_sales_product ON public.daily_sales_data USING btree (product_name);
CREATE INDEX idx_daily_sales_upload ON public.daily_sales_data USING btree (upload_id);
CREATE INDEX idx_daily_waste_shift ON public.daily_waste_log USING btree (shift_id);
CREATE UNIQUE INDEX departments_code_key ON public.departments USING btree (code);
CREATE UNIQUE INDEX disclosures_disclosure_number_key ON public.disclosures USING btree (disclosure_number);
CREATE INDEX idx_disclosures_category ON public.disclosures USING btree (category);
CREATE INDEX idx_disclosures_due_date ON public.disclosures USING btree (due_date);
CREATE INDEX idx_disclosures_fiscal_year ON public.disclosures USING btree (fiscal_year);
CREATE INDEX idx_disclosures_status ON public.disclosures USING btree (status);
CREATE INDEX idx_disclosures_type ON public.disclosures USING btree (disclosure_type);
CREATE INDEX idx_discount_usage_branch ON public.discount_usage_logs USING btree (branch_id);
CREATE INDEX idx_discount_usage_date ON public.discount_usage_logs USING btree (used_at);
CREATE INDEX idx_discount_usage_discount ON public.discount_usage_logs USING btree (discount_id);
CREATE INDEX idx_display_bar_receipts_branch_date ON public.display_bar_receipts USING btree (branch_id, receipt_date);
CREATE UNIQUE INDEX dividend_distributions_distribution_number_key ON public.dividend_distributions USING btree (distribution_number);
CREATE INDEX idx_dividend_distributions_payment_date ON public.dividend_distributions USING btree (payment_date);
CREATE INDEX idx_dividend_distributions_status ON public.dividend_distributions USING btree (status);
CREATE INDEX idx_dividend_distributions_year ON public.dividend_distributions USING btree (fiscal_year);
CREATE INDEX idx_doc_access_document ON public.document_access_logs USING btree (document_id);
CREATE INDEX idx_doc_shares_document ON public.document_shares USING btree (document_id);
CREATE INDEX idx_doc_shares_link ON public.document_shares USING btree (share_link);
CREATE INDEX idx_doc_versions_document ON public.document_versions USING btree (document_id);
CREATE INDEX idx_documents_branch ON public.documents USING btree (branch_id);
CREATE INDEX idx_documents_category ON public.documents USING btree (category_id);
CREATE INDEX idx_documents_created ON public.documents USING btree (created_at DESC);
CREATE INDEX idx_documents_folder ON public.documents USING btree (folder_id);
CREATE INDEX idx_documents_status ON public.documents USING btree (status);
CREATE INDEX idx_employee_schedules_branch ON public.employee_schedules USING btree (branch_id);
CREATE INDEX idx_employee_schedules_branch_employee ON public.employee_schedules USING btree (branch_employee_id);
CREATE INDEX idx_employee_schedules_date ON public.employee_schedules USING btree (schedule_date);
CREATE INDEX idx_employee_schedules_employee ON public.employee_schedules USING btree (employee_id);
CREATE INDEX idx_employee_schedules_period ON public.employee_schedules USING btree (period_id);
CREATE INDEX idx_employee_settings_active ON public.employee_settings USING btree (is_active);
CREATE INDEX idx_employee_settings_category ON public.employee_settings USING btree (category);
CREATE INDEX idx_transfer_dest ON public.employee_transfer_requests USING btree (destination_branch_id);
CREATE INDEX idx_transfer_employee ON public.employee_transfer_requests USING btree (employee_id);
CREATE INDEX idx_transfer_requested_by ON public.employee_transfer_requests USING btree (requested_by);
CREATE INDEX idx_transfer_source ON public.employee_transfer_requests USING btree (source_branch_id);
CREATE INDEX idx_transfer_status ON public.employee_transfer_requests USING btree (status);
CREATE UNIQUE INDEX exec_correspondence_ref_number_key ON public.exec_correspondence USING btree (ref_number);
CREATE INDEX idx_exec_corr_assigned ON public.exec_correspondence USING btree (assigned_to);
CREATE INDEX idx_exec_corr_branch ON public.exec_correspondence USING btree (branch_id);
CREATE INDEX idx_exec_corr_category ON public.exec_correspondence USING btree (category);
CREATE INDEX idx_exec_corr_owner ON public.exec_correspondence USING btree (owner_id);
CREATE INDEX idx_exec_corr_received ON public.exec_correspondence USING btree (received_at);
CREATE INDEX idx_exec_corr_status ON public.exec_correspondence USING btree (status);
CREATE INDEX idx_exec_corr_type ON public.exec_correspondence USING btree (type);
CREATE INDEX idx_exec_attendees_meeting ON public.exec_meeting_attendees USING btree (meeting_id);
CREATE INDEX idx_exec_attendees_user ON public.exec_meeting_attendees USING btree (user_id);
CREATE INDEX idx_exec_meetings_branch ON public.exec_meetings USING btree (branch_id);
CREATE INDEX idx_exec_meetings_organizer ON public.exec_meetings USING btree (organizer_id);
CREATE INDEX idx_exec_meetings_start ON public.exec_meetings USING btree (start_at);
CREATE INDEX idx_exec_meetings_status ON public.exec_meetings USING btree (status);
CREATE INDEX idx_exec_notif_branch ON public.exec_notifications USING btree (branch_id);
CREATE INDEX idx_exec_notif_entity ON public.exec_notifications USING btree (entity_type, entity_id);
CREATE INDEX idx_exec_notif_read ON public.exec_notifications USING btree (is_read);
CREATE INDEX idx_exec_notif_user ON public.exec_notifications USING btree (user_id);
CREATE INDEX idx_exec_task_comments_task ON public.exec_task_comments USING btree (task_id);
CREATE INDEX idx_exec_tasks_assigned ON public.exec_tasks USING btree (assigned_to);
CREATE INDEX idx_exec_tasks_branch ON public.exec_tasks USING btree (branch_id);
CREATE INDEX idx_exec_tasks_created_by ON public.exec_tasks USING btree (created_by);
CREATE INDEX idx_exec_tasks_due_date ON public.exec_tasks USING btree (due_date);
CREATE INDEX idx_exec_tasks_priority ON public.exec_tasks USING btree (priority);
CREATE INDEX idx_exec_tasks_status ON public.exec_tasks USING btree (status);
CREATE INDEX idx_financial_cogs_period ON public.financial_cogs USING btree (period_id);
CREATE INDEX idx_financial_cogs_type ON public.financial_cogs USING btree (item_type);
CREATE INDEX idx_financial_fixed_period ON public.financial_fixed_costs USING btree (period_id);
CREATE INDEX idx_financial_fixed_type ON public.financial_fixed_costs USING btree (cost_type);
CREATE INDEX idx_financial_metrics_period ON public.financial_metrics USING btree (period_id);
CREATE INDEX idx_financial_metrics_rating ON public.financial_metrics USING btree (rating);
CREATE INDEX idx_financial_opex_period ON public.financial_operating_expenses USING btree (period_id);
CREATE INDEX idx_financial_opex_type ON public.financial_operating_expenses USING btree (expense_type);
CREATE INDEX idx_financial_periods_branch ON public.financial_periods USING btree (branch_id);
CREATE INDEX idx_financial_periods_date ON public.financial_periods USING btree (year, month);
CREATE INDEX idx_financial_sales_channel ON public.financial_sales USING btree (channel);
CREATE INDEX idx_financial_sales_period ON public.financial_sales USING btree (period_id);
CREATE UNIQUE INDEX finished_goods_unique_idx ON public.finished_goods_inventory USING btree (branch_id, product_name_normalized, production_date);
CREATE INDEX idx_finished_goods_branch ON public.finished_goods_inventory USING btree (branch_id);
CREATE INDEX idx_finished_goods_category ON public.finished_goods_inventory USING btree (product_category);
CREATE INDEX idx_finished_goods_date ON public.finished_goods_inventory USING btree (production_date);
CREATE INDEX idx_finished_goods_product ON public.finished_goods_inventory USING btree (product_id);
CREATE INDEX idx_fg_transfers_date ON public.finished_goods_transfers USING btree (transfer_date);
CREATE INDEX idx_fg_transfers_dest ON public.finished_goods_transfers USING btree (destination_branch_id);
CREATE INDEX idx_fg_transfers_source ON public.finished_goods_transfers USING btree (source_branch_id);
CREATE INDEX idx_fg_transfers_status ON public.finished_goods_transfers USING btree (status);
CREATE INDEX idx_fg_transfers_type ON public.finished_goods_transfers USING btree (destination_type);
CREATE INDEX idx_transfers_date ON public.finished_goods_transfers USING btree (transfer_date);
CREATE INDEX idx_transfers_dest_type ON public.finished_goods_transfers USING btree (destination_type);
CREATE INDEX idx_transfers_source ON public.finished_goods_transfers USING btree (source_branch_id);
CREATE UNIQUE INDEX governance_meetings_meeting_number_key ON public.governance_meetings USING btree (meeting_number);
CREATE INDEX idx_governance_meetings_date ON public.governance_meetings USING btree (meeting_date);
CREATE INDEX idx_governance_meetings_fiscal_year ON public.governance_meetings USING btree (fiscal_year);
CREATE INDEX idx_governance_meetings_status ON public.governance_meetings USING btree (status);
CREATE INDEX idx_governance_meetings_type ON public.governance_meetings USING btree (meeting_type);
CREATE INDEX idx_influencer_contracts_branch ON public.influencer_contracts USING btree (branch_id);
CREATE INDEX idx_influencer_contracts_influencer ON public.influencer_contracts USING btree (influencer_id);
CREATE INDEX idx_influencer_contracts_payment ON public.influencer_contracts USING btree (payment_status);
CREATE INDEX idx_influencer_contracts_status ON public.influencer_contracts USING btree (status);
CREATE INDEX idx_interest_declarations_member ON public.interest_declarations USING btree (board_member_id);
CREATE INDEX idx_interest_declarations_status ON public.interest_declarations USING btree (status);
CREATE INDEX idx_interest_declarations_type ON public.interest_declarations USING btree (declaration_type);
CREATE INDEX idx_interest_declarations_year ON public.interest_declarations USING btree (fiscal_year);
CREATE UNIQUE INDEX interest_declarations_declaration_number_key ON public.interest_declarations USING btree (declaration_number);
CREATE INDEX idx_inventory_items_branch ON public.inventory_items USING btree (branch_id);
CREATE INDEX idx_inventory_items_branch_category ON public.inventory_items USING btree (branch_id, category);
CREATE INDEX idx_inventory_items_branch_status ON public.inventory_items USING btree (branch_id, status);
CREATE INDEX idx_inventory_items_created ON public.inventory_items USING btree (created_at DESC);
CREATE INDEX idx_inventory_items_status ON public.inventory_items USING btree (status);
CREATE INDEX idx_material_transfer_items_item ON public.material_transfer_items USING btree (item_id);
CREATE INDEX idx_material_transfer_items_transfer ON public.material_transfer_items USING btree (transfer_id);
CREATE INDEX idx_material_transfers_date ON public.material_transfers USING btree (transfer_date);
CREATE INDEX idx_material_transfers_dest ON public.material_transfers USING btree (destination_branch_id);
CREATE INDEX idx_material_transfers_request ON public.material_transfers USING btree (request_id);
CREATE INDEX idx_material_transfers_source ON public.material_transfers USING btree (source_branch_id);
CREATE INDEX idx_material_transfers_status ON public.material_transfers USING btree (status);
CREATE UNIQUE INDEX material_transfers_transfer_number_key ON public.material_transfers USING btree (transfer_number);
CREATE INDEX idx_meeting_attendance_board_member ON public.meeting_attendance USING btree (board_member_id);
CREATE INDEX idx_meeting_attendance_meeting ON public.meeting_attendance USING btree (meeting_id);
CREATE INDEX idx_meeting_attendance_shareholder ON public.meeting_attendance USING btree (shareholder_id);
CREATE INDEX idx_meeting_attendance_status ON public.meeting_attendance USING btree (attendance_status);
CREATE INDEX idx_meeting_minutes_meeting ON public.meeting_minutes USING btree (meeting_id);
CREATE INDEX idx_meeting_minutes_number ON public.meeting_minutes USING btree (minutes_number);
CREATE INDEX idx_meeting_minutes_status ON public.meeting_minutes USING btree (status);
CREATE UNIQUE INDEX meeting_minutes_minutes_number_key ON public.meeting_minutes USING btree (minutes_number);
CREATE INDEX idx_meeting_rsvps_meeting ON public.meeting_rsvps USING btree (meeting_id);
CREATE INDEX idx_meeting_rsvps_shareholder ON public.meeting_rsvps USING btree (shareholder_id);
CREATE INDEX idx_meeting_rsvps_token ON public.meeting_rsvps USING btree (token);
CREATE UNIQUE INDEX meeting_rsvps_token_key ON public.meeting_rsvps USING btree (token);
CREATE UNIQUE INDEX idx_notif_read_unique ON public.notification_reads USING btree (notification_id, user_id);
CREATE INDEX idx_notif_read_user ON public.notification_reads USING btree (user_id);
CREATE INDEX idx_notification_reads_user ON public.notification_reads USING btree (user_id, notification_id);
CREATE INDEX idx_notifications_branch ON public.notifications USING btree (branch_id);
CREATE INDEX idx_notifications_category ON public.notifications USING btree (category);
CREATE INDEX idx_notifications_read ON public.notifications USING btree (is_read);
CREATE INDEX idx_notifications_scheduled ON public.notifications USING btree (scheduled_for);
CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);
CREATE INDEX idx_org_job_roles_active ON public.org_job_roles USING btree (is_active);
CREATE INDEX idx_org_job_roles_level ON public.org_job_roles USING btree (level);
CREATE INDEX idx_org_job_roles_parent ON public.org_job_roles USING btree (parent_id);
CREATE UNIQUE INDEX org_job_roles_slug_key ON public.org_job_roles USING btree (slug);
CREATE INDEX idx_permissions_module_action ON public.permissions USING btree (module, action);
CREATE INDEX idx_pnl_branch_settings_branch ON public.pnl_branch_settings USING btree (branch_id);
CREATE INDEX idx_pnl_branch_settings_branch_id ON public.pnl_branch_settings USING btree (branch_id);
CREATE INDEX idx_pnl_monthly_inputs_branch ON public.pnl_monthly_inputs USING btree (branch_id);
CREATE INDEX idx_pnl_monthly_inputs_branch_period ON public.pnl_monthly_inputs USING btree (branch_id, year, month);
CREATE INDEX idx_pnl_monthly_inputs_branch_year_month ON public.pnl_monthly_inputs USING btree (branch_id, year, month);
CREATE INDEX idx_pnl_monthly_inputs_period ON public.pnl_monthly_inputs USING btree (year, month);
CREATE INDEX idx_product_prices_branch ON public.product_prices USING btree (branch_id);
CREATE INDEX idx_product_prices_date ON public.product_prices USING btree (effective_date);
CREATE INDEX idx_product_prices_name ON public.product_prices USING btree (product_name);
CREATE INDEX idx_product_storage_category ON public.product_storage_settings USING btree (product_category);
CREATE INDEX idx_product_storage_name ON public.product_storage_settings USING btree (product_name);
CREATE INDEX idx_product_storage_verified ON public.product_storage_settings USING btree (is_verified);
CREATE UNIQUE INDEX product_storage_settings_product_name_key ON public.product_storage_settings USING btree (product_name);
CREATE INDEX idx_inventory_logs_branch ON public.production_inventory_logs USING btree (branch_id);
CREATE INDEX idx_inventory_logs_product ON public.production_inventory_logs USING btree (product_id);
CREATE INDEX idx_inventory_logs_type ON public.production_inventory_logs USING btree (movement_type);
CREATE INDEX idx_prod_inv_logs_branch ON public.production_inventory_logs USING btree (branch_id);
CREATE INDEX idx_prod_inv_logs_product ON public.production_inventory_logs USING btree (product_id);
CREATE INDEX idx_prod_inv_logs_type ON public.production_inventory_logs USING btree (movement_type);
CREATE UNIQUE INDEX production_orders_order_number_key ON public.production_orders USING btree (order_number);
CREATE INDEX idx_products_active ON public.products USING btree (is_active);
CREATE INDEX idx_products_category ON public.products USING btree (category);
CREATE INDEX idx_proxy_votes_holder ON public.proxy_votes USING btree (proxy_holder_shareholder_id);
CREATE INDEX idx_proxy_votes_meeting ON public.proxy_votes USING btree (meeting_id);
CREATE INDEX idx_proxy_votes_principal ON public.proxy_votes USING btree (principal_shareholder_id);
CREATE INDEX idx_proxy_votes_status ON public.proxy_votes USING btree (status);
CREATE UNIQUE INDEX proxy_votes_proxy_number_key ON public.proxy_votes USING btree (proxy_number);
CREATE INDEX idx_purchasing_requests_branch ON public.purchasing_requests USING btree (branch_id);
CREATE INDEX idx_purchasing_requests_status ON public.purchasing_requests USING btree (status);
CREATE UNIQUE INDEX purchasing_requests_request_number_key ON public.purchasing_requests USING btree (request_number);
CREATE INDEX idx_quorum_calculations_meeting ON public.quorum_calculations USING btree (meeting_id);
CREATE INDEX idx_quorum_calculations_resolution ON public.quorum_calculations USING btree (resolution_id);
CREATE INDEX idx_quorum_calculations_type ON public.quorum_calculations USING btree (calculation_type);
CREATE INDEX idx_resolution_signatures_member ON public.resolution_signatures USING btree (board_member_id);
CREATE INDEX idx_resolution_signatures_resolution ON public.resolution_signatures USING btree (resolution_id);
CREATE INDEX idx_resolution_signatures_shareholder ON public.resolution_signatures USING btree (shareholder_id);
CREATE INDEX idx_resolution_signatures_status ON public.resolution_signatures USING btree (status);
CREATE INDEX idx_resolution_signatures_token ON public.resolution_signatures USING btree (signature_token);
CREATE UNIQUE INDEX resolution_signatures_resolution_id_board_member_id_key ON public.resolution_signatures USING btree (resolution_id, board_member_id);
CREATE UNIQUE INDEX resolution_signatures_signature_token_key ON public.resolution_signatures USING btree (signature_token);
CREATE INDEX idx_resolution_votes_board_member ON public.resolution_votes USING btree (board_member_id);
CREATE INDEX idx_resolution_votes_resolution ON public.resolution_votes USING btree (resolution_id);
CREATE INDEX idx_resolution_votes_shareholder ON public.resolution_votes USING btree (shareholder_id);
CREATE INDEX idx_resolution_votes_vote ON public.resolution_votes USING btree (vote);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);
CREATE UNIQUE INDEX role_templates_slug_key ON public.role_templates USING btree (slug);
CREATE UNIQUE INDEX roles_slug_key ON public.roles USING btree (slug);
CREATE INDEX idx_schedule_audit_branch ON public.schedule_change_audit USING btree (branch_id);
CREATE INDEX idx_schedule_audit_date ON public.schedule_change_audit USING btree (created_at);
CREATE INDEX idx_schedule_audit_employee ON public.schedule_change_audit USING btree (employee_id);
CREATE INDEX idx_schedule_audit_week ON public.schedule_change_audit USING btree (week_start_date);
CREATE INDEX idx_schedule_periods_branch ON public.schedule_periods USING btree (branch_id);
CREATE INDEX idx_schedule_periods_dates ON public.schedule_periods USING btree (start_date, end_date);
CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);
CREATE INDEX idx_share_transfers_date ON public.share_transfers USING btree (transfer_date);
CREATE INDEX idx_share_transfers_from ON public.share_transfers USING btree (from_shareholder_id);
CREATE INDEX idx_share_transfers_status ON public.share_transfers USING btree (approval_status);
CREATE INDEX idx_share_transfers_to ON public.share_transfers USING btree (to_shareholder_id);
CREATE UNIQUE INDEX share_transfers_transfer_number_key ON public.share_transfers USING btree (transfer_number);
CREATE INDEX idx_shareholder_dividends_distribution ON public.shareholder_dividends USING btree (distribution_id);
CREATE INDEX idx_shareholder_dividends_shareholder ON public.shareholder_dividends USING btree (shareholder_id);
CREATE INDEX idx_shareholder_dividends_status ON public.shareholder_dividends USING btree (status);
CREATE INDEX idx_shareholder_docs_shareholder ON public.shareholder_documents USING btree (shareholder_id);
CREATE INDEX idx_shareholder_docs_type ON public.shareholder_documents USING btree (document_type);
CREATE INDEX idx_shareholders_percentage ON public.shareholders USING btree (share_percentage);
CREATE INDEX idx_shareholders_status ON public.shareholders USING btree (status);
CREATE INDEX idx_shareholders_type ON public.shareholders USING btree (shareholder_type);
CREATE INDEX idx_shift_audit_action ON public.shift_audit_log USING btree (action);
CREATE INDEX idx_shift_audit_date ON public.shift_audit_log USING btree (created_at);
CREATE INDEX idx_shift_audit_shift ON public.shift_audit_log USING btree (shift_id);
CREATE INDEX idx_shift_checklist_item ON public.shift_checklist_responses USING btree (item_id);
CREATE INDEX idx_shift_checklist_shift ON public.shift_checklist_responses USING btree (shift_id);
CREATE INDEX idx_shift_photos_shift ON public.shift_photos USING btree (shift_id);
CREATE INDEX idx_shift_reminders_branch ON public.shift_reminders USING btree (branch_id);
CREATE INDEX idx_shift_reminders_date ON public.shift_reminders USING btree (shift_date);
CREATE INDEX idx_shift_reminders_sent ON public.shift_reminders USING btree (is_sent);
CREATE INDEX idx_shift_signatures_shift ON public.shift_signatures USING btree (shift_id);
CREATE INDEX idx_shifts_branch ON public.shifts USING btree (branch_id);
CREATE INDEX idx_social_accounts_branch ON public.social_accounts USING btree (branch_id);
CREATE INDEX idx_social_accounts_platform ON public.social_accounts USING btree (platform);
CREATE INDEX idx_content_templates_category ON public.social_content_templates USING btree (category);
CREATE INDEX idx_social_init_beneficiary ON public.social_initiatives USING btree (beneficiary_organization_id);
CREATE INDEX idx_social_init_dates ON public.social_initiatives USING btree (start_date, end_date);
CREATE INDEX idx_social_init_status ON public.social_initiatives USING btree (status);
CREATE INDEX idx_social_init_type ON public.social_initiatives USING btree (initiative_type);
CREATE INDEX idx_social_metrics_platform ON public.social_post_metrics USING btree (platform);
CREATE INDEX idx_social_metrics_post ON public.social_post_metrics USING btree (post_id);
CREATE INDEX idx_social_posts_campaign ON public.social_posts USING btree (campaign_id);
CREATE INDEX idx_social_posts_scheduled ON public.social_posts USING btree (scheduled_at);
CREATE INDEX idx_social_posts_status ON public.social_posts USING btree (status);
CREATE INDEX idx_schedule_slots_day ON public.social_schedule_slots USING btree (day_of_week);
CREATE INDEX idx_schedule_slots_platform ON public.social_schedule_slots USING btree (platform);
CREATE INDEX idx_sys_notif_active ON public.system_notifications USING btree (is_active);
CREATE INDEX idx_sys_notif_dates ON public.system_notifications USING btree (start_date, end_date);
CREATE INDEX idx_sys_notif_priority ON public.system_notifications USING btree (priority);
CREATE INDEX idx_time_entries_attendance ON public.time_entries USING btree (attendance_id);
CREATE INDEX idx_time_entries_branch ON public.time_entries USING btree (branch_id);
CREATE INDEX idx_time_entries_employee ON public.time_entries USING btree (employee_id);
CREATE INDEX idx_timesheet_entries_date ON public.timesheet_report_entries USING btree (date);
CREATE INDEX idx_timesheet_entries_report ON public.timesheet_report_entries USING btree (report_id);
CREATE INDEX idx_timesheet_reports_branch ON public.timesheet_reports USING btree (branch_id);
CREATE INDEX idx_timesheet_reports_branch_employee ON public.timesheet_reports USING btree (branch_employee_id);
CREATE INDEX idx_timesheet_reports_dates ON public.timesheet_reports USING btree (start_date, end_date);
CREATE INDEX idx_timesheet_reports_employee ON public.timesheet_reports USING btree (employee_id);
CREATE INDEX idx_timesheet_reports_status ON public.timesheet_reports USING btree (status);
CREATE INDEX idx_approval_approver ON public.transfer_approval_steps USING btree (approver_id);
CREATE INDEX idx_approval_status ON public.transfer_approval_steps USING btree (status);
CREATE INDEX idx_approval_transfer ON public.transfer_approval_steps USING btree (transfer_id);
CREATE INDEX idx_history_event ON public.transfer_history USING btree (event_type);
CREATE INDEX idx_history_transfer ON public.transfer_history USING btree (transfer_id);
CREATE INDEX idx_travel_expenses_request ON public.travel_expenses USING btree (travel_request_id);
CREATE INDEX idx_travel_expenses_status ON public.travel_expenses USING btree (status);
CREATE INDEX idx_travel_expenses_type ON public.travel_expenses USING btree (expense_type);
CREATE INDEX idx_travel_requests_branch ON public.travel_requests USING btree (branch_id);
CREATE INDEX idx_travel_requests_dates ON public.travel_requests USING btree (departure_date, return_date);
CREATE INDEX idx_travel_requests_number ON public.travel_requests USING btree (request_number);
CREATE INDEX idx_travel_requests_requester ON public.travel_requests USING btree (requester_id);
CREATE INDEX idx_travel_requests_status ON public.travel_requests USING btree (status);
CREATE INDEX idx_user_assignments_branch_id ON public.user_assignments USING btree (branch_id);
CREATE INDEX idx_user_assignments_role_id ON public.user_assignments USING btree (role_id);
CREATE INDEX idx_user_assignments_user_id ON public.user_assignments USING btree (user_id);
CREATE INDEX idx_user_branch_access_user_id ON public.user_branch_access USING btree (user_id);
CREATE UNIQUE INDEX user_security_settings_user_id_key ON public.user_security_settings USING btree (user_id);
CREATE UNIQUE INDEX user_sessions_session_id_key ON public.user_sessions USING btree (session_id);
CREATE INDEX idx_users_branch ON public.users USING btree (branch_id);
CREATE INDEX idx_users_username ON public.users USING btree (username);
CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);
CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone);
CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);
CREATE INDEX idx_visitor_logs_branch ON public.visitor_logs USING btree (branch_id);
CREATE INDEX idx_visitor_logs_date ON public.visitor_logs USING btree (visit_date);
CREATE INDEX idx_visitor_logs_host ON public.visitor_logs USING btree (host_id);
CREATE INDEX idx_visitor_logs_number ON public.visitor_logs USING btree (visit_number);
CREATE INDEX idx_visitor_logs_status ON public.visitor_logs USING btree (status);
CREATE INDEX idx_visitor_logs_visitor ON public.visitor_logs USING btree (visitor_id);
CREATE INDEX idx_visitors_branch ON public.visitors USING btree (branch_id);
CREATE INDEX idx_visitors_company ON public.visitors USING btree (company);
CREATE INDEX idx_visitors_national_id ON public.visitors USING btree (national_id);
CREATE INDEX idx_visitors_phone ON public.visitors USING btree (phone);
CREATE INDEX idx_voting_audit_action ON public.voting_audit_log USING btree (action);
CREATE INDEX idx_voting_audit_actor ON public.voting_audit_log USING btree (actor_id);
CREATE INDEX idx_voting_audit_meeting ON public.voting_audit_log USING btree (meeting_id);
CREATE INDEX idx_voting_audit_resolution ON public.voting_audit_log USING btree (resolution_id);
CREATE INDEX idx_voting_audit_timestamp ON public.voting_audit_log USING btree ("timestamp");
CREATE INDEX idx_voting_tokens_resolution ON public.voting_tokens USING btree (resolution_id);
CREATE INDEX idx_voting_tokens_shareholder ON public.voting_tokens USING btree (shareholder_id);
CREATE INDEX idx_voting_tokens_status ON public.voting_tokens USING btree (status);
CREATE INDEX idx_voting_tokens_token ON public.voting_tokens USING btree (vote_token);
CREATE UNIQUE INDEX voting_tokens_resolution_id_shareholder_id_key ON public.voting_tokens USING btree (resolution_id, shareholder_id);
CREATE UNIQUE INDEX voting_tokens_vote_token_key ON public.voting_tokens USING btree (vote_token);
CREATE INDEX idx_warehouse_items_active ON public.warehouse_items USING btree (is_active);
CREATE INDEX idx_warehouse_items_category ON public.warehouse_items USING btree (category);
CREATE INDEX idx_warehouse_items_sku ON public.warehouse_items USING btree (sku);
CREATE INDEX idx_warehouse_logs_branch ON public.warehouse_movement_logs USING btree (branch_id);
CREATE INDEX idx_warehouse_logs_date ON public.warehouse_movement_logs USING btree (created_at);
CREATE INDEX idx_warehouse_logs_item ON public.warehouse_movement_logs USING btree (item_id);
CREATE INDEX idx_warehouse_logs_type ON public.warehouse_movement_logs USING btree (movement_type);
CREATE INDEX idx_warehouse_notif_branch ON public.warehouse_notifications USING btree (branch_id);
CREATE INDEX idx_warehouse_notif_date ON public.warehouse_notifications USING btree (created_at);
CREATE INDEX idx_warehouse_notif_entity ON public.warehouse_notifications USING btree (entity_type, entity_id);
CREATE INDEX idx_warehouse_notif_read ON public.warehouse_notifications USING btree (is_read);
CREATE INDEX idx_warehouse_notif_user ON public.warehouse_notifications USING btree (user_id);
CREATE INDEX idx_waste_items_report ON public.waste_items USING btree (waste_report_id);
CREATE INDEX idx_waste_reports_branch_date ON public.waste_reports USING btree (branch_id, report_date);
CREATE INDEX idx_waste_alerts_branch ON public.waste_risk_alerts USING btree (branch_id);
CREATE INDEX idx_waste_alerts_date ON public.waste_risk_alerts USING btree (alert_date);
CREATE INDEX idx_waste_alerts_rule ON public.waste_risk_alerts USING btree (rule_id);
CREATE INDEX idx_waste_alerts_severity ON public.waste_risk_alerts USING btree (severity);
CREATE INDEX idx_waste_alerts_status ON public.waste_risk_alerts USING btree (status);
CREATE INDEX idx_waste_rules_active ON public.waste_risk_rules USING btree (is_active);
CREATE INDEX idx_waste_rules_branch ON public.waste_risk_rules USING btree (branch_id);
CREATE INDEX idx_waste_rules_category ON public.waste_risk_rules USING btree (category);
CREATE INDEX idx_weekly_locks_branch ON public.weekly_schedule_locks USING btree (branch_id);
CREATE UNIQUE INDEX idx_weekly_locks_unique ON public.weekly_schedule_locks USING btree (branch_id, week_start_date);
CREATE INDEX idx_weekly_locks_week ON public.weekly_schedule_locks USING btree (week_start_date);


-- =====================================================
-- تحديثات إضافية (Startup Migrations)
-- =====================================================

ALTER TABLE backups ADD COLUMN IF NOT EXISTS table_count INTEGER;
ALTER TABLE backups ADD COLUMN IF NOT EXISTS row_count INTEGER;
ALTER TABLE backups ADD COLUMN IF NOT EXISTS backup_data TEXT;
ALTER TABLE backups ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE backups ADD COLUMN IF NOT EXISTS restored_at TIMESTAMP;
ALTER TABLE backups ADD COLUMN IF NOT EXISTS restored_by VARCHAR;
ALTER TABLE advanced_production_orders ADD COLUMN IF NOT EXISTS mto_items JSONB;
