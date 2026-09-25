/** Decimal quantities in the stock tables have six fractional places. */
export const reverseMicros = (value: string | number): bigint =>
  BigInt(Math.round(Number(value) * 1_000_000));

export function reverseQuantityAllowed(requested: bigint, confirmed: bigint, committed: bigint): boolean {
  return requested > BigInt(0) && confirmed >= BigInt(0) && committed >= BigInt(0)
    && requested + committed <= confirmed;
}

export function reverseReceiptAllowed(received: bigint, shipped: bigint): boolean {
  return received >= BigInt(0) && shipped >= BigInt(0) && received <= shipped;
}

export function reverseInspectionAllowed(usable: bigint, damaged: bigint, received: bigint): boolean {
  return usable >= BigInt(0) && damaged >= BigInt(0) && usable + damaged === received;
}

export function reverseWriteoffAllowed(amount: bigint, damaged: bigint, writtenOff: bigint): boolean {
  return amount > BigInt(0) && writtenOff >= BigInt(0) && amount + writtenOff <= damaged;
}

/** Credit only verified source lots, oldest first. No invented production date. */
export function reverseReleaseLots(lots: { quantity: number; productionDate: string }[], usable: number) {
  if (!Number.isInteger(usable) || usable < 0) throw new Error("Whole finished-good quantity required");
  let remaining = usable;
  const credits: { quantity: number; productionDate: string }[] = [];
  for (const lot of lots) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lot.productionDate) || !Number.isInteger(lot.quantity) || lot.quantity < 0)
      throw new Error("Verified production lot required");
    const take = Math.min(remaining,lot.quantity);
    if (take) credits.push({ quantity:take, productionDate:lot.productionDate });
    remaining -= take;
  }
  if (remaining) throw new Error("Original production lot attribution is unavailable");
  return credits;
}

/** JSONB normalizes key ordering. Canonicalize replay payloads before comparing. */
export function reverseCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(reverseCanonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map(k =>
      `${JSON.stringify(k)}:${reverseCanonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}