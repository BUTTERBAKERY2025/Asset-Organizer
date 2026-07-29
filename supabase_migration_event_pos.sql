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
