const SCALE = BigInt(1000000);

export function demandMicros(value: string | number): bigint {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new Error("Quantity must be a non-negative decimal with at most 6 places");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}

export function demandDecimal(value: bigint): string {
  if (value < BigInt(0)) throw new Error("Quantity cannot be negative");
  const whole = value / SCALE;
  const fraction = String(value % SCALE).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export type DemandAccounting = {
  requested: string | number;
  originalGoodReceived: string | number;
  acceptedSubstitute: string | number;
  compensationGoodReceived: string | number;
  waived: string | number;
};

export function calculateDemandRemaining(input: DemandAccounting): string {
  const requested = demandMicros(input.requested);
  const credits = demandMicros(input.originalGoodReceived)
    + demandMicros(input.acceptedSubstitute)
    + demandMicros(input.compensationGoodReceived)
    + demandMicros(input.waived);
  return demandDecimal(credits >= requested ? BigInt(0) : requested - credits);
}

export function cappedCompensationReceipt(allocated: string | number, actuallyReceived: string | number): string {
  const allocation = demandMicros(allocated);
  const receipt = demandMicros(actuallyReceived);
  return demandDecimal(receipt < allocation ? receipt : allocation);
}

export function activeReplacementCommitment(input: {
  allocated: string | number;
  actuallyReceived: string | number;
  status: string;
}): string {
  if (input.status === "cancelled") return "0";
  if (input.status === "received") return cappedCompensationReceipt(input.allocated, input.actuallyReceived);
  return demandDecimal(demandMicros(input.allocated));
}

export function validateReceiptAttribution(input: {
  totalGoodReceived: string | number;
  requested: string | number;
  preparedSubstitute: string | number;
  originalGood: string | number;
  substituteGood: string | number;
}): boolean {
  const original = demandMicros(input.originalGood);
  const substitute = demandMicros(input.substituteGood);
  return original + substitute === demandMicros(input.totalGoodReceived)
    && original <= demandMicros(input.requested)
    && substitute <= demandMicros(input.preparedSubstitute);
}

export function availableDemandAllocation(input: {
  requested: string | number;
  originalGoodReceived: string | number;
  activeAllocated: string | number;
}): string {
  const requested = demandMicros(input.requested);
  const used = demandMicros(input.originalGoodReceived) + demandMicros(input.activeAllocated);
  return demandDecimal(used >= requested ? BigInt(0) : requested - used);
}