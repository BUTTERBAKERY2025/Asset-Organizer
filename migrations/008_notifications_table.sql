-- Migration: Notifications System
-- Date: 2026-01-20
-- Description: جدول نظام التنبيهات الفورية

-- =====================================================
-- نظام التنبيهات - Notifications System
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id),
    user_id VARCHAR(50) REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    category TEXT,
    priority TEXT DEFAULT 'normal',
    link_type TEXT,
    link_id INTEGER,
    link_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    scheduled_for TIMESTAMP,
    expires_at TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);
