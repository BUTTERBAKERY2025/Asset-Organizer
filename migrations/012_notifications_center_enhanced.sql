-- ============================================
-- Notifications Center Enhancement (Phases 2, 3, 4)
-- Run this MANUALLY in Supabase SQL Editor BEFORE deploying new code.
-- Safe & idempotent: uses IF NOT EXISTS everywhere.
-- ============================================

-- Phase 2: WhatsApp media support in the outbound queue
ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Phase 4: Role targeting + automation provenance on system_notifications
ALTER TABLE system_notifications
  ADD COLUMN IF NOT EXISTS target_role_ids TEXT[];

ALTER TABLE system_notifications
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE system_notifications
  ADD COLUMN IF NOT EXISTS auto_source TEXT;
  -- Examples: 'work_anniversary'

-- Phase 3: Automation deduplication table
-- Ensures we never send the same auto-greeting twice in the same year.
CREATE TABLE IF NOT EXISTS notification_automations (
  id SERIAL PRIMARY KEY,
  automation_type TEXT NOT NULL,
  branch_employee_id INTEGER NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  notification_id INTEGER REFERENCES system_notifications(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_auto_unique
  ON notification_automations(automation_type, branch_employee_id, year);

CREATE INDEX IF NOT EXISTS idx_notif_auto_type_year
  ON notification_automations(automation_type, year);
