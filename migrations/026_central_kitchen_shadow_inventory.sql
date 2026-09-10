-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;-- Shadow-only central-kitchen inventory ledger.
-- It never updates finished_goods_inventory, branch_stock, warehouse_items, or any real balance.
BEGIN;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_config (
  id integer PRIMARY KEY CHECK (id = 1),
  activated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO central_kitchen_shadow_inventory_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS central_kitchen_shadow_inventory_entries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES central_kitchen_orders(id) ON DELETE RESTRICT,
  order_item_id integer NOT NULL REFERENCES central_kitchen_order_items(id) ON DELETE RESTRICT,
  source_event_id integer NOT NULL REFERENCES central_kitchen_order_events(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('projected_kitchen_out', 'projected_branch_in')),
  component text NOT NULL CHECK (component IN ('original', 'substitute')),
  branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  counterparty_branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity real NOT NULL CHECK (quantity > 0),
  actor_id varchar NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_central_kitchen_shadow_inventory_source
    UNIQUE (order_item_id, direction, component)
);

CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_order
  ON central_kitchen_shadow_inventory_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_central_kitchen_shadow_inventory_branch
  ON central_kitchen_shadow_inventory_entries(branch_id, created_at);

CREATE OR REPLACE FUNCTION prevent_central_kitchen_shadow_inventory_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'central kitchen shadow inventory entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_central_kitchen_shadow_inventory_immutable
  ON central_kitchen_shadow_inventory_entries;
CREATE TRIGGER trg_central_kitchen_shadow_inventory_immutable
BEFORE UPDATE OR DELETE ON central_kitchen_shadow_inventory_entries
FOR EACH ROW EXECUTE FUNCTION prevent_central_kitchen_shadow_inventory_mutation();

COMMIT;