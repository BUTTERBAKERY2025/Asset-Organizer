---
name: Assembly re-vote grants
description: Invariants for the assembly resolution re-vote (إعادة فتح التصويت) feature
---

Admin reopens voting for a specific shareholder on a whole (legacy) resolution OR a clause (بند).
Shareholder re-votes via portal or a one-time WhatsApp token link. Last vote supersedes; tallies
(heads + shares) auto-adjust; old vote archived to systemAuditLogs; latest signature authoritative.
Core supersede logic lives in `castOrSupersedeVote` (server/assembly-revote.ts) and runs inside a tx.

**Rule: grant consumption must be atomic.** Never read-then-update a grant's status across separate
statements — that double-spends the "one-time" link under concurrency. Claim with a conditional
transition `UPDATE assembly_revote_grants SET status='used' WHERE id=? AND status='open' RETURNING *`
and assert exactly one row changed BEFORE casting the vote (inside the same tx, so a failed cast
rolls back the claim). Applies to all 3 paths: public token POST, portal /vote, portal item /vote.
**Why:** two concurrent requests both passed a non-locked status read and both cast votes.

**Rule: a whole-resolution grant (itemId=null) is invalid when the resolution has clauses.** Reject
at grant creation (admin endpoint) so the portal/public consumption paths can trust that a whole
grant implies no clauses. Otherwise the grant path bypasses live voting's strict per-clause mode.
