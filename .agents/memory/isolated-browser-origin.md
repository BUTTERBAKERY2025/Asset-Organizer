---
name: Isolated browser origin
description: Preserve real origin checks while browser-testing an API-only isolated runtime.
---

An isolated API runtime needs a same-origin static frontend proxy for real built-UI tests. Preserve the browser-facing Host when forwarding requests instead of replacing it with the upstream API authority.

**Why:** Replacing Host while preserving the browser Origin causes legitimate synthetic logins to fail CSRF validation. A temporary proxy also exits between tool calls unless launched as a managed background shell.

**How to apply:** Keep the proxy persistently running for the test, preserve same-origin headers, and clean it and the owned database up afterward. Do not loosen application CSRF checks or start a connected production-backed workflow to work around test setup.