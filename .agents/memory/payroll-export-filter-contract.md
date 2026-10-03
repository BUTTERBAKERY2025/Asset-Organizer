---
name: Payroll export filter contract
description: User expectation that payroll exports honor nationality, job and combined screen filters.
---

Payroll PDF and Excel exports must follow the user's selected nationality, job and other filters together, retaining all matching employees and their report data. Counts and totals must describe the exported subset.

**Why:** The user explicitly reported exports ignoring selections or losing data, and clarified that the exported result should be based on the selected filters.

**How to apply:** Verify file contents and totals against the filtered result, not merely successful downloads. Refreshing authoritative data must not discard the chosen filters. Preserve the existing bank eligibility rules and distinguish their exclusions from arbitrary missing rows.

Unlinked attendance must not be presented as matching an employee filter; exclude it from a filtered employee export with an explicit explanatory note, while preserving it in unfiltered reports.

**Why:** Without an employee identity, nationality/job/payment membership cannot be proven. Including these records would imply a match that is not known.