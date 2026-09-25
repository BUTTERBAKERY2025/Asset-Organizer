---
name: Headless dev screenshots hang in Suspense
description: Authenticated in-app screenshots via headless Chromium against the Vite dev server never leave the page-level Suspense skeleton; use a static harness instead.
---
Rule: do not try to screenshot authenticated pages of this app with puppeteer/headless Chromium against the dev server. Every authenticated route (home, branch-operations) stays on App's `DelayedFallback` skeleton forever, then the 20s stuck-page watchdog reloads and shows "تعذّر تحميل الصفحة".

**Why (observed 2026-09-23):** all lazy page/layout imports resolve within ~2s, no console/page errors, no pending requests, i18n initialized, React Query queries built but never fetched (tree never commits). The final suspension is a non-lazy thenable inside the page children; root cause not found after ~2h. Also: the login endpoint rate-limits to HTTP 429 after a few attempts (restarting the workflow resets it), and the Screenshot tool cannot authenticate (login page only).

**How to apply:** for visual verification of a protected page, mount the REAL components: a throwaway `client/src/__harness.tsx` (createRoot + sample props, imports `./index.css`) loaded from a throwaway `client/public/__harness.html` via `<script type=module src="/src/__harness.tsx">`. The static HTML must include the React refresh preamble (`import RefreshRuntime from "/@react-refresh"; injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>t=>t; window.__vite_plugin_react_preamble_installed__=true`) and `/@vite/client`, or the page renders blank. Screenshot with the Screenshot tool, then delete both files. Container-query layouts can be checked at any width by fixing the shell's width; viewport-based `sm:` variants cannot.

Full real-page mounting can also work outside App when isolated fixture responses cover its auth/permission/query providers. This is still UI verification, not authenticated end-to-end proof.

**Why:** The kitchen page and its nested dialogs rendered successfully this way, permitting actual 360/390px viewport and visualViewport-only keyboard checks without the App-level suspension.

**How to apply:** Block all fixture API mutations from reaching the real server, mount production page/components rather than approximations, and remove the temporary source/public harness plus any copied build artifact afterward. If using installed Puppeteer, use the system Chromium executable; its expected downloaded Chrome may be absent.
