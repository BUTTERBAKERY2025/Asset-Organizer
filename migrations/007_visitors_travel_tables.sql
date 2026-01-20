-- Migration: Visitor Management & Travel Management Tables
-- Date: 2026-01-20
-- Description: جداول سجل الزوار وإدارة السفر والحجوزات

-- =====================================================
-- سجل الزوار - Visitor Management
-- =====================================================

-- Visitors - الزوار
CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id),
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
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitors_branch ON visitors(branch_id);
CREATE INDEX IF NOT EXISTS idx_visitors_national_id ON visitors(national_id);
CREATE INDEX IF NOT EXISTS idx_visitors_phone ON visitors(phone);
CREATE INDEX IF NOT EXISTS idx_visitors_company ON visitors(company);

-- Visitor Logs - سجل الزيارات
CREATE TABLE IF NOT EXISTS visitor_logs (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id),
    visitor_id INTEGER REFERENCES visitors(id),
    visit_number TEXT,
    visit_date TIMESTAMP DEFAULT NOW() NOT NULL,
    visit_purpose TEXT NOT NULL,
    visit_type TEXT DEFAULT 'business',
    host_id VARCHAR(50) REFERENCES users(id),
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
    registered_by VARCHAR(50) REFERENCES users(id),
    registered_by_name TEXT,
    checked_out_by VARCHAR(50) REFERENCES users(id),
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

-- =====================================================
-- إدارة السفر والحجوزات - Travel Management
-- =====================================================

-- Travel Requests - طلبات السفر
CREATE TABLE IF NOT EXISTS travel_requests (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id),
    request_number TEXT,
    requester_id VARCHAR(50) REFERENCES users(id),
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
    estimated_flight_cost NUMERIC(12,2),
    estimated_hotel_cost NUMERIC(12,2),
    estimated_transport_cost NUMERIC(12,2),
    estimated_meals_cost NUMERIC(12,2),
    estimated_other_cost NUMERIC(12,2),
    total_estimated_cost NUMERIC(12,2),
    currency TEXT DEFAULT 'SAR',
    status TEXT DEFAULT 'draft',
    manager_approval TEXT DEFAULT 'pending',
    manager_approval_date TIMESTAMP,
    manager_approval_by VARCHAR(50) REFERENCES users(id),
    manager_approval_notes TEXT,
    finance_approval TEXT DEFAULT 'pending',
    finance_approval_date TIMESTAMP,
    finance_approval_by VARCHAR(50) REFERENCES users(id),
    finance_approval_notes TEXT,
    actual_flight_cost NUMERIC(12,2),
    actual_hotel_cost NUMERIC(12,2),
    actual_transport_cost NUMERIC(12,2),
    actual_meals_cost NUMERIC(12,2),
    actual_other_cost NUMERIC(12,2),
    total_actual_cost NUMERIC(12,2),
    flight_details JSONB,
    hotel_details JSONB,
    transport_details JSONB,
    attachments JSONB,
    notes TEXT,
    trip_report TEXT,
    trip_report_date TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_travel_requests_branch ON travel_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_requester ON travel_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_status ON travel_requests(status);
CREATE INDEX IF NOT EXISTS idx_travel_requests_dates ON travel_requests(departure_date, return_date);
CREATE INDEX IF NOT EXISTS idx_travel_requests_number ON travel_requests(request_number);

-- Travel Expenses - مصروفات السفر
CREATE TABLE IF NOT EXISTS travel_expenses (
    id SERIAL PRIMARY KEY,
    travel_request_id INTEGER NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    expense_type TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'SAR',
    expense_date TIMESTAMP NOT NULL,
    receipt_number TEXT,
    receipt_url TEXT,
    vendor TEXT,
    status TEXT DEFAULT 'pending',
    approved_by VARCHAR(50) REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    notes TEXT,
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_travel_expenses_request ON travel_expenses(travel_request_id);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_type ON travel_expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_status ON travel_expenses(status);
