---
name: Database test attestation
description: Temporary schemas are not proof of a safely isolated test database.
---

Every database-writing test must require ownership attestation before connecting for writes; a temporary schema or an integration-test filename is not sufficient isolation.

**Why:** A legacy suite inherited the configured local development database and created a temporary test schema despite the task requiring owned disposable PostgreSQL only. Cleanup did not make that target choice acceptable.

**How to apply:** Use the guarded owned-cluster launcher. Inspect older tests before including them in a broad test command; absent registry/ownership proof must skip or refuse, never fall back to configured database credentials.

A generated Drizzle baseline does not prove that a raw-SQL feature's manual schema dependencies are installed.

**Why:** A delivery authorization check first hit a schema-unavailable response rather than exercising authorization; installing only the latest additive migration also failed because its predecessor tables were absent.

**How to apply:** Install the feature's ordered manual dependencies on the attested connection before starting its HTTP checks. Keep schema-readiness failures distinct from authorization denials; never weaken a production schema guard to make the isolated fixture pass.