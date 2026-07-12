-- ============================================================
-- ترقية نظام الإجازات: التصفية + مباشرة الخروج والعودة
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر الكود على Render
-- آمن لإعادة التنفيذ (IF NOT EXISTS في كل الأوامر)
-- ============================================================

-- 1) أعمدة الخروج والعودة على طلبات الإجازات
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS actual_exit_date text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS exit_confirmed_by varchar REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS exit_confirmed_at timestamp;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS actual_return_date text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS return_confirmed_by varchar REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS return_confirmed_at timestamp;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS return_status text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS late_days real DEFAULT 0;

-- 2) عمود الأيام المصفّاة على أرصدة الإجازات
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS settled_days real NOT NULL DEFAULT 0;

-- 3) جدول تصفيات رصيد الإجازة (سند صرف بدل الإجازة)
CREATE TABLE IF NOT EXISTS leave_settlements (
  id serial PRIMARY KEY,
  leave_request_id integer NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  branch_employee_id integer NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id varchar NOT NULL REFERENCES branches(id),
  year integer NOT NULL,
  leave_type text NOT NULL DEFAULT 'annual',
  settled_days real NOT NULL,
  divisor integer NOT NULL,
  gross_salary real NOT NULL,
  daily_rate real NOT NULL,
  calculated_amount real NOT NULL,
  final_amount real NOT NULL,
  is_manual_amount boolean NOT NULL DEFAULT false,
  settlement_date text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'active',
  cancelled_by varchar REFERENCES users(id),
  cancelled_at timestamp,
  cancel_reason text,
  created_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_settlements_employee ON leave_settlements (branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_settlements_branch ON leave_settlements (branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_settlements_request_active ON leave_settlements (leave_request_id) WHERE status = 'active';
