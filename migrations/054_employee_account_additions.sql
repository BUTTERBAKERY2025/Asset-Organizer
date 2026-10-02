-- MANUAL ONLY. Independent provenance for explicitly created overrides.
-- No legacy adoption, seed, direct-base write, role write or deny conversion.
BEGIN;
ALTER TABLE public.user_permission_overrides ADD COLUMN IF NOT EXISTS starts_at timestamp;
CREATE TABLE IF NOT EXISTS public.employee_account_additions (
  override_id integer PRIMARY KEY REFERENCES public.user_permission_overrides(id) ON DELETE CASCADE,
  employee_id integer NOT NULL REFERENCES public.branch_employees(id),
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_branch_id varchar NOT NULL REFERENCES public.branches(id),
  revision uuid NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_by varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_account_additions_user ON public.employee_account_additions(user_id);
ALTER TABLE public.employee_account_additions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_account_additions FROM PUBLIC;
DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.employee_account_additions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.employee_account_additions FROM authenticated;
  END IF;
END;
$roles$;
COMMIT;