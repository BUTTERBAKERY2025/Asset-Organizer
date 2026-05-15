-- Add missing columns to system_audit_logs to match shared/schema.ts
-- Safe to run multiple times (uses IF NOT EXISTS).

ALTER TABLE system_audit_logs
  ADD COLUMN IF NOT EXISTS target_id text;

ALTER TABLE system_audit_logs
  ADD COLUMN IF NOT EXISTS description text;
