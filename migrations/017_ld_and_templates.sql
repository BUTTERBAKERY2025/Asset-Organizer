-- ============================================================
-- المرحلة 4: غرامات التأخير + قوالب العقود
-- Phase 4: Liquidated Damages + Contract Templates
-- ============================================================
-- نفّذ هذا في Supabase SQL Editor قبل نشر الكود على Render
-- ============================================================

-- 1) غرامات التأخير على العقود (Liquidated Damages)
ALTER TABLE construction_contracts
  ADD COLUMN IF NOT EXISTS ld_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ld_daily_rate REAL DEFAULT 0,                  -- نسبة يومية كنسبة مئوية، مثلاً 0.1 = 0.1% يومياً
  ADD COLUMN IF NOT EXISTS ld_max_percentage REAL DEFAULT 10,             -- سقف أقصى من قيمة العقد
  ADD COLUMN IF NOT EXISTS planned_completion_date TEXT,                  -- تاريخ التسليم المخطط
  ADD COLUMN IF NOT EXISTS actual_completion_date TEXT,                   -- تاريخ التسليم الفعلي
  ADD COLUMN IF NOT EXISTS ld_calculated_amount REAL DEFAULT 0,           -- المبلغ المحسوب
  ADD COLUMN IF NOT EXISTS ld_calculated_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ld_calculated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ld_applied BOOLEAN DEFAULT false,              -- تم تطبيقها كخصم
  ADD COLUMN IF NOT EXISTS ld_waived BOOLEAN DEFAULT false,               -- تم التنازل
  ADD COLUMN IF NOT EXISTS ld_waived_reason TEXT,
  ADD COLUMN IF NOT EXISTS ld_action_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ld_action_by VARCHAR REFERENCES users(id);

-- 2) قوالب العقود (Contract Templates)
CREATE TABLE IF NOT EXISTS contract_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                                       -- مدنية | كهرباء | ميكانيكية | تشطيبات | عام
  default_terms TEXT,                                  -- نص بنود/شروط افتراضي
  default_retention_percentage REAL DEFAULT 0,
  default_ld_enabled BOOLEAN DEFAULT false,
  default_ld_daily_rate REAL DEFAULT 0,
  default_ld_max_percentage REAL DEFAULT 10,
  default_milestones JSONB DEFAULT '[]'::jsonb,        -- [{title, amountType, percentage, sequence, triggerType, dueDays}]
  default_guarantees JSONB DEFAULT '[]'::jsonb,        -- [{type, amountPercentage, validityMonths}]
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,                       -- عدّاد مرات الاستخدام
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_category ON contract_templates(category);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON contract_templates(is_active);

-- ✅ تم.
