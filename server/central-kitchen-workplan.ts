import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { canAccessBranch, isAuthenticated, requirePermission } from "./auth";
import {
  CENTRAL_KITCHEN_WORKPLAN_OVERDUE_LOOKBACK_DAYS,
  CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
  centralKitchenWorkplanQuerySchema,
  type CentralKitchenWorkplan,
  type CentralKitchenWorkplanBatch,
  type CentralKitchenWorkplanBatchSummary,
  type CentralKitchenWorkplanException,
  type CentralKitchenWorkplanInventoryMode,
  type CentralKitchenWorkplanOrder,
  type CentralKitchenWorkplanOrderItem,
  type CentralKitchenWorkplanQuantityGroup,
  type CentralKitchenWorkplanRecipeEvidence,
} from "@shared/central-kitchen-workplan";
import {
  getCentralKitchenNextStep,
  parseCentralKitchenInventoryMode,
} from "@shared/central-kitchen-next-step";

type DatabaseRow = Record<string, unknown>;

export type WorkplanSqlExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>;
};

export type CentralKitchenWorkplanDatabase = {
  transaction: <T>(callback: (transaction: WorkplanSqlExecutor) => Promise<T>) => Promise<T>;
};

export type CentralKitchenWorkplanRouteDependencies = {
  database?: CentralKitchenWorkplanDatabase;
  canAccessBranch?: (req: Request, branchId: string) => Promise<boolean>;
  now?: () => Date;
};

class CentralKitchenWorkplanError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CentralKitchenWorkplanError";
  }
}

function asRow(value: unknown): DatabaseRow {
  return (value || {}) as DatabaseRow;
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integerValue(value: unknown): number {
  return Math.trunc(numberValue(value));
}

function nullableInteger(value: unknown): number | null {
  return value === null || value === undefined ? null : integerValue(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : numberValue(value);
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true";
}

function actualRiyadhDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function sortByDateAndId<T extends { neededDate: string; id: number }>(left: T, right: T): number {
  return left.neededDate.localeCompare(right.neededDate) || left.id - right.id;
}

function quantityGroups(
  batches: readonly CentralKitchenWorkplanBatch[],
): CentralKitchenWorkplanQuantityGroup[] {
  const groups = new Map<string, CentralKitchenWorkplanQuantityGroup>();
  for (const batch of batches) {
    const key = `${batch.unit}\u0000${batch.status}`;
    const current = groups.get(key) || {
      unit: batch.unit,
      status: batch.status,
      batchCount: 0,
      quantity: 0,
    };
    current.batchCount += 1;
    current.quantity += batch.quantity;
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) =>
    left.unit.localeCompare(right.unit) || left.status.localeCompare(right.status));
}

function batchSummary(batches: CentralKitchenWorkplanBatch[]): CentralKitchenWorkplanBatchSummary {
  const recipeEvidence = { recipeBacked: 0, legacy: 0, unknown: 0 };
  const materialPosting = { consumed: 0, pending: 0, unknown: 0 };
  for (const batch of batches) {
    recipeEvidence[batch.recipeEvidence === "recipe_backed"
      ? "recipeBacked"
      : batch.recipeEvidence] += 1;
    materialPosting[batch.materialPosting] += 1;
  }
  return {
    count: batches.length,
    refs: batches.map((batch) => ({ id: batch.id, directLink: batch.directLink })),
    byUnitAndStatus: quantityGroups(batches),
    recipeEvidence,
    materialPosting,
    batches,
  };
}

type MutableOrder = {
  id: number;
  orderNumber: string;
  orderDate: string;
  neededDate: string;
  cohort: "date" | "overdue";
  requestingBranch: { id: string; name: string };
  kitchen: { id: string; name: string };
  rawStatus: string;
  inventoryMode: CentralKitchenWorkplanInventoryMode;
  discrepancyStatus: string;
  items: CentralKitchenWorkplanOrderItem[];
};

function orderFromRows(rows: unknown[]): {
  orders: MutableOrder[];
  dateCandidateCount: number;
  overdueCandidateCount: number;
} {
  const orders = new Map<number, MutableOrder>();
  for (const raw of rows) {
    const row = asRow(raw);
    const id = integerValue(row.order_id);
    if (!id) continue;
    let order = orders.get(id);
    if (!order) {
      order = {
        id,
        orderNumber: textValue(row.order_number, `#${id}`),
        orderDate: textValue(row.order_date),
        neededDate: textValue(row.needed_date),
        cohort: row.cohort === "overdue" ? "overdue" : "date",
        requestingBranch: {
          id: textValue(row.request_branch_id),
          name: textValue(row.request_branch_name, textValue(row.request_branch_id)),
        },
        kitchen: {
          id: textValue(row.kitchen_id),
          name: textValue(row.kitchen_name, textValue(row.kitchen_id)),
        },
        rawStatus: textValue(row.raw_status, "unknown"),
        inventoryMode: parseCentralKitchenInventoryMode(row.inventory_mode),
        discrepancyStatus: textValue(row.discrepancy_status, "unknown"),
        items: [],
      };
      orders.set(id, order);
    }
    const itemId = nullableInteger(row.item_id);
    if (itemId === null || order.items.some((item) => item.id === itemId)) continue;
    const productId = nullableInteger(row.product_id);
    const warehouseItemId = nullableInteger(row.warehouse_item_id);
    const catalogMapping = productId !== null && warehouseItemId !== null
      ? "ambiguous"
      : productId !== null
        ? "product"
        : warehouseItemId !== null
          ? "warehouse_item"
          : "none";
    order.items.push({
      id: itemId,
      productId,
      warehouseItemId,
      productName: textValue(row.item_name, "صنف غير مسمى"),
      unit: textValue(row.item_unit, "غير محددة"),
      requestedQuantity: numberValue(row.requested_quantity),
      preparedQuantity: nullableNumber(row.prepared_quantity),
      dispatchedQuantity: nullableNumber(row.dispatched_quantity),
      receivedQuantity: nullableNumber(row.received_quantity),
      damagedQuantity: nullableNumber(row.damaged_quantity),
      missingQuantity: nullableNumber(row.missing_quantity),
      catalogMapping,
      approvedRecipe: null,
      approvedRecipeNote: null,
    });
  }
  const all = [...orders.values()];
  return {
    orders: all.sort(sortByDateAndId),
    dateCandidateCount: all.filter((order) => order.cohort === "date").length,
    overdueCandidateCount: all.filter((order) => order.cohort === "overdue").length,
  };
}

function exception(
  code: CentralKitchenWorkplanException["code"],
  message: string,
  itemId?: number,
  batchIds?: number[],
): CentralKitchenWorkplanException {
  return {
    code,
    objective: code === "overdue"
      ? "إظهار الطلبات التي تجاوزت تاريخ احتياجها حسب تاريخ الرياض"
      : code === "no_catalog_mapping"
        ? "تأكيد مصدر كتالوج قابل للتحقق قبل التخطيط"
        : "متابعة دفعات الإنتاج المرتبطة غير المكتملة",
    message,
    ...(itemId === undefined ? {} : { itemId }),
    ...(batchIds?.length ? { batchIds } : {}),
  };
}

function buildOrder(
  order: MutableOrder,
  batchesByItem: Map<number, CentralKitchenWorkplanBatch[]>,
  actualToday: string,
): CentralKitchenWorkplanOrder {
  const batches = order.items.flatMap((item) => batchesByItem.get(item.id) || [])
    .sort((left, right) => left.id - right.id);
  const nextStep = getCentralKitchenNextStep({
    status: order.rawStatus,
    inventoryMode: order.inventoryMode,
    discrepancyStatus: order.discrepancyStatus,
  });
  const finished = nextStep.isComplete;
  const exceptions: CentralKitchenWorkplanException[] = [];
  if (order.neededDate < actualToday && !finished) {
    exceptions.push(exception("overdue", "الطلب غير مكتمل وتاريخ الاحتياج أسبق من تاريخ الرياض الحالي"));
  }
  for (const item of order.items) {
    if (item.catalogMapping === "none" || item.catalogMapping === "ambiguous") {
      exceptions.push(exception("no_catalog_mapping", "بند الطلب لا يملك ربط كتالوج واحداً قابلاً للتحقق", item.id));
    }
  }
  const unfinishedBatchIds = batches.filter((batch) => !batch.finished).map((batch) => batch.id);
  if (unfinishedBatchIds.length) {
    exceptions.push(exception(
      "unfinished_linked_batch",
      "توجد دفعات إنتاج مرتبطة لم تصل إلى حالة finished",
      undefined,
      unfinishedBatchIds,
    ));
  }
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    neededDate: order.neededDate,
    cohort: order.cohort,
    source: {
      requestingBranch: order.requestingBranch,
      kitchen: order.kitchen,
    },
    rawStatus: order.rawStatus,
    inventoryMode: order.inventoryMode,
    discrepancyStatus: order.discrepancyStatus,
    nextStep,
    finished,
    directOrderLink: `/api/central-kitchen-orders/${order.id}`,
    items: order.items,
    linkedBatches: batchSummary(batches),
    readiness: {
      status: "unknown",
      reason: "allocated_stock_not_evaluated",
    },
    exceptions,
  };
}

function summaryForOrders(
  orders: CentralKitchenWorkplanOrder[],
  dateCohortOrderCount = orders.filter((order) => order.cohort === "date").length,
  overdueEarlierOrderCount = orders.filter((order) => order.cohort === "overdue").length,
): CentralKitchenWorkplan["summary"] {
  const statusMap = new Map<string, number>();
  const modeMap = new Map<CentralKitchenWorkplanInventoryMode, {
    orderCount: number;
    batches: CentralKitchenWorkplanBatch[];
  }>();
  const exceptionCounts: CentralKitchenWorkplan["summary"]["exceptionCounts"] = {};
  let linkedBatchCount = 0;
  let finishedOrderCount = 0;
  for (const order of orders) {
    statusMap.set(order.rawStatus, (statusMap.get(order.rawStatus) || 0) + 1);
    if (order.finished) finishedOrderCount += 1;
    const mode = modeMap.get(order.inventoryMode) || { orderCount: 0, batches: [] };
    mode.orderCount += 1;
    mode.batches.push(...order.linkedBatches.batches);
    modeMap.set(order.inventoryMode, mode);
    linkedBatchCount += order.linkedBatches.count;
    for (const item of order.exceptions) {
      exceptionCounts[item.code] = (exceptionCounts[item.code] || 0) + 1;
    }
  }
  const byInventoryMode = (["real", "shadow", "unknown"] as const).map((inventoryMode) => {
    const mode = modeMap.get(inventoryMode) || { orderCount: 0, batches: [] };
    const recipeEvidence = { recipeBacked: 0, legacy: 0, unknown: 0 };
    const materialPosting = { consumed: 0, pending: 0, unknown: 0 };
    for (const batch of mode.batches) {
      recipeEvidence[batch.recipeEvidence === "recipe_backed"
        ? "recipeBacked"
        : batch.recipeEvidence] += 1;
      materialPosting[batch.materialPosting] += 1;
    }
    return {
      inventoryMode,
      orderCount: mode.orderCount,
      linkedBatchCount: mode.batches.length,
      linkedBatchQuantityByUnitAndStatus: quantityGroups(mode.batches),
      recipeEvidence,
      materialPosting,
    };
  });
  const recipeEvidence = { recipeBacked: 0, legacy: 0, unknown: 0 };
  const materialPosting = { consumed: 0, pending: 0, unknown: 0 };
  for (const mode of byInventoryMode) {
    recipeEvidence.recipeBacked += mode.recipeEvidence.recipeBacked;
    recipeEvidence.legacy += mode.recipeEvidence.legacy;
    recipeEvidence.unknown += mode.recipeEvidence.unknown;
    materialPosting.consumed += mode.materialPosting.consumed;
    materialPosting.pending += mode.materialPosting.pending;
    materialPosting.unknown += mode.materialPosting.unknown;
  }
  return {
    // `orders` and `overdueEarlierOrders` are intentionally separate in the
    // response. Keep this primary count aligned with the requested date
    // cohort; the cohort-specific counts make the overdue extension explicit.
    orderCount: dateCohortOrderCount,
    dateCohortOrderCount,
    overdueEarlierOrderCount,
    unfinishedOrderCount: orders.length - finishedOrderCount,
    finishedOrderCount,
    byStatus: [...statusMap.entries()]
      .map(([status, orderCount]) => ({ status, orderCount }))
      .sort((left, right) => left.status.localeCompare(right.status)),
    linkedBatchCount,
    byInventoryMode,
    recipeEvidence,
    materialPosting,
    exceptionCounts,
    countsScope: "returned_rows_only",
  };
}

async function tableExists(tx: WorkplanSqlExecutor, tableName: string): Promise<boolean> {
  const result = await tx.execute(sql`
    SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS exists
  `);
  return booleanValue(asRow(result.rows[0]).exists);
}

async function buildWorkplan(
  tx: WorkplanSqlExecutor,
  kitchenId: string,
  date: string,
  generatedAt: string,
  actualToday: string,
): Promise<CentralKitchenWorkplan> {
  await tx.execute(sql.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"));
  const kitchenResult = await tx.execute(sql`
    SELECT id, name, is_central_kitchen
    FROM branches
    WHERE id = ${kitchenId}
    LIMIT 1
  `);
  const kitchenRow = asRow(kitchenResult.rows[0]);
  if (!kitchenRow.id) throw new CentralKitchenWorkplanError(404, "المطبخ المركزي غير موجود");
  if (!booleanValue(kitchenRow.is_central_kitchen)) {
    throw new CentralKitchenWorkplanError(400, "الفرع المحدد ليس مطبخاً مركزياً");
  }

  const candidateLimit = CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT + 1;
  const candidateResult = await tx.execute(sql`
    WITH date_orders AS (
      SELECT
        cko.id AS order_id,
        cko.order_number,
        cko.order_date::text AS order_date,
        cko.needed_date::text AS needed_date,
        cko.request_branch_id AS request_branch_id,
        cko.central_kitchen_id AS kitchen_id,
        cko.status AS raw_status,
        cko.inventory_mode,
        cko.discrepancy_status,
        'date'::text AS cohort
      FROM central_kitchen_orders cko
      WHERE cko.central_kitchen_id = ${kitchenId}
        AND cko.needed_date = ${date}::date
      ORDER BY cko.needed_date ASC, cko.id ASC
      LIMIT ${candidateLimit}
    ),
    overdue_orders AS (
      SELECT
        cko.id AS order_id,
        cko.order_number,
        cko.order_date::text AS order_date,
        cko.needed_date::text AS needed_date,
        cko.request_branch_id AS request_branch_id,
        cko.central_kitchen_id AS kitchen_id,
        cko.status AS raw_status,
        cko.inventory_mode,
        cko.discrepancy_status,
        'overdue'::text AS cohort
      FROM central_kitchen_orders cko
      WHERE cko.central_kitchen_id = ${kitchenId}
        AND cko.needed_date < ${date}::date
        AND cko.needed_date >= (${date}::date - ${CENTRAL_KITCHEN_WORKPLAN_OVERDUE_LOOKBACK_DAYS}::integer)
        AND cko.status IN ('requested', 'approved', 'prepared', 'dispatched')
      ORDER BY cko.needed_date ASC, cko.id ASC
      LIMIT ${candidateLimit}
    ),
    candidate_orders AS (
      SELECT * FROM date_orders
      UNION ALL
      SELECT * FROM overdue_orders
    )
    SELECT
      c.order_id,
      c.order_number,
      c.order_date,
      c.needed_date,
      c.request_branch_id,
      c.kitchen_id,
      c.raw_status,
      c.inventory_mode,
      c.discrepancy_status,
      c.cohort,
      request_branch.name AS request_branch_name,
      kitchen_branch.name AS kitchen_name,
      item.id AS item_id,
      item.product_id,
      item.warehouse_item_id,
      item.product_name AS item_name,
      item.unit AS item_unit,
      item.requested_quantity,
      item.prepared_quantity,
      item.dispatched_quantity,
      item.received_quantity,
      item.damaged_quantity,
      item.missing_quantity
    FROM candidate_orders c
    INNER JOIN branches request_branch ON request_branch.id = c.request_branch_id
    INNER JOIN branches kitchen_branch
      ON kitchen_branch.id = c.kitchen_id
      AND kitchen_branch.is_central_kitchen = TRUE
    LEFT JOIN central_kitchen_order_items item ON item.order_id = c.order_id
    ORDER BY c.needed_date ASC, c.order_id ASC, item.id ASC NULLS LAST
  `);
  const parsed = orderFromRows(candidateResult.rows);
  const candidateOrders = parsed.orders;
  const dateCandidateLimitReached = parsed.dateCandidateCount > CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT;
  const overdueCandidateLimitReached = parsed.overdueCandidateCount > CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT;

  const retainedOrders = candidateOrders.slice(0, CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT);
  const dateReturnedCount = retainedOrders.filter((order) => order.cohort === "date").length;
  const overdueReturnedCount = retainedOrders.filter((order) => order.cohort === "overdue").length;

  const productIds = [...new Set(retainedOrders.flatMap((order) =>
    order.items.map((item) => item.productId).filter((id): id is number => id !== null)))];
  const approvedProducts = new Set<number>();
  if (productIds.length) {
    const approvedResult = await tx.execute(sql`
      SELECT product_id
      FROM central_kitchen_recipes
      WHERE kitchen_id = ${kitchenId}
        AND status = 'approved'
        AND product_id IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})
      GROUP BY product_id
    `);
    for (const row of approvedResult.rows) approvedProducts.add(integerValue(asRow(row).product_id));
  }
  for (const order of retainedOrders) {
    for (const item of order.items) {
      item.approvedRecipe = item.productId === null ? null : approvedProducts.has(item.productId);
      item.approvedRecipeNote = item.approvedRecipe === false
        ? "الوصفة الحالية غير متوفرة؛ ليس إثبات نقص إنتاج"
        : null;
    }
  }

  const itemToOrder = new Map<number, MutableOrder>();
  for (const order of retainedOrders) {
    for (const item of order.items) itemToOrder.set(item.id, order);
  }
  const batchesByItem = new Map<number, CentralKitchenWorkplanBatch[]>();
  const itemIds = [...itemToOrder.keys()];
  if (itemIds.length) {
    const movementsTableAvailable = await tableExists(tx, "central_kitchen_batch_material_movements");
    const consumedEvidence = movementsTableAvailable
      ? sql`EXISTS (
          SELECT 1 FROM central_kitchen_batch_material_movements movement
          WHERE movement.batch_id = batch.id
        )`
      : sql`FALSE`;
    const batchResult = await tx.execute(sql`
      SELECT
        batch.id,
        batch.central_kitchen_order_item_id AS order_item_id,
        batch.product_id,
        batch.product_name,
        batch.status,
        batch.quantity,
        COALESCE(NULLIF(BTRIM(batch.unit), ''), 'غير محددة') AS unit,
        batch.recipe_backed,
        ${consumedEvidence} AS material_consumed
      FROM daily_production_batches batch
      WHERE batch.central_kitchen_order_item_id IN (${sql.join(itemIds.map((id) => sql`${id}`), sql`, `)})
        AND batch.branch_id = ${kitchenId}
      ORDER BY batch.id ASC
    `);
    for (const raw of batchResult.rows) {
      const row = asRow(raw);
      const itemId = integerValue(row.order_item_id);
      if (!itemToOrder.has(itemId)) continue;
      const recipeBacked = row.recipe_backed === true
        ? true
        : row.recipe_backed === false
          ? false
          : null;
      const recipeEvidence: CentralKitchenWorkplanRecipeEvidence = recipeBacked === true
        ? "recipe_backed"
        : recipeBacked === false
          ? "legacy"
          : "unknown";
      const rawStatus = textValue(row.status, "unknown");
      const materialPosting = recipeEvidence === "recipe_backed"
        ? booleanValue(row.material_consumed)
          ? "consumed"
          // An unfinished recipe-backed batch is an explicit prospective
          // pending state. A finished batch without a movement remains
          // unknown so historical consumption is never inferred as missing.
          : rawStatus === "in_progress"
            ? "pending"
            : "unknown"
        : "unknown";
      const batch: CentralKitchenWorkplanBatch = {
        id: integerValue(row.id),
        orderItemId: itemId,
        productId: nullableInteger(row.product_id),
        productName: textValue(row.product_name, "منتج غير مسمى"),
        rawStatus,
        status: rawStatus,
        quantity: numberValue(row.quantity),
        unit: textValue(row.unit, "غير محددة"),
        finished: rawStatus === "finished",
        recipeBacked,
        recipeEvidence,
        materialPosting,
        materialPostingEvidence: booleanValue(row.material_consumed)
          ? "recorded_movement_present"
          : "no_recorded_movement",
        directLink: `/central-kitchen-orders?orderId=${itemToOrder.get(itemId)!.id}`,
      };
      const itemBatches = batchesByItem.get(itemId) || [];
      itemBatches.push(batch);
      batchesByItem.set(itemId, itemBatches);
    }
  }

  const builtOrders = retainedOrders.map((order) => buildOrder(order, batchesByItem, actualToday));
  const dateOrders = builtOrders.filter((order) => order.cohort === "date");
  const overdueOrders = builtOrders.filter((order) => order.cohort === "overdue");
  const totalCandidateCount = parsed.dateCandidateCount + parsed.overdueCandidateCount;
  const totalRowsTruncated = totalCandidateCount > builtOrders.length;
  return {
    kitchen: {
      id: textValue(kitchenRow.id, kitchenId),
      name: textValue(kitchenRow.name, kitchenId),
    },
    date,
    generatedAt,
    orders: dateOrders,
    overdueEarlierOrders: overdueOrders,
    summary: summaryForOrders(dateOrders, dateOrders.length, overdueOrders.length),
    metadata: {
      scope: "current_central_kitchen_orders",
      snapshotKind: "current_lifecycle_snapshot",
      stateBasis: "current_persisted_state_not_historical_as_of",
      currentState: true,
      historicalAsOf: null,
      excludedSources: ["advanced_production_orders"],
      timezone: "Asia/Riyadh",
      rowLimit: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
      returnedOrderCount: dateOrders.length,
      totalReturnedOrderCount: builtOrders.length,
      totalRowsTruncated,
      dateCohort: {
        candidateRowLimit: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
        candidateRowsReturned: Math.min(parsed.dateCandidateCount, CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT),
        truncated: dateCandidateLimitReached || dateReturnedCount < parsed.dateCandidateCount,
        countComplete: !dateCandidateLimitReached && dateReturnedCount === parsed.dateCandidateCount,
      },
      overdueEarlier: {
        lookbackDays: CENTRAL_KITCHEN_WORKPLAN_OVERDUE_LOOKBACK_DAYS,
        candidateRowLimit: CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT,
        candidateRowsReturned: Math.min(parsed.overdueCandidateCount, CENTRAL_KITCHEN_WORKPLAN_ROW_LIMIT),
        truncated: overdueCandidateLimitReached || overdueReturnedCount < parsed.overdueCandidateCount,
        countComplete: !overdueCandidateLimitReached && overdueReturnedCount === parsed.overdueCandidateCount,
      },
      actualRiyadhToday: actualToday,
      overdueRule: "needed_date_before_riyadh_today_and_order_not_finished",
      futureEarlierOrdersAreNotOverdue: true,
      allocationReadiness: "unknown",
      limitations: {
        reservedStock: "not_reported",
        materialShortages: "not_evaluated",
        completionIsNotReadinessPermission: true,
        readinessPermission: "not_evaluated",
        approvedRecipeIsInformational: true,
        materialPostingIsRecordedEvidenceNotReconciliation: true,
      },
      generatedAt,
    },
  };
}

export async function getCentralKitchenWorkplan(
  req: Request,
  kitchenId: string,
  date: string,
  dependencies: CentralKitchenWorkplanRouteDependencies = {},
): Promise<CentralKitchenWorkplan> {
  const accessCheck = dependencies.canAccessBranch || canAccessBranch;
  if (!(await accessCheck(req, kitchenId))) {
    throw new CentralKitchenWorkplanError(403, "غير مصرح بالوصول لهذا المطبخ");
  }
  const now = dependencies.now ? dependencies.now() : new Date();
  const generatedAt = now.toISOString();
  const actualToday = actualRiyadhDate(now);
  const database = dependencies.database || (db as unknown as CentralKitchenWorkplanDatabase);
  return database.transaction((transaction) =>
    buildWorkplan(transaction, kitchenId, date, generatedAt, actualToday));
}

export function registerCentralKitchenWorkplanRoute(
  app: Express,
  dependencies: CentralKitchenWorkplanRouteDependencies = {},
): void {
  app.get(
    "/api/central-kitchen-orders/workplan",
    isAuthenticated,
    requirePermission("production", "view"),
    async (req: Request, res: Response) => {
      const parsed = centralKitchenWorkplanQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "معرف المطبخ والتاريخ بصيغة YYYY-MM-DD مطلوبان" });
      }
      res.set("Cache-Control", "no-store");
      const requestNow = dependencies.now ? dependencies.now() : new Date();
      const date = parsed.data.date || actualRiyadhDate(requestNow);
      try {
        const workplan = await getCentralKitchenWorkplan(req, parsed.data.kitchenId, date, {
          ...dependencies,
          now: () => requestNow,
        });
        return res.json(workplan);
      } catch (error) {
        if (error instanceof CentralKitchenWorkplanError) {
          return res.status(error.status).json({ error: error.message });
        }
        throw error;
      }
    },
  );
}