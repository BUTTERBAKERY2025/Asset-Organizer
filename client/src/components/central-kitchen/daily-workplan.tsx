import React, { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { CentralKitchenWorkplan, CentralKitchenWorkplanInventoryMode, CentralKitchenWorkplanOrder } from "@shared/central-kitchen-workplan";
import { AlertTriangle, ArrowLeft, ClipboardList, Factory, RefreshCw, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compactPreparationEvidenceReferences, getPreparationSourceReadout, preparationSourceQuantityText } from "@/lib/production-operations-export";
import { planningPage, workplanStatusLabel } from "./production-planning-model";
import workspaceStyles from "./planning-workspace.css?raw";

type Kitchen = { id: string; name: string };
type ModeFilter = "all" | CentralKitchenWorkplanInventoryMode;

const riyadhDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const formatWorkplanQuantity = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 6 }).format(value);
const number = formatWorkplanQuantity;
const modeText: Record<CentralKitchenWorkplanInventoryMode, string> = { real: "مخزون فعلي", shadow: "تشغيل ظلّي", unknown: "سجل بلا نمط" };
const modeClass: Record<CentralKitchenWorkplanInventoryMode, string> = { real: "border-emerald-200 bg-emerald-50 text-emerald-800", shadow: "border-amber-200 bg-amber-50 text-amber-800", unknown: "border-stone-200 bg-stone-100 text-stone-700" };

export function filterWorkplanOrders(orders: readonly CentralKitchenWorkplanOrder[], filters: { mode: ModeFilter; status: string; stage: string; search: string }) {
  const needle = filters.search.trim().toLocaleLowerCase("ar");
  return orders.filter(order => {
    if (filters.mode !== "all" && order.inventoryMode !== filters.mode) return false;
    if (filters.status !== "all" && order.rawStatus !== filters.status) return false;
    if (filters.stage !== "all" && order.nextStep.stage !== filters.stage) return false;
    if (!needle) return true;
    return [order.orderNumber, order.source.requestingBranch.name, order.nextStep.label, order.nextStep.owner, ...order.items.map(item => item.productName)].join(" ").toLocaleLowerCase("ar").includes(needle);
  });
}

export function DailyWorkplan({ kitchens, kitchenId, onKitchenChange }: { kitchens: Kitchen[]; kitchenId: string; onKitchenChange: (id: string) => void }) {
  const [date, setDate] = useState(riyadhDate);
  const [mode, setMode] = useState<ModeFilter>("all");
  const [status, setStatus] = useState("all");
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scopeKey, setScopeKey] = useState(`${kitchenId}:${date}`);
  const currentScope = `${kitchenId}:${date}`;
  if (scopeKey !== currentScope) { setScopeKey(currentScope); setSelectedId(null); setPage(1); }
  const workplan = useQuery<CentralKitchenWorkplan>({
    queryKey: ["/api/central-kitchen-orders/workplan", kitchenId, date],
    queryFn: async () => {
      const response = await fetch(`/api/central-kitchen-orders/workplan?kitchenId=${encodeURIComponent(kitchenId)}&date=${encodeURIComponent(date)}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "لا تملك صلاحية عرض خطة هذا المطبخ." : "تعذر تحميل خطة العمل اليومية.");
      return response.json();
    },
    enabled: Boolean(kitchenId && /^\d{4}-\d{2}-\d{2}$/.test(date)),
  });
  const allOrders = useMemo(() => workplan.data ? [...workplan.data.orders, ...workplan.data.overdueEarlierOrders] : [], [workplan.data]);
  const filtered = useMemo(() => filterWorkplanOrders(allOrders, { mode, status, stage, search }), [allOrders, mode, status, stage, search]);
  const statuses = useMemo(() => [...new Set(allOrders.map(order => order.rawStatus))].sort(), [allOrders]);
  const stages = useMemo(() => [...new Map(allOrders.map(order => [order.nextStep.stage, order.nextStep.label])).entries()], [allOrders]);
  const { pageItems, currentPage, totalPages } = planningPage(filtered, page);
  const selectedOrder = allOrders.find(order => order.id === selectedId);
  const changeScope = (change: () => void) => { setSelectedId(null); setPage(1); change(); };

  return <section dir="rtl" className="planning-workspace space-y-3"><style>{workspaceStyles}</style>
    <div className="pw-shell"><div className="pw-top"><span className="pw-kicker">متابعة اليوم</span><h2>خطة العمل اليومية</h2><p>طلبات المطبخ المركزي والدفعات المرتبطة المحفوظة فقط. شاشة متابعة لا تعدّل خطة الإنتاج؛ جاهزية تخصيص المواد غير معروفة.</p></div>
      <div className="pw-toolbar">
        <div className="pw-field"><Label htmlFor="workplan-kitchen">المطبخ المركزي</Label><Select value={kitchenId || ""} onValueChange={value => changeScope(() => onKitchenChange(value))}><SelectTrigger id="workplan-kitchen"><SelectValue placeholder="اختر المطبخ" /></SelectTrigger><SelectContent>{kitchens.map(kitchen => <SelectItem key={kitchen.id} value={kitchen.id}>{kitchen.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="pw-field"><Label htmlFor="workplan-date">التاريخ · الرياض</Label><Input id="workplan-date" type="date" value={date} onChange={event => changeScope(() => setDate(event.target.value))} /></div>
        <div className="pw-field pw-search"><Label htmlFor="workplan-search">بحث في الطلبات المُعادة</Label><Input id="workplan-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="رقم الطلب أو الفرع أو الصنف" /></div>
        <Filter label="نمط المخزون" value={mode} onChange={value => { setMode(value as ModeFilter); setPage(1); }} options={[["all", "كل الأنماط"], ["real", modeText.real], ["shadow", modeText.shadow], ["unknown", modeText.unknown]]} />
        <Filter label="حالة الطلب" value={status} onChange={value => { setStatus(value); setPage(1); }} options={[["all", "كل الحالات"], ...statuses.map(value => [value, workplanStatusLabel(value)])]} />
        <Filter label="الخطوة التالية" value={stage} onChange={value => { setStage(value); setPage(1); }} options={[["all", "كل الخطوات"], ...stages]} />
        <Button size="sm" variant="outline" disabled={!kitchenId || workplan.isFetching} onClick={() => workplan.refetch()} aria-label="تحديث خطة العمل"><RefreshCw className={`ml-2 h-4 w-4 ${workplan.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
      </div></div>
    {!kitchenId ? <State icon={<Factory className="h-7 w-7" />} title="اختر مطبخاً مركزياً" text="اختر الفرع لعرض الطلبات القائمة ودفعاتها." /> : !/^\d{4}-\d{2}-\d{2}$/.test(date) ? <State icon={<ClipboardList className="h-7 w-7" />} title="حدد تاريخ الخطة" text="اختر تاريخاً صالحاً بتوقيت الرياض لعرض الطلبات." /> : <>
      {workplan.isLoading || (workplan.isFetching && !workplan.data) ? <div className="pw-shell p-4">{[1,2,3].map(item => <div key={item} className="mb-2 h-12 animate-pulse rounded-md bg-violet-100/60" />)}</div> : workplan.isError ? <State icon={<AlertTriangle className="h-7 w-7" />} title="خطة العمل غير متاحة" text={workplan.error instanceof Error ? workplan.error.message : "تحقق من الاتصال."} action={<Button variant="outline" onClick={() => workplan.refetch()}>إعادة المحاولة</Button>} /> : workplan.data && workplan.data.kitchen?.id === kitchenId && workplan.data.date === date && <div className="pw-shell">
        <Scope workplan={workplan.data} filtered={filtered.length} total={allOrders.length} />
        <div className="pw-head"><span>الطلب / النمط</span><span>الفرع</span><span>حالة الطلب</span><span>تاريخ الاحتياج</span><span>الخطوة التالية</span><span>التفاصيل</span></div>
        {filtered.length === 0 ? <State icon={<ClipboardList className="h-7 w-7" />} title="لا توجد طلبات ضمن هذا النطاق" text="عدّل التاريخ أو عوامل التصفية. لا تنشئ هذه الشاشة طلبات أو دفعات جديدة." /> : pageItems.map(order => <div key={`${order.cohort}-${order.id}`} className="pw-row">
          <div className="pw-main"><strong className="pw-primary">{order.orderNumber}</strong><span className="pw-sub">{modeText[order.inventoryMode]}{order.cohort === "overdue" ? " · سابق غير منتهٍ" : ""}</span></div>
          <span className="pw-ellipsis" title={order.source.requestingBranch.name}>{order.source.requestingBranch.name}</span>
          <span>{workplanStatusLabel(order.rawStatus)}</span><span dir="ltr">{order.neededDate}</span>
          <div><span className="pw-ellipsis" title={order.nextStep.label}>{order.nextStep.label}</span><span className="pw-sub">{order.nextStep.owner} · {order.items.length} بنود{order.exceptions.length ? ` · ${order.exceptions.length} استثناء` : ""}</span></div>
          <Button className="pw-action" size="sm" variant="outline" onClick={() => setSelectedId(order.id)}>عرض</Button>
        </div>)}
        <div className="pw-foot"><span>عدد النتائج {number(filtered.length)} · الصفحة {number(currentPage)} من {number(totalPages)}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>السابق</Button><Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>التالي</Button></div></div>
        <Dialog open={Boolean(selectedOrder)} onOpenChange={open => !open && setSelectedId(null)}><DialogContent dir="rtl" className="max-w-3xl"><DialogHeader><DialogTitle>تفاصيل {selectedOrder?.orderNumber}</DialogTitle><DialogDescription>الطلب والدفعات المرتبطة كما وردت من المصدر</DialogDescription></DialogHeader>{selectedOrder && <OrderCard order={selectedOrder} />}</DialogContent></Dialog>
      </div>}
    </>}
  </section>;
}

function Scope({ workplan, filtered, total }: { workplan: CentralKitchenWorkplan; filtered: number; total: number }) {
  const { summary, metadata } = workplan;
  return <><div className="pw-statbar"><Stat label="طلبات معروضة / مُعادة" value={`${number(filtered)} / ${number(total)}`} /><Stat label="بتاريخ الخطة" value={number(summary.dateCohortOrderCount)} /><Stat label="سابقة غير منتهية" value={number(summary.overdueEarlierOrderCount)} /><Stat label="استثناءات موضوعية" value={number(Object.values(summary.exceptionCounts).reduce((sum, count) => sum + (count || 0), 0))} /><Stat label="دفعات مرتبطة" value={number(summary.linkedBatchCount)} /></div>
    <p className="pw-note">النطاق: الطلبات الحالية للمطبخ المركزي فقط؛ لا يشمل أوامر الإنتاج المتقدمة. العدادات تخص الصفوف المُعادة فقط. جاهزية التخصيص: غير معروفة ولا يتم استنتاجها هنا. الكميات مفصّلة حسب الوحدة والحالة في التفاصيل.</p>
    {(metadata.totalRowsTruncated || metadata.dateCohort.truncated || metadata.overdueEarlier.truncated) && <p role="alert" className="pw-warning">تم بلوغ حد الصفوف؛ النتائج والعدادات قد تكون مقتطعة.</p>}</>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="pw-stat"><strong>{value}</strong><span>{label}</span></div>; }

function OrderCard({ order }: { order: CentralKitchenWorkplanOrder }) {
  const orderLink = `/central-kitchen-orders?orderId=${order.id}`;
  const batchGroups = order.linkedBatches.byUnitAndStatus;
  return <Card><CardContent className="p-4 sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={orderLink} className="font-mono text-sm font-bold text-primary">{order.orderNumber}</Link><Badge variant="outline" className={modeClass[order.inventoryMode]}>{modeText[order.inventoryMode]}</Badge>{order.cohort === "overdue" && <Badge variant="outline">من نطاق سابق لتاريخ الخطة</Badge>}</div><p className="mt-2 font-semibold">{order.source.requestingBranch.name}</p><p className="text-xs text-muted-foreground">الحاجة: {order.neededDate} · حالة الطلب: {workplanStatusLabel(order.rawStatus)}</p></div><div className="rounded-lg bg-muted/55 px-4 py-3 text-right"><p className="text-xs text-muted-foreground">الخطوة التالية · المسؤول</p><p className="mt-1 font-semibold">{order.nextStep.label}</p><p className="text-xs text-muted-foreground">{order.nextStep.owner}</p></div><div className="flex items-start gap-2"><Link href={orderLink} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium">فتح الطلب <ArrowLeft className="mr-1 h-3.5 w-3.5" /></Link>{order.items.some(item => item.approvedRecipe === false) && <Link href="/production-dashboard?tab=recipes" className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium"><UtensilsCrossed className="ml-1 h-3.5 w-3.5" />مراجعة الوصفات</Link>}</div></div>
    <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold text-muted-foreground">كميات الطلب حسب الوحدة</p><div className="space-y-2">{order.items.map(item => <div key={item.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><div className="flex justify-between gap-3"><span className="font-medium">{item.productName}</span><span className="tabular-nums">{number(item.requestedQuantity)} {item.unit}</span></div><p className="mt-1 text-[11px] text-muted-foreground">مجهز: {item.preparedQuantity === null ? "غير مسجل" : `${number(item.preparedQuantity)} ${item.unit}`} · مرسل: {item.dispatchedQuantity === null ? "غير مسجل" : `${number(item.dispatchedQuantity)} ${item.unit}`}</p><PreparationSourceReadout item={item} unit={item.unit} /></div>)}</div></div>
      <div><p className="mb-2 text-xs font-semibold text-muted-foreground">الدفعات المرتبطة وحالة المواد</p>{batchGroups.length ? <div className="space-y-2">{batchGroups.map(group => <div key={`${group.unit}-${group.status}`} className="rounded-lg border px-3 py-2 text-sm"><div className="flex justify-between"><span>{workplanStatusLabel(group.status)} · {group.unit}</span><span>{number(group.quantity)} · {number(group.batchCount)} دفعة</span></div></div>)}<p className="text-[11px] text-muted-foreground">سجل المواد: دفعات لها سجل صرف {number(order.linkedBatches.materialPosting.consumed)} · صرف معلّق {number(order.linkedBatches.materialPosting.pending)} · غير معروف {number(order.linkedBatches.materialPosting.unknown)}. هذا يبيّن وجود سجل دفتر الأستاذ، وليس تسوية مكتملة مع لقطة المخزون. دليل الوصفة: مرتبط {number(order.linkedBatches.recipeEvidence.recipeBacked)} · قديم {number(order.linkedBatches.recipeEvidence.legacy)} · غير معروف {number(order.linkedBatches.recipeEvidence.unknown)}.</p></div> : <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">لا توجد دفعات مرتبطة في المصدر.</p>}</div>
    </div>
    {order.exceptions.length > 0 && <div className="mt-4 border-t border-amber-200 pt-3"><p className="text-xs font-semibold text-amber-900">استثناءات موضوعية من المصدر</p><ul className="mt-2 space-y-1 text-xs text-amber-900">{order.exceptions.map((exception, index) => <li key={`${exception.code}-${exception.itemId || index}`} className="rounded-md bg-amber-50 px-3 py-2"><span className="font-semibold">{exception.objective}: </span>{exception.message}{exception.batchIds?.length ? ` · الدفعات: ${exception.batchIds.join("، ")}` : ""}</li>)}</ul></div>}
  </CardContent></Card>;
}

function PreparationSourceReadout({ item, unit }: { item: unknown; unit: string }) {
  const source = getPreparationSourceReadout(item);
  const row = item as Record<string, unknown>;
  const amount = (value: unknown) => source.status === "recorded"
    ? `${preparationSourceQuantityText(value, source)} ${unit}`
    : preparationSourceQuantityText(value, source);
  const evidence = compactPreparationEvidenceReferences(row.productionFulfillmentEvidence);
  return <div className="mt-1 text-[11px] text-muted-foreground">
    <p>مصدر التجهيز — من المخزون: {amount(row.preparedFromStock)} · من إنتاج مرتبط: {amount(row.preparedFromProduction)}</p>
    {evidence !== "—" && <p className="mt-0.5">دليل الإنتاج المرتبط: {evidence}</p>}
    <p className="mt-0.5">مصدر التجهيز وصف للكميات المجهزة فقط؛ ليس إنتاجاً إضافياً ولا كمية مرسلة.</p>
  </div>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <div className="pw-field"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent></Select></div>; }
function State({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <Card><CardContent className="flex flex-col items-center py-14 text-center"><div className="mb-3 text-muted-foreground">{icon}</div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</CardContent></Card>; }