import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { kitchenActionAllowed, resolveKitchenRouting } from "../server/central-kitchen-routing";

const order = { requestBranchId: "requester", centralKitchenId: "kitchen" };
const actor = (id: string, branchId: string, role = "branch_manager") => ({
  id, role, branchId, actions: ["view", "edit", "approve"],
  _hasCustomPermissions: true,
});

// Exercise the live guard's routing queries without a database or production writes.
function routingExecutor(person: ReturnType<typeof actor>, scopedBranch: string | null) {
  let query = 0;
  return {
    select() {
      const current = ++query;
      // routingPeople builds a userBranchAccess subquery before its people query.
      const rows = current === 2 ? [person]
        : current === 3 ? [{ userId: person.id, module: "central_kitchen_orders", actions: person.actions }]
        : current === 7 ? (scopedBranch ? [person] : [])
        : current === 8 && scopedBranch
          ? [{ userId: person.id, module: "central_kitchen_orders", actions: person.actions }]
          : [];
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => Promise.resolve(rows),
      };
      return chain;
    },
    insert() { throw new Error("Unexpected write"); },
  };
}

describe("central kitchen action actor/source authority", () => {
  it.each(["approve", "prepare", "dispatch"])(
    "never grants %s using the request branch's edit or approve permissions",
    async action => {
      const requester = actor("requester-manager", order.requestBranchId);
      expect(await kitchenActionAllowed(routingExecutor(requester, null), requester.id, order, action)).toBe(false);

      // Kitchen-side actions are restricted to the existing explicit
      // production manager role; branch-scoped edit/approve alone is not a grant.
      const source = actor("production-manager", order.centralKitchenId, "production_development_manager");
      expect(await kitchenActionAllowed(routingExecutor(source, order.centralKitchenId), source.id, order, action)).toBe(true);
      const kitchenBranchManager = actor("kitchen-branch-manager", order.centralKitchenId);
      expect(await kitchenActionAllowed(routingExecutor(kitchenBranchManager, order.centralKitchenId),
        kitchenBranchManager.id, order, action)).toBe(false);
      const unrelated = actor("other-manager", "other");
      expect(await kitchenActionAllowed(routingExecutor(unrelated, null), unrelated.id, order, action)).toBe(false);
    },
  );

  it("keeps explicit admin/operations authority, but respects revoked actions", async () => {
    for (const role of ["admin", "operations_manager"]) {
      const supervisor = actor(role, "other", role);
      expect(await kitchenActionAllowed(routingExecutor(supervisor, null), supervisor.id, order, "approve")).toBe(true);
      expect(await kitchenActionAllowed(routingExecutor(supervisor, null), supervisor.id, order, "prepare")).toBe(true);
      const revoked = { ...supervisor, actions: ["view", "edit"] };
      expect(await kitchenActionAllowed(routingExecutor(revoked, null), revoked.id, order, "approve")).toBe(false);
    }
  });

  it("requires action-specific permission even for the production manager", async () => {
    const source = { ...actor("production-manager", "kitchen", "production_development_manager"), actions: ["view", "edit"] };
    expect(await kitchenActionAllowed(routingExecutor(source, "kitchen"), source.id, order, "approve")).toBe(false);
    expect(await kitchenActionAllowed(routingExecutor(source, "kitchen"), source.id, order, "prepare")).toBe(true);
  });

  it("leaves receiving in the requester branch and does not assign it to source operators", () => {
    const requester = actor("requester-manager", order.requestBranchId);
    const source = actor("source-operator", order.centralKitchenId);
    expect(resolveKitchenRouting(order.requestBranchId, null, [requester]).receiverUserId).toBe(requester.id);
    expect(resolveKitchenRouting(order.requestBranchId, null, [source]).receiverUserId).toBeNull();
  });

  it("keeps detail flags and transitions on the same guard and action branch", () => {
    const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
    const detail = routes.slice(routes.indexOf('app.get(\n    "/api/central-kitchen-orders/:id",'),
      routes.indexOf('app.post(\n    "/api/central-kitchen-orders",'));
    const transitions = routes.slice(routes.indexOf("const transitionCentralKitchenOrder ="),
      routes.indexOf('app.post("/api/central-kitchen-orders/:id/approve"'));
    expect(detail).toContain('action === "receive" ? detail.requestBranchId : detail.centralKitchenId');
    expect(detail).toContain("kitchenActionAllowed(db, actorId, detail, action)");
    expect(transitions).toContain('targetStatus === "received"\n        ? order.requestBranchId\n        : order.centralKitchenId');
    expect(transitions).toContain("kitchenActionAllowed(db, user.id, order, routingAction)");
    expect(transitions).toContain("canAccessBranch(req, scopedBranchId)");
    expect(transitions).toContain("kitchenActionAllowed(tx, user.id, order, routingAction)");
    expect(detail).toContain("canAccessBranch(req, detail.requestBranchId)");
    expect(detail).toContain("allowedActions.edit = !!requestEditable");
    expect(detail).toContain("allowedActions.cancel = !!(branchEditor");
  });
});