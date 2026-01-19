-- ============================================
-- جداول قسم التسويق الكاملة
-- يجب تنفيذ هذا في Supabase SQL Editor
-- ============================================

-- 1. جدول عقود المؤثرين
CREATE TABLE IF NOT EXISTS influencer_contracts (
  id SERIAL PRIMARY KEY,
  contract_number TEXT NOT NULL,
  influencer_id INTEGER REFERENCES marketing_influencers(id) ON DELETE SET NULL,
  influencer_name TEXT NOT NULL,
  influencer_phone TEXT,
  influencer_email TEXT,
  national_id TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  iban TEXT,
  campaign_name TEXT NOT NULL,
  campaign_description TEXT,
  branch_id VARCHAR REFERENCES branches(id),
  branch_name TEXT,
  coverage_location TEXT,
  coverage_date TEXT,
  coverage_time TEXT,
  contract_amount REAL NOT NULL,
  currency TEXT DEFAULT 'SAR',
  payment_terms TEXT,
  deliverables TEXT[],
  content_requirements TEXT,
  exclusivity_clause BOOLEAN DEFAULT false,
  contract_start_date TEXT NOT NULL,
  contract_end_date TEXT,
  influencer_signature TEXT,
  influencer_signed_at TIMESTAMP,
  company_signature TEXT,
  company_signed_at TIMESTAMP,
  company_signed_by VARCHAR,
  status TEXT NOT NULL DEFAULT 'draft',
  finance_approved BOOLEAN DEFAULT false,
  finance_approved_by VARCHAR,
  finance_approved_at TIMESTAMP,
  finance_notes TEXT,
  payment_status TEXT DEFAULT 'pending',
  payment_date TEXT,
  payment_reference TEXT,
  notes TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. جدول مدفوعات المؤثرين
CREATE TABLE IF NOT EXISTS influencer_payments (
  id SERIAL PRIMARY KEY,
  influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_date TEXT NOT NULL,
  payment_method TEXT,
  reference_number TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  invoice_number TEXT,
  attachment_url TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  approved_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- الفهارس لتحسين الأداء
-- ============================================

-- فهارس عقود المؤثرين
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_influencer_id ON influencer_contracts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_status ON influencer_contracts(status);
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_branch_id ON influencer_contracts(branch_id);
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_created_at ON influencer_contracts(created_at);

-- فهارس مدفوعات المؤثرين
CREATE INDEX IF NOT EXISTS idx_influencer_payments_influencer_id ON influencer_payments(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_payments_campaign_id ON influencer_payments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_payments_status ON influencer_payments(status);
CREATE INDEX IF NOT EXISTS idx_influencer_payments_payment_date ON influencer_payments(payment_date);
