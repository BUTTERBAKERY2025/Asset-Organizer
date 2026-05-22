-- P&L global settings (single-row table)
-- Holds system-wide P&L rules. Currently: fixed COGS ratio (default 30%).
-- Editable by admin only via /api/pnl/global-settings.

CREATE TABLE IF NOT EXISTS pnl_global_settings (
  id           SERIAL PRIMARY KEY,
  cogs_ratio   REAL    NOT NULL DEFAULT 0.30,
  updated_by   VARCHAR,
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed the single configuration row if it doesn't exist yet.
INSERT INTO pnl_global_settings (id, cogs_ratio)
SELECT 1, 0.30
WHERE NOT EXISTS (SELECT 1 FROM pnl_global_settings);
