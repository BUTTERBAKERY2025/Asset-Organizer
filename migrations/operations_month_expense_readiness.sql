-- Additive P&L source readiness for the operations monthly workflow.
-- Safe alternative to migration 010: NO records, backfill or inferred dates.
-- Do not run migration 010's historical rent seed without verified effective dates.
-- Existing legacy rent remains readable from pnl_branch_settings.

BEGIN;

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

ALTER TABLE pnl_monthly_inputs
    ADD COLUMN IF NOT EXISTS internet_cost REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS government_fees REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS insurance_cost REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscriptions_cost REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS security_cost REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bank_fees REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fuel_cost REAL DEFAULT 0;

COMMIT;