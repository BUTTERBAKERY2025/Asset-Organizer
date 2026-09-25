import { z } from "zod";

export const shippingKey = z.string().min(8).max(128).regex(/^[\w.:-]+$/);
export const shippingId = z.coerce.number().int().positive();
export const shippingQuantity = z.number().int().positive().max(1000000);
export const shippingCreate = z.object({
  stockId: shippingId,
  warehouseId: shippingId,
  quantity: shippingQuantity,
  idempotencyKey: shippingKey,
  notes: z.string().trim().max(2000).optional(),
}).strict();
export const shippingAction = z.object({
  idempotencyKey: shippingKey,
  carrierName: z.string().trim().min(1).max(200).optional(),
  vehicleNumber: z.string().trim().max(100).optional(),
  receivedQuantity: z.number().int().min(0).max(1000000).optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

export function allocateReceivedLots<T extends { quantity: number }>(lots: T[], received: number): (T & { credited: number })[] {
  if (!Number.isSafeInteger(received) || received < 0 || received > lots.reduce((sum, lot) => sum + lot.quantity, 0))
    throw new Error("Invalid receipt quantity");
  let left = received;
  return lots.map(lot => {
    const credited = Math.min(left, lot.quantity);
    left -= credited;
    return { ...lot, credited };
  });
}