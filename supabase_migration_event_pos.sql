-- ============================================================
-- تحديث نقطة بيع الإيفنتات (Event POS)
-- نفّذ هذا السكربت في Supabase SQL Editor قبل نشر الكود على Render
-- السكربت آمن لإعادة التنفيذ (IF NOT EXISTS)
-- ============================================================

-- 1) جدول الإيفنتات
CREATE TABLE IF NOT EXISTS pos_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  invoice_prefix TEXT,
  notes TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_events_branch ON pos_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_events_status ON pos_events(status);

-- 2) جدول ورديات الكاشير
CREATE TABLE IF NOT EXISTS pos_shifts (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES pos_events(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cashier_id VARCHAR NOT NULL REFERENCES users(id),
  cashier_name TEXT NOT NULL,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP,
  opening_cash DOUBLE PRECISION NOT NULL DEFAULT 0,
  expected_cash DOUBLE PRECISION,
  expected_network DOUBLE PRECISION,
  actual_cash DOUBLE PRECISION,
  actual_network DOUBLE PRECISION,
  cash_discrepancy DOUBLE PRECISION,
  sales_count INTEGER,
  sales_total DOUBLE PRECISION,
  refunds_total DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  closed_by VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_event ON pos_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_cashier ON pos_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_status ON pos_shifts(status);
-- وردية مفتوحة واحدة فقط لكل (إيفنت، كاشير) — يمنع سباق فتح ورديتين
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_shifts_open ON pos_shifts(event_id, cashier_id) WHERE status = 'open';

-- 3) جدول الاسترجاعات (الجزئية)
CREATE TABLE IF NOT EXISTS pos_refunds (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES pos_events(id),
  shift_id INTEGER REFERENCES pos_shifts(id),
  refund_number TEXT NOT NULL,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  vat_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL DEFAULT 'cash',
  reason TEXT,
  refunded_by VARCHAR NOT NULL,
  refunded_by_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_refunds_sale ON pos_refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_refunds_event ON pos_refunds(event_id);

-- 4) جدول أصناف الاسترجاع
CREATE TABLE IF NOT EXISTS pos_refund_items (
  id SERIAL PRIMARY KEY,
  refund_id INTEGER NOT NULL REFERENCES pos_refunds(id) ON DELETE CASCADE,
  sale_item_id INTEGER NOT NULL REFERENCES pos_sale_items(id),
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DOUBLE PRECISION NOT NULL,
  vat_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_price DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pos_refund_items_refund ON pos_refund_items(refund_id);

-- 5) أعمدة جديدة على الجداول الحالية
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS event_id INTEGER;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS shift_id INTEGER;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS refunded_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pos_held_orders ADD COLUMN IF NOT EXISTS event_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_pos_sales_event ON pos_sales(event_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_shift ON pos_sales(shift_id);

-- تم — لا حاجة لأي بيانات أولية

-- ===== حماية من تكرار الفواتير (Idempotency) =====
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_sales_idempotency ON pos_sales (branch_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ===== حماية من تكرار الاسترجاعات (Idempotency) =====
ALTER TABLE pos_refunds ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_refunds_idempotency ON pos_refunds (sale_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- تذكيرات توقيع الإنذارات (Task #23)
ALTER TABLE employee_warnings ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;
ALTER TABLE employee_warnings ADD COLUMN IF NOT EXISTS last_reminder_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_queue_warning_reminder ON notification_queue (related_module, related_entity_id, channel) WHERE related_module = 'warning_signature_reminder';

-- ===== 2026-07-29: performance evaluations (task #28) =====
CREATE TABLE IF NOT EXISTS employee_evaluations (
  id serial PRIMARY KEY,
  branch_employee_id integer NOT NULL REFERENCES branch_employees(id) ON DELETE CASCADE,
  branch_id varchar NOT NULL REFERENCES branches(id),
  period_type text NOT NULL DEFAULT 'quarterly',
  period_start text NOT NULL,
  period_end text NOT NULL,
  criteria jsonb NOT NULL,
  overall_score real NOT NULL DEFAULT 0,
  strengths text,
  improvements text,
  goals text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  evaluator_id varchar REFERENCES users(id),
  evaluator_name text,
  approved_by varchar REFERENCES users(id),
  approved_by_name text,
  approved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_employee ON employee_evaluations (branch_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_branch ON employee_evaluations (branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_status ON employee_evaluations (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_evaluations_period ON employee_evaluations (branch_employee_id, period_type, period_start);

-- ===== 2026-07-30: evaluation employee acknowledgment =====
ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS employee_ack_at timestamp;
ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS employee_ack_comment text;

-- ===== 022: cashier deficit posting (applied to prod 2026-07-29) =====
-- 022: ترحيل عجوزات يوميات المبيعات للكاشير إلى السلف والقروض
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر التحديث على Render

ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_deduction_id integer;
ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_posted_by varchar REFERENCES users(id);
ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_posted_at timestamp;
CREATE INDEX IF NOT EXISTS idx_cashier_journals_deficit_posted ON cashier_sales_journals(deficit_deduction_id);

-- ============================================================
-- 2026-07-29: أعمدة ناقصة في salary_closure_lines على الإنتاج
-- (خصم الإجازات المرضية + حالة الموظف وقت الإقفال)
-- كانت تسبب انهيار /api/my/payslips في بوابتي (column does not exist)
-- ============================================================
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS sick_leave_deduction real DEFAULT 0;
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS sick_three_quarter_days real DEFAULT 0;
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS sick_unpaid_days real DEFAULT 0;
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS employee_status text;

-- ============================================================
-- 2026-07-29: معالجة انحراف مخطط الإنتاج (كان يكسر /api/my/payslips وبوابة المساهمين)
-- أعمدة ناقصة متفرقة + إنشاء جداول المساهمين الأربعة
-- ============================================================
ALTER TABLE biometric_credentials ADD COLUMN IF NOT EXISTS verification_pin text;
ALTER TABLE project_daily_log_photos ADD COLUMN IF NOT EXISTS photo_type text DEFAULT 'during';
ALTER TABLE report_runs ADD COLUMN IF NOT EXISTS message_body text;
ALTER TABLE report_runs ADD COLUMN IF NOT EXISTS summary jsonb;
ALTER TABLE security_violation_alerts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE voting_audit_log ADD COLUMN IF NOT EXISTS proxy_id integer;

--
-- PostgreSQL database dump
--

\restrict VejCNbU80sKn9IiGUTvBPyhQUh3DuLm8XoXkxuqF8tjpYqNuKuzC8wjkP4WDDla

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: shareholder_profile_update_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shareholder_profile_update_requests (
    id integer NOT NULL,
    shareholder_id integer NOT NULL,
    changes jsonb NOT NULL,
    note text,
    status text DEFAULT 'pending'::text NOT NULL,
    review_note text,
    reviewed_by character varying,
    reviewed_at timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shareholder_profile_update_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.shareholder_profile_update_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shareholder_profile_update_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shareholder_profile_update_requests_id_seq OWNED BY public.shareholder_profile_update_requests.id;


--
-- Name: shareholder_ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shareholder_ticket_messages (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    sender_type text NOT NULL,
    sender_user_id character varying,
    sender_name text,
    body text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shareholder_ticket_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.shareholder_ticket_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shareholder_ticket_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shareholder_ticket_messages_id_seq OWNED BY public.shareholder_ticket_messages.id;


--
-- Name: shareholder_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shareholder_tickets (
    id integer NOT NULL,
    shareholder_id integer NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    unread_by_admin boolean DEFAULT true NOT NULL,
    unread_by_shareholder boolean DEFAULT false NOT NULL,
    last_message_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shareholder_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.shareholder_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shareholder_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shareholder_tickets_id_seq OWNED BY public.shareholder_tickets.id;


--
-- Name: shareholders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shareholders (
    id integer NOT NULL,
    shareholder_type text NOT NULL,
    full_name text NOT NULL,
    national_id text,
    commercial_register text,
    email text,
    phone text,
    address text,
    nationality text,
    number_of_shares integer NOT NULL,
    share_percentage numeric(8,4) NOT NULL,
    share_class text DEFAULT 'common'::text,
    acquisition_date date NOT NULL,
    acquisition_price numeric(12,2),
    certificate_number text,
    bank_name text,
    bank_account_number text,
    iban text,
    is_board_member boolean DEFAULT false,
    board_member_id integer,
    voting_rights boolean DEFAULT true,
    dividend_rights boolean DEFAULT true,
    status text DEFAULT 'active'::text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    linked_user_id character varying,
    two_factor_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: shareholders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.shareholders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shareholders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shareholders_id_seq OWNED BY public.shareholders.id;


--
-- Name: shareholder_profile_update_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_profile_update_requests ALTER COLUMN id SET DEFAULT nextval('public.shareholder_profile_update_requests_id_seq'::regclass);


--
-- Name: shareholder_ticket_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_ticket_messages ALTER COLUMN id SET DEFAULT nextval('public.shareholder_ticket_messages_id_seq'::regclass);


--
-- Name: shareholder_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_tickets ALTER COLUMN id SET DEFAULT nextval('public.shareholder_tickets_id_seq'::regclass);


--
-- Name: shareholders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders ALTER COLUMN id SET DEFAULT nextval('public.shareholders_id_seq'::regclass);


--
-- Name: shareholder_profile_update_requests shareholder_profile_update_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_profile_update_requests
    ADD CONSTRAINT shareholder_profile_update_requests_pkey PRIMARY KEY (id);


--
-- Name: shareholder_ticket_messages shareholder_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_ticket_messages
    ADD CONSTRAINT shareholder_ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: shareholder_tickets shareholder_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_tickets
    ADD CONSTRAINT shareholder_tickets_pkey PRIMARY KEY (id);


--
-- Name: shareholders shareholders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_pkey PRIMARY KEY (id);


--
-- Name: idx_shareholder_profile_requests_shareholder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholder_profile_requests_shareholder ON public.shareholder_profile_update_requests USING btree (shareholder_id);


--
-- Name: idx_shareholder_profile_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholder_profile_requests_status ON public.shareholder_profile_update_requests USING btree (status);


--
-- Name: idx_shareholder_ticket_messages_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholder_ticket_messages_ticket ON public.shareholder_ticket_messages USING btree (ticket_id);


--
-- Name: idx_shareholder_tickets_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholder_tickets_last_message ON public.shareholder_tickets USING btree (last_message_at);


--
-- Name: idx_shareholder_tickets_shareholder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholder_tickets_shareholder ON public.shareholder_tickets USING btree (shareholder_id);


--
-- Name: idx_shareholder_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholder_tickets_status ON public.shareholder_tickets USING btree (status);


--
-- Name: idx_shareholders_percentage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholders_percentage ON public.shareholders USING btree (share_percentage);


--
-- Name: idx_shareholders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholders_status ON public.shareholders USING btree (status);


--
-- Name: idx_shareholders_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_shareholders_type ON public.shareholders USING btree (shareholder_type);


--
-- Name: uq_shareholder_pending_profile_request; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS uq_shareholder_pending_profile_request ON public.shareholder_profile_update_requests USING btree (shareholder_id) WHERE (status = 'pending'::text);


--
-- Name: shareholder_profile_update_requests shareholder_profile_update_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_profile_update_requests
    ADD CONSTRAINT shareholder_profile_update_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: shareholder_profile_update_requests shareholder_profile_update_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_profile_update_requests
    ADD CONSTRAINT shareholder_profile_update_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: shareholder_profile_update_requests shareholder_profile_update_requests_shareholder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_profile_update_requests
    ADD CONSTRAINT shareholder_profile_update_requests_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id) ON DELETE CASCADE;


--
-- Name: shareholder_ticket_messages shareholder_ticket_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_ticket_messages
    ADD CONSTRAINT shareholder_ticket_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES public.users(id);


--
-- Name: shareholder_ticket_messages shareholder_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_ticket_messages
    ADD CONSTRAINT shareholder_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.shareholder_tickets(id) ON DELETE CASCADE;


--
-- Name: shareholder_tickets shareholder_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_tickets
    ADD CONSTRAINT shareholder_tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: shareholder_tickets shareholder_tickets_shareholder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholder_tickets
    ADD CONSTRAINT shareholder_tickets_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id) ON DELETE CASCADE;


--
-- Name: shareholders shareholders_board_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id);


--
-- Name: shareholders shareholders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: shareholders shareholders_linked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict VejCNbU80sKn9IiGUTvBPyhQUh3DuLm8XoXkxuqF8tjpYqNuKuzC8wjkP4WDDla

