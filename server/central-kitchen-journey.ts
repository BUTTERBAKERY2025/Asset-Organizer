import type { Express, Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { canAccessBranch, getAllowedBranchIds, isAuthenticated, requirePermission } from "./auth";
import { finishedGoodsInventory, finishedGoodsTransfers } from "@shared/schema";
import type { KitchenOrderJourney, JourneySection } from "@shared/central-kitchen-journey";

type Detail = {
  id: number;
  status: string;
  inventoryMode: string | null;
  requestBranchId: string;
  centralKitchenId: string;
  discrepancyStatus: string;
  items: Array<{ productId: number | null; substituteProductId?: number | null; receivedQuantity: number | null; dispatchedQuantity: number | null; missingQuantity?: number | null }>;
  linkedBatches?: Array<{ id: number; status: string | null }>;
};

// Use the actual module middleware rather than raw permission rows: role templates
// and explicit revocations are enforced there, just as in the delivery API.
function permitted(req: Request, module: string, action: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const response = { status: () => response, json: () => resolve(false) } as unknown as Response;
    Promise.resolve(requirePermission(module, action)(req, response, (error?: unknown) =>
      error ? reject(error) : resolve(true))).catch(reject);
  });
}

export function composeKitchenOrderJourney(
  order: Detail,
  state: Record<"production" | "delivery" | "inventory" | "bar", JourneySection>,
  delivery: KitchenOrderJourney["delivery"],
  context: { lotIds: number[]; handoffIds: number[] },
): KitchenOrderJourney {
  const cancelled = order.status === "cancelled";
  const status = (step: string): KitchenOrderJourney["stages"][number]["status"] => {
    if (cancelled) return "blocked";
    const sequence = ["requested", "approved", "prepared", "dispatched", "received"];
    const position = sequence.indexOf(order.status);
    const target = sequence.indexOf(step);
    return position < 0 ? "unknown" : position >= target ? "complete" : position === target - 1 ? "current" : "pending";
  };
  const warnings: string[] = [];
  if (cancelled) warnings.push("الطلب ملغى؛ لا يُفترض اكتمال أي مرحلة لاحقة.");
  if (order.discrepancyStatus === "open") warnings.push("يوجد فرق استلام مفتوح.");
  if (order.items.some(item => item.receivedQuantity != null && item.dispatchedQuantity != null
    && item.receivedQuantity < item.dispatchedQuantity)) warnings.push("الاستلام جزئي مقارنة بالكمية المرسلة.");
  if (order.items.some(item => (item.missingQuantity ?? 0) > 0)) warnings.push("سُجّلت كمية مفقودة عند الاستلام.");
  if (order.inventoryMode === "shadow") warnings.push("وضع الظل محاكاة فقط، ولا يثبت وجود مخزون فعلي.");
  if (order.inventoryMode == null) warnings.push("وضع المخزون التاريخي غير معروف.");
  if (state.inventory === "available" || state.bar === "available")
    warnings.push("الدفعات وعهدة البار سياق مشترك للفرع والصنف، لا يمكن نسبتهما لهذا الطلب من تطابق الصنف أو التاريخ. استلام البار ليس رصيداً بعد المبيعات والهدر.");
  const names = { production: "الإنتاج", delivery: "التوصيل", inventory: "المخزون", bar: "البار" };
  for (const [section, value] of Object.entries(state)) {
    if (value === "restricted") warnings.push(`بيانات ${names[section as keyof typeof names]} محجوبة حسب الصلاحيات.`);
    if (value === "error") warnings.push(`تعذر تحميل بيانات ${names[section as keyof typeof names]}؛ لا يعني ذلك عدم وجودها.`);
  }
  const sectionState = state;
  const deliveryNames: Record<string, string> = {
    assigned: "تم الإسناد", in_transit: "قيد النقل", awaiting_receipt: "بانتظار الاستلام",
    receipt_approved: "تم اعتماد الاستلام", completed: "مكتمل", failed: "متعثر", cancelled: "ملغى",
  };
  return {
    orderId: order.id,
    stages: [
      { key: "request", label: "الطلب", status: cancelled ? "blocked" : order.status === "requested" ? "current" : "complete", summary: cancelled ? "ملغى" : "مسجل", owner: "الفرع" },
      { key: "production", label: "الإنتاج والتحضير", status: status("prepared"),
        summary: state.production === "restricted" ? "بيانات الإنتاج محجوبة حسب الصلاحيات"
          : (order.linkedBatches?.length ?? 0) ? "توجد دفعات مرتبطة صراحة؛ التغطية تحتاج مراجعة." : "لا توجد دفعات مرتبطة صراحة؛ لا يُستنتج الإنتاج من الصنف.", owner: "المطبخ" },
      { key: "dispatch", label: "الإرسال", status: status("dispatched"), summary: "حالة إرسال الطلب", owner: "المطبخ" },
      { key: "delivery", label: "التوصيل", status: state.delivery === "restricted" || state.delivery === "error" ? "unknown"
        : cancelled ? "blocked" : delivery?.status === "completed" ? "complete" : delivery ? "current" : "unknown",
        summary: state.delivery === "restricted" ? "محجوب حسب الصلاحيات" : state.delivery === "error" ? "تعذر التحميل"
          : delivery ? `حالة مهمة التوصيل: ${deliveryNames[delivery.status] ?? "غير معروفة"}` : "لا توجد مهمة توصيل مسجلة" },
      { key: "receipt", label: "استلام الفرع", status: status("received"),
        summary: order.discrepancyStatus === "open" ? "يوجد فرق استلام مفتوح" : "حالة استلام الطلب", owner: "الفرع" },
      { key: "inventory", label: "مخزون الفرع", status: cancelled ? "blocked" : "unknown",
        summary: order.inventoryMode === "shadow" ? "محاكاة؛ ليس مخزوناً فعلياً"
          : state.inventory === "restricted" ? "محجوب حسب الصلاحيات"
          : state.inventory === "error" ? "تعذر التحميل" : "سياق فرع مشترك؛ لا يثبت رصيد الطلب" },
      { key: "bar", label: "عهدة البار", status: cancelled ? "blocked" : "unknown",
        summary: state.bar === "restricted" ? "محجوب حسب الصلاحيات"
          : state.bar === "error" ? "تعذر التحميل" : "سياق فرع مشترك؛ ليس رصيداً بعد البيع" },
    ],
    delivery: state.delivery === "available" ? delivery : null,
    destinationBranchId: order.requestBranchId,
    inventoryProductIds: order.items.flatMap(item => [item.productId, item.substituteProductId])
      .filter((id): id is number => id != null)
      .filter((id, index, all) => all.indexOf(id) === index),
    inventoryMode: order.inventoryMode,
    warnings,
    sections: { production: state.production === "available", delivery: state.delivery === "available" || state.delivery === "absent",
      inventory: state.inventory === "available" || state.inventory === "absent",
      bar: state.bar === "available" || state.bar === "absent" },
    sectionState,
    ...(state.inventory === "available" || state.bar === "available" ? { sharedBranchContext: {
      lotIds: state.inventory === "available" ? context.lotIds : [],
      handoffIds: state.bar === "available" ? context.handoffIds : [],
    } } : {}),
  };
}

export function registerCentralKitchenJourneyRoute(
  app: Express,
  getDetail: (id: number) => Promise<Detail | null>,
  canAccessOrder: (req: Request, detail: Detail) => Promise<boolean>,
) {
  app.get("/api/central-kitchen-orders/:id/journey", isAuthenticated,
    requirePermission("central_kitchen_orders", "view"), async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      try {
        const id = Number(req.params.id);
        if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id))
          return res.status(400).json({ error: "معرف الطلب غير صالح" });
        const order = await getDetail(id);
        if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
        if (!(await canAccessOrder(req, order))) return res.status(403).json({ error: "غير مصرح بالوصول لهذا الطلب" });

        const state: Record<"production" | "delivery" | "inventory" | "bar", JourneySection> = {
          production: "restricted", delivery: "restricted", inventory: "restricted", bar: "restricted",
        };
        let delivery: KitchenOrderJourney["delivery"] = null;
        const context = { lotIds: [] as number[], handoffIds: [] as number[] };
        // Deliberately do not grant driver access from a kitchen-order view:
        // the delivery endpoint has separate driver identity/assignment checks.
        const allowed = getAllowedBranchIds(req);
        const manager = req.currentUser?.jobTitle !== "delivery"
          && (allowed === null || allowed.includes(order.centralKitchenId))
          && await permitted(req, "central_kitchen_orders", "view")
          && await permitted(req, "delivery_tasks", "view");
        const receiver = req.currentUser?.jobTitle !== "delivery"
          && await canAccessBranch(req, order.requestBranchId)
          && await permitted(req, "central_kitchen_orders", "edit")
          && await permitted(req, "delivery_tasks", "approve");
        if (manager || receiver) {
          try {
            const result = await pool.query(
              `SELECT id, status FROM delivery_assignments WHERE source_type = 'kitchen' AND source_id = $1 ORDER BY id DESC LIMIT 1`, [id]);
            delivery = result.rows[0] ? { id: Number(result.rows[0].id), status: result.rows[0].status } : null;
            state.delivery = delivery ? "available" : "absent";
          } catch { state.delivery = "error"; }
        }
        const branchVisible = await canAccessBranch(req, order.requestBranchId);
        const productionView = branchVisible && await permitted(req, "production", "view");
        state.production = await canAccessBranch(req, order.centralKitchenId)
          && await permitted(req, "production", "view") ? "available" : "restricted";
        const productIds = order.items.flatMap(item => [item.productId, item.substituteProductId])
          .filter((p): p is number => p != null);
        if (productionView && order.inventoryMode === "real" && productIds.length) {
          try {
            const lots = await db.select({ id: finishedGoodsInventory.id })
              .from(finishedGoodsInventory).where(and(eq(finishedGoodsInventory.branchId, order.requestBranchId),
                inArray(finishedGoodsInventory.productId, productIds)));
            context.lotIds = lots.map(lot => lot.id);
            state.inventory = lots.length ? "available" : "absent";
          } catch { state.inventory = "error"; }
        } else if (productionView) state.inventory = "absent";
        if (productionView && order.inventoryMode === "real" && productIds.length) {
          try {
            const handoffs = await db.select({ id: finishedGoodsTransfers.id })
              .from(finishedGoodsTransfers).where(and(eq(finishedGoodsTransfers.sourceBranchId, order.requestBranchId),
                eq(finishedGoodsTransfers.transportPolicy, "internal_bar_receipt"),
                inArray(finishedGoodsTransfers.productId, productIds)));
            context.handoffIds = handoffs.map(row => row.id);
            state.bar = handoffs.length ? "available" : "absent";
          } catch { state.bar = "error"; }
        } else if (productionView) state.bar = "absent";
        return res.json(composeKitchenOrderJourney(order, state, delivery, context));
      } catch (error) {
        console.error("Error fetching central kitchen journey:", error);
        return res.status(500).json({ error: "تعذر تحميل رحلة الطلب" });
      }
    });
}