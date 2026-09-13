---
name: Idempotency replay authorization
description: Security rules for safely replaying branch-scoped create and workflow requests.
---

An idempotent replay must authorize access to the persisted resource, not only validate the branch or fields in the new retry request. Creation keys must be bound to a canonical payload fingerprint, and transition keys must be bound to the intended event and target state.

**Why:** A user can lose access to the branch where an earlier request was created. If a reused key returns the stored result after checking only the new request, it can disclose the old branch resource. A transition key reused for another action can also report false success.

**How to apply:** On every normal replay, race-recovery replay, and unique-conflict path, load the stored fingerprint or operation identity, reject mismatches, re-run authorization against the stored resource, and only then return it.

Contract regression tests must use the browser's actual idempotency transport, not only a header-based substitute.

**Why:** Header-only integration tests passed while the live kitchen UI sent a body key rejected by strict validation. Schema acceptance and key extraction must both support the chosen transport.

**How to apply:** Test body-only creation/replay when the UI sends JSON keys; retain header compatibility and reject mismatched body/header keys without loosening unknown-field validation.

An uncertain delivery must retain its original key and payload across subsequent errors, including authentication failures.

**Why:** A retry rejected with 401/403 does not prove the earlier network-uncertain request failed to commit. Freeing its key can turn the next login/retry into duplicate stock posting.

**How to apply:** Keep attempted intents until durable success or explicit warned discard. Scope browser persistence and late response callbacks by user, branch, operation, and active intent key; storage namespacing alone does not protect component state after navigation.

Durable manual-production keys have no automatic expiry, and successful responses are stored in the same transaction as their stock effects.

**Why:** Expiring an unresolved key or reconstructing its response from an edited/deleted batch breaks retry guarantees. Server-generated timestamps must not change the canonical request fingerprint between retries.

**How to apply:** Use the manual workflow's header transport, normalize accepted business fields, preserve explicit client timestamps when present, and replay stored JSON only after current authorization. Missing operation storage must fail explicitly rather than execute without protection.