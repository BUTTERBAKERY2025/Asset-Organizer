-- Apply manually to the confirmed target BEFORE deploying code; depends on
-- 033, 043 and advanced_production_explicit_execution.sql. No historical UPDATE.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;
CREATE TABLE IF NOT EXISTS production_recipe_mode_events (
  id serial PRIMARY KEY,
  kitchen_id varchar NOT NULL REFERENCES branches(id),
  enabled boolean NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 1000),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS production_recipe_mode_kitchen ON production_recipe_mode_events(kitchen_id,id DESC);
ALTER TABLE daily_production_batches ADD COLUMN IF NOT EXISTS recipe_mode_activation_id integer
  REFERENCES production_recipe_mode_events(id);
CREATE OR REPLACE FUNCTION guard_production_recipe_mode_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Recipe mode audit is append-only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.actor_id AND role IN ('admin','production_development_manager')) THEN
    RAISE EXCEPTION 'Recipe mode activation role forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id=NEW.kitchen_id AND is_central_kitchen=true) THEN
    RAISE EXCEPTION 'Recipe mode requires central kitchen';
  END IF;
  PERFORM pg_advisory_xact_lock(73049,hashtext(NEW.kitchen_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_production_recipe_mode_event ON production_recipe_mode_events;
CREATE TRIGGER guard_production_recipe_mode_event BEFORE INSERT OR UPDATE OR DELETE ON production_recipe_mode_events
  FOR EACH ROW EXECUTE FUNCTION guard_production_recipe_mode_event();

CREATE OR REPLACE FUNCTION stamp_production_recipe_mode() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE activation production_recipe_mode_events%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.recipe_mode_activation_id IS DISTINCT FROM OLD.recipe_mode_activation_id THEN
      RAISE EXCEPTION 'Production recipe execution mode is immutable';
    END IF;
    IF OLD.recipe_mode_activation_id IS NOT NULL AND
      (NEW.recipe_backed IS DISTINCT FROM false OR
       (NEW.branch_id,NEW.product_id,NEW.quantity,NEW.unit,NEW.production_date)
       IS DISTINCT FROM (OLD.branch_id,OLD.product_id,OLD.quantity,OLD.unit,OLD.production_date)) THEN
      RAISE EXCEPTION 'Output-only production identity is immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.recipe_mode_activation_id IS NOT NULL THEN RAISE EXCEPTION 'Client cannot supply recipe mode proof'; END IF;
  PERFORM pg_advisory_xact_lock(73049,hashtext(NEW.branch_id));
  SELECT * INTO activation FROM production_recipe_mode_events WHERE kitchen_id=NEW.branch_id ORDER BY id DESC LIMIT 1;
  IF activation.enabled IS TRUE THEN
    NEW.recipe_mode_activation_id := activation.id;
    NEW.recipe_backed := false;
    NEW.recipe_exception_id := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aa_stamp_production_recipe_mode ON daily_production_batches;
CREATE TRIGGER aa_stamp_production_recipe_mode BEFORE INSERT OR UPDATE ON daily_production_batches
  FOR EACH ROW EXECUTE FUNCTION stamp_production_recipe_mode();

-- Preserve the original guards verbatim, adding only the new proven mode.
-- Abort rather than silently accepting an unexpected deployed function version.
DO $$
DECLARE definition text; anchor text;
BEGIN
  definition := pg_get_functiondef('enforce_linked_recipe_exception()'::regprocedure);
  anchor := 'IF NEW.recipe_backed IS TRUE OR';
  IF position('NEW.recipe_mode_activation_id' IN definition)=0 THEN
    IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected recipe exception guard version'; END IF;
    definition := replace(definition,anchor,
      'IF NEW.recipe_mode_activation_id IS NOT NULL AND NEW.recipe_backed IS FALSE THEN RETURN NEW; END IF; ' || anchor);
    EXECUTE definition;
  END IF;
  definition := pg_get_functiondef('require_advanced_execution_recipe_proof()'::regprocedure);
  anchor := 'IF batch.advanced_production_order_item_id IS NOT NULL AND (';
  IF position('batch.recipe_mode_activation_id' IN definition)=0 THEN
    IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected advanced recipe guard version'; END IF;
    definition := replace(definition,anchor,
      'IF batch.advanced_production_order_item_id IS NOT NULL AND batch.recipe_mode_activation_id IS NULL AND (');
    EXECUTE definition;
  END IF;
  definition := pg_get_functiondef('guard_advanced_execution_batch()'::regprocedure);
  anchor := 'NEW.recipe_backed IS DISTINCT FROM true AND NOT (';
  IF position('NEW.recipe_mode_activation_id' IN definition)=0 THEN
    IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected advanced batch guard version'; END IF;
    definition := replace(definition,anchor,
      'NEW.recipe_backed IS DISTINCT FROM true AND NEW.recipe_mode_activation_id IS NULL AND NOT (');
    EXECUTE definition;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION require_output_only_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch daily_production_batches%ROWTYPE;
BEGIN
  SELECT * INTO batch FROM daily_production_batches WHERE id=NEW.id;
  IF batch.recipe_mode_activation_id IS NOT NULL AND (
    batch.recipe_backed IS DISTINCT FROM false OR batch.recipe_exception_id IS NOT NULL OR
    NOT EXISTS(SELECT 1 FROM production_recipe_mode_events e WHERE e.id=batch.recipe_mode_activation_id
      AND e.enabled=true AND e.kitchen_id=batch.branch_id) OR
    EXISTS(SELECT 1 FROM central_kitchen_batch_recipe_snapshots s WHERE s.batch_id=batch.id) OR
    EXISTS(SELECT 1 FROM central_kitchen_batch_materials m WHERE m.batch_id=batch.id) OR
    EXISTS(SELECT 1 FROM central_kitchen_batch_material_movements m WHERE m.batch_id=batch.id)
  ) THEN RAISE EXCEPTION 'Output-only batch has conflicting recipe or raw movement proof'; END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS require_output_only_proof ON daily_production_batches;
CREATE CONSTRAINT TRIGGER require_output_only_proof AFTER INSERT OR UPDATE ON daily_production_batches
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_output_only_proof();
COMMIT;