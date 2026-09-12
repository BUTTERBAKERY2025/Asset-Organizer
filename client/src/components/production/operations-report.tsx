import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type {
  ProductionOperationsMaterialRow,
  ProductionOperationsReport,
  ProductionOperationsRequestRow,
} from "@shared/production-operations-report";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Factory,
  FileWarning,
  FlaskConical,
  Link2,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type PipelineMode = ProductionOperationsRequestRow["inventoryMode"];
type ModeSummary = ProductionOperationsReport["summary"]["centralKitchen"]["byInventoryMode"][number];
type SummaryQuantityField = "requestedQuantityByUnit" | "preparedQuantityByUnit" | "dispatchedQuantityByUnit" | "goodReceivedQuantityByUnit" | "damagedQuantityByUnit" | "missingQuantityByUnit";

const modeLabels: Record<PipelineMode, string> = {
  real: "فعلي",
  shadow: "ظلّي",
  unknown: "غير معروف",
};

const statusLabels: Record<string, string> = {
  requested: "مطلوب",
  approved: "معتمد",
  prepared: "مجهز",
  dispatched: "مرسل",
  received: "مستلم",
  cancelled: "ملغى",
  canceled: "ملغى",
  rejected: "مرفوض",
};

const stageLabels: Array<{ summaryKey: SummaryQuantityField; label: string; icon: ElementType }> = [
  { summaryKey: "requestedQuantityByUnit", label: "الطلب", icon: ClipboardList },
  { summaryKey: "preparedQuantityByUnit", label: "التجهيز", icon: PackageCheck },
  { summaryKey: "dispatchedQuantityByUnit", label: "الإرسال", icon: Send },
  { summaryKey: "goodReceivedQuantityByUnit", label: "الاستلام السليم", icon: CheckCircle2 },
  { summaryKey: "damagedQuantityByUnit", label: "التالف", icon: AlertTriangle },
  { summaryKey: "missingQuantityByUnit", label: "المفقود", icon: FileWarning },
];

const todayInRiyadh = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const recentStartInRiyadh = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

/** Quantities are deliberately capped at six decimals, matching NUMERIC(18,6). */
export function formatQuantity6(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متاح";
  return new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 6 }).format(value);
}

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متاح";
  return new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: string): string {
  return statusLabels[status.toLowerCase()] || status;
}

function referenceList(ids: number[], prefix: string): string {
  return ids.length ? ids.map((id) => `${prefix}${id}`).join("، ") : "غير متاح";
}

function modeRows(report: ProductionOperationsReport, mode: PipelineMode): ProductionOperationsRequestRow[] {
  return report.requestRows.filter((row) => row.inventoryMode === mode);
}

function modeSummary(report: ProductionOperationsReport, mode: PipelineMode): ModeSummary | undefined {
  return report.summary.centralKitchen.byInventoryMode.find((summary) => summary.inventoryMode === mode);
}

function modeHref(mode: PipelineMode): string {
  return `/central-kitchen-orders?inventoryMode=${encodeURIComponent(mode)}`;
}

/**
 * Spreadsheet formula protection must inspect the first non-whitespace/control
 * character. A simple /^[=+\-@]/ check is not enough for values such as
 * "\t=1+1" or "\u0000@cmd".
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const formulaAfterWhitespace = /^[\s\u0000-\u001f\u007f-\u009f\uFEFF]*[=+\-@]/u.test(text);
  const safe = formulaAfterWhitespace ? `'${text}` : text;
  return `"${safe.replace(/"/g, "\"\"")}"`;
}

function csvNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : value.toFixed(6);
}

function exportCsv(
  report: ProductionOperationsReport,
  rows: {
    production: ProductionOperationsReport["productionRows"];
    planned: ProductionOperationsReport["plannedRows"];
    requests: ProductionOperationsRequestRow[];
    materials: ProductionOperationsMaterialRow[];
    waste: ProductionOperationsReport["wasteRows"];
  },
  filters: { startDate: string; endDate: string },
) {
  const output: string[][] = [[
    "القسم",
    "البند",
    "الوحدة",
    "المخطط/المطلوب",
    "المنجز/الفعلي",
    "إنتاج منتهي مرتبط",
    "قيد الإنتاج مرتبط",
    "الفرق",
    "الوضع",
    "الحالة",
    "مرجع الوصفة/المصدر",
    "مراجع السجل",
    "ملاحظات",
  ]];

  rows.production.forEach((row) => output.push([
    "مخرجات فعلية",
    row.productName,
    row.unit,
    "",
    csvNumber(row.finishedQuantity),
    "",
    "",
    "",
    "",
    `مكتمل ${row.finishedBatchCount} · قيد التنفيذ ${row.inProgressBatchCount}`,
    referenceList(row.recipeSourceRecipeIds, "وصفة #"),
    referenceList(row.batchIds, "دفعة #"),
    `قيد التنفيذ ${csvNumber(row.inProgressQuantity)}`,
  ]));
  rows.planned.forEach((row) => output.push([
    "خطة إنتاج",
    row.productName,
    row.catalogUnit || "غير محددة",
    csvNumber(row.plannedQuantity),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    referenceList(row.advancedOrderIds, "أمر #"),
    "لا مقارنة دون رابط دفعة صريح",
  ]));
  rows.requests.forEach((row) => output.push([
    "طلب مطبخ مركزي",
    row.itemName,
    row.unit,
    csvNumber(row.requestedQuantity),
    csvNumber(row.goodReceivedQuantity),
    csvNumber(row.linkedFinishedQuantity),
    csvNumber(row.linkedInProgressQuantity),
    "",
    modeLabels[row.inventoryMode],
    statusLabel(row.status),
    "",
    `${referenceList(row.orderIds, "طلب #")} · ${referenceList(row.linkedBatchIds, "دفعة مرتبطة #")}`,
    `مجهز ${csvNumber(row.preparedQuantity)} · مرسل ${csvNumber(row.dispatchedQuantity)} · تالف ${csvNumber(row.damagedQuantity)} · مفقود ${csvNumber(row.missingQuantity)}`,
  ]));
  rows.materials.forEach((row) => output.push([
    "استهلاك مواد فعلي",
    row.materialName,
    row.unit,
    "",
    csvNumber(row.consumedQuantity),
    "",
    "",
    "",
    "",
    "",
    "حركة صرف مادة فعلية",
    `${referenceList(row.movementIds, "حركة #")} · ${referenceList(row.batchIds, "دفعة #")}`,
    "مرجع وصفة مستقل غير وارد في عقد حركة المادة",
  ]));
  rows.waste.forEach((row) => output.push([
    "هالك معتمد",
    row.productName,
    row.catalogUnit || "غير محددة",
    "",
    csvNumber(row.approvedQuantity),
    "",
    "",
    "",
    "",
    "معتمد",
    "",
    `${referenceList(row.wasteReportIds, "تقرير #")} · ${referenceList(row.wasteItemIds, "بند #")}`,
    "وحدة الكتالوج الحالية وليست لقطة تاريخية",
  ]));

  const csv = `\uFEFF${output.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `تقرير_التشغيل_المترابط_${filters.startDate}_${filters.endDate}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function StateCard({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <Card><CardContent className="flex flex-col items-center justify-center py-14 text-center"><div className="mb-3 text-muted-foreground">{icon}</div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-xl text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</CardContent></Card>;
}

const metricTone: Record<string, string> = {
  emerald: "border-emerald-200 bg-emerald-50/50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50/50 text-amber-800",
  violet: "border-violet-200 bg-violet-50/50 text-violet-800",
  blue: "border-blue-200 bg-blue-50/50 text-blue-800",
  cyan: "border-cyan-200 bg-cyan-50/50 text-cyan-800",
  orange: "border-orange-200 bg-orange-50/50 text-orange-800",
};

function MetricCard({ icon: Icon, label, value, tone, note, quantity = false }: { icon: ElementType; label: string; value: number | null; tone: string; note: string; quantity?: boolean }) {
  return <Card className={metricTone[tone] || metricTone.violet}><CardContent className="flex min-h-28 items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70"><Icon className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{quantity ? formatQuantity6(value) : formatCount(value)}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></div></CardContent></Card>;
}

function SectionTitle({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" aria-hidden="true" /><div><h2 className="font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div>;
}

function ModePipeline({ report, mode, search }: { report: ProductionOperationsReport; mode: PipelineMode; search: string }) {
  const rows = modeRows(report, mode);
  const summary = modeSummary(report, mode);
  return <Card className="border-violet-200"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><SectionTitle icon={Truck} title={`دورة الطلب — ${modeLabels[mode]}`} description="لا تخلط الكميات بين وضع فعلي وظلّي أو غير معروف." /><Badge variant="outline">{search ? `${rows.length} نتيجة` : summary ? `${formatCount(summary.orderCount)} طلب` : "لا توجد بنود"}</Badge></div></CardHeader><CardContent className="space-y-3">{summary || rows.length ? <>{summary && !search && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{stageLabels.map(({ summaryKey, label, icon: Icon }) => <div key={summaryKey} className="rounded-md border bg-muted/20 p-3"><div className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4 text-violet-700" />{label}</div>{summary[summaryKey].map((quantity) => <p key={quantity.unit} className="mt-2 flex justify-between gap-2 text-xs"><span>{quantity.unit}</span><span className="font-mono tabular-nums">{formatQuantity6(quantity.quantity)}</span></p>)}</div>)}</div>}{rows.length ? <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[1260px] text-sm"><caption className="sr-only">تفاصيل دورة طلبات المطبخ حسب الوضع {modeLabels[mode]}</caption><thead className="bg-muted/40"><tr><th className="p-3 text-right font-medium">الصنف</th><th className="p-3 text-right font-medium">الوحدة</th><th className="p-3 text-right font-medium">الحالة</th><th className="p-3 text-right font-medium">الطلب</th><th className="p-3 text-right font-medium">التجهيز</th><th className="p-3 text-right font-medium">الإرسال</th><th className="p-3 text-right font-medium">الاستلام السليم</th><th className="p-3 text-right font-medium">إنتاج منتهي مرتبط</th><th className="p-3 text-right font-medium">قيد الإنتاج مرتبط</th><th className="p-3 text-right font-medium">التالف</th><th className="p-3 text-right font-medium">المفقود</th><th className="p-3 text-right font-medium">المرجع</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.itemKind}-${row.itemId}-${row.unit}-${row.status}-${row.orderItemIds.join("-")}`} className="border-t"><td className="p-3 font-medium">{row.itemName}</td><td className="p-3">{row.unit}</td><td className="p-3">{statusLabel(row.status)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.requestedQuantity)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.preparedQuantity)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.dispatchedQuantity)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.goodReceivedQuantity)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.linkedFinishedQuantity)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.linkedInProgressQuantity)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.damagedQuantity)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.missingQuantity)}</td><td className="p-3 text-xs text-muted-foreground">{referenceList(row.orderIds, "طلب #")} · {referenceList(row.orderItemIds, "بند #")} · {referenceList(row.linkedBatchIds, "دفعة مرتبطة #")}</td></tr>)}</tbody></table></div> : <p className="py-5 text-center text-sm text-muted-foreground">{search ? "لا تطابق نتائج البحث." : "لا توجد تفاصيل صفوف لهذا الوضع في العقد."}</p>}<Link href={modeHref(mode)} className="inline-flex text-xs font-medium text-primary underline underline-offset-2">فتح تفاصيل طلبات هذا الوضع <Link2 className="mr-1 h-3.5 w-3.5" /></Link></> : <p className="py-5 text-center text-sm text-muted-foreground">لا توجد بنود لهذا الوضع في الفترة.</p>}</CardContent></Card>;
}

function filterRows(report: ProductionOperationsReport, search: string) {
  if (!search) return { production: report.productionRows, planned: report.plannedRows, requests: report.requestRows, materials: report.materialRows, waste: report.wasteRows };
  const matches = (value: string) => value.toLocaleLowerCase().includes(search);
  return {
    production: report.productionRows.filter((row) => matches(`${row.productName} ${row.unit} ${row.batchIds.join(" ")}`)),
    planned: report.plannedRows.filter((row) => matches(`${row.productName} ${row.catalogUnit || ""} ${row.advancedOrderIds.join(" ")}`)),
    requests: report.requestRows.filter((row) => matches(`${row.itemName} ${row.unit} ${row.inventoryMode} ${row.status} ${row.orderIds.join(" ")} ${row.linkedBatchIds.join(" ")}`)),
    materials: report.materialRows.filter((row) => matches(`${row.materialName} ${row.unit} ${row.movementIds.join(" ")} ${row.batchIds.join(" ")}`)),
    waste: report.wasteRows.filter((row) => matches(`${row.productName} ${row.catalogUnit || ""} ${row.wasteReportIds.join(" ")} ${row.wasteItemIds.join(" ")}`)),
  };
}

export function OperationsReport() {
  const { branches, isLoading: branchesLoading, canSelectBranch, defaultBranchId } = useBranches();
  const [branchId, setBranchId] = useState("");
  const [startDate, setStartDate] = useState(recentStartInRiyadh);
  const [endDate, setEndDate] = useState(todayInRiyadh);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (branchesLoading) return;
    setBranchId((current) => {
      const allowed = current === "all" ? canSelectBranch : branches.some((branch) => branch.id === current);
      if (current && allowed) return current;
      return canSelectBranch ? "all" : defaultBranchId || branches[0]?.id || "";
    });
  }, [branches, branchesLoading, canSelectBranch, defaultBranchId]);

  const dateError = startDate > endDate;
  const reportQuery = useQuery<ProductionOperationsReport, Error>({
    queryKey: ["/api/production/operations-report", branchId, startDate, endDate],
    enabled: Boolean(branchId && startDate && endDate && !dateError),
    staleTime: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, startDate, endDate });
      const response = await fetch(`/api/production/operations-report?${params.toString()}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        let message = "تعذر تحميل تقرير التشغيل المترابط.";
        try {
          const body = await response.json() as { error?: string };
          message = body.error || message;
        } catch {
          // The explicit fallback is more useful than exposing a JSON parser error.
        }
        throw new Error(message);
      }
      return response.json() as Promise<ProductionOperationsReport>;
    },
  });

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const rows = useMemo(() => reportQuery.data ? filterRows(reportQuery.data, normalizedSearch) : null, [normalizedSearch, reportQuery.data]);
  const branchName = branchId === "all" ? "جميع الفروع المسموح بها" : branches.find((branch) => branch.id === branchId)?.name || branchId;
  const reportHasData = reportQuery.data ? Boolean(
    reportQuery.data.productionRows.length ||
    reportQuery.data.plannedRows.length ||
    reportQuery.data.requestRows.length ||
    reportQuery.data.materialRows.length ||
    reportQuery.data.wasteRows.length ||
    reportQuery.data.summary.production.finishedBatchCount ||
    reportQuery.data.summary.production.inProgressBatchCount ||
    reportQuery.data.summary.advancedPlans.orderCount ||
    reportQuery.data.summary.centralKitchen.orderCount ||
    reportQuery.data.summary.materials.movementCount ||
    reportQuery.data.summary.approvedWaste.reportCount,
  ) : false;

  const download = () => {
    if (!reportQuery.data || !rows) return;
    exportCsv(reportQuery.data, rows, { startDate, endDate });
  };

  return <section className="space-y-5" dir="rtl" aria-labelledby="linked-operations-report-title">
    <Card className="overflow-hidden border-violet-200 bg-[linear-gradient(120deg,hsl(264_38%_20%),hsl(280_42%_30%))] text-white shadow-lg">
      <CardContent className="p-5 sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2 text-violet-200"><Link2 className="h-5 w-5" aria-hidden="true" /><span className="text-xs font-semibold tracking-[.14em]">تقرير تشغيل مترابط</span></div><h2 id="linked-operations-report-title" className="text-2xl font-bold">من الطلب المعتمد إلى الإنتاج والمواد والاستلام</h2><p className="mt-2 max-w-3xl text-sm text-violet-100">يعرض هذا التقرير الروابط التي أكدتها الخدمة فقط. لا تُجمع الكميات بين وحدات قياس مختلفة ولا تُفترض صلة الدفعات التاريخية.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={download} disabled={!reportQuery.data || !rows || reportQuery.isFetching} aria-label="تصدير التقرير الحالي إلى CSV"><Download className="ml-2 h-4 w-4" />CSV</Button><Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching || !branchId || dateError} aria-label="تحديث التقرير"><RefreshCw className={`ml-2 h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`} />تحديث</Button></div></div></CardContent>
    </Card>

    <Card className="border-violet-200"><CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(180px,1fr)_minmax(150px,auto)_minmax(150px,auto)_minmax(220px,1fr)] md:items-end"><div><Label htmlFor="operations-branch" className="mb-1.5 flex items-center gap-2 text-xs"><Warehouse className="h-4 w-4" />الفرع</Label><Select value={branchId || undefined} onValueChange={setBranchId} disabled={branchesLoading || !canSelectBranch}><SelectTrigger id="operations-branch" aria-label="اختر الفرع"><SelectValue placeholder={branchesLoading ? "جارٍ تحميل الفروع..." : "الفرع"} /></SelectTrigger><SelectContent>{canSelectBranch && <SelectItem value="all">جميع الفروع المسموح بها</SelectItem>}{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select>{!branchesLoading && !branches.length && <p className="mt-1 text-xs text-amber-700">لا توجد فروع مصرح بها في قائمة المستخدم.</p>}</div><div><Label htmlFor="operations-start-date" className="mb-1.5 flex items-center gap-2 text-xs"><Calendar className="h-4 w-4" />من تاريخ</Label><Input id="operations-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div><Label htmlFor="operations-end-date" className="mb-1.5 flex items-center gap-2 text-xs"><Calendar className="h-4 w-4" />إلى تاريخ</Label><Input id="operations-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div><div><Label htmlFor="operations-search" className="mb-1.5 flex items-center gap-2 text-xs"><Search className="h-4 w-4" />تصفية العرض والتصدير</Label><div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="operations-search" value={search} onChange={(event) => setSearch(event.target.value)} className="pr-9" placeholder="منتج، مادة، مرجع..." /></div></div></CardContent></Card>

    {dateError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.</div>}
    {reportQuery.isLoading || branchesLoading ? <div className="space-y-4" aria-live="polite" aria-busy="true"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[1, 2, 3, 4, 5, 6].map((item) => <Card key={item}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div><Card><CardContent className="p-5"><Skeleton className="h-64 w-full" /></CardContent></Card></div> : reportQuery.isError ? <StateCard icon={<ShieldAlert className="h-8 w-8" />} title="تعذر تحميل تقرير التشغيل المترابط" text={reportQuery.error.message} action={<Button variant="outline" onClick={() => reportQuery.refetch()}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button>} /> : !reportQuery.data || !reportHasData ? <StateCard icon={<ClipboardList className="h-8 w-8" />} title="لا توجد بيانات لهذه الفترة" text={`لم ترد سجلات مترابطة للفرع ${branchName} بين ${startDate} و${endDate}. لم يتم استبدالها بأصفار تقديرية.`} /> : rows && <ReportBody report={reportQuery.data} rows={rows} search={normalizedSearch} />}
  </section>;
}

function ReportBody({
  report,
  rows,
  search,
}: {
  report: ProductionOperationsReport;
  rows: ReturnType<typeof filterRows>;
  search: string;
}) {
  const hasRows = Boolean(rows.production.length || rows.planned.length || rows.requests.length || rows.materials.length || rows.waste.length);
  const coverage = report.coverage;
  const warningLinks: Array<{ message: string; href: string }> = [];
  if (coverage.materialPostingMissing > 0) warningLinks.push({ message: `ترحيل مواد مفقود لعدد ${coverage.materialPostingMissing} دفعة مرتبطة بوصفة.`, href: "/daily-production" });
  if (coverage.materialPostingUnknown > 0) warningLinks.push({ message: `حالة ترحيل المواد غير معروفة لعدد ${coverage.materialPostingUnknown} دفعة.`, href: "/daily-production" });
  if (coverage.outputPostingMissing > 0) warningLinks.push({ message: `إثبات ترحيل المخرج مفقود لعدد ${coverage.outputPostingMissing} دفعة.`, href: "/daily-production" });
  if (coverage.outputPostingUnknown > 0) warningLinks.push({ message: `حالة ترحيل المخرج غير معروفة لعدد ${coverage.outputPostingUnknown} دفعة تاريخية.`, href: "/daily-production" });
  if (coverage.recipeSnapshotMissing !== null && coverage.recipeSnapshotMissing > 0) warningLinks.push({ message: `لقطة الوصفة المجمدة مفقودة لعدد ${coverage.recipeSnapshotMissing} دفعة.`, href: "/production-dashboard?tab=recipes" });

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      <MetricCard icon={CheckCircle2} label="دفعات مكتملة" value={report.summary.production.finishedBatchCount} tone="emerald" note="عداد سجلات" />
      <MetricCard icon={Factory} label="دفعات قيد التنفيذ" value={report.summary.production.inProgressBatchCount} tone="amber" note="عداد سجلات" />
      <MetricCard icon={FlaskConical} label="مرتبطة بوصفة" value={coverage.recipeBacked} tone="violet" note="ربط مؤكد فقط" />
      <MetricCard icon={ClipboardList} label="طلبات المطبخ" value={report.summary.centralKitchen.orderCount} tone="blue" note="عدد سجلات؛ الكميات مفصولة حسب الوضع" />
      <MetricCard icon={PackageCheck} label="أوامر مخططة" value={report.summary.advancedPlans.orderCount} tone="cyan" note="خطة مستقلة" />
      <MetricCard icon={Warehouse} label="حركات مواد" value={report.summary.materials.movementCount} tone="orange" note="حركات فعلية" />
      <MetricCard icon={FileWarning} label="سجلات تاريخية" value={null} tone="orange" note="لا يوجد عداد مستقل في العقد" />
    </div>

    <Card><CardContent className="grid gap-3 p-4 text-sm md:grid-cols-2"><p><span className="font-semibold">الفرع:</span> {report.metadata.branchScope.requestedBranchId === "all" ? "جميع الفروع المسموح بها" : report.metadata.branchScope.requestedBranchId} · <span className="font-semibold">الفترة:</span> {report.metadata.dateWindow.startDate} — {report.metadata.dateWindow.endDate} ({report.metadata.dateWindow.timezone})</p><p><span className="font-semibold">أساس التاريخ:</span> {report.metadata.dateWindow.bases.map((basis) => `${basis.label} (${basis.dateBasis})`).join(" · ")}</p><p className="md:col-span-2"><span className="font-semibold">مصادر التقرير:</span> {report.metadata.sources.map((source) => `${source.label} — ${source.status === "available" ? "متاح" : "غير متاح"}`).join(" · ")}</p><p className="md:col-span-2"><span className="font-semibold">التكلفة:</span> {report.metadata.costing.message} <Badge variant="outline" className="mr-1 border-amber-300 text-amber-800">غير متاحة</Badge></p><p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 md:col-span-2">الدفعات التاريخية ذات حالة الوصفة غير المعروفة لا تُعد غير مرتبطة ولا مرتبطة تلقائياً. لا يقدّم العقد عداداً مستقلاً لكل الدفعات التاريخية.</p><p className="text-xs text-muted-foreground md:col-span-2">توليد {formatDateTime(report.metadata.generatedAt)} · قراءة {report.metadata.readConsistency === "repeatable_read_read_only_transaction" ? "متسقة للقراءة فقط" : report.metadata.readConsistency}</p></CardContent></Card>

    {(report.metadata.warnings.length || warningLinks.length) > 0 && <Card className="border-amber-200"><CardHeader className="pb-3"><SectionTitle icon={ShieldAlert} title="صحة الربط والتنبيهات" description="تنبيهات صريحة من عقد التقرير مع روابط متابعة معروفة." /></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{report.metadata.warnings.map((warning, index) => <div key={`metadata-${index}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="ml-2 inline h-4 w-4" />{warning}</div>)}{warningLinks.map((warning) => <div key={warning.message} className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><AlertTriangle className="ml-2 inline h-4 w-4" />{warning.message}<Link href={warning.href} className="mr-2 inline-flex items-center text-xs font-medium underline">فتح التفاصيل <Link2 className="mr-1 h-3 w-3" /></Link></div>)}</CardContent></Card>}

    <Card><CardHeader className="pb-3"><SectionTitle icon={Factory} title="المخرجات الفعلية" description="دفعات فعلية حسب المنتج والوحدة؛ لا تُجمع الوحدات ولا تُحسب الخطط ضمن المنجز." /></CardHeader><CardContent>{rows.production.length ? <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[900px] text-sm"><caption className="sr-only">المخرجات الفعلية حسب المنتج والوحدة</caption><thead className="bg-muted/40"><tr><th className="p-3 text-right font-medium">المنتج</th><th className="p-3 text-right font-medium">الوحدة</th><th className="p-3 text-right font-medium">دفعات مكتملة</th><th className="p-3 text-right font-medium">كمية مكتملة</th><th className="p-3 text-right font-medium">دفعات قيد التنفيذ</th><th className="p-3 text-right font-medium">كمية قيد التنفيذ</th><th className="p-3 text-right font-medium">مصدر الوصفة</th><th className="p-3 text-right font-medium">الدفعات</th></tr></thead><tbody>{rows.production.map((row) => <tr key={`${row.productId}-${row.productName}-${row.unit}`} className="border-t"><td className="p-3 font-medium">{row.productName}</td><td className="p-3">{row.unit}</td><td className="p-3 tabular-nums">{formatCount(row.finishedBatchCount)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.finishedQuantity)}</td><td className="p-3 tabular-nums">{formatCount(row.inProgressBatchCount)}</td><td className="p-3 tabular-nums">{formatQuantity6(row.inProgressQuantity)}</td><td className="p-3 text-xs">{referenceList(row.recipeSourceRecipeIds, "وصفة #")}</td><td className="p-3 text-xs text-muted-foreground">{referenceList(row.batchIds, "دفعة #")}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-muted-foreground">{search ? "لا تطابق نتائج البحث." : "لا توجد مخرجات فعلية."}</p>}</CardContent></Card>

    <Card><CardHeader className="pb-3"><SectionTitle icon={ClipboardList} title="الخطط مقابل المخرجات" description="الخطط معروضة مستقلة. الفرق ونسبة الإنجاز غير متاحين دون رابط دفعة صريح، لذلك لا يوجد دمج أو inference." /></CardHeader><CardContent>{rows.planned.length ? <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><caption className="sr-only">خطط الإنتاج غير القابلة للمقارنة تلقائياً مع المخرجات</caption><thead className="bg-muted/40"><tr><th className="p-3 text-right font-medium">المنتج</th><th className="p-3 text-right font-medium">وحدة الكتالوج</th><th className="p-3 text-right font-medium">الكمية المخططة</th><th className="p-3 text-right font-medium">الفرق/الإنجاز</th><th className="p-3 text-right font-medium">أوامر الإنتاج</th><th className="p-3 text-right font-medium">حالة المقارنة</th></tr></thead><tbody>{rows.planned.map((row) => <tr key={`${row.productId}-${row.productName}-${row.advancedOrderItemIds.join("-")}`} className="border-t"><td className="p-3 font-medium">{row.productName}</td><td className="p-3">{row.catalogUnit || "غير محددة"}</td><td className="p-3 tabular-nums">{formatQuantity6(row.plannedQuantity)}</td><td className="p-3 text-muted-foreground">—</td><td className="p-3 text-xs">{referenceList(row.advancedOrderIds, "أمر #")}</td><td className="p-3"><Badge variant="outline" className="border-amber-300 text-amber-800">غير متاح دون رابط دفعة صريح</Badge></td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-muted-foreground">لا توجد خطط في الفترة.</p>}</CardContent></Card>

    <div className="space-y-4"><div><SectionTitle icon={Truck} title="مسار طلبات المطبخ المركزي" description="كل وضع مخزون معروض في صف مستقل؛ الظلّي ليس حركة فعلية ولا يُسمّى فعلياً." /></div>{(["real", "shadow", "unknown"] as PipelineMode[]).map((mode) => <ModePipeline key={mode} report={report} mode={mode} search={search} />)}</div>

    <Card><CardHeader className="pb-3"><SectionTitle icon={FlaskConical} title="الاستهلاك الفعلي للمواد" description="حسب الصنف والوحدة من materialRows.consumedQuantity؛ المراجع هي حركات الصرف والدفعات كما وردت." /></CardHeader><CardContent>{rows.materials.length ? <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[840px] text-sm"><caption className="sr-only">الاستهلاك الفعلي للمواد حسب الصنف والوحدة</caption><thead className="bg-muted/40"><tr><th className="p-3 text-right font-medium">المادة</th><th className="p-3 text-right font-medium">الوحدة</th><th className="p-3 text-right font-medium">المستهلك فعلياً</th><th className="p-3 text-right font-medium">حركات الصرف</th><th className="p-3 text-right font-medium">دفعات الإنتاج</th><th className="p-3 text-right font-medium">مرجع الوصفة</th></tr></thead><tbody>{rows.materials.map((row) => <tr key={`${row.warehouseItemId}-${row.unit}`} className="border-t"><td className="p-3 font-medium">{row.materialName}</td><td className="p-3">{row.unit}</td><td className="p-3 tabular-nums">{formatQuantity6(row.consumedQuantity)}</td><td className="p-3 text-xs">{referenceList(row.movementIds, "حركة #")}</td><td className="p-3 text-xs">{referenceList(row.batchIds, "دفعة #")}</td><td className="p-3 text-xs text-muted-foreground">غير وارد في عقد حركات المادة</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-muted-foreground">{search ? "لا تطابق نتائج البحث." : "لا توجد حركات استهلاك فعلية."}</p>}</CardContent></Card>

    <Card><CardHeader className="pb-3"><SectionTitle icon={FileWarning} title="الهالك المعتمد" description="صفوف مستقلة عن الاستهلاك، مع approvedQuantity ووحدة الكتالوج الحالية." /></CardHeader><CardContent>{rows.waste.length ? <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><caption className="sr-only">الهالك المعتمد</caption><thead className="bg-muted/40"><tr><th className="p-3 text-right font-medium">المنتج</th><th className="p-3 text-right font-medium">وحدة الكتالوج الحالية</th><th className="p-3 text-right font-medium">الكمية المعتمدة</th><th className="p-3 text-right font-medium">تقارير الهالك</th><th className="p-3 text-right font-medium">بنود الهالك</th></tr></thead><tbody>{rows.waste.map((row) => <tr key={`${row.productId}-${row.catalogUnit || "unknown"}`} className="border-t"><td className="p-3 font-medium">{row.productName}</td><td className="p-3">{row.catalogUnit || "غير محددة"}</td><td className="p-3 tabular-nums">{formatQuantity6(row.approvedQuantity)}</td><td className="p-3 text-xs">{referenceList(row.wasteReportIds, "تقرير #")}</td><td className="p-3 text-xs">{referenceList(row.wasteItemIds, "بند #")}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-muted-foreground">{search ? "لا تطابق نتائج البحث." : "لا توجد صفوف هالك معتمدة."}</p>}</CardContent></Card>

    {!hasRows && search && <StateCard icon={<Search className="h-8 w-8" />} title="لا توجد نتائج مطابقة" text="غيّر عبارة البحث لرؤية صفوف التقرير الحالية." />}
  </div>;
}