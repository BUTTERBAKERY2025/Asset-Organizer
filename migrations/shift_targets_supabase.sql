-- ==========================================
-- نظام أهداف الشفت والكاشير - Shift & Cashier Targets
-- Run this in Supabase SQL Editor BEFORE deploying
-- ==========================================

-- 1. Cashier Shift Targets - أهداف الكاشير داخل الشفت
CREATE TABLE IF NOT EXISTS cashier_shift_targets (
  id SERIAL PRIMARY KEY,
  shift_allocation_id INTEGER REFERENCES target_shift_allocations(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  cashier_id VARCHAR NOT NULL REFERENCES users(id),
  target_date TEXT NOT NULL,
  shift_type TEXT NOT NULL,
  cashier_role TEXT NOT NULL DEFAULT 'main',
  target_amount REAL NOT NULL,
  target_ticket_value REAL,
  target_transactions INTEGER,
  shift_start_time TEXT,
  shift_end_time TEXT,
  shift_duration_hours REAL,
  alert_threshold_percent REAL DEFAULT 80,
  below_track_threshold REAL DEFAULT 70,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cashier_shift_targets_branch_date 
  ON cashier_shift_targets(branch_id, target_date);
CREATE INDEX IF NOT EXISTS idx_cashier_shift_targets_cashier 
  ON cashier_shift_targets(cashier_id);

-- 2. Average Ticket Targets - أهداف متوسط الفاتورة
CREATE TABLE IF NOT EXISTS average_ticket_targets (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  cashier_id VARCHAR REFERENCES users(id),
  shift_type TEXT,
  target_type TEXT NOT NULL,
  target_value REAL NOT NULL,
  min_acceptable REAL,
  bonus_threshold REAL,
  bonus_per_riyal REAL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_average_ticket_targets_branch 
  ON average_ticket_targets(branch_id);
CREATE INDEX IF NOT EXISTS idx_average_ticket_targets_cashier 
  ON average_ticket_targets(cashier_id);

-- 3. Performance Alerts - تنبيهات الأداء الفورية
CREATE TABLE IF NOT EXISTS performance_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  cashier_id VARCHAR REFERENCES users(id),
  shift_type TEXT,
  alert_date TEXT NOT NULL,
  alert_time TEXT NOT NULL,
  target_amount REAL,
  current_amount REAL,
  achievement_percent REAL,
  message TEXT NOT NULL,
  message_ar TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by VARCHAR REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_performance_alerts_branch_date 
  ON performance_alerts(branch_id, alert_date);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_unread 
  ON performance_alerts(branch_id, is_read) WHERE is_read = FALSE;

-- 4. Shift Performance Tracking - تتبع أداء الشفت المباشر
CREATE TABLE IF NOT EXISTS shift_performance_tracking (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  tracking_date TEXT NOT NULL,
  shift_type TEXT NOT NULL,
  shift_start_time TEXT NOT NULL,
  shift_end_time TEXT,
  shift_target_amount REAL NOT NULL,
  expected_at_current_time REAL DEFAULT 0,
  current_sales_amount REAL NOT NULL DEFAULT 0,
  current_transactions INTEGER DEFAULT 0,
  current_average_ticket REAL DEFAULT 0,
  current_cashier_count INTEGER DEFAULT 0,
  achievement_percent REAL DEFAULT 0,
  progress_status TEXT DEFAULT 'on_track',
  estimated_end_amount REAL DEFAULT 0,
  top_cashier_id VARCHAR REFERENCES users(id),
  top_cashier_sales REAL DEFAULT 0,
  lowest_cashier_id VARCHAR REFERENCES users(id),
  lowest_cashier_sales REAL DEFAULT 0,
  last_updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shift_performance_tracking_branch_date 
  ON shift_performance_tracking(branch_id, tracking_date);
CREATE INDEX IF NOT EXISTS idx_shift_performance_tracking_active 
  ON shift_performance_tracking(branch_id, tracking_date, shift_type);

-- Unique constraint to prevent duplicate tracking records
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_performance_tracking_unique 
  ON shift_performance_tracking(branch_id, tracking_date, shift_type);

-- ==========================================
-- Grant permissions (if using RLS)
-- ==========================================
-- ALTER TABLE cashier_shift_targets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE average_ticket_targets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shift_performance_tracking ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Success message
-- ==========================================
SELECT 'Shift & Cashier Targets tables created successfully!' as message;
