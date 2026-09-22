import { describe, expect, it } from "vitest";
import {
  buildCentralKitchenNotificationPayload,
  canReceiveCentralKitchenNotification,
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
      buttonAction: "/central-kitchen-orders?orderId=42",
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
});