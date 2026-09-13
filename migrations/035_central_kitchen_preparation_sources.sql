BEGIN;

-- Deliberately additive: existing preparations remain NULL/unknown and are
-- never inferred as stock-backed.
ALTER TABLE central_kitchen_order_items
  ADD COLUMN IF NOT EXISTS prepared_from_stock NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS prepared_from_production NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS production_fulfillment_evidence JSONB;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_central_kitchen_order_items_preparation_source_pair') THEN
    ALTER TABLE central_kitchen_order_items
      ADD CONSTRAINT ck_central_kitchen_order_items_preparation_source_pair
      CHECK ((prepared_from_stock IS NULL) = (prepared_from_production IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_central_kitchen_order_items_preparation_sources') THEN
    ALTER TABLE central_kitchen_order_items
      ADD CONSTRAINT ck_central_kitchen_order_items_preparation_sources
      CHECK (prepared_from_stock IS NULL OR (
        prepared_quantity IS NOT NULL
        AND prepared_from_stock >= 0
        AND prepared_from_production >= 0
        AND prepared_from_stock + prepared_from_production = prepared_quantity
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_central_kitchen_order_items_production_evidence') THEN
    ALTER TABLE central_kitchen_order_items
      ADD CONSTRAINT ck_central_kitchen_order_items_production_evidence
      CHECK (
        (prepared_from_production IS NULL OR prepared_from_production = 0)
        = (production_fulfillment_evidence IS NULL)
      );
  END IF;
END $$;

-- A proof may only reference a batch that was linked to one order item at
-- creation time.  The FK already supplies referential integrity; this closes
-- the later reassignment path without introducing a source/claims ledger.
CREATE OR REPLACE FUNCTION prevent_central_kitchen_linked_batch_reassignment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.central_kitchen_order_item_id IS DISTINCT FROM OLD.central_kitchen_order_item_id THEN
    RAISE EXCEPTION 'central kitchen linked production batch item is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ck_linked_batch_item_immutable
  ON daily_production_batches;
CREATE TRIGGER trg_ck_linked_batch_item_immutable
BEFORE UPDATE OF central_kitchen_order_item_id ON daily_production_batches
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_linked_batch_reassignment();

COMMIT;