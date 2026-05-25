-- ============================================
-- Notification Share Links (Phase 5)
-- Run this MANUALLY in Supabase SQL Editor BEFORE deploying new code.
-- Safe & idempotent: uses IF NOT EXISTS everywhere.
-- ============================================

CREATE TABLE IF NOT EXISTS notification_share_links (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES system_notifications(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP,
  view_count INTEGER DEFAULT 0 NOT NULL,
  default_recipient_name TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_share_slug ON notification_share_links (slug);
CREATE INDEX IF NOT EXISTS idx_notif_share_notif ON notification_share_links (notification_id);
