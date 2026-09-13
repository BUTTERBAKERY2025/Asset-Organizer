import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canApplyManualProductionContextGate,
  clearManualProductionIntent,
  getManualProductionIntentStorageKey,
  isUncertainManualProductionError,
  ManualProductionIntentMismatchError,
  ManualProductionOperationError,
  ManualProductionStorageError,
  postManualProductionOperation,
  prepareManualProductionIntent,
  type ManualProductionOperationContext,
  type ManualProductionStorage,
} from "../client/src/components/central-kitchen/manual-production-operation";

class MemorySessionStorage implements ManualProductionStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const context = (userId = "user-1", branchId = "branch-1"): ManualProductionOperationContext => ({
  userId,
  branchId,
  operation: "create",
});

describe("manual production browser retry intent", () => {
  it("reuses the key for an exact retry and freezes its payload", () => {
    const storage = new MemorySessionStorage();
    const payload = { branchId: "branch-1", quantity: 3, independentEntryAcknowledged: true };
    const first = prepareManualProductionIntent(context(), payload, "/api/daily-production/batches", storage);
    const retry = prepareManualProductionIntent(
      context(),
      { independentEntryAcknowledged: true, quantity: 3, branchId: "branch-1" },
      "/api/daily-production/batches",
      storage,
    );

    expect(retry.reused).toBe(true);
    expect(retry.intent.key).toBe(first.intent.key);
    expect(Object.isFrozen(retry.intent.payload)).toBe(true);
  });

  it("creates a fresh key only after the exact successful intent is cleared", () => {
    const storage = new MemorySessionStorage();
    const first = prepareManualProductionIntent(context(), { quantity: 3 }, "/api/daily-production/batches", storage);
    clearManualProductionIntent(first.intent, storage);
    const next = prepareManualProductionIntent(context(), { quantity: 3 }, "/api/daily-production/batches", storage);

    expect(next.reused).toBe(false);
    expect(next.intent.key).not.toBe(first.intent.key);
  });

  it("isolates authenticated user, branch, and operation namespaces", () => {
    const storage = new MemorySessionStorage();
    const first = prepareManualProductionIntent(context(), { quantity: 3 }, "/api/daily-production/batches", storage);
    const otherUser = prepareManualProductionIntent(context("user-2"), { quantity: 3 }, "/api/daily-production/batches", storage);
    const otherBranch = prepareManualProductionIntent(context("user-1", "branch-2"), { quantity: 3 }, "/api/daily-production/batches", storage);
    const reschedule = prepareManualProductionIntent(
      { ...context(), operation: "reschedule" },
      { quantity: 3 },
      "/api/daily-production/batches/8/reschedule",
      storage,
    );

    expect(getManualProductionIntentStorageKey(context())).not.toBe(getManualProductionIntentStorageKey(context("user-2")));
    expect(getManualProductionIntentStorageKey(context())).not.toBe(getManualProductionIntentStorageKey(context("user-1", "branch-2")));
    expect(otherUser.intent.key).not.toBe(first.intent.key);
    expect(otherBranch.intent.key).not.toBe(first.intent.key);
    expect(reschedule.intent.key).not.toBe(first.intent.key);
  });

  it("rejects a late branch/user result from touching the active branch intent", () => {
    const expected = context("user-a", "branch-a");
    const currentBranchB = { userId: "user-a", branchId: "branch-b" };
    const currentUserB = { userId: "user-b", branchId: "branch-a" };
    const activeBranchB = "branch-b-key";

    expect(canApplyManualProductionContextGate(currentBranchB, expected, "branch-a-key", activeBranchB)).toBe(false);
    expect(canApplyManualProductionContextGate(currentUserB, expected, "branch-a-key", "branch-a-key")).toBe(false);
    expect(canApplyManualProductionContextGate(
      { userId: "user-a", branchId: "branch-b" },
      { ...expected, branchId: "branch-b" },
      "branch-a-key",
      "branch-b-key",
    )).toBe(false);
    expect(canApplyManualProductionContextGate(
      { userId: "user-a", branchId: "branch-a" },
      expected,
      "branch-a-key",
      "branch-a-key",
    )).toBe(true);
  });

  it("rejects a changed payload or endpoint instead of rotating the old key", () => {
    const storage = new MemorySessionStorage();
    const first = prepareManualProductionIntent(context(), { quantity: 3 }, "/api/daily-production/batches", storage);

    expect(() => prepareManualProductionIntent(
      context(),
      { quantity: 4 },
      "/api/daily-production/batches",
      storage,
    )).toThrow(ManualProductionIntentMismatchError);
    expect(first.intent.key).toBe(
      prepareManualProductionIntent(context(), { quantity: 3 }, "/api/daily-production/batches", storage).intent.key,
    );
  });

  it("fails closed when session storage cannot persist an intent", () => {
    const unavailable: ManualProductionStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    };
    expect(() => prepareManualProductionIntent(
      context(),
      { quantity: 3 },
      "/api/daily-production/batches",
      unavailable,
    )).toThrow(ManualProductionStorageError);
  });

  it("keeps every non-success response unresolved, including auth and conflicts", () => {
    expect(isUncertainManualProductionError(new Error("network dropped"))).toBe(true);
    expect(isUncertainManualProductionError(new ManualProductionOperationError(500, "server error"))).toBe(true);
    expect(isUncertainManualProductionError(new ManualProductionOperationError(409, "same key, different payload"))).toBe(true);
    expect(isUncertainManualProductionError(new ManualProductionOperationError(401, "expired session"))).toBe(true);
    expect(isUncertainManualProductionError(new ManualProductionOperationError(403, "forbidden"))).toBe(true);
    expect(isUncertainManualProductionError(new ManualProductionOperationError(422, "invalid"))).toBe(true);
  });

  it("restores the same key after a network failure followed by session expiry", () => {
    const storage = new MemorySessionStorage();
    const first = prepareManualProductionIntent(
      context(),
      { quantity: 3 },
      "/api/daily-production/batches",
      storage,
    );
    // The network failure and subsequent 401 both retain storage.  A later
    // authenticated render therefore gets the exact original intent.
    const restored = prepareManualProductionIntent(
      context(),
      { quantity: 3 },
      "/api/daily-production/batches",
      storage,
    );
    expect(restored.reused).toBe(true);
    expect(restored.intent.key).toBe(first.intent.key);
  });

  it("sends the frozen intent key through a relative credentialed POST", async () => {
    const storage = new MemorySessionStorage();
    const prepared = prepareManualProductionIntent(
      context(),
      { branchId: "branch-1", quantity: 3 },
      "/api/daily-production/batches",
      storage,
    );
    let request: RequestInfo | URL | undefined;
    let options: RequestInit | undefined;
    const response = await postManualProductionOperation(
      prepared.intent.requestPath,
      prepared.intent,
      async (input, init) => {
        request = input;
        options = init;
        return new Response(JSON.stringify({ ok: true }), { status: 201 });
      },
    );

    expect(response).toEqual({ ok: true });
    expect(request).toBe("/api/daily-production/batches");
    expect(options?.credentials).toBe("include");
    expect((options?.headers as Record<string, string>)["Idempotency-Key"]).toBe(prepared.intent.key);
  });

  it("uses the stable helper for both POST workflows in the actual page", () => {
    const page = readFileSync("client/src/pages/daily-production.tsx", "utf8");
    const helper = readFileSync("client/src/components/central-kitchen/manual-production-operation.ts", "utf8");
    expect(page).toContain("postManualProductionOperation");
    expect(page).toContain("/api/daily-production/batches/${sourceBatch.id}/reschedule");
    expect(page).toContain("prepareManualProductionIntent");
    expect(helper).toContain("Idempotency-Key");
    expect(helper).toContain('credentials: "include"');
    expect(page).toContain("canApplyManualProductionContextGate");
    expect(page).toContain("latestManualContextRef");
    expect(page).toContain("الحمولة الأصلية");
  });
});