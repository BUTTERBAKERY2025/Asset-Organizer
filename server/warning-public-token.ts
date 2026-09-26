import crypto from "node:crypto";
import { and, eq, gte, isNull, or, sql } from "drizzle-orm";
import { employeeWarnings } from "@shared/schema";

export const WARNING_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The issuance time lives in the opaque database-backed token, not updatedAt:
// editing a warning must not silently extend an existing signing link.
export function issueWarningPublicToken(now = new Date()): string {
  return `v1.${now.getTime()}.${crypto.randomBytes(24).toString("base64url")}`;
}

export function warningPublicAccessCondition(token: string) {
  const match = /^v1\.(\d{13})\.([A-Za-z0-9_-]{32})$/.exec(token);
  const issued = match ? Number(match[1]) : NaN;
  // Pre-existing links have no embedded issue time; use their original creation
  // date. Legacy links regenerated before this change need another regeneration.
  const timeCondition = Number.isSafeInteger(issued)
    ? sql`CURRENT_TIMESTAMP < ${new Date(issued + WARNING_LINK_TTL_MS)}`
    : gte(employeeWarnings.createdAt, sql`CURRENT_TIMESTAMP - INTERVAL '7 days'`);
  return and(
    eq(employeeWarnings.publicToken, token),
    eq(employeeWarnings.status, "active"),
    or(isNull(employeeWarnings.expiresAt), gte(employeeWarnings.expiresAt, sql`CURRENT_DATE::text`)),
    timeCondition,
  );
}