-- ============================================================================
-- Floor Plan — Role Slots (التوزيع الأساسي بالوظيفة، تعيين الموظف اختياري)
-- Run this in Supabase SQL Editor BEFORE deploying the new code to Render.
-- Depends on `migrations/floor_plan_tables.sql` and `migrations/floor_plan_shifts.sql`.
-- ============================================================================

-- 1) Allow empty role slots that have no employee assigned yet.
ALTER TABLE floor_plan_assignments
  ALTER COLUMN employee_id DROP NOT NULL;

-- 2) Replace the old strict unique with a PARTIAL unique:
--    same employee may only sit in one slot per (plan, shift),
--    but unlimited empty slots are allowed.
DROP INDEX IF EXISTS uq_floor_plan_assignments_emp_shift;

CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plan_assignments_emp_shift
  ON floor_plan_assignments(floor_plan_id, employee_id, shift_type)
  WHERE employee_id IS NOT NULL;
