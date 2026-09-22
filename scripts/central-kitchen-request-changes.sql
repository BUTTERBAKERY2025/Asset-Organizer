-- Apply before deploying request edit/cancel. No inventory or history is rewritten.
BEGIN;
ALTER TABLE central_kitchen_order_events ADD COLUMN IF NOT EXISTS change_snapshot jsonb;
ALTER TABLE central_kitchen_orders DROP CONSTRAINT IF EXISTS ck_central_kitchen_orders_status;
ALTER TABLE central_kitchen_orders ADD CONSTRAINT ck_central_kitchen_orders_status
  CHECK (status IN ('requested','approved','prepared','dispatched','received','cancelled'));
COMMIT;