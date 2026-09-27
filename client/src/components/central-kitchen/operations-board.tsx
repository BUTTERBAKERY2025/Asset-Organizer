import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { CentralKitchenOperationDemand, CentralKitchenOperationsResponse, CentralKitchenRuntimeMode } from "@shared/central-kitchen-live";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Factory, Loader2, PackageCheck, Play, RefreshCw, Search, Settings2, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RecipeMaterialsPreview, useRecipeMaterialRequirements } from "@/components/central-kitchen/recipe-materials";
import { RecipeExceptions, exceptionQueryKey, useOrderRecipeExceptions } from "@/components/central-kitchen/recipe-exceptions";
import { linkedBatchPayload, matchingApprovedException, type ExceptionBinding } from "@/components/central-kitchen/recipe-exception-flow";
import { OPERATIONS_PAGE_SIZE, selectOperationsDemands, type DemandFilter } from "./operations-board-model";
import "./operations-board.css";

type Kitchen = { id: string; name: string };
const modeStyle: Record<CentralKitchenRuntimeMode, string> = {
  shadow: "bg-amber-50 text-amber-800 border-amber-200",
  real: "bg-emerald-50 text-emerald-800 border-emerald-200",
  paused: "bg-stone-100 text-stone-700 border-stone-200",
};
const modeLabel: Record<CentralKitchenRuntimeMode, string> = { shadow: "تشغيل ظلّي", real: "مخزون فعلي", paused: "متوقف" };
const qty = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 2 }).format(value);
const saudiDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function OperationsBoard({ kitchens, kitchenId, onKitchenChange }: { kitchens: Kitchen[]; kitchenId: string; onKitchenChange: (id: string) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, canCreate } = usePermissions();
  const [modeDraft, setModeDraft] = useState<CentralKitchenRuntimeMode | null>(null);
  const [production, setProduction] = useState<{ orderId: number; itemId: number; productId: number; unit: string; name: string; uncovered: number } | null>(null);
  const [batchQty, setBatchQty] = useState("");
  const [date, setDate] = useState(saudiDate);
  const [batchMode, setBatchMode] = useState<"recipe" | "exception">("recipe");
  const batchAttemptRef = useRef<{ signature: string; key: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DemandFilter>("all");
  const [unit, setUnit] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const operations = useQuery<CentralKitchenOperationsResponse>({
    queryKey: ["/api/central-kitchen-orders/operations", kitchenId],
    queryFn: async () => {
      const response = await fetch(`/api/central-kitchen-orders/operations?kitchenId=${encodeURIComponent(kitchenId)}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(response.status === 403 ? "لا تملك صلاحية عرض هذا المطبخ."
          : response.status === 409 && typeof body?.error === "string"
            ? `${body.error}. راجع الأصناف المرتبطة بالطلبات المعتمدة مع المسؤول.`
            : "تعذر تحميل احتياج التشغيل.");
      }
      return response.json();
    },
    enabled: Boolean(kitchenId),
    refetchInterval: 45_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/central-kitchen-orders/operations", kitchenId] });
  const recipeRequirements = useRecipeMaterialRequirements({
    kitchenId, productId: production?.productId || 0, quantity: batchQty, enabled: production !== null,
  });
  const exceptions = useOrderRecipeExceptions(production?.orderId || 0, production !== null);
  const binding: ExceptionBinding | null = production ? {
    orderId: production.orderId, itemId: production.itemId, kitchenId, productId: production.productId,
    unit: production.unit, quantity: Number(batchQty), productionDate: date,
  } : null;
  const approvedException = binding && exceptions.data ? matchingApprovedException(exceptions.data.exceptions, binding) : undefined;
  const runtimeMutation = useMutation({
    mutationFn: async (mode: CentralKitchenRuntimeMode) => {
      const response = await apiRequest("PUT", `/api/central-kitchen-orders/runtime/${kitchenId}`, { mode });
      return response.json();
    },
    onSuccess: () => {
      setModeDraft(null);
      void queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/central-kitchen-orders") });
      toast({ title: "تم تحديث وضع تشغيل المطبخ" });
    },
    onError: (error) => toast({ title: "لم يتم تحديث الوضع", description: error instanceof Error ? error.message : "حاول مجدداً.", variant: "destructive" }),
  });
  const batchMutation = useMutation({
    mutationFn: async () => {
      if (!production || !binding) throw new Error("اختر بنداً للإنتاج.");
      if (batchMode === "recipe" && (!recipeRequirements.data?.recipe || recipeRequirements.isError)) throw new Error("لا توجد وصفة معتمدة صالحة لربط هذه الدفعة.");
      if (batchMode === "exception" && !exceptions.data) throw new Error("تعذر قراءة الاعتماد؛ أعد تحميل الاستثناءات.");
      const signature = JSON.stringify({ ...binding, mode: batchMode, exceptionId: approvedException?.id });
      if (!batchAttemptRef.current || batchAttemptRef.current.signature !== signature) batchAttemptRef.current = { signature, key: crypto.randomUUID() };
      const payload = linkedBatchPayload(binding, batchMode === "recipe", exceptions.data?.exceptions || [], batchAttemptRef.current.key);
      const response = await apiRequest("POST", `/api/central-kitchen-orders/${production.orderId}/items/${production.itemId}/production-batches`, payload);
      return response.json();
    },
    onSuccess: () => { const orderId = production?.orderId; batchAttemptRef.current = null; setProduction(null); setBatchQty(""); setBatchMode("recipe"); refresh(); if (orderId) { void queryClient.invalidateQueries({ queryKey: exceptionQueryKey(orderId) }); void queryClient.invalidateQueries({ queryKey: [`/api/central-kitchen-orders/${orderId}`] }); } toast({ title: batchMode === "recipe" ? "بدأت دفعة الإنتاج وربطت بالوصفة المعتمدة" : "بدأت دفعة استثنائية دون وصفة؛ لا يُسجّل استهلاك مواد خام" }); },
    onError: (error) => toast({ title: "تعذر إنشاء الدفعة", description: error instanceof Error ? error.message : "تحقق من الاحتياج المتبقي.", variant: "destructive" }),
  });
  const data = operations.data;
  const units = [...new Set(data?.demands.map(d => d.unit) || [])].sort((a, b) => a.localeCompare(b, "ar"));
  const { filtered, pageItems, currentPage, totalPages } = selectOperationsDemands(data?.demands || [], { search, filter, unit, page });
  const selected = data?.demands.find(d => d.orderItemId === selectedId) || null;
  const canProduce = canCreate("production");
  const setCriteria = (next: { search?: string; filter?: DemandFilter; unit?: string }) => {
    if (next.search !== undefined) setSearch(next.search);
    if (next.filter !== undefined) setFilter(next.filter);
    if (next.unit !== undefined) setUnit(next.unit);
    setPage(1);
  };
  const begin = (d: CentralKitchenOperationDemand) => {
    setBatchQty(String(d.uncoveredQuantity)); setBatchMode("recipe"); batchAttemptRef.current = null;
    setProduction({ orderId: d.orderId, itemId: d.orderItemId, productId: d.catalogId, unit: d.unit, name: d.name, uncovered: d.uncoveredQuantity });
  };
  const productionAllowed = (d: CentralKitchenOperationDemand) => d.kind === "product" && !d.catalogInactive && d.uncoveredQuantity > 0 && canProduce && data?.runtime.mode !== "paused";

  return <section dir="rtl" className="operations-board space-y-4">
    <div className="ops-shell">
      <div className="ops-top flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0"><span className="ops-kicker inline-flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" /> مساحة تشغيل المطبخ</span><h2>احتياجات الإنتاج المعتمدة</h2><p>متابعة كل بند على حدة، دون دمج القطع والكيلو أو افتراض صرف المواد الخام.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kitchenId || undefined} onValueChange={id => { onKitchenChange(id); setSelectedId(null); setCriteria({ search: "", filter: "all", unit: "all" }); }}><SelectTrigger aria-label="المطبخ المركزي" className="w-[180px] bg-white"><SelectValue placeholder="اختر المطبخ" /></SelectTrigger><SelectContent>{kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select>
          {data && <Badge variant="outline" className={`${modeStyle[data.runtime.mode]} border`}>{modeLabel[data.runtime.mode]}</Badge>}
          <Button size="icon" variant="outline" onClick={() => refresh()} disabled={!kitchenId || operations.isFetching} aria-label="تحديث الاحتياجات"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      {!kitchenId ? <State icon={<Factory className="h-7 w-7" />} title="اختر مطبخاً مركزياً" text="اعرض احتياجات الفرع المعتمدة وحالة تغطيتها." /> :
        operations.isLoading ? <div aria-label="تحميل احتياجات التشغيل" className="space-y-2 p-5">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-violet-100/60" />)}</div> :
        operations.isError ? <State icon={<AlertTriangle className="h-7 w-7" />} title="البيانات التشغيلية غير متاحة" text={operations.error instanceof Error ? operations.error.message : "تحقق من الاتصال."} action={<Button variant="outline" onClick={() => operations.refetch()}>إعادة المحاولة</Button>} /> : data && <>
          <div className="ops-statbar" aria-label="ملخص البنود">
            <Stat value={data.demands.length} label="بنود معتمدة" />
            <Stat value={data.demands.filter(d => d.uncoveredQuantity > 0).length} label="تحتاج تغطية" />
            <Stat value={data.demands.filter(d => d.linkedUnfinishedQuantity > 0).length} label="قيد الإنتاج" />
            <Stat value={data.demands.filter(d => d.catalogInactive).length} label="أصناف غير مفعّلة" />
            <span className="px-4 text-[11px] text-[#766b84]">الكميات مفصولة بحسب الوحدة داخل تفاصيل كل بند</span>
          </div>
          {isAdmin && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9e1ef] bg-[#f8f3fa] px-4 py-2 text-xs"><span><Settings2 className="ml-1 inline h-3.5 w-3.5" /> وضع المخزون: الظلّي لا يرحّل رصيداً؛ التغيير يتطلب تأكيداً.</span><Select value={data.runtime.mode} onValueChange={value => { if (value !== data.runtime.mode) setModeDraft(value as CentralKitchenRuntimeMode); }}><SelectTrigger aria-label="ضبط وضع المخزون" className="h-8 w-40 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shadow">تشغيل ظلّي</SelectItem><SelectItem value="real">مخزون فعلي</SelectItem><SelectItem value="paused">إيقاف</SelectItem></SelectContent></Select></div>}
          <div className="ops-toolbar">
            <div className="ops-search"><Search aria-hidden="true" /><Input aria-label="بحث في الطلبات والأصناف" placeholder="ابحث برقم الطلب أو الصنف أو التاريخ..." value={search} onChange={e => setCriteria({ search: e.target.value })} /></div>
            <Select value={filter} onValueChange={value => setCriteria({ filter: value as DemandFilter })}><SelectTrigger aria-label="تصفية الحالة" className="h-9 w-[154px] bg-white"><SlidersHorizontal className="ml-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">جميع الحالات</SelectItem><SelectItem value="uncovered">تحتاج تغطية</SelectItem><SelectItem value="production">قيد الإنتاج</SelectItem><SelectItem value="covered">مغطاة</SelectItem><SelectItem value="inactive">غير مفعّلة</SelectItem></SelectContent></Select>
            <Select value={unit} onValueChange={value => setCriteria({ unit: value })}><SelectTrigger aria-label="تصفية الوحدة" className="h-9 w-[140px] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">جميع الوحدات</SelectItem>{units.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
            {(search || filter !== "all" || unit !== "all") && <Button variant="ghost" size="sm" onClick={() => setCriteria({ search: "", filter: "all", unit: "all" })}>مسح الفلاتر</Button>}
          </div>
          {!data.demands.length ? <State icon={<PackageCheck className="h-7 w-7" />} title="لا توجد احتياجات معتمدة" text="ستظهر البنود هنا بعد اعتماد طلبات الفروع." /> :
            !filtered.length ? <State icon={<Search className="h-7 w-7" />} title="لا توجد نتائج مطابقة" text="غيّر البحث أو الفلاتر لعرض بنود أخرى." action={<Button variant="outline" onClick={() => setCriteria({ search: "", filter: "all", unit: "all" })}>عرض جميع البنود</Button>} /> : <>
              <div role="table" aria-label="بنود التشغيل المعتمدة">
                <div role="row" className="ops-table-head"><span role="columnheader">الطلب</span><span role="columnheader">الصنف</span><span role="columnheader">الفرع</span><span role="columnheader">موعد الحاجة</span><span role="columnheader">التغطية</span><span role="columnheader">الكمية / التغطية</span><span role="columnheader">إجراء</span></div>
                {pageItems.map(d => <div role="row" className="ops-row" key={d.orderItemId} data-testid="operations-demand-row">
                  <div role="cell"><span className="ops-primary ops-ellipsis" dir="ltr" title={d.orderNumber}>{d.orderNumber}</span><span className="ops-sub">بند #{d.orderItemId}</span></div>
                  <div role="cell" className="ops-product"><span className="ops-primary ops-ellipsis" title={d.name}>{d.name}</span><span className="ops-sub">{d.kind === "warehouse" ? "صنف مستودع · لا تُفتح له دفعة" : "منتج كتالوج"}{d.catalogInactive ? " · غير مفعّل" : ""}</span></div>
                   <div role="cell"><span className="ops-ellipsis" title={d.requestBranchName || d.requestBranchId}>{d.requestBranchName || d.requestBranchId}</span><span className="ops-sub">حالة الطلب: {d.orderStatus === "approved" ? "معتمد" : d.orderStatus}</span></div>
                  <div role="cell"><span className="ops-number">{d.neededDate || "—"}</span></div>
                  <div role="cell"><Badge variant="outline" className={d.catalogInactive ? "border-amber-200 bg-amber-50 text-amber-800" : d.uncoveredQuantity > 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}>{d.catalogInactive ? "غير مفعّل" : d.uncoveredQuantity > 0 ? "تحتاج تغطية" : "مغطّى"}</Badge></div>
                  <div role="cell"><span className="ops-primary"><span className="ops-number">{qty(d.uncoveredQuantity)}</span> {d.unit} متبقٍ</span><span className="ops-sub">المطلوب <span className="ops-number">{qty(d.targetQuantity)}</span> {d.unit}</span></div>
                  <div role="cell" className="ops-action"><Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedId(d.orderItemId)} aria-label={`تفاصيل ${d.name} من الطلب ${d.orderNumber}`}>تفاصيل <ArrowLeft className="mr-1 h-3.5 w-3.5" /></Button></div>
                </div>)}
              </div>
              <div className="ops-foot"><span>عرض {qty((currentPage - 1) * OPERATIONS_PAGE_SIZE + 1)}–{qty(Math.min(currentPage * OPERATIONS_PAGE_SIZE, filtered.length))} من {qty(filtered.length)} بند · ترتيب حسب موعد الحاجة ثم رقم الطلب</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="الصفحة السابقة" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronRight className="h-4 w-4" /></Button><span aria-live="polite">{currentPage} / {totalPages}</span><Button size="icon" variant="outline" aria-label="الصفحة التالية" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronLeft className="h-4 w-4" /></Button></div></div>
            </>}
        </>}
    </div>
    {selected && <Dialog open onOpenChange={open => { if (!open && !batchMutation.isPending) { setSelectedId(null); setProduction(null); setBatchMode("recipe"); } }}><DialogContent dir="rtl" className={`max-h-[92dvh] overflow-y-auto ${production ? "sm:max-w-4xl" : "sm:max-w-xl"}`}>{!production ? <><DialogHeader><DialogTitle>{selected.name}</DialogTitle><DialogDescription>بند الطلب {selected.orderNumber} · كل الأرقام بوحدة {selected.unit}</DialogDescription></DialogHeader><div className="ops-detail"><div className="ops-detail-grid">
      <DetailValue label="الكمية المطلوبة" value={`${qty(selected.targetQuantity)} ${selected.unit}`} /><DetailValue label="الاحتياج غير المغطّى" value={`${qty(selected.uncoveredQuantity)} ${selected.unit}`} />
      <DetailValue label="المتاح" value={`${qty(selected.availableQuantity)} ${selected.unit}`} /><DetailValue label="المحجوز" value={`${qty(selected.reservedQuantity)} ${selected.unit}`} />
      <DetailValue label="قيد الإنتاج" value={`${qty(selected.linkedUnfinishedQuantity)} ${selected.unit}`} /><DetailValue label="تاريخ الحاجة" value={selected.neededDate || "غير محدد"} />
    </div>{selected.catalogInactive && <p role="alert" className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" />الصنف غير مفعّل حالياً. يظهر الاحتياج المعتمد للمتابعة فقط ولا يمكن بدء عمليات جديدة عليه.</p>}<p className="text-xs text-[#766b84]">بيانات الفرع وحالة الطلب التفصيلية متاحة في سجل الطلب. لا تُستنتج من احتياجات الإنتاج.</p><div className="flex flex-wrap gap-2"><Link href={`/central-kitchen-orders?orderId=${selected.orderId}`} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium" onClick={() => setSelectedId(null)}>فتح الطلب <ArrowLeft className="mr-1 h-3.5 w-3.5" /></Link>{productionAllowed(selected) && <Button size="sm" onClick={() => begin(selected)}><Play className="ml-1 h-3.5 w-3.5" />بدء إنتاج</Button>}</div></div></> : <><DialogHeader><DialogTitle>بدء دفعة إنتاج</DialogTitle><DialogDescription>{production.name} · أقصى احتياج غير مغطى: {qty(production.uncovered)} {production.unit}. المسار المعتاد بوصفة معتمدة؛ الإنتاج دون وصفة يتطلب استثناء معتمداً ومطابقاً لهذه الدفعة.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><div><Label>كمية صحيحة</Label><Input className="mt-1" type="number" min="1" step="1" disabled={batchMutation.isPending} value={batchQty} onChange={e => setBatchQty(e.target.value)} /></div><div><Label>تاريخ الإنتاج</Label><Input className="mt-1" type="date" disabled={batchMutation.isPending} value={date} onChange={e => setDate(e.target.value)} /></div></div><div className="flex flex-wrap gap-2"><Button type="button" disabled={batchMutation.isPending} variant={batchMode === "recipe" ? "default" : "outline"} onClick={() => setBatchMode("recipe")}>إنتاج بوصفة معتمدة (الافتراضي)</Button><Button type="button" disabled={batchMutation.isPending} variant={batchMode === "exception" ? "default" : "outline"} onClick={() => setBatchMode("exception")}>طلب استثناء دون وصفة</Button></div>{batchMode === "recipe" && <RecipeMaterialsPreview query={recipeRequirements} kitchenId={kitchenId} onRetry={() => recipeRequirements.refetch()} />}{batchMode === "exception" && <><RecipeExceptions key={`${production.orderId}:${production.itemId}:${batchQty}:${date}`} orderId={production.orderId} binding={binding} allowRequest /><p className="text-xs text-amber-900">لا توجد لقطة وصفة أو إثبات لصرف مواد خام في دفعة الاستثناء. {approvedException ? `الاستثناء المعتمد المطابق #${approvedException.id} متاح للاستخدام مرة واحدة.` : "انتظر الاعتماد المطابق قبل إنشاء الدفعة."}</p></>}<DialogFooter><Button variant="outline" disabled={batchMutation.isPending} onClick={() => { setProduction(null); setSelectedId(null); }}>إلغاء</Button><Button disabled={batchMutation.isPending || !binding || !Number.isInteger(binding.quantity) || binding.quantity < 1 || (batchMode === "recipe" ? recipeRequirements.isLoading || recipeRequirements.isError || !recipeRequirements.data?.recipe : !exceptions.data || !approvedException)} onClick={() => batchMutation.mutate()}>{batchMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إنشاء الدفعة</Button></DialogFooter></>}</DialogContent></Dialog>}
    <Dialog open={modeDraft !== null} onOpenChange={open => !open && setModeDraft(null)}><DialogContent dir="rtl"><DialogHeader><DialogTitle>تأكيد تغيير وضع تشغيل المطبخ</DialogTitle><DialogDescription>{modeDraft === "real" ? "سيؤثر التفعيل على الطلبات الجديدة فقط: ستُنشأ حجوزات من مخزون فرع المطبخ. لا يُرحّل أو يُصحح أي رصيد أو طلب قديم." : modeDraft === "paused" ? "سيوقف الإيقاف ترحيل المخزون للطلبات الحقيقية المعلّقة ويمنع بدء أو إنهاء دفعات الإنتاج المرتبطة إلى أن يُستأنف التشغيل. تبقى الأرصدة والحجوزات الحالية محفوظة." : "سيعود أثر الطلبات الجديدة إلى السجل الظلّي فقط، دون تعديل أي طلب أو رصيد قديم."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setModeDraft(null)}>إلغاء</Button><Button disabled={runtimeMutation.isPending} onClick={() => modeDraft && runtimeMutation.mutate(modeDraft)}>{runtimeMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تأكيد التغيير</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="ops-stat"><strong>{qty(value)}</strong><span>{label}</span></div>; }
function DetailValue({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function State({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <Card className="m-4 border-dashed"><CardContent className="flex flex-col items-center py-10 text-center"><div className="mb-3 text-muted-foreground">{icon}</div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</CardContent></Card>; }