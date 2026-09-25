-- Null policy preserves all historical completed rows and their balances.
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS transport_policy text;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS production_date text;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS received_quantity integer;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS received_by varchar REFERENCES users(id);
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS received_at timestamp;
ALTER TABLE finished_goods_transfers ADD COLUMN IF NOT EXISTS dispatched_at timestamp;