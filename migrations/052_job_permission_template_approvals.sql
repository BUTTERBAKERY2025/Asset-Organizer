-- MANUAL ONLY. Content review certification, never effective employee authority.
-- Requires 051; no seed, existing template update, employee or permission writes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.job_permission_template_approvals (
  template_id integer NOT NULL,
  version integer NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  reviewed boolean NOT NULL CHECK (reviewed IS TRUE),
  acknowledge_empty_permissions boolean NOT NULL DEFAULT false,
  approved_at timestamptz NOT NULL DEFAULT now(),
  approved_by varchar NOT NULL REFERENCES public.users(id),
  PRIMARY KEY (template_id, version),
  FOREIGN KEY (template_id, version)
    REFERENCES public.job_permission_template_draft_versions(template_id, version)
);

CREATE OR REPLACE FUNCTION public.guard_job_permission_template_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $guard$
DECLARE latest integer; selected_content jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Template approvals are immutable content certifications' USING ERRCODE = '23514';
  END IF;
  PERFORM id FROM public.job_permission_template_drafts WHERE id = NEW.template_id FOR UPDATE;
  SELECT MAX(version) INTO latest FROM public.job_permission_template_draft_versions WHERE template_id = NEW.template_id;
  IF NEW.version IS DISTINCT FROM latest THEN
    RAISE EXCEPTION 'Approval must select latest template version' USING ERRCODE = '23514';
  END IF;
  SELECT content INTO selected_content FROM public.job_permission_template_draft_versions
    WHERE template_id = NEW.template_id AND version = NEW.version;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(selected_content->'permissions') permission
    WHERE jsonb_array_length(permission->'actions') > 0
  ) AND NEW.acknowledge_empty_permissions IS NOT TRUE THEN
    RAISE EXCEPTION 'Empty permissions require explicit acknowledgement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;
DROP TRIGGER IF EXISTS trg_job_template_approval_guard ON public.job_permission_template_approvals;
CREATE TRIGGER trg_job_template_approval_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.job_permission_template_approvals
FOR EACH ROW EXECUTE FUNCTION public.guard_job_permission_template_approval();
ALTER TABLE public.job_permission_template_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_permission_template_approvals FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_job_permission_template_approval() FROM PUBLIC;
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.job_permission_template_approvals FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.job_permission_template_approvals FROM authenticated;
  END IF;
END;
$roles$;
COMMIT;