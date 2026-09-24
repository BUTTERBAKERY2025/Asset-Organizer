# Authoritative catalogue staged-import API

This API adopts business codes only after a human review.  It never treats a
workbook code, a source alias, or a similar name as an internal database ID.
All endpoints require an authenticated user whose role is `admin`; branch
permissions and module permissions do not grant this capability.

## Review and staging

`GET /api/admin/catalogue-import/review`

Returns a read-only reconciliation of the three approved workbooks against the
current target catalogue.  The response includes `sourceChecksum`,
`snapshotChecksum`, `targetId`, source totals, rows, and conservative default
actions.  `review` and `legacy_review` rows are not actions.

`POST /api/admin/catalogue-import/stage`

Body:

```json
{
  "targetId": "the configured, independently confirmed target identifier",
  "sourceChecksum": "checksum returned by GET review",
  "snapshotChecksum": "checksum returned by GET review",
  "reviewAcknowledgement": "CATALOGUE_REVIEWED",
  "approvals": [
    {
      "namespace": "products",
      "sourceCode": "SK-100",
      "action": "adopt_code",
      "currentId": 42,
      "identityAcknowledgement": "MANUAL_IDENTITY_CONFIRMED",
      "reason": "Reviewer confirmed Arabic-only existing record 42 is this bilingual source item.",
      "adoptSourceName": false,
      "approvedAliasSections": ["Finish bakery"]
    },
    {
      "namespace": "warehouse",
      "sourceCode": "RM-2",
      "action": "add",
      "category": "raw",
      "availabilityDisposition": "inactive_pending_price"
    },
    {
      "namespace": "products",
      "currentId": 77,
      "action": "deactivate",
      "reviewAcknowledgement": "LEGACY_RECORD_REVIEWED",
      "reason": "Reviewed legacy sales history; retain it but remove from new selection."
    }
  ]
}
```

The endpoint persists an immutable staged plan and returns `planId`,
`planChecksum`, source/snapshot checksums, operations, usage-section
memberships, and a rollback summary. The client must send the exact
`sourceChecksum` and `snapshotChecksum` returned by its review; staging
rejects stale review data. `adopt_code` accepts an explicit internal ID chosen
by the reviewer for either a unique candidate or an Arabic-only/ambiguous
record. It requires `identityAcknowledgement:
"MANUAL_IDENTITY_CONFIRMED"`, a reason, and an equal normalized unit. It does
not infer identity from a name, alias, transliteration, or suggestion.
`adoptSourceName` is opt-in; otherwise the existing name is preserved while
the approved business code is adopted. `add` is accepted only for an
unambiguous, coded source row and requires an explicit primary category. An
addition cannot silently become a zero-priced selectable item: send both a
positive `price` and `availabilityDisposition: "active_priced"` to create an
active item, or explicitly send `availabilityDisposition:
"inactive_pending_price"` to create it unavailable until a separate reviewed
price/activation workflow completes.

`approvedAliasSections` is an optional array for `adopt_code` or `add`. Render
it as unchecked reviewer checkboxes only from that source row's
`categoryMatches` whose `matchedBy` is exactly `"source_alias"` (for example,
SK-0950's reviewed alias matches). The API rejects every value that is not in
that exact row-level allow-list. Alias matches never select an internal record
or create an action by themselves. Canonical-name usage sections remain
additive automatically; checked alias sections are additive memberships with
plan provenance.
`deactivate` and `hard_delete` can only target an explicit legacy record and
require a legacy-review acknowledgement. `hard_delete` is only a request to
prove unused status at apply time; it is never promised by staging. No alias
or name suggestion is converted into an approval.
Every non-exact source row must be handled by an explicit valid `adopt_code`
or `add` approval before apply. A legacy row can be explicitly left untouched
with `action: "defer"`, a reason, and the legacy-review acknowledgement.

## Apply

`POST /api/admin/catalogue-import/plans/:planId/apply`

Headers:

* `Idempotency-Key`: 16–128 characters, unique per plan and actor

Body:

```json
{
  "targetId": "the same configured target identifier",
  "backupId": 123,
  "applyConfirmation": "APPLY_CATALOGUE_<planId>"
}
```

The server rejects application unless all gates pass: the deployment has
configured `CATALOGUE_IMPORT_TARGET_ID`, it exactly matches `targetId`, the
plan has recorded review acknowledgement, `backupId` exists with completed
status and was created after the plan, and that backup has a server-produced
catalogue manifest matching both the server-derived database target identity
and staged catalogue snapshot. The normal `POST /api/backups` flow creates
that manifest only when its `selectedTables` includes **both** `products` and
`warehouse_items`; poll `GET /api/backups` until its status is `completed`
before using the returned backup ID. A generic/manual database row without
that manifest is intentionally rejected. The source checksum must still match
the three workbooks and the current catalogue snapshot must still match the
staged plan. The server globally serializes catalogue applies and takes
write-conflicting locks on both catalogue tables before the final snapshot and
mutation. Repeated requests replay the stored result only when their
idempotency key is bound to the same actor and payload.

`CATALOGUE_IMPORT_TARGET_ID` is an independently provisioned, unique
deployment marker. It is mixed with the PostgreSQL database/server fingerprint
to form the plan and backup target identity; changing it invalidates old
plans/backups. It is a deliberate operator safety control, not a cure for an
operator configuring the same marker on the wrong deployment.

The apply response has `replayed`, `summary`, `operations`, and
`rollbackPlan`. Catalogue metadata changes preserve existing IDs, prices,
stock/balances, and historical rows. Usage sections are additive many-to-many
memberships; they never replace `products.category` or
`warehouse_items.category`.

Before a hard delete the server locks and rechecks the record, all database FK
references, a typed semantic registry of non-FK references, warehouse/branch
stock, and open operations. Newly discovered typed semantic reference columns
outside that registry fail closed until a rule is reviewed and added. If any
reference or balance exists, or this proof cannot be completed, the
transaction is refused. It does not fall back to cascading or broad deletion.
A used legacy item is deactivated only when that explicit reviewed action was
staged.

`GET /api/admin/catalogue-import/plans/:planId`

Returns the staged/applied plan and its auditable stored summary to an admin.
It never accepts an ID from the workbook as a database ID.