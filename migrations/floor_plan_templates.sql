-- =====================================================
-- Floor Plan Templates — reusable layouts
-- Run this in Supabase SQL Editor BEFORE deploying the
-- Batch 3 (templates / history / WhatsApp) code.
-- Safe to run multiple times (IF NOT EXISTS).
-- =====================================================

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
