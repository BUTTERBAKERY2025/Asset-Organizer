-- ============================================================
-- Branch Opening Campaigns — حملات افتتاح الفروع
-- يجب تنفيذ هذا الملف يدوياً في Supabase SQL Editor قبل النشر
-- ============================================================

CREATE TABLE IF NOT EXISTS branch_opening_campaigns (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  branch_city TEXT NOT NULL,
  branch_address TEXT,
  opening_date TEXT,
  headline TEXT,
  description TEXT,
  prizes_json TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_guests INTEGER,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branch_opening_campaigns_slug ON branch_opening_campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_branch_opening_campaigns_active ON branch_opening_campaigns(is_active);

CREATE TABLE IF NOT EXISTS branch_opening_guests (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES branch_opening_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  nationality TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  ticket_number TEXT NOT NULL,
  prize_won TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branch_opening_guests_campaign ON branch_opening_guests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_branch_opening_guests_phone ON branch_opening_guests(phone);
CREATE INDEX IF NOT EXISTS idx_branch_opening_guests_campaign_phone ON branch_opening_guests(campaign_id, phone);
