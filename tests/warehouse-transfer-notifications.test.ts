import { describe, expect, it } from "vitest";
import {
  buildWarehouseTransferNotificationPayload,
  hasWarehouseAction,
  routedWarehouseTransferRecipients,
} from "../server/warehouse-transfer-notifications";

function executorWith(users: any[], access: any[], overrides: any[] = []) {
  let selectCall = 0;
  return {
    select: () => {
      const call = selectCall++;
      const rows = call === 0 ? users : call === 1 ? access : overrides;
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        then: (resolve: (value: any[]) => unknown) => Promise.resolve(rows).then(resolve),
      };
      return chain;
    },
  } as any;
}

describe("warehouse transfer lifecycle notifications", () => {
  it("is action-aware and does not infer warehouse permission from a role", () => {
    expect(hasWarehouseAction("employee", ["view"], "view")).toBe(true);
    expect(hasWarehouseAction("employee", ["view"], "edit")).toBe(false);
    expect(hasWarehouseAction("branch_manager", null, "view")).toBe(false);
    expect(hasWarehouseAction("operations_manager", null, "edit")).toBe(true);
    expect(hasWarehouseAction("production_development_manager", null, "edit")).toBe(true);
    expect(hasWarehouseAction("viewer", ["edit"], "edit")).toBe(false);
    expect(hasWarehouseAction("attendance_clerk", ["view"], "view")).toBe(false);
    expect(hasWarehouseAction("admin", null, "edit")).toBe(true);
  });

  it("uses exact recipients, both-side live scope and a safe exact deep link", () => {
    const payload = buildWarehouseTransferNotificationPayload({
      transfer: {
        id: 42,
        sourceBranchId: "main_warehouse",
        destinationBranchId: "branch a&b",
      } as any,
      event: "in_transit",
      actorId: "dispatcher",
      recipientIds: ["receiver"],
    });
    expect(payload).toMatchObject({
      targetAllBranches: false,
      targetBranchIds: ["branch a&b"],
      targetUserIds: ["receiver"],
      accessModule: "warehouse",
      accessBranchIds: ["main_warehouse", "branch a&b"],
      dedupeKey: "warehouse-transfer:42:in_transit:in_transit",
      buttonAction: "/transfer-requests?branchId=branch%20a%26b&transferId=42",
      showOnce: true,
    });
  });

  it("keeps successive real quantity-edit events distinct", () => {
    const base = {
      transfer: { id: 42, sourceBranchId: "source", destinationBranchId: "destination" } as any,
      event: "modified" as const,
      actorId: "editor",
      recipientIds: ["requester"],
    };
    const first = buildWarehouseTransferNotificationPayload({ ...base, eventKey: "event-a" });
    const second = buildWarehouseTransferNotificationPayload({ ...base, eventKey: "event-b" });
    expect(first.dedupeKey).not.toBe(second.dedupeKey);
  });

  it("routes action events only to currently authorized destination users", async () => {
    const executor = executorWith([
      { id: "destination-editor", role: "employee", primaryBranchId: "other", actions: ["view", "edit"] },
      { id: "source-editor", role: "employee", primaryBranchId: "source", actions: ["view", "edit"] },
      { id: "revoked", role: "employee", primaryBranchId: "destination", actions: ["view"] },
      { id: "wrong-branch", role: "employee", primaryBranchId: "other", actions: ["view", "edit"] },
    ], [
      { userId: "destination-editor", branchId: "destination" },
    ]);
    expect(await routedWarehouseTransferRecipients(executor, {
      sourceBranchId: "source",
      destinationBranchId: "destination",
      createdBy: "requester",
    }, "in_transit")).toEqual(["destination-editor"]);
  });

  it("does not resurrect a denied action through an operations role template", async () => {
    const executor = executorWith([
      { id: "revoked", role: "operations_manager", primaryBranchId: "source", actions: null },
      { id: "expired", role: "operations_manager", primaryBranchId: "source", actions: null },
    ], [{ userId: "revoked", branchId: "destination" }, { userId: "expired", branchId: "destination" }], [
      { userId: "revoked", action: "edit", allow: false, expiresAt: null },
      { userId: "expired", action: "edit", allow: false, expiresAt: new Date(Date.now() - 1000) },
    ]);
    expect(await routedWarehouseTransferRecipients(executor, {
      sourceBranchId: "source", destinationBranchId: "destination", createdBy: "requester",
    }, "in_transit")).toEqual(["expired"]);
  });

  it.each([
    "created",
    "approved",
    "rejected",
    "modified",
    "in_transit",
    "delivered",
    "delivered_discrepancy",
    "cancelled",
  ] as const)("provides useful Arabic copy for %s", event => {
    const payload = buildWarehouseTransferNotificationPayload({
      transfer: { id: 1, sourceBranchId: "source", destinationBranchId: "destination" } as any,
      event,
      actorId: "actor",
      recipientIds: ["recipient"],
    });
    expect(payload.title.length).toBeGreaterThan(8);
    expect(payload.content.length).toBeGreaterThan(10);
  });
});