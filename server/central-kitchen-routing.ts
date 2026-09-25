import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { branches, centralKitchenRouting, systemAuditLogs, userBranchAccess, userPermissions, users,
  permissions, rolePermissions, userAssignments, userPermissionOverrides, ROLE_PERMISSION_TEMPLATES } from "@shared/schema";

export type RoutingExecutor = { select: (...args: any[]) => any; insert: (...args: any[]) => any };
export const routingSchema = z.object({
  responsibleUserId: z.null().optional(),
  deputyUserId: z.null().optional(),
  receiverUserId: z.string().min(1).nullable(),
}).strict();

export function routingPermission(role: string, actions: string[], action: string) {
  return role === "admin" || actions.includes(action)
    || (role === "production_development_manager" && ROLE_PERMISSION_TEMPLATES.production_development_manager
      .some(entry => entry.module === "central_kitchen_orders" && entry.actions.some(allowed => allowed === action)))
    || (role === "branch_manager" && ["view", "edit", "create"].includes(action));
}

type RoutingPerson = {
  id: string;
  name?: string | null;
  lastName?: string | null;
  username?: string | null;
  role: string;
  branchId?: string | null;
  actions?: string[];
  _hasCustomPermissions?: boolean;
  _deniedActions?: string[];
};

export function routingPersonEligible(person: RoutingPerson, action: string) {
  if (person._deniedActions?.includes(action)) return false;
  if (person._hasCustomPermissions && !person.actions?.includes(action)) return false;
  return routingPermission(person.role, person.actions || [], action);
}

export function kitchenManagerEligible(person: RoutingPerson, action: string) {
  return person.role === "production_development_manager" && routingPersonEligible(person, action);
}

export async function routingPeople(tx: RoutingExecutor, branchId?: string) {
  const access = tx.select({ id: userBranchAccess.userId }).from(userBranchAccess)
    .where(eq(userBranchAccess.branchId, branchId || ""));
  const people = await tx.select({
    id: users.id, name: users.firstName, lastName: users.lastName, username: users.username,
    role: users.role, branchId: users.branchId, actions: userPermissions.actions,
  }).from(users).leftJoin(userPermissions, and(eq(userPermissions.userId, users.id),
    eq(userPermissions.module, "central_kitchen_orders")))
    .where(and(eq(users.isActive, "active"), ...(branchId ? [or(eq(users.role, "production_development_manager"), eq(users.branchId, branchId), inArray(users.id, access))] : [])));
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
  for (const person of people as any[]) {
    // Unrelated module overrides must not erase kitchen role permissions.
    const hasCustom = direct.some((p: any) => p.userId === person.id
      && p.module === "central_kitchen_orders" && p.actions.length > 0);
    person._hasCustomPermissions = hasCustom;
    const actions = new Set<string>(hasCustom ? person.actions || []
      : inherited.filter((p: any) => p.userId === person.id).map((p: any) => p.action));
    const deniedActions = new Set<string>();
    for (const override of overrides.filter((p: any) => p.userId === person.id)) {
      if (override.expiresAt && new Date(override.expiresAt).getTime() < Date.now()) continue;
      if (override.allow) actions.add(override.action);
      else {
        actions.delete(override.action);
        deniedActions.add(override.action);
      }
    }
    person.actions = Array.from(actions);
    person._deniedActions = Array.from(deniedActions);
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
    kitchenCandidates: people.filter((p: any) => kitchenManagerEligible(p, "approve")).map(named),
    receiverCandidates: people.filter((p: any) => p.role !== "production_development_manager"
      && routingPersonEligible(p, "edit")).map(named),
  };
}

export function resolveKitchenRouting(branchId: string, row: any, people: RoutingPerson[]) {
  const named = (person: RoutingPerson | undefined) => person
    ? [person.name, person.lastName].filter(Boolean).join(" ") || person.username || person.id
    : null;
  // Legacy named kitchen columns are retained for historical data, not authority.
  const approvingManagers = people.filter(person => kitchenManagerEligible(person, "approve"));
  const manualReceiver = people.find(person =>
    person.id === row?.receiverUserId && person.role !== "production_development_manager"
    && routingPersonEligible(person, "edit"));
  // A branch access grant is intentionally insufficient here: automatic assignment
  // follows the user's authoritative primary branch assignment only.
  const primaryManagers = manualReceiver ? [] : people.filter(person =>
    person.role === "branch_manager"
    && person.branchId === branchId
    && routingPersonEligible(person, "edit"));
  const automaticReceiver = primaryManagers.length === 1 ? primaryManagers[0] : undefined;
  const receiver = manualReceiver || automaticReceiver;
  const receiverAssignmentSource = manualReceiver
    ? "manual" as const
    : automaticReceiver ? "branch_manager" as const : "unassigned" as const;
  return {
    branchId,
    responsibleUserId: approvingManagers[0]?.id || null,
    deputyUserId: approvingManagers[1]?.id || null,
    receiverUserId: receiver?.id || null,
    responsibleName: named(approvingManagers[0]),
    deputyName: named(approvingManagers[1]),
    receiverName: named(receiver),
    hasKitchenResponsible: approvingManagers.length > 0,
    kitchenManagers: approvingManagers.map(person => ({ id: person.id, name: named(person) })),
    receiverAssignmentSource,
    receiverAssignmentConflict: !manualReceiver && primaryManagers.length > 1,
  };
}

export async function getKitchenRouting(tx: RoutingExecutor, branchId: string) {
  const [row] = await tx.select().from(centralKitchenRouting)
    .where(eq(centralKitchenRouting.branchId, branchId));
  const people = await routingPeople(tx, branchId);
  return resolveKitchenRouting(branchId, row, people);
}

export async function getKitchenRoutingBatch(tx: RoutingExecutor, branchIds: string[]) {
  const unique = Array.from(new Set(branchIds.filter(Boolean)));
  if (!unique.length) return new Map<string, Awaited<ReturnType<typeof getKitchenRouting>>>();
  const rows = await tx.select().from(centralKitchenRouting)
    .where(inArray(centralKitchenRouting.branchId, unique));
  const byBranch = new Map(rows.map((row: any) => [row.branchId, row]));
  const peopleByBranch = await Promise.all(unique.map(branchId => routingPeople(tx, branchId)));
  return new Map(unique.map((branchId, index) => [
    branchId,
    resolveKitchenRouting(branchId, byBranch.get(branchId), peopleByBranch[index]),
  ]));
}

export async function kitchenActionAllowed(tx: RoutingExecutor, userId: string, order: any, action: string) {
  const receiving = action === "receive" || action === "resolve_discrepancy";
  const branchId = receiving ? order.requestBranchId : order.centralKitchenId;
  const actor = await routingActor(tx, userId);
  if (!actor || !routingPersonEligible(actor, action === "approve" ? "approve" : "edit")) return false;
  // Administration may intervene, but a revoked action is never restored by role.
  if (["admin", "operations_manager"].includes(actor.role)) return true;
  if (!receiving && kitchenManagerEligible(actor, action === "approve" ? "approve" : "edit")) return true;
  if (!receiving) return false;
  const people = await routingPeople(tx, branchId);
  if (!people.some((p: any) => p.id === userId)) return false;
  const routing = await getKitchenRouting(tx, branchId);
  return routing.receiverUserId === userId;
}

export function registerKitchenRoutingRoutes(app: any, db: any, auth: any, getUser: any, canAccessBranch: any) {
  const handler = (kind: "read" | "candidates" | "write") => async (req: any, res: any) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const branchId = kind === "write" ? req.params.branchId : req.query.branchId;
      if (typeof branchId !== "string" || !branchId) return res.status(400).json({ error: "الفرع مطلوب" });
      const actor = await routingActor(db, getUser(req).id);
      if (!actor || !routingPersonEligible(actor, "view")) return res.status(403).json({ error: "غير مصرح" });
      const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
      if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });
      if (kind === "read") {
        if (!branch.isCentralKitchen && !(await canAccessBranch(req, branchId))) return res.status(403).json({ error: "غير مصرح للفرع" });
        return res.json(await getKitchenRouting(db, branchId));
      }
      if (!["admin", "operations_manager", "production_development_manager"].includes(actor.role)) return res.status(403).json({ error: "إعدادات التوجيه للإدارة فقط" });
      if (kind === "write" && !routingPersonEligible(actor, "edit")) return res.status(403).json({ error: "غير مصرح بتعديل التوجيه" });
      if (kind === "candidates") return res.json(await routingCandidates(db, branchId));
      const parsed = routingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "لا يمكن تعيين مسؤول أو نائب للمطبخ يدوياً؛ مدير الإنتاج والتطوير مسؤول تلقائياً، أو بيانات المستلم غير صالحة" });
      const result = await db.transaction(async (tx: any) => {
        const currentActor = await routingActor(tx, actor.id);
        if (!currentActor || !["admin", "operations_manager", "production_development_manager"].includes(currentActor.role)
          || !routingPersonEligible(currentActor, "edit")) throw new Error("ROUTING_FORBIDDEN");
        const candidates = await routingCandidates(tx, branchId);
        for (const [key, id] of Object.entries(parsed.data)) {
          const eligible = key === "receiverUserId" ? candidates.receiverCandidates : candidates.kitchenCandidates;
          if (id && !eligible.some((p: any) => p.id === id)) throw new Error("ROUTING_INELIGIBLE");
        }
        const [before] = await tx.select().from(centralKitchenRouting).where(eq(centralKitchenRouting.branchId, branchId));
        const values = { receiverUserId: parsed.data.receiverUserId, updatedBy: actor.id, updatedAt: new Date() };
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