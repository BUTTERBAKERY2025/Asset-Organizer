-- ============================================================================
-- Floor Plan — Add Shift Support (صباحي / مسائي / ليلي)
-- Run this in Supabase SQL Editor BEFORE deploying the new code to Render.
-- This depends on `migrations/floor_plan_tables.sql` already being applied.
-- ============================================================================

-- 1) Add shift_type column (defaults all existing assignments to 'morning')
ALTER TABLE floor_plan_assignments
  ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'morning';

-- 2) Replace the old uniqueness (one row per employee) with one row per
--    (employee, shift) so the same employee can be placed in different shifts.
DROP INDEX IF EXISTS uq_floor_plan_assignments_emp;

CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plan_assignments_emp_shift
  ON floor_plan_assignments(floor_plan_id, employee_id, shift_type);

-- 3) Helpful index for filtering by shift
CREATE INDEX IF NOT EXISTS idx_floor_plan_assignments_plan_shift
  ON floor_plan_assignments(floor_plan_id, shift_type);

-- 4) Enforce allowed shift values at the DB level
ALTER TABLE floor_plan_assignments
  DROP CONSTRAINT IF EXISTS floor_plan_assignments_shift_type_check;
ALTER TABLE floor_plan_assignments
  ADD CONSTRAINT floor_plan_assignments_shift_type_check
  CHECK (shift_type IN ('morning','evening','night'));
