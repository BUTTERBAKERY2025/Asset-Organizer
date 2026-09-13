export type PrepareFulfillmentMode = "mixed" | "legacy";

export type PrepareFulfillmentItem = {
  productId?: string | number | null;
  warehouseItemId?: string | number | null;
  requestedQuantity: number;
  preparedQuantity?: number | null;
  preparedFromStock?: number | null;
  preparedFromProduction?: number | null;
  productionFulfillmentEvidence?: unknown;
};

export type ProductionFulfillmentBatch = { batchId: number; quantity: number };
export type ProductionFulfillmentReadiness = {
  eligibleQuantity: number;
  batches: ProductionFulfillmentBatch[];
  [key: string]: unknown;
};
export type ProductionFulfillmentReadinessState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; eligibleQuantity: number };

const QUANTITY_EPSILON = 0.000001;

function finiteQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const quantity = typeof value === "number" ? value : Number(value);
  return Number.isFinite(quantity) ? quantity : null;
}

/**
 * Warehouse, shadow, and legacy/manual lines retain the original prepare
 * contract. Only real catalog products may claim finished linked production.
 */
export function getPrepareFulfillmentMode(
  item: Pick<PrepareFulfillmentItem, "productId" | "warehouseItemId">,
  inventoryMode: string | null | undefined,
): PrepareFulfillmentMode {
  return inventoryMode === "real" && item.productId != null && item.warehouseItemId == null
    ? "mixed"
    : "legacy";
}

/**
 * This stock-first fallback is for editing an old preparedQuantity record.
 * Saved detail rendering never infers a source when split fields are null.
 */
export function getInitialMixedFulfillment(item: PrepareFulfillmentItem): { stock: string; production: string } {
  const requested = Math.max(0, finiteQuantity(item.requestedQuantity) || 0);
  const savedStock = finiteQuantity(item.preparedFromStock);
  const savedProduction = finiteQuantity(item.preparedFromProduction);
  if (savedStock !== null && savedProduction !== null) {
    return { stock: String(savedStock), production: String(savedProduction) };
  }
  const preparedQuantity = finiteQuantity(item.preparedQuantity);
  const existing = Math.max(0, Math.min(requested, preparedQuantity === null ? requested : preparedQuantity));
  return { stock: String(existing), production: "0" };
}

export function validateMixedFulfillmentQuantities(input: {
  requestedQuantity: number;
  stockQuantity: string | number;
  productionQuantity: string | number;
  readiness: ProductionFulfillmentReadinessState;
}): { error: string | null; totalPrepared: number; stockQuantity: number; productionQuantity: number } {
  const requested = finiteQuantity(input.requestedQuantity);
  const stock = finiteQuantity(input.stockQuantity);
  const production = finiteQuantity(input.productionQuantity);
  if (requested === null || requested < 0 || stock === null || production === null || stock < 0 || production < 0) {
    return { error: "أدخل كميات تجهيز صحيحة غير سالبة.", totalPrepared: 0, stockQuantity: stock || 0, productionQuantity: production || 0 };
  }
  const totalPrepared = stock + production;
  if (totalPrepared > requested + QUANTITY_EPSILON) {
    return { error: "إجمالي الجاهز من المخزون والإنتاج لا يمكن أن يتجاوز الكمية المطلوبة.", totalPrepared, stockQuantity: stock, productionQuantity: production };
  }
  // Finished-goods product reservations (including production output) use
  // whole product counts in the server's reserveComponent path.
  if (!Number.isInteger(stock) || !Number.isInteger(production)) {
    return {
      error: "مصدرَا تجهيز المنتج الجاهز يقبلان كميات صحيحة فقط.",
      totalPrepared,
      stockQuantity: stock,
      productionQuantity: production,
    };
  }
  if (production > QUANTITY_EPSILON && input.readiness.status !== "ready") {
    return {
      error: input.readiness.status === "loading"
        ? "انتظر اكتمال التحقق من دفعات الإنتاج قبل تسجيل كمية إنتاج."
        : "تعذر التحقق من دفعات الإنتاج؛ لا يمكن تسجيل كمية إنتاج دون دليل مؤهل.",
      totalPrepared,
      stockQuantity: stock,
      productionQuantity: production,
    };
  }
  if (production > QUANTITY_EPSILON && input.readiness.status === "ready" && production > input.readiness.eligibleQuantity + QUANTITY_EPSILON) {
    return { error: "كمية الإنتاج تتجاوز الكمية المؤهلة من الدفعات المكتملة المرتبطة بالطلب.", totalPrepared, stockQuantity: stock, productionQuantity: production };
  }
  return { error: null, totalPrepared, stockQuantity: stock, productionQuantity: production };
}

export function buildFulfillmentFields(
  mode: PrepareFulfillmentMode,
  stockQuantity: number,
  productionQuantity: number,
): { preparedFromStock?: number; preparedFromProduction?: number } {
  return mode === "mixed" ? { preparedFromStock: stockQuantity, preparedFromProduction: productionQuantity } : {};
}

export type SavedPreparationSource =
  | { kind: "split"; stockQuantity: number; productionQuantity: number; proofBatchIds: string[]; proofLabels: string[] }
  | { kind: "unrecorded"; proofBatchIds: string[]; proofLabels: string[] };

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (typeof entry === "string" && entry.trim()) return [entry.trim()];
    if (typeof entry === "number" && Number.isFinite(entry)) return [String(entry)];
    return [];
  });
}

/**
 * Consume only explicit proof fields. No order id, date, or relationship is
 * guessed from a batch id or from the product itself.
 */
export function getProductionProofSummary(evidence: unknown): { batchIds: string[]; labels: string[] } {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { batchIds: [], labels: [] };
  const value = evidence as Record<string, unknown>;
  const explicitBatches = Array.isArray(value.batches) ? value.batches : [];
  const batchIds = [
    ...stringList(value.frozenProofBatchIds),
    ...stringList(value.proofBatchIds),
    ...stringList(value.batchIds),
    ...explicitBatches.flatMap(batch => {
      if (!batch || typeof batch !== "object" || Array.isArray(batch)) return [];
      return stringList([(batch as Record<string, unknown>).batchId]);
    }),
  ];
  const labels = [
    ...stringList(value.frozenProofBatchLabels),
    ...stringList(value.proofBatchLabels),
    ...stringList(value.batchLabels),
    ...stringList(value.labels),
    ...explicitBatches.flatMap(batch => {
      if (!batch || typeof batch !== "object" || Array.isArray(batch)) return [];
      return stringList([(batch as Record<string, unknown>).label]);
    }),
  ];
  return { batchIds: Array.from(new Set(batchIds)), labels: Array.from(new Set(labels)) };
}

export function getSavedPreparationSource(item: PrepareFulfillmentItem): SavedPreparationSource {
  const stock = finiteQuantity(item.preparedFromStock);
  const production = finiteQuantity(item.preparedFromProduction);
  const proof = getProductionProofSummary(item.productionFulfillmentEvidence);
  if (stock === null || production === null) return { kind: "unrecorded", proofBatchIds: proof.batchIds, proofLabels: proof.labels };
  return { kind: "split", stockQuantity: stock, productionQuantity: production, proofBatchIds: proof.batchIds, proofLabels: proof.labels };
}

export function parseProductionFulfillmentReadiness(payload: unknown): ProductionFulfillmentReadiness {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("استجابة التحقق من الإنتاج غير صالحة.");
  const value = payload as Record<string, unknown>;
  const eligibleQuantity = finiteQuantity(value.eligibleQuantity);
  if (eligibleQuantity === null || eligibleQuantity < 0 || !Array.isArray(value.batches)) throw new Error("استجابة التحقق من الإنتاج لا تحتوي دليلاً مكتملًا.");
  const batches = value.batches.map(batch => {
    if (!batch || typeof batch !== "object" || Array.isArray(batch)) throw new Error("بيانات دفعة الإنتاج غير صالحة.");
    const row = batch as Record<string, unknown>;
    const batchId = finiteQuantity(row.batchId);
    const quantity = finiteQuantity(row.quantity);
    if (batchId === null || !Number.isInteger(batchId) || batchId <= 0 || quantity === null || quantity < 0) throw new Error("بيانات دفعة الإنتاج غير صالحة.");
    return { batchId, quantity };
  });
  return { ...value, eligibleQuantity, batches };
}

export async function fetchProductionFulfillmentReadiness(orderId: string | number, itemId: string | number): Promise<ProductionFulfillmentReadiness> {
  const response = await fetch(
    `/api/central-kitchen-orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/production-fulfillment`,
    { credentials: "include", cache: "no-store" },
  );
  if (!response.ok) {
    let message = "تعذر التحقق من دفعات الإنتاج المكتملة المرتبطة بالطلب.";
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim()) message = body.error;
    } catch {
      // Keep the explicit error when the response is not JSON.
    }
    throw new Error(message);
  }
  return parseProductionFulfillmentReadiness(await response.json());
}