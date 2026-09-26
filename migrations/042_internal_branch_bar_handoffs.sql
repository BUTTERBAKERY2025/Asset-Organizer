-- Prospective, same-site branch kitchen to bar handoffs. Legacy receipts are not backfilled.
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS request_key text;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS dispatch_key text;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS receive_key text;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS cancel_key text;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS usable_quantity integer;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS damaged_quantity integer;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS shortage_quantity integer;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS settlement_status text;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS receipt_notes text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_internal_bar_request_key ON finished_goods_transfers(request_key) WHERE request_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS branch_bar_stock (
  id serial PRIMARY KEY,
  branch_id varchar NOT NULL REFERENCES branches(id),
  product_id integer NOT NULL REFERENCES products(id),
  production_date text NOT NULL,
  unit text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  quarantine_quantity integer NOT NULL DEFAULT 0,
  CONSTRAINT ck_branch_bar_stock_nonnegative CHECK (quantity >= 0 AND quarantine_quantity >= 0),
  CONSTRAINT uq_branch_bar_stock_lot UNIQUE(branch_id,product_id,production_date,unit)
);
CREATE TABLE IF NOT EXISTS branch_bar_handoff_events (
  id bigserial PRIMARY KEY,
  transfer_id integer NOT NULL REFERENCES finished_goods_transfers(id),
  action text NOT NULL CHECK (action IN ('request','dispatch','receive','cancel')),
  actor_id varchar NOT NULL REFERENCES users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_branch_bar_handoff_event UNIQUE(transfer_id,action)
);
-- The cutoff prevents the legacy missing-receipts sync from inventing an
-- acknowledgement for batches finished after this workflow was activated.
CREATE TABLE IF NOT EXISTS branch_bar_workflow_activation (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO branch_bar_workflow_activation(id) VALUES (1) ON CONFLICT DO NOTHING;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_internal_bar_handoff_totals'
                 AND conrelid = 'finished_goods_transfers'::regclass) THEN
    ALTER TABLE finished_goods_transfers ADD CONSTRAINT ck_internal_bar_handoff_totals CHECK (
      transport_policy <> 'internal_bar_receipt' OR (
        quantity > 0 AND destination_type = 'display_bar'
        AND destination_branch_id = source_branch_id AND product_id IS NOT NULL
        AND production_date IS NOT NULL AND created_by IS NOT NULL
        AND request_key IS NOT NULL AND status IN ('pending','in_transit','received','cancelled')
        AND (status <> 'in_transit' OR (dispatched_at IS NOT NULL AND dispatch_key IS NOT NULL))
        AND (status <> 'received' OR (
          dispatched_at IS NOT NULL AND received_at IS NOT NULL
          AND dispatch_key IS NOT NULL AND receive_key IS NOT NULL AND received_by IS NOT NULL
          AND usable_quantity >= 0 AND damaged_quantity >= 0 AND shortage_quantity >= 0
          AND received_quantity = usable_quantity + damaged_quantity
          AND shortage_quantity = quantity - received_quantity
        ))
      )
    );
  END IF;
END $$;