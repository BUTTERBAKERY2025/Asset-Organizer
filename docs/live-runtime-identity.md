# Live runtime identity — 2026-09-26

Initial read-only observations. Update: the user later explicitly authorized database additions on `irgeqdrdaejhedlcbvzz`; those were applied as documented in `supabase-release-applied-2026-09-26.md`. No deployment was performed. This does not independently establish Render's database connection identity.

- `https://thebutterbakery.com/api/health` returned HTTP 200 with `database: connected`. Response headers identified Render behind Cloudflare. The `www` host redirects to the canonical domain.
- The same service's `/api/version` returned version `2026-02-23-v3` with a build marker. This identifies the observed response, not a verified repository commit.
- Replit deployment metadata reported `https://asset-organizer--sadels1.replit.app`, with no successful current build. Its health/version requests returned Replit's not-live 404 page. This is not the custom-domain service.
- Repository records identify Supabase project `irgeqdrdaejhedlcbvzz` as the intended external database. Its schema was inspected separately through Supabase MCP; see `supabase-release-gap-audit.md`.

**Update — 2026-10-02:** The user confirmed checking the live Render service settings and that its Supabase project matches `irgeqdrdaejhedlcbvzz`. The database mapping is now owner-confirmed, not independently verified through provider metadata.

**Later screenshot evidence — 2026-10-02:** The supplied Render service header shows Asset-Organizer-1, repository BUTTERBAKERY2025/Asset-Organizer, main branch, thebutterbakery.com, and Live revision `a66fa77`. Local Git resolves this to `a66fa7775c89b862c1068efec56fee96de27d5b0`, an ancestor preceding the three authorization fixes. Thus the pictured revision does not include those fixes. This is screenshot evidence at capture time, not continuous provider verification. The user also confirmed a recent backup and known restoration procedure; no restore test was performed here.

The exact Supabase project was previously confirmed and authorized by the user, who reported a September 26 backup; restoration was not tested. The October 2 confirmation resolves the separate database-mapping question through owner attestation. It does not establish end-to-end operational verification, deployed revision, or current backup/restore readiness. Never copy connection strings, passwords, tokens or environment-value screenshots containing credentials.

Database additions on the authorized Supabase target are complete. Application release and authenticated operational verification remain separate; no automated Replit publication can be treated as a deployment of this Render service.