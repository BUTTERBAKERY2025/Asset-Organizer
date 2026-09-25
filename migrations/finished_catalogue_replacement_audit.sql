-- Private audit snapshot for explicitly approved, fresh catalogue replacements.
CREATE TABLE IF NOT EXISTS catalogue_fresh_replacements (
  source_sha256 text PRIMARY KEY,
  target text NOT NULL,
  backup_sha256 text NOT NULL,
  previous_products jsonb NOT NULL,
  new_product_ids jsonb NOT NULL,
  source_rows jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE catalogue_fresh_replacements ENABLE ROW LEVEL SECURITY;