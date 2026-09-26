import type { Express } from "express";
import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated, requirePermission, canAccessBranch } from "./auth";
import {
  branchBarStock, branchBarHandoffEvents, displayBarReceipts,
  finishedGoodsInventory, finishedGoodsTransfers, productionInventoryLogs,
} from "@shared/schema";

const keyValid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const whole = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
class HandoffError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new HandoffError(status, message); };
const note = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 1000) : "";

export function registerBranchBarHandoffRoutes(app: Express) {
  app.get("/api/branch-bar-handoffs", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const branchId = req.query.branchId;
      if (typeof branchId !== "string" || !branchId || !(await canAccessBranch(req, branchId)))
        return res.status(403).json({ error: "غير مصرح بعرض عهدة الفرع" });
      const handoffs = await db.select().from(finishedGoodsTransfers).where(and(
        eq(finishedGoodsTransfers.sourceBranchId, branchId),
        eq(finishedGoodsTransfers.transportPolicy, "internal_bar_receipt"),
      )).orderBy(desc(finishedGoodsTransfers.createdAt));
      const balances = await db.select().from(branchBarStock).where(eq(branchBarStock.branchId, branchId));
      return res.json({ handoffs, balances });
    } catch (error) {
      console.error("Branch bar handoffs read:", error);
      return res.status(500).json({ error: "تعذر تحميل عهدة البار" });
    }
  });

  app.post("/api/branch-bar-handoffs", isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const { inventoryId, quantity, idempotencyKey } = req.body || {};
      if (!whole(inventoryId) || inventoryId < 1 || !whole(quantity) || quantity < 1 || !keyValid(idempotencyKey))
        return res.status(400).json({ error: "بيانات التسليم أو مفتاح إعادة المحاولة غير صالحة" });
      const actor = req.currentUser!;
      const result = await db.transaction(async tx => {
        // Serialize identical retries before reserving any inventory.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`);
        const [previous] = await tx.select().from(finishedGoodsTransfers)
          .where(eq(finishedGoodsTransfers.requestKey, idempotencyKey)).limit(1);
        if (previous) {
          if (previous.inventoryId !== inventoryId || previous.quantity !== quantity ||
              previous.createdBy !== actor.id || note(previous.notes) !== note(req.body.notes))
            fail(409, "مفتاح العملية مستخدم لطلب مختلف");
          if (!(await canAccessBranch(req, previous.sourceBranchId))) fail(403, "غير مصرح بهذا الفرع");
          return previous;
        }
        const [lot] = await tx.select().from(finishedGoodsInventory)
          .where(eq(finishedGoodsInventory.id, inventoryId)).for("update");
        if (!lot) fail(404, "دفعة المخزون غير موجودة");
        if (!(await canAccessBranch(req, lot.branchId))) fail(403, "غير مصرح بمخزون الفرع");
        if (!lot.productId) fail(409, "لا يمكن تسليم منتج دون هوية كتالوج مؤكدة");
        const [updated] = await tx.update(finishedGoodsInventory)
          .set({ reservedQuantity: sql`${finishedGoodsInventory.reservedQuantity} + ${quantity}` })
          .where(and(eq(finishedGoodsInventory.id, inventoryId),
            sql`${finishedGoodsInventory.quantity} - ${finishedGoodsInventory.reservedQuantity} >= ${quantity}`,
            sql`EXISTS (SELECT 1 FROM products catalog WHERE catalog.id = ${lot.productId}
              AND (catalog.operations_enabled = true OR COALESCE(lower(trim(catalog.is_active::text)), 'true') NOT IN ('false','inactive','0','f','no')))`))
          .returning();
        if (!updated) fail(409, "الكمية المتاحة غير كافية أو المنتج مؤرشف");
        const [handoff] = await tx.insert(finishedGoodsTransfers).values({
          inventoryId, sourceBranchId: lot.branchId, destinationType: "display_bar",
          destinationBranchId: lot.branchId, productId: lot.productId,
          productName: lot.productName, productCategory: lot.productCategory,
          quantity, unit: lot.unit, productionDate: lot.productionDate,
          transferDate: new Date().toISOString().slice(0, 10),
          transportPolicy: "internal_bar_receipt", status: "pending",
          notes: note(req.body.notes) || null, requestKey: idempotencyKey,
          createdBy: actor.id, createdByName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.username,
        }).returning();
        await tx.insert(branchBarHandoffEvents).values({ transferId: handoff.id, action: "request", actorId: actor.id, payload: { quantity, inventoryId } });
        return handoff;
      });
      return res.status(201).json(result);
    } catch (e) {
      console.error("Branch bar request:", e);
      return res.status(e instanceof HandoffError ? e.status : 500).json({
        error: e instanceof HandoffError ? e.message : "تعذر إنشاء التسليم",
      });
    }
  });

  app.post("/api/branch-bar-handoffs/:id/:action", isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const transferId = Number(req.params.id);
      const action = req.params.action;
      const key = req.body?.idempotencyKey;
      if (!Number.isSafeInteger(transferId) || transferId < 1 ||
          !["dispatch", "receive", "cancel"].includes(action) || !keyValid(key))
        return res.status(400).json({ error: "طلب تسليم غير صالح" });
      const actor = req.currentUser!;
      const result = await db.transaction(async tx => {
        const [transfer] = await tx.select().from(finishedGoodsTransfers)
          .where(eq(finishedGoodsTransfers.id, transferId)).for("update");
        if (!transfer || transfer.transportPolicy !== "internal_bar_receipt") fail(404, "التسليم الداخلي غير موجود");
        if (!(await canAccessBranch(req, transfer.sourceBranchId))) fail(403, "غير مصرح بعهدة الفرع");
        const [previousAction] = await tx.select().from(branchBarHandoffEvents)
          .where(and(eq(branchBarHandoffEvents.transferId, transferId), eq(branchBarHandoffEvents.action, action)))
          .limit(1);
        if (previousAction && previousAction.actorId !== actor.id)
          fail(403, "إعادة الإجراء مقصورة على الموظف الذي سجّله");
        if (action === "receive") {
          const [dispatchEvent] = await tx.select().from(branchBarHandoffEvents)
            .where(and(eq(branchBarHandoffEvents.transferId, transferId), eq(branchBarHandoffEvents.action, "dispatch")))
            .limit(1);
          if (actor.id === transfer.createdBy || actor.id === dispatchEvent?.actorId)
            fail(403, "يجب أن يؤكد الاستلام موظف لم ينشئ المحضر ولم يسلّم البضاعة");
        }
        const storedKey = action === "dispatch" ? transfer.dispatchKey : action === "receive" ? transfer.receiveKey : transfer.cancelKey;
        const usable = req.body.usableQuantity, damaged = req.body.damagedQuantity;
        if (storedKey) {
          if (storedKey !== key || (action === "receive" && (
            transfer.usableQuantity !== usable || transfer.damagedQuantity !== damaged ||
            note(transfer.receiptNotes) !== note(req.body.notes)
          )))
            fail(409, "اكتمل الإجراء مسبقاً ببيانات مختلفة");
          return transfer;
        }
        if ((action === "receive" && transfer.status !== "in_transit") ||
            (action !== "receive" && transfer.status !== "pending"))
          fail(409, "حالة التسليم لا تسمح بهذا الإجراء");
        if (action === "receive") {
          if (!whole(usable) || !whole(damaged) || usable + damaged > transfer.quantity)
            fail(400, "الكميات المستلمة غير صالحة");
          if ((damaged || usable + damaged < transfer.quantity) && note(req.body.notes).length < 3)
            fail(400, "يجب تدوين سبب التلف أو النقص للمراجعة");
          const [updated] = await tx.update(finishedGoodsTransfers).set({
            status: "received", receivedQuantity: usable + damaged,
            usableQuantity: usable, damagedQuantity: damaged,
            shortageQuantity: transfer.quantity - usable - damaged,
            settlementStatus: damaged || usable + damaged < transfer.quantity ? "open" : "none",
            receiptNotes: note(req.body.notes) || null,
            receivedBy: actor.id, receivedAt: new Date(), receiveKey: key,
          }).where(eq(finishedGoodsTransfers.id, transferId)).returning();
          if (usable || damaged) {
            await tx.insert(branchBarStock).values({
              branchId: transfer.sourceBranchId, productId: transfer.productId!,
              productionDate: transfer.productionDate!, unit: transfer.unit || "قطعة",
              quantity: usable, quarantineQuantity: damaged,
            }).onConflictDoUpdate({
              target: [branchBarStock.branchId, branchBarStock.productId, branchBarStock.productionDate, branchBarStock.unit],
              set: {
                quantity: sql`${branchBarStock.quantity} + ${usable}`,
                quarantineQuantity: sql`${branchBarStock.quarantineQuantity} + ${damaged}`,
              },
            });
          }
          if (usable) await tx.insert(displayBarReceipts).values({
            branchId: transfer.sourceBranchId, productId: transfer.productId!,
            receiptDate: new Date().toISOString().slice(0, 10),
            receiptTime: new Date().toISOString().slice(11, 16),
            quantity: usable, receivedBy: actor.id,
            productionBatch: `FG-${transfer.id}`,
            notes: `استلام فعلي من مطبخ الفرع للتسليم #${transfer.id}`,
          });
          await tx.insert(branchBarHandoffEvents).values({ transferId, action, actorId: actor.id,
            payload: { usable, damaged, shortage: transfer.quantity - usable - damaged, notes: note(req.body.notes) } });
          return updated;
        }
        if (action === "dispatch") {
          const [debited] = await tx.update(finishedGoodsInventory).set({
            quantity: sql`${finishedGoodsInventory.quantity} - ${transfer.quantity}`,
            reservedQuantity: sql`${finishedGoodsInventory.reservedQuantity} - ${transfer.quantity}`,
          }).where(and(eq(finishedGoodsInventory.id, transfer.inventoryId),
            sql`${finishedGoodsInventory.reservedQuantity} >= ${transfer.quantity}`,
            sql`${finishedGoodsInventory.quantity} >= ${transfer.quantity}`)).returning();
          if (!debited) fail(409, "الحجز لم يعد متاحاً للشحن");
          await tx.insert(productionInventoryLogs).values({
            branchId: transfer.sourceBranchId, productId: transfer.productId,
            productName: transfer.productName, movementType: "transfer_out",
            quantity: -transfer.quantity, balanceBefore: debited.quantity + transfer.quantity,
            balanceAfter: debited.quantity, referenceType: "transfer", referenceId: transferId,
            notes: "تسليم داخلي إلى بار الفرع، بانتظار تأكيد الاستلام", createdBy: actor.id,
          });
        } else {
          const [released] = await tx.update(finishedGoodsInventory).set({
            reservedQuantity: sql`${finishedGoodsInventory.reservedQuantity} - ${transfer.quantity}`,
          }).where(and(eq(finishedGoodsInventory.id, transfer.inventoryId),
            sql`${finishedGoodsInventory.reservedQuantity} >= ${transfer.quantity}`)).returning();
          if (!released) fail(409, "الحجز غير موجود؛ راجع المخزون قبل الإلغاء");
        }
        const [updated] = await tx.update(finishedGoodsTransfers).set(action === "dispatch"
          ? { status: "in_transit", dispatchedAt: new Date(), dispatchKey: key }
          : { status: "cancelled", cancelKey: key })
          .where(eq(finishedGoodsTransfers.id, transferId)).returning();
        await tx.insert(branchBarHandoffEvents).values({ transferId, action, actorId: actor.id, payload: {} });
        return updated;
      });
      return res.json(result);
    } catch (e) {
      console.error("Branch bar transition:", e);
      return res.status(e instanceof HandoffError ? e.status : 500).json({ error: e instanceof HandoffError ? e.message : "تعذر تحديث التسليم" });
    }
  });
}