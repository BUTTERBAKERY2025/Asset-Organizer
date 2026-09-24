/**
 * Product activity was historically stored as text while warehouse activity is
 * boolean.  Treat only an explicit inactive value as unavailable so legacy
 * records with a missing/default value remain usable.
 */
export function isCatalogRecordActive(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (typeof value !== "string") return true;

  return !["false", "inactive", "0", "f", "no"].includes(value.trim().toLowerCase());
}

export function isExplicitCatalogActivityValue(value: unknown): boolean {
  if (value === true || value === false || value === 1 || value === 0) return true;
  if (typeof value !== "string") return false;
  return ["true", "active", "1", "t", "yes", "false", "inactive", "0", "f", "no"]
    .includes(value.trim().toLowerCase());
}

export function isExplicitCatalogActivation(value: unknown): boolean {
  if (!isExplicitCatalogActivityValue(value)) return false;
  return isCatalogRecordActive(value);
}

export type CatalogActivityRecord = { isActive?: unknown };

/**
 * New operational records must point to an existing active catalog record.
 * Historical rows retain their stored reference and must not use this guard.
 */
export function isNewCatalogReferenceAllowed(
  record: CatalogActivityRecord | null | undefined,
): boolean {
  return record !== null && record !== undefined && isCatalogRecordActive(record.isActive);
}

/**
 * Use only for pickers and other new-selection surfaces. It returns a new
 * array and leaves the complete source collection available for history.
 */
export function getSelectableCatalogRecords<T extends CatalogActivityRecord>(
  records: readonly T[],
): T[] {
  return records.filter(record => isCatalogRecordActive(record.isActive));
}

export function isPositiveCatalogPrice(value: unknown): boolean {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

/**
 * POS sales may use a branch-specific override, otherwise the catalogue base
 * price. A zero, missing, or non-finite value is never a valid sale price.
 */
export function getEffectiveSalePrice(
  priceOverride: unknown,
  basePrice: unknown,
): number | null {
  const candidate = priceOverride ?? basePrice;
  return isPositiveCatalogPrice(candidate) ? Number(candidate) : null;
}

export function canReactivatePendingPriceCatalogRecord(
  currentPrice: unknown,
  incomingPrice: unknown,
): boolean {
  return isPositiveCatalogPrice(incomingPrice) || isPositiveCatalogPrice(currentPrice);
}