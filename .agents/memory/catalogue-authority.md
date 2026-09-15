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