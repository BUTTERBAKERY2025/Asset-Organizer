-- Additive external-DB migration for lifecycle notifications.
-- Apply to DEV before deploying code; production is intentionally not touched here.
ALTER TABLE system_notifications
  ADD COLUMN IF NOT EXISTS access_module text,
  ADD COLUMN IF NOT EXISTS access_branch_ids text[],
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_notif_dedupe_key
  ON system_notifications (dedupe_key);