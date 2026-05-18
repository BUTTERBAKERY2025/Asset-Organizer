-- ============================================================================
-- Floor Plan (مخطط أرضية الفرع) — Production Migration
-- Run this in Supabase SQL Editor BEFORE deploying the new code to Render
-- ============================================================================

-- 1) Per-branch floor plan (one per branch)
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

-- 2) Colored zones drawn inside the plan (kitchen / hall / barista ...)
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

-- 3) Employee placements on the plan (one row per employee per plan)
CREATE TABLE IF NOT EXISTS floor_plan_assignments (
  id SERIAL PRIMARY KEY,
  floor_plan_id INTEGER NOT NULL REFERENCES branch_floor_plans(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT floor_plan_assignments_plan_emp_unique UNIQUE (floor_plan_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_floor_plan_assignments_plan ON floor_plan_assignments(floor_plan_id);
