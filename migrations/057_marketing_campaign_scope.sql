BEGIN;
ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS scope_type text;
ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS branch_id varchar REFERENCES branches(id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marketing_campaign_scope_valid'
    AND conrelid='marketing_campaigns'::regclass) THEN
    ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaign_scope_valid CHECK ((
      (scope_type IS NULL AND branch_id IS NULL)
      OR (scope_type = 'central' AND branch_id IS NULL)
      OR (scope_type = 'branch' AND branch_id IS NOT NULL)
    ) IS TRUE);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS marketing_campaign_branch_idx ON marketing_campaigns(branch_id);
COMMIT;