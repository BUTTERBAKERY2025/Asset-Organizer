-- Additive reverse logistics; apply before deploying API/UI. Never seed or duplicate main stock.
CREATE TABLE IF NOT EXISTS managed_warehouses (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS reverse_reserved_quantity numeric(18,6) NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='warehouse_reverse_reserved_guard') THEN
  ALTER TABLE warehouse_items ADD CONSTRAINT warehouse_reverse_reserved_guard CHECK (reverse_reserved_quantity >= 0 AND reverse_reserved_quantity <= COALESCE(current_stock,0));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS managed_warehouse_stock (
  warehouse_id bigint NOT NULL REFERENCES managed_warehouses(id),
  item_id integer NOT NULL REFERENCES warehouse_items(id),
  quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity),
  PRIMARY KEY (warehouse_id,item_id)
);
CREATE TABLE IF NOT EXISTS managed_warehouse_movement_logs (
 id bigserial PRIMARY KEY,
 warehouse_id bigint NOT NULL REFERENCES managed_warehouses(id),
 item_id integer NOT NULL REFERENCES warehouse_items(id),
 movement_id bigint NOT NULL,
 movement_type text NOT NULL CHECK(movement_type IN ('transfer_in','transfer_out')),
 quantity numeric(18,6) NOT NULL CHECK(quantity <> 0),
 balance_before numeric(18,6) NOT NULL,
 balance_after numeric(18,6) NOT NULL,
 actor_id varchar NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(movement_id,movement_type,warehouse_id)
);
CREATE TABLE IF NOT EXISTS reverse_product_reservations (
  movement_id bigint NOT NULL,
  stock_id integer NOT NULL REFERENCES finished_goods_inventory(id),
  quantity integer NOT NULL CHECK(quantity > 0),
  PRIMARY KEY(movement_id,stock_id)
);
CREATE TABLE IF NOT EXISTS reverse_movements (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('material_return','product_return','warehouse_transfer')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','requested','dispatched','received','inspected','cancelled')),
  source_branch_id varchar REFERENCES branches(id),
  destination_branch_id varchar REFERENCES branches(id),
  source_warehouse_id bigint REFERENCES managed_warehouses(id),
  destination_warehouse_id bigint REFERENCES managed_warehouses(id),
  original_transfer_item_id integer REFERENCES material_transfer_items(id),
  original_order_item_id integer REFERENCES central_kitchen_order_items(id),
  component text CHECK (component IN ('original','substitute')),
  item_id integer REFERENCES warehouse_items(id),
  product_id integer REFERENCES products(id),
  item_name text NOT NULL,
  unit text NOT NULL,
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0),
  shipped_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (shipped_quantity >= 0),
  received_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  usable_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (usable_quantity >= 0),
  damaged_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  written_off_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (written_off_quantity >= 0),
  carrier_name text,
  vehicle_number text,
  notes text,
  created_by varchar NOT NULL REFERENCES users(id),
  create_key varchar(128) NOT NULL,
  create_fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(created_by,create_key),
  CHECK (received_quantity <= shipped_quantity),
  CHECK (usable_quantity + damaged_quantity <= received_quantity),
  CHECK (written_off_quantity <= damaged_quantity),
  CHECK (
    (kind='material_return' AND source_branch_id IS NOT NULL AND destination_branch_id IS NULL AND original_transfer_item_id IS NOT NULL AND item_id IS NOT NULL AND product_id IS NULL AND source_warehouse_id IS NULL AND destination_warehouse_id IS NULL AND original_order_item_id IS NULL)
    OR (kind='product_return' AND source_branch_id IS NOT NULL AND destination_branch_id IS NOT NULL AND original_order_item_id IS NOT NULL AND product_id IS NOT NULL AND component IS NOT NULL AND original_transfer_item_id IS NULL AND source_warehouse_id IS NULL AND destination_warehouse_id IS NULL)
    OR (kind='warehouse_transfer' AND source_branch_id IS NULL AND destination_branch_id IS NULL AND original_order_item_id IS NULL AND original_transfer_item_id IS NULL AND item_id IS NOT NULL AND product_id IS NULL
      AND source_warehouse_id IS DISTINCT FROM destination_warehouse_id)
  )
);
-- Re-running an additive revision after an earlier local install remains safe.
ALTER TABLE reverse_movements ADD COLUMN IF NOT EXISTS create_key varchar(128);
ALTER TABLE reverse_movements ADD COLUMN IF NOT EXISTS create_fingerprint varchar(64);
UPDATE reverse_movements SET create_key='pre-key-' || id, create_fingerprint=md5(id::text)
 WHERE create_key IS NULL OR create_fingerprint IS NULL;
ALTER TABLE reverse_movements ALTER COLUMN create_key SET NOT NULL;
ALTER TABLE reverse_movements ALTER COLUMN create_fingerprint SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reverse_movements_actor_create_key ON reverse_movements(created_by,create_key);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reverse_product_reservations_movement_fk') THEN
  ALTER TABLE reverse_product_reservations ADD CONSTRAINT reverse_product_reservations_movement_fk
   FOREIGN KEY(movement_id) REFERENCES reverse_movements(id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS reverse_movements_material_source ON reverse_movements(original_transfer_item_id) WHERE original_transfer_item_id IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='managed_warehouse_movement_logs_movement_fk') THEN
  ALTER TABLE managed_warehouse_movement_logs ADD CONSTRAINT managed_warehouse_movement_logs_movement_fk
   FOREIGN KEY(movement_id) REFERENCES reverse_movements(id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS reverse_movements_product_source ON reverse_movements(original_order_item_id,component) WHERE original_order_item_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS reverse_movement_events (
  id bigserial PRIMARY KEY,
  movement_id bigint NOT NULL REFERENCES reverse_movements(id),
  action text NOT NULL,
  actor_id varchar NOT NULL REFERENCES users(id),
  idempotency_key varchar(128) NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(movement_id,idempotency_key)
);
-- Backend uses the trusted direct-PG owner. No browser/API role has a policy.
ALTER TABLE managed_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_movement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_product_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_warehouse_movement_logs ENABLE ROW LEVEL SECURITY;