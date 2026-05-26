-- =============================================================================
-- GOVERNANCE PHASE 1 — Saudi Companies Law M/132 & CMA Nomu Compliance Foundation
-- =============================================================================
-- Run this ONCE in Supabase SQL Editor BEFORE deploying the new server code.
-- All statements are IF [NOT] EXISTS / idempotent — safe to re-run.
--
-- Goals:
--   1. Separate Board Resolutions from Assembly Resolutions (legal distinction).
--   2. Add immutability (lock) to resolutions and meeting minutes once signed.
--   3. Create Insider Register & Blackout Periods (Nomu listing requirement).
--   4. Migrate the existing EGM resolution out of board_resolutions.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) LOCK COLUMNS — immutability on signed/approved corporate records
-- -----------------------------------------------------------------------------
ALTER TABLE board_resolutions
  ADD COLUMN IF NOT EXISTS is_locked   boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at   timestamp NULL,
  ADD COLUMN IF NOT EXISTS locked_by   varchar   NULL REFERENCES users(id);

ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS is_locked   boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at   timestamp NULL,
  ADD COLUMN IF NOT EXISTS locked_by   varchar   NULL REFERENCES users(id);

-- -----------------------------------------------------------------------------
-- 2) ASSEMBLY RESOLUTIONS — separate table for General Assembly decisions
--    (Ordinary OGM and Extraordinary EGM resolutions have legally distinct
--     quorums, majority requirements, and disclosure obligations from Board
--     resolutions and MUST NOT live in the same table.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assembly_resolutions (
  id                      serial PRIMARY KEY,
  resolution_number       text NOT NULL UNIQUE,
  meeting_id              integer NULL REFERENCES governance_meetings(id),
  assembly_type           text NOT NULL,   -- 'ordinary' | 'extraordinary'
  resolution_type         text NOT NULL,   -- regular | dividend | capital_change | statute_amendment | merger | dissolution | board_election
  majority_type           text NOT NULL DEFAULT 'simple', -- 'simple' | 'two_thirds' | 'three_quarters'
  title                   text NOT NULL,
  description             text NOT NULL,
  category                text NULL,
  priority                text NULL DEFAULT 'normal',
  proposed_by             varchar NULL REFERENCES users(id),
  proposed_at             timestamp NOT NULL,
  voting_required         boolean NULL DEFAULT true,
  voting_deadline         timestamp NULL,
  for_votes               integer NULL DEFAULT 0,
  against_votes           integer NULL DEFAULT 0,
  abstain_votes           integer NULL DEFAULT 0,
  total_votes             integer NULL DEFAULT 0,
  for_shares              numeric(18,4) NULL DEFAULT 0,    -- share-weighted vote totals (assemblies vote by shares, not heads)
  against_shares          numeric(18,4) NULL DEFAULT 0,
  abstain_shares          numeric(18,4) NULL DEFAULT 0,
  required_majority       numeric(5,2)  NULL DEFAULT 50.00,
  quorum_capital_pct      numeric(5,2)  NULL,             -- % of capital present (must meet quorum threshold)
  status                  text NULL DEFAULT 'draft',
  approved_at             timestamp NULL,
  implementation_deadline date NULL,
  implementation_status   text NULL DEFAULT 'pending',
  implemented_at          timestamp NULL,
  responsible_person      varchar NULL REFERENCES users(id),
  financial_impact        numeric(15,2) NULL,
  attachments             jsonb NULL,
  related_resolutions     integer[] NULL,
  expiry_date             date NULL,
  notes                   text NULL,
  is_locked               boolean NOT NULL DEFAULT false,
  locked_at               timestamp NULL,
  locked_by               varchar NULL REFERENCES users(id),
  created_by              varchar NULL REFERENCES users(id),
  created_at              timestamp NOT NULL DEFAULT now(),
  updated_at              timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assembly_resolutions_meeting       ON assembly_resolutions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_assembly_resolutions_assembly_type ON assembly_resolutions(assembly_type);
CREATE INDEX IF NOT EXISTS idx_assembly_resolutions_status        ON assembly_resolutions(status);
CREATE INDEX IF NOT EXISTS idx_assembly_resolutions_type          ON assembly_resolutions(resolution_type);

-- Parallel vote & signature tables for assembly resolutions (mirror the
-- board_resolutions side; kept separate to preserve clean FKs and the legal
-- distinction). Both empty so no data migration.
CREATE TABLE IF NOT EXISTS assembly_resolution_votes (
  id                      serial PRIMARY KEY,
  resolution_id           integer NOT NULL REFERENCES assembly_resolutions(id) ON DELETE CASCADE,
  shareholder_id          integer NULL REFERENCES shareholders(id),
  voter_name              text NOT NULL,
  vote                    text NOT NULL,            -- for | against | abstain
  shares_voted            numeric(18,4) NULL,       -- weighted by shares held
  voted_at                timestamp NOT NULL DEFAULT now(),
  vote_method             text NULL DEFAULT 'in_meeting',
  proxy_vote_id           integer NULL,             -- if cast via proxy
  ip_address              text NULL,
  device_info             text NULL,
  signature_url           text NULL,
  comments                text NULL,
  is_valid                boolean NULL DEFAULT true,
  invalidation_reason     text NULL,
  created_at              timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assembly_votes_resolution  ON assembly_resolution_votes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_assembly_votes_shareholder ON assembly_resolution_votes(shareholder_id);

CREATE TABLE IF NOT EXISTS assembly_resolution_signatures (
  id                      serial PRIMARY KEY,
  resolution_id           integer NOT NULL REFERENCES assembly_resolutions(id) ON DELETE CASCADE,
  shareholder_id          integer NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  signer_name             text NULL,
  signature_token         text NOT NULL UNIQUE,
  signature_data          text NULL,
  signature_type          text NULL DEFAULT 'draw',
  status                  text NOT NULL DEFAULT 'pending',
  signed_at               timestamp NULL,
  declined_at             timestamp NULL,
  decline_reason          text NULL,
  ip_address              text NULL,
  user_agent              text NULL,
  expires_at              timestamp NULL,
  reminder_sent_at        timestamp NULL,
  reminder_count          integer NULL DEFAULT 0,
  created_at              timestamp NOT NULL DEFAULT now(),
  updated_at              timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assembly_sigs_resolution  ON assembly_resolution_signatures(resolution_id);
CREATE INDEX IF NOT EXISTS idx_assembly_sigs_shareholder ON assembly_resolution_signatures(shareholder_id);

-- -----------------------------------------------------------------------------
-- 3) MIGRATE THE EXISTING EGM ROW out of board_resolutions
--    The row id=7 "RES-2025-EGM-001" is titled "قرارات الجمعية العامة غير العادية"
--    — it is an Extraordinary General Assembly resolution that was saved in the
--    wrong table. We move it now and delete the original. Empty resolution_votes
--    and resolution_signatures for this row mean no FK cleanup is needed.
-- -----------------------------------------------------------------------------
INSERT INTO assembly_resolutions (
  resolution_number, meeting_id, assembly_type, resolution_type, majority_type,
  title, description, category, priority, proposed_by, proposed_at,
  voting_required, voting_deadline, for_votes, against_votes, abstain_votes, total_votes,
  required_majority, status, approved_at,
  implementation_deadline, implementation_status, implemented_at, responsible_person,
  financial_impact, attachments, related_resolutions, expiry_date, notes,
  is_locked, locked_at, locked_by,
  created_by, created_at, updated_at
)
SELECT
  resolution_number, meeting_id,
  'extraordinary',                       -- assembly_type
  COALESCE(resolution_type, 'regular'),  -- preserve original type
  'two_thirds',                          -- EGM default majority
  title, description, category, priority, proposed_by, proposed_at,
  voting_required, voting_deadline, for_votes, against_votes, abstain_votes, total_votes,
  required_majority, status, approved_at,
  implementation_deadline, implementation_status, implemented_at, responsible_person,
  financial_impact, attachments, related_resolutions, expiry_date, notes,
  true,                                  -- lock approved historical row immediately
  CASE WHEN status = 'approved' THEN COALESCE(approved_at, now()) ELSE NULL END,
  created_by,
  created_by, created_at, updated_at
FROM board_resolutions
WHERE resolution_number = 'RES-2025-EGM-001'
  AND NOT EXISTS (SELECT 1 FROM assembly_resolutions ar WHERE ar.resolution_number = 'RES-2025-EGM-001');

DELETE FROM board_resolutions WHERE resolution_number = 'RES-2025-EGM-001';

-- Lock any other already-approved board resolutions historically (defensive —
-- once approved, a board resolution must not be silently editable).
UPDATE board_resolutions
SET is_locked = true,
    locked_at = COALESCE(approved_at, updated_at, now())
WHERE status IN ('approved','implemented')
  AND is_locked = false;

-- Same for meeting_minutes with status 'signed' or 'approved'
UPDATE meeting_minutes
SET is_locked = true,
    locked_at = COALESCE(reviewed_at, updated_at, now())
WHERE status IN ('signed','approved','archived')
  AND is_locked = false;

-- -----------------------------------------------------------------------------
-- 4) INSIDER TRADING REGISTER (CMA / Nomu listing requirement)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insider_register (
  id                   serial PRIMARY KEY,
  full_name            text NOT NULL,
  national_id          text NULL,
  position             text NOT NULL,         -- board_member | senior_executive | auditor | consultant | relative_of_insider | other
  relationship_to      integer NULL,          -- if 'relative_of_insider', points to another insider_register.id
  related_board_member_id integer NULL REFERENCES board_members(id),
  related_user_id      varchar NULL REFERENCES users(id),
  email                text NULL,
  phone                text NULL,
  notification_method  text NULL DEFAULT 'email', -- email | sms | both
  start_date           date NOT NULL,
  end_date             date NULL,             -- null = still an insider
  reason_added         text NULL,
  reason_removed       text NULL,
  acknowledgment_signed boolean NOT NULL DEFAULT false, -- did they sign the insider obligations form
  acknowledgment_date  date NULL,
  acknowledgment_doc_url text NULL,
  status               text NOT NULL DEFAULT 'active', -- active | inactive | suspended
  notes                text NULL,
  created_by           varchar NULL REFERENCES users(id),
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insider_register_status   ON insider_register(status);
CREATE INDEX IF NOT EXISTS idx_insider_register_position ON insider_register(position);
CREATE INDEX IF NOT EXISTS idx_insider_register_member   ON insider_register(related_board_member_id);

CREATE TABLE IF NOT EXISTS insider_blackout_periods (
  id                   serial PRIMARY KEY,
  title                text NOT NULL,
  period_type          text NOT NULL,         -- pre_earnings | pre_disclosure | event_specific | other
  start_date           date NOT NULL,
  end_date             date NOT NULL,
  related_disclosure_id integer NULL,         -- link to disclosures table if applicable
  description          text NULL,
  applies_to_all       boolean NOT NULL DEFAULT true,
  specific_insider_ids integer[] NULL,        -- if applies_to_all=false
  notification_sent_at timestamp NULL,
  status               text NOT NULL DEFAULT 'active', -- active | cancelled | completed
  created_by           varchar NULL REFERENCES users(id),
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now(),
  CONSTRAINT blackout_dates_valid CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_blackout_status ON insider_blackout_periods(status);
CREATE INDEX IF NOT EXISTS idx_blackout_dates  ON insider_blackout_periods(start_date, end_date);

-- -----------------------------------------------------------------------------
-- 5) VERIFICATION SNAPSHOT (read-only — for your eyes)
-- -----------------------------------------------------------------------------
-- Run these SELECTs after COMMIT to confirm the migration:
--   SELECT count(*) FROM assembly_resolutions;          -- should be 1
--   SELECT count(*) FROM board_resolutions;              -- should be 0
--   SELECT count(*) FROM insider_register;               -- should be 0 (new empty table)
--   SELECT count(*) FROM insider_blackout_periods;       -- should be 0
--   SELECT is_locked FROM assembly_resolutions
--      WHERE resolution_number='RES-2025-EGM-001';       -- should be true

COMMIT;
