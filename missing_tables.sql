-- =====================================================
-- الجداول الناقصة في قاعدة البيانات الخارجية (Supabase)
-- قم بتشغيل هذا الملف في Supabase SQL Editor
-- =====================================================

-- 1. طلبات نقل الموظفين
CREATE TABLE IF NOT EXISTS employee_transfer_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES branch_employees(id),
  source_branch_id VARCHAR NOT NULL REFERENCES branches(id),
  destination_branch_id VARCHAR NOT NULL REFERENCES branches(id),
  requested_by VARCHAR NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  effective_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_approver_role TEXT DEFAULT 'source_manager',
  rejection_reason TEXT,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transfer_employee ON employee_transfer_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_transfer_source ON employee_transfer_requests(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfer_dest ON employee_transfer_requests(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status ON employee_transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requested_by ON employee_transfer_requests(requested_by);

-- 2. خطوات الموافقة على النقل
CREATE TABLE IF NOT EXISTS transfer_approval_steps (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES employee_transfer_requests(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  approver_role TEXT NOT NULL,
  approver_id VARCHAR REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  action_taken_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_transfer ON transfer_approval_steps(transfer_id);
CREATE INDEX IF NOT EXISTS idx_approval_approver ON transfer_approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON transfer_approval_steps(status);

-- 3. سجل تاريخ النقل
CREATE TABLE IF NOT EXISTS transfer_history (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES employee_transfer_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  performed_by VARCHAR REFERENCES users(id),
  details JSONB,
  event_timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_history_transfer ON transfer_history(transfer_id);
CREATE INDEX IF NOT EXISTS idx_history_event ON transfer_history(event_type);

-- 4. بيانات المبيعات اليومية
CREATE TABLE IF NOT EXISTS daily_sales_data (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  sales_date DATE NOT NULL,
  product_name TEXT NOT NULL,
  product_category TEXT,
  quantity_sold INTEGER DEFAULT 0,
  sales_value REAL DEFAULT 0,
  unit_price REAL,
  upload_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_sales_branch ON daily_sales_data(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales_data(sales_date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_product ON daily_sales_data(product_name);
CREATE INDEX IF NOT EXISTS idx_daily_sales_upload ON daily_sales_data(upload_id);

-- 5. ملفات رفع المقارنات
CREATE TABLE IF NOT EXISTS comparison_uploads (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT 'excel',
  data_type TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  total_records INTEGER DEFAULT 0,
  total_value REAL DEFAULT 0,
  unique_products INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  uploaded_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comparison_uploads_branch ON comparison_uploads(branch_id);
CREATE INDEX IF NOT EXISTS idx_comparison_uploads_type ON comparison_uploads(data_type);
CREATE INDEX IF NOT EXISTS idx_comparison_uploads_status ON comparison_uploads(status);

-- 6. مقارنة الإنتاج والمبيعات اليومية
CREATE TABLE IF NOT EXISTS daily_comparisons (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  comparison_date DATE NOT NULL,
  product_name TEXT NOT NULL,
  product_category TEXT,
  produced_quantity INTEGER DEFAULT 0,
  sold_quantity INTEGER DEFAULT 0,
  difference INTEGER DEFAULT 0,
  difference_percent REAL DEFAULT 0,
  production_value REAL DEFAULT 0,
  sales_value REAL DEFAULT 0,
  value_difference REAL DEFAULT 0,
  waste_value REAL DEFAULT 0,
  is_storable BOOLEAN DEFAULT FALSE,
  storage_notes TEXT,
  status TEXT DEFAULT 'normal',
  status_changed_by VARCHAR,
  status_changed_at TIMESTAMP,
  status_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_comparisons_branch ON daily_comparisons(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_comparisons_date ON daily_comparisons(comparison_date);
CREATE INDEX IF NOT EXISTS idx_daily_comparisons_product ON daily_comparisons(product_name);
CREATE INDEX IF NOT EXISTS idx_daily_comparisons_category ON daily_comparisons(product_category);
CREATE INDEX IF NOT EXISTS idx_daily_comparisons_status ON daily_comparisons(status);

-- 7. ملخص المقارنات
CREATE TABLE IF NOT EXISTS comparison_summaries (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_produced INTEGER DEFAULT 0,
  total_sold INTEGER DEFAULT 0,
  total_waste INTEGER DEFAULT 0,
  total_shortage INTEGER DEFAULT 0,
  production_value REAL DEFAULT 0,
  sales_value REAL DEFAULT 0,
  waste_value REAL DEFAULT 0,
  waste_percent REAL DEFAULT 0,
  shortage_percent REAL DEFAULT 0,
  efficiency_score REAL DEFAULT 0,
  top_waste_products JSONB,
  top_shortage_products JSONB,
  category_breakdown JSONB,
  recommendations JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comparison_summaries_branch ON comparison_summaries(branch_id);
CREATE INDEX IF NOT EXISTS idx_comparison_summaries_period ON comparison_summaries(period_type);
CREATE INDEX IF NOT EXISTS idx_comparison_summaries_dates ON comparison_summaries(period_start, period_end);

-- 8. سجل تغييرات حالة المقارنة
CREATE TABLE IF NOT EXISTS comparison_status_history (
  id SERIAL PRIMARY KEY,
  comparison_id INTEGER NOT NULL REFERENCES daily_comparisons(id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_history_comparison ON comparison_status_history(comparison_id);
CREATE INDEX IF NOT EXISTS idx_status_history_date ON comparison_status_history(created_at);

-- 9. إعدادات تخزين المنتجات
CREATE TABLE IF NOT EXISTS product_storage_settings (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE,
  product_category TEXT,
  suggested_category TEXT,
  confidence_score INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR,
  verified_at TIMESTAMP,
  is_storable BOOLEAN DEFAULT FALSE,
  max_storage_days INTEGER DEFAULT 0,
  storage_type TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_product_storage_name ON product_storage_settings(product_name);
CREATE INDEX IF NOT EXISTS idx_product_storage_category ON product_storage_settings(product_category);
CREATE INDEX IF NOT EXISTS idx_product_storage_verified ON product_storage_settings(is_verified);

-- 10. أسعار المنتجات
CREATE TABLE IF NOT EXISTS product_prices (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  branch_id VARCHAR REFERENCES branches(id),
  price REAL NOT NULL,
  cost_price REAL,
  currency VARCHAR(3) DEFAULT 'SAR',
  effective_date DATE NOT NULL DEFAULT NOW(),
  source TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_product_prices_name ON product_prices(product_name);
CREATE INDEX IF NOT EXISTS idx_product_prices_branch ON product_prices(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_date ON product_prices(effective_date);

-- 11. قواعد مخاطر الهدر
CREATE TABLE IF NOT EXISTS waste_risk_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  branch_id VARCHAR REFERENCES branches(id),
  category TEXT,
  product_name TEXT,
  threshold_type TEXT NOT NULL,
  threshold_value REAL NOT NULL,
  period_days INTEGER DEFAULT 1,
  severity TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waste_rules_branch ON waste_risk_rules(branch_id);
CREATE INDEX IF NOT EXISTS idx_waste_rules_category ON waste_risk_rules(category);
CREATE INDEX IF NOT EXISTS idx_waste_rules_active ON waste_risk_rules(is_active);

-- 12. تنبيهات مخاطر الهدر
CREATE TABLE IF NOT EXISTS waste_risk_alerts (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES waste_risk_rules(id),
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  alert_date DATE NOT NULL,
  product_name TEXT,
  category TEXT,
  current_value REAL NOT NULL,
  threshold_value REAL NOT NULL,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  acknowledged_by VARCHAR REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  resolved_by VARCHAR REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waste_alerts_rule ON waste_risk_alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_waste_alerts_branch ON waste_risk_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_waste_alerts_date ON waste_risk_alerts(alert_date);
CREATE INDEX IF NOT EXISTS idx_waste_alerts_status ON waste_risk_alerts(status);
CREATE INDEX IF NOT EXISTS idx_waste_alerts_severity ON waste_risk_alerts(severity);

-- 13. حسابات السوشيال ميديا
CREATE TABLE IF NOT EXISTS social_accounts (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  account_id TEXT,
  account_name TEXT NOT NULL,
  account_handle TEXT,
  profile_url TEXT,
  page_id TEXT,
  profile_image_url TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  branch_id VARCHAR REFERENCES branches(id),
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at TIMESTAMP,
  connection_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_branch ON social_accounts(branch_id);

-- 14. منشورات السوشيال ميديا
CREATE TABLE IF NOT EXISTS social_posts (
  id SERIAL PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  content_ar TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  hashtags TEXT[],
  status TEXT NOT NULL DEFAULT 'draft',
  platforms TEXT[] NOT NULL,
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  failed_reason TEXT,
  campaign_id INTEGER REFERENCES marketing_campaigns(id),
  calendar_event_id INTEGER REFERENCES marketing_calendar_events(id),
  influencer_id INTEGER REFERENCES marketing_influencers(id),
  created_by VARCHAR REFERENCES users(id),
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  post_type TEXT DEFAULT 'regular',
  link_url TEXT,
  call_to_action TEXT,
  target_audience TEXT,
  is_promoted BOOLEAN DEFAULT FALSE,
  promotion_budget REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_campaign ON social_posts(campaign_id);

-- 15. إحصائيات المنشورات
CREATE TABLE IF NOT EXISTS social_post_metrics (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_metrics_post ON social_post_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_social_metrics_platform ON social_post_metrics(platform);

-- 16. قوالب المحتوى
CREATE TABLE IF NOT EXISTS social_content_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  content_ar TEXT,
  default_hashtags TEXT[],
  default_media_type TEXT,
  placeholder_fields TEXT[],
  suitable_platforms TEXT[],
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_templates_category ON social_content_templates(category);

-- 17. أوقات النشر المفضلة
CREATE TABLE IF NOT EXISTS social_schedule_slots (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  time_slot TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  engagement_score REAL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_platform ON social_schedule_slots(platform);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_day ON social_schedule_slots(day_of_week);

-- =====================================================
-- تم الانتهاء - 17 جدول مع جميع الفهارس والعلاقات
-- =====================================================
