---
name: Production evidence boundaries
description: Avoid attributing custom-domain Render failures to unrelated Replit deployment evidence.
---

The custom-domain live service has been hosted on Render with Supabase, while Replit publishing metadata has referred to a separate deployment. Verify the current mapping before using any deployment logs as incident evidence.

**Why:** Successful local requests and a healthy Replit deployment did not explain intermittent gateway failures on the external service. A successful mutation can also precede failing refresh requests; testing only the mutation misses that distinction.

**How to apply:** Read the affected production state without changing it, separate mutation completion from subsequent reads and background work, and match runtime evidence to the actual hosting service. Do not describe a defensive change or passing local test as a proven gateway-outage fix.