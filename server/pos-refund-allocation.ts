/**
 * Deterministic, cent-based allocation for POS refunds.
 *
 * Sale-item amounts are stored before an invoice-level discount is applied,
 * while the sale header stores the amount the customer actually paid.  Refund
 * rows must use the latter amount.  This helper allocates the header total and
 * VAT over the original item amounts and then uses cumulative quantities so
 * that a sequence of partial refunds is exactly the same as one full refund.
 */

export interface RefundAllocationSaleItem {
  saleItemId: number;
  quantity: number;
  grossTotal: number;
  grossVat: number;
  refundedQuantity?: number | null;
}

export interface RefundAllocationRequest {
  saleItemId: number;
  quantity: number;
}

export interface RefundAllocationLine {
  saleItemId: number;
  quantity: number;
  totalAmount: number;
  vatAmount: number;
  subtotal: number;
}

export interface PosRefundAllocation {
  items: RefundAllocationLine[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  isFinal: boolean;
}

export interface RefundAllocationInput {
  saleTotal: number;
  saleVat: number;
  saleItems: RefundAllocationSaleItem[];
  requestedItems: RefundAllocationRequest[];
  /**
   * Totals already recorded in pos_refunds.  They are only needed when this
   * request consumes the last quantity: the final request is the authoritative
   * remainder and closes any legacy cent-rounding gap.
   */
  existingRefundTotal?: number;
  existingRefundVat?: number;
}

function toCents(value: number | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

/**
 * Split a number of cents by non-negative integer weights using largest
 * remainder rounding.  The result always sums to `total`.
 */
function allocateCentsByWeights(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (total < 0) {
    throw new Error("لا يمكن توزيع مبلغ استرجاع سالب");
  }

  const normalizedWeights = weights.map((weight) => Math.max(0, Math.round(weight)));
  const weightTotal = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal === 0) {
    const equalWeights = normalizedWeights.map(() => 1);
    return allocateCentsByWeights(total, equalWeights);
  }

  const exact = normalizedWeights.map((weight) => (total * weight) / weightTotal);
  const allocated = exact.map(Math.floor);
  let remainder = total - allocated.reduce((sum, amount) => sum + amount, 0);
  const order = exact
    .map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    allocated[order[index].index] += 1;
    remainder -= 1;
  }
  return allocated;
}

/**
 * Like allocateCentsByWeights, but never allocates more than a line's
 * available cents.  This is used for VAT because an independently rounded VAT
 * delta can otherwise be larger than the total delta for a tiny line.
 */
function allocateCentsWithCaps(total: number, weights: number[], caps: number[]): number[] {
  if (weights.length !== caps.length) {
    throw new Error("تعذر توزيع مبالغ الاسترجاع");
  }
  const normalizedCaps = caps.map((cap) => Math.max(0, Math.round(cap)));
  const capacity = normalizedCaps.reduce((sum, cap) => sum + cap, 0);
  if (total < 0 || total > capacity) {
    throw new Error("ضريبة الاسترجاع تتجاوز إجمالي الاسترجاع");
  }

  const allocated = normalizedCaps.map(() => 0);
  let remaining = total;
  let active = normalizedCaps
    .map((cap, index) => (cap > 0 ? index : -1))
    .filter((index) => index >= 0);

  while (remaining > 0 && active.length > 0) {
    const candidate = allocateCentsByWeights(
      remaining,
      active.map((index) => weights[index]),
    );
    let consumed = 0;
    const nextActive: number[] = [];
    active.forEach((index, candidateIndex) => {
      const room = normalizedCaps[index] - allocated[index];
      const amount = Math.min(room, candidate[candidateIndex]);
      allocated[index] += amount;
      consumed += amount;
      if (allocated[index] < normalizedCaps[index]) nextActive.push(index);
    });
    if (consumed === 0) {
      throw new Error("تعذر توزيع مبالغ الاسترجاع");
    }
    remaining -= consumed;
    active = nextActive;
  }

  if (remaining !== 0) {
    throw new Error("تعذر توزيع مبالغ الاسترجاع");
  }
  return allocated;
}

function cumulativeAmount(fullAmount: number, quantity: number, refundedQuantity: number): number {
  if (quantity <= 0) return 0;
  return Math.round((fullAmount * refundedQuantity) / quantity);
}

function cumulativeUnitAmount(units: number[], quantity: number): number {
  return units.slice(0, quantity).reduce((sum, amount) => sum + amount, 0);
}

/**
 * Allocate a requested POS refund in cents.
 *
 * The full invoice amount is first apportioned to sale items.  Each requested
 * line then receives:
 *
 *   round(full line amount * new cumulative quantity / line quantity)
 *   - round(full line amount * old cumulative quantity / line quantity)
 *
 * This makes repeated requests add up exactly, including quantities whose
 * per-unit amount is a fraction of a cent.
 */
export function allocatePosRefundAmounts(input: RefundAllocationInput): PosRefundAllocation {
  const { saleItems, requestedItems } = input;
  if (saleItems.length === 0) {
    throw new Error("لا توجد أصناف في الفاتورة");
  }

  const requestedIds = new Set<number>();
  for (const requested of requestedItems) {
    if (requestedIds.has(requested.saleItemId)) {
      throw new Error("لا يمكن تكرار الصنف في طلب الاسترجاع");
    }
    requestedIds.add(requested.saleItemId);
  }

  const saleTotalCents = toCents(input.saleTotal);
  const saleVatCents = toCents(input.saleVat);
  if (saleTotalCents < 0 || saleVatCents < 0) {
    throw new Error("إجمالي الفاتورة غير صالح للاسترجاع");
  }

  const normalizedItems = saleItems.map((item) => {
    const quantity = Number(item.quantity);
    const refundedQuantity = item.refundedQuantity == null ? 0 : Number(item.refundedQuantity);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("كمية صنف الفاتورة غير صالحة — يجب أن تكون عدداً صحيحاً موجباً");
    }
    if (!Number.isFinite(refundedQuantity) || !Number.isInteger(refundedQuantity) || refundedQuantity < 0 || refundedQuantity > quantity) {
      throw new Error("كمية صنف الفاتورة غير صالحة");
    }
    return {
      ...item,
      quantity,
      refundedQuantity,
      grossTotalCents: Math.max(0, toCents(item.grossTotal)),
      grossVatCents: Math.max(0, toCents(item.grossVat)),
    };
  }).sort((a, b) => a.saleItemId - b.saleItemId);

  const grossTotalWeights = normalizedItems.map((item) => item.grossTotalCents);
  const totalWeight = grossTotalWeights.reduce((sum, weight) => sum + weight, 0);
  const fallbackQuantityWeights = normalizedItems.map((item) => item.quantity);
  const fullLineTotals = allocateCentsByWeights(
    saleTotalCents,
    totalWeight > 0 ? grossTotalWeights : fallbackQuantityWeights,
  );
  const grossVatWeights = normalizedItems.map((item) => item.grossVatCents);
  const vatWeightTotal = grossVatWeights.reduce((sum, weight) => sum + weight, 0);
  const fullLineVat = allocateCentsWithCaps(
    saleVatCents,
    vatWeightTotal > 0
      ? grossVatWeights
      : totalWeight > 0
        ? grossTotalWeights
        : fallbackQuantityWeights,
    fullLineTotals,
  );
  const lineVatUnits = normalizedItems.map((item, index) => {
    const totalUnits = Array.from({ length: item.quantity }, (_, unitIndex) =>
      cumulativeAmount(fullLineTotals[index], item.quantity, unitIndex + 1) -
      cumulativeAmount(fullLineTotals[index], item.quantity, unitIndex),
    );
    const proportionalVatUnits = Array.from({ length: item.quantity }, (_, unitIndex) =>
      cumulativeAmount(fullLineVat[index], item.quantity, unitIndex + 1) -
      cumulativeAmount(fullLineVat[index], item.quantity, unitIndex),
    );
    const hasNegativeSubtotal = proportionalVatUnits.some(
      (vatAmount, unitIndex) => vatAmount > totalUnits[unitIndex],
    );
    return hasNegativeSubtotal
      ? allocateCentsByWeights(fullLineVat[index], totalUnits)
      : proportionalVatUnits;
  });

  // Keep both allocation and returned line ordering stable even when the
  // database or caller supplies items in a different order.
  const normalizedRequests = [...requestedItems].sort((a, b) => a.saleItemId - b.saleItemId);
  const requested = normalizedRequests.map((requestedItem) => {
    const itemIndex = normalizedItems.findIndex((item) => item.saleItemId === requestedItem.saleItemId);
    const item = normalizedItems[itemIndex];
    if (!item) {
      throw new Error("صنف غير موجود في الفاتورة");
    }

    const requestedQuantity = Number(requestedItem.quantity);
    if (!Number.isFinite(requestedQuantity) || !Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      throw new Error("كمية الاسترجاع غير صالحة — يجب أن تكون عدداً صحيحاً موجباً");
    }
    const remaining = item.quantity - item.refundedQuantity;
    if (requestedQuantity > remaining) {
      throw new Error(`الكمية المطلوب استرجاعها من الصنف أكبر من المتبقي (${remaining})`);
    }

    const oldCumulativeQuantity = item.refundedQuantity;
    const newCumulativeQuantity = oldCumulativeQuantity + requestedQuantity;
    const expectedTotalDelta =
      cumulativeAmount(fullLineTotals[itemIndex], item.quantity, newCumulativeQuantity) -
      cumulativeAmount(fullLineTotals[itemIndex], item.quantity, oldCumulativeQuantity);
    const expectedVatDelta =
      cumulativeUnitAmount(lineVatUnits[itemIndex], newCumulativeQuantity) -
      cumulativeUnitAmount(lineVatUnits[itemIndex], oldCumulativeQuantity);

    return {
      ...requestedItem,
      quantity: requestedQuantity,
      itemIndex,
      expectedTotalDelta,
      expectedVatDelta,
    };
  });

  if (requested.length === 0) {
    throw new Error("لم يتم تحديد أصناف للاسترجاع");
  }

  const isFinal = normalizedItems.every((item) => {
    const requestedItem = requested.find((candidate) => candidate.saleItemId === item.saleItemId);
    return item.refundedQuantity + (requestedItem?.quantity || 0) >= item.quantity;
  });

  let totalDeltas = requested.map((item) => item.expectedTotalDelta);
  let vatDeltas = requested.map((item) => item.expectedVatDelta);

  if (isFinal) {
    // Without ledger totals, the cumulative targets themselves are enough to
    // calculate the remainder.  Callers that have the ledger (the database
    // path does) may provide it to repair an older independently-rounded row.
    const inferredExistingTotalCents = normalizedItems.reduce(
      (sum, item, index) =>
        sum + cumulativeAmount(fullLineTotals[index], item.quantity, item.refundedQuantity),
      0,
    );
    const inferredExistingVatCents = normalizedItems.reduce(
      (sum, item, index) =>
        sum + cumulativeUnitAmount(lineVatUnits[index], item.refundedQuantity),
      0,
    );
    const existingTotalCents =
      input.existingRefundTotal == null
        ? inferredExistingTotalCents
        : toCents(input.existingRefundTotal);
    const existingVatCents =
      input.existingRefundVat == null
        ? inferredExistingVatCents
        : toCents(input.existingRefundVat);
    if (existingTotalCents > saleTotalCents || existingVatCents > saleVatCents) {
      throw new Error("إجمالي الاسترجاعات السابقة يتجاوز إجمالي الفاتورة");
    }

    // The last request closes any discrepancy left by older independently
    // rounded rows.  Distribute that remainder over the lines in this request
    // without changing the invariant that line totals equal header totals.
    const finalTotalRemainder = saleTotalCents - existingTotalCents;
    const finalVatRemainder = saleVatCents - existingVatCents;
    totalDeltas = allocateCentsByWeights(
      finalTotalRemainder,
      totalDeltas.length > 0 ? totalDeltas : requested.map((item) => item.quantity),
    );
    vatDeltas = allocateCentsWithCaps(
      finalVatRemainder,
      vatDeltas.length > 0 ? vatDeltas : totalDeltas,
      totalDeltas,
    );
  }

  const lines = requested.map((requestedItem, index) => ({
    saleItemId: requestedItem.saleItemId,
    quantity: requestedItem.quantity,
    totalAmount: fromCents(totalDeltas[index]),
    vatAmount: fromCents(vatDeltas[index]),
    subtotal: fromCents(totalDeltas[index] - vatDeltas[index]),
  }));
  const totalAmountCents = totalDeltas.reduce((sum, amount) => sum + amount, 0);
  const vatAmountCents = vatDeltas.reduce((sum, amount) => sum + amount, 0);

  return {
    items: lines,
    subtotal: fromCents(totalAmountCents - vatAmountCents),
    vatAmount: fromCents(vatAmountCents),
    totalAmount: fromCents(totalAmountCents),
    isFinal,
  };
}
