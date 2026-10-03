-- MANUAL ONLY. Additive preparation; does not migrate or alter any live grant.
-- Requires 051/052. Server-only. No application startup DDL.
BEGIN;
CREATE TABLE IF NOT EXISTS public.branch_employee_template_assignments (
  user_id varchar NOT NULL REFERENCES public.users(id),
  branch_id varchar NOT NULL REFERENCES public.branches(id),
  employee_id integer NOT NULL REFERENCES public.branch_employees(id),
  template_id integer NOT NULL,
  version integer NOT NULL,
  revision uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by varchar NOT NULL REFERENCES public.users(id),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  PRIMARY KEY (user_id, branch_id),
  UNIQUE (employee_id, branch_id),
  FOREIGN KEY (template_id, version)
    REFERENCES public.job_permission_template_approvals(template_id, version)
);
ALTER TABLE public.branch_employee_template_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branch_employee_template_assignments FROM PUBLIC;
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.branch_employee_template_assignments FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.branch_employee_template_assignments FROM authenticated;
  END IF;
END;
$roles$;
COMMIT;