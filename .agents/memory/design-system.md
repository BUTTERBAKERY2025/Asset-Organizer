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

**Why:** the cashier-journal-form page had ~14 hardcoded palette families (rainbow) that
ignored the theme and broke dark mode. Restyled to the buckets above.
**How to apply:** when styling/restyling any page, prefer tokens; only use green/amber/
destructive for genuine status meaning. Leave self-contained print/PDF HTML strings
(inline hex colors) untouched — they're paper documents, separate from the on-screen theme.
