--
-- PostgreSQL database dump
--


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
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id character varying NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: construction_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_categories (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: construction_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.construction_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: construction_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.construction_categories_id_seq OWNED BY public.construction_categories.id;


--
-- Name: construction_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_projects (
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


--
-- Name: construction_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.construction_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: construction_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.construction_projects_id_seq OWNED BY public.construction_projects.id;


--
-- Name: contractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractors (
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


--
-- Name: contractors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contractors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contractors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contractors_id_seq OWNED BY public.contractors.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
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


--
-- Name: payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_requests (
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


--
-- Name: payment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_requests_id_seq OWNED BY public.payment_requests.id;


--
-- Name: project_budget_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_budget_allocations (
    id integer NOT NULL,
    project_id integer NOT NULL,
    category_id integer,
    planned_amount real DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_budget_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_budget_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_budget_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_budget_allocations_id_seq OWNED BY public.project_budget_allocations.id;


--
-- Name: project_work_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_work_items (
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


--
-- Name: project_work_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_work_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_work_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_work_items_id_seq OWNED BY public.project_work_items.id;


--
-- Name: construction_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_categories ALTER COLUMN id SET DEFAULT nextval('public.construction_categories_id_seq'::regclass);


--
-- Name: construction_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects ALTER COLUMN id SET DEFAULT nextval('public.construction_projects_id_seq'::regclass);


--
-- Name: contractors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractors ALTER COLUMN id SET DEFAULT nextval('public.contractors_id_seq'::regclass);


--
-- Name: payment_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests ALTER COLUMN id SET DEFAULT nextval('public.payment_requests_id_seq'::regclass);


--
-- Name: project_budget_allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_budget_allocations ALTER COLUMN id SET DEFAULT nextval('public.project_budget_allocations_id_seq'::regclass);


--
-- Name: project_work_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_work_items ALTER COLUMN id SET DEFAULT nextval('public.project_work_items_id_seq'::regclass);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: construction_categories construction_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_categories
    ADD CONSTRAINT construction_categories_pkey PRIMARY KEY (id);


--
-- Name: construction_categories construction_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_categories
    ADD CONSTRAINT construction_categories_slug_key UNIQUE (slug);


--
-- Name: construction_projects construction_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_pkey PRIMARY KEY (id);


--
-- Name: contractors contractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: payment_requests payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_pkey PRIMARY KEY (id);


--
-- Name: project_budget_allocations project_budget_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_budget_allocations
    ADD CONSTRAINT project_budget_allocations_pkey PRIMARY KEY (id);


--
-- Name: project_work_items project_work_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_pkey PRIMARY KEY (id);


--
-- Name: construction_projects construction_projects_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: payment_requests payment_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: payment_requests payment_requests_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.construction_categories(id);


--
-- Name: payment_requests payment_requests_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.construction_contracts(id);


--
-- Name: payment_requests payment_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: payment_requests payment_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: project_budget_allocations project_budget_allocations_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_budget_allocations
    ADD CONSTRAINT project_budget_allocations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.construction_categories(id);


--
-- Name: project_budget_allocations project_budget_allocations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_budget_allocations
    ADD CONSTRAINT project_budget_allocations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: project_work_items project_work_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.construction_categories(id);


--
-- Name: project_work_items project_work_items_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractors(id);


--
-- Name: project_work_items project_work_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_work_items
    ADD CONSTRAINT project_work_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


