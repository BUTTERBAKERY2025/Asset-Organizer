import type { OwnerBranch, OwnerSalesResponse } from "@shared/owner-portal";

export const OWNER_PAGE_SIZE = 20;
export const OWNER_SALES_STATUSES = ["posted", "approved"] as const;
export const OWNER_SOURCE_LABEL = "إجمالي مبيعات يوميات الكاشير المرحّلة والمعتمدة فقط؛ تستبعد المسودات والمرفوضة وأي حالة أخرى. ليست صافي المبيعات ولا تضاف معاملات نقطة البيع. المقارنة بالفترة السابقة المساوية بالأيام بتوقيت الرياض. الإجمالي للمبلغ عنه فقط؛ غياب اليومية لا يعني صفراً.";
export const OWNER_IMAGE_NOTICE = "لا تتوفر معاينة آمنة لهذه المادة؛ تدعم البوابة الصور المخزنة داخلياً فقط.";
/** Only server-stored paths, never arbitrary URLs or signed URLs, are accepted. */
export function ownerImageReference(value: unknown): { provider: "documents" | "objects"; key: string } | null {
  if (typeof value !== "string" || value.length > 500) return null;
  const document = /^\/api\/(?:documents|uploads)\/file\/([a-zA-Z0-9\u0600-\u06ff_-][a-zA-Z0-9\u0600-\u06ff_.-]*\.(?:png|jpg|jpeg|gif|webp))$/i.exec(value);
  if (document && !document[1].includes("..")) return { provider: "documents", key: document[1] };
  const object = /^\/objects\/uploads\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.exec(value);
  return object ? { provider: "objects", key: value } : null;
}
export function ownerImageMime(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
export class OwnerInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function ownerString(value: unknown, fallback = ""): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new OwnerInputError("معامل غير صالح");
  return value;
}
export function ownerPage(value: unknown): number {
  const text = ownerString(value, "1");
  if (!/^[1-9]\d{0,4}$/.test(text)) throw new OwnerInputError("رقم الصفحة غير صالح");
  return Number(text);
}
export function ownerSearch(value: unknown): string {
  const text = ownerString(value).trim();
  if (text.length > 100) throw new OwnerInputError("البحث طويل جداً");
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}
export function riyadhToday(now = new Date()): string {
  return new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10);
}
export function ownerDate(value: unknown, fallback = riyadhToday()): string {
  const date = ownerString(value, fallback);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "1900-01-01" || date > "9998-12-31") throw new OwnerInputError("التاريخ غير صالح");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new OwnerInputError("التاريخ غير صالح");
  return date;
}
export function ownerDateRange(from: unknown, to: unknown) {
  const dateFrom = ownerDate(from);
  const dateTo = ownerDate(to, dateFrom);
  const start = Date.parse(`${dateFrom}T00:00:00Z`);
  const end = Date.parse(`${dateTo}T00:00:00Z`);
  const days = (end - start) / 86400000 + 1;
  if (days < 1 || days > 92) throw new OwnerInputError("يجب أن تكون الفترة مرتبة ولا تتجاوز 92 يوماً");
  return {
    dateFrom, dateTo,
    previousFrom: new Date(start - days * 86400000).toISOString().slice(0, 10),
    previousTo: new Date(start - 86400000).toISOString().slice(0, 10),
  };
}
/** Intersection with explicit grants prevents legacy default-branch fallbacks from granting owner access. */
export function ownerScope(role: string, grants: string[], allowed: string[] | null, effective: { hasAccess: boolean; branchIds: string[] | null }): string[] | null {
  if (role !== "admin" && role !== "business_owner") throw new OwnerInputError("غير مصرح", 403);
  if (!effective.hasAccess) throw new OwnerInputError("لا يوجد وصول للفروع المطلوبة", 403);
  if (role === "admin") return effective.branchIds;
  const ids = Array.from(new Set(grants)).filter(id => allowed !== null && allowed.includes(id) && (effective.branchIds === null || effective.branchIds.includes(id)));
  if (!ids.length) throw new OwnerInputError("لا توجد فروع ممنوحة صراحة", 403);
  return ids;
}
export interface OwnerSalesAggregate { branchId: string; sales: string | number; journalCount: number }
export function ownerSalesResponse(branches: OwnerBranch[], current: OwnerSalesAggregate[], previous: OwnerSalesAggregate[], dateFrom: string, dateTo: string): OwnerSalesResponse {
  const nowMap = new Map(current.map(row => [row.branchId, row]));
  const beforeMap = new Map(previous.map(row => [row.branchId, row]));
  const items = branches.map(branch => {
    const row = nowMap.get(branch.id), before = beforeMap.get(branch.id);
    return { ...branch, sales: row ? Number(row.sales) : null, journalCount: row ? Number(row.journalCount) : 0, status: row ? "reported" as const : "missing" as const, previousSales: before ? Number(before.sales) : null };
  });
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    sourceLabel: OWNER_SOURCE_LABEL, generatedAt: new Date().toISOString(), dateFrom, dateTo, branches: items,
    totals: {
      sales: round(items.reduce((n, row) => n + (row.sales ?? 0), 0)),
      journalCount: items.reduce((n, row) => n + row.journalCount, 0),
      reportedBranches: items.filter(row => row.status === "reported").length, branchCount: items.length,
      previousSales: items.some(row => row.previousSales !== null) ? round(items.reduce((n, row) => n + (row.previousSales ?? 0), 0)) : null,
    },
  };
}