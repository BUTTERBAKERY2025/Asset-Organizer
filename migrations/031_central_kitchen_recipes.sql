BEGIN;

-- Recipe definitions are configuration only.  This migration intentionally
-- does not backfill, consume, reserve, or otherwise change stock.
CREATE TABLE IF NOT EXISTS central_kitchen_recipes (
  id SERIAL PRIMARY KEY,
  kitchen_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  output_quantity NUMERIC(18, 6) NOT NULL,
  output_unit TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  update_token VARCHAR(128) NOT NULL DEFAULT gen_random_uuid()::text,
  supersedes_recipe_id INTEGER REFERENCES central_kitchen_recipes(id) ON DELETE RESTRICT,
  superseded_by_recipe_id INTEGER REFERENCES central_kitchen_recipes(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(128),
  payload_fingerprint VARCHAR(64),
  created_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  approved_by VARCHAR REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMP,
  superseded_at TIMESTAMP,
  CONSTRAINT ck_central_kitchen_recipes_status
    CHECK (status IN ('draft', 'approved', 'superseded')),
  CONSTRAINT ck_central_kitchen_recipes_output_quantity
    CHECK (output_quantity > 0),
  CONSTRAINT ck_central_kitchen_recipes_version
    CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_central_kitchen_recipes_current_draft
  ON central_kitchen_recipes(kitchen_id, product_id)
  WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS uq_central_kitchen_recipes_current_approved
  ON central_kitchen_recipes(kitchen_id, product_id)
  WHERE status = 'approved';
CREATE UNIQUE INDEX IF NOT EXISTS uq_central_kitchen_recipes_creator_idempotency
  ON central_kitchen_recipes(created_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_central_kitchen_recipes_kitchen_product
  ON central_kitchen_recipes(kitchen_id, product_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_recipes_status
  ON central_kitchen_recipes(status);

CREATE TABLE IF NOT EXISTS central_kitchen_recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES central_kitchen_recipes(id) ON DELETE CASCADE,
  warehouse_item_id INTEGER NOT NULL REFERENCES warehouse_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 6) NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_recipe_ingredients_item
    UNIQUE (recipe_id, warehouse_item_id),
  CONSTRAINT ck_central_kitchen_recipe_ingredients_quantity
    CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_recipe_ingredients_recipe
  ON central_kitchen_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_recipe_ingredients_item
  ON central_kitchen_recipe_ingredients(warehouse_item_id);

CREATE TABLE IF NOT EXISTS central_kitchen_recipe_operations (
  id SERIAL PRIMARY KEY,
  actor_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  recipe_id INTEGER NOT NULL,
  kitchen_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  snapshot_json JSONB NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ck_central_kitchen_recipe_operations_action
    CHECK (action IN ('create', 'update', 'approve', 'revise', 'delete')),
  CONSTRAINT uq_central_kitchen_recipe_operations_actor_key
    UNIQUE (actor_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_recipe_operations_recipe
  ON central_kitchen_recipe_operations(recipe_id);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_recipe_operation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen recipe operations are append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_central_kitchen_recipe_operation_append_only
  ON central_kitchen_recipe_operations;
CREATE TRIGGER trg_central_kitchen_recipe_operation_append_only
BEFORE UPDATE OR DELETE ON central_kitchen_recipe_operations
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_recipe_operation_mutation();

CREATE OR REPLACE FUNCTION prevent_central_kitchen_recipe_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('approved', 'superseded') THEN
    RAISE EXCEPTION 'approved central kitchen recipes are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF OLD.status = 'superseded' THEN
    RAISE EXCEPTION 'superseded central kitchen recipes are immutable';
  END IF;

  -- The only legal mutation of an approved row is the atomic lifecycle change
  -- that records which newly-approved revision superseded it.  Recipe content,
  -- identity, approval audit, idempotency, and optimistic token remain fixed.
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    IF NEW.status <> 'superseded'
      OR NEW.kitchen_id IS DISTINCT FROM OLD.kitchen_id
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.output_quantity IS DISTINCT FROM OLD.output_quantity
      OR NEW.output_unit IS DISTINCT FROM OLD.output_unit
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.update_token IS DISTINCT FROM OLD.update_token
      OR NEW.supersedes_recipe_id IS DISTINCT FROM OLD.supersedes_recipe_id
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.payload_fingerprint IS DISTINCT FROM OLD.payload_fingerprint
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.superseded_by_recipe_id IS NULL
      OR NEW.superseded_at IS NULL
    THEN
      RAISE EXCEPTION 'approved central kitchen recipes are immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_central_kitchen_recipe_immutable
  ON central_kitchen_recipes;
CREATE TRIGGER trg_central_kitchen_recipe_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_recipes
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_recipe_mutation();

CREATE OR REPLACE FUNCTION prevent_central_kitchen_recipe_ingredient_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_recipe_status TEXT;
  new_recipe_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO new_recipe_status
    FROM central_kitchen_recipes
    WHERE id = NEW.recipe_id
    FOR UPDATE;
    IF new_recipe_status IN ('approved', 'superseded') THEN
      RAISE EXCEPTION 'ingredients of approved central kitchen recipes are immutable';
    END IF;
    RETURN NEW;
  END IF;

  SELECT status INTO old_recipe_status
  FROM central_kitchen_recipes
  WHERE id = OLD.recipe_id
  FOR UPDATE;
  IF old_recipe_status IN ('approved', 'superseded') THEN
    RAISE EXCEPTION 'ingredients of approved central kitchen recipes are immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.recipe_id IS DISTINCT FROM OLD.recipe_id THEN
    SELECT status INTO new_recipe_status
    FROM central_kitchen_recipes
    WHERE id = NEW.recipe_id
    FOR UPDATE;
    IF new_recipe_status IN ('approved', 'superseded') THEN
      RAISE EXCEPTION 'ingredients of approved central kitchen recipes are immutable';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_central_kitchen_recipe_ingredient_immutable
  ON central_kitchen_recipe_ingredients;
CREATE TRIGGER trg_central_kitchen_recipe_ingredient_immutable
BEFORE INSERT OR UPDATE OR DELETE ON central_kitchen_recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_recipe_ingredient_mutation();

COMMIT;