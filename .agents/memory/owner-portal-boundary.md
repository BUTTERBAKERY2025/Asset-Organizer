---
name: Owner portal boundaries
description: Owner portal disclosure policy, sales interpretation, and role-first bootstrap.
---

The owner is an oversight reader, not a restricted-looking administrator. Keep its portal separate from operational screens; company-wide shareholder/marketing summaries must not pretend to be filtered by branch. Shareholder disclosure is limited to name, shares, and a clearly labeled registered-share denominator, not assumed legal capital.

**Why:** The user explicitly requested minimal owner information on mobile, PDF export, and marketing visibility without administrative detail. Existing shareholder self-service is identity-bound and must not be repurposed for cross-shareholder owner access.

**How to apply:** Preserve server-side minimized responses and explicit branch grants. Do not enable broad operational permissions to obtain a tile, image, or report. PDF exports must carry the same scope and disclosure restrictions as the screen.

Sales are reported cashier journals, not a promise of live POS or reconciled net revenue. Missing journals are missing data, not zero sales; never add journal and POS totals together.

**Why:** Sources can overlap and refund/net reporting remains a separate concern.

**How to apply:** Keep source/status labels and freshness visible; changing this meaning requires reconciling the sources first.

Owner sales must show the recorded gross amount inclusive of VAT, without adding 15% again, for yesterday and month-to-date as well as custom dates.

**Why:** The user explicitly required inclusive amounts without expanding owner disclosure. The canonical P&L extracts VAT from journal gross; a separate accounting draft generator adds VAT inconsistently and is not the authority for owner sales.

**How to apply:** Preserve the recorded gross amount and honest journal-source label. Any accounting-generator reconciliation is separate work, not a reason to recalculate historical owner totals or expose accounting details.

Do not infer journal lifecycle states from the schema comment alone: production uses `posted` for most completed journals, although the comment lists `submitted` instead.

**Why:** A production read on 2026-09-30 found thousands of posted journals omitted by the initial owner report. Selecting today's date also legitimately had no journals although yesterday had sales.

**How to apply:** Compare reporting filters with the operational aggregate and actual stored statuses. Distinguish missing current-day reports from missing historical data; expose a clearly dated latest-report choice rather than silently relabeling older sales as today's.

Authentication must establish a fresh role before mounting operational providers. Cached identity may support a loading placeholder, never access.

**Why:** Owner isolation intentionally denies the broad legacy bootstrap and notification APIs; eager legacy bootstrap can both leak stale UI and fail for owner sessions.

**How to apply:** Preserve role-first bootstrap and fail-closed cache clearing when roles, branch grants, or sessions change.