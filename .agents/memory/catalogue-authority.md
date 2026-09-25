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

Finished goods may be explicitly available for production and internal transfers while pending sales pricing. This is not permission to activate them for POS.

**Why:** The final kitchen list specifies operational units/categories but no prices. During rolling/manual deployments an older server ignores newly added sales flags; making an unpriced row legacy-active before deployment could expose a zero-priced sale.

**How to apply:** Keep unpriced additions legacy-inactive and sales-disabled, with a separate explicit operational opt-in. New production consumers honor that opt-in; sales consumers must still require sales eligibility and a positive reviewed price. Never infer that changing "قطعة" to "بوكس" preserves the stock-count meaning without reviewing package identity.

For the final kitchen finished-goods list, the user explicitly chose all-new identities rather than reusing the old catalogue, with prices to be supplied later. This is an exception to the usual preserve-matched-identity adoption strategy.

**Why:** Existing codes all differed, several packs/units were ambiguous, and some names were duplicated. The user chose a fresh catalogue after those consequences were explained.

**How to apply:** Do not treat the saved name-match candidates as approved mappings. Keep legacy history/stock/prices on their original identities; do not automatically copy prices, move balances, or attach old recipes to new products.

The user also explicitly chose all-new warehouse identities, despite overlapping business codes: zero opening balances, unspecified prices, and old identities archived with their balances/history intact.

**Why:** Preserving matched warehouse identities was offered as the recommended alternative, but the user chose fresh records. Reusing old IDs or transferring old balances would contradict that decision.

**How to apply:** An archived and a current warehouse row may intentionally share a business code. Resolve new operations/pricing to the current identity, not the first code match; historical operations remain ID-bound. Unpriced warehouse materials may be requested internally, but missing cost must not be presented as an approved zero valuation. Do not reactivate old ingredients or attach existing recipes automatically.

Database names and database OIDs alone do not identify a deployment.

**Why:** Independent PostgreSQL installations can share the same default database name and OID; an operator label or completed-backup flag cannot prove that a backup covers the reviewed target.

**How to apply:** Bind staged reviews and backup manifests to a server-derived installation identity and catalogue snapshot, and reject mismatches before applying.

Deletion proofs must distinguish references by their entity type, not just a column name such as `item_id`.

**Why:** The application uses that name for warehouse stock, fixed assets, voting clauses and checklists. Treating them all as warehouse references makes safe deletion impossible; ignoring them all loses real usage protection.

**How to apply:** Discover FK destinations, separately classify non-FK references, and fail closed for unknown semantic references. Test unused-record deletion with the real schema's unrelated entity columns present, not only a minimal catalogue fixture.

Audit inactive-item write boundaries from reference-writing storage methods, not just page names or create routes.

**Why:** An update/upsert may create a new association, and forecasts or held carts may create operational records indirectly. Checking familiar selectors and POST endpoints repeatedly missed such paths.

**How to apply:** Trace all callers that introduce or replace catalogue IDs; permit unchanged historical associations. When an upsert chooses between creation and an existing association, make that decision and the activity check atomic.

Batch remote catalogue inserts rather than issuing one network request per row while holding an exclusive lock.

**Why:** Round-trip latency alone can exceed the shell execution budget and roll back a healthy migration while blocking operational writers.

**How to apply:** Validate the entire source before locking; use parameterized bulk insertion, then verify and commit atomically. After a timeout, independently check the audit record and committed counts before retrying.

Compare backup fields using their database types, not raw JSON equality.

**Why:** Node's PostgreSQL driver serializes NUMERIC values as strings and timestamps with different formatting/precision from PostgreSQL JSON; a direct JSON comparison can falsely flag every unchanged record.

**How to apply:** Normalize numeric/date representations explicitly during independent verification while comparing business names, codes and other fields exactly.