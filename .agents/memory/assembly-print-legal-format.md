---
name: Assembly print legal format
description: How the General Assembly محضر/قرار print docs are structured and their data-derivation constraints.
---

# Assembly printed documents = formal legal prose (CMA-ready)

The General Assembly meeting minutes (`assembly-meeting-print.ts`) and single
resolution (`assembly-resolution-print.ts`) print as **official legal-prose
documents** for filing with هيئة السوق المالية — narrative preamble + ordinal
sections (أولاً..سادساً), NOT a dashboard of cards/badges. Do not regress them
back to stat-card layout.

**Why:** the user explicitly needs CMA-ready legal wording matching a Word
template they provided.

**Data-derivation constraints (durable):**
- There is **no canonical total-capital / total-shares field** in the schema.
  Ownership % and quorum % are computed from the sum of `representedShares`
  across the attendance rows. Phrase percentages as "من الأسهم المثبتة في كشف
  الحضور" — never claim "من إجمالي رأس مال الشركة" (would overstate).
- Chairman / secretary are **inferred from attendance rows** (role matching
  /رئيس/ for chairman; `attendeeType==="secretary"` or /أمين/ for secretary).
  Fall back to blank placeholders "(__________)" when not found.
- Hijri date is computed at print time via `Intl.DateTimeFormat` with
  `ar-SA-u-ca-islamic-umalqura-nu-latn` (not stored).
- Resolution legal text comes from `assemblyResolutions.description`; the meeting
  fetch must map `description` (older code only mapped vote tallies).
- Company city (خميس مشيط) and legal form live in the hardcoded DEFAULT_COMPANY,
  not the DB.

**How to apply:** when editing these generators, keep the `<thead>` repeating
letterhead + fixed full-page watermark, escape all DB strings via escapeHtml,
filter image src via safeImageSrc, and guard numeric formatting against NaN
(nfSafe). Print-only feature — no DB/schema change; prod = code deploy only.
