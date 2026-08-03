---
name: Signature canvas iOS resize wipe
description: Why voting/signing pages can save an all-white "signature" and how the guards work
---
Rule: any signature `<canvas>` with a `window resize → re-setup` handler MUST snapshot+restore the drawing, because setting canvas.width wipes it — and iOS Safari fires resize when the toolbar hides/shows while scrolling. Also pixel-check ink (getImageData, ≥40 non-white visible px) before submit; a `hasSignature` boolean alone is not proof.

**Why:** A board member signed a resolution from iPhone; resize wiped the strokes after `hasSignature=true`, so a pure-white 336×150 PNG was stored in `voting_tokens.signature_data` and the print showed no signature.

**How to apply:** Fixed in `client/public/vote-resolution.html` and `client/public/sign-resolution.html` (snapshot on resize + `canvasHasInk()` guard + submit aborts on null signature). Any new signature pad (incl. React SignaturePad usages) needs the same two guards. To let someone re-vote on a board resolution: reset their `voting_tokens` row to `status='pending'` and NULL vote/signature/voted_at (no revote-grant flow exists for board resolutions, only assemblies). Diagnose blank sigs via psql: decode base64 → PIL, all pixels (255,255,255,255) = wiped canvas.
