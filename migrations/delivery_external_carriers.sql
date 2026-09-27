-- Additive metadata only; source stock dispatch/receipt remains authoritative.
ALTER TABLE delivery_assignments ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE delivery_assignments ALTER COLUMN vehicle_number DROP NOT NULL;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS transport_mode text NOT NULL DEFAULT 'internal';
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS carrier_name text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS waybill text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS package_count integer;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS exception_reason text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS exception_resolution text;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS exception_resolved_at timestamptz;
DO $carrier$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'delivery_assignments'::regclass
    AND conname = 'delivery_transport_fields_check') THEN
    ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_transport_fields_check
      CHECK ((transport_mode = 'internal' AND driver_id IS NOT NULL AND vehicle_number IS NOT NULL
               AND carrier IS NULL AND carrier_name IS NULL AND waybill IS NULL AND package_count IS NULL)
        OR (transport_mode = 'external' AND driver_id IS NULL AND vehicle_number IS NULL
               AND carrier IS NOT NULL AND carrier IN ('road','naqel','other')
               AND (carrier <> 'other' OR (carrier_name IS NOT NULL AND length(trim(carrier_name)) > 0))
               AND waybill IS NOT NULL AND length(trim(waybill)) > 0
               AND package_count IS NOT NULL AND package_count > 0));
  END IF;
END $carrier$;
CREATE TABLE IF NOT EXISTS delivery_carrier_attachments (
  id bigserial PRIMARY KEY,
  assignment_id bigint NOT NULL REFERENCES delivery_assignments(id),
  kind text NOT NULL CHECK (kind IN ('shipment_photo','carrier_receipt')),
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  uploaded_by varchar NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_carrier_attachments_assignment_idx ON delivery_carrier_attachments(assignment_id);
ALTER TABLE delivery_carrier_attachments ENABLE ROW LEVEL SECURITY;