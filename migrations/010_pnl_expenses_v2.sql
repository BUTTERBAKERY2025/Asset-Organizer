-- ============================================================================
-- P&L Expense Management v2
-- ============================================================================
-- شغّل هذا الملف يدوياً على Supabase SQL Editor قبل نشر الكود الجديد.
-- يُضيف:
--   1. جدول pnl_rent_history     — سجل الإيجار مع تواريخ الصلاحية
--   2. جدول pnl_recurring_expenses — المصاريف المتكررة (اشتراكات، تأمين، إلخ)
--   3. حقول جديدة على pnl_monthly_inputs (إنترنت، تأمين، رخص، ...)
--   4. ترحيل قيمة الإيجار الحالية من pnl_branch_settings إلى pnl_rent_history
-- الملف آمن لإعادة التشغيل (idempotent) — يستخدم IF NOT EXISTS.
-- ============================================================================

BEGIN;

-- 1) Rent history with effective dates -------------------------------------
CREATE TABLE IF NOT EXISTS pnl_rent_history (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    monthly_amount REAL NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    contract_ref TEXT,
    notes TEXT,
    created_by VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnl_rent_history_branch
    ON pnl_rent_history (branch_id);
CREATE INDEX IF NOT EXISTS idx_pnl_rent_history_effective
    ON pnl_rent_history (branch_id, effective_from);

-- 2) Recurring monthly expenses --------------------------------------------
CREATE TABLE IF NOT EXISTS pnl_recurring_expenses (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    monthly_amount REAL NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    vendor TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnl_recurring_branch
    ON pnl_recurring_expenses (branch_id);
CREATE INDEX IF NOT EXISTS idx_pnl_recurring_active
    ON pnl_recurring_expenses (branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pnl_recurring_effective
    ON pnl_recurring_expenses (branch_id, effective_from);

-- 3) New columns on pnl_monthly_inputs -------------------------------------
ALTER TABLE pnl_monthly_inputs
    ADD COLUMN IF NOT EXISTS internet_cost       REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS government_fees     REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS insurance_cost      REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscriptions_cost  REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS security_cost       REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bank_fees           REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fuel_cost           REAL DEFAULT 0;

-- 4) Backfill: seed current rent value into pnl_rent_history ---------------
--    For each branch that has a non-zero monthly_rent in pnl_branch_settings
--    and no rent_history yet, create a single open-ended history row.
INSERT INTO pnl_rent_history (branch_id, monthly_amount, effective_from, notes, created_at, updated_at)
SELECT
    bs.branch_id,
    bs.monthly_rent,
    DATE '2024-01-01' AS effective_from,
    'ترحيل تلقائي من pnl_branch_settings عند ترقية النظام' AS notes,
    NOW(), NOW()
FROM pnl_branch_settings bs
WHERE COALESCE(bs.monthly_rent, 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM pnl_rent_history rh WHERE rh.branch_id = bs.branch_id
  );

COMMIT;

-- ============================================================================
-- تحقّق من النتائج (اختياري)
-- ============================================================================
-- SELECT branch_id, monthly_amount, effective_from FROM pnl_rent_history;
-- SELECT branch_id, category, name, monthly_amount FROM pnl_recurring_expenses;
-- \d pnl_monthly_inputs
