-- ============================================
-- الجداول الناقصة فقط - Missing Tables Only
-- 4 جداول ناقصة من قاعدة بيانات Supabase
-- ============================================

-- ⚠️ يجب تنفيذها بالترتيب التالي:
-- 1. chart_of_accounts (لا يعتمد على جداول أخرى)
-- 2. accounting_journal_entries (يعتمد على branches, users)
-- 3. journal_entry_lines (يعتمد على accounting_journal_entries)
-- 4. accounting_reconciliations (يعتمد على branches, users)

CREATE TABLE public.chart_of_accounts (
    id integer NOT NULL,
    account_code text NOT NULL,
    account_name text NOT NULL,
    account_name_en text,
    account_type text NOT NULL,
    parent_code text,
    level integer DEFAULT 1,
    is_active text DEFAULT 'true'::text,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.chart_of_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.chart_of_accounts_id_seq OWNED BY public.chart_of_accounts.id;
ALTER TABLE ONLY public.chart_of_accounts ALTER COLUMN id SET DEFAULT nextval('public.chart_of_accounts_id_seq'::regclass);
ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_account_code_key UNIQUE (account_code);
ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);

CREATE TABLE public.accounting_journal_entries (
    id integer NOT NULL,
    entry_number text NOT NULL,
    entry_date text NOT NULL,
    entry_type text NOT NULL,
    description text NOT NULL,
    branch_id character varying,
    reference_type text,
    reference_id text,
    total_debit numeric(12,2) DEFAULT '0'::numeric,
    total_credit numeric(12,2) DEFAULT '0'::numeric,
    vat_amount numeric(12,2) DEFAULT '0'::numeric,
    currency text DEFAULT 'SAR'::text,
    status text DEFAULT 'draft'::text NOT NULL,
    reconciliation_status text DEFAULT 'pending'::text,
    reconciliation_notes text,
    posted_by character varying,
    posted_at timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.accounting_journal_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.accounting_journal_entries_id_seq OWNED BY public.accounting_journal_entries.id;
ALTER TABLE ONLY public.accounting_journal_entries ALTER COLUMN id SET DEFAULT nextval('public.accounting_journal_entries_id_seq'::regclass);
ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_pkey PRIMARY KEY (id);
CREATE INDEX idx_journal_entry_branch ON public.accounting_journal_entries USING btree (branch_id);
CREATE INDEX idx_journal_entry_date ON public.accounting_journal_entries USING btree (entry_date);
CREATE INDEX idx_journal_entry_status ON public.accounting_journal_entries USING btree (status);
CREATE INDEX idx_journal_entry_type ON public.accounting_journal_entries USING btree (entry_type);
CREATE INDEX idx_journal_reconciliation ON public.accounting_journal_entries USING btree (reconciliation_status);
ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);
ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id);

CREATE TABLE public.journal_entry_lines (
    id integer NOT NULL,
    journal_entry_id integer NOT NULL,
    line_number integer NOT NULL,
    account_code text NOT NULL,
    account_name text NOT NULL,
    description text,
    debit_amount numeric(12,2) DEFAULT '0'::numeric,
    credit_amount numeric(12,2) DEFAULT '0'::numeric,
    cost_center text,
    vat_code text,
    vat_rate numeric(5,2)
);
CREATE SEQUENCE public.journal_entry_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.journal_entry_lines_id_seq OWNED BY public.journal_entry_lines.id;
ALTER TABLE ONLY public.journal_entry_lines ALTER COLUMN id SET DEFAULT nextval('public.journal_entry_lines_id_seq'::regclass);
ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.accounting_journal_entries(id);

CREATE TABLE public.accounting_reconciliations (
    id integer NOT NULL,
    reconciliation_date text NOT NULL,
    period_from text NOT NULL,
    period_to text NOT NULL,
    branch_id character varying,
    total_system_sales numeric(12,2) DEFAULT '0'::numeric,
    total_actual_deposits numeric(12,2) DEFAULT '0'::numeric,
    total_variance numeric(12,2) DEFAULT '0'::numeric,
    total_waste_value numeric(12,2) DEFAULT '0'::numeric,
    total_purchases numeric(12,2) DEFAULT '0'::numeric,
    vat_collected numeric(12,2) DEFAULT '0'::numeric,
    vat_paid numeric(12,2) DEFAULT '0'::numeric,
    net_vat numeric(12,2) DEFAULT '0'::numeric,
    entries_count integer DEFAULT 0,
    matched_count integer DEFAULT 0,
    discrepancy_count integer DEFAULT 0,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    prepared_by character varying,
    approved_by character varying,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.accounting_reconciliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.accounting_reconciliations_id_seq OWNED BY public.accounting_reconciliations.id;
ALTER TABLE ONLY public.accounting_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.accounting_reconciliations_id_seq'::regclass);
ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_pkey PRIMARY KEY (id);
CREATE INDEX idx_reconciliation_branch ON public.accounting_reconciliations USING btree (branch_id);
CREATE INDEX idx_reconciliation_date ON public.accounting_reconciliations USING btree (reconciliation_date);
CREATE INDEX idx_reconciliation_status ON public.accounting_reconciliations USING btree (status);
ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);
ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.users(id);

