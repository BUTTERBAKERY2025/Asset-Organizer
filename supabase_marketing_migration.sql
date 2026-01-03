-- ============================================
-- إدارة التسويق - Marketing Management Tables
-- نظام باتر لإدارة المخابز
-- ============================================

-- 1. الحملات التسويقية - Marketing Campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    description TEXT,
    objective TEXT NOT NULL, -- brand_awareness, engagement, sales_increase, new_product, seasonal, event, loyalty
    season TEXT, -- summer, winter, spring, autumn, ramadan, eid, national_day, other
    status TEXT NOT NULL DEFAULT 'draft', -- draft, planned, active, paused, completed, cancelled
    total_budget REAL NOT NULL DEFAULT 0,
    spent_budget REAL NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT NOT NULL, -- YYYY-MM-DD
    target_audience TEXT,
    channels TEXT[], -- social, print, influencer, email, etc.
    kpis JSONB, -- Key Performance Indicators
    owner_id VARCHAR REFERENCES users(id),
    created_by VARCHAR REFERENCES users(id),
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. توزيع ميزانية الحملة على الفروع - Campaign Budget Allocations
CREATE TABLE IF NOT EXISTS campaign_budget_allocations (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    allocated_budget REAL NOT NULL,
    spent_amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. أهداف الحملة - Campaign Goals
CREATE TABLE IF NOT EXISTS campaign_goals (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL, -- sales_target, engagement_rate, impressions, reach, conversions
    target_value REAL NOT NULL,
    current_value REAL NOT NULL DEFAULT 0,
    unit TEXT, -- SAR, %, count
    description TEXT,
    deadline TEXT, -- YYYY-MM-DD
    is_achieved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. تقويم التسويق - Marketing Calendar Events
CREATE TABLE IF NOT EXISTS marketing_calendar_events (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL, -- campaign_start, campaign_end, content_deadline, meeting, reminder, milestone
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT, -- YYYY-MM-DD (optional for single-day events)
    start_time TEXT, -- HH:MM
    end_time TEXT, -- HH:MM
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    color TEXT, -- hex color for calendar display
    assigned_to VARCHAR REFERENCES users(id),
    reminder_minutes INTEGER, -- minutes before event
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_pattern TEXT, -- daily, weekly, monthly
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. المؤثرين والبلوجرز - Marketing Influencers
CREATE TABLE IF NOT EXISTS marketing_influencers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    email TEXT,
    phone TEXT,
    profile_image_url TEXT,
    specialty TEXT NOT NULL, -- food, lifestyle, family, beauty, fashion, fitness, travel, entertainment, tech, general
    platforms TEXT[], -- instagram, tiktok, twitter, youtube, snapchat, facebook, other
    content_types TEXT[], -- photo, video, story, reel, live, blog, podcast, review
    follower_count INTEGER DEFAULT 0,
    engagement_rate REAL, -- percentage
    avg_views INTEGER DEFAULT 0,
    price_per_post REAL,
    price_per_story REAL,
    price_per_video REAL,
    city TEXT,
    region TEXT,
    social_handles JSONB, -- { instagram: "@handle", tiktok: "@handle", ... }
    best_collaboration_times TEXT, -- description of best times
    notes TEXT,
    rating REAL, -- 1-5 rating based on past collaborations
    total_collaborations INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ai_insights JSONB, -- AI-generated insights about performance
    last_contact_date TEXT, -- YYYY-MM-DD
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. ربط المؤثرين بالحملات - Influencer Campaign Links
CREATE TABLE IF NOT EXISTS influencer_campaign_links (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
    campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, contacted, confirmed, in_progress, completed, cancelled
    contract_amount REAL,
    deliverables JSONB, -- array of expected deliverables
    deliverables_done JSONB, -- array of completed deliverables
    start_date TEXT, -- YYYY-MM-DD
    end_date TEXT, -- YYYY-MM-DD
    performance_score REAL, -- 1-100 score after campaign
    sales_impact REAL, -- estimated sales impact in SAR
    engagement_generated INTEGER,
    impressions_generated INTEGER,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. سجل التواصل مع المؤثرين - Influencer Contacts Log
CREATE TABLE IF NOT EXISTS influencer_contacts (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
    contact_type TEXT NOT NULL, -- call, email, whatsapp, meeting, social_dm
    contact_date TEXT NOT NULL, -- YYYY-MM-DD
    contact_time TEXT, -- HH:MM
    subject TEXT,
    notes TEXT,
    outcome TEXT, -- positive, negative, neutral, follow_up_needed
    next_follow_up TEXT, -- YYYY-MM-DD
    contacted_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. مهام فريق التسويق - Marketing Tasks
CREATE TABLE IF NOT EXISTS marketing_tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    assigned_to VARCHAR REFERENCES users(id),
    assigned_by VARCHAR REFERENCES users(id),
    priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled, blocked
    due_date TEXT, -- YYYY-MM-DD
    completed_at TIMESTAMP,
    estimated_hours REAL,
    actual_hours REAL,
    category TEXT, -- content, design, coordination, analysis, other
    attachments JSONB, -- array of attachment URLs
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. نشاط المهام - Marketing Task Activities
CREATE TABLE IF NOT EXISTS marketing_task_activities (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES marketing_tasks(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- comment, status_change, assignment, attachment, update
    description TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. تقارير أداء التسويق - Marketing Performance Reports
CREATE TABLE IF NOT EXISTS marketing_performance_reports (
    id SERIAL PRIMARY KEY,
    report_type TEXT NOT NULL, -- campaign, influencer, monthly, quarterly, yearly
    period_start TEXT NOT NULL, -- YYYY-MM-DD
    period_end TEXT NOT NULL, -- YYYY-MM-DD
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    branch_id VARCHAR REFERENCES branches(id),
    -- Metrics
    total_spend REAL DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    engagement_rate REAL DEFAULT 0,
    estimated_sales_impact REAL DEFAULT 0,
    actual_sales_impact REAL DEFAULT 0,
    roi REAL DEFAULT 0, -- Return on Investment percentage
    cost_per_engagement REAL DEFAULT 0,
    cost_per_impression REAL DEFAULT 0,
    -- Comparison with previous period
    previous_period_sales REAL,
    sales_growth REAL, -- percentage
    -- Additional data
    top_performing_content JSONB,
    top_influencers JSONB,
    recommendations JSONB, -- AI-generated recommendations
    generated_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. الأصول التسويقية - Marketing Assets
CREATE TABLE IF NOT EXISTS marketing_assets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- image, video, document, design, template
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    category TEXT, -- social, print, email, website
    tags TEXT[],
    file_size INTEGER, -- in bytes
    dimensions TEXT, -- e.g., "1080x1080"
    duration INTEGER, -- for videos, in seconds
    usage_count INTEGER DEFAULT 0,
    uploaded_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. أعضاء فريق التسويق - Marketing Team Members
CREATE TABLE IF NOT EXISTS marketing_team_members (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    role TEXT NOT NULL, -- manager, coordinator, designer, content_creator, analyst
    specialization TEXT, -- social_media, influencer_relations, content, analytics
    is_team_lead BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_branches TEXT[], -- branch IDs this member focuses on
    weekly_hours_capacity REAL DEFAULT 40,
    current_workload REAL DEFAULT 0, -- calculated from active tasks
    join_date TEXT, -- YYYY-MM-DD
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. تنبيهات التسويق - Marketing Alerts
CREATE TABLE IF NOT EXISTS marketing_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL, -- campaign_start, campaign_end, budget_warning, task_overdue, influencer_deadline
    severity TEXT NOT NULL, -- info, warning, critical
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES marketing_tasks(id) ON DELETE CASCADE,
    target_user_id VARCHAR REFERENCES users(id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by VARCHAR REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- الفهارس - Indexes for Performance
-- ============================================

-- Marketing Campaigns Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_objective ON marketing_campaigns(objective);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_dates ON marketing_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_owner ON marketing_campaigns(owner_id);

-- Campaign Budget Allocations Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_budget_allocations_campaign ON campaign_budget_allocations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_budget_allocations_branch ON campaign_budget_allocations(branch_id);

-- Campaign Goals Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_goals_campaign ON campaign_goals(campaign_id);

-- Marketing Calendar Events Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_calendar_events_dates ON marketing_calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_marketing_calendar_events_campaign ON marketing_calendar_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_calendar_events_assigned ON marketing_calendar_events(assigned_to);

-- Marketing Influencers Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_influencers_specialty ON marketing_influencers(specialty);
CREATE INDEX IF NOT EXISTS idx_marketing_influencers_active ON marketing_influencers(is_active);
CREATE INDEX IF NOT EXISTS idx_marketing_influencers_city ON marketing_influencers(city);

-- Influencer Campaign Links Indexes
CREATE INDEX IF NOT EXISTS idx_influencer_campaign_links_influencer ON influencer_campaign_links(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_campaign_links_campaign ON influencer_campaign_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_campaign_links_status ON influencer_campaign_links(status);

-- Influencer Contacts Indexes
CREATE INDEX IF NOT EXISTS idx_influencer_contacts_influencer ON influencer_contacts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_contacts_date ON influencer_contacts(contact_date);

-- Marketing Tasks Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_campaign ON marketing_tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_assigned ON marketing_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_status ON marketing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_priority ON marketing_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_due_date ON marketing_tasks(due_date);

-- Marketing Task Activities Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_task_activities_task ON marketing_task_activities(task_id);

-- Marketing Performance Reports Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_performance_reports_type ON marketing_performance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_marketing_performance_reports_period ON marketing_performance_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_marketing_performance_reports_campaign ON marketing_performance_reports(campaign_id);

-- Marketing Assets Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_assets_campaign ON marketing_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_type ON marketing_assets(asset_type);

-- Marketing Team Members Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_team_members_user ON marketing_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_team_members_active ON marketing_team_members(is_active);

-- Marketing Alerts Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_alerts_campaign ON marketing_alerts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_alerts_task ON marketing_alerts(task_id);
CREATE INDEX IF NOT EXISTS idx_marketing_alerts_target_user ON marketing_alerts(target_user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_alerts_read ON marketing_alerts(is_read);

-- ============================================
-- تعليقات الجداول - Table Comments
-- ============================================

COMMENT ON TABLE marketing_campaigns IS 'الحملات التسويقية - Marketing Campaigns';
COMMENT ON TABLE campaign_budget_allocations IS 'توزيع ميزانية الحملة على الفروع - Campaign Budget Allocations per Branch';
COMMENT ON TABLE campaign_goals IS 'أهداف الحملة التسويقية - Campaign Goals';
COMMENT ON TABLE marketing_calendar_events IS 'تقويم التسويق والفعاليات - Marketing Calendar Events';
COMMENT ON TABLE marketing_influencers IS 'قاعدة بيانات المؤثرين والبلوجرز - Marketing Influencers Database';
COMMENT ON TABLE influencer_campaign_links IS 'ربط المؤثرين بالحملات التسويقية - Influencer-Campaign Relationships';
COMMENT ON TABLE influencer_contacts IS 'سجل التواصل مع المؤثرين - Influencer Contact Log';
COMMENT ON TABLE marketing_tasks IS 'مهام فريق التسويق - Marketing Team Tasks';
COMMENT ON TABLE marketing_task_activities IS 'سجل نشاط المهام - Task Activity Log';
COMMENT ON TABLE marketing_performance_reports IS 'تقارير أداء التسويق - Marketing Performance Reports';
COMMENT ON TABLE marketing_assets IS 'الأصول التسويقية (صور، فيديوهات، تصاميم) - Marketing Assets';
COMMENT ON TABLE marketing_team_members IS 'أعضاء فريق التسويق - Marketing Team Members';
COMMENT ON TABLE marketing_alerts IS 'تنبيهات وإشعارات التسويق - Marketing Alerts';
