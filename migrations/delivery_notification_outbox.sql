-- State transitions enqueue in the same transaction; a separate worker delivers
-- bell/push notices without ever making delivery or stock depend on push success.
CREATE TABLE IF NOT EXISTS delivery_notification_outbox (
  id bigserial PRIMARY KEY,
  assignment_id bigint NOT NULL REFERENCES delivery_assignments(id),
  event_id bigint REFERENCES delivery_assignment_events(id),
  event_type text NOT NULL CHECK (event_type IN
    ('failed','cancelled','awaiting_receipt','receipt_approved','overdue','escalated')),
  revision text NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_notice_once UNIQUE (assignment_id, event_type, revision)
);
CREATE INDEX IF NOT EXISTS delivery_notice_pending ON delivery_notification_outbox(available_at, id)
  WHERE published_at IS NULL;
ALTER TABLE delivery_notification_outbox ENABLE ROW LEVEL SECURITY;