-- جدول عقود المؤثرين - influencer_contracts
-- يجب تنفيذ هذا في Supabase SQL Editor قبل النشر

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

-- إضافة فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_influencer_id ON influencer_contracts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_status ON influencer_contracts(status);
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_branch_id ON influencer_contracts(branch_id);
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_created_at ON influencer_contracts(created_at);
