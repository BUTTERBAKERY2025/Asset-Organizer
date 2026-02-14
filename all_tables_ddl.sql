-- ============================================
-- جميع جداول نظام باتر لإدارة المخابز
-- Bater Bakery Management System - All Tables
-- ============================================

-- Table: accounting_exports
CREATE TABLE IF NOT EXISTS public.accounting_exports (
    id integer NOT NULL,
    export_type text NOT NULL,
    date_from text,
    date_to text,
    branch_id character varying,
    data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    synced_at timestamp without time zone,
    exported_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: accounting_journal_entries
CREATE TABLE IF NOT EXISTS public.accounting_journal_entries (
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

-- Table: accounting_reconciliations
CREATE TABLE IF NOT EXISTS public.accounting_reconciliations (
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

-- Table: advanced_production_orders
CREATE TABLE IF NOT EXISTS public.advanced_production_orders (
    id integer NOT NULL,
    order_number text NOT NULL,
    order_type text DEFAULT 'daily'::text NOT NULL,
    source_branch_id character varying NOT NULL,
    target_branch_id character varying NOT NULL,
    target_department text,
    title text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    target_sales_value real,
    estimated_cost real DEFAULT 0,
    actual_cost real DEFAULT 0,
    total_items integer DEFAULT 0,
    completed_items integer DEFAULT 0,
    completion_percent real DEFAULT 0,
    is_ai_generated boolean DEFAULT false,
    ai_plan_id integer,
    notes text,
    created_by character varying,
    approved_by character varying,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    source_sales_value real
);

-- Table: asset_transfer_events
CREATE TABLE IF NOT EXISTS public.asset_transfer_events (
    id integer NOT NULL,
    transfer_id integer NOT NULL,
    event_type text NOT NULL,
    actor_id character varying,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: asset_transfers
CREATE TABLE IF NOT EXISTS public.asset_transfers (
    id integer NOT NULL,
    transfer_number text NOT NULL,
    item_id character varying NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    from_branch_id character varying NOT NULL,
    to_branch_id character varying NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reason text,
    notes text,
    requested_by character varying,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_by character varying,
    approved_at timestamp without time zone,
    received_by character varying,
    received_at timestamp without time zone,
    receiver_name text,
    receiver_signature text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: attendance_records
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id integer NOT NULL,
    employee_id character varying NOT NULL,
    employee_name text NOT NULL,
    branch_id character varying NOT NULL,
    schedule_id integer,
    attendance_date text NOT NULL,
    scheduled_start_time text,
    scheduled_end_time text,
    actual_check_in text,
    actual_check_out text,
    check_in_signature text,
    check_out_signature text,
    status text DEFAULT 'pending'::text NOT NULL,
    late_minutes integer DEFAULT 0,
    early_leave_minutes integer DEFAULT 0,
    overtime_minutes integer DEFAULT 0,
    working_hours real DEFAULT 0,
    device_info text,
    location_info text,
    notes text,
    approved_by character varying,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    branch_employee_id integer,
    biometric_verified boolean DEFAULT false,
    biometric_check_in boolean DEFAULT false,
    biometric_check_out boolean DEFAULT false
);

-- Table: attendance_summary
CREATE TABLE IF NOT EXISTS public.attendance_summary (
    id integer NOT NULL,
    employee_id character varying NOT NULL,
    employee_name text NOT NULL,
    branch_id character varying NOT NULL,
    period_month text NOT NULL,
    total_scheduled_days integer DEFAULT 0,
    total_present_days integer DEFAULT 0,
    total_absent_days integer DEFAULT 0,
    total_late_days integer DEFAULT 0,
    total_early_leave_days integer DEFAULT 0,
    total_leave_days integer DEFAULT 0,
    total_working_hours real DEFAULT 0,
    total_overtime_hours real DEFAULT 0,
    total_late_minutes integer DEFAULT 0,
    total_early_leave_minutes integer DEFAULT 0,
    attendance_rate real DEFAULT 0,
    punctuality_rate real DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id integer NOT NULL,
    item_id character varying NOT NULL,
    action text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    changed_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: average_ticket_targets
CREATE TABLE IF NOT EXISTS public.average_ticket_targets (
    id integer NOT NULL,
    branch_id character varying,
    cashier_id character varying,
    shift_type text,
    target_type text NOT NULL,
    target_value real NOT NULL,
    min_acceptable real,
    bonus_threshold real,
    bonus_per_riyal real,
    valid_from text NOT NULL,
    valid_to text,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: backups
CREATE TABLE IF NOT EXISTS public.backups (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    file_size integer,
    file_path text,
    tables text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    table_count integer,
    row_count integer,
    backup_data text,
    error_message text,
    restored_at timestamp without time zone,
    restored_by character varying
);

-- Table: beneficiary_organizations
CREATE TABLE IF NOT EXISTS public.beneficiary_organizations (
    id integer NOT NULL,
    name text NOT NULL,
    name_en text,
    organization_type text NOT NULL,
    category text,
    contact_person text,
    email text,
    phone text,
    address text,
    city text,
    registration_number text,
    tax_number text,
    website text,
    logo_url text,
    description text,
    partnership_type text,
    discount_percentage numeric(5,2),
    status text DEFAULT 'active'::text,
    valid_from date,
    valid_to date,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Table: biometric_credentials
CREATE TABLE IF NOT EXISTS public.biometric_credentials (
    id integer NOT NULL,
    employee_id character varying NOT NULL,
    employee_name text NOT NULL,
    branch_id character varying NOT NULL,
    credential_id text NOT NULL,
    public_key text NOT NULL,
    counter integer DEFAULT 0 NOT NULL,
    device_info text,
    registered_by character varying,
    is_active boolean DEFAULT true NOT NULL,
    last_used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    device_type text,
    device_model text,
    registration_method text DEFAULT 'fingerprint'::text,
    registered_by_name text,
    deactivated_at timestamp without time zone,
    deactivated_by character varying,
    deactivation_reason text,
    usage_count integer DEFAULT 0,
    verification_pin text
);

-- Table: board_committees
CREATE TABLE IF NOT EXISTS public.board_committees (
    id integer NOT NULL,
    name text NOT NULL,
    name_en text,
    description text,
    committee_type text NOT NULL,
    chairman_id integer,
    secretary_id integer,
    formation_date date NOT NULL,
    term_end_date date,
    mandate_document text,
    meeting_frequency text DEFAULT 'quarterly'::text,
    quorum_required integer DEFAULT 2,
    status text DEFAULT 'active'::text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: board_member_training
CREATE TABLE IF NOT EXISTS public.board_member_training (
    id integer NOT NULL,
    board_member_id integer NOT NULL,
    training_type text NOT NULL,
    title text NOT NULL,
    provider text,
    start_date date NOT NULL,
    end_date date,
    duration integer,
    certificate_number text,
    certificate_url text,
    expiry_date date,
    status text DEFAULT 'completed'::text,
    score numeric(5,2),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: board_members
CREATE TABLE IF NOT EXISTS public.board_members (
    id integer NOT NULL,
    user_id character varying,
    full_name text NOT NULL,
    national_id text,
    email text,
    phone text,
    "position" text NOT NULL,
    member_type text DEFAULT 'executive'::text,
    nationality text,
    date_of_birth date,
    qualifications text,
    experience text,
    current_employer text,
    other_board_memberships text,
    appointment_date date NOT NULL,
    term_end_date date,
    term_number integer DEFAULT 1,
    status text DEFAULT 'active'::text,
    resignation_date date,
    resignation_reason text,
    photo_url text,
    signature_url text,
    committees text[],
    voting_power numeric(18,4) DEFAULT 1.00,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: board_resolutions
CREATE TABLE IF NOT EXISTS public.board_resolutions (
    id integer NOT NULL,
    resolution_number text NOT NULL,
    meeting_id integer,
    resolution_type text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text,
    priority text DEFAULT 'normal'::text,
    proposed_by character varying,
    proposed_at timestamp without time zone NOT NULL,
    voting_required boolean DEFAULT true,
    voting_deadline timestamp without time zone,
    for_votes integer DEFAULT 0,
    against_votes integer DEFAULT 0,
    abstain_votes integer DEFAULT 0,
    total_votes integer DEFAULT 0,
    required_majority numeric(5,2) DEFAULT 50.00,
    status text DEFAULT 'draft'::text,
    approved_at timestamp without time zone,
    implementation_deadline date,
    implementation_status text DEFAULT 'pending'::text,
    implemented_at timestamp without time zone,
    responsible_person character varying,
    financial_impact numeric(15,2),
    attachments jsonb,
    related_resolutions integer[],
    expiry_date date,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_achievement_bonus
CREATE TABLE IF NOT EXISTS public.branch_achievement_bonus (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    year_month text NOT NULL,
    bonus_pool real NOT NULL,
    target_amount real NOT NULL,
    distribution_method text DEFAULT 'contribution_ratio'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    bonus_tiers text,
    calculation_status text DEFAULT 'pending'::text,
    actual_sales real,
    achievement_percent real,
    matched_tier_amount real,
    calculation_details text,
    calculated_at timestamp without time zone,
    calculated_by character varying
);

-- Table: branch_custom_checklist_items
CREATE TABLE IF NOT EXISTS public.branch_custom_checklist_items (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    template_id integer NOT NULL,
    title text NOT NULL,
    title_en text,
    description text,
    display_order integer DEFAULT 100,
    requires_photo boolean DEFAULT false,
    requires_note boolean DEFAULT false,
    is_critical boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_daily_closure_journals
CREATE TABLE IF NOT EXISTS public.branch_daily_closure_journals (
    id integer NOT NULL,
    closure_id integer NOT NULL,
    journal_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_daily_closure_payments
CREATE TABLE IF NOT EXISTS public.branch_daily_closure_payments (
    id integer NOT NULL,
    closure_id integer NOT NULL,
    payment_method text NOT NULL,
    total_amount real DEFAULT 0 NOT NULL,
    total_pos_amount real DEFAULT 0,
    total_terminal_amount real DEFAULT 0,
    total_bank_discrepancy real DEFAULT 0,
    bank_discrepancy_type text DEFAULT 'balanced'::text,
    total_transaction_count integer DEFAULT 0,
    total_terminal_transaction_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_daily_closures
CREATE TABLE IF NOT EXISTS public.branch_daily_closures (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    closure_date text NOT NULL,
    total_sales real DEFAULT 0 NOT NULL,
    cash_total real DEFAULT 0 NOT NULL,
    network_total real DEFAULT 0 NOT NULL,
    delivery_total real DEFAULT 0 NOT NULL,
    total_opening_balance real DEFAULT 0 NOT NULL,
    total_expected_cash real DEFAULT 0 NOT NULL,
    total_actual_cash real DEFAULT 0 NOT NULL,
    total_cash_discrepancy real DEFAULT 0 NOT NULL,
    cash_discrepancy_status text DEFAULT 'balanced'::text NOT NULL,
    total_bank_pos_amount real DEFAULT 0,
    total_bank_terminal_amount real DEFAULT 0,
    total_bank_discrepancy real DEFAULT 0,
    bank_discrepancy_status text DEFAULT 'balanced'::text,
    total_customer_count integer DEFAULT 0,
    total_transaction_count integer DEFAULT 0,
    average_ticket real DEFAULT 0,
    journals_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    closed_by character varying,
    closed_at timestamp without time zone,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_daily_sales
CREATE TABLE IF NOT EXISTS public.branch_daily_sales (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    sales_date text NOT NULL,
    total_sales real DEFAULT 0 NOT NULL,
    transactions_count integer DEFAULT 0,
    average_ticket real DEFAULT 0,
    cashier_count integer DEFAULT 0,
    target_amount real DEFAULT 0,
    achievement_amount real DEFAULT 0,
    achievement_percent real DEFAULT 0,
    morning_shift_sales real DEFAULT 0,
    evening_shift_sales real DEFAULT 0,
    night_shift_sales real DEFAULT 0,
    journal_ids jsonb,
    computed_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_employees
CREATE TABLE IF NOT EXISTS public.branch_employees (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    employee_name text NOT NULL,
    employee_name_en text,
    job_title text NOT NULL,
    department text,
    nationality text NOT NULL,
    salary real NOT NULL,
    housing_allowance real DEFAULT 0,
    transport_allowance real DEFAULT 0,
    food_allowance real DEFAULT 0,
    other_allowances real DEFAULT 0,
    total_salary real,
    hire_date text,
    health_certificate text DEFAULT 'none'::text,
    health_certificate_expiry text,
    iqama_number text,
    iqama_expiry text,
    passport_number text,
    passport_expiry text,
    phone_number text,
    emergency_contact text,
    bank_name text,
    bank_account_number text,
    status text DEFAULT 'active'::text NOT NULL,
    contract_type text DEFAULT 'full_time'::text,
    work_permit_number text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    linked_user_id character varying,
    default_schedule_template_id integer,
    employee_number text,
    social_insurance_deduction real DEFAULT 0
);

-- Table: branch_monthly_targets
CREATE TABLE IF NOT EXISTS public.branch_monthly_targets (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    year_month text NOT NULL,
    target_amount real NOT NULL,
    profile_id integer,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_by character varying,
    approved_by character varying,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_shift_profiles
CREATE TABLE IF NOT EXISTS public.branch_shift_profiles (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    shift_code text NOT NULL,
    display_name text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    break_minutes integer DEFAULT 60,
    grace_minutes_before integer DEFAULT 15,
    grace_minutes_after integer DEFAULT 15,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: branch_shifts
CREATE TABLE IF NOT EXISTS public.branch_shifts (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    shift_type text NOT NULL,
    shift_date date NOT NULL,
    status text DEFAULT 'in_progress'::text,
    supervisor_id character varying,
    supervisor_name text,
    employee_count integer,
    opening_time timestamp without time zone,
    closing_time timestamp without time zone,
    total_sales numeric(12,2),
    cash_sales numeric(12,2),
    card_sales numeric(12,2),
    transaction_count integer,
    cash_variance numeric(10,2),
    waste_amount numeric(10,2),
    supervisor_notes text,
    customer_feedback text,
    team_performance text,
    improvements text,
    issues text,
    opening_completed boolean DEFAULT false,
    closing_completed boolean DEFAULT false,
    opening_completed_at timestamp without time zone,
    closing_completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    opening_gps_latitude numeric(10,7),
    opening_gps_longitude numeric(10,7),
    closing_gps_latitude numeric(10,7),
    closing_gps_longitude numeric(10,7)
);

-- Table: branch_stock
CREATE TABLE IF NOT EXISTS public.branch_stock (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    item_id integer NOT NULL,
    current_quantity integer DEFAULT 0,
    daily_consumption integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying
);

-- Table: branches
CREATE TABLE IF NOT EXISTS public.branches (
    id character varying NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    latitude double precision,
    longitude double precision,
    location_radius integer DEFAULT 200,
    address text
);

-- Table: campaign_budget_allocations
CREATE TABLE IF NOT EXISTS public.campaign_budget_allocations (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    branch_id character varying NOT NULL,
    allocated_budget real NOT NULL,
    spent_amount real DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: campaign_expenses
CREATE TABLE IF NOT EXISTS public.campaign_expenses (
    id integer NOT NULL,
    campaign_id integer,
    influencer_id integer,
    category text NOT NULL,
    description text NOT NULL,
    amount real DEFAULT 0 NOT NULL,
    currency text DEFAULT 'SAR'::text NOT NULL,
    expense_date text NOT NULL,
    payment_method text,
    reference_number text,
    invoice_number text,
    vendor text,
    attachment_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by character varying,
    approved_at timestamp without time zone,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    branch_id integer,
    branch_name text,
    expense_month text
);

-- Table: campaign_goals
CREATE TABLE IF NOT EXISTS public.campaign_goals (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    goal_type text NOT NULL,
    target_value real NOT NULL,
    current_value real DEFAULT 0 NOT NULL,
    unit text,
    description text,
    deadline text,
    is_achieved boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: capital_transactions
CREATE TABLE IF NOT EXISTS public.capital_transactions (
    id integer NOT NULL,
    transaction_number text NOT NULL,
    transaction_type text NOT NULL,
    description text NOT NULL,
    previous_capital numeric(15,2) NOT NULL,
    new_capital numeric(15,2) NOT NULL,
    change_amount numeric(15,2) NOT NULL,
    previous_shares integer NOT NULL,
    new_shares integer NOT NULL,
    share_change integer NOT NULL,
    price_per_share numeric(12,2),
    effective_date date NOT NULL,
    board_resolution_id integer,
    assembly_approval_required boolean DEFAULT true,
    assembly_meeting_id integer,
    regulatory_approval_date date,
    regulatory_approval_number text,
    registration_date date,
    status text DEFAULT 'pending'::text,
    attachments jsonb,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: cashier_daily_challenges
CREATE TABLE IF NOT EXISTS public.cashier_daily_challenges (
    id integer NOT NULL,
    name text NOT NULL,
    challenge_type text NOT NULL,
    branch_id character varying,
    target_value real NOT NULL,
    base_points integer NOT NULL,
    bonus_points_per_unit real DEFAULT 0,
    unit_label text,
    shift_type text,
    is_active boolean DEFAULT true NOT NULL,
    valid_from text NOT NULL,
    valid_to text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    cashier_id character varying
);

-- Table: cashier_incentive_statements
CREATE TABLE IF NOT EXISTS public.cashier_incentive_statements (
    id integer NOT NULL,
    statement_number text NOT NULL,
    cashier_id character varying NOT NULL,
    branch_id character varying NOT NULL,
    period_from text NOT NULL,
    period_to text NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    total_amount real DEFAULT 0 NOT NULL,
    daily_challenge_points integer DEFAULT 0,
    product_commission_points integer DEFAULT 0,
    branch_bonus_points integer DEFAULT 0,
    manual_adjustment_points integer DEFAULT 0,
    entries_count integer DEFAULT 0,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_by character varying,
    approved_by character varying,
    approved_at timestamp without time zone,
    rejected_by character varying,
    rejected_at timestamp without time zone,
    rejection_reason text,
    paid_by character varying,
    paid_at timestamp without time zone,
    statement_data text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: cashier_payment_breakdowns
CREATE TABLE IF NOT EXISTS public.cashier_payment_breakdowns (
    id integer NOT NULL,
    journal_id integer NOT NULL,
    payment_method text NOT NULL,
    amount real DEFAULT 0 NOT NULL,
    transaction_count integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    pos_amount real DEFAULT 0,
    terminal_amount real DEFAULT 0,
    bank_discrepancy real DEFAULT 0,
    bank_discrepancy_type text DEFAULT 'balanced'::text,
    terminal_transaction_count integer DEFAULT 0
);

-- Table: cashier_points_ledger
CREATE TABLE IF NOT EXISTS public.cashier_points_ledger (
    id integer NOT NULL,
    cashier_id character varying NOT NULL,
    branch_id character varying NOT NULL,
    transaction_date text NOT NULL,
    shift_type text,
    points_type text NOT NULL,
    source_id integer,
    source_name text,
    points_earned integer NOT NULL,
    point_value real NOT NULL,
    amount_earned real NOT NULL,
    status text DEFAULT 'earned'::text NOT NULL,
    approved_by character varying,
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: cashier_product_sales
CREATE TABLE IF NOT EXISTS public.cashier_product_sales (
    id integer NOT NULL,
    cashier_id character varying NOT NULL,
    branch_id character varying NOT NULL,
    commission_id integer NOT NULL,
    sales_date text NOT NULL,
    shift_type text,
    quantity_sold integer DEFAULT 0 NOT NULL,
    target_quantity integer NOT NULL,
    is_target_met boolean DEFAULT false,
    points_awarded integer DEFAULT 0,
    recorded_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: cashier_sales_journals
CREATE TABLE IF NOT EXISTS public.cashier_sales_journals (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    shift_id integer,
    cashier_id character varying NOT NULL,
    cashier_name text NOT NULL,
    journal_date text NOT NULL,
    shift_type text,
    shift_start_time text,
    shift_end_time text,
    total_sales real DEFAULT 0 NOT NULL,
    cash_total real DEFAULT 0 NOT NULL,
    network_total real DEFAULT 0 NOT NULL,
    delivery_total real DEFAULT 0 NOT NULL,
    expected_cash real DEFAULT 0 NOT NULL,
    actual_cash_drawer real DEFAULT 0 NOT NULL,
    discrepancy_amount real DEFAULT 0 NOT NULL,
    discrepancy_status text DEFAULT 'balanced'::text NOT NULL,
    customer_count integer DEFAULT 0,
    transaction_count integer DEFAULT 0,
    average_ticket real DEFAULT 0,
    status text DEFAULT 'draft'::text NOT NULL,
    submitted_at timestamp without time zone,
    approved_by character varying,
    approved_at timestamp without time zone,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    opening_balance real DEFAULT 0 NOT NULL,
    total_bank_pos_amount real DEFAULT 0,
    total_bank_terminal_amount real DEFAULT 0,
    bank_discrepancy_total real DEFAULT 0,
    bank_discrepancy_status text DEFAULT 'balanced'::text,
    is_input_error boolean DEFAULT false,
    input_error_amount real DEFAULT 0,
    net_discrepancy real DEFAULT 0,
    return_amount real DEFAULT 0,
    return_payment_method text,
    return_reason text,
    return_reference text,
    has_return boolean DEFAULT false
);

-- Table: cashier_shift_performance
CREATE TABLE IF NOT EXISTS public.cashier_shift_performance (
    id integer NOT NULL,
    journal_id integer,
    cashier_id character varying NOT NULL,
    cashier_name text NOT NULL,
    shift_id integer,
    shift_type text NOT NULL,
    branch_id character varying NOT NULL,
    performance_date text NOT NULL,
    sales_amount real DEFAULT 0 NOT NULL,
    transactions_count integer DEFAULT 0,
    average_ticket real DEFAULT 0,
    customer_count integer DEFAULT 0,
    target_share real DEFAULT 0,
    achievement_percent real DEFAULT 0,
    discrepancy_amount real DEFAULT 0,
    discrepancy_status text DEFAULT 'balanced'::text,
    branch_rank integer,
    shift_rank integer,
    computed_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: cashier_shift_targets
CREATE TABLE IF NOT EXISTS public.cashier_shift_targets (
    id integer NOT NULL,
    cashier_id character varying(255) NOT NULL,
    branch_id character varying(255) NOT NULL,
    shift_type character varying(50) NOT NULL,
    cashier_role character varying(50) NOT NULL,
    target_amount numeric(12,2) DEFAULT 0 NOT NULL,
    target_transactions integer DEFAULT 0 NOT NULL,
    target_ticket_value numeric(10,2) DEFAULT 0 NOT NULL,
    target_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    period_type character varying DEFAULT 'daily'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_target_amount numeric NOT NULL,
    total_target_transactions integer
);

-- Table: cashier_signatures
CREATE TABLE IF NOT EXISTS public.cashier_signatures (
    id integer NOT NULL,
    journal_id integer NOT NULL,
    signature_type text NOT NULL,
    signer_name text NOT NULL,
    signer_id character varying,
    signature_data text NOT NULL,
    signed_at timestamp without time zone DEFAULT now() NOT NULL,
    ip_address text,
    notes text
);

-- Table: chart_of_accounts
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
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

-- Table: checklist_items
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id integer NOT NULL,
    template_id integer NOT NULL,
    title text NOT NULL,
    title_en text,
    description text,
    display_order integer DEFAULT 0,
    requires_photo boolean DEFAULT false,
    requires_note boolean DEFAULT false,
    is_critical boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: checklist_templates
CREATE TABLE IF NOT EXISTS public.checklist_templates (
    id integer NOT NULL,
    name text NOT NULL,
    name_en text,
    type text NOT NULL,
    category text NOT NULL,
    description text,
    icon text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    requires_photo boolean DEFAULT false,
    requires_note boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: commission_calculations
CREATE TABLE IF NOT EXISTS public.commission_calculations (
    id integer NOT NULL,
    cashier_id character varying,
    branch_id character varying,
    period_start text NOT NULL,
    period_end text NOT NULL,
    total_sales real NOT NULL,
    target_amount real,
    achievement_percent real,
    rate_id integer,
    calculated_commission real NOT NULL,
    adjusted_commission real,
    final_commission real NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    journal_ids jsonb,
    notes text,
    approved_by character varying,
    approved_at timestamp without time zone,
    paid_at timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: commission_rates
CREATE TABLE IF NOT EXISTS public.commission_rates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    min_sales_amount real DEFAULT 0,
    max_sales_amount real,
    commission_type text NOT NULL,
    fixed_amount real,
    percentage_rate real,
    applicable_to text DEFAULT 'cashier'::text NOT NULL,
    applicable_branches jsonb,
    is_active boolean DEFAULT true NOT NULL,
    valid_from text,
    valid_to text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: committee_memberships
CREATE TABLE IF NOT EXISTS public.committee_memberships (
    id integer NOT NULL,
    committee_id integer NOT NULL,
    board_member_id integer NOT NULL,
    role text DEFAULT 'member'::text,
    appointment_date date NOT NULL,
    end_date date,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: community_discounts
CREATE TABLE IF NOT EXISTS public.community_discounts (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    minimum_order numeric(10,2),
    maximum_discount numeric(10,2),
    beneficiary_organization_id integer,
    initiative_id integer,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    usage_limit integer,
    usage_count integer DEFAULT 0,
    usage_limit_per_user integer,
    applicable_branches text[],
    applicable_products text[],
    status text DEFAULT 'active'::text,
    terms text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Table: comparison_status_history
CREATE TABLE IF NOT EXISTS public.comparison_status_history (
    id integer NOT NULL,
    comparison_id integer NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    reason text,
    changed_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: comparison_summaries
CREATE TABLE IF NOT EXISTS public.comparison_summaries (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    period_type text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_produced integer DEFAULT 0,
    total_sold integer DEFAULT 0,
    total_waste integer DEFAULT 0,
    total_shortage integer DEFAULT 0,
    production_value real DEFAULT 0,
    sales_value real DEFAULT 0,
    waste_value real DEFAULT 0,
    waste_percent real DEFAULT 0,
    shortage_percent real DEFAULT 0,
    efficiency_score real DEFAULT 0,
    top_waste_products jsonb,
    top_shortage_products jsonb,
    category_breakdown jsonb,
    recommendations jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: comparison_uploads
CREATE TABLE IF NOT EXISTS public.comparison_uploads (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    file_name text NOT NULL,
    file_type text DEFAULT 'excel'::text,
    data_type text NOT NULL,
    period_start date,
    period_end date,
    total_records integer DEFAULT 0,
    total_value real DEFAULT 0,
    unique_products integer DEFAULT 0,
    status text DEFAULT 'pending'::text,
    error_message text,
    uploaded_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: compliance_history
CREATE TABLE IF NOT EXISTS public.compliance_history (
    id integer NOT NULL,
    requirement_id integer NOT NULL,
    action text NOT NULL,
    action_date timestamp without time zone NOT NULL,
    previous_status text,
    new_status text,
    document_number text,
    document_url text,
    valid_from date,
    valid_until date,
    cost numeric(12,2),
    penalty_amount numeric(12,2),
    notes text,
    performed_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: compliance_requirements
CREATE TABLE IF NOT EXISTS public.compliance_requirements (
    id integer NOT NULL,
    requirement_code text NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    regulatory_body text NOT NULL,
    applicable_law text,
    frequency text NOT NULL,
    is_recurring boolean DEFAULT true,
    current_status text DEFAULT 'pending'::text,
    valid_from date,
    valid_until date,
    last_renewal_date date,
    next_due_date date,
    reminder_days integer DEFAULT 30,
    document_number text,
    document_url text,
    cost numeric(12,2),
    responsible_person character varying,
    priority text DEFAULT 'normal'::text,
    penalty_for_non_compliance text,
    notes text,
    attachments jsonb,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: construction_categories
CREATE TABLE IF NOT EXISTS public.construction_categories (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: construction_contracts
CREATE TABLE IF NOT EXISTS public.construction_contracts (
    id integer NOT NULL,
    project_id integer NOT NULL,
    contractor_id integer NOT NULL,
    contract_number text,
    title text NOT NULL,
    description text,
    contract_type text DEFAULT 'fixed_price'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    total_amount real DEFAULT 0 NOT NULL,
    paid_amount real DEFAULT 0,
    start_date text,
    end_date text,
    payment_terms text,
    warranty_period text,
    notes text,
    attachment_url text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: construction_projects
CREATE TABLE IF NOT EXISTS public.construction_projects (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'planned'::text NOT NULL,
    budget real,
    actual_cost real,
    start_date text,
    target_completion_date text,
    actual_completion_date text,
    progress_percent integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: contract_items
CREATE TABLE IF NOT EXISTS public.contract_items (
    id integer NOT NULL,
    contract_id integer NOT NULL,
    category_id integer,
    description text NOT NULL,
    unit text DEFAULT 'قطعة'::text,
    quantity real DEFAULT 1 NOT NULL,
    unit_price real DEFAULT 0 NOT NULL,
    total_price real DEFAULT 0 NOT NULL,
    completed_quantity real DEFAULT 0,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: contract_payments
CREATE TABLE IF NOT EXISTS public.contract_payments (
    id integer NOT NULL,
    contract_id integer NOT NULL,
    payment_request_id integer,
    amount real NOT NULL,
    payment_date text NOT NULL,
    payment_method text,
    reference_number text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: contractors
CREATE TABLE IF NOT EXISTS public.contractors (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    specialization text,
    notes text,
    rating integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: daily_comparisons
CREATE TABLE IF NOT EXISTS public.daily_comparisons (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    comparison_date date NOT NULL,
    product_name text NOT NULL,
    product_category text,
    produced_quantity integer DEFAULT 0,
    sold_quantity integer DEFAULT 0,
    difference integer DEFAULT 0,
    difference_percent real DEFAULT 0,
    production_value real DEFAULT 0,
    sales_value real DEFAULT 0,
    value_difference real DEFAULT 0,
    is_storable boolean DEFAULT false,
    storage_notes text,
    status text DEFAULT 'normal'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    waste_value real DEFAULT 0,
    status_changed_by character varying,
    status_changed_at timestamp without time zone,
    status_reason text
);

-- Table: daily_operations_summary
CREATE TABLE IF NOT EXISTS public.daily_operations_summary (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    date text NOT NULL,
    total_orders integer DEFAULT 0,
    completed_orders integer DEFAULT 0,
    total_produced integer DEFAULT 0,
    total_wasted integer DEFAULT 0,
    waste_percentage real DEFAULT 0,
    quality_score real,
    shifts_count integer DEFAULT 0,
    employees_present integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: daily_production_batches
CREATE TABLE IF NOT EXISTS public.daily_production_batches (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    product_id integer,
    product_name text NOT NULL,
    product_category text,
    quantity integer NOT NULL,
    unit text DEFAULT 'قطعة'::text,
    destination text NOT NULL,
    shift_id integer,
    production_order_id integer,
    produced_at timestamp without time zone DEFAULT now() NOT NULL,
    recorded_by character varying,
    recorder_name text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'finished'::text,
    chef_id character varying,
    chef_name text,
    source_batch_id integer,
    finished_at timestamp without time zone,
    finished_by_id character varying,
    finished_by_name text,
    production_date text
);

-- Table: daily_sales_data
CREATE TABLE IF NOT EXISTS public.daily_sales_data (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    sales_date date NOT NULL,
    product_name text NOT NULL,
    product_category text,
    quantity_sold integer DEFAULT 0,
    sales_value real DEFAULT 0,
    unit_price real,
    upload_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: daily_waste_log
CREATE TABLE IF NOT EXISTS public.daily_waste_log (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    product_name text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit text DEFAULT 'piece'::text,
    reason text NOT NULL,
    estimated_cost numeric(10,2),
    photo_url text,
    notes text,
    recorded_by character varying,
    recorded_by_name text,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: data_import_jobs
CREATE TABLE IF NOT EXISTS public.data_import_jobs (
    id integer NOT NULL,
    source_system text NOT NULL,
    target_module text NOT NULL,
    file_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    total_records integer DEFAULT 0,
    processed_records integer DEFAULT 0,
    failed_records integer DEFAULT 0,
    error_log text,
    imported_by character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: departments
CREATE TABLE IF NOT EXISTS public.departments (
    id integer NOT NULL,
    name text NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: disclosures
CREATE TABLE IF NOT EXISTS public.disclosures (
    id integer NOT NULL,
    disclosure_number text NOT NULL,
    disclosure_type text NOT NULL,
    title text NOT NULL,
    description text,
    fiscal_year text,
    fiscal_quarter text,
    reporting_period_start date,
    reporting_period_end date,
    due_date date,
    submission_date timestamp without time zone,
    publish_date timestamp without time zone,
    regulatory_body text,
    reference_number text,
    category text,
    priority text DEFAULT 'normal'::text,
    status text DEFAULT 'draft'::text,
    content text,
    attachments jsonb,
    financial_statements jsonb,
    reviewed_by character varying,
    reviewed_at timestamp without time zone,
    approved_by character varying,
    approved_at timestamp without time zone,
    rejection_reason text,
    is_confidential boolean DEFAULT false,
    publish_url text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: discount_usage_logs
CREATE TABLE IF NOT EXISTS public.discount_usage_logs (
    id integer NOT NULL,
    discount_id integer NOT NULL,
    branch_id character varying,
    order_id text,
    order_amount numeric(12,2),
    discount_amount numeric(10,2),
    customer_name text,
    customer_phone text,
    used_by character varying,
    used_at timestamp without time zone DEFAULT now(),
    notes text
);

-- Table: display_bar_daily_summary
CREATE TABLE IF NOT EXISTS public.display_bar_daily_summary (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    product_id integer NOT NULL,
    summary_date text NOT NULL,
    opening_quantity integer DEFAULT 0 NOT NULL,
    received_quantity integer DEFAULT 0 NOT NULL,
    sold_quantity integer DEFAULT 0 NOT NULL,
    wasted_quantity integer DEFAULT 0 NOT NULL,
    closing_quantity integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: display_bar_receipts
CREATE TABLE IF NOT EXISTS public.display_bar_receipts (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    product_id integer NOT NULL,
    receipt_date text NOT NULL,
    receipt_time text NOT NULL,
    shift_id integer,
    quantity integer NOT NULL,
    received_by character varying,
    production_batch text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: dividend_distributions
CREATE TABLE IF NOT EXISTS public.dividend_distributions (
    id integer NOT NULL,
    distribution_number text NOT NULL,
    fiscal_year text NOT NULL,
    distribution_type text NOT NULL,
    description text,
    total_amount numeric(15,2) NOT NULL,
    amount_per_share numeric(12,4) NOT NULL,
    eligible_shares integer NOT NULL,
    record_date date NOT NULL,
    payment_date date NOT NULL,
    board_resolution_id integer,
    assembly_meeting_id integer,
    status text DEFAULT 'announced'::text,
    paid_amount numeric(15,2) DEFAULT 0,
    withholding_tax_rate numeric(5,2) DEFAULT 0,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: document_access_logs
CREATE TABLE IF NOT EXISTS public.document_access_logs (
    id integer NOT NULL,
    document_id integer NOT NULL,
    user_id character varying,
    user_name text,
    action text NOT NULL,
    action_details text,
    ip_address text,
    user_agent text,
    version_number integer,
    accessed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: document_categories
CREATE TABLE IF NOT EXISTS public.document_categories (
    id integer NOT NULL,
    name text NOT NULL,
    name_en text,
    description text,
    color text DEFAULT '#6B7280'::text,
    icon text DEFAULT 'folder'::text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: document_folders
CREATE TABLE IF NOT EXISTS public.document_folders (
    id integer NOT NULL,
    name text NOT NULL,
    name_en text,
    description text,
    parent_id integer,
    path text DEFAULT '/'::text,
    access_level text DEFAULT 'internal'::text,
    is_locked boolean DEFAULT false,
    owner_id character varying,
    owner_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: document_shares
CREATE TABLE IF NOT EXISTS public.document_shares (
    id integer NOT NULL,
    document_id integer NOT NULL,
    folder_id integer,
    shared_with_user_id character varying,
    shared_with_user_name text,
    shared_with_branch_id character varying,
    share_type text DEFAULT 'user'::text,
    permission text DEFAULT 'view'::text,
    expires_at timestamp without time zone,
    share_link text,
    share_password text,
    access_count integer DEFAULT 0,
    max_access_count integer,
    is_active boolean DEFAULT true,
    shared_by character varying,
    shared_by_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: document_versions
CREATE TABLE IF NOT EXISTS public.document_versions (
    id integer NOT NULL,
    document_id integer NOT NULL,
    version_number integer NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    file_path text NOT NULL,
    mime_type text,
    checksum text,
    change_notes text,
    changed_by character varying,
    changed_by_name text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: documents
CREATE TABLE IF NOT EXISTS public.documents (
    id integer NOT NULL,
    branch_id character varying,
    folder_id integer,
    category_id integer,
    title text NOT NULL,
    title_en text,
    description text,
    description_en text,
    document_number text,
    document_date timestamp without time zone,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    file_path text NOT NULL,
    mime_type text,
    checksum text,
    current_version integer DEFAULT 1,
    access_level text DEFAULT 'internal'::text,
    status text DEFAULT 'active'::text NOT NULL,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    expiry_date timestamp without time zone,
    retention_period integer,
    is_template boolean DEFAULT false,
    template_for text,
    related_type text,
    related_id integer,
    owner_id character varying,
    owner_name text,
    last_accessed_at timestamp without time zone,
    last_accessed_by character varying,
    download_count integer DEFAULT 0,
    view_count integer DEFAULT 0,
    is_locked boolean DEFAULT false,
    locked_by character varying,
    locked_at timestamp without time zone,
    archived_at timestamp without time zone,
    archived_by character varying,
    created_by character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: employee_schedules
CREATE TABLE IF NOT EXISTS public.employee_schedules (
    id integer NOT NULL,
    period_id integer,
    employee_id character varying NOT NULL,
    employee_name text NOT NULL,
    schedule_date text NOT NULL,
    day_of_week text NOT NULL,
    shift_type text,
    start_time text,
    end_time text,
    is_off boolean DEFAULT false NOT NULL,
    break_duration integer DEFAULT 60,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    branch_id character varying(255),
    status text DEFAULT 'scheduled'::text NOT NULL,
    branch_employee_id integer
);

-- Table: employee_settings
CREATE TABLE IF NOT EXISTS public.employee_settings (
    id integer NOT NULL,
    category text NOT NULL,
    value text NOT NULL,
    label_ar text NOT NULL,
    label_en text,
    color text,
    icon text,
    order_index integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: employee_transfer_requests
CREATE TABLE IF NOT EXISTS public.employee_transfer_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    source_branch_id character varying NOT NULL,
    destination_branch_id character varying NOT NULL,
    requested_by character varying NOT NULL,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    effective_date text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    current_approver_role text DEFAULT 'source_manager'::text,
    rejection_reason text,
    completed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: exec_correspondence
CREATE TABLE IF NOT EXISTS public.exec_correspondence (
    id integer NOT NULL,
    branch_id character varying(255),
    ref_number text NOT NULL,
    type text DEFAULT 'incoming'::text NOT NULL,
    subject text NOT NULL,
    subject_en text,
    body text,
    body_en text,
    sender_name text,
    sender_organization text,
    sender_email text,
    sender_phone text,
    receiver_name text,
    receiver_organization text,
    receiver_email text,
    receiver_phone text,
    category text DEFAULT 'general'::text,
    priority text DEFAULT 'normal'::text,
    status text DEFAULT 'received'::text NOT NULL,
    received_at timestamp without time zone,
    sent_at timestamp without time zone,
    response_deadline timestamp without time zone,
    responded_at timestamp without time zone,
    response_ref_number text,
    attachments jsonb DEFAULT '[]'::jsonb,
    owner_id character varying(255),
    owner_name text,
    assigned_to character varying(255),
    assigned_to_name text,
    is_confidential boolean DEFAULT false,
    notes text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: exec_meeting_attendees
CREATE TABLE IF NOT EXISTS public.exec_meeting_attendees (
    id integer NOT NULL,
    meeting_id integer NOT NULL,
    user_id character varying(255),
    attendee_name text NOT NULL,
    attendee_email text,
    attendee_phone text,
    role text DEFAULT 'attendee'::text,
    is_external boolean DEFAULT false,
    external_organization text,
    attendance_status text DEFAULT 'invited'::text,
    attended_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: exec_meetings
CREATE TABLE IF NOT EXISTS public.exec_meetings (
    id integer NOT NULL,
    branch_id character varying(255),
    title text NOT NULL,
    title_en text,
    agenda text,
    agenda_en text,
    meeting_type text DEFAULT 'regular'::text,
    start_at timestamp without time zone NOT NULL,
    end_at timestamp without time zone,
    location text,
    location_en text,
    is_virtual boolean DEFAULT false,
    virtual_meeting_link text,
    organizer_id character varying(255),
    organizer_name text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    minutes text,
    decisions text,
    reminder_sent boolean DEFAULT false,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: exec_notifications
CREATE TABLE IF NOT EXISTS public.exec_notifications (
    id integer NOT NULL,
    user_id character varying(255),
    branch_id character varying(255),
    type text NOT NULL,
    title text NOT NULL,
    title_en text,
    body text,
    body_en text,
    entity_type text,
    entity_id integer,
    priority text DEFAULT 'normal'::text,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    scheduled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: exec_task_comments
CREATE TABLE IF NOT EXISTS public.exec_task_comments (
    id integer NOT NULL,
    task_id integer NOT NULL,
    user_id character varying(255),
    user_name text,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: exec_tasks
CREATE TABLE IF NOT EXISTS public.exec_tasks (
    id integer NOT NULL,
    branch_id character varying(255),
    title text NOT NULL,
    title_en text,
    description text,
    description_en text,
    task_type text DEFAULT 'general'::text,
    assigned_to character varying(255),
    assigned_to_name text,
    created_by character varying(255),
    created_by_name text,
    related_type text,
    related_id integer,
    due_date timestamp without time zone,
    start_date timestamp without time zone,
    completed_at timestamp without time zone,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    progress integer DEFAULT 0,
    notes text,
    reminder_sent boolean DEFAULT false,
    reminder_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: external_integrations
CREATE TABLE IF NOT EXISTS public.external_integrations (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    config jsonb,
    is_active text DEFAULT 'true'::text,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: financial_cogs
CREATE TABLE IF NOT EXISTS public.financial_cogs (
    id integer NOT NULL,
    period_id integer NOT NULL,
    item_type text NOT NULL,
    amount real DEFAULT 0 NOT NULL,
    waste_amount real DEFAULT 0,
    waste_pct real DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: financial_fixed_costs
CREATE TABLE IF NOT EXISTS public.financial_fixed_costs (
    id integer NOT NULL,
    period_id integer NOT NULL,
    cost_type text NOT NULL,
    amount real DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: financial_metrics
CREATE TABLE IF NOT EXISTS public.financial_metrics (
    id integer NOT NULL,
    period_id integer NOT NULL,
    total_revenue real DEFAULT 0,
    total_cogs real DEFAULT 0,
    total_operating_expenses real DEFAULT 0,
    total_fixed_costs real DEFAULT 0,
    gross_profit real DEFAULT 0,
    net_profit real DEFAULT 0,
    gross_margin_pct real DEFAULT 0,
    net_margin_pct real DEFAULT 0,
    break_even_sales real DEFAULT 0,
    salary_to_sales_pct real DEFAULT 0,
    rent_to_revenue_pct real DEFAULT 0,
    waste_pct real DEFAULT 0,
    invoice_count integer DEFAULT 0,
    avg_invoice_value real DEFAULT 0,
    ebitda real DEFAULT 0,
    ebitda_margin_pct real DEFAULT 0,
    contribution_margin real DEFAULT 0,
    contribution_margin_pct real DEFAULT 0,
    labor_productivity real DEFAULT 0,
    revenue_per_employee real DEFAULT 0,
    employee_count integer DEFAULT 0,
    operating_profit real DEFAULT 0,
    operating_margin_pct real DEFAULT 0,
    rating text DEFAULT 'average'::text,
    rating_reasons jsonb,
    recommendations jsonb,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: financial_operating_expenses
CREATE TABLE IF NOT EXISTS public.financial_operating_expenses (
    id integer NOT NULL,
    period_id integer NOT NULL,
    expense_type text NOT NULL,
    amount real DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: financial_periods
CREATE TABLE IF NOT EXISTS public.financial_periods (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    period_type text DEFAULT 'monthly'::text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    target_revenue real DEFAULT 0,
    target_gross_margin real DEFAULT 0,
    target_net_margin real DEFAULT 0,
    status text DEFAULT 'draft'::text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: financial_sales
CREATE TABLE IF NOT EXISTS public.financial_sales (
    id integer NOT NULL,
    period_id integer NOT NULL,
    channel text NOT NULL,
    category text,
    shift text,
    total_amount real DEFAULT 0 NOT NULL,
    invoice_count integer DEFAULT 0,
    avg_invoice_value real DEFAULT 0,
    date text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: finished_goods_inventory
CREATE TABLE IF NOT EXISTS public.finished_goods_inventory (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    product_id integer,
    product_name text NOT NULL,
    product_category text,
    quantity integer DEFAULT 0 NOT NULL,
    unit text DEFAULT 'قطعة'::text,
    production_date text NOT NULL,
    last_batch_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    product_name_normalized text
);

-- Table: finished_goods_transfers
CREATE TABLE IF NOT EXISTS public.finished_goods_transfers (
    id integer NOT NULL,
    inventory_id integer NOT NULL,
    source_branch_id character varying NOT NULL,
    destination_type text NOT NULL,
    destination_branch_id character varying,
    product_id integer,
    product_name text NOT NULL,
    product_category text,
    quantity integer NOT NULL,
    unit text DEFAULT 'قطعة'::text,
    transfer_date text NOT NULL,
    notes text,
    status text DEFAULT 'completed'::text NOT NULL,
    created_by character varying,
    created_by_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: governance_meetings
CREATE TABLE IF NOT EXISTS public.governance_meetings (
    id integer NOT NULL,
    meeting_number text NOT NULL,
    meeting_type text NOT NULL,
    title text NOT NULL,
    description text,
    meeting_date timestamp without time zone NOT NULL,
    start_time text,
    end_time text,
    location text,
    location_type text DEFAULT 'in_person'::text,
    virtual_meeting_link text,
    agenda text,
    agenda_items jsonb,
    quorum_required numeric(5,2) DEFAULT 50.00,
    quorum_achieved boolean,
    attendance_count integer DEFAULT 0,
    total_eligible_votes integer,
    status text DEFAULT 'scheduled'::text,
    postponed_to timestamp without time zone,
    cancellation_reason text,
    invitation_sent_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    minutes_status text DEFAULT 'pending'::text,
    minutes_approved_at timestamp without time zone,
    minutes_approved_by character varying,
    fiscal_year text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: incentive_awards
CREATE TABLE IF NOT EXISTS public.incentive_awards (
    id integer NOT NULL,
    award_type text NOT NULL,
    branch_id character varying,
    cashier_id character varying,
    period_start text NOT NULL,
    period_end text NOT NULL,
    target_amount real NOT NULL,
    achieved_amount real NOT NULL,
    achievement_percent real NOT NULL,
    tier_id integer,
    calculated_reward real NOT NULL,
    adjusted_reward real,
    final_reward real NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    journal_ids jsonb,
    approved_by character varying,
    approved_at timestamp without time zone,
    paid_at timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: incentive_tiers
CREATE TABLE IF NOT EXISTS public.incentive_tiers (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    min_achievement_percent real NOT NULL,
    max_achievement_percent real,
    reward_type text NOT NULL,
    fixed_amount real,
    percentage_rate real,
    is_active boolean DEFAULT true NOT NULL,
    applicable_to text DEFAULT 'all'::text NOT NULL,
    sort_order integer DEFAULT 0,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: influencer_campaign_links
CREATE TABLE IF NOT EXISTS public.influencer_campaign_links (
    id integer NOT NULL,
    influencer_id integer NOT NULL,
    campaign_id integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    contract_amount real,
    deliverables jsonb,
    deliverables_done jsonb,
    start_date text,
    end_date text,
    performance_score real,
    sales_impact real,
    engagement_generated integer,
    impressions_generated integer,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: influencer_contacts
CREATE TABLE IF NOT EXISTS public.influencer_contacts (
    id integer NOT NULL,
    influencer_id integer NOT NULL,
    contact_type text NOT NULL,
    contact_date text NOT NULL,
    contact_time text,
    subject text,
    notes text,
    outcome text,
    next_follow_up text,
    contacted_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: influencer_contracts
CREATE TABLE IF NOT EXISTS public.influencer_contracts (
    id integer NOT NULL,
    contract_number text NOT NULL,
    influencer_id integer,
    influencer_name text NOT NULL,
    influencer_phone text,
    influencer_email text,
    national_id text,
    bank_name text,
    bank_account_number text,
    bank_account_holder text,
    iban text,
    campaign_name text NOT NULL,
    campaign_description text,
    branch_id character varying,
    branch_name text,
    coverage_location text,
    coverage_date text,
    coverage_time text,
    contract_amount real NOT NULL,
    currency text DEFAULT 'SAR'::text,
    payment_terms text,
    deliverables text[],
    content_requirements text,
    exclusivity_clause boolean DEFAULT false,
    contract_start_date text NOT NULL,
    contract_end_date text,
    influencer_signature text,
    influencer_signed_at timestamp without time zone,
    company_signature text,
    company_signed_at timestamp without time zone,
    company_signed_by character varying,
    status text DEFAULT 'draft'::text NOT NULL,
    finance_approved boolean DEFAULT false,
    finance_approved_by character varying,
    finance_approved_at timestamp without time zone,
    finance_notes text,
    payment_status text DEFAULT 'pending'::text,
    payment_date text,
    payment_reference text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: influencer_payments
CREATE TABLE IF NOT EXISTS public.influencer_payments (
    id integer NOT NULL,
    influencer_id integer NOT NULL,
    campaign_id integer,
    payment_type text NOT NULL,
    amount real NOT NULL,
    currency text DEFAULT 'SAR'::text NOT NULL,
    payment_date text NOT NULL,
    payment_method text,
    reference_number text,
    description text,
    status text DEFAULT 'completed'::text NOT NULL,
    invoice_number text,
    attachment_url text,
    notes text,
    created_by character varying,
    approved_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: interest_declarations
CREATE TABLE IF NOT EXISTS public.interest_declarations (
    id integer NOT NULL,
    declaration_number text NOT NULL,
    board_member_id integer NOT NULL,
    declaration_type text NOT NULL,
    declaration_date date NOT NULL,
    fiscal_year text,
    related_party_name text,
    relationship_type text,
    description text NOT NULL,
    transaction_type text,
    transaction_value numeric(15,2),
    action_taken text,
    board_decision text,
    status text DEFAULT 'pending'::text,
    reviewed_by character varying,
    reviewed_at timestamp without time zone,
    attachments jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: inventory_items
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id character varying NOT NULL,
    branch_id character varying NOT NULL,
    name text NOT NULL,
    quantity integer NOT NULL,
    unit text NOT NULL,
    category text NOT NULL,
    price real,
    status text,
    last_check text,
    notes text,
    serial_number text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    image_url text,
    next_inspection_date text,
    inspection_interval_days integer
);

-- Table: job_role_permissions
CREATE TABLE IF NOT EXISTS public.job_role_permissions (
    id integer NOT NULL,
    job_title text NOT NULL,
    module text NOT NULL,
    actions text[] NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: journal_attachments
CREATE TABLE IF NOT EXISTS public.journal_attachments (
    id integer NOT NULL,
    journal_id integer NOT NULL,
    attachment_type text NOT NULL,
    file_name text NOT NULL,
    file_data text NOT NULL,
    mime_type text NOT NULL,
    file_size integer,
    notes text,
    uploaded_by character varying,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: journal_entry_lines
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
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

-- Table: marketing_alerts
CREATE TABLE IF NOT EXISTS public.marketing_alerts (
    id integer NOT NULL,
    alert_type text NOT NULL,
    severity text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    campaign_id integer,
    task_id integer,
    target_user_id character varying,
    is_read boolean DEFAULT false NOT NULL,
    is_acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_by character varying,
    acknowledged_at timestamp without time zone,
    scheduled_for timestamp without time zone,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: marketing_assets
CREATE TABLE IF NOT EXISTS public.marketing_assets (
    id integer NOT NULL,
    name text NOT NULL,
    asset_type text NOT NULL,
    file_url text,
    thumbnail_url text,
    campaign_id integer,
    category text,
    tags text[],
    file_size integer,
    dimensions text,
    duration integer,
    usage_count integer DEFAULT 0,
    uploaded_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    branch_id character varying,
    location text,
    quantity integer DEFAULT 1,
    description text
);

-- Table: marketing_calendar_events
CREATE TABLE IF NOT EXISTS public.marketing_calendar_events (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    event_type text NOT NULL,
    campaign_id integer,
    start_date text NOT NULL,
    end_date text,
    start_time text,
    end_time text,
    is_all_day boolean DEFAULT false NOT NULL,
    color text,
    assigned_to character varying,
    reminder_minutes integer,
    is_recurring boolean DEFAULT false NOT NULL,
    recurring_pattern text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: marketing_campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id integer NOT NULL,
    name text NOT NULL,
    name_ar text,
    description text,
    objective text NOT NULL,
    season text,
    status text DEFAULT 'draft'::text NOT NULL,
    total_budget real DEFAULT 0 NOT NULL,
    spent_budget real DEFAULT 0 NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    target_audience text,
    channels text[],
    kpis jsonb,
    owner_id character varying,
    created_by character varying,
    notes text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: marketing_influencers
CREATE TABLE IF NOT EXISTS public.marketing_influencers (
    id integer NOT NULL,
    name text NOT NULL,
    name_ar text,
    email text,
    phone text,
    profile_image_url text,
    specialty text NOT NULL,
    platforms text[],
    content_types text[],
    follower_count integer DEFAULT 0,
    engagement_rate real,
    avg_views integer DEFAULT 0,
    price_per_post real,
    price_per_story real,
    price_per_video real,
    city text,
    region text,
    social_handles jsonb,
    best_collaboration_times text,
    notes text,
    rating real,
    total_collaborations integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    ai_insights jsonb,
    last_contact_date text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    account_url text,
    coverage_url text,
    follower_count_text text,
    view_rating integer,
    bank_account_number text,
    bank_account_holder text,
    bank_name text
);

-- Table: marketing_performance_reports
CREATE TABLE IF NOT EXISTS public.marketing_performance_reports (
    id integer NOT NULL,
    report_type text NOT NULL,
    period_start text NOT NULL,
    period_end text NOT NULL,
    campaign_id integer,
    branch_id character varying,
    total_spend real DEFAULT 0,
    total_reach integer DEFAULT 0,
    total_impressions integer DEFAULT 0,
    total_engagement integer DEFAULT 0,
    engagement_rate real DEFAULT 0,
    estimated_sales_impact real DEFAULT 0,
    actual_sales_impact real DEFAULT 0,
    roi real DEFAULT 0,
    cost_per_engagement real DEFAULT 0,
    cost_per_impression real DEFAULT 0,
    previous_period_sales real,
    sales_growth real,
    top_performing_content jsonb,
    top_influencers jsonb,
    recommendations jsonb,
    generated_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: marketing_task_activities
CREATE TABLE IF NOT EXISTS public.marketing_task_activities (
    id integer NOT NULL,
    task_id integer NOT NULL,
    activity_type text NOT NULL,
    description text,
    old_value text,
    new_value text,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: marketing_tasks
CREATE TABLE IF NOT EXISTS public.marketing_tasks (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    campaign_id integer,
    assigned_to character varying,
    assigned_by character varying,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    due_date text,
    completed_at timestamp without time zone,
    estimated_hours real,
    actual_hours real,
    category text,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: marketing_team_members
CREATE TABLE IF NOT EXISTS public.marketing_team_members (
    id integer NOT NULL,
    user_id character varying,
    role text NOT NULL,
    specialization text,
    is_team_lead boolean DEFAULT false NOT NULL,
    assigned_branches text[],
    weekly_hours_capacity real DEFAULT 40,
    current_workload real DEFAULT 0,
    join_date text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    name text,
    email text,
    phone text
);

-- Table: material_transfer_items
CREATE TABLE IF NOT EXISTS public.material_transfer_items (
    id integer NOT NULL,
    transfer_id integer NOT NULL,
    item_id integer NOT NULL,
    item_name text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    quantity integer NOT NULL,
    received_quantity integer,
    notes text,
    available_quantity integer,
    discrepancy integer,
    discrepancy_notes text,
    original_quantity integer,
    is_modified boolean DEFAULT false,
    modified_by text,
    modified_by_name text,
    modified_at timestamp without time zone,
    modification_notes text
);

-- Table: material_transfers
CREATE TABLE IF NOT EXISTS public.material_transfers (
    id integer NOT NULL,
    transfer_number text NOT NULL,
    request_id integer,
    source_type text DEFAULT 'warehouse'::text NOT NULL,
    source_branch_id character varying,
    destination_branch_id character varying NOT NULL,
    transfer_date text NOT NULL,
    delivery_date text,
    status text DEFAULT 'pending'::text NOT NULL,
    driver_name text,
    vehicle_number text,
    departure_time timestamp without time zone,
    arrival_time timestamp without time zone,
    received_by character varying,
    received_by_name text,
    receiver_signature text,
    notes text,
    created_by character varying,
    created_by_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_by character varying,
    approved_by_name text,
    approved_at timestamp without time zone,
    rejected_by character varying,
    rejected_by_name text,
    rejected_at timestamp without time zone,
    rejection_reason text,
    delivery_notes text,
    has_discrepancy boolean DEFAULT false,
    has_quantity_modifications boolean DEFAULT false
);

-- Table: meeting_attendance
CREATE TABLE IF NOT EXISTS public.meeting_attendance (
    id integer NOT NULL,
    meeting_id integer NOT NULL,
    attendee_type text NOT NULL,
    board_member_id integer,
    shareholder_id integer,
    attendee_name text NOT NULL,
    attendee_role text,
    represented_shares integer,
    voting_power numeric(18,4),
    attendance_status text DEFAULT 'expected'::text,
    arrival_time timestamp without time zone,
    departure_time timestamp without time zone,
    attendance_method text DEFAULT 'in_person'::text,
    proxy_holder_name text,
    proxy_document_url text,
    signature_url text,
    signed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: meeting_minutes
CREATE TABLE IF NOT EXISTS public.meeting_minutes (
    id integer NOT NULL,
    meeting_id integer NOT NULL,
    minutes_number text NOT NULL,
    content text NOT NULL,
    summary text,
    attendance_list jsonb,
    discussion_points jsonb,
    decisions jsonb,
    voting_results jsonb,
    next_meeting_date timestamp without time zone,
    attachments jsonb,
    status text DEFAULT 'draft'::text,
    prepared_by character varying,
    prepared_at timestamp without time zone,
    reviewed_by character varying,
    reviewed_at timestamp without time zone,
    signed_by jsonb,
    archived_at timestamp without time zone,
    archive_reference text,
    pdf_url text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: meeting_rsvps
CREATE TABLE IF NOT EXISTS public.meeting_rsvps (
    id integer NOT NULL,
    meeting_id integer NOT NULL,
    shareholder_id integer NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text,
    confirmed_at timestamp without time zone,
    declined_at timestamp without time zone,
    response_note text,
    shareholder_name text NOT NULL,
    shareholder_phone text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: notification_queue
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id integer NOT NULL,
    recipient_phone text NOT NULL,
    recipient_name text,
    channel text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    related_module text,
    related_entity_id text,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: notification_templates
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id integer NOT NULL,
    name text NOT NULL,
    event_type text NOT NULL,
    channel text NOT NULL,
    template text NOT NULL,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id integer NOT NULL,
    branch_id character varying,
    user_id character varying,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text,
    category text,
    priority text DEFAULT 'normal'::text,
    link_type text,
    link_id integer,
    link_url text,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    is_dismissed boolean DEFAULT false,
    dismissed_at timestamp without time zone,
    scheduled_for timestamp without time zone,
    expires_at timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: org_job_roles
CREATE TABLE IF NOT EXISTS public.org_job_roles (
    id integer NOT NULL,
    slug text NOT NULL,
    parent_id integer,
    level integer DEFAULT 1 NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    title_ar text NOT NULL,
    title_en text NOT NULL,
    summary_ar text,
    summary_en text,
    responsibilities_ar jsonb DEFAULT '[]'::jsonb,
    responsibilities_en jsonb DEFAULT '[]'::jsonb,
    qualifications_ar jsonb DEFAULT '[]'::jsonb,
    qualifications_en jsonb DEFAULT '[]'::jsonb,
    icon text DEFAULT 'user'::text,
    color text DEFAULT 'bg-amber-500'::text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: payment_requests
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id integer NOT NULL,
    project_id integer NOT NULL,
    contract_id integer,
    request_number text,
    request_type text NOT NULL,
    amount real NOT NULL,
    description text NOT NULL,
    beneficiary_name text,
    beneficiary_bank text,
    beneficiary_iban text,
    category_id integer,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text,
    request_date text,
    due_date text,
    approved_by character varying,
    approved_at timestamp without time zone,
    paid_at timestamp without time zone,
    rejection_reason text,
    attachment_url text,
    invoice_number text,
    notes text,
    requested_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: performance_alerts
CREATE TABLE IF NOT EXISTS public.performance_alerts (
    id integer NOT NULL,
    cashier_id character varying(255),
    branch_id character varying(255) NOT NULL,
    shift_type character varying(50) NOT NULL,
    alert_type character varying(50) NOT NULL,
    alert_level character varying(20) NOT NULL,
    message text NOT NULL,
    current_value numeric(12,2),
    target_value numeric(12,2),
    percentage numeric(5,2),
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);

-- Table: permission_audit_logs
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
    id integer NOT NULL,
    target_user_id character varying NOT NULL,
    changed_by_user_id character varying NOT NULL,
    action text NOT NULL,
    module text,
    old_actions text[],
    new_actions text[],
    template_applied text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: permission_check_logs
CREATE TABLE IF NOT EXISTS public.permission_check_logs (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    module character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    resource_id text,
    branch_id character varying,
    allowed boolean NOT NULL,
    denial_reason text,
    ip_address text,
    request_path text,
    request_method character varying(10),
    response_time integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: permissions
CREATE TABLE IF NOT EXISTS public.permissions (
    id integer NOT NULL,
    module character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    name text NOT NULL,
    description text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: pnl_branch_settings
CREATE TABLE IF NOT EXISTS public.pnl_branch_settings (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    monthly_rent real DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: pnl_monthly_inputs
CREATE TABLE IF NOT EXISTS public.pnl_monthly_inputs (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    electricity_cost real DEFAULT 0,
    water_cost real DEFAULT 0,
    utilities_other real DEFAULT 0,
    cogs_cost real DEFAULT 0,
    cogs_notes text,
    maintenance_cost real DEFAULT 0,
    marketing_cost real DEFAULT 0,
    supplies_cost real DEFAULT 0,
    other_costs real DEFAULT 0,
    other_costs_details text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: point_settings
CREATE TABLE IF NOT EXISTS public.point_settings (
    id integer NOT NULL,
    point_value real DEFAULT 0.5 NOT NULL,
    max_daily_points integer,
    max_monthly_points integer,
    seasonal_multiplier real DEFAULT 1,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    updated_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: product_commissions
CREATE TABLE IF NOT EXISTS public.product_commissions (
    id integer NOT NULL,
    product_name text NOT NULL,
    product_category text,
    commission_type text NOT NULL,
    branch_id character varying,
    target_quantity integer NOT NULL,
    points_on_target integer NOT NULL,
    bonus_points_per_extra real DEFAULT 0,
    shift_type text,
    is_active boolean DEFAULT true NOT NULL,
    valid_from text NOT NULL,
    valid_to text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    cashier_id character varying
);

-- Table: product_prices
CREATE TABLE IF NOT EXISTS public.product_prices (
    id integer NOT NULL,
    product_name text NOT NULL,
    branch_id character varying,
    price real NOT NULL,
    cost_price real,
    currency character varying(3) DEFAULT 'SAR'::character varying,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    source text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying
);

-- Table: product_sales_analytics
CREATE TABLE IF NOT EXISTS public.product_sales_analytics (
    id integer NOT NULL,
    upload_id integer NOT NULL,
    product_id integer,
    product_name text NOT NULL,
    product_category text,
    total_quantity_sold integer DEFAULT 0,
    total_revenue real DEFAULT 0,
    average_daily_sales real DEFAULT 0,
    sales_velocity real DEFAULT 0,
    profit_margin real DEFAULT 0,
    peak_hours text,
    weekday_pattern text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: product_storage_settings
CREATE TABLE IF NOT EXISTS public.product_storage_settings (
    id integer NOT NULL,
    product_name text NOT NULL,
    product_category text,
    is_storable boolean DEFAULT false,
    max_storage_days integer DEFAULT 0,
    storage_type text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by character varying,
    suggested_category text,
    confidence_score integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    verified_by character varying,
    verified_at timestamp without time zone
);

-- Table: production_ai_plans
CREATE TABLE IF NOT EXISTS public.production_ai_plans (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    plan_name text NOT NULL,
    target_sales_value real NOT NULL,
    plan_date text NOT NULL,
    dataset_id integer,
    algorithm_version text DEFAULT 'v1.0'::text,
    confidence_score real DEFAULT 0,
    recommended_products jsonb,
    total_estimated_value real DEFAULT 0,
    total_estimated_cost real DEFAULT 0,
    profit_margin real DEFAULT 0,
    status text DEFAULT 'generated'::text NOT NULL,
    applied_to_order_id integer,
    reviewed_by character varying,
    reviewed_at timestamp without time zone,
    review_notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: production_inventory_logs
CREATE TABLE IF NOT EXISTS public.production_inventory_logs (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    product_id integer,
    product_name text NOT NULL,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    balance_before integer DEFAULT 0,
    balance_after integer DEFAULT 0,
    reference_type text,
    reference_id integer,
    notes text,
    created_by character varying,
    created_by_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: production_order_items
CREATE TABLE IF NOT EXISTS public.production_order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    product_name text NOT NULL,
    product_category text,
    target_quantity integer NOT NULL,
    produced_quantity integer DEFAULT 0,
    wasted_quantity integer DEFAULT 0,
    unit_price real DEFAULT 0,
    total_value real DEFAULT 0,
    scheduled_date text,
    scheduled_shift text,
    status text DEFAULT 'pending'::text NOT NULL,
    assigned_to text,
    priority integer DEFAULT 0,
    sales_velocity real,
    notes text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    original_quantity integer
);

-- Table: production_order_schedules
CREATE TABLE IF NOT EXISTS public.production_order_schedules (
    id integer NOT NULL,
    order_id integer NOT NULL,
    scheduled_date text NOT NULL,
    day_of_week text,
    shift text,
    target_quantity integer DEFAULT 0,
    completed_quantity integer DEFAULT 0,
    status text DEFAULT 'pending'::text NOT NULL,
    assigned_department text,
    assigned_employees text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: production_orders
CREATE TABLE IF NOT EXISTS public.production_orders (
    id integer NOT NULL,
    order_number text,
    branch_id character varying NOT NULL,
    shift_id integer,
    product_id integer NOT NULL,
    target_quantity integer NOT NULL,
    produced_quantity integer DEFAULT 0,
    wasted_quantity integer DEFAULT 0,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text,
    scheduled_date text,
    scheduled_time text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    assigned_to text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: products
CREATE TABLE IF NOT EXISTS public.products (
    id integer NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    unit text DEFAULT 'قطعة'::text,
    base_price real,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    sku text,
    price_excl_vat real,
    vat_amount real,
    vat_rate real DEFAULT 0.15,
    product_type text DEFAULT 'finish'::text,
    name_en text
);

-- Table: project_budget_allocations
CREATE TABLE IF NOT EXISTS public.project_budget_allocations (
    id integer NOT NULL,
    project_id integer NOT NULL,
    category_id integer,
    planned_amount real DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: project_work_items
CREATE TABLE IF NOT EXISTS public.project_work_items (
    id integer NOT NULL,
    project_id integer NOT NULL,
    category_id integer,
    name text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    cost_estimate real,
    actual_cost real,
    contractor_id integer,
    scheduled_start text,
    scheduled_end text,
    completed_at text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: proxy_votes
CREATE TABLE IF NOT EXISTS public.proxy_votes (
    id integer NOT NULL,
    proxy_number text NOT NULL,
    meeting_id integer NOT NULL,
    principal_shareholder_id integer NOT NULL,
    proxy_holder_shareholder_id integer,
    proxy_holder_name text NOT NULL,
    proxy_holder_national_id text,
    shares_represented integer NOT NULL,
    voting_power numeric(8,4) NOT NULL,
    proxy_type text NOT NULL,
    voting_instructions jsonb,
    document_url text,
    valid_from timestamp without time zone NOT NULL,
    valid_until timestamp without time zone NOT NULL,
    status text DEFAULT 'pending'::text,
    verified_by character varying,
    verified_at timestamp without time zone,
    used_at timestamp without time zone,
    revoked_at timestamp without time zone,
    revocation_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: purchasing_request_items
CREATE TABLE IF NOT EXISTS public.purchasing_request_items (
    id integer NOT NULL,
    purchasing_request_id integer NOT NULL,
    item_id integer,
    item_name text NOT NULL,
    category text,
    unit text,
    requested_quantity integer DEFAULT 0 NOT NULL,
    approved_quantity integer DEFAULT 0,
    ordered_quantity integer DEFAULT 0,
    received_quantity integer DEFAULT 0,
    unit_price numeric(10,2),
    total_price numeric(12,2),
    notes text
);

-- Table: purchasing_requests
CREATE TABLE IF NOT EXISTS public.purchasing_requests (
    id integer NOT NULL,
    request_number text NOT NULL,
    source_material_request_id integer,
    branch_id character varying NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text,
    total_estimated_cost numeric(12,2) DEFAULT 0,
    approved_budget numeric(12,2),
    vendor_id integer,
    vendor_name text,
    expected_delivery_date text,
    actual_delivery_date text,
    notes text,
    requested_by character varying,
    requested_by_name text,
    approved_by character varying,
    approved_by_name text,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: quality_checks
CREATE TABLE IF NOT EXISTS public.quality_checks (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    shift_id integer,
    production_order_id integer,
    check_type text NOT NULL,
    check_date text NOT NULL,
    check_time text,
    result text NOT NULL,
    score integer,
    temperature real,
    checked_by text NOT NULL,
    details text,
    issues text,
    corrective_action text,
    attachment_url text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: quorum_calculations
CREATE TABLE IF NOT EXISTS public.quorum_calculations (
    id integer NOT NULL,
    meeting_id integer NOT NULL,
    calculation_type text NOT NULL,
    resolution_id integer,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    total_eligible_shares integer NOT NULL,
    total_eligible_votes integer NOT NULL,
    present_shares integer NOT NULL,
    present_votes integer NOT NULL,
    proxy_shares integer DEFAULT 0,
    proxy_votes integer DEFAULT 0,
    total_represented_shares integer NOT NULL,
    total_represented_votes integer NOT NULL,
    percentage_represented numeric(8,4) NOT NULL,
    required_quorum numeric(5,2) NOT NULL,
    quorum_met boolean NOT NULL,
    notes text,
    calculated_by character varying
);

-- Table: resolution_signatures
CREATE TABLE IF NOT EXISTS public.resolution_signatures (
    id integer NOT NULL,
    resolution_id integer NOT NULL,
    board_member_id integer,
    signature_token text NOT NULL,
    signature_data text,
    signature_type text DEFAULT 'draw'::text,
    status text DEFAULT 'pending'::text NOT NULL,
    signed_at timestamp without time zone,
    declined_at timestamp without time zone,
    decline_reason text,
    ip_address text,
    user_agent text,
    expires_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    reminder_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    shareholder_id integer,
    signer_name text,
    signer_type text DEFAULT 'board_member'::text
);

-- Table: resolution_votes
CREATE TABLE IF NOT EXISTS public.resolution_votes (
    id integer NOT NULL,
    resolution_id integer NOT NULL,
    voter_type text NOT NULL,
    board_member_id integer,
    shareholder_id integer,
    voter_name text NOT NULL,
    vote text NOT NULL,
    voting_power numeric(18,4) DEFAULT 1.00,
    weighted_vote numeric(18,4),
    voted_at timestamp without time zone DEFAULT now() NOT NULL,
    vote_method text DEFAULT 'in_meeting'::text,
    ip_address text,
    device_info text,
    signature_url text,
    comments text,
    is_valid boolean DEFAULT true,
    invalidation_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    scope jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: role_templates
CREATE TABLE IF NOT EXISTS public.role_templates (
    id integer NOT NULL,
    name text NOT NULL,
    slug character varying(50) NOT NULL,
    description text,
    permissions jsonb NOT NULL,
    department_id integer,
    is_system_default boolean DEFAULT false NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: roles
CREATE TABLE IF NOT EXISTS public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    slug character varying(50) NOT NULL,
    hierarchy_level integer DEFAULT 0 NOT NULL,
    description text,
    is_system_default boolean DEFAULT false NOT NULL,
    inherits_from_role_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: sales_data_uploads
CREATE TABLE IF NOT EXISTS public.sales_data_uploads (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    file_name text NOT NULL,
    file_type text DEFAULT 'excel'::text,
    file_size integer,
    period_start text,
    period_end text,
    total_records integer DEFAULT 0,
    total_sales_value real DEFAULT 0,
    unique_products integer DEFAULT 0,
    parsed_data jsonb,
    product_velocity jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    uploaded_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: saved_filters
CREATE TABLE IF NOT EXISTS public.saved_filters (
    id integer NOT NULL,
    name text NOT NULL,
    filter_config text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: schedule_change_audit
CREATE TABLE IF NOT EXISTS public.schedule_change_audit (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    week_start_date text NOT NULL,
    employee_id character varying,
    employee_name text,
    change_type text NOT NULL,
    schedule_date text,
    old_value jsonb,
    new_value jsonb,
    changed_by character varying,
    changed_by_name text,
    change_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: schedule_periods
CREATE TABLE IF NOT EXISTS public.schedule_periods (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    period_type text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    template_id integer,
    required_staff_per_day jsonb,
    notes text,
    published_by character varying,
    published_at timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: schedule_templates
CREATE TABLE IF NOT EXISTS public.schedule_templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    branch_id character varying,
    is_default boolean DEFAULT false,
    weekly_pattern jsonb,
    created_by character varying,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: seasons_holidays
CREATE TABLE IF NOT EXISTS public.seasons_holidays (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    weight_multiplier real DEFAULT 1.0 NOT NULL,
    applicable_branches jsonb,
    description text,
    is_recurring boolean DEFAULT false,
    recurring_pattern text,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    category text,
    color text DEFAULT '#f59e0b'::text,
    icon text
);

-- Table: security_violation_alerts
CREATE TABLE IF NOT EXISTS public.security_violation_alerts (
    id integer NOT NULL,
    user_id character varying,
    violation_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'warning'::character varying NOT NULL,
    module character varying(100),
    action character varying(50),
    ip_address text,
    user_agent text,
    details jsonb,
    description text,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_by character varying,
    resolved_at timestamp without time zone,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);

-- Table: share_transfers
CREATE TABLE IF NOT EXISTS public.share_transfers (
    id integer NOT NULL,
    transfer_number text NOT NULL,
    from_shareholder_id integer NOT NULL,
    to_shareholder_id integer NOT NULL,
    number_of_shares integer NOT NULL,
    price_per_share numeric(12,2) NOT NULL,
    total_value numeric(15,2) NOT NULL,
    transfer_date date NOT NULL,
    transfer_type text NOT NULL,
    approval_status text DEFAULT 'pending'::text,
    approved_by character varying,
    approved_at timestamp without time zone,
    board_resolution_id integer,
    certificate_old_number text,
    certificate_new_number text,
    attachment_url text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shareholder_dividends
CREATE TABLE IF NOT EXISTS public.shareholder_dividends (
    id integer NOT NULL,
    distribution_id integer NOT NULL,
    shareholder_id integer NOT NULL,
    shares_held integer NOT NULL,
    gross_amount numeric(12,2) NOT NULL,
    withholding_tax numeric(12,2) DEFAULT 0,
    net_amount numeric(12,2) NOT NULL,
    payment_method text DEFAULT 'bank_transfer'::text,
    payment_reference text,
    payment_date date,
    status text DEFAULT 'pending'::text,
    failure_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shareholder_documents
CREATE TABLE IF NOT EXISTS public.shareholder_documents (
    id integer NOT NULL,
    shareholder_id integer NOT NULL,
    document_type text NOT NULL,
    document_name text NOT NULL,
    original_file_name text NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    mime_type text,
    expiry_date date,
    notes text,
    uploaded_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Table: shareholders
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
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shift_audit_log
CREATE TABLE IF NOT EXISTS public.shift_audit_log (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    action text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    performed_by character varying,
    performed_by_name text,
    ip_address text,
    user_agent text,
    gps_latitude numeric(10,7),
    gps_longitude numeric(10,7),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shift_checklist_responses
CREATE TABLE IF NOT EXISTS public.shift_checklist_responses (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    item_id integer NOT NULL,
    checklist_type text NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp without time zone,
    completed_by character varying,
    completed_by_name text,
    notes text,
    photo_url text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shift_employees
CREATE TABLE IF NOT EXISTS public.shift_employees (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    employee_name text NOT NULL,
    role text,
    check_in_time text,
    check_out_time text,
    status text DEFAULT 'expected'::text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shift_performance_tracking
CREATE TABLE IF NOT EXISTS public.shift_performance_tracking (
    id integer NOT NULL,
    branch_id character varying(255) NOT NULL,
    shift_type character varying(50) NOT NULL,
    tracking_date date NOT NULL,
    total_sales numeric(12,2) DEFAULT 0,
    total_transactions integer DEFAULT 0,
    average_ticket numeric(10,2) DEFAULT 0,
    target_sales numeric(12,2) DEFAULT 0,
    target_transactions integer DEFAULT 0,
    achievement_percentage numeric(5,2) DEFAULT 0,
    status character varying(50) DEFAULT 'pending'::character varying,
    updated_at timestamp without time zone DEFAULT now()
);

-- Table: shift_photos
CREATE TABLE IF NOT EXISTS public.shift_photos (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    checklist_response_id integer,
    photo_type text NOT NULL,
    category text,
    photo_url text NOT NULL,
    thumbnail_url text,
    caption text,
    uploaded_by character varying,
    uploaded_by_name text,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shift_reminders
CREATE TABLE IF NOT EXISTS public.shift_reminders (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    reminder_type text NOT NULL,
    shift_date date NOT NULL,
    shift_type text NOT NULL,
    reminder_time timestamp without time zone NOT NULL,
    is_sent boolean DEFAULT false,
    sent_at timestamp without time zone,
    notification_channels text[] DEFAULT ARRAY['system'::text],
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: shift_signatures
CREATE TABLE IF NOT EXISTS public.shift_signatures (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    signature_type text NOT NULL,
    signature_data text NOT NULL,
    signed_by character varying,
    signer_name text NOT NULL,
    signer_role text,
    signed_at timestamp without time zone DEFAULT now() NOT NULL,
    ip_address text
);

-- Table: shifts
CREATE TABLE IF NOT EXISTS public.shifts (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    name text NOT NULL,
    date text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    supervisor_name text,
    employee_count integer DEFAULT 0,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: social_accounts
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id integer NOT NULL,
    platform text NOT NULL,
    account_id text,
    account_name text NOT NULL,
    account_handle text,
    page_id text,
    profile_image_url text,
    followers_count integer DEFAULT 0,
    following_count integer DEFAULT 0,
    posts_count integer DEFAULT 0,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    branch_id character varying,
    is_connected boolean DEFAULT false NOT NULL,
    last_sync_at timestamp without time zone,
    connection_error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    profile_url text
);

-- Table: social_content_templates
CREATE TABLE IF NOT EXISTS public.social_content_templates (
    id integer NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    content text NOT NULL,
    content_ar text,
    default_hashtags text[],
    default_media_type text,
    placeholder_fields text[],
    suitable_platforms text[],
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: social_initiatives
CREATE TABLE IF NOT EXISTS public.social_initiatives (
    id integer NOT NULL,
    title text NOT NULL,
    title_en text,
    initiative_type text NOT NULL,
    category text,
    description text,
    objectives text,
    target_audience text,
    start_date date,
    end_date date,
    budget numeric(12,2),
    actual_cost numeric(12,2),
    beneficiary_organization_id integer,
    partners_names text,
    channels text[],
    status text DEFAULT 'planned'::text,
    impact_metrics text,
    beneficiaries_count integer,
    media_links text[],
    attachments text[],
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Table: social_post_metrics
CREATE TABLE IF NOT EXISTS public.social_post_metrics (
    id integer NOT NULL,
    post_id integer NOT NULL,
    platform text NOT NULL,
    platform_post_id text,
    impressions integer DEFAULT 0,
    reach integer DEFAULT 0,
    engagements integer DEFAULT 0,
    likes integer DEFAULT 0,
    comments integer DEFAULT 0,
    shares integer DEFAULT 0,
    saves integer DEFAULT 0,
    clicks integer DEFAULT 0,
    video_views integer DEFAULT 0,
    engagement_rate real DEFAULT 0,
    fetched_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: social_posts
CREATE TABLE IF NOT EXISTS public.social_posts (
    id integer NOT NULL,
    title text,
    content text NOT NULL,
    content_ar text,
    media_urls text[],
    media_types text[],
    hashtags text[],
    status text DEFAULT 'draft'::text NOT NULL,
    platforms text[] NOT NULL,
    scheduled_at timestamp without time zone,
    published_at timestamp without time zone,
    failed_reason text,
    campaign_id integer,
    calendar_event_id integer,
    created_by character varying,
    approved_by character varying,
    approved_at timestamp without time zone,
    post_type text DEFAULT 'regular'::text,
    link_url text,
    call_to_action text,
    target_audience text,
    is_promoted boolean DEFAULT false,
    promotion_budget real,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    influencer_id integer
);

-- Table: social_schedule_slots
CREATE TABLE IF NOT EXISTS public.social_schedule_slots (
    id integer NOT NULL,
    platform text NOT NULL,
    day_of_week integer NOT NULL,
    time_slot text NOT NULL,
    priority integer DEFAULT 1,
    engagement_score real DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: system_audit_logs
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id integer NOT NULL,
    module text NOT NULL,
    entity_id text NOT NULL,
    entity_name text,
    action text NOT NULL,
    details text,
    user_id character varying,
    user_name text,
    ip_address text,
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: target_daily_allocations
CREATE TABLE IF NOT EXISTS public.target_daily_allocations (
    id integer NOT NULL,
    monthly_target_id integer NOT NULL,
    target_date text NOT NULL,
    weight_percent real NOT NULL,
    daily_target real NOT NULL,
    is_holiday boolean DEFAULT false,
    is_manual_override boolean DEFAULT false,
    override_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: target_shift_allocations
CREATE TABLE IF NOT EXISTS public.target_shift_allocations (
    id integer NOT NULL,
    daily_allocation_id integer NOT NULL,
    shift_type text NOT NULL,
    shift_target real NOT NULL,
    shift_weight_percent real NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: target_weight_profiles
CREATE TABLE IF NOT EXISTS public.target_weight_profiles (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true NOT NULL,
    sunday_weight real DEFAULT 100 NOT NULL,
    monday_weight real DEFAULT 100 NOT NULL,
    tuesday_weight real DEFAULT 100 NOT NULL,
    wednesday_weight real DEFAULT 100 NOT NULL,
    thursday_weight real DEFAULT 130 NOT NULL,
    friday_weight real DEFAULT 130 NOT NULL,
    saturday_weight real DEFAULT 100 NOT NULL,
    seasonal_adjustments jsonb,
    holiday_overrides jsonb,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: time_entries
CREATE TABLE IF NOT EXISTS public.time_entries (
    id integer NOT NULL,
    attendance_id integer,
    employee_id character varying NOT NULL,
    branch_id character varying NOT NULL,
    entry_type text NOT NULL,
    entry_time timestamp without time zone DEFAULT now() NOT NULL,
    signature text,
    signature_type text,
    device_id text,
    ip_address text,
    latitude double precision,
    longitude double precision,
    is_verified boolean DEFAULT false,
    verified_by character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: timesheet_report_entries
CREATE TABLE IF NOT EXISTS public.timesheet_report_entries (
    id integer NOT NULL,
    report_id integer NOT NULL,
    date text NOT NULL,
    day_of_week text NOT NULL,
    scheduled_start_time text,
    scheduled_end_time text,
    actual_start_time text,
    actual_end_time text,
    is_off boolean DEFAULT false,
    status text DEFAULT 'pending'::text,
    scheduled_hours real DEFAULT 0,
    actual_hours real DEFAULT 0,
    overtime_minutes integer DEFAULT 0,
    late_minutes integer DEFAULT 0,
    notes text,
    check_in_signature text,
    check_out_signature text
);

-- Table: timesheet_reports
CREATE TABLE IF NOT EXISTS public.timesheet_reports (
    id integer NOT NULL,
    employee_id character varying NOT NULL,
    branch_id character varying NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    generated_by character varying,
    status text DEFAULT 'pending'::text NOT NULL,
    total_scheduled_days integer DEFAULT 0,
    total_present_days integer DEFAULT 0,
    total_absent_days integer DEFAULT 0,
    total_late_days integer DEFAULT 0,
    total_scheduled_hours real DEFAULT 0,
    total_actual_hours real DEFAULT 0,
    total_overtime_minutes integer DEFAULT 0,
    total_late_minutes integer DEFAULT 0,
    employee_signature text,
    employee_signed_at timestamp without time zone,
    employee_acknowledgment text,
    manager_signature text,
    manager_id character varying,
    manager_signed_at timestamp without time zone,
    manager_acknowledgment text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    branch_employee_id integer
);

-- Table: transfer_approval_steps
CREATE TABLE IF NOT EXISTS public.transfer_approval_steps (
    id integer NOT NULL,
    transfer_id integer NOT NULL,
    step_order integer NOT NULL,
    approver_role text NOT NULL,
    approver_id character varying,
    status text DEFAULT 'pending'::text NOT NULL,
    action_taken_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: transfer_history
CREATE TABLE IF NOT EXISTS public.transfer_history (
    id integer NOT NULL,
    transfer_id integer NOT NULL,
    event_type text NOT NULL,
    performed_by character varying,
    details jsonb,
    event_timestamp timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: travel_expenses
CREATE TABLE IF NOT EXISTS public.travel_expenses (
    id integer NOT NULL,
    travel_request_id integer NOT NULL,
    expense_type text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'SAR'::text,
    expense_date timestamp without time zone NOT NULL,
    receipt_number text,
    receipt_url text,
    vendor text,
    status text DEFAULT 'pending'::text,
    approved_by character varying,
    approved_at timestamp without time zone,
    rejection_reason text,
    notes text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: travel_requests
CREATE TABLE IF NOT EXISTS public.travel_requests (
    id integer NOT NULL,
    branch_id character varying,
    request_number text,
    requester_id character varying,
    requester_name text,
    requester_department text,
    requester_job_title text,
    trip_title text NOT NULL,
    trip_purpose text NOT NULL,
    trip_type text DEFAULT 'business'::text,
    departure_city text NOT NULL,
    destination_city text NOT NULL,
    destination_country text,
    departure_date timestamp without time zone NOT NULL,
    return_date timestamp without time zone NOT NULL,
    trip_duration integer,
    needs_flight boolean DEFAULT true,
    needs_hotel boolean DEFAULT true,
    needs_transportation boolean DEFAULT false,
    needs_visa boolean DEFAULT false,
    estimated_flight_cost numeric(12,2),
    estimated_hotel_cost numeric(12,2),
    estimated_transport_cost numeric(12,2),
    estimated_meals_cost numeric(12,2),
    estimated_other_cost numeric(12,2),
    total_estimated_cost numeric(12,2),
    currency text DEFAULT 'SAR'::text,
    status text DEFAULT 'draft'::text,
    manager_approval text DEFAULT 'pending'::text,
    manager_approval_date timestamp without time zone,
    manager_approval_by character varying,
    manager_approval_notes text,
    finance_approval text DEFAULT 'pending'::text,
    finance_approval_date timestamp without time zone,
    finance_approval_by character varying,
    finance_approval_notes text,
    actual_flight_cost numeric(12,2),
    actual_hotel_cost numeric(12,2),
    actual_transport_cost numeric(12,2),
    actual_meals_cost numeric(12,2),
    actual_other_cost numeric(12,2),
    total_actual_cost numeric(12,2),
    flight_details jsonb,
    hotel_details jsonb,
    transport_details jsonb,
    attachments jsonb,
    notes text,
    trip_report text,
    trip_report_date timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: user_assignments
CREATE TABLE IF NOT EXISTS public.user_assignments (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    role_id integer NOT NULL,
    branch_id character varying,
    department_id integer,
    scope_type character varying(20) DEFAULT 'branch'::character varying NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    start_date timestamp without time zone DEFAULT now(),
    end_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: user_branch_access
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    branch_id character varying NOT NULL,
    access_level character varying(20) DEFAULT 'full'::character varying NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: user_permission_overrides
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    permission_id integer NOT NULL,
    allow boolean NOT NULL,
    branch_id character varying,
    department_id integer,
    reason text,
    granted_by character varying,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: user_permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    module text NOT NULL,
    actions text[] NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: user_security_settings
CREATE TABLE IF NOT EXISTS public.user_security_settings (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_secret text,
    two_factor_backup_codes text[],
    ip_whitelist text[],
    ip_restriction_enabled boolean DEFAULT false NOT NULL,
    session_timeout integer DEFAULT 480,
    max_concurrent_sessions integer DEFAULT 3,
    password_changed_at timestamp without time zone,
    password_expiry_days integer DEFAULT 90,
    force_password_change boolean DEFAULT false NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp without time zone,
    last_login_at timestamp without time zone,
    last_login_ip text,
    last_login_device text,
    trusted_devices jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    user_id character varying NOT NULL,
    device_info jsonb,
    ip_address text,
    user_agent text,
    is_active boolean DEFAULT true NOT NULL,
    last_activity_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    role character varying DEFAULT 'viewer'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    phone character varying,
    password character varying,
    username character varying,
    branch_id character varying,
    job_title character varying,
    is_active text DEFAULT 'active'::text
);

-- Table: visitor_logs
CREATE TABLE IF NOT EXISTS public.visitor_logs (
    id integer NOT NULL,
    branch_id character varying,
    visitor_id integer,
    visit_number text,
    visit_date timestamp without time zone DEFAULT now() NOT NULL,
    visit_purpose text NOT NULL,
    visit_type text DEFAULT 'business'::text,
    host_id character varying,
    host_name text,
    host_department text,
    check_in_time timestamp without time zone,
    check_out_time timestamp without time zone,
    expected_duration integer,
    actual_duration integer,
    status text DEFAULT 'checked_in'::text,
    badge_number text,
    badge_issued boolean DEFAULT false,
    badge_returned boolean DEFAULT false,
    vehicle_plate text,
    items_carried text,
    access_areas text[],
    escort_required boolean DEFAULT false,
    escort_name text,
    notes text,
    visitor_signature text,
    host_signature text,
    security_notes text,
    registered_by character varying,
    registered_by_name text,
    checked_out_by character varying,
    checked_out_by_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: visitors
CREATE TABLE IF NOT EXISTS public.visitors (
    id integer NOT NULL,
    branch_id character varying,
    full_name text NOT NULL,
    national_id text,
    phone text,
    email text,
    company text,
    nationality text,
    id_type text DEFAULT 'national_id'::text,
    photo_url text,
    notes text,
    is_blacklisted boolean DEFAULT false,
    blacklist_reason text,
    visit_count integer DEFAULT 0,
    last_visit_at timestamp without time zone,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: voting_audit_log
CREATE TABLE IF NOT EXISTS public.voting_audit_log (
    id integer NOT NULL,
    resolution_id integer,
    meeting_id integer,
    action text NOT NULL,
    actor_type text NOT NULL,
    actor_id character varying,
    actor_name text,
    vote_id integer,
    proxy_id integer,
    previous_value text,
    new_value text,
    voting_power numeric(8,4),
    ip_address text,
    user_agent text,
    device_fingerprint text,
    session_id text,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    is_valid boolean DEFAULT true,
    validation_notes text
);

-- Table: voting_tokens
CREATE TABLE IF NOT EXISTS public.voting_tokens (
    id integer NOT NULL,
    resolution_id integer NOT NULL,
    shareholder_id integer NOT NULL,
    vote_token text NOT NULL,
    vote text,
    vote_weight integer DEFAULT 1,
    comments text,
    status text DEFAULT 'pending'::text NOT NULL,
    voted_at timestamp without time zone,
    ip_address text,
    user_agent text,
    expires_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    reminder_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    signature_data text
);

-- Table: warehouse_items
CREATE TABLE IF NOT EXISTS public.warehouse_items (
    id integer NOT NULL,
    name text NOT NULL,
    name_en text,
    category text NOT NULL,
    unit text DEFAULT 'كجم'::text NOT NULL,
    sku text,
    barcode text,
    min_stock_level integer DEFAULT 0,
    max_stock_level integer,
    reorder_point integer,
    current_stock integer DEFAULT 0,
    unit_price text,
    supplier_id integer,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: warehouse_movement_logs
CREATE TABLE IF NOT EXISTS public.warehouse_movement_logs (
    id integer NOT NULL,
    item_id integer NOT NULL,
    branch_id character varying,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    balance_before integer DEFAULT 0,
    balance_after integer DEFAULT 0,
    reference_type text,
    reference_id integer,
    notes text,
    created_by character varying,
    created_by_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: warehouse_notifications
CREATE TABLE IF NOT EXISTS public.warehouse_notifications (
    id integer NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    title_en text,
    body text NOT NULL,
    body_en text,
    branch_id character varying,
    target_branch_id character varying,
    user_id character varying,
    entity_type text,
    entity_id integer,
    priority text DEFAULT 'normal'::text,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    read_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: waste_items
CREATE TABLE IF NOT EXISTS public.waste_items (
    id integer NOT NULL,
    waste_report_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price real DEFAULT 0,
    total_value real DEFAULT 0,
    waste_reason text NOT NULL,
    reason_details text,
    image_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: waste_reports
CREATE TABLE IF NOT EXISTS public.waste_reports (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    report_date text NOT NULL,
    shift_id integer,
    reported_by character varying,
    reporter_name text,
    total_items integer DEFAULT 0 NOT NULL,
    total_value real DEFAULT 0,
    status text DEFAULT 'draft'::text NOT NULL,
    approved_by character varying,
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    shift_name text
);

-- Table: waste_risk_alerts
CREATE TABLE IF NOT EXISTS public.waste_risk_alerts (
    id integer NOT NULL,
    rule_id integer NOT NULL,
    branch_id character varying NOT NULL,
    alert_date date NOT NULL,
    product_name text,
    category text,
    current_value real NOT NULL,
    threshold_value real NOT NULL,
    severity text DEFAULT 'medium'::text,
    status text DEFAULT 'open'::text,
    acknowledged_by character varying,
    acknowledged_at timestamp without time zone,
    resolved_by character varying,
    resolved_at timestamp without time zone,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: waste_risk_rules
CREATE TABLE IF NOT EXISTS public.waste_risk_rules (
    id integer NOT NULL,
    name text NOT NULL,
    branch_id character varying,
    category text,
    product_name text,
    threshold_type text NOT NULL,
    threshold_value real NOT NULL,
    period_days integer DEFAULT 1,
    severity text DEFAULT 'medium'::text,
    is_active boolean DEFAULT true,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Table: weekly_schedule_locks
CREATE TABLE IF NOT EXISTS public.weekly_schedule_locks (
    id integer NOT NULL,
    branch_id character varying NOT NULL,
    week_start_date text NOT NULL,
    locked_at timestamp without time zone DEFAULT now() NOT NULL,
    locked_by character varying,
    locked_by_name text,
    shift_profile text,
    notes text
);


-- ============================================
-- الفهارس - Indexes
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS branch_stock_unique ON public.branch_stock USING btree (branch_id, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS finished_goods_unique_idx ON public.finished_goods_inventory USING btree (branch_id, product_name_normalized, production_date);

CREATE INDEX IF NOT EXISTS idx_approval_approver ON public.transfer_approval_steps USING btree (approver_id);

CREATE INDEX IF NOT EXISTS idx_approval_status ON public.transfer_approval_steps USING btree (status);

CREATE INDEX IF NOT EXISTS idx_approval_transfer ON public.transfer_approval_steps USING btree (transfer_id);

CREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance_records USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_attendance_branch_employee ON public.attendance_records USING btree (branch_employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records USING btree (attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.attendance_records USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_records USING btree (status);

CREATE INDEX IF NOT EXISTS idx_attendance_summary_branch ON public.attendance_summary USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_attendance_summary_employee ON public.attendance_summary USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_summary_month ON public.attendance_summary USING btree (period_month);

CREATE INDEX IF NOT EXISTS idx_beneficiary_org_partnership ON public.beneficiary_organizations USING btree (partnership_type);

CREATE INDEX IF NOT EXISTS idx_beneficiary_org_status ON public.beneficiary_organizations USING btree (status);

CREATE INDEX IF NOT EXISTS idx_beneficiary_org_type ON public.beneficiary_organizations USING btree (organization_type);

CREATE INDEX IF NOT EXISTS idx_biometric_branch ON public.biometric_credentials USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_biometric_credential ON public.biometric_credentials USING btree (credential_id);

CREATE INDEX IF NOT EXISTS idx_biometric_employee ON public.biometric_credentials USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_board_committees_status ON public.board_committees USING btree (status);

CREATE INDEX IF NOT EXISTS idx_board_committees_type ON public.board_committees USING btree (committee_type);

CREATE INDEX IF NOT EXISTS idx_board_member_training_member ON public.board_member_training USING btree (board_member_id);

CREATE INDEX IF NOT EXISTS idx_board_member_training_status ON public.board_member_training USING btree (status);

CREATE INDEX IF NOT EXISTS idx_board_member_training_type ON public.board_member_training USING btree (training_type);

CREATE INDEX IF NOT EXISTS idx_board_members_position ON public.board_members USING btree ("position");

CREATE INDEX IF NOT EXISTS idx_board_members_status ON public.board_members USING btree (status);

CREATE INDEX IF NOT EXISTS idx_board_members_type ON public.board_members USING btree (member_type);

CREATE INDEX IF NOT EXISTS idx_board_resolutions_category ON public.board_resolutions USING btree (category);

CREATE INDEX IF NOT EXISTS idx_board_resolutions_implementation ON public.board_resolutions USING btree (implementation_status);

CREATE INDEX IF NOT EXISTS idx_board_resolutions_meeting ON public.board_resolutions USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_board_resolutions_status ON public.board_resolutions USING btree (status);

CREATE INDEX IF NOT EXISTS idx_board_resolutions_type ON public.board_resolutions USING btree (resolution_type);

CREATE INDEX IF NOT EXISTS idx_branch_custom_items_branch ON public.branch_custom_checklist_items USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_custom_items_template ON public.branch_custom_checklist_items USING btree (template_id);

CREATE INDEX IF NOT EXISTS idx_branch_daily_sales_branch_date ON public.branch_daily_sales USING btree (branch_id, sales_date);

CREATE INDEX IF NOT EXISTS idx_branch_employees_branch ON public.branch_employees USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_employees_job ON public.branch_employees USING btree (job_title);

CREATE INDEX IF NOT EXISTS idx_branch_employees_linked_user ON public.branch_employees USING btree (linked_user_id);

CREATE INDEX IF NOT EXISTS idx_branch_employees_nationality ON public.branch_employees USING btree (nationality);

CREATE INDEX IF NOT EXISTS idx_branch_employees_status ON public.branch_employees USING btree (status);

CREATE INDEX IF NOT EXISTS idx_branch_shift_profiles_branch ON public.branch_shift_profiles USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_shift_profiles_code ON public.branch_shift_profiles USING btree (branch_id, shift_code);

CREATE INDEX IF NOT EXISTS idx_branch_shifts_branch ON public.branch_shifts USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_shifts_date ON public.branch_shifts USING btree (shift_date);

CREATE INDEX IF NOT EXISTS idx_branch_shifts_status ON public.branch_shifts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_branch_stock_branch ON public.branch_stock USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_stock_branch_item ON public.branch_stock USING btree (branch_id, item_id);

CREATE INDEX IF NOT EXISTS idx_branch_stock_item ON public.branch_stock USING btree (item_id);

CREATE INDEX IF NOT EXISTS idx_capital_transactions_date ON public.capital_transactions USING btree (effective_date);

CREATE INDEX IF NOT EXISTS idx_capital_transactions_status ON public.capital_transactions USING btree (status);

CREATE INDEX IF NOT EXISTS idx_capital_transactions_type ON public.capital_transactions USING btree (transaction_type);

CREATE INDEX IF NOT EXISTS idx_cashier_journals_branch_date ON public.cashier_sales_journals USING btree (branch_id, journal_date);

CREATE INDEX IF NOT EXISTS idx_cashier_journals_created ON public.cashier_sales_journals USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cashier_journals_status ON public.cashier_sales_journals USING btree (status);

CREATE INDEX IF NOT EXISTS idx_cashier_shift_perf_branch ON public.cashier_shift_performance USING btree (branch_id, performance_date);

CREATE INDEX IF NOT EXISTS idx_cashier_shift_perf_cashier ON public.cashier_shift_performance USING btree (cashier_id, performance_date);

CREATE INDEX IF NOT EXISTS idx_checklist_items_template ON public.checklist_items USING btree (template_id);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_category ON public.checklist_templates USING btree (category);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_type ON public.checklist_templates USING btree (type);

CREATE INDEX IF NOT EXISTS idx_closure_journal_closure ON public.branch_daily_closure_journals USING btree (closure_id);

CREATE INDEX IF NOT EXISTS idx_closure_journal_journal ON public.branch_daily_closure_journals USING btree (journal_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_closure_journal_unique ON public.branch_daily_closure_journals USING btree (journal_id);

CREATE INDEX IF NOT EXISTS idx_committee_memberships_committee ON public.committee_memberships USING btree (committee_id);

CREATE INDEX IF NOT EXISTS idx_committee_memberships_member ON public.committee_memberships USING btree (board_member_id);

CREATE INDEX IF NOT EXISTS idx_committee_memberships_status ON public.committee_memberships USING btree (status);

CREATE INDEX IF NOT EXISTS idx_community_discount_code ON public.community_discounts USING btree (code);

CREATE INDEX IF NOT EXISTS idx_community_discount_org ON public.community_discounts USING btree (beneficiary_organization_id);

CREATE INDEX IF NOT EXISTS idx_community_discount_status ON public.community_discounts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_community_discount_validity ON public.community_discounts USING btree (valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_comparison_summaries_branch ON public.comparison_summaries USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_comparison_summaries_dates ON public.comparison_summaries USING btree (period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_comparison_summaries_period ON public.comparison_summaries USING btree (period_type);

CREATE INDEX IF NOT EXISTS idx_comparison_uploads_branch ON public.comparison_uploads USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_comparison_uploads_status ON public.comparison_uploads USING btree (status);

CREATE INDEX IF NOT EXISTS idx_comparison_uploads_type ON public.comparison_uploads USING btree (data_type);

CREATE INDEX IF NOT EXISTS idx_compliance_history_action ON public.compliance_history USING btree (action);

CREATE INDEX IF NOT EXISTS idx_compliance_history_date ON public.compliance_history USING btree (action_date);

CREATE INDEX IF NOT EXISTS idx_compliance_history_requirement ON public.compliance_history USING btree (requirement_id);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_category ON public.compliance_requirements USING btree (category);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_due_date ON public.compliance_requirements USING btree (next_due_date);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_frequency ON public.compliance_requirements USING btree (frequency);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_status ON public.compliance_requirements USING btree (current_status);

CREATE INDEX IF NOT EXISTS idx_content_templates_category ON public.social_content_templates USING btree (category);

CREATE INDEX IF NOT EXISTS idx_daily_closure_branch_date ON public.branch_daily_closures USING btree (branch_id, closure_date);

CREATE INDEX IF NOT EXISTS idx_daily_closure_status ON public.branch_daily_closures USING btree (status);

CREATE INDEX IF NOT EXISTS idx_daily_comparisons_branch ON public.daily_comparisons USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_daily_comparisons_category ON public.daily_comparisons USING btree (product_category);

CREATE INDEX IF NOT EXISTS idx_daily_comparisons_date ON public.daily_comparisons USING btree (comparison_date);

CREATE INDEX IF NOT EXISTS idx_daily_comparisons_product ON public.daily_comparisons USING btree (product_name);

CREATE INDEX IF NOT EXISTS idx_daily_comparisons_status ON public.daily_comparisons USING btree (status);

CREATE INDEX IF NOT EXISTS idx_daily_production_branch_date ON public.daily_production_batches USING btree (branch_id, production_date);

CREATE INDEX IF NOT EXISTS idx_daily_production_created ON public.daily_production_batches USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_production_status ON public.daily_production_batches USING btree (status);

CREATE INDEX IF NOT EXISTS idx_daily_sales_branch ON public.daily_sales_data USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON public.daily_sales_data USING btree (sales_date);

CREATE INDEX IF NOT EXISTS idx_daily_sales_product ON public.daily_sales_data USING btree (product_name);

CREATE INDEX IF NOT EXISTS idx_daily_sales_upload ON public.daily_sales_data USING btree (upload_id);

CREATE INDEX IF NOT EXISTS idx_daily_waste_shift ON public.daily_waste_log USING btree (shift_id);

CREATE INDEX IF NOT EXISTS idx_disclosures_category ON public.disclosures USING btree (category);

CREATE INDEX IF NOT EXISTS idx_disclosures_due_date ON public.disclosures USING btree (due_date);

CREATE INDEX IF NOT EXISTS idx_disclosures_fiscal_year ON public.disclosures USING btree (fiscal_year);

CREATE INDEX IF NOT EXISTS idx_disclosures_status ON public.disclosures USING btree (status);

CREATE INDEX IF NOT EXISTS idx_disclosures_type ON public.disclosures USING btree (disclosure_type);

CREATE INDEX IF NOT EXISTS idx_discount_usage_branch ON public.discount_usage_logs USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_discount_usage_date ON public.discount_usage_logs USING btree (used_at);

CREATE INDEX IF NOT EXISTS idx_discount_usage_discount ON public.discount_usage_logs USING btree (discount_id);

CREATE INDEX IF NOT EXISTS idx_dividend_distributions_payment_date ON public.dividend_distributions USING btree (payment_date);

CREATE INDEX IF NOT EXISTS idx_dividend_distributions_status ON public.dividend_distributions USING btree (status);

CREATE INDEX IF NOT EXISTS idx_dividend_distributions_year ON public.dividend_distributions USING btree (fiscal_year);

CREATE INDEX IF NOT EXISTS idx_doc_access_document ON public.document_access_logs USING btree (document_id);

CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON public.document_shares USING btree (document_id);

CREATE INDEX IF NOT EXISTS idx_doc_shares_link ON public.document_shares USING btree (share_link);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON public.document_versions USING btree (document_id);

CREATE INDEX IF NOT EXISTS idx_documents_branch ON public.documents USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents USING btree (category_id);

CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents USING btree (folder_id);

CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents USING btree (status);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_branch ON public.employee_schedules USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_branch_employee ON public.employee_schedules USING btree (branch_employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_date ON public.employee_schedules USING btree (schedule_date);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_employee ON public.employee_schedules USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_period ON public.employee_schedules USING btree (period_id);

CREATE INDEX IF NOT EXISTS idx_employee_settings_active ON public.employee_settings USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_employee_settings_category ON public.employee_settings USING btree (category);

CREATE INDEX IF NOT EXISTS idx_exec_attendees_meeting ON public.exec_meeting_attendees USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_exec_attendees_user ON public.exec_meeting_attendees USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_exec_corr_assigned ON public.exec_correspondence USING btree (assigned_to);

CREATE INDEX IF NOT EXISTS idx_exec_corr_branch ON public.exec_correspondence USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_exec_corr_category ON public.exec_correspondence USING btree (category);

CREATE INDEX IF NOT EXISTS idx_exec_corr_owner ON public.exec_correspondence USING btree (owner_id);

CREATE INDEX IF NOT EXISTS idx_exec_corr_received ON public.exec_correspondence USING btree (received_at);

CREATE INDEX IF NOT EXISTS idx_exec_corr_status ON public.exec_correspondence USING btree (status);

CREATE INDEX IF NOT EXISTS idx_exec_corr_type ON public.exec_correspondence USING btree (type);

CREATE INDEX IF NOT EXISTS idx_exec_meetings_branch ON public.exec_meetings USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_exec_meetings_organizer ON public.exec_meetings USING btree (organizer_id);

CREATE INDEX IF NOT EXISTS idx_exec_meetings_start ON public.exec_meetings USING btree (start_at);

CREATE INDEX IF NOT EXISTS idx_exec_meetings_status ON public.exec_meetings USING btree (status);

CREATE INDEX IF NOT EXISTS idx_exec_notif_branch ON public.exec_notifications USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_exec_notif_entity ON public.exec_notifications USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_exec_notif_read ON public.exec_notifications USING btree (is_read);

CREATE INDEX IF NOT EXISTS idx_exec_notif_user ON public.exec_notifications USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_exec_task_comments_task ON public.exec_task_comments USING btree (task_id);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_assigned ON public.exec_tasks USING btree (assigned_to);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_branch ON public.exec_tasks USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_created_by ON public.exec_tasks USING btree (created_by);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_due_date ON public.exec_tasks USING btree (due_date);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_priority ON public.exec_tasks USING btree (priority);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_status ON public.exec_tasks USING btree (status);

CREATE INDEX IF NOT EXISTS idx_fg_transfers_date ON public.finished_goods_transfers USING btree (transfer_date);

CREATE INDEX IF NOT EXISTS idx_fg_transfers_dest ON public.finished_goods_transfers USING btree (destination_branch_id);

CREATE INDEX IF NOT EXISTS idx_fg_transfers_source ON public.finished_goods_transfers USING btree (source_branch_id);

CREATE INDEX IF NOT EXISTS idx_fg_transfers_status ON public.finished_goods_transfers USING btree (status);

CREATE INDEX IF NOT EXISTS idx_fg_transfers_type ON public.finished_goods_transfers USING btree (destination_type);

CREATE INDEX IF NOT EXISTS idx_financial_cogs_period ON public.financial_cogs USING btree (period_id);

CREATE INDEX IF NOT EXISTS idx_financial_cogs_type ON public.financial_cogs USING btree (item_type);

CREATE INDEX IF NOT EXISTS idx_financial_fixed_period ON public.financial_fixed_costs USING btree (period_id);

CREATE INDEX IF NOT EXISTS idx_financial_fixed_type ON public.financial_fixed_costs USING btree (cost_type);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_period ON public.financial_metrics USING btree (period_id);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_rating ON public.financial_metrics USING btree (rating);

CREATE INDEX IF NOT EXISTS idx_financial_opex_period ON public.financial_operating_expenses USING btree (period_id);

CREATE INDEX IF NOT EXISTS idx_financial_opex_type ON public.financial_operating_expenses USING btree (expense_type);

CREATE INDEX IF NOT EXISTS idx_financial_periods_branch ON public.financial_periods USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_financial_periods_date ON public.financial_periods USING btree (year, month);

CREATE INDEX IF NOT EXISTS idx_financial_sales_channel ON public.financial_sales USING btree (channel);

CREATE INDEX IF NOT EXISTS idx_financial_sales_period ON public.financial_sales USING btree (period_id);

CREATE INDEX IF NOT EXISTS idx_finished_goods_branch ON public.finished_goods_inventory USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_finished_goods_category ON public.finished_goods_inventory USING btree (product_category);

CREATE INDEX IF NOT EXISTS idx_finished_goods_date ON public.finished_goods_inventory USING btree (production_date);

CREATE INDEX IF NOT EXISTS idx_finished_goods_product ON public.finished_goods_inventory USING btree (product_id);

CREATE INDEX IF NOT EXISTS idx_governance_meetings_date ON public.governance_meetings USING btree (meeting_date);

CREATE INDEX IF NOT EXISTS idx_governance_meetings_fiscal_year ON public.governance_meetings USING btree (fiscal_year);

CREATE INDEX IF NOT EXISTS idx_governance_meetings_status ON public.governance_meetings USING btree (status);

CREATE INDEX IF NOT EXISTS idx_governance_meetings_type ON public.governance_meetings USING btree (meeting_type);

CREATE INDEX IF NOT EXISTS idx_history_event ON public.transfer_history USING btree (event_type);

CREATE INDEX IF NOT EXISTS idx_history_transfer ON public.transfer_history USING btree (transfer_id);

CREATE INDEX IF NOT EXISTS idx_incentive_stmt_branch ON public.cashier_incentive_statements USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_incentive_stmt_cashier ON public.cashier_incentive_statements USING btree (cashier_id);

CREATE INDEX IF NOT EXISTS idx_incentive_stmt_status ON public.cashier_incentive_statements USING btree (status);

CREATE INDEX IF NOT EXISTS idx_influencer_contracts_branch ON public.influencer_contracts USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_influencer_contracts_influencer ON public.influencer_contracts USING btree (influencer_id);

CREATE INDEX IF NOT EXISTS idx_influencer_contracts_payment ON public.influencer_contracts USING btree (payment_status);

CREATE INDEX IF NOT EXISTS idx_influencer_contracts_status ON public.influencer_contracts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_interest_declarations_member ON public.interest_declarations USING btree (board_member_id);

CREATE INDEX IF NOT EXISTS idx_interest_declarations_status ON public.interest_declarations USING btree (status);

CREATE INDEX IF NOT EXISTS idx_interest_declarations_type ON public.interest_declarations USING btree (declaration_type);

CREATE INDEX IF NOT EXISTS idx_interest_declarations_year ON public.interest_declarations USING btree (fiscal_year);

CREATE INDEX IF NOT EXISTS idx_inventory_items_branch_category ON public.inventory_items USING btree (branch_id, category);

CREATE INDEX IF NOT EXISTS idx_inventory_items_branch_status ON public.inventory_items USING btree (branch_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_items_created ON public.inventory_items USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_branch ON public.production_inventory_logs USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON public.production_inventory_logs USING btree (product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON public.production_inventory_logs USING btree (movement_type);

CREATE INDEX IF NOT EXISTS idx_journal_entry_branch ON public.accounting_journal_entries USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_date ON public.accounting_journal_entries USING btree (entry_date);

CREATE INDEX IF NOT EXISTS idx_journal_entry_status ON public.accounting_journal_entries USING btree (status);

CREATE INDEX IF NOT EXISTS idx_journal_entry_type ON public.accounting_journal_entries USING btree (entry_type);

CREATE INDEX IF NOT EXISTS idx_journal_reconciliation ON public.accounting_journal_entries USING btree (reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_material_transfer_items_item ON public.material_transfer_items USING btree (item_id);

CREATE INDEX IF NOT EXISTS idx_material_transfer_items_transfer ON public.material_transfer_items USING btree (transfer_id);

CREATE INDEX IF NOT EXISTS idx_material_transfers_date ON public.material_transfers USING btree (transfer_date);

CREATE INDEX IF NOT EXISTS idx_material_transfers_dest ON public.material_transfers USING btree (destination_branch_id);

CREATE INDEX IF NOT EXISTS idx_material_transfers_request ON public.material_transfers USING btree (request_id);

CREATE INDEX IF NOT EXISTS idx_material_transfers_source ON public.material_transfers USING btree (source_branch_id);

CREATE INDEX IF NOT EXISTS idx_material_transfers_status ON public.material_transfers USING btree (status);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_board_member ON public.meeting_attendance USING btree (board_member_id);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting ON public.meeting_attendance USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_shareholder ON public.meeting_attendance USING btree (shareholder_id);

CREATE INDEX IF NOT EXISTS idx_meeting_attendance_status ON public.meeting_attendance USING btree (attendance_status);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting ON public.meeting_minutes USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_number ON public.meeting_minutes USING btree (minutes_number);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_status ON public.meeting_minutes USING btree (status);

CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_meeting ON public.meeting_rsvps USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_shareholder ON public.meeting_rsvps USING btree (shareholder_id);

CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_token ON public.meeting_rsvps USING btree (token);

CREATE INDEX IF NOT EXISTS idx_notifications_branch ON public.notifications USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications USING btree (category);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications USING btree (is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON public.notifications USING btree (scheduled_for);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications USING btree (type);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_org_job_roles_active ON public.org_job_roles USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_org_job_roles_level ON public.org_job_roles USING btree (level);

CREATE INDEX IF NOT EXISTS idx_org_job_roles_parent ON public.org_job_roles USING btree (parent_id);

CREATE INDEX IF NOT EXISTS idx_permissions_module_action ON public.permissions USING btree (module, action);

CREATE INDEX IF NOT EXISTS idx_pnl_branch_settings_branch ON public.pnl_branch_settings USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_pnl_branch_settings_branch_id ON public.pnl_branch_settings USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_pnl_monthly_inputs_branch ON public.pnl_monthly_inputs USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_pnl_monthly_inputs_branch_period ON public.pnl_monthly_inputs USING btree (branch_id, year, month);

CREATE INDEX IF NOT EXISTS idx_pnl_monthly_inputs_branch_year_month ON public.pnl_monthly_inputs USING btree (branch_id, year, month);

CREATE INDEX IF NOT EXISTS idx_pnl_monthly_inputs_period ON public.pnl_monthly_inputs USING btree (year, month);

CREATE INDEX IF NOT EXISTS idx_points_branch_date ON public.cashier_points_ledger USING btree (branch_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_points_cashier_date ON public.cashier_points_ledger USING btree (cashier_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_points_status ON public.cashier_points_ledger USING btree (status);

CREATE INDEX IF NOT EXISTS idx_prod_inv_logs_branch ON public.production_inventory_logs USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_prod_inv_logs_product ON public.production_inventory_logs USING btree (product_id);

CREATE INDEX IF NOT EXISTS idx_prod_inv_logs_type ON public.production_inventory_logs USING btree (movement_type);

CREATE INDEX IF NOT EXISTS idx_product_prices_branch ON public.product_prices USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_product_prices_date ON public.product_prices USING btree (effective_date);

CREATE INDEX IF NOT EXISTS idx_product_prices_name ON public.product_prices USING btree (product_name);

CREATE INDEX IF NOT EXISTS idx_product_sales_cashier ON public.cashier_product_sales USING btree (cashier_id, sales_date);

CREATE INDEX IF NOT EXISTS idx_product_storage_category ON public.product_storage_settings USING btree (product_category);

CREATE INDEX IF NOT EXISTS idx_product_storage_name ON public.product_storage_settings USING btree (product_name);

CREATE INDEX IF NOT EXISTS idx_product_storage_verified ON public.product_storage_settings USING btree (is_verified);

CREATE INDEX IF NOT EXISTS idx_products_active ON public.products USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products USING btree (category);

CREATE INDEX IF NOT EXISTS idx_proxy_votes_holder ON public.proxy_votes USING btree (proxy_holder_shareholder_id);

CREATE INDEX IF NOT EXISTS idx_proxy_votes_meeting ON public.proxy_votes USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_proxy_votes_principal ON public.proxy_votes USING btree (principal_shareholder_id);

CREATE INDEX IF NOT EXISTS idx_proxy_votes_status ON public.proxy_votes USING btree (status);

CREATE INDEX IF NOT EXISTS idx_purchasing_requests_branch ON public.purchasing_requests USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_purchasing_requests_status ON public.purchasing_requests USING btree (status);

CREATE INDEX IF NOT EXISTS idx_quorum_calculations_meeting ON public.quorum_calculations USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_quorum_calculations_resolution ON public.quorum_calculations USING btree (resolution_id);

CREATE INDEX IF NOT EXISTS idx_quorum_calculations_type ON public.quorum_calculations USING btree (calculation_type);

CREATE INDEX IF NOT EXISTS idx_reconciliation_branch ON public.accounting_reconciliations USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_date ON public.accounting_reconciliations USING btree (reconciliation_date);

CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON public.accounting_reconciliations USING btree (status);

CREATE INDEX IF NOT EXISTS idx_resolution_signatures_member ON public.resolution_signatures USING btree (board_member_id);

CREATE INDEX IF NOT EXISTS idx_resolution_signatures_resolution ON public.resolution_signatures USING btree (resolution_id);

CREATE INDEX IF NOT EXISTS idx_resolution_signatures_shareholder ON public.resolution_signatures USING btree (shareholder_id);

CREATE INDEX IF NOT EXISTS idx_resolution_signatures_status ON public.resolution_signatures USING btree (status);

CREATE INDEX IF NOT EXISTS idx_resolution_signatures_token ON public.resolution_signatures USING btree (signature_token);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_board_member ON public.resolution_votes USING btree (board_member_id);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_resolution ON public.resolution_votes USING btree (resolution_id);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_shareholder ON public.resolution_votes USING btree (shareholder_id);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_vote ON public.resolution_votes USING btree (vote);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_branch ON public.schedule_change_audit USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_date ON public.schedule_change_audit USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_employee ON public.schedule_change_audit USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_week ON public.schedule_change_audit USING btree (week_start_date);

CREATE INDEX IF NOT EXISTS idx_schedule_periods_branch ON public.schedule_periods USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_schedule_periods_dates ON public.schedule_periods USING btree (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_day ON public.social_schedule_slots USING btree (day_of_week);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_platform ON public.social_schedule_slots USING btree (platform);

CREATE INDEX IF NOT EXISTS idx_share_transfers_date ON public.share_transfers USING btree (transfer_date);

CREATE INDEX IF NOT EXISTS idx_share_transfers_from ON public.share_transfers USING btree (from_shareholder_id);

CREATE INDEX IF NOT EXISTS idx_share_transfers_status ON public.share_transfers USING btree (approval_status);

CREATE INDEX IF NOT EXISTS idx_share_transfers_to ON public.share_transfers USING btree (to_shareholder_id);

CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_distribution ON public.shareholder_dividends USING btree (distribution_id);

CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_shareholder ON public.shareholder_dividends USING btree (shareholder_id);

CREATE INDEX IF NOT EXISTS idx_shareholder_dividends_status ON public.shareholder_dividends USING btree (status);

CREATE INDEX IF NOT EXISTS idx_shareholder_docs_shareholder ON public.shareholder_documents USING btree (shareholder_id);

CREATE INDEX IF NOT EXISTS idx_shareholder_docs_type ON public.shareholder_documents USING btree (document_type);

CREATE INDEX IF NOT EXISTS idx_shareholders_percentage ON public.shareholders USING btree (share_percentage);

CREATE INDEX IF NOT EXISTS idx_shareholders_status ON public.shareholders USING btree (status);

CREATE INDEX IF NOT EXISTS idx_shareholders_type ON public.shareholders USING btree (shareholder_type);

CREATE INDEX IF NOT EXISTS idx_shift_audit_action ON public.shift_audit_log USING btree (action);

CREATE INDEX IF NOT EXISTS idx_shift_audit_date ON public.shift_audit_log USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_shift_audit_shift ON public.shift_audit_log USING btree (shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_checklist_item ON public.shift_checklist_responses USING btree (item_id);

CREATE INDEX IF NOT EXISTS idx_shift_checklist_shift ON public.shift_checklist_responses USING btree (shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_photos_shift ON public.shift_photos USING btree (shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_reminders_branch ON public.shift_reminders USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_shift_reminders_date ON public.shift_reminders USING btree (shift_date);

CREATE INDEX IF NOT EXISTS idx_shift_reminders_sent ON public.shift_reminders USING btree (is_sent);

CREATE INDEX IF NOT EXISTS idx_shift_signatures_shift ON public.shift_signatures USING btree (shift_id);

CREATE INDEX IF NOT EXISTS idx_social_accounts_branch ON public.social_accounts USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON public.social_accounts USING btree (platform);

CREATE INDEX IF NOT EXISTS idx_social_init_beneficiary ON public.social_initiatives USING btree (beneficiary_organization_id);

CREATE INDEX IF NOT EXISTS idx_social_init_dates ON public.social_initiatives USING btree (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_social_init_status ON public.social_initiatives USING btree (status);

CREATE INDEX IF NOT EXISTS idx_social_init_type ON public.social_initiatives USING btree (initiative_type);

CREATE INDEX IF NOT EXISTS idx_social_metrics_platform ON public.social_post_metrics USING btree (platform);

CREATE INDEX IF NOT EXISTS idx_social_metrics_post ON public.social_post_metrics USING btree (post_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_campaign ON public.social_posts USING btree (campaign_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON public.social_posts USING btree (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_status_history_comparison ON public.comparison_status_history USING btree (comparison_id);

CREATE INDEX IF NOT EXISTS idx_status_history_date ON public.comparison_status_history USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_time_entries_attendance ON public.time_entries USING btree (attendance_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_branch ON public.time_entries USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON public.time_entries USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON public.timesheet_report_entries USING btree (date);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_report ON public.timesheet_report_entries USING btree (report_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_reports_branch ON public.timesheet_reports USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_reports_branch_employee ON public.timesheet_reports USING btree (branch_employee_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_reports_dates ON public.timesheet_reports USING btree (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_timesheet_reports_employee ON public.timesheet_reports USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_reports_status ON public.timesheet_reports USING btree (status);

CREATE INDEX IF NOT EXISTS idx_transfer_dest ON public.employee_transfer_requests USING btree (destination_branch_id);

CREATE INDEX IF NOT EXISTS idx_transfer_employee ON public.employee_transfer_requests USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_transfer_requested_by ON public.employee_transfer_requests USING btree (requested_by);

CREATE INDEX IF NOT EXISTS idx_transfer_source ON public.employee_transfer_requests USING btree (source_branch_id);

CREATE INDEX IF NOT EXISTS idx_transfer_status ON public.employee_transfer_requests USING btree (status);

CREATE INDEX IF NOT EXISTS idx_transfers_date ON public.finished_goods_transfers USING btree (transfer_date);

CREATE INDEX IF NOT EXISTS idx_transfers_dest_type ON public.finished_goods_transfers USING btree (destination_type);

CREATE INDEX IF NOT EXISTS idx_transfers_source ON public.finished_goods_transfers USING btree (source_branch_id);

CREATE INDEX IF NOT EXISTS idx_travel_expenses_request ON public.travel_expenses USING btree (travel_request_id);

CREATE INDEX IF NOT EXISTS idx_travel_expenses_status ON public.travel_expenses USING btree (status);

CREATE INDEX IF NOT EXISTS idx_travel_expenses_type ON public.travel_expenses USING btree (expense_type);

CREATE INDEX IF NOT EXISTS idx_travel_requests_branch ON public.travel_requests USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_travel_requests_dates ON public.travel_requests USING btree (departure_date, return_date);

CREATE INDEX IF NOT EXISTS idx_travel_requests_number ON public.travel_requests USING btree (request_number);

CREATE INDEX IF NOT EXISTS idx_travel_requests_requester ON public.travel_requests USING btree (requester_id);

CREATE INDEX IF NOT EXISTS idx_travel_requests_status ON public.travel_requests USING btree (status);

CREATE INDEX IF NOT EXISTS idx_user_assignments_branch_id ON public.user_assignments USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_user_assignments_role_id ON public.user_assignments USING btree (role_id);

CREATE INDEX IF NOT EXISTS idx_user_assignments_user_id ON public.user_assignments USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_user_branch_access_user_id ON public.user_branch_access USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_branch ON public.visitor_logs USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_date ON public.visitor_logs USING btree (visit_date);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_host ON public.visitor_logs USING btree (host_id);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_number ON public.visitor_logs USING btree (visit_number);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_status ON public.visitor_logs USING btree (status);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor ON public.visitor_logs USING btree (visitor_id);

CREATE INDEX IF NOT EXISTS idx_visitors_branch ON public.visitors USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_visitors_company ON public.visitors USING btree (company);

CREATE INDEX IF NOT EXISTS idx_visitors_national_id ON public.visitors USING btree (national_id);

CREATE INDEX IF NOT EXISTS idx_visitors_phone ON public.visitors USING btree (phone);

CREATE INDEX IF NOT EXISTS idx_voting_audit_action ON public.voting_audit_log USING btree (action);

CREATE INDEX IF NOT EXISTS idx_voting_audit_actor ON public.voting_audit_log USING btree (actor_id);

CREATE INDEX IF NOT EXISTS idx_voting_audit_meeting ON public.voting_audit_log USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_voting_audit_resolution ON public.voting_audit_log USING btree (resolution_id);

CREATE INDEX IF NOT EXISTS idx_voting_audit_timestamp ON public.voting_audit_log USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS idx_voting_tokens_resolution ON public.voting_tokens USING btree (resolution_id);

CREATE INDEX IF NOT EXISTS idx_voting_tokens_shareholder ON public.voting_tokens USING btree (shareholder_id);

CREATE INDEX IF NOT EXISTS idx_voting_tokens_status ON public.voting_tokens USING btree (status);

CREATE INDEX IF NOT EXISTS idx_voting_tokens_token ON public.voting_tokens USING btree (vote_token);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_active ON public.warehouse_items USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_category ON public.warehouse_items USING btree (category);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_sku ON public.warehouse_items USING btree (sku);

CREATE INDEX IF NOT EXISTS idx_warehouse_logs_branch ON public.warehouse_movement_logs USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_logs_date ON public.warehouse_movement_logs USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_warehouse_logs_item ON public.warehouse_movement_logs USING btree (item_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_logs_type ON public.warehouse_movement_logs USING btree (movement_type);

CREATE INDEX IF NOT EXISTS idx_warehouse_notif_branch ON public.warehouse_notifications USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_notif_date ON public.warehouse_notifications USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_warehouse_notif_entity ON public.warehouse_notifications USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_notif_read ON public.warehouse_notifications USING btree (is_read);

CREATE INDEX IF NOT EXISTS idx_warehouse_notif_user ON public.warehouse_notifications USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_waste_alerts_branch ON public.waste_risk_alerts USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_waste_alerts_date ON public.waste_risk_alerts USING btree (alert_date);

CREATE INDEX IF NOT EXISTS idx_waste_alerts_rule ON public.waste_risk_alerts USING btree (rule_id);

CREATE INDEX IF NOT EXISTS idx_waste_alerts_severity ON public.waste_risk_alerts USING btree (severity);

CREATE INDEX IF NOT EXISTS idx_waste_alerts_status ON public.waste_risk_alerts USING btree (status);

CREATE INDEX IF NOT EXISTS idx_waste_rules_active ON public.waste_risk_rules USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_waste_rules_branch ON public.waste_risk_rules USING btree (branch_id);

CREATE INDEX IF NOT EXISTS idx_waste_rules_category ON public.waste_risk_rules USING btree (category);

CREATE INDEX IF NOT EXISTS idx_weekly_locks_branch ON public.weekly_schedule_locks USING btree (branch_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_locks_unique ON public.weekly_schedule_locks USING btree (branch_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_weekly_locks_week ON public.weekly_schedule_locks USING btree (week_start_date);


-- ============================================
-- التسلسلات - Sequences
-- ============================================

CREATE SEQUENCE IF NOT EXISTS public.accounting_exports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.accounting_journal_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.accounting_reconciliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.advanced_production_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.asset_transfer_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.asset_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.attendance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.attendance_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.average_ticket_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.backups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.beneficiary_organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.biometric_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.board_committees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.board_member_training_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.board_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.board_resolutions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_achievement_bonus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_custom_checklist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_daily_closure_journals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_daily_closure_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_daily_closures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_daily_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_monthly_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_shift_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.branch_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.campaign_budget_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.campaign_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.campaign_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.capital_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_daily_challenges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_incentive_statements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_payment_breakdowns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_points_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_product_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_sales_journals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_shift_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_shift_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cashier_signatures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.chart_of_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.checklist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.checklist_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.commission_calculations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.commission_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.committee_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.community_discounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.comparison_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.comparison_summaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.comparison_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.compliance_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.compliance_requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.construction_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.construction_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.construction_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.contract_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.contract_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.contractors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.daily_comparisons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.daily_operations_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.daily_production_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.daily_sales_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.daily_waste_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.data_import_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.disclosures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.discount_usage_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.display_bar_daily_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.display_bar_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.dividend_distributions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.document_access_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.document_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.document_folders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.document_shares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.document_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.employee_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.employee_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.employee_transfer_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.exec_correspondence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.exec_meeting_attendees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.exec_meetings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.exec_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.exec_task_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.exec_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.external_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.financial_cogs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.financial_fixed_costs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.financial_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.financial_operating_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.financial_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.financial_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.finished_goods_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.finished_goods_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.governance_meetings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.incentive_awards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.incentive_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.influencer_campaign_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.influencer_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.influencer_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.influencer_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.interest_declarations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.job_role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.journal_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.journal_entry_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_influencers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_performance_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_task_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.marketing_team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.material_transfer_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.material_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.meeting_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.meeting_minutes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.meeting_rsvps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.notification_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.org_job_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.payment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.performance_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.permission_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.permission_check_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.pnl_branch_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.pnl_monthly_inputs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.point_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.product_commissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.product_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.product_sales_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.product_storage_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.production_ai_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.production_inventory_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.production_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.production_order_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.production_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.project_budget_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.project_work_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.proxy_votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.purchasing_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.purchasing_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.quality_checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.quorum_calculations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.resolution_signatures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.resolution_votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.role_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.sales_data_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.saved_filters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.schedule_change_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.schedule_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.schedule_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.seasons_holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.security_violation_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.share_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shareholder_dividends_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shareholder_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shareholders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shift_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shift_checklist_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shift_employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shift_performance_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shift_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shift_reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shift_signatures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.social_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.social_content_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.social_initiatives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.social_post_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.social_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.social_schedule_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.system_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.target_daily_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.target_shift_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.target_weight_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.time_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.timesheet_report_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.timesheet_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.transfer_approval_steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.transfer_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.travel_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.travel_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.user_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.user_branch_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.user_permission_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.user_security_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.visitor_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.visitors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.voting_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.voting_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.warehouse_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.warehouse_movement_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.warehouse_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.waste_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.waste_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.waste_risk_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.waste_risk_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.weekly_schedule_locks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



-- ============================================
-- القيود والمفاتيح - Constraints & Keys
-- ============================================

ALTER TABLE ONLY public.accounting_exports ALTER COLUMN id SET DEFAULT nextval('public.accounting_exports_id_seq'::regclass);

ALTER TABLE ONLY public.accounting_journal_entries ALTER COLUMN id SET DEFAULT nextval('public.accounting_journal_entries_id_seq'::regclass);

ALTER TABLE ONLY public.accounting_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.accounting_reconciliations_id_seq'::regclass);

ALTER TABLE ONLY public.advanced_production_orders ALTER COLUMN id SET DEFAULT nextval('public.advanced_production_orders_id_seq'::regclass);

ALTER TABLE ONLY public.asset_transfer_events ALTER COLUMN id SET DEFAULT nextval('public.asset_transfer_events_id_seq'::regclass);

ALTER TABLE ONLY public.asset_transfers ALTER COLUMN id SET DEFAULT nextval('public.asset_transfers_id_seq'::regclass);

ALTER TABLE ONLY public.attendance_records ALTER COLUMN id SET DEFAULT nextval('public.attendance_records_id_seq'::regclass);

ALTER TABLE ONLY public.attendance_summary ALTER COLUMN id SET DEFAULT nextval('public.attendance_summary_id_seq'::regclass);

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

ALTER TABLE ONLY public.average_ticket_targets ALTER COLUMN id SET DEFAULT nextval('public.average_ticket_targets_id_seq'::regclass);

ALTER TABLE ONLY public.backups ALTER COLUMN id SET DEFAULT nextval('public.backups_id_seq'::regclass);

ALTER TABLE ONLY public.beneficiary_organizations ALTER COLUMN id SET DEFAULT nextval('public.beneficiary_organizations_id_seq'::regclass);

ALTER TABLE ONLY public.biometric_credentials ALTER COLUMN id SET DEFAULT nextval('public.biometric_credentials_id_seq'::regclass);

ALTER TABLE ONLY public.board_committees ALTER COLUMN id SET DEFAULT nextval('public.board_committees_id_seq'::regclass);

ALTER TABLE ONLY public.board_member_training ALTER COLUMN id SET DEFAULT nextval('public.board_member_training_id_seq'::regclass);

ALTER TABLE ONLY public.board_members ALTER COLUMN id SET DEFAULT nextval('public.board_members_id_seq'::regclass);

ALTER TABLE ONLY public.board_resolutions ALTER COLUMN id SET DEFAULT nextval('public.board_resolutions_id_seq'::regclass);

ALTER TABLE ONLY public.branch_achievement_bonus ALTER COLUMN id SET DEFAULT nextval('public.branch_achievement_bonus_id_seq'::regclass);

ALTER TABLE ONLY public.branch_custom_checklist_items ALTER COLUMN id SET DEFAULT nextval('public.branch_custom_checklist_items_id_seq'::regclass);

ALTER TABLE ONLY public.branch_daily_closure_journals ALTER COLUMN id SET DEFAULT nextval('public.branch_daily_closure_journals_id_seq'::regclass);

ALTER TABLE ONLY public.branch_daily_closure_payments ALTER COLUMN id SET DEFAULT nextval('public.branch_daily_closure_payments_id_seq'::regclass);

ALTER TABLE ONLY public.branch_daily_closures ALTER COLUMN id SET DEFAULT nextval('public.branch_daily_closures_id_seq'::regclass);

ALTER TABLE ONLY public.branch_daily_sales ALTER COLUMN id SET DEFAULT nextval('public.branch_daily_sales_id_seq'::regclass);

ALTER TABLE ONLY public.branch_employees ALTER COLUMN id SET DEFAULT nextval('public.branch_employees_id_seq'::regclass);

ALTER TABLE ONLY public.branch_monthly_targets ALTER COLUMN id SET DEFAULT nextval('public.branch_monthly_targets_id_seq'::regclass);

ALTER TABLE ONLY public.branch_shift_profiles ALTER COLUMN id SET DEFAULT nextval('public.branch_shift_profiles_id_seq'::regclass);

ALTER TABLE ONLY public.branch_shifts ALTER COLUMN id SET DEFAULT nextval('public.branch_shifts_id_seq'::regclass);

ALTER TABLE ONLY public.branch_stock ALTER COLUMN id SET DEFAULT nextval('public.branch_stock_id_seq'::regclass);

ALTER TABLE ONLY public.campaign_budget_allocations ALTER COLUMN id SET DEFAULT nextval('public.campaign_budget_allocations_id_seq'::regclass);

ALTER TABLE ONLY public.campaign_expenses ALTER COLUMN id SET DEFAULT nextval('public.campaign_expenses_id_seq'::regclass);

ALTER TABLE ONLY public.campaign_goals ALTER COLUMN id SET DEFAULT nextval('public.campaign_goals_id_seq'::regclass);

ALTER TABLE ONLY public.capital_transactions ALTER COLUMN id SET DEFAULT nextval('public.capital_transactions_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_daily_challenges ALTER COLUMN id SET DEFAULT nextval('public.cashier_daily_challenges_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_incentive_statements ALTER COLUMN id SET DEFAULT nextval('public.cashier_incentive_statements_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_payment_breakdowns ALTER COLUMN id SET DEFAULT nextval('public.cashier_payment_breakdowns_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_points_ledger ALTER COLUMN id SET DEFAULT nextval('public.cashier_points_ledger_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_product_sales ALTER COLUMN id SET DEFAULT nextval('public.cashier_product_sales_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_sales_journals ALTER COLUMN id SET DEFAULT nextval('public.cashier_sales_journals_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_shift_performance ALTER COLUMN id SET DEFAULT nextval('public.cashier_shift_performance_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_shift_targets ALTER COLUMN id SET DEFAULT nextval('public.cashier_shift_targets_id_seq'::regclass);

ALTER TABLE ONLY public.cashier_signatures ALTER COLUMN id SET DEFAULT nextval('public.cashier_signatures_id_seq'::regclass);

ALTER TABLE ONLY public.chart_of_accounts ALTER COLUMN id SET DEFAULT nextval('public.chart_of_accounts_id_seq'::regclass);

ALTER TABLE ONLY public.checklist_items ALTER COLUMN id SET DEFAULT nextval('public.checklist_items_id_seq'::regclass);

ALTER TABLE ONLY public.checklist_templates ALTER COLUMN id SET DEFAULT nextval('public.checklist_templates_id_seq'::regclass);

ALTER TABLE ONLY public.commission_calculations ALTER COLUMN id SET DEFAULT nextval('public.commission_calculations_id_seq'::regclass);

ALTER TABLE ONLY public.commission_rates ALTER COLUMN id SET DEFAULT nextval('public.commission_rates_id_seq'::regclass);

ALTER TABLE ONLY public.committee_memberships ALTER COLUMN id SET DEFAULT nextval('public.committee_memberships_id_seq'::regclass);

ALTER TABLE ONLY public.community_discounts ALTER COLUMN id SET DEFAULT nextval('public.community_discounts_id_seq'::regclass);

ALTER TABLE ONLY public.comparison_status_history ALTER COLUMN id SET DEFAULT nextval('public.comparison_status_history_id_seq'::regclass);

ALTER TABLE ONLY public.comparison_summaries ALTER COLUMN id SET DEFAULT nextval('public.comparison_summaries_id_seq'::regclass);

ALTER TABLE ONLY public.comparison_uploads ALTER COLUMN id SET DEFAULT nextval('public.comparison_uploads_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_history ALTER COLUMN id SET DEFAULT nextval('public.compliance_history_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_requirements ALTER COLUMN id SET DEFAULT nextval('public.compliance_requirements_id_seq'::regclass);

ALTER TABLE ONLY public.construction_categories ALTER COLUMN id SET DEFAULT nextval('public.construction_categories_id_seq'::regclass);

ALTER TABLE ONLY public.construction_contracts ALTER COLUMN id SET DEFAULT nextval('public.construction_contracts_id_seq'::regclass);

ALTER TABLE ONLY public.construction_projects ALTER COLUMN id SET DEFAULT nextval('public.construction_projects_id_seq'::regclass);

ALTER TABLE ONLY public.contract_items ALTER COLUMN id SET DEFAULT nextval('public.contract_items_id_seq'::regclass);

ALTER TABLE ONLY public.contract_payments ALTER COLUMN id SET DEFAULT nextval('public.contract_payments_id_seq'::regclass);

ALTER TABLE ONLY public.contractors ALTER COLUMN id SET DEFAULT nextval('public.contractors_id_seq'::regclass);

ALTER TABLE ONLY public.daily_comparisons ALTER COLUMN id SET DEFAULT nextval('public.daily_comparisons_id_seq'::regclass);

ALTER TABLE ONLY public.daily_operations_summary ALTER COLUMN id SET DEFAULT nextval('public.daily_operations_summary_id_seq'::regclass);

ALTER TABLE ONLY public.daily_production_batches ALTER COLUMN id SET DEFAULT nextval('public.daily_production_batches_id_seq'::regclass);

ALTER TABLE ONLY public.daily_sales_data ALTER COLUMN id SET DEFAULT nextval('public.daily_sales_data_id_seq'::regclass);

ALTER TABLE ONLY public.daily_waste_log ALTER COLUMN id SET DEFAULT nextval('public.daily_waste_log_id_seq'::regclass);

ALTER TABLE ONLY public.data_import_jobs ALTER COLUMN id SET DEFAULT nextval('public.data_import_jobs_id_seq'::regclass);

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);

ALTER TABLE ONLY public.disclosures ALTER COLUMN id SET DEFAULT nextval('public.disclosures_id_seq'::regclass);

ALTER TABLE ONLY public.discount_usage_logs ALTER COLUMN id SET DEFAULT nextval('public.discount_usage_logs_id_seq'::regclass);

ALTER TABLE ONLY public.display_bar_daily_summary ALTER COLUMN id SET DEFAULT nextval('public.display_bar_daily_summary_id_seq'::regclass);

ALTER TABLE ONLY public.display_bar_receipts ALTER COLUMN id SET DEFAULT nextval('public.display_bar_receipts_id_seq'::regclass);

ALTER TABLE ONLY public.dividend_distributions ALTER COLUMN id SET DEFAULT nextval('public.dividend_distributions_id_seq'::regclass);

ALTER TABLE ONLY public.document_access_logs ALTER COLUMN id SET DEFAULT nextval('public.document_access_logs_id_seq'::regclass);

ALTER TABLE ONLY public.document_categories ALTER COLUMN id SET DEFAULT nextval('public.document_categories_id_seq'::regclass);

ALTER TABLE ONLY public.document_folders ALTER COLUMN id SET DEFAULT nextval('public.document_folders_id_seq'::regclass);

ALTER TABLE ONLY public.document_shares ALTER COLUMN id SET DEFAULT nextval('public.document_shares_id_seq'::regclass);

ALTER TABLE ONLY public.document_versions ALTER COLUMN id SET DEFAULT nextval('public.document_versions_id_seq'::regclass);

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);

ALTER TABLE ONLY public.employee_schedules ALTER COLUMN id SET DEFAULT nextval('public.employee_schedules_id_seq'::regclass);

ALTER TABLE ONLY public.employee_settings ALTER COLUMN id SET DEFAULT nextval('public.employee_settings_id_seq'::regclass);

ALTER TABLE ONLY public.employee_transfer_requests ALTER COLUMN id SET DEFAULT nextval('public.employee_transfer_requests_id_seq'::regclass);

ALTER TABLE ONLY public.exec_correspondence ALTER COLUMN id SET DEFAULT nextval('public.exec_correspondence_id_seq'::regclass);

ALTER TABLE ONLY public.exec_meeting_attendees ALTER COLUMN id SET DEFAULT nextval('public.exec_meeting_attendees_id_seq'::regclass);

ALTER TABLE ONLY public.exec_meetings ALTER COLUMN id SET DEFAULT nextval('public.exec_meetings_id_seq'::regclass);

ALTER TABLE ONLY public.exec_notifications ALTER COLUMN id SET DEFAULT nextval('public.exec_notifications_id_seq'::regclass);

ALTER TABLE ONLY public.exec_task_comments ALTER COLUMN id SET DEFAULT nextval('public.exec_task_comments_id_seq'::regclass);

ALTER TABLE ONLY public.exec_tasks ALTER COLUMN id SET DEFAULT nextval('public.exec_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.external_integrations ALTER COLUMN id SET DEFAULT nextval('public.external_integrations_id_seq'::regclass);

ALTER TABLE ONLY public.financial_cogs ALTER COLUMN id SET DEFAULT nextval('public.financial_cogs_id_seq'::regclass);

ALTER TABLE ONLY public.financial_fixed_costs ALTER COLUMN id SET DEFAULT nextval('public.financial_fixed_costs_id_seq'::regclass);

ALTER TABLE ONLY public.financial_metrics ALTER COLUMN id SET DEFAULT nextval('public.financial_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.financial_operating_expenses ALTER COLUMN id SET DEFAULT nextval('public.financial_operating_expenses_id_seq'::regclass);

ALTER TABLE ONLY public.financial_periods ALTER COLUMN id SET DEFAULT nextval('public.financial_periods_id_seq'::regclass);

ALTER TABLE ONLY public.financial_sales ALTER COLUMN id SET DEFAULT nextval('public.financial_sales_id_seq'::regclass);

ALTER TABLE ONLY public.finished_goods_inventory ALTER COLUMN id SET DEFAULT nextval('public.finished_goods_inventory_id_seq'::regclass);

ALTER TABLE ONLY public.finished_goods_transfers ALTER COLUMN id SET DEFAULT nextval('public.finished_goods_transfers_id_seq'::regclass);

ALTER TABLE ONLY public.governance_meetings ALTER COLUMN id SET DEFAULT nextval('public.governance_meetings_id_seq'::regclass);

ALTER TABLE ONLY public.incentive_awards ALTER COLUMN id SET DEFAULT nextval('public.incentive_awards_id_seq'::regclass);

ALTER TABLE ONLY public.incentive_tiers ALTER COLUMN id SET DEFAULT nextval('public.incentive_tiers_id_seq'::regclass);

ALTER TABLE ONLY public.influencer_campaign_links ALTER COLUMN id SET DEFAULT nextval('public.influencer_campaign_links_id_seq'::regclass);

ALTER TABLE ONLY public.influencer_contacts ALTER COLUMN id SET DEFAULT nextval('public.influencer_contacts_id_seq'::regclass);

ALTER TABLE ONLY public.influencer_contracts ALTER COLUMN id SET DEFAULT nextval('public.influencer_contracts_id_seq'::regclass);

ALTER TABLE ONLY public.influencer_payments ALTER COLUMN id SET DEFAULT nextval('public.influencer_payments_id_seq'::regclass);

ALTER TABLE ONLY public.interest_declarations ALTER COLUMN id SET DEFAULT nextval('public.interest_declarations_id_seq'::regclass);

ALTER TABLE ONLY public.job_role_permissions ALTER COLUMN id SET DEFAULT nextval('public.job_role_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.journal_attachments ALTER COLUMN id SET DEFAULT nextval('public.journal_attachments_id_seq'::regclass);

ALTER TABLE ONLY public.journal_entry_lines ALTER COLUMN id SET DEFAULT nextval('public.journal_entry_lines_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_alerts ALTER COLUMN id SET DEFAULT nextval('public.marketing_alerts_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_assets ALTER COLUMN id SET DEFAULT nextval('public.marketing_assets_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_calendar_events ALTER COLUMN id SET DEFAULT nextval('public.marketing_calendar_events_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_campaigns ALTER COLUMN id SET DEFAULT nextval('public.marketing_campaigns_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_influencers ALTER COLUMN id SET DEFAULT nextval('public.marketing_influencers_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_performance_reports ALTER COLUMN id SET DEFAULT nextval('public.marketing_performance_reports_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_task_activities ALTER COLUMN id SET DEFAULT nextval('public.marketing_task_activities_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_tasks ALTER COLUMN id SET DEFAULT nextval('public.marketing_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.marketing_team_members ALTER COLUMN id SET DEFAULT nextval('public.marketing_team_members_id_seq'::regclass);

ALTER TABLE ONLY public.material_transfer_items ALTER COLUMN id SET DEFAULT nextval('public.material_transfer_items_id_seq'::regclass);

ALTER TABLE ONLY public.material_transfers ALTER COLUMN id SET DEFAULT nextval('public.material_transfers_id_seq'::regclass);

ALTER TABLE ONLY public.meeting_attendance ALTER COLUMN id SET DEFAULT nextval('public.meeting_attendance_id_seq'::regclass);

ALTER TABLE ONLY public.meeting_minutes ALTER COLUMN id SET DEFAULT nextval('public.meeting_minutes_id_seq'::regclass);

ALTER TABLE ONLY public.meeting_rsvps ALTER COLUMN id SET DEFAULT nextval('public.meeting_rsvps_id_seq'::regclass);

ALTER TABLE ONLY public.notification_queue ALTER COLUMN id SET DEFAULT nextval('public.notification_queue_id_seq'::regclass);

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);

ALTER TABLE ONLY public.org_job_roles ALTER COLUMN id SET DEFAULT nextval('public.org_job_roles_id_seq'::regclass);

ALTER TABLE ONLY public.payment_requests ALTER COLUMN id SET DEFAULT nextval('public.payment_requests_id_seq'::regclass);

ALTER TABLE ONLY public.performance_alerts ALTER COLUMN id SET DEFAULT nextval('public.performance_alerts_id_seq'::regclass);

ALTER TABLE ONLY public.permission_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.permission_audit_logs_id_seq'::regclass);

ALTER TABLE ONLY public.permission_check_logs ALTER COLUMN id SET DEFAULT nextval('public.permission_check_logs_id_seq'::regclass);

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);

ALTER TABLE ONLY public.pnl_branch_settings ALTER COLUMN id SET DEFAULT nextval('public.pnl_branch_settings_id_seq'::regclass);

ALTER TABLE ONLY public.pnl_monthly_inputs ALTER COLUMN id SET DEFAULT nextval('public.pnl_monthly_inputs_id_seq'::regclass);

ALTER TABLE ONLY public.point_settings ALTER COLUMN id SET DEFAULT nextval('public.point_settings_id_seq'::regclass);

ALTER TABLE ONLY public.product_commissions ALTER COLUMN id SET DEFAULT nextval('public.product_commissions_id_seq'::regclass);

ALTER TABLE ONLY public.product_prices ALTER COLUMN id SET DEFAULT nextval('public.product_prices_id_seq'::regclass);

ALTER TABLE ONLY public.product_sales_analytics ALTER COLUMN id SET DEFAULT nextval('public.product_sales_analytics_id_seq'::regclass);

ALTER TABLE ONLY public.product_storage_settings ALTER COLUMN id SET DEFAULT nextval('public.product_storage_settings_id_seq'::regclass);

ALTER TABLE ONLY public.production_ai_plans ALTER COLUMN id SET DEFAULT nextval('public.production_ai_plans_id_seq'::regclass);

ALTER TABLE ONLY public.production_inventory_logs ALTER COLUMN id SET DEFAULT nextval('public.production_inventory_logs_id_seq'::regclass);

ALTER TABLE ONLY public.production_order_items ALTER COLUMN id SET DEFAULT nextval('public.production_order_items_id_seq'::regclass);

ALTER TABLE ONLY public.production_order_schedules ALTER COLUMN id SET DEFAULT nextval('public.production_order_schedules_id_seq'::regclass);

ALTER TABLE ONLY public.production_orders ALTER COLUMN id SET DEFAULT nextval('public.production_orders_id_seq'::regclass);

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);

ALTER TABLE ONLY public.project_budget_allocations ALTER COLUMN id SET DEFAULT nextval('public.project_budget_allocations_id_seq'::regclass);

ALTER TABLE ONLY public.project_work_items ALTER COLUMN id SET DEFAULT nextval('public.project_work_items_id_seq'::regclass);

ALTER TABLE ONLY public.proxy_votes ALTER COLUMN id SET DEFAULT nextval('public.proxy_votes_id_seq'::regclass);

ALTER TABLE ONLY public.purchasing_request_items ALTER COLUMN id SET DEFAULT nextval('public.purchasing_request_items_id_seq'::regclass);

ALTER TABLE ONLY public.purchasing_requests ALTER COLUMN id SET DEFAULT nextval('public.purchasing_requests_id_seq'::regclass);

ALTER TABLE ONLY public.quality_checks ALTER COLUMN id SET DEFAULT nextval('public.quality_checks_id_seq'::regclass);

ALTER TABLE ONLY public.quorum_calculations ALTER COLUMN id SET DEFAULT nextval('public.quorum_calculations_id_seq'::regclass);

ALTER TABLE ONLY public.resolution_signatures ALTER COLUMN id SET DEFAULT nextval('public.resolution_signatures_id_seq'::regclass);

ALTER TABLE ONLY public.resolution_votes ALTER COLUMN id SET DEFAULT nextval('public.resolution_votes_id_seq'::regclass);

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.role_templates ALTER COLUMN id SET DEFAULT nextval('public.role_templates_id_seq'::regclass);

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);

ALTER TABLE ONLY public.sales_data_uploads ALTER COLUMN id SET DEFAULT nextval('public.sales_data_uploads_id_seq'::regclass);

ALTER TABLE ONLY public.saved_filters ALTER COLUMN id SET DEFAULT nextval('public.saved_filters_id_seq'::regclass);

ALTER TABLE ONLY public.schedule_change_audit ALTER COLUMN id SET DEFAULT nextval('public.schedule_change_audit_id_seq'::regclass);

ALTER TABLE ONLY public.schedule_periods ALTER COLUMN id SET DEFAULT nextval('public.schedule_periods_id_seq'::regclass);

ALTER TABLE ONLY public.schedule_templates ALTER COLUMN id SET DEFAULT nextval('public.schedule_templates_id_seq'::regclass);

ALTER TABLE ONLY public.seasons_holidays ALTER COLUMN id SET DEFAULT nextval('public.seasons_holidays_id_seq'::regclass);

ALTER TABLE ONLY public.security_violation_alerts ALTER COLUMN id SET DEFAULT nextval('public.security_violation_alerts_id_seq'::regclass);

ALTER TABLE ONLY public.share_transfers ALTER COLUMN id SET DEFAULT nextval('public.share_transfers_id_seq'::regclass);

ALTER TABLE ONLY public.shareholder_dividends ALTER COLUMN id SET DEFAULT nextval('public.shareholder_dividends_id_seq'::regclass);

ALTER TABLE ONLY public.shareholder_documents ALTER COLUMN id SET DEFAULT nextval('public.shareholder_documents_id_seq'::regclass);

ALTER TABLE ONLY public.shareholders ALTER COLUMN id SET DEFAULT nextval('public.shareholders_id_seq'::regclass);

ALTER TABLE ONLY public.shift_audit_log ALTER COLUMN id SET DEFAULT nextval('public.shift_audit_log_id_seq'::regclass);

ALTER TABLE ONLY public.shift_checklist_responses ALTER COLUMN id SET DEFAULT nextval('public.shift_checklist_responses_id_seq'::regclass);

ALTER TABLE ONLY public.shift_employees ALTER COLUMN id SET DEFAULT nextval('public.shift_employees_id_seq'::regclass);

ALTER TABLE ONLY public.shift_performance_tracking ALTER COLUMN id SET DEFAULT nextval('public.shift_performance_tracking_id_seq'::regclass);

ALTER TABLE ONLY public.shift_photos ALTER COLUMN id SET DEFAULT nextval('public.shift_photos_id_seq'::regclass);

ALTER TABLE ONLY public.shift_reminders ALTER COLUMN id SET DEFAULT nextval('public.shift_reminders_id_seq'::regclass);

ALTER TABLE ONLY public.shift_signatures ALTER COLUMN id SET DEFAULT nextval('public.shift_signatures_id_seq'::regclass);

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);

ALTER TABLE ONLY public.social_accounts ALTER COLUMN id SET DEFAULT nextval('public.social_accounts_id_seq'::regclass);

ALTER TABLE ONLY public.social_content_templates ALTER COLUMN id SET DEFAULT nextval('public.social_content_templates_id_seq'::regclass);

ALTER TABLE ONLY public.social_initiatives ALTER COLUMN id SET DEFAULT nextval('public.social_initiatives_id_seq'::regclass);

ALTER TABLE ONLY public.social_post_metrics ALTER COLUMN id SET DEFAULT nextval('public.social_post_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.social_posts ALTER COLUMN id SET DEFAULT nextval('public.social_posts_id_seq'::regclass);

ALTER TABLE ONLY public.social_schedule_slots ALTER COLUMN id SET DEFAULT nextval('public.social_schedule_slots_id_seq'::regclass);

ALTER TABLE ONLY public.system_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.system_audit_logs_id_seq'::regclass);

ALTER TABLE ONLY public.target_daily_allocations ALTER COLUMN id SET DEFAULT nextval('public.target_daily_allocations_id_seq'::regclass);

ALTER TABLE ONLY public.target_shift_allocations ALTER COLUMN id SET DEFAULT nextval('public.target_shift_allocations_id_seq'::regclass);

ALTER TABLE ONLY public.target_weight_profiles ALTER COLUMN id SET DEFAULT nextval('public.target_weight_profiles_id_seq'::regclass);

ALTER TABLE ONLY public.time_entries ALTER COLUMN id SET DEFAULT nextval('public.time_entries_id_seq'::regclass);

ALTER TABLE ONLY public.timesheet_report_entries ALTER COLUMN id SET DEFAULT nextval('public.timesheet_report_entries_id_seq'::regclass);

ALTER TABLE ONLY public.timesheet_reports ALTER COLUMN id SET DEFAULT nextval('public.timesheet_reports_id_seq'::regclass);

ALTER TABLE ONLY public.transfer_approval_steps ALTER COLUMN id SET DEFAULT nextval('public.transfer_approval_steps_id_seq'::regclass);

ALTER TABLE ONLY public.transfer_history ALTER COLUMN id SET DEFAULT nextval('public.transfer_history_id_seq'::regclass);

ALTER TABLE ONLY public.travel_expenses ALTER COLUMN id SET DEFAULT nextval('public.travel_expenses_id_seq'::regclass);

ALTER TABLE ONLY public.travel_requests ALTER COLUMN id SET DEFAULT nextval('public.travel_requests_id_seq'::regclass);

ALTER TABLE ONLY public.user_assignments ALTER COLUMN id SET DEFAULT nextval('public.user_assignments_id_seq'::regclass);

ALTER TABLE ONLY public.user_branch_access ALTER COLUMN id SET DEFAULT nextval('public.user_branch_access_id_seq'::regclass);

ALTER TABLE ONLY public.user_permission_overrides ALTER COLUMN id SET DEFAULT nextval('public.user_permission_overrides_id_seq'::regclass);

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.user_security_settings ALTER COLUMN id SET DEFAULT nextval('public.user_security_settings_id_seq'::regclass);

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.visitor_logs ALTER COLUMN id SET DEFAULT nextval('public.visitor_logs_id_seq'::regclass);

ALTER TABLE ONLY public.visitors ALTER COLUMN id SET DEFAULT nextval('public.visitors_id_seq'::regclass);

ALTER TABLE ONLY public.voting_audit_log ALTER COLUMN id SET DEFAULT nextval('public.voting_audit_log_id_seq'::regclass);

ALTER TABLE ONLY public.voting_tokens ALTER COLUMN id SET DEFAULT nextval('public.voting_tokens_id_seq'::regclass);

ALTER TABLE ONLY public.warehouse_items ALTER COLUMN id SET DEFAULT nextval('public.warehouse_items_id_seq'::regclass);

ALTER TABLE ONLY public.warehouse_movement_logs ALTER COLUMN id SET DEFAULT nextval('public.warehouse_movement_logs_id_seq'::regclass);

ALTER TABLE ONLY public.warehouse_notifications ALTER COLUMN id SET DEFAULT nextval('public.warehouse_notifications_id_seq'::regclass);

ALTER TABLE ONLY public.waste_items ALTER COLUMN id SET DEFAULT nextval('public.waste_items_id_seq'::regclass);

ALTER TABLE ONLY public.waste_reports ALTER COLUMN id SET DEFAULT nextval('public.waste_reports_id_seq'::regclass);

ALTER TABLE ONLY public.waste_risk_alerts ALTER COLUMN id SET DEFAULT nextval('public.waste_risk_alerts_id_seq'::regclass);

ALTER TABLE ONLY public.waste_risk_rules ALTER COLUMN id SET DEFAULT nextval('public.waste_risk_rules_id_seq'::regclass);

ALTER TABLE ONLY public.weekly_schedule_locks ALTER COLUMN id SET DEFAULT nextval('public.weekly_schedule_locks_id_seq'::regclass);

ALTER TABLE ONLY public.accounting_exports
    ADD CONSTRAINT accounting_exports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.advanced_production_orders
    ADD CONSTRAINT advanced_production_orders_order_number_key UNIQUE (order_number);

ALTER TABLE ONLY public.advanced_production_orders
    ADD CONSTRAINT advanced_production_orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.asset_transfer_events
    ADD CONSTRAINT asset_transfer_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_transfer_number_key UNIQUE (transfer_number);

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance_summary
    ADD CONSTRAINT attendance_summary_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.average_ticket_targets
    ADD CONSTRAINT average_ticket_targets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.beneficiary_organizations
    ADD CONSTRAINT beneficiary_organizations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.biometric_credentials
    ADD CONSTRAINT biometric_credentials_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.board_committees
    ADD CONSTRAINT board_committees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.board_member_training
    ADD CONSTRAINT board_member_training_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.board_members
    ADD CONSTRAINT board_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.board_resolutions
    ADD CONSTRAINT board_resolutions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.board_resolutions
    ADD CONSTRAINT board_resolutions_resolution_number_key UNIQUE (resolution_number);

ALTER TABLE ONLY public.branch_achievement_bonus
    ADD CONSTRAINT branch_achievement_bonus_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_custom_checklist_items
    ADD CONSTRAINT branch_custom_checklist_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_daily_closure_journals
    ADD CONSTRAINT branch_daily_closure_journals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_daily_closure_payments
    ADD CONSTRAINT branch_daily_closure_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_daily_closures
    ADD CONSTRAINT branch_daily_closures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_daily_sales
    ADD CONSTRAINT branch_daily_sales_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_employees
    ADD CONSTRAINT branch_employees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_monthly_targets
    ADD CONSTRAINT branch_monthly_targets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_shift_profiles
    ADD CONSTRAINT branch_shift_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_shifts
    ADD CONSTRAINT branch_shifts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_stock
    ADD CONSTRAINT branch_stock_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campaign_budget_allocations
    ADD CONSTRAINT campaign_budget_allocations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campaign_expenses
    ADD CONSTRAINT campaign_expenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campaign_goals
    ADD CONSTRAINT campaign_goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.capital_transactions
    ADD CONSTRAINT capital_transactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.capital_transactions
    ADD CONSTRAINT capital_transactions_transaction_number_key UNIQUE (transaction_number);

ALTER TABLE ONLY public.cashier_daily_challenges
    ADD CONSTRAINT cashier_daily_challenges_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_incentive_statements
    ADD CONSTRAINT cashier_incentive_statements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_payment_breakdowns
    ADD CONSTRAINT cashier_payment_breakdowns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_points_ledger
    ADD CONSTRAINT cashier_points_ledger_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_product_sales
    ADD CONSTRAINT cashier_product_sales_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_sales_journals
    ADD CONSTRAINT cashier_sales_journals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_shift_performance
    ADD CONSTRAINT cashier_shift_performance_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_shift_targets
    ADD CONSTRAINT cashier_shift_targets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashier_signatures
    ADD CONSTRAINT cashier_signatures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_account_code_key UNIQUE (account_code);

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.commission_rates
    ADD CONSTRAINT commission_rates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.committee_memberships
    ADD CONSTRAINT committee_memberships_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.community_discounts
    ADD CONSTRAINT community_discounts_code_key UNIQUE (code);

ALTER TABLE ONLY public.community_discounts
    ADD CONSTRAINT community_discounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comparison_status_history
    ADD CONSTRAINT comparison_status_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comparison_summaries
    ADD CONSTRAINT comparison_summaries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comparison_uploads
    ADD CONSTRAINT comparison_uploads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_history
    ADD CONSTRAINT compliance_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_requirement_code_key UNIQUE (requirement_code);

ALTER TABLE ONLY public.construction_categories
    ADD CONSTRAINT construction_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.construction_categories
    ADD CONSTRAINT construction_categories_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.construction_contracts
    ADD CONSTRAINT construction_contracts_contract_number_key UNIQUE (contract_number);

ALTER TABLE ONLY public.construction_contracts
    ADD CONSTRAINT construction_contracts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contract_items
    ADD CONSTRAINT contract_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contract_payments
    ADD CONSTRAINT contract_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_comparisons
    ADD CONSTRAINT daily_comparisons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_operations_summary
    ADD CONSTRAINT daily_operations_summary_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_sales_data
    ADD CONSTRAINT daily_sales_data_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_waste_log
    ADD CONSTRAINT daily_waste_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_import_jobs
    ADD CONSTRAINT data_import_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.disclosures
    ADD CONSTRAINT disclosures_disclosure_number_key UNIQUE (disclosure_number);

ALTER TABLE ONLY public.disclosures
    ADD CONSTRAINT disclosures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.discount_usage_logs
    ADD CONSTRAINT discount_usage_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.display_bar_daily_summary
    ADD CONSTRAINT display_bar_daily_summary_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.display_bar_receipts
    ADD CONSTRAINT display_bar_receipts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dividend_distributions
    ADD CONSTRAINT dividend_distributions_distribution_number_key UNIQUE (distribution_number);

ALTER TABLE ONLY public.dividend_distributions
    ADD CONSTRAINT dividend_distributions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.document_access_logs
    ADD CONSTRAINT document_access_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employee_schedules
    ADD CONSTRAINT employee_schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employee_settings
    ADD CONSTRAINT employee_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employee_transfer_requests
    ADD CONSTRAINT employee_transfer_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exec_correspondence
    ADD CONSTRAINT exec_correspondence_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exec_correspondence
    ADD CONSTRAINT exec_correspondence_ref_number_key UNIQUE (ref_number);

ALTER TABLE ONLY public.exec_meeting_attendees
    ADD CONSTRAINT exec_meeting_attendees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exec_meetings
    ADD CONSTRAINT exec_meetings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exec_notifications
    ADD CONSTRAINT exec_notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exec_task_comments
    ADD CONSTRAINT exec_task_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exec_tasks
    ADD CONSTRAINT exec_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.external_integrations
    ADD CONSTRAINT external_integrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_cogs
    ADD CONSTRAINT financial_cogs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_fixed_costs
    ADD CONSTRAINT financial_fixed_costs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_metrics
    ADD CONSTRAINT financial_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_operating_expenses
    ADD CONSTRAINT financial_operating_expenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_sales
    ADD CONSTRAINT financial_sales_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finished_goods_inventory
    ADD CONSTRAINT finished_goods_inventory_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finished_goods_transfers
    ADD CONSTRAINT finished_goods_transfers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.governance_meetings
    ADD CONSTRAINT governance_meetings_meeting_number_key UNIQUE (meeting_number);

ALTER TABLE ONLY public.governance_meetings
    ADD CONSTRAINT governance_meetings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.incentive_awards
    ADD CONSTRAINT incentive_awards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.incentive_tiers
    ADD CONSTRAINT incentive_tiers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.influencer_campaign_links
    ADD CONSTRAINT influencer_campaign_links_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.influencer_contacts
    ADD CONSTRAINT influencer_contacts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.influencer_contracts
    ADD CONSTRAINT influencer_contracts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.influencer_payments
    ADD CONSTRAINT influencer_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.interest_declarations
    ADD CONSTRAINT interest_declarations_declaration_number_key UNIQUE (declaration_number);

ALTER TABLE ONLY public.interest_declarations
    ADD CONSTRAINT interest_declarations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.job_role_permissions
    ADD CONSTRAINT job_role_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.journal_attachments
    ADD CONSTRAINT journal_attachments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_alerts
    ADD CONSTRAINT marketing_alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_calendar_events
    ADD CONSTRAINT marketing_calendar_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_influencers
    ADD CONSTRAINT marketing_influencers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_performance_reports
    ADD CONSTRAINT marketing_performance_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_task_activities
    ADD CONSTRAINT marketing_task_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_tasks
    ADD CONSTRAINT marketing_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketing_team_members
    ADD CONSTRAINT marketing_team_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_transfer_items
    ADD CONSTRAINT material_transfer_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_transfers
    ADD CONSTRAINT material_transfers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.material_transfers
    ADD CONSTRAINT material_transfers_transfer_number_key UNIQUE (transfer_number);

ALTER TABLE ONLY public.meeting_attendance
    ADD CONSTRAINT meeting_attendance_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_minutes_number_key UNIQUE (minutes_number);

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meeting_rsvps
    ADD CONSTRAINT meeting_rsvps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meeting_rsvps
    ADD CONSTRAINT meeting_rsvps_token_key UNIQUE (token);

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.org_job_roles
    ADD CONSTRAINT org_job_roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.org_job_roles
    ADD CONSTRAINT org_job_roles_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.performance_alerts
    ADD CONSTRAINT performance_alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permission_audit_logs
    ADD CONSTRAINT permission_audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permission_check_logs
    ADD CONSTRAINT permission_check_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pnl_branch_settings
    ADD CONSTRAINT pnl_branch_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pnl_monthly_inputs
    ADD CONSTRAINT pnl_monthly_inputs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.point_settings
    ADD CONSTRAINT point_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_commissions
    ADD CONSTRAINT product_commissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_storage_settings
    ADD CONSTRAINT product_storage_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_storage_settings
    ADD CONSTRAINT product_storage_settings_product_name_key UNIQUE (product_name);

ALTER TABLE ONLY public.production_ai_plans
    ADD CONSTRAINT production_ai_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.production_inventory_logs
    ADD CONSTRAINT production_inventory_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.production_order_items
    ADD CONSTRAINT production_order_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.production_order_schedules
    ADD CONSTRAINT production_order_schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_order_number_key UNIQUE (order_number);

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_budget_allocations
    ADD CONSTRAINT project_budget_allocations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.proxy_votes
    ADD CONSTRAINT proxy_votes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.proxy_votes
    ADD CONSTRAINT proxy_votes_proxy_number_key UNIQUE (proxy_number);

ALTER TABLE ONLY public.purchasing_request_items
    ADD CONSTRAINT purchasing_request_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.purchasing_requests
    ADD CONSTRAINT purchasing_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.purchasing_requests
    ADD CONSTRAINT purchasing_requests_request_number_key UNIQUE (request_number);

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.quorum_calculations
    ADD CONSTRAINT quorum_calculations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.resolution_signatures
    ADD CONSTRAINT resolution_signatures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.resolution_signatures
    ADD CONSTRAINT resolution_signatures_resolution_id_board_member_id_key UNIQUE (resolution_id, board_member_id);

ALTER TABLE ONLY public.resolution_signatures
    ADD CONSTRAINT resolution_signatures_signature_token_key UNIQUE (signature_token);

ALTER TABLE ONLY public.resolution_votes
    ADD CONSTRAINT resolution_votes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_templates
    ADD CONSTRAINT role_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_templates
    ADD CONSTRAINT role_templates_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.sales_data_uploads
    ADD CONSTRAINT sales_data_uploads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.saved_filters
    ADD CONSTRAINT saved_filters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedule_change_audit
    ADD CONSTRAINT schedule_change_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedule_templates
    ADD CONSTRAINT schedule_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.seasons_holidays
    ADD CONSTRAINT seasons_holidays_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.security_violation_alerts
    ADD CONSTRAINT security_violation_alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_transfer_number_key UNIQUE (transfer_number);

ALTER TABLE ONLY public.shareholder_dividends
    ADD CONSTRAINT shareholder_dividends_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shareholder_documents
    ADD CONSTRAINT shareholder_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shift_audit_log
    ADD CONSTRAINT shift_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shift_checklist_responses
    ADD CONSTRAINT shift_checklist_responses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shift_employees
    ADD CONSTRAINT shift_employees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shift_performance_tracking
    ADD CONSTRAINT shift_performance_tracking_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shift_photos
    ADD CONSTRAINT shift_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shift_reminders
    ADD CONSTRAINT shift_reminders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shift_signatures
    ADD CONSTRAINT shift_signatures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.social_content_templates
    ADD CONSTRAINT social_content_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.social_initiatives
    ADD CONSTRAINT social_initiatives_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.social_post_metrics
    ADD CONSTRAINT social_post_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.social_schedule_slots
    ADD CONSTRAINT social_schedule_slots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.target_daily_allocations
    ADD CONSTRAINT target_daily_allocations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.target_shift_allocations
    ADD CONSTRAINT target_shift_allocations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.target_weight_profiles
    ADD CONSTRAINT target_weight_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.timesheet_report_entries
    ADD CONSTRAINT timesheet_report_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.timesheet_reports
    ADD CONSTRAINT timesheet_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transfer_approval_steps
    ADD CONSTRAINT transfer_approval_steps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transfer_history
    ADD CONSTRAINT transfer_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.travel_expenses
    ADD CONSTRAINT travel_expenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.travel_requests
    ADD CONSTRAINT travel_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_security_settings
    ADD CONSTRAINT user_security_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_security_settings
    ADD CONSTRAINT user_security_settings_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_id_key UNIQUE (session_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.voting_audit_log
    ADD CONSTRAINT voting_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.voting_tokens
    ADD CONSTRAINT voting_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.voting_tokens
    ADD CONSTRAINT voting_tokens_resolution_id_shareholder_id_key UNIQUE (resolution_id, shareholder_id);

ALTER TABLE ONLY public.voting_tokens
    ADD CONSTRAINT voting_tokens_vote_token_key UNIQUE (vote_token);

ALTER TABLE ONLY public.warehouse_items
    ADD CONSTRAINT warehouse_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.warehouse_movement_logs
    ADD CONSTRAINT warehouse_movement_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.warehouse_notifications
    ADD CONSTRAINT warehouse_notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.waste_items
    ADD CONSTRAINT waste_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.waste_reports
    ADD CONSTRAINT waste_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.waste_risk_alerts
    ADD CONSTRAINT waste_risk_alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.waste_risk_rules
    ADD CONSTRAINT waste_risk_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.weekly_schedule_locks
    ADD CONSTRAINT weekly_schedule_locks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accounting_exports
    ADD CONSTRAINT accounting_exports_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.accounting_exports
    ADD CONSTRAINT accounting_exports_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.accounting_journal_entries
    ADD CONSTRAINT accounting_journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.accounting_reconciliations
    ADD CONSTRAINT accounting_reconciliations_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.advanced_production_orders
    ADD CONSTRAINT advanced_production_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.advanced_production_orders
    ADD CONSTRAINT advanced_production_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.advanced_production_orders
    ADD CONSTRAINT advanced_production_orders_source_branch_id_fkey FOREIGN KEY (source_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.advanced_production_orders
    ADD CONSTRAINT advanced_production_orders_target_branch_id_fkey FOREIGN KEY (target_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.asset_transfer_events
    ADD CONSTRAINT asset_transfer_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.asset_transfer_events
    ADD CONSTRAINT asset_transfer_events_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.asset_transfers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_from_branch_id_fkey FOREIGN KEY (from_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_to_branch_id_fkey FOREIGN KEY (to_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.attendance_summary
    ADD CONSTRAINT attendance_summary_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.attendance_summary
    ADD CONSTRAINT attendance_summary_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_item_id_inventory_items_id_fk FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.average_ticket_targets
    ADD CONSTRAINT average_ticket_targets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.average_ticket_targets
    ADD CONSTRAINT average_ticket_targets_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.average_ticket_targets
    ADD CONSTRAINT average_ticket_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.beneficiary_organizations
    ADD CONSTRAINT beneficiary_organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.biometric_credentials
    ADD CONSTRAINT biometric_credentials_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.biometric_credentials
    ADD CONSTRAINT biometric_credentials_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.board_committees
    ADD CONSTRAINT board_committees_chairman_id_fkey FOREIGN KEY (chairman_id) REFERENCES public.board_members(id);

ALTER TABLE ONLY public.board_committees
    ADD CONSTRAINT board_committees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.board_committees
    ADD CONSTRAINT board_committees_secretary_id_fkey FOREIGN KEY (secretary_id) REFERENCES public.board_members(id);

ALTER TABLE ONLY public.board_member_training
    ADD CONSTRAINT board_member_training_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.board_members
    ADD CONSTRAINT board_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.board_members
    ADD CONSTRAINT board_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.board_resolutions
    ADD CONSTRAINT board_resolutions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.board_resolutions
    ADD CONSTRAINT board_resolutions_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id);

ALTER TABLE ONLY public.board_resolutions
    ADD CONSTRAINT board_resolutions_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.board_resolutions
    ADD CONSTRAINT board_resolutions_responsible_person_fkey FOREIGN KEY (responsible_person) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_achievement_bonus
    ADD CONSTRAINT branch_achievement_bonus_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.branch_achievement_bonus
    ADD CONSTRAINT branch_achievement_bonus_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_custom_checklist_items
    ADD CONSTRAINT branch_custom_checklist_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.branch_custom_checklist_items
    ADD CONSTRAINT branch_custom_checklist_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_custom_checklist_items
    ADD CONSTRAINT branch_custom_checklist_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.branch_daily_closure_journals
    ADD CONSTRAINT branch_daily_closure_journals_closure_id_fkey FOREIGN KEY (closure_id) REFERENCES public.branch_daily_closures(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.branch_daily_closure_journals
    ADD CONSTRAINT branch_daily_closure_journals_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.cashier_sales_journals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.branch_daily_closure_payments
    ADD CONSTRAINT branch_daily_closure_payments_closure_id_fkey FOREIGN KEY (closure_id) REFERENCES public.branch_daily_closures(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.branch_daily_closures
    ADD CONSTRAINT branch_daily_closures_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.branch_daily_closures
    ADD CONSTRAINT branch_daily_closures_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_daily_closures
    ADD CONSTRAINT branch_daily_closures_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_daily_sales
    ADD CONSTRAINT branch_daily_sales_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.branch_employees
    ADD CONSTRAINT branch_employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.branch_monthly_targets
    ADD CONSTRAINT branch_monthly_targets_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_monthly_targets
    ADD CONSTRAINT branch_monthly_targets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.branch_monthly_targets
    ADD CONSTRAINT branch_monthly_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_monthly_targets
    ADD CONSTRAINT branch_monthly_targets_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.target_weight_profiles(id);

ALTER TABLE ONLY public.branch_shift_profiles
    ADD CONSTRAINT branch_shift_profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.branch_shifts
    ADD CONSTRAINT branch_shifts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.branch_shifts
    ADD CONSTRAINT branch_shifts_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.branch_stock
    ADD CONSTRAINT branch_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.branch_stock
    ADD CONSTRAINT branch_stock_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.warehouse_items(id);

ALTER TABLE ONLY public.branch_stock
    ADD CONSTRAINT branch_stock_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.campaign_budget_allocations
    ADD CONSTRAINT campaign_budget_allocations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.campaign_budget_allocations
    ADD CONSTRAINT campaign_budget_allocations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.campaign_expenses
    ADD CONSTRAINT campaign_expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_expenses
    ADD CONSTRAINT campaign_expenses_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.campaign_expenses
    ADD CONSTRAINT campaign_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_expenses
    ADD CONSTRAINT campaign_expenses_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.marketing_influencers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_goals
    ADD CONSTRAINT campaign_goals_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.capital_transactions
    ADD CONSTRAINT capital_transactions_assembly_meeting_id_fkey FOREIGN KEY (assembly_meeting_id) REFERENCES public.governance_meetings(id);

ALTER TABLE ONLY public.capital_transactions
    ADD CONSTRAINT capital_transactions_board_resolution_id_fkey FOREIGN KEY (board_resolution_id) REFERENCES public.board_resolutions(id);

ALTER TABLE ONLY public.capital_transactions
    ADD CONSTRAINT capital_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_daily_challenges
    ADD CONSTRAINT cashier_daily_challenges_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.cashier_daily_challenges
    ADD CONSTRAINT cashier_daily_challenges_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_daily_challenges
    ADD CONSTRAINT cashier_daily_challenges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_incentive_statements
    ADD CONSTRAINT cashier_incentive_statements_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_incentive_statements
    ADD CONSTRAINT cashier_incentive_statements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.cashier_incentive_statements
    ADD CONSTRAINT cashier_incentive_statements_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_incentive_statements
    ADD CONSTRAINT cashier_incentive_statements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_incentive_statements
    ADD CONSTRAINT cashier_incentive_statements_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_incentive_statements
    ADD CONSTRAINT cashier_incentive_statements_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_payment_breakdowns
    ADD CONSTRAINT cashier_payment_breakdowns_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.cashier_sales_journals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cashier_points_ledger
    ADD CONSTRAINT cashier_points_ledger_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_points_ledger
    ADD CONSTRAINT cashier_points_ledger_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.cashier_points_ledger
    ADD CONSTRAINT cashier_points_ledger_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_product_sales
    ADD CONSTRAINT cashier_product_sales_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.cashier_product_sales
    ADD CONSTRAINT cashier_product_sales_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_product_sales
    ADD CONSTRAINT cashier_product_sales_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.product_commissions(id);

ALTER TABLE ONLY public.cashier_product_sales
    ADD CONSTRAINT cashier_product_sales_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_sales_journals
    ADD CONSTRAINT cashier_sales_journals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_sales_journals
    ADD CONSTRAINT cashier_sales_journals_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cashier_sales_journals
    ADD CONSTRAINT cashier_sales_journals_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_sales_journals
    ADD CONSTRAINT cashier_sales_journals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_sales_journals
    ADD CONSTRAINT cashier_sales_journals_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);

ALTER TABLE ONLY public.cashier_shift_performance
    ADD CONSTRAINT cashier_shift_performance_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.cashier_shift_performance
    ADD CONSTRAINT cashier_shift_performance_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.cashier_shift_performance
    ADD CONSTRAINT cashier_shift_performance_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.cashier_sales_journals(id);

ALTER TABLE ONLY public.cashier_shift_performance
    ADD CONSTRAINT cashier_shift_performance_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);

ALTER TABLE ONLY public.cashier_signatures
    ADD CONSTRAINT cashier_signatures_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.cashier_sales_journals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cashier_signatures
    ADD CONSTRAINT cashier_signatures_signer_id_fkey FOREIGN KEY (signer_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_rate_id_fkey FOREIGN KEY (rate_id) REFERENCES public.commission_rates(id);

ALTER TABLE ONLY public.commission_rates
    ADD CONSTRAINT commission_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.committee_memberships
    ADD CONSTRAINT committee_memberships_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.committee_memberships
    ADD CONSTRAINT committee_memberships_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public.board_committees(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.community_discounts
    ADD CONSTRAINT community_discounts_beneficiary_organization_id_fkey FOREIGN KEY (beneficiary_organization_id) REFERENCES public.beneficiary_organizations(id);

ALTER TABLE ONLY public.community_discounts
    ADD CONSTRAINT community_discounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.community_discounts
    ADD CONSTRAINT community_discounts_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES public.social_initiatives(id);

ALTER TABLE ONLY public.comparison_status_history
    ADD CONSTRAINT comparison_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.comparison_status_history
    ADD CONSTRAINT comparison_status_history_comparison_id_fkey FOREIGN KEY (comparison_id) REFERENCES public.daily_comparisons(id);

ALTER TABLE ONLY public.comparison_summaries
    ADD CONSTRAINT comparison_summaries_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.comparison_uploads
    ADD CONSTRAINT comparison_uploads_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.compliance_history
    ADD CONSTRAINT compliance_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.compliance_history
    ADD CONSTRAINT compliance_history_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.compliance_requirements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_responsible_person_fkey FOREIGN KEY (responsible_person) REFERENCES public.users(id);

ALTER TABLE ONLY public.construction_contracts
    ADD CONSTRAINT construction_contracts_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractors(id);

ALTER TABLE ONLY public.construction_contracts
    ADD CONSTRAINT construction_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.construction_contracts
    ADD CONSTRAINT construction_contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contract_items
    ADD CONSTRAINT contract_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.construction_categories(id);

ALTER TABLE ONLY public.contract_items
    ADD CONSTRAINT contract_items_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.construction_contracts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contract_payments
    ADD CONSTRAINT contract_payments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.construction_contracts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contract_payments
    ADD CONSTRAINT contract_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.contract_payments
    ADD CONSTRAINT contract_payments_payment_request_id_fkey FOREIGN KEY (payment_request_id) REFERENCES public.payment_requests(id);

ALTER TABLE ONLY public.daily_comparisons
    ADD CONSTRAINT daily_comparisons_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.daily_operations_summary
    ADD CONSTRAINT daily_operations_summary_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_finished_by_id_fkey FOREIGN KEY (finished_by_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_production_order_id_fkey FOREIGN KEY (production_order_id) REFERENCES public.advanced_production_orders(id);

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.daily_production_batches
    ADD CONSTRAINT daily_production_batches_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);

ALTER TABLE ONLY public.daily_sales_data
    ADD CONSTRAINT daily_sales_data_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.daily_waste_log
    ADD CONSTRAINT daily_waste_log_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.daily_waste_log
    ADD CONSTRAINT daily_waste_log_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.branch_shifts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.data_import_jobs
    ADD CONSTRAINT data_import_jobs_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.disclosures
    ADD CONSTRAINT disclosures_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.disclosures
    ADD CONSTRAINT disclosures_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.disclosures
    ADD CONSTRAINT disclosures_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.discount_usage_logs
    ADD CONSTRAINT discount_usage_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.discount_usage_logs
    ADD CONSTRAINT discount_usage_logs_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.community_discounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.discount_usage_logs
    ADD CONSTRAINT discount_usage_logs_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.display_bar_daily_summary
    ADD CONSTRAINT display_bar_daily_summary_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.display_bar_daily_summary
    ADD CONSTRAINT display_bar_daily_summary_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.display_bar_receipts
    ADD CONSTRAINT display_bar_receipts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.display_bar_receipts
    ADD CONSTRAINT display_bar_receipts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.display_bar_receipts
    ADD CONSTRAINT display_bar_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.display_bar_receipts
    ADD CONSTRAINT display_bar_receipts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);

ALTER TABLE ONLY public.dividend_distributions
    ADD CONSTRAINT dividend_distributions_assembly_meeting_id_fkey FOREIGN KEY (assembly_meeting_id) REFERENCES public.governance_meetings(id);

ALTER TABLE ONLY public.dividend_distributions
    ADD CONSTRAINT dividend_distributions_board_resolution_id_fkey FOREIGN KEY (board_resolution_id) REFERENCES public.board_resolutions(id);

ALTER TABLE ONLY public.dividend_distributions
    ADD CONSTRAINT dividend_distributions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.document_access_logs
    ADD CONSTRAINT document_access_logs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_access_logs
    ADD CONSTRAINT document_access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document_folders(id);

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_shared_with_branch_id_fkey FOREIGN KEY (shared_with_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_shared_with_user_id_fkey FOREIGN KEY (shared_with_user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.document_categories(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_last_accessed_by_fkey FOREIGN KEY (last_accessed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.employee_schedules
    ADD CONSTRAINT employee_schedules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.employee_schedules
    ADD CONSTRAINT employee_schedules_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.schedule_periods(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_transfer_requests
    ADD CONSTRAINT employee_transfer_requests_destination_branch_id_fkey FOREIGN KEY (destination_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.employee_transfer_requests
    ADD CONSTRAINT employee_transfer_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.branch_employees(id);

ALTER TABLE ONLY public.employee_transfer_requests
    ADD CONSTRAINT employee_transfer_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.employee_transfer_requests
    ADD CONSTRAINT employee_transfer_requests_source_branch_id_fkey FOREIGN KEY (source_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.exec_correspondence
    ADD CONSTRAINT exec_correspondence_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_correspondence
    ADD CONSTRAINT exec_correspondence_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.exec_correspondence
    ADD CONSTRAINT exec_correspondence_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_correspondence
    ADD CONSTRAINT exec_correspondence_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_meeting_attendees
    ADD CONSTRAINT exec_meeting_attendees_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.exec_meetings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exec_meeting_attendees
    ADD CONSTRAINT exec_meeting_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_meetings
    ADD CONSTRAINT exec_meetings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.exec_meetings
    ADD CONSTRAINT exec_meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_meetings
    ADD CONSTRAINT exec_meetings_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_notifications
    ADD CONSTRAINT exec_notifications_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.exec_notifications
    ADD CONSTRAINT exec_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_task_comments
    ADD CONSTRAINT exec_task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.exec_tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exec_task_comments
    ADD CONSTRAINT exec_task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_tasks
    ADD CONSTRAINT exec_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);

ALTER TABLE ONLY public.exec_tasks
    ADD CONSTRAINT exec_tasks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.exec_tasks
    ADD CONSTRAINT exec_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.financial_cogs
    ADD CONSTRAINT financial_cogs_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_fixed_costs
    ADD CONSTRAINT financial_fixed_costs_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_metrics
    ADD CONSTRAINT financial_metrics_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_operating_expenses
    ADD CONSTRAINT financial_operating_expenses_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.financial_sales
    ADD CONSTRAINT financial_sales_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.finished_goods_inventory
    ADD CONSTRAINT finished_goods_inventory_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.finished_goods_inventory
    ADD CONSTRAINT finished_goods_inventory_last_batch_id_fkey FOREIGN KEY (last_batch_id) REFERENCES public.daily_production_batches(id);

ALTER TABLE ONLY public.finished_goods_inventory
    ADD CONSTRAINT finished_goods_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.finished_goods_transfers
    ADD CONSTRAINT finished_goods_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.finished_goods_transfers
    ADD CONSTRAINT finished_goods_transfers_destination_branch_id_fkey FOREIGN KEY (destination_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.finished_goods_transfers
    ADD CONSTRAINT finished_goods_transfers_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.finished_goods_inventory(id);

ALTER TABLE ONLY public.finished_goods_transfers
    ADD CONSTRAINT finished_goods_transfers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.finished_goods_transfers
    ADD CONSTRAINT finished_goods_transfers_source_branch_id_fkey FOREIGN KEY (source_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.governance_meetings
    ADD CONSTRAINT governance_meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.governance_meetings
    ADD CONSTRAINT governance_meetings_minutes_approved_by_fkey FOREIGN KEY (minutes_approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.incentive_awards
    ADD CONSTRAINT incentive_awards_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.incentive_awards
    ADD CONSTRAINT incentive_awards_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.incentive_awards
    ADD CONSTRAINT incentive_awards_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.incentive_awards
    ADD CONSTRAINT incentive_awards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.incentive_awards
    ADD CONSTRAINT incentive_awards_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.incentive_tiers(id);

ALTER TABLE ONLY public.incentive_tiers
    ADD CONSTRAINT incentive_tiers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.influencer_campaign_links
    ADD CONSTRAINT influencer_campaign_links_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.influencer_campaign_links
    ADD CONSTRAINT influencer_campaign_links_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.marketing_influencers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.influencer_contacts
    ADD CONSTRAINT influencer_contacts_contacted_by_fkey FOREIGN KEY (contacted_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.influencer_contacts
    ADD CONSTRAINT influencer_contacts_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.marketing_influencers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.influencer_contracts
    ADD CONSTRAINT influencer_contracts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.influencer_contracts
    ADD CONSTRAINT influencer_contracts_company_signed_by_fkey FOREIGN KEY (company_signed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.influencer_contracts
    ADD CONSTRAINT influencer_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.influencer_contracts
    ADD CONSTRAINT influencer_contracts_finance_approved_by_fkey FOREIGN KEY (finance_approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.influencer_contracts
    ADD CONSTRAINT influencer_contracts_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.marketing_influencers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.influencer_payments
    ADD CONSTRAINT influencer_payments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.influencer_payments
    ADD CONSTRAINT influencer_payments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.influencer_payments
    ADD CONSTRAINT influencer_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.influencer_payments
    ADD CONSTRAINT influencer_payments_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.marketing_influencers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.interest_declarations
    ADD CONSTRAINT interest_declarations_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.interest_declarations
    ADD CONSTRAINT interest_declarations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.journal_attachments
    ADD CONSTRAINT journal_attachments_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.cashier_sales_journals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.journal_attachments
    ADD CONSTRAINT journal_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.accounting_journal_entries(id);

ALTER TABLE ONLY public.marketing_alerts
    ADD CONSTRAINT marketing_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_alerts
    ADD CONSTRAINT marketing_alerts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.marketing_alerts
    ADD CONSTRAINT marketing_alerts_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_alerts
    ADD CONSTRAINT marketing_alerts_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.marketing_tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_calendar_events
    ADD CONSTRAINT marketing_calendar_events_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_calendar_events
    ADD CONSTRAINT marketing_calendar_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_calendar_events
    ADD CONSTRAINT marketing_calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_influencers
    ADD CONSTRAINT marketing_influencers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_performance_reports
    ADD CONSTRAINT marketing_performance_reports_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.marketing_performance_reports
    ADD CONSTRAINT marketing_performance_reports_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_performance_reports
    ADD CONSTRAINT marketing_performance_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_task_activities
    ADD CONSTRAINT marketing_task_activities_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.marketing_tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.marketing_task_activities
    ADD CONSTRAINT marketing_task_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_tasks
    ADD CONSTRAINT marketing_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_tasks
    ADD CONSTRAINT marketing_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);

ALTER TABLE ONLY public.marketing_tasks
    ADD CONSTRAINT marketing_tasks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_team_members
    ADD CONSTRAINT marketing_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.material_transfer_items
    ADD CONSTRAINT material_transfer_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.warehouse_items(id);

ALTER TABLE ONLY public.material_transfer_items
    ADD CONSTRAINT material_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.material_transfers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.material_transfers
    ADD CONSTRAINT material_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.material_transfers
    ADD CONSTRAINT material_transfers_destination_branch_id_fkey FOREIGN KEY (destination_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.material_transfers
    ADD CONSTRAINT material_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.material_transfers
    ADD CONSTRAINT material_transfers_source_branch_id_fkey FOREIGN KEY (source_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.meeting_attendance
    ADD CONSTRAINT meeting_attendance_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id);

ALTER TABLE ONLY public.meeting_attendance
    ADD CONSTRAINT meeting_attendance_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.meeting_attendance
    ADD CONSTRAINT meeting_attendance_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id);

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.meeting_rsvps
    ADD CONSTRAINT meeting_rsvps_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.meeting_rsvps
    ADD CONSTRAINT meeting_rsvps_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.construction_categories(id);

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.construction_contracts(id);

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.permission_audit_logs
    ADD CONSTRAINT permission_audit_logs_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.permission_audit_logs
    ADD CONSTRAINT permission_audit_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pnl_branch_settings
    ADD CONSTRAINT pnl_branch_settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.pnl_monthly_inputs
    ADD CONSTRAINT pnl_monthly_inputs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.point_settings
    ADD CONSTRAINT point_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.product_commissions
    ADD CONSTRAINT product_commissions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.product_commissions
    ADD CONSTRAINT product_commissions_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.product_commissions
    ADD CONSTRAINT product_commissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.product_sales_analytics
    ADD CONSTRAINT product_sales_analytics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.sales_data_uploads(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.production_ai_plans
    ADD CONSTRAINT production_ai_plans_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.production_ai_plans
    ADD CONSTRAINT production_ai_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.production_ai_plans
    ADD CONSTRAINT production_ai_plans_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.production_inventory_logs
    ADD CONSTRAINT production_inventory_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.production_inventory_logs
    ADD CONSTRAINT production_inventory_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.production_inventory_logs
    ADD CONSTRAINT production_inventory_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.production_order_items
    ADD CONSTRAINT production_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.advanced_production_orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.production_order_items
    ADD CONSTRAINT production_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.production_order_schedules
    ADD CONSTRAINT production_order_schedules_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.advanced_production_orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);

ALTER TABLE ONLY public.project_budget_allocations
    ADD CONSTRAINT project_budget_allocations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.construction_categories(id);

ALTER TABLE ONLY public.project_budget_allocations
    ADD CONSTRAINT project_budget_allocations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.construction_categories(id);

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractors(id);

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.proxy_votes
    ADD CONSTRAINT proxy_votes_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.proxy_votes
    ADD CONSTRAINT proxy_votes_principal_shareholder_id_fkey FOREIGN KEY (principal_shareholder_id) REFERENCES public.shareholders(id);

ALTER TABLE ONLY public.proxy_votes
    ADD CONSTRAINT proxy_votes_proxy_holder_shareholder_id_fkey FOREIGN KEY (proxy_holder_shareholder_id) REFERENCES public.shareholders(id);

ALTER TABLE ONLY public.proxy_votes
    ADD CONSTRAINT proxy_votes_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.purchasing_request_items
    ADD CONSTRAINT purchasing_request_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.warehouse_items(id);

ALTER TABLE ONLY public.purchasing_request_items
    ADD CONSTRAINT purchasing_request_items_purchasing_request_id_fkey FOREIGN KEY (purchasing_request_id) REFERENCES public.purchasing_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.purchasing_requests
    ADD CONSTRAINT purchasing_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.purchasing_requests
    ADD CONSTRAINT purchasing_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.purchasing_requests
    ADD CONSTRAINT purchasing_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_production_order_id_fkey FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id);

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);

ALTER TABLE ONLY public.quorum_calculations
    ADD CONSTRAINT quorum_calculations_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.quorum_calculations
    ADD CONSTRAINT quorum_calculations_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.quorum_calculations
    ADD CONSTRAINT quorum_calculations_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES public.board_resolutions(id);

ALTER TABLE ONLY public.resolution_signatures
    ADD CONSTRAINT resolution_signatures_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resolution_signatures
    ADD CONSTRAINT resolution_signatures_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES public.board_resolutions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resolution_signatures
    ADD CONSTRAINT resolution_signatures_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resolution_votes
    ADD CONSTRAINT resolution_votes_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id);

ALTER TABLE ONLY public.resolution_votes
    ADD CONSTRAINT resolution_votes_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES public.board_resolutions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resolution_votes
    ADD CONSTRAINT resolution_votes_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_inherits_from_role_id_fkey FOREIGN KEY (inherits_from_role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.sales_data_uploads
    ADD CONSTRAINT sales_data_uploads_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.sales_data_uploads
    ADD CONSTRAINT sales_data_uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.schedule_change_audit
    ADD CONSTRAINT schedule_change_audit_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.schedule_change_audit
    ADD CONSTRAINT schedule_change_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.schedule_templates(id);

ALTER TABLE ONLY public.schedule_templates
    ADD CONSTRAINT schedule_templates_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.schedule_templates
    ADD CONSTRAINT schedule_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.seasons_holidays
    ADD CONSTRAINT seasons_holidays_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_from_shareholder_id_fkey FOREIGN KEY (from_shareholder_id) REFERENCES public.shareholders(id);

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_to_shareholder_id_fkey FOREIGN KEY (to_shareholder_id) REFERENCES public.shareholders(id);

ALTER TABLE ONLY public.shareholder_dividends
    ADD CONSTRAINT shareholder_dividends_distribution_id_fkey FOREIGN KEY (distribution_id) REFERENCES public.dividend_distributions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shareholder_dividends
    ADD CONSTRAINT shareholder_dividends_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id);

ALTER TABLE ONLY public.shareholder_documents
    ADD CONSTRAINT shareholder_documents_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shareholder_documents
    ADD CONSTRAINT shareholder_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_board_member_id_fkey FOREIGN KEY (board_member_id) REFERENCES public.board_members(id);

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.shift_audit_log
    ADD CONSTRAINT shift_audit_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.shift_audit_log
    ADD CONSTRAINT shift_audit_log_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.branch_shifts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shift_checklist_responses
    ADD CONSTRAINT shift_checklist_responses_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.shift_checklist_responses
    ADD CONSTRAINT shift_checklist_responses_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.checklist_items(id);

ALTER TABLE ONLY public.shift_checklist_responses
    ADD CONSTRAINT shift_checklist_responses_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.branch_shifts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shift_employees
    ADD CONSTRAINT shift_employees_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shift_photos
    ADD CONSTRAINT shift_photos_checklist_response_id_fkey FOREIGN KEY (checklist_response_id) REFERENCES public.shift_checklist_responses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shift_photos
    ADD CONSTRAINT shift_photos_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.branch_shifts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shift_photos
    ADD CONSTRAINT shift_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.shift_reminders
    ADD CONSTRAINT shift_reminders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.shift_signatures
    ADD CONSTRAINT shift_signatures_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.branch_shifts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shift_signatures
    ADD CONSTRAINT shift_signatures_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.social_initiatives
    ADD CONSTRAINT social_initiatives_beneficiary_organization_id_fkey FOREIGN KEY (beneficiary_organization_id) REFERENCES public.beneficiary_organizations(id);

ALTER TABLE ONLY public.social_initiatives
    ADD CONSTRAINT social_initiatives_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.marketing_influencers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.target_daily_allocations
    ADD CONSTRAINT target_daily_allocations_monthly_target_id_fkey FOREIGN KEY (monthly_target_id) REFERENCES public.branch_monthly_targets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.target_shift_allocations
    ADD CONSTRAINT target_shift_allocations_daily_allocation_id_fkey FOREIGN KEY (daily_allocation_id) REFERENCES public.target_daily_allocations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.target_weight_profiles
    ADD CONSTRAINT target_weight_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance_records(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.timesheet_report_entries
    ADD CONSTRAINT timesheet_report_entries_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.timesheet_reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.timesheet_reports
    ADD CONSTRAINT timesheet_reports_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.timesheet_reports
    ADD CONSTRAINT timesheet_reports_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.timesheet_reports
    ADD CONSTRAINT timesheet_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.timesheet_reports
    ADD CONSTRAINT timesheet_reports_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.transfer_approval_steps
    ADD CONSTRAINT transfer_approval_steps_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.transfer_approval_steps
    ADD CONSTRAINT transfer_approval_steps_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.employee_transfer_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transfer_history
    ADD CONSTRAINT transfer_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.transfer_history
    ADD CONSTRAINT transfer_history_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.employee_transfer_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.travel_expenses
    ADD CONSTRAINT travel_expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.travel_expenses
    ADD CONSTRAINT travel_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.travel_expenses
    ADD CONSTRAINT travel_expenses_travel_request_id_fkey FOREIGN KEY (travel_request_id) REFERENCES public.travel_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.travel_requests
    ADD CONSTRAINT travel_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.travel_requests
    ADD CONSTRAINT travel_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.travel_requests
    ADD CONSTRAINT travel_requests_finance_approval_by_fkey FOREIGN KEY (finance_approval_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.travel_requests
    ADD CONSTRAINT travel_requests_manager_approval_by_fkey FOREIGN KEY (manager_approval_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.travel_requests
    ADD CONSTRAINT travel_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_checked_out_by_fkey FOREIGN KEY (checked_out_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.visitors(id);

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.voting_audit_log
    ADD CONSTRAINT voting_audit_log_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id);

ALTER TABLE ONLY public.voting_audit_log
    ADD CONSTRAINT voting_audit_log_proxy_id_fkey FOREIGN KEY (proxy_id) REFERENCES public.proxy_votes(id);

ALTER TABLE ONLY public.voting_audit_log
    ADD CONSTRAINT voting_audit_log_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES public.board_resolutions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.voting_audit_log
    ADD CONSTRAINT voting_audit_log_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES public.resolution_votes(id);

ALTER TABLE ONLY public.voting_tokens
    ADD CONSTRAINT voting_tokens_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES public.board_resolutions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.voting_tokens
    ADD CONSTRAINT voting_tokens_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.warehouse_movement_logs
    ADD CONSTRAINT warehouse_movement_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.warehouse_movement_logs
    ADD CONSTRAINT warehouse_movement_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.warehouse_movement_logs
    ADD CONSTRAINT warehouse_movement_logs_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.warehouse_items(id);

ALTER TABLE ONLY public.warehouse_notifications
    ADD CONSTRAINT warehouse_notifications_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.warehouse_notifications
    ADD CONSTRAINT warehouse_notifications_read_by_fkey FOREIGN KEY (read_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.warehouse_notifications
    ADD CONSTRAINT warehouse_notifications_target_branch_id_fkey FOREIGN KEY (target_branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.warehouse_notifications
    ADD CONSTRAINT warehouse_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.waste_items
    ADD CONSTRAINT waste_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.waste_items
    ADD CONSTRAINT waste_items_waste_report_id_fkey FOREIGN KEY (waste_report_id) REFERENCES public.waste_reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.waste_reports
    ADD CONSTRAINT waste_reports_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.waste_reports
    ADD CONSTRAINT waste_reports_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.waste_reports
    ADD CONSTRAINT waste_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.waste_reports
    ADD CONSTRAINT waste_reports_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);

ALTER TABLE ONLY public.waste_risk_alerts
    ADD CONSTRAINT waste_risk_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.waste_risk_alerts
    ADD CONSTRAINT waste_risk_alerts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.waste_risk_alerts
    ADD CONSTRAINT waste_risk_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.waste_risk_alerts
    ADD CONSTRAINT waste_risk_alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.waste_risk_rules(id);

ALTER TABLE ONLY public.waste_risk_rules
    ADD CONSTRAINT waste_risk_rules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.weekly_schedule_locks
    ADD CONSTRAINT weekly_schedule_locks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.weekly_schedule_locks
    ADD CONSTRAINT weekly_schedule_locks_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users(id);

