---
name: Headless dev screenshots hang in Suspense
description: Protected routes can strand React.lazy despite healthy APIs; do not substitute fixture screenshots for authenticated verification.
---
Treat a protected-page skeleton/watchdog as a real unresolved failure, not an inherent headless-browser limitation.

**Why (updated 2026-10-01):** An authenticated real-login test proved the suspended fiber was the route's React.lazy payload, not the permission guard or a non-lazy hook. Direct imports and APIs succeeded; clearing service-worker/HTTP caches did not fix it. Bounded loader retries alone also failed. Eagerly loading the focused operations HR route preserved its authorization guard and allowed the actual report and attendance drawer to mount. The deeper generic lazy-import cause remains unproven.

**How to apply:** Preserve eager loading for this route unless authenticated mounting is verified after changing it. For another blocked route, capture the actual suspended fiber and executed module rather than assuming healthy APIs imply a working page. Fixture harnesses remain useful for isolated visual checks only; never present them as proof of authenticated navigation. The screenshot tool alone sees login, and repeated local logins are rate-limited.

Full real-page mounting can also work outside App when isolated fixture responses cover its auth/permission/query providers. This is still UI verification, not authenticated end-to-end proof.

**Why:** The kitchen page and its nested dialogs rendered successfully this way, permitting actual 360/390px viewport and visualViewport-only keyboard checks without the App-level suspension.

**How to apply:** Block all fixture API mutations from reaching the real server, mount production page/components rather than approximations, and remove the temporary source/public harness plus any copied build artifact afterward. If using installed Puppeteer, use the system Chromium executable; its expected downloaded Chrome may be absent.

Chromium fixtures may report `(hover: hover)` as false even after Puppeteer moves the mouse and CSS `:hover` matches.

**Why:** Tailwind hover variants can include a hover-capability media query, so a mouse move alone may not reveal a hover-only preview in a headless fixture.

**How to apply:** Check pointer media capabilities when diagnosing previews; verify keyboard focus and explicit touch controls too. Do not assume a hover simulation proves or disproves the interactive behavior without checking visibility.
