---
name: Mobile dialogs and virtual keyboards
description: Fixed dialog action bars need visual-viewport bounds, not just dynamic viewport CSS.
---

Size and position keyboard-sensitive dialogs using the visual viewport, with ordinary viewport fallbacks.

**Why:** A fixed footer inside a `dvh`-sized dialog can still be hidden by the iPhone keyboard: the visible viewport can shrink without the layout viewport shrinking. Merely adding internal scrolling or a sticky footer does not solve that.

**How to apply:** Listen to visual-viewport resize/scroll while the dialog is open, clean up listeners on close, and keep fields in one scrollable body. Browser tests should simulate a smaller visual viewport without changing the layout viewport, then verify the submit action is visible.