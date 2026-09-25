-- Managed warehouse PRODUCT lots are separate from raw material managed_warehouse_stock.
-- Existing managed_warehouses are reused; this migration does not create opening balances.
CREATE TABLE IF NOT EXISTS kitchen_warehouse_shipments (
  id bigserial PRIMARY KEY,
  source_branch_id varchar NOT NULL REFERENCES branches(id),
  destination_warehouse_id bigint NOT NULL REFERENCES managed_warehouses(id),
  product_id integer NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  received_quantity integer CHECK (received_quantity BETWEEN 0 AND quantity),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','dispatched','received','cancelled')),
  carrier_name text,
  vehicle_number text,
  notes text,
  created_by varchar NOT NULL REFERENCES users(id),
  create_key varchar(128) NOT NULL,
  create_fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  received_at timestamptz,
  UNIQUE(created_by,create_key)
);
CREATE TABLE IF NOT EXISTS kitchen_warehouse_shipment_lots (
  shipment_id bigint NOT NULL REFERENCES kitchen_warehouse_shipments(id),
  stock_id integer NOT NULL REFERENCES finished_goods_inventory(id),
  production_date text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY(shipment_id,stock_id)
);
CREATE TABLE IF NOT EXISTS managed_warehouse_product_stock (
  warehouse_id bigint NOT NULL REFERENCES managed_warehouses(id),
  product_id integer NOT NULL REFERENCES products(id),
  unit text NOT NULL,
  production_date text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  PRIMARY KEY(warehouse_id,product_id,unit,production_date)
);
CREATE TABLE IF NOT EXISTS kitchen_warehouse_shipment_events (
  id bigserial PRIMARY KEY,
  shipment_id bigint NOT NULL REFERENCES kitchen_warehouse_shipments(id),
  action text NOT NULL,
  actor_id varchar NOT NULL REFERENCES users(id),
  idempotency_key varchar(128) NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shipment_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS kitchen_warehouse_shipments_source_idx ON kitchen_warehouse_shipments(source_branch_id,id DESC);
CREATE INDEX IF NOT EXISTS kitchen_warehouse_shipments_destination_idx ON kitchen_warehouse_shipments(destination_warehouse_id,id DESC);