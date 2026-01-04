CREATE TABLE "accounting_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"export_type" text NOT NULL,
	"date_from" text,
	"date_to" text,
	"branch_id" varchar,
	"data" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"synced_at" timestamp,
	"exported_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advanced_production_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"order_type" text DEFAULT 'daily' NOT NULL,
	"source_branch_id" varchar NOT NULL,
	"target_branch_id" varchar NOT NULL,
	"target_department" text,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"target_sales_value" real,
	"estimated_cost" real DEFAULT 0,
	"actual_cost" real DEFAULT 0,
	"total_items" integer DEFAULT 0,
	"completed_items" integer DEFAULT 0,
	"completion_percent" real DEFAULT 0,
	"is_ai_generated" boolean DEFAULT false,
	"ai_plan_id" integer,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "advanced_production_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "asset_transfer_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" varchar,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_number" text NOT NULL,
	"item_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"from_branch_id" varchar NOT NULL,
	"to_branch_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"notes" text,
	"requested_by" varchar,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"received_by" varchar,
	"received_at" timestamp,
	"receiver_name" text,
	"receiver_signature" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_transfers_transfer_number_unique" UNIQUE("transfer_number")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" varchar NOT NULL,
	"action" text NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"changed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "average_ticket_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar,
	"cashier_id" varchar,
	"shift_type" text,
	"target_type" text NOT NULL,
	"target_value" real NOT NULL,
	"min_acceptable" real,
	"bonus_threshold" real,
	"bonus_per_riyal" real,
	"valid_from" text NOT NULL,
	"valid_to" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"file_size" integer,
	"file_path" text,
	"tables" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "branch_daily_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"sales_date" text NOT NULL,
	"total_sales" real DEFAULT 0 NOT NULL,
	"transactions_count" integer DEFAULT 0,
	"average_ticket" real DEFAULT 0,
	"cashier_count" integer DEFAULT 0,
	"target_amount" real DEFAULT 0,
	"achievement_amount" real DEFAULT 0,
	"achievement_percent" real DEFAULT 0,
	"morning_shift_sales" real DEFAULT 0,
	"evening_shift_sales" real DEFAULT 0,
	"night_shift_sales" real DEFAULT 0,
	"journal_ids" jsonb,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_monthly_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"year_month" text NOT NULL,
	"target_amount" real NOT NULL,
	"profile_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_budget_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"branch_id" varchar NOT NULL,
	"allocated_budget" real NOT NULL,
	"spent_amount" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"influencer_id" integer,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"expense_date" text NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"invoice_number" text,
	"vendor" text,
	"attachment_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"goal_type" text NOT NULL,
	"target_value" real NOT NULL,
	"current_value" real DEFAULT 0 NOT NULL,
	"unit" text,
	"description" text,
	"deadline" text,
	"is_achieved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashier_payment_breakdowns" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_id" integer NOT NULL,
	"payment_method" text NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"transaction_count" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashier_sales_journals" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"shift_id" integer,
	"cashier_id" varchar NOT NULL,
	"cashier_name" text NOT NULL,
	"journal_date" text NOT NULL,
	"shift_type" text,
	"shift_start_time" text,
	"shift_end_time" text,
	"opening_balance" real DEFAULT 0 NOT NULL,
	"total_sales" real DEFAULT 0 NOT NULL,
	"cash_total" real DEFAULT 0 NOT NULL,
	"network_total" real DEFAULT 0 NOT NULL,
	"delivery_total" real DEFAULT 0 NOT NULL,
	"expected_cash" real DEFAULT 0 NOT NULL,
	"actual_cash_drawer" real DEFAULT 0 NOT NULL,
	"discrepancy_amount" real DEFAULT 0 NOT NULL,
	"discrepancy_status" text DEFAULT 'balanced' NOT NULL,
	"customer_count" integer DEFAULT 0,
	"transaction_count" integer DEFAULT 0,
	"average_ticket" real DEFAULT 0,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashier_shift_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_id" integer,
	"cashier_id" varchar NOT NULL,
	"cashier_name" text NOT NULL,
	"shift_id" integer,
	"shift_type" text NOT NULL,
	"branch_id" varchar NOT NULL,
	"performance_date" text NOT NULL,
	"sales_amount" real DEFAULT 0 NOT NULL,
	"transactions_count" integer DEFAULT 0,
	"average_ticket" real DEFAULT 0,
	"customer_count" integer DEFAULT 0,
	"target_share" real DEFAULT 0,
	"achievement_percent" real DEFAULT 0,
	"discrepancy_amount" real DEFAULT 0,
	"discrepancy_status" text DEFAULT 'balanced',
	"branch_rank" integer,
	"shift_rank" integer,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashier_shift_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_allocation_id" integer,
	"branch_id" varchar NOT NULL,
	"cashier_id" varchar NOT NULL,
	"target_date" text NOT NULL,
	"shift_type" text NOT NULL,
	"cashier_role" text DEFAULT 'main' NOT NULL,
	"target_amount" real NOT NULL,
	"target_ticket_value" real,
	"target_transactions" integer,
	"shift_start_time" text,
	"shift_end_time" text,
	"shift_duration_hours" real,
	"alert_threshold_percent" real DEFAULT 80,
	"below_track_threshold" real DEFAULT 70,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashier_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_id" integer NOT NULL,
	"signature_type" text NOT NULL,
	"signer_name" text NOT NULL,
	"signer_id" varchar,
	"signature_data" text NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "commission_calculations" (
	"id" serial PRIMARY KEY NOT NULL,
	"cashier_id" varchar,
	"branch_id" varchar,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"total_sales" real NOT NULL,
	"target_amount" real,
	"achievement_percent" real,
	"rate_id" integer,
	"calculated_commission" real NOT NULL,
	"adjusted_commission" real,
	"final_commission" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"journal_ids" jsonb,
	"notes" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_sales_amount" real DEFAULT 0,
	"max_sales_amount" real,
	"commission_type" text NOT NULL,
	"fixed_amount" real,
	"percentage_rate" real,
	"applicable_to" text DEFAULT 'cashier' NOT NULL,
	"applicable_branches" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" text,
	"valid_to" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "construction_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "construction_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "construction_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"contractor_id" integer NOT NULL,
	"contract_number" text,
	"title" text NOT NULL,
	"description" text,
	"contract_type" text DEFAULT 'fixed_price' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"paid_amount" real DEFAULT 0,
	"start_date" text,
	"end_date" text,
	"payment_terms" text,
	"warranty_period" text,
	"notes" text,
	"attachment_url" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "construction_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "construction_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"budget" real,
	"actual_cost" real,
	"start_date" text,
	"target_completion_date" text,
	"actual_completion_date" text,
	"progress_percent" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"category_id" integer,
	"description" text NOT NULL,
	"unit" text DEFAULT 'قطعة',
	"quantity" real DEFAULT 1 NOT NULL,
	"unit_price" real DEFAULT 0 NOT NULL,
	"total_price" real DEFAULT 0 NOT NULL,
	"completed_quantity" real DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"payment_request_id" integer,
	"amount" real NOT NULL,
	"payment_date" text NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"specialization" text,
	"notes" text,
	"rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_operations_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"date" text NOT NULL,
	"total_orders" integer DEFAULT 0,
	"completed_orders" integer DEFAULT 0,
	"total_produced" integer DEFAULT 0,
	"total_wasted" integer DEFAULT 0,
	"waste_percentage" real DEFAULT 0,
	"quality_score" real,
	"shifts_count" integer DEFAULT 0,
	"employees_present" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_production_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"product_category" text,
	"quantity" integer NOT NULL,
	"unit" text DEFAULT 'قطعة',
	"destination" text NOT NULL,
	"shift_id" integer,
	"production_order_id" integer,
	"produced_at" timestamp DEFAULT now() NOT NULL,
	"recorded_by" varchar,
	"recorder_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_system" text NOT NULL,
	"target_module" text NOT NULL,
	"file_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_records" integer DEFAULT 0,
	"processed_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"error_log" text,
	"imported_by" varchar,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "display_bar_daily_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"product_id" integer NOT NULL,
	"summary_date" text NOT NULL,
	"opening_quantity" integer DEFAULT 0 NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL,
	"sold_quantity" integer DEFAULT 0 NOT NULL,
	"wasted_quantity" integer DEFAULT 0 NOT NULL,
	"closing_quantity" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "display_bar_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"product_id" integer NOT NULL,
	"receipt_date" text NOT NULL,
	"receipt_time" text NOT NULL,
	"shift_id" integer,
	"quantity" integer NOT NULL,
	"received_by" varchar,
	"production_batch" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"is_active" text DEFAULT 'true',
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"award_type" text NOT NULL,
	"branch_id" varchar,
	"cashier_id" varchar,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"target_amount" real NOT NULL,
	"achieved_amount" real NOT NULL,
	"achievement_percent" real NOT NULL,
	"tier_id" integer,
	"calculated_reward" real NOT NULL,
	"adjusted_reward" real,
	"final_reward" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"journal_ids" jsonb,
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_achievement_percent" real NOT NULL,
	"max_achievement_percent" real,
	"reward_type" text NOT NULL,
	"fixed_amount" real,
	"percentage_rate" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"applicable_to" text DEFAULT 'all' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencer_campaign_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"influencer_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"contract_amount" real,
	"deliverables" jsonb,
	"deliverables_done" jsonb,
	"start_date" text,
	"end_date" text,
	"performance_score" real,
	"sales_impact" real,
	"engagement_generated" integer,
	"impressions_generated" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencer_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"influencer_id" integer NOT NULL,
	"contact_type" text NOT NULL,
	"contact_date" text NOT NULL,
	"contact_time" text,
	"subject" text,
	"notes" text,
	"outcome" text,
	"next_follow_up" text,
	"contacted_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencer_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"influencer_id" integer NOT NULL,
	"campaign_id" integer,
	"payment_type" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"payment_date" text NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"description" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"invoice_number" text,
	"attachment_url" text,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit" text NOT NULL,
	"category" text NOT NULL,
	"price" real,
	"status" text,
	"last_check" text,
	"notes" text,
	"serial_number" text,
	"image_url" text,
	"next_inspection_date" text,
	"inspection_interval_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_title" text NOT NULL,
	"module" text NOT NULL,
	"actions" text[] NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_id" integer NOT NULL,
	"attachment_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"notes" text,
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"campaign_id" integer,
	"task_id" integer,
	"target_user_id" varchar,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"asset_type" text NOT NULL,
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"campaign_id" integer,
	"category" text,
	"tags" text[],
	"file_size" integer,
	"dimensions" text,
	"duration" integer,
	"usage_count" integer DEFAULT 0,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_type" text NOT NULL,
	"campaign_id" integer,
	"start_date" text NOT NULL,
	"end_date" text,
	"start_time" text,
	"end_time" text,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"color" text,
	"assigned_to" varchar,
	"reminder_minutes" integer,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_pattern" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"description" text,
	"objective" text NOT NULL,
	"season" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_budget" real DEFAULT 0 NOT NULL,
	"spent_budget" real DEFAULT 0 NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"target_audience" text,
	"channels" text[],
	"kpis" jsonb,
	"owner_id" varchar,
	"created_by" varchar,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_influencers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"email" text,
	"phone" text,
	"profile_image_url" text,
	"specialty" text NOT NULL,
	"platforms" text[],
	"content_types" text[],
	"follower_count" integer DEFAULT 0,
	"engagement_rate" real,
	"avg_views" integer DEFAULT 0,
	"price_per_post" real,
	"price_per_story" real,
	"price_per_video" real,
	"city" text,
	"region" text,
	"social_handles" jsonb,
	"best_collaboration_times" text,
	"notes" text,
	"rating" real,
	"total_collaborations" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"ai_insights" jsonb,
	"last_contact_date" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_performance_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"campaign_id" integer,
	"branch_id" varchar,
	"total_spend" real DEFAULT 0,
	"total_reach" integer DEFAULT 0,
	"total_impressions" integer DEFAULT 0,
	"total_engagement" integer DEFAULT 0,
	"engagement_rate" real DEFAULT 0,
	"estimated_sales_impact" real DEFAULT 0,
	"actual_sales_impact" real DEFAULT 0,
	"roi" real DEFAULT 0,
	"cost_per_engagement" real DEFAULT 0,
	"cost_per_impression" real DEFAULT 0,
	"previous_period_sales" real,
	"sales_growth" real,
	"top_performing_content" jsonb,
	"top_influencers" jsonb,
	"recommendations" jsonb,
	"generated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_task_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"description" text,
	"old_value" text,
	"new_value" text,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"campaign_id" integer,
	"assigned_to" varchar,
	"assigned_by" varchar,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" text,
	"completed_at" timestamp,
	"estimated_hours" real,
	"actual_hours" real,
	"category" text,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text NOT NULL,
	"specialization" text,
	"is_team_lead" boolean DEFAULT false NOT NULL,
	"assigned_branches" text[],
	"weekly_hours_capacity" real DEFAULT 40,
	"current_workload" real DEFAULT 0,
	"join_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_name" text,
	"channel" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"related_module" text,
	"related_entity_id" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_type" text NOT NULL,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"contract_id" integer,
	"request_number" text,
	"request_type" text NOT NULL,
	"amount" real NOT NULL,
	"description" text NOT NULL,
	"beneficiary_name" text,
	"beneficiary_bank" text,
	"beneficiary_iban" text,
	"category_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal',
	"request_date" text,
	"due_date" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"rejection_reason" text,
	"attachment_url" text,
	"invoice_number" text,
	"notes" text,
	"requested_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"branch_id" varchar NOT NULL,
	"cashier_id" varchar,
	"shift_type" text,
	"alert_date" text NOT NULL,
	"alert_time" text NOT NULL,
	"target_amount" real,
	"current_amount" real,
	"achievement_percent" real,
	"message" text NOT NULL,
	"message_ar" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_user_id" varchar NOT NULL,
	"changed_by_user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"module" text,
	"old_actions" text[],
	"new_actions" text[],
	"template_applied" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"module" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sales_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"product_category" text,
	"total_quantity_sold" integer DEFAULT 0,
	"total_revenue" real DEFAULT 0,
	"average_daily_sales" real DEFAULT 0,
	"sales_velocity" real DEFAULT 0,
	"profit_margin" real DEFAULT 0,
	"peak_hours" text,
	"weekday_pattern" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_ai_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"plan_name" text NOT NULL,
	"target_sales_value" real NOT NULL,
	"plan_date" text NOT NULL,
	"dataset_id" integer,
	"algorithm_version" text DEFAULT 'v1.0',
	"confidence_score" real DEFAULT 0,
	"recommended_products" jsonb,
	"total_estimated_value" real DEFAULT 0,
	"total_estimated_cost" real DEFAULT 0,
	"profit_margin" real DEFAULT 0,
	"status" text DEFAULT 'generated' NOT NULL,
	"applied_to_order_id" integer,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"product_category" text,
	"target_quantity" integer NOT NULL,
	"produced_quantity" integer DEFAULT 0,
	"wasted_quantity" integer DEFAULT 0,
	"unit_price" real DEFAULT 0,
	"total_value" real DEFAULT 0,
	"scheduled_date" text,
	"scheduled_shift" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" text,
	"priority" integer DEFAULT 0,
	"sales_velocity" real,
	"notes" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_order_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"scheduled_date" text NOT NULL,
	"day_of_week" text,
	"shift" text,
	"target_quantity" integer DEFAULT 0,
	"completed_quantity" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_department" text,
	"assigned_employees" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text,
	"branch_id" varchar NOT NULL,
	"shift_id" integer,
	"product_id" integer NOT NULL,
	"target_quantity" integer NOT NULL,
	"produced_quantity" integer DEFAULT 0,
	"wasted_quantity" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal',
	"scheduled_date" text,
	"scheduled_time" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"assigned_to" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text NOT NULL,
	"unit" text DEFAULT 'قطعة',
	"base_price" double precision,
	"price_excl_vat" double precision,
	"vat_amount" double precision,
	"vat_rate" double precision DEFAULT 0.15,
	"is_active" text DEFAULT 'true',
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_budget_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"category_id" integer,
	"planned_amount" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_work_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"category_id" integer,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"cost_estimate" real,
	"actual_cost" real,
	"contractor_id" integer,
	"scheduled_start" text,
	"scheduled_end" text,
	"completed_at" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"shift_id" integer,
	"production_order_id" integer,
	"check_type" text NOT NULL,
	"check_date" text NOT NULL,
	"check_time" text,
	"result" text NOT NULL,
	"score" integer,
	"temperature" real,
	"checked_by" text NOT NULL,
	"details" text,
	"issues" text,
	"corrective_action" text,
	"attachment_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"scope" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(50) NOT NULL,
	"hierarchy_level" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_system_default" boolean DEFAULT false NOT NULL,
	"inherits_from_role_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sales_data_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text DEFAULT 'excel',
	"file_size" integer,
	"period_start" text,
	"period_end" text,
	"total_records" integer DEFAULT 0,
	"total_sales_value" real DEFAULT 0,
	"unique_products" integer DEFAULT 0,
	"parsed_data" jsonb,
	"product_velocity" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_filters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"filter_config" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"color" text DEFAULT '#f59e0b',
	"icon" text,
	"weight_multiplier" real DEFAULT 1 NOT NULL,
	"applicable_branches" jsonb,
	"description" text,
	"is_recurring" boolean DEFAULT false,
	"recurring_pattern" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"employee_name" text NOT NULL,
	"role" text,
	"check_in_time" text,
	"check_out_time" text,
	"status" text DEFAULT 'expected' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_performance_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"tracking_date" text NOT NULL,
	"shift_type" text NOT NULL,
	"shift_start_time" text NOT NULL,
	"shift_end_time" text,
	"shift_target_amount" real NOT NULL,
	"expected_at_current_time" real DEFAULT 0,
	"current_sales_amount" real DEFAULT 0 NOT NULL,
	"current_transactions" integer DEFAULT 0,
	"current_average_ticket" real DEFAULT 0,
	"current_cashier_count" integer DEFAULT 0,
	"achievement_percent" real DEFAULT 0,
	"progress_status" text DEFAULT 'on_track',
	"estimated_end_amount" real DEFAULT 0,
	"top_cashier_id" varchar,
	"top_cashier_sales" real DEFAULT 0,
	"lowest_cashier_id" varchar,
	"lowest_cashier_sales" real DEFAULT 0,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"supervisor_name" text,
	"employee_count" integer DEFAULT 0,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text,
	"action" text NOT NULL,
	"details" text,
	"user_id" varchar,
	"user_name" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_daily_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"monthly_target_id" integer NOT NULL,
	"target_date" text NOT NULL,
	"weight_percent" real NOT NULL,
	"daily_target" real NOT NULL,
	"is_holiday" boolean DEFAULT false,
	"is_manual_override" boolean DEFAULT false,
	"override_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_shift_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"daily_allocation_id" integer NOT NULL,
	"shift_type" text NOT NULL,
	"shift_target" real NOT NULL,
	"shift_weight_percent" real NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_weight_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"sunday_weight" real DEFAULT 100 NOT NULL,
	"monday_weight" real DEFAULT 100 NOT NULL,
	"tuesday_weight" real DEFAULT 100 NOT NULL,
	"wednesday_weight" real DEFAULT 100 NOT NULL,
	"thursday_weight" real DEFAULT 130 NOT NULL,
	"friday_weight" real DEFAULT 130 NOT NULL,
	"saturday_weight" real DEFAULT 100 NOT NULL,
	"seasonal_adjustments" jsonb,
	"holiday_overrides" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" integer NOT NULL,
	"branch_id" varchar,
	"department_id" integer,
	"scope_type" varchar(20) DEFAULT 'branch' NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_branch_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"branch_id" varchar NOT NULL,
	"access_level" varchar(20) DEFAULT 'full' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permission_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"permission_id" integer NOT NULL,
	"allow" boolean NOT NULL,
	"branch_id" varchar,
	"department_id" integer,
	"reason" text,
	"granted_by" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"module" text NOT NULL,
	"actions" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar,
	"password" varchar,
	"phone" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'viewer' NOT NULL,
	"branch_id" varchar,
	"job_title" varchar,
	"is_active" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "waste_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"waste_report_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" real DEFAULT 0,
	"total_value" real DEFAULT 0,
	"waste_reason" text NOT NULL,
	"reason_details" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" varchar NOT NULL,
	"report_date" text NOT NULL,
	"shift_id" integer,
	"shift_name" text,
	"reported_by" varchar,
	"reporter_name" text,
	"total_items" integer DEFAULT 0 NOT NULL,
	"total_value" real DEFAULT 0,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting_exports" ADD CONSTRAINT "accounting_exports_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_exports" ADD CONSTRAINT "accounting_exports_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_production_orders" ADD CONSTRAINT "advanced_production_orders_source_branch_id_branches_id_fk" FOREIGN KEY ("source_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_production_orders" ADD CONSTRAINT "advanced_production_orders_target_branch_id_branches_id_fk" FOREIGN KEY ("target_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_production_orders" ADD CONSTRAINT "advanced_production_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_production_orders" ADD CONSTRAINT "advanced_production_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_events" ADD CONSTRAINT "asset_transfer_events_transfer_id_asset_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."asset_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_events" ADD CONSTRAINT "asset_transfer_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_from_branch_id_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_to_branch_id_branches_id_fk" FOREIGN KEY ("to_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "average_ticket_targets" ADD CONSTRAINT "average_ticket_targets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "average_ticket_targets" ADD CONSTRAINT "average_ticket_targets_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "average_ticket_targets" ADD CONSTRAINT "average_ticket_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_daily_sales" ADD CONSTRAINT "branch_daily_sales_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_monthly_targets" ADD CONSTRAINT "branch_monthly_targets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_monthly_targets" ADD CONSTRAINT "branch_monthly_targets_profile_id_target_weight_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."target_weight_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_monthly_targets" ADD CONSTRAINT "branch_monthly_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_monthly_targets" ADD CONSTRAINT "branch_monthly_targets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_budget_allocations" ADD CONSTRAINT "campaign_budget_allocations_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_budget_allocations" ADD CONSTRAINT "campaign_budget_allocations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_expenses" ADD CONSTRAINT "campaign_expenses_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_expenses" ADD CONSTRAINT "campaign_expenses_influencer_id_marketing_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."marketing_influencers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_expenses" ADD CONSTRAINT "campaign_expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_expenses" ADD CONSTRAINT "campaign_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_goals" ADD CONSTRAINT "campaign_goals_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_payment_breakdowns" ADD CONSTRAINT "cashier_payment_breakdowns_journal_id_cashier_sales_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."cashier_sales_journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_sales_journals" ADD CONSTRAINT "cashier_sales_journals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_sales_journals" ADD CONSTRAINT "cashier_sales_journals_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_sales_journals" ADD CONSTRAINT "cashier_sales_journals_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_sales_journals" ADD CONSTRAINT "cashier_sales_journals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_sales_journals" ADD CONSTRAINT "cashier_sales_journals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_performance" ADD CONSTRAINT "cashier_shift_performance_journal_id_cashier_sales_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."cashier_sales_journals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_performance" ADD CONSTRAINT "cashier_shift_performance_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_performance" ADD CONSTRAINT "cashier_shift_performance_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_performance" ADD CONSTRAINT "cashier_shift_performance_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_targets" ADD CONSTRAINT "cashier_shift_targets_shift_allocation_id_target_shift_allocations_id_fk" FOREIGN KEY ("shift_allocation_id") REFERENCES "public"."target_shift_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_targets" ADD CONSTRAINT "cashier_shift_targets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_targets" ADD CONSTRAINT "cashier_shift_targets_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_shift_targets" ADD CONSTRAINT "cashier_shift_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_signatures" ADD CONSTRAINT "cashier_signatures_journal_id_cashier_sales_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."cashier_sales_journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashier_signatures" ADD CONSTRAINT "cashier_signatures_signer_id_users_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_rate_id_commission_rates_id_fk" FOREIGN KEY ("rate_id") REFERENCES "public"."commission_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_project_id_construction_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."construction_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_contract_id_construction_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."construction_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_category_id_construction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."construction_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_contract_id_construction_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."construction_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_operations_summary" ADD CONSTRAINT "daily_operations_summary_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_production_batches" ADD CONSTRAINT "daily_production_batches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_production_batches" ADD CONSTRAINT "daily_production_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_production_batches" ADD CONSTRAINT "daily_production_batches_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_production_batches" ADD CONSTRAINT "daily_production_batches_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_bar_daily_summary" ADD CONSTRAINT "display_bar_daily_summary_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_bar_daily_summary" ADD CONSTRAINT "display_bar_daily_summary_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_bar_receipts" ADD CONSTRAINT "display_bar_receipts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_bar_receipts" ADD CONSTRAINT "display_bar_receipts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_bar_receipts" ADD CONSTRAINT "display_bar_receipts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_bar_receipts" ADD CONSTRAINT "display_bar_receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_awards" ADD CONSTRAINT "incentive_awards_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_awards" ADD CONSTRAINT "incentive_awards_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_awards" ADD CONSTRAINT "incentive_awards_tier_id_incentive_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."incentive_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_awards" ADD CONSTRAINT "incentive_awards_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_awards" ADD CONSTRAINT "incentive_awards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_tiers" ADD CONSTRAINT "incentive_tiers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_campaign_links" ADD CONSTRAINT "influencer_campaign_links_influencer_id_marketing_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."marketing_influencers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_campaign_links" ADD CONSTRAINT "influencer_campaign_links_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_contacts" ADD CONSTRAINT "influencer_contacts_influencer_id_marketing_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."marketing_influencers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_contacts" ADD CONSTRAINT "influencer_contacts_contacted_by_users_id_fk" FOREIGN KEY ("contacted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_payments" ADD CONSTRAINT "influencer_payments_influencer_id_marketing_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."marketing_influencers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_payments" ADD CONSTRAINT "influencer_payments_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_payments" ADD CONSTRAINT "influencer_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_payments" ADD CONSTRAINT "influencer_payments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_attachments" ADD CONSTRAINT "journal_attachments_journal_id_cashier_sales_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."cashier_sales_journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_attachments" ADD CONSTRAINT "journal_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_alerts" ADD CONSTRAINT "marketing_alerts_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_alerts" ADD CONSTRAINT "marketing_alerts_task_id_marketing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."marketing_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_alerts" ADD CONSTRAINT "marketing_alerts_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_alerts" ADD CONSTRAINT "marketing_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_calendar_events" ADD CONSTRAINT "marketing_calendar_events_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_calendar_events" ADD CONSTRAINT "marketing_calendar_events_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_calendar_events" ADD CONSTRAINT "marketing_calendar_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_influencers" ADD CONSTRAINT "marketing_influencers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_performance_reports" ADD CONSTRAINT "marketing_performance_reports_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_performance_reports" ADD CONSTRAINT "marketing_performance_reports_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_performance_reports" ADD CONSTRAINT "marketing_performance_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_task_activities" ADD CONSTRAINT "marketing_task_activities_task_id_marketing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."marketing_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_task_activities" ADD CONSTRAINT "marketing_task_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_team_members" ADD CONSTRAINT "marketing_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_project_id_construction_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."construction_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_contract_id_construction_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."construction_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_category_id_construction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."construction_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_alerts" ADD CONSTRAINT "performance_alerts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_alerts" ADD CONSTRAINT "performance_alerts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_alerts" ADD CONSTRAINT "performance_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_logs" ADD CONSTRAINT "permission_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_logs" ADD CONSTRAINT "permission_audit_logs_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sales_analytics" ADD CONSTRAINT "product_sales_analytics_upload_id_sales_data_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."sales_data_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sales_analytics" ADD CONSTRAINT "product_sales_analytics_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_ai_plans" ADD CONSTRAINT "production_ai_plans_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_ai_plans" ADD CONSTRAINT "production_ai_plans_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_ai_plans" ADD CONSTRAINT "production_ai_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_order_id_advanced_production_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."advanced_production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_order_schedules" ADD CONSTRAINT "production_order_schedules_order_id_advanced_production_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."advanced_production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_allocations" ADD CONSTRAINT "project_budget_allocations_project_id_construction_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."construction_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_allocations" ADD CONSTRAINT "project_budget_allocations_category_id_construction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."construction_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_work_items" ADD CONSTRAINT "project_work_items_project_id_construction_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."construction_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_work_items" ADD CONSTRAINT "project_work_items_category_id_construction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."construction_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_work_items" ADD CONSTRAINT "project_work_items_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_production_order_id_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_data_uploads" ADD CONSTRAINT "sales_data_uploads_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_data_uploads" ADD CONSTRAINT "sales_data_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons_holidays" ADD CONSTRAINT "seasons_holidays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_employees" ADD CONSTRAINT "shift_employees_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_performance_tracking" ADD CONSTRAINT "shift_performance_tracking_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_performance_tracking" ADD CONSTRAINT "shift_performance_tracking_top_cashier_id_users_id_fk" FOREIGN KEY ("top_cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_performance_tracking" ADD CONSTRAINT "shift_performance_tracking_lowest_cashier_id_users_id_fk" FOREIGN KEY ("lowest_cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_daily_allocations" ADD CONSTRAINT "target_daily_allocations_monthly_target_id_branch_monthly_targets_id_fk" FOREIGN KEY ("monthly_target_id") REFERENCES "public"."branch_monthly_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_shift_allocations" ADD CONSTRAINT "target_shift_allocations_daily_allocation_id_target_daily_allocations_id_fk" FOREIGN KEY ("daily_allocation_id") REFERENCES "public"."target_daily_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_weight_profiles" ADD CONSTRAINT "target_weight_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assignments" ADD CONSTRAINT "user_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assignments" ADD CONSTRAINT "user_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assignments" ADD CONSTRAINT "user_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assignments" ADD CONSTRAINT "user_assignments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_items" ADD CONSTRAINT "waste_items_waste_report_id_waste_reports_id_fk" FOREIGN KEY ("waste_report_id") REFERENCES "public"."waste_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_items" ADD CONSTRAINT "waste_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_projects_branch" ON "construction_projects" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "construction_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_branch" ON "inventory_items" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_category" ON "inventory_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_inventory_status" ON "inventory_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_work_items_project" ON "project_work_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_work_items_status" ON "project_work_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_users_branch_id" ON "users" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");