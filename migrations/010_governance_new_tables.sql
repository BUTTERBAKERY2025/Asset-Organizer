-- =====================================================
-- Governance New Tables Migration
-- جداول الحوكمة الجديدة للصفحات الخمس
-- Run this in Supabase SQL Editor before deployment
-- =====================================================

-- 1. Share Transfers - تحويلات الأسهم
CREATE TABLE IF NOT EXISTS share_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  from_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  to_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  number_of_shares INTEGER NOT NULL,
  price_per_share DECIMAL(15,4),
  total_value DECIMAL(20,2),
  transfer_date DATE NOT NULL,
  transfer_type VARCHAR(50) DEFAULT 'sale',
  approval_status VARCHAR(50) DEFAULT 'pending',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  board_resolution_id INTEGER REFERENCES board_resolutions(id),
  notes TEXT,
  attachment_url VARCHAR(500),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_share_transfers_from ON share_transfers(from_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_to ON share_transfers(to_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_status ON share_transfers(approval_status);
CREATE INDEX IF NOT EXISTS idx_share_transfers_date ON share_transfers(transfer_date);

-- 2. Disclosures - الإفصاحات والتقارير
CREATE TABLE IF NOT EXISTS disclosures (
  id SERIAL PRIMARY KEY,
  disclosure_number TEXT UNIQUE NOT NULL,
  disclosure_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  fiscal_year TEXT,
  fiscal_quarter TEXT,
  reporting_period_start DATE,
  reporting_period_end DATE,
  due_date DATE,
  submission_date TIMESTAMP,
  publish_date TIMESTAMP,
  regulatory_body TEXT,
  reference_number TEXT,
  category TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'draft',
  content TEXT,
  attachments JSONB,
  financial_statements JSONB,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  is_confidential BOOLEAN DEFAULT FALSE,
  publish_url TEXT,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disclosures_type ON disclosures(disclosure_type);
CREATE INDEX IF NOT EXISTS idx_disclosures_status ON disclosures(status);
CREATE INDEX IF NOT EXISTS idx_disclosures_year ON disclosures(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_disclosures_due ON disclosures(due_date);

-- 3. Dividend Distributions - توزيعات الأرباح
CREATE TABLE IF NOT EXISTS dividend_distributions (
  id SERIAL PRIMARY KEY,
  distribution_number TEXT UNIQUE NOT NULL,
  fiscal_year TEXT NOT NULL,
  distribution_type TEXT DEFAULT 'cash',
  description TEXT,
  total_amount DECIMAL(15,2) NOT NULL,
  amount_per_share DECIMAL(15,4) NOT NULL,
  eligible_shares INTEGER,
  record_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  board_resolution_id INTEGER REFERENCES board_resolutions(id),
  assembly_meeting_id INTEGER REFERENCES governance_meetings(id),
  status TEXT DEFAULT 'announced',
  paid_amount DECIMAL(15,2) DEFAULT 0,
  withholding_tax_rate DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dividend_distributions_year ON dividend_distributions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dividend_distributions_status ON dividend_distributions(status);
CREATE INDEX IF NOT EXISTS idx_dividend_distributions_payment_date ON dividend_distributions(payment_date);

-- 4. Shareholder Dividends - توزيعات المساهمين الفردية
CREATE TABLE IF NOT EXISTS shareholder_dividends (
  id SERIAL PRIMARY KEY,
  distribution_id INTEGER NOT NULL REFERENCES dividend_distributions(id) ON DELETE CASCADE,
  shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  shares_held INTEGER NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  withholding_tax DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'bank_transfer',
  payment_reference TEXT,
  payment_date DATE,
  status TEXT DEFAULT 'pending',
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_distribution ON shareholder_dividends(distribution_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_shareholder ON shareholder_dividends(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_status ON shareholder_dividends(status);

-- 5. Capital Transactions - معاملات رأس المال
CREATE TABLE IF NOT EXISTS capital_transactions (
  id SERIAL PRIMARY KEY,
  transaction_number TEXT UNIQUE NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT NOT NULL,
  previous_capital DECIMAL(15,2) NOT NULL,
  new_capital DECIMAL(15,2) NOT NULL,
  change_amount DECIMAL(15,2) NOT NULL,
  previous_shares INTEGER NOT NULL,
  new_shares INTEGER NOT NULL,
  share_change INTEGER NOT NULL,
  price_per_share DECIMAL(15,4),
  effective_date DATE NOT NULL,
  board_resolution_id INTEGER REFERENCES board_resolutions(id),
  assembly_meeting_id INTEGER REFERENCES governance_meetings(id),
  regulatory_approval TEXT,
  regulatory_approval_date DATE,
  registration_number TEXT,
  registration_date DATE,
  status TEXT DEFAULT 'pending',
  attachments JSONB,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capital_transactions_type ON capital_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_capital_transactions_status ON capital_transactions(status);
CREATE INDEX IF NOT EXISTS idx_capital_transactions_date ON capital_transactions(effective_date);

-- 6. Resolution Votes - أصوات القرارات
CREATE TABLE IF NOT EXISTS resolution_votes (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER NOT NULL REFERENCES board_resolutions(id) ON DELETE CASCADE,
  voter_type TEXT NOT NULL,
  voter_id INTEGER,
  voter_name TEXT,
  vote TEXT NOT NULL,
  voting_weight INTEGER DEFAULT 1,
  comments TEXT,
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  signature_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_resolution ON resolution_votes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_resolution_votes_vote ON resolution_votes(vote);

-- Add vote count columns to board_resolutions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'board_resolutions' AND column_name = 'for_votes') THEN
    ALTER TABLE board_resolutions ADD COLUMN for_votes INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'board_resolutions' AND column_name = 'against_votes') THEN
    ALTER TABLE board_resolutions ADD COLUMN against_votes INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'board_resolutions' AND column_name = 'abstain_votes') THEN
    ALTER TABLE board_resolutions ADD COLUMN abstain_votes INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'board_resolutions' AND column_name = 'total_votes') THEN
    ALTER TABLE board_resolutions ADD COLUMN total_votes INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'board_resolutions' AND column_name = 'voting_deadline') THEN
    ALTER TABLE board_resolutions ADD COLUMN voting_deadline TIMESTAMP;
  END IF;
END $$;

-- =====================================================
-- End of Migration
-- =====================================================
