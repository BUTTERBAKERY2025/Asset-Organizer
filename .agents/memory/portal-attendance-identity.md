---
name: Portal attendance identity matching
description: Why employee self-service attendance reads must match three identity forms, not one.
---

# Attendance reads must match ALL identity forms or manager records disappear

A `attendance_records` row for one person can be keyed three different ways:
- `employee_id = 'branch_emp_<branchEmployeeId>'` — written by the portal self check-in.
- `branch_employee_id = <id>` (integer FK) — set only when employeeId starts with `branch_emp_`.
- `employee_id = <linkedUserId UUID>` — written by the **manager** flow (shift page) which
  stores `employee.linkedUserId || 'branch_emp_<id>'`; UUID-keyed rows get a NULL branch_employee_id.

**Why:** matching by a single form (e.g. branch_employee_id only) silently hides
manager-entered attendance from the employee's بوابتي (today card, monthly list, overview
summary). This was a real audit bug.

**How to apply:**
- Use one shared matcher across every `/api/my` attendance read (overview, monthly, today):
  OR of the three forms. `linkedUserId` comes from `getMyEmployee()` (resolved via
  `branchEmployees.linkedUserId === session userId`), so matching that UUID is safe — it
  provably belongs to the logged-in employee and cannot leak another person's rows.
- Matching multiple forms can return 2 rows for the same day (portal + manager) → dedupe by
  `attendanceDate` keeping the highest `id` (most recent wins) before counting/listing.
- There is NO provenance column, so "who recorded this" is only a heuristic
  (`employeeId === branch_emp_<id>` ⇒ self). It can under-report manager records (false
  negative) but never fabricate a self/manager label — fine for a non-critical badge.

## The matcher must be symmetric across BOTH surfaces (read AND write/check-out)

**Why:** the portal READ matched all 3 forms incl. the numeric `branch_employee_id`
column, but storage's `getAttendanceForAnyIdentityAndDate` (used by check-in dup-guard +
check-out, and the aggregated branch page) matched ONLY by `employee_id` string. So a
checkout on the aggregated page closed one row while the portal read a different open row →
employee stuck "في الدوام". The same endpoint also mixed an exact-match pre-check with an
identity-aware update path → they could pick different rows.

**How to apply:** any code that finds "today's attendance for a person" — portal reads,
storage lookups, AND the aggregated `/api/attendance/check-out-employee` pre-check — must use
the SAME OR-of-all-forms matcher (string forms + numeric `branch_employee_id`), prefer the
OPEN row, else newest. Keep the 42703 missing-column fallback also matching all string forms.
Backfilling `branch_employee_id` for every row (from `branch_emp_<n>` and from
`linked_user_id`) makes the numeric column the canonical unifier and prevents future splits.

## Roster dedup must key on canonical be identity, not raw employeeId string

**Why:** the attendance roster showed the same person twice (one "مكتمل" + one "لم يحضر")
because `employee_schedules` can hold two rows for one person under different identity forms
(`branch_emp_<id>` vs the linked user UUID), and the dedup keyed on the raw `employeeId`
string never collapsed them; attendance matched only one form.

**How to apply:** resolve each schedule row to a canonical `be_<id>` (parse `branch_emp_<n>`,
else `branchEmployeeId` column, else `branchEmployees.linkedUserId === employeeId`; `linkedUserId`
is UNIQUE so this is deterministic, no branch filter needed). Dedup by that key, and when two
rows collapse KEEP the one that has an attendance record so a real attendee is never shown
absent. NOTE: this only merges one-person-two-schedule-identities; two genuinely separate
`branch_employees` profiles (different be id, e.g. English+Arabic data-entry dupes) still need a
profile MERGE — detect via shared STRONG ids (iqama/passport/emp_no/phone), excluding junk
placeholders like '--'/'0'.

## Orphan schedules (deleted-and-recreated profiles) are the most common roster-dup cause

**Why:** when a person's `branch_employees` profile is deleted and re-created with a NEW id
(e.g. backfill: old be N, recreated as be M linked to the login user), their OLD
`employee_schedules` rows (`branch_emp_N` / `branch_employee_id=N`) stay behind as
ORPHANS pointing to a now-nonexistent be. The roster shows the orphan (name from the
schedule's own `employee_name`) NEXT TO the real new profile's row → same person twice. The
canonical-be dedup does NOT merge them (N vs M are different keys), so this is a DATA
problem, not a code one. Re-created profiles often carry an English `employee_name` while the
orphan kept the Arabic transliteration, so name-based twin detection misses them — match
old→new by human eyeballing the day's roster.

**How to apply:** detect orphans = scheduled rows where NO branch_employee resolves
(`NOT EXISTS` over the 3 forms). Cross-reference each orphan against the day's REAL roster
(schedules whose be exists) to map old_be→real_be. Clean by DELETING the orphan schedule
ONLY when the mapped real profile already has a schedule for the same branch+date+shift (so
the person still appears once, zero data loss); wrap in BEGIN/COMMIT, idempotent. Leave
orphans with no confirmed real twin alone (could be a genuinely deleted employee). Diagnostics
live in `supabase_duplicate_employee_profiles_diagnose.sql` (E1 = orphan detector) and the
fix in `supabase_cleanup_orphan_schedules.sql`.
