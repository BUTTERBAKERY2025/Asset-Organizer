-- Migration: Asset Transfers Tables
-- تحويلات الأصول بين الفروع
-- Run this in Supabase SQL Editor before deploying to production

-- Asset Transfers table
CREATE TABLE IF NOT EXISTS asset_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number TEXT UNIQUE NOT NULL,
  item_id VARCHAR NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  from_branch_id VARCHAR NOT NULL REFERENCES branches(id),
  to_branch_id VARCHAR NOT NULL REFERENCES branches(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, in_transit, completed, cancelled
  reason TEXT,
  notes TEXT,
  requested_by VARCHAR REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT NOW() NOT NULL,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  received_by VARCHAR REFERENCES users(id),
  received_at TIMESTAMP,
  receiver_name TEXT,
  receiver_signature TEXT, -- Base64 signature
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Asset Transfer Events table
CREATE TABLE IF NOT EXISTS asset_transfer_events (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES asset_transfers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- created, approved, dispatched, received, cancelled
  actor_id VARCHAR REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_asset_transfers_item_id ON asset_transfers(item_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_from_branch ON asset_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_to_branch ON asset_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_status ON asset_transfers(status);
CREATE INDEX IF NOT EXISTS idx_asset_transfer_events_transfer_id ON asset_transfer_events(transfer_id);
