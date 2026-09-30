import React, { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ProductionPlanningResponse } from "@shared/production-planning";
import type { CentralKitchenWorkplan } from "@shared/central-kitchen-workplan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationsBoard } from "./operations-board";
import { ProductionPlanning } from "./production-planning";
import { planningStatusLabel } from "./production-planning-model";
import { cycleMovements, cycleStatusLabel, explicitPlanReferences, readCycleSource, type CycleRecord, type MovementLane } from "./production-cycle-model";

type Props = { kitchens: { id: string; name: string }[]; kitchenId: string; onKitchenChange: (id: string) => void; date: string; onDateChange: (date: string) => void };
const modes: Record<string, string> = { real: "مخزون فعلي", shadow: "تجريبي — دون خصم فعلي", paused: "متوقف", unknown: "غير معروف" };
const quantity = (value: number | null | undefined) => value == null ? "غير متاح" : value.toLocaleString("en-US", { maximumFractionDigits: 6 });
const scope = (href: string, kitchenId: string, date: string) => {
  const url = new URL(href, "https://internal.invalid");
  url.searchParams.set("kitchenId", kitchenId);
  url.searchParams.set("date", date);
  return `${url.pathname}${url.search}${url.hash}`;
};

export function CycleState({ loading, error, empty, children, retry }: { loading: boolean; error: Error | null; empty: boolean; children: ReactNode; retry: () => void }) {
  if (error) return <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm"><p>{error.message} لا تُعرض بيانات مخبأة لهذا المسار.</p><Button variant="outline" onClick={retry}>إعادة المحاولة</Button></div>;
  if (loading) return <p role="status" className="p-3 text-sm text-muted-foreground">جارٍ التحقق من المسار…</p>;
  if (empty) return <p className="p-3 text-sm text-muted-foreground">لا توجد سجلات ضمن النطاق المُعاد. هذا ليس إثباتًا لاكتمال الدورة.</p>;
  return <>{children}</>;
}

function MovementQueue({ lane, kitchenId, date }: { lane: MovementLane; kitchenId: string; date: string }) {
  const endpoint = lane === "raw" ? `/api/warehouse/material-transfers?branchId=${encodeURIComponent(kitchenId)}&destinationBranchId=${encodeURIComponent(kitchenId)}`
    : lane === "shipments" ? `/api/kitchen-warehouse-shipping?kitchenId=${encodeURIComponent(kitchenId)}` : `/api/reverse-logistics?kitchenId=${encodeURIComponent(kitchenId)}`;
  const query = useQuery<CycleRecord[]>({
    queryKey: ["production-cycle-movements", lane, kitchenId, date],
    queryFn: ({ signal }) => readCycleSource(endpoint, signal), enabled: !!kitchenId,
    staleTime: 0, refetchInterval: 60_000, retry: false,
  });
  const [showAll, setShowAll] = useState(false);
  const data = query.isError ? undefined : query.data;
  const rows = cycleMovements(data ?? [], lane, kitchenId, date);
  const limit = lane === "shipments" ? 500 : lane === "returns" ? 250 : null;
  return <section className="min-w-0 rounded-xl border bg-card p-3 space-y-3">
    <h3 className="font-bold">{lane === "raw" ? "وارد المواد الخام" : lane === "shipments" ? "المنتج النهائي إلى المستودعات" : "المرتجعات والعزل"}</h3>
    <p className="text-xs leading-6 text-muted-foreground">{lane === "raw" ? "إمداد مستقل للمطبخ، وليس رابطًا بطلب فرع. الاعتماد لا يحجز الخام؛ الخصم عند الإرسال والإضافة عند الاستلام."
      : lane === "shipments" ? "مسار صادر مستقل عن طلبات الفروع؛ حجز ثم إرسال ثم استلام المستودع."
        : "الصالح بعد الفحص فقط يعود إلى المخزون. الشطب والعزل لا يعنيان رصيدًا صالحًا."}</p>
    <p className="text-xs text-muted-foreground">سجلات يوم الإنشاء المحدد والمتأخر المفتوح؛ الحالة الحالية لا لقطة تاريخية. السجلات دون تاريخ معلوم تبقى ظاهرة.</p>
    {limit && <p className="text-xs text-amber-700 dark:text-amber-300">المصدر يصفي المطبخ قبل حد النتائج ويعيد أحدث {limit} سجلًا ضمن صلاحياتك؛ قد تغيب سجلات أقدم. تاريخ العرض يرشح النتائج المُعادة فقط. {data && data.length >= limit ? "بلغت النتائج حد المصدر." : ""}</p>}
    <CycleState loading={query.isPending} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <p className="text-xs">{rows.length} سجلًا ضمن النتائج المُعادة فقط</p>
      {rows.slice(0, showAll ? undefined : 6).map(row => {
        const href = lane === "raw" ? `/transfer-requests?transferId=${row.id}&branchId=${encodeURIComponent(kitchenId)}`
          : lane === "shipments" ? `/kitchen-warehouse-shipping?shipmentId=${row.id}`
            : `/reverse-logistics?movementId=${row.id}&branchId=${encodeURIComponent(String(row.source_branch_id ?? kitchenId))}`;
        return <article key={row.id} className="rounded-lg border p-3 text-sm space-y-2">
          <div className="flex flex-wrap justify-between gap-2"><b>{String(row.transferNumber ?? row.shipment_number ?? `#${row.id}`)}</b><span>{cycleStatusLabel(row.status)}</span></div>
          <p className="break-words text-muted-foreground">{String(row.sourceBranchName ?? row.product_name ?? ({ product_return: "مرتجع منتجات", material_return: "مرتجع مواد خام", warehouse_transfer: "تحويل بين المستودعات" } as Record<string, string>)[String(row.kind)] ?? row.kind ?? "")} {row.destination_name ? `← ${row.destination_name}` : ""}</p>
          {lane === "returns" && <p>الحجر: {String(row.quarantine_quantity ?? "غير متاح")} · النقص: {String(row.shortage_quantity ?? "غير متاح")}</p>}
          {row.hasDiscrepancy === true && <p className="text-destructive">توجد فروق استلام</p>}
          <Link className="inline-flex min-h-11 items-center font-bold text-primary" href={scope(href, kitchenId, date)}>فتح السجل وإجراءاته والتوصيل ←</Link>
        </article>;
      })}
      {rows.length > 6 && <Button variant="outline" onClick={() => setShowAll(value => !value)}>{showAll ? "عرض أقل" : `عرض جميع السجلات المُعادة (${rows.length})`}</Button>}
    </CycleState>
  </section>;
}

export function ProductionCycle(props: Props) {
  const { kitchenId, date, kitchens, onKitchenChange, onDateChange } = props;
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const queryString = new URLSearchParams({ kitchenId, date }).toString();
  const planning = useQuery<ProductionPlanningResponse>({
    queryKey: ["/api/production/planning", kitchenId, date],
    queryFn: ({ signal }) => readCycleSource(`/api/production/planning?${queryString}`, signal),
    enabled: !!kitchenId && /^\d{4}-\d{2}-\d{2}$/.test(date), retry: false, staleTime: 0, refetchInterval: 60_000,
  });
  const workplan = useQuery<CentralKitchenWorkplan>({
    queryKey: ["/api/central-kitchen-orders/workplan", kitchenId, date],
    queryFn: ({ signal }) => readCycleSource(`/api/central-kitchen-orders/workplan?${queryString}`, signal),
    enabled: !!kitchenId && /^\d{4}-\d{2}-\d{2}$/.test(date), retry: false, staleTime: 0, refetchInterval: 60_000,
  });
  const plan = !planning.isError && planning.data?.kitchen.id === kitchenId && planning.data.date === date ? planning.data : undefined;
  const work = !workplan.isError && workplan.data?.kitchen.id === kitchenId && workplan.data.date === date ? workplan.data : undefined;
  const orders = [...(work?.orders ?? []), ...(work?.overdueEarlierOrders ?? [])].filter(order =>
    (!onlyAttention || !order.finished || order.discrepancyStatus === "open") &&
    `${order.orderNumber} ${order.source.requestingBranch.name} ${order.items.map(item => item.productName).join(" ")}`.includes(search.trim()));
  return <section dir="rtl" className="space-y-4 min-w-0 text-right" aria-label="دورة الإنتاج الموحدة">
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h2 className="text-lg font-black">دورة الإنتاج — من الخام إلى الاستلام</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">المطبخ<select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" value={kitchenId} onChange={event => onKitchenChange(event.target.value)}><option value="" disabled>اختر المطبخ</option>{kitchens.map(kitchen => <option key={kitchen.id} value={kitchen.id}>{kitchen.name}</option>)}</select></label>
        <label className="min-w-0 text-sm">يوم العمل · الرياض<Input className="mt-1" type="date" value={date} onChange={event => onDateChange(event.target.value)} /></label>
        <Button variant="outline" onClick={() => void client.invalidateQueries({ predicate: query => ["production-cycle-movements", "/api/central-kitchen-orders/workplan", "/api/production/planning", "/api/central-kitchen-orders/operations"].includes(String(query.queryKey[0])) })}>تحديث جميع المسارات</Button>
      </div>
      <p className="text-sm break-words">النطاق المحدد: {kitchens.find(kitchen => kitchen.id === kitchenId)?.name ?? "لم يُحدد مطبخ بعد"}</p>
      <p className="text-sm">{plan ? `وضع المطبخ: ${modes[plan.metadata.configuration.inventoryMode]} · آخر قراءة: ${new Date(plan.metadata.generatedAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}` : "وضع التشغيل غير متحقق حتى تحميل التخطيط."}</p>
      <p className="text-xs leading-6 text-muted-foreground">الطلب ← الخطة المرتبطة ← الدفعة ← التجهيز والحجز ← الإرسال ← الاستلام. الخام والمنتج النهائي والمرتجع دفاتر مستقلة. لا تُنشأ الروابط باستنتاج المنتج أو التاريخ. توفر المكونات ليس حجزًا؛ استهلاك الوصفة عند إنهاء الدفعة. الإنتاج المستقل لا يثبت استهلاك وصفة.</p>
    </div>
    {!kitchenId ? <p role="status">اختر مطبخًا مصرحًا لبدء المتابعة.</p> : <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-3">{(["raw", "shipments", "returns"] as const).map(lane => <MovementQueue key={`${kitchenId}:${date}:${lane}`} lane={lane} kitchenId={kitchenId} date={date} />)}</div>
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="font-black">طلبات الفروع وسلسلة التنفيذ والاستلام</h3>
        <p className="text-xs text-muted-foreground">طلبات موعد اليوم والمتأخر ضمن نافذة المصدر. الكميات منفصلة حسب الصنف والوحدة؛ الأعداد تخص النتائج المُعادة فقط.</p>
        <Input aria-label="بحث سلسلة الإنتاج" placeholder="رقم الطلب أو الفرع أو الصنف" value={search} onChange={event => setSearch(event.target.value)} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={onlyAttention} onChange={event => setOnlyAttention(event.target.checked)} />غير المكتمل أو ذو الفروق فقط</label>
        <CycleState loading={planning.isPending} error={planning.error} empty={false} retry={() => void planning.refetch()}><p className="text-xs text-muted-foreground">{plan?.metadata.truncated ? "التخطيط جزئي؛ بعض السجلات خارج حد المصدر. عدم ظهور رابط لا يعني عدم وجوده." : "روابط الخطط من المراجع الصريحة المُعادة فقط."}</p></CycleState>
        <CycleState loading={workplan.isPending} error={workplan.error} empty={!orders.length} retry={() => void workplan.refetch()}>
          <p className="text-xs text-amber-700 dark:text-amber-300">خطة العمل محدودة بـ250 طلبًا لكل مجموعة؛ لا تعتمد على هذه القائمة كجرد شامل. السجلات الأقدم تُراجع من صفحة الطلبات.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {orders.map(order => <article key={order.id} className="min-w-0 rounded-lg border p-3 space-y-3">
              <div className="flex flex-wrap justify-between gap-2"><b>{order.orderNumber} · {order.source.requestingBranch.name}</b><span className="text-sm">{planningStatusLabel(order.rawStatus)}</span></div>
              <p className="text-xs">{modes[order.inventoryMode]} · موعد الطلب: {order.neededDate} · الفروق: {order.discrepancyStatus === "open" ? "مفتوحة" : order.discrepancyStatus === "resolved" ? "مسواة" : "لا فروق مسجلة"}</p>
              <p className="text-sm font-semibold">{order.nextStep.label} · {order.nextStep.owner}</p>
              {order.items.map(item => <div key={item.id} className="rounded bg-muted/40 p-2 space-y-2 text-xs leading-6">
                <b>{item.productName} · {item.unit}</b>
                <p>مطلوب {quantity(item.requestedQuantity)} · مجهز {quantity(item.preparedQuantity)} · مرسل {quantity(item.dispatchedQuantity)} · مستلم {quantity(item.receivedQuantity)}</p>
                <p>تالف {quantity(item.damagedQuantity)} · ناقص {quantity(item.missingQuantity)} · مصدر التجهيز: {item.preparationSourceStatus === "unknown" ? "غير موثق" : `مخزون ${quantity(item.preparedFromStock)} / إنتاج ${quantity(item.preparedFromProduction)}`}</p>
                {explicitPlanReferences(plan, item.id).map(ref => <Link key={`${ref.planId}:${ref.itemId}`} className="block min-h-11 text-primary underline" href={scope(ref.href, kitchenId, date)}>خطة #{ref.planId} / بند #{ref.itemId} · تغطية {quantity(ref.quantity)} {item.unit}</Link>)}
                {!explicitPlanReferences(plan, item.id).length && <p className="text-muted-foreground">{plan ? "لا مرجع خطة متقدمة ضمن النتائج المُعادة." : "روابط الخطط غير متاحة."}</p>}
                {order.linkedBatches.batches.filter(batch => batch.orderItemId === item.id).map(batch => <Link className="block min-h-11 text-primary underline" key={batch.id} href={scope(batch.directLink, kitchenId, date)}>دفعة #{batch.id}: {quantity(batch.quantity)} {batch.unit} · {cycleStatusLabel(batch.status)} · {batch.materialPosting === "consumed" ? "استهلاك خام مسجل" : batch.materialPosting === "pending" ? "استهلاك الخام لم يُسجل بعد" : "دليل الاستهلاك غير معروف"} — فتح تنفيذ الطلب المرتبط</Link>)}
              </div>)}
              <Link className="inline-flex min-h-11 items-center text-sm font-bold text-primary" href={scope(order.directOrderLink, kitchenId, date)}>فتح الطلب: التجهيز والإرسال والتوصيل والاستلام ←</Link>
            </article>)}
          </div>
        </CycleState>
      </section>
      <details className="rounded-xl border bg-card p-3" open><summary className="min-h-11 cursor-pointer font-bold">التغطية والمخزون الجاهز والخطط المرتبطة</summary><ProductionPlanning mode="planning" {...props} /></details>
      <details className="rounded-xl border bg-card p-3" open><summary className="min-h-11 cursor-pointer font-bold">تنفيذ الإنتاج الحي — الحالة الحالية لجميع المواعيد</summary><p className="mb-3 text-xs text-muted-foreground">التنفيذ الحي أدناه غير مقيد بتاريخ التقرير؛ يحتفظ بحراس الصلاحيات والوصفة والمخزون الأصلية.</p><OperationsBoard kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={onKitchenChange} /></details>
    </>}
  </section>;
}