---
name: Headless dev screenshots hang in Suspense
description: Authenticated in-app screenshots via headless Chromium against the Vite dev server never leave the page-level Suspense skeleton; use a static harness instead.
---
Rule: do not try to screenshot authenticated pages of this app with puppeteer/headless Chromium against the dev server. Every authenticated route (home, branch-operations) stays on App's `DelayedFallback` skeleton forever, then the 20s stuck-page watchdog reloads and shows "تعذّر تحميل الصفحة".

**Why (observed 2026-09-23):** all lazy page/layout imports resolve within ~2s, no console/page errors, no pending requests, i18n initialized, React Query queries built but never fetched (tree never commits). The final suspension is a non-lazy thenable inside the page children; root cause not found after ~2h. Also: the login endpoint rate-limits to HTTP 429 after a few attempts (restarting the workflow resets it), and the Screenshot tool cannot authenticate (login page only).

**How to apply:** for visual verification of a protected page, render the real markup in a throwaway HTML under client/public that links `/src/index.css` (Vite serves compiled Tailwind + scoped rules) and the real `/src/assets/...` files, screenshot it with the Screenshot tool, then delete it. Container-query layouts can be checked at any width by fixing the shell's width in that harness.
