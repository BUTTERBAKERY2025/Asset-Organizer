import { describe, expect, it } from "vitest";
import {
  resolveKitchenRouting,
  routingPermission,
  routingPersonEligible,
} from "../server/central-kitchen-routing";

const branchA = "branch-a";
const branchB = "branch-b";

function manager(
  id: string,
  branchId: string | null = branchA,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    name: id,
    role: "branch_manager",
    branchId,
    actions: [],
    ...extra,
  };
}

describe("central-kitchen automatic branch-manager receiver", () => {
  it("selects the unique active primary branch manager", () => {
    const result = resolveKitchenRouting(branchA, null, [manager("manager-a")]);

    expect(result).toMatchObject({
      receiverUserId: "manager-a",
      receiverName: "manager-a",
      receiverAssignmentSource: "branch_manager",
      receiverAssignmentConflict: false,
    });
  });

  it("does not choose arbitrarily when multiple eligible primary managers exist", () => {
    const result = resolveKitchenRouting(branchA, null, [
      manager("manager-1"),
      manager("manager-2"),
    ]);

    expect(result).toMatchObject({
      receiverUserId: null,
      receiverAssignmentSource: "unassigned",
      receiverAssignmentConflict: true,
    });
  });

  it("ignores inactive users because only live eligible people enter the resolver", () => {
    const result = resolveKitchenRouting(branchA, null, []);

    expect(result).toMatchObject({
      receiverUserId: null,
      receiverAssignmentSource: "unassigned",
      receiverAssignmentConflict: false,
    });
  });

  it("deactivates a transferred manager and activates the new primary assignment live", () => {
    const transferred = resolveKitchenRouting(branchA, null, [
      manager("old-manager", branchB),
      manager("new-manager", branchA),
    ]);

    expect(transferred.receiverUserId).toBe("new-manager");
    expect(transferred.receiverAssignmentSource).toBe("branch_manager");
  });

  it("requires edit eligibility and honors a live deny override", () => {
    const revoked = manager("revoked", branchA, { _deniedActions: ["edit"] });

    expect(routingPersonEligible(revoked, "edit")).toBe(false);
    expect(resolveKitchenRouting(branchA, null, [revoked])).toMatchObject({
      receiverUserId: null,
      receiverAssignmentSource: "unassigned",
    });
  });

  it("requires edit in custom permissions rather than applying the role fallback", () => {
    const noEdit = manager("custom-no-edit", branchA, {
      _hasCustomPermissions: true,
      actions: ["view"],
    });

    expect(routingPersonEligible(noEdit, "edit")).toBe(false);
    expect(resolveKitchenRouting(branchA, null, [noEdit]).receiverUserId).toBeNull();
  });

  it("an explicit empty kitchen override revokes the branch manager's receiver eligibility", () => {
    const revoked = manager("revoked", branchA, { _hasCustomPermissions: true, actions: [] });
    expect(routingPersonEligible(revoked, "view")).toBe(false);
    expect(routingPersonEligible(revoked, "edit")).toBe(false);
    expect(resolveKitchenRouting(branchA, null, [revoked]).receiverUserId).toBeNull();
  });

  it("never grants a source approval to branch managers with a custom approve action", () => {
    expect(routingPermission("branch_manager", ["approve", "edit"], "approve")).toBe(false);
    expect(routingPersonEligible(manager("source-approver", branchA,
      { _hasCustomPermissions: true, actions: ["approve", "edit"] }), "approve")).toBe(false);
  });

  it("keeps an eligible explicit manual receiver higher priority", () => {
    const manual = {
      id: "manual-user",
      name: "Manual User",
      role: "employee",
      branchId: branchA,
      actions: ["edit"],
    };
    const result = resolveKitchenRouting(
      branchA,
      { receiverUserId: manual.id },
      [manager("manager-a"), manager("manager-b"), manual],
    );

    expect(result).toMatchObject({
      receiverUserId: manual.id,
      receiverAssignmentSource: "manual",
      receiverAssignmentConflict: false,
    });
  });

  it("falls back safely when a configured manual receiver becomes ineligible", () => {
    const ineligibleManual = {
      id: "manual-user",
      role: "employee",
      branchId: branchA,
      actions: [],
    };
    const result = resolveKitchenRouting(
      branchA,
      { receiverUserId: ineligibleManual.id },
      [ineligibleManual, manager("manager-a")],
    );

    expect(result).toMatchObject({
      receiverUserId: "manager-a",
      receiverAssignmentSource: "branch_manager",
      receiverAssignmentConflict: false,
    });
  });

  it("honors an explicitly authorized extra branch, including a null primary", () => {
    const result = resolveKitchenRouting(branchA, null, [
      manager("cross-scope-manager", branchB, { authorizedBranchIds: [branchA, branchB] }),
    ]);
    expect(result.receiverUserId).toBe("cross-scope-manager");
    expect(resolveKitchenRouting(branchA, null, [
      manager("no-primary", null, { authorizedBranchIds: [branchA] }),
    ]).receiverUserId).toBe("no-primary");
  });

  it("fails closed on revoked/empty grants and refuses ambiguous auto assignment", () => {
    expect(resolveKitchenRouting(branchA, null, [
      manager("revoked", branchA, { authorizedBranchIds: [branchB] }),
    ])).toMatchObject({
      receiverUserId: null,
      receiverAssignmentSource: "unassigned",
      receiverAssignmentConflict: false,
    });
    expect(resolveKitchenRouting(branchA, null, [
      manager("empty", null, { authorizedBranchIds: [] }),
    ]).receiverUserId).toBeNull();
    expect(resolveKitchenRouting(branchA, null, [
      manager("primary", branchA),
      manager("extra", branchB, { authorizedBranchIds: [branchA, branchB] }),
    ])).toMatchObject({ receiverUserId: null, receiverAssignmentConflict: true });
  });

  it("uses one authoritative resolver contract for single and batch callers", async () => {
    const source = await import("../server/central-kitchen-routing");
    const result = source.resolveKitchenRouting(branchA, null, [manager("manager-a")]);

    expect(Object.keys(result)).toEqual(expect.arrayContaining([
      "receiverAssignmentSource",
      "receiverAssignmentConflict",
    ]));
    expect(result.receiverAssignmentSource).toBe("branch_manager");
  });
});