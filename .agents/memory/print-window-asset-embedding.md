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
- Watermark shows through whitespace only; opaque cell/section backgrounds will hide
  it, which is the expected "official paper" look.
- User-supplied images (e.g. signature URLs) still must pass through `safeImageSrc`
  (data:image or https only); the self-fetched same-origin logo is trusted and does not.
- Used by the General Assembly print generators: `assembly-meeting-print.ts` and
  `assembly-resolution-print.ts`.
