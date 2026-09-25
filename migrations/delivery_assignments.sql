-- Delivery orchestration is metadata only. Source receiving APIs remain the only stock writers.
CREATE TABLE IF NOT EXISTS delivery_assignments (
  id bigserial PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('kitchen', 'material_transfer')),
  source_id integer NOT NULL,
  driver_id varchar NOT NULL REFERENCES users(id),
  vehicle_number text NOT NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_transit','awaiting_receipt','receipt_approved','completed','failed')),
  signature_data text,
  receiver_name text,
  notes text,
  proof_at timestamptz,
  receipt_approved_by varchar REFERENCES users(id),
  receipt_approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_by varchar NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- A failed assignment remains the historical job; recovery must reassign it,
-- never create a second job for the same source (nor re-credit its stock).
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_source ON delivery_assignments(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_delivery_driver ON delivery_assignments(driver_id, created_at DESC);
CREATE TABLE IF NOT EXISTS delivery_assignment_events (
  id bigserial PRIMARY KEY,
  assignment_id bigint NOT NULL REFERENCES delivery_assignments(id),
  actor_id varchar NOT NULL REFERENCES users(id),
  action text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_events_assignment ON delivery_assignment_events(assignment_id, created_at);