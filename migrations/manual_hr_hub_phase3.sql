-- ============================================================================
-- HR Hub - Phase 3 Migration (Manual Supabase SQL)
-- ============================================================================
-- شغّل هذا الملف في Supabase SQL Editor قبل نشر الكود الجديد على Render.
-- المحتوى: 4 جداول جديدة + الفهارس الخاصة بها.
-- جميع البيانات الموجودة لا تتأثر (no destructive changes).
-- ============================================================================

-- 1) وثائق الموظفين
CREATE TABLE IF NOT EXISTS employee_documents (
  id SERIAL PRIMARY KEY,
  branch_employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id VARCHAR REFERENCES branches(id),
  document_type TEXT NOT NULL,
  document_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  file_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_branch ON employee_documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON employee_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_documents_status ON employee_documents(status);

-- 2) طلبات الإجازات
CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  branch_employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  reviewer_note TEXT,
  attachment_url TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_branch ON leave_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON leave_requests(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start ON leave_requests(start_date);

-- 3) الإنذارات والمخالفات
CREATE TABLE IF NOT EXISTS employee_warnings (
  id SERIAL PRIMARY KEY,
  branch_employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  level TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  issued_date TEXT NOT NULL,
  issued_by VARCHAR REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  acknowledged_signature TEXT,
  deduction_amount REAL DEFAULT 0,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_warnings_employee ON employee_warnings(branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_warnings_branch ON employee_warnings(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_warnings_status ON employee_warnings(status);
CREATE INDEX IF NOT EXISTS idx_employee_warnings_level ON employee_warnings(level);
CREATE INDEX IF NOT EXISTS idx_employee_warnings_date ON employee_warnings(issued_date);

-- 4) نهاية الخدمة (EOS)
CREATE TABLE IF NOT EXISTS eos_calculations (
  id SERIAL PRIMARY KEY,
  branch_employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  calculation_date TEXT NOT NULL,
  termination_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_service_years REAL NOT NULL,
  basic_salary REAL NOT NULL,
  total_salary REAL NOT NULL,
  eos_amount REAL NOT NULL,
  vacation_balance REAL DEFAULT 0,
  vacation_amount REAL DEFAULT 0,
  other_dues REAL DEFAULT 0,
  total_deductions REAL DEFAULT 0,
  net_amount REAL NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eos_calculations_employee ON eos_calculations(branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_eos_calculations_branch ON eos_calculations(branch_id);
CREATE INDEX IF NOT EXISTS idx_eos_calculations_status ON eos_calculations(status);
CREATE INDEX IF NOT EXISTS idx_eos_calculations_date ON eos_calculations(calculation_date);

-- ============================================================================
-- التحقق
-- ============================================================================
SELECT tablename FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('employee_documents','leave_requests','employee_warnings','eos_calculations')
ORDER BY tablename;
