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
  transfer_type VARCHAR(50) DEFAULT 'sale', -- sale, gift, inheritance, transfer
  approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, completed
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
  disclosure_number VARCHAR(50) UNIQUE NOT NULL,
  disclosure_type VARCHAR(100) NOT NULL, -- annual_report, quarterly_report, financial_statement, board_changes, material_event, ownership_change, dividend_announcement, other
  title VARCHAR(500) NOT NULL,
  description TEXT,
  fiscal_year VARCHAR(10),
  fiscal_quarter VARCHAR(10), -- Q1, Q2, Q3, Q4
  regulatory_body VARCHAR(255), -- هيئة السوق المالية
  category VARCHAR(100), -- financial, operational, governance, regulatory
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_review, approved, submitted, published, rejected
  due_date DATE,
  submission_date DATE,
  publication_date DATE,
  reporting_period_start DATE,
  reporting_period_end DATE,
  content TEXT,
  document_url VARCHAR(500),
  reference_number VARCHAR(100),
  submitted_by VARCHAR(255),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  publish_url VARCHAR(500),
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
  distribution_number VARCHAR(50) UNIQUE NOT NULL,
  fiscal_year VARCHAR(10) NOT NULL,
  distribution_type VARCHAR(50) DEFAULT 'cash', -- cash, stock, mixed
  description TEXT,
  total_amount DECIMAL(20,2) NOT NULL,
  amount_per_share DECIMAL(15,6) NOT NULL,
  eligible_shares INTEGER,
  record_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'announced', -- announced, approved, in_progress, completed, cancelled
  board_resolution_id INTEGER REFERENCES board_resolutions(id),
  withholding_tax_rate DECIMAL(5,2) DEFAULT 0,
  paid_amount DECIMAL(20,2) DEFAULT 0,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dividends_year ON dividend_distributions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dividends_status ON dividend_distributions(status);
CREATE INDEX IF NOT EXISTS idx_dividends_record ON dividend_distributions(record_date);
CREATE INDEX IF NOT EXISTS idx_dividends_payment ON dividend_distributions(payment_date);

-- 4. Shareholder Dividends - توزيعات المساهمين الفردية
CREATE TABLE IF NOT EXISTS shareholder_dividends (
  id SERIAL PRIMARY KEY,
  distribution_id INTEGER NOT NULL REFERENCES dividend_distributions(id),
  shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  number_of_shares INTEGER NOT NULL,
  gross_amount DECIMAL(20,2) NOT NULL,
  tax_amount DECIMAL(20,2) DEFAULT 0,
  net_amount DECIMAL(20,2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, cancelled
  payment_date DATE,
  payment_reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shareholder_div_dist ON shareholder_dividends(distribution_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_div_shareholder ON shareholder_dividends(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_div_status ON shareholder_dividends(payment_status);

-- 5. Capital Transactions - معاملات رأس المال
CREATE TABLE IF NOT EXISTS capital_transactions (
  id SERIAL PRIMARY KEY,
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- increase, decrease, stock_split, reverse_split
  description TEXT NOT NULL,
  previous_capital DECIMAL(20,2) NOT NULL,
  new_capital DECIMAL(20,2) NOT NULL,
  change_amount DECIMAL(20,2) NOT NULL,
  previous_shares INTEGER NOT NULL,
  new_shares INTEGER NOT NULL,
  share_change INTEGER NOT NULL,
  price_per_share DECIMAL(15,4),
  effective_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, registered, rejected
  board_resolution_id INTEGER REFERENCES board_resolutions(id),
  regulatory_approval_number VARCHAR(100),
  regulatory_approval_date DATE,
  registration_number VARCHAR(100),
  registration_date DATE,
  notes TEXT,
  attachments JSONB,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capital_type ON capital_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_capital_status ON capital_transactions(status);
CREATE INDEX IF NOT EXISTS idx_capital_date ON capital_transactions(effective_date);

-- 6. Resolution Votes - أصوات القرارات (لصفحة التصويت الإلكتروني)
CREATE TABLE IF NOT EXISTS resolution_votes (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER NOT NULL REFERENCES board_resolutions(id),
  voter_type VARCHAR(50) NOT NULL, -- board_member, shareholder
  voter_id INTEGER,
  voter_name VARCHAR(255),
  vote VARCHAR(20) NOT NULL, -- for, against, abstain
  voting_weight INTEGER DEFAULT 1,
  comments TEXT,
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(50),
  signature_url VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_votes_resolution ON resolution_votes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON resolution_votes(voter_type, voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_vote ON resolution_votes(vote);

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
