-- =====================================================
-- Job Offers Module — Phase 12
-- شغّل هذا الملف في Supabase SQL Editor قبل الديبلوي
-- =====================================================

CREATE TABLE IF NOT EXISTS job_offers (
  id SERIAL PRIMARY KEY,
  offer_number TEXT NOT NULL UNIQUE,
  candidate_name TEXT NOT NULL,
  candidate_name_en TEXT,
  nationality TEXT,
  id_number TEXT,
  id_place TEXT,
  id_expiry TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  qualification TEXT,
  position TEXT NOT NULL,
  position_en TEXT,
  department TEXT,
  branch_id VARCHAR REFERENCES branches(id),
  branch_name TEXT,
  start_date TEXT NOT NULL,
  contract_duration_months INTEGER NOT NULL DEFAULT 12,
  probation_days INTEGER NOT NULL DEFAULT 180,
  working_hours TEXT DEFAULT '8 ساعات / 6 أيام في الأسبوع',
  basic_salary INTEGER NOT NULL DEFAULT 0,
  housing_allowance INTEGER NOT NULL DEFAULT 0,
  transport_allowance INTEGER NOT NULL DEFAULT 0,
  other_allowances INTEGER NOT NULL DEFAULT 0,
  annual_leave_days INTEGER NOT NULL DEFAULT 21,
  has_medical_insurance BOOLEAN NOT NULL DEFAULT TRUE,
  has_travel_tickets BOOLEAN NOT NULL DEFAULT FALSE,
  benefits_notes TEXT,
  terms_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  validity_days INTEGER NOT NULL DEFAULT 2,
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP,
  candidate_signature TEXT,
  accepted_at_signature TIMESTAMP,
  decline_reason TEXT,
  candidate_ip TEXT,
  candidate_user_agent TEXT,
  created_by VARCHAR REFERENCES users(id),
  cancelled_by VARCHAR REFERENCES users(id),
  cancel_reason TEXT,
  hired_employee_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers(status);
CREATE INDEX IF NOT EXISTS idx_job_offers_branch ON job_offers(branch_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_phone ON job_offers(phone);
CREATE INDEX IF NOT EXISTS idx_job_offers_created_at ON job_offers(created_at);

CREATE TABLE IF NOT EXISTS job_offer_tokens (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_offer_tokens_token ON job_offer_tokens(token);
CREATE INDEX IF NOT EXISTS idx_job_offer_tokens_offer ON job_offer_tokens(offer_id);

CREATE TABLE IF NOT EXISTS job_offer_audit_log (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by VARCHAR REFERENCES users(id),
  performed_by_name TEXT,
  ip_address TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_offer_audit_offer ON job_offer_audit_log(offer_id);
CREATE INDEX IF NOT EXISTS idx_job_offer_audit_created_at ON job_offer_audit_log(created_at);
