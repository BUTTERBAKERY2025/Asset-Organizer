-- ============================================================================
-- Floor Plan — Zone Rotation (تدوير المناطق على المخطط)
-- Run this in Supabase SQL Editor BEFORE deploying the new code to Render.
-- Depends on `migrations/floor_plan_tables.sql`.
-- ============================================================================

-- Adds rotation in degrees (0–359 typical; -180..180 also fine). Default 0 = no rotation.
ALTER TABLE floor_plan_zones
  ADD COLUMN IF NOT EXISTS rotation INTEGER NOT NULL DEFAULT 0;
