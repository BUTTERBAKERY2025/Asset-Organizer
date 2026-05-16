-- =====================================================
-- Phase 12: Employee Status History & Termination Tracking
-- Run this manually in Supabase SQL Editor BEFORE deploying code
-- Date: 2026-05-16
-- =====================================================

BEGIN;

-- 1) Add new tracking columns to branch_employees
ALTER TABLE branch_employees
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS status_changed_by VARCHAR NULL,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT NULL;

-- 2) Create employee_status_history table
CREATE TABLE IF NOT EXISTS employee_status_history (
  id SERIAL PRIMARY KEY,
  branch_employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by VARCHAR REFERENCES users(id),
  reason TEXT,
  notes TEXT
);

-- 3) Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_emp_status_history_emp ON employee_status_history(branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_status_history_new_status ON employee_status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_emp_status_history_changed_at ON employee_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_branch_employees_branch_status ON branch_employees(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_branch_employees_terminated_at ON branch_employees(terminated_at);

-- 4) Backfill: existing terminated employees get terminated_at = updated_at
UPDATE branch_employees
SET terminated_at = updated_at,
    status_changed_at = updated_at
WHERE status = 'terminated' AND terminated_at IS NULL;

-- 5) Backfill: all employees get a status_changed_at to avoid NULL on first edit
UPDATE branch_employees
SET status_changed_at = updated_at
WHERE status_changed_at IS NULL;

-- 6) Backfill: seed an initial history row for each existing employee
--    so the timeline shows at least one entry even before any future change.
INSERT INTO employee_status_history (branch_employee_id, old_status, new_status, changed_at, reason)
SELECT id, NULL, status, COALESCE(status_changed_at, updated_at, created_at), 'Seed entry on migration'
FROM branch_employees
WHERE NOT EXISTS (
  SELECT 1 FROM employee_status_history h WHERE h.branch_employee_id = branch_employees.id
);

COMMIT;

-- =====================================================
-- Verification queries (run separately AFTER commit):
-- =====================================================
-- SELECT COUNT(*) AS total, COUNT(terminated_at) AS terminated_count FROM branch_employees;
-- SELECT COUNT(*) FROM employee_status_history;
-- SELECT status, COUNT(*) FROM branch_employees GROUP BY status;
