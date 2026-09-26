#!/usr/bin/env bash
# Disposable loopback PostgreSQL only; ignores application connection variables.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
port="$((20000 + $$ % 20000))"
cleanup() {
  pg_ctl -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
initdb -D "$tmp/data" -A trust --no-instructions >/dev/null
pg_ctl -D "$tmp/data" -o "-h 127.0.0.1 -p $port -k $tmp" -l "$tmp/log" start >/dev/null
sql=(psql -X -q -v ON_ERROR_STOP=1 -h "$tmp" -p "$port" -U "$(id -un)" -d postgres)

"${sql[@]}" <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.branches (id varchar PRIMARY KEY);
CREATE TABLE public.users (id varchar PRIMARY KEY);
CREATE TABLE public.inventory_items (id varchar PRIMARY KEY);
CREATE TABLE public.products (id integer PRIMARY KEY, unit text, product_type text, is_active boolean, operations_enabled boolean);
CREATE TABLE public.finished_goods_transfers (
  id integer PRIMARY KEY, transport_policy text, quantity integer, destination_type text,
  destination_branch_id varchar, source_branch_id varchar, product_id integer,
  production_date text, created_by varchar, status text, dispatched_at timestamp,
  received_at timestamp, received_by varchar, received_quantity integer
);
CREATE TABLE public.central_kitchen_orders (
  id integer PRIMARY KEY, central_kitchen_id varchar, request_branch_id varchar,
  needed_date date, inventory_mode text, status text
);
CREATE TABLE public.central_kitchen_order_items (
  id integer PRIMARY KEY, order_id integer REFERENCES public.central_kitchen_orders(id),
  product_id integer, warehouse_item_id integer, unit text, requested_quantity numeric,
  prepared_quantity numeric, substitute_quantity numeric, substitute_product_id integer,
  substitute_warehouse_item_id integer
);
CREATE TABLE public.central_kitchen_batch_recipe_snapshots (batch_id integer PRIMARY KEY);
CREATE TABLE public.advanced_production_orders (
  id integer PRIMARY KEY, source_branch_id text, target_branch_id text,
  start_date text, end_date text, status text
);
CREATE TABLE public.production_order_items (
  id integer PRIMARY KEY, order_id integer REFERENCES public.advanced_production_orders(id),
  product_id integer, target_quantity integer, status text, scheduled_date text, execution_unit text
);
CREATE TABLE public.daily_production_batches (
  id serial PRIMARY KEY, branch_id varchar, product_id integer, quantity integer,
  unit text, destination text, status text, production_date text,
  central_kitchen_order_item_id integer, recipe_backed boolean,
  advanced_production_order_item_id integer
);
-- Model Supabase default object privileges without touching existing tables.
ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
SQL

files=(039_maintenance_tickets 042_internal_branch_bar_handoffs 043_recipe_exceptions 044_advanced_request_coverage 045_branch_complaints)
for pass in 1 2; do
  for name in "${files[@]}"; do
    "${sql[@]}" -f "$root/migrations/$name.sql" > "$tmp/$name.$pass.out"
  done
done

"${sql[@]}" <<'SQL'
DO $$
DECLARE
  names text[] := ARRAY[
    'maintenance_tickets','maintenance_ticket_events','maintenance_ticket_attachments',
    'branch_bar_stock','branch_bar_handoff_events','branch_bar_workflow_activation',
    'central_kitchen_recipe_exceptions','advanced_production_request_links',
    'branch_complaints','branch_complaint_events','branch_complaint_attachments'
  ];
  sequences text[] := ARRAY[
    'maintenance_tickets_id_seq','maintenance_ticket_events_id_seq','maintenance_ticket_attachments_id_seq',
    'branch_bar_stock_id_seq','branch_bar_handoff_events_id_seq',
    'central_kitchen_recipe_exceptions_id_seq',
    'branch_complaints_id_seq','branch_complaint_events_id_seq','branch_complaint_attachments_id_seq'
  ];
  functions text[] := ARRAY[
    'public.enforce_linked_recipe_exception()',
    'public.check_advanced_request_coverage(integer)',
    'public.guard_advanced_request_link()','public.guard_advanced_batch_request_provenance()',
    'public.guard_request_direct_coverage()','public.guard_request_linked_identity()',
    'public.guard_linked_request_order()','public.guard_linked_plan_identity()',
    'public.guard_linked_plan_order()','public.reject_branch_complaint_event_mutation()'
  ];
  name text;
  role_name text;
  privilege text;
BEGIN
  FOREACH name IN ARRAY names LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.' || name) AND relrowsecurity)
      OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = to_regclass('public.' || name)) THEN
      RAISE EXCEPTION 'RLS or policies incorrect on %', name;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
      WHERE c.oid = to_regclass('public.' || name) AND acl.grantee = 0) THEN
      RAISE EXCEPTION 'PUBLIC table grant on %', name;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(role_name, 'public.' || name, privilege) THEN
          RAISE EXCEPTION '% has % on %', role_name, privilege, name;
        END IF;
      END LOOP;
    END LOOP;
    IF NOT has_table_privilege('service_role','public.' || name,'INSERT') THEN
      RAISE EXCEPTION 'default server grant lost on %', name;
    END IF;
  END LOOP;
  FOREACH name IN ARRAY sequences LOOP
    IF EXISTS (SELECT 1 FROM pg_class c, aclexplode(COALESCE(c.relacl, acldefault('S', c.relowner))) acl
      WHERE c.oid = to_regclass('public.' || name) AND acl.grantee = 0) THEN
      RAISE EXCEPTION 'PUBLIC sequence grant on %', name;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH privilege IN ARRAY ARRAY['USAGE','SELECT','UPDATE'] LOOP
        IF has_sequence_privilege(role_name, 'public.' || name, privilege) THEN
          RAISE EXCEPTION '% has % on sequence %', role_name, privilege, name;
        END IF;
      END LOOP;
    END LOOP;
    IF NOT has_sequence_privilege('service_role','public.' || name,'USAGE') THEN
      RAISE EXCEPTION 'default server sequence grant lost on %', name;
    END IF;
  END LOOP;
  FOREACH name IN ARRAY functions LOOP
    IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
      WHERE p.oid = name::regprocedure AND acl.grantee = 0) THEN
      RAISE EXCEPTION 'PUBLIC function grant on %', name;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_function_privilege(role_name, name, 'EXECUTE') THEN
        RAISE EXCEPTION '% has EXECUTE on %', role_name, name;
      END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM public.branch_bar_workflow_activation) <> 1
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.finished_goods_transfers'::regclass
      AND conname = 'ck_internal_bar_handoff_totals' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.daily_production_batches'::regclass
      AND conname = 'fk_daily_production_recipe_exception' AND convalidated)
    OR NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid = 'public.uq_daily_production_recipe_exception'::regclass
      AND indisvalid AND indisunique)
    OR (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled = 'O'
      AND tgname IN ('trg_linked_recipe_exception','guard_advanced_request_link',
        'guard_advanced_batch_request_provenance','guard_request_direct_coverage',
        'guard_request_linked_identity','guard_linked_request_order',
        'guard_linked_plan_identity','guard_linked_plan_order',
        'trg_branch_complaint_events_append_only')) <> 9 THEN
    RAISE EXCEPTION 'migration guard, FK, index or activation missing';
  END IF;
END $$;
INSERT INTO public.branches VALUES ('kitchen'),('branch');
INSERT INTO public.users VALUES ('actor');
INSERT INTO public.inventory_items VALUES ('asset');
INSERT INTO public.products VALUES (11,'piece','finish',true,false);
INSERT INTO public.maintenance_tickets(branch_id,asset_id,description,created_by,updated_by)
  VALUES ('branch','asset','repair','actor','actor');
INSERT INTO public.maintenance_ticket_events(ticket_id,actor_user_id,event_type)
  VALUES (1,'actor','created');
INSERT INTO public.maintenance_ticket_attachments(ticket_id,original_name,storage_path,mime_type,size_bytes,uploaded_by)
  VALUES (1,'image','private/maintenance','image/png',1,'actor');
INSERT INTO public.branch_bar_stock(branch_id,product_id,production_date,unit)
  VALUES ('branch',11,'2099-01-01','piece');
INSERT INTO public.finished_goods_transfers(id) VALUES (1);
INSERT INTO public.branch_bar_handoff_events(transfer_id,action,actor_id)
  VALUES (1,'request','actor');
INSERT INTO public.central_kitchen_orders VALUES (20,'kitchen','branch','2099-01-10','real','approved');
INSERT INTO public.central_kitchen_order_items VALUES (30,20,11,NULL,'piece',10,NULL,NULL,NULL,NULL);
INSERT INTO public.central_kitchen_recipe_exceptions
  (order_id,item_id,kitchen_id,product_id,unit,quantity,production_date,reason,
   requested_by,status,reviewed_by,reviewed_at,review_reason)
  VALUES (20,30,'kitchen',11,'piece',1,'2099-01-01','reason',
    'actor','approved','actor',now(),'ok');
INSERT INTO public.daily_production_batches
  (branch_id,product_id,quantity,unit,destination,status,production_date,
   central_kitchen_order_item_id,recipe_backed,recipe_exception_id)
  VALUES ('kitchen',11,1,'piece','central_kitchen_order','in_progress','2099-01-01',30,false,1);
INSERT INTO public.advanced_production_orders VALUES (40,'kitchen','branch','2099-01-01','2099-01-09','approved');
INSERT INTO public.production_order_items VALUES (41,40,11,8,'pending',NULL,NULL);
INSERT INTO public.advanced_production_request_links(plan_item_id,request_item_id,reason)
  VALUES (41,30,'approved demand');
INSERT INTO public.branch_complaints(branch_id,subject,description,category,created_by,updated_by)
  VALUES ('branch','subject','description','service','actor','actor');
INSERT INTO public.branch_complaint_events(complaint_id,actor_user_id,event_type)
  VALUES (1,'actor','created');
INSERT INTO public.branch_complaint_attachments
  (complaint_id,original_name,storage_path,mime_type,size_bytes,uploaded_by)
  VALUES (1,'attachment','private/complaint','application/pdf',1,'actor');
DO $$
BEGIN
  IF (SELECT status FROM public.central_kitchen_recipe_exceptions WHERE id = 1) <> 'consumed' THEN
    RAISE EXCEPTION 'exception was not consumed';
  END IF;
  BEGIN
    INSERT INTO public.maintenance_tickets(branch_id,description,created_by,updated_by)
      VALUES ('missing','bad','actor','actor');
    RAISE EXCEPTION 'FK unexpectedly allowed';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.branch_bar_stock(branch_id,product_id,production_date,unit,quantity)
      VALUES ('branch',11,'2099-01-02','piece',-1);
    RAISE EXCEPTION 'stock check unexpectedly allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.branch_complaint_attachments
      (complaint_id,original_name,storage_path,mime_type,size_bytes,uploaded_by)
      VALUES (999,'x','private/bad','application/pdf',1,'actor');
    RAISE EXCEPTION 'complaint FK unexpectedly allowed';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.advanced_production_request_links(plan_item_id,request_item_id,reason)
      VALUES (41,30,'duplicate');
    RAISE EXCEPTION 'plan unique key unexpectedly allowed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    UPDATE public.branch_complaint_events SET event_type = 'edited' WHERE id = 1;
    RAISE EXCEPTION 'event mutation unexpectedly allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.finished_goods_transfers(id,transport_policy,quantity,status)
      VALUES (2,'internal_bar_receipt',1,'received');
    RAISE EXCEPTION 'handoff check unexpectedly allowed invalid receipt';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SQL

# Internal-bar CHECK must reject unknown status and incomplete received totals;
# pending transfers still do not need receipt/settlement fields.
"${sql[@]}" <<'SQL'
DO $$
BEGIN
  BEGIN
    INSERT INTO public.finished_goods_transfers
      (id,transport_policy,quantity,destination_type,destination_branch_id,source_branch_id,
       product_id,production_date,created_by,request_key)
      VALUES (3,'internal_bar_receipt',10,'display_bar','branch','branch',
        11,'2099-01-01','actor','null-status');
    RAISE EXCEPTION 'NULL internal-bar status unexpectedly allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.finished_goods_transfers
      (id,transport_policy,quantity,destination_type,destination_branch_id,source_branch_id,
       product_id,production_date,created_by,request_key,status,dispatched_at,dispatch_key,
       received_at,receive_key,received_by,received_quantity)
      VALUES (4,'internal_bar_receipt',10,'display_bar','branch','branch',
        11,'2099-01-01','actor','null-totals','received',now(),'dispatch',
        now(),'receive','actor',8);
    RAISE EXCEPTION 'NULL received totals unexpectedly allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO public.finished_goods_transfers
  (id,transport_policy,quantity,destination_type,destination_branch_id,source_branch_id,
   product_id,production_date,created_by,request_key,status)
  VALUES (5,'internal_bar_receipt',10,'display_bar','branch','branch',
    11,'2099-01-01','actor','valid-pending','pending');
INSERT INTO public.finished_goods_transfers
  (id,transport_policy,quantity,destination_type,destination_branch_id,source_branch_id,
   product_id,production_date,created_by,request_key,status,dispatched_at,dispatch_key,
   received_at,receive_key,received_by,received_quantity,usable_quantity,damaged_quantity,shortage_quantity)
  VALUES (6,'internal_bar_receipt',10,'display_bar','branch','branch',
    11,'2099-01-01','actor','valid-received','received',now(),'dispatch',
    now(),'receive','actor',8,7,1,2);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.finished_goods_transfers WHERE id IN (5,6)) <> 2
    OR (SELECT count(*) FROM public.finished_goods_transfers WHERE id IN (3,4)) <> 0 THEN
    RAISE EXCEPTION 'Unexpected internal bar check outcomes';
  END IF;
END $$;
SQL

# Test SQL execution under the actual roles, not only effective ACL metadata.
if "${sql[@]}" -c "SET ROLE anon; SELECT * FROM public.branch_complaints LIMIT 1" >"$tmp/anon.out" 2>&1; then
  echo "anon unexpectedly selected complaints" >&2
  exit 1
fi
grep -q 'permission denied' "$tmp/anon.out"
if "${sql[@]}" -c "SET ROLE authenticated; SELECT nextval('public.maintenance_tickets_id_seq')" >"$tmp/auth.out" 2>&1; then
  echo "authenticated unexpectedly used maintenance sequence" >&2
  exit 1
fi
grep -q 'permission denied' "$tmp/auth.out"
"${sql[@]}" -c "SET ROLE service_role; SELECT count(*) FROM public.branch_complaints" >"$tmp/server.out"

# Also rehearse a rerun when optional browser roles are absent.
"${sql[@]}" <<'SQL'
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM anon, authenticated;
DROP ROLE anon;
DROP ROLE authenticated;
SQL
for name in "${files[@]}"; do
  "${sql[@]}" -f "$root/migrations/$name.sql" > "$tmp/$name.no-roles.out"
done
echo "Integrated release migrations: twice applied, guards/FKs/security/roles verified; no-role replay passed."