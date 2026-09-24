---
name: Authoritative catalogue adoption
description: Safely adopting supplied business codes without losing historical item identities.
---

Treat an authoritative code workbook as the desired business-code catalogue, not as a list of internal record IDs or an automatic deletion allowlist.

**Why:** Existing catalogue records can use locally assigned codes and Arabic-only names while the supplied reference uses numeric/SK codes and bilingual names. A missing code match can be the same existing item, not a new item or obsolete record.

**How to apply:** Resolve identity mappings before any cleanup. Preserve internal IDs, prices, balances and historical references. Review unit differences explicitly; never infer mass/volume conversions. No FK references is insufficient evidence that a record is unused: also check non-FK references, balances and open operations. The chosen cleanup policy is hard deletion only for genuinely unused records; used records require review before deactivation.

Keep usage sections separate from a primary category, and do not interpret a warehouse item list as warehouse allocation or opening balances.

**Why:** The supplied section workbook lists the same ingredient under multiple production sections; its warehouse counterpart specifies codes and units, not warehouse locations or quantities.

**How to apply:** Preserve all matched section memberships without duplicating item identities. Do not change kitchen versus main-warehouse balances when adopting catalogue metadata.

An item missing a supplied price must remain explicitly unavailable until a reviewer provides a price; a missing price is not an approved zero price.

**Why:** The authoritative files describe codes and units, not commercial prices. Automatically activating imported records can make existing POS fallbacks sell them at zero.

**How to apply:** Preserve existing prices during identity adoption. For genuine additions, require an explicit priced/active or unpriced/inactive decision, and enforce inactivity at both selection and write boundaries.

Database names and database OIDs alone do not identify a deployment.

**Why:** Independent PostgreSQL installations can share the same default database name and OID; an operator label or completed-backup flag cannot prove that a backup covers the reviewed target.

**How to apply:** Bind staged reviews and backup manifests to a server-derived installation identity and catalogue snapshot, and reject mismatches before applying.

Deletion proofs must distinguish references by their entity type, not just a column name such as `item_id`.

**Why:** The application uses that name for warehouse stock, fixed assets, voting clauses and checklists. Treating them all as warehouse references makes safe deletion impossible; ignoring them all loses real usage protection.

**How to apply:** Discover FK destinations, separately classify non-FK references, and fail closed for unknown semantic references. Test unused-record deletion with the real schema's unrelated entity columns present, not only a minimal catalogue fixture.

Audit inactive-item write boundaries from reference-writing storage methods, not just page names or create routes.

**Why:** An update/upsert may create a new association, and forecasts or held carts may create operational records indirectly. Checking familiar selectors and POST endpoints repeatedly missed such paths.

**How to apply:** Trace all callers that introduce or replace catalogue IDs; permit unchanged historical associations. When an upsert chooses between creation and an existing association, make that decision and the activity check atomic.