-- Apply after delivery_source_extension and reverse_logistics.
ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_source_type_check;
ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_assignments_source_type_check
  CHECK (source_type IN ('kitchen','material_transfer','finished_goods_transfer','kitchen_warehouse_shipment','reverse_movement'));
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS handover_recorded_at timestamptz;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS handover_acknowledged_at timestamptz;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS handover_driver_id varchar REFERENCES users(id);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS handover_vehicle_number text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS handover_items jsonb;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS handover_fingerprint text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS handover_revision integer NOT NULL DEFAULT 0;