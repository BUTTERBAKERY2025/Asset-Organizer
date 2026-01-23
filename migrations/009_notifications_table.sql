-- Migration: Create notifications table
-- Date: 2026-01-23
-- Description: جدول الإشعارات الموحد للنظام

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  user_id VARCHAR REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  category TEXT,
  priority TEXT DEFAULT 'normal',
  link_type TEXT,
  link_id INTEGER,
  link_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMP,
  scheduled_for TIMESTAMP,
  expires_at TIMESTAMP,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
