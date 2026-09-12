import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ProductionOperationsReport, ProductionOperationsRequestRow } from "@shared/production-operations-report";
import { getCentralKitchenNextStep } from "@shared/central-kitchen-next-step";
import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, Download, Factory, FileSpreadsheet, FileText, FlaskConical, Link2, PackageCheck, RefreshCw, Search, Send, ShieldAlert, Truck, Warehouse } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { buildProductionReportTables, downloadProductionReportCsv, downloadProductionReportExcel, formatQuantity6, printProductionReport, type ProductionReportFilteredRows } from "@/lib/production-operations-export";

export { csvCell, formatQuantity6 } from "@/lib/production-operations-export";

type PipelineMode = ProductionOperationsRequestRow["inventoryMode"];
type SummaryQuantityField = "requestedQuantityByUnit" | "preparedQuantityByUnit" | "dispatchedQuantityByUnit" | "goodReceivedQuantityByUnit" | "damagedQuantityByUnit" | "missingQuantityByUnit";

const modeLabels: Record<PipelineMode, string> = { real: "فعلي", shadow: "ظلّي", unknown: "غير معروف" };
const statusLabels: Record<string, string> = { requested: "مطلوب", approved: "معتمد", prepared: "مجهز", dispatched: "مرسل", received: "مستلم", cancelled: "ملغى", canceled: "ملغى", rejected: "مرفوض" };
const stages: Array<{ key: SummaryQuantityField; label: string; icon: ElementType }> = [
  { key: "requestedQuantityByUnit", label: "المطلوب", icon: ClipboardList }, { key: "preparedQuantityByUnit", label: "المجهز", icon: PackageCheck },
  { key: "dispatchedQuantityByUnit", label: "المرسل", icon: Send }, { key: "goodReceivedQuantityByUnit", label: "المستلم سليماً", icon: CheckCircle2 },
  { key: "damagedQuantityByUnit", label: "التالف", icon: AlertTriangle }, { key: "missingQuantityByUnit", label: "الناقص", icon: AlertTriangle },
];

const riyadhDate = (offset = 0) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};
const labelStatus = (status: string) => statusLabels[status.toLowerCase()] || status;
const references = (items: number[], prefix: string) => items.length ? items.map((item) => `${prefix} ${item}`).join("، ") : "—";
const totalRows = (rows: ProductionReportFilteredRows) => Object.values(rows).reduce((total, section) => total + section.length, 0);

function StateCard({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <Card><CardContent className="flex flex-col items-center justify-center py-14 text-center"><div className="mb-3 text-amber-700">{icon}</div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-xl text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</CardContent></Card>;
}

function SectionHead({ icon: Icon, title, description, count }: { icon: ElementType; title: string; description: string; count: number }) {
  return <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3"><div className="flex gap-2"><Icon className="mt-0.5 h-5 w-5 text-amber-700" /><div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></div><Badge variant="outline">{count} صف</Badge></CardHeader>;
}

function DataTable({ children, caption }: { children: ReactNode; caption: string }) {
  return <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[720px] text-sm"><caption className="sr-only">{caption}</caption>{children}</table></div>;
}
function EmptyRows({ searched, label }: { searched: boolean; label: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{searched ? "لا تطابق عبارة البحث أي صف في هذا القسم." : `لا توجد ${label} في الفترة المحددة.`}</p>; }
function RequestReferences({ row }: { row: ProductionOperationsRequestRow }) {
  if (!row.orderIds.length) return <span className="text-xs text-muted-foreground">لا يوجد رقم طلب متاح</span>;
  return <div className="flex flex-wrap gap-1.5 text-xs">{row.orderIds.map((orderId) => <Link key={orderId} href={`/central-kitchen-orders?orderId=${orderId}`} className="rounded border border-amber-200 px-1.5 py-0.5 text-amber-900 underline underline-offset-2">طلب {orderId}</Link>)}{row.linkedBatchIds.length > 0 && <span className="text-muted-foreground">دفعات مرتبطة: {references(row.linkedBatchIds, "دفعة")} ضمن الطلب</span>}</div>;
}
function ModeSection({ report, rows, mode, searched }: { report: ProductionOperationsReport; rows: ProductionOperationsRequestRow[]; mode: PipelineMode; searched: boolean }) {
  const summary = report.summary.centralKitchen.byInventoryMode.find((item) => item.inventoryMode === mode);
  return <Card className={mode === "real" ? "border-emerald-200" : mode === "shadow" ? "border-violet-200" : "border-amber-200"}>
    <SectionHead icon={Truck} title={`طلبات المطبخ المركزي — ${modeLabels[mode]}`} description={mode === "real" ? "مسار مخزون فعلي." : mode === "shadow" ? "عرض تشغيلي ظلّي، وليس حركة مخزون فعلية." : "طلبات قديمة لم تُحفظ لها طريقة المخزون."} count={rows.length} />
    <CardContent className="space-y-3">
      {summary && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{stages.map(({ key, label, icon: Icon }) => <div className="rounded-md border bg-muted/20 p-3" key={key}><p className="flex items-center gap-1.5 text-xs font-medium"><Icon className="h-3.5 w-3.5 text-amber-700" />{label}</p>{summary[key].length ? summary[key].map((quantity) => <p key={quantity.unit} className="mt-1 flex justify-between text-xs tabular-nums"><span>{quantity.unit}</span><span>{formatQuantity6(quantity.quantity)}</span></p>) : <p className="mt-1 text-xs text-muted-foreground">لا توجد كمية</p>}</div>)}</div>}
      {rows.length ? <DataTable caption={`تفاصيل طلبات وضع ${modeLabels[mode]}`}><thead className="bg-muted/50"><tr><th>الصنف</th><th>الحالة والخطوة التالية</th><th>الوحدة</th><th>المطلوب</th><th>المجهز</th><th>المرسل</th><th>المستلم سليماً</th><th>ناتج مكتمل مرتبط</th><th>ناتج قيد الإنتاج مرتبط</th><th>التالف</th><th>الناقص</th><th>فتح الطلب</th></tr></thead><tbody>{rows.map((row) => { const step = getCentralKitchenNextStep({ status: row.status, inventoryMode: row.inventoryMode, damagedQuantity: row.damagedQuantity, missingQuantity: row.missingQuantity }); return <tr className="border-t" key={`${row.itemKind}-${row.itemId}-${row.unit}-${row.orderItemIds.join("-")}`}><td className="font-medium">{row.itemName}</td><td><p>{labelStatus(row.status)}</p><p className="mt-0.5 text-xs text-muted-foreground">{step.label} · {step.owner}</p></td><td>{row.unit}</td><td>{formatQuantity6(row.requestedQuantity)}</td><td>{formatQuantity6(row.preparedQuantity)}</td><td>{formatQuantity6(row.dispatchedQuantity)}</td><td>{formatQuantity6(row.goodReceivedQuantity)}</td><td>{formatQuantity6(row.linkedFinishedQuantity)}</td><td>{formatQuantity6(row.linkedInProgressQuantity)}</td><td>{formatQuantity6(row.damagedQuantity)}</td><td>{formatQuantity6(row.missingQuantity)}</td><td><RequestReferences row={row} /></td></tr>; })}</tbody></DataTable> : <EmptyRows searched={searched} label="طلبات" />}
      <Link href={`/central-kitchen-orders?inventoryMode=${mode}`} className="inline-flex items-center text-xs font-medium text-primary underline underline-offset-4">فتح طلبات هذا المسار <Link2 className="mr-1 h-3.5 w-3.5" /></Link>
    </CardContent>
  </Card>;
}

function filterRows(report: ProductionOperationsReport, search: string): ProductionReportFilteredRows {
  if (!search) return { production: report.productionRows, planned: report.plannedRows, requests: report.requestRows, materials: report.materialRows, waste: report.wasteRows };
  const matches = (text: string) => text.toLocaleLowerCase().includes(search);
  return {
    production: report.productionRows.filter((row) => matches(`${row.productName} ${row.unit} ${row.batchIds.join(" ")}`)),
    planned: report.plannedRows.filter((row) => matches(`${row.productName} ${row.catalogUnit || ""} ${row.advancedOrderIds.join(" ")}`)),
    requests: report.requestRows.filter((row) => matches(`${row.itemName} ${row.unit} ${labelStatus(row.status)} ${modeLabels[row.inventoryMode]} ${row.orderIds.join(" ")}`)),
    materials: report.materialRows.filter((row) => matches(`${row.materialName} ${row.unit} ${row.movementIds.join(" ")}`)),
    waste: report.wasteRows.filter((row) => matches(`${row.productName} ${row.catalogUnit || ""} ${row.wasteReportIds.join(" ")}`)),
  };
}

export function OperationsReport() {
  const { branches, isLoading: branchesLoading, canSelectBranch, defaultBranchId } = useBranches();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState(""); const [startDate, setStartDate] = useState(() => riyadhDate(-6)); const [endDate, setEndDate] = useState(() => riyadhDate()); const [search, setSearch] = useState("");
  useEffect(() => { if (!branchesLoading) setBranchId((current) => current && (current === "all" ? canSelectBranch : branches.some((branch) => branch.id === current)) ? current : canSelectBranch ? "all" : defaultBranchId || branches[0]?.id || ""); }, [branches, branchesLoading, canSelectBranch, defaultBranchId]);
  const dateError = startDate > endDate;
  const reportQuery = useQuery<ProductionOperationsReport, Error>({ queryKey: ["/api/production/operations-report", branchId, startDate, endDate], enabled: Boolean(branchId && startDate && endDate && !dateError), staleTime: 30_000, queryFn: async () => {
    const response = await fetch(`/api/production/operations-report?${new URLSearchParams({ branchId, startDate, endDate })}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) { let message = "تعذر تحميل تقرير التشغيل."; try { message = (await response.json() as { error?: string }).error || message; } catch { /* fallback */ } throw new Error(message); } return response.json() as Promise<ProductionOperationsReport>;
  }});
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const rows = useMemo(() => reportQuery.data ? filterRows(reportQuery.data, normalizedSearch) : null, [normalizedSearch, reportQuery.data]);
  const branchLabel = branchId === "all" ? "جميع الفروع المسموح بها" : branches.find((branch) => branch.id === branchId)?.name || "الفرع المحدد";
  const canExport = Boolean(reportQuery.data && rows && !reportQuery.isFetching && !exporting && !dateError && startDate && endDate && branchId);
  const exportFilters = { startDate, endDate, branchLabel, search: normalizedSearch || undefined };
  const runExport = async (kind: "csv" | "excel" | "print") => {
    if (!canExport || !reportQuery.data || !rows) return;
    setExportError(null);
    setExporting(true);
    try {
      if (kind === "csv") downloadProductionReportCsv(reportQuery.data, rows, exportFilters);
      else if (kind === "excel") await downloadProductionReportExcel(reportQuery.data, rows, exportFilters);
      else printProductionReport(reportQuery.data, rows, exportFilters);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "تعذر تصدير التقرير. يرجى المحاولة مجدداً.");
    } finally {
      setExporting(false);
    }
  };
  const hasData = reportQuery.data && (totalRows({ production: reportQuery.data.productionRows, planned: reportQuery.data.plannedRows, requests: reportQuery.data.requestRows, materials: reportQuery.data.materialRows, waste: reportQuery.data.wasteRows }) > 0);
  return <section dir="rtl" className="space-y-5" aria-labelledby="operations-title">
    {exporting && <p role="status" className="text-sm text-muted-foreground">جارٍ تجهيز التصدير…</p>}
    {exportError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{exportError}</p>}
    <Card className="overflow-hidden border-amber-200 bg-[linear-gradient(135deg,hsl(28_50%_24%),hsl(18_44%_34%))] text-stone-50"><CardContent className="p-5 sm:p-7"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="mb-2 text-xs font-semibold tracking-[.16em] text-amber-200">متابعة التشغيل</p><h1 id="operations-title" className="text-2xl font-bold">سجل الإنتاج والطلبات والمواد</h1><p className="mt-2 max-w-3xl text-sm text-amber-50/85">كل قسم مستقل حسب مصدره. لا نقارن الخطة بالإنتاج عند غياب رابط مؤكد، ولا نخلط أوضاع المخزون.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!canExport} onClick={() => runExport("csv")}><Download className="ml-2 h-4 w-4" />CSV</Button><Button variant="secondary" disabled={!canExport} onClick={() => runExport("excel")}><FileSpreadsheet className="ml-2 h-4 w-4" />Excel</Button><Button variant="secondary" disabled={!canExport} onClick={() => runExport("print")}><FileText className="ml-2 h-4 w-4" />طباعة / حفظ PDF</Button><Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" disabled={reportQuery.isFetching || !branchId || dateError} onClick={() => reportQuery.refetch()}><RefreshCw className={`ml-2 h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`} />تحديث</Button></div></div></CardContent></Card>
    <Card><CardContent className="grid gap-4 p-4 md:grid-cols-[1.2fr_.8fr_.8fr_1.2fr] md:items-end"><div><Label htmlFor="op-branch">الفرع</Label><Select value={branchId || undefined} onValueChange={setBranchId} disabled={branchesLoading || !canSelectBranch}><SelectTrigger id="op-branch" className="mt-1.5"><SelectValue placeholder="اختر الفرع" /></SelectTrigger><SelectContent>{canSelectBranch && <SelectItem value="all">جميع الفروع المسموح بها</SelectItem>}{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="op-start">من تاريخ</Label><Input id="op-start" className="mt-1.5" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><Label htmlFor="op-end">إلى تاريخ</Label><Input id="op-end" className="mt-1.5" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div><div><Label htmlFor="op-search">بحث داخل الصفوف والتصدير</Label><div className="relative mt-1.5"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="op-search" className="pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="صنف أو رقم طلب..." /></div></div></CardContent></Card>
    {dateError ? <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.</div> : reportQuery.isLoading || branchesLoading ? <div className="space-y-3" aria-busy="true"><div className="grid gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton className="h-24" key={item} />)}</div><Skeleton className="h-80 w-full" /></div> : reportQuery.isError ? <StateCard icon={<ShieldAlert className="h-8 w-8" />} title="تعذر تحميل التقرير" text={reportQuery.error.message} action={<Button onClick={() => reportQuery.refetch()} variant="outline">إعادة المحاولة</Button>} /> : !hasData ? <StateCard icon={<ClipboardList className="h-8 w-8" />} title="لا توجد بيانات في الفترة" text={`لا توجد سجلات للفرع ${branchLabel} بين ${startDate} و${endDate}.`} /> : rows && <ReportBody report={reportQuery.data!} rows={rows} search={normalizedSearch} />}
  </section>;
}

function ReportBody({ report, rows, search }: { report: ProductionOperationsReport; rows: ProductionReportFilteredRows; search: string }) {
  const warnings = [
    report.coverage.materialPostingMissing && `هناك ${report.coverage.materialPostingMissing} دفعة مرتبطة بلا صرف مواد مثبت.`,
    report.coverage.outputPostingMissing && `هناك ${report.coverage.outputPostingMissing} دفعة بلا إثبات مخرج.`,
    report.coverage.recipeSnapshotMissing && `هناك ${report.coverage.recipeSnapshotMissing} دفعة بلا لقطة وصفة محفوظة.`,
    ...report.metadata.warnings,
  ].filter(Boolean) as string[];
  const allCount = totalRows(rows);
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Factory} label="دفعات مكتملة" value={report.summary.production.finishedBatchCount} /><Metric icon={Truck} label="طلبات المطبخ" value={report.summary.centralKitchen.orderCount} /><Metric icon={Warehouse} label="حركات المواد" value={report.summary.materials.movementCount} /><Metric icon={ClipboardList} label="صفوف معروضة" value={allCount} note={search ? "بعد البحث؛ الملخصات أدناه للفترة كاملة." : "في الفترة المحددة"} /></div>
    {search && <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">يعرض البحث {allCount} صفاً فقط، بينما بطاقات الملخص وكميات مراحل الطلب تمثل كامل الفترة المحددة.</p>}
    {warnings.length > 0 && <Card className="border-amber-200"><CardContent className="p-4"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="font-medium">تنبيهات تحتاج مراجعة</p><ul className="mt-1 list-disc space-y-1 pr-4 text-sm text-muted-foreground">{warnings.slice(0, 4).map((warning, index) => <li key={index}>{warning}</li>)}</ul>{warnings.length > 4 && <p className="mt-2 text-xs text-muted-foreground">توجد {warnings.length - 4} تنبيهات إضافية ضمن بيانات التقرير.</p>}</div></div></CardContent></Card>}
    <Card><SectionHead icon={Factory} title="الإنتاج المنفذ" description="الكميات حسب المنتج والوحدة." count={rows.production.length} /><CardContent>{rows.production.length ? <DataTable caption="الإنتاج المنفذ"><thead className="bg-muted/50"><tr><th>المنتج</th><th>الوحدة</th><th>دفعات مكتملة</th><th>الكمية المكتملة</th><th>قيد التنفيذ</th><th>كميته</th><th>مراجع الدفعات</th></tr></thead><tbody>{rows.production.map((row) => <tr className="border-t" key={`${row.productId}-${row.unit}`}><td className="font-medium">{row.productName}</td><td>{row.unit}</td><td>{row.finishedBatchCount}</td><td>{formatQuantity6(row.finishedQuantity)}</td><td>{row.inProgressBatchCount}</td><td>{formatQuantity6(row.inProgressQuantity)}</td><td className="text-xs text-muted-foreground">{references(row.batchIds, "دفعة")}</td></tr>)}</tbody></DataTable> : <EmptyRows searched={Boolean(search)} label="إنتاج منفذ" />}</CardContent></Card>
    <Card><SectionHead icon={ClipboardList} title="الخطة المسجلة" description="تُعرض مستقلة؛ لا توجد مقارنة مؤكدة مع الدفعات المنفذة." count={rows.planned.length} /><CardContent>{rows.planned.length ? <DataTable caption="الخطة المسجلة"><thead className="bg-muted/50"><tr><th>المنتج</th><th>الوحدة الحالية</th><th>الكمية المخططة</th><th>مراجع الأوامر</th><th>المقارنة</th></tr></thead><tbody>{rows.planned.map((row) => <tr className="border-t" key={`${row.productId}-${row.advancedOrderItemIds.join("-")}`}><td className="font-medium">{row.productName}</td><td>{row.catalogUnit || "غير محددة"}</td><td>{formatQuantity6(row.plannedQuantity)}</td><td className="text-xs">{references(row.advancedOrderIds, "أمر")}</td><td className="text-muted-foreground">غير متاحة دون رابط دفعة مؤكد</td></tr>)}</tbody></DataTable> : <EmptyRows searched={Boolean(search)} label="خطط" />}</CardContent></Card>
    <div className="space-y-4"><div><h2 className="font-semibold">مسار طلبات المطبخ</h2><p className="text-xs text-muted-foreground">فصل صريح بين الفعلي والظلّي وغير المعروف.</p></div>{(["real", "shadow", "unknown"] as PipelineMode[]).map((mode) => <ModeSection key={mode} report={report} rows={rows.requests.filter((row) => row.inventoryMode === mode)} mode={mode} searched={Boolean(search)} />)}</div>
    <Card><SectionHead icon={FlaskConical} title="المواد المصروفة للإنتاج" description="صرف فعلي حسب المادة والوحدة." count={rows.materials.length} /><CardContent>{rows.materials.length ? <DataTable caption="المواد المصروفة"><thead className="bg-muted/50"><tr><th>المادة</th><th>الوحدة</th><th>الكمية المصروفة</th><th>حركات الصرف</th><th>دفعات الإنتاج</th></tr></thead><tbody>{rows.materials.map((row) => <tr className="border-t" key={`${row.warehouseItemId}-${row.unit}`}><td className="font-medium">{row.materialName}</td><td>{row.unit}</td><td>{formatQuantity6(row.consumedQuantity)}</td><td className="text-xs">{references(row.movementIds, "حركة")}</td><td className="text-xs">{references(row.batchIds, "دفعة")}</td></tr>)}</tbody></DataTable> : <EmptyRows searched={Boolean(search)} label="مواد مصروفة" />}</CardContent></Card>
    <Card><SectionHead icon={AlertTriangle} title="الهالك المعتمد" description="كميات معتمدة ووحدة المنتج الحالية." count={rows.waste.length} /><CardContent>{rows.waste.length ? <DataTable caption="الهالك المعتمد"><thead className="bg-muted/50"><tr><th>المنتج</th><th>الوحدة الحالية</th><th>الكمية المعتمدة</th><th>تقارير الهالك</th></tr></thead><tbody>{rows.waste.map((row) => <tr className="border-t" key={`${row.productId}-${row.catalogUnit}`}><td className="font-medium">{row.productName}</td><td>{row.catalogUnit || "غير محددة"}</td><td>{formatQuantity6(row.approvedQuantity)}</td><td className="text-xs">{references(row.wasteReportIds, "تقرير")}</td></tr>)}</tbody></DataTable> : <EmptyRows searched={Boolean(search)} label="هالك معتمد" />}</CardContent></Card>
  </div>;
}
function Metric({ icon: Icon, label, value, note }: { icon: ElementType; label: string; value: number; note?: string }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-full bg-amber-100 p-2 text-amber-800"><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold tabular-nums">{new Intl.NumberFormat("ar-SA-u-nu-latn").format(value)}</p>{note && <p className="text-[11px] text-muted-foreground">{note}</p>}</div></CardContent></Card>; }