---
name: Financial statements review module
description: القوائم المالية ومراجعتها — sequential PDF signing invariants and design decisions
---
Governance module «القوائم المالية ومراجعتها» (/governance/financial-statements, guarded by governance_compliance; routes in server/financial-review-routes.ts, public page client/public/sign-financial.html, stamping in client/src/lib/financial-doc-stamp.ts).

Rules worth keeping in sync:
- Signing is STRICTLY sequential: both sign AND decline must run in a transaction with FOR UPDATE, re-check `status='pending'`, expiry, and that no lower-signOrder signer is unsigned. The public /file endpoint must also enforce expiry for pending links.
- Reopening a signer MUST reset every downstream signer too (new tokens, cleared signatures) or a stale downstream approval can flip the doc back to "completed" out of sequence.
- PDFs live in Supabase storage (uploadToSupabase / documents bucket) — never base64 in DB. Dev startup logs an RLS "Error creating bucket" warning; harmless, bucket exists.
- Stamped/approved copy is generated client-side with pdf-lib: an A4 approval page is drawn on canvas (Arabic-safe) and appended as a JPEG page; stamp date = last signedAt (deterministic). Server-side archival is a proposed follow-up.
- Tables financial_review_cycles / financial_documents / financial_doc_signers were created with manual CREATE TABLE SQL on BOTH dev and prod (never drizzle-kit push here).

- Supabase Storage rejects non-ASCII object keys ("Invalid key") — uploadToSupabase's sanitizer deliberately KEEPS Arabic chars, so never pass an Arabic filename as the storage name; store the Arabic name in DB for display and use an ASCII key. Also multer decodes originalname as latin1 → re-decode to UTF-8 before saving.
- PROD CSP GOTCHA: helmet in production sets `script-src 'self'`, which silently kills the inline `<script>` of any public static signing page (page sticks at "جاري التحميل"). Every new public HTML page (like vote-resolution.html / sign-resolution.html / sign-financial.html) MUST be added to the CSP exemption list in server/index.ts. Dev never reproduces this (helmet disabled outside production).

**Why:** review round flagged out-of-turn decline, non-transactional decline, and reopen leaving downstream signatures — all financial-record integrity bugs.
- Stamped-copy download compatibility: save PDFs with useObjectStreams:false, delay revokeObjectURL (~2min) and copy bytes before Blob — otherwise some viewers report the file corrupt or it "opens then closes"; keep the approval-overlay PNG ≲2200px wide (huge alpha PNGs crash picky viewers).
- When local `npx vite build` hangs at "transforming..." even on a clean baseline (environment slowness), verify instead via dev-server transform (curl localhost:5000/src/<file> → 200) + esbuild per-file transform, then push and let Render build.
