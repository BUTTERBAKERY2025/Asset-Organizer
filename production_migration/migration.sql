-- Migration: Add daily_production_batches table
-- Run this in Supabase SQL Editor BEFORE deploying code

CREATE TABLE IF NOT EXISTS daily_production_batches (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_category TEXT,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT 'قطعة',
  destination TEXT NOT NULL,
  shift_id INTEGER REFERENCES shifts(id),
  production_order_id INTEGER REFERENCES advanced_production_orders(id),
  produced_at TIMESTAMP DEFAULT NOW() NOT NULL,
  recorded_by VARCHAR REFERENCES users(id),
  recorder_name TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_production_batches_branch ON daily_production_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_production_batches_produced_at ON daily_production_batches(produced_at);
CREATE INDEX IF NOT EXISTS idx_daily_production_batches_destination ON daily_production_batches(destination);
