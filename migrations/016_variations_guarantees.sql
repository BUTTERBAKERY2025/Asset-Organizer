-- ============================================================
-- المرحلة 3: أوامر التغيير + الضمانات البنكية
-- Phase 3: Variation Orders + Bank Guarantees
-- ============================================================
-- نفّذ هذا في Supabase SQL Editor قبل نشر الكود على Render
-- ============================================================

-- 1) أوامر التغيير (Variation Orders / Change Orders)
CREATE TABLE IF NOT EXISTS contract_variations (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES construction_contracts(id) ON DELETE CASCADE,
  variation_number TEXT NOT NULL,                          -- VO-001
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'addition',                   -- 'addition' | 'deduction' | 'scope_change' | 'time_extension'
  amount REAL NOT NULL DEFAULT 0,                          -- موجب=زيادة، سالب=تخفيض، 0=تغيير مدة فقط
  duration_change_days INTEGER DEFAULT 0,                  -- تمديد/تقليص المدة
  reason TEXT,                                             -- سبب التغيير
  status TEXT NOT NULL DEFAULT 'draft',                    -- 'draft' | 'pending_approval' | 'approved' | 'rejected'
  requested_by VARCHAR REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  attachment_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_variations_contract ON contract_variations(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_variations_status ON contract_variations(status);

-- 2) الضمانات البنكية (Bank Guarantees)
CREATE TABLE IF NOT EXISTS contract_guarantees (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES construction_contracts(id) ON DELETE CASCADE,
  guarantee_number TEXT NOT NULL,                          -- رقم الضمان من البنك
  type TEXT NOT NULL DEFAULT 'performance',                -- 'bid' | 'performance' | 'advance' | 'maintenance'
  bank_name TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  issue_date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',                   -- 'active' | 'expired' | 'released' | 'claimed'
  released_at TIMESTAMP,
  released_by VARCHAR REFERENCES users(id),
  release_notes TEXT,
  attachment_url TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_guarantees_contract ON contract_guarantees(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_guarantees_status ON contract_guarantees(status);
CREATE INDEX IF NOT EXISTS idx_contract_guarantees_expiry ON contract_guarantees(expiry_date);

-- ✅ تم. شغّل الكود على Render بعد ذلك.
