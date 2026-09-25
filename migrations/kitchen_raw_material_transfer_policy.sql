-- Required by dispatch availability checks even when reverse logistics has not
-- yet been installed. This creates no reservation and changes no stock balance.
ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS reverse_reserved_quantity numeric(18,6) NOT NULL DEFAULT 0;

ALTER TABLE material_transfers
  ADD COLUMN IF NOT EXISTS stock_posting_policy text NOT NULL DEFAULT 'on_receipt';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_transfers_stock_posting_policy_check'
    AND conrelid = 'material_transfers'::regclass) THEN
    ALTER TABLE material_transfers
      ADD CONSTRAINT material_transfers_stock_posting_policy_check
      CHECK (stock_posting_policy IN ('on_receipt', 'on_dispatch'));
  END IF;
END $$;