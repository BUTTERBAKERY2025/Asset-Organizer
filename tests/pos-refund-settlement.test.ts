/**
 * اختبارات تسوية الاسترجاع في نقطة البيع (Event POS).
 *
 * تغطي:
 *  1. الاسترجاع الكامل لفاتورة دفعها العميل نقداً/شبكة (split) مع اختيار
 *     طريقة الإرجاع، وربط السجل بالوردية وبنود الفاتورة.
 *  2. احتساب إجماليات الوردية وإغلاقها بعد الاسترجاع.
 *  3. استرجاع جزئي يتبعه استرجاع كامل — صافي التسوية = صفر.
 *
 * تعمل على قاعدة بيانات التطوير وتُنظف بياناتها بالكامل بعد كل اختبار.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { sql } from "drizzle-orm";

const BRANCH = "EVENT-BB";
let uid: string;
let refundUid: string;
let pid: number;
let storage: typeof import("../server/storage").storage;
let db: typeof import("../server/db").db;

const createdSaleIds: number[] = [];
const createdShiftIds: number[] = [];
const createdEventIds: number[] = [];

function uuid() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function makeEventAndShift(
  openingCash = 0,
  cashierId = uid,
  cashierName = "اختبار آلي",
) {
  const event = await storage.createPosEvent({
    name: `اختبار تسوية ${uuid()}`,
    branchId: BRANCH,
    startDate: "2001-01-01",
    endDate: "2001-01-01",
    status: "active",
    createdBy: uid,
  } as any);
  createdEventIds.push(event.id);

  const shift = await storage.openPosShift({
    eventId: event.id,
    branchId: BRANCH,
    cashierId,
    cashierName,
    openingCash,
  } as any);
  createdShiftIds.push(shift.id);

  return { event, shift };
}

async function makeShift(
  eventId: number,
  cashierId: string,
  cashierName: string,
  openingCash = 0,
) {
  const shift = await storage.openPosShift({
    eventId,
    branchId: BRANCH,
    cashierId,
    cashierName,
    openingCash,
  } as any);
  createdShiftIds.push(shift.id);
  return shift;
}

async function makeSplitSale(opts: {
  eventId: number;
  shiftId: number;
  total?: number;
  vat?: number;
  subtotal?: number;
  qty?: number;
  cashAmount?: number;
  networkAmount?: number;
}) {
  const total = opts.total ?? 100;
  const vat = opts.vat ?? 15;
  const subtotal = opts.subtotal ?? total - vat;
  const qty = opts.qty ?? 2;
  const cashAmount = opts.cashAmount ?? total / 2;
  const networkAmount = opts.networkAmount ?? total - cashAmount;

  const sale = await storage.createPosSale({
    branchId: BRANCH,
    cashierId: uid,
    cashierName: "اختبار آلي",
    invoiceNumber: "GSETTLE-" + uuid(),
    saleDate: "2001-01-01",
    saleTime: "12:00:00",
    subtotal,
    vatAmount: vat,
    totalAmount: total,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    paymentMethod: "split",
    cashAmount,
    networkAmount,
    amountPaid: total,
    changeAmount: 0,
    status: "completed",
    eventId: opts.eventId,
    shiftId: opts.shiftId,
    idempotencyKey: null,
  } as any, [
    {
      productId: pid,
      productName: "صنف اختبار التسوية",
      quantity: qty,
      unitPrice: total / qty,
      vatRate: 0.15,
      vatAmount: vat,
      totalPrice: total,
    } as any,
  ]);
  createdSaleIds.push(sale.id);
  return sale;
}

beforeAll(async () => {
  // حارس أمان قبل أي dynamic import: لا تستخدم الاختبارات اتصال Supabase
  // الاحتياطي الموجود في server/db.ts ولا تعمل على بيئة الإنتاج.
  const dbUrl = process.env.DATABASE_URL || "";
  const useSupabase = process.env.USE_SUPABASE === "true";
  let testDbHost = "";
  try {
    const parsed = new URL(dbUrl);
    testDbHost = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    // تُرفض القيمة غير الصالحة أدناه.
  }
  const isLocalOrReplitTestHost =
    /^(localhost|127(?:\.\d+){3}|0\.0\.0\.0|::1|helium)$/i.test(testDbHost) ||
    /(^|\.)replit\.(?:dev|com)$/i.test(testDbHost);
  if (
    process.env.NODE_ENV === "production" ||
    useSupabase ||
    !dbUrl ||
    !isLocalOrReplitTestHost
  ) {
    throw new Error("رفض التشغيل: يلزم DATABASE_URL محلي/اختباري (وليس Supabase أو الإنتاج)");
  }

  ({ storage } = await import("../server/storage"));
  ({ db } = await import("../server/db"));

  const u: any = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  uid = (u.rows || u)[0].id;
  const otherUser: any = await db.execute(sql`SELECT id FROM users WHERE id <> ${uid} LIMIT 1`);
  refundUid = (otherUser.rows || otherUser)[0]?.id;
  if (!refundUid) throw new Error("يلزم مستخدم ثانٍ لاختبار وردية الكاشير المسترجع");
  const p: any = await db.execute(sql`SELECT id FROM products LIMIT 1`);
  pid = (p.rows || p)[0]?.id;
  if (!pid) throw new Error("لا توجد منتجات في قاعدة بيانات التطوير");
});

afterEach(async () => {
  // تنظيف بالمعرّفات الدقيقة للفواتير والورديات والإيفنتات التي أنشأتها الاختبارات.
  if (createdSaleIds.length > 0) {
    const ids = sql.join(createdSaleIds.map((id) => sql`${id}`), sql`, `);
    await db.execute(sql`DELETE FROM pos_refund_items WHERE refund_id IN (SELECT id FROM pos_refunds WHERE sale_id IN (${ids}))`);
    await db.execute(sql`DELETE FROM pos_refunds WHERE sale_id IN (${ids})`);
    await db.execute(sql`DELETE FROM pos_sales WHERE id IN (${ids})`);
  }

  if (createdShiftIds.length > 0) {
    const ids = sql.join(createdShiftIds.map((id) => sql`${id}`), sql`, `);
    await db.execute(sql`DELETE FROM pos_shifts WHERE id IN (${ids})`);
  }

  if (createdEventIds.length > 0) {
    const ids = sql.join(createdEventIds.map((id) => sql`${id}`), sql`, `);
    await db.execute(sql`DELETE FROM pos_events WHERE id IN (${ids})`);
  }

  createdSaleIds.length = 0;
  createdShiftIds.length = 0;
  createdEventIds.length = 0;
});

describe("الاسترجاع الكامل وتسوية الدفع المنقسم", () => {
  it.each(["cash", "network"] as const)(
    "إرجاع فاتورة split بالكامل بطريقة %s يربط الوردية وبنود الاسترجاع",
    async (refundMethod) => {
      // The cash-return route rejects a negative counted cash amount.  Seed
      // the cash drawer so the selected cash refund has a valid actual total.
      const openingCash = refundMethod === "cash" ? 100 : 0;
      const { shift, event } = await makeEventAndShift(openingCash);
      const sale = await makeSplitSale({ eventId: event.id, shiftId: shift.id });
      const saleItems = await storage.getPosSaleItems(sale.id);

      const result = await storage.refundPosSaleFull({
        saleId: sale.id,
        refundMethod,
        refundedBy: uid,
        refundedByName: "اختبار آلي",
        shiftId: shift.id,
        idempotencyKey: uuid(),
      });

      expect(result.error).toBeFalsy();
      expect(result.sale?.status).toBe("refunded");

      const refunds = await storage.getPosRefundsBySale(sale.id);
      expect(refunds).toHaveLength(1);
      const refund = refunds[0];
      expect(refund).toMatchObject({
        saleId: sale.id,
        eventId: event.id,
        shiftId: shift.id,
        refundMethod,
        totalAmount: 100,
        vatAmount: 15,
        subtotal: 85,
      });
      expect(refund.items).toHaveLength(1);
      expect(refund.items[0]).toMatchObject({
        refundId: refund.id,
        saleItemId: saleItems[0].id,
        productId: pid,
        productName: "صنف اختبار التسوية",
        quantity: 2,
        vatAmount: 15,
        totalPrice: 100,
      });

      const stats = await storage.getPosShiftStats(shift.id);
      expect(stats).toMatchObject({
        salesCount: 1,
        salesTotal: 100,
        cashTotal: 50,
        networkTotal: 50,
        refundsTotal: 100,
        refundsCash: refundMethod === "cash" ? 100 : 0,
        refundsNetwork: refundMethod === "network" ? 100 : 0,
      });

      const expectedCash = openingCash + 50 - (refundMethod === "cash" ? 100 : 0);
      const expectedNetwork = 50 - (refundMethod === "network" ? 100 : 0);
      const closed = await storage.closePosShift(shift.id, {
        actualCash: expectedCash,
        actualNetwork: expectedNetwork,
        closedBy: uid,
      });
      expect(closed?.status).toBe("closed");
      expect(closed?.expectedCash).toBeCloseTo(expectedCash, 2);
      expect(closed?.expectedNetwork).toBeCloseTo(expectedNetwork, 2);
      expect(closed?.actualCash).toBeCloseTo(expectedCash, 2);
      expect(closed?.actualNetwork).toBeCloseTo(expectedNetwork, 2);
      expect(closed?.cashDiscrepancy).toBeCloseTo(0, 2);
    },
  );
});

describe("إسناد الاسترجاع إلى وردية الكاشير الصحيحة", () => {
  it("shiftId=null يترك الاسترجاع خارج وردية البيع الأصلية", async () => {
    const { shift, event } = await makeEventAndShift(0);
    const sale = await makeSplitSale({ eventId: event.id, shiftId: shift.id });

    const result = await storage.refundPosSaleFull({
      saleId: sale.id,
      refundMethod: "cash",
      refundedBy: uid,
      refundedByName: "اختبار آلي",
      shiftId: null,
      idempotencyKey: uuid(),
    });
    expect(result.error).toBeFalsy();
    expect(result.sale?.status).toBe("refunded");

    const refunds = await storage.getPosRefundsBySale(sale.id);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].shiftId).toBeNull();
    expect((await storage.getPosSaleById(sale.id))?.shiftId).toBe(shift.id);

    const originatingStats = await storage.getPosShiftStats(shift.id);
    expect(originatingStats).toMatchObject({
      salesCount: 1,
      salesTotal: 100,
      cashTotal: 50,
      networkTotal: 50,
      refundsTotal: 0,
      refundsCash: 0,
      refundsNetwork: 0,
    });
    const closed = await storage.closePosShift(shift.id, {
      actualCash: 50,
      actualNetwork: 50,
      closedBy: uid,
    });
    expect(closed?.expectedCash).toBeCloseTo(50, 2);
    expect(closed?.expectedNetwork).toBeCloseTo(50, 2);
  });

  it("بدون shiftId يربط الاسترجاع بورديّة الكاشير المسترجع لا وردية البيع", async () => {
    const { shift: saleShift, event } = await makeEventAndShift(0);
    // This is a different cashier's open shift on the same event.  Omitting
    // shiftId must resolve this shift from refundedBy.
    const refundShift = await makeShift(event.id, refundUid, "كاشير استرجاع", 100);
    const sale = await makeSplitSale({ eventId: event.id, shiftId: saleShift.id });

    const result = await storage.refundPosSaleFull({
      saleId: sale.id,
      refundMethod: "cash",
      refundedBy: refundUid,
      refundedByName: "كاشير استرجاع",
      idempotencyKey: uuid(),
    });
    expect(result.error).toBeFalsy();
    expect(result.sale?.status).toBe("refunded");

    const refunds = await storage.getPosRefundsBySale(sale.id);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].shiftId).toBe(refundShift.id);
    expect((await storage.getPosSaleById(sale.id))?.shiftId).toBe(saleShift.id);

    const originatingStats = await storage.getPosShiftStats(saleShift.id);
    expect(originatingStats).toMatchObject({
      salesCount: 1,
      salesTotal: 100,
      refundsTotal: 0,
    });
    const refundStats = await storage.getPosShiftStats(refundShift.id);
    expect(refundStats).toMatchObject({
      salesCount: 0,
      salesTotal: 0,
      refundsTotal: 100,
      refundsCash: 100,
      refundsNetwork: 0,
    });

    const closedSaleShift = await storage.closePosShift(saleShift.id, {
      actualCash: 50,
      actualNetwork: 50,
      closedBy: uid,
    });
    expect(closedSaleShift?.expectedCash).toBeCloseTo(50, 2);
    expect(closedSaleShift?.expectedNetwork).toBeCloseTo(50, 2);
    const closedRefundShift = await storage.closePosShift(refundShift.id, {
      actualCash: 0,
      actualNetwork: 0,
      closedBy: refundUid,
    });
    expect(closedRefundShift?.expectedCash).toBeCloseTo(0, 2);
    expect(closedRefundShift?.expectedNetwork).toBeCloseTo(0, 2);
  });
});

describe("الاسترجاع الجزئي ثم الكامل", () => {
  it("استرجاع نصف split نقداً ثم الباقي شبكة يجعل صافي الوردية صفراً", async () => {
    const { shift, event } = await makeEventAndShift(0);
    const sale = await makeSplitSale({ eventId: event.id, shiftId: shift.id });
    const saleItems = await storage.getPosSaleItems(sale.id);

    const partial = await storage.createPosPartialRefund({
      saleId: sale.id,
      items: [{ saleItemId: saleItems[0].id, quantity: 1 }],
      refundMethod: "cash",
      refundedBy: uid,
      refundedByName: "اختبار آلي",
      shiftId: shift.id,
      idempotencyKey: uuid(),
    });
    expect(partial.error).toBeFalsy();
    expect(partial.refund).toMatchObject({
      saleId: sale.id,
      eventId: event.id,
      shiftId: shift.id,
      refundMethod: "cash",
      totalAmount: 50,
    });

    const full = await storage.refundPosSaleFull({
      saleId: sale.id,
      refundMethod: "network",
      refundedBy: uid,
      refundedByName: "اختبار آلي",
      shiftId: shift.id,
      idempotencyKey: uuid(),
    });
    expect(full.error).toBeFalsy();
    expect(full.sale?.status).toBe("refunded");

    const refunds = await storage.getPosRefundsBySale(sale.id);
    expect(refunds).toHaveLength(2);
    expect(refunds.reduce((sum, refund) => sum + refund.totalAmount, 0)).toBeCloseTo(100, 2);
    for (const refund of refunds) {
      expect(refund.shiftId).toBe(shift.id);
      expect(refund.items).toHaveLength(1);
      expect(refund.items[0]).toMatchObject({
        saleItemId: saleItems[0].id,
        quantity: 1,
        totalPrice: 50,
      });
    }
    expect(refunds.some((refund) => refund.refundMethod === "cash" && refund.totalAmount === 50)).toBe(true);
    expect(refunds.some((refund) => refund.refundMethod === "network" && refund.totalAmount === 50)).toBe(true);

    const stats = await storage.getPosShiftStats(shift.id);
    expect(stats).toMatchObject({
      salesCount: 1,
      salesTotal: 100,
      cashTotal: 50,
      networkTotal: 50,
      refundsTotal: 100,
      refundsCash: 50,
      refundsNetwork: 50,
    });
    expect(stats.salesTotal - stats.refundsTotal).toBeCloseTo(0, 2);

    const closed = await storage.closePosShift(shift.id, {
      actualCash: 0,
      actualNetwork: 0,
      closedBy: uid,
    });
    expect(closed?.status).toBe("closed");
    expect(closed?.expectedCash).toBeCloseTo(0, 2);
    expect(closed?.expectedNetwork).toBeCloseTo(0, 2);
    expect(closed?.salesTotal).toBeCloseTo(100, 2);
    expect(closed?.refundsTotal).toBeCloseTo(100, 2);
  });
});