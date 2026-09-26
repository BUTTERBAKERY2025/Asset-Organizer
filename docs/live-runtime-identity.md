# Live runtime identity — 2026-09-26

Read-only observations; no deployment or database changes.

- `https://thebutterbakery.com/api/health` returned HTTP 200 with `database: connected`. Response headers identified Render behind Cloudflare. The `www` host redirects to the canonical domain.
- The same service's `/api/version` returned version `2026-02-23-v3` with a build marker. This identifies the observed response, not a verified repository commit.
- Replit deployment metadata reported `https://asset-organizer--sadels1.replit.app`, with no successful current build. Its health/version requests returned Replit's not-live 404 page. This is not the custom-domain service.
- Repository records identify Supabase project `irgeqdrdaejhedlcbvzz` as the intended external database. Its schema was inspected separately through Supabase MCP; see `supabase-release-gap-audit.md`.

**Unresolved:** Public health proves connectivity but does not identify the database host/project used by Render. Neither development environment configuration nor a matching repository name proves that mapping.

Before any database write, obtain the effective database hostname/project reference and database schema from the Render service owner or authorized read-only provider metadata, plus current backup/restore readiness. Only non-secret host/project information is needed; never copy connection strings, passwords, tokens or environment-value screenshots containing credentials.

The release remains blocked pending target confirmation and the reviewed preflight in `supabase-release-runbook.md`. No automated Replit publication can be treated as a deployment of this Render service.