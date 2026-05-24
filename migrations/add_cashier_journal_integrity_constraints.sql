-- ============================================================================
-- Cashier Sales Journal — Data Integrity Hardening
-- ============================================================================
-- Run this on BOTH dev (Supabase project for dev) and PRODUCTION Supabase.
-- It is idempotent (safe to re-run).
--
-- WHAT IT DOES:
-- 1. Prevents two journals for the same (branch, cashier, date, shift).
-- 2. Prevents duplicate payment-method rows inside the same journal.
-- 3. Adds an index on cashier_payment_breakdowns.journal_id (speeds the
--    "delete-then-insert" pattern used when editing breakdowns).
--
-- BEFORE running step 1/2, run the diagnostic SELECTs to see if any duplicates
-- already exist. If they do, dedupe them manually first — otherwise the
-- CREATE UNIQUE INDEX will fail.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DIAGNOSTIC 1: find duplicate journals for the same shift
-- ---------------------------------------------------------------------------
-- SELECT branch_id, cashier_id, journal_date, COALESCE(shift_type, '(null)') AS shift_type,
--        COUNT(*) AS dup_count, ARRAY_AGG(id ORDER BY id) AS ids
-- FROM cashier_sales_journals
-- GROUP BY branch_id, cashier_id, journal_date, COALESCE(shift_type, '(null)')
-- HAVING COUNT(*) > 1;

-- ---------------------------------------------------------------------------
-- DIAGNOSTIC 2: find duplicate payment-method rows inside a journal
-- ---------------------------------------------------------------------------
-- SELECT journal_id, payment_method, COUNT(*) AS dup_count, ARRAY_AGG(id ORDER BY id) AS ids
-- FROM cashier_payment_breakdowns
-- GROUP BY journal_id, payment_method
-- HAVING COUNT(*) > 1;

-- ---------------------------------------------------------------------------
-- 1. UNIQUE: one journal per (branch, cashier, date, shift_type)
--    Uses COALESCE so two NULL shift_types are treated as equal.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cashier_journal_branch_cashier_date_shift
  ON cashier_sales_journals (branch_id, cashier_id, journal_date, COALESCE(shift_type, ''));

-- ---------------------------------------------------------------------------
-- 2. UNIQUE: one breakdown row per (journal, payment_method)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cashier_breakdown_journal_method
  ON cashier_payment_breakdowns (journal_id, payment_method);

-- ---------------------------------------------------------------------------
-- 3. Helper index for the delete-by-journal pattern in PATCH flow
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cashier_breakdowns_journal_id
  ON cashier_payment_breakdowns (journal_id);
