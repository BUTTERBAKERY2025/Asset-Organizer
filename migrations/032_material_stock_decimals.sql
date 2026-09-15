BEGIN;

-- Integer material quantities convert losslessly.  No values are backfilled,
-- rounded, or defaulted by this migration; existing NULLs remain NULL.
ALTER TABLE warehouse_items
  ALTER COLUMN min_stock_level TYPE NUMERIC(18, 6) USING min_stock_level::NUMERIC(18, 6),
  ALTER COLUMN max_stock_level TYPE NUMERIC(18, 6) USING max_stock_level::NUMERIC(18, 6),
  ALTER COLUMN reorder_point TYPE NUMERIC(18, 6) USING reorder_point::NUMERIC(18, 6),
  ALTER COLUMN current_stock TYPE NUMERIC(18, 6) USING current_stock::NUMERIC(18, 6);

ALTER TABLE branch_stock
  ALTER COLUMN current_quantity TYPE NUMERIC(18, 6) USING current_quantity::NUMERIC(18, 6),
  ALTER COLUMN reserved_quantity TYPE NUMERIC(18, 6) USING reserved_quantity::NUMERIC(18, 6),
  ALTER COLUMN daily_consumption TYPE NUMERIC(18, 6) USING daily_consumption::NUMERIC(18, 6);

ALTER TABLE material_transfer_items
  ALTER COLUMN quantity TYPE NUMERIC(18, 6) USING quantity::NUMERIC(18, 6),
  ALTER COLUMN original_quantity TYPE NUMERIC(18, 6) USING original_quantity::NUMERIC(18, 6),
  ALTER COLUMN available_quantity TYPE NUMERIC(18, 6) USING available_quantity::NUMERIC(18, 6),
  ALTER COLUMN received_quantity TYPE NUMERIC(18, 6) USING received_quantity::NUMERIC(18, 6),
  ALTER COLUMN discrepancy TYPE NUMERIC(18, 6) USING discrepancy::NUMERIC(18, 6);

-- Transfer and adjustment audit rows must represent the same fractional
-- quantity as the balance they describe.
ALTER TABLE warehouse_movement_logs
  ALTER COLUMN quantity TYPE NUMERIC(18, 6) USING quantity::NUMERIC(18, 6),
  ALTER COLUMN balance_before TYPE NUMERIC(18, 6) USING balance_before::NUMERIC(18, 6),
  ALTER COLUMN balance_after TYPE NUMERIC(18, 6) USING balance_after::NUMERIC(18, 6);

-- Allocation values are decimal only for warehouse-material sources.  Finished
-- goods remain integer-enforced by the live-service source-specific boundary.
ALTER TABLE central_kitchen_inventory_allocations
  ALTER COLUMN reserved_quantity TYPE NUMERIC(18, 6) USING reserved_quantity::NUMERIC(18, 6),
  ALTER COLUMN dispatched_quantity TYPE NUMERIC(18, 6) USING dispatched_quantity::NUMERIC(18, 6),
  ALTER COLUMN released_quantity TYPE NUMERIC(18, 6) USING released_quantity::NUMERIC(18, 6),
  ALTER COLUMN received_quantity TYPE NUMERIC(18, 6) USING received_quantity::NUMERIC(18, 6);

ALTER TABLE central_kitchen_inventory_movements
  ALTER COLUMN quantity TYPE NUMERIC(18, 6) USING quantity::NUMERIC(18, 6);

-- Central-kitchen workflow quantities were REAL.  Convert their canonical
-- textual representation, never the binary float directly.  Abort rather
-- than silently rounding a legacy value that has more than six decimals.
DO $$
DECLARE
  invalid_quantity TEXT;
BEGIN
  SELECT format('%s (row %s) = %s', field_name, row_id, quantity_text)
  INTO invalid_quantity
  FROM (
    SELECT 'central_kitchen_order_items.requested_quantity' AS field_name, id AS row_id, requested_quantity::text AS quantity_text FROM central_kitchen_order_items
    UNION ALL SELECT 'central_kitchen_order_items.prepared_quantity', id, prepared_quantity::text FROM central_kitchen_order_items
    UNION ALL SELECT 'central_kitchen_order_items.substitute_quantity', id, substitute_quantity::text FROM central_kitchen_order_items
    UNION ALL SELECT 'central_kitchen_order_items.dispatched_quantity', id, dispatched_quantity::text FROM central_kitchen_order_items
    UNION ALL SELECT 'central_kitchen_order_items.received_quantity', id, received_quantity::text FROM central_kitchen_order_items
    UNION ALL SELECT 'central_kitchen_order_items.damaged_quantity', id, damaged_quantity::text FROM central_kitchen_order_items
    UNION ALL SELECT 'central_kitchen_order_items.missing_quantity', id, missing_quantity::text FROM central_kitchen_order_items
    UNION ALL SELECT 'central_kitchen_shadow_inventory_entries.quantity', id, quantity::text FROM central_kitchen_shadow_inventory_entries
  ) quantities
  WHERE quantity_text IS NOT NULL
    AND (
      quantity_text !~ '^-?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
      OR CASE
        WHEN quantity_text ~ '^-?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
          THEN scale(quantity_text::numeric) > 6
            OR abs(quantity_text::numeric) > 999999999999.999999::numeric
        ELSE false
      END
    )
  LIMIT 1;

  IF invalid_quantity IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration 032 cannot convert central-kitchen quantity without rounding: %. Correct it to a canonical decimal with at most 6 places before retrying.',
      invalid_quantity;
  END IF;
END $$;

ALTER TABLE central_kitchen_order_items
  ALTER COLUMN requested_quantity TYPE NUMERIC(18, 6) USING requested_quantity::text::NUMERIC(18, 6),
  ALTER COLUMN prepared_quantity TYPE NUMERIC(18, 6) USING prepared_quantity::text::NUMERIC(18, 6),
  ALTER COLUMN substitute_quantity TYPE NUMERIC(18, 6) USING substitute_quantity::text::NUMERIC(18, 6),
  ALTER COLUMN dispatched_quantity TYPE NUMERIC(18, 6) USING dispatched_quantity::text::NUMERIC(18, 6),
  ALTER COLUMN received_quantity TYPE NUMERIC(18, 6) USING received_quantity::text::NUMERIC(18, 6),
  ALTER COLUMN damaged_quantity TYPE NUMERIC(18, 6) USING damaged_quantity::text::NUMERIC(18, 6),
  ALTER COLUMN missing_quantity TYPE NUMERIC(18, 6) USING missing_quantity::text::NUMERIC(18, 6);

ALTER TABLE central_kitchen_shadow_inventory_entries
  ALTER COLUMN quantity TYPE NUMERIC(18, 6) USING quantity::text::NUMERIC(18, 6);

COMMIT;