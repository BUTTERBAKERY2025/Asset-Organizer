import type { Express, Request, RequestHandler } from "express";
import { and, asc, count, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { branches, cashierSalesJournals, inventoryItems, maintenanceTickets, marketingAssets, marketingCalendarEvents, marketingCampaigns, marketingTasks, shareholders } from "@shared/schema";
import type { OwnerAssetsResponse, OwnerMarketingResponse, OwnerMarketingSection, OwnerOverviewResponse, OwnerShareholdersResponse } from "@shared/owner-portal";
import { db } from "./db";
import { getAllowedBranchIds, getEffectiveBranchFilter, isAuthenticated } from "./auth";
import { OWNER_IMAGE_NOTICE, OWNER_PAGE_SIZE, OWNER_SALES_STATUSES, OWNER_SOURCE_LABEL, OwnerInputError, ownerDate, ownerDateRange, ownerImageMime, ownerImageReference, ownerPage, ownerSalesResponse, ownerScope, ownerSearch, ownerString } from "./owner-portal-data";

const generatedAt = () => new Date().toISOString();
const attentionStatuses = ["maintenance", "damaged", "missing", "صيانة", "تالف", "مفقود"];
function scope(req: Request): string[] | null {
  const context = req as Request & { currentUser?: { role: string }; userBranchAccess?: Array<{ branchId: string }> };
  const role = context.currentUser?.role ?? "";
  const requested = ownerString(req.query.branchId, "all");
  if (!requested || requested.length > 128) throw new OwnerInputError("الفرع غير صالح");
  const allowed = getAllowedBranchIds(req);
  const effective = getEffectiveBranchFilter(req, requested);
  const ids = ownerScope(role, (context.userBranchAccess ?? []).map(row => row.branchId), allowed, effective);
  if (requested !== "all" && ids !== null && !ids.includes(requested)) throw new OwnerInputError("الفرع غير مصرح", 403);
  return ids;
}
function branchCondition(column: typeof branches.id | typeof inventoryItems.branchId | typeof cashierSalesJournals.branchId | typeof marketingAssets.branchId, ids: string[] | null): SQL | undefined {
  return ids === null ? undefined : ids.length ? inArray(column, ids) : sql`false`;
}
async function visibleBranches(ids: string[] | null) {
  return db.select({ id: branches.id, name: branches.name }).from(branches).where(branchCondition(branches.id, ids)).orderBy(asc(branches.name), asc(branches.id));
}
async function sales(ids: string[] | null, from: unknown, to: unknown) {
  const dates = ownerDateRange(from, to);
  const aggregate = (start: string, end: string) => db.select({
    branchId: cashierSalesJournals.branchId,
    // Cast each real value before summing to avoid PostgreSQL float4 accumulation loss.
    sales: sql<string>`round(sum(${cashierSalesJournals.totalSales}::numeric), 2)`,
    journalCount: count(),
    reportedDays: sql<number>`count(distinct ${cashierSalesJournals.journalDate})::int`,
  }).from(cashierSalesJournals).where(and(
    branchCondition(cashierSalesJournals.branchId, ids),
    inArray(cashierSalesJournals.status, [...OWNER_SALES_STATUSES]),
    gte(cashierSalesJournals.journalDate, start), lte(cashierSalesJournals.journalDate, end),
  )).groupBy(cashierSalesJournals.branchId);
  const [list, current, previous, latest] = await Promise.all([
    visibleBranches(ids), aggregate(dates.dateFrom, dates.dateTo), aggregate(dates.previousFrom, dates.previousTo),
    db.select({ date: sql<string | null>`max(${cashierSalesJournals.journalDate})` }).from(cashierSalesJournals).where(and(
      branchCondition(cashierSalesJournals.branchId, ids),
      inArray(cashierSalesJournals.status, [...OWNER_SALES_STATUSES]),
    )),
  ]);
  if (ids?.length === 1 && !list.length) throw new OwnerInputError("الفرع غير موجود", 404);
  return { ...ownerSalesResponse(list, current, previous, dates.dateFrom, dates.dateTo), latestReportDate: latest[0]?.date ?? null };
}
async function shareholderSummary() {
  // Registered, non-transferred holdings; denominator is not assumed legal capital.
  const [row] = await db.select({ count: count(), totalShares: sql<string>`coalesce(sum(${shareholders.numberOfShares}), 0)` }).from(shareholders).where(inArray(shareholders.status, ["active", "frozen"]));
  return { count: row.count, totalShares: Number(row.totalShares), ownershipBasis: "نسبة من إجمالي الأسهم المسجلة للمساهمين النشطين والمجمدين، وليست نسبة من رأس المال القانوني" };
}
export function registerOwnerPortalRoutes(app: Express) {
  const preview: RequestHandler = async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    try {
      const ids = scope(req);
      if (Object.keys(req.query).some(key => key !== "branchId")) throw new OwnerInputError("معامل معاينة غير صالح");
      const id = ownerString(req.params.id);
      if (!id || id.length > 128) throw new OwnerInputError("معرف غير صالح");
      let stored: string | null = null;
      if (req.route.path === "/api/owner/assets/:id/image") {
        const [row] = await db.select({ image: inventoryItems.imageUrl }).from(inventoryItems).where(and(eq(inventoryItems.id, id), branchCondition(inventoryItems.branchId, ids))).limit(1);
        stored = row?.image ?? null;
      } else {
        if (!/^[1-9]\d{0,8}$/.test(id)) throw new OwnerInputError("معرف غير صالح");
        const [row] = await db.select({ image: marketingAssets.thumbnailUrl, file: marketingAssets.fileUrl }).from(marketingAssets).where(and(eq(marketingAssets.id, Number(id)), ids === null ? undefined : or(isNull(marketingAssets.branchId), branchCondition(marketingAssets.branchId, ids)))).limit(1);
        stored = ownerImageReference(row?.image) ? row.image : row?.file ?? null;
      }
      const reference = ownerImageReference(stored);
      if (!reference) throw new OwnerInputError("لا تتوفر صورة آمنة لهذا السجل", 404);
      const maxBytes = 8 * 1024 * 1024;
      let bytes: Buffer;
      if (reference.provider === "documents") {
        const { downloadFromSupabase } = await import("./supabase-storage");
        const file = await downloadFromSupabase(reference.key);
        if (!file) throw new OwnerInputError("الصورة غير متاحة", 404);
        if (file.data.size > maxBytes) throw new OwnerInputError("الصورة أكبر من حد المعاينة", 413);
        bytes = Buffer.from(await file.data.arrayBuffer());
      } else {
        const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
        const file = await new ObjectStorageService().getObjectEntityFile(reference.key);
        const [metadata] = await file.getMetadata();
        if (Number(metadata.size) > maxBytes) throw new OwnerInputError("الصورة أكبر من حد المعاينة", 413);
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of file.createReadStream()) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.length;
          if (size > maxBytes) throw new OwnerInputError("الصورة أكبر من حد المعاينة", 413);
          chunks.push(buffer);
        }
        bytes = Buffer.concat(chunks);
      }
      const mime = ownerImageMime(bytes);
      if (!mime) throw new OwnerInputError("صيغة الصورة غير آمنة أو غير مدعومة", 415);
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", "inline");
      res.send(bytes);
    } catch (error) {
      res.status(error instanceof OwnerInputError ? error.status : 503).json({ message: error instanceof OwnerInputError ? error.message : "تعذر تحميل معاينة الصورة" });
    }
  };
  app.get("/api/owner/assets/:id/image", isAuthenticated, preview);
  app.get("/api/owner/marketing/content/:id/image", isAuthenticated, preview);
  const get = (path: string, handler: (req: Request, ids: string[] | null) => Promise<unknown>) => {
    const handle: RequestHandler = async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      try {
        const ids = scope(req);
        res.json(await handler(req, ids));
      } catch (error) {
        if (error instanceof OwnerInputError) { res.status(error.status).json({ message: error.message }); return; }
        res.status(500).json({ message: "تعذر تحميل بيانات بوابة المالك. يرجى المحاولة لاحقاً." });
      }
    };
    app.get(path, isAuthenticated, handle);
  };
  get("/api/owner/branches", async (_req, ids) => ({ branches: await visibleBranches(ids), generatedAt: generatedAt() }));
  get("/api/owner/sales", (req, ids) => sales(ids, req.query.dateFrom, req.query.dateTo));
  get("/api/owner/overview", async (req, ids): Promise<OwnerOverviewResponse> => {
    const date = ownerDate(req.query.date);
    const [report, assetTotals, campaignTotals, summary] = await Promise.allSettled([
      Promise.resolve().then(() => sales(ids, date, date)),
      Promise.resolve().then(() => db.select({ total: count(), needsAttention: sql<number>`count(*) filter (where ${inArray(inventoryItems.status, attentionStatuses)})::int` }).from(inventoryItems).where(branchCondition(inventoryItems.branchId, ids))),
      Promise.resolve().then(() => db.select({ activeCampaigns: count() }).from(marketingCampaigns).where(eq(marketingCampaigns.status, "active"))),
      Promise.resolve().then(() => shareholderSummary()),
    ]);
    const sectionErrors: NonNullable<OwnerOverviewResponse["sectionErrors"]> = {};
    if (report.status === "rejected") sectionErrors.sales = "تعذر تحميل بيانات المبيعات";
    if (assetTotals.status === "rejected") sectionErrors.assets = "تعذر تحميل بيانات الأصول";
    if (campaignTotals.status === "rejected") sectionErrors.marketing = "تعذر تحميل بيانات التسويق";
    if (summary.status === "rejected") sectionErrors.shareholders = "تعذر تحميل بيانات المساهمين";
    // Empty fields are never interpreted as zero when sectionErrors.sales is present.
    const salesReport = report.status === "fulfilled" ? report.value : {
      sourceLabel: OWNER_SOURCE_LABEL, generatedAt: generatedAt(), dateFrom: date, dateTo: date,
      latestReportDate: null, branches: [],
      totals: { sales: 0, journalCount: 0, reportedBranches: 0, branchCount: 0, previousSales: null, previousReportedBranches: 0, comparisonComparable: false },
    };
    return {
      ...salesReport,
      assets: assetTotals.status === "fulfilled" ? assetTotals.value[0] : null,
      marketing: campaignTotals.status === "fulfilled" ? campaignTotals.value[0] : null,
      shareholders: summary.status === "fulfilled" ? { count: summary.value.count, totalShares: summary.value.totalShares } : null,
      ...(Object.keys(sectionErrors).length ? { sectionErrors } : {}),
    };
  });
  get("/api/owner/assets", async (req, ids): Promise<OwnerAssetsResponse> => {
    const page = ownerPage(req.query.page), search = ownerSearch(req.query.search);
    const filter = and(branchCondition(inventoryItems.branchId, ids), ilike(inventoryItems.name, search));
    const [items, totals] = await Promise.all([
      db.select({ id: inventoryItems.id, name: inventoryItems.name, branchName: branches.name, status: inventoryItems.status, category: inventoryItems.category, image: inventoryItems.imageUrl,
        openTickets: sql<number>`(select count(*)::int from ${maintenanceTickets} where ${maintenanceTickets.assetId} = ${inventoryItems.id} and ${maintenanceTickets.branchId} = ${inventoryItems.branchId} and ${maintenanceTickets.status} in ('open', 'assigned', 'in_progress'))`,
      }).from(inventoryItems).innerJoin(branches, eq(branches.id, inventoryItems.branchId)).where(filter).orderBy(asc(inventoryItems.name), asc(inventoryItems.id)).limit(OWNER_PAGE_SIZE).offset((page - 1) * OWNER_PAGE_SIZE),
      db.select({ total: count() }).from(inventoryItems).where(filter),
    ]);
    return { items: items.map(({ image, openTickets, ...item }) => ({ ...item, status: item.status ?? "غير محدد", imageUrl: ownerImageReference(image) ? `/api/owner/assets/${encodeURIComponent(item.id)}/image` : null, maintenanceSummary: openTickets > 0 ? `بلاغات صيانة مفتوحة: ${openTickets}` : null })), page, pageSize: OWNER_PAGE_SIZE, total: totals[0].total, generatedAt: generatedAt() };
  });
  get("/api/owner/shareholders", async (req): Promise<OwnerShareholdersResponse> => {
    const page = ownerPage(req.query.page), search = ownerSearch(req.query.search);
    const filter = and(inArray(shareholders.status, ["active", "frozen"]), ilike(shareholders.fullName, search));
    const [items, totals, summary] = await Promise.all([
      db.select({ id: shareholders.id, name: shareholders.fullName, shares: shareholders.numberOfShares }).from(shareholders).where(filter).orderBy(asc(shareholders.fullName), asc(shareholders.id)).limit(OWNER_PAGE_SIZE).offset((page - 1) * OWNER_PAGE_SIZE),
      db.select({ total: count() }).from(shareholders).where(filter),
      shareholderSummary(),
    ]);
    return { items: items.map(item => ({ ...item, ownershipPercent: summary.totalShares > 0 ? Number((item.shares / summary.totalShares * 100).toFixed(4)) : null })), summary, page, pageSize: OWNER_PAGE_SIZE, total: totals[0].total, generatedAt: generatedAt() };
  });
  get("/api/owner/marketing", async (req, ids): Promise<OwnerMarketingResponse> => {
    const section = ownerString(req.query.section, "campaigns") as OwnerMarketingSection;
    if (!["campaigns", "calendar", "tasks", "content"].includes(section)) throw new OwnerInputError("قسم التسويق غير صالح");
    const page = ownerPage(req.query.page), search = ownerSearch(req.query.search);
    // No free-text descriptions, personnel, budgets or attachments are read.
    const config = {
      campaigns: { table: marketingCampaigns, id: marketingCampaigns.id, title: marketingCampaigns.name, status: marketingCampaigns.status, date: marketingCampaigns.startDate },
      calendar: { table: marketingCalendarEvents, id: marketingCalendarEvents.id, title: marketingCalendarEvents.title, status: sql<string>`'scheduled'`, date: marketingCalendarEvents.startDate },
      tasks: { table: marketingTasks, id: marketingTasks.id, title: marketingTasks.title, status: marketingTasks.status, date: marketingTasks.dueDate },
      content: { table: marketingAssets, id: marketingAssets.id, title: marketingAssets.name, status: sql<string>`'registered'`, date: sql<string | null>`null::text` },
    }[section];
    // Company-wide records have no branch relation; content does, so restrict its branch-specific rows.
    const filter = and(ilike(config.title, search), section === "content" && ids !== null ? or(isNull(marketingAssets.branchId), branchCondition(marketingAssets.branchId, ids)) : undefined);
    const [items, totals] = await Promise.all([
      db.select({ id: config.id, title: config.title, status: config.status, date: config.date,
        image: section === "content" ? marketingAssets.thumbnailUrl : sql<string | null>`null::text`,
        file: section === "content" ? marketingAssets.fileUrl : sql<string | null>`null::text`,
      }).from(config.table).where(filter).orderBy(asc(config.title), asc(config.id)).limit(OWNER_PAGE_SIZE).offset((page - 1) * OWNER_PAGE_SIZE),
      db.select({ total: count() }).from(config.table).where(filter),
    ]);
    return { items: items.map(({ image, file, ...item }) => {
      const hasPreview = section === "content" && !!(ownerImageReference(image) || ownerImageReference(file));
      return { ...item, id: String(item.id), summary: section === "content" && !hasPreview ? OWNER_IMAGE_NOTICE : section === "calendar" ? "موعد مسجل في تقويم التسويق؛ لا تتوفر حالة تنفيذ" : null, imageUrl: hasPreview ? `/api/owner/marketing/content/${item.id}/image` : null };
    }), section, page, pageSize: OWNER_PAGE_SIZE, total: totals[0].total, scopeLabel: "على مستوى الشركة", generatedAt: generatedAt() };
  });
}