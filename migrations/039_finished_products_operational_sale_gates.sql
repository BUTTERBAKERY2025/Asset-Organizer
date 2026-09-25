-- Additive catalogue gates. Apply on the confirmed target before deploying
-- code referencing these columns. No data is imported by this migration.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS operations_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_enabled boolean NOT NULL DEFAULT true;

-- Existing product activity remains unchanged. Unpriced imported goods must
-- be inserted with is_active='false', operations_enabled=true,
-- sale_enabled=false: even an older server cannot sell them.