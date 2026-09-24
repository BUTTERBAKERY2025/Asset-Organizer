import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  eligiblePersonalDevices,
  deliverPersonalPushBatch,
  personalPushDue,
  personalPushPayload,
} from "../server/personal-notification-push";

const migration = readFileSync("migrations/038_personal_notification_push.sql", "utf8");
const startup = readFileSync("server/db.ts", "utf8");
const validEndpoint = "https://fcm.googleapis.com/fcm/send/device";

describe("personal push outbox boundary", () => {
  it("records new inserts transactionally from every writer, never backfills historical rows", () => {
    for (const sql of [migration, startup]) {
      expect(sql).toContain("AFTER INSERT ON notifications FOR EACH ROW");
      expect(sql).toContain("NEW.user_id IS NOT NULL");
      expect(sql).toContain("NEW.created_at >=");
      expect(sql).toContain("ON CONFLICT DO NOTHING");
      expect(sql).not.toMatch(/INSERT INTO personal_notification_push_outbox\s+SELECT/i);
      expect(sql).toContain("REFERENCES notifications(id) ON DELETE CASCADE");
      for (const table of ["personal_push_activation", "personal_notification_push_outbox", "personal_notification_push_deliveries"]) {
        expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      }
      expect(sql).not.toMatch(/CREATE POLICY.*personal_notification_push/i);
    }
    expect(startup).toContain("personal_notifications_v1");
  });

  it("keeps recipient to exact user ID and filters inactive accounts", () => {
    const source = readFileSync("server/personal-notification-push.ts", "utf8");
    expect(source).toContain("eq(pushSubscriptions.userId, userId)");
    expect(source).toContain('eq(users.isActive, "active")');
    expect(source).toContain("n.userId !== userId");
    expect(source).not.toContain("notifications.branchId");
  });

  it("respects schedule, exact expiry boundary, and lockscreens disclose no HR contents", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(personalPushDue({ scheduledFor: new Date(now.getTime() + 1), expiresAt: null }, now)).toBe("scheduled");
    expect(personalPushDue({ scheduledFor: now, expiresAt: new Date(now.getTime() + 1) }, now)).toBe("due");
    expect(personalPushDue({ scheduledFor: null, expiresAt: now }, now)).toBe("expired");
    const payload = JSON.parse(personalPushPayload(52));
    expect(payload.url).toBe("/my-portal");
    expect(payload.body).not.toMatch(/salary|leave|راتب|إجازة/i);
    expect(payload.tag).toBe("personal-notification-52");
  });

  it("retires expired stale leases conditionally rather than letting them clog the sweep", () => {
    const source = readFileSync("server/personal-notification-push.ts", "utf8");
    expect(source).toContain("claimedAt: outbox.claimedAt");
    expect(source).toContain("row.claimedAt ? eq(outbox.claimedAt, row.claimedAt) : isNull(outbox.claimedAt)");
    expect(readFileSync("server/scheduler.ts", "utf8")).toContain("setInterval(personalPushSweep, 60_000)");
  });

  it("retries only undelivered devices, at most five times, and rejects unknown providers", () => {
    const devices = [
      { id: 1, endpoint: validEndpoint },
      { id: 2, endpoint: validEndpoint },
      { id: 3, endpoint: validEndpoint },
      { id: 4, endpoint: "https://untrusted.example/send" },
    ];
    expect(eligiblePersonalDevices(devices, [
      { subscriptionId: 1, status: "delivered", attempts: 1 },
      { subscriptionId: 2, status: "pending", attempts: 1 },
      { subscriptionId: 3, status: "pending", attempts: 5 },
    ])).toEqual([devices[1]]);
    expect(eligiblePersonalDevices([devices[0]], [])).toEqual([devices[0]]);
  });

  it("dispatches only authorized devices and retries partial failures without resending accepted receipts", async () => {
    const devices = [1, 2, 3].map((id) => ({ id, endpoint: validEndpoint }));
    const sent: number[] = [];
    const stored: { subscriptionId: number; status: string; attempts: number }[] = [];
    let failSecond = true;
    const actions = {
      authorized: async (device: typeof devices[number]) => device.id !== 3,
      send: async (device: typeof devices[number], payload: string) => {
        expect(JSON.parse(payload).url).toBe("/my-portal");
        sent.push(device.id);
        if (device.id === 2 && failSecond) throw Object.assign(new Error("temporary"), { statusCode: 503 });
      },
      receipt: async (device: typeof devices[number], status: "delivered" | "pending", attempts: number) => {
        const index = stored.findIndex((r) => r.subscriptionId === device.id);
        if (index !== -1) stored.splice(index, 1);
        stored.push({ subscriptionId: device.id, status, attempts });
      },
      revoke: async () => {},
    };
    await expect(deliverPersonalPushBatch(92, devices, stored, actions)).rejects.toThrow("provider failed");
    expect(sent.sort()).toEqual([1, 2]);
    expect(stored).toEqual(expect.arrayContaining([
      { subscriptionId: 1, status: "delivered", attempts: 1 },
      { subscriptionId: 2, status: "pending", attempts: 1 },
    ]));
    failSecond = false;
    sent.length = 0;
    await deliverPersonalPushBatch(92, devices, stored, actions);
    expect(sent).toEqual([2]);
    expect(stored.find((r) => r.subscriptionId === 2)).toEqual({ subscriptionId: 2, status: "delivered", attempts: 2 });
  });
});