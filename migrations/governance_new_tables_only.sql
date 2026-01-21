-- =====================================================
-- الجداول الجديدة فقط + تحديثات الجداول الموجودة
-- يُستخدم عندما تكون الجداول الأساسية موجودة مسبقاً
-- =====================================================

-- =====================================================
-- الجزء الأول: إضافة الأعمدة الجديدة للجداول الموجودة
-- =====================================================

-- تحديث جدول أعضاء المجلس
ALTER TABLE board_members 
  ADD COLUMN IF NOT EXISTS training_hours_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_evaluation_date DATE,
  ADD COLUMN IF NOT EXISTS evaluation_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS attendance_rate NUMERIC(5, 2);

-- تحديث جدول المساهمين
ALTER TABLE shareholders
  ADD COLUMN IF NOT EXISTS shareholder_category TEXT DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS is_major_shareholder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_dividends_received NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_dividends NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voting_restrictions TEXT;

-- تحديث جدول القرارات
ALTER TABLE board_resolutions
  ADD COLUMN IF NOT EXISTS weighted_for_votes NUMERIC(15, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weighted_against_votes NUMERIC(15, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weighted_abstain_votes NUMERIC(15, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weighted_total_votes NUMERIC(15, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_special_majority BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS electronic_voting_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pre_voting_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_voting_deadline TIMESTAMP;

-- تحديث جدول التصويت
ALTER TABLE resolution_votes
  ADD COLUMN IF NOT EXISTS verification_code TEXT,
  ADD COLUMN IF NOT EXISTS is_pre_vote BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_factor_verified BOOLEAN DEFAULT FALSE;

-- تحديث جدول الاجتماعات
ALTER TABLE governance_meetings
  ADD COLUMN IF NOT EXISTS electronic_voting_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pre_voting_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_voting_start TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pre_voting_end TIMESTAMP,
  ADD COLUMN IF NOT EXISTS proxy_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS total_shares_represented INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_voting_power NUMERIC(15, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_attached JSONB;

-- =====================================================
-- الجزء الثاني: الجداول الجديدة
-- =====================================================

-- 1. لجان مجلس الإدارة - Board Committees
CREATE TABLE IF NOT EXISTS board_committees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  committee_type TEXT NOT NULL,
  chairman_id INTEGER REFERENCES board_members(id),
  secretary_id INTEGER REFERENCES board_members(id),
  formation_date DATE NOT NULL,
  term_end_date DATE,
  mandate_document TEXT,
  meeting_frequency TEXT DEFAULT 'quarterly',
  quorum_required INTEGER DEFAULT 2,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_committees_type ON board_committees(committee_type);
CREATE INDEX IF NOT EXISTS idx_board_committees_status ON board_committees(status);

-- 2. عضوية اللجان - Committee Memberships
CREATE TABLE IF NOT EXISTS committee_memberships (
  id SERIAL PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES board_committees(id) ON DELETE CASCADE,
  board_member_id INTEGER NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  appointment_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_committee_memberships_committee ON committee_memberships(committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_memberships_member ON committee_memberships(board_member_id);
CREATE INDEX IF NOT EXISTS idx_committee_memberships_status ON committee_memberships(status);

-- 3. سجل المصالح والإفصاحات الشخصية - Interest Declarations
CREATE TABLE IF NOT EXISTS interest_declarations (
  id SERIAL PRIMARY KEY,
  declaration_number TEXT NOT NULL UNIQUE,
  board_member_id INTEGER NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  declaration_type TEXT NOT NULL,
  declaration_date DATE NOT NULL,
  fiscal_year TEXT,
  related_party_name TEXT,
  relationship_type TEXT,
  description TEXT NOT NULL,
  transaction_type TEXT,
  transaction_value NUMERIC(15, 2),
  action_taken TEXT,
  board_decision TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  attachments JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interest_declarations_member ON interest_declarations(board_member_id);
CREATE INDEX IF NOT EXISTS idx_interest_declarations_type ON interest_declarations(declaration_type);
CREATE INDEX IF NOT EXISTS idx_interest_declarations_status ON interest_declarations(status);
CREATE INDEX IF NOT EXISTS idx_interest_declarations_year ON interest_declarations(fiscal_year);

-- 4. شهادات التدريب والتأهيل - Board Member Training
CREATE TABLE IF NOT EXISTS board_member_training (
  id SERIAL PRIMARY KEY,
  board_member_id INTEGER NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  training_type TEXT NOT NULL,
  title TEXT NOT NULL,
  provider TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  duration INTEGER,
  certificate_number TEXT,
  certificate_url TEXT,
  expiry_date DATE,
  status TEXT DEFAULT 'completed',
  score NUMERIC(5, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_member_training_member ON board_member_training(board_member_id);
CREATE INDEX IF NOT EXISTS idx_board_member_training_type ON board_member_training(training_type);
CREATE INDEX IF NOT EXISTS idx_board_member_training_status ON board_member_training(status);

-- 5. التصويت بالوكالة - Proxy Votes
CREATE TABLE IF NOT EXISTS proxy_votes (
  id SERIAL PRIMARY KEY,
  proxy_number TEXT NOT NULL UNIQUE,
  meeting_id INTEGER NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  principal_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  proxy_holder_shareholder_id INTEGER REFERENCES shareholders(id),
  proxy_holder_name TEXT NOT NULL,
  proxy_holder_national_id TEXT,
  shares_represented INTEGER NOT NULL,
  voting_power NUMERIC(8, 4) NOT NULL,
  proxy_type TEXT NOT NULL,
  voting_instructions JSONB,
  document_url TEXT,
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending',
  verified_by VARCHAR(255),
  verified_at TIMESTAMP,
  used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revocation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proxy_votes_meeting ON proxy_votes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_proxy_votes_principal ON proxy_votes(principal_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_proxy_votes_holder ON proxy_votes(proxy_holder_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_proxy_votes_status ON proxy_votes(status);

-- 6. سجل تدقيق التصويت - Voting Audit Log
CREATE TABLE IF NOT EXISTS voting_audit_log (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER REFERENCES board_resolutions(id) ON DELETE CASCADE,
  meeting_id INTEGER REFERENCES governance_meetings(id),
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id VARCHAR(255),
  actor_name TEXT,
  vote_id INTEGER REFERENCES resolution_votes(id),
  previous_value TEXT,
  new_value TEXT,
  voting_power NUMERIC(8, 4),
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  session_id TEXT,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  validation_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_voting_audit_resolution ON voting_audit_log(resolution_id);
CREATE INDEX IF NOT EXISTS idx_voting_audit_meeting ON voting_audit_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_voting_audit_action ON voting_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_voting_audit_actor ON voting_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_voting_audit_timestamp ON voting_audit_log(timestamp);

-- 7. حساب النصاب - Quorum Calculations
CREATE TABLE IF NOT EXISTS quorum_calculations (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  calculation_type TEXT NOT NULL,
  resolution_id INTEGER REFERENCES board_resolutions(id),
  calculated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  total_eligible_shares INTEGER NOT NULL,
  total_eligible_votes INTEGER NOT NULL,
  present_shares INTEGER NOT NULL,
  present_votes INTEGER NOT NULL,
  proxy_shares INTEGER DEFAULT 0,
  proxy_votes INTEGER DEFAULT 0,
  total_represented_shares INTEGER NOT NULL,
  total_represented_votes INTEGER NOT NULL,
  percentage_represented NUMERIC(8, 4) NOT NULL,
  required_quorum NUMERIC(5, 2) NOT NULL,
  quorum_met BOOLEAN NOT NULL,
  notes TEXT,
  calculated_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_quorum_calculations_meeting ON quorum_calculations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_quorum_calculations_resolution ON quorum_calculations(resolution_id);
CREATE INDEX IF NOT EXISTS idx_quorum_calculations_type ON quorum_calculations(calculation_type);

-- 8. سجل تحويلات الأسهم - Share Transfers
CREATE TABLE IF NOT EXISTS share_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  from_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  to_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  shares_transferred INTEGER NOT NULL,
  transfer_date DATE NOT NULL,
  transfer_price NUMERIC(15, 2),
  total_value NUMERIC(15, 2),
  transfer_type TEXT DEFAULT 'sale',
  approval_status TEXT DEFAULT 'pending',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_transfers_from ON share_transfers(from_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_to ON share_transfers(to_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_date ON share_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_share_transfers_status ON share_transfers(approval_status);

-- 9. توزيعات الأرباح - Dividends
CREATE TABLE IF NOT EXISTS dividends (
  id SERIAL PRIMARY KEY,
  dividend_number TEXT NOT NULL UNIQUE,
  fiscal_year TEXT NOT NULL,
  declaration_date DATE NOT NULL,
  record_date DATE NOT NULL,
  payment_date DATE,
  dividend_per_share NUMERIC(10, 4) NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL,
  dividend_type TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'declared',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dividends_year ON dividends(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dividends_status ON dividends(status);

-- 10. استحقاقات المساهمين - Shareholder Entitlements
CREATE TABLE IF NOT EXISTS shareholder_entitlements (
  id SERIAL PRIMARY KEY,
  dividend_id INTEGER NOT NULL REFERENCES dividends(id) ON DELETE CASCADE,
  shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  shares_held INTEGER NOT NULL,
  amount_entitled NUMERIC(15, 2) NOT NULL,
  amount_paid NUMERIC(15, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shareholder_entitlements_dividend ON shareholder_entitlements(dividend_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_entitlements_shareholder ON shareholder_entitlements(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_entitlements_status ON shareholder_entitlements(payment_status);

-- =====================================================
-- إضافة القيد المرجعي لجدول القرارات
-- =====================================================
ALTER TABLE board_resolutions 
  ADD COLUMN IF NOT EXISTS quorum_calculation_id INTEGER;

-- =====================================================
-- ملاحظات: هذا الملف يفترض أن الجداول التالية موجودة مسبقاً:
-- board_members, shareholders, governance_meetings, 
-- board_resolutions, resolution_votes, compliance_requirements
-- =====================================================
