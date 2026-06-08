-- ============================================================
-- جدول صرف الرواتب (salary_payments)
-- يُسجّل لكل موظف/شهر أنّه تم صرف راتبه وبأي طريقة.
-- وجود السجل = تم الصرف ، حذفه = إلغاء التأشير.
-- آمن للتشغيل أكثر من مرة (idempotent).
-- نفّذ هذا في Supabase SQL Editor قبل نشر الكود على Render.
-- ============================================================

CREATE TABLE IF NOT EXISTS salary_payments (
  id SERIAL PRIMARY KEY,
  branch_employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  month TEXT NOT NULL,                 -- صيغة YYYY-MM
  payment_method TEXT NOT NULL,        -- bank_transfer | wage_protection | cash
  amount REAL,                         -- المبلغ المصروف (اختياري)
  paid_at TIMESTAMP NOT NULL DEFAULT NOW(),
  note TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_by_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_branch_month ON salary_payments (branch_id, month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments (branch_employee_id);

-- سجل صرف واحد فقط لكل موظف في كل شهر
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_payments_emp_month ON salary_payments (branch_employee_id, month);
