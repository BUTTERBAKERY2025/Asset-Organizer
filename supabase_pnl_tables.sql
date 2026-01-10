-- P&L (Profit & Loss) Dashboard Tables
-- Execute this SQL in Supabase SQL Editor before deploying

-- Financial Periods - الفترات المالية
CREATE TABLE IF NOT EXISTS financial_periods (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  period_type TEXT NOT NULL DEFAULT 'monthly',
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_revenue REAL DEFAULT 0,
  target_gross_margin REAL DEFAULT 0,
  target_net_margin REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_periods_branch ON financial_periods(branch_id);
CREATE INDEX IF NOT EXISTS idx_financial_periods_date ON financial_periods(year, month);

-- Financial Sales - المبيعات المالية
CREATE TABLE IF NOT EXISTS financial_sales (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  category TEXT,
  shift TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  avg_invoice_value REAL DEFAULT 0,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_sales_period ON financial_sales(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_sales_channel ON financial_sales(channel);

-- Financial COGS (Cost of Goods Sold) - تكلفة البضائع المباعة
CREATE TABLE IF NOT EXISTS financial_cogs (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  waste_amount REAL DEFAULT 0,
  waste_pct REAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_cogs_period ON financial_cogs(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_cogs_type ON financial_cogs(item_type);

-- Financial Operating Expenses - المصروفات التشغيلية
CREATE TABLE IF NOT EXISTS financial_operating_expenses (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_opex_period ON financial_operating_expenses(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_opex_type ON financial_operating_expenses(expense_type);

-- Financial Fixed Costs - التكاليف الثابتة
CREATE TABLE IF NOT EXISTS financial_fixed_costs (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_fixed_period ON financial_fixed_costs(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_fixed_type ON financial_fixed_costs(cost_type);

-- Financial Metrics Cache - تخزين المؤشرات المالية
CREATE TABLE IF NOT EXISTS financial_metrics (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  total_revenue REAL DEFAULT 0,
  total_cogs REAL DEFAULT 0,
  total_operating_expenses REAL DEFAULT 0,
  total_fixed_costs REAL DEFAULT 0,
  gross_profit REAL DEFAULT 0,
  net_profit REAL DEFAULT 0,
  gross_margin_pct REAL DEFAULT 0,
  net_margin_pct REAL DEFAULT 0,
  break_even_sales REAL DEFAULT 0,
  salary_to_sales_pct REAL DEFAULT 0,
  rent_to_revenue_pct REAL DEFAULT 0,
  waste_pct REAL DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  avg_invoice_value REAL DEFAULT 0,
  rating TEXT DEFAULT 'average',
  rating_reasons JSONB,
  recommendations JSONB,
  calculated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_period ON financial_metrics(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_rating ON financial_metrics(rating);

-- Unique constraint to prevent duplicate periods per branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_branch_period ON financial_periods(branch_id, year, month);
