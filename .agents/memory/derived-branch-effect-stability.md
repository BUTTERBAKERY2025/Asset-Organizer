---
name: Derived branch scope effect stability
description: Authorized branch arrays can change reference each render; URL-to-form synchronization must settle.
---

Treat derived authorized branch arrays and callbacks closing over them as referentially unstable. URL-to-form synchronization effects must return the existing state when relevant field values are unchanged.

**Why:** A canonical transfer deep link repeatedly allocated identical draft state from a newly derived branch array, causing Maximum update depth exceeded. A healthy source API and an apparent route-loading skeleton did not reveal the render loop; eager mounting exposed it.

**How to apply:** Test actual React rendering with repeated fresh but equivalent permission/branch data, authoritative source hydration and URL context. Do not classify every persistent skeleton as a generic lazy-import problem, and do not suppress error boundaries instead of fixing the state loop.

Validate navigation authority without triggering the UI's authority-refresh loading lifecycle.

**Why:** The canonical operations-manager branch hook intentionally hides rows during refetch. Using that hook's refetch as a click preflight unmounted the selected workspace, invalidated its legitimate unmount guard and silently cancelled the click before source navigation.

**How to apply:** Use a separate fresh no-store preflight bound to actor, source and intent generation. Unchanged grants should leave the current workspace mounted; confirmed revocation must purge/hide stale data and deny navigation. Retain unmount and A→B→A guards rather than weakening them to mask self-cancellation.

Do not finalize a default branch before authorization finishes loading. Keep requested selection separate from the currently authorized selection.

**Why:** A single-branch scheduling account could become stranded on "all" during the temporary empty scope, then have its selector disabled once its sole branch arrived. This is a loading race, not evidence that the user needs broader permissions.

**How to apply:** Derive the usable selection from fresh branches; single-branch users open their authorized branch automatically. Pause scoped queries and draft synchronization during revalidation, preserve multi-branch choices, and distinguish loading/error from confirmed empty access.