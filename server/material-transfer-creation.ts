import { createHash } from "node:crypto";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export class MaterialTransferCreationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MaterialTransferCreationError";
  }
}

export function databaseErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const visited = new Set<unknown>();
  for (let depth = 0; depth < 8 && current && !visited.has(current); depth += 1) {
    visited.add(current);
    if (typeof current !== "object") return undefined;
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

export async function runIdempotentMaterialTransferCreation<
  T extends { idempotencyPayloadHash?: string | null },
>(options: {
  payloadHash: string;
  create: () => Promise<T>;
  findExisting: () => Promise<T | undefined>;
}): Promise<{ transfer: T; replayed: boolean }> {
  try {
    return { transfer: await options.create(), replayed: false };
  } catch (error) {
    if (databaseErrorCode(error) !== "23505") throw error;
    const existing = await options.findExisting();
    if (!existing) throw error;
    if (existing.idempotencyPayloadHash !== options.payloadHash) {
      throw new MaterialTransferCreationError(
        "مفتاح Idempotency-Key مستخدم مع بيانات مختلفة",
        409,
      );
    }
    return { transfer: existing, replayed: true };
  }
}

export function requireMaterialTransferIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new MaterialTransferCreationError(
      "يلزم Idempotency-Key صالح بطول 8 إلى 128 حرفاً",
      400,
    );
  }
  return key;
}

export function requireNonEmptyMaterialTransferItems(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new MaterialTransferCreationError(
      "يجب أن يحتوي التحويل على صنف واحد صالح على الأقل",
      400,
    );
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function materialTransferPayloadHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}