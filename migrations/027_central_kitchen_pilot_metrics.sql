-- Bounded pilot-metrics lookup indexes. No data mutation.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_request_created
  ON central_kitchen_orders(request_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_kitchen_created
  ON central_kitchen_orders(central_kitchen_id, created_at DESC);
COMMIT;-- Bounded pilot-metrics lookup indexes. No data mutation.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_request_created
  ON central_kitchen_orders(request_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_orders_kitchen_created
  ON central_kitchen_orders(central_kitchen_id, created_at DESC);
COMMIT;