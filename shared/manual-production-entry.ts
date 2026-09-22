/**
 * Guards for the generic daily-production endpoint.
 *
 * Manual entries are deliberately a separate boundary from the central-kitchen
 * production workflow.  Keep these checks on the raw request object: parsing or
 * coercing a value before checking it would allow a caller to smuggle an
 * operational link through the generic endpoint.
 */

export const MANUAL_PRODUCTION_RESERVED_FIELDS = [
  "advancedProductionOrderItemId",
  "advancedIdempotencyKey",
  "advancedPayloadFingerprint",
  "advanced_production_order_item_id",
  "advanced_idempotency_key",
  "advanced_payload_fingerprint",
  "recipeBacked",
  "centralKitchenOrderItemId",
  "centralKitchenIdempotencyKey",
  "centralKitchenPayloadFingerprint",
  "productionOrderId",
  "recipe_backed",
  "central_kitchen_order_item_id",
  "central_kitchen_idempotency_key",
  "central_kitchen_payload_fingerprint",
  "production_order_id",
] as const;

export type ManualProductionReservedField =
  (typeof MANUAL_PRODUCTION_RESERVED_FIELDS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Return the first reserved operational field supplied by the caller.
 *
 * Own-property checks are intentional.  The generic route accepts a JSON
 * object, and inherited properties must not be treated as a client-supplied
 * field.
 */
export function getManualProductionReservedField(
  body: unknown,
): ManualProductionReservedField | undefined {
  if (!isRecord(body)) return undefined;
  return MANUAL_PRODUCTION_RESERVED_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  );
}

/**
 * The acknowledgement is ephemeral intent, not a daily-production column.
 * Do not coerce truthy values: only the literal JSON boolean true is valid.
 */
export function hasIndependentEntryAcknowledgement(body: unknown): boolean {
  return isRecord(body) && body.independentEntryAcknowledged === true;
}

/**
 * Existing operationally-owned batches cannot be edited or deleted through
 * the manual endpoint.  The extra link metadata checks protect historical
 * rows even when a partially-populated legacy row has no current order item.
 */
export function isOperationallyLinkedProductionBatch(batch: unknown): boolean {
  if (!isRecord(batch)) return false;
  return batch.recipeBacked === true
    || batch.advancedProductionOrderItemId != null
    || batch.advancedIdempotencyKey != null
    || batch.advancedPayloadFingerprint != null
    || batch.centralKitchenOrderItemId != null
    || batch.centralKitchenIdempotencyKey != null
    || batch.centralKitchenPayloadFingerprint != null
    || batch.productionOrderId != null;
}