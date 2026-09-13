/**
 * Browser-side state for manual production operations.
 *
 * A POST can reach the server and still look like a failed request to the
 * browser.  The intent is therefore the unit that is retried: its payload,
 * URL, and idempotency key are immutable for its entire lifetime.  This file
 * deliberately stores no credentials; the authenticated session is supplied
 * by fetch({ credentials: "include" }).
 */

export type ManualProductionOperation = "create" | "reschedule";

export interface ManualProductionOperationContext {
  userId: string;
  branchId: string;
  operation: ManualProductionOperation;
}

export interface ManualProductionContextIdentity {
  userId: string;
  branchId: string;
}

export interface ManualProductionIntent<TPayload = Record<string, unknown>> {
  version: 1;
  userId: string;
  branchId: string;
  operation: ManualProductionOperation;
  requestPath: string;
  key: string;
  payload: Readonly<TPayload>;
}

export interface ManualProductionIntentPreparation<TPayload = Record<string, unknown>> {
  intent: ManualProductionIntent<TPayload>;
  reused: boolean;
}

export interface ManualProductionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_PREFIX = "manual-production-operation:v1";

export class ManualProductionStorageError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ManualProductionStorageError";
    this.cause = cause;
  }
}

export class ManualProductionIntentMismatchError extends Error {
  readonly existingIntent: ManualProductionIntent;

  constructor(existingIntent: ManualProductionIntent) {
    super("A different unresolved manual production intent already exists");
    this.name = "ManualProductionIntentMismatchError";
    this.existingIntent = existingIntent;
  }
}

export class ManualProductionOperationError extends Error {
  readonly status: number | null;
  readonly responseText: string;

  constructor(status: number | null, responseText: string) {
    super(status === null ? responseText : `${status}: ${responseText}`);
    this.name = "ManualProductionOperationError";
    this.status = status;
    this.responseText = responseText;
  }
}

function getBrowserStorage(storage?: ManualProductionStorage): ManualProductionStorage {
  if (storage) return storage;
  let browserStorage: ManualProductionStorage | undefined;
  try {
    browserStorage = typeof window !== "undefined"
      ? window.sessionStorage
      : (globalThis as { sessionStorage?: ManualProductionStorage }).sessionStorage;
  } catch (error) {
    throw new ManualProductionStorageError("لا يمكن حفظ نية العملية: تخزين الجلسة غير متاح.", error);
  }
  if (!browserStorage) {
    throw new ManualProductionStorageError("لا يمكن حفظ نية العملية: تخزين الجلسة غير متاح.");
  }
  return browserStorage;
}

/**
 * Probes sessionStorage before a request is sent.  A private browsing mode
 * can expose sessionStorage while making setItem throw, so merely checking
 * for the property is not sufficient.
 */
export function assertManualProductionStorageAvailable(storage?: ManualProductionStorage): ManualProductionStorage {
  const candidate = getBrowserStorage(storage);
  const probeKey = `${STORAGE_PREFIX}:probe`;
  try {
    candidate.setItem(probeKey, "1");
    candidate.removeItem(probeKey);
  } catch (error) {
    throw new ManualProductionStorageError(
      "لا يمكن حفظ نية العملية بأمان في تخزين الجلسة؛ لم يتم إرسال الطلب.",
      error,
    );
  }
  return candidate;
}

function requireContext(context: ManualProductionOperationContext): void {
  if (!context.userId || !context.branchId || !context.operation) {
    throw new ManualProductionStorageError("يلزم المستخدم والفرع ونوع العملية لحفظ نية الإنتاج.");
  }
}

export function getManualProductionIntentStorageKey(
  context: ManualProductionOperationContext,
): string {
  requireContext(context);
  return [
    STORAGE_PREFIX,
    encodeURIComponent(context.userId),
    encodeURIComponent(context.branchId),
    context.operation,
  ].join(":");
}

function cloneAndFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const copy = value.map(item => cloneAndFreeze(item)) as T;
    return Object.freeze(copy) as T;
  }
  const copy: Record<string, unknown> = {};
  Object.keys(value as Record<string, unknown>).forEach(key => {
    copy[key] = cloneAndFreeze((value as Record<string, unknown>)[key]);
  });
  return Object.freeze(copy) as T;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function stableManualProductionPayload(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function newUuid(): string {
  const browserCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  if (browserCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new ManualProductionStorageError("لا يمكن إنشاء مفتاح آمن للعملية.");
}

export function createManualProductionIntent<TPayload>(
  context: ManualProductionOperationContext,
  payload: TPayload,
  requestPath: string,
  key: string = newUuid(),
): ManualProductionIntent<TPayload> {
  requireContext(context);
  if (!requestPath || !key) {
    throw new ManualProductionStorageError("مسار العملية ومفتاحها مطلوبان.");
  }
  return cloneAndFreeze({
    version: 1 as const,
    userId: context.userId,
    branchId: context.branchId,
    operation: context.operation,
    requestPath,
    key,
    payload: cloneAndFreeze(payload),
  });
}

function parseIntent<TPayload>(
  context: ManualProductionOperationContext,
  raw: string,
): ManualProductionIntent<TPayload> {
  let parsed: Partial<ManualProductionIntent<TPayload>>;
  try {
    parsed = JSON.parse(raw) as Partial<ManualProductionIntent<TPayload>>;
  } catch (error) {
    throw new ManualProductionStorageError("تعذر قراءة نية إنتاج محفوظة؛ لم يتم تجاهلها تلقائياً.", error);
  }
  if (
    parsed.version !== 1
    || parsed.userId !== context.userId
    || parsed.branchId !== context.branchId
    || parsed.operation !== context.operation
    || typeof parsed.requestPath !== "string"
    || typeof parsed.key !== "string"
    || !parsed.payload
  ) {
    throw new ManualProductionStorageError("نية إنتاج محفوظة غير صالحة؛ لم يتم إرسال طلب جديد.");
  }
  return cloneAndFreeze(parsed as ManualProductionIntent<TPayload>);
}

export function readManualProductionIntent<TPayload = Record<string, unknown>>(
  context: ManualProductionOperationContext,
  storage?: ManualProductionStorage,
): ManualProductionIntent<TPayload> | null {
  const candidate = assertManualProductionStorageAvailable(storage);
  const storageKey = getManualProductionIntentStorageKey(context);
  let raw: string | null;
  try {
    raw = candidate.getItem(storageKey);
  } catch (error) {
    throw new ManualProductionStorageError("تعذر قراءة نية إنتاج الجلسة؛ لم يتم إرسال طلب جديد.", error);
  }
  return raw === null ? null : parseIntent<TPayload>(context, raw);
}

export function saveManualProductionIntent<TPayload>(
  intent: ManualProductionIntent<TPayload>,
  storage?: ManualProductionStorage,
): void {
  const context: ManualProductionOperationContext = {
    userId: intent.userId,
    branchId: intent.branchId,
    operation: intent.operation,
  };
  const candidate = assertManualProductionStorageAvailable(storage);
  try {
    candidate.setItem(getManualProductionIntentStorageKey(context), JSON.stringify(intent));
  } catch (error) {
    throw new ManualProductionStorageError(
      "تعذر حفظ نية الإنتاج بأمان؛ لم يتم إرسال الطلب.",
      error,
    );
  }
}

export function manualProductionIntentMatches<TPayload>(
  intent: ManualProductionIntent<TPayload>,
  context: ManualProductionOperationContext,
  payload: TPayload,
  requestPath: string,
): boolean {
  return intent.userId === context.userId
    && intent.branchId === context.branchId
    && intent.operation === context.operation
    && intent.requestPath === requestPath
    && stableManualProductionPayload(intent.payload) === stableManualProductionPayload(payload);
}

/**
 * Returns the existing intent for an exact retry.  A different payload or
 * endpoint is a hard mismatch: rotating the key here would turn an uncertain
 * operation into a second logical operation.
 */
export function prepareManualProductionIntent<TPayload>(
  context: ManualProductionOperationContext,
  payload: TPayload,
  requestPath: string,
  storage?: ManualProductionStorage,
): ManualProductionIntentPreparation<TPayload> {
  const candidate = assertManualProductionStorageAvailable(storage);
  const existing = readManualProductionIntent<TPayload>(context, candidate);
  if (existing) {
    if (!manualProductionIntentMatches(existing, context, payload, requestPath)) {
      throw new ManualProductionIntentMismatchError(existing);
    }
    return { intent: existing, reused: true };
  }
  const intent = createManualProductionIntent(context, payload, requestPath);
  saveManualProductionIntent(intent, candidate);
  return { intent, reused: false };
}

/**
 * Removes only the exact intent that was acknowledged by the server.  This
 * protects a newer intent from a late success callback in another tab.
 */
export function clearManualProductionIntent(
  intent: ManualProductionIntent,
  storage?: ManualProductionStorage,
): void {
  const context: ManualProductionOperationContext = {
    userId: intent.userId,
    branchId: intent.branchId,
    operation: intent.operation,
  };
  const candidate = assertManualProductionStorageAvailable(storage);
  const current = readManualProductionIntent(context, candidate);
  if (!current) return;
  if (current.key !== intent.key
    || current.requestPath !== intent.requestPath
    || stableManualProductionPayload(current.payload) !== stableManualProductionPayload(intent.payload)) {
    throw new ManualProductionIntentMismatchError(current);
  }
  try {
    candidate.removeItem(getManualProductionIntentStorageKey(context));
  } catch (error) {
    throw new ManualProductionStorageError("تعذر مسح نية الإنتاج بعد نجاح الطلب.", error);
  }
}

export function getManualProductionIntentContext(
  intent: ManualProductionIntent,
): ManualProductionOperationContext {
  return {
    userId: intent.userId,
    branchId: intent.branchId,
    operation: intent.operation,
  };
}

/**
 * Mutation callbacks may resolve after the user changes branch or signs in as
 * another user.  This is intentionally pure so every callback can gate its
 * state update without consulting a stale closure.  The active key check also
 * rejects a late result after the intent was explicitly discarded/replaced.
 */
export function canApplyManualProductionContextGate(
  current: ManualProductionContextIdentity,
  expected: ManualProductionOperationContext,
  intentKey: string,
  activeIntentKey: string | null | undefined,
): boolean {
  return isManualProductionContextCurrent(current, expected)
    && intentKey === activeIntentKey;
}

export function isManualProductionContextCurrent(
  current: ManualProductionContextIdentity,
  expected: ManualProductionContextIdentity,
): boolean {
  return current.userId === expected.userId && current.branchId === expected.branchId;
}

export function isUncertainManualProductionError(_error: unknown): boolean {
  // A response can arrive after the server accepted the request, including a
  // validation/auth/session response generated at a later middleware stage.
  // Keep the intent for every non-success status; explicit discard is the
  // only safe way to abandon a possibly delivered operation.
  return true;
}

export function isManualProductionConflict(error: unknown): boolean {
  return error instanceof ManualProductionOperationError && error.status === 409;
}

export async function postManualProductionOperation<TResponse>(
  requestPath: string,
  intent: ManualProductionIntent,
  fetchImplementation: typeof fetch = fetch,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetchImplementation(requestPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": intent.key,
      },
      body: JSON.stringify(intent.payload),
      credentials: "include",
    });
  } catch (error) {
    throw error;
  }
  if (!response.ok) {
    let responseText = response.statusText || "فشل طلب إنتاج يدوي";
    try {
      responseText = (await response.text()) || responseText;
    } catch {
      // The status remains available even if an error body cannot be read.
    }
    throw new ManualProductionOperationError(response.status, responseText);
  }
  return response.json() as Promise<TResponse>;
}

export function isProductionDateAfter(targetDate: string, sourceDate: string | null | undefined): boolean {
  const isValidDate = (value: string | null | undefined): value is string => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return candidate.getUTCFullYear() === year
      && candidate.getUTCMonth() === month - 1
      && candidate.getUTCDate() === day;
  };
  if (!isValidDate(sourceDate) || !isValidDate(targetDate)) return false;
  return targetDate > sourceDate;
}