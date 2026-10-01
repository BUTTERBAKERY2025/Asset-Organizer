import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  people: {} as Record<string, any[]>, permitted: true, editRevoked: false,
  user: { id: "ops", role: "operations_manager", branchId: "dest", isActive: "active" },
  allowed: ["dest"] as string[] | null,
  row: { id: 31, kind: "product_return", status: "inspected", source_branch_id: "source",
    destination_branch_id: "dest", destination_warehouse_id: null,
    damaged_quantity: "2", written_off_quantity: "0", event_action: "inspect" },
  deliveryEvent: "failed",
}));
const query = vi.hoisted(() => vi.fn());
vi.mock("../server/db", () => ({ pool: { query }, db: {} }));
vi.mock("../server/source-notification-access", () => ({
  sourceNoticeAccess: async (id: string) => id === state.user.id ? {
    user: state.user, allowed: state.allowed,
    branch: (branch: string) => !!branch && (state.allowed === null || state.allowed.includes(branch)),
    view: async () => state.permitted,
  } : null,
}));
vi.mock("../server/auth", () => ({
  requirePermission: () => (_req: unknown, res: any, next: () => void) => state.permitted ? next() : res.status(403).json({}),
}));
vi.mock("../server/central-kitchen-routing", () => ({
  routingPeople: async (_tx: unknown, branch: string) => state.people[branch] || [],
  routingPersonEligible: (p: any) => p.view === true,
  kitchenManagerEligible: (p: any) => p.role === "production_development_manager" && p.view === true,
  getKitchenRouting: async () => ({ receiverUserId: "receiver", hasKitchenResponsible: true }),
}));
vi.mock("../server/warehouse-transfer-notifications", () => ({ routedWarehouseTransferRecipients: async () => [] }));

import { routedRecipients } from "../server/central-kitchen-notifications";
import { filterAuthorizedDeliveryNoticeUsers } from "../server/delivery-notifications";
import { filterAuthorizedReverseNotificationUsers, insertReverseMovementNotification, projectReverseSourceNotificationForRecipient } from "../server/reverse-logistics-notifications";
import { cancelDeliveryAssignmentForSource } from "../server/delivery-dispatch-guard";

beforeEach(() => {
  state.permitted = true;
  state.editRevoked = false;
  state.allowed = ["dest"];
  state.user = { id: "ops", role: "operations_manager", branchId: "dest", isActive: "active" };
  state.row.status = "inspected"; state.row.written_off_quantity = "0"; state.row.event_action = "inspect";
  state.people = {
    source: [{ id: "source-ops", role: "operations_manager", authorizedBranchIds: ["source"], view: true },
      { id: "producer", role: "production_development_manager", view: true }],
    dest: [{ id: "ops", role: "operations_manager", authorizedBranchIds: ["dest"], view: true }],
  };
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("reverse_movement_events")) return { rows: [state.row] };
    if (sql.includes("user_permission_overrides")) return { rows: [], rowCount: state.editRevoked ? 1 : 0 };
    if (sql.includes("delivery_notification_outbox")) return { rows: [{
      id: "11", source_type: "kitchen", source_id: 9, status: state.deliveryEvent,
      event_type: state.deliveryEvent, driver_id: null,
    }] };
    if (sql.includes("central_kitchen_orders")) return { rows: [{ source: "source", destination: "dest", status: "dispatched" }] };
    if (sql.includes("is_active='active'")) return { rows: [{ id: "source-ops" }, { id: "ops" }] };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
});

describe("kitchen exceptions follow the authorized operational scope", () => {
  const order = { centralKitchenId: "source", requestBranchId: "dest" };
  it("notifies source and destination operations of opened/resolved discrepancies, without routine broadcasts", async () => {
    for (const event of ["received_discrepancy", "discrepancy_resolved"] as const) {
      const ids = await routedRecipients({} as any, order, event);
      expect(ids).toContain("source-ops"); expect(ids).toContain("ops");
    }
    expect(await routedRecipients({} as any, order, "created")).not.toContain("ops");
  });
  it("rechecks explicit branch grant and current permission", async () => {
    state.people.dest[0].authorizedBranchIds = [];
    expect(await routedRecipients({} as any, order, "discrepancy_resolved")).not.toContain("ops");
    state.people.source[0].view = false;
    expect(await routedRecipients({} as any, order, "received_discrepancy")).not.toContain("source-ops");
  });
  it("enqueues compensation creation inside its source transaction and dispatches only after commit", () => {
    const code = readFileSync("server/central-kitchen-demand-routes.ts", "utf8");
    expect(code).toContain("eventId: createdEvent.id, orderId: order.id, event: \"created\"");
    expect(code).toContain("notificationIds.forEach(dispatchCentralKitchenNotificationAfterCommit)");
  });
});

describe("delivery escalation and cancellation", () => {
  it.each(["failed", "overdue", "escalated"])("rechecks source-side operations recipients for %s", async event => {
    state.deliveryEvent = event;
    const n = { dedupeKey: "delivery:11:source-ops", targetUserIds: ["source-ops", "ops"] };
    expect(await filterAuthorizedDeliveryNoticeUsers(n, ["source-ops", "ops"])).toEqual(["source-ops"]);
    state.people.source[0].view = false;
    expect(await filterAuthorizedDeliveryNoticeUsers(n, ["source-ops", "ops"])).toEqual([]);
  });
  it("writes source cancellation, immutable event and outbox in the same executor; retries do not duplicate", async () => {
    let status = "assigned";
    const tx = { query: vi.fn(async (sql: string) => {
      if (sql.startsWith("SELECT")) return { rows: [{ id: 4, status }] };
      if (sql.startsWith("UPDATE")) status = "cancelled";
      if (sql.includes("INSERT INTO delivery_assignment_events")) return { rows: [{ id: 8 }] };
      return { rows: [] };
    }) };
    const input = { sourceType: "kitchen" as const, sourceId: 9, actorId: "ops" };
    await cancelDeliveryAssignmentForSource(tx as any, input);
    expect(tx.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO delivery_notification_outbox"))).toHaveLength(1);
    expect(tx.query.mock.calls.at(-1)![0]).toContain("ON CONFLICT");
    await cancelDeliveryAssignmentForSource(tx as any, input);
    expect(tx.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO delivery_assignment_events"))).toHaveLength(1);
  });
});

describe("reverse source notices reauthorize at READ and PUSH", () => {
  const notice = () => ({ id: 17, autoGenerated: true, autoSource: "reverse_movement", accessModule: "warehouse",
    dedupeKey: "reverse-event:12:inspect:ops", targetUserIds: ["ops"],
    buttonAction: "/reverse-logistics?branchId=dest&movementId=31", title: "فحص المرتجع" }) as any;
  it("exposes a damaged inspection only to a currently permitted destination operations editor", async () => {
    expect(await filterAuthorizedReverseNotificationUsers(notice(), ["ops"])).toEqual(["ops"]);
    state.permitted = false;
    expect(await filterAuthorizedReverseNotificationUsers(notice(), ["ops"])).toEqual([]);
    expect(await projectReverseSourceNotificationForRecipient(notice(), "ops")).toBeNull();
    state.permitted = true; state.allowed = ["source"];
    expect(await filterAuthorizedReverseNotificationUsers(notice(), ["ops"])).toEqual([]);
  });
  it("respects explicit edit revocation and global warehouse custody without inventing branch grants", async () => {
    state.editRevoked = true;
    expect(await filterAuthorizedReverseNotificationUsers(notice(), ["ops"])).toEqual([]);
    state.editRevoked = false;
    const movement = { ...state.row, kind: "warehouse_transfer", source_branch_id: null, destination_branch_id: null };
    const tx = { query: vi.fn(async (sql: string) => sql.includes("SELECT u.id")
      ? { rows: [{ id: "ops" }] } : { rows: [{ id: 90 }] }) };
    expect(await insertReverseMovementNotification(tx as any, movement, 12, "inspect", "actor")).toEqual([]);
    state.allowed = null;
    expect(await insertReverseMovementNotification(tx as any, movement, 12, "inspect", "actor")).toEqual([90]);
  });
  it("strips completed inspection CTA and validates immutable event identity", async () => {
    state.row.written_off_quantity = "2";
    const projected = await projectReverseSourceNotificationForRecipient(notice(), "ops");
    expect(projected?.sourceState).toBe("history"); expect(projected?.buttonAction).toBeNull();
    expect(await projectReverseSourceNotificationForRecipient({ ...notice(), buttonAction: "/reverse-logistics?movementId=99" }, "ops")).toBeNull();
    state.row.event_action = "writeoff";
    expect(await filterAuthorizedReverseNotificationUsers(notice(), ["ops"])).toEqual([]);
  });
  it("creates exact per-recipient event-deduped rows with the transaction executor", async () => {
    const tx = { query: vi.fn(async (sql: string) => sql.includes("SELECT u.id")
      ? { rows: [{ id: "ops" }, { id: "outsider" }] } : { rows: [{ id: 90 }] }) };
    expect(await insertReverseMovementNotification(tx as any, state.row, 12, "inspect", "actor")).toEqual([90]);
    const [sql, values] = tx.query.mock.calls.at(-1)! as unknown as [string, any[]];
    expect(sql).toContain("ON CONFLICT(dedupe_key) DO NOTHING");
    expect(values).toContain("reverse-event:12:inspect:ops");
  });
});