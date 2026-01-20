-- Migration: 009_governance_tables.sql
-- Description: نظام الحوكمة ومجلس الإدارة - Corporate Governance System
-- Date: 2026-01-20

-- أعضاء مجلس الإدارة - Board Members
CREATE TABLE IF NOT EXISTS board_members (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  full_name TEXT NOT NULL,
  national_id TEXT,
  email TEXT,
  phone TEXT,
  position TEXT NOT NULL,
  member_type TEXT DEFAULT 'executive',
  nationality TEXT,
  date_of_birth DATE,
  qualifications TEXT,
  experience TEXT,
  current_employer TEXT,
  other_board_memberships TEXT,
  appointment_date DATE NOT NULL,
  term_end_date DATE,
  term_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  resignation_date DATE,
  resignation_reason TEXT,
  photo_url TEXT,
  signature_url TEXT,
  committees TEXT[],
  voting_power NUMERIC(5, 2) DEFAULT 1.00,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_members_status ON board_members(status);
CREATE INDEX IF NOT EXISTS idx_board_members_position ON board_members(position);
CREATE INDEX IF NOT EXISTS idx_board_members_type ON board_members(member_type);

-- المساهمون - Shareholders
CREATE TABLE IF NOT EXISTS shareholders (
  id SERIAL PRIMARY KEY,
  shareholder_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
  national_id TEXT,
  commercial_register TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  nationality TEXT,
  number_of_shares INTEGER NOT NULL,
  share_percentage NUMERIC(8, 4) NOT NULL,
  share_class TEXT DEFAULT 'common',
  acquisition_date DATE NOT NULL,
  acquisition_price NUMERIC(12, 2),
  certificate_number TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  iban TEXT,
  is_board_member BOOLEAN DEFAULT FALSE,
  board_member_id INTEGER REFERENCES board_members(id),
  voting_rights BOOLEAN DEFAULT TRUE,
  dividend_rights BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shareholders_type ON shareholders(shareholder_type);
CREATE INDEX IF NOT EXISTS idx_shareholders_status ON shareholders(status);
CREATE INDEX IF NOT EXISTS idx_shareholders_percentage ON shareholders(share_percentage);

-- تحويلات الأسهم - Share Transfers
CREATE TABLE IF NOT EXISTS share_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  from_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  to_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  number_of_shares INTEGER NOT NULL,
  price_per_share NUMERIC(12, 2) NOT NULL,
  total_value NUMERIC(15, 2) NOT NULL,
  transfer_date DATE NOT NULL,
  transfer_type TEXT NOT NULL,
  approval_status TEXT DEFAULT 'pending',
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  board_resolution_id INTEGER,
  certificate_old_number TEXT,
  certificate_new_number TEXT,
  attachment_url TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_transfers_from ON share_transfers(from_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_to ON share_transfers(to_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_status ON share_transfers(approval_status);
CREATE INDEX IF NOT EXISTS idx_share_transfers_date ON share_transfers(transfer_date);

-- اجتماعات مجلس الإدارة والجمعية العمومية - Board & Assembly Meetings
CREATE TABLE IF NOT EXISTS governance_meetings (
  id SERIAL PRIMARY KEY,
  meeting_number TEXT NOT NULL UNIQUE,
  meeting_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMP NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  location_type TEXT DEFAULT 'in_person',
  virtual_meeting_link TEXT,
  agenda TEXT,
  agenda_items JSONB,
  quorum_required NUMERIC(5, 2) DEFAULT 50.00,
  quorum_achieved BOOLEAN,
  attendance_count INTEGER DEFAULT 0,
  total_eligible_votes INTEGER,
  status TEXT DEFAULT 'scheduled',
  postponed_to TIMESTAMP,
  cancellation_reason TEXT,
  invitation_sent_at TIMESTAMP,
  reminder_sent_at TIMESTAMP,
  minutes_status TEXT DEFAULT 'pending',
  minutes_approved_at TIMESTAMP,
  minutes_approved_by VARCHAR REFERENCES users(id),
  fiscal_year TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_meetings_type ON governance_meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_governance_meetings_status ON governance_meetings(status);
CREATE INDEX IF NOT EXISTS idx_governance_meetings_date ON governance_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_governance_meetings_fiscal_year ON governance_meetings(fiscal_year);

-- سجل حضور الاجتماعات - Meeting Attendance
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  attendee_type TEXT NOT NULL,
  board_member_id INTEGER REFERENCES board_members(id),
  shareholder_id INTEGER REFERENCES shareholders(id),
  attendee_name TEXT NOT NULL,
  attendee_role TEXT,
  represented_shares INTEGER,
  voting_power NUMERIC(8, 4),
  attendance_status TEXT DEFAULT 'expected',
  arrival_time TIMESTAMP,
  departure_time TIMESTAMP,
  attendance_method TEXT DEFAULT 'in_person',
  proxy_holder_name TEXT,
  proxy_document_url TEXT,
  signature_url TEXT,
  signed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting ON meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_board_member ON meeting_attendance(board_member_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_shareholder ON meeting_attendance(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_status ON meeting_attendance(attendance_status);

-- محاضر الاجتماعات - Meeting Minutes
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  minutes_number TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  summary TEXT,
  attendance_list JSONB,
  discussion_points JSONB,
  decisions JSONB,
  voting_results JSONB,
  next_meeting_date TIMESTAMP,
  attachments JSONB,
  status TEXT DEFAULT 'draft',
  prepared_by VARCHAR REFERENCES users(id),
  prepared_at TIMESTAMP,
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  signed_by JSONB,
  archived_at TIMESTAMP,
  archive_reference TEXT,
  pdf_url TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting ON meeting_minutes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_status ON meeting_minutes(status);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_number ON meeting_minutes(minutes_number);

-- قرارات مجلس الإدارة - Board Resolutions
CREATE TABLE IF NOT EXISTS board_resolutions (
  id SERIAL PRIMARY KEY,
  resolution_number TEXT NOT NULL UNIQUE,
  meeting_id INTEGER REFERENCES governance_meetings(id),
  resolution_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  priority TEXT DEFAULT 'normal',
  proposed_by VARCHAR REFERENCES users(id),
  proposed_at TIMESTAMP NOT NULL,
  voting_required BOOLEAN DEFAULT TRUE,
  voting_deadline TIMESTAMP,
  for_votes INTEGER DEFAULT 0,
  against_votes INTEGER DEFAULT 0,
  abstain_votes INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  required_majority NUMERIC(5, 2) DEFAULT 50.00,
  status TEXT DEFAULT 'draft',
  approved_at TIMESTAMP,
  implementation_deadline DATE,
  implementation_status TEXT DEFAULT 'pending',
  implemented_at TIMESTAMP,
  responsible_person VARCHAR REFERENCES users(id),
  financial_impact NUMERIC(15, 2),
  attachments JSONB,
  related_resolutions INTEGER[],
  expiry_date DATE,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_resolutions_meeting ON board_resolutions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_board_resolutions_type ON board_resolutions(resolution_type);
CREATE INDEX IF NOT EXISTS idx_board_resolutions_status ON board_resolutions(status);
CREATE INDEX IF NOT EXISTS idx_board_resolutions_category ON board_resolutions(category);
CREATE INDEX IF NOT EXISTS idx_board_resolutions_implementation ON board_resolutions(implementation_status);

-- التصويت على القرارات - Resolution Votes
CREATE TABLE IF NOT EXISTS resolution_votes (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER NOT NULL REFERENCES board_resolutions(id) ON DELETE CASCADE,
  voter_type TEXT NOT NULL,
  board_member_id INTEGER REFERENCES board_members(id),
  shareholder_id INTEGER REFERENCES shareholders(id),
  voter_name TEXT NOT NULL,
  vote TEXT NOT NULL,
  voting_power NUMERIC(8, 4) DEFAULT 1.00,
  weighted_vote NUMERIC(8, 4),
  voted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  vote_method TEXT DEFAULT 'in_meeting',
  ip_address TEXT,
  device_info TEXT,
  signature_url TEXT,
  comments TEXT,
  is_valid BOOLEAN DEFAULT TRUE,
  invalidation_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_resolution ON resolution_votes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_resolution_votes_board_member ON resolution_votes(board_member_id);
CREATE INDEX IF NOT EXISTS idx_resolution_votes_shareholder ON resolution_votes(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_resolution_votes_vote ON resolution_votes(vote);

-- رأس المال والأسهم - Capital Transactions
CREATE TABLE IF NOT EXISTS capital_transactions (
  id SERIAL PRIMARY KEY,
  transaction_number TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL,
  description TEXT NOT NULL,
  previous_capital NUMERIC(15, 2) NOT NULL,
  new_capital NUMERIC(15, 2) NOT NULL,
  change_amount NUMERIC(15, 2) NOT NULL,
  previous_shares INTEGER NOT NULL,
  new_shares INTEGER NOT NULL,
  share_change INTEGER NOT NULL,
  price_per_share NUMERIC(12, 2),
  effective_date DATE NOT NULL,
  board_resolution_id INTEGER REFERENCES board_resolutions(id),
  assembly_approval_required BOOLEAN DEFAULT TRUE,
  assembly_meeting_id INTEGER REFERENCES governance_meetings(id),
  regulatory_approval_date DATE,
  regulatory_approval_number TEXT,
  registration_date DATE,
  status TEXT DEFAULT 'pending',
  attachments JSONB,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capital_transactions_type ON capital_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_capital_transactions_status ON capital_transactions(status);
CREATE INDEX IF NOT EXISTS idx_capital_transactions_date ON capital_transactions(effective_date);

-- توزيعات الأرباح - Dividend Distributions
CREATE TABLE IF NOT EXISTS dividend_distributions (
  id SERIAL PRIMARY KEY,
  distribution_number TEXT NOT NULL UNIQUE,
  fiscal_year TEXT NOT NULL,
  distribution_type TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC(15, 2) NOT NULL,
  amount_per_share NUMERIC(12, 4) NOT NULL,
  eligible_shares INTEGER NOT NULL,
  record_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  board_resolution_id INTEGER REFERENCES board_resolutions(id),
  assembly_meeting_id INTEGER REFERENCES governance_meetings(id),
  status TEXT DEFAULT 'announced',
  paid_amount NUMERIC(15, 2) DEFAULT 0,
  withholding_tax_rate NUMERIC(5, 2) DEFAULT 0,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dividend_distributions_year ON dividend_distributions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dividend_distributions_status ON dividend_distributions(status);
CREATE INDEX IF NOT EXISTS idx_dividend_distributions_payment_date ON dividend_distributions(payment_date);

-- مدفوعات الأرباح للمساهمين - Shareholder Dividends
CREATE TABLE IF NOT EXISTS shareholder_dividends (
  id SERIAL PRIMARY KEY,
  distribution_id INTEGER NOT NULL REFERENCES dividend_distributions(id) ON DELETE CASCADE,
  shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  shares_held INTEGER NOT NULL,
  gross_amount NUMERIC(12, 2) NOT NULL,
  withholding_tax NUMERIC(12, 2) DEFAULT 0,
  net_amount NUMERIC(12, 2) NOT NULL,
  payment_method TEXT DEFAULT 'bank_transfer',
  payment_reference TEXT,
  payment_date DATE,
  status TEXT DEFAULT 'pending',
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_distribution ON shareholder_dividends(distribution_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_shareholder ON shareholder_dividends(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_status ON shareholder_dividends(status);

-- الإفصاحات والتقارير النظامية - Disclosures
CREATE TABLE IF NOT EXISTS disclosures (
  id SERIAL PRIMARY KEY,
  disclosure_number TEXT NOT NULL UNIQUE,
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
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  is_confidential BOOLEAN DEFAULT FALSE,
  publish_url TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disclosures_type ON disclosures(disclosure_type);
CREATE INDEX IF NOT EXISTS idx_disclosures_status ON disclosures(status);
CREATE INDEX IF NOT EXISTS idx_disclosures_fiscal_year ON disclosures(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_disclosures_due_date ON disclosures(due_date);
CREATE INDEX IF NOT EXISTS idx_disclosures_category ON disclosures(category);

-- الامتثال والمتطلبات النظامية - Compliance Requirements
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id SERIAL PRIMARY KEY,
  requirement_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  regulatory_body TEXT NOT NULL,
  applicable_law TEXT,
  frequency TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT TRUE,
  current_status TEXT DEFAULT 'pending',
  valid_from DATE,
  valid_until DATE,
  last_renewal_date DATE,
  next_due_date DATE,
  reminder_days INTEGER DEFAULT 30,
  document_number TEXT,
  document_url TEXT,
  cost NUMERIC(12, 2),
  responsible_person VARCHAR REFERENCES users(id),
  priority TEXT DEFAULT 'normal',
  penalty_for_non_compliance TEXT,
  notes TEXT,
  attachments JSONB,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_category ON compliance_requirements(category);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_status ON compliance_requirements(current_status);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_due_date ON compliance_requirements(next_due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_frequency ON compliance_requirements(frequency);

-- سجل الامتثال والتجديدات - Compliance History
CREATE TABLE IF NOT EXISTS compliance_history (
  id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  action_date TIMESTAMP NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  document_number TEXT,
  document_url TEXT,
  valid_from DATE,
  valid_until DATE,
  cost NUMERIC(12, 2),
  penalty_amount NUMERIC(12, 2),
  notes TEXT,
  performed_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_history_requirement ON compliance_history(requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_history_action ON compliance_history(action);
CREATE INDEX IF NOT EXISTS idx_compliance_history_date ON compliance_history(action_date);
