# Supabase attachment cutover (staged; not applied)

Production audit evidence: `documents` is recorded with `public=false`, but
`storage.objects` has `public_upload` (INSERT), `public_download` (SELECT),
and `public_delete` (DELETE) for `public` on `bucket_id='documents'`. Private
bucket metadata alone does **not** cancel those policies. No remote changes
were made as part of this change.

1. Configure `SUPABASE_URL` and **server-only**
   `SUPABASE_SERVICE_ROLE_KEY` on each server deployment. Never expose the
   service key through Vite/client env or API responses. Do not remove the
   existing anon key if other features still need it.
2. Deploy the server change, then apply
   `migrations/manual/045_private_supabase_attachments.sql` explicitly using
   privileged Supabase SQL access. The migration removes only the three
   audited policies, creates/verifies the private `documents` and
   `app-private-attachments` buckets, and does not move or delete objects.
   **Do not apply before the service role is configured and code is deployed.**
3. Audit all remaining `storage.objects` policies (including other names,
   roles, and grants), plus bucket metadata. Other permissive policies may
   still grant anon access; this migration does not blanket-delete them.
   Verify unauthenticated direct Storage API reads/writes/deletes are denied
   and authorized app proxy reads still work. If a policy differs from the
   audited one, the migration aborts for manual review.

The shared generic `server/supabase-storage.ts` is used by
`server/routes.ts` (generic upload/document upload, cashier journal legacy
lookup and migration, authenticated proxy), `server/media-team-routes.ts`,
`server/onboarding-routes.ts`, `server/audit-portal-routes.ts`,
`server/financial-review-routes.ts`, and `server/governance-routes.ts`.
`server/index.ts` calls `ensureBucketExists` on startup, now verification
only. Existing file names and database paths remain untouched; no data
migration is required. The generic proxy's ACL/provenance checks remain
unchanged. `server/private-supabase-storage.ts` uses the separate
`app-private-attachments` bucket and already expects the same service key.

Some callers only check client availability, not bucket readiness, and may
report generic upload failure until buckets/policies are prepared. The legacy
`journal_attachments` migration endpoint is independent and should not be
run as part of this policy cutover. The fixed-name policy audit cannot prove
the absence of different broad policies; review them before claiming storage
is private. If any third-party client relied on direct anonymous reads, it
must be switched to an authorized server proxy instead.

## Delivery, complaint and maintenance private evidence

On Render set `SUPABASE_URL` and **server-only** `SUPABASE_SERVICE_ROLE_KEY`;
create `app-private-attachments` with `public=false` using the staged SQL
above, and audit all Storage policies for anonymous access before enabling
uploads. Do not put the service key in `VITE_` variables or in browser code.
The adapter only accepts a bucket whose id is `app-private-attachments` and
whose metadata says `public=false`; it never creates buckets or issues public
URLs. Missing configuration or unverified bucket fails closed. The bucket
metadata check alone cannot prove that other broad policies are absent: the
policy audit and unauthenticated access checks in step 3 are required.

Render defaults to Supabase (`PRIVATE_ATTACHMENT_PROVIDER=supabase` may be
set explicitly); Replit defaults to its existing private Object Storage
unless a service-role key or explicit Supabase override is set. New Supabase
paths are marked `/objects/<namespace>/__supabase__/...` while older paths
remain unchanged and continue to require Replit Object Storage. On Render,
old Replit-backed complaint/maintenance attachments cannot be downloaded
without a separately planned authenticated migration; they are never
reinterpreted as Supabase keys. No automatic transfer, remote bucket
creation, or production test write occurs on startup.