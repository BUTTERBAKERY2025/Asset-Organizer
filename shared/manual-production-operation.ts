/**
 * Wire-level helpers for durable manual-production operations.
 *
 * Keep this module browser-safe: hashing and database access belong to the
 * server operation service.
 */

export const MANUAL_PRODUCTION_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{8,128}$/;

export function isManualProductionIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && MANUAL_PRODUCTION_IDEMPOTENCY_KEY_PATTERN.test(value);
}

/** Deterministic JSON representation used as the input to the server hash. */
export function canonicalManualProductionPayload(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([, child]) => child !== undefined)
          .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
          .map(([key, child]) => [key, normalize(child)]),
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}