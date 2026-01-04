-- Campaign Expenses Table Migration
-- مصروفات الحملات التسويقية

-- Create campaign_expenses table
CREATE TABLE IF NOT EXISTS campaign_expenses (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  influencer_id INTEGER REFERENCES marketing_influencers(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  invoice_number VARCHAR(100),
  vendor VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_campaign_id ON campaign_expenses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_influencer_id ON campaign_expenses(influencer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_category ON campaign_expenses(category);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_status ON campaign_expenses(status);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_expense_date ON campaign_expenses(expense_date);

-- Add comment for table
COMMENT ON TABLE campaign_expenses IS 'مصروفات الحملات التسويقية';
COMMENT ON COLUMN campaign_expenses.category IS 'فئة المصروف: influencer, advertising, content_production, design, printing, events, gifts, travel, equipment, software, other';
COMMENT ON COLUMN campaign_expenses.status IS 'حالة المصروف: pending, approved, paid, rejected';
COMMENT ON COLUMN campaign_expenses.payment_method IS 'طريقة الدفع: bank_transfer, cash, check, credit_card';
