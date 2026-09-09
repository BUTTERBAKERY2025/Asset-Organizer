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
  event: { eventType: string; toStatus: string } | null | undefined,
  expectedEventType: string,
  expectedStatus: CentralKitchenStatus,
): boolean {
  return event?.eventType === expectedEventType && event?.toStatus === expectedStatus;
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

export function saudiDate(now = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}