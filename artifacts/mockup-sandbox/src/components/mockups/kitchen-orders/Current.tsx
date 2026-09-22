import { useMemo, useState } from "react";
import {
  Bell, ChevronLeft, Factory, Filter, Plus, RefreshCw, Search, Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BRANCHES, KITCHEN_ORDERS, PILOT_METRICS, type KitchenOrderFixture, type KitchenOrderStatus } from "./_fixtures";
import { MockAppShell } from "./_Shell";
import "./_group.css";

const STATUS: Record<KitchenOrderStatus, { label: string; className: string }> = {
  cancelled: { label: "ملغي", className: "bg-stone-100 text-stone-700 border-stone-200" },
  requested: { label: "بانتظار الاعتماد", className: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { label: "معتمد", className: "bg-sky-50 text-sky-800 border-sky-200" },
  prepared: { label: "تم التجهيز", className: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  dispatched: { label: "في الطريق", className: "bg-orange-50 text-orange-800 border-orange-200" },
  received: { label: "تم الاستلام", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

const nextStep = (order: KitchenOrderFixture) => {
  if (order.status === "requested") return "التالي: اعتماد الطلب · مسؤول المطبخ";
  if (order.status === "approved") return "التالي: تجهيز البنود · فريق المطبخ";
  if (order.status === "prepared") return "التالي: إرسال الطلب · مسؤول الإرسال";
  if (order.status === "dispatched") return "التالي: تأكيد الاستلام · مسؤول الفرع";
  if (order.status === "received" && order.discrepancyStatus === "open") return "التالي: معالجة الفروقات · العمليات";
  if (order.status === "received") return "مسار الطلب مكتمل";
  return "طلب ملغي — محفوظ في السجل";
};

function StatusBadge({ status }: { status: KitchenOrderStatus }) {
  const info = STATUS[status];
  return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", info.className)}>{info.label}</Badge>;
}

function MetricTile({ label, value, tone = "normal" }: { label: string; value: string | number; tone?: "normal" | "danger" | "warning" }) {
  return <div className={cn("rounded-lg border bg-background p-3", tone === "danger" && "border-red-200", tone === "warning" && "border-amber-200")}><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-1 text-xl font-bold", tone === "danger" && "text-red-700", tone === "warning" && "text-amber-700")}>{value}</p></div>;
}

function StageTime({ label, value }: { label: string; value: number }) {
  return <div><span className="text-muted-foreground">متوسط {label}: </span><strong>{value} ساعة</strong></div>;
}

export function Current() {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState("all");
  const [inventoryMode, setInventoryMode] = useState("all");
  const [pilotDays, setPilotDays] = useState("30");

  const filtered = useMemo(() => KITCHEN_ORDERS.filter(order =>
    (branch === "all" || order.requestBranchId === branch) &&
    (status === "all" || order.status === status) &&
    (inventoryMode === "all" || order.inventoryMode === inventoryMode) &&
    (!search.trim() || `${order.orderNumber} ${order.requestBranchName} ${order.centralKitchenName}`.includes(search.trim()))
  ), [search, branch, status, inventoryMode]);

  return <div className="kitchen-orders-scope min-h-screen bg-background text-foreground">
    <MockAppShell>
      <main dir="rtl" className="page-container space-y-5 pb-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><Factory className="h-5 w-5" /></div><div><h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">طلبات المطبخ المركزي</h1><p className="mt-0.5 text-sm text-gray-500">تتبّع احتياج الفروع من الطلب حتى الاستلام</p></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm"><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button><Button variant="outline" size="sm"><Settings className="ml-2 h-4 w-4" />مسؤولو الفروع</Button><Button size="sm"><Plus className="ml-2 h-4 w-4" />طلب جديد</Button></div>
        </div>

        <section className="rounded-lg border bg-sky-50/50 p-4 text-sm" aria-label="مواعيد الطلب اليومية"><h2 className="font-semibold">مواعيد الطلب اليومية — بتوقيت السعودية</h2><div className="mt-2 grid gap-2 sm:grid-cols-3"><p><strong>5 مساءً:</strong> آخر موعد لطلبات اليوم التالي.</p><p><strong>7 مساءً:</strong> موعد مراجعة المطبخ لطلبات الغد.</p><p><strong>7 صباحاً:</strong> وقت التسليم الافتراضي في يوم الحاجة.</p></div><p className="mt-2 text-xs text-muted-foreground">الطلب المتأخر مسموح مع تنبيه. إرسال الطلب والاعتماد يتمان يدوياً؛ لا تُنشأ طلبات أو كميات تلقائياً.</p></section>

        <Card className="border-violet-200 bg-gradient-to-l from-violet-50/70 to-background"><CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">مؤشرات التجربة والتوسع</h2><p className="text-xs text-muted-foreground">قياس دورة الطلب وجودة التوريد قبل تفعيل المخزون الفعلي.</p></div><Select value={pilotDays} onValueChange={setPilotDays}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">آخر 7 أيام</SelectItem><SelectItem value="30">آخر 30 يوماً</SelectItem><SelectItem value="90">آخر 90 يوماً</SelectItem></SelectContent></Select></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricTile label="إجمالي الطلبات" value={PILOT_METRICS.totalOrders} /><MetricTile label="متأخرة عن الحاجة" value={PILOT_METRICS.overdueOrders} tone="danger" /><MetricTile label="فروقات مفتوحة" value={PILOT_METRICS.openDiscrepancies} tone="warning" /><MetricTile label="متوسط اكتمال البنود" value={`${PILOT_METRICS.fulfillmentRate}%`} /><MetricTile label="طلبات بها فروقات" value={`${PILOT_METRICS.discrepancyRate}%`} /></div>
          <div className="mt-4 grid gap-2 border-t pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><StageTime label="الاعتماد" value={PILOT_METRICS.averageStageHours.approval} /><StageTime label="التجهيز" value={PILOT_METRICS.averageStageHours.preparation} /><StageTime label="الإرسال" value={PILOT_METRICS.averageStageHours.dispatch} /><StageTime label="التوصيل" value={PILOT_METRICS.averageStageHours.delivery} /></div><div className="mt-3 text-xs text-muted-foreground">السجل التجريبي: {PILOT_METRICS.shadowLedger.entryCount} حركة · {PILOT_METRICS.shadowLedger.summary}</div>
        </CardContent></Card>

        <Card className="border-border/80 shadow-sm"><CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12"><div className="relative md:col-span-5"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} className="h-10 pr-9" placeholder="ابحث برقم الطلب أو الفرع..." /></div>
            <Select value={branch} onValueChange={setBranch}><SelectTrigger className="h-10 md:col-span-4"><SelectValue placeholder="فرع المصدر" /></SelectTrigger><SelectContent><SelectItem value="all">كل الفروع</SelectItem>{BRANCHES.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 md:col-span-3"><Filter className="ml-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="كل الحالات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{Object.entries(STATUS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select>
            <Select value={inventoryMode} onValueChange={setInventoryMode}><SelectTrigger className="h-10 md:col-span-3"><SelectValue placeholder="كل أوضاع المخزون" /></SelectTrigger><SelectContent><SelectItem value="all">كل أوضاع المخزون</SelectItem><SelectItem value="real">فعلي</SelectItem><SelectItem value="shadow">ظلّي — تشغيلي</SelectItem><SelectItem value="unknown">غير محدد / طلب قديم</SelectItem></SelectContent></Select>
          </div><p className="mt-2 text-xs text-muted-foreground">يُطبّق نطاق الفرع والحالة على الخادم، بينما يُصفّى وضع المخزون محلياً على كامل قائمة الطلبات غير المرقّمة.</p>
        </CardContent></Card>

        <div className="rounded-lg border border-sky-200 bg-sky-50/65 px-3 py-2.5"><div className="flex items-start gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-sky-800" /><div className="min-w-0 flex-1"><p className="text-xs font-medium text-sky-950">تابع تحديثات الطلب من جهازك</p><p className="mt-1 text-[11px] leading-5 text-sky-900">فعّل التنبيه الاختياري لمعرفة الاعتماد والتجهيز والإرسال والاستلام.</p><Button type="button" size="sm" variant="outline" className="mt-2 min-h-9 border-sky-300 bg-background">تفعيل التنبيهات</Button></div></div></div>

        <section className="space-y-3 md:hidden" aria-label="قائمة الطلبات">{filtered.map(order => <button key={order.id} type="button" className="block min-h-32 w-full rounded-xl border border-border/80 bg-card p-4 text-right shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="block font-mono text-sm font-bold text-primary">{order.orderNumber}</span><span className="mt-1 block truncate text-sm font-medium">{order.requestBranchName} <span className="font-normal text-muted-foreground">←</span> {order.centralKitchenName}</span></div><StatusBadge status={order.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs"><div><span className="block text-muted-foreground">موعد الحاجة</span><span className="mt-0.5 block font-medium">{new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(order.neededDate))} · {order.neededTime}</span></div><div><span className="block text-muted-foreground">البنود</span><span className="mt-0.5 block font-medium">{order.itemCount} بنود</span></div></div><div className="mt-2">{order.isLate && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">أُرسل بعد الموعد</Badge>}<span className="mt-1 block text-[11px] text-muted-foreground">{nextStep(order)}</span></div></button>)}</section>

        <Card className="hidden overflow-hidden border-border/80 md:block"><div className="overflow-x-auto"><Table><TableHeader className="bg-muted/40"><TableRow><TableHead className="text-right">رقم الطلب</TableHead><TableHead className="text-right">من</TableHead><TableHead className="text-right">إلى المطبخ</TableHead><TableHead className="text-right">المطلوب</TableHead><TableHead className="text-right">البنود</TableHead><TableHead className="text-right">الحالة</TableHead><TableHead className="text-left"> </TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(order => <TableRow key={order.id} className="cursor-pointer hover:bg-muted/35"><TableCell className="font-mono font-semibold text-primary">{order.orderNumber}</TableCell><TableCell>{order.requestBranchName}</TableCell><TableCell>{order.centralKitchenName}</TableCell><TableCell><span className="text-sm">{new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(order.neededDate))} <span className="text-muted-foreground">{order.neededTime}</span></span></TableCell><TableCell>{order.itemCount} بنود</TableCell><TableCell><StatusBadge status={order.status} />{order.isLate && <Badge variant="outline" className="mr-1 border-amber-300 bg-amber-50 text-amber-900">أُرسل بعد الموعد</Badge>}<span className={cn("mt-1 block text-[11px]", order.status === "received" && order.discrepancyStatus !== "open" ? "text-emerald-700" : "text-muted-foreground")}>{nextStep(order)}</span>{order.inventoryMode === "shadow" && <span className="block text-[10px] text-amber-700">ظلّي — تشغيلي فقط، لا حركة مخزون فعلية</span>}{order.inventoryMode === "unknown" && <span className="block text-[10px] text-muted-foreground">وضع المخزون غير محدد — طلب قديم</span>}</TableCell><TableCell className="text-left"><Button variant="ghost" size="icon" aria-label="عرض الطلب"><ChevronLeft className="h-4 w-4" /></Button></TableCell></TableRow>)}
        </TableBody></Table></div></Card>
      </main>
    </MockAppShell>
  </div>;
}

export default Current;