import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ProductionPlanningCheck, ProductionPlanningResponse, ProductionPlanningRow } from "@shared/production-planning";
import { AlertTriangle, ExternalLink, Factory, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterPlanningRows, planningItemQuantities, planningIssueLabel, planningStatusLabel } from "./production-planning-model";

type Props = {
  mode: "settings" | "planning";
  kitchens: { id: string; name: string }[];
  kitchenId: string;
  onKitchenChange: (id: string) => void;
  date: string;
  onDateChange: (date: string) => void;
};

const sourceLabel = { central_request: "طلب فرع", advanced_plan: "أمر إنتاج" } as const;
const checkStyle = {
  pass: { label: "متحقق", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  warning: { label: "يحتاج مراجعة", className: "border-amber-200 bg-amber-50 text-amber-900" },
  unknown: { label: "غير متحقق", className: "border-slate-200 bg-slate-50 text-slate-700" },
};
const number = new Intl.NumberFormat("ar-SA-u-nu-latn");
const modeLabel = { real: "مخزون فعلي", shadow: "تشغيل ظلّي", paused: "تشغيل متوقف", unknown: "وضع غير معروف" } as const;

export function ProductionPlanning({ mode, kitchens, kitchenId, onKitchenChange, date, onDateChange }: Props) {
  const [source, setSource] = useState<"all" | "central_request" | "advanced_plan">("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const planning = useQuery<ProductionPlanningResponse>({
    queryKey: ["/api/production/planning", kitchenId, date],
    queryFn: async () => {
      const response = await fetch(`/api/production/planning?kitchenId=${encodeURIComponent(kitchenId)}&date=${encodeURIComponent(date)}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "لا تملك صلاحية عرض بيانات هذا المطبخ." : response.status === 400 ? "تحقق من المطبخ والتاريخ المحددين." : `تعذر تحميل المراجعة والتخطيط (${response.status}).`);
      return response.json();
    },
    enabled: Boolean(kitchenId && /^\d{4}-\d{2}-\d{2}$/.test(date)),
    staleTime: 30_000,
  });
  const data = planning.data?.kitchen.id === kitchenId && planning.data.date === date ? planning.data : undefined;
  const filtered = useMemo(() => filterPlanningRows(data?.rows || [], { source, status, search }), [data, source, status, search]);
  const statuses = useMemo(() => [...new Set((data?.rows || []).map(row => row.status))].sort(), [data]);

  return <section dir="rtl" className="space-y-4" aria-label={mode === "settings" ? "مراجعة إعدادات الإنتاج" : "التخطيط الموحد"}>
    <Card className="border-violet-200 bg-violet-50/40"><CardContent className="space-y-4 p-4 sm:p-6">
      <div><h2 className="text-xl font-bold">{mode === "settings" ? "مراجعة إعدادات الإنتاج" : "التخطيط الموحد للإنتاج"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">عرض للقراءة فقط للبيانات المحفوظة حالياً، وليس اعتماداً للإعدادات أو خطة تنفيذ. لا تخصيص ولا تعديل للمخزون أو الطلبات من هذه الشاشة. لا تُستنتج جاهزية المخزون المباشر أو مصدر المبيعات.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1 sm:max-w-64"><Label htmlFor={`planning-kitchen-${mode}`}>المطبخ المركزي</Label><Select value={kitchenId || undefined} onValueChange={onKitchenChange}><SelectTrigger id={`planning-kitchen-${mode}`} className="mt-1"><SelectValue placeholder="اختر المطبخ" /></SelectTrigger><SelectContent>{kitchens.map(kitchen => <SelectItem key={kitchen.id} value={kitchen.id}>{kitchen.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[170px]"><Label htmlFor={`planning-date-${mode}`}>تاريخ الخطة (توقيت الرياض)</Label><Input id={`planning-date-${mode}`} className="mt-1" type="date" value={date} onChange={event => onDateChange(event.target.value)} /></div>
        <Button type="button" variant="outline" onClick={() => planning.refetch()} disabled={!kitchenId || !date || planning.isFetching} aria-label="تحديث المراجعة والتخطيط"><RefreshCw className={`ml-2 h-4 w-4 ${planning.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
      </div>
    </CardContent></Card>
    {!kitchenId ? <Notice title="اختر مطبخاً مركزياً" detail="اختر المطبخ لعرض البيانات الخاصة به." /> :
      !date ? <Notice title="حدد تاريخ الخطة" detail="اختر تاريخاً صالحاً لعرض البيانات." /> :
      planning.isLoading || (planning.isFetching && !data) ? <div role="status" className="rounded-lg border p-6 text-sm text-muted-foreground">جارٍ تحميل بيانات {kitchens.find(k => k.id === kitchenId)?.name || "المطبخ"} بتاريخ {date}…</div> :
      planning.isError ? <Notice title="تعذر تحميل بيانات المطبخ والتاريخ المحددين" detail={planning.error instanceof Error ? planning.error.message : "تحقق من الاتصال وحاول مرة أخرى."} action={<Button variant="outline" onClick={() => planning.refetch()}>إعادة المحاولة</Button>} /> :
      !data ? <Notice title="لا توجد بيانات لهذا النطاق" detail="أعد تحميل الصفحة أو اختر مطبخاً وتاريخاً آخرين." /> :
      mode === "settings" ? <SettingsReview data={data} /> :
      <div className="space-y-4">
        <Scope data={data} />
        <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div><Label htmlFor="planning-source">المصدر</Label><Select value={source} onValueChange={value => setSource(value as typeof source)}><SelectTrigger id="planning-source" className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المصادر</SelectItem><SelectItem value="central_request">طلبات الفروع</SelectItem><SelectItem value="advanced_plan">أوامر الإنتاج</SelectItem></SelectContent></Select></div>
          <div><Label htmlFor="planning-status">الحالة</Label><Select value={status} onValueChange={setStatus}><SelectTrigger id="planning-status" className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{statuses.map(value => <SelectItem key={value} value={value}>{planningStatusLabel(value)}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="planning-search">بحث بالرقم أو المصدر أو الصنف</Label><Input id="planning-search" className="mt-1" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث في الصفوف المُعادة" /></div>
        </CardContent></Card>
        <p role="status" className="text-sm text-muted-foreground">المعروض {number.format(filtered.length)} من {number.format(data.rows.length)} سجل مُعاد. النتائج المفلترة لا تمثل إجمالي الطلبات خارج النطاق.</p>
        {!filtered.length ? <Notice title="لا توجد سجلات ضمن هذا النطاق" detail="غيّر عوامل التصفية أو المطبخ أو التاريخ. لا يعني ذلك عدم وجود طلبات خارج النطاق." /> :
          <div className="space-y-4">{filtered.map(row => <PlanningRow key={row.key} row={row} />)}</div>}
      </div>}
  </section>;
}

function Notice({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <Card><CardContent className="flex items-start gap-3 p-6"><Factory aria-hidden="true" className="mt-1 h-5 w-5 text-muted-foreground" /><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{detail}</p>{action && <div className="mt-3">{action}</div>}</div></CardContent></Card>;
}

function SettingsReview({ data }: { data: ProductionPlanningResponse }) {
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">مراجعة للمطبخ {data.kitchen.name} بتاريخ {data.date}. فحوص الأصناف والوصفات تخص البنود المُعادة فقط، وليست تدقيقاً للكتالوج الكامل{data.metadata.truncated ? "؛ النتائج مقتطعة أيضاً" : ""}. «متحقق» يصف فحصاً محدداً فقط وليس موافقة أو تأكيد جاهزية التشغيل. حالة تخصيص المواد: غير معروفة.</p>
    {data.checks.length ? <div className="grid gap-3 md:grid-cols-2">{data.checks.map(check => <CheckCard key={check.id} check={check} configuration={data.metadata.configuration} />)}</div> :
      <Notice title="لا تتوفر فحوص إعدادات" detail="لم تُرجع الخدمة فحوصاً لهذا المطبخ والتاريخ؛ لا يمكن استنتاج حالة الإعدادات." />}
    <p className="text-xs text-muted-foreground">البيانات تعكس الحالة المحفوظة وقت التوليد ({data.metadata.generatedAt}) لا لقطة تاريخية بتاريخ الخطة؛ لا تتحقق هذه المراجعة من المخزون الحي أو مصدر المبيعات.</p>
  </div>;
}

function CheckCard({ check, configuration }: { check: ProductionPlanningCheck; configuration: ProductionPlanningResponse["metadata"]["configuration"] }) {
  const style = checkStyle[check.status];
  const relatedHref = check.actionHref || (check.id === "recipe_evidence" ? "/central-kitchen-recipes" : undefined);
  const detail = check.id === "configuration_mode"
    ? `وضع تشغيل المطبخ الحالي: ${modeLabel[configuration.inventoryMode]} (${configuration.source === "runtime_default_shadow_no_row" ? "الوضع الافتراضي عند غياب سجل إعدادات" : "من سجل إعدادات التشغيل"}). هذا لا يغيّر وضع الطلبات التاريخية.`
    : check.detail;
  return <Card><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span>{check.title}</span><Badge variant="outline" className={style.className}>{style.label}</Badge></CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail}</p>{relatedHref && <Link href={relatedHref} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">فتح الصفحة ذات الصلة <ExternalLink className="h-3.5 w-3.5" /></Link>}</CardContent></Card>;
}

function Scope({ data }: { data: ProductionPlanningResponse }) {
  const { bySource } = data.summary;
  return <Card><CardContent className="space-y-3 p-4">
    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      <p><strong>طلبات الفروع:</strong> بتاريخ الخطة {number.format(bySource.central_request.date)} · سابقة غير منتهية {number.format(bySource.central_request.overdue)}</p>
      <p><strong>أوامر الإنتاج:</strong> بتاريخ الخطة {number.format(bySource.advanced_plan.date)} · سابقة غير منتهية {number.format(bySource.advanced_plan.overdue)}</p>
    </div>
    <p className="text-xs text-muted-foreground">عدادات الصفوف المُعادة لكل مصدر على حدة؛ لا تجمع كميات مصادر أو وحدات مختلفة. السابق ضمن فترة البحث {number.format(data.metadata.cohorts.central_request.overdue.lookbackDays)} يومًا. التاريخ الفعلي بالرياض: {data.metadata.actualRiyadhToday}.</p>
    {data.metadata.truncated && <p role="alert" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />بعض النتائج مقتطعة بسبب حد {number.format(data.metadata.rowLimitPerSourceAndCohort)} صف لكل مصدر وفترة؛ العدادات تخص المُعاد فقط ولا تمثل إجمالياً كاملاً.</p>}
    <p className="text-xs text-muted-foreground">الكميات المكتملة والجارية تعتمد على دفعات إنتاج مرتبطة صراحةً فقط. غير متحقق لا يساوي صفرًا، ولا يُستنتج عجز صافٍ أو توافر مخزون.</p>
  </CardContent></Card>;
}

function PlanningRow({ row }: { row: ProductionPlanningRow }) {
  const executionHref = row.source === "advanced_plan" ? "/daily-production" : "/production-dashboard?tab=operations";
  return <Card><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center gap-2 text-base"><Badge variant="secondary">{sourceLabel[row.source]}</Badge><span>{row.number}</span><Badge variant="outline">{planningStatusLabel(row.status)}</Badge>{row.source === "central_request" && <Badge variant="outline" title="وضع المخزون المحفوظ مع هذا الطلب؛ قد يختلف عن إعدادات المطبخ الحالية">{row.inventoryMode === null ? modeLabel.unknown : modeLabel[row.inventoryMode]} · وضع الطلب</Badge>}{row.cohort === "overdue" && <Badge variant="outline" className="border-amber-300 text-amber-800">سابق غير منتهٍ</Badge>}</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">المصدر: {row.originLabel} · {row.cohort === "date" ? "بتاريخ الخطة" : "من تاريخ سابق"}: <span dir="ltr">{row.date}</span></p>
    <div className="flex flex-wrap gap-3 text-sm"><Link href={row.directLink} className="font-medium text-primary underline underline-offset-4">فتح التفاصيل الأصلية</Link><Link href={executionHref} className="font-medium text-primary underline underline-offset-4">فتح شاشة التنفيذ</Link></div>
    {row.issues.length > 0 && <ul className="space-y-1 text-sm text-amber-900">{row.issues.map((issue, index) => <li key={index} className="rounded-md bg-amber-50 p-2">{planningIssueLabel(issue)}</li>)}</ul>}
    {!row.items.length ? <p className="text-sm text-muted-foreground">لا توجد بنود مُعادة لهذا السجل.</p> :
      <div className="grid gap-2 lg:grid-cols-2">{row.items.map(item => {
        const quantities = planningItemQuantities(item);
        return <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="font-semibold">{item.productName} <span className="font-normal text-muted-foreground">· {item.unit}</span></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">{([["مخطط", quantities.planned], ["مكتمل", quantities.completed], ["جارٍ", quantities.inProgress], ["متبقٍ", quantities.remaining]] as const).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
          {item.issues.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-900">{item.issues.map((issue, index) => <li key={index}>{planningIssueLabel(issue)}</li>)}</ul>}
        </div>;
      })}</div>}
  </CardContent></Card>;
}