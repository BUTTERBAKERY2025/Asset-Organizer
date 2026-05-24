-- Enforce one daily closure per (branch, date) at DB level.
-- This prevents the duplicate-closure race when two users finalize different
-- journal subsets for the same branch+date concurrently. Violations bubble
-- up as Postgres error 23505, which the route maps to HTTP 409.
--
-- HOW TO APPLY:
--   1) Run this in Supabase SQL Editor on DEV first, then on PROD.
--   2) If it fails because duplicates already exist, deduplicate first:
--        SELECT branch_id, closure_date, COUNT(*)
--        FROM branch_daily_closures
--        GROUP BY 1,2 HAVING COUNT(*) > 1;
--      then delete/merge the redundant rows before re-running.
--   3) After applying on PROD, deploy the matching code (manual Render deploy).

DROP INDEX IF EXISTS idx_daily_closure_branch_date;

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_closure_branch_date
  ON branch_daily_closures (branch_id, closure_date);
