import { describe, expect, it } from "vitest";
import { allocatePosRefundAmounts } from "../server/pos-refund-allocation";

describe("POS refund money allocation", () => {
  it("allocates discounted total and VAT to lines, not just the refund header", () => {
    const allocation = allocatePosRefundAmounts({
      saleTotal: 20.7,
      saleVat: 2.7,
      saleItems: [
        {
          saleItemId: 10,
          quantity: 2,
          grossTotal: 23,
          grossVat: 3,
          refundedQuantity: 0,
        },
      ],
      requestedItems: [{ saleItemId: 10, quantity: 1 }],
    });

    expect(allocation.totalAmount).toBe(10.35);
    expect(allocation.vatAmount).toBe(1.35);
    expect(allocation.subtotal).toBe(9);
    expect(allocation.items).toEqual([
      {
        saleItemId: 10,
        quantity: 1,
        totalAmount: 10.35,
        vatAmount: 1.35,
        subtotal: 9,
      },
    ]);
    expect(allocation.items.reduce((sum, line) => sum + line.totalAmount, 0)).toBe(allocation.totalAmount);
    expect(allocation.items.reduce((sum, line) => sum + line.vatAmount, 0)).toBe(allocation.vatAmount);
  });

  it("is invariant to sale-item and request permutations", () => {
    const ordered = allocatePosRefundAmounts({
      saleTotal: 10,
      saleVat: 1.3,
      saleItems: [
        { saleItemId: 1, quantity: 2, grossTotal: 4, grossVat: 0.52 },
        { saleItemId: 2, quantity: 1, grossTotal: 6, grossVat: 0.78 },
      ],
      requestedItems: [
        { saleItemId: 1, quantity: 2 },
        { saleItemId: 2, quantity: 1 },
      ],
    });
    const shuffled = allocatePosRefundAmounts({
      saleTotal: 10,
      saleVat: 1.3,
      saleItems: [
        { saleItemId: 2, quantity: 1, grossTotal: 6, grossVat: 0.78 },
        { saleItemId: 1, quantity: 2, grossTotal: 4, grossVat: 0.52 },
      ],
      requestedItems: [
        { saleItemId: 2, quantity: 1 },
        { saleItemId: 1, quantity: 2 },
      ],
    });

    expect(shuffled).toEqual(ordered);
    expect(ordered.items.map((line) => line.saleItemId)).toEqual([1, 2]);
  });

  it("rejects non-finite, fractional, and non-positive quantities", () => {
    const base = {
      saleTotal: 10,
      saleVat: 1.3,
      saleItems: [{ saleItemId: 14, quantity: 1, grossTotal: 10, grossVat: 1.3 }],
      requestedItems: [{ saleItemId: 14, quantity: 1 }],
    };

    for (const quantity of [NaN, Infinity, 1.5, 0, -1]) {
      expect(() =>
        allocatePosRefundAmounts({
          ...base,
          saleItems: [{ ...base.saleItems[0], quantity }],
        }),
      ).toThrow();
      expect(() =>
        allocatePosRefundAmounts({
          ...base,
          requestedItems: [{ saleItemId: 14, quantity }],
        }),
      ).toThrow();
    }
  });

  it("uses cumulative quantity rounding so repeated refunds equal the original invoice", () => {
    const saleItems = [
      {
        saleItemId: 11,
        quantity: 3,
        grossTotal: 12,
        grossVat: 1.56,
        refundedQuantity: 0,
      },
    ];

    const first = allocatePosRefundAmounts({
      saleTotal: 10,
      saleVat: 1.3,
      saleItems,
      requestedItems: [{ saleItemId: 11, quantity: 1 }],
    });
    const second = allocatePosRefundAmounts({
      saleTotal: 10,
      saleVat: 1.3,
      saleItems: [{ ...saleItems[0], refundedQuantity: 1 }],
      requestedItems: [{ saleItemId: 11, quantity: 1 }],
      existingRefundTotal: first.totalAmount,
      existingRefundVat: first.vatAmount,
    });
    const final = allocatePosRefundAmounts({
      saleTotal: 10,
      saleVat: 1.3,
      saleItems: [{ ...saleItems[0], refundedQuantity: 2 }],
      requestedItems: [{ saleItemId: 11, quantity: 1 }],
      existingRefundTotal: first.totalAmount + second.totalAmount,
      existingRefundVat: first.vatAmount + second.vatAmount,
    });

    expect(first.totalAmount).toBe(3.33);
    expect(second.totalAmount).toBe(3.34);
    expect(final.totalAmount).toBe(3.33);
    expect(first.vatAmount).toBe(0.43);
    expect(second.vatAmount).toBe(0.44);
    expect(final.vatAmount).toBe(0.43);
    expect(final.isFinal).toBe(true);
    expect(first.totalAmount + second.totalAmount + final.totalAmount).toBeCloseTo(10, 2);
    expect(first.vatAmount + second.vatAmount + final.vatAmount).toBeCloseTo(1.3, 2);
  });

  it("closes a legacy ledger remainder on the final request", () => {
    const allocation = allocatePosRefundAmounts({
      saleTotal: 10,
      saleVat: 1.3,
      saleItems: [
        {
          saleItemId: 12,
          quantity: 2,
          grossTotal: 12,
          grossVat: 1.56,
          refundedQuantity: 1,
        },
      ],
      requestedItems: [{ saleItemId: 12, quantity: 1 }],
      // A legacy first refund rounded to 3.32 instead of the allocator's
      // expected 3.33.  The last request must return the actual remainder.
      existingRefundTotal: 3.32,
      existingRefundVat: 0.43,
    });

    expect(allocation.isFinal).toBe(true);
    expect(allocation.totalAmount).toBe(6.68);
    expect(allocation.vatAmount).toBe(0.87);
    expect(allocation.items[0].totalAmount).toBe(allocation.totalAmount);
    expect(allocation.items[0].vatAmount).toBe(allocation.vatAmount);
  });

  it("keeps tiny VAT deltas non-negative while conserving VAT", () => {
    const saleItems = [
      {
        saleItemId: 15,
        quantity: 3,
        grossTotal: 0.03,
        grossVat: 0.01,
        refundedQuantity: 0,
      },
    ];
    const first = allocatePosRefundAmounts({
      saleTotal: 0.02,
      saleVat: 0.01,
      saleItems,
      requestedItems: [{ saleItemId: 15, quantity: 1 }],
    });
    const second = allocatePosRefundAmounts({
      saleTotal: 0.02,
      saleVat: 0.01,
      saleItems: [{ ...saleItems[0], refundedQuantity: 1 }],
      requestedItems: [{ saleItemId: 15, quantity: 1 }],
    });
    const final = allocatePosRefundAmounts({
      saleTotal: 0.02,
      saleVat: 0.01,
      saleItems: [{ ...saleItems[0], refundedQuantity: 2 }],
      requestedItems: [{ saleItemId: 15, quantity: 1 }],
    });
    const refunds = [first, second, final];

    expect(refunds.every((refund) => refund.subtotal >= 0)).toBe(true);
    expect(refunds.every((refund) => refund.vatAmount <= refund.totalAmount)).toBe(true);
    expect(refunds.reduce((sum, refund) => sum + refund.totalAmount, 0)).toBeCloseTo(0.02, 2);
    expect(refunds.reduce((sum, refund) => sum + refund.vatAmount, 0)).toBeCloseTo(0.01, 2);
    expect(first.vatAmount).toBe(0.01);
    expect(second.vatAmount).toBe(0);
    expect(final.vatAmount).toBe(0);
  });

  it("rejects duplicate item ids instead of adding both quantities", () => {
    expect(() =>
      allocatePosRefundAmounts({
        saleTotal: 10,
        saleVat: 1.3,
        saleItems: [
          {
            saleItemId: 13,
            quantity: 2,
            grossTotal: 12,
            grossVat: 1.56,
          },
        ],
        requestedItems: [
          { saleItemId: 13, quantity: 1 },
          { saleItemId: 13, quantity: 1 },
        ],
      }),
    ).toThrow("تكرار");
  });
});
