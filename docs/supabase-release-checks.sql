-- READ ONLY. Run against the CONFIRMED target before and after each approved
-- migration. Every required row below must report ready=true after release.
-- Preflight absence is expected for not-yet-applied modules, NOT permission to
-- apply automatically. Confirm effective connection identity out of band.
SELECT current_database() AS database_name, current_user AS database_role,
       current_setting('search_path') AS search_path;

WITH expected(module, name) AS (VALUES
  ('033 prior','central_kitchen_batch_recipe_snapshots'),
  ('033 prior','central_kitchen_batch_materials'),
  ('033 prior','central_kitchen_batch_material_movements'),
  ('039 maintenance','maintenance_tickets'),
  ('039 maintenance','maintenance_ticket_events'),
  ('039 maintenance','maintenance_ticket_attachments'),
  ('042 bar','branch_bar_stock'),
  ('042 bar','branch_bar_handoff_events'),
  ('042 bar','branch_bar_workflow_activation'),
  ('043','central_kitchen_recipe_exceptions'),
  ('044','advanced_production_request_links'),
  ('045 complaints','branch_complaints'),
  ('045 complaints','branch_complaint_events'),
  ('045 complaints','branch_complaint_attachments')
)
SELECT module, 'table' AS kind, name, to_regclass('public.' || name) IS NOT NULL AS ready
FROM expected ORDER BY module, name;

WITH expected(module, tbl, col, datatype, required) AS (VALUES
  ('039 catalogue','products','operations_enabled','boolean',true),
  ('039 catalogue','products','sale_enabled','boolean',true),
  ('033 prior','daily_production_batches','recipe_backed','boolean',false),
  ('042 bar','finished_goods_transfers','request_key','text',false),
  ('042 bar','finished_goods_transfers','dispatch_key','text',false),
  ('042 bar','finished_goods_transfers','receive_key','text',false),
  ('042 bar','finished_goods_transfers','cancel_key','text',false),
  ('042 bar','finished_goods_transfers','usable_quantity','integer',false),
  ('042 bar','finished_goods_transfers','damaged_quantity','integer',false),
  ('042 bar','finished_goods_transfers','shortage_quantity','integer',false),
  ('042 bar','finished_goods_transfers','settlement_status','text',false),
  ('042 bar','finished_goods_transfers','receipt_notes','text',false),
  ('043','daily_production_batches','recipe_exception_id','integer',false),
  ('044','daily_production_batches','advanced_request_item_id','integer',false),
  ('045 complaints','branch_complaints','id','integer',true),
  ('045 complaints','branch_complaints','branch_id','character varying',true),
  ('045 complaints','branch_complaints','subject','text',true),
  ('045 complaints','branch_complaints','description','text',true),
  ('045 complaints','branch_complaints','category','text',true),
  ('045 complaints','branch_complaints','priority','text',true),
  ('045 complaints','branch_complaints','owner_user_id','character varying',false),
  ('045 complaints','branch_complaints','response_due','timestamp without time zone',false),
  ('045 complaints','branch_complaints','status','text',true),
  ('045 complaints','branch_complaints','resolution','text',false),
  ('045 complaints','branch_complaints','first_responded_at','timestamp without time zone',false),
  ('045 complaints','branch_complaints','version','integer',true),
  ('045 complaints','branch_complaints','created_by','character varying',true),
  ('045 complaints','branch_complaints','updated_by','character varying',true),
  ('045 complaints','branch_complaints','created_at','timestamp without time zone',true),
  ('045 complaints','branch_complaints','updated_at','timestamp without time zone',true),
  ('045 complaints','branch_complaint_events','id','integer',true),
  ('045 complaints','branch_complaint_events','complaint_id','integer',true),
  ('045 complaints','branch_complaint_events','actor_user_id','character varying',true),
  ('045 complaints','branch_complaint_events','event_type','text',true),
  ('045 complaints','branch_complaint_events','from_status','text',false),
  ('045 complaints','branch_complaint_events','to_status','text',false),
  ('045 complaints','branch_complaint_events','reason','text',false),
  ('045 complaints','branch_complaint_events','changes','jsonb',false),
  ('045 complaints','branch_complaint_events','created_at','timestamp without time zone',true),
  ('045 complaints','branch_complaint_attachments','id','integer',true),
  ('045 complaints','branch_complaint_attachments','complaint_id','integer',true),
  ('045 complaints','branch_complaint_attachments','original_name','text',true),
  ('045 complaints','branch_complaint_attachments','storage_path','text',true),
  ('045 complaints','branch_complaint_attachments','mime_type','text',true),
  ('045 complaints','branch_complaint_attachments','size_bytes','integer',true),
  ('045 complaints','branch_complaint_attachments','uploaded_by','character varying',true),
  ('045 complaints','branch_complaint_attachments','archived_at','timestamp without time zone',false),
  ('045 complaints','branch_complaint_attachments','archived_by','character varying',false),
  ('045 complaints','branch_complaint_attachments','created_at','timestamp without time zone',true)
)
SELECT e.module, 'column' AS kind, e.tbl || '.' || e.col AS name,
       (c.data_type = e.datatype AND (NOT e.required OR c.is_nullable = 'NO')) AS ready,
       c.data_type AS actual_type, c.column_default AS actual_default
FROM expected e LEFT JOIN information_schema.columns c ON c.table_schema = 'public'
  AND c.table_name = e.tbl AND c.column_name = e.col
ORDER BY e.module, e.tbl, e.col;

-- Complete required table-column inventory (045 types/nullability are checked
-- above). Missing names are reported explicitly, never silently counted away.
WITH expected(module, tbl, cols) AS (VALUES
 ('039 maintenance','maintenance_tickets','id branch_id asset_id description priority assignee_user_id due_at status closed_at version created_by updated_by created_at updated_at'),
 ('039 maintenance','maintenance_ticket_events','id ticket_id actor_user_id event_type from_status to_status reason changes created_at'),
 ('039 maintenance','maintenance_ticket_attachments','id ticket_id original_name storage_path mime_type size_bytes uploaded_by archived_at archived_by created_at'),
 ('042 bar','branch_bar_stock','id branch_id product_id production_date unit quantity quarantine_quantity'),
 ('042 bar','branch_bar_handoff_events','id transfer_id action actor_id occurred_at payload'),
 ('042 bar','branch_bar_workflow_activation','id activated_at'),
 ('043','central_kitchen_recipe_exceptions','id order_id item_id kitchen_id product_id unit quantity production_date reason requested_by requested_at status reviewed_by reviewed_at review_reason consumed_batch_id consumed_at'),
 ('044','advanced_production_request_links','plan_item_id request_item_id reason created_by created_at'),
 ('033 prior','central_kitchen_batch_recipe_snapshots','batch_id kitchen_id product_id source_recipe_id source_recipe_version recipe_source recipe_output_quantity recipe_output_unit batch_output_quantity ingredient_count ingredient_checksum created_at'),
 ('033 prior','central_kitchen_batch_materials','id batch_id warehouse_item_id material_name unit recipe_quantity required_quantity created_at'),
 ('033 prior','central_kitchen_batch_material_movements','id batch_id warehouse_item_id branch_stock_id movement_type quantity unit actor_id actor_name created_at')
), expanded AS (
 SELECT module, tbl, unnest(string_to_array(cols,' ')) AS col FROM expected
)
SELECT e.module, 'column existence' AS kind, e.tbl || '.' || e.col AS name,
 c.column_name IS NOT NULL AS ready
FROM expanded e LEFT JOIN information_schema.columns c
 ON c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = e.col
ORDER BY e.module, e.tbl, e.col;

-- Checks include validated FK/unique/check constraints (unnamed checks matched
-- by their expression) and unique index predicates, not just object names.
WITH expected(module, tbl, name, kind, fragment) AS (VALUES
  ('033 prior','central_kitchen_batch_materials','uq_ck_batch_materials_batch_item','u',''),
  ('033 prior','central_kitchen_batch_material_movements','uq_ck_batch_material_movement','u',''),
  ('033 prior','central_kitchen_batch_recipe_snapshots','recipe source check','c','recipe_source'),
  ('033 prior','central_kitchen_batch_recipe_snapshots','recipe quantity check','c','recipe_output_quantity'),
  ('033 prior','central_kitchen_batch_material_movements','movement type check','c','movement_type'),
  ('033 prior','central_kitchen_batch_materials','required quantity check','c','required_quantity'),
  ('039 maintenance','maintenance_tickets','priority check','c','priority'),
  ('039 maintenance','maintenance_tickets','status check','c','status'),
  ('039 maintenance','maintenance_tickets','version check','c','version'),
  ('039 maintenance','maintenance_tickets','assignee check','c','assignee_user_id'),
  ('039 maintenance','maintenance_ticket_attachments','mime check','c','mime_type'),
  ('039 maintenance','maintenance_ticket_attachments','size check','c','size_bytes'),
  ('042 bar','branch_bar_stock','ck_branch_bar_stock_nonnegative','c','quantity'),
  ('042 bar','branch_bar_stock','uq_branch_bar_stock_lot','u',''),
  ('042 bar','branch_bar_handoff_events','uq_branch_bar_handoff_event','u',''),
  ('042 bar','branch_bar_handoff_events','action check','c','action'),
  ('042 bar','branch_bar_workflow_activation','activation id check','c','id'),
  ('042 bar','finished_goods_transfers','ck_internal_bar_handoff_totals','c','internal_bar_receipt'),
  ('043','central_kitchen_recipe_exceptions','status check','c','status'),
  ('043','central_kitchen_recipe_exceptions','quantity check','c','quantity'),
  ('043','central_kitchen_recipe_exceptions','reason check','c','reason'),
  ('043','central_kitchen_recipe_exceptions','consumed_batch_id unique','u','consumed_batch_id'),
  ('043','daily_production_batches','fk_daily_production_recipe_exception','f','recipe_exception_id'),
  ('044','advanced_production_request_links','plan_item_id pk','p','plan_item_id'),
  ('044','advanced_production_request_links','request item fk','f','request_item_id'),
  ('044','advanced_production_request_links','reason check','c','reason'),
  ('044','daily_production_batches','advanced request fk','f','advanced_request_item_id'),
  ('045 complaints','branch_complaints','chk_branch_complaints_category','c','category'),
  ('045 complaints','branch_complaints','chk_branch_complaints_priority','c','priority'),
  ('045 complaints','branch_complaints','chk_branch_complaints_status','c','status'),
  ('045 complaints','branch_complaints','chk_branch_complaints_version','c','version'),
  ('045 complaints','branch_complaint_attachments','chk_branch_complaint_attachment_size','c','size_bytes')
)
SELECT e.module, 'constraint' AS kind, e.tbl || '.' || e.name AS name,
       EXISTS (SELECT 1 FROM pg_constraint c
         WHERE c.conrelid = to_regclass('public.' || e.tbl)
         AND c.contype = e.kind AND c.convalidated
         AND (c.conname = e.name OR (e.name LIKE '% check' OR e.name LIKE '% fk'
           OR e.name LIKE '% pk' OR e.name LIKE '% unique')
           AND pg_get_constraintdef(c.oid) ILIKE '%' || e.fragment || '%')
         AND pg_get_constraintdef(c.oid) ILIKE '%' || e.fragment || '%') AS ready
FROM expected e ORDER BY e.module, e.tbl, e.name;

-- Every 045 FK must point to the expected parent column, not merely share a name.
WITH expected(child, name, parent) AS (VALUES
 ('branch_complaints','fk_branch_complaints_branch','branches'),
 ('branch_complaints','fk_branch_complaints_owner','users'),
 ('branch_complaints','fk_branch_complaints_created_by','users'),
 ('branch_complaints','fk_branch_complaints_updated_by','users'),
 ('branch_complaint_events','fk_branch_complaint_events_complaint','branch_complaints'),
 ('branch_complaint_events','fk_branch_complaint_events_actor','users'),
 ('branch_complaint_attachments','fk_branch_complaint_attachments_complaint','branch_complaints'),
 ('branch_complaint_attachments','fk_branch_complaint_attachments_uploader','users'),
 ('branch_complaint_attachments','fk_branch_complaint_attachments_archiver','users')
)
SELECT '045 complaints' AS module, 'FK' AS kind, child || '.' || name AS name,
  EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = expected.name AND c.contype = 'f'
    AND c.convalidated AND c.conrelid = to_regclass('public.' || child)
    AND c.confrelid = to_regclass('public.' || parent)) AS ready
FROM expected ORDER BY child, name;

WITH expected(module, tbl, name, unique_required, fragment) AS (VALUES
 ('033 prior','central_kitchen_batch_recipe_snapshots','idx_ck_batch_recipe_snapshots_recipe',false,'source_recipe_id'),
 ('033 prior','central_kitchen_batch_materials','idx_ck_batch_materials_batch',false,'batch_id'),
 ('033 prior','central_kitchen_batch_material_movements','idx_ck_batch_material_movements_batch',false,'batch_id'),
 ('039 maintenance','maintenance_tickets','idx_maintenance_tickets_branch_status_due',false,'branch_id, status, due_at'),
 ('039 maintenance','maintenance_tickets','idx_maintenance_tickets_assignee',false,'assignee_user_id'),
 ('039 maintenance','maintenance_ticket_events','idx_maintenance_ticket_events_ticket',false,'ticket_id'),
 ('039 maintenance','maintenance_ticket_attachments','idx_maintenance_ticket_attachments_ticket',false,'ticket_id'),
 ('039 maintenance','maintenance_ticket_attachments','uq_maintenance_ticket_attachment_path',true,'storage_path'),
 ('042 bar','finished_goods_transfers','uq_internal_bar_request_key',true,'WHERE (request_key IS NOT NULL)'),
 ('043','central_kitchen_recipe_exceptions','idx_recipe_exceptions_order',false,'order_id'),
 ('043','daily_production_batches','uq_daily_production_recipe_exception',true,'WHERE (recipe_exception_id IS NOT NULL)'),
 ('044','advanced_production_request_links','idx_advanced_request_links_request',false,'request_item_id'),
 ('045 complaints','branch_complaints','idx_branch_complaints_branch_status',false,'branch_id, status'),
 ('045 complaints','branch_complaints','idx_branch_complaints_branch_priority',false,'branch_id, priority'),
 ('045 complaints','branch_complaints','idx_branch_complaints_owner',false,'owner_user_id'),
 ('045 complaints','branch_complaints','idx_branch_complaints_response_due',false,'response_due'),
 ('045 complaints','branch_complaint_events','idx_branch_complaint_events_complaint',false,'complaint_id, created_at'),
 ('045 complaints','branch_complaint_attachments','idx_branch_complaint_attachments_complaint',false,'complaint_id, created_at'),
 ('045 complaints','branch_complaint_attachments','uq_branch_complaint_attachment_path',true,'storage_path')
)
SELECT e.module, 'index' AS kind, e.tbl || '.' || e.name AS name,
  EXISTS (SELECT 1 FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
    WHERE x.indrelid = to_regclass('public.' || e.tbl) AND i.relname = e.name
      AND x.indisvalid AND x.indisready AND (NOT e.unique_required OR x.indisunique)
      AND pg_get_indexdef(i.oid) ILIKE '%' || e.fragment || '%') AS ready
FROM expected e ORDER BY e.module, e.tbl, e.name;

WITH expected(module, tbl, name, function_name) AS (VALUES
 ('033 prior','daily_production_batches','trg_ck_recipe_backed_snapshot_required','enforce_central_kitchen_recipe_backed_snapshot'),
 ('033 prior','central_kitchen_batch_recipe_snapshots','trg_ck_batch_recipe_snapshot_immutable','prevent_central_kitchen_batch_material_snapshot_mutation'),
 ('033 prior','central_kitchen_batch_materials','trg_ck_batch_material_immutable','prevent_central_kitchen_batch_material_snapshot_mutation'),
 ('033 prior','central_kitchen_batch_material_movements','trg_ck_batch_material_movement_immutable','prevent_central_kitchen_batch_material_movement_mutation'),
 ('043','daily_production_batches','trg_linked_recipe_exception','enforce_linked_recipe_exception'),
 ('044','advanced_production_request_links','guard_advanced_request_link','guard_advanced_request_link'),
 ('044','daily_production_batches','guard_advanced_batch_request_provenance','guard_advanced_batch_request_provenance'),
 ('044','daily_production_batches','guard_request_direct_coverage','guard_request_direct_coverage'),
 ('044','central_kitchen_order_items','guard_request_linked_identity','guard_request_linked_identity'),
 ('044','central_kitchen_orders','guard_linked_request_order','guard_linked_request_order'),
 ('044','production_order_items','guard_linked_plan_identity','guard_linked_plan_identity'),
 ('044','advanced_production_orders','guard_linked_plan_order','guard_linked_plan_order'),
 ('045 complaints','branch_complaint_events','trg_branch_complaint_events_append_only','reject_branch_complaint_event_mutation')
)
SELECT e.module, 'trigger' AS kind, e.tbl || '.' || e.name AS name,
 EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE t.tgrelid = to_regclass('public.' || e.tbl)
     AND t.tgname = e.name AND t.tgenabled = 'O'
     AND n.nspname = 'public' AND p.proname = e.function_name) AS ready
FROM expected e ORDER BY e.module, e.name;

WITH expected(module, signature, body_fragment) AS (VALUES
 ('033 prior','enforce_central_kitchen_recipe_backed_snapshot()','immutable'),
 ('033 prior','prevent_central_kitchen_batch_material_snapshot_mutation()','pg_trigger_depth()'),
 ('033 prior','prevent_central_kitchen_batch_material_movement_mutation()','central_kitchen_material_consume'),
 ('043','enforce_linked_recipe_exception()','Linked batch approval identity is immutable'),
 ('044','check_advanced_request_coverage(integer)','FOR NO KEY UPDATE'),
 ('044','guard_advanced_request_link()','check_advanced_request_coverage'),
 ('044','guard_advanced_batch_request_provenance()','advanced_request_item_id'),
 ('044','guard_request_direct_coverage()','FOR NO KEY UPDATE'),
 ('044','guard_request_linked_identity()','check_advanced_request_coverage'),
 ('044','guard_linked_request_order()','NEW.request_branch_id IS DISTINCT FROM OLD.request_branch_id'),
 ('044','guard_linked_plan_identity()','NEW.execution_unit IS DISTINCT FROM OLD.execution_unit'),
 ('044','guard_linked_plan_order()','NEW.target_branch_id IS DISTINCT FROM OLD.target_branch_id'),
 ('045 complaints','reject_branch_complaint_event_mutation()','append-only')
)
SELECT module, 'function' AS kind, signature AS name,
 COALESCE(pg_get_functiondef(to_regprocedure('public.' || signature)) ILIKE '%' || body_fragment || '%',false) AS ready
FROM expected ORDER BY module, signature;

-- Once 042's table exists, separately run this read-only query to inspect
-- its one-time activation timestamp (cannot reference an absent table in SQL):
-- SELECT id, activated_at FROM public.branch_bar_workflow_activation WHERE id = 1;

-- 045 defense in depth: RLS enabled, no direct browser-role table/sequence
-- privilege; an RLS policy allowing access would also require a separate review.
SELECT c.relname, c.relrowsecurity AS rls_enabled,
       c.relname IN ('branch_complaints','branch_complaint_events','branch_complaint_attachments') AS expected,
       EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy
FROM pg_class c WHERE c.oid IN (to_regclass('public.branch_complaints'),
  to_regclass('public.branch_complaint_events'),to_regclass('public.branch_complaint_attachments'));
SELECT r.rolname, t.table_name, t.privilege_type
FROM information_schema.role_table_grants t JOIN pg_roles r ON r.rolname = t.grantee
WHERE t.table_schema = 'public'
  AND t.table_name IN ('branch_complaints','branch_complaint_events','branch_complaint_attachments')
  AND r.rolname IN ('anon','authenticated');

-- Independent read-only uniqueness review; DO NOT add this index as part of release.
SELECT journal_id, count(*) AS link_count FROM public.branch_daily_closure_journals
WHERE journal_id IS NOT NULL GROUP BY journal_id HAVING count(*) > 1
ORDER BY link_count DESC, journal_id LIMIT 100;