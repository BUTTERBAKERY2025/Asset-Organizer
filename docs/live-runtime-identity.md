# Live runtime identity — 2026-09-26

Initial read-only observations. Update: the user later explicitly authorized database additions on `irgeqdrdaejhedlcbvzz`; those were applied as documented in `supabase-release-applied-2026-09-26.md`. No deployment was performed. This does not independently establish Render's database connection identity.

- `https://thebutterbakery.com/api/health` returned HTTP 200 with `database: connected`. Response headers identified Render behind Cloudflare. The `www` host redirects to the canonical domain.
- The same service's `/api/version` returned version `2026-02-23-v3` with a build marker. This identifies the observed response, not a verified repository commit.
- Replit deployment metadata reported `https://asset-organizer--sadels1.replit.app`, with no successful current build. Its health/version requests returned Replit's not-live 404 page. This is not the custom-domain service.
- Repository records identify Supabase project `irgeqdrdaejhedlcbvzz` as the intended external database. Its schema was inspected separately through Supabase MCP; see `supabase-release-gap-audit.md`.

**Unresolved:** Public health proves connectivity but does not identify the database host/project used by Render. Neither development environment configuration nor a matching repository name proves that mapping.

The exact Supabase project was subsequently confirmed and authorized by the user, who reported a September 26 backup; restoration was not tested. Before claiming end-to-end Render production verification, still obtain its effective database hostname/project reference and schema from the service owner or authorized read-only provider metadata. Only non-secret host/project information is needed; never copy connection strings, passwords, tokens or environment-value screenshots containing credentials.

Database additions on the authorized Supabase target are complete. Application release and authenticated operational verification remain separate; no automated Replit publication can be treated as a deployment of this Render service.