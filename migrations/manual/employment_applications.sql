-- =====================================================
-- Employment Applications Module — Phase 13
-- شغّل هذا الملف في Supabase SQL Editor قبل الديبلوي
-- =====================================================

CREATE TABLE IF NOT EXISTS job_vacancies (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_en TEXT,
  department TEXT,
  branch_id VARCHAR REFERENCES branches(id),
  branch_name TEXT,
  description TEXT,
  requirements TEXT,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  closed_at TIMESTAMP,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_vacancies_slug ON job_vacancies(slug);
CREATE INDEX IF NOT EXISTS idx_job_vacancies_branch ON job_vacancies(branch_id);
CREATE INDEX IF NOT EXISTS idx_job_vacancies_is_open ON job_vacancies(is_open);

CREATE TABLE IF NOT EXISTS employment_applications (
  id SERIAL PRIMARY KEY,
  application_number TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'directed',
  vacancy_id INTEGER REFERENCES job_vacancies(id) ON DELETE SET NULL,
  target_position TEXT,
  target_branch_id VARCHAR REFERENCES branches(id),
  target_branch_name TEXT,
  full_name_ar TEXT,
  full_name_en TEXT,
  nationality TEXT,
  id_number TEXT,
  id_type TEXT,
  id_expiry TEXT,
  dob TEXT,
  gender TEXT,
  marital_status TEXT,
  city TEXT,
  address TEXT,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  education JSONB,
  experience JSONB,
  skills JSONB,
  languages JSONB,
  "references" JSONB,
  expected_salary INTEGER,
  availability_date TEXT,
  cv_url TEXT,
  photo_url TEXT,
  id_copy_url TEXT,
  signature TEXT,
  agreed_to_terms BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'invited',
  rating INTEGER,
  hr_notes TEXT,
  rejection_reason TEXT,
  converted_to_offer_id INTEGER,
  invited_at TIMESTAMP,
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  decided_at TIMESTAMP,
  expires_at TIMESTAMP,
  applicant_ip TEXT,
  applicant_user_agent TEXT,
  created_by VARCHAR REFERENCES users(id),
  reviewed_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_app_status ON employment_applications(status);
CREATE INDEX IF NOT EXISTS idx_emp_app_branch ON employment_applications(target_branch_id);
CREATE INDEX IF NOT EXISTS idx_emp_app_phone ON employment_applications(phone);
CREATE INDEX IF NOT EXISTS idx_emp_app_vacancy ON employment_applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_emp_app_created_at ON employment_applications(created_at);

CREATE TABLE IF NOT EXISTS employment_application_tokens (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES employment_applications(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_app_tokens_token ON employment_application_tokens(token);
CREATE INDEX IF NOT EXISTS idx_emp_app_tokens_app ON employment_application_tokens(application_id);

CREATE TABLE IF NOT EXISTS employment_application_audit_log (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES employment_applications(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by VARCHAR REFERENCES users(id),
  performed_by_name TEXT,
  ip_address TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_app_audit_app ON employment_application_audit_log(application_id);
CREATE INDEX IF NOT EXISTS idx_emp_app_audit_created_at ON employment_application_audit_log(created_at);
