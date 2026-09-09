import { z } from "zod";
import { createHash } from "crypto";

export const CENTRAL_KITCHEN_STATUSES = [
  "requested",
  "approved",
  "prepared",
  "dispatched",
  "received",
] as const;

export type CentralKitchenStatus = (typeof CENTRAL_KITCHEN_STATUSES)[number];

export const CENTRAL_KITCHEN_TRANSITIONS: Readonly<Record<CentralKitchenStatus, CentralKitchenStatus | null>> = {
  requested: "approved",
  approved: "prepared",
  prepared: "dispatched",
  dispatched: "received",
  received: null,
};

export function canTransitionCentralKitchenOrder(
  from: CentralKitchenStatus,
  to: CentralKitchenStatus,
): boolean {
  return CENTRAL_KITCHEN_TRANSITIONS[from] === to;
}

export function isMatchingCentralKitchenReplay(
  event: { eventType: string; toStatus: string; payloadFingerprint?: string | null } | null | undefined,
  expectedEventType: string,
  expectedStatus: CentralKitchenStatus,
  expectedPayloadFingerprint?: string,
): boolean {
  return event?.eventType === expectedEventType
    && event?.toStatus === expectedStatus
    && (!expectedPayloadFingerprint || event.payloadFingerprint === expectedPayloadFingerprint);
}

const trimmedText = (max: number) => z.string().trim().min(1).max(max);
const realCalendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Invalid calendar date");
const neededTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Invalid time");

export const centralKitchenIdempotencyKeySchema = z.string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Invalid idempotency key");

export const createCentralKitchenOrderSchema = z.object({
  requestBranchId: trimmedText(255),
  centralKitchenId: trimmedText(255),
  neededDate: realCalendarDate.optional().nullable(),
  neededTime: neededTime.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: centralKitchenIdempotencyKeySchema.optional(),
  items: z.array(z.object({
    productId: z.number().int().positive().optional().nullable(),
    productName: trimmedText(300),
    requestedQuantity: z.number().finite().positive().max(1_000_000),
    unit: trimmedText(50),
    notes: z.string().trim().max(1000).optional().nullable(),
  }).strict()).min(1).max(500),
}).strict().superRefine((value, ctx) => {
  if (value.requestBranchId === value.centralKitchenId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["centralKitchenId"],
      message: "Request branch and central kitchen must differ",
    });
  }
});

export function createCentralKitchenPayloadFingerprint(
  payload: z.infer<typeof createCentralKitchenOrderSchema>,
): string {
  const canonical = {
    requestBranchId: payload.requestBranchId,
    centralKitchenId: payload.centralKitchenId,
    neededDate: payload.neededDate || null,
    neededTime: payload.neededTime || null,
    notes: payload.notes || null,
    items: payload.items.map((item) => ({
      productId: item.productId || null,
      productName: item.productName,
      requestedQuantity: item.requestedQuantity,
      unit: item.unit,
      notes: item.notes || null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export const centralKitchenTransitionSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: centralKitchenIdempotencyKeySchema.optional(),
}).strict();

export const CENTRAL_KITCHEN_SHORTAGE_REASONS = [
  "unavailable",
  "out_of_stock",
  "production_issue",
  "quality_issue",
  "other",
] as const;

export const centralKitchenPreparationSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: centralKitchenIdempotencyKeySchema.optional(),
  items: z.array(z.object({
    itemId: z.number().int().positive(),
    preparedQuantity: z.number().finite().min(0).max(1_000_000),
    substituteQuantity: z.number().finite().min(0).max(1_000_000).default(0),
    substituteProductId: z.number().int().positive().optional().nullable(),
    substituteProductName: z.string().trim().max(300).optional().nullable(),
    substituteUnit: z.string().trim().max(50).optional().nullable(),
    shortageReason: z.enum(CENTRAL_KITCHEN_SHORTAGE_REASONS).optional().nullable(),
    preparationNotes: z.string().trim().max(1000).optional().nullable(),
  }).strict()).min(1).max(500),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<number>();
  value.items.forEach((item, index) => {
    if (seen.has(item.itemId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", index, "itemId"], message: "Duplicate item" });
    }
    seen.add(item.itemId);
    if (item.substituteQuantity > 0 && (!item.substituteProductName || !item.substituteUnit)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", index], message: "Substitute name and unit are required" });
    }
  });
});

export const centralKitchenDispatchSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: centralKitchenIdempotencyKeySchema.optional(),
  driverName: trimmedText(200),
  vehicleNumber: trimmedText(100),
  items: z.array(z.object({
    itemId: z.number().int().positive(),
    dispatchedQuantity: z.number().finite().min(0).max(1_000_000),
  }).strict()).min(1).max(500),
}).strict();

export const centralKitchenReceiveSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: centralKitchenIdempotencyKeySchema.optional(),
  items: z.array(z.object({
    itemId: z.number().int().positive(),
    receivedQuantity: z.number().finite().min(0).max(1_000_000),
    damagedQuantity: z.number().finite().min(0).max(1_000_000).default(0),
    receivingNotes: z.string().trim().max(1000).optional().nullable(),
  }).strict()).min(1).max(500),
}).strict();

export const centralKitchenResolveDiscrepancySchema = z.object({
  notes: trimmedText(2000),
  idempotencyKey: centralKitchenIdempotencyKeySchema.optional(),
}).strict();

function validateExactItemSet(expectedIds: number[], submittedIds: number[]): string | null {
  if (expectedIds.length !== submittedIds.length || new Set(submittedIds).size !== submittedIds.length) {
    return "يجب تسجيل جميع بنود الطلب مرة واحدة";
  }
  const expected = new Set(expectedIds);
  return submittedIds.every((id) => expected.has(id)) ? null : "بيانات البنود لا تطابق الطلب";
}

export function validateCentralKitchenDispatch(
  preparedItems: Array<{ id: number; preparedQuantity: number; substituteQuantity: number }>,
  dispatchedItems: z.infer<typeof centralKitchenDispatchSchema>["items"],
): string | null {
  const setError = validateExactItemSet(preparedItems.map((item) => item.id), dispatchedItems.map((item) => item.itemId));
  if (setError) return setError;
  const prepared = new Map(preparedItems.map((item) => [item.id, item.preparedQuantity + item.substituteQuantity]));
  for (const item of dispatchedItems) {
    if (item.dispatchedQuantity > (prepared.get(item.itemId) || 0) + 0.000001) {
      return "الكمية المرسلة لا يمكن أن تتجاوز الكمية المجهزة";
    }
  }
  return null;
}

export function validateCentralKitchenReceipt(
  dispatchedItems: Array<{ id: number; dispatchedQuantity: number }>,
  receivedItems: z.infer<typeof centralKitchenReceiveSchema>["items"],
): { error: string | null; hasDiscrepancy: boolean } {
  const setError = validateExactItemSet(dispatchedItems.map((item) => item.id), receivedItems.map((item) => item.itemId));
  if (setError) return { error: setError, hasDiscrepancy: false };
  const dispatched = new Map(dispatchedItems.map((item) => [item.id, item.dispatchedQuantity]));
  let hasDiscrepancy = false;
  for (const item of receivedItems) {
    const sent = dispatched.get(item.itemId) || 0;
    if (item.receivedQuantity + item.damagedQuantity > sent + 0.000001) {
      return { error: "المستلم والتالف لا يمكن أن يتجاوز الكمية المرسلة", hasDiscrepancy: false };
    }
    const missing = Math.max(0, sent - item.receivedQuantity - item.damagedQuantity);
    if ((missing > 0.000001 || item.damagedQuantity > 0.000001) && !item.receivingNotes) {
      return { error: "يجب كتابة ملاحظة عند وجود ناقص أو تالف", hasDiscrepancy: false };
    }
    hasDiscrepancy ||= missing > 0.000001 || item.damagedQuantity > 0.000001;
  }
  return { error: null, hasDiscrepancy };
}

export type CentralKitchenShadowAllocation = {
  component: "original" | "substitute";
  productId: number | null;
  productName: string;
  unit: string;
  quantity: number;
};

export function buildCentralKitchenShadowAllocations(
  direction: "projected_kitchen_out" | "projected_branch_in",
  item: {
    productId: number | null;
    productName: string;
    unit: string;
    preparedQuantity: number;
    substituteQuantity: number;
    substituteProductId: number | null;
    substituteProductName: string | null;
    substituteUnit: string | null;
    dispatchedQuantity: number;
    receivedQuantity: number;
  },
): CentralKitchenShadowAllocation[] {
  const total = direction === "projected_kitchen_out" ? item.dispatchedQuantity : item.receivedQuantity;
  const dispatchedOriginal = Math.min(item.dispatchedQuantity, item.preparedQuantity);
  const originalQuantity = Math.min(total, dispatchedOriginal);
  const substituteQuantity = Math.max(0, total - originalQuantity);
  const allocations: CentralKitchenShadowAllocation[] = [];
  if (originalQuantity > 0.000001) allocations.push({
    component: "original",
    productId: item.productId,
    productName: item.productName,
    unit: item.unit,
    quantity: originalQuantity,
  });
  if (substituteQuantity > 0.000001) allocations.push({
    component: "substitute",
    productId: item.substituteProductId,
    productName: item.substituteProductName || "منتج بديل",
    unit: item.substituteUnit || item.unit,
    quantity: substituteQuantity,
  });
  return allocations;
}

export function validateCentralKitchenPreparation(
  requestedItems: Array<{ id: number; requestedQuantity: number; unit: string }>,
  preparedItems: z.infer<typeof centralKitchenPreparationSchema>["items"],
): string | null {
  if (requestedItems.length !== preparedItems.length) return "يجب تسجيل التجهيز لجميع بنود الطلب";
  const submitted = new Map(preparedItems.map((item) => [item.itemId, item]));
  for (const requested of requestedItems) {
    const prepared = submitted.get(requested.id);
    if (!prepared) return "بيانات بنود التجهيز لا تطابق الطلب";
    const totalReady = prepared.preparedQuantity + prepared.substituteQuantity;
    if (totalReady > requested.requestedQuantity + 0.000001) {
      return "الكمية المجهزة والبديلة لا يمكن أن تتجاوز الكمية المطلوبة";
    }
    if (prepared.substituteQuantity > 0 && prepared.substituteUnit !== requested.unit) {
      return "كمية البديل يجب تسجيلها بنفس وحدة قياس الطلب";
    }
    if (prepared.substituteQuantity === 0 && (
      prepared.substituteProductId
      || prepared.substituteProductName
      || prepared.substituteUnit
    )) {
      return "لا يجوز تسجيل بيانات بديل عندما تكون كمية البديل صفراً";
    }
    if (totalReady < requested.requestedQuantity - 0.000001 && !prepared.shortageReason) {
      return "يجب تحديد سبب النقص لكل بند غير مكتمل";
    }
    if (totalReady >= requested.requestedQuantity - 0.000001 && prepared.shortageReason) {
      return "لا يجوز تسجيل سبب نقص لبند مكتمل";
    }
  }
  return null;
}

export function createCentralKitchenTransitionFingerprint(
  eventType: string,
  payload: z.infer<typeof centralKitchenTransitionSchema>
    | z.infer<typeof centralKitchenPreparationSchema>
    | z.infer<typeof centralKitchenDispatchSchema>
    | z.infer<typeof centralKitchenReceiveSchema>
    | z.infer<typeof centralKitchenResolveDiscrepancySchema>,
): string {
  const topLevel = {
    notes: payload.notes ?? null,
    ...Object.fromEntries(Object.entries(payload)
    .filter(([key]) => key !== "idempotencyKey" && key !== "items" && key !== "notes")
    .map(([key, value]) => [key, value ?? null])),
  };
  const canonical = "items" in payload
    ? {
        ...topLevel,
        items: [...payload.items]
          .sort((left, right) => left.itemId - right.itemId)
          .map((item) => Object.fromEntries(Object.entries(item)
            .filter(([key]) => key !== "idempotencyKey")
            .map(([key, value]) => [key, value ?? null]))),
      }
    : topLevel;
  return createHash("sha256").update(JSON.stringify({ eventType, payload: canonical })).digest("hex");
}

export function saudiDate(now = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}