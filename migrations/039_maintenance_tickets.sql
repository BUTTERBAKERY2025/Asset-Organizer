-- Additive only. Apply through the reviewed migration process, never db:push.
BEGIN;
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id serial PRIMARY KEY,
  branch_id varchar NOT NULL REFERENCES branches(id),
  asset_id varchar REFERENCES inventory_items(id),
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assignee_user_id varchar REFERENCES users(id),
  due_at timestamp,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','closed')),
  closed_at timestamp,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by varchar NOT NULL REFERENCES users(id),
  updated_by varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('assigned','in_progress') OR assignee_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_branch_status_due ON maintenance_tickets(branch_id,status,due_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_assignee ON maintenance_tickets(assignee_user_id);
CREATE TABLE IF NOT EXISTS maintenance_ticket_events (
  id serial PRIMARY KEY,
  ticket_id integer NOT NULL REFERENCES maintenance_tickets(id),
  actor_user_id varchar NOT NULL REFERENCES users(id),
  event_type text NOT NULL, from_status text, to_status text, reason text, changes jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maintenance_ticket_events_ticket ON maintenance_ticket_events(ticket_id,created_at);
CREATE TABLE IF NOT EXISTS maintenance_ticket_attachments (
  id serial PRIMARY KEY,
  ticket_id integer NOT NULL REFERENCES maintenance_tickets(id),
  original_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  uploaded_by varchar NOT NULL REFERENCES users(id),
  archived_at timestamp,
  archived_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maintenance_ticket_attachments_ticket ON maintenance_ticket_attachments(ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_ticket_attachment_path ON maintenance_ticket_attachments(storage_path);
COMMIT;