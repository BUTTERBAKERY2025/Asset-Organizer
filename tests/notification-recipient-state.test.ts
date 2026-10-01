import { describe, expect, it } from "vitest";
import {
  activeNotificationsKey, reconcileNotificationQueue, selectedRecipientNotice, type NotificationQueueState,
} from "../client/src/lib/notification-view-state";
import { parseAnnouncementAction } from "../shared/operations-center-notifications";
import { centerNoticeDestination } from "../client/src/lib/operations-center-navigation";

const scope = JSON.stringify(["operator", "a"]);
const initial: NotificationQueueState = { scope, ids: [], shown: [] };

describe("authoritative recipient notification state", () => {
  it("reconciles queued IDs and resolves updated content only from the latest authorized rows", () => {
    const old = [{ id: 1, content: "old", buttonAction: "/old" }, { id: 2, content: "queued" }];
    const queue = reconcileNotificationQueue(initial, scope, old);
    expect(queue.ids).toEqual([1, 2]);
    const latest = [{ id: 1, content: "history", buttonAction: null }, { id: 3, content: "new" }];
    const next = reconcileNotificationQueue(queue, scope, latest);
    expect(next.ids).toEqual([1, 3]);
    const selection = { id: 1, scope };
    expect(selectedRecipientNotice(selection, scope, latest)).toBe(latest[0]);
    expect(selectedRecipientNotice(selection, scope, latest)).not.toBe(old[0]);
    expect(selectedRecipientNotice({ id: 2, scope }, scope, latest)).toBeNull();
    expect(selectedRecipientNotice(selection, scope, latest)?.buttonAction).toBeNull();
  });
  it("clears popup queue and selected details when a refresh revokes all notices or fails with stale query data", () => {
    const rows = [{ id: 1, content: "sensitive" }];
    const queue = reconcileNotificationQueue(initial, scope, rows);
    expect(reconcileNotificationQueue(queue, scope, []).ids).toEqual([]);
    expect(reconcileNotificationQueue(queue, scope, rows, true).ids).toEqual([]);
    expect(selectedRecipientNotice({ id: 1, scope }, scope, [])).toBeNull();
    expect(selectedRecipientNotice({ id: 1, scope }, scope, rows, true)).toBeNull();
    expect(selectedRecipientNotice({ id: 1, scope }, scope, undefined)).toBeNull();
  });
  it("discards old-account and old-branch identities even when the new scope contains the same notice ID", () => {
    const oldRows = [{ id: 1, content: "old actor" }];
    const queued = reconcileNotificationQueue(initial, scope, oldRows);
    for (const nextScope of [JSON.stringify(["other", "a"]), JSON.stringify(["operator", "b"]), JSON.stringify(["", ""])]) {
      expect(selectedRecipientNotice({ id: 1, scope }, nextScope, [{ id: 1, content: "new actor" }])).toBeNull();
      const pending = reconcileNotificationQueue(queued, nextScope, undefined);
      expect(pending).toEqual({ scope: nextScope, ids: [], shown: [] });
      const fresh = reconcileNotificationQueue(pending, nextScope, [{ id: 1 }]);
      expect(fresh.ids).toEqual([1]);
    }
    expect(activeNotificationsKey("operator", "a")).not.toEqual(activeNotificationsKey("operator", "b"));
    expect(activeNotificationsKey("operator", "a")).not.toEqual(activeNotificationsKey("other", "a"));
  });
  it("does not replay a dismissed popup or keep a show-once notice removed by the authoritative read refresh", () => {
    const queue = reconcileNotificationQueue(initial, scope, [{ id: 1 }]);
    const dismissed = { ...queue, ids: [] };
    expect(reconcileNotificationQueue(dismissed, scope, [{ id: 1 }]).ids).toEqual([]);
    expect(reconcileNotificationQueue(queue, scope, []).ids).toEqual([]);
  });
});

describe("safe general announcement actions without source-record bypass", () => {
  const origin = "https://bakery.test";
  const destination = (action: string, branches: string[] = []) =>
    centerNoticeDestination(action, branches, ["a"], ["a"], 7, origin);
  it("opens branchless general pages without inventing a branch, and HTTPS announcements in a separate safe path", () => {
    expect(destination("/notifications-center")).toEqual({ href: "/notifications-center", branchId: "", navigationKind: "general" });
    expect(destination("https://bakery.test/help")).toEqual({ href: "/help", branchId: "", navigationKind: "general" });
    expect(destination("https://example.org/announcement")).toEqual({
      href: "https://example.org/announcement", branchId: "", navigationKind: "external",
    });
  });
  it("still requires branch/source validation for every business record and never treats a scoped source as an external announcement", () => {
    for (const href of ["/central-kitchen-orders?orderId=1", "/hr/leaves?leaveId=1",
      "/hr/onboarding?notificationId=1", "/notifications-center?branchId=b", "/api/active-notifications"]) {
      expect(destination(href)).toBeNull();
    }
    expect(destination("https://example.org/announcement", ["a"])).toBeNull();
    const record = destination("/transfer-requests?branchId=a&transferId=1", ["a"]);
    expect(record?.branchId).toBe("a");
    expect(record?.navigationKind).toBeUndefined();
    expect(destination("/transfer-requests?branchId=b&transferId=1", ["a"])).toBeNull();
  });
  it("rejects script, protocol-relative, credentials, control characters and HTTP links", () => {
    for (const href of ["javascript:alert(1)", "//example.org", "http://example.org", "https://user:pass@example.org",
      "/\\example.org", "/help\n", " https://example.org", "data:text/html,hello"]) {
      expect(parseAnnouncementAction(href, origin)).toBeNull();
      expect(destination(href)).toBeNull();
    }
  });
});