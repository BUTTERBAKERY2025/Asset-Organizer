import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ProductionPlanningCheck, ProductionPlanningResponse, ProductionPlanningRow } from "@shared/production-planning";
import { AlertTriangle, ExternalLink, Factory, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterPlanningRows, planningItemQuantities, planningIssueLabel, planningPage, planningStatusLabel } from "./production-planning-model";
import { CoverageScope, ItemCoverage } from "./production-coverage";
import workspaceStyles from "./planning-workspace.css?raw";

type Props = {
  embedded?: boolean;
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

export function ProductionPlanning({ mode, kitchens, kitchenId, onKitchenChange, date, onDateChange, embedded = false }: Props) {
  const [source, setSource] = useState<"all" | "central_request" | "advanced_plan">("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [checkSearch, setCheckSearch] = useState("");
  const [checkStatus, setCheckStatus] = useState("all");
  const [checkPage, setCheckPage] = useState(1);
  const [scopeKey, setScopeKey] = useState(`${kitchenId}:${date}:${mode}`);
  const currentScope = `${kitchenId}:${date}:${mode}`;
  if (scopeKey !== currentScope) { setScopeKey(currentScope); setSelectedKey(null); setSelectedCheck(null); setPage(1); setCheckPage(1); }
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
  const { pageItems, currentPage, totalPages } = planningPage(filtered, page);
  const checks = useMemo(() => (data?.checks || []).filter(check =>
    (checkStatus === "all" || check.status === checkStatus) &&
    (!checkSearch.trim() || `${check.title} ${check.detail}`.toLocaleLowerCase("ar").includes(checkSearch.trim().toLocaleLowerCase("ar")))
  ), [data, checkStatus, checkSearch]);
  const checkPagination = planningPage(checks, checkPage);
  const selectedRow = data?.rows.find(row => row.key === selectedKey);
  const check = data?.checks.find(item => item.id === selectedCheck);
  const changeScope = (change: () => void) => { setSelectedKey(null); setSelectedCheck(null); setPage(1); setCheckPage(1); change(); };

  return <section dir="rtl" className="planning-workspace space-y-3" aria-label={mode === "settings" ? "مراجعة إعدادات الإنتاج" : "التخطيط الموحد"}><style>{workspaceStyles}</style>
    <div className="pw-shell"><div className="pw-top"><span className="pw-kicker">{mode === "settings" ? "مراجعة التشغيل" : "مكتب التخطيط"}</span><h2>{mode === "settings" ? "مراجعة إعدادات الإنتاج" : "التخطيط الموحد للإنتاج"}</h2><p>عرض للقراءة فقط للحالة المحفوظة حالياً؛ لا يُعتمد منه التنفيذ أو تخصيص المخزون. جاهزية التخصيص غير معروفة.</p></div>
      <div className="pw-toolbar">
        {!embedded && <><div className="pw-field"><Label htmlFor={`planning-kitchen-${mode}`}>المطبخ المركزي</Label><Select value={kitchenId || ""} onValueChange={value => changeScope(() => onKitchenChange(value))}><SelectTrigger id={`planning-kitchen-${mode}`}><SelectValue placeholder="اختر المطبخ" /></SelectTrigger><SelectContent>{kitchens.map(kitchen => <SelectItem key={kitchen.id} value={kitchen.id}>{kitchen.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="pw-field"><Label htmlFor={`planning-date-${mode}`}>التاريخ · الرياض</Label><Input id={`planning-date-${mode}`} type="date" value={date} onChange={event => changeScope(() => onDateChange(event.target.value))} /></div></>}
        {mode === "planning" ? <>
          <div className="pw-field pw-search"><Label htmlFor="planning-search">بحث في الصفوف المُعادة</Label><Input id="planning-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="رقم أو مصدر أو صنف" /></div>
          <div className="pw-field"><Label htmlFor="planning-source">المصدر</Label><Select value={source} onValueChange={value => { setSource(value as typeof source); setPage(1); }}><SelectTrigger id="planning-source"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المصادر</SelectItem><SelectItem value="central_request">طلبات الفروع</SelectItem><SelectItem value="advanced_plan">أوامر الإنتاج</SelectItem></SelectContent></Select></div>
          <div className="pw-field"><Label htmlFor="planning-status">الحالة</Label><Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}><SelectTrigger id="planning-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{statuses.map(value => <SelectItem key={value} value={value}>{planningStatusLabel(value)}</SelectItem>)}</SelectContent></Select></div>
        </> : <>
          <div className="pw-field pw-search"><Label htmlFor="check-search">بحث في الفحوص</Label><Input id="check-search" type="search" value={checkSearch} onChange={event => { setCheckSearch(event.target.value); setCheckPage(1); }} placeholder="عنوان أو وصف الفحص" /></div>
          <div className="pw-field"><Label htmlFor="check-status">نتيجة الفحص</Label><Select value={checkStatus} onValueChange={value => { setCheckStatus(value); setCheckPage(1); }}><SelectTrigger id="check-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل النتائج</SelectItem>{Object.entries(checkStyle).map(([value, style]) => <SelectItem key={value} value={value}>{style.label}</SelectItem>)}</SelectContent></Select></div>
        </>}
        {!embedded && <Button type="button" size="sm" variant="outline" onClick={() => planning.refetch()} disabled={!kitchenId || !date || planning.isFetching} aria-label="تحديث المراجعة والتخطيط"><RefreshCw className={`ml-2 h-4 w-4 ${planning.isFetching ? "animate-spin" : ""}`} />تحديث</Button>}
      </div>
    </div>
    {!kitchenId ? <Notice title="اختر مطبخاً مركزياً" detail="اختر المطبخ لعرض البيانات الخاصة به." /> :
      !date ? <Notice title="حدد تاريخ الخطة" detail="اختر تاريخاً صالحاً لعرض البيانات." /> :
      planning.isLoading || (planning.isFetching && !data) ? <div role="status" className="rounded-lg border p-6 text-sm text-muted-foreground">جارٍ تحميل بيانات {kitchens.find(k => k.id === kitchenId)?.name || "المطبخ"} بتاريخ {date}…</div> :
      planning.isError ? <Notice title="تعذر تحميل بيانات المطبخ والتاريخ المحددين" detail={planning.error instanceof Error ? planning.error.message : "تحقق من الاتصال وحاول مرة أخرى."} action={<Button variant="outline" onClick={() => planning.refetch()}>إعادة المحاولة</Button>} /> :
      !data ? <Notice title="لا توجد بيانات لهذا النطاق" detail="أعد تحميل الصفحة أو اختر مطبخاً وتاريخاً آخرين." /> :
       mode === "settings" ? <div className="pw-shell">
         <div className="pw-statbar"><Stat label="فحوص معروضة" value={`${number.format(checks.length)} / ${number.format(data.checks.length)}`} /><Stat label="متحقق" value={number.format(data.checks.filter(c => c.status === "pass").length)} /><Stat label="يحتاج مراجعة" value={number.format(data.checks.filter(c => c.status === "warning").length)} /><Stat label="غير متحقق" value={number.format(data.checks.filter(c => c.status === "unknown").length)} /></div>
         <p className="pw-note">فحوص الأصناف والوصفات تخص البنود المُعادة فقط، وليست تدقيقاً للكتالوج الكامل{data.metadata.truncated ? "؛ النتائج مقتطعة أيضاً" : ""}. «متحقق» يصف فحصاً محدداً فقط وليس موافقة أو تأكيد جاهزية التشغيل. حالة تخصيص المواد: غير معروفة. البيانات محفوظة وقت التوليد ({data.metadata.generatedAt}) لا لقطة تاريخية.</p>
         {data.metadata.truncated && <p className="pw-warning">النتائج مقتطعة؛ لا تمثل جميع سجلات النظام.</p>}
         <div className="pw-head pw-check"><span>الفحص</span><span>النتيجة</span><span>الملاحظة</span><span>التفاصيل</span></div>
         {!checks.length ? <Notice title="لا توجد فحوص مطابقة" detail="لم تُرجع الخدمة فحوصاً أو لا توجد نتائج لعوامل التصفية الحالية؛ لا يمكن استنتاج حالة الإعدادات." /> : checkPagination.pageItems.map(item => <div key={item.id} className="pw-row pw-check"><strong className="pw-primary pw-ellipsis">{item.title}</strong><Badge variant="outline" className={checkStyle[item.status].className}>{checkStyle[item.status].label}</Badge><span className="pw-ellipsis" title={item.id === "configuration_mode" ? modeLabel[data.metadata.configuration.inventoryMode] : item.detail}>{item.id === "configuration_mode" ? `وضع التشغيل الحالي: ${modeLabel[data.metadata.configuration.inventoryMode]}` : item.detail}</span><Button size="sm" variant="outline" onClick={() => setSelectedCheck(item.id)}>عرض</Button></div>)}
         <Pager current={checkPagination.currentPage} total={checkPagination.totalPages} count={checks.length} onChange={setCheckPage} />
         <Dialog open={Boolean(check)} onOpenChange={open => !open && setSelectedCheck(null)}><DialogContent dir="rtl" className="max-w-2xl"><DialogHeader><DialogTitle>{check?.title}</DialogTitle><DialogDescription>نتيجة الفحص المحفوظة لهذا النطاق فقط</DialogDescription></DialogHeader>{check && <CheckDetail check={check} configuration={data.metadata.configuration} />}</DialogContent></Dialog>
       </div> :
       <div className="space-y-3">
         <div className="pw-shell"><Scope data={data} />
         <div className="pw-statbar"><Stat label="طلبات بتاريخ الخطة" value={number.format(data.summary.bySource.central_request.date)} /><Stat label="طلبات سابقة" value={number.format(data.summary.bySource.central_request.overdue)} /><Stat label="أوامر بتاريخ الخطة" value={number.format(data.summary.bySource.advanced_plan.date)} /><Stat label="أوامر سابقة" value={number.format(data.summary.bySource.advanced_plan.overdue)} /></div>
         <p role="status" className="pw-note">المعروض {number.format(filtered.length)} من {number.format(data.rows.length)} سجل مُعاد. النتائج المفلترة لا تمثل إجمالي الطلبات خارج النطاق؛ لا تُجمع كميات وحدات أو مصادر مختلفة.</p>
         <div className="pw-head"><span>الرقم / المصدر</span><span>الجهة</span><span>الحالة</span><span>التاريخ</span><span>الملخص</span><span>التفاصيل</span></div>
         {!filtered.length ? <Notice title="لا توجد سجلات ضمن هذا النطاق" detail="غيّر عوامل التصفية أو المطبخ أو التاريخ. لا يعني ذلك عدم وجود طلبات خارج النطاق." /> :
           pageItems.map(row => <div key={row.key} className="pw-row">
             <div className="pw-main"><span className="pw-primary">{row.number}</span><span className="pw-sub">{sourceLabel[row.source]}{row.cohort === "overdue" ? " · سابق غير منتهٍ" : ""}</span></div>
             <span className="pw-ellipsis" title={row.originLabel}>{row.originLabel}</span>
             <span>{planningStatusLabel(row.status)}</span><span dir="ltr">{row.date}</span>
             <div><span className="pw-ellipsis" title={row.items.map(item => item.productName).join("، ")}>{row.items.length ? row.items.map(item => item.productName).join("، ") : "لا توجد بنود مُعادة"}</span>{row.source === "central_request" && <span className="pw-sub">{row.inventoryMode === null ? modeLabel.unknown : modeLabel[row.inventoryMode]} · وضع الطلب</span>}{row.issues.length > 0 && <span className="pw-sub text-amber-800">{planningIssueLabel(row.issues[0])}{row.issues.length > 1 ? ` · +${row.issues.length - 1}` : ""}</span>}</div>
             <Button className="pw-action" size="sm" variant="outline" onClick={() => setSelectedKey(row.key)}>عرض</Button>
           </div>)}
         <Pager current={currentPage} total={totalPages} count={filtered.length} onChange={setPage} /></div>
        <CoverageScope metadata={data.metadata.coverage} />
         <Dialog open={Boolean(selectedRow)} onOpenChange={open => !open && setSelectedKey(null)}><DialogContent dir="rtl" className="max-w-3xl"><DialogHeader><DialogTitle>تفاصيل {selectedRow?.number}</DialogTitle><DialogDescription>بيانات السجل المحفوظة والروابط الأصلية؛ لا تُستنتج جاهزية المخزون.</DialogDescription></DialogHeader>{selectedRow && <PlanningRow row={selectedRow} />}</DialogContent></Dialog>
      </div>}
  </section>;
}

function Notice({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <Card><CardContent className="flex items-start gap-3 p-6"><Factory aria-hidden="true" className="mt-1 h-5 w-5 text-muted-foreground" /><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{detail}</p>{action && <div className="mt-3">{action}</div>}</div></CardContent></Card>;
}

function CheckDetail({ check, configuration }: { check: ProductionPlanningCheck; configuration: ProductionPlanningResponse["metadata"]["configuration"] }) {
  const style = checkStyle[check.status];
  const relatedHref = check.actionHref || (check.id === "recipe_evidence" ? "/central-kitchen-recipes" : undefined);
  const detail = check.id === "configuration_mode"
    ? `وضع تشغيل المطبخ الحالي: ${modeLabel[configuration.inventoryMode]} (${configuration.source === "runtime_default_shadow_no_row" ? "الوضع الافتراضي عند غياب سجل إعدادات" : "من سجل إعدادات التشغيل"}). هذا لا يغيّر وضع الطلبات التاريخية.`
    : check.detail;
  return <Card><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span>{check.title}</span><Badge variant="outline" className={style.className}>{style.label}</Badge></CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail}</p>{relatedHref && <Link href={relatedHref} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">فتح الصفحة ذات الصلة <ExternalLink className="h-3.5 w-3.5" /></Link>}</CardContent></Card>;
}

function Scope({ data }: { data: ProductionPlanningResponse }) {
  return <><p className="pw-note">عدادات الصفوف المُعادة لكل مصدر على حدة. السابق ضمن فترة البحث {number.format(data.metadata.cohorts.central_request.overdue.lookbackDays)} يومًا. التاريخ الفعلي بالرياض: {data.metadata.actualRiyadhToday}. المكتمل والجاري من دفعات مرتبطة صراحة فقط؛ غير متحقق لا يساوي صفرًا.</p>
    {data.metadata.truncated && <p role="alert" className="pw-warning flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />بعض النتائج مقتطعة بسبب حد {number.format(data.metadata.rowLimitPerSourceAndCohort)} صف لكل مصدر وفترة؛ العدادات تخص المُعاد فقط ولا تمثل إجمالياً كاملاً.</p>}</>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="pw-stat"><strong>{value}</strong><span>{label}</span></div>; }
function Pager({ current, total, count, onChange }: { current: number; total: number; count: number; onChange: (page: number) => void }) {
  return <div className="pw-foot"><span>عدد النتائج {number.format(count)} · الصفحة {number.format(current)} من {number.format(total)}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={current <= 1} onClick={() => onChange(current - 1)}>السابق</Button><Button size="sm" variant="outline" disabled={current >= total} onClick={() => onChange(current + 1)}>التالي</Button></div></div>;
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
          {row.source === "advanced_plan" && <div className="mt-2 text-xs">{item.requestLink ? <>
            <Link href={`/central-kitchen-orders?orderId=${item.requestLink.requestOrderId}`} className="font-medium text-primary underline">طلب الفرع #{item.requestLink.requestOrderId} · البند #{item.requestLink.requestItemId}</Link>
            <p>مرتبط: {number.format(item.requestLink.allocatedQuantity)} {item.unit} من طلب {number.format(item.requestLink.requestedQuantity)} {item.unit} · السبب: {item.requestLink.reason}</p>
          </> : <p className="text-muted-foreground">خطة مستقلة: لا ربط صريح بطلب فرع؛ سبب السجلات التاريخية غير المرتبطة غير معروف.</p>}</div>}
          {row.source === "central_request" && item.linkedAdvancedPlans && <div className="mt-2 text-xs">{item.linkedAdvancedPlans.length ? item.linkedAdvancedPlans.map(link =>
            <p key={link.planItemId}><Link href={`/advanced-production-orders/${link.planOrderId}`} className="font-medium text-primary underline">خطة #{link.planOrderId} · البند #{link.planItemId}</Link> · {number.format(link.allocatedQuantity)} {item.unit} · السبب: {link.reason}</p>
          ) : <p className="text-muted-foreground">لا توجد خطط مرتبطة صراحةً بهذا البند.</p>}</div>}
          <ItemCoverage coverage={item.coverage} unit={item.unit} advanced={row.source === "advanced_plan"} />
          {item.issues.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-900">{item.issues.map((issue, index) => <li key={index}>{planningIssueLabel(issue)}</li>)}</ul>}
        </div>;
      })}</div>}
  </CardContent></Card>;
}