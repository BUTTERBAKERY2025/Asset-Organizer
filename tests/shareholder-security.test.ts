import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  codes: new Map<string, any>(),
  queue: [] as any[],
  locks: new Map<string, Promise<void>>(),
  failQueue: false,
}));

vi.mock("../server/db", () => {
  const param = (condition: any) => condition?.queryChunks?.find(
    (part: any) => part && typeof part.value !== "undefined" && !Array.isArray(part.value),
  )?.value;
  const database: any = {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: () => {
            const key = param(condition);
            const result = table[Symbol.for("drizzle:Name")] === "shareholders"
              ? (key === "alice" || key === "bob" ? [{ id: 1, phone: "0501234567", fullName: "Test" }] : [])
              : table[Symbol.for("drizzle:Name")] === "shareholder_portal_settings"
                ? [{ requireTwoFactor: true, twoFactorChannel: "sms", enableWhatsapp: true }]
                : state.codes.has(key) ? [{ ...state.codes.get(key) }] : [];
            const promise = Promise.resolve(result);
            return Object.assign(promise, { for: () => promise });
          },
        }),
      }),
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: async (condition: any) => {
          const id = param(condition);
          const key = [...state.codes].find(([, row]) => row.id === id)?.[0];
          if (key) state.codes.set(key, { ...state.codes.get(key), ...values });
        },
      }),
    }),
    insert: (table: any) => ({
      values: async (values: any) => {
        if (table[Symbol.for("drizzle:Name")] === "notification_queue") {
          if (state.failQueue) throw new Error("queue unavailable");
          state.queue.push(...(Array.isArray(values) ? values : [values]));
        } else {
          state.codes.set(values.userId, { id: state.codes.size + 1, ...values });
        }
      },
    }),
    execute: async () => {},
  };
  return {
    db: {
      ...database,
      transaction: async (callback: (tx: any) => Promise<any>) => {
        // Model PostgreSQL's serialized per-account row/advisory lock and rollback.
        const preceding = state.locks.get("otp") ?? Promise.resolve();
        let release!: () => void;
        const current = new Promise<void>((resolve) => { release = resolve; });
        state.locks.set("otp", preceding.then(() => current));
        await preceding;
        const snapshot = new Map([...state.codes].map(([k, v]) => [k, { ...v }]));
        const queueLength = state.queue.length;
        try {
          return await callback(database);
        } catch (error) {
          state.codes.clear();
          for (const [k, v] of snapshot) state.codes.set(k, v);
          state.queue.length = queueLength;
          throw error;
        } finally {
          release();
        }
      },
    },
  };
});

import { issueOtpForUser, verifyOtpForUser } from "../server/shareholder-security";

const hash = (code: string, user: string) =>
  crypto.createHash("sha256").update(`${code}:${user}`).digest("hex");
const challenge = (user: string, code = "123456", changes: Record<string, unknown> = {}) => ({
  id: user === "alice" ? 1 : 2,
  userId: user,
  codeHash: hash(code, user),
  attempts: 0,
  sendCount: 1,
  consumedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  lastSentAt: new Date(Date.now() - 60_000),
  ...changes,
});

describe("shareholder OTP atomicity", () => {
  beforeEach(() => {
    state.codes.clear();
    state.queue.length = 0;
    state.locks.clear();
    state.failQueue = false;
  });

  it("consumes a correct code only once under concurrent verification", async () => {
    state.codes.set("alice", challenge("alice"));
    const results = await Promise.all([
      verifyOtpForUser("alice", "123456"),
      verifyOtpForUser("alice", "123456"),
    ]);
    expect(results).toContainEqual({ ok: true });
    expect(results).toContainEqual({ ok: false, error: "no_challenge" });
  });

  it("counts concurrent bad attempts without losing increments and enforces the limit", async () => {
    state.codes.set("alice", challenge("alice"));
    const results = await Promise.all(Array.from({ length: 7 }, () => verifyOtpForUser("alice", "000000")));
    expect(results.filter((r) => !r.ok && r.error === "invalid")).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.error === "too_many_attempts")).toHaveLength(2);
    expect(state.codes.get("alice").attempts).toBe(5);
    expect(await verifyOtpForUser("alice", "123456")).toEqual({ ok: false, error: "too_many_attempts" });
  });

  it("rejects expired challenges and codes bound to another account", async () => {
    state.codes.set("alice", challenge("alice", "123456", { expiresAt: new Date(Date.now() - 1) }));
    state.codes.set("bob", challenge("bob", "654321"));
    expect(await verifyOtpForUser("alice", "123456")).toEqual({ ok: false, error: "expired" });
    expect(await verifyOtpForUser("bob", "123456")).toEqual({ ok: false, error: "invalid" });
    expect(state.codes.get("alice").consumedAt).toBeNull();
    expect(state.codes.get("bob").attempts).toBe(1);
  });

  it("serializes concurrent resends, cooldown and send cap", async () => {
    state.codes.set("alice", challenge("alice"));
    const results = await Promise.all([
      issueOtpForUser("alice", { resend: true }),
      issueOtpForUser("alice", { resend: true }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === "cooldown")).toHaveLength(1);
    expect(state.codes.get("alice").sendCount).toBe(2);
    expect(state.queue).toHaveLength(1);
    state.codes.get("alice").lastSentAt = new Date(Date.now() - 60_000);
    state.codes.get("alice").sendCount = 4;
    expect(await issueOtpForUser("alice", { resend: true })).toEqual({ ok: false, error: "too_many_sends" });
    expect(state.queue).toHaveLength(1);
  });

  it("uses a transaction-scoped account lock even when no challenge row exists", async () => {
    const source = readFileSync(new URL("../server/shareholder-security.ts", import.meta.url), "utf8");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source.match(/\.for\("update"\)/g)).toHaveLength(2);
    const results = await Promise.all([
      issueOtpForUser("alice", { resend: true }),
      issueOtpForUser("alice", { resend: true }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(state.codes.get("alice").sendCount).toBe(1);
    expect(state.queue).toHaveLength(1);
  });

  it("does not spend a send or replace a code when enqueue fails", async () => {
    state.codes.set("alice", challenge("alice"));
    state.failQueue = true;
    expect(await issueOtpForUser("alice", { resend: true })).toEqual({ ok: false, error: "send_failed" });
    expect(state.codes.get("alice").sendCount).toBe(1);
    expect(await verifyOtpForUser("alice", "123456")).toEqual({ ok: true });
  });
});