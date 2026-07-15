---
name: Print-window asset embedding (logos/images)
description: Why printable HTML built with window.open + document.write must embed images as base64 data URIs, and how the per-page watermark works.
---

# Print-window asset embedding

Printable documents in this app are generated as HTML strings and rendered via
`window.open("", "_blank")` + `document.write(html)` + `w.print()`.

**Rule:** any image that must appear in those print windows (company logo, watermark)
must be embedded as a `data:` URI, not referenced by a relative URL like
`/company-logo.png`.

**Why:** the new window has an `about:blank` (opaque) origin, so relative/root-relative
asset URLs do not resolve to the app origin and the image silently fails to load —
often only visible as a blank logo at print time. Fetching the asset in the app
context and converting it to base64 (see `client/src/lib/company-logo-data.ts`,
`getCompanyLogoDataUri()`) sidesteps origin + network-timing issues.

**How to apply:** cache only the *successful* data URI (never cache `null`), or a
transient first-load failure locks the whole session into the fallback for that asset.

## Official letterhead + watermark pattern
- Per-page repeating watermark on printed A4: a single `position: fixed` element
  (centered, low opacity ~0.06) repeats on every page in Chrome print. Give the
  document container `position: relative; z-index: 1` and the watermark `z-index: 0`
  so text stays above it.
- **Do NOT use `transform: translate(-50%,-50%)` to center a `position:fixed`
  watermark** — it triggers a Chrome print bug that injects a blank first page.
  Center with a full-page fixed flex container instead:
  `.watermark{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center}`.
- **Repeating the letterhead/header on every printed page:** wrap the whole document
  in a `<table>` with the header in `<thead>` and all content in one `<tbody><tr><td>`.
  Browsers auto-repeat `<thead>` at the top of every printed page (the bulletproof
  running-header technique). Gotchas: a global `tr { page-break-inside: avoid }` will
  stop the big tbody row from paginating — override with
  `.page-wrap > tbody > tr { page-break-inside: auto; break-inside: auto; }`; and reset
  wrapper cells (`padding:0;border:none;background:transparent`) so they don't inherit
  global `td`/zebra styling. Nested real tables inside the tbody cell keep their styles.
- Watermark shows through whitespace only; opaque cell/section backgrounds will hide
  it, which is the expected "official paper" look.
- User-supplied images (e.g. signature URLs) still must pass through `safeImageSrc`
  (data:image or https only); the self-fetched same-origin logo is trusted and does not.
- Used by the General Assembly print generators: `assembly-meeting-print.ts` and
  `assembly-resolution-print.ts`.

## Escape DB text before document.write (XSS)
- These print/export generators interpolate DB-sourced strings (employee/branch/
  department names, job titles, notes) directly into an HTML string fed to
  `document.write` / iframe write. That is a stored-XSS sink: any malicious value
  persisted in a profile field runs as script in the app's same origin at print time.
- **Rule:** run every dynamic text field through an `escapeHtml` helper before
  concatenation. Numeric fields formatted via `fmt`/`toLocaleString` are safe.
- **How to apply:** when adding a new print/PDF generator, escape text at the
  interpolation site (see `escapeHtml` in `salary-closing.tsx` accrued-salaries PDF).

- print-document.html shell: its own <style> (flex-centering "جارٍ تجهيز") can leak into the written print doc in prod — shell now strips old <style> nodes before document.write, and print docs should include `html,body{display:block !important;height:auto !important}` reset as defense.
