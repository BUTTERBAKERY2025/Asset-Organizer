import type { Express, Request, RequestHandler } from "express";
import { createHash, randomUUID } from "crypto";
import { and, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { canAccessBranch, getAllowedBranchIds, isAuthenticated, requirePermission } from "./auth";
import { kitchenActionAllowed } from "./central-kitchen-routing";
import { saudiDate } from "./central-kitchen-orders";
import {
  centralKitchenDemandActions,
  centralKitchenDemandCommitments,
  centralKitchenOrderEvents,
  centralKitchenOrderItems,
  centralKitchenOrders,
  users,
} from "@shared/schema";
import { activeReplacementCommitment, calculateDemandRemaining, demandDecimal, demandMicros, validateReceiptAttribution } from "@shared/central-kitchen-demand";

const id = z.coerce.number().int().positive();
const quantity = z.union([z.string(), z.number()]).transform(String).refine((value) => {
  try { return demandMicros(value) > BigInt(0); } catch { return false; }
}, "invalid quantity");
export const centralKitchenDemandActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("replacement"), quantity, dueDate: z.string().date(), responsibleUserId: z.string().min(1), idempotencyKey: z.string().min(8).max(128) }).strict(),
  z.object({ type: z.literal("accept_substitute"), quantity, reason: z.string().trim().min(3).max(1000), acknowledged: z.literal(true), idempotencyKey: z.string().min(8).max(128) }).strict(),
  z.object({ type: z.literal("waive"), quantity, reason: z.string().trim().min(3).max(1000), acknowledged: z.literal(true), idempotencyKey: z.string().min(8).max(128) }).strict(),
  z.object({ type: z.literal("confirm_receipt_components"), originalGoodQuantity: z.union([z.string(), z.number()]).transform(String), substituteGoodQuantity: z.union([z.string(), z.number()]).transform(String), reason: z.string().trim().min(3).max(1000), idempotencyKey: z.string().min(8).max(128) }).strict(),
]);

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const calendarDayNumber = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};
const currentUserId = (req: Request) => {
  if (!req.currentUser) throw new Error("User not authenticated");
  return req.currentUser.id;
};

async function scoped(req: Request, commitment: { requestBranchId: string; centralKitchenId: string }) {
  return await canAccessBranch(req, commitment.requestBranchId)
    || await canAccessBranch(req, commitment.centralKitchenId);
}

async function reportRows(req: Request, q: {
  kitchenId?: string; branchId?: string; status?: string; item?: string; reason?: string;
  originalOrderId?: number;
  mode?: "real" | "shadow" | "legacy"; dateFrom?: string; dateTo?: string;
  ownerId?: string; overdue?: "true" | "false";
  page: number; pageSize: number; export: "true" | "false";
}) {
  const allowed = getAllowedBranchIds(req);
  const conditions = [
    allowed === null ? undefined : or(
      inArray(centralKitchenDemandCommitments.requestBranchId, allowed.length ? allowed : ["__none__"]),
      inArray(centralKitchenDemandCommitments.centralKitchenId, allowed.length ? allowed : ["__none__"]),
    ),
    q.kitchenId ? eq(centralKitchenDemandCommitments.centralKitchenId, q.kitchenId) : undefined,
    q.branchId ? eq(centralKitchenDemandCommitments.requestBranchId, q.branchId) : undefined,
    q.reason ? eq(centralKitchenDemandCommitments.reasonCode, q.reason) : undefined,
    q.originalOrderId ? eq(centralKitchenDemandCommitments.originalOrderId, q.originalOrderId) : undefined,
    q.item ? ilike(centralKitchenDemandCommitments.productName, `%${q.item.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`) : undefined,
    q.mode === "legacy" ? isNull(centralKitchenDemandCommitments.inventoryMode)
      : q.mode ? eq(centralKitchenDemandCommitments.inventoryMode, q.mode) : undefined,
    q.dateFrom ? gte(centralKitchenDemandCommitments.activatedAt, new Date(`${q.dateFrom}T00:00:00+03:00`)) : undefined,
    q.dateTo ? lte(centralKitchenDemandCommitments.activatedAt, new Date(`${q.dateTo}T23:59:59.999+03:00`)) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => !!condition);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` })
    .from(centralKitchenDemandCommitments).where(conditions.length ? and(...conditions) : undefined);
  const baseQuery = db.select().from(centralKitchenDemandCommitments)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${centralKitchenDemandCommitments.activatedAt} DESC`, sql`${centralKitchenDemandCommitments.id} DESC`);
  const requiresDerivedFiltering = !!q.ownerId || !!q.overdue || !!q.status;
  const rows = q.export === "true" || requiresDerivedFiltering
    ? await baseQuery
    : await baseQuery.limit(q.pageSize).offset((q.page - 1) * q.pageSize);
  const visible = rows;
  const ids = visible.map((row) => row.id);
  const actions = ids.length
    ? await db.select().from(centralKitchenDemandActions).where(inArray(centralKitchenDemandActions.commitmentId, ids))
    : [];
  const actionsByCommitment = new Map<number, typeof actions>();
  for (const action of actions) actionsByCommitment.set(action.commitmentId, [...(actionsByCommitment.get(action.commitmentId) || []), action]);
  const replacementOrderIds = actions.flatMap((row) => row.replacementOrderId ? [row.replacementOrderId] : []);
  const replacementOrders = replacementOrderIds.length
    ? await db.select({ id: centralKitchenOrders.id, status: centralKitchenOrders.status })
        .from(centralKitchenOrders).where(inArray(centralKitchenOrders.id, replacementOrderIds))
    : [];
  const replacementStatus = new Map(replacementOrders.map((order) => [order.id, order.status]));
  const replacementItemIds = actions.flatMap((row) => row.replacementOrderItemId ? [row.replacementOrderItemId] : []);
  const compensation = replacementItemIds.length
    ? await db.select({
        itemId: centralKitchenOrderItems.id,
        received: centralKitchenOrderItems.receivedQuantity,
        preparedOriginal: centralKitchenOrderItems.preparedQuantity,
      }).from(centralKitchenOrderItems)
        .where(inArray(centralKitchenOrderItems.id, replacementItemIds))
    : [];
  const compensationByItem = new Map(compensation.map((row) => [row.itemId, row]));
  return { total, rows: visible.map((row) => {
    const ownActions = actionsByCommitment.get(row.id) || [];
    const accepted = ownActions.filter((a) => a.actionType === "substitute_accepted")
      .reduce((sum, a) => sum + demandMicros(String(a.quantity)), BigInt(0));
    const waived = ownActions.filter((a) => a.actionType === "remainder_waived")
      .reduce((sum, a) => sum + demandMicros(String(a.quantity)), BigInt(0));
    const compensationGood = ownActions.filter((a) => a.replacementOrderId)
      .reduce((sum, a) => {
        const receipt = compensationByItem.get(a.replacementOrderItemId!);
        const received = demandMicros(String(receipt?.received || 0));
        const preparedOriginal = demandMicros(String(receipt?.preparedOriginal || 0));
        const originalReceipt = received < preparedOriginal ? received : preparedOriginal;
        const allocated = demandMicros(String(a.quantity));
        return sum + (originalReceipt < allocated ? originalReceipt : allocated);
      }, BigInt(0));
    const replacementActions = ownActions.filter((action) => action.actionType === "replacement_created");
    const activeReplacementActions = replacementActions.filter((action) => {
      const status = replacementStatus.get(action.replacementOrderId!);
      return status != null && !["cancelled", "received"].includes(status);
    });
    const nextDue = activeReplacementActions.map((action) => action.dueDate).filter(Boolean).sort()[0] || null;
    const owners = Array.from(new Set(activeReplacementActions.map((action) => action.responsibleUserId).filter((id): id is string => !!id)));
    const remaining = calculateDemandRemaining({
      requested: row.requestedQuantity,
      originalGoodReceived: row.originalGoodReceivedQuantity,
      acceptedSubstitute: demandDecimal(accepted),
      compensationGoodReceived: demandDecimal(compensationGood),
      waived: demandDecimal(waived),
    });
    const serviceFulfilled = demandMicros(remaining) === BigInt(0)
      && demandMicros(String(row.originalGoodReceivedQuantity)) + accepted + compensationGood >= demandMicros(String(row.requestedQuantity));
    const effectiveStatus = serviceFulfilled ? "fulfilled"
      : demandMicros(remaining) === BigInt(0) && waived > BigInt(0) ? "waived"
      : activeReplacementActions.length ? "replacement_planned"
      : accepted + compensationGood + waived > BigInt(0) ? "partially_settled"
      : row.receiptAttributionBasis === "branch_confirmed"
        && demandMicros(String(row.substituteOfferedQuantity)) > accepted ? "substitute_pending"
        : "open";
    return {
      ...row,
      acceptedSubstituteQuantity: demandDecimal(accepted),
      compensationGoodReceivedQuantity: demandDecimal(compensationGood),
      waivedQuantity: demandDecimal(waived),
      remainingQuantity: remaining,
      nextDueDate: nextDue,
      responsibleUserIds: owners,
      overdue: !!nextDue && nextDue < saudiDate() && demandMicros(remaining) > BigInt(0),
      agingDays: Math.max(0, calendarDayNumber(saudiDate()) - calendarDayNumber(saudiDate(new Date(row.activatedAt)))),
      serviceFulfilled,
      effectiveStatus,
      status: effectiveStatus,
      originalReceiptBasis: row.receiptAttributionBasis,
      actions: ownActions,
    };
  }) };
}

function groupedReportTotals(rows: Awaited<ReturnType<typeof reportRows>>["rows"]) {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const identity = row.productId ? `p:${row.productId}` : row.warehouseItemId ? `w:${row.warehouseItemId}` : `n:${row.productName}`;
    const key = `${identity}|${row.unit}|${row.inventoryMode || "legacy"}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const sum = (values: Array<string | number>) => demandDecimal(values.reduce((total, value) => total + demandMicros(String(value)), BigInt(0)));
  return Array.from(groups.entries()).map(([key, values]) => ({
    key, productName: values[0].productName, unit: values[0].unit, inventoryMode: values[0].inventoryMode,
    requestedQuantity: sum(values.map((row) => row.requestedQuantity)),
    originalGoodReceivedQuantity: sum(values.map((row) => row.originalGoodReceivedQuantity)),
    acceptedSubstituteQuantity: sum(values.map((row) => row.acceptedSubstituteQuantity)),
    compensationGoodReceivedQuantity: sum(values.map((row) => row.compensationGoodReceivedQuantity)),
    waivedQuantity: sum(values.map((row) => row.waivedQuantity)),
    remainingQuantity: sum(values.map((row) => row.remainingQuantity)),
  }));
}

// Express 4 does not forward rejected async handlers to error middleware.
// Cover the entire handler, including reads before transaction-level catches.
const forwardAsyncErrors = (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve().then(() => handler(req, res, next)).catch(next);
  };

export function registerCentralKitchenDemandRoutes(app: Express) {
  app.get("/api/central-kitchen-demand/legacy-candidates", isAuthenticated, requirePermission("central_kitchen_orders", "view"), forwardAsyncErrors(async (req, res) => {
    const parsed = z.object({ orderId: id.optional(), page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().min(1).max(200).default(100) }).safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "معايير المصالحة القديمة غير صالحة" });
    const conditions = [
      eq(centralKitchenOrders.status, "received"),
      sql`LEAST(COALESCE(${centralKitchenOrderItems.receivedQuantity}, 0), COALESCE(${centralKitchenOrderItems.preparedQuantity}, 0)) < ${centralKitchenOrderItems.requestedQuantity}`,
      sql`NOT EXISTS (SELECT 1 FROM central_kitchen_demand_commitments dc WHERE dc.original_order_item_id = ${centralKitchenOrderItems.id})`,
      sql`NOT EXISTS (SELECT 1 FROM central_kitchen_demand_actions da WHERE da.replacement_order_id = ${centralKitchenOrders.id})`,
      ...(parsed.data.orderId ? [eq(centralKitchenOrders.id, parsed.data.orderId)] : []),
    ];
    const allowed = getAllowedBranchIds(req);
    if (allowed !== null) conditions.push(or(
      inArray(centralKitchenOrders.requestBranchId, allowed.length ? allowed : ["__none__"]),
      inArray(centralKitchenOrders.centralKitchenId, allowed.length ? allowed : ["__none__"]),
    )!);
    const candidates = await db.select({ item: centralKitchenOrderItems, order: centralKitchenOrders })
      .from(centralKitchenOrderItems)
      .innerJoin(centralKitchenOrders, eq(centralKitchenOrders.id, centralKitchenOrderItems.orderId))
      .where(and(...conditions))
      .orderBy(sql`${centralKitchenOrders.receivedAt} DESC NULLS LAST`, sql`${centralKitchenOrderItems.id} DESC`)
      .limit(parsed.data.pageSize)
      .offset((parsed.data.page - 1) * parsed.data.pageSize);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` })
      .from(centralKitchenOrderItems)
      .innerJoin(centralKitchenOrders, eq(centralKitchenOrders.id, centralKitchenOrderItems.orderId))
      .where(and(...conditions));
    const visible = [];
    for (const candidate of candidates) {
      const requested = demandMicros(String(candidate.item.requestedQuantity));
      const prepared = demandMicros(String(candidate.item.preparedQuantity || 0));
      const received = demandMicros(String(candidate.item.receivedQuantity || 0));
      const originalGood = received < prepared ? received : prepared;
      if (originalGood >= requested) continue;
      visible.push({
        orderId: candidate.order.id,
        orderNumber: candidate.order.orderNumber,
        itemId: candidate.item.id,
        productName: candidate.item.productName,
        unit: candidate.item.unit,
        requestedQuantity: demandDecimal(requested),
        estimatedOriginalGoodReceivedQuantity: demandDecimal(originalGood),
        estimatedRemainingQuantity: demandDecimal(requested - originalGood),
        reconciliationRequired: true,
        inventoryEffect: "none",
      });
    }
    res.set("Cache-Control", "private, no-store");
    return res.json({ rows: visible, total, page: parsed.data.page, pageSize: parsed.data.pageSize, totalPages: Math.ceil(total / parsed.data.pageSize) });
  }));

  app.get("/api/central-kitchen-demand", isAuthenticated, requirePermission("central_kitchen_orders", "view"), forwardAsyncErrors(async (req, res) => {
    const query = z.object({
      kitchenId: z.string().optional(), branchId: z.string().optional(), status: z.string().optional(),
      originalOrderId: z.coerce.number().int().positive().optional(),
      item: z.string().optional(), reason: z.string().optional(), mode: z.enum(["real", "shadow", "legacy"]).optional(),
      dateFrom: z.string().date().optional(), dateTo: z.string().date().optional(),
      ownerId: z.string().optional(), overdue: z.enum(["true", "false"]).optional(),
      page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().min(1).max(200).default(50),
      export: z.enum(["true", "false"]).default("false"),
    }).safeParse(req.query);
    if (!query.success) return res.status(400).json({ error: "معايير التقرير غير صالحة" });
    const q = query.data;
    const report = await reportRows(req, q);
    const filterDerived = (row: (typeof report.rows)[number]) =>
      (!q.status || row.effectiveStatus === q.status)
      && (!q.ownerId || row.responsibleUserIds.includes(q.ownerId))
      && (!q.overdue || row.overdue === (q.overdue === "true"))
    ;
    let rows = report.rows.filter(filterDerived);
    const allFiltered = q.export === "true" || q.ownerId || q.overdue || q.status
      ? rows
      : (await reportRows(req, { ...q, export: "true", page: 1 })).rows.filter(filterDerived);
    res.set("Cache-Control", "private, no-store");
    const total = allFiltered.length;
    const ownerSource = q.ownerId || q.overdue || q.status ? report.rows : allFiltered;
    const ownerIds = Array.from(new Set(ownerSource.flatMap((row) => row.responsibleUserIds)));
    const ownerRows = ownerIds.length
      ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users).where(inArray(users.id, ownerIds))
      : [];
    const responsibleUsers = ownerRows.map((owner) => ({
      id: owner.id,
      name: [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.username || "مستخدم غير مسمى",
    }));
    if (q.export !== "true" && (q.ownerId || q.overdue || q.status)) {
      rows = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    }
    return res.json({ rows, groups: groupedReportTotals(allFiltered), responsibleUsers, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }));

  app.post("/api/central-kitchen-demand/activate/:itemId", isAuthenticated, requirePermission("central_kitchen_orders", "edit"), forwardAsyncErrors(async (req, res) => {
    const itemId = id.safeParse(req.params.itemId);
    if (!itemId.success) return res.status(400).json({ error: "معرف البند غير صالح" });
    const [item] = await db.select({ item: centralKitchenOrderItems, order: centralKitchenOrders })
      .from(centralKitchenOrderItems).innerJoin(centralKitchenOrders, eq(centralKitchenOrders.id, centralKitchenOrderItems.orderId))
      .where(eq(centralKitchenOrderItems.id, itemId.data)).limit(1);
    if (!item) return res.status(404).json({ error: "البند غير موجود" });
    if (!(await scoped(req, item.order))) return res.status(403).json({ error: "خارج نطاق الفروع المسموح" });
    if (!["received", "cancelled"].includes(item.order.status)) return res.status(409).json({ error: "لا يمكن تفعيل الالتزام قبل إغلاق مسار الطلب" });
    const [isReplacement] = await db.select({ id: centralKitchenDemandActions.id }).from(centralKitchenDemandActions)
      .where(eq(centralKitchenDemandActions.replacementOrderId, item.order.id)).limit(1);
    if (isReplacement) return res.status(409).json({ error: "لا يمكن إنشاء سلسلة تعويض من طلب تعويضي؛ يُحتسب استلامه على الطلب الأصلي" });
    const requested = demandMicros(String(item.item.requestedQuantity));
    const preparedOriginal = demandMicros(String(item.item.preparedQuantity || 0));
    const received = demandMicros(String(item.item.receivedQuantity || 0));
    const originalGood = received < preparedOriginal ? received : preparedOriginal;
    const prepShortfall = requested > preparedOriginal ? requested - preparedOriginal : BigInt(0);
    const transitLoss = preparedOriginal > originalGood ? preparedOriginal - originalGood : BigInt(0);
    const substitute = demandMicros(String(item.item.substituteQuantity || 0));
    const inferredSubstituteReceived = substitute < (received - originalGood) ? substitute : (received - originalGood);
    if (requested <= originalGood) return res.status(409).json({ error: "لا يوجد طلب أصلي غير ملبّى لهذا البند" });
    try {
      const [created] = await db.insert(centralKitchenDemandCommitments).values({
        originalOrderId: item.order.id, originalOrderItemId: item.item.id,
        requestBranchId: item.order.requestBranchId, centralKitchenId: item.order.centralKitchenId,
        inventoryMode: item.order.inventoryMode, productId: item.item.productId, warehouseItemId: item.item.warehouseItemId,
        productName: item.item.productName, unit: item.item.unit, requestedQuantity: demandDecimal(requested),
        originalGoodReceivedQuantity: demandDecimal(originalGood),
        totalGoodReceivedQuantity: demandDecimal(received),
        preparationShortfallQuantity: demandDecimal(prepShortfall),
        transitLossQuantity: demandDecimal(transitLoss),
        substitutePreparedQuantity: demandDecimal(substitute),
        substituteOfferedQuantity: demandDecimal(inferredSubstituteReceived),
        receiptAttributionBasis: "estimated_original_first",
        reasonCode: transitLoss > BigInt(0) ? "transit_loss" : "preparation_shortfall",
        status: inferredSubstituteReceived > BigInt(0) ? "substitute_pending" : "open",
        activationKind: item.order.inventoryMode == null ? "legacy_reconciliation" : "receipt",
        activatedBy: currentUserId(req),
      }).returning();
      return res.status(201).json(created);
    } catch (error: any) {
      if ((error?.cause?.code || error?.code) === "23505") {
        const [existing] = await db.select().from(centralKitchenDemandCommitments)
          .where(eq(centralKitchenDemandCommitments.originalOrderItemId, item.item.id)).limit(1);
        return res.json(existing);
      }
      throw error;
    }
  }));

  app.post("/api/central-kitchen-demand/:id/actions", isAuthenticated, requirePermission("central_kitchen_orders", "edit"), forwardAsyncErrors(async (req, res) => {
    const commitmentId = id.safeParse(req.params.id);
    const body = centralKitchenDemandActionSchema.safeParse(req.body);
    if (!commitmentId.success || !body.success) return res.status(400).json({ error: "بيانات القرار غير صالحة" });
    const [commitment] = await db.select().from(centralKitchenDemandCommitments).where(eq(centralKitchenDemandCommitments.id, commitmentId.data)).limit(1);
    if (!commitment) return res.status(404).json({ error: "الالتزام غير موجود" });
    const branchDecision = body.data.type !== "replacement";
    if (!(await canAccessBranch(req, branchDecision ? commitment.requestBranchId : commitment.centralKitchenId))) {
      return res.status(403).json({ error: branchDecision ? "اعتماد البديل أو الإلغاء متاح للفرع الطالب فقط" : "إنشاء التعويض متاح للمطبخ المسؤول فقط" });
    }
    const routingOrder = { requestBranchId: commitment.requestBranchId, centralKitchenId: commitment.centralKitchenId };
    if (branchDecision && !(await kitchenActionAllowed(db, currentUserId(req), routingOrder, "receive"))) {
      return res.status(403).json({ error: "يتطلب هذا القرار صلاحية وتكليف الاستلام الحالي للفرع الطالب" });
    }
    if (body.data.type === "replacement"
      && !(await kitchenActionAllowed(db, body.data.responsibleUserId, routingOrder, "prepare"))) {
      return res.status(400).json({ error: "المسؤول المحدد غير نشط أو غير مؤهل أو خارج تكليف المطبخ الحالي" });
    }
    const hash = fingerprint(body.data);
    const [replay] = await db.select().from(centralKitchenDemandActions).where(and(
      eq(centralKitchenDemandActions.commitmentId, commitment.id),
      eq(centralKitchenDemandActions.idempotencyKey, body.data.idempotencyKey),
    )).limit(1);
    if (replay) {
      if (replay.payloadFingerprint !== hash) return res.status(409).json({ error: "مفتاح عدم التكرار مستخدم لقرار مختلف" });
      res.set("Idempotent-Replayed", "true");
      return res.json(replay);
    }
    try {
      const result = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(centralKitchenDemandCommitments)
          .where(eq(centralKitchenDemandCommitments.id, commitment.id)).for("update");
        const prior = await tx.select().from(centralKitchenDemandActions)
          .where(eq(centralKitchenDemandActions.commitmentId, commitment.id));
        const priorReplacementIds = prior.flatMap((action) => action.replacementOrderId ? [action.replacementOrderId] : []);
        const replacementOrders = priorReplacementIds.length
          ? await tx.select({ id: centralKitchenOrders.id, status: centralKitchenOrders.status })
              .from(centralKitchenOrders).where(inArray(centralKitchenOrders.id, priorReplacementIds))
          : [];
        const replacementStatuses = new Map(replacementOrders.map((order) => [order.id, order.status]));
        const priorReplacementItemIds = prior.flatMap((action) => action.replacementOrderItemId ? [action.replacementOrderItemId] : []);
        const replacementItems = priorReplacementItemIds.length
          ? await tx.select({ id: centralKitchenOrderItems.id, received: centralKitchenOrderItems.receivedQuantity })
              .from(centralKitchenOrderItems).where(inArray(centralKitchenOrderItems.id, priorReplacementItemIds))
          : [];
        const replacementReceipts = new Map(replacementItems.map((item) => [item.id, String(item.received || 0)]));
        const committed = prior.reduce((sum, action) => {
          if (action.actionType === "receipt_attribution_confirmed") return sum;
          const allocated = demandMicros(String(action.quantity));
          if (action.actionType !== "replacement_created") return sum + allocated;
          const status = replacementStatuses.get(action.replacementOrderId!);
          return sum + demandMicros(activeReplacementCommitment({
            allocated: String(action.quantity),
            actuallyReceived: replacementReceipts.get(action.replacementOrderItemId!) || "0",
            status: status || "requested",
          }));
        }, BigInt(0));
        const available = demandMicros(String(locked.requestedQuantity))
          - demandMicros(String(locked.originalGoodReceivedQuantity)) - committed;
        if (body.data.type === "confirm_receipt_components") {
          if (prior.some((action) => action.actionType !== "receipt_attribution_confirmed")) {
            throw Object.assign(new Error("يجب تأكيد توزيع الاستلام قبل أي قرار تسوية"), { status: 409 });
          }
          if (prior.some((action) => action.actionType === "receipt_attribution_confirmed")) {
            throw Object.assign(new Error("سبق أن أكد الفرع توزيع مكونات الاستلام"), { status: 409 });
          }
          const original = demandMicros(body.data.originalGoodQuantity);
          const substitute = demandMicros(body.data.substituteGoodQuantity);
          if (!validateReceiptAttribution({
            totalGoodReceived: locked.totalGoodReceivedQuantity,
            requested: locked.requestedQuantity,
            preparedSubstitute: locked.substitutePreparedQuantity,
            originalGood: body.data.originalGoodQuantity,
            substituteGood: body.data.substituteGoodQuantity,
          })) {
            throw Object.assign(new Error("توزيع مكونات الاستلام يتجاوز الكميات المسجلة"), { status: 409 });
          }
          const [confirmation] = await tx.insert(centralKitchenDemandActions).values({
            commitmentId: locked.id, actionType: "receipt_attribution_confirmed",
            quantity: demandDecimal(original), secondaryQuantity: demandDecimal(substitute),
            reason: body.data.reason, actorId: currentUserId(req),
            idempotencyKey: body.data.idempotencyKey, payloadFingerprint: hash,
          }).returning();
          await tx.update(centralKitchenDemandCommitments).set({
            originalGoodReceivedQuantity: demandDecimal(original),
            substituteOfferedQuantity: demandDecimal(substitute),
            receiptAttributionBasis: "branch_confirmed",
            status: substitute > BigInt(0) ? "substitute_pending" : "open",
            version: sql`${centralKitchenDemandCommitments.version} + 1`, updatedAt: sql`now()`,
          }).where(eq(centralKitchenDemandCommitments.id, locked.id));
          return confirmation;
        }
        const requestedAction = demandMicros(body.data.quantity);
        if (locked.receiptAttributionBasis !== "branch_confirmed") {
          throw Object.assign(new Error("يجب أن يؤكد الفرع توزيع الاستلام قبل أي قرار تسوية أو تعويض"), { status: 409 });
        }
        if (requestedAction > available) throw Object.assign(new Error("الكمية تتجاوز المتبقي غير المخصص"), { status: 409 });
        if (body.data.type === "accept_substitute" && requestedAction > demandMicros(String(locked.substituteOfferedQuantity))) {
          throw Object.assign(new Error("الكمية تتجاوز البديل المعروض"), { status: 409 });
        }
        const priorAccepted = prior.filter((action) => action.actionType === "substitute_accepted")
          .reduce((sum, action) => sum + demandMicros(String(action.quantity)), BigInt(0));
        if (body.data.type === "accept_substitute"
          && priorAccepted + requestedAction > demandMicros(String(locked.substituteOfferedQuantity))) {
          throw Object.assign(new Error("إجمالي القبول يتجاوز كمية البديل المعروضة"), { status: 409 });
        }
        let replacementOrderId: number | null = null;
        let replacementOrderItemId: number | null = null;
        if (body.data.type === "replacement") {
          const [responsible] = await tx.select({ id: users.id }).from(users).where(eq(users.id, body.data.responsibleUserId)).limit(1);
          if (!responsible) throw Object.assign(new Error("المسؤول المحدد غير موجود"), { status: 400 });
          const orderKey = `demand:${locked.id}:${body.data.idempotencyKey}`.slice(0, 128);
          const [order] = await tx.insert(centralKitchenOrders).values({
            orderNumber: `CK-R-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`,
            requestBranchId: locked.requestBranchId, centralKitchenId: locked.centralKitchenId,
            orderDate: new Date().toISOString().slice(0, 10), neededDate: body.data.dueDate,
            notes: `تعويض مرتبط بالالتزام #${locked.id}`, idempotencyKey: orderKey,
            payloadFingerprint: hash, createdBy: currentUserId(req), inventoryMode: locked.inventoryMode,
          }).returning({ id: centralKitchenOrders.id });
          replacementOrderId = order.id;
          const [replacementItem] = await tx.insert(centralKitchenOrderItems).values({
            orderId: order.id, productId: locked.productId, warehouseItemId: locked.warehouseItemId,
            productName: locked.productName, requestedQuantity: body.data.quantity as any,
            reportedAvailableQuantity: 0, unit: locked.unit, notes: `تعويض للطلب الأصلي #${locked.originalOrderId}`,
          }).returning({ id: centralKitchenOrderItems.id });
          replacementOrderItemId = replacementItem.id;
          await tx.insert(centralKitchenOrderEvents).values({
            orderId: order.id, eventType: "created", fromStatus: null, toStatus: "requested",
            notes: `تعويض للالتزام #${locked.id}`, idempotencyKey: `created:${orderKey}`.slice(0, 128),
            payloadFingerprint: hash, actorId: currentUserId(req),
          });
        }
        const actionType = body.data.type === "replacement" ? "replacement_created"
          : body.data.type === "accept_substitute" ? "substitute_accepted" : "remainder_waived";
        if (!("quantity" in body.data)) throw new Error("Receipt confirmation did not return from transaction");
        const [action] = await tx.insert(centralKitchenDemandActions).values({
          commitmentId: locked.id, actionType, quantity: body.data.quantity,
          dueDate: body.data.type === "replacement" ? body.data.dueDate : null,
          responsibleUserId: body.data.type === "replacement" ? body.data.responsibleUserId : null,
          replacementOrderId, replacementOrderItemId, secondaryQuantity: null,
          reason: body.data.type === "replacement" ? null : body.data.reason,
          actorId: currentUserId(req), idempotencyKey: body.data.idempotencyKey, payloadFingerprint: hash,
        }).returning();
        const exhausted = requestedAction === available;
        await tx.update(centralKitchenDemandCommitments).set({
          status: body.data.type === "waive" && exhausted ? "waived"
            : body.data.type === "replacement" ? "replacement_planned"
            : exhausted ? "fulfilled" : "partially_settled",
          version: sql`${centralKitchenDemandCommitments.version} + 1`, updatedAt: sql`now()`,
        }).where(eq(centralKitchenDemandCommitments.id, locked.id));
        return action;
      });
      return res.status(201).json(result);
    } catch (error: any) {
      if (error?.status) return res.status(error.status).json({ error: error.message });
      if ((error?.cause?.code || error?.code) === "23505") {
        const [racedReplay] = await db.select().from(centralKitchenDemandActions).where(and(
          eq(centralKitchenDemandActions.commitmentId, commitment.id),
          eq(centralKitchenDemandActions.idempotencyKey, body.data.idempotencyKey),
        )).limit(1);
        if (racedReplay?.payloadFingerprint === hash) {
          res.set("Idempotent-Replayed", "true");
          return res.json(racedReplay);
        }
        return res.status(409).json({ error: "تعارض متزامن؛ حدّث التقرير وأعد المحاولة" });
      }
      throw error;
    }
  }));
}