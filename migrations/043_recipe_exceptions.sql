-- Prospective boundary: no historical batch is changed or retroactively denied.
CREATE TABLE IF NOT EXISTS central_kitchen_recipe_exceptions (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  kitchen_id varchar NOT NULL REFERENCES branches(id),
  product_id integer NOT NULL REFERENCES products(id),
  unit text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  production_date text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  requested_by varchar NOT NULL REFERENCES users(id),
  requested_at timestamp NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','consumed')),
  reviewed_by varchar REFERENCES users(id),
  reviewed_at timestamp,
  review_reason text,
  consumed_batch_id integer UNIQUE,
  consumed_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_recipe_exceptions_order ON central_kitchen_recipe_exceptions(order_id);
ALTER TABLE daily_production_batches ADD COLUMN IF NOT EXISTS recipe_exception_id integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_daily_production_recipe_exception'
    AND conrelid = 'daily_production_batches'::regclass) THEN
    ALTER TABLE daily_production_batches ADD CONSTRAINT fk_daily_production_recipe_exception
      FOREIGN KEY (recipe_exception_id) REFERENCES central_kitchen_recipe_exceptions(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_production_recipe_exception ON daily_production_batches(recipe_exception_id) WHERE recipe_exception_id IS NOT NULL;
CREATE OR REPLACE FUNCTION enforce_linked_recipe_exception() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ex central_kitchen_recipe_exceptions%ROWTYPE;
DECLARE ord central_kitchen_orders%ROWTYPE;
DECLARE item central_kitchen_order_items%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.recipe_exception_id IS DISTINCT FROM NEW.recipe_exception_id OR
       OLD.central_kitchen_order_item_id IS DISTINCT FROM NEW.central_kitchen_order_item_id OR
       (OLD.central_kitchen_order_item_id IS NOT NULL AND
        (OLD.quantity, OLD.unit, OLD.production_date, OLD.product_id, OLD.branch_id)
        IS DISTINCT FROM
        (NEW.quantity, NEW.unit, NEW.production_date, NEW.product_id, NEW.branch_id)) OR
       (OLD.central_kitchen_order_item_id IS NOT NULL AND
        OLD.recipe_backed IS DISTINCT FROM NEW.recipe_backed AND
        NOT (OLD.recipe_exception_id IS NULL AND OLD.recipe_backed IS NULL
          AND NEW.recipe_backed IS TRUE AND EXISTS (
            SELECT 1 FROM central_kitchen_batch_recipe_snapshots WHERE batch_id = NEW.id
          ))) THEN
      RAISE EXCEPTION 'Linked batch approval identity is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.recipe_exception_id IS NOT NULL AND NEW.central_kitchen_order_item_id IS NULL THEN
    RAISE EXCEPTION 'Exception is reserved for linked orders' USING ERRCODE = '23514';
  END IF;
  IF NEW.central_kitchen_order_item_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.destination IS DISTINCT FROM 'central_kitchen_order' OR NEW.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'New linked batch must start in central kitchen production' USING ERRCODE = '23514';
  END IF;
  IF NEW.recipe_backed IS TRUE OR
     (NEW.recipe_backed IS NULL AND
      current_setting('app.central_kitchen_snapshot_write', true) = 'on') THEN
    IF NEW.recipe_exception_id IS NOT NULL THEN
      RAISE EXCEPTION 'Recipe batch cannot use exception' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.recipe_backed IS DISTINCT FROM FALSE OR NEW.recipe_exception_id IS NULL THEN
    RAISE EXCEPTION 'Linked nonrecipe batch requires approved exception' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO ex FROM central_kitchen_recipe_exceptions WHERE id = NEW.recipe_exception_id FOR UPDATE;
  SELECT * INTO item FROM central_kitchen_order_items WHERE id = NEW.central_kitchen_order_item_id;
  SELECT * INTO ord FROM central_kitchen_orders WHERE id = item.order_id;
  IF ex.status IS DISTINCT FROM 'approved' OR ex.reviewed_by IS NULL OR ex.reviewed_at IS NULL OR
     ord.status IS DISTINCT FROM 'approved' OR ord.inventory_mode IS DISTINCT FROM 'real' OR
     ex.item_id IS DISTINCT FROM item.id OR ex.order_id IS DISTINCT FROM ord.id OR
     ex.kitchen_id IS DISTINCT FROM ord.central_kitchen_id OR
     ex.product_id IS DISTINCT FROM item.product_id OR ex.product_id IS DISTINCT FROM NEW.product_id OR
     ex.unit IS DISTINCT FROM item.unit OR ex.unit IS DISTINCT FROM NEW.unit OR
     ex.quantity IS DISTINCT FROM NEW.quantity OR ex.production_date IS DISTINCT FROM NEW.production_date OR
     NEW.branch_id IS DISTINCT FROM ex.kitchen_id THEN
    RAISE EXCEPTION 'Exception identity or approval invalid' USING ERRCODE = '23514';
  END IF;
  UPDATE central_kitchen_recipe_exceptions SET status = 'consumed',
    consumed_batch_id = NEW.id, consumed_at = now() WHERE id = ex.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_linked_recipe_exception ON daily_production_batches;
CREATE TRIGGER trg_linked_recipe_exception BEFORE INSERT OR UPDATE ON daily_production_batches
FOR EACH ROW EXECUTE FUNCTION enforce_linked_recipe_exception();