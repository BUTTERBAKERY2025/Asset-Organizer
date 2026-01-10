-- =====================================================
-- P&L Dashboard - New Financial KPIs Migration
-- Execute this SQL manually in Supabase SQL Editor
-- Date: 2026-01-10
-- =====================================================

-- Add new KPI columns to financial_metrics table
ALTER TABLE financial_metrics 
ADD COLUMN IF NOT EXISTS ebitda REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ebitda_margin_pct REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS contribution_margin REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS contribution_margin_pct REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_productivity REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_per_employee REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS employee_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS operating_profit REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS operating_margin_pct REAL DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN financial_metrics.ebitda IS 'Earnings Before Interest, Taxes, Depreciation, and Amortization';
COMMENT ON COLUMN financial_metrics.ebitda_margin_pct IS 'EBITDA as percentage of revenue';
COMMENT ON COLUMN financial_metrics.contribution_margin IS 'Revenue minus variable costs (COGS)';
COMMENT ON COLUMN financial_metrics.contribution_margin_pct IS 'Contribution margin as percentage of revenue';
COMMENT ON COLUMN financial_metrics.labor_productivity IS 'Gross profit per salary expense ratio (percentage)';
COMMENT ON COLUMN financial_metrics.revenue_per_employee IS 'Total revenue divided by number of active employees';
COMMENT ON COLUMN financial_metrics.employee_count IS 'Number of active employees in the branch';
COMMENT ON COLUMN financial_metrics.operating_profit IS 'Gross profit minus operating expenses';
COMMENT ON COLUMN financial_metrics.operating_margin_pct IS 'Operating profit as percentage of revenue';
