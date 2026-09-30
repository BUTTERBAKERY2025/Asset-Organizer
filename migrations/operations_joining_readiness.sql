-- Schema only, matching CURRENT shared/schema.ts. No business rows or historical IDs are converted.
-- Existing incompatible columns require a reviewed manual reconciliation; do not run older conversion scripts.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SELECT pg_advisory_xact_lock(202610017);
CREATE TABLE IF NOT EXISTS job_offers (
  id SERIAL PRIMARY KEY, offer_number TEXT NOT NULL UNIQUE,
  candidate_name TEXT NOT NULL, candidate_name_en TEXT, nationality TEXT,
  id_number TEXT, id_place TEXT, id_expiry TEXT, phone TEXT NOT NULL,
  email TEXT, qualification TEXT, position TEXT NOT NULL, position_en TEXT,
  department TEXT, branch_id VARCHAR REFERENCES branches(id), branch_name TEXT,
  start_date TEXT NOT NULL, contract_duration_months INTEGER NOT NULL DEFAULT 12,
  probation_days INTEGER NOT NULL DEFAULT 180, working_hours TEXT DEFAULT '8 ساعات / 6 أيام في الأسبوع',
  basic_salary INTEGER NOT NULL DEFAULT 0, housing_allowance INTEGER NOT NULL DEFAULT 0,
  transport_allowance INTEGER NOT NULL DEFAULT 0, other_allowances INTEGER NOT NULL DEFAULT 0,
  annual_leave_days INTEGER NOT NULL DEFAULT 21, has_medical_insurance BOOLEAN NOT NULL DEFAULT TRUE,
  has_travel_tickets BOOLEAN NOT NULL DEFAULT FALSE, benefits_notes TEXT, terms_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft', validity_days INTEGER NOT NULL DEFAULT 2,
  sent_at TIMESTAMP, viewed_at TIMESTAMP, responded_at TIMESTAMP, expires_at TIMESTAMP,
  candidate_signature TEXT, accepted_at_signature TIMESTAMP, decline_reason TEXT,
  candidate_ip TEXT, candidate_user_agent TEXT, created_by VARCHAR REFERENCES users(id),
  cancelled_by VARCHAR REFERENCES users(id), cancel_reason TEXT,
  hired_employee_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers(status);
CREATE INDEX IF NOT EXISTS idx_job_offers_branch ON job_offers(branch_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_phone ON job_offers(phone);
CREATE INDEX IF NOT EXISTS idx_job_offers_created_at ON job_offers(created_at);
CREATE TABLE IF NOT EXISTS job_offer_tokens (
  id SERIAL PRIMARY KEY, offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP,
  revoked_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_offer_tokens_token ON job_offer_tokens(token);
CREATE INDEX IF NOT EXISTS idx_job_offer_tokens_offer ON job_offer_tokens(offer_id);
CREATE TABLE IF NOT EXISTS job_offer_audit_log (
  id SERIAL PRIMARY KEY, offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  action TEXT NOT NULL, performed_by VARCHAR REFERENCES users(id), performed_by_name TEXT,
  ip_address TEXT, details JSONB, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_offer_audit_offer ON job_offer_audit_log(offer_id);
CREATE INDEX IF NOT EXISTS idx_job_offer_audit_created_at ON job_offer_audit_log(created_at);
CREATE TABLE IF NOT EXISTS onboarding_notifications (
  id SERIAL PRIMARY KEY, notification_number TEXT NOT NULL UNIQUE,
  job_offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL, phone TEXT NOT NULL, position TEXT NOT NULL,
  branch_id VARCHAR REFERENCES branches(id), branch_name TEXT, actual_start_date TEXT NOT NULL,
  working_hours TEXT, reporting_to TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'pending',
  validity_days INTEGER NOT NULL DEFAULT 7, sent_at TIMESTAMP, expires_at TIMESTAMP,
  selfie_photo_url TEXT, selfie_lat DOUBLE PRECISION, selfie_lng DOUBLE PRECISION,
  selfie_accuracy DOUBLE PRECISION, selfie_captured_at TIMESTAMP, distance_from_branch_m INTEGER,
  within_branch_radius BOOLEAN, employee_signature TEXT, signed_at TIMESTAMP,
  signed_ip TEXT, signed_user_agent TEXT, confirmed_at TIMESTAMP, confirmed_by VARCHAR REFERENCES users(id),
  confirmed_notes TEXT, converted_at TIMESTAMP, converted_by VARCHAR REFERENCES users(id),
  converted_employee_id VARCHAR REFERENCES users(id),
  converted_branch_employee_id INTEGER REFERENCES branch_employees(id),
  created_by VARCHAR REFERENCES users(id), cancelled_at TIMESTAMP, cancel_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_notifications(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_branch ON onboarding_notifications(branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_offer ON onboarding_notifications(job_offer_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON onboarding_notifications(created_at);
CREATE TABLE IF NOT EXISTS onboarding_tokens (
  id SERIAL PRIMARY KEY, notification_id INTEGER NOT NULL REFERENCES onboarding_notifications(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP,
  revoked_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_token ON onboarding_tokens(token);
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_notification ON onboarding_tokens(notification_id);
-- Check key identifier compatibility before committing, without casting or updating old records.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='job_offers'
      AND column_name='hired_employee_id' AND udt_name='varchar') THEN
    RAISE EXCEPTION 'job_offers.hired_employee_id must be varchar referencing users.id; reconcile verified identifiers manually. No automatic conversion.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='onboarding_notifications'
      AND column_name='converted_branch_employee_id' AND udt_name='int4') THEN
    RAISE EXCEPTION 'onboarding_notifications.converted_branch_employee_id must be integer referencing branch_employees.id; reconcile existing schema manually.';
  END IF;
END $$;
COMMIT;