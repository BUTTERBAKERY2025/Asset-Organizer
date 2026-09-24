-- Authoritative catalogue adoption is deliberately staged.  This migration
-- does not change a single product, warehouse item, price, balance, or history.
BEGIN;

CREATE TABLE IF NOT EXISTS catalogue_import_plans (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'applying', 'applied', 'failed')),
  target_id text NOT NULL,
  target_identity varchar(64) NOT NULL,
  source_checksum varchar(64) NOT NULL,
  snapshot_checksum varchar(64) NOT NULL,
  plan_checksum varchar(64) NOT NULL,
  review_acknowledgement text NOT NULL,
  requested_by varchar NOT NULL REFERENCES users(id),
  reviewed_by varchar NOT NULL REFERENCES users(id),
  backup_id integer REFERENCES backups(id),
  idempotency_actor_id varchar REFERENCES users(id),
  idempotency_key varchar(128),
  request_hash varchar(64),
  staged_payload jsonb NOT NULL,
  applied_summary jsonb,
  applied_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_import_plan_idempotency
    UNIQUE (idempotency_actor_id, idempotency_key)
);

ALTER TABLE catalogue_import_plans
  ADD COLUMN IF NOT EXISTS target_identity varchar(64);

CREATE INDEX IF NOT EXISTS idx_catalogue_import_plans_status_created
  ON catalogue_import_plans (status, created_at DESC);

-- A completed generic backup becomes eligible for catalogue application only
-- when the backup producer records this immutable, server-derived manifest.
-- It binds the captured products/warehouse snapshot to this exact database.
CREATE TABLE IF NOT EXISTS catalogue_backup_manifests (
  backup_id integer PRIMARY KEY REFERENCES backups(id) ON DELETE RESTRICT,
  target_identity varchar(64) NOT NULL,
  snapshot_checksum varchar(64) NOT NULL,
  manifest_checksum varchar(64) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Sections are usage contexts, not a replacement for the existing primary
-- category fields. Names are source labels and deliberately have no fuzzy
-- matching/alias table.
CREATE TABLE IF NOT EXISTS catalogue_usage_sections (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_usage_sections (
  product_id integer NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  usage_section_id integer NOT NULL REFERENCES catalogue_usage_sections(id) ON DELETE RESTRICT,
  source_plan_id uuid NOT NULL REFERENCES catalogue_import_plans(id) ON DELETE RESTRICT,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, usage_section_id)
);

CREATE TABLE IF NOT EXISTS warehouse_item_usage_sections (
  warehouse_item_id integer NOT NULL REFERENCES warehouse_items(id) ON DELETE RESTRICT,
  usage_section_id integer NOT NULL REFERENCES catalogue_usage_sections(id) ON DELETE RESTRICT,
  source_plan_id uuid NOT NULL REFERENCES catalogue_import_plans(id) ON DELETE RESTRICT,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_item_id, usage_section_id)
);

COMMIT;