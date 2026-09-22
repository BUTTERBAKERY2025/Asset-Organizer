import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { branches, centralKitchenRouting, systemAuditLogs, userBranchAccess, userPermissions, users,
  permissions, rolePermissions, userAssignments, userPermissionOverrides } from "@shared/schema";

export type RoutingExecutor = { select: (...args: any[]) => any; insert: (...args: any[]) => any };
export const routingSchema = z.object({
  responsibleUserId: z.string().min(1).nullable(),
  deputyUserId: z.string().min(1).nullable(),
  receiverUserId: z.string().min(1).nullable(),
}).strict().refine(value => {
  const ids = Object.values(value).filter(Boolean);
  return new Set(ids).size === ids.length;
}, "يجب اختيار أشخاص مختلفين");

export function routingPermission(role: string, actions: string[], action: string) {
  return role === "admin" || actions.includes(action)
    || (role === "branch_manager" && ["view", "edit", "create"].includes(action));
}

export async function routingPeople(tx: RoutingExecutor, branchId?: string) {
  const access = tx.select({ id: userBranchAccess.userId }).from(userBranchAccess)
    .where(eq(userBranchAccess.branchId, branchId || ""));
  const people = await tx.select({
    id: users.id, name: users.firstName, lastName: users.lastName, username: users.username,
    role: users.role, actions: userPermissions.actions,
  }).from(users).leftJoin(userPermissions, and(eq(userPermissions.userId, users.id),
    eq(userPermissions.module, "central_kitchen_orders")))
    .where(and(eq(users.isActive, "active"), ...(branchId ? [or(eq(users.branchId, branchId), inArray(users.id, access))] : [])));
  if (!people.length) return people;
  const ids = people.map((p: any) => p.id);
  const direct = await tx.select().from(userPermissions).where(inArray(userPermissions.userId, ids));
  const inherited = await tx.select({ userId: userAssignments.userId, action: permissions.action })
    .from(userAssignments).innerJoin(rolePermissions, eq(userAssignments.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(inArray(userAssignments.userId, ids), eq(userAssignments.isActive, true), eq(permissions.module, "central_kitchen_orders")));
  const overrides = await tx.select({ userId: userPermissionOverrides.userId, action: permissions.action,
    allow: userPermissionOverrides.allow, expiresAt: userPermissionOverrides.expiresAt })
    .from(userPermissionOverrides).innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(and(inArray(userPermissionOverrides.userId, ids), eq(permissions.module, "central_kitchen_orders")));
  for (const person of people) {
    // Unrelated module overrides must not erase kitchen role permissions.
    const hasCustom = direct.some((p: any) => p.userId === person.id
      && p.module === "central_kitchen_orders" && p.actions.length > 0);
    const actions = new Set<string>(hasCustom ? person.actions || []
      : inherited.filter((p: any) => p.userId === person.id).map((p: any) => p.action));
    for (const override of overrides.filter((p: any) => p.userId === person.id)) {
      if (override.expiresAt && new Date(override.expiresAt).getTime() < Date.now()) continue;
      if (override.allow) actions.add(override.action);
      else actions.delete(override.action);
    }
    person.actions = Array.from(actions);
  }
  return people;
}

export async function routingActor(tx: RoutingExecutor, userId: string) {
  return (await routingPeople(tx)).find((person: any) => person.id === userId);
}

export async function routingCandidates(tx: RoutingExecutor, branchId: string) {
  const people = await routingPeople(tx, branchId);
  const named = (p: any) => ({ id: p.id, name: [p.name, p.lastName].filter(Boolean).join(" ") || p.username || p.id });
  return {
    kitchenCandidates: people.filter((p: any) => routingPermission(p.role, p.actions || [], "approve")).map(named),
    receiverCandidates: people.filter((p: any) => routingPermission(p.role, p.actions || [], "edit")).map(named),
  };
}

export async function getKitchenRouting(tx: RoutingExecutor, branchId: string) {
  const [row] = await tx.select().from(centralKitchenRouting).where(eq(centralKitchenRouting.branchId, branchId));
  const candidates = await routingCandidates(tx, branchId);
  const responsible = candidates.kitchenCandidates.find((p: any) => p.id === row?.responsibleUserId);
  const deputy = candidates.kitchenCandidates.find((p: any) => p.id === row?.deputyUserId);
  const receiver = candidates.receiverCandidates.find((p: any) => p.id === row?.receiverUserId);
  return {
    branchId, responsibleUserId: responsible?.id || null, deputyUserId: deputy?.id || null,
    receiverUserId: receiver?.id || null, responsibleName: responsible?.name || null,
    deputyName: deputy?.name || null, receiverName: receiver?.name || null,
    hasKitchenResponsible: !!(responsible || deputy),
  };
}

export async function kitchenActionAllowed(tx: RoutingExecutor, userId: string, order: any, action: string) {
  const branchId = action === "receive" ? order.requestBranchId : order.centralKitchenId;
  const actor = await routingActor(tx, userId);
  if (!actor || !routingPermission(actor.role, actor.actions || [], action === "approve" ? "approve" : "edit")) return false;
  if (["admin", "operations_manager"].includes(actor.role)) return true;
  const people = await routingPeople(tx, branchId);
  if (!people.some((p: any) => p.id === userId)) return false;
  if (!["approve", "receive"].includes(action)) return true;
  const routing = await getKitchenRouting(tx, branchId);
  return action === "approve"
    ? [routing.responsibleUserId, routing.deputyUserId].includes(userId)
    : routing.receiverUserId === userId || actor.role === "branch_manager";
}

export function registerKitchenRoutingRoutes(app: any, db: any, auth: any, getUser: any, canAccessBranch: any) {
  const handler = (kind: "read" | "candidates" | "write") => async (req: any, res: any) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const branchId = kind === "write" ? req.params.branchId : req.query.branchId;
      if (typeof branchId !== "string" || !branchId) return res.status(400).json({ error: "الفرع مطلوب" });
      const actor = await routingActor(db, getUser(req).id);
      if (!actor || !routingPermission(actor.role, actor.actions || [], "view")) return res.status(403).json({ error: "غير مصرح" });
      const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
      if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });
      if (kind === "read") {
        if (!branch.isCentralKitchen && !(await canAccessBranch(req, branchId))) return res.status(403).json({ error: "غير مصرح للفرع" });
        return res.json(await getKitchenRouting(db, branchId));
      }
      if (!["admin", "operations_manager"].includes(actor.role)) return res.status(403).json({ error: "إعدادات التوجيه للإدارة فقط" });
      if (kind === "candidates") return res.json(await routingCandidates(db, branchId));
      const parsed = routingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "أشخاص التوجيه غير صالحين أو مكررون" });
      const result = await db.transaction(async (tx: any) => {
        const currentActor = await routingActor(tx, actor.id);
        if (!currentActor || !["admin", "operations_manager"].includes(currentActor.role)
          || !routingPermission(currentActor.role, currentActor.actions || [], "view")) throw new Error("ROUTING_FORBIDDEN");
        const candidates = await routingCandidates(tx, branchId);
        for (const [key, id] of Object.entries(parsed.data)) {
          const eligible = key === "receiverUserId" ? candidates.receiverCandidates : candidates.kitchenCandidates;
          if (id && !eligible.some((p: any) => p.id === id)) throw new Error("ROUTING_INELIGIBLE");
        }
        const [before] = await tx.select().from(centralKitchenRouting).where(eq(centralKitchenRouting.branchId, branchId));
        const values = { ...parsed.data, updatedBy: actor.id, updatedAt: new Date() };
        await tx.insert(centralKitchenRouting).values({ branchId, ...values }).onConflictDoUpdate({ target: centralKitchenRouting.branchId, set: values });
        await tx.insert(systemAuditLogs).values({ module: "central_kitchen_orders", entityId: branchId,
          action: "update", userId: actor.id, branchId, details: JSON.stringify({ before: before || null, after: values }) });
        return getKitchenRouting(tx, branchId);
      });
      return res.json(result);
    } catch (error: any) {
      if (error.message === "ROUTING_INELIGIBLE") return res.status(400).json({ error: "المستخدم غير نشط أو لا يملك صلاحية الإجراء والوصول للفرع" });
      if (error.message === "ROUTING_FORBIDDEN") return res.status(403).json({ error: "غير مصرح" });
      console.error("[kitchen-routing]", error);
      return res.status(500).json({ error: "تعذر حفظ أو قراءة التوجيه" });
    }
  };
  app.get("/api/central-kitchen-orders/routing", auth, handler("read"));
  app.get("/api/central-kitchen-orders/routing/candidates", auth, handler("candidates"));
  app.put("/api/central-kitchen-orders/routing/:branchId", auth, handler("write"));
}