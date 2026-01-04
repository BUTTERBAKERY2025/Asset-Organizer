-- Campaign Expenses Table Migration
-- مصروفات الحملات التسويقية
-- يجب تنفيذ هذا الملف في Supabase SQL Editor قبل النشر

-- إنشاء جدول مصروفات الحملات
CREATE TABLE IF NOT EXISTS campaign_expenses (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  influencer_id INTEGER REFERENCES marketing_influencers(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'SAR' NOT NULL,
  expense_date TEXT NOT NULL,
  payment_method TEXT,
  reference_number TEXT,
  invoice_number TEXT,
  vendor TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- إنشاء الفهارس لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_campaign_id ON campaign_expenses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_influencer_id ON campaign_expenses(influencer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_category ON campaign_expenses(category);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_status ON campaign_expenses(status);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_expense_date ON campaign_expenses(expense_date);

-- شرح الجدول والأعمدة
COMMENT ON TABLE campaign_expenses IS 'مصروفات الحملات التسويقية';
COMMENT ON COLUMN campaign_expenses.category IS 'فئة المصروف: influencer, advertising, content_production, design, printing, events, gifts, travel, equipment, software, other';
COMMENT ON COLUMN campaign_expenses.status IS 'حالة المصروف: pending, approved, paid, rejected';
COMMENT ON COLUMN campaign_expenses.payment_method IS 'طريقة الدفع: bank_transfer, cash, check, credit_card';
