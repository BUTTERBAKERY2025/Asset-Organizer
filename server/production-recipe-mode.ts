import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAuthenticated, requirePermission, canAccessBranch } from "./auth";

export const mayManageRecipeMode = (role?: string) =>
  role === "admin" || role === "production_development_manager";

// The same lock is taken by the INSERT trigger: toggles and creation serialize,
// including legacy/manual writers. Never consult today's setting at finish.
export async function lockedRecipeMode(tx: any, kitchenId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(73049, hashtext(${kitchenId}))`);
  const result = await tx.execute(sql`SELECT * FROM production_recipe_mode_events
    WHERE kitchen_id=${kitchenId} ORDER BY id DESC LIMIT 1`);
  return result.rows[0] ?? null;
}

export function registerProductionRecipeModeRoutes(app: Express) {
  const body = z.object({ kitchenId: z.string().trim().min(1).max(255), enabled: z.boolean(),
    reason: z.string().trim().min(5).max(1000) }).strict();
  for (const method of ["get", "patch"] as const) {
    app[method]("/api/production/recipe-mode", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
      try {
        const parsed = method === "patch" ? body.safeParse(req.body) : null;
        const kitchen = z.string().trim().min(1).max(255).safeParse(method === "patch" ? req.body?.kitchenId : req.query.kitchenId);
        if (!kitchen.success || (parsed && !parsed.success)) return res.status(400).json({ error: "حدد المطبخ وسببًا واضحًا للتغيير" });
        const canManage = mayManageRecipeMode(req.currentUser?.role);
        if (method === "patch" && !canManage) return res.status(403).json({ error: "التفعيل والإيقاف للأدمن ومدير التطوير والإنتاج فقط" });
        if (!(await canAccessBranch(req, kitchen.data))) return res.status(403).json({ error: "غير مصرح بهذا المطبخ" });
        const exists = await db.execute(sql`SELECT id FROM branches WHERE id=${kitchen.data} AND is_central_kitchen=true`);
        if (!exists.rows.length) return res.status(404).json({ error: "المطبخ غير موجود" });
        const result = await db.transaction(async tx => {
          await lockedRecipeMode(tx, kitchen.data);
          if (parsed?.success) await tx.execute(sql`INSERT INTO production_recipe_mode_events(kitchen_id, enabled, reason, actor_id)
            VALUES (${kitchen.data},${parsed.data.enabled},${parsed.data.reason},${req.currentUser!.id})`);
          const history = await tx.execute(sql`SELECT id, enabled, reason, actor_id AS "actorId", created_at AS "createdAt"
            FROM production_recipe_mode_events WHERE kitchen_id=${kitchen.data} ORDER BY id DESC LIMIT 30`);
          const latest = history.rows[0] as any;
          return { kitchenId: kitchen.data, enabled: latest?.enabled === true, canManage,
            activationId: latest?.enabled ? latest.id : null, history: history.rows };
        });
        res.json(result);
      } catch (error) {
        console.error("Production recipe mode failed", error);
        res.status(500).json({ error: "تعذر قراءة أو تعديل السحب على المكشوف؛ تحقق من ترحيل قاعدة البيانات والصلاحيات" });
      }
    });
  }
}