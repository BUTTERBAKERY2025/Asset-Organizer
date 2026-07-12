---
name: Leave provision journal & accounting write gaps
description: Invariants for the annual-leave provision journal entry and known weaknesses in the accounting journal subsystem.
---

# Leave provision journal (قيد مخصص الإجازات)

- Provision entry (debit 5210 مصروف مخصص الإجازات / credit 2310 مخصص الإجازات المستحقة) is idempotent per (year + branch scope) via `referenceType='leave_provision'` + deterministic `referenceId`, enforced inside ONE db.transaction with `pg_advisory_xact_lock(hashtext(refId))`. Replace flow renames the old entry's referenceId to `...-superseded-<id>` inside the same transaction.
- **Why:** there is NO unique constraint on accounting_journal_entries reference columns, so a read-then-insert guard alone races and duplicates accounting entries.
- **How to apply:** any new auto-generated journal entry type keyed by a logical period/scope must use the same advisory-lock + in-transaction pattern; don't reuse `storage.createJournalEntry` for idempotent entries (it can't join a transaction).
- CoA accounts 2310/5210 are auto-seeded with `onConflictDoNothing` on first use — no manual prod SQL needed for them.

# Known subsystem weaknesses (pre-existing, not regressions)

- `storage.generateNextEntryNumber()` is `COUNT(*)+1` — race-prone; entry_number has no unique constraint. Harden if journal generation ever becomes concurrent/high-volume.
- Older `/api/accounting/journal-entries*` routes are gated by `isAuthenticated` only (no permission module). New accounting-writing routes should gate stricter (e.g. `requirePermission(module, "edit")`).
- Client must send the year it displays (e.g. `stats.year`) to period-scoped mutation endpoints; server defaulting to "current year" silently posts to the wrong period when the UI shows another year.
