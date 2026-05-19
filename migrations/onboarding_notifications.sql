-- =====================================================
-- Phase 14: Onboarding / Work Commencement Notifications
-- Run this in Supabase SQL Editor BEFORE deploying to Render
-- =====================================================

-- 1) Fix job_offers.hired_employee_id type to match users.id (UUID/varchar).
--    Old column was INTEGER which mismatched users.id varchar UUID.
ALTER TABLE job_offers
  ALTER COLUMN hired_employee_id TYPE VARCHAR USING hired_employee_id::VARCHAR;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'job_offers_hired_employee_id_fkey'
  ) THEN
    ALTER TABLE job_offers
      ADD CONSTRAINT job_offers_hired_employee_id_fkey
      FOREIGN KEY (hired_employee_id) REFERENCES users(id);
  END IF;
END $$;

-- 2) Onboarding tables

CREATE TABLE IF NOT EXISTS onboarding_notifications (
  id SERIAL PRIMARY KEY,
  notification_number TEXT NOT NULL UNIQUE,
  job_offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  position TEXT NOT NULL,
  branch_id VARCHAR REFERENCES branches(id),
  branch_name TEXT,
  actual_start_date TEXT NOT NULL,
  working_hours TEXT,
  reporting_to TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  validity_days INTEGER NOT NULL DEFAULT 7,
  sent_at TIMESTAMP,
  expires_at TIMESTAMP,
  selfie_photo_url TEXT,
  selfie_lat DOUBLE PRECISION,
  selfie_lng DOUBLE PRECISION,
  selfie_accuracy DOUBLE PRECISION,
  selfie_captured_at TIMESTAMP,
  distance_from_branch_m INTEGER,
  within_branch_radius BOOLEAN,
  employee_signature TEXT,
  signed_at TIMESTAMP,
  signed_ip TEXT,
  signed_user_agent TEXT,
  confirmed_at TIMESTAMP,
  confirmed_by VARCHAR REFERENCES users(id),
  confirmed_notes TEXT,
  converted_at TIMESTAMP,
  converted_by VARCHAR REFERENCES users(id),
  converted_employee_id VARCHAR REFERENCES users(id),
  created_by VARCHAR REFERENCES users(id),
  cancelled_at TIMESTAMP,
  cancel_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_notifications(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_branch ON onboarding_notifications(branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_offer ON onboarding_notifications(job_offer_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON onboarding_notifications(created_at);

CREATE TABLE IF NOT EXISTS onboarding_tokens (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES onboarding_notifications(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_token ON onboarding_tokens(token);
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_notification ON onboarding_tokens(notification_id);
