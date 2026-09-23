import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { BarChart3, Download, ExternalLink, Search, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { demandDecimal, demandMicros } from "@shared/central-kitchen-demand";

type Row = {
  id: number; originalOrderId: number; originalOrderItemId: number; productId: number | null; warehouseItemId: number | null;
  requestBranchId: string; centralKitchenId: string; productName: string; unit: string; inventoryMode: string | null;
  requestedQuantity: number; originalGoodReceivedQuantity: number; acceptedSubstituteQuantity: string;
  compensationGoodReceivedQuantity: string; waivedQuantity: string; remainingQuantity: string;
  preparationShortfallQuantity: number; transitLossQuantity: number; substituteOfferedQuantity: number;
  status: string; reasonCode: string; activatedAt: string; agingDays: number; overdue: boolean;
  effectiveStatus: string;
  nextDueDate: string | null; responsibleUserIds: string[]; serviceFulfilled: boolean;
  originalReceiptBasis: "estimated_original_first" | "branch_confirmed";
};
type Group = {
  key: string; productName: string; unit: string; inventoryMode: string | null;
  requestedQuantity: string; originalGoodReceivedQuantity: string; acceptedSubstituteQuantity: string;
  compensationGoodReceivedQuantity: string; waivedQuantity: string; remainingQuantity: string;
};
type Candidate = { orderId: number; orderNumber: string; itemId: number; productName: string; unit: string; requestedQuantity: string; estimatedOriginalGoodReceivedQuantity: string; estimatedRemainingQuantity: string; inventoryEffect: "none" };
type ResponsibleUser = { id: string; name: string };

const blank = { branchId: "all", kitchenId: "all", status: "all", reason: "all", mode: "all", item: "", ownerId: "", dateFrom: "", dateTo: "", overdue: "all" };
const safeCsv = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const add = (values: Array<string | number>) => demandDecimal(values.reduce((sum, value) => sum + demandMicros(String(value)), BigInt(0)));
const statusLabel: Record<string, string> = { open: "مفتوح", substitute_pending: "بديل ينتظر القبول", replacement_planned: "تعويض مخطط", partially_settled: "مسوّى جزئياً", fulfilled: "خدمة مكتملة", waived: "متنازل عنه" };
const reasonLabel: Record<string, string> = { preparation_shortfall: "عجز تجهيز", transit_loss: "فقد أثناء النقل" };
const modeLabel: Record<string, string> = { real: "فعلي", shadow: "ظلّي", legacy: "قديم / مصالحة" };

export default function CentralKitchenDemandReportPage() {
  const { branches } = useBranches();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(blank);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"work" | "summary" | "history">("work");
  const [page, setPage] = useState(1);
  const [candidatePage, setCandidatePage] = useState(1);
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "50");
  Object.entries(filters).forEach(([key, value]) => { if (value && value !== "all") params.set(key, value); });
  const url = `/api/central-kitchen-demand${params.size ? `?${params}` : ""}`;
  const report = useQuery<{ rows: Row[]; groups: Group[]; responsibleUsers: ResponsibleUser[]; total: number; totalPages: number }>({ queryKey: [url] });
  const candidatesUrl = `/api/central-kitchen-demand/legacy-candidates?page=${candidatePage}&pageSize=50`;
  const candidates = useQuery<{ rows: Candidate[]; total: number; totalPages: number }>({ queryKey: [candidatesUrl] });
  const activate = useMutation({
    mutationFn: async (itemId: number) => (await apiRequest("POST", `/api/central-kitchen-demand/activate/${itemId}`, {})).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/central-kitchen-demand") });
      toast({ title: "تم تفعيل المصالحة دون أي حركة مخزون" });
    },
    onError: (error) => toast({ title: "تعذر التفعيل", description: error instanceof Error ? error.message : "", variant: "destructive" }),
  });
  const rows = report.data?.rows || [];
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const ownerNames = new Map((report.data?.responsibleUsers || []).map((owner) => [owner.id, owner.name]));
  const fallbackGroups = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    rows.forEach((row) => {
      const identity = row.productId ? `p:${row.productId}` : row.warehouseItemId ? `w:${row.warehouseItemId}` : `n:${row.productName}`;
      const key = `${identity}|${row.unit}|${row.inventoryMode || "legacy"}`;
      grouped.set(key, [...(grouped.get(key) || []), row]);
    });
    return Array.from(grouped.entries()).map(([key, values]) => ({
      key, name: values[0].productName, unit: values[0].unit, mode: values[0].inventoryMode || "legacy",
      requested: add(values.map((row) => row.requestedQuantity)),
      original: add(values.map((row) => row.originalGoodReceivedQuantity)),
      substitute: add(values.map((row) => row.acceptedSubstituteQuantity)),
      compensation: add(values.map((row) => row.compensationGoodReceivedQuantity)),
      waived: add(values.map((row) => row.waivedQuantity)),
      remaining: add(values.map((row) => row.remainingQuantity)),
    }));
  }, [rows]);
  const groups = report.data?.groups?.map((group) => ({
    key: group.key, name: group.productName, unit: group.unit, mode: group.inventoryMode || "legacy",
    requested: group.requestedQuantity, original: group.originalGoodReceivedQuantity,
    substitute: group.acceptedSubstituteQuantity, compensation: group.compensationGoodReceivedQuantity,
    waived: group.waivedQuantity, remaining: group.remainingQuantity,
  })) || fallbackGroups;
  const update = (key: keyof typeof blank, value: string) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== "item" && value && value !== "all").length;
  const exportRows = async () => {
    const exportParams = new URLSearchParams(params);
    exportParams.delete("page"); exportParams.delete("pageSize"); exportParams.set("export", "true");
    const response = await fetch(`/api/central-kitchen-demand?${exportParams}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) { toast({ title: "تعذر تصدير التقرير", variant: "destructive" }); return; }
    const exportData = (await response.json()) as { rows: Row[]; responsibleUsers: ResponsibleUser[] };
    const exportRows = exportData.rows;
    const exportOwnerNames = new Map(exportData.responsibleUsers.map((owner) => [owner.id, owner.name]));
    const headers = ["المطبخ", "الفرع", "الصنف", "الوحدة", "الوضع", "تاريخ التفعيل", "الحالة", "السبب", "العمر بالأيام", "متأخر", "المسؤول", "الاستحقاق", "المطلوب الأصلي", "المستلم الأصلي", "أساس إسناد الاستلام", "البديل المقبول", "التعويض المستلم", "المتنازل", "المتبقي", "إتمام الخدمة"];
    const body = exportRows.map((row) => [
      branchNames.get(row.centralKitchenId) || row.centralKitchenId, branchNames.get(row.requestBranchId) || row.requestBranchId, row.productName, row.unit, modeLabel[row.inventoryMode || "legacy"] || row.inventoryMode, row.activatedAt,
      statusLabel[row.effectiveStatus] || row.effectiveStatus, reasonLabel[row.reasonCode] || row.reasonCode, row.agingDays, row.overdue ? "نعم" : "لا", row.responsibleUserIds.map((id) => exportOwnerNames.get(id) || id).join("|"), row.nextDueDate,
      row.requestedQuantity, row.originalGoodReceivedQuantity, row.originalReceiptBasis === "branch_confirmed" ? "مؤكد من الفرع" : "تقديري: الأصلي أولاً",
      row.acceptedSubstituteQuantity, row.compensationGoodReceivedQuantity, row.waivedQuantity, row.remainingQuantity, row.serviceFulfilled ? "نعم" : "لا",
    ].map(safeCsv).join(","));
    const blob = new Blob([`\uFEFF${headers.map(safeCsv).join(",")}\r\n${body.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = "central-kitchen-unmet-demand.csv"; anchor.click(); URL.revokeObjectURL(objectUrl);
  };
  const openRows = rows.filter((row) => !row.serviceFulfilled && Number(row.remainingQuantity) > 0);
  const overdueRows = openRows.filter((row) => row.overdue);
  return <Layout><main dir="rtl" className="demand-workspace page-container space-y-3 pb-10">
    <PageHeader icon={BarChart3} tone="production" title="تقرير الطلب غير الملبّى" description="قياس إتمام الخدمة للطلب الأصلي بمعزل عن الإغلاق الإداري وحركة المخزون"
      actions={<div className="flex gap-2"><Link href="/central-kitchen-orders"><Button variant="outline">الطلبات</Button></Link><Button onClick={() => void exportRows()} disabled={!report.data?.total}><Download className="ml-1 h-4 w-4" />CSV عربي</Button></div>} />
    <section className="demand-mobile-summary rounded-xl border border-amber-200 bg-[#fff8e9] p-3" aria-label="ملخص قرارات الطلب غير الملبّى"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold text-amber-900">ضمن هذه الصفحة</p><strong className="text-lg">{openRows.length} بنود تحتاج قراراً</strong></div><div className="text-left text-xs text-amber-900"><strong className="block text-base">{overdueRows.length}</strong>متأخر</div></div></section>
    <nav className="flex gap-1 overflow-x-auto border-b pb-2 sm:hidden" aria-label="أقسام تقرير الطلب غير الملبّى"><Button size="sm" className="min-h-11 shrink-0" variant={mobileView === "work" ? "default" : "outline"} onClick={() => setMobileView("work")}>القرارات</Button><Button size="sm" className="min-h-11 shrink-0" variant={mobileView === "summary" ? "default" : "outline"} onClick={() => setMobileView("summary")}>الإجماليات</Button><Button size="sm" className="min-h-11 shrink-0" variant={mobileView === "history" ? "default" : "outline"} onClick={() => setMobileView("history")}>مصالحة تاريخية</Button></nav>
    <Card className="demand-report-filters"><CardContent className="p-3 sm:p-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative sm:col-span-2 lg:col-span-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="min-h-11 pr-9" placeholder="الصنف" value={filters.item} onChange={(event) => update("item", event.target.value)} /></div>
      <Button className="min-h-11 sm:hidden" variant="outline" onClick={() => setMobileFiltersOpen((open) => !open)} aria-expanded={mobileFiltersOpen}><SlidersHorizontal className="ml-1 h-4 w-4" />الفلاتر{activeFilterCount ? ` (${activeFilterCount})` : ""}</Button>
      <details className="hidden sm:block sm:col-span-2 lg:col-span-3"><summary className="cursor-pointer py-2 text-sm">فلاتر إضافية: السبب، الوضع، التاريخ، المسؤول والتأخير</summary></details>
      <div className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 sm:contents`}>
      <Select value={filters.kitchenId} onValueChange={(value) => update("kitchenId", value)}><SelectTrigger><SelectValue placeholder="المطبخ" /></SelectTrigger><SelectContent><SelectItem value="all">كل المطابخ</SelectItem>{branches.filter((branch) => branch.isCentralKitchen).map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.branchId} onValueChange={(value) => update("branchId", value)}><SelectTrigger><SelectValue placeholder="الفرع" /></SelectTrigger><SelectContent><SelectItem value="all">كل الفروع المسموحة</SelectItem>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select>
       <Select value={filters.status} onValueChange={(value) => update("status", value)}><SelectTrigger className="min-h-11"><SelectValue placeholder="الحالة" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="open">مفتوح</SelectItem><SelectItem value="substitute_pending">بديل ينتظر القبول</SelectItem><SelectItem value="replacement_planned">تعويض مخطط</SelectItem><SelectItem value="partially_settled">مسوى جزئياً</SelectItem><SelectItem value="fulfilled">خدمة مكتملة</SelectItem><SelectItem value="waived">متنازل عنه</SelectItem></SelectContent></Select>
       <Select value={filters.reason} onValueChange={(value) => update("reason", value)}><SelectTrigger className="min-h-11"><SelectValue placeholder="السبب" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأسباب</SelectItem><SelectItem value="preparation_shortfall">عجز تجهيز</SelectItem><SelectItem value="transit_loss">فقد نقل</SelectItem></SelectContent></Select>
      <Select value={filters.mode} onValueChange={(value) => update("mode", value)}><SelectTrigger><SelectValue placeholder="الوضع" /></SelectTrigger><SelectContent><SelectItem value="all">فعلي وظلّي وقديم</SelectItem><SelectItem value="real">فعلي</SelectItem><SelectItem value="shadow">ظلّي</SelectItem><SelectItem value="legacy">قديم / مصالحة</SelectItem></SelectContent></Select>
       <Input aria-label="من تاريخ" lang="en" type="date" value={filters.dateFrom} onChange={(event) => update("dateFrom", event.target.value)} />
        <Input aria-label="إلى تاريخ" lang="en" type="date" value={filters.dateTo} onChange={(event) => update("dateTo", event.target.value)} />
      <Select value={filters.ownerId || "all"} onValueChange={(value) => update("ownerId", value === "all" ? "" : value)}><SelectTrigger aria-label="المسؤول"><SelectValue placeholder="المسؤول" /></SelectTrigger><SelectContent><SelectItem value="all">كل المسؤولين النشطين</SelectItem>{(report.data?.responsibleUsers || []).map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}</SelectContent></Select>
       <Select value={filters.overdue} onValueChange={(value) => update("overdue", value)}><SelectTrigger><SelectValue placeholder="التأخير" /></SelectTrigger><SelectContent><SelectItem value="all">الكل زمنياً</SelectItem><SelectItem value="true">متأخر فقط</SelectItem><SelectItem value="false">غير متأخر</SelectItem></SelectContent></Select>
       <Button className="min-h-11" variant="outline" onClick={() => { setPage(1); setFilters(blank); }}>مسح الفلاتر</Button>
       <div className="flex gap-2 sm:hidden"><Link href="/central-kitchen-orders" className="flex-1"><Button className="min-h-11 w-full" variant="outline">الطلبات</Button></Link><Button className="min-h-11 flex-1" variant="outline" onClick={() => void exportRows()} disabled={!report.data?.total}>CSV عربي</Button></div>
      </div></div></CardContent></Card>
    <p className="demand-explanation rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">عندما لم يؤكد الفرع توزيع الاستلام بين الأصلي والبديل، يظهر المستلم الأصلي كتقدير «الأصلي أولاً» بوضوح، ولا يُعرض كحقيقة مؤكدة. هذا التصنيف لا يعيد ترحيل المخزون.</p>
    <Card className={`demand-details ${mobileView === "work" ? "" : "hidden sm:block"}`}><CardContent className="p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">التفاصيل والتتبع ({report.data?.total || 0})</h2><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button><span className="text-xs">{page} / {report.data?.totalPages || 1}</span><Button size="sm" variant="outline" disabled={page >= (report.data?.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>التالي</Button></div></div>{report.isLoading ? <p>جارٍ التحميل…</p> : report.isError ? <p role="alert" className="text-red-700">تعذر تحميل التقرير. لم تُفترض بيانات بديلة.</p> : <><div className="space-y-2 md:hidden">{rows.map((row) => <article key={row.id} className="demand-row-card rounded-xl border bg-background p-3"><div className="flex justify-between gap-3"><div><strong>{row.productName}</strong><p className="text-xs text-muted-foreground">{row.unit} · {modeLabel[row.inventoryMode || "legacy"] || row.inventoryMode} · {reasonLabel[row.reasonCode] || row.reasonCode}</p></div><strong className="text-amber-800">{row.remainingQuantity} متبقٍ</strong></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs"><span><span className="block text-muted-foreground">المطلوب</span><strong>{row.requestedQuantity} {row.unit}</strong></span><span><span className="block text-muted-foreground">الحالة</span><strong>{statusLabel[row.effectiveStatus] || row.effectiveStatus}</strong></span><span><span className="block text-muted-foreground">المسؤول</span><strong>{row.responsibleUserIds.length ? row.responsibleUserIds.map((id) => ownerNames.get(id) || id).join("، ") : "لا يوجد تعويض نشط"}</strong></span><span><span className="block text-muted-foreground">الاستحقاق</span><strong className={row.overdue ? "text-red-700" : ""}>{row.nextDueDate || "لا يوجد استحقاق"}</strong></span></div><p className="mt-2 text-xs">{branchNames.get(row.centralKitchenId) || row.centralKitchenId} ← {branchNames.get(row.requestBranchId) || row.requestBranchId} · {row.agingDays} يوم {row.overdue ? "· متأخر" : ""}</p><details className="mt-3 rounded border bg-muted/10 p-2 text-xs"><summary className="cursor-pointer font-medium text-primary">مكونات الكمية</summary><div className="mt-2 space-y-1 text-muted-foreground"><p>الأصلي الجيد: {row.originalGoodReceivedQuantity} · البديل المقبول: {row.acceptedSubstituteQuantity}</p><p>التعويض المستلم: {row.compensationGoodReceivedQuantity} · المتنازل: {row.waivedQuantity}</p><p>عجز التجهيز: {row.preparationShortfallQuantity} · فقد النقل: {row.transitLossQuantity} · البديل المعروض: {row.substituteOfferedQuantity}</p></div></details><Link href={`/central-kitchen-orders?orderId=${row.originalOrderId}`} className="mt-2 inline-flex min-h-11 items-center text-xs text-primary underline">فتح قرار الطلب</Link></article>)}</div><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>الصنف والتفاصيل</TableHead><TableHead>المطبخ / الفرع</TableHead><TableHead>المسؤول / الاستحقاق</TableHead><TableHead>العمر</TableHead><TableHead>المطلوب</TableHead><TableHead>المتبقي</TableHead><TableHead>الخدمة / الحالة</TableHead><TableHead>تتبع</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.productName}<span className="block text-xs text-muted-foreground">{row.unit} · {modeLabel[row.inventoryMode || "legacy"] || row.inventoryMode} · {reasonLabel[row.reasonCode] || row.reasonCode}</span><details className="mt-1 text-xs"><summary className="cursor-pointer text-primary">مكونات الكمية</summary><div className="mt-1 space-y-0.5 text-muted-foreground"><p>الأصلي الجيد: {row.originalGoodReceivedQuantity} · البديل المقبول: {row.acceptedSubstituteQuantity}</p><p>التعويض المستلم: {row.compensationGoodReceivedQuantity} · المتنازل: {row.waivedQuantity}</p><p>عجز التجهيز: {row.preparationShortfallQuantity} · فقد النقل: {row.transitLossQuantity} · البديل المعروض: {row.substituteOfferedQuantity}</p></div></details></TableCell><TableCell>{branchNames.get(row.centralKitchenId) || row.centralKitchenId}<span className="block text-xs text-muted-foreground">{branchNames.get(row.requestBranchId) || row.requestBranchId}</span></TableCell><TableCell>{row.responsibleUserIds.length ? row.responsibleUserIds.map((id) => ownerNames.get(id) || id).join("، ") : "لا يوجد تعويض نشط"}<span className={`block text-xs ${row.overdue ? "text-red-700" : "text-muted-foreground"}`}>{row.nextDueDate || "لا يوجد استحقاق نشط"}</span></TableCell><TableCell>{row.agingDays} يوم{row.overdue && <span className="block text-xs text-red-700">متأخر</span>}</TableCell><TableCell>{row.requestedQuantity}</TableCell><TableCell className="font-semibold">{row.remainingQuantity}</TableCell><TableCell>{row.serviceFulfilled ? "مكتملة" : "غير مكتملة"}<span className="block text-xs text-muted-foreground">{statusLabel[row.effectiveStatus] || row.effectiveStatus}</span></TableCell><TableCell><Link href={`/central-kitchen-orders?orderId=${row.originalOrderId}`}><Button size="sm" variant="outline"><ExternalLink className="ml-1 h-3.5 w-3.5" />الطلب</Button></Link></TableCell></TableRow>)}</TableBody></Table></div></>}</CardContent></Card>
    <Card className={`demand-totals ${mobileView === "summary" ? "" : "hidden sm:block"}`}><CardContent className="p-3 sm:p-4"><h2 className="mb-3 font-semibold">الإجماليات المجمعة — الهوية + الوحدة + الوضع</h2><div className="space-y-2 md:hidden">{groups.map((group) => <details key={group.key} className="rounded-lg border bg-background p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span><strong className="block">{group.name}</strong><span className="text-xs text-muted-foreground">{group.unit} · {modeLabel[group.mode] || group.mode}</span></span><strong>{group.remaining} متبقٍ</strong></summary><dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs"><div><dt>المطلوب</dt><dd>{group.requested}</dd></div><div><dt>الأصلي</dt><dd>{group.original}</dd></div><div><dt>البديل</dt><dd>{group.substitute}</dd></div><div><dt>التعويض</dt><dd>{group.compensation}</dd></div><div><dt>المتنازل</dt><dd>{group.waived}</dd></div></dl></details>)}</div><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الوحدة / الوضع</TableHead><TableHead>المطلوب</TableHead><TableHead>الأصلي</TableHead><TableHead>البديل</TableHead><TableHead>التعويض</TableHead><TableHead>المتنازل</TableHead><TableHead>المتبقي</TableHead></TableRow></TableHeader><TableBody>{groups.map((group) => <TableRow key={group.key}><TableCell>{group.name}</TableCell><TableCell>{group.unit} · {modeLabel[group.mode] || group.mode}</TableCell><TableCell>{group.requested}</TableCell><TableCell>{group.original}</TableCell><TableCell>{group.substitute}</TableCell><TableCell>{group.compensation}</TableCell><TableCell>{group.waived}</TableCell><TableCell>{group.remaining}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    <Card className={`demand-admin-history ${mobileView === "history" ? "" : "hidden sm:block"}`}><CardContent className="p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">طلبات مستلمة تاريخياً تحتاج مصالحة ({candidates.data?.total || 0})</h2><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={candidatePage <= 1} onClick={() => setCandidatePage((value) => value - 1)}>السابق</Button><span className="text-xs">{candidatePage} / {candidates.data?.totalPages || 1}</span><Button size="sm" variant="outline" disabled={candidatePage >= (candidates.data?.totalPages || 1)} onClick={() => setCandidatePage((value) => value + 1)}>التالي</Button></div></div>{candidates.isLoading ? <p>جارٍ التحميل…</p> : candidates.isError ? <p role="alert" className="text-red-700">تعذر تحميل مرشحي المصالحة.</p> : <div className="space-y-2">{candidates.data?.rows.map((candidate) => <article key={candidate.itemId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span><strong>{candidate.productName}</strong><small className="mr-2 text-muted-foreground">{candidate.orderNumber} · المتبقي {candidate.estimatedRemainingQuantity}</small></span><Button size="sm" disabled={!canEdit("central_kitchen_orders") || activate.isPending} onClick={() => activate.mutate(candidate.itemId)}>تفعيل المصالحة</Button></article>)}</div>}</CardContent></Card>
  </main></Layout>;
}