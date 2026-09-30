import { describe, expect, it } from "vitest";
import { findAuthorizedJoiningNotification, joiningNotificationId, consumeJoiningNotificationLink, joiningNotificationResponseReady, retainAuthorizedJoiningRow } from "../client/src/lib/onboarding-notification-navigation";

describe("authorized onboarding notification link receiver", () => {
  const rows = [
    { offer: { id: 2 }, notification: { id: 12 } },
    { offer: { id: 3 }, notification: null },
  ];
  it("accepts the exact operations notification button URL and selects only its loaded authorized row", () => {
    const url = new URL("/hr/onboarding?notificationId=12", "https://app.test");
    expect(findAuthorizedJoiningNotification(url.search, rows)).toBe(rows[0]);
  });
  it("does not select an offer ID instead of a notification ID or load a missing/revoked record", () => {
    expect(findAuthorizedJoiningNotification("?notificationId=2", rows)).toBeNull();
    expect(findAuthorizedJoiningNotification("?notificationId=99", rows)).toBeNull();
    expect(findAuthorizedJoiningNotification("?notificationId=12", [])).toBeNull();
  });
  it("rejects ambiguous or malformed numeric IDs", () => {
    for (const raw of ["0", "-1", "12x", "1.2", "01", "Infinity", "9007199254740993", ""]) {
      expect(joiningNotificationId(`?notificationId=${raw}`)).toBeNull();
    }
    expect(joiningNotificationId("?notificationId=12&notificationId=13")).toBeNull();
  });
  it("waits for a fresh authorized list and consumes the link once, so dismissing cannot auto-reopen", () => {
    const consumed = new Set<string>();
    expect(consumeJoiningNotificationLink("?notificationId=12", [], false, consumed).handled).toBe(false);
    expect(consumed.size).toBe(0);
    expect(consumeJoiningNotificationLink("?notificationId=12", rows, true, consumed)).toEqual({ handled: true, row: rows[0] });
    expect(consumeJoiningNotificationLink("?notificationId=12", rows, true, consumed)).toEqual({ handled: false, row: null });
  });
  it("clears a selected revoked record and never resurrects it from the consumed link", () => {
    const consumed = new Set<string>();
    const selected = consumeJoiningNotificationLink("?notificationId=12", rows, true, consumed).row;
    expect(retainAuthorizedJoiningRow(selected, [])).toBeNull();
    expect(consumeJoiningNotificationLink("?notificationId=12", rows, true, consumed).handled).toBe(false);
    expect(retainAuthorizedJoiningRow(selected, rows)).toBe(rows[0]);
  });
  it("does not consume an initial query failure; a successful retry opens the exact authorized record once", () => {
    const consumed = new Set<string>();
    const failed = { isSuccess: false, isFetching: false, isError: true };
    expect(consumeJoiningNotificationLink("?notificationId=12", [], joiningNotificationResponseReady(failed), consumed).handled).toBe(false);
    expect(consumed.size).toBe(0);
    const success = { isSuccess: true, isFetching: false, isError: false };
    expect(consumeJoiningNotificationLink("?notificationId=12", rows, joiningNotificationResponseReady(success), consumed).row).toBe(rows[0]);
    expect(consumeJoiningNotificationLink("?notificationId=12", rows, joiningNotificationResponseReady(success), consumed).handled).toBe(false);
    expect(retainAuthorizedJoiningRow(rows[0], [])).toBeNull();
  });
  it("does not consume stale authorized data during refetch or an errored refetch", () => {
    expect(joiningNotificationResponseReady({ isSuccess: true, isFetching: true, isError: false })).toBe(false);
    expect(joiningNotificationResponseReady({ isSuccess: true, isFetching: false, isError: true })).toBe(false);
  });
});