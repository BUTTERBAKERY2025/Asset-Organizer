-- Branch Daily Closures Module - الإغلاق اليومي للفرع
-- Execute this SQL in Supabase SQL Editor before deploying

-- Branch Daily Closures table - الإغلاق اليومي للفرع
CREATE TABLE IF NOT EXISTS branch_daily_closures (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  closure_date TEXT NOT NULL,
  
  -- إجمالي المبيعات المجمعة
  total_sales REAL DEFAULT 0 NOT NULL,
  cash_total REAL DEFAULT 0 NOT NULL,
  network_total REAL DEFAULT 0 NOT NULL,
  delivery_total REAL DEFAULT 0 NOT NULL,
  
  -- إجمالي الصندوق النقدي
  total_opening_balance REAL DEFAULT 0 NOT NULL,
  total_expected_cash REAL DEFAULT 0 NOT NULL,
  total_actual_cash REAL DEFAULT 0 NOT NULL,
  total_cash_discrepancy REAL DEFAULT 0 NOT NULL,
  cash_discrepancy_status TEXT DEFAULT 'balanced' NOT NULL,
  
  -- مطابقة البنك المجمعة
  total_bank_pos_amount REAL DEFAULT 0,
  total_bank_terminal_amount REAL DEFAULT 0,
  total_bank_discrepancy REAL DEFAULT 0,
  bank_discrepancy_status TEXT DEFAULT 'balanced',
  
  -- إحصائيات مجمعة
  total_customer_count INTEGER DEFAULT 0,
  total_transaction_count INTEGER DEFAULT 0,
  average_ticket REAL DEFAULT 0,
  journals_count INTEGER DEFAULT 0 NOT NULL,
  
  -- الحالة
  status TEXT DEFAULT 'open' NOT NULL,
  closed_by VARCHAR REFERENCES users(id),
  closed_at TIMESTAMP,
  
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_closure_branch_date ON branch_daily_closures(branch_id, closure_date);
CREATE INDEX IF NOT EXISTS idx_daily_closure_status ON branch_daily_closures(status);

-- Branch Daily Closure Payments - تفاصيل الدفع المجمعة
CREATE TABLE IF NOT EXISTS branch_daily_closure_payments (
  id SERIAL PRIMARY KEY,
  closure_id INTEGER NOT NULL REFERENCES branch_daily_closures(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  total_amount REAL DEFAULT 0 NOT NULL,
  total_pos_amount REAL DEFAULT 0,
  total_terminal_amount REAL DEFAULT 0,
  total_bank_discrepancy REAL DEFAULT 0,
  bank_discrepancy_type TEXT DEFAULT 'balanced',
  total_transaction_count INTEGER DEFAULT 0,
  total_terminal_transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Branch Daily Closure Journals - ربط اليومية المجمعة باليوميات الفردية
CREATE TABLE IF NOT EXISTS branch_daily_closure_journals (
  id SERIAL PRIMARY KEY,
  closure_id INTEGER NOT NULL REFERENCES branch_daily_closures(id) ON DELETE CASCADE,
  journal_id INTEGER NOT NULL REFERENCES cashier_sales_journals(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_closure_journal_closure ON branch_daily_closure_journals(closure_id);
CREATE INDEX IF NOT EXISTS idx_closure_journal_journal ON branch_daily_closure_journals(journal_id);
