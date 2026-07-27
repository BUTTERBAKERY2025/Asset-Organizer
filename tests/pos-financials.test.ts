/**
 * اختبارات حراسة الحسابات المالية لنقطة البيع (Event POS)
 *
 * تغطي:
 *  1. منع تكرار الفواتير عند إعادة المحاولة (idempotency) — بما فيها طلبان متزامنان
 *  2. منع تكرار الاسترجاعات (جزئي/كامل) بنفس المفتاح — بما فيها السباق المتزامن
 *  3. الضريبة التناسبية للاسترجاع الجزئي على فاتورة مخصومة
 *  4. الاسترجاع الكامل عبر السجل الموحد: صافي التقارير = صفر
 *  5. الفواتير المسترجعة القديمة (بدون سجل) لا تدخل الإجماليات مرتين
 *
 * تعمل على قاعدة بيانات التطوير وتُنظف بياناتها بالكامل بعد كل اختبار.
 * التشغيل: npm run test:pos
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const BRANCH = "EVENT-BB";
let uid: string;
let pid: number;
const createdSaleIds: number[] = [];

function uuid() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function makeSale(opts: {
  total: number; vat: number; subtotal: number;
  discountAmount?: number; discountType?: string; discountValue?: number;
  qty?: number; lineTotal?: number; lineVat?: number;
  status?: string; idempotencyKey?: string | null;
}) {
  const sale = await storage.createPosSale({
    branchId: BRANCH, cashierId: uid, cashierName: "اختبار آلي",
    invoiceNumber: "GTEST-" + uuid(),
    saleDate: "2001-01-01", saleTime: "12:00:00",
    subtotal: opts.subtotal, vatAmount: opts.vat, totalAmount: opts.total,
    discountType: opts.discountType ?? null,
    discountValue: opts.discountValue ?? 0,
    discountAmount: opts.discountAmount ?? 0,
    paymentMethod: "cash", amountPaid: opts.total, changeAmount: 0,
    status: opts.status ?? "completed",
    idempotencyKey: opts.idempotencyKey ?? null,
  } as any, [
    {
      productId: pid, productName: "صنف اختبار",
      quantity: opts.qty ?? 1,
      unitPrice: (opts.lineTotal ?? opts.total) / (opts.qty ?? 1),
      vatRate: 0.15,
      vatAmount: opts.lineVat ?? opts.vat,
      totalPrice: opts.lineTotal ?? opts.total,
    } as any,
  ]);
  createdSaleIds.push(sale.id);
  return sale;
}

beforeAll(async () => {
  // حارس أمان: هذه الاختبارات تكتب وتحذف بيانات — ممنوع تشغيلها على قاعدة الإنتاج
  const dbUrl = process.env.DATABASE_URL || "";
  if (process.env.NODE_ENV === "production" || /supabase|pooler\.supabase|render\.com/i.test(dbUrl)) {
    throw new Error("رفض التشغيل: يبدو أن الاتصال موجه لقاعدة بيانات الإنتاج");
  }
  const u: any = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  uid = (u.rows || u)[0].id;
  const p: any = await db.execute(sql`SELECT id FROM products LIMIT 1`);
  pid = (p.rows || p)[0]?.id;
  if (!pid) throw new Error("لا توجد منتجات في قاعدة بيانات التطوير");
});

afterEach(async () => {
  // تنظيف بالمعرّفات الدقيقة للفواتير التي أنشأتها الاختبارات فقط
  if (createdSaleIds.length > 0) {
    const ids = sql.join(createdSaleIds.map((id) => sql`${id}`), sql`, `);
    await db.execute(sql`DELETE FROM pos_refund_items WHERE refund_id IN (SELECT id FROM pos_refunds WHERE sale_id IN (${ids}))`);
    await db.execute(sql`DELETE FROM pos_refunds WHERE sale_id IN (${ids})`);
    await db.execute(sql`DELETE FROM pos_sales WHERE id IN (${ids})`);
  }
  createdSaleIds.length = 0;
});

describe("منع تكرار الفواتير (idempotency)", () => {
  it("نفس المفتاح لا يُدرج مرتين — الفهرس الفريد يمنع التكرار", async () => {
    const key = uuid();
    await makeSale({ total: 23, vat: 3, subtotal: 20, idempotencyKey: key });
    const existing = await storage.getPosSaleByIdempotencyKey(BRANCH, key);
    expect(existing).toBeTruthy();
    // إدراج ثانٍ بنفس المفتاح يجب أن يفشل على مستوى القاعدة
    await expect(makeSale({ total: 23, vat: 3, subtotal: 20, idempotencyKey: key })).rejects.toThrow();
  });

  it("البحث بالمفتاح يعيد الفاتورة الأصلية (مسار إعادة المحاولة في الراوت)", async () => {
    const key = uuid();
    const sale = await makeSale({ total: 46, vat: 6, subtotal: 40, idempotencyKey: key });
    const found = await storage.getPosSaleByIdempotencyKey(BRANCH, key);
    expect(found?.id).toBe(sale.id);
    expect(found?.totalAmount).toBe(46);
  });
});

describe("منع تكرار الاسترجاعات", () => {
  it("استرجاعان متتاليان بنفس المفتاح يعيدان نفس السطر", async () => {
    const sale = await makeSale({ total: 23, vat: 3, subtotal: 20, qty: 2, lineTotal: 23, lineVat: 3 });
    const items = await storage.getPosSaleItems(sale.id);
    const key = uuid();
    const r1 = await storage.createPosPartialRefund({ saleId: sale.id, items: [{ saleItemId: items[0].id, quantity: 1 }], refundMethod: "cash", refundedBy: uid, idempotencyKey: key });
    const r2 = await storage.createPosPartialRefund({ saleId: sale.id, items: [{ saleItemId: items[0].id, quantity: 1 }], refundMethod: "cash", refundedBy: uid, idempotencyKey: key });
    expect(r1.refund?.id).toBeTruthy();
    expect(r2.refund?.id).toBe(r1.refund?.id);
    const refunds = await storage.getPosRefundsBySale(sale.id);
    expect(refunds.length).toBe(1);
  });

  it("طلبان متزامنان بنفس المفتاح (يفرغان الفاتورة) → عملية واحدة ونفس السطر", async () => {
    const sale = await makeSale({ total: 23, vat: 3, subtotal: 20, qty: 1, lineTotal: 23, lineVat: 3 });
    const items = await storage.getPosSaleItems(sale.id);
    const key = uuid();
    const [a, b] = await Promise.all([
      storage.createPosPartialRefund({ saleId: sale.id, items: [{ saleItemId: items[0].id, quantity: 1 }], refundMethod: "cash", refundedBy: uid, idempotencyKey: key }),
      storage.createPosPartialRefund({ saleId: sale.id, items: [{ saleItemId: items[0].id, quantity: 1 }], refundMethod: "cash", refundedBy: uid, idempotencyKey: key }),
    ]);
    expect(a.error).toBeFalsy();
    expect(b.error).toBeFalsy();
    expect(a.refund?.id).toBe(b.refund?.id);
    const refunds = await storage.getPosRefundsBySale(sale.id);
    expect(refunds.length).toBe(1);
  });

  it("إعادة استرجاع كامل بنفس المفتاح بعد نجاح سابق تعود بنجاح دون تكرار", async () => {
    const sale = await makeSale({ total: 23, vat: 3, subtotal: 20, qty: 1, lineTotal: 23, lineVat: 3 });
    const key = uuid();
    const f1 = await storage.refundPosSaleFull({ saleId: sale.id, refundMethod: "cash", refundedBy: uid, idempotencyKey: key });
    const f2 = await storage.refundPosSaleFull({ saleId: sale.id, refundMethod: "cash", refundedBy: uid, idempotencyKey: key });
    expect(f1.sale?.status).toBe("refunded");
    expect(f2.error).toBeFalsy();
    expect(f2.sale?.status).toBe("refunded");
    const refunds = await storage.getPosRefundsBySale(sale.id);
    expect(refunds.length).toBe(1);
    expect(refunds[0].totalAmount).toBeCloseTo(23, 2);
  });
});

describe("الضريبة التناسبية للاسترجاع الجزئي مع الخصم", () => {
  it("فاتورة بخصم 10%: استرجاع قطعة من قطعتين → المبلغ والضريبة مخفَّضان بنسبة الخصم", async () => {
    // قطعتان × 11.5 (شامل) = 23، ضريبة 3 — بعد خصم 10%: إجمالي 20.7، ضريبة 2.7
    const sale = await makeSale({
      total: 20.7, vat: 2.7, subtotal: 18,
      discountType: "percentage", discountValue: 10, discountAmount: 2.3,
      qty: 2, lineTotal: 23, lineVat: 3,
    });
    const items = await storage.getPosSaleItems(sale.id);
    const r = await storage.createPosPartialRefund({ saleId: sale.id, items: [{ saleItemId: items[0].id, quantity: 1 }], refundMethod: "cash", refundedBy: uid, idempotencyKey: uuid() });
    expect(r.error).toBeFalsy();
    expect(r.refund?.totalAmount).toBeCloseTo(10.35, 2); // 11.5 × 0.9
    expect(r.refund?.vatAmount).toBeCloseTo(1.35, 2);    // 1.5 × 0.9
    expect(r.refund?.subtotal).toBeCloseTo(9.0, 2);      // الإجمالي - الضريبة
  });
});

describe("صافي التقارير بعد الاسترجاع الكامل عبر السجل", () => {
  it("بيع ثم استرجاع كامل → أثر الفاتورة على ملخص اليوم = صفر", async () => {
    const before = await storage.getPosSalesSummary(BRANCH, "2001-01-01");
    const sale = await makeSale({ total: 23, vat: 3, subtotal: 20, qty: 1, lineTotal: 23, lineVat: 3 });
    await storage.refundPosSaleFull({ saleId: sale.id, refundMethod: "cash", refundedBy: uid, idempotencyKey: uuid() });
    const after = await storage.getPosSalesSummary(BRANCH, "2001-01-01");
    expect(after.totalSales - before.totalSales).toBeCloseTo(0, 2);
    expect(after.cashTotal - before.cashTotal).toBeCloseTo(0, 2);
  });

  it("استرجاع جزئي → الملخص ينقص بمبلغ الاسترجاع فقط", async () => {
    const before = await storage.getPosSalesSummary(BRANCH, "2001-01-01");
    const sale = await makeSale({ total: 23, vat: 3, subtotal: 20, qty: 2, lineTotal: 23, lineVat: 3 });
    const items = await storage.getPosSaleItems(sale.id);
    await storage.createPosPartialRefund({ saleId: sale.id, items: [{ saleItemId: items[0].id, quantity: 1 }], refundMethod: "cash", refundedBy: uid, idempotencyKey: uuid() });
    const after = await storage.getPosSalesSummary(BRANCH, "2001-01-01");
    expect(after.totalSales - before.totalSales).toBeCloseTo(11.5, 2); // 23 - 11.5
  });
});

describe("الفواتير المسترجعة القديمة (قبل السجل الموحد)", () => {
  it("فاتورة بحالة refunded بدون أي سطر سجل لا تدخل الإجماليات إطلاقاً", async () => {
    const before = await storage.getPosSalesSummary(BRANCH, "2001-01-01");
    // فاتورة قديمة: مسترجعة بقلب الحالة فقط (النموذج القديم)
    await makeSale({ total: 99, vat: 12.91, subtotal: 86.09, status: "refunded" });
    const after = await storage.getPosSalesSummary(BRANCH, "2001-01-01");
    expect(after.totalSales - before.totalSales).toBeCloseTo(0, 2);
    expect(after.cashTotal - before.cashTotal).toBeCloseTo(0, 2);
  });
});
