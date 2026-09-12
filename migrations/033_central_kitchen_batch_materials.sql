BEGIN;

-- Recipe-backed material posting is prospective only.  A NULL flag means a
-- historical/non-recipe batch and is never inferred or backfilled.
ALTER TABLE daily_production_batches
  ADD COLUMN IF NOT EXISTS recipe_backed BOOLEAN;

CREATE TABLE IF NOT EXISTS central_kitchen_batch_recipe_snapshots (
  batch_id INTEGER PRIMARY KEY
    REFERENCES daily_production_batches(id) ON DELETE CASCADE,
  kitchen_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  source_recipe_id INTEGER NOT NULL
    REFERENCES central_kitchen_recipes(id) ON DELETE RESTRICT,
  source_recipe_version INTEGER NOT NULL CHECK (source_recipe_version > 0),
  recipe_source TEXT NOT NULL DEFAULT 'approved_recipe'
    CHECK (recipe_source = 'approved_recipe'),
  recipe_output_quantity NUMERIC(18, 6) NOT NULL CHECK (recipe_output_quantity > 0),
  recipe_output_unit TEXT NOT NULL,
  batch_output_quantity NUMERIC(18, 6) NOT NULL CHECK (batch_output_quantity > 0),
  ingredient_count INTEGER NOT NULL CHECK (ingredient_count > 0),
  ingredient_checksum VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ck_batch_recipe_snapshots_recipe
  ON central_kitchen_batch_recipe_snapshots(source_recipe_id);

CREATE TABLE IF NOT EXISTS central_kitchen_batch_materials (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL
    REFERENCES daily_production_batches(id) ON DELETE CASCADE,
  warehouse_item_id INTEGER NOT NULL
    REFERENCES warehouse_items(id) ON DELETE RESTRICT,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  recipe_quantity NUMERIC(18, 6) NOT NULL CHECK (recipe_quantity > 0),
  required_quantity NUMERIC(18, 6) NOT NULL CHECK (required_quantity > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_ck_batch_materials_batch_item UNIQUE (batch_id, warehouse_item_id)
);
CREATE INDEX IF NOT EXISTS idx_ck_batch_materials_batch
  ON central_kitchen_batch_materials(batch_id);

CREATE TABLE IF NOT EXISTS central_kitchen_batch_material_movements (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL
    REFERENCES daily_production_batches(id) ON DELETE RESTRICT,
  warehouse_item_id INTEGER NOT NULL
    REFERENCES warehouse_items(id) ON DELETE RESTRICT,
  branch_stock_id INTEGER NOT NULL
    REFERENCES branch_stock(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL DEFAULT 'production_material_debit'
    CHECK (movement_type = 'production_material_debit'),
  quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  actor_id VARCHAR REFERENCES users(id) ON DELETE RESTRICT,
  actor_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_ck_batch_material_movement UNIQUE (batch_id, warehouse_item_id)
);
CREATE INDEX IF NOT EXISTS idx_ck_batch_material_movements_batch
  ON central_kitchen_batch_material_movements(batch_id);

-- The public generic batch endpoints must not be able to opt a batch into
-- material posting. The only legal transition is after this migration's
-- immutable snapshot has been inserted in the linked-batch transaction.
CREATE OR REPLACE FUNCTION enforce_central_kitchen_recipe_backed_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.recipe_backed IS TRUE AND NOT EXISTS (
    SELECT 1 FROM central_kitchen_batch_recipe_snapshots s WHERE s.batch_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'recipe-backed production batch requires an immutable recipe snapshot';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.recipe_backed IS TRUE
    AND NEW.recipe_backed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'recipe-backed production batch flag is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ck_recipe_backed_snapshot_required
  ON daily_production_batches;
CREATE TRIGGER trg_ck_recipe_backed_snapshot_required
BEFORE INSERT OR UPDATE OF recipe_backed ON daily_production_batches
FOR EACH ROW EXECUTE FUNCTION enforce_central_kitchen_recipe_backed_snapshot();

-- Snapshots are write-once while their unconsumed parent batch may still be
-- cancelled/deleted.  Cascading parent deletion remains intentionally legal.
CREATE OR REPLACE FUNCTION prevent_central_kitchen_batch_material_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT'
    AND current_setting('app.central_kitchen_snapshot_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- The FK cascade that removes an uncompleted/cancelled parent batch is
  -- nested. Direct changes or removal of the frozen set are prohibited.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'central kitchen batch material snapshots are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_ck_batch_recipe_snapshot_immutable
  ON central_kitchen_batch_recipe_snapshots;
CREATE TRIGGER trg_ck_batch_recipe_snapshot_immutable
BEFORE INSERT OR UPDATE OR DELETE ON central_kitchen_batch_recipe_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_batch_material_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_ck_batch_material_immutable
  ON central_kitchen_batch_materials;
CREATE TRIGGER trg_ck_batch_material_immutable
BEFORE INSERT OR UPDATE OR DELETE ON central_kitchen_batch_materials
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_batch_material_snapshot_mutation();

CREATE OR REPLACE FUNCTION prevent_central_kitchen_batch_material_movement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT'
    AND current_setting('app.central_kitchen_material_consume', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'central kitchen batch material movements are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_ck_batch_material_movement_immutable
  ON central_kitchen_batch_material_movements;
CREATE TRIGGER trg_ck_batch_material_movement_immutable
BEFORE INSERT OR UPDATE OR DELETE ON central_kitchen_batch_material_movements
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_batch_material_movement_mutation();

COMMIT;