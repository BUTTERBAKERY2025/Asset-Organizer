BEGIN;

CREATE TABLE IF NOT EXISTS branch_complaints (
  id serial PRIMARY KEY,
  branch_id varchar NOT NULL REFERENCES branches(id),
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('service','product','cleanliness','staff','other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  owner_user_id varchar REFERENCES users(id),
  response_due timestamp,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  resolution text,
  first_responded_at timestamp,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by varchar NOT NULL REFERENCES users(id),
  updated_by varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_branch_status ON branch_complaints(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_branch_priority ON branch_complaints(branch_id, priority);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_owner ON branch_complaints(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_branch_complaints_response_due ON branch_complaints(response_due);

CREATE TABLE IF NOT EXISTS branch_complaint_events (
  id serial PRIMARY KEY,
  complaint_id integer NOT NULL REFERENCES branch_complaints(id),
  actor_user_id varchar NOT NULL REFERENCES users(id),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  reason text,
  changes jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branch_complaint_events_complaint ON branch_complaint_events(complaint_id, created_at);

CREATE OR REPLACE FUNCTION reject_branch_complaint_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'branch complaint events are append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_branch_complaint_events_append_only ON branch_complaint_events;
CREATE TRIGGER trg_branch_complaint_events_append_only
BEFORE UPDATE OR DELETE ON branch_complaint_events
FOR EACH ROW EXECUTE FUNCTION reject_branch_complaint_event_mutation();

CREATE TABLE IF NOT EXISTS branch_complaint_attachments (
  id serial PRIMARY KEY,
  complaint_id integer NOT NULL REFERENCES branch_complaints(id),
  original_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  uploaded_by varchar NOT NULL REFERENCES users(id),
  archived_at timestamp,
  archived_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branch_complaint_attachments_complaint ON branch_complaint_attachments(complaint_id, created_at);

COMMIT;

-- Development only: run scripts/apply-branch-complaints-development.sh.
-- That wrapper rejects NODE_ENV=production and non-local/non-Helium database hosts.
-- Recovery: retain these additive tables; disable route registration. Drop only after exporting records.