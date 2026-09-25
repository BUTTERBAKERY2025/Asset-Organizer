-- Private audit of manual warehouse catalogue replacement; no client RLS policies.
CREATE TABLE IF NOT EXISTS public.warehouse_fresh_replacements (
  source_sha256 text NOT NULL,
  target text NOT NULL,
  backup_sha256 text NOT NULL,
  previous_warehouse jsonb NOT NULL,
  new_warehouse_ids jsonb NOT NULL,
  source_rows jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_sha256, target)
);
ALTER TABLE public.warehouse_fresh_replacements ENABLE ROW LEVEL SECURITY;