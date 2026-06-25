---
name: Governance print & unified resolutions
description: How board/assembly/minutes "official document" printing is shared, and how a cross-type page must fetch across permission modules.
---

# Governance signed-document printing

The three governance document types each have their own print path that builds a self-contained
RTL HTML doc (window.open + document.write + setTimeout print) with company letterhead, watermark,
electronic signatures, and Hijri/Gregorian dates:
- board resolutions → `client/src/lib/board-resolution-print.ts`
- assembly resolutions → `client/src/lib/assembly-resolution-print.ts`
- meeting minutes → `client/src/lib/meeting-minutes-print.ts`

**Rule:** keep each print routine in its shared lib as the single source of truth. The owning page
(voting.tsx, assembly-minutes.tsx) calls the lib via a thin wrapper. The unified
`signed-resolutions.tsx` page reuses the same libs so a fix to a document layout lands everywhere.
**Why:** these print functions were duplicated/inline and drifted; lifting them verbatim into libs
avoids two copies of ~400-line HTML generators.

**How to apply:** minutes printing needs the parent meeting record (for date/type/location), so the
caller passes the `GovernanceMeeting` in; the lib falls back to `new Date()` if meeting is undefined.

## Cross-module permission gotcha
A page that aggregates multiple governance types fetches endpoints guarded by DIFFERENT permission
modules (e.g. `/api/governance/resolutions` = governance_resolutions vs `/api/governance/minutes`
and `/api/governance/meetings` = governance_meetings). A user may hold one but not the other.
**Rule:** for the secondary-module fetches, use a tolerant queryFn that returns `[]` on 401/403
(and only throws on other non-ok) so the page degrades gracefully instead of erroring out.
