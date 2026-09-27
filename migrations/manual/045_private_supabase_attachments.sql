-- STAGED ONLY: apply in Supabase SQL Editor AFTER deploying the server-only
-- SUPABASE_SERVICE_ROLE_KEY and the updated code. Do not auto-apply.
-- This preserves existing objects/paths and does not migrate file bytes.
-- First audit ALL remaining storage.objects policies (other policies may
-- still grant anon access even when a bucket has public=false):
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';

BEGIN;

-- Refuse to silently remove a same-named policy with different intent.
DO $policy_audit$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('public_upload', 'public_download', 'public_delete')
  LOOP
    IF p.roles <> ARRAY['public']::name[]
      OR (p.policyname = 'public_upload' AND
          (p.cmd <> 'INSERT' OR p.with_check IS NULL OR p.with_check !~ $rx$^\(?bucket_id = 'documents'::text\)?$$rx$))
      OR (p.policyname = 'public_download' AND
          (p.cmd <> 'SELECT' OR p.qual IS NULL OR p.qual !~ $rx$^\(?bucket_id = 'documents'::text\)?$$rx$))
      OR (p.policyname = 'public_delete' AND
          (p.cmd <> 'DELETE' OR p.qual IS NULL OR p.qual !~ $rx$^\(?bucket_id = 'documents'::text\)?$$rx$))
    THEN
      RAISE EXCEPTION 'Policy storage.objects.% differs from audited documents policy; review manually', p.policyname;
    END IF;
  END LOOP;
END $policy_audit$;

DROP POLICY IF EXISTS public_upload ON storage.objects;
DROP POLICY IF EXISTS public_download ON storage.objects;
DROP POLICY IF EXISTS public_delete ON storage.objects;

-- Keep the original documents bucket and every stored object path unchanged.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Used by PrivateSupabaseStorage for branch complaints, maintenance,
-- and delivery-carrier evidence. No anonymous object policies are created.
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-private-attachments', 'app-private-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

COMMIT;

-- After apply: re-run the policy audit above and check bucket metadata:
-- SELECT id, name, public FROM storage.buckets
-- WHERE id IN ('documents', 'app-private-attachments');