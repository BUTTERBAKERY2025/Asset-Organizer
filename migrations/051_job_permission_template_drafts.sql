-- Manual reviewed migration only. No account writes, legacy templates, or seeds.
BEGIN;

CREATE TABLE IF NOT EXISTS public.job_permission_template_drafts (
  id serial PRIMARY KEY,
  key varchar(80) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar NOT NULL REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.job_permission_template_draft_versions (
  template_id integer NOT NULL REFERENCES public.job_permission_template_drafts(id),
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  change_reason text NOT NULL CHECK (length(btrim(change_reason)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  PRIMARY KEY (template_id, version)
);

CREATE OR REPLACE FUNCTION public.guard_job_permission_template_draft_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $guard$
BEGIN
  RAISE EXCEPTION 'Job permission template drafts are append-only' USING ERRCODE = '23514';
END;
$guard$;

DROP TRIGGER IF EXISTS trg_job_template_draft_immutable ON public.job_permission_template_drafts;
CREATE TRIGGER trg_job_template_draft_immutable
BEFORE UPDATE OR DELETE ON public.job_permission_template_drafts
FOR EACH ROW EXECUTE FUNCTION public.guard_job_permission_template_draft_immutable();
DROP TRIGGER IF EXISTS trg_job_template_version_immutable ON public.job_permission_template_draft_versions;
CREATE TRIGGER trg_job_template_version_immutable
BEFORE UPDATE OR DELETE ON public.job_permission_template_draft_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_job_permission_template_draft_immutable();

CREATE OR REPLACE FUNCTION public.guard_job_permission_template_draft_append()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $guard$
DECLARE template_key text; latest integer;
BEGIN
  SELECT key INTO template_key FROM public.job_permission_template_drafts
    WHERE id = NEW.template_id FOR UPDATE;
  IF template_key IS NULL OR NEW.content->>'key' IS DISTINCT FROM template_key THEN
    RAISE EXCEPTION 'Draft content key must match template key' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(MAX(version), 0) INTO latest
    FROM public.job_permission_template_draft_versions WHERE template_id = NEW.template_id;
  IF NEW.version <> latest + 1 THEN
    RAISE EXCEPTION 'Draft versions must be sequential' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;
DROP TRIGGER IF EXISTS trg_job_template_version_append ON public.job_permission_template_draft_versions;
CREATE TRIGGER trg_job_template_version_append
BEFORE INSERT ON public.job_permission_template_draft_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_job_permission_template_draft_append();

-- These are server-only records, with no direct browser policies.
ALTER TABLE public.job_permission_template_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_permission_template_draft_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_permission_template_drafts, public.job_permission_template_draft_versions FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_job_permission_template_draft_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_job_permission_template_draft_append() FROM PUBLIC;
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.job_permission_template_drafts, public.job_permission_template_draft_versions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.job_permission_template_drafts, public.job_permission_template_draft_versions FROM authenticated;
  END IF;
END;
$roles$;
COMMIT;