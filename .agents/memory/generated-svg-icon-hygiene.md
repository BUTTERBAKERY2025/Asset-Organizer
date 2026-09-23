---
name: Generated SVG icon hygiene
description: Checks to run on AI-generated SVG illustrations (QuiverAI arrow-1.1-max) before committing them as UI assets.
---
Rule: every generated SVG must pass a lint before it ships, because a defective file still decodes, so an `<img onError>` fallback never fires.

**Why:** one icon in the branch-operations set (sales) came back with stray multilingual text nodes, an unterminated `@media (prefers-color-scheme: dark)` block that filled unclassed paths white, and a full-canvas `m0 0v128h128v-128z` path — invisible on the light contact sheet, degraded for dark-OS users.

**How to apply:** reject and regenerate when the file contains `<script`, `on*=` handlers, `<foreignObject`, `href=`, `@media`, `<text>`, bare text between elements, a full-viewBox rect/path, or `url(#…)` pointing at a missing def (internal gradient refs with a matching `<linearGradient>` are fine). Files use `<style>.cls-N` classes, so always render them via `<img src>` (Vite asset import), never inline, or class names collide across icons.
