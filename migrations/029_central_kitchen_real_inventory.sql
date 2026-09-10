BEGIN;

ALTER TABLE central_kitchen_orders
  ADD COLUMN IF NOT EXISTS inventory_mode TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_central_kitchen_orders_inventory_mode') THEN
    ALTER TABLE central_kitchen_orders ADD CONSTRAINT ck_central_kitchen_orders_inventory_mode
      CHECK (inventory_mode IS NULL OR inventory_mode IN ('shadow', 'real')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS central_kitchen_runtime (
  kitchen_id VARCHAR PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'shadow',
  activated_at TIMESTAMP,
  activated_by VARCHAR REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_central_kitchen_runtime_mode CHECK (mode IN ('shadow', 'real', 'paused'))
);

ALTER TABLE finished_goods_inventory
  ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_finished_goods_reserved_quantity') THEN
    ALTER TABLE finished_goods_inventory ADD CONSTRAINT ck_finished_goods_reserved_quantity
      CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_finished_goods_product ON finished_goods_inventory(product_id);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM finished_goods_inventory WHERE product_id IS NOT NULL
    GROUP BY branch_id, product_id, production_date, unit HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Canonical finished-goods collision: resolve duplicate branch/product/date/unit rows before migration 029';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_finished_goods_canonical_product
  ON finished_goods_inventory(branch_id, product_id, production_date, unit)
  WHERE product_id IS NOT NULL;
DROP INDEX IF EXISTS finished_goods_unique_idx;
CREATE UNIQUE INDEX finished_goods_unique_idx
  ON finished_goods_inventory(branch_id, product_name_normalized, production_date)
  WHERE product_id IS NULL;

ALTER TABLE branch_stock
  ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_branch_stock_reserved_quantity') THEN
    ALTER TABLE branch_stock ADD CONSTRAINT ck_branch_stock_reserved_quantity
      CHECK (reserved_quantity >= 0 AND reserved_quantity <= COALESCE(current_quantity, 0)) NOT VALID;
  END IF;
END $$;

ALTER TABLE daily_production_batches
  ADD COLUMN IF NOT EXISTS central_kitchen_order_item_id INTEGER
    REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS central_kitchen_idempotency_key VARCHAR(128),
  ADD COLUMN IF NOT EXISTS central_kitchen_payload_fingerprint VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_production_linked_item_date
  ON daily_production_batches(central_kitchen_order_item_id, production_date)
  WHERE central_kitchen_order_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_production_linked_creator_key
  ON daily_production_batches(recorded_by, central_kitchen_idempotency_key)
  WHERE central_kitchen_order_item_id IS NOT NULL AND central_kitchen_idempotency_key IS NOT NULL;

ALTER TABLE production_inventory_logs
  ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES daily_production_batches(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_production_inventory_logs_batch
  ON production_inventory_logs(batch_id) WHERE batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS central_kitchen_inventory_allocations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id INTEGER NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  component TEXT NOT NULL,
  kind TEXT NOT NULL,
  catalog_id INTEGER NOT NULL,
  source_finished_goods_id INTEGER REFERENCES finished_goods_inventory(id) ON DELETE RESTRICT,
  source_branch_stock_id INTEGER REFERENCES branch_stock(id) ON DELETE RESTRICT,
  unit TEXT NOT NULL,
  reserved_quantity INTEGER NOT NULL,
  dispatched_quantity INTEGER NOT NULL DEFAULT 0,
  released_quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_central_kitchen_allocation_component CHECK (component IN ('original', 'substitute')),
  CONSTRAINT ck_central_kitchen_allocation_kind CHECK (kind IN ('product', 'warehouse')),
  CONSTRAINT ck_central_kitchen_allocation_source CHECK (
    (kind = 'product' AND source_finished_goods_id IS NOT NULL AND source_branch_stock_id IS NULL)
    OR (kind = 'warehouse' AND source_finished_goods_id IS NULL AND source_branch_stock_id IS NOT NULL)
  ),
  CONSTRAINT ck_central_kitchen_allocation_quantities CHECK (
    reserved_quantity > 0 AND dispatched_quantity >= 0 AND released_quantity >= 0
    AND received_quantity >= 0 AND dispatched_quantity + released_quantity <= reserved_quantity
    AND received_quantity <= dispatched_quantity
  ),
  CONSTRAINT ck_central_kitchen_allocation_status CHECK (status IN ('reserved', 'dispatched', 'released'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_central_kitchen_allocation_finished_source
  ON central_kitchen_inventory_allocations(order_item_id, component, source_finished_goods_id)
  WHERE source_finished_goods_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_central_kitchen_allocation_branch_source
  ON central_kitchen_inventory_allocations(order_item_id, component, source_branch_stock_id)
  WHERE source_branch_stock_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_central_kitchen_allocations_order
  ON central_kitchen_inventory_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_allocations_item
  ON central_kitchen_inventory_allocations(order_item_id);

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