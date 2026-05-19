-- Floor Plan Multi-task Links
-- Visual lines connecting two assignments in the same shift to indicate a
-- shared / multi-task role. Purely visual; doesn't affect RBAC or scheduling.
--
-- IMPORTANT: Run this on Supabase BEFORE deploying the new code to Render.

CREATE TABLE IF NOT EXISTS floor_plan_links (
  id                  serial PRIMARY KEY,
  floor_plan_id       integer NOT NULL REFERENCES branch_floor_plans(id) ON DELETE CASCADE,
  shift_type          text NOT NULL DEFAULT 'morning',
  from_assignment_id  integer NOT NULL REFERENCES floor_plan_assignments(id) ON DELETE CASCADE,
  to_assignment_id    integer NOT NULL REFERENCES floor_plan_assignments(id) ON DELETE CASCADE,
  label               text,
  color               text NOT NULL DEFAULT '#6366f1',
  created_at          timestamp NOT NULL DEFAULT now(),
  CONSTRAINT floor_plan_links_no_self CHECK (from_assignment_id <> to_assignment_id),
  -- Defence-in-depth: enforce a canonical ordering so the pair (A,B) and
  -- (B,A) cannot both exist regardless of insert path. Storage layer
  -- normalizes to min/max before insert; this CHECK is the DB backstop.
  CONSTRAINT floor_plan_links_ordered_pair CHECK (from_assignment_id < to_assignment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plan_links_pair
  ON floor_plan_links (floor_plan_id, shift_type, from_assignment_id, to_assignment_id);

CREATE INDEX IF NOT EXISTS idx_floor_plan_links_plan_shift
  ON floor_plan_links (floor_plan_id, shift_type);
