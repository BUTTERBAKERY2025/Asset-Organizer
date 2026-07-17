---
name: EOS Saudi labor law calc
description: End-of-service gratuity rules and print form conventions for the EOS module
---
Rule: EOS gratuity base = last TOTAL wage (الأجر الأخير الشامل, Art 84), never the basic salary alone. Half-month per year for first 5 years, full month after, pro-rated fractions. Resignation tiers (Art 85): <2y none, 2-5y 1/3, 5-10y 2/3, 10y+ full. Art 80 termination = zero. Art 87 (marriage/childbirth resignation, force majeure) = full.
**Why:** original implementation used basic salary — legally wrong; corrected 2026-07-14.
**How to apply:** any new EOS-related surface (reports, exports, payroll linkage) must reuse the server /api/hr/eos/calculate output, not re-derive amounts; termination types are an extended enum shared across schema zod, server zod, and TERMINATION_TYPE_LABELS — keep all three in sync when adding cases.
Vacation auto-fill parity: EOS calculate must use the SAME governing rule as leave approval — contract annualLeaveDays set → accrual balance as-of the EOS end date; else yearly leave_balances summary. Keep the two gates in sync to avoid drift.
Print: settlement (مخالصة) form uses the shared print-window shell (localStorage handoff, CSP-exempt page); harden against legacy rows (nullable/typed-loose fields) before string ops.
