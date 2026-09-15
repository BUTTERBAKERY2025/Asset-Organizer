-- Central-kitchen release preflight (read-only).
--
-- This file deliberately contains catalog queries only.  It does not inspect
-- application/customer rows and it does not create objects, call migration
-- functions, or change the database.  The migrations use the default public
-- schema; run this file against that schema on the approved target.
--
-- Status values:
--   OK         the expected catalog object/property is present
--   MISSING    the expected object/property is absent
--   MISMATCH   the object exists, but its kind/type/nullability differs
--   NOT_VALID  a check/foreign-key constraint exists but is not validated
--   DISABLED   an expected trigger exists but is disabled

-- 1. Tables created by 031, 033, and 034, plus the tables/objects that those
-- migrations and 032/035 require from earlier migrations.
WITH expected_tables (scope, table_schema, table_name, reason) AS (
  VALUES
    ('prerequisite', 'public', 'branches', '031/033/035 foreign-key target'),
    ('prerequisite', 'public', 'products', '031/033 foreign-key target'),
    ('prerequisite', 'public', 'users', '031/033 foreign-key target'),
    ('prerequisite', 'public', 'warehouse_items', '031/032/033 material source'),
    ('prerequisite', 'public', 'branch_stock', '032/033 material quantity source'),
    ('prerequisite', 'public', 'material_transfer_items', '032 decimal conversion'),
    ('prerequisite', 'public', 'warehouse_movement_logs', '032 decimal conversion'),
    ('prerequisite', 'public', 'central_kitchen_order_items', '032/035 preparation source'),
    ('prerequisite', 'public', 'central_kitchen_shadow_inventory_entries', '032 decimal conversion'),
    ('prerequisite', 'public', 'central_kitchen_inventory_allocations', '032 decimal conversion'),
    ('prerequisite', 'public', 'central_kitchen_inventory_movements', '032 decimal conversion'),
    ('prerequisite', 'public', 'daily_production_batches', '033/035 batch hooks'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'recipe definitions'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'recipe ingredients'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'append-only recipe audit'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'immutable batch recipe snapshot'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'frozen batch material requirements'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'immutable material debits'),
    ('migration_034', 'public', 'manual_production_operations', 'manual production idempotency')
)
SELECT
  e.scope,
  e.table_schema,
  e.table_name,
  e.reason,
  t.table_type AS actual_table_type,
  CASE
    WHEN t.table_name IS NULL THEN 'MISSING'
    WHEN t.table_type <> 'BASE TABLE' THEN 'MISMATCH'
    ELSE 'OK'
  END AS status
FROM expected_tables AS e
LEFT JOIN information_schema.tables AS t
  ON t.table_schema = e.table_schema
 AND t.table_name = e.table_name
ORDER BY e.scope, e.table_name;

-- 2. Columns introduced or type-changed by 031-035, and the minimum columns
-- needed from prerequisite tables.  Numeric precision/scale are checked here
-- as metadata, not by reading any customer rows.
WITH expected_columns (
  scope,
  table_schema,
  table_name,
  column_name,
  expected_data_type,
  expected_udt_name,
  expected_numeric_precision,
  expected_numeric_scale,
  expected_character_maximum_length,
  expected_is_nullable
) AS (
  VALUES
    -- Minimum prerequisite keys/hooks.
    ('prerequisite', 'public', 'branches', 'id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'products', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'users', 'id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'warehouse_items', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'branch_stock', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'material_transfer_items', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'warehouse_movement_logs', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'central_kitchen_order_items', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'central_kitchen_shadow_inventory_entries', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'central_kitchen_inventory_allocations', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'central_kitchen_inventory_movements', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'daily_production_batches', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('prerequisite', 'public', 'daily_production_batches', 'central_kitchen_order_item_id', 'integer', 'int4', NULL, NULL, NULL, 'YES'),

    -- Migration 031: recipe definitions and append-only operations.
    ('migration_031', 'public', 'central_kitchen_recipes', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'kitchen_id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'product_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'output_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'output_unit', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'notes', 'text', 'text', NULL, NULL, NULL, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'status', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'version', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'update_token', 'character varying', 'varchar', NULL, NULL, 128, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'supersedes_recipe_id', 'integer', 'int4', NULL, NULL, NULL, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'superseded_by_recipe_id', 'integer', 'int4', NULL, NULL, NULL, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'idempotency_key', 'character varying', 'varchar', NULL, NULL, 128, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'payload_fingerprint', 'character varying', 'varchar', NULL, NULL, 64, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'created_by', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'created_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'updated_by', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'updated_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'approved_by', 'character varying', 'varchar', NULL, NULL, NULL, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'approved_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'superseded_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'YES'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'recipe_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'warehouse_item_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'unit', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'created_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'actor_id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'action', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'idempotency_key', 'character varying', 'varchar', NULL, NULL, 128, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'fingerprint', 'character varying', 'varchar', NULL, NULL, 64, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'recipe_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'kitchen_id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'product_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'snapshot_json', 'jsonb', 'jsonb', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'response_json', 'jsonb', 'jsonb', NULL, NULL, NULL, 'NO'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'created_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),

    -- Migration 032: every ALTER COLUMN TYPE target, including the
    -- source-specific central-kitchen quantities.
    ('migration_032', 'public', 'warehouse_items', 'min_stock_level', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'warehouse_items', 'max_stock_level', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'warehouse_items', 'reorder_point', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'warehouse_items', 'current_stock', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'branch_stock', 'current_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'branch_stock', 'reserved_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'branch_stock', 'daily_consumption', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'material_transfer_items', 'quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'material_transfer_items', 'original_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'material_transfer_items', 'available_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'material_transfer_items', 'received_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'material_transfer_items', 'discrepancy', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'warehouse_movement_logs', 'quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'warehouse_movement_logs', 'balance_before', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'warehouse_movement_logs', 'balance_after', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'reserved_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'dispatched_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'released_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'received_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'central_kitchen_inventory_movements', 'quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'requested_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'prepared_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'substitute_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'dispatched_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'received_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'damaged_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'missing_quantity', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_032', 'public', 'central_kitchen_shadow_inventory_entries', 'quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),

    -- Migration 033: recipe snapshots and frozen material movements.
    ('migration_033', 'public', 'daily_production_batches', 'recipe_backed', 'boolean', 'bool', NULL, NULL, NULL, 'YES'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'batch_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'kitchen_id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'product_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'source_recipe_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'source_recipe_version', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'recipe_source', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'recipe_output_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'recipe_output_unit', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'batch_output_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'ingredient_count', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'ingredient_checksum', 'character varying', 'varchar', NULL, NULL, 64, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'created_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'batch_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'warehouse_item_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'material_name', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'unit', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'recipe_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'required_quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'created_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'batch_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'warehouse_item_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'branch_stock_id', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'movement_type', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'quantity', 'numeric', 'numeric', 18, 6, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'unit', 'text', 'text', NULL, NULL, NULL, 'NO'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'actor_id', 'character varying', 'varchar', NULL, NULL, NULL, 'YES'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'actor_name', 'text', 'text', NULL, NULL, NULL, 'YES'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'created_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),

    -- Migration 034: manual production operation idempotency.
    ('migration_034', 'public', 'manual_production_operations', 'id', 'bigint', 'int8', NULL, NULL, NULL, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'actor_id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'operation', 'character varying', 'varchar', NULL, NULL, 32, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'idempotency_key', 'character varying', 'varchar', NULL, NULL, 128, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'payload_hash', 'character varying', 'varchar', NULL, NULL, 64, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'branch_id', 'character varying', 'varchar', NULL, NULL, NULL, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'response_status', 'integer', 'int4', NULL, NULL, NULL, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'response_json', 'jsonb', 'jsonb', NULL, NULL, NULL, 'NO'),
    ('migration_034', 'public', 'manual_production_operations', 'created_at', 'timestamp without time zone', 'timestamp', NULL, NULL, NULL, 'NO'),

    -- Migration 035: preparation source evidence.
    ('migration_035', 'public', 'central_kitchen_order_items', 'prepared_from_stock', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_035', 'public', 'central_kitchen_order_items', 'prepared_from_production', 'numeric', 'numeric', 18, 6, NULL, 'YES'),
    ('migration_035', 'public', 'central_kitchen_order_items', 'production_fulfillment_evidence', 'jsonb', 'jsonb', NULL, NULL, NULL, 'YES')
)
SELECT
  e.scope,
  e.table_name,
  e.column_name,
  e.expected_data_type,
  e.expected_udt_name,
  e.expected_numeric_precision,
  e.expected_numeric_scale,
  e.expected_character_maximum_length,
  e.expected_is_nullable,
  c.data_type AS actual_data_type,
  c.udt_name AS actual_udt_name,
  c.numeric_precision AS actual_numeric_precision,
  c.numeric_scale AS actual_numeric_scale,
  c.character_maximum_length AS actual_character_maximum_length,
  c.is_nullable AS actual_is_nullable,
  c.column_default AS actual_column_default,
  CASE
    WHEN c.column_name IS NULL THEN 'MISSING'
    WHEN c.data_type IS DISTINCT FROM e.expected_data_type
      OR c.udt_name IS DISTINCT FROM e.expected_udt_name
      OR (
        e.expected_data_type = 'numeric'
        AND (
          c.numeric_precision IS DISTINCT FROM e.expected_numeric_precision
          OR c.numeric_scale IS DISTINCT FROM e.expected_numeric_scale
        )
      )
      OR (
        e.expected_data_type = 'character varying'
        AND c.character_maximum_length IS DISTINCT FROM e.expected_character_maximum_length
      )
      OR c.is_nullable IS DISTINCT FROM e.expected_is_nullable
      THEN 'MISMATCH'
    ELSE 'OK'
  END AS status
FROM expected_columns AS e
LEFT JOIN information_schema.columns AS c
  ON c.table_schema = e.table_schema
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
ORDER BY e.scope, e.table_name, e.column_name;

-- 3. Numeric contract (the same numeric targets are listed separately so an
-- operator can quickly filter/copy just the decimal conversion evidence).
WITH expected_numeric_columns (scope, table_schema, table_name, column_name) AS (
  VALUES
    ('migration_031', 'public', 'central_kitchen_recipes', 'output_quantity'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'quantity'),
    ('migration_032', 'public', 'warehouse_items', 'min_stock_level'),
    ('migration_032', 'public', 'warehouse_items', 'max_stock_level'),
    ('migration_032', 'public', 'warehouse_items', 'reorder_point'),
    ('migration_032', 'public', 'warehouse_items', 'current_stock'),
    ('migration_032', 'public', 'branch_stock', 'current_quantity'),
    ('migration_032', 'public', 'branch_stock', 'reserved_quantity'),
    ('migration_032', 'public', 'branch_stock', 'daily_consumption'),
    ('migration_032', 'public', 'material_transfer_items', 'quantity'),
    ('migration_032', 'public', 'material_transfer_items', 'original_quantity'),
    ('migration_032', 'public', 'material_transfer_items', 'available_quantity'),
    ('migration_032', 'public', 'material_transfer_items', 'received_quantity'),
    ('migration_032', 'public', 'material_transfer_items', 'discrepancy'),
    ('migration_032', 'public', 'warehouse_movement_logs', 'quantity'),
    ('migration_032', 'public', 'warehouse_movement_logs', 'balance_before'),
    ('migration_032', 'public', 'warehouse_movement_logs', 'balance_after'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'reserved_quantity'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'dispatched_quantity'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'released_quantity'),
    ('migration_032', 'public', 'central_kitchen_inventory_allocations', 'received_quantity'),
    ('migration_032', 'public', 'central_kitchen_inventory_movements', 'quantity'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'requested_quantity'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'prepared_quantity'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'substitute_quantity'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'dispatched_quantity'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'received_quantity'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'damaged_quantity'),
    ('migration_032', 'public', 'central_kitchen_order_items', 'missing_quantity'),
    ('migration_032', 'public', 'central_kitchen_shadow_inventory_entries', 'quantity'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'recipe_output_quantity'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'batch_output_quantity'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'recipe_quantity'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'required_quantity'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'quantity'),
    ('migration_035', 'public', 'central_kitchen_order_items', 'prepared_from_stock'),
    ('migration_035', 'public', 'central_kitchen_order_items', 'prepared_from_production')
)
SELECT
  e.scope,
  e.table_name,
  e.column_name,
  'numeric' AS expected_data_type,
  'numeric' AS expected_udt_name,
  18 AS expected_numeric_precision,
  6 AS expected_numeric_scale,
  c.data_type AS actual_data_type,
  c.udt_name AS actual_udt_name,
  c.numeric_precision AS actual_numeric_precision,
  c.numeric_scale AS actual_numeric_scale,
  CASE
    WHEN c.column_name IS NULL THEN 'MISSING'
    WHEN c.data_type IS DISTINCT FROM 'numeric'
      OR c.udt_name IS DISTINCT FROM 'numeric'
      OR c.numeric_precision IS DISTINCT FROM 18
      OR c.numeric_scale IS DISTINCT FROM 6
      THEN 'MISMATCH'
    ELSE 'OK'
  END AS status
FROM expected_numeric_columns AS e
LEFT JOIN information_schema.columns AS c
  ON c.table_schema = e.table_schema
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
ORDER BY e.scope, e.table_name, e.column_name;

-- 4. Constraints declared by 031-035, plus the prerequisite FK explicitly
-- installed by 030 and required by the 035 immutability trigger.
WITH expected_constraints (
  scope,
  table_schema,
  table_name,
  constraint_name,
  expected_contype,
  expected_definition
) AS (
  VALUES
    -- 030 prerequisite FK.
    ('prerequisite', 'public', 'daily_production_batches', 'daily_production_batches_central_kitchen_order_item_id_fkey', 'f', 'FOREIGN KEY (central_kitchen_order_item_id) REFERENCES public.central_kitchen_order_items(id) ON DELETE RESTRICT'),

    -- 031 central_kitchen_recipes.
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_pkey', 'p', 'PRIMARY KEY (id)'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_kitchen_id_fkey', 'f', 'FOREIGN KEY (kitchen_id) REFERENCES public.branches(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_product_id_fkey', 'f', 'FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_supersedes_recipe_id_fkey', 'f', 'FOREIGN KEY (supersedes_recipe_id) REFERENCES public.central_kitchen_recipes(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_superseded_by_recipe_id_fkey', 'f', 'FOREIGN KEY (superseded_by_recipe_id) REFERENCES public.central_kitchen_recipes(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_created_by_fkey', 'f', 'FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_updated_by_fkey', 'f', 'FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'central_kitchen_recipes_approved_by_fkey', 'f', 'FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'ck_central_kitchen_recipes_status', 'c', 'CHECK (status IN (''draft'', ''approved'', ''superseded''))'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'ck_central_kitchen_recipes_output_quantity', 'c', 'CHECK (output_quantity > 0)'),
    ('migration_031', 'public', 'central_kitchen_recipes', 'ck_central_kitchen_recipes_version', 'c', 'CHECK (version > 0)'),

    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'central_kitchen_recipe_ingredients_pkey', 'p', 'PRIMARY KEY (id)'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'central_kitchen_recipe_ingredients_recipe_id_fkey', 'f', 'FOREIGN KEY (recipe_id) REFERENCES public.central_kitchen_recipes(id) ON DELETE CASCADE'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'central_kitchen_recipe_ingredients_warehouse_item_id_fkey', 'f', 'FOREIGN KEY (warehouse_item_id) REFERENCES public.warehouse_items(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'uq_central_kitchen_recipe_ingredients_item', 'u', 'UNIQUE (recipe_id, warehouse_item_id)'),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'ck_central_kitchen_recipe_ingredients_quantity', 'c', 'CHECK (quantity > 0)'),

    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'central_kitchen_recipe_operations_pkey', 'p', 'PRIMARY KEY (id)'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'central_kitchen_recipe_operations_actor_id_fkey', 'f', 'FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'central_kitchen_recipe_operations_kitchen_id_fkey', 'f', 'FOREIGN KEY (kitchen_id) REFERENCES public.branches(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'central_kitchen_recipe_operations_product_id_fkey', 'f', 'FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'ck_central_kitchen_recipe_operations_action', 'c', 'CHECK (action IN (''create'', ''update'', ''approve'', ''revise'', ''delete''))'),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'uq_central_kitchen_recipe_operations_actor_key', 'u', 'UNIQUE (actor_id, idempotency_key)'),

    -- 033 batch snapshots/materials/movements.
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapshots_pkey', 'p', 'PRIMARY KEY (batch_id)'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapshots_batch_id_fkey', 'f', 'FOREIGN KEY (batch_id) REFERENCES public.daily_production_batches(id) ON DELETE CASCADE'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapshots_kitchen_id_fkey', 'f', 'FOREIGN KEY (kitchen_id) REFERENCES public.branches(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapshots_product_id_fkey', 'f', 'FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapshots_source_recipe_id_fkey', 'f', 'FOREIGN KEY (source_recipe_id) REFERENCES public.central_kitchen_recipes(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapsh_source_recipe_version_check', 'c', 'CHECK (source_recipe_version > 0)'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapshots_recipe_source_check', 'c', 'CHECK (recipe_source = ''approved_recipe'')'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snaps_recipe_output_quantity_check', 'c', 'CHECK (recipe_output_quantity > 0)'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapsh_batch_output_quantity_check', 'c', 'CHECK (batch_output_quantity > 0)'),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'central_kitchen_batch_recipe_snapshots_ingredient_count_check', 'c', 'CHECK (ingredient_count > 0)'),

    ('migration_033', 'public', 'central_kitchen_batch_materials', 'central_kitchen_batch_materials_pkey', 'p', 'PRIMARY KEY (id)'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'central_kitchen_batch_materials_batch_id_fkey', 'f', 'FOREIGN KEY (batch_id) REFERENCES public.daily_production_batches(id) ON DELETE CASCADE'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'central_kitchen_batch_materials_warehouse_item_id_fkey', 'f', 'FOREIGN KEY (warehouse_item_id) REFERENCES public.warehouse_items(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'central_kitchen_batch_materials_recipe_quantity_check', 'c', 'CHECK (recipe_quantity > 0)'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'central_kitchen_batch_materials_required_quantity_check', 'c', 'CHECK (required_quantity > 0)'),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'uq_ck_batch_materials_batch_item', 'u', 'UNIQUE (batch_id, warehouse_item_id)'),

    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'central_kitchen_batch_material_movements_pkey', 'p', 'PRIMARY KEY (id)'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'central_kitchen_batch_material_movements_batch_id_fkey', 'f', 'FOREIGN KEY (batch_id) REFERENCES public.daily_production_batches(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'central_kitchen_batch_material_movements_warehouse_item_id_fkey', 'f', 'FOREIGN KEY (warehouse_item_id) REFERENCES public.warehouse_items(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'central_kitchen_batch_material_movements_branch_stock_id_fkey', 'f', 'FOREIGN KEY (branch_stock_id) REFERENCES public.branch_stock(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'central_kitchen_batch_material_movements_actor_id_fkey', 'f', 'FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'central_kitchen_batch_material_movements_movement_type_check', 'c', 'CHECK (movement_type = ''production_material_debit'')'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'central_kitchen_batch_material_movements_quantity_check', 'c', 'CHECK (quantity > 0)'),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'uq_ck_batch_material_movement', 'u', 'UNIQUE (batch_id, warehouse_item_id)'),

    -- 034.
    ('migration_034', 'public', 'manual_production_operations', 'manual_production_operations_pkey', 'p', 'PRIMARY KEY (id)'),
    ('migration_034', 'public', 'manual_production_operations', 'uq_manual_production_operations_actor_operation_key', 'u', 'UNIQUE (actor_id, operation, idempotency_key)'),

    -- 035.
    ('migration_035', 'public', 'central_kitchen_order_items', 'ck_central_kitchen_order_items_preparation_source_pair', 'c', 'CHECK ((prepared_from_stock IS NULL) = (prepared_from_production IS NULL))'),
    ('migration_035', 'public', 'central_kitchen_order_items', 'ck_central_kitchen_order_items_preparation_sources', 'c', 'CHECK (prepared_from_stock IS NULL OR (prepared_quantity IS NOT NULL AND prepared_from_stock >= 0 AND prepared_from_production >= 0 AND prepared_from_stock + prepared_from_production = prepared_quantity))'),
    ('migration_035', 'public', 'central_kitchen_order_items', 'ck_central_kitchen_order_items_production_evidence', 'c', 'CHECK ((prepared_from_production IS NULL OR prepared_from_production = 0) = (production_fulfillment_evidence IS NULL))')
)
SELECT
  e.scope,
  e.table_name,
  e.constraint_name,
  e.expected_contype,
  e.expected_definition,
  c.contype AS actual_contype,
  CASE WHEN c.oid IS NULL THEN NULL ELSE pg_get_constraintdef(c.oid, true) END AS actual_definition,
  CASE WHEN c.oid IS NULL THEN NULL ELSE c.convalidated END AS actual_validated,
  CASE
    WHEN c.oid IS NULL THEN 'MISSING'
    WHEN c.contype IS DISTINCT FROM e.expected_contype THEN 'MISMATCH'
    WHEN c.contype IN ('c', 'f') AND c.convalidated IS FALSE THEN 'NOT_VALID'
    ELSE 'OK'
  END AS status
FROM expected_constraints AS e
LEFT JOIN pg_catalog.pg_namespace AS n
  ON n.nspname = e.table_schema
LEFT JOIN pg_catalog.pg_class AS r
  ON r.relnamespace = n.oid
 AND r.relname = e.table_name
LEFT JOIN pg_catalog.pg_constraint AS c
  ON c.conrelid = r.oid
 AND c.conname = e.constraint_name
ORDER BY e.scope, e.table_name, e.constraint_name;

-- 5. Trigger names, owning relations, functions, enabled state, and complete
-- trigger definitions.  This is catalog metadata only; it does not invoke a
-- trigger or its function.
WITH expected_triggers (
  scope,
  table_schema,
  table_name,
  trigger_name,
  expected_function,
  expected_tgtype
) AS (
  VALUES
    -- tgtype is the PostgreSQL catalog bitmask: row(1), before(2),
    -- insert(4), delete(8), update(16).  The returned definition remains
    -- visible so UPDATE OF column lists can be reviewed without invoking it.
    ('prerequisite', 'public', 'central_kitchen_inventory_movements', 'trg_central_kitchen_inventory_movements_immutable', 'reject_central_kitchen_inventory_movement_mutation', 27),
    ('migration_031', 'public', 'central_kitchen_recipe_operations', 'trg_central_kitchen_recipe_operation_append_only', 'prevent_central_kitchen_recipe_operation_mutation', 27),
    ('migration_031', 'public', 'central_kitchen_recipes', 'trg_central_kitchen_recipe_immutable', 'prevent_central_kitchen_recipe_mutation', 27),
    ('migration_031', 'public', 'central_kitchen_recipe_ingredients', 'trg_central_kitchen_recipe_ingredient_immutable', 'prevent_central_kitchen_recipe_ingredient_mutation', 31),
    ('migration_033', 'public', 'daily_production_batches', 'trg_ck_recipe_backed_snapshot_required', 'enforce_central_kitchen_recipe_backed_snapshot', 23),
    ('migration_033', 'public', 'central_kitchen_batch_recipe_snapshots', 'trg_ck_batch_recipe_snapshot_immutable', 'prevent_central_kitchen_batch_material_snapshot_mutation', 31),
    ('migration_033', 'public', 'central_kitchen_batch_materials', 'trg_ck_batch_material_immutable', 'prevent_central_kitchen_batch_material_snapshot_mutation', 31),
    ('migration_033', 'public', 'central_kitchen_batch_material_movements', 'trg_ck_batch_material_movement_immutable', 'prevent_central_kitchen_batch_material_movement_mutation', 31),
    ('migration_035', 'public', 'daily_production_batches', 'trg_ck_linked_batch_item_immutable', 'prevent_central_kitchen_linked_batch_reassignment', 19)
)
SELECT
  e.scope,
  e.table_name,
  e.trigger_name,
  e.expected_function,
  e.expected_tgtype,
  p.proname AS actual_function,
  pn.nspname AS actual_function_schema,
  t.tgtype AS actual_tgtype,
  CASE WHEN t.oid IS NULL THEN NULL ELSE t.tgenabled END AS actual_enabled,
  CASE WHEN t.oid IS NULL THEN NULL ELSE t.tgisinternal END AS actual_is_internal,
  CASE WHEN t.oid IS NULL THEN NULL ELSE pg_get_triggerdef(t.oid, true) END AS actual_definition,
  CASE
    WHEN t.oid IS NULL THEN 'MISSING'
    WHEN t.tgisinternal
      OR p.proname IS DISTINCT FROM e.expected_function
      OR pn.nspname IS DISTINCT FROM e.table_schema
      OR t.tgtype IS DISTINCT FROM e.expected_tgtype
      THEN 'MISMATCH'
    WHEN t.tgenabled = 'D' THEN 'DISABLED'
    ELSE 'OK'
  END AS status
FROM expected_triggers AS e
LEFT JOIN pg_catalog.pg_namespace AS n
  ON n.nspname = e.table_schema
LEFT JOIN pg_catalog.pg_class AS r
  ON r.relnamespace = n.oid
 AND r.relname = e.table_name
LEFT JOIN pg_catalog.pg_trigger AS t
  ON t.tgrelid = r.oid
 AND t.tgname = e.trigger_name
LEFT JOIN pg_catalog.pg_proc AS p
  ON p.oid = t.tgfoid
LEFT JOIN pg_catalog.pg_namespace AS pn
  ON pn.oid = p.pronamespace
ORDER BY e.scope, e.table_name, e.trigger_name;
