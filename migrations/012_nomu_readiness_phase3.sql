-- ============================================================================
-- Phase 3 — Nomu Readiness (CMA / Tadawul)
-- 5 Modules: Audit Committee | Prospectus | Investor Relations | Material
-- Disclosures | Internal Audit
-- Run manually in Supabase SQL Editor BEFORE deploying code to Render.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) AUDIT COMMITTEE (لجنة المراجعة)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_committees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  charter TEXT,
  charter_doc_url TEXT,
  formation_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_committees_status ON audit_committees(status);

CREATE TABLE IF NOT EXISTS audit_committee_members (
  id SERIAL PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES audit_committees(id) ON DELETE CASCADE,
  board_member_id INTEGER REFERENCES board_members(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- chair | member | secretary
  is_independent BOOLEAN NOT NULL DEFAULT false,
  is_financial_expert BOOLEAN NOT NULL DEFAULT false,
  appointment_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_committee_members_committee ON audit_committee_members(committee_id);
CREATE INDEX IF NOT EXISTS idx_audit_committee_members_status ON audit_committee_members(status);

CREATE TABLE IF NOT EXISTS audit_committee_reports (
  id SERIAL PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES audit_committees(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- quarterly | annual | special
  fiscal_year TEXT NOT NULL,
  period TEXT NOT NULL, -- Q1 | Q2 | Q3 | Q4 | FY
  title TEXT NOT NULL,
  summary TEXT,
  findings JSONB,
  recommendations TEXT,
  attachments JSONB,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | published
  submitted_at TIMESTAMP,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP,
  locked_by VARCHAR REFERENCES users(id),
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_committee_reports_committee ON audit_committee_reports(committee_id);
CREATE INDEX IF NOT EXISTS idx_audit_committee_reports_year ON audit_committee_reports(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_audit_committee_reports_status ON audit_committee_reports(status);

-- ----------------------------------------------------------------------------
-- 2) PROSPECTUS (نشرة الإصدار)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospectuses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  issue_type TEXT NOT NULL DEFAULT 'ipo', -- ipo | rights_issue | capital_increase
  target_market TEXT NOT NULL DEFAULT 'nomu', -- nomu | main
  version TEXT NOT NULL DEFAULT 'v1.0',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | under_review | approved | published
  offering_size NUMERIC(20,2),
  share_price NUMERIC(12,4),
  total_shares BIGINT,
  offering_start_date DATE,
  offering_end_date DATE,
  lead_manager TEXT,
  legal_advisor TEXT,
  auditor TEXT,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  published_at TIMESTAMP,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospectuses_status ON prospectuses(status);
CREATE INDEX IF NOT EXISTS idx_prospectuses_market ON prospectuses(target_market);

CREATE TABLE IF NOT EXISTS prospectus_sections (
  id SERIAL PRIMARY KEY,
  prospectus_id INTEGER NOT NULL REFERENCES prospectuses(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL, -- executive_summary | company_overview | business_description | risk_factors | financial_statements | use_of_proceeds | management | major_shareholders | dividend_policy | legal_matters | subscription_terms | underwriting | tax_considerations | additional_info
  title TEXT NOT NULL,
  content TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  required_by_cma BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | drafted | reviewed | approved
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospectus_sections_prospectus ON prospectus_sections(prospectus_id);
CREATE INDEX IF NOT EXISTS idx_prospectus_sections_status ON prospectus_sections(status);

-- ----------------------------------------------------------------------------
-- 3) INVESTOR RELATIONS (العلاقات مع المساهمين)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ir_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL, -- earnings_call | agm | egm | roadshow | investor_day | conference | dividend_payment
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TEXT,
  end_date DATE,
  location TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  meeting_link TEXT,
  registration_link TEXT,
  fiscal_year TEXT,
  fiscal_quarter TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled | postponed
  attendees_expected INTEGER,
  attendees_actual INTEGER,
  materials JSONB,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ir_events_date ON ir_events(event_date);
CREATE INDEX IF NOT EXISTS idx_ir_events_status ON ir_events(status);
CREATE INDEX IF NOT EXISTS idx_ir_events_type ON ir_events(event_type);

CREATE TABLE IF NOT EXISTS ir_contacts (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  institution TEXT,
  institution_type TEXT, -- analyst | fund | bank | individual | media | regulator
  position TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  city TEXT,
  language_preference TEXT DEFAULT 'ar',
  subscribed_channels JSONB, -- ["email","whatsapp","sms"]
  last_contacted_at TIMESTAMP,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ir_contacts_institution_type ON ir_contacts(institution_type);
CREATE INDEX IF NOT EXISTS idx_ir_contacts_status ON ir_contacts(status);

-- ----------------------------------------------------------------------------
-- 4) MATERIAL DISCLOSURES (الإفصاحات الجوهرية - Tadawul-ready)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_disclosures (
  id SERIAL PRIMARY KEY,
  disclosure_number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- financial_results | dividend | capital_change | board_change | acquisition | litigation | material_contract | regulatory_action | major_loss | other
  severity TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  title_ar TEXT NOT NULL,
  title_en TEXT,
  content_ar TEXT NOT NULL,
  content_en TEXT,
  event_date DATE NOT NULL,
  discovery_date DATE,
  requires_immediate_disclosure BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | under_review | approved | submitted | published | rejected
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  published_to_tadawul BOOLEAN NOT NULL DEFAULT false,
  tadawul_reference TEXT,
  tadawul_published_at TIMESTAMP,
  publication_channels JSONB, -- ["tadawul","website","email","whatsapp","sms"]
  attachments JSONB,
  regulatory_reference TEXT,
  related_disclosure_id INTEGER,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP,
  locked_by VARCHAR REFERENCES users(id),
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_disclosures_status ON material_disclosures(status);
CREATE INDEX IF NOT EXISTS idx_material_disclosures_category ON material_disclosures(category);
CREATE INDEX IF NOT EXISTS idx_material_disclosures_severity ON material_disclosures(severity);
CREATE INDEX IF NOT EXISTS idx_material_disclosures_event_date ON material_disclosures(event_date);

-- ----------------------------------------------------------------------------
-- 5) INTERNAL AUDIT (التدقيق الداخلي)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_audit_plans (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  scope TEXT,
  objectives TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | in_progress | completed
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  total_engagements INTEGER NOT NULL DEFAULT 0,
  completed_engagements INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_internal_audit_plans_year ON internal_audit_plans(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_internal_audit_plans_status ON internal_audit_plans(status);

CREATE TABLE IF NOT EXISTS internal_audit_engagements (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES internal_audit_plans(id) ON DELETE SET NULL,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  area TEXT NOT NULL, -- finance | hr | operations | it | procurement | branches | compliance | other
  branch_id INTEGER,
  scope TEXT,
  objectives TEXT,
  lead_auditor TEXT,
  team_members JSONB,
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  status TEXT NOT NULL DEFAULT 'planned', -- planned | in_progress | reporting | closed
  total_findings INTEGER NOT NULL DEFAULT 0,
  open_findings INTEGER NOT NULL DEFAULT 0,
  report_url TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_internal_audit_engagements_plan ON internal_audit_engagements(plan_id);
CREATE INDEX IF NOT EXISTS idx_internal_audit_engagements_status ON internal_audit_engagements(status);
CREATE INDEX IF NOT EXISTS idx_internal_audit_engagements_area ON internal_audit_engagements(area);

CREATE TABLE IF NOT EXISTS internal_audit_findings (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER NOT NULL REFERENCES internal_audit_engagements(id) ON DELETE CASCADE,
  finding_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium', -- critical | high | medium | low
  category TEXT, -- control_weakness | non_compliance | inefficiency | fraud_risk | other
  recommendation TEXT,
  management_response TEXT,
  owner_name TEXT,
  owner_user_id VARCHAR REFERENCES users(id),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open', -- open | in_progress | resolved | accepted_risk | overdue
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  attachments JSONB,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_internal_audit_findings_engagement ON internal_audit_findings(engagement_id);
CREATE INDEX IF NOT EXISTS idx_internal_audit_findings_status ON internal_audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_internal_audit_findings_severity ON internal_audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_internal_audit_findings_owner ON internal_audit_findings(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_internal_audit_findings_due ON internal_audit_findings(due_date);

-- ============================================================================
-- DONE. Verify all 11 tables created:
--   audit_committees, audit_committee_members, audit_committee_reports,
--   prospectuses, prospectus_sections,
--   ir_events, ir_contacts,
--   material_disclosures,
--   internal_audit_plans, internal_audit_engagements, internal_audit_findings
-- ============================================================================
