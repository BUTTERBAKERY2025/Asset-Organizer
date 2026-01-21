-- =====================================================
-- مخطط الحوكمة الكامل - Complete Governance Schema
-- نظام إدارة باتر - Butter Bakery System
-- تاريخ الإنشاء: 2026-01-21
-- =====================================================

-- =====================================================
-- الجداول الأساسية للحوكمة
-- =====================================================

-- 1. أعضاء مجلس الإدارة - Board Members
CREATE TABLE IF NOT EXISTS board_members (
  id SERIAL PRIMARY KEY,
  member_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  full_name_en TEXT,
  national_id TEXT,
  position TEXT NOT NULL,
  member_type TEXT DEFAULT 'non_executive',
  is_independent BOOLEAN DEFAULT FALSE,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  date_of_birth DATE,
  qualifications TEXT,
  experience_summary TEXT,
  current_positions TEXT,
  previous_positions TEXT,
  appointment_date DATE NOT NULL,
  term_start_date DATE,
  term_end_date DATE,
  term_duration_years INTEGER DEFAULT 3,
  status TEXT DEFAULT 'active',
  photo_url TEXT,
  cv_url TEXT,
  signature_url TEXT,
  bio TEXT,
  notes TEXT,
  training_hours_completed INTEGER DEFAULT 0,
  next_evaluation_date DATE,
  evaluation_score NUMERIC(5, 2),
  attendance_rate NUMERIC(5, 2),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_members_status ON board_members(status);
CREATE INDEX IF NOT EXISTS idx_board_members_type ON board_members(member_type);
CREATE INDEX IF NOT EXISTS idx_board_members_position ON board_members(position);

-- 2. المساهمين - Shareholders
CREATE TABLE IF NOT EXISTS shareholders (
  id SERIAL PRIMARY KEY,
  shareholder_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  full_name_en TEXT,
  shareholder_type TEXT DEFAULT 'individual',
  national_id TEXT,
  commercial_registration TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  nationality TEXT,
  total_shares INTEGER NOT NULL DEFAULT 0,
  share_percentage NUMERIC(8, 4) DEFAULT 0,
  voting_power NUMERIC(8, 4) DEFAULT 0,
  share_class TEXT DEFAULT 'ordinary',
  acquisition_date DATE,
  bank_name TEXT,
  bank_account TEXT,
  iban TEXT,
  status TEXT DEFAULT 'active',
  is_board_member BOOLEAN DEFAULT FALSE,
  board_member_id INTEGER REFERENCES board_members(id),
  shareholder_category TEXT DEFAULT 'individual',
  is_major_shareholder BOOLEAN DEFAULT FALSE,
  total_dividends_received NUMERIC(15, 2) DEFAULT 0,
  pending_dividends NUMERIC(15, 2) DEFAULT 0,
  voting_restrictions TEXT,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shareholders_type ON shareholders(shareholder_type);
CREATE INDEX IF NOT EXISTS idx_shareholders_status ON shareholders(status);
CREATE INDEX IF NOT EXISTS idx_shareholders_category ON shareholders(shareholder_category);

-- 3. اجتماعات الحوكمة - Governance Meetings
CREATE TABLE IF NOT EXISTS governance_meetings (
  id SERIAL PRIMARY KEY,
  meeting_number TEXT NOT NULL UNIQUE,
  meeting_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  location_type TEXT DEFAULT 'in_person',
  virtual_meeting_link TEXT,
  virtual_meeting_password TEXT,
  agenda TEXT,
  agenda_items JSONB,
  fiscal_year TEXT,
  quorum_required NUMERIC(5, 2) DEFAULT 50,
  quorum_achieved BOOLEAN DEFAULT FALSE,
  total_members_invited INTEGER DEFAULT 0,
  total_members_present INTEGER DEFAULT 0,
  total_shares_represented INTEGER DEFAULT 0,
  total_voting_power NUMERIC(15, 4) DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  minutes_draft TEXT,
  minutes_approved BOOLEAN DEFAULT FALSE,
  minutes_approved_date DATE,
  minutes_file_url TEXT,
  attachments JSONB,
  documents_attached JSONB,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_date TIMESTAMP,
  reminder_sent BOOLEAN DEFAULT FALSE,
  electronic_voting_enabled BOOLEAN DEFAULT TRUE,
  pre_voting_enabled BOOLEAN DEFAULT FALSE,
  pre_voting_start TIMESTAMP,
  pre_voting_end TIMESTAMP,
  proxy_deadline TIMESTAMP,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_meetings_type ON governance_meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_governance_meetings_status ON governance_meetings(status);
CREATE INDEX IF NOT EXISTS idx_governance_meetings_date ON governance_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_governance_meetings_year ON governance_meetings(fiscal_year);

-- 4. حضور الاجتماعات - Meeting Attendance
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES board_members(id),
  shareholder_id INTEGER REFERENCES shareholders(id),
  attendee_type TEXT NOT NULL,
  attendee_name TEXT NOT NULL,
  attendance_status TEXT DEFAULT 'invited',
  attendance_method TEXT DEFAULT 'in_person',
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  represented_by TEXT,
  proxy_document_url TEXT,
  voting_power NUMERIC(8, 4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting ON meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_member ON meeting_attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_status ON meeting_attendance(attendance_status);

-- 5. قرارات مجلس الإدارة - Board Resolutions
CREATE TABLE IF NOT EXISTS board_resolutions (
  id SERIAL PRIMARY KEY,
  resolution_number TEXT NOT NULL UNIQUE,
  resolution_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  meeting_id INTEGER REFERENCES governance_meetings(id),
  proposed_by INTEGER REFERENCES board_members(id),
  seconded_by INTEGER REFERENCES board_members(id),
  fiscal_year TEXT,
  status TEXT DEFAULT 'draft',
  voting_method TEXT DEFAULT 'show_of_hands',
  required_majority NUMERIC(5, 2) DEFAULT 50,
  total_votes INTEGER DEFAULT 0,
  for_votes INTEGER DEFAULT 0,
  against_votes INTEGER DEFAULT 0,
  abstain_votes INTEGER DEFAULT 0,
  weighted_for_votes NUMERIC(15, 4) DEFAULT 0,
  weighted_against_votes NUMERIC(15, 4) DEFAULT 0,
  weighted_abstain_votes NUMERIC(15, 4) DEFAULT 0,
  weighted_total_votes NUMERIC(15, 4) DEFAULT 0,
  quorum_calculation_id INTEGER,
  requires_special_majority BOOLEAN DEFAULT FALSE,
  electronic_voting_enabled BOOLEAN DEFAULT TRUE,
  pre_voting_enabled BOOLEAN DEFAULT FALSE,
  pre_voting_deadline TIMESTAMP,
  voting_start_time TIMESTAMP,
  voting_end_time TIMESTAMP,
  result TEXT,
  implementation_deadline TEXT,
  implemented_date DATE,
  implementation_status TEXT,
  implementation_notes TEXT,
  responsible_person TEXT,
  related_resolutions INTEGER[],
  attachments JSONB,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_resolutions_type ON board_resolutions(resolution_type);
CREATE INDEX IF NOT EXISTS idx_board_resolutions_status ON board_resolutions(status);
CREATE INDEX IF NOT EXISTS idx_board_resolutions_meeting ON board_resolutions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_board_resolutions_year ON board_resolutions(fiscal_year);

-- 6. تصويت القرارات - Resolution Votes
CREATE TABLE IF NOT EXISTS resolution_votes (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER NOT NULL REFERENCES board_resolutions(id) ON DELETE CASCADE,
  voter_type TEXT NOT NULL,
  board_member_id INTEGER REFERENCES board_members(id),
  shareholder_id INTEGER REFERENCES shareholders(id),
  voter_name TEXT NOT NULL,
  vote TEXT NOT NULL,
  voting_power NUMERIC(8, 4) DEFAULT 1,
  shares_voted INTEGER,
  vote_time TIMESTAMP DEFAULT NOW(),
  vote_method TEXT DEFAULT 'electronic',
  proxy_vote_id INTEGER,
  verification_code TEXT,
  is_pre_vote BOOLEAN DEFAULT FALSE,
  two_factor_verified BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  device_info TEXT,
  signature_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_resolution ON resolution_votes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_resolution_votes_voter_type ON resolution_votes(voter_type);
CREATE INDEX IF NOT EXISTS idx_resolution_votes_vote ON resolution_votes(vote);

-- 7. متطلبات الامتثال - Compliance Requirements
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id SERIAL PRIMARY KEY,
  requirement_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  requirement_type TEXT NOT NULL,
  regulatory_body TEXT NOT NULL,
  frequency TEXT DEFAULT 'annual',
  document_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'valid',
  renewal_reminder_days INTEGER DEFAULT 30,
  responsible_person TEXT,
  responsible_department TEXT,
  compliance_officer TEXT,
  last_compliance_date DATE,
  next_compliance_date DATE,
  compliance_cost NUMERIC(12, 2),
  penalty_amount NUMERIC(12, 2),
  attachments JSONB,
  checklist JSONB,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_type ON compliance_requirements(requirement_type);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_body ON compliance_requirements(regulatory_body);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_status ON compliance_requirements(status);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_expiry ON compliance_requirements(expiry_date);

-- =====================================================
-- الجداول المتقدمة للحوكمة
-- =====================================================

-- 8. لجان مجلس الإدارة - Board Committees
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

-- 9. عضوية اللجان - Committee Memberships
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

-- 10. سجل المصالح والإفصاحات الشخصية - Interest Declarations
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

-- 11. شهادات التدريب والتأهيل - Board Member Training
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

-- 12. التصويت بالوكالة - Proxy Votes
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

-- 13. سجل تدقيق التصويت - Voting Audit Log
CREATE TABLE IF NOT EXISTS voting_audit_log (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER REFERENCES board_resolutions(id) ON DELETE CASCADE,
  meeting_id INTEGER REFERENCES governance_meetings(id),
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id VARCHAR(255),
  actor_name TEXT,
  vote_id INTEGER REFERENCES resolution_votes(id),
  proxy_id INTEGER REFERENCES proxy_votes(id),
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

-- 14. حساب النصاب - Quorum Calculations
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

-- 15. سجل تحويلات الأسهم - Share Transfers
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

-- 16. توزيعات الأرباح - Dividends
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

-- 17. استحقاقات المساهمين - Shareholder Entitlements
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
  DROP CONSTRAINT IF EXISTS board_resolutions_quorum_calculation_id_fkey;
ALTER TABLE board_resolutions 
  ADD CONSTRAINT board_resolutions_quorum_calculation_id_fkey 
  FOREIGN KEY (quorum_calculation_id) REFERENCES quorum_calculations(id);

-- =====================================================
-- إنشاء التسلسلات للأرقام التلقائية
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS board_member_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS shareholder_number_seq START WITH 2001;
CREATE SEQUENCE IF NOT EXISTS meeting_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS resolution_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS compliance_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS declaration_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS proxy_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS transfer_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS dividend_number_seq START WITH 1;

-- =====================================================
-- ملاحظات التنفيذ
-- =====================================================
-- 1. تأكد من وجود جدول users قبل تنفيذ هذا الملف
-- 2. يجب تنفيذ الجداول بالترتيب المذكور
-- 3. جميع الجداول تستخدم IF NOT EXISTS لتجنب الأخطاء
-- 4. الفهارس تم إنشاؤها لتحسين أداء الاستعلامات
-- =====================================================
