---
name: Async route crash testing
description: Why normal route integration tests missed a production process crash after a successful mutation.
---

For Express 4 async handlers, test rejected database reads through actual router dispatch in an isolated Node subprocess, not only by awaiting handlers directly. Catching transaction errors does not cover reads before the transaction or subsequent GETs mounted by a successful mutation.

**Why:** Local fixtures had the complete schema, while production lacked a feature table. Cancellation committed successfully; its new terminal status mounted a different read. That read rejected outside a catch and terminated the Node process rather than reaching Express error middleware. Subprocess tests reproduced exit code 1; guarded dispatch survived with a controlled error response.

**How to apply:** Preserve explicit async error forwarding around the entire handler. Inject missing-relation and connection failures without real external services. Verify that the process survives and error middleware receives the rejection. Never hide missing schema by returning empty successful data or swallowing uncaught exceptions globally.