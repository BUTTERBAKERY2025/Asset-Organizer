import { describe, expect, it } from "vitest";
import {
  buildCentralKitchenNotificationPayload,
  canReceiveCentralKitchenNotification,
  dispatchAfterCommitSafely,
  type CentralKitchenNotificationEvent,
} from "../server/central-kitchen-notifications";

describe("central kitchen lifecycle notifications", () => {
  it("requires current view permission while retaining the branch-manager grant", () => {
    expect(canReceiveCentralKitchenNotification("employee", ["view"])).toBe(true);
    expect(canReceiveCentralKitchenNotification("employee", ["edit"])).toBe(false);
    expect(canReceiveCentralKitchenNotification("employee", null)).toBe(false);
    expect(canReceiveCentralKitchenNotification("branch_manager", null)).toBe(true);
    expect(canReceiveCentralKitchenNotification("operations_manager", null)).toBe(false);
    expect(canReceiveCentralKitchenNotification("admin", null)).toBe(true);
  });

  it("uses a durable event key, exact recipients, scoped branch and order link", () => {
    const payload = buildCentralKitchenNotificationPayload({
      eventId: 91,
      orderId: 42,
      event: "created",
      branchId: "kitchen-a",
      actorId: "creator",
      recipientIds: ["kitchen-user"],
    });
    expect(payload).toMatchObject({
      targetAllBranches: false,
      targetBranchIds: ["kitchen-a"],
      targetUserIds: ["kitchen-user"],
      accessModule: "central_kitchen_orders",
      accessBranchIds: ["kitchen-a"],
      dedupeKey: "central-kitchen-event:91:created",
      buttonAction: "/central-kitchen-orders?branchId=kitchen-a&orderId=42",
      title: "طلب جديد للمطبخ المركزي",
      showOnce: true,
    });
    expect(payload.content).not.toContain("creator");
  });

  it.each<[CentralKitchenNotificationEvent, string]>([
    ["edited", "تم تعديل طلب المطبخ المركزي"],
    ["cancelled", "تم إلغاء طلب المطبخ المركزي"],
    ["approved", "تم اعتماد طلب المطبخ المركزي"],
    ["prepared", "تم تجهيز طلب المطبخ المركزي"],
    ["dispatched", "تم إرسال طلب المطبخ المركزي"],
    ["received", "تم استلام طلب المطبخ المركزي"],
    ["received_discrepancy", "تم استلام الطلب مع فروقات"],
    ["discrepancy_resolved", "تمت معالجة فروقات طلب المطبخ"],
  ])("provides clear Arabic copy for %s", (event, title) => {
    const payload = buildCentralKitchenNotificationPayload({
      eventId: 1,
      orderId: 2,
      event,
      branchId: "branch-a",
      actorId: "actor",
      recipientIds: ["recipient"],
    });
    expect(payload.title).toBe(title);
    expect(payload.content.length).toBeGreaterThan(10);
  });

  it("contains both synchronous throws and rejected post-commit tasks", async () => {
    const errors: unknown[] = [];
    const syncFailure = new Error("sync import boundary");
    const asyncFailure = new Error("rejected push");

    expect(() => dispatchAfterCommitSafely(() => {
      throw syncFailure;
    }, error => errors.push(error))).not.toThrow();
    dispatchAfterCommitSafely(
      () => Promise.reject(asyncFailure),
      error => errors.push(error),
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(errors).toEqual([syncFailure, asyncFailure]);
  });

  it("does not leak a rejection when post-commit error reporting itself throws", async () => {
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", listener);
    try {
      dispatchAfterCommitSafely(
        () => Promise.reject(new Error("push failure")),
        () => { throw new Error("logger failure"); },
      );
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });
});