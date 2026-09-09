---
name: Idempotency replay authorization
description: Security rules for safely replaying branch-scoped create and workflow requests.
---

An idempotent replay must authorize access to the persisted resource, not only validate the branch or fields in the new retry request. Creation keys must be bound to a canonical payload fingerprint, and transition keys must be bound to the intended event and target state.

**Why:** A user can lose access to the branch where an earlier request was created. If a reused key returns the stored result after checking only the new request, it can disclose the old branch resource. A transition key reused for another action can also report false success.

**How to apply:** On every normal replay, race-recovery replay, and unique-conflict path, load the stored fingerprint or operation identity, reject mismatches, re-run authorization against the stored resource, and only then return it.