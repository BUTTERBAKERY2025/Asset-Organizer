-- MANUAL ONLY. Requires 050, 051 and 052. No seeds or existing account writes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.employee_job_template_assignments (
  employee_id integer PRIMARY KEY REFERENCES public.branch_employees(id),
  user_id varchar NOT NULL UNIQUE REFERENCES public.users(id),
  template_id integer NOT NULL,
  version integer NOT NULL,
  branch_id varchar NOT NULL REFERENCES public.branches(id),
  revision uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by varchar NOT NULL REFERENCES public.users(id),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  FOREIGN KEY (template_id, version)
    REFERENCES public.job_permission_template_approvals(template_id, version)
);
-- This stores the last explicit assignment only. Versions/approvals remain
-- immutable; subsequent template edits never rewrite employee authority.
ALTER TABLE public.employee_job_template_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_job_template_assignments FROM PUBLIC;
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.employee_job_template_assignments FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.employee_job_template_assignments FROM authenticated;
  END IF;
END;
$roles$;
COMMIT;