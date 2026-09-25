import { CheckCircle2, CircleAlert, MapPin, Package, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Delivery } from "@/pages/driver-deliveries";

const stages: Record<Delivery["status"], { label: string; className: string }> = {
  assigned: { label: "بانتظار التسليم أو الانطلاق", className: "border-violet-200 bg-violet-50 text-violet-800" },
  in_transit: { label: "في الطريق", className: "border-sky-200 bg-sky-50 text-sky-800" },
  awaiting_receipt: { label: "بانتظار اعتماد الاستلام", className: "border-amber-200 bg-amber-50 text-amber-900" },
  receipt_approved: { label: "تم اعتماد الاستلام", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  completed: { label: "مكتملة", className: "border-stone-200 bg-stone-100 text-stone-700" },
  failed: { label: "تعذر التسليم", className: "border-rose-200 bg-rose-50 text-rose-800" },
  cancelled: { label: "مهمة ملغاة", className: "border-zinc-200 bg-zinc-50 text-zinc-700" },
};

export const deliveryStatus = (status: Delivery["status"]) => stages[status];
export const deliverySourceLabel = (type: Delivery["sourceType"]) => ({
  kitchen: "طلب المطبخ المركزي",
  material_transfer: "نقل مواد",
  finished_goods_transfer: "نقل منتجات جاهزة",
  kitchen_warehouse_shipment: "شحنة مطبخ إلى مستودع",
  reverse_movement: "إرجاع أو نقل بين المستودعات",
})[type];
export const deliverySourcePath = (delivery: Delivery) => delivery.sourceType === "kitchen"
  ? `/central-kitchen-orders?orderId=${delivery.sourceId}`
  : delivery.sourceType === "material_transfer"
    ? `/transfer-requests?transferId=${delivery.sourceId}`
    : delivery.sourceType === "finished_goods_transfer"
      ? `/finished-goods-inventory?transferId=${delivery.sourceId}&branchId=${encodeURIComponent(delivery.destinationBranchId || "")}&deliveryId=${delivery.id}`
      : delivery.sourceType === "reverse_movement"
        ? `/reverse-logistics?movementId=${delivery.sourceId}`
        : `/kitchen-warehouse-shipping?shipmentId=${delivery.sourceId}&deliveryId=${delivery.id}`;
export function DeliveryItemLabel({ item }: { item: Delivery["items"][number] }) {
  return <span>{item.name}{!!item.substituteQuantity && <span className="mt-1 block text-xs text-muted-foreground">تفصيل التجهيز: أصلي {item.originalQuantity || 0} {item.unit || ""} · بديل {item.substituteName || "بديل"} {item.substituteQuantity} {item.substituteUnit || item.unit || ""}</span>}</span>;
}
export const deliveryDate = (date?: string | null) => date ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "غير محدد";
export function deliveryTiming(delivery: Delivery, now: number): "on_time" | "overdue" | "escalated" {
  if (!delivery.scheduledAt || ["completed", "cancelled", "receipt_approved"].includes(delivery.status)) return "on_time";
  const scheduled = new Date(delivery.scheduledAt).getTime();
  if (!Number.isFinite(scheduled) || scheduled > now) return "on_time";
  return now - scheduled >= 60 * 60_000 ? "escalated" : "overdue";
}

export function DeliveryCard({ delivery, onOpen, now = Date.now() }: { delivery: Delivery; onOpen: () => void; now?: number }) {
  const state = deliveryStatus(delivery.status);
  const timing = deliveryTiming(delivery, now);
  return <Card className="border-border/80 shadow-sm transition-transform active:scale-[0.99]">
    <CardContent className="p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Truck className="h-5 w-5" /></span><div><p className="font-bold">{delivery.sourceLabel}</p><p className="text-sm text-muted-foreground">{delivery.driverName} · {delivery.vehicleNumber}</p></div></div>
        <Badge variant="outline" className={state.className}>{state.label}</Badge>
        {delivery.handoverInvalidated && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">المحضر السابق ملغى</Badge>}
        {timing !== "on_time" && <Badge variant="destructive">{timing === "escalated" ? "تصعيد: متأخرة أكثر من ساعة" : "متأخرة عن الموعد"}</Badge>}
      </div>
      <div className="mt-4 grid gap-3 border-y border-border/70 py-3 text-sm md:grid-cols-2">
        <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />من {delivery.sourceBranchName}</p>
        <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />إلى {delivery.destinationBranchName}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{delivery.items.length} بنود · {deliveryDate(delivery.scheduledAt || delivery.createdAt)}</span><Button onClick={onOpen} className="min-h-11">فتح المهمة</Button></div>
    </CardContent>
  </Card>;
}

export function DeliveryDetail({ delivery, proof, now = Date.now() }: { delivery: Delivery; now?: number; proof?: { signatureData: string | null; receiverName: string | null; proofAt: string | null; receiptApprovedBy: string | null; receiptApprovedAt: string | null } }) {
  const receiptPath = deliverySourcePath(delivery);
  const timing = deliveryTiming(delivery, now);
  return <div className="space-y-4" dir="rtl">
    {timing !== "on_time" && <div role="status" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-medium text-rose-900">{timing === "escalated" ? "تصعيد: تجاوزت المهمة موعد التسليم بساعة أو أكثر. تابع مع المسؤول فوراً." : "المهمة متأخرة عن موعد التسليم المحدد. تابع إجراء التسليم الآن."} الموعد: {deliveryDate(delivery.scheduledAt)}</div>}
    <section className="rounded-xl bg-primary/8 p-4"><p className="text-xs font-semibold text-primary">خط السير</p><div className="mt-2 grid gap-3 text-sm md:grid-cols-2"><p><span className="text-muted-foreground">الاستلام من: </span>{delivery.sourceBranchName}</p><p><span className="text-muted-foreground">التسليم إلى: </span>{delivery.destinationBranchName}</p></div></section>
    {delivery.status === "awaiting_receipt" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><span className="flex items-center gap-2"><CircleAlert className="h-5 w-5" />{delivery.sourceStatus === "received" || delivery.sourceStatus === "delivered" ? "سُجل الاستلام في المصدر؛ على المستلم المعتمد العودة هنا لاعتماد الإيصال." : "التوقيع قُدم، لكن الاستلام الفعلي يجب تسجيله في المصدر أولاً ثم العودة لهذا التبويب لاعتماد الإيصال."}</span><a href={receiptPath} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">فتح استلام المصدر في تبويب جديد</a></div>}
    {(delivery.capabilities.canStart || delivery.capabilities.canSubmitProof) && (delivery.sourceStatus === "received" || delivery.sourceStatus === "delivered" || delivery.sourceStatus === "inspected") && !delivery.proofPresent && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950">استكمل الإثبات، الاستلام مسجل ولن يعاد ترحيل المخزون.{delivery.capabilities.canStart ? " ابدأ المهمة لتوثيق الإثبات دون إعادة شحن المصدر." : ""}</div>}
    {delivery.status === "receipt_approved" && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5" />تم اعتماد إيصال المصدر، يمكن للسائق إنهاء المهمة.</div>}
     <section><div className="mb-2 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /><h3 className="font-bold">بنود الشحنة</h3></div><div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-right text-sm"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="p-3 font-medium">الصنف</th><th className="p-3 font-medium">الكمية</th></tr></thead><tbody>{delivery.items.map(item => <tr key={item.id} className="border-t border-border"><td className="p-3"><DeliveryItemLabel item={item} /></td><td className="p-3 font-semibold">{item.quantity} {item.unit || ""}</td></tr>)}</tbody></table></div></section>
    <section className="grid gap-2 rounded-xl border border-border p-4 text-sm md:grid-cols-2"><p><span className="text-muted-foreground">السائق: </span>{delivery.driverName}</p><p><span className="text-muted-foreground">المركبة: </span>{delivery.vehicleNumber}</p>{delivery.receiverName && <p><span className="text-muted-foreground">اسم المستلم: </span>{delivery.receiverName}</p>}{delivery.failureReason && <p className="text-destructive"><span>سبب التعذر: </span>{delivery.failureReason}</p>}{delivery.cancellationReason && <p className="text-destructive"><span>سبب إلغاء المهمة (الشحنة لم تُلغَ): </span>{delivery.cancellationReason}</p>}</section>
    {proof?.signatureData && <section className="rounded-xl border border-border bg-muted/20 p-4"><p className="mb-3 font-bold">دليل التوقيع</p><img src={proof.signatureData} alt="توقيع المستلم المسجل" className="max-h-40 max-w-full rounded-lg border border-border bg-[#fbfaf7]" /><p className="mt-2 text-xs text-muted-foreground">سُجل {deliveryDate(proof.proofAt)}{proof.receiptApprovedAt ? ` · اعتُمد ${deliveryDate(proof.receiptApprovedAt)}` : ""}</p></section>}
  </div>;
}