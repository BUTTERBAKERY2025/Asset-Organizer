---
name: Permission timestamp decoding
description: Raw SQL and Drizzle reads must interpret timestamp-without-zone identically.
---

Use the existing schema timestamp decoder when raw SQL reads authority dates that other paths read through Drizzle; do not pass offset-free raw database strings directly to JavaScript Date.

**Why:** PostgreSQL override timestamps read through raw execute were interpreted in the process time zone, while Drizzle interpreted them as UTC. Untampered additions consequently failed provenance checks and became protected accounts. A permissive integrity comparison would hide the real defect.

**How to apply:** Keep timestamp-without-zone decoding consistent for validity and provenance dates, leave timestamptz offset-aware, and cover non-UTC process zones and actual database round trips. Never fix this by ignoring timestamp mismatches.