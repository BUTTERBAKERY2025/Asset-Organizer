-- Additive preparation details for central-kitchen orders.
-- No inventory, production-order, or stock-ledger writes are introduced here.
BEGIN;

ALTER TABLE central_kitchen_order_items
  ADD COLUMN IF NOT EXISTS prepared_quantity real,
  ADD COLUMN IF NOT EXISTS substitute_quantity real,
  ADD COLUMN IF NOT EXISTS substitute_product_id integer REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substitute_product_name text,
  ADD COLUMN IF NOT EXISTS substitute_unit text,
  ADD COLUMN IF NOT EXISTS shortage_reason text,
  ADD COLUMN IF NOT EXISTS preparation_notes text;

ALTER TABLE central_kitchen_order_events
  ADD COLUMN IF NOT EXISTS payload_fingerprint varchar(64);

ALTER TABLE central_kitchen_order_items
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_prepared_quantity,
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_substitute_quantity,
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_total_ready,
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_substitute_identity,
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_shortage_reason,
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_preparation_consistency;

ALTER TABLE central_kitchen_order_items
  ADD CONSTRAINT ck_central_kitchen_order_items_prepared_quantity
    CHECK (prepared_quantity IS NULL OR prepared_quantity >= 0),
  ADD CONSTRAINT ck_central_kitchen_order_items_substitute_quantity
    CHECK (substitute_quantity IS NULL OR substitute_quantity >= 0),
  ADD CONSTRAINT ck_central_kitchen_order_items_total_ready
    CHECK (prepared_quantity IS NULL OR
      COALESCE(prepared_quantity, 0) + COALESCE(substitute_quantity, 0) <= requested_quantity),
  ADD CONSTRAINT ck_central_kitchen_order_items_substitute_identity
    CHECK (
      (COALESCE(substitute_quantity, 0) = 0 AND substitute_product_id IS NULL AND
       substitute_product_name IS NULL AND substitute_unit IS NULL) OR
      (COALESCE(substitute_quantity, 0) > 0 AND
       NULLIF(BTRIM(substitute_product_name), '') IS NOT NULL AND substitute_unit = unit)
    ),
  ADD CONSTRAINT ck_central_kitchen_order_items_shortage_reason
    CHECK (
      prepared_quantity IS NULL OR
      (COALESCE(prepared_quantity, 0) + COALESCE(substitute_quantity, 0) < requested_quantity AND
       shortage_reason IN ('unavailable', 'out_of_stock', 'production_issue', 'quality_issue', 'other')) OR
      (COALESCE(prepared_quantity, 0) + COALESCE(substitute_quantity, 0) >= requested_quantity AND
       shortage_reason IS NULL)
    ),
  ADD CONSTRAINT ck_central_kitchen_order_items_preparation_consistency
    CHECK (
      prepared_quantity IS NOT NULL OR
      (substitute_quantity IS NULL AND substitute_product_id IS NULL AND
       substitute_product_name IS NULL AND substitute_unit IS NULL AND
       shortage_reason IS NULL AND preparation_notes IS NULL)
    );

COMMIT;