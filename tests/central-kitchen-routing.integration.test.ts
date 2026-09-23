import { describe, expect, it } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema";
import { getKitchenRouting, getKitchenRoutingBatch, kitchenActionAllowed, registerKitchenRoutingRoutes, routingCandidates, routingPermission, routingSchema } from "../server/central-kitchen-routing";
import { filterAuthorizedCentralKitchenNotificationUsers, insertCentralKitchenNotification, routedRecipients } from "../server/central-kitchen-notifications";

describe("routing authorization", () => {
  it("never promotes view or branch-manager blanket rights into approval", () => {
    expect(routingPermission("employee", ["view"], "approve")).toBe(false);
    expect(routingPermission("branch_manager", [], "approve")).toBe(false);
    expect(routingPermission("branch_manager", ["approve"], "approve")).toBe(true);
    expect(routingSchema.safeParse({ responsibleUserId: "a", deputyUserId: "a", receiverUserId: null }).success).toBe(false);
    expect(routingSchema.safeParse({ responsibleUserId: null, deputyUserId: null, receiverUserId: null }).success).toBe(true);
  });

  it("rechecks routing, branch access, permission revocation and exact notification targets transactionally", async () => {
    if (!process.env.DATABASE_URL) throw new Error("Development DATABASE_URL required");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const db = drizzle(pool, { schema });
    const rollback = new Error("ROLLBACK_ROUTING_TEST");
    try {
      await db.transaction(async tx => {
        const key = `routing-test-${Date.now()}`;
        const kitchen = `${key}-k`, branch = `${key}-b`, other = `${key}-o`;
        await tx.insert(schema.branches).values([
          { id: kitchen, name: key, isCentralKitchen: true }, { id: branch, name: key }, { id: other, name: key },
        ]);
        const lead = `${key}-lead`, creator = `${key}-creator`, ops = `${key}-ops`, manager = `${key}-manager`, receiver = `${key}-receiver`, admin = `${key}-admin`;
        await tx.insert(schema.users).values([
          { id: lead, role: "employee", branchId: kitchen }, { id: creator, role: "employee", branchId: branch },
          { id: ops, role: "operations_manager" }, { id: manager, role: "branch_manager", branchId: branch },
          { id: receiver, role: "employee", branchId: other }, { id: admin, role: "admin" },
        ]);
        await tx.insert(schema.userPermissions).values([
          { userId: lead, module: "central_kitchen_orders", actions: ["view", "approve", "edit"] },
          { userId: creator, module: "central_kitchen_orders", actions: ["view", "create", "edit"] },
          { userId: receiver, module: "central_kitchen_orders", actions: ["view", "edit"] },
          { userId: ops, module: "central_kitchen_orders", actions: ["view", "approve", "edit"] },
        ]);
        await tx.insert(schema.userBranchAccess).values({ userId: receiver, branchId: branch });
        await tx.insert(schema.centralKitchenRouting).values([
          { branchId: kitchen, responsibleUserId: lead }, { branchId: branch, receiverUserId: receiver },
        ]);
        const [order] = await tx.insert(schema.centralKitchenOrders).values({
          requestBranchId: branch, centralKitchenId: kitchen, createdBy: creator,
          orderNumber: key, orderDate: "2001-01-01", payloadFingerprint: key,
          neededDate: "2001-01-01", neededTime: "07:00", idempotencyKey: key,
        }).returning();
        expect(await kitchenActionAllowed(tx, lead, order, "approve")).toBe(true);
        expect(await kitchenActionAllowed(tx, creator, order, "receive")).toBe(false);
        expect(await kitchenActionAllowed(tx, receiver, order, "receive")).toBe(true);
        const batchRouting = await getKitchenRoutingBatch(tx, [kitchen, branch]);
        expect(batchRouting.get(kitchen)?.responsibleUserId).toBe(lead);
        expect(batchRouting.get(branch)?.receiverUserId).toBe(receiver);
        expect(await kitchenActionAllowed(tx, manager, order, "receive")).toBe(false);
        expect(await routedRecipients(tx, order, "created")).toEqual([lead]);
        expect((await routedRecipients(tx, order, "dispatched")).sort()).toEqual([creator, manager, receiver].sort());
        expect((await routedRecipients(tx, order, "received_discrepancy")).sort()).toEqual([lead, ops].sort());
        expect(await routedRecipients(tx, order, "overdue")).toEqual([ops]);

        const routes = new Map<string, any>();
        const app: any = { get: (path: string, ...handlers: any[]) => routes.set(`GET ${path}`, handlers.at(-1)),
          put: (path: string, ...handlers: any[]) => routes.set(`PUT ${path}`, handlers.at(-1)) };
        registerKitchenRoutingRoutes(app, tx, () => {}, (req: any) => req.user, async () => false);
        const invoke = async (path: string, userId: string, body?: any) => {
          let status = 200, output: any;
          const res: any = { set: () => res, status: (value: number) => { status = value; return res; },
            json: (value: any) => { output = value; return res; } };
          await routes.get(path)({ user: { id: userId }, query: { branchId: kitchen }, params: { branchId: kitchen }, body }, res);
          return { status, output };
        };
        expect((await invoke("GET /api/central-kitchen-orders/routing", creator)).status).toBe(200);
        expect((await invoke("GET /api/central-kitchen-orders/routing/candidates", creator)).status).toBe(403);
        expect((await invoke("GET /api/central-kitchen-orders/routing/candidates", ops)).status).toBe(200);
        expect((await invoke("PUT /api/central-kitchen-orders/routing/:branchId", admin,
          { responsibleUserId: creator, deputyUserId: null, receiverUserId: null })).status).toBe(400);

        // Test durable deduplication without invoking post-commit push in a
        // rollback-only fixture or notifying existing development orders.
        const eventInput = { eventId: order.id, orderId: order.id, event: "overdue" as const, branchId: kitchen, actorId: creator };
        const first = await insertCentralKitchenNotification(tx, eventInput);
        expect(first).toBeTypeOf("number");
        expect(await insertCentralKitchenNotification(tx, eventInput)).toBeNull();
        const [notice] = await tx.select().from(schema.systemNotifications).where(eq(schema.systemNotifications.id, first!));
        expect(await filterAuthorizedCentralKitchenNotificationUsers(tx, notice, [ops, admin, lead])).toEqual([ops]);
        expect(await routedRecipients(tx, { ...order, status: "received" }, "overdue")).toEqual([]);

        await tx.update(schema.userPermissions).set({ actions: ["view"] }).where(eq(schema.userPermissions.userId, lead));
        expect(await kitchenActionAllowed(tx, lead, order, "approve")).toBe(false);
        expect((await getKitchenRouting(tx, kitchen)).hasKitchenResponsible).toBe(false);
        expect((await getKitchenRoutingBatch(tx, [kitchen])).get(kitchen)?.hasKitchenResponsible).toBe(false);
        expect((await routingCandidates(tx, kitchen)).kitchenCandidates).toEqual([]);
        const missing = await insertCentralKitchenNotification(tx, { ...eventInput, event: "created", eventId: order.id + 1000000 });
        expect(missing).toBeTypeOf("number");
        const [missingNotice] = await tx.select().from(schema.systemNotifications).where(eq(schema.systemNotifications.id, missing!));
        expect(missingNotice.targetUserIds).toEqual([ops]);
        await tx.update(schema.users).set({ isActive: "inactive" }).where(eq(schema.users.id, ops));
        expect(await filterAuthorizedCentralKitchenNotificationUsers(tx, notice, [ops])).toEqual([]);
        await tx.delete(schema.userBranchAccess).where(eq(schema.userBranchAccess.userId, receiver));
        expect(await kitchenActionAllowed(tx, receiver, order, "receive")).toBe(false);
        expect((await getKitchenRoutingBatch(tx, [branch])).get(branch)).toMatchObject({
          receiverUserId: manager,
          receiverAssignmentSource: "branch_manager",
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await pool.end();
    }
  });
});