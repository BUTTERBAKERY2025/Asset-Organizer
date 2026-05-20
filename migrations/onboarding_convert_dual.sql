-- ============================================================
-- Phase: Dual conversion (HR employee + optional login)
-- Adds: onboarding_notifications.converted_branch_employee_id
-- Date: 2026-05-20
-- ============================================================

ALTER TABLE onboarding_notifications
  ADD COLUMN IF NOT EXISTS converted_branch_employee_id INTEGER
  REFERENCES branch_employees(id);

CREATE INDEX IF NOT EXISTS idx_onboarding_converted_branch_employee
  ON onboarding_notifications(converted_branch_employee_id);
