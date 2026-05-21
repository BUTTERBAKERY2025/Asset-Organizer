-- ============================================================
-- Operations Reports Dashboard — Performance Indexes
-- ============================================================
-- Run this BEFORE deploying the matching code changes in production
-- (Supabase SQL Editor). All statements use IF NOT EXISTS so it is
-- safe to re-run.
--
-- Why each index exists:
-- 1. idx_cashier_journals_cashier_date
--    Speeds up "filter by cashier + date range" used when a manager
--    picks a specific cashier in the dashboard or when the cashier's
--    own journals page loads.
-- 2. idx_cashier_journals_branch_status_date
--    Covers the common combo "branch + status (approved/posted) +
--    date" used by targets, leaderboard and KPI calculations.
-- 3. idx_cashier_journals_discrepancy
--    Filtering by shortage/surplus/balanced (Payment Mismatch &
--    Executive Summary tabs).
-- 4. idx_cashier_journals_date_desc
--    The default list ordering (newest first) when no branch is
--    specified.
-- 5. idx_production_orders_branch_scheduled
--    Production aggregate queries inside getOperationsReport.
-- 6. idx_quality_checks_production_order
--    Quality-pass-rate join inside getOperationsReport.

CREATE INDEX IF NOT EXISTS idx_cashier_journals_cashier_date
  ON public.cashier_sales_journals USING btree (cashier_id, journal_date DESC);

CREATE INDEX IF NOT EXISTS idx_cashier_journals_branch_status_date
  ON public.cashier_sales_journals USING btree (branch_id, status, journal_date DESC);

CREATE INDEX IF NOT EXISTS idx_cashier_journals_discrepancy
  ON public.cashier_sales_journals USING btree (discrepancy_status);

CREATE INDEX IF NOT EXISTS idx_cashier_journals_date_desc
  ON public.cashier_sales_journals USING btree (journal_date DESC);

CREATE INDEX IF NOT EXISTS idx_production_orders_branch_scheduled
  ON public.production_orders USING btree (branch_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_quality_checks_production_order
  ON public.quality_checks USING btree (production_order_id);
