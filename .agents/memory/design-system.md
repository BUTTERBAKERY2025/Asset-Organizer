---
name: Design system / theme
description: The real app theme and how to color components consistently (replit.md is stale on this).
---

# Theme = "Royal Violet" (NOT "Butter Gold")

`replit.md` still says "Butter Gold" — that is outdated. The live theme is defined as
CSS semantic tokens in `client/src/index.css` under `@theme inline` (light) + `.dark`:
`--color-primary` (violet hsl 262 83% 58%), `--color-background`, `--color-card`,
`--color-muted`, `--color-muted-foreground`, `--color-foreground`, `--color-border`,
`--color-accent`, `--color-destructive`. Gold (hsl 42 87% 55%) is only `--color-chart-4`.

## How to color components (so pages match the system + dark mode)
- **Neutrals → tokens, never raw palette:** `bg-muted` (surfaces), `bg-card` (cards),
  `text-muted-foreground` / `text-foreground`, `border-border`. Do NOT use
  gray/zinc/slate-* or `bg-white` directly, and don't hand-write `dark:` neutral
  variants — the tokens already swap in dark mode.
- **Theme accent / info / primary actions → `primary`:** `bg-primary`, `text-primary`,
  `bg-primary/5`, `border-primary/20`. Don't hardcode violet/purple/blue for accents.
- **Status colors carry meaning, keep them consistent app-wide:**
  - success / surplus / positive → green (`text-green-600`, `bg-green-50 dark:bg-green-950/40`, `border-green-200`)
  - error / deficit / shortage / delete / destructive → the `destructive` token (`text-destructive`, `bg-destructive/10`, `border-destructive/30`)
  - warning / mismatch / pending-variance → amber (`text-amber-600`, `bg-amber-50 dark:bg-amber-950/30`)
- **Reserve amber for warnings only** — surplus ("فائض") is success=green (the cashier
  PDF/print document also colors surplus green `#2e7d32`, so on-screen must match).
- A whole page using 10+ raw palette families = visual clash. Route every color to one
  of the buckets above.

## Allowed exception: brand badges
Small per-brand payment badges (VISA navy, Mastercard orange, mada teal, STC violet,
Apple Pay foreground, delivery apps amber) intentionally use real brand-identity colors
via a `BRAND_BADGE` map. These are deliberate, recognizable brand marks (like logos), NOT
the random rainbow. Keep them tiny (badge pills only); everything around them stays on
tokens/status colors.

## Fixed bottom action bar + spacer (cashier-journal-form)
The page has a `fixed bottom-0 ... md:right-64` action bar (payment quick-add chips +
summary stats + save/post buttons). Because it's `position:fixed` it's out of flow, so a
SINGLE in-flow spacer div inside `.page-container` reserves scroll space so the last
content (attachments) isn't hidden behind it. Spacer is conditional on `isReadOnly`
(short when read-only, taller otherwise) and responsive (mobile taller than md).
**Gotcha:** there used to be TWO spacers (a leftover + a new one) → double empty gap;
keep exactly one. If the bar's row count changes, re-tune the spacer height.
**Mobile:** the card-chip row is a single horizontal-scroll row (`overflow-x-auto`,
chips `shrink-0 whitespace-nowrap`) and only `sm:flex-wrap sm:justify-center` on bigger
screens — flex-wrap on phones made the bar grow several lines tall.

## Card-brand logos & add-payment UX (cashier-journal-form)
Bank cards mirror the delivery pattern: a `CARD_BRANDS` map → `client/public/payment-logos/*.png`
(mada/visa/mastercard/apple_pay) in white rounded avatars; methods without a logo
(stc_pay/amex/card_other) fall back to a colored brand badge. `CARD_METHOD_OPTIONS`
is the selectable list — the legacy `card` method ("بطاقة ائتمان (قديم)") is deliberately
EXCLUDED from selection but MUST stay in `PAYMENT_METHODS` so historical rows still render/edit.
Adding a card goes through one deduping helper `addCardPayment(value)` (functional setState,
skips if method already present); `addPaymentBreakdown` is just `addCardPayment("card_other")`.
Both the header dropdown and the sticky quick-add row filter out already-added methods.
**Why:** the old top "إضافة" button silently inserted the legacy `card`; users wanted to pick
the type. **Gotcha:** when downloading brand logos, white/grayscale versions are invisible on
the white avatar — always fetch the COLORED variant and verify visually (mastercard especially).

## Delivery-app logos (cashier-journal-form)
The delivery section uses real app **logos** (a `DELIVERY_BRANDS` map → image files in
`client/public/delivery-logos/*.png`) inside white rounded avatars, plus per-app brand
colors for the active-row ring + text fallback. Logos sourced from the web
(HungerStation, Jahez, Mrsool, Keeta, The Chefz, Ninja `نينجا`). **ToYou has no clean
public logo** — it intentionally falls back to a colored brand badge (navy `#2b2e83` +
"ToYou"). Rows are collapsible (click header to expand inputs); default-open = `amount>0`.
Ninja (real Saudi app, ananinja.com) replaced the now-defunct Talabat; brand color
`#1b2733`.

## Adding/removing a delivery-app payment method touches MANY files
A delivery/payment method key lives in: `shared/schema.ts` (`PAYMENT_METHODS` const
array → drives the `PaymentMethod` type, `PAYMENT_CATEGORIES.apps`, and the typed
`PAYMENT_METHOD_LABELS` record — all three must stay in sync or TS breaks), `server/
routes.ts` (two `deliveryMethods` classification arrays), and client pages: cashier-
journal-form (PAYMENT_METHODS list, BRAND_BADGE, DELIVERY_BRANDS, an inline label map,
a print-filter array), branch-daily-closing + branch-daily-closure-detail label maps,
operations-reports-dashboard (`DELIVERY_APP_COLORS`, `DELIVERY_APP_KEYS`, print filter),
and both `client/src/locales/{ar,en}/operations.json` (`paymentMethods` + `deliveryApps`).
**Grep the whole repo for the key before assuming you're done.**
**Why:** `payment_method` is a plain `text` column (NOT a pgEnum) everywhere, so
adding/renaming a method needs NO DB migration — but renaming an existing key orphans
historical rows that stored the old value (classification/labels miss them); back-fill
with a one-time `UPDATE ... SET payment_method='new' WHERE payment_method='old'` if old
data exists.

**Why:** the cashier-journal-form page had ~14 hardcoded palette families (rainbow) that
ignored the theme and broke dark mode. Restyled to the buckets above. Later the payment
cards were redesigned (brand badge + stacked POS/الجهاز rows + a rounded "الفرق" banner +
count chips, h-9 inputs for iPad) — brand badges are the only sanctioned brand-color use.
**How to apply:** when styling/restyling any page, prefer tokens; only use green/amber/
destructive for genuine status meaning. Leave self-contained print/PDF HTML strings
(inline hex colors) untouched — they're paper documents, separate from the on-screen theme.
