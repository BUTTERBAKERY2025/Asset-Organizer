-- Additive migration only. Review/apply separately; no historical linkage or stock backfill.
BEGIN;
ALTER TABLE production_order_items ADD COLUMN IF NOT EXISTS execution_unit text;
ALTER TABLE daily_production_batches
  ADD COLUMN IF NOT EXISTS advanced_production_order_item_id integer REFERENCES production_order_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS advanced_idempotency_key varchar(128),
  ADD COLUMN IF NOT EXISTS advanced_payload_fingerprint varchar(64);
CREATE INDEX IF NOT EXISTS idx_daily_production_advanced_item ON daily_production_batches(advanced_production_order_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_production_advanced_creator_key
  ON daily_production_batches(recorded_by, advanced_idempotency_key)
  WHERE advanced_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION guard_advanced_execution_batch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  plan advanced_production_orders%ROWTYPE;
  item production_order_items%ROWTYPE;
  used bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.advanced_production_order_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'Linked production batches cannot be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.advanced_production_order_item_id IS NOT NULL THEN
    IF NEW.advanced_production_order_item_id IS DISTINCT FROM OLD.advanced_production_order_item_id
      OR NEW.production_order_id IS DISTINCT FROM OLD.production_order_id
      OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.unit IS DISTINCT FROM OLD.unit OR NEW.quantity IS DISTINCT FROM OLD.quantity
      OR NEW.production_date IS DISTINCT FROM OLD.production_date
      OR NEW.advanced_idempotency_key IS DISTINCT FROM OLD.advanced_idempotency_key
      OR NEW.advanced_payload_fingerprint IS DISTINCT FROM OLD.advanced_payload_fingerprint
      OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
      OR NEW.central_kitchen_order_item_id IS DISTINCT FROM OLD.central_kitchen_order_item_id
      OR NEW.source_batch_id IS DISTINCT FROM OLD.source_batch_id THEN
      RAISE EXCEPTION 'Linked batch identity is immutable' USING ERRCODE = '23514';
    END IF;
    -- The existing snapshot service inserts immutable snapshot + ingredients,
    -- then promotes false -> true inside this same transaction. No other flag
    -- change (including true -> false) is allowed.
    IF NEW.recipe_backed IS DISTINCT FROM OLD.recipe_backed AND (
      OLD.recipe_backed IS DISTINCT FROM false OR NEW.recipe_backed IS DISTINCT FROM true
      OR OLD.status <> 'in_progress' OR NEW.status <> 'in_progress'
      OR current_setting('app.central_kitchen_snapshot_write', true) IS DISTINCT FROM 'on'
      OR NOT EXISTS (
        SELECT 1 FROM central_kitchen_batch_recipe_snapshots s
        WHERE s.batch_id = NEW.id AND s.kitchen_id = NEW.branch_id
          AND s.product_id = NEW.product_id AND s.recipe_output_unit = NEW.unit
          AND s.batch_output_quantity = NEW.quantity
          AND s.ingredient_count > 0 AND length(s.ingredient_checksum) = 64
          AND s.ingredient_count = (SELECT count(*) FROM central_kitchen_batch_materials m WHERE m.batch_id = NEW.id)
      )
    ) THEN
      RAISE EXCEPTION 'Advanced recipe flag requires complete immutable snapshot proof' USING ERRCODE = '23514';
    END IF;
    IF OLD.status IN ('finished', 'cancelled') AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Terminal linked batch is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.advanced_production_order_item_id IS NULL THEN
    IF NEW.advanced_idempotency_key IS NOT NULL OR NEW.advanced_payload_fingerprint IS NOT NULL THEN
      RAISE EXCEPTION 'Advanced metadata requires an explicit item' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF current_setting('app.advanced_execution_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use the dedicated advanced execution operation' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.advanced_production_order_item_id IS NULL THEN
    RAISE EXCEPTION 'Historical batches cannot be linked retrospectively' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO plan FROM advanced_production_orders
    WHERE id = (SELECT order_id FROM production_order_items WHERE id = NEW.advanced_production_order_item_id) FOR UPDATE;
  SELECT * INTO item FROM production_order_items WHERE id = NEW.advanced_production_order_item_id FOR UPDATE;
  IF item.id IS NULL OR plan.id IS NULL OR plan.status NOT IN ('approved', 'in_progress') OR item.status = 'cancelled'
    OR NEW.branch_id IS DISTINCT FROM plan.source_branch_id OR NEW.product_id IS DISTINCT FROM item.product_id
    OR NEW.production_order_id IS DISTINCT FROM plan.id OR NEW.unit IS DISTINCT FROM item.execution_unit
    OR NEW.quantity <= 0
    OR (NEW.recipe_backed IS DISTINCT FROM true AND NOT (
      TG_OP = 'INSERT' AND NEW.recipe_backed IS FALSE AND NEW.status = 'in_progress'
    ))
    OR NEW.central_kitchen_order_item_id IS NOT NULL OR NEW.source_batch_id IS NOT NULL
    OR NEW.advanced_idempotency_key IS NULL OR NEW.advanced_payload_fingerprint IS NULL OR NEW.recorded_by IS NULL
    OR NEW.production_date IS NULL OR NEW.production_date < plan.start_date OR NEW.production_date > plan.end_date
    OR NEW.status IS NULL OR NEW.status NOT IN ('in_progress', 'finished', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid advanced execution identity or state' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Linked batches must start in progress' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO used FROM daily_production_batches
    WHERE advanced_production_order_item_id = item.id AND id <> NEW.id AND status IN ('in_progress', 'finished');
  IF used + (CASE WHEN NEW.status IN ('in_progress', 'finished') THEN NEW.quantity ELSE 0 END) > item.target_quantity THEN
    RAISE EXCEPTION 'Linked batches exceed planned quantity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_advanced_execution_batch ON daily_production_batches;
CREATE TRIGGER guard_advanced_execution_batch BEFORE INSERT OR UPDATE OR DELETE ON daily_production_batches
FOR EACH ROW EXECUTE FUNCTION guard_advanced_execution_batch();

-- Inspect CURRENT stored state, not the transient NEW tuple captured by the
-- insert event. Failure at COMMIT rolls back the batch, execution-unit freeze,
-- recipe snapshot, materials, and idempotency metadata together.
CREATE OR REPLACE FUNCTION require_advanced_execution_recipe_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  batch daily_production_batches%ROWTYPE;
BEGIN
  SELECT * INTO batch FROM daily_production_batches WHERE id = NEW.id;
  IF batch.advanced_production_order_item_id IS NOT NULL AND (
    batch.recipe_backed IS DISTINCT FROM true OR NOT EXISTS (
      SELECT 1 FROM central_kitchen_batch_recipe_snapshots s
      WHERE s.batch_id = batch.id AND s.kitchen_id = batch.branch_id
        AND s.product_id = batch.product_id AND s.recipe_output_unit = batch.unit
        AND s.batch_output_quantity = batch.quantity
        AND s.ingredient_count > 0 AND length(s.ingredient_checksum) = 64
        AND s.ingredient_count = (SELECT count(*) FROM central_kitchen_batch_materials m WHERE m.batch_id = batch.id)
    )
  ) THEN
    RAISE EXCEPTION 'Advanced linked batches cannot commit without recipe snapshot proof' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS require_advanced_execution_recipe_proof ON daily_production_batches;
CREATE CONSTRAINT TRIGGER require_advanced_execution_recipe_proof
AFTER INSERT OR UPDATE ON daily_production_batches
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_advanced_execution_recipe_proof();

CREATE OR REPLACE FUNCTION guard_advanced_execution_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM id FROM advanced_production_orders WHERE id = NEW.order_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM production_order_items i JOIN daily_production_batches b
      ON b.advanced_production_order_item_id = i.id WHERE i.order_id = NEW.order_id) THEN
      RAISE EXCEPTION 'Cannot add items to an executed plan' USING ERRCODE = '23514';
    END IF;
    IF NEW.execution_unit IS NOT NULL THEN
      RAISE EXCEPTION 'Execution unit is assigned only by explicit execution' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  -- Lock order even when there are currently no linked batches, serializing first execution.
  PERFORM id FROM advanced_production_orders WHERE id = OLD.order_id FOR UPDATE;
  IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Plan item ownership cannot be reassigned' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.execution_unit IS DISTINCT FROM OLD.execution_unit
    AND current_setting('app.advanced_execution_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Execution unit is not an editable planning field' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM daily_production_batches WHERE advanced_production_order_item_id = OLD.id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Linked plan items cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Linked plan items cannot be edited; execution totals are derived from batches' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_advanced_execution_item ON production_order_items;
CREATE TRIGGER guard_advanced_execution_item BEFORE INSERT OR UPDATE OR DELETE ON production_order_items
FOR EACH ROW EXECUTE FUNCTION guard_advanced_execution_item();

CREATE OR REPLACE FUNCTION guard_advanced_execution_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM production_order_items i JOIN daily_production_batches b
    ON b.advanced_production_order_item_id = i.id WHERE i.order_id = OLD.id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Executed plans cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF NEW.source_branch_id IS DISTINCT FROM OLD.source_branch_id
      OR NEW.target_branch_id IS DISTINCT FROM OLD.target_branch_id
      OR NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date
      OR NEW.status NOT IN ('approved', 'in_progress', 'completed') THEN
      RAISE EXCEPTION 'Executed plan identity and active state are protected' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'completed' AND EXISTS (
      SELECT 1 FROM production_order_items i WHERE i.order_id = OLD.id AND i.status <> 'cancelled'
      AND (i.execution_unit IS NULL OR i.target_quantity <> (
        SELECT COALESCE(SUM(b.quantity), 0) FROM daily_production_batches b
        WHERE b.advanced_production_order_item_id = i.id AND b.status = 'finished'
      ))
    ) THEN
      RAISE EXCEPTION 'Plan completion requires explicit completed output for every active item' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'Completed executed plans cannot reopen' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_advanced_execution_plan ON advanced_production_orders;
CREATE TRIGGER guard_advanced_execution_plan BEFORE UPDATE OR DELETE ON advanced_production_orders
FOR EACH ROW EXECUTE FUNCTION guard_advanced_execution_plan();
COMMIT;