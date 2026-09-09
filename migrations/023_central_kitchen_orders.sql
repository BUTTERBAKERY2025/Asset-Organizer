-- Additive central-kitchen branch-order workflow. This migration intentionally
-- creates no inventory movement, ledger, stock trigger, or inventory foreign key.
BEGIN;

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS is_central_kitchen boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS central_kitchen_orders (
  id serial PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  request_branch_id varchar NOT NULL REFERENCES branches(id),
  central_kitchen_id varchar NOT NULL REFERENCES branches(id),
  order_date date NOT NULL,
  needed_date date,
  needed_time text,
  status text NOT NULL DEFAULT 'requested',
  notes text,
  idempotency_key varchar(128) NOT NULL,
  payload_fingerprint varchar(64) NOT NULL,
  created_by varchar NOT NULL REFERENCES users(id),
  approved_by varchar REFERENCES users(id),
  prepared_by varchar REFERENCES users(id),
  dispatched_by varchar REFERENCES users(id),
  received_by varchar REFERENCES users(id),
  approved_at timestamp,
  prepared_at timestamp,
  dispatched_at timestamp,
  received_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT ck_central_kitchen_orders_status
    CHECK (status IN ('requested', 'approved', 'prepared', 'dispatched', 'received')),
  CONSTRAINT ck_central_kitchen_orders_distinct_branches
    CHECK (request_branch_id <> central_kitchen_id),
  CONSTRAINT uq_central_kitchen_orders_creator_idempotency
    UNIQUE (created_by, idempotency_key)
);

-- Safe when upgrading a development database that briefly used "preparing".
ALTER TABLE central_kitchen_orders
  ADD COLUMN IF NOT EXISTS payload_fingerprint varchar(64);
UPDATE central_kitchen_orders
SET payload_fingerprint = 'legacy-' || id::text
WHERE payload_fingerprint IS NULL;
ALTER TABLE central_kitchen_orders
  ALTER COLUMN payload_fingerprint SET NOT NULL;
ALTER TABLE central_kitchen_orders
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_orders_status;
UPDATE central_kitchen_orders SET status = 'prepared' WHERE status = 'preparing';
ALTER TABLE central_kitchen_orders
  ADD CONSTRAINT ck_central_kitchen_orders_status
  CHECK (status IN ('requested', 'approved', 'prepared', 'dispatched', 'received'));

CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_request_branch
  ON central_kitchen_orders(request_branch_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_kitchen
  ON central_kitchen_orders(central_kitchen_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_status
  ON central_kitchen_orders(status);

CREATE TABLE IF NOT EXISTS central_kitchen_order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE CASCADE,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  requested_quantity real NOT NULL CHECK (requested_quantity > 0),
  unit text NOT NULL,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_order_items_order
  ON central_kitchen_order_items(order_id);

CREATE TABLE IF NOT EXISTS central_kitchen_order_events (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  notes text,
  idempotency_key varchar(128) NOT NULL,
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_order_events_idempotency
    UNIQUE (order_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_order_events_order
  ON central_kitchen_order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_order_events_created
  ON central_kitchen_order_events(created_at);

-- Event rows are an append-only audit history, including for direct SQL clients.
CREATE OR REPLACE FUNCTION prevent_central_kitchen_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'central_kitchen_order_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_central_kitchen_events_immutable ON central_kitchen_order_events;
CREATE TRIGGER trg_central_kitchen_events_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_order_events
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_event_mutation();

COMMIT;