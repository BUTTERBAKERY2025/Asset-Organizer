---
name: Operations performance evidence
description: Sales definition and period consistency across the operating center, source drilldowns and assistant.
---

The performance center's registered sales measure uses approved/posted cashier journal total sales, consistently with Sales Analytics. It is not net sales, not an assertion of complete operating-day coverage, and not a sum of journal totals and daily closures.

**Why:** Closed-day snapshots and journal-based source links previously represented different facts under the same label, leaving the chart blank or inconsistent with its destination. Financial return/net semantics are a separate concern.

**How to apply:** Keep closure evidence separate for monthly operating review. Preserve exact date range and branch scope across chart, detail, assistant and source navigation. A recorded zero differs from no eligible records; missing days remain unknown. Current follow-up counts are a bounded as-of snapshot, not a sales-period trend.

Assistant evidence identity must depend on underlying authorized evidence, not visible queue pagination or refresh timestamps.

**Why:** The assistant reads the first page while the user may be on another page; including next-page flags rejected valid responses despite unchanged evidence.

**How to apply:** Invalidate suggestions when actual scope, period or evidence changes, and permit only server-authorized source links, including valid evidence outside the currently displayed queue.