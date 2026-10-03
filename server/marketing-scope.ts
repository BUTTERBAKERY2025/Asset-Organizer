import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { centralMarketingSnapshot } from "./permission-decision";
import { contextualActionAllowed, getAllowedBranchIds } from "./auth";

const entities: Record<string, any> = {
  campaigns: schema.marketingCampaigns,
  "budget-allocations": schema.campaignBudgetAllocations,
  goals: schema.campaignGoals,
  expenses: schema.campaignExpenses,
  "calendar-events": schema.marketingCalendarEvents,
  tasks: schema.marketingTasks,
  reports: schema.marketingPerformanceReports,
  assets: schema.marketingAssets,
  alerts: schema.marketingAlerts,
  "influencer-payments": schema.influencerPayments,
  "influencer-links": schema.influencerCampaignLinks,
  "influencer-contracts": schema.influencerContracts,
};

async function campaign(id: unknown) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error("INVALID_CAMPAIGN");
  const [row] = await db.select().from(schema.marketingCampaigns)
    .where(eq(schema.marketingCampaigns.id, Number(id)));
  if (!row) throw new Error("MISSING_CAMPAIGN");
  return row;
}

export function marketingScopeAllowed(req: any, module: string, action: string, branchId: string | null) {
  if (req.currentUser?.role === "admin") return true;
  const snapshot = req.authPermissionDecisionSnapshot;
  if (!snapshot || snapshot.userId !== req.currentUser?.id) return false;
  // Central campaigns are not a resource of a replaced branch. Only original
  // global authority (including independent denies) can authorize them.
  const central = centralMarketingSnapshot(snapshot);
  return contextualActionAllowed(req, branchId === null ? central : snapshot,
    module, action, branchId === null ? {} : { branchId });
}

export async function filterMarketingRows(req: any, rows: any[], module: string, ownCampaign = false) {
  const visibility = new Map<number, boolean>();
  const result = [];
  for (const row of rows) {
    const id = ownCampaign ? row.id : row.campaignId;
    let allowed: boolean;
    if (id != null) {
      if (!visibility.has(Number(id))) {
        const owner = ownCampaign ? row : await campaign(id);
        visibility.set(Number(id), marketingScopeAllowed(req, module, "view", owner.branchId ?? null));
      }
      allowed = visibility.get(Number(id))!;
    } else allowed = marketingScopeAllowed(req, module, "view", null);
    if (allowed) result.push(row);
  }
  return result;
}

/** Called by the normal permission guard after fresh authentication. */
export async function enforceMarketingScope(req: any, res: any, next: any, module: string, action: string | string[]) {
  try {
    const segments = req.path.slice("/api/marketing/".length).split("/");
    const entity = segments[0], table = entities[entity];
    const id = /^[1-9]\d*$/.test(segments[1] ?? "") ? Number(segments[1]) : null;
    let owner: any;
    let row: any;
    if (table && id !== null) {
      [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!row) return res.status(404).json({ message: "السجل غير موجود" });
      owner = ["campaigns", "influencer-contracts"].includes(entity) ? row : row.campaignId ? await campaign(row.campaignId) : null;
    }
    if (entity === "task-activities" || (entity === "tasks" && segments[2] === "activities")) {
      const taskId = entity === "tasks" ? id : Number(req.body?.taskId);
      const [task] = await db.select().from(schema.marketingTasks).where(eq(schema.marketingTasks.id, taskId!));
      if (!task) return res.status(404).json({ message: "المهمة غير موجودة" });
      row = task; owner = task.campaignId ? await campaign(task.campaignId) : null;
    }
    const checkOwner = (value: any) => (Array.isArray(action) ? action : [action])
      .some(a => marketingScopeAllowed(req, module, a, value?.branchId ?? null));
    if (row && !checkOwner(owner)) return res.status(403).json({ message: "الحملة خارج نطاق صلاحياتك" });
    if (entity === "influencer-contracts" && req.method !== "GET"
      && Object.hasOwn(req.body ?? {}, "branchId") && !checkOwner({ branchId: req.body.branchId }))
      return res.status(403).json({ message: "فرع العقد خارج صلاحياتك" });
    // A campaign query cannot turn the central influencer/team registry into a
    // branch-owned resource. Only real campaign foreign keys carry this scope.
    const campaignInput = table?.campaignId ? req.body?.campaignId ?? req.query?.campaignId : undefined;
    if (campaignInput != null && campaignInput !== "" && !checkOwner(await campaign(campaignInput)))
      return res.status(403).json({ message: "الحملة خارج نطاق صلاحياتك" });
    if (table?.campaignId && req.body && Object.hasOwn(req.body, "campaignId") && req.body.campaignId === null && !checkOwner(null))
      return res.status(403).json({ message: "لا يمكنك نقل السجل إلى النطاق المركزي" });
    if (entity === "campaigns" && segments.length === 1 && req.method === "POST"
      || entity === "campaigns" && segments.length === 2 && req.method === "PATCH") {
      const scopeType = req.body.scopeType ?? row?.scopeType;
      const branchId = Object.hasOwn(req.body, "branchId") ? req.body.branchId : row?.branchId;
      if (!["central", "branch"].includes(scopeType) || (scopeType === "branch" ? typeof branchId !== "string" || !branchId.trim() : branchId != null))
        return res.status(400).json({ message: "حدد حملة مركزية أو حملة مرتبطة بفرع صحيح" });
      if (!checkOwner({ branchId: scopeType === "branch" ? branchId : null }))
        return res.status(403).json({ message: "نطاق الحملة الجديد غير مسموح" });
      req.body.scopeType = scopeType;
      req.body.branchId = scopeType === "branch" ? branchId : null;
    } else if (!row && campaignInput == null) {
      const list = req.method === "GET" && (table || entity === "statistics");
      const branches = getAllowedBranchIds(req) ?? [];
      const creationOwner = entity === "influencer-contracts" && req.method === "POST"
        ? { branchId: req.body?.branchId ?? null } : null;
      if (!checkOwner(creationOwner) && !(list && branches.some(branchId => checkOwner({ branchId }))))
        return res.status(403).json({ message: "غير مصرح" });
    }
    // Campaign-scoped list routes and central lists can contain mixed ownership.
    // Filter rows before serialization, never infer ownership from a query branch.
    if (req.method === "GET" && ((table && id === null)
      || entity === "influencers" && ["payments", "expenses"].includes(segments[2]))) {
      const send = res.json.bind(res);
      res.json = (data: any) => {
        if (!Array.isArray(data)) return send(data);
        void filterMarketingRows(req, data, module, ["campaigns", "influencer-contracts"].includes(entity))
          .then(send).catch(() => { res.status(503); send({ message: "تعذر التحقق من نطاق البيانات" }); });
        return res;
      };
    }
    return next();
  } catch (error) {
    return res.status(503).json({ message: "تعذر التحقق من نطاق التسويق. تحقق من ترحيل نطاق الحملات." });
  }
}