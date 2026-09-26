#!/usr/bin/env bash
# Isolated local PostgreSQL ONLY. Never reads DATABASE_URL or connects remotely.
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
sql=(psql -X -v ON_ERROR_STOP=1 -h "$tmp" -p "$port" -U "$(id -un)" -d postgres)
"${sql[@]}" <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE TABLE public.branches (id varchar PRIMARY KEY);
CREATE TABLE public.users (id varchar PRIMARY KEY);
CREATE TABLE public.branch_daily_closure_journals (journal_id integer);
-- Simulate Supabase's permissive default grants on future objects.
ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon, authenticated;
SQL
"${sql[@]}" -f "$root/migrations/045_branch_complaints.sql" >/dev/null
"${sql[@]}" -f "$root/migrations/045_branch_complaints.sql" >/dev/null
"${sql[@]}" <<'SQL'
DO $$
DECLARE names text[] := ARRAY['branch_complaints','branch_complaint_events','branch_complaint_attachments'];
DECLARE tbl text;
DECLARE actual integer;
BEGIN
  FOREACH tbl IN ARRAY names LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.' || tbl) AND relrowsecurity) THEN
      RAISE EXCEPTION 'RLS missing on %', tbl;
    END IF;
    IF has_table_privilege('anon','public.' || tbl,'SELECT')
      OR has_table_privilege('authenticated','public.' || tbl,'INSERT')
      OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = to_regclass('public.' || tbl)) THEN
      RAISE EXCEPTION 'browser role access on %', tbl;
    END IF;
  END LOOP;
  SELECT count(*) INTO actual FROM information_schema.columns
    WHERE table_schema = 'public' AND (
      (table_name = 'branch_complaints' AND column_name IN ('id','branch_id','subject','description','category','priority','owner_user_id','response_due','status','resolution','first_responded_at','version','created_by','updated_by','created_at','updated_at'))
      OR (table_name = 'branch_complaint_events' AND column_name IN ('id','complaint_id','actor_user_id','event_type','from_status','to_status','reason','changes','created_at'))
      OR (table_name = 'branch_complaint_attachments' AND column_name IN ('id','complaint_id','original_name','storage_path','mime_type','size_bytes','uploaded_by','archived_at','archived_by','created_at'))
    );
  IF actual <> 35 THEN RAISE EXCEPTION 'Expected 35 columns, found %', actual; END IF;
  SELECT count(*) INTO actual FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'branch_complaints' AND column_name IN ('branch_id','subject','description','category','priority','status','version','created_by','updated_by','created_at','updated_at'))
        OR (table_name = 'branch_complaint_events' AND column_name IN ('complaint_id','actor_user_id','event_type','created_at'))
        OR (table_name = 'branch_complaint_attachments' AND column_name IN ('complaint_id','original_name','storage_path','mime_type','size_bytes','uploaded_by','created_at')))
      AND is_nullable = 'NO';
  IF actual <> 22 THEN RAISE EXCEPTION 'Missing NOT NULL complaint columns: %', actual; END IF;
  SELECT count(*) INTO actual FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'branch_complaints'
    AND ((column_name = 'priority' AND column_default = '''normal''::text')
      OR (column_name = 'status' AND column_default = '''open''::text')
      OR (column_name = 'version' AND column_default = '1')
      OR (column_name IN ('created_at','updated_at') AND column_default = 'now()'));
  IF actual <> 5 THEN RAISE EXCEPTION 'Complaint defaults incorrect: %', actual; END IF;
  SELECT count(*) INTO actual FROM pg_constraint WHERE convalidated AND contype = 'f'
    AND conrelid IN (to_regclass('public.branch_complaints'),to_regclass('public.branch_complaint_events'),to_regclass('public.branch_complaint_attachments'));
  IF actual <> 9 THEN RAISE EXCEPTION 'Expected 9 valid foreign keys, found %', actual; END IF;
  SELECT count(*) INTO actual FROM pg_constraint WHERE convalidated AND contype = 'c'
    AND conrelid IN (to_regclass('public.branch_complaints'),to_regclass('public.branch_complaint_attachments'));
  IF actual <> 5 THEN RAISE EXCEPTION 'Expected 5 checks, found %', actual; END IF;
  SELECT count(*) INTO actual FROM pg_index WHERE indisunique AND indisvalid
    AND indexrelid = to_regclass('public.uq_branch_complaint_attachment_path');
  IF actual <> 1 THEN RAISE EXCEPTION 'Missing unique attachment path'; END IF;
  SELECT count(*) INTO actual FROM pg_index WHERE indisvalid AND indexrelid IN (
    to_regclass('public.idx_branch_complaints_branch_status'),
    to_regclass('public.idx_branch_complaints_branch_priority'),
    to_regclass('public.idx_branch_complaints_owner'),
    to_regclass('public.idx_branch_complaints_response_due'),
    to_regclass('public.idx_branch_complaint_events_complaint'),
    to_regclass('public.idx_branch_complaint_attachments_complaint'));
  IF actual <> 6 THEN RAISE EXCEPTION 'Missing complaint lookup index: %', actual; END IF;
  IF has_sequence_privilege('anon','public.branch_complaints_id_seq','USAGE')
    OR has_sequence_privilege('authenticated','public.branch_complaint_events_id_seq','USAGE')
    THEN RAISE EXCEPTION 'Browser sequence access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.branch_complaint_events'::regclass
    AND tgname = 'trg_branch_complaint_events_append_only' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'Append-only event guard missing';
  END IF;
END $$;
INSERT INTO branches(id) VALUES ('b');
INSERT INTO users(id) VALUES ('u');
INSERT INTO branch_complaints(branch_id,subject,description,category,created_by,updated_by)
 VALUES ('b','s','d','service','u','u');
INSERT INTO branch_complaint_events(complaint_id,actor_user_id,event_type,changes)
 VALUES (1,'u','created','{}');
INSERT INTO branch_complaint_attachments(complaint_id,original_name,storage_path,mime_type,size_bytes,uploaded_by)
 VALUES (1,'x','private/path','application/pdf',2,'u');
UPDATE branch_complaint_attachments SET archived_at = now(), archived_by = 'u' WHERE id = 1;
DO $$
BEGIN
  BEGIN
    UPDATE branch_complaint_events SET event_type='edited' WHERE id=1;
    RAISE EXCEPTION 'Event update unexpectedly allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM branch_complaint_events WHERE id=1;
    RAISE EXCEPTION 'Event deletion unexpectedly allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO branch_complaints(branch_id,subject,description,category,created_by,updated_by)
      VALUES ('missing','s','d','service','u','u');
    RAISE EXCEPTION 'Missing branch unexpectedly allowed';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO branch_complaint_attachments(complaint_id,original_name,storage_path,mime_type,size_bytes,uploaded_by)
      VALUES (1,'x','private/path','application/pdf',2,'u');
    RAISE EXCEPTION 'Duplicate path unexpectedly allowed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SQL
"${sql[@]}" -f "$root/docs/supabase-release-checks.sql" > "$tmp/checks.txt"
echo "045 isolated PostgreSQL assertions passed (twice applied)"