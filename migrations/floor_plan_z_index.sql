-- Batch 4: per-element stacking order for floor-plan zones + assignments.
-- Powers "إلى الأمام / إلى الخلف" context-menu actions to resolve overlaps.
-- Higher z_index renders on top; default 0 preserves current behaviour.
-- Safe to run repeatedly.

ALTER TABLE floor_plan_zones
  ADD COLUMN IF NOT EXISTS z_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE floor_plan_assignments
  ADD COLUMN IF NOT EXISTS z_index INTEGER NOT NULL DEFAULT 0;
