-- Central-kitchen dispatch and receiving details.
-- This phase records operational quantities only. It creates no inventory movement.
BEGIN;

ALTER TABLE central_kitchen_orders
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS vehicle_number text,
  ADD COLUMN IF NOT EXISTS discrepancy_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discrepancy_resolved_by varchar REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS discrepancy_resolved_at timestamp,
  ADD COLUMN IF NOT EXISTS discrepancy_resolution_notes text;

ALTER TABLE central_kitchen_order_items
  ADD COLUMN IF NOT EXISTS dispatched_quantity real,
  ADD COLUMN IF NOT EXISTS received_quantity real,
  ADD COLUMN IF NOT EXISTS damaged_quantity real,
  ADD COLUMN IF NOT EXISTS missing_quantity real,
  ADD COLUMN IF NOT EXISTS receiving_notes text;

ALTER TABLE central_kitchen_orders
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_orders_discrepancy_status;
ALTER TABLE central_kitchen_orders
  ADD CONSTRAINT ck_central_kitchen_orders_discrepancy_status
  CHECK (discrepancy_status IN ('none', 'open', 'resolved'));

ALTER TABLE central_kitchen_order_items
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_dispatched_quantity,
  DROP CONSTRAINT IF EXISTS ck_central_kitchen_order_items_receipt_quantities;
ALTER TABLE central_kitchen_order_items
  ADD CONSTRAINT ck_central_kitchen_order_items_dispatched_quantity
    CHECK (dispatched_quantity IS NULL OR
      (dispatched_quantity >= 0 AND
       dispatched_quantity <= COALESCE(prepared_quantity, 0) + COALESCE(substitute_quantity, 0))),
  ADD CONSTRAINT ck_central_kitchen_order_items_receipt_quantities
    CHECK (received_quantity IS NULL OR
      (received_quantity >= 0 AND COALESCE(damaged_quantity, 0) >= 0 AND
       COALESCE(missing_quantity, 0) >= 0 AND
       received_quantity + COALESCE(damaged_quantity, 0) + COALESCE(missing_quantity, 0) = dispatched_quantity));

CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_discrepancy
  ON central_kitchen_orders(discrepancy_status);

COMMIT;