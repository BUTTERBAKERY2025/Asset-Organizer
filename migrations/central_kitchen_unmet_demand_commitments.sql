-- Additive only. Commitment rows never post inventory. Historical orders are
-- visible to reconciliation queries but become actionable only after an
-- explicit legacy_reconciliation activation.
CREATE TABLE IF NOT EXISTS central_kitchen_demand_commitments (
  id serial PRIMARY KEY,
  original_order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  original_order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  request_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  central_kitchen_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  inventory_mode text,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  warehouse_item_id integer REFERENCES warehouse_items(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  requested_quantity numeric(18,6) NOT NULL,
  original_good_received_quantity numeric(18,6) NOT NULL,
  total_good_received_quantity numeric(18,6) NOT NULL,
  preparation_shortfall_quantity numeric(18,6) NOT NULL,
  transit_loss_quantity numeric(18,6) NOT NULL,
  substitute_prepared_quantity numeric(18,6) NOT NULL,
  substitute_offered_quantity numeric(18,6) NOT NULL,
  receipt_attribution_basis text NOT NULL DEFAULT 'estimated_original_first',
  reason_code text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  activation_kind text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  activated_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  activated_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_demand_commitment_item UNIQUE(original_order_item_id),
  CONSTRAINT ck_central_kitchen_demand_commitment_mode CHECK (inventory_mode IS NULL OR inventory_mode IN ('real','shadow')),
  CONSTRAINT ck_central_kitchen_demand_commitment_status CHECK (status IN ('open','replacement_planned','substitute_pending','partially_settled','fulfilled','waived')),
  CONSTRAINT ck_central_kitchen_demand_commitment_activation CHECK (activation_kind IN ('receipt','legacy_reconciliation')),
  CONSTRAINT ck_central_kitchen_demand_commitment_receipt_basis CHECK (receipt_attribution_basis IN ('estimated_original_first','branch_confirmed')),
  CONSTRAINT ck_central_kitchen_demand_commitment_quantities CHECK (requested_quantity > 0 AND original_good_received_quantity >= 0 AND original_good_received_quantity <= requested_quantity AND total_good_received_quantity >= original_good_received_quantity AND total_good_received_quantity <= requested_quantity AND preparation_shortfall_quantity >= 0 AND transit_loss_quantity >= 0 AND substitute_prepared_quantity >= 0 AND substitute_prepared_quantity <= requested_quantity AND substitute_offered_quantity >= 0 AND substitute_offered_quantity <= substitute_prepared_quantity)
);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_demand_commitments_scope ON central_kitchen_demand_commitments(central_kitchen_id, request_branch_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'central_kitchen_order_items'::regclass
      AND conname = 'uq_central_kitchen_order_items_order_identity'
  ) THEN
    ALTER TABLE central_kitchen_order_items
      ADD CONSTRAINT uq_central_kitchen_order_items_order_identity UNIQUE(order_id,id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS central_kitchen_demand_actions (
  id serial PRIMARY KEY,
  commitment_id integer NOT NULL REFERENCES central_kitchen_demand_commitments(id) ON DELETE RESTRICT,
  action_type text NOT NULL,
  quantity numeric(18,6) NOT NULL,
  secondary_quantity numeric(18,6),
  due_date date,
  responsible_user_id varchar REFERENCES users(id) ON DELETE RESTRICT,
  replacement_order_id integer REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  replacement_order_item_id integer REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  reason text,
  actor_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key varchar(128) NOT NULL,
  payload_fingerprint varchar(64) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_demand_action_key UNIQUE(commitment_id,idempotency_key),
  CONSTRAINT fk_central_kitchen_demand_replacement_item FOREIGN KEY(replacement_order_id,replacement_order_item_id) REFERENCES central_kitchen_order_items(order_id,id) ON DELETE RESTRICT,
  CONSTRAINT ck_central_kitchen_demand_action_type CHECK (action_type IN ('replacement_created','substitute_accepted','remainder_waived','receipt_attribution_confirmed')),
  CONSTRAINT ck_central_kitchen_demand_action_quantity CHECK ((action_type='receipt_attribution_confirmed' AND quantity >= 0 AND secondary_quantity >= 0) OR (action_type<>'receipt_attribution_confirmed' AND quantity > 0 AND secondary_quantity IS NULL)),
  CONSTRAINT ck_central_kitchen_demand_action_shape CHECK (
    (action_type='replacement_created' AND due_date IS NOT NULL AND responsible_user_id IS NOT NULL AND replacement_order_id IS NOT NULL AND replacement_order_item_id IS NOT NULL)
    OR (action_type='substitute_accepted' AND replacement_order_id IS NULL AND replacement_order_item_id IS NULL)
    OR (action_type='remainder_waived' AND NULLIF(BTRIM(reason),'') IS NOT NULL AND replacement_order_id IS NULL AND replacement_order_item_id IS NULL)
    OR (action_type='receipt_attribution_confirmed' AND replacement_order_id IS NULL AND replacement_order_item_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_demand_actions_commitment ON central_kitchen_demand_actions(commitment_id,created_at);

-- Match the existing kitchen tables: server-side database access only.
-- Do not expose order follow-up data through Supabase's public Data API.
ALTER TABLE central_kitchen_demand_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_kitchen_demand_actions ENABLE ROW LEVEL SECURITY;