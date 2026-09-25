---
name: Mobile dialogs and virtual keyboards
description: Fixed dialog action bars need visual-viewport bounds, not just dynamic viewport CSS.
---

Size and position keyboard-sensitive dialogs using the visual viewport, with ordinary viewport fallbacks.

When simulating a keyboard, changing `visualViewport.height` alone is not a resize test: dispatch its `resize` event and wait for layout before measuring. Distinguish fixed footers from actions inside a scrollable body, which must be scrolled into view.

**Why:** A browser audit reported a hidden action after overriding height without notifying the viewport listener, and measured a scroll-body action as if it were a fixed footer. The corrected measurement passed.

**How to apply:** Check the dialog bounds, fixed footer bounds, and scroll-to-action reachability separately. Compare close controls against the dialog title, not the app header behind its overlay.

**Why:** A fixed footer inside a `dvh`-sized dialog can still be hidden by the iPhone keyboard: the visible viewport can shrink without the layout viewport shrinking. Merely adding internal scrolling or a sticky footer does not solve that.

**How to apply:** Listen to visual-viewport resize/scroll while the dialog is open, clean up listeners on close, and keep fields in one scrollable body. Browser tests should simulate a smaller visual viewport without changing the layout viewport, then verify the submit action is visible.

Verify actual geometry, not merely that an action exists or can be clicked programmatically: the full button must fit within the scroll viewport with lower breathing room. Keep the order context outside the scrolling body and reserve the physical side occupied by the close button in RTL.

**Why:** Mobile fixture passes previously concealed a partly clipped Save button and a close control overlapping the status badge. A viewport screenshot exposed what presence/click assertions missed.

Mobile usability also requires an ordered task flow, not only overflow fixes: keep actionable records ahead of advanced filters/history, and separate task sections instead of one long detail form.

**Why:** The user rejected technically fitting layouts that still required excessive scrolling through controls and administrative information, then confirmed improvement after new-order creation was split into details, items, and review steps. Preserve this guided flow rather than reverting to one long form.

**How to apply:** Review viewport-sized captures of the real default list and selected task; full-page screenshots and error-dialog captures cannot establish everyday usability.

Keyboard-sensitive dialog geometry must update without height/top transitions or entry animation interpolation.

**Why:** Generic dialog animation retained a taller shell during viewport shrink even after correct bounds were calculated. CSS viewport units also differed from measured visible height during resize.

**How to apply:** Use measured pixel bounds, remeasure after layout, and disable geometry animations for these shells; verify immediately after shrink rather than waiting for transitions to hide the defect.

Pending-submit browser fixtures must not silently return to idle on a short timer; use explicit success/failure simulation.

**Why:** A timer reset during repeated-tap testing looked like an in-flight duplicate. A real workflow must also protect the interval between successful submission and refreshed detail, not just the pending network request.

**How to apply:** Verify synchronous tap exclusion and retry-after-failure separately from successful transition/remount behavior; distinguish a fixture reset from an actual duplicate request.