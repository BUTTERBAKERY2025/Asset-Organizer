-- =====================================================
-- الجداول الناقصة التي تحتاج إضافتها في Supabase
-- تاريخ التوليد: 2026-02-08
-- العدد: 22 جدول
-- =====================================================

-- 1. Financial Periods - الفترات المالية
CREATE TABLE IF NOT EXISTS financial_periods (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  period_type TEXT NOT NULL DEFAULT 'monthly',
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_revenue REAL DEFAULT 0,
  target_gross_margin REAL DEFAULT 0,
  target_net_margin REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_periods_branch ON financial_periods(branch_id);
CREATE INDEX IF NOT EXISTS idx_financial_periods_date ON financial_periods(year, month);

-- 2. Financial Sales - المبيعات المالية
CREATE TABLE IF NOT EXISTS financial_sales (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  category TEXT,
  shift TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  avg_invoice_value REAL DEFAULT 0,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_sales_period ON financial_sales(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_sales_channel ON financial_sales(channel);

-- 3. Financial COGS - تكلفة البضائع المباعة
CREATE TABLE IF NOT EXISTS financial_cogs (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  waste_amount REAL DEFAULT 0,
  waste_pct REAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_cogs_period ON financial_cogs(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_cogs_type ON financial_cogs(item_type);

-- 4. Financial Operating Expenses - المصروفات التشغيلية
CREATE TABLE IF NOT EXISTS financial_operating_expenses (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_opex_period ON financial_operating_expenses(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_opex_type ON financial_operating_expenses(expense_type);

-- 5. Financial Fixed Costs - التكاليف الثابتة
CREATE TABLE IF NOT EXISTS financial_fixed_costs (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_fixed_period ON financial_fixed_costs(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_fixed_type ON financial_fixed_costs(cost_type);

-- 6. Financial Metrics - المؤشرات المالية
CREATE TABLE IF NOT EXISTS financial_metrics (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  total_revenue REAL DEFAULT 0,
  total_cogs REAL DEFAULT 0,
  total_operating_expenses REAL DEFAULT 0,
  total_fixed_costs REAL DEFAULT 0,
  gross_profit REAL DEFAULT 0,
  net_profit REAL DEFAULT 0,
  gross_margin_pct REAL DEFAULT 0,
  net_margin_pct REAL DEFAULT 0,
  break_even_sales REAL DEFAULT 0,
  salary_to_sales_pct REAL DEFAULT 0,
  rent_to_revenue_pct REAL DEFAULT 0,
  waste_pct REAL DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  avg_invoice_value REAL DEFAULT 0,
  ebitda REAL DEFAULT 0,
  ebitda_margin_pct REAL DEFAULT 0,
  contribution_margin REAL DEFAULT 0,
  contribution_margin_pct REAL DEFAULT 0,
  labor_productivity REAL DEFAULT 0,
  revenue_per_employee REAL DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  operating_profit REAL DEFAULT 0,
  operating_margin_pct REAL DEFAULT 0,
  rating TEXT DEFAULT 'average',
  rating_reasons JSONB,
  recommendations JSONB,
  calculated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_period ON financial_metrics(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_rating ON financial_metrics(rating);

-- 7. Influencer Payments - مدفوعات المؤثرين
CREATE TABLE IF NOT EXISTS influencer_payments (
  id SERIAL PRIMARY KEY,
  influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_date TEXT NOT NULL,
  payment_method TEXT,
  reference_number TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  invoice_number TEXT,
  attachment_url TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  approved_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 8. Visitors - الزوار
CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  full_name TEXT NOT NULL,
  national_id TEXT,
  phone TEXT,
  email TEXT,
  company TEXT,
  nationality TEXT,
  id_type TEXT DEFAULT 'national_id',
  photo_url TEXT,
  notes TEXT,
  is_blacklisted BOOLEAN DEFAULT FALSE,
  blacklist_reason TEXT,
  visit_count INTEGER DEFAULT 0,
  last_visit_at TIMESTAMP,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitors_branch ON visitors(branch_id);
CREATE INDEX IF NOT EXISTS idx_visitors_national_id ON visitors(national_id);
CREATE INDEX IF NOT EXISTS idx_visitors_phone ON visitors(phone);
CREATE INDEX IF NOT EXISTS idx_visitors_company ON visitors(company);

-- 9. Visitor Logs - سجل الزيارات
CREATE TABLE IF NOT EXISTS visitor_logs (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  visitor_id INTEGER REFERENCES visitors(id),
  visit_number TEXT,
  visit_date TIMESTAMP DEFAULT NOW() NOT NULL,
  visit_purpose TEXT NOT NULL,
  visit_type TEXT DEFAULT 'business',
  host_id VARCHAR REFERENCES users(id),
  host_name TEXT,
  host_department TEXT,
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  expected_duration INTEGER,
  actual_duration INTEGER,
  status TEXT DEFAULT 'checked_in',
  badge_number TEXT,
  badge_issued BOOLEAN DEFAULT FALSE,
  badge_returned BOOLEAN DEFAULT FALSE,
  vehicle_plate TEXT,
  items_carried TEXT,
  access_areas TEXT[],
  escort_required BOOLEAN DEFAULT FALSE,
  escort_name TEXT,
  notes TEXT,
  visitor_signature TEXT,
  host_signature TEXT,
  security_notes TEXT,
  registered_by VARCHAR REFERENCES users(id),
  registered_by_name TEXT,
  checked_out_by VARCHAR REFERENCES users(id),
  checked_out_by_name TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_branch ON visitor_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor ON visitor_logs(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_host ON visitor_logs(host_id);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_date ON visitor_logs(visit_date);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_status ON visitor_logs(status);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_number ON visitor_logs(visit_number);

-- 10. Travel Requests - طلبات السفر
CREATE TABLE IF NOT EXISTS travel_requests (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  request_number TEXT,
  requester_id VARCHAR REFERENCES users(id),
  requester_name TEXT,
  requester_department TEXT,
  requester_job_title TEXT,
  trip_title TEXT NOT NULL,
  trip_purpose TEXT NOT NULL,
  trip_type TEXT DEFAULT 'business',
  departure_city TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_country TEXT,
  departure_date TIMESTAMP NOT NULL,
  return_date TIMESTAMP NOT NULL,
  trip_duration INTEGER,
  needs_flight BOOLEAN DEFAULT TRUE,
  needs_hotel BOOLEAN DEFAULT TRUE,
  needs_transportation BOOLEAN DEFAULT FALSE,
  needs_visa BOOLEAN DEFAULT FALSE,
  estimated_flight_cost NUMERIC(12, 2),
  estimated_hotel_cost NUMERIC(12, 2),
  estimated_transport_cost NUMERIC(12, 2),
  estimated_meals_cost NUMERIC(12, 2),
  estimated_other_cost NUMERIC(12, 2),
  total_estimated_cost NUMERIC(12, 2),
  currency TEXT DEFAULT 'SAR',
  status TEXT DEFAULT 'draft',
  manager_approval TEXT DEFAULT 'pending',
  manager_approval_date TIMESTAMP,
  manager_approval_by VARCHAR REFERENCES users(id),
  manager_approval_notes TEXT,
  finance_approval TEXT DEFAULT 'pending',
  finance_approval_date TIMESTAMP,
  finance_approval_by VARCHAR REFERENCES users(id),
  finance_approval_notes TEXT,
  actual_flight_cost NUMERIC(12, 2),
  actual_hotel_cost NUMERIC(12, 2),
  actual_transport_cost NUMERIC(12, 2),
  actual_meals_cost NUMERIC(12, 2),
  actual_other_cost NUMERIC(12, 2),
  total_actual_cost NUMERIC(12, 2),
  flight_details JSONB,
  hotel_details JSONB,
  transport_details JSONB,
  attachments JSONB,
  notes TEXT,
  trip_report TEXT,
  trip_report_date TIMESTAMP,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_travel_requests_branch ON travel_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_requester ON travel_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_status ON travel_requests(status);
CREATE INDEX IF NOT EXISTS idx_travel_requests_dates ON travel_requests(departure_date, return_date);
CREATE INDEX IF NOT EXISTS idx_travel_requests_number ON travel_requests(request_number);

-- 11. Travel Expenses - مصروفات السفر
CREATE TABLE IF NOT EXISTS travel_expenses (
  id SERIAL PRIMARY KEY,
  travel_request_id INTEGER NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'SAR',
  expense_date TIMESTAMP NOT NULL,
  receipt_number TEXT,
  receipt_url TEXT,
  vendor TEXT,
  status TEXT DEFAULT 'pending',
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_request ON travel_expenses(travel_request_id);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_type ON travel_expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_status ON travel_expenses(status);

-- 12. Shareholder Documents - وثائق المساهمين
CREATE TABLE IF NOT EXISTS shareholder_documents (
  id SERIAL PRIMARY KEY,
  shareholder_id INTEGER NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  expiry_date DATE,
  notes TEXT,
  uploaded_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shareholder_docs_shareholder ON shareholder_documents(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_docs_type ON shareholder_documents(document_type);

-- 13. Board Committees - لجان مجلس الإدارة
CREATE TABLE IF NOT EXISTS board_committees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  committee_type TEXT NOT NULL,
  chairman_id INTEGER REFERENCES board_members(id),
  secretary_id INTEGER REFERENCES board_members(id),
  formation_date DATE NOT NULL,
  term_end_date DATE,
  mandate_document TEXT,
  meeting_frequency TEXT DEFAULT 'quarterly',
  quorum_required INTEGER DEFAULT 2,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_board_committees_type ON board_committees(committee_type);
CREATE INDEX IF NOT EXISTS idx_board_committees_status ON board_committees(status);

-- 14. Committee Memberships - عضوية اللجان
CREATE TABLE IF NOT EXISTS committee_memberships (
  id SERIAL PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES board_committees(id) ON DELETE CASCADE,
  board_member_id INTEGER NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  appointment_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_committee_memberships_committee ON committee_memberships(committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_memberships_member ON committee_memberships(board_member_id);
CREATE INDEX IF NOT EXISTS idx_committee_memberships_status ON committee_memberships(status);

-- 15. Interest Declarations - إفصاحات المصالح
CREATE TABLE IF NOT EXISTS interest_declarations (
  id SERIAL PRIMARY KEY,
  declaration_number TEXT NOT NULL UNIQUE,
  board_member_id INTEGER NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  declaration_type TEXT NOT NULL,
  declaration_date DATE NOT NULL,
  fiscal_year TEXT,
  related_party_name TEXT,
  relationship_type TEXT,
  description TEXT NOT NULL,
  transaction_type TEXT,
  transaction_value NUMERIC(15, 2),
  action_taken TEXT,
  board_decision TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  attachments JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interest_declarations_member ON interest_declarations(board_member_id);
CREATE INDEX IF NOT EXISTS idx_interest_declarations_type ON interest_declarations(declaration_type);
CREATE INDEX IF NOT EXISTS idx_interest_declarations_status ON interest_declarations(status);
CREATE INDEX IF NOT EXISTS idx_interest_declarations_year ON interest_declarations(fiscal_year);

-- 16. Board Member Training - تدريب أعضاء مجلس الإدارة
CREATE TABLE IF NOT EXISTS board_member_training (
  id SERIAL PRIMARY KEY,
  board_member_id INTEGER NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  training_type TEXT NOT NULL,
  title TEXT NOT NULL,
  provider TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  duration INTEGER,
  certificate_number TEXT,
  certificate_url TEXT,
  expiry_date DATE,
  status TEXT DEFAULT 'completed',
  score NUMERIC(5, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_board_member_training_member ON board_member_training(board_member_id);
CREATE INDEX IF NOT EXISTS idx_board_member_training_type ON board_member_training(training_type);
CREATE INDEX IF NOT EXISTS idx_board_member_training_status ON board_member_training(status);

-- 17. Proxy Votes - التصويت بالوكالة
CREATE TABLE IF NOT EXISTS proxy_votes (
  id SERIAL PRIMARY KEY,
  proxy_number TEXT NOT NULL UNIQUE,
  meeting_id INTEGER NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  principal_shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  proxy_holder_shareholder_id INTEGER REFERENCES shareholders(id),
  proxy_holder_name TEXT NOT NULL,
  proxy_holder_national_id TEXT,
  shares_represented INTEGER NOT NULL,
  voting_power NUMERIC(8, 4) NOT NULL,
  proxy_type TEXT NOT NULL,
  voting_instructions JSONB,
  document_url TEXT,
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending',
  verified_by VARCHAR REFERENCES users(id),
  verified_at TIMESTAMP,
  used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revocation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proxy_votes_meeting ON proxy_votes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_proxy_votes_principal ON proxy_votes(principal_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_proxy_votes_holder ON proxy_votes(proxy_holder_shareholder_id);
CREATE INDEX IF NOT EXISTS idx_proxy_votes_status ON proxy_votes(status);

-- 18. Voting Audit Log - سجل تدقيق التصويت
CREATE TABLE IF NOT EXISTS voting_audit_log (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER REFERENCES board_resolutions(id) ON DELETE CASCADE,
  meeting_id INTEGER REFERENCES governance_meetings(id),
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id VARCHAR,
  actor_name TEXT,
  vote_id INTEGER REFERENCES resolution_votes(id),
  proxy_id INTEGER REFERENCES proxy_votes(id),
  previous_value TEXT,
  new_value TEXT,
  voting_power NUMERIC(8, 4),
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  session_id TEXT,
  "timestamp" TIMESTAMP DEFAULT NOW() NOT NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  validation_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_voting_audit_resolution ON voting_audit_log(resolution_id);
CREATE INDEX IF NOT EXISTS idx_voting_audit_meeting ON voting_audit_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_voting_audit_action ON voting_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_voting_audit_actor ON voting_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_voting_audit_timestamp ON voting_audit_log("timestamp");

-- 19. Quorum Calculations - حساب النصاب
CREATE TABLE IF NOT EXISTS quorum_calculations (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  calculation_type TEXT NOT NULL,
  resolution_id INTEGER REFERENCES board_resolutions(id),
  calculated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  total_eligible_shares INTEGER NOT NULL,
  total_eligible_votes INTEGER NOT NULL,
  present_shares INTEGER NOT NULL,
  present_votes INTEGER NOT NULL,
  proxy_shares INTEGER DEFAULT 0,
  proxy_votes INTEGER DEFAULT 0,
  total_represented_shares INTEGER NOT NULL,
  total_represented_votes INTEGER NOT NULL,
  percentage_represented NUMERIC(8, 4) NOT NULL,
  required_quorum NUMERIC(5, 2) NOT NULL,
  quorum_met BOOLEAN NOT NULL,
  notes TEXT,
  calculated_by VARCHAR REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_quorum_calculations_meeting ON quorum_calculations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_quorum_calculations_resolution ON quorum_calculations(resolution_id);
CREATE INDEX IF NOT EXISTS idx_quorum_calculations_type ON quorum_calculations(calculation_type);

-- 20. Shift Audit Log - سجل تدقيق الشفتات
CREATE TABLE IF NOT EXISTS shift_audit_log (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES branch_shifts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by VARCHAR REFERENCES users(id),
  performed_by_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  gps_latitude NUMERIC(10, 7),
  gps_longitude NUMERIC(10, 7),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shift_audit_shift ON shift_audit_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_audit_action ON shift_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_shift_audit_date ON shift_audit_log(created_at);

-- 21. Branch Custom Checklist Items - بنود مخصصة للفروع
CREATE TABLE IF NOT EXISTS branch_custom_checklist_items (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  template_id INTEGER NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 100,
  requires_photo BOOLEAN DEFAULT FALSE,
  requires_note BOOLEAN DEFAULT FALSE,
  is_critical BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branch_custom_items_branch ON branch_custom_checklist_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_custom_items_template ON branch_custom_checklist_items(template_id);

-- 22. Shift Reminders - تذكيرات الشفتات
CREATE TABLE IF NOT EXISTS shift_reminders (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  reminder_type TEXT NOT NULL,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  reminder_time TIMESTAMP NOT NULL,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  notification_channels TEXT[] DEFAULT ARRAY['system'],
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shift_reminders_branch ON shift_reminders(branch_id);
CREATE INDEX IF NOT EXISTS idx_shift_reminders_date ON shift_reminders(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_reminders_sent ON shift_reminders(is_sent);

-- =====================================================
-- تعديلات على جداول موجودة
-- =====================================================

-- تعديل جدول average_ticket_targets (الأعمدة مختلفة عن الكود)
-- ملاحظة مهمة: هذا الجدول يحتوي على 2 سجلات - يفضل حذف وإعادة إنشاء
-- إذا كنت تريد الحفاظ على البيانات، نفذ ALTER TABLE بدلاً من DROP

-- الخيار 1: حذف وإعادة إنشاء (مستحسن إذا البيانات غير مهمة)
DROP TABLE IF EXISTS average_ticket_targets CASCADE;
CREATE TABLE average_ticket_targets (
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

-- =====================================================
-- تم الانتهاء - 22 جدول جديد + 1 جدول معدل
-- =====================================================
