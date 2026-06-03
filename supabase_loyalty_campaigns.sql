-- =====================================================
-- نظام حملات الولاء وبطاقات QR - Loyalty / QR Campaign System
-- Run this in the Supabase SQL Editor BEFORE deploying to Render.
-- Safe to run multiple times (idempotent: CREATE TABLE / INDEX IF NOT EXISTS).
-- Creates 4 tables: campaigns, customers (CRM), members (codes), redemptions.
-- =====================================================

CREATE TABLE IF NOT EXISTS loyalty_campaigns (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL,            -- percentage | fixed_amount | gift
  discount_value NUMERIC(10,2) NOT NULL,  -- 0 for gift campaigns
  max_uses_per_customer INTEGER NOT NULL DEFAULT 1,
  minimum_order NUMERIC(10,2),
  maximum_discount NUMERIC(10,2),
  code_prefix TEXT,
  applicable_branches TEXT[],             -- null = all branches
  valid_from DATE,
  valid_to DATE,
  status TEXT NOT NULL DEFAULT 'active',  -- active | inactive | expired
  terms TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_campaign_slug ON loyalty_campaigns (slug);
CREATE INDEX IF NOT EXISTS idx_loyalty_campaign_status ON loyalty_campaigns (status);

CREATE TABLE IF NOT EXISTS loyalty_customers (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer_phone ON loyalty_customers (phone);

CREATE TABLE IF NOT EXISTS loyalty_members (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES loyalty_campaigns(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES loyalty_customers(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  max_uses INTEGER NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',  -- active | exhausted | disabled
  apple_serial TEXT,                      -- reserved for future Apple Wallet pass
  google_object_id TEXT,                  -- reserved for future Google Wallet pass
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_member_campaign_customer ON loyalty_members (campaign_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_member_campaign ON loyalty_members (campaign_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_member_code ON loyalty_members (code);

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES loyalty_campaigns(id) ON DELETE CASCADE,
  pos_sale_id INTEGER REFERENCES pos_sales(id) ON DELETE SET NULL,
  branch_id VARCHAR,
  order_amount NUMERIC(12,2),
  discount_amount NUMERIC(10,2),
  redeemed_by VARCHAR,
  redeemed_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_member ON loyalty_redemptions (member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_campaign ON loyalty_redemptions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_date ON loyalty_redemptions (redeemed_at);
