-- Additive complaint workflow. Requires public.branches(id) and public.users(id)
-- as varchar primary keys. App-server access only; no browser-role grants.
-- No historical data is imported or changed.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.branch_complaints (
  id serial PRIMARY KEY,
  branch_id varchar NOT NULL CONSTRAINT fk_branch_complaints_branch REFERENCES public.branches(id),
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CONSTRAINT chk_branch_complaints_category CHECK (category IN ('service','product','cleanliness','staff','other')),
  priority text NOT NULL DEFAULT 'normal' CONSTRAINT chk_branch_complaints_priority CHECK (priority IN ('low','normal','high','urgent')),
  owner_user_id varchar CONSTRAINT fk_branch_complaints_owner REFERENCES public.users(id),
  response_due timestamp,
  status text NOT NULL DEFAULT 'open' CONSTRAINT chk_branch_complaints_status CHECK (status IN ('open','in_progress','resolved','closed')),
  resolution text,
  first_responded_at timestamp,
  version integer NOT NULL DEFAULT 1 CONSTRAINT chk_branch_complaints_version CHECK (version > 0),
  created_by varchar NOT NULL CONSTRAINT fk_branch_complaints_created_by REFERENCES public.users(id),
  updated_by varchar NOT NULL CONSTRAINT fk_branch_complaints_updated_by REFERENCES public.users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_branch_status ON public.branch_complaints(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_branch_priority ON public.branch_complaints(branch_id, priority);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_owner ON public.branch_complaints(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_response_due ON public.branch_complaints(response_due);

CREATE TABLE IF NOT EXISTS public.branch_complaint_events (
  id serial PRIMARY KEY,
  complaint_id integer NOT NULL CONSTRAINT fk_branch_complaint_events_complaint REFERENCES public.branch_complaints(id),
  actor_user_id varchar NOT NULL CONSTRAINT fk_branch_complaint_events_actor REFERENCES public.users(id),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  reason text,
  changes jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branch_complaint_events_complaint ON public.branch_complaint_events(complaint_id, created_at);

CREATE OR REPLACE FUNCTION public.reject_branch_complaint_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'branch complaint events are append-only' USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS trg_branch_complaint_events_append_only ON public.branch_complaint_events;
CREATE TRIGGER trg_branch_complaint_events_append_only
  BEFORE UPDATE OR DELETE ON public.branch_complaint_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_branch_complaint_event_mutation();

CREATE TABLE IF NOT EXISTS public.branch_complaint_attachments (
  id serial PRIMARY KEY,
  complaint_id integer NOT NULL CONSTRAINT fk_branch_complaint_attachments_complaint REFERENCES public.branch_complaints(id),
  original_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CONSTRAINT chk_branch_complaint_attachment_size CHECK (size_bytes > 0),
  uploaded_by varchar NOT NULL CONSTRAINT fk_branch_complaint_attachments_uploader REFERENCES public.users(id),
  archived_at timestamp,
  archived_by varchar CONSTRAINT fk_branch_complaint_attachments_archiver REFERENCES public.users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branch_complaint_attachments_complaint ON public.branch_complaint_attachments(complaint_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_complaint_attachment_path ON public.branch_complaint_attachments(storage_path);

-- Supabase may have default grants for newly created public objects. Restrict
-- direct access even if the operator role inherits those default privileges.
ALTER TABLE public.branch_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_complaint_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_complaint_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branch_complaints, public.branch_complaint_events, public.branch_complaint_attachments FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_branch_complaint_event_mutation() FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON public.branch_complaints, public.branch_complaint_events, public.branch_complaint_attachments FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION public.reject_branch_complaint_event_mutation() FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON SEQUENCE public.branch_complaints_id_seq, public.branch_complaint_events_id_seq, public.branch_complaint_attachments_id_seq FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.branch_complaints_id_seq, public.branch_complaint_events_id_seq, public.branch_complaint_attachments_id_seq FROM PUBLIC;
COMMIT;