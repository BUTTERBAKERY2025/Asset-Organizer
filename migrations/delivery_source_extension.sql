-- Delivery remains metadata only: cancellation does not undo source stock.
ALTER TABLE delivery_assignments ALTER COLUMN source_id TYPE bigint;
ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_source_type_check;
ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_assignments_source_type_check
  CHECK (source_type IN ('kitchen','material_transfer','finished_goods_transfer','kitchen_warehouse_shipment'));
ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_status_check;
ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_assignments_status_check
  CHECK (status IN ('assigned','in_transit','awaiting_receipt','receipt_approved','completed','failed','cancelled'));
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE kitchen_warehouse_shipments ADD COLUMN IF NOT EXISTS received_by varchar REFERENCES users(id);