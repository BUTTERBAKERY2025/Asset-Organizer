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

export function nextMaterialTransferNumber(
  now: Date,
  existingTransferNumbers: readonly string[] = [],
): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `MT-${year}${month}`;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let maximumSequence = 0;
  for (const transferNumber of existingTransferNumbers) {
    const match = pattern.exec(transferNumber);
    if (!match) continue;
    const sequence = Number(match[1]);
    if (Number.isSafeInteger(sequence) && sequence > maximumSequence) {
      maximumSequence = sequence;
    }
  }
  const sequence = maximumSequence + 1;
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

/**
 * The caller must supply transaction-bound operations. Keeping the advisory
 * lock, number read and header insert in this sequence makes the human number
 * allocation atomic without changing the public create API.
 */
export async function allocateMaterialTransferCreation<T>(options: {
  now: Date;
  lockNumberAllocation: () => Promise<void>;
  findExistingNumbers: (prefix: string) => Promise<readonly string[]>;
  insert: (transferNumber: string) => Promise<T>;
}): Promise<T> {
  await options.lockNumberAllocation();
  const prefix = nextMaterialTransferNumber(options.now).slice(0, -5);
  const existing = await options.findExistingNumbers(prefix);
  return options.insert(nextMaterialTransferNumber(options.now, existing));
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