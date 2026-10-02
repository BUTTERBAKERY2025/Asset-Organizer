-- MANUAL / ADDITIVE ONLY. Latest numbered migration checked: 049.
-- Apply to an explicitly approved target before enabling the new resolver.
-- Do not use db:push, run this automatically at startup, or bulk-convert users.
-- Existing users have no metadata row (equivalent to NULL): legacy heuristic. A deliberate
-- replacement stamps 'direct' in its transaction, including an empty replacement.
-- 'inherit' is reserved for an explicitly approved individual source-mode change.
-- Rollback of app code may leave this table; do not drop it after writes.
-- Ordinary users reads/startup do not require this table. Permission reads and
-- intentional replacements require it and FAIL CLOSED when absent. No silent
-- permission fallback; readiness must verify this approved migration is applied.
BEGIN;
CREATE TABLE IF NOT EXISTS user_permission_source_modes (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source_mode varchar(20) NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_permission_source_modes
    CHECK (source_mode IS NULL OR source_mode IN ('direct', 'inherit'))
);
COMMIT;