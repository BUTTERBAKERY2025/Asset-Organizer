BEGIN;

ALTER TABLE central_kitchen_inventory_allocations
  ADD COLUMN IF NOT EXISTS received_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE central_kitchen_inventory_allocations
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_allocation_quantities;
ALTER TABLE central_kitchen_inventory_allocations
  ADD CONSTRAINT ck_central_kitchen_allocation_quantities CHECK (
    reserved_quantity > 0 AND dispatched_quantity >= 0 AND released_quantity >= 0
    AND received_quantity >= 0
    AND dispatched_quantity + released_quantity <= reserved_quantity
    AND received_quantity <= dispatched_quantity
  ) NOT VALID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) AS key(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
    WHERE c.contype = 'f'
      AND c.conrelid = 'daily_production_batches'::regclass
      AND c.confrelid = 'central_kitchen_order_items'::regclass
      AND a.attname = 'central_kitchen_order_item_id'
  ) THEN
    ALTER TABLE daily_production_batches
      ADD CONSTRAINT daily_production_batches_central_kitchen_order_item_id_fkey
      FOREIGN KEY (central_kitchen_order_item_id)
      REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM finished_goods_inventory WHERE product_id IS NOT NULL
    GROUP BY branch_id, product_id, production_date, unit HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Canonical finished-goods collision: resolve duplicate branch/product/date/unit rows before migration 030';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finished_goods_canonical_product
  ON finished_goods_inventory(branch_id, product_id, production_date, unit)
  WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS central_kitchen_inventory_movements (
  id SERIAL PRIMARY KEY,
  allocation_id INTEGER NOT NULL REFERENCES central_kitchen_inventory_allocations(id) ON DELETE RESTRICT,
  order_id INTEGER NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id INTEGER NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  catalog_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,
  event_id INTEGER NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  actor_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_inventory_movement_reference UNIQUE(allocation_id, movement_type),
  CONSTRAINT ck_central_kitchen_inventory_movement_type CHECK
    (movement_type IN ('dispatch_debit', 'reservation_release', 'receipt_credit')),
  CONSTRAINT ck_central_kitchen_inventory_movement_quantity CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_inventory_movements_order
  ON central_kitchen_inventory_movements(order_id, created_at);

CREATE OR REPLACE FUNCTION reject_central_kitchen_inventory_movement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'central_kitchen_inventory_movements is immutable';
END $$;
DROP TRIGGER IF EXISTS trg_central_kitchen_inventory_movements_immutable
  ON central_kitchen_inventory_movements;
CREATE TRIGGER trg_central_kitchen_inventory_movements_immutable
  BEFORE UPDATE OR DELETE ON central_kitchen_inventory_movements
  FOR EACH ROW EXECUTE FUNCTION reject_central_kitchen_inventory_movement_mutation();

COMMIT;