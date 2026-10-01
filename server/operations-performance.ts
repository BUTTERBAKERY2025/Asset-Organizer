import { createHash } from "node:crypto";
import { and, gte, inArray, lte, sql } from "drizzle-orm";
import { cashierSalesJournals } from "@shared/schema";
import {
  REGISTERED_SALES_STATUSES, deduplicateOperationsRefs, operationsDateRange, operationsSourceRef, projectRegisteredSales,
} from "@shared/operations-performance";
import type {
  OperationsCenterResponse, OperationsInsight, OperationsRegisteredSales, OperationsSourceRef,
} from "@shared/operations-center";
import { db } from "./db";

/** Aggregate permission grants aggregates, never journal/cashier identities. No scan limit is used for sales. */
export async function loadOperationsRegisteredSales(branchIds: string[], from: string, to: string): Promise<OperationsRegisteredSales> {
  const authorized = and(inArray(cashierSalesJournals.branchId, branchIds),
    inArray(cashierSalesJournals.status, [...REGISTERED_SALES_STATUSES]), lte(cashierSalesJournals.journalDate, to));
  const [rows, lastDates] = await Promise.all([
    db.select({ date: cashierSalesJournals.journalDate, branchId: cashierSalesJournals.branchId,
      sales: sql<number>`sum(${cashierSalesJournals.totalSales}::double precision)`,
      recordedCount: sql<number>`count(*)` }).from(cashierSalesJournals)
      .where(and(authorized, gte(cashierSalesJournals.journalDate, from)))
      .groupBy(cashierSalesJournals.branchId, cashierSalesJournals.journalDate),
    db.select({ branchId: cashierSalesJournals.branchId, date: sql<string>`max(${cashierSalesJournals.journalDate})` })
      .from(cashierSalesJournals).where(authorized).groupBy(cashierSalesJournals.branchId),
  ]);
  const parsed = rows.map(row => {
    const sales = Number(row.sales), recordedCount = Number(row.recordedCount);
    if (row.sales === null || !Number.isFinite(sales) || !Number.isSafeInteger(recordedCount) || recordedCount < 1)
      throw new Error("Invalid registered sales aggregate");
    return { ...row, sales, recordedCount };
  });
  return projectRegisteredSales(branchIds, operationsDateRange(from, to), parsed, "available", lastDates);
}

/** data.queue must be the full loaded scan, not a display page.
 * Revision changes with evidence/scope, never with refresh time or display pagination.
 * The response's truncated flag can mean "another display page"; only scan metadata
 * describes the underlying source evidence. nextOffset is deliberately excluded. */
export function operationsEvidenceRevision(data: Pick<OperationsCenterResponse, "scope" | "coverage" | "queue">,
  analytics: Pick<NonNullable<OperationsCenterResponse["analytics"]>, "period" | "sales" | "followups" | "observations">): string {
  return createHash("sha256").update(JSON.stringify({
    branchIds: [...data.scope.branchIds].sort(), period: analytics.period,
    sales: { ...analytics.sales, byBranch: [...analytics.sales.byBranch].sort((a, b) => a.branchId.localeCompare(b.branchId)) },
    followups: analytics.followups, observations: analytics.observations,
    coverage: { queue: data.coverage.queue, scanTruncated: analytics.followups.scan.truncated },
    records: data.queue.map(row => ({ ref: operationsSourceRef(row), status: row.status, step: row.step, dueAt: row.dueAt,
      decision: row.decision, priorityReason: row.priorityReason })).sort((a, b) =>
      `${a.ref.branchId}:${a.ref.sourceType}:${a.ref.sourceId}`.localeCompare(`${b.ref.branchId}:${b.ref.sourceType}:${b.ref.sourceId}`)),
  })).digest("hex").slice(0, 24);
}

export type OperationsInsightRecord = OperationsSourceRef & {
  status: string; dueAt: string | null; evidence: OperationsInsight["evidence"];
  awaitingDecision?: boolean; sourceUrgency?: boolean;
};

/** Observation refs are from the full authorized scan, not only the visible queue page. */
export function operationsInsightRecords(data: OperationsCenterResponse): OperationsInsightRecord[] {
  const records: OperationsInsightRecord[] = data.queue.map(row => ({ ...operationsSourceRef(row), status: row.status, dueAt: row.dueAt,
    awaitingDecision: row.decision?.awaitingActor === true, sourceUrgency: !!row.priorityReason,
    evidence: { label: "الحالة المسجلة للمصدر؛ لقطة حالية", source: row.sourceType, period: "current", value: null } }));
  for (const observation of data.analytics?.observations ?? []) {
    for (const ref of observation.sourceRefs) {
      if (ref.sourceType === "sales_trend") continue;
      records.push({ ...ref, status: "observed_current", dueAt: null,
        awaitingDecision: observation.category === "decision", sourceUrgency: observation.category === "emergency",
        evidence: { label: "ملاحظة مصدر مسجلة في اللقطة الحالية", source: observation.source, period: "current", value: null } });
    }
  }
  for (const branch of data.analytics?.sales.byBranch ?? []) {
    if (branch.state !== "recorded") continue;
    const href = data.analytics!.sales.hrefs.find(row => row.branchId === branch.branchId)?.href;
    if (!href) continue;
    records.push({ sourceType: "sales_trend", sourceId: `${data.analytics!.period.from}/${data.analytics!.period.to}`,
      branchId: branch.branchId, href, status: "recorded_partial", dueAt: null,
      evidence: { label: "إجمالي المبيعات المسجلة في اليوميات المرحلة والمعتمدة", source: data.analytics!.sales.source,
        period: `${data.analytics!.period.from}/${data.analytics!.period.to}`, value: branch.total, unit: "SAR" } });
  }
  const refs = deduplicateOperationsRefs(records);
  return refs.map(ref => {
    const matching = records.filter(row => row.branchId === ref.branchId && row.sourceType === ref.sourceType && row.sourceId === ref.sourceId);
    return { ...matching[0], awaitingDecision: matching.some(row => row.awaitingDecision),
      sourceUrgency: matching.some(row => row.sourceUrgency) };
  });
}

/** AI can select evidence and prose only. It cannot invent identity, branch scope, or action destinations. */
export function canonicalOperationsInsights(parsed: unknown, records: OperationsInsightRecord[]): OperationsInsight[] {
  const entries = (parsed as { insights?: unknown })?.insights;
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const result: OperationsInsight[] = [];
  for (const entry of entries) {
    if (!entry || !Number.isInteger(entry.index) || !records[entry.index] || typeof entry.title !== "string" || typeof entry.explanation !== "string") continue;
    const record = records[entry.index];
    const id = `${record.branchId}:${record.sourceType}:${record.sourceId}`;
    if (seen.has(id)) continue;
    const safeText = (value: string) => value.replace(/https?:\/\/\S+|<[^>]*>/gi, "")
      .replace(/[0-9٠-٩۰-۹]+(?:[.,][0-9٠-٩۰-۹]+)*/g, "").trim();
    const title = safeText(entry.title).slice(0, 90), explanation = safeText(entry.explanation).slice(0, 220);
    if (!title || !explanation) continue;
    seen.add(id);
    const ref = operationsSourceRef(record);
    result.push({ title, explanation, ...ref, evidence: record.evidence, sourceRefs: [ref] });
    if (result.length === 3) break;
  }
  return result;
}