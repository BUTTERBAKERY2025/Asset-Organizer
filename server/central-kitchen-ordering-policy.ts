import { eq } from "drizzle-orm";
import {
  portalSettings,
  systemAuditLogs,
} from "@shared/schema";
import {
  CENTRAL_KITCHEN_DEFAULT_ORDERING_POLICY,
  type CentralKitchenOrderingPolicyConfig,
  getOrderingPolicy,
  validateOrderingPolicyConfig,
} from "@shared/central-kitchen-ordering-policy";

export const CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY =
  "central_kitchen.ordering_policy.v1";

export const CENTRAL_KITCHEN_POLICY_MANAGER_ROLES = new Set([
  "admin",
  "operations_manager",
  "production_development_manager",
]);

export class CentralKitchenOrderingPolicyError extends Error {
  constructor(message: string, readonly kind: "corrupt" | "database") {
    super(message);
    this.name = "CentralKitchenOrderingPolicyError";
  }
}

type PolicyDb = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  transaction?: (callback: (tx: PolicyDb) => Promise<any>) => Promise<any>;
};

export function canManageCentralKitchenOrderingPolicy(role: string | null | undefined): boolean {
  return !!role && CENTRAL_KITCHEN_POLICY_MANAGER_ROLES.has(role);
}

export function parseCentralKitchenOrderingPolicyBody(
  body: unknown,
): CentralKitchenOrderingPolicyConfig | null {
  return validateOrderingPolicyConfig(body);
}

export function registerCentralKitchenOrderingPolicyPutRoute(
  app: { put: (path: string, ...handlers: any[]) => unknown },
  database: PolicyDb,
  isAuthenticated: any,
  requireEditPermission: any,
  getCurrentUser: (req: any) => any,
) {
  app.put(
    "/api/central-kitchen-orders/policy",
    isAuthenticated,
    requireEditPermission,
    async (req: any, res: any) => {
      const user = getCurrentUser(req);
      if (!canManageCentralKitchenOrderingPolicy(user.role)) {
        return res.status(403).json({ error: "تعديل سياسة مواعيد الطلبات متاح لمديري المطبخ المعتمدين فقط" });
      }
      const policy = parseCentralKitchenOrderingPolicyBody(req.body);
      if (!policy) {
        return res.status(400).json({
          error: "يجب إرسال requestDeadline وreviewTime وdefaultNeededTime فقط بصيغة HH:mm، وألا يتجاوز موعد الإغلاق موعد المراجعة",
        });
      }
      try {
        const saved = await saveCentralKitchenOrderingPolicy(database, policy, {
          id: user.id,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        });
        res.set("Cache-Control", "private, no-store");
        return res.json(getOrderingPolicy(new Date(), saved));
      } catch (error) {
        console.error("Error saving central kitchen ordering policy:", error);
        return res.status(500).json({ error: "تعذر حفظ سياسة مواعيد الطلبات وتسجيل التغيير" });
      }
    },
  );
}

export async function loadCentralKitchenOrderingPolicy(
  executor: PolicyDb,
): Promise<CentralKitchenOrderingPolicyConfig> {
  let rows: Array<{ value: string }>;
  try {
    rows = await executor.select({ value: portalSettings.value })
      .from(portalSettings)
      .where(eq(portalSettings.key, CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY))
      .limit(1);
  } catch (error) {
    throw new CentralKitchenOrderingPolicyError(
      `Failed to load central kitchen ordering policy: ${error instanceof Error ? error.message : String(error)}`,
      "database",
    );
  }
  if (!rows[0]) return { ...CENTRAL_KITCHEN_DEFAULT_ORDERING_POLICY };

  let decoded: unknown;
  try {
    decoded = JSON.parse(rows[0].value);
  } catch {
    throw new CentralKitchenOrderingPolicyError(
      "Stored central kitchen ordering policy is not valid JSON",
      "corrupt",
    );
  }
  const policy = validateOrderingPolicyConfig(decoded);
  if (!policy) {
    throw new CentralKitchenOrderingPolicyError(
      "Stored central kitchen ordering policy is invalid",
      "corrupt",
    );
  }
  return policy;
}

export async function saveCentralKitchenOrderingPolicy(
  database: PolicyDb,
  policy: CentralKitchenOrderingPolicyConfig,
  actor: {
    id: string;
    name?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<CentralKitchenOrderingPolicyConfig> {
  const validated = validateOrderingPolicyConfig(policy);
  if (!validated) throw new Error("Invalid central kitchen ordering policy");
  if (!database.transaction) throw new Error("Policy save requires a database transaction");

  try {
    return await database.transaction(async (tx) => {
      const previous = await loadCentralKitchenOrderingPolicy(tx);
      await tx.insert(portalSettings).values({
        key: CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY,
        value: JSON.stringify(validated),
      }).onConflictDoUpdate({
        target: portalSettings.key,
        set: { value: JSON.stringify(validated), updatedAt: new Date() },
      });
      await tx.insert(systemAuditLogs).values({
        module: "central_kitchen_orders",
        entityId: CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY,
        entityName: "Central kitchen ordering policy",
        action: "update",
        details: JSON.stringify({ before: previous, after: validated }),
        userId: actor.id,
        userName: actor.name || null,
        description: "Updated central kitchen ordering policy",
        ipAddress: actor.ipAddress || null,
        userAgent: actor.userAgent || null,
      });
      return validated;
    });
  } catch (error) {
    if (error instanceof CentralKitchenOrderingPolicyError) throw error;
    throw new CentralKitchenOrderingPolicyError(
      `Failed to save central kitchen ordering policy: ${error instanceof Error ? error.message : String(error)}`,
      "database",
    );
  }
}