-- Floor-plan assignments uniqueness fix.
--
-- Problem: a legacy unique constraint on (floor_plan_id, employee_id) prevented
-- placing the same employee in more than one shift of the same plan (e.g., the
-- same person covering both morning and evening). The correct uniqueness is
-- per-shift: (floor_plan_id, employee_id, shift_type) where employee_id IS NOT NULL.
--
-- This migration is idempotent and safe to run multiple times.
-- Apply on Supabase via SQL Editor BEFORE deploying the new code to Render.

BEGIN;

-- 1) Drop the legacy too-strict constraint (no-op if it was already removed)
ALTER TABLE floor_plan_assignments
  DROP CONSTRAINT IF EXISTS floor_plan_assignments_plan_emp_unique;

-- 2) Ensure the correct partial unique index exists (no-op if already present).
--    Using a partial index lets multiple empty slots (employee_id IS NULL)
--    coexist while still preventing duplicate placements of the same person
--    in the same shift of the same plan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plan_assignments_emp_shift
  ON floor_plan_assignments (floor_plan_id, employee_id, shift_type)
  WHERE employee_id IS NOT NULL;

COMMIT;

-- Verification (run separately, should return one row, the partial unique index):
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'floor_plan_assignments'
--   AND indexname = 'uq_floor_plan_assignments_emp_shift';
--
-- And the legacy constraint should be gone:
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'floor_plan_assignments'::regclass
--   AND conname = 'floor_plan_assignments_plan_emp_unique';
-- (should return zero rows)
