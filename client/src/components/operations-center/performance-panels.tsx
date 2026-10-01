import React, { useId } from "react";
import { ArrowUpLeft } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OperationsCenterResponse, OperationsQueueItem } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import {
  analyticsMetadata, analyticsNumber, analyticsSource, coverageLabel, finiteValue, followupChartPoints,
  latestRecordedDate, periodLabel, salesChartPoints, validatedInsightHref, validatedSalesHref, type AnalyticsChart, type PerformanceDays,
} from "./analytics-model";

export function PerformanceRange({ days, onChange }: { days: PerformanceDays; onChange: (days: PerformanceDays) => void }) {
  const groupId = useId();
  return <fieldset className="oc-range"><legend className="sr-only">فترة المبيعات المسجلة</legend>
    {([7, 30] as const).map(value => <label key={value} data-active={days === value}>
      <input type="radio" name={`performance-days-${groupId}`} checked={days === value} onChange={() => onChange(value)} />
      آخر {value} أيام
    </label>)}
  </fieldset>;
}

export function PerformancePeriod({ data }: { data: OperationsCenterResponse }) {
  const last = latestRecordedDate(data.analytics);
  return <p className="oc-performance-period text-[11px] leading-5 text-muted-foreground">
    فترة المبيعات: <span dir="ltr">{periodLabel(data.analytics?.period)}</span>
    <span className="block">آخر تاريخ مبيعات مسجل في النطاق: <span dir="ltr">{last || "لا يوجد تاريخ مؤكد"}</span> · المتابعات لقطة حالية، لا تتغير بفترة المبيعات</span>
  </p>;
}

function SalesState({ data }: { data: OperationsCenterResponse }) {
  const state = analyticsMetadata(data.analytics)?.sales.state;
  return <div role="status" className="oc-chart-empty">
    {state === "forbidden" ? "لا تملك صلاحية الاطلاع على دليل المبيعات."
      : !data.analytics || state === "unavailable" || data.analytics.sales.coverage === "unavailable" ? "تعذر تحميل دليل المبيعات؛ غياب الدليل لا يعني صفر مبيعات."
      : "لا توجد مبيعات مسجلة قابلة للرسم خلال الفترة؛ الأيام غير المسجلة ليست صفرًا."}
  </div>;
}

function FullTooltip({ active, payload, label, sales }: { active?: boolean; payload?: readonly { value?: unknown; payload?: { date?: string; name?: string; recordedBranches?: number; awaitingDecision?: number; emergency?: number } }[]; label?: unknown; sales: boolean }) {
  if (!active || !payload?.length || !finiteValue(payload[0].value)) return null;
  const row = payload[0].payload;
  return <div dir="rtl" className="oc-performance-tooltip oc-panel p-3 text-xs shadow-md">
    <strong>{sales ? row?.date : row?.name || String(label || "")}</strong>
    <p>{sales ? "المبيعات المسجلة" : "المتابعات المحمّلة"}: {analyticsNumber(payload[0].value)} {sales ? "ر.س" : "سجل"}</p>
    {sales ? <p>فروع لها تسجيل: {row?.recordedBranches ?? "غير معروف"} · ليست صافي المبيعات</p>
      : <p>بانتظار القرار: {finiteValue(row?.awaitingDecision) ? analyticsNumber(row.awaitingDecision) : "غير متاح"} · عاجل بالمصدر: {finiteValue(row?.emergency) ? analyticsNumber(row.emergency) : "غير متاح"}</p>}
  </div>;
}

export function PerformanceChart({ chart, data, expanded = false, loading = false }: { chart: AnalyticsChart; data: OperationsCenterResponse; expanded?: boolean; loading?: boolean }) {
  const sales = salesChartPoints(data.analytics);
  const branches = followupChartPoints(data);
  const usableSales = sales.some(day => day.value !== null) && data.analytics?.sales.coverage !== "unavailable";
  const usableFollowups = branches.some(row => row.value !== null) && data.analytics?.followups.coverage !== "unavailable";
  const dateTick = (timestamp: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", month: "2-digit", day: "2-digit" }).format(timestamp);
  return <div className={`oc-chart ${expanded ? "oc-chart-expanded" : ""}`} dir="ltr"
    style={expanded && chart === "followups" ? { height: Math.max(290, branches.length * 34) } : undefined}
    aria-label={chart === "sales" ? "المبيعات المسجلة بالريال السعودي عبر تواريخ الفترة" : "عدد المتابعات المحمّلة حسب الفرع"}>
    {chart === "sales" ? loading ? <div role="status" className="oc-chart-empty">جار تحميل مبيعات الفترة المحددة؛ لم نعرض قيم الفترة السابقة.</div> : usableSales ? <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={sales} margin={{ top: 12, right: 15, bottom: 2, left: 2 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="#eee8f3" />
        <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={dateTick} tick={{ fontSize: 10 }} minTickGap={20} />
        <YAxis domain={[0, "auto"]} tick={{ fontSize: 10 }} width={58} tickFormatter={analyticsNumber} />
        <Tooltip content={<FullTooltip sales />} />
        <Area name="المبيعات المسجلة (ر.س)" type="linear" dataKey="value" stroke="#61A9BD" fill="#8CCEDE" fillOpacity={0.35}
          strokeWidth={2} connectNulls={false} dot={{ r: 3.5, fill: "#61A9BD", stroke: "#3C7686", strokeWidth: 1 }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer> : <SalesState data={data} />
      : usableFollowups ? <ResponsiveContainer width="100%" height="100%">
        <BarChart data={branches} layout={expanded ? "vertical" : "horizontal"} margin={{ top: 16, right: 30, bottom: 2, left: 2 }} accessibilityLayer>
          <CartesianGrid vertical={expanded} horizontal={!expanded} stroke="#eee8f3" />
          {expanded ? <>
            <XAxis type="number" allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
          </> : <>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={name => String(name).length > 13 ? `${String(name).slice(0, 12)}…` : String(name)} minTickGap={12} />
            <YAxis type="number" allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 10 }} width={32} />
          </>}
          <Tooltip content={<FullTooltip sales={false} />} />
          <Bar name="المتابعات المحمّلة (سجل)" dataKey="value" fill="#61A9BD" radius={expanded ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
            <LabelList dataKey="value" position={expanded ? "right" : "top"} fontSize={10} formatter={(value: unknown) => finiteValue(value) ? analyticsNumber(value) : ""} />
          </Bar>
        </BarChart>
      </ResponsiveContainer> : <div role="status" className="oc-chart-empty">تعذر تحميل دليل المتابعات من المصادر المسموح بها؛ لا يمثل ذلك صفر متابعات.</div>}
  </div>;
}

export function PerformancePanel({ chart, data, onExpand, loading = false }: { chart: AnalyticsChart; data: OperationsCenterResponse; onExpand: () => void; loading?: boolean }) {
  return <section className="oc-panel min-w-0 p-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold">{chart === "sales" ? "اتجاه المبيعات المسجلة" : "المتابعات حسب الفرع"}</h3>
      <button type="button" onClick={onExpand} className="oc-expand" aria-label={chart === "sales" ? "تكبير المبيعات وعرض تفاصيل الأيام" : "تكبير المتابعات وعرض تفاصيل الفروع"}><ArrowUpLeft className="size-4" /><span className="sr-only">تكبير الرسم والتفاصيل</span></button>
    </div>
    <p className="text-xs text-muted-foreground">{chart === "sales" ? "إجمالي يوميات معتمدة أو مرحلة · ليس صافي المبيعات" : "لقطة المتابعات المحمّلة الآن · ليست إجمالي كل المهام"}</p>
    <div className="mt-2"><PerformanceChart chart={chart} data={data} loading={loading} /></div>
    <p className="mt-1 text-[11px] text-muted-foreground">{chart === "sales" ? `ر.س · تغطية ${coverageLabel(data.analytics?.sales.coverage)} · الفراغ: لا تسجيل · النقطة عند الصفر: صفر مسجل` : `سجل · تغطية ${coverageLabel(data.analytics?.followups.coverage)}`}</p>
  </section>;
}

export function PerformanceSummary({ data }: { data: OperationsCenterResponse }) {
  const analytics = data.analytics;
  const sales = salesChartPoints(analytics);
  const counts = followupChartPoints(data).filter(row => row.value !== null);
  const total = counts.length ? counts.reduce((sum, row) => sum + row.value!, 0) : null;
  return <div className="min-w-0 flex-1">
    <strong className="text-sm">ملخص الأدلة المسجلة</strong>
    <p className="mt-1 text-sm">{finiteValue(analytics?.sales.total) && analytics?.sales.coverage !== "unavailable"
      ? `${analyticsNumber(analytics.sales.total)} ر.س مبيعات مسجلة · ${sales.filter(day => day.value !== null).length} أيام لها تسجيل`
      : analyticsMetadata(analytics)?.sales.state === "forbidden" ? "دليل المبيعات غير مسموح لهذا الحساب" : "لا إجمالي مبيعات مؤكد في الفترة"}</p>
    <p className="text-xs text-muted-foreground">{total !== null && analytics?.followups.coverage !== "unavailable" ? `${analyticsNumber(total)} متابعة محمّلة في ${counts.length} فروع` : "دليل المتابعات غير متاح"} · لا نستنتج سبب التغير أو اكتمال العمل من هذه الأرقام.</p>
  </div>;
}

export function PerformanceDetail({ chart, data, open, loading = false }: {
  chart: AnalyticsChart; data: OperationsCenterResponse; loading?: boolean; open: (href: string, branchId: string, item?: OperationsQueueItem) => void;
}) {
  const analytics = data.analytics;
  const metadata = analyticsMetadata(analytics);
  const rows = (analytics?.sales.byBranch || []).filter(branch => data.scope.branchIds.includes(branch.branchId))
    .flatMap(branch => branch.daily.map(day => ({ ...day, branchId: branch.branchId,
      available: branch.state !== "forbidden" && branch.state !== "unavailable" && analytics?.sales.coverage !== "unavailable" })));
  const branchName = (id: string) => data.branches.find(branch => branch.id === id)?.name || id;
  return <div className="oc-performance-detail space-y-3">
    <h3 className="oc-performance-title text-lg font-bold">{chart === "sales" ? "المبيعات المسجلة · الأيام والفروع" : "المتابعات المحمّلة · الفروع"}</h3>
    <PerformancePeriod data={data} />
    <PerformanceChart chart={chart} data={data} expanded loading={loading} />
    <p className="oc-performance-provenance text-xs leading-6 text-muted-foreground">المصدر: {analyticsSource(chart === "sales" ? analytics?.sales.source : analytics?.followups.source)} · التغطية: {coverageLabel(chart === "sales" ? analytics?.sales.coverage : analytics?.followups.coverage)}.
      {chart === "sales" ? " إجمالي المبيعات كما سُجل في اليومية، لا يُطرح منه الاسترجاع هنا. غياب التسجيل لا يساوي صفرًا." : " عدد من السجلات المحمّلة من المصادر المسموح بها، وليس ضمانًا لعد جميع المتابعات أو اكتمالها."}</p>
    {chart === "sales" ? <>
      <div className="oc-performance-source-links flex flex-wrap gap-2">{analytics?.sales.hrefs.filter(link => data.scope.branchIds.includes(link.branchId)).map(link => {
        const href = validatedSalesHref(link.href, link.branchId, data, window.location.origin);
        return href ? <Button key={link.branchId} variant="outline" size="sm" className="h-auto min-w-0 max-w-full whitespace-normal py-2 text-right" onClick={() => open(href, link.branchId)}>مصدر الفترة · {branchName(link.branchId)}<ArrowUpLeft className="mr-1 size-3.5 shrink-0" /></Button> : null;
      })}</div>
      <div className="oc-evidence-table"><table><caption>اليوميات المعتمدة أو المرحلة في الفترة المحددة · ر.س</caption><thead><tr><th>الفرع</th><th>اليوم</th><th>المبيعات المسجلة</th><th>اليوميات</th><th>المصدر</th></tr></thead>
        <tbody>{rows.map(row => {
          const source = analytics?.sales.hrefs.find(link => link.branchId === row.branchId);
          const href = source && validatedSalesHref(source.href, row.branchId, data, window.location.origin);
          return <tr key={`${row.branchId}:${row.date}`}><th>{branchName(row.branchId)}</th><td dir="ltr">{row.date}</td><td>{row.available ? finiteValue(row.value) ? `${analyticsNumber(row.value)} ر.س` : "لا تسجيل مؤكد" : "الدليل غير متاح"}</td><td>{row.available && finiteValue(row.recordedCount) ? analyticsNumber(row.recordedCount) : "غير متاح"}</td><td>{href ? <button type="button" className="font-bold text-violet-700 underline" onClick={() => open(href, row.branchId)}>مراجعة فترة الفرع</button> : "غير متاح"}</td></tr>;
        })}</tbody></table></div>
      {!rows.length && <p className="text-xs text-muted-foreground">لا تفاصيل أيام متاحة لهذا النطاق.</p>}
    </> : <>
      {metadata?.followups.scan && <p className="text-xs text-muted-foreground">حد التحميل لكل مصدر: {metadata.followups.scan.sourceLimit} سجل{metadata.followups.scan.truncated ? " · توجد مصادر اقتُطعت عند حد التحميل" : ""}{metadata.followups.scan.unavailableSources.length ? ` · ${metadata.followups.scan.unavailableSources.length} مصادر تعذر تحميلها` : ""}.</p>}
      <div className="oc-evidence-table"><table><caption>لقطة حالية من السجلات المحمّلة؛ ليست اتجاهًا عبر الفترة</caption><thead><tr><th>الفرع</th><th>متابعات</th><th>بانتظار قرار</th><th>عاجل بالمصدر</th></tr></thead><tbody>
        {followupChartPoints(data).map(row => <tr key={row.branchId}><th>{row.name}</th>{[row.value, row.awaitingDecision, row.emergency].map((value, index) => <td key={index}>{analytics?.followups.coverage !== "unavailable" && finiteValue(value) ? analyticsNumber(value) : "غير متاح"}</td>)}</tr>)}
      </tbody></table></div>
      <details className="oc-panel p-3"><summary className="cursor-pointer text-xs font-bold text-violet-700">مصادر السجلات المعروضة في صفحة المتابعة الحالية ({data.queue.length})</summary>
        <p className="my-2 text-xs text-muted-foreground">قد تشمل أعداد الرسم سجلات في صفحات أخرى. أدلة الجودة للتحقيق فقط، ولا تدخل في عدد المتابعات.</p>
        <div className="oc-evidence-table"><table><thead><tr><th>الفرع</th><th>الدليل</th><th>المصدر</th></tr></thead><tbody>
          {data.queue.filter(item => data.scope.branchIds.includes(item.branchId)).map(item => {
            const href = validatedInsightHref(item, data, window.location.origin);
            return <tr key={item.id}><th>{branchName(item.branchId)}</th><td>{item.title}</td><td>{href ? <button type="button" className="font-bold text-violet-700 underline" onClick={() => open(href, item.branchId, item)}>فتح {analyticsSource(item.sourceType)}</button> : "رابط المصدر غير متاح"}</td></tr>;
          })}
        </tbody></table></div>
      </details>
    </>}
  </div>;
}