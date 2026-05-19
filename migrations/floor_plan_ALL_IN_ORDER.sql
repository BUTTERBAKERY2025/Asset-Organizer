-- ============================================================================
-- Floor Plan — حزمة كاملة بالترتيب الصحيح
-- شغّلها مرة واحدة في Supabase SQL Editor.
-- كل الأوامر آمنة للتشغيل عدة مرات (IF NOT EXISTS / IF EXISTS).
-- ============================================================================

-- ─── 1) الجداول الأساسية ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_floor_plans (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT,
  width INTEGER NOT NULL DEFAULT 1200,
  height INTEGER NOT NULL DEFAULT 800,
  background_color TEXT NOT NULL DEFAULT '#f8fafc',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT branch_floor_plans_branch_id_unique UNIQUE (branch_id)
);

CREATE TABLE IF NOT EXISTS floor_plan_zones (
  id SERIAL PRIMARY KEY,
  floor_plan_id INTEGER NOT NULL REFERENCES branch_floor_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#fde68a',
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 200,
  height INTEGER NOT NULL DEFAULT 150,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_floor_plan_zones_plan ON floor_plan_zones(floor_plan_id);

CREATE TABLE IF NOT EXISTS floor_plan_assignments (
  id SERIAL PRIMARY KEY,
  floor_plan_id INTEGER NOT NULL REFERENCES branch_floor_plans(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES branch_employees(id) ON DELETE CASCADE,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_floor_plan_assignments_plan ON floor_plan_assignments(floor_plan_id);

-- ─── 2) دعم الورديات (صباحي / مسائي / ليلي) ──────────────────────────────────
ALTER TABLE floor_plan_assignments
  ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'morning';

ALTER TABLE floor_plan_assignments
  DROP CONSTRAINT IF EXISTS floor_plan_assignments_shift_type_check;
ALTER TABLE floor_plan_assignments
  ADD CONSTRAINT floor_plan_assignments_shift_type_check
  CHECK (shift_type IN ('morning','evening','night'));

CREATE INDEX IF NOT EXISTS idx_floor_plan_assignments_plan_shift
  ON floor_plan_assignments(floor_plan_id, shift_type);

-- ─── 3) السماح بالخانات الفارغة (employee_id قابل للـ NULL) ──────────────────
ALTER TABLE floor_plan_assignments
  ALTER COLUMN employee_id DROP NOT NULL;

-- ─── 4) إزالة القيد القديم وإضافة فهرس فريد جزئي صحيح ────────────────────────
ALTER TABLE floor_plan_assignments
  DROP CONSTRAINT IF EXISTS floor_plan_assignments_plan_emp_unique;

DROP INDEX IF EXISTS uq_floor_plan_assignments_emp;
DROP INDEX IF EXISTS uq_floor_plan_assignments_emp_shift;

CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plan_assignments_emp_shift
  ON floor_plan_assignments(floor_plan_id, employee_id, shift_type)
  WHERE employee_id IS NOT NULL;

-- ─── 5) تدوير المناطق ─────────────────────────────────────────────────────────
ALTER TABLE floor_plan_zones
  ADD COLUMN IF NOT EXISTS rotation INTEGER NOT NULL DEFAULT 0;

-- ─── 6) ترتيب الطبقات (z_index) ──────────────────────────────────────────────
ALTER TABLE floor_plan_zones
  ADD COLUMN IF NOT EXISTS z_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE floor_plan_assignments
  ADD COLUMN IF NOT EXISTS z_index INTEGER NOT NULL DEFAULT 0;

-- ─── 7) جدول القوالب (floor_plan_templates) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plan_templates (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  description text,
  branch_id   varchar REFERENCES branches(id) ON DELETE CASCADE,
  payload     jsonb NOT NULL,
  created_by  varchar REFERENCES users(id),
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_floor_plan_templates_branch
  ON floor_plan_templates(branch_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_templates_created_at
  ON floor_plan_templates(created_at);

-- ============================================================================
-- تمّ. ارجع إلى صفحة /floor-plan وحدّثها — يجب أن تظهر البيانات الآن.
-- ============================================================================
