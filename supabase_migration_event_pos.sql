-- ============================================================
-- تحديث نقطة بيع الإيفنتات (Event POS)
-- نفّذ هذا السكربت في Supabase SQL Editor قبل نشر الكود على Render
-- السكربت آمن لإعادة التنفيذ (IF NOT EXISTS)
-- ============================================================

-- 1) جدول الإيفنتات
CREATE TABLE IF NOT EXISTS pos_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  invoice_prefix TEXT,
  notes TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_events_branch ON pos_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_events_status ON pos_events(status);

-- 2) جدول ورديات الكاشير
CREATE TABLE IF NOT EXISTS pos_shifts (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES pos_events(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cashier_id VARCHAR NOT NULL REFERENCES users(id),
  cashier_name TEXT NOT NULL,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP,
  opening_cash DOUBLE PRECISION NOT NULL DEFAULT 0,
  expected_cash DOUBLE PRECISION,
  expected_network DOUBLE PRECISION,
  actual_cash DOUBLE PRECISION,
  actual_network DOUBLE PRECISION,
  cash_discrepancy DOUBLE PRECISION,
  sales_count INTEGER,
  sales_total DOUBLE PRECISION,
  refunds_total DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  closed_by VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_event ON pos_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_cashier ON pos_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_status ON pos_shifts(status);
-- وردية مفتوحة واحدة فقط لكل (إيفنت، كاشير) — يمنع سباق فتح ورديتين
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_shifts_open ON pos_shifts(event_id, cashier_id) WHERE status = 'open';

-- 3) جدول الاسترجاعات (الجزئية)
CREATE TABLE IF NOT EXISTS pos_refunds (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES pos_events(id),
  shift_id INTEGER REFERENCES pos_shifts(id),
  refund_number TEXT NOT NULL,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  vat_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL DEFAULT 'cash',
  reason TEXT,
  refunded_by VARCHAR NOT NULL,
  refunded_by_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_refunds_sale ON pos_refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_refunds_event ON pos_refunds(event_id);

-- 4) جدول أصناف الاسترجاع
CREATE TABLE IF NOT EXISTS pos_refund_items (
  id SERIAL PRIMARY KEY,
  refund_id INTEGER NOT NULL REFERENCES pos_refunds(id) ON DELETE CASCADE,
  sale_item_id INTEGER NOT NULL REFERENCES pos_sale_items(id),
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DOUBLE PRECISION NOT NULL,
  vat_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_price DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pos_refund_items_refund ON pos_refund_items(refund_id);

-- 5) أعمدة جديدة على الجداول الحالية
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS event_id INTEGER;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS shift_id INTEGER;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS refunded_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pos_held_orders ADD COLUMN IF NOT EXISTS event_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_pos_sales_event ON pos_sales(event_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_shift ON pos_sales(shift_id);

-- تم — لا حاجة لأي بيانات أولية

-- ===== حماية من تكرار الفواتير (Idempotency) =====
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_sales_idempotency ON pos_sales (branch_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ===== حماية من تكرار الاسترجاعات (Idempotency) =====
ALTER TABLE pos_refunds ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_refunds_idempotency ON pos_refunds (sale_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- تذكيرات توقيع الإنذارات (Task #23)
ALTER TABLE employee_warnings ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;
ALTER TABLE employee_warnings ADD COLUMN IF NOT EXISTS last_reminder_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_queue_warning_reminder ON notification_queue (related_module, related_entity_id, channel) WHERE related_module = 'warning_signature_reminder';

-- ===== 2026-07-29: performance evaluations (task #28) =====
CREATE TABLE IF NOT EXISTS employee_evaluations (
  id serial PRIMARY KEY,
  branch_employee_id integer NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id varchar NOT NULL REFERENCES branches(id),
  period_type text NOT NULL DEFAULT 'quarterly',
  period_start text NOT NULL,
  period_end text NOT NULL,
  criteria jsonb NOT NULL,
  overall_score real NOT NULL DEFAULT 0,
  strengths text,
  improvements text,
  goals text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  evaluator_id varchar REFERENCES users(id),
  evaluator_name text,
  approved_by varchar REFERENCES users(id),
  approved_by_name text,
  approved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_employee ON employee_evaluations (branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_branch ON employee_evaluations (branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_status ON employee_evaluations (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_evaluations_period ON employee_evaluations (branch_employee_id, period_type, period_start);

-- ===== 2026-07-30: evaluation employee acknowledgment =====
ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS employee_ack_at timestamp;
ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS employee_ack_comment text;

-- ===== 022: cashier deficit posting (applied to prod 2026-07-29) =====
-- 022: ترحيل عجوزات يوميات المبيعات للكاشير إلى السلف والقروض
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر التحديث على Render

ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_deduction_id integer;
ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_posted_by varchar REFERENCES users(id);
ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_posted_at timestamp;
CREATE INDEX IF NOT EXISTS idx_cashier_journals_deficit_posted ON cashier_sales_journals(deficit_deduction_id);
