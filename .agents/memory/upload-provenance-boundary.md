---
name: Upload provenance boundary
description: Why a matching document URL is not enough to authorize generic file downloads.
---

Treat user-editable attachment URLs as claims, not proof that the uploader owned the object. Generic downloads need server-authenticated provenance in addition to resource permissions.

**Why:** Adding record/branch checks alone still allowed a guessed orphan object key to be pasted into an editable expense or attachment record, thereby manufacturing an authorized reference.

**How to apply:** Check whether reference fields can be freely written before using them as file ACLs. Fail closed for unverifiable legacy objects; do not re-enable them merely to restore a preview. Avoid monolithic reference queries that fail all downloads when an unrelated optional table is absent.