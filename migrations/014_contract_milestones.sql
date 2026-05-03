-- ============================================================
-- المرحلة 1: تقسيم الدفعات المهيكل (Payment Milestones)
-- Phase 1: Structured Payment Milestones for Construction Contracts
-- ============================================================
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر الكود على Render
-- Run this in Supabase SQL Editor BEFORE deploying code to Render
-- ============================================================

CREATE TABLE IF NOT EXISTS contract_milestones (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES construction_contracts(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  amount_type TEXT NOT NULL DEFAULT 'percentage',          -- 'percentage' | 'fixed'
  percentage REAL,                                          -- إذا amount_type='percentage' (مثلاً 30.0)
  amount REAL NOT NULL DEFAULT 0,                           -- المبلغ بالريال (محسوب من النسبة أو ثابت)
  trigger_type TEXT NOT NULL DEFAULT 'manual',              -- 'manual' | 'date' | 'progress' | 'item_completion'
  trigger_date TEXT,                                        -- إذا trigger_type='date'
  trigger_progress_percent REAL,                            -- إذا trigger_type='progress' (نسبة الإنجاز المطلوبة)
  status TEXT NOT NULL DEFAULT 'pending',                   -- 'pending' | 'due' | 'requested' | 'paid' | 'cancelled'
  due_date TEXT,                                            -- تاريخ الاستحقاق المتوقع
  payment_request_id INTEGER REFERENCES payment_requests(id) ON DELETE SET NULL,
  paid_at TIMESTAMP,
  paid_amount REAL DEFAULT 0,                               -- المبلغ المدفوع فعلاً (قد يختلف بسبب خصومات)
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_milestones_contract ON contract_milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_milestones_status ON contract_milestones(status);
CREATE INDEX IF NOT EXISTS idx_contract_milestones_payment_req ON contract_milestones(payment_request_id);

-- ✅ تم. الجدول جاهز. شغّل الكود من Render بعد ذلك.
