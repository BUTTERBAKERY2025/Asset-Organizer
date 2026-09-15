-- Link central-kitchen lines to the warehouse catalog without moving real stock.
-- Existing product/manual rows are intentionally left unchanged; there is no backfill.
BEGIN;

ALTER TABLE central_kitchen_order_items
  ADD COLUMN IF NOT EXISTS warehouse_item_id INTEGER REFERENCES warehouse_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substitute_warehouse_item_id INTEGER REFERENCES warehouse_items(id) ON DELETE SET NULL;

ALTER TABLE central_kitchen_shadow_inventory_entries
  ADD COLUMN IF NOT EXISTS warehouse_item_id INTEGER REFERENCES warehouse_items(id) ON DELETE RESTRICT;

ALTER TABLE central_kitchen_order_items
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_catalog_identity,
  ADD CONSTRAINT ck_central_kitchen_order_items_catalog_identity
    CHECK (NOT (product_id IS NOT NULL AND warehouse_item_id IS NOT NULL)),
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_substitute_identity,
  ADD CONSTRAINT ck_central_kitchen_order_items_substitute_identity CHECK (
    (COALESCE(substitute_quantity, 0) = 0
      AND substitute_product_id IS NULL
      AND substitute_warehouse_item_id IS NULL
      AND substitute_product_name IS NULL
      AND substitute_unit IS NULL)
    OR
    (COALESCE(substitute_quantity, 0) > 0
      AND NOT (substitute_product_id IS NOT NULL AND substitute_warehouse_item_id IS NOT NULL)
      AND NULLIF(BTRIM(substitute_product_name), '') IS NOT NULL
      AND substitute_unit = unit)
  ),
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_preparation_consistency,
  ADD CONSTRAINT ck_central_kitchen_order_items_preparation_consistency CHECK (
    prepared_quantity IS NOT NULL
    OR (substitute_quantity IS NULL
      AND substitute_product_id IS NULL
      AND substitute_warehouse_item_id IS NULL
      AND substitute_product_name IS NULL
      AND substitute_unit IS NULL
      AND shortage_reason IS NULL
      AND preparation_notes IS NULL)
  );

COMMIT;