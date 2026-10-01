import type { Request } from "express";
import {
  operationsSalesSources, salesPagePlan,
  type OperationsSalesRecord, type OperationsSalesResponse, type OperationsSalesSource,
} from "@shared/operations-sales";
import { operationsDecisionMetadata } from "@shared/operations-center";
import { getAllowedBranchIds } from "./auth";
import { hasAuthoritativePermission } from "./branch-operations";
import { pool } from "./db";
import { storage } from "./storage";
import { operationsSalesSql, type SalesActor, type SalesGrants } from "./operations-sales-predicates";

export type SalesRow = {
  id: number; branch_id: string; status: string; business_date: string;
  created_by?: string | null; creator_name?: string | null;
  cashier_id?: string; cashier_name?: string;
  total_sales?: number | string | null; cash_discrepancy?: number | string | null;
  bank_discrepancy?: number | string | null; journals_count?: number | string | null;
};
const descriptions: Record<OperationsSalesSource, { label: string; definition: string }> = {
  journals: { label: "يوميات قيد المتابعة", definition: "يوميات draft/submitted/rejected حتى تاريخ العمل السعودي، ضمن الفروع والكاشيرات المصرح بها؛ ليست مبيعات معتمدة." },
  closures: { label: "إغلاقات يومية مفتوحة", definition: "سجلات إغلاق محفوظة open حتى تاريخ العمل السعودي؛ ليست أيامًا بلا إغلاق، ولا إثباتًا لفروق غير مسواة." },
};

/** Mirrors canUserViewAllCashiers in the source, using fresh effective grants,
 * never storage.hasPermission (which only examines direct assignments). */
export async function salesCanViewAllCashiers(req: Request): Promise<boolean> {
  const user = req.currentUser;
  if (!user) return false;
  if (["admin", "manager"].includes(user.role)) return true;
  const permissions = await storage.getUserPermissions(user.id, { bypassCache: true });
  for (const module of ["cashier_performance", "cashier_journal"]) {
    if (permissions.some(permission => permission.module === module && permission.actions.includes("approve"))
      && await hasAuthoritativePermission(req, module, "approve")) return true;
  }
  return false;
}

export async function salesGrants(req: Request): Promise<SalesGrants> {
  const [journalsView, journalsApprove, closuresView, closuresApprove, allCashiers] = await Promise.all([
    hasAuthoritativePermission(req, "cashier_journal", "view"),
    hasAuthoritativePermission(req, "cashier_journal", "approve"),
    hasAuthoritativePermission(req, "daily_closures", "view"),
    hasAuthoritativePermission(req, "daily_closures", "approve"),
    salesCanViewAllCashiers(req),
  ]);
  return { journalsView, journalsApprove, closuresView, closuresApprove, allCashiers };
}

const numericFact = (value: number | string | null | undefined): number | null => {
  if (value == null || typeof value === "string" && !value.trim()) return null;
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
};

export function projectSalesRecord(domain: OperationsSalesSource, row: SalesRow, actor: SalesActor,
  grants: SalesGrants): OperationsSalesRecord {
  if (!operationsSalesSources.includes(domain) || !Number.isSafeInteger(row.id) || row.id < 1
    || !row.branch_id || !/^\d{4}-\d{2}-\d{2}$/.test(row.business_date))
    throw new Error("Invalid sales source identity or business date");
  const journal = domain === "journals";
  if (journal ? !["draft", "submitted", "rejected"].includes(row.status) : row.status !== "open")
    throw new Error("Sales source stage is no longer active");
  const sourceType = journal ? "cashier_journal" : "daily_closure";
  const module = journal ? "cashier_journal" : "daily_closures";
  const step = !journal ? "closure_review" : row.status === "submitted" ? "journal_review"
    : row.status === "draft" ? "journal_draft" : "journal_rejected";
  const href = `${journal ? "/cashier-journals" : "/branch-daily-closures"}/${row.id}?${new URLSearchParams({ branchId: row.branch_id })}`;
  const label = !journal ? "مراجعة الإغلاق واليوميات المشمولة في المصدر"
    : row.status === "submitted" ? "مراجعة اليومية المقدمة في المصدر"
      : row.status === "draft" ? "استكمال المسودة في المصدر" : "مراجعة سبب الرفض ومسار التصحيح في المصدر";
  const count = numericFact(row.journals_count);
  const item: OperationsSalesRecord = {
    id: `${sourceType}:${row.id}:${step}:${row.branch_id}`, canonicalId: `${sourceType}:${row.id}`,
    sourceType, sourceId: String(row.id), step, branchId: row.branch_id, module, domain,
    title: !journal ? "إغلاق يومي مفتوح للمراجعة" : row.status === "submitted" ? "يومية مقدمة للمراجعة"
      : row.status === "draft" ? "يومية مسودة" : "يومية مرفوضة",
    status: row.status, owner: "", ownerId: null, dueAt: null, href,
    businessDate: row.business_date,
    creator: { id: row.created_by ?? null, name: row.creator_name ?? null },
    ...(journal && row.cashier_id ? { cashier: { id: row.cashier_id, name: row.cashier_name || "لا يقدم المصدر اسم الكاشير" } } : {}),
    facts: { totalSales: numericFact(row.total_sales), cashDiscrepancy: numericFact(row.cash_discrepancy),
      bankDiscrepancy: numericFact(row.bank_discrepancy),
      journalsCount: count !== null && Number.isSafeInteger(count) && count >= 0 ? count : null },
    nextStep: { label, href }, actions: [{ label: "عرض السجل في المصدر", href, capability: "read" }],
    reason: !journal ? "لقطة إغلاق محفوظة لم تعتمد بعد؛ الأرقام تخص اليوميات المشمولة ولا تثبت شمول اليوم أو تسوية جميع الفروق."
      : row.status === "submitted" ? "اليومية مقدمة؛ القرار يتطلب صلاحية المصدر ولا يُستنتج من اسم الكاشير أو منشئ السجل."
        : row.status === "draft" ? "اليومية مسودة وليست مبيعات معتمدة؛ استكمالها يتم في مصدرها."
          : "اليومية مرفوضة؛ راجع سبب الرفض في المصدر، ولا يعني ظهورها إتاحة إعادة التقديم.",
  };
  const canApprove = journal ? grants.journalsView && grants.journalsApprove && row.status === "submitted"
    : grants.closuresView && grants.closuresApprove && (actor.role === "admin" || row.created_by !== actor.id);
  item.decision = operationsDecisionMetadata(item, actor.id, canApprove, true, { module, action: "approve" },
    journal ? "مراجعة واعتماد اليومية" : "مراجعة واعتماد الإغلاق");
  if (item.decision) item.decision.reason = journal
    ? "اليومية مقدمة وتملك صلاحية اعتمادها الحالية في المصدر."
    : "الإغلاق مفتوح وتملك صلاحية اعتماده وفق فصل الواجبات في المصدر؛ العرض لا يثبت اكتمال المطابقة المالية.";
  return item;
}

function countValue(value: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Invalid source cardinality");
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid source cardinality");
  return count;
}

/** This domain is paged from full scoped counts, independent of the global
 * center's bounded evidence snapshot. No synthetic missing-day tasks. */
export async function projectOperationsSales(req: Request, requested: string[], source: OperationsSalesSource | "all",
  offset = 0, limit = 30): Promise<OperationsSalesResponse> {
  if (!requested.length || requested.length > 30 || requested.some(id => !id || id.toLowerCase() === "all")
    || new Set(requested).size !== requested.length || !Number.isSafeInteger(offset) || offset < 0
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || source !== "all" && !operationsSalesSources.includes(source))
    throw Object.assign(new Error("Invalid sales query"), { status: 400 });
  const allowed = getAllowedBranchIds(req);
  if (requested.some(id => allowed !== null && !allowed.includes(id)))
    throw Object.assign(new Error("Branch scope denied"), { status: 403 });
  const branches = (await pool.query<{ id: string; name: string }>(
    "SELECT id,name FROM branches WHERE id=ANY($1::varchar[]) ORDER BY id", [requested])).rows;
  if (branches.length !== requested.length || requested.some(id => !branches.some(branch => branch.id === id)))
    throw Object.assign(new Error("Branch scope denied or branch does not exist"), { status: 403 });
  const actor: SalesActor = { id: req.currentUser!.id, role: req.currentUser!.role };
  const grants = await salesGrants(req);
  const now = new Date(), generatedAt = now.toISOString();
  const businessDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  const selected = source === "all" ? [...operationsSalesSources] : [source];
  const coverage = Object.fromEntries(operationsSalesSources.map(domain => {
    const permitted = domain === "journals" ? grants.journalsView : grants.closuresView;
    return [domain, { state: permitted ? "unavailable" : "forbidden",
      reason: permitted ? "Source not selected; count not requested" : "Current source permission denied" }];
  })) as OperationsSalesResponse["coverage"]["sources"];
  const counts: { source: OperationsSalesSource; count: number }[] = [];
  await Promise.all(selected.map(async domain => {
    if (!(domain === "journals" ? grants.journalsView : grants.closuresView)) return;
    try {
      const sql = operationsSalesSql(domain, requested, businessDate, actor, grants);
      const result = await pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${sql.from} WHERE ${sql.where}`, sql.values);
      counts.push({ source: domain, count: countValue(result.rows[0].total) });
      coverage[domain] = { state: "complete", reason: null };
    } catch {
      coverage[domain] = { state: "unavailable", reason: "Source count query failed; not zero" };
    }
  }));
  counts.sort((a, b) => operationsSalesSources.indexOf(a.source) - operationsSalesSources.indexOf(b.source));
  const records: OperationsSalesRecord[] = [];
  for (const page of salesPagePlan(counts, offset, limit)) {
    try {
      const sql = operationsSalesSql(page.source, requested, businessDate, actor, grants);
      const result = await pool.query<SalesRow>(`SELECT ${sql.select} FROM ${sql.from} WHERE ${sql.where}
        ORDER BY ${sql.order} LIMIT $${sql.values.length + 1} OFFSET $${sql.values.length + 2}`,
      [...sql.values, page.limit, page.offset]);
      const projected = result.rows.map(row => {
        if (!requested.includes(row.branch_id) || row.business_date > businessDate
          || page.source === "journals" && !grants.allCashiers && row.cashier_id !== actor.id)
          throw new Error("Source row outside selected visibility");
        return projectSalesRecord(page.source, row, actor, grants);
      });
      records.push(...projected);
    } catch {
      coverage[page.source] = { state: "unavailable", reason: "Source page query failed; records and count unavailable" };
    }
  }
  const knownTotal = counts.filter(entry => coverage[entry.source].state === "complete").reduce((sum, entry) => sum + entry.count, 0);
  return {
    generatedAt, businessDate, scope: { branchIds: requested, requested, source, offset, limit }, branches, records,
    summaries: selected.map(domain => ({
      source: domain, ...descriptions[domain], coverage: coverage[domain].state,
      value: coverage[domain].state === "complete" ? counts.find(entry => entry.source === domain)!.count : null,
    })),
    coverage: { sources: coverage, total: selected.every(domain => coverage[domain].state === "complete") ? knownTotal : null,
      nextOffset: knownTotal > offset + limit ? offset + limit : null },
  };
}