-- Server-only authority metadata. No changes to employee grants or source rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.user_permission_source_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_permission_source_modes FROM PUBLIC;
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.user_permission_source_modes FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.user_permission_source_modes FROM authenticated;
  END IF;
END;
$roles$;
COMMIT;