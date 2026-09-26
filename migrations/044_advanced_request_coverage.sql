-- Prospective full-item coverage only. Apply manually in production after review.
BEGIN;
ALTER TABLE daily_production_batches
  ADD COLUMN IF NOT EXISTS advanced_request_item_id integer
    REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS advanced_production_request_links (
  plan_item_id integer PRIMARY KEY REFERENCES production_order_items(id) ON DELETE RESTRICT,
  request_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  created_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advanced_request_links_request ON advanced_production_request_links(request_item_id);

-- Lock the demand row before measuring either kind of coverage. This serializes
-- link creation, direct batch creation and any change of request identity/quantity.
CREATE OR REPLACE FUNCTION check_advanced_request_coverage(p_request_item integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  demand central_kitchen_order_items%ROWTYPE;
  request central_kitchen_orders%ROWTYPE;
  committed numeric;
BEGIN
  SELECT * INTO demand FROM central_kitchen_order_items WHERE id = p_request_item FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request item missing' USING ERRCODE = '23514'; END IF;
  SELECT * INTO request FROM central_kitchen_orders WHERE id = demand.order_id;
  IF request.status NOT IN ('approved','prepared','dispatched','received') OR request.inventory_mode IS DISTINCT FROM 'real'
    OR demand.product_id IS NULL OR demand.warehouse_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request not eligible for linked production' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM advanced_production_request_links l
    JOIN production_order_items i ON i.id = l.plan_item_id
    JOIN advanced_production_orders p ON p.id = i.order_id
    WHERE l.request_item_id = demand.id AND (
      p.source_branch_id IS DISTINCT FROM request.central_kitchen_id
      OR p.target_branch_id IS DISTINCT FROM request.request_branch_id
      OR p.status NOT IN ('approved','in_progress','completed')
      OR i.status IS NULL OR i.status = 'cancelled' OR p.start_date > p.end_date
      OR request.needed_date IS NULL OR p.end_date > request.needed_date::text
      OR i.product_id IS DISTINCT FROM demand.product_id
      OR (SELECT unit FROM products WHERE id = i.product_id) IS DISTINCT FROM demand.unit
      OR (SELECT product_type FROM products WHERE id = i.product_id) IS DISTINCT FROM 'finish'
      OR NOT EXISTS (SELECT 1 FROM products product WHERE product.id = i.product_id
        AND (product.operations_enabled IS TRUE OR
          lower(btrim(COALESCE(product.is_active, 'true'))) NOT IN ('false','inactive','0','f','no')))
      OR i.execution_unit IS DISTINCT FROM NULL AND i.execution_unit IS DISTINCT FROM demand.unit
      OR i.target_quantity IS NULL OR i.target_quantity <= 0
      OR demand.requested_quantity <= 0 OR demand.requested_quantity <> trunc(demand.requested_quantity)
      OR (i.scheduled_date IS NOT NULL AND i.scheduled_date > request.needed_date::text)
    )
  ) THEN RAISE EXCEPTION 'Plan and request identity, state or date mismatch' USING ERRCODE = '23514'; END IF;
  SELECT COALESCE((SELECT sum(i.target_quantity) FROM advanced_production_request_links l
    JOIN production_order_items i ON i.id = l.plan_item_id WHERE l.request_item_id = demand.id), 0)
    + COALESCE((SELECT sum(b.quantity) FROM daily_production_batches b
      WHERE b.central_kitchen_order_item_id = demand.id AND b.status IN ('in_progress','finished')), 0)
  INTO committed;
  IF committed > demand.requested_quantity THEN
    RAISE EXCEPTION 'Linked and direct production exceed request quantity' USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION guard_advanced_request_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  plan_item production_order_items%ROWTYPE;
  plan_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Unlink then create a new link' USING ERRCODE = '23514'; END IF;
  SELECT * INTO plan_item FROM production_order_items WHERE id = COALESCE(NEW.plan_item_id, OLD.plan_item_id);
  SELECT status INTO plan_status FROM advanced_production_orders WHERE id = plan_item.order_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM daily_production_batches WHERE advanced_production_order_item_id = plan_item.id
    AND (TG_OP = 'INSERT' OR status IN ('in_progress','finished'))) THEN
    RAISE EXCEPTION 'Executed or active plan item link is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF plan_status NOT IN ('approved','in_progress') OR
    NOT EXISTS (SELECT 1 FROM central_kitchen_order_items i JOIN central_kitchen_orders o ON o.id = i.order_id
      WHERE i.id = NEW.request_item_id AND o.status = 'approved' AND i.prepared_quantity IS NULL
        AND i.substitute_quantity IS NULL AND i.substitute_product_id IS NULL
        AND i.substitute_warehouse_item_id IS NULL) THEN
    RAISE EXCEPTION 'Only active approved plans can link requests' USING ERRCODE = '23514';
  END IF;
  -- The demand row is locked by the check, protecting simultaneous direct writes.
  PERFORM check_advanced_request_coverage(NEW.request_item_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_advanced_request_link ON advanced_production_request_links;
CREATE TRIGGER guard_advanced_request_link AFTER INSERT OR UPDATE OR DELETE ON advanced_production_request_links
FOR EACH ROW EXECUTE FUNCTION guard_advanced_request_link();

CREATE OR REPLACE FUNCTION guard_advanced_batch_request_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.advanced_request_item_id IS DISTINCT FROM OLD.advanced_request_item_id THEN
    RAISE EXCEPTION 'Batch request provenance is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.advanced_production_order_item_id IS NULL AND NEW.advanced_request_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'Independent batch cannot claim request provenance' USING ERRCODE = '23514';
    END IF;
    IF NEW.advanced_production_order_item_id IS NOT NULL THEN
      SELECT request_item_id INTO expected FROM advanced_production_request_links
      WHERE plan_item_id = NEW.advanced_production_order_item_id;
      IF NEW.advanced_request_item_id IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'Advanced batch request provenance does not match explicit plan link' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_advanced_batch_request_provenance ON daily_production_batches;
CREATE TRIGGER guard_advanced_batch_request_provenance BEFORE INSERT OR UPDATE ON daily_production_batches
FOR EACH ROW EXECUTE FUNCTION guard_advanced_batch_request_provenance();

CREATE OR REPLACE FUNCTION guard_request_direct_coverage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.central_kitchen_order_item_id IS NOT NULL AND NEW.status IN ('in_progress','finished')
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR
      OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.central_kitchen_order_item_id IS DISTINCT FROM NEW.central_kitchen_order_item_id)
  THEN
    -- Do not test EXISTS before acquiring the demand lock: an uncommitted
    -- competing link would be invisible, allowing the direct insert to escape.
    PERFORM id FROM central_kitchen_order_items WHERE id = NEW.central_kitchen_order_item_id FOR NO KEY UPDATE;
    IF EXISTS (SELECT 1 FROM advanced_production_request_links
      WHERE request_item_id = NEW.central_kitchen_order_item_id) THEN
      PERFORM check_advanced_request_coverage(NEW.central_kitchen_order_item_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_request_direct_coverage ON daily_production_batches;
CREATE TRIGGER guard_request_direct_coverage AFTER INSERT OR UPDATE ON daily_production_batches
FOR EACH ROW EXECUTE FUNCTION guard_request_direct_coverage();

CREATE OR REPLACE FUNCTION guard_request_linked_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM advanced_production_request_links WHERE request_item_id = OLD.id) THEN
      RAISE EXCEPTION 'Linked request cannot be removed' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM advanced_production_request_links WHERE request_item_id = NEW.id) THEN
    IF TG_OP = 'UPDATE' AND (NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.unit IS DISTINCT FROM OLD.unit
      OR NEW.requested_quantity IS DISTINCT FROM OLD.requested_quantity) THEN
      RAISE EXCEPTION 'Linked request identity and quantity are immutable' USING ERRCODE = '23514';
    END IF;
    PERFORM check_advanced_request_coverage(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_request_linked_identity ON central_kitchen_order_items;
CREATE TRIGGER guard_request_linked_identity AFTER UPDATE OR DELETE ON central_kitchen_order_items
FOR EACH ROW EXECUTE FUNCTION guard_request_linked_identity();

CREATE OR REPLACE FUNCTION guard_linked_request_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM central_kitchen_order_items i JOIN advanced_production_request_links l
    ON l.request_item_id = i.id WHERE i.order_id = OLD.id)
    AND (TG_OP = 'DELETE' OR NEW.central_kitchen_id IS DISTINCT FROM OLD.central_kitchen_id
      OR NEW.request_branch_id IS DISTINCT FROM OLD.request_branch_id
      OR NEW.needed_date IS DISTINCT FROM OLD.needed_date OR NEW.inventory_mode IS DISTINCT FROM OLD.inventory_mode
      OR NEW.status NOT IN ('approved','prepared','dispatched','received')) THEN
    RAISE EXCEPTION 'Linked request order identity cannot be cancelled or changed' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_linked_request_order ON central_kitchen_orders;
CREATE TRIGGER guard_linked_request_order BEFORE UPDATE OR DELETE ON central_kitchen_orders
FOR EACH ROW EXECUTE FUNCTION guard_linked_request_order();

CREATE OR REPLACE FUNCTION guard_linked_plan_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request_unit text;
BEGIN
  IF EXISTS (SELECT 1 FROM advanced_production_request_links WHERE plan_item_id = OLD.id) THEN
    IF TG_OP = 'UPDATE' AND NEW.execution_unit IS DISTINCT FROM OLD.execution_unit THEN
      SELECT ri.unit INTO request_unit FROM advanced_production_request_links l
        JOIN central_kitchen_order_items ri ON ri.id = l.request_item_id WHERE l.plan_item_id = OLD.id;
      IF OLD.execution_unit IS NOT NULL OR NEW.execution_unit IS DISTINCT FROM request_unit
        OR current_setting('app.advanced_execution_write', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Linked execution unit can only be frozen once to request unit by execution'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    IF TG_OP = 'DELETE' OR NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.target_quantity IS DISTINCT FROM OLD.target_quantity
      OR NEW.status = 'cancelled' OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
      RAISE EXCEPTION 'Unlink plan item before editing identity or cancelling' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_linked_plan_identity ON production_order_items;
CREATE TRIGGER guard_linked_plan_identity BEFORE UPDATE OR DELETE ON production_order_items
FOR EACH ROW EXECUTE FUNCTION guard_linked_plan_identity();

CREATE OR REPLACE FUNCTION guard_linked_plan_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM production_order_items i JOIN advanced_production_request_links l ON l.plan_item_id = i.id
    WHERE i.order_id = OLD.id) THEN
    IF TG_OP = 'DELETE' OR NEW.source_branch_id IS DISTINCT FROM OLD.source_branch_id
      OR NEW.target_branch_id IS DISTINCT FROM OLD.target_branch_id
      OR NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date
      OR NEW.status NOT IN ('approved','in_progress','completed') THEN
      RAISE EXCEPTION 'Unlink plan before changing linked order identity' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_linked_plan_order ON advanced_production_orders;
CREATE TRIGGER guard_linked_plan_order BEFORE UPDATE OR DELETE ON advanced_production_orders
FOR EACH ROW EXECUTE FUNCTION guard_linked_plan_order();
COMMIT;