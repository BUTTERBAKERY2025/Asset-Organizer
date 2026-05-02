-- ============================================================================
-- Migration 013: Daily Work Log Restructure (Smart Linking)
-- Date: 2026-05-02
-- Purpose:
--   1) Add `daily_log_activities` table — smart per-activity rows linking
--      daily log → contractor → contract → contract item, replacing the loose
--      JSONB `work_items` column for new logs (legacy column kept for read).
--   2) Add `daily_log_id` back-reference column on `project_expenses` so
--      in-site expenses logged from the daily work log can be traced back.
--   3) Add `main_trade` column on `project_daily_logs` to record the day's
--      primary finishing trade (paint / tiling / hvac / plumbing / etc.).
--
-- Run this in Supabase SQL Editor BEFORE deploying the corresponding code.
-- All operations are idempotent (use IF NOT EXISTS) so re-running is safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) New table: daily_log_activities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_log_activities (
  id                 SERIAL PRIMARY KEY,
  daily_log_id       INTEGER NOT NULL REFERENCES project_daily_logs(id) ON DELETE CASCADE,
  contractor_id      INTEGER REFERENCES contractors(id),
  contract_id        INTEGER REFERENCES construction_contracts(id),
  contract_item_id   INTEGER REFERENCES contract_items(id),
  trade_type         TEXT,
  description        TEXT NOT NULL,
  quantity_today     REAL DEFAULT 0,
  unit               TEXT,
  unit_cost          REAL,
  total_cost         REAL,
  completion_status  TEXT DEFAULT 'in_progress',
  notes              TEXT,
  created_by         VARCHAR REFERENCES users(id),
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_log_activities_log
  ON daily_log_activities(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_activities_contractor
  ON daily_log_activities(contractor_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_activities_contract_item
  ON daily_log_activities(contract_item_id);

-- ----------------------------------------------------------------------------
-- 2) project_expenses: add daily_log_id back-reference
-- ----------------------------------------------------------------------------
ALTER TABLE project_expenses
  ADD COLUMN IF NOT EXISTS daily_log_id INTEGER
    REFERENCES project_daily_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_expenses_daily_log
  ON project_expenses(daily_log_id);

-- ----------------------------------------------------------------------------
-- 3) project_daily_logs: add main_trade column
-- ----------------------------------------------------------------------------
ALTER TABLE project_daily_logs
  ADD COLUMN IF NOT EXISTS main_trade TEXT;

-- ============================================================================
-- DONE. Verify with:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'project_expenses' AND column_name = 'daily_log_id';
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'project_daily_logs' AND column_name = 'main_trade';
--   SELECT to_regclass('public.daily_log_activities');
-- ============================================================================
