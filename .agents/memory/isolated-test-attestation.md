---
name: Database test attestation
description: Temporary schemas are not proof of a safely isolated test database.
---

Every database-writing test must require ownership attestation before connecting for writes; a temporary schema or an integration-test filename is not sufficient isolation.

**Why:** A legacy suite inherited the configured local development database and created a temporary test schema despite the task requiring owned disposable PostgreSQL only. Cleanup did not make that target choice acceptable.

**How to apply:** Use the guarded owned-cluster launcher. Inspect older tests before including them in a broad test command; absent registry/ownership proof must skip or refuse, never fall back to configured database credentials.