-- Branch-declared on-hand quantity is informative only. Historical NULL rows
-- deliberately mean "not reported" and must not be rewritten to zero.
ALTER TABLE central_kitchen_order_items
  ADD COLUMN IF NOT EXISTS reported_available_quantity numeric(18, 6);

ALTER TABLE central_kitchen_order_items
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_reported_available_quantity,
  ADD CONSTRAINT ck_central_kitchen_order_items_reported_available_quantity
    CHECK (reported_available_quantity IS NULL OR reported_available_quantity >= 0);