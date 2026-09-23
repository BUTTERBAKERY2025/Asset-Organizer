---
name: Theme tokens are inline (dark class is partial)
description: Why custom CSS must not use var(--color-*) for surfaces in this app, and how to verify a page against the real theme.
---
Rule: style new surfaces with Tailwind token utilities (bg-card, border-border, text-foreground…) or plain light values; do not reference `var(--color-card)` etc. from hand-written CSS for surfaces.

**Why:** `client/src/index.css` declares the palette in `@theme inline`, so utilities compile to literal light values, while `.dark { --color-*: … }` only changes the variables. A component that mixes the two half-flips under the theme toggle (dark cards on a light page) — observed on the branch operations board 2026-09-24. The rest of the app is effectively light-only.

**How to apply:** keep hand-written CSS to layout (container queries, grids, motion); put colors on elements as utilities. `var(--color-ring)`/`var(--color-primary)` for outlines and shadows are harmless.
