import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AvailabilitySnapshot } from "@/components/central-kitchen/availability-snapshot";
import { LinkedBatches } from "@/components/central-kitchen/linked-batches";
import {
  CentralKitchenCatalogItem,
  parseCentralKitchenCatalogV2,
} from "@shared/central-kitchen-catalog";
import {
  AlertTriangle, Check, ChevronLeft, Factory, Filter, Loader2, PackagePlus, Plus, Printer,
  RefreshCw, Search, ShieldCheck, Truck, X,
} from "lucide-react";

type KitchenItem = {
  id?: string | number; productId?: string | number; warehouseItemId?: string | number; productName: string; unit: string; requestedQuantity: number; notes?: string;
  preparedQuantity?: number | null; substituteQuantity?: number | null; substituteProductName?: string | null;
  substituteUnit?: string | null; substituteProductId?: string | number | null; substituteWarehouseItemId?: string | number | null;
  shortageReason?: string | null; preparationNotes?: string | null;
  dispatchedQuantity?: number | null; receivedQuantity?: number | null; damagedQuantity?: number | null;
  missingQuantity?: number | null; receivingNotes?: string | null;
};
type KitchenEvent = { id: string | number; fromStatus?: string; toStatus: string; actorId?: string; notes?: string; createdAt: string };
type KitchenOrder = {
  id: string | number; orderNumber: string; requestBranchId: string; centralKitchenId: string; status: string;
  neededDate?: string; neededTime?: string; notes?: string; createdBy?: string; approvedBy?: string; preparedBy?: string;
  dispatchedBy?: string; receivedBy?: string; createdAt: string; approvedAt?: string; preparedAt?: string; dispatchedAt?: string;
  receivedAt?: string; requestBranchName?: string; centralKitchenName?: string; itemCount?: number; items?: KitchenItem[]; events?: KitchenEvent[];
  driverName?: string | null; vehicleNumber?: string | null; discrepancyStatus?: "none" | "open" | "resolved";
  discrepancyResolutionNotes?: string | null;
  shadowInventoryEntries?: ShadowInventoryEntry[];
  inventoryMode?: "shadow" | "real";
  allocations?: Array<{ id: number; orderItemId: number; component: "original" | "substitute"; unit: string; reservedQuantity: number; dispatchedQuantity: number; releasedQuantity: number; status: string }>;
  linkedBatches?: Array<{ id: number; orderItemId: number; productId: number; quantity: number; productionDate: string | null; status: string | null }>;
};
type ProductOption = CentralKitchenCatalogItem;
type DraftItem = { productId?: number; warehouseItemId?: number; manualMode?: boolean; productName: string; unit: string; requestedQuantity: string; notes: string };
type PreparationInput = {
  itemId: number; preparedQuantity: number; substituteQuantity: number; substituteProductName?: string;
  substituteUnit?: string; substituteProductId?: number; substituteWarehouseItemId?: number;
  shortageReason?: string; preparationNotes?: string;
};
type ShadowInventoryEntry = {
  id: number; direction: "projected_kitchen_out" | "projected_branch_in";
  component: "original" | "substitute"; productName: string; unit: string; quantity: number;
  productId?: string | number | null; warehouseItemId?: string | number | null;
};
type PilotMetrics = {
  totalOrders: number; overdueOrders: number; openDiscrepancies: number;
  fulfillmentRate: number | null; discrepancyRate: number | null;
  statusCounts: Record<string, number>;
  averageStageHours: { approval: number | null; preparation: number | null; dispatch: number | null; delivery: number | null };
  shadowLedger: { entryCount: number; byUnit: Array<{ direction: string; unit: string; quantity: number }> };
};

const STATUS: Record<string, { label: string; className: string }> = {
  requested: { label: "بانتظار الاعتماد", className: "bg-amber-50 text-amber-800 border-amber-200" },
  pending: { label: "بانتظار الاعتماد", className: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { label: "معتمد", className: "bg-sky-50 text-sky-800 border-sky-200" },
  prepared: { label: "تم التجهيز", className: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  dispatched: { label: "في الطريق", className: "bg-orange-50 text-orange-800 border-orange-200" },
  received: { label: "تم الاستلام", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  draft: { label: "مسودة", className: "bg-stone-100 text-stone-700 border-stone-200" },
};
const emptyLine = (): DraftItem => ({ productName: "", unit: "قطعة", requestedQuantity: "1", notes: "" });
const catalogKey = (item: Pick<ProductOption, "id" | "source">) => `${item.source}:${item.id}`;
const sourceLabel = (source: "product" | "warehouse") => source === "warehouse" ? "المستودع" : "المنتجات";
const identitySource = (value: { productId?: string | number | null; warehouseItemId?: string | number | null }) =>
  value.warehouseItemId != null ? "warehouse" : "product";
const localDate = () => new Date().toLocaleDateString("en-CA");
const readableDate = (value?: string) => value ? new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "غير محدد";
const readableTime = (value?: string) => value || "—";
const normalized = (status: string) => status?.toLowerCase().replaceAll(" ", "_") || "pending";

export default function CentralKitchenOrdersPage() {
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const { canCreate, canEdit, canApprove } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState(userBranchId || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | number | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [pilotDays, setPilotDays] = useState("30");
  const [draft, setDraft] = useState({ sourceBranchId: userBranchId || "", centralKitchenId: "", neededDate: localDate(), neededTime: "", notes: "", items: [emptyLine()] });
  const createAttemptRef = useRef<{ signature: string; key: string } | null>(null);
  const transitionKeysRef = useRef(new Map<string, { signature: string; key: string }>());

  useEffect(() => { if (userBranchId) setBranchFilter(userBranchId); }, [userBranchId]);
  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("orderId");
    if (orderId) setDetailId(orderId);
  }, []);
  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (branchFilter !== "all") params.set("branchId", branchFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const string = params.toString();
    return `/api/central-kitchen-orders${string ? `?${string}` : ""}`;
  }, [branchFilter, statusFilter]);
  const ordersQuery = useQuery<KitchenOrder[]>({ queryKey: [listUrl] });
  const metricsUrl = `/api/central-kitchen-orders/pilot-metrics?days=${pilotDays}${branchFilter !== "all" ? `&branchId=${encodeURIComponent(branchFilter)}` : ""}`;
  const metricsQuery = useQuery<PilotMetrics>({ queryKey: [metricsUrl] });
  const productsQuery = useQuery<ProductOption[]>({
    queryKey: ["/api/central-kitchen-orders/catalog-v2"],
    queryFn: async () => {
      let response: Response;
      try {
        response = await fetch("/api/central-kitchen-orders/catalog-v2", { credentials: "include" });
      } catch {
        throw new Error("تعذر الاتصال بالخادم لتحميل الكتالوج. تحقق من الشبكة ثم أعد المحاولة.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("انتهت الجلسة أو لا تملك صلاحية عرض الكتالوج. سجّل الدخول مجدداً أو راجع الصلاحيات.");
      }
      if (!response.ok) {
        throw new Error("تعذر تحميل الكتالوج من الخادم. تحقق من الاتصال ثم أعد المحاولة.");
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("إصدار كتالوج الأصناف غير متوافق. أعد تحميل الصفحة للحصول على الإصدار الأحدث.");
      }
      return parseCentralKitchenCatalogV2(payload).items;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    placeholderData: () => undefined,
  });
  const kitchensQuery = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/central-kitchen-orders/kitchens"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const detailQuery = useQuery<KitchenOrder>({ queryKey: [`/api/central-kitchen-orders/${detailId}`], enabled: detailId !== null });
  const products = productsQuery.data || [];
  useEffect(() => {
    if (createOpen) void productsQuery.refetch();
  }, [createOpen]);
  const centralKitchens = useMemo(() => {
    const merged = new Map<string, { id: string; name: string }>();
    for (const branch of kitchensQuery.data || []) merged.set(branch.id, branch);
    for (const branch of branches) {
      if (branch.isCentralKitchen) merged.set(branch.id, { id: branch.id, name: branch.name });
    }
    return Array.from(merged.values());
  }, [branches, kitchensQuery.data]);
  const filtered = useMemo(() => (ordersQuery.data || []).filter(order => {
    const term = search.trim().toLowerCase();
    return !term || [order.orderNumber, order.requestBranchName, order.centralKitchenName].some(value => value?.toLowerCase().includes(term));
  }), [ordersQuery.data, search]);
  const refresh = () => queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/central-kitchen-orders") });

  const createMutation = useMutation({
    mutationFn: async () => {
      const invalid = draft.items.some(item => !item.productName.trim() || !item.unit.trim() || Number(item.requestedQuantity) <= 0);
      if (!draft.sourceBranchId || !draft.centralKitchenId || invalid) throw new Error("أكمل الفروع وبنود الطلب بالكميات الصحيحة.");
      const payload = {
        requestBranchId: draft.sourceBranchId, centralKitchenId: draft.centralKitchenId, neededDate: draft.neededDate || undefined,
        neededTime: draft.neededTime || undefined, notes: draft.notes || undefined,
        items: draft.items.map(item => ({
          ...(item.warehouseItemId !== undefined ? { warehouseItemId: item.warehouseItemId } : item.productId !== undefined ? { productId: item.productId } : {}),
          productName: item.productName.trim(), unit: item.unit.trim(), requestedQuantity: Number(item.requestedQuantity), notes: item.notes || undefined,
        })),
      };
      const signature = JSON.stringify(payload);
      if (!createAttemptRef.current || createAttemptRef.current.signature !== signature) {
        createAttemptRef.current = { signature, key: crypto.randomUUID() };
      }
      const response = await apiRequest("POST", "/api/central-kitchen-orders", {
        ...payload,
        idempotencyKey: createAttemptRef.current.key,
      });
      return response.json() as Promise<KitchenOrder>;
    },
    onSuccess: (order) => {
      toast({ title: "تم إنشاء طلب المطبخ", description: `تم تسجيل الطلب ${order.orderNumber || ""}` });
      createAttemptRef.current = null;
      setCreateOpen(false); setDetailId(order.id); setDraft({ sourceBranchId: userBranchId || "", centralKitchenId: "", neededDate: localDate(), neededTime: "", notes: "", items: [emptyLine()] }); refresh();
    },
    onError: (error) => toast({ title: "تعذر إنشاء الطلب", description: error instanceof Error ? error.message : "تحقق من البيانات وحاول مجدداً.", variant: "destructive" }),
  });
  const workflowMutation = useMutation({
    mutationFn: async ({ id, action, details }: { id: string | number; action: "approve" | "prepare" | "dispatch" | "receive" | "resolve-discrepancy"; details?: Record<string, unknown> }) => {
      const attemptId = `${id}:${action}`;
      const payload = {
        notes: actionNotes || undefined,
        ...details,
      };
      const signature = JSON.stringify(payload);
      const previous = transitionKeysRef.current.get(attemptId);
      const idempotencyKey = previous?.signature === signature ? previous.key : crypto.randomUUID();
      transitionKeysRef.current.set(attemptId, { signature, key: idempotencyKey });
      const response = await apiRequest("POST", `/api/central-kitchen-orders/${id}/${action}`, {
        ...payload,
        idempotencyKey,
      });
      return { order: await response.json(), attemptId };
    },
    onSuccess: ({ attemptId }, { action }) => { transitionKeysRef.current.delete(attemptId); toast({ title: action === "resolve-discrepancy" ? "تمت معالجة الفروقات" : `تم ${action === "approve" ? "اعتماد" : action === "prepare" ? "تجهيز" : action === "dispatch" ? "شحن" : "استلام"} الطلب` }); setActionNotes(""); refresh(); },
    onError: (error) => toast({ title: "لم تكتمل العملية", description: error instanceof Error ? error.message : "يرجى مراجعة حالة الطلب والصلاحيات.", variant: "destructive" }),
  });
  const setLine = (index: number, changes: Partial<DraftItem>) => setDraft(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, ...changes } : item) }));
  const selectedDetail = detailQuery.data;
  const statusInfo = (status: string) => STATUS[normalized(status)] || { label: status || "قيد المراجعة", className: "bg-muted text-muted-foreground border-border" };
  const branchName = (id: string) => branches.find(branch => branch.id === id)?.name || id;

  return <Layout>
    <main dir="rtl" className="page-container space-y-5 pb-10">
      <PageHeader icon={Factory} tone="production" title="طلبات المطبخ المركزي" description="تتبّع احتياج الفروع من الطلب حتى الاستلام"
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refresh} data-testid="refresh-kitchen-orders"><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button>
          {canCreate("central_kitchen_orders") && <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="create-kitchen-order"><Plus className="ml-2 h-4 w-4" />طلب جديد</Button>}
        </div>} />

      <Card className="border-violet-200 bg-gradient-to-l from-violet-50/70 to-background">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">مؤشرات التجربة والتوسع</h2><p className="text-xs text-muted-foreground">قياس دورة الطلب وجودة التوريد قبل تفعيل المخزون الفعلي.</p></div><Select value={pilotDays} onValueChange={setPilotDays}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">آخر 7 أيام</SelectItem><SelectItem value="30">آخر 30 يوماً</SelectItem><SelectItem value="90">آخر 90 يوماً</SelectItem></SelectContent></Select></div>
          {metricsQuery.isLoading ? <div className="grid gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div> : metricsQuery.data ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricTile label="إجمالي الطلبات" value={metricsQuery.data.totalOrders} /><MetricTile label="متأخرة عن الحاجة" value={metricsQuery.data.overdueOrders} tone={metricsQuery.data.overdueOrders ? "danger" : "normal"} /><MetricTile label="فروقات مفتوحة" value={metricsQuery.data.openDiscrepancies} tone={metricsQuery.data.openDiscrepancies ? "warning" : "normal"} /><MetricTile label="متوسط اكتمال البنود" value={metricsQuery.data.fulfillmentRate === null ? "—" : `${metricsQuery.data.fulfillmentRate}%`} /><MetricTile label="طلبات بها فروقات" value={metricsQuery.data.discrepancyRate === null ? "—" : `${metricsQuery.data.discrepancyRate}%`} /></div><div className="mt-4 grid gap-2 border-t pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><StageTime label="الاعتماد" value={metricsQuery.data.averageStageHours.approval} /><StageTime label="التجهيز" value={metricsQuery.data.averageStageHours.preparation} /><StageTime label="الإرسال" value={metricsQuery.data.averageStageHours.dispatch} /><StageTime label="التوصيل" value={metricsQuery.data.averageStageHours.delivery} /></div><div className="mt-3 text-xs text-muted-foreground">السجل التجريبي: {metricsQuery.data.shadowLedger.entryCount} حركة{metricsQuery.data.shadowLedger.byUnit.length ? ` · ${metricsQuery.data.shadowLedger.byUnit.map(entry => `${entry.direction === "projected_kitchen_out" ? "خصم" : "إضافة"} ${entry.quantity} ${entry.unit}`).join(" · ")}` : ""}</div></> : <p className="text-sm text-muted-foreground">تعذر تحميل مؤشرات التجربة.</p>}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="relative md:col-span-5"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} className="h-10 pr-9" placeholder="ابحث برقم الطلب أو الفرع..." /></div>
            <Select value={branchFilter} onValueChange={setBranchFilter}><SelectTrigger className="h-10 md:col-span-4" disabled={!canSelectBranch}><SelectValue placeholder="فرع المصدر" /></SelectTrigger><SelectContent>{canSelectBranch && <SelectItem value="all">كل الفروع</SelectItem>}{branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-10 md:col-span-3"><Filter className="ml-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="كل الحالات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{["requested", "approved", "prepared", "dispatched", "received"].map(key => <SelectItem key={key} value={key}>{STATUS[key].label}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardContent>
      </Card>

      {ordersQuery.isLoading ? <Card><CardContent className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton className="h-14 w-full" key={i} />)}</CardContent></Card> :
      ordersQuery.isError ? <Card><CardContent className="py-16 text-center"><p className="font-medium">تعذر تحميل الطلبات</p><p className="mt-1 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة.</p><Button className="mt-4" variant="outline" onClick={refresh}>إعادة المحاولة</Button></CardContent></Card> :
      filtered.length === 0 ? <Card><CardContent className="py-16 text-center"><PackagePlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">لا توجد طلبات مطابقة</h2><p className="mt-1 text-sm text-muted-foreground">{canCreate("central_kitchen_orders") ? "أنشئ طلباً جديداً أو عدّل عوامل التصفية." : "عدّل عوامل التصفية أو انتظر وصول طلب جديد."}</p>{canCreate("central_kitchen_orders") && <Button className="mt-5" onClick={() => setCreateOpen(true)}>إنشاء طلب</Button>}</CardContent></Card> :
      <Card className="overflow-hidden border-border/80"><div className="overflow-x-auto"><Table><TableHeader className="bg-muted/40"><TableRow><TableHead className="text-right">رقم الطلب</TableHead><TableHead className="text-right">من</TableHead><TableHead className="text-right">إلى المطبخ</TableHead><TableHead className="text-right">المطلوب</TableHead><TableHead className="text-right">البنود</TableHead><TableHead className="text-right">الحالة</TableHead><TableHead className="text-left"> </TableHead></TableRow></TableHeader><TableBody>
        {filtered.map(order => <TableRow key={order.id} className="cursor-pointer hover:bg-muted/35" onClick={() => setDetailId(order.id)}>
          <TableCell className="font-mono font-semibold text-primary">{order.orderNumber}</TableCell><TableCell>{order.requestBranchName || branchName(order.requestBranchId)}</TableCell><TableCell>{order.centralKitchenName || branchName(order.centralKitchenId)}</TableCell><TableCell><span className="text-sm">{readableDate(order.neededDate)} <span className="text-muted-foreground">{readableTime(order.neededTime)}</span></span></TableCell><TableCell>{order.itemCount ?? order.items?.length ?? 0} بنود</TableCell><TableCell><StatusBadge status={order.status} /></TableCell><TableCell className="text-left"><Button variant="ghost" size="icon" aria-label="عرض الطلب" onClick={event => { event.stopPropagation(); setDetailId(order.id); }}><ChevronLeft className="h-4 w-4" /></Button></TableCell>
        </TableRow>)}</TableBody></Table></div></Card>}
    </main>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent dir="rtl" className="max-h-[92dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>طلب جديد للمطبخ المركزي</DialogTitle><DialogDescription>أضف احتياج الفرع بدقة ليظهر لفريق المطبخ فوراً.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2 md:grid-cols-2"><FormSelect label="الفرع الطالب" value={draft.sourceBranchId} onChange={value => setDraft({ ...draft, sourceBranchId: value })} branches={branches} placeholder="اختر الفرع" /><FormSelect label="المطبخ المركزي" value={draft.centralKitchenId} onChange={value => setDraft({ ...draft, centralKitchenId: value })} branches={centralKitchens.filter(branch => branch.id !== draft.sourceBranchId)} placeholder={kitchensQuery.isLoading ? "جارٍ تحميل المطابخ..." : centralKitchens.length ? "اختر المطبخ" : kitchensQuery.isError ? "تعذر تحميل المطابخ المركزية" : "لا يوجد مطبخ مركزي مفعّل"} />
        <div><Label htmlFor="needed-date">تاريخ الحاجة</Label><Input id="needed-date" type="date" className="mt-2" value={draft.neededDate} onChange={event => setDraft({ ...draft, neededDate: event.target.value })} /></div><div><Label htmlFor="needed-time">وقت الحاجة</Label><Input id="needed-time" type="time" className="mt-2" value={draft.neededTime} onChange={event => setDraft({ ...draft, neededTime: event.target.value })} /></div>
      </div>
      <div className="rounded-lg border bg-muted/20"><div className="flex items-center justify-between border-b px-4 py-3"><div><p className="font-semibold">بنود الطلب</p><p className="text-xs text-muted-foreground">اختر من كتالوج المنتجات أو المستودع، أو اختر الإدخال اليدوي صراحةً.</p></div><Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, items: [...draft.items, emptyLine()] })}><Plus className="ml-1 h-4 w-4" />إضافة بند</Button></div>
        <CatalogQueryState query={productsQuery} count={products.length} />
        <div className="space-y-3 p-3">{draft.items.map((item, index) => <div className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-12" key={index}>
          <div className="md:col-span-4"><Label className="text-xs">الصنف</Label><SearchableSelect className="mt-1" triggerClassName="h-9" value={item.warehouseItemId !== undefined ? `warehouse:${item.warehouseItemId}` : item.productId !== undefined ? `product:${item.productId}` : item.manualMode ? "__manual" : undefined} onValueChange={value => { if (value === "__manual") setLine(index, { manualMode: true, productId: undefined, warehouseItemId: undefined, productName: "", unit: "قطعة" }); else { const selected = products.find(entry => catalogKey(entry) === value); if (selected) { const source = selected.source; setLine(index, { manualMode: false, productId: source === "product" ? selected.id : undefined, warehouseItemId: source === "warehouse" ? selected.id : undefined, productName: selected.name, unit: selected.unit }); } } }} options={[{ value: "__manual", label: "إدخال يدوي", badge: "يدوي" }, ...products.map(product => ({ value: catalogKey(product), label: product.name, sublabel: [product.sku, product.unit].filter(Boolean).join(" · "), badge: sourceLabel(product.source) }))]} placeholder="اختر صنفاً أو الوضع اليدوي" searchPlaceholder="ابحث بالاسم أو الرمز..." emptyText="لا توجد أصناف مطابقة" dataTestid={`catalog-item-${index}`} /><Input className="mt-2 h-9" disabled={!item.manualMode} value={item.productName} onChange={event => setLine(index, { productName: event.target.value })} placeholder={item.manualMode ? "اسم الصنف اليدوي" : "يُثبت الاسم بعد اختيار الكتالوج"} /><AvailabilitySnapshot kitchenId={draft.centralKitchenId} productId={item.productId} warehouseItemId={item.warehouseItemId} requested={item.requestedQuantity} /></div>
          <div className="md:col-span-2"><Label className="text-xs">الوحدة</Label><Input className="mt-1 h-9" disabled={!item.manualMode} value={item.unit} onChange={event => setLine(index, { unit: event.target.value })} placeholder="قطعة" /></div><div className="md:col-span-2"><Label className="text-xs">الكمية</Label><Input className="mt-1 h-9" type="number" min="0.01" step="any" value={item.requestedQuantity} onChange={event => setLine(index, { requestedQuantity: event.target.value })} /></div><div className="md:col-span-3"><Label className="text-xs">ملاحظة البند</Label><Input className="mt-1 h-9" value={item.notes} onChange={event => setLine(index, { notes: event.target.value })} placeholder="اختياري" /></div><div className="flex items-end md:col-span-1"><Button variant="ghost" size="icon" className="text-destructive" disabled={draft.items.length === 1} onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })} aria-label="حذف البند"><X className="h-4 w-4" /></Button></div>
        </div>)}</div></div>
      <div><Label htmlFor="order-notes">ملاحظات عامة</Label><textarea id="order-notes" className="mt-2 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="تعليمات خاصة للاستلام أو التجهيز..." /></div>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button><Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إرسال الطلب</Button></div>
    </DialogContent></Dialog>

    <Dialog open={detailId !== null} onOpenChange={open => { if (!open) { setDetailId(null); setActionNotes(""); } }}><DialogContent dir="rtl" className="max-h-[92dvh] max-w-5xl overflow-y-auto">{detailQuery.isLoading ? <div className="space-y-3 py-8">{Array.from({ length: 5 }).map((_, i) => <Skeleton className="h-14 w-full" key={i} />)}</div> : detailQuery.isError || !selectedDetail ? <div className="py-12 text-center"><p className="font-medium">تعذر تحميل تفاصيل الطلب</p><Button variant="outline" className="mt-4" onClick={() => detailQuery.refetch()}>إعادة المحاولة</Button></div> : <OrderDetail order={selectedDetail} products={products} productsQuery={productsQuery} accessibleBranchIds={branches.map(branch => branch.id)} actionNotes={actionNotes} setActionNotes={setActionNotes} pending={workflowMutation.isPending} canApprove={canApprove("central_kitchen_orders")} canEdit={canEdit("central_kitchen_orders")} onAction={(action, details) => workflowMutation.mutate({ id: selectedDetail.id, action, details })} />}</DialogContent></Dialog>
  </Layout>;
}

function StatusBadge({ status }: { status: string }) { const info = STATUS[normalized(status)] || { label: status, className: "bg-muted text-muted-foreground border-border" }; return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", info.className)}>{info.label}</Badge>; }
function MetricTile({ label, value, tone = "normal" }: { label: string; value: string | number; tone?: "normal" | "warning" | "danger" }) { return <div className={cn("rounded-lg border bg-background p-3", tone === "warning" && "border-amber-200 bg-amber-50", tone === "danger" && "border-red-200 bg-red-50")}><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-2xl">{value}</strong></div>; }
function StageTime({ label, value }: { label: string; value: number | null }) { return <div className="flex items-center justify-between rounded-md bg-background/70 px-3 py-2"><span>متوسط {label}</span><strong>{value === null ? "—" : `${value} ساعة`}</strong></div>; }
function FormSelect({ label, value, onChange, branches, placeholder }: { label: string; value: string; onChange: (value: string) => void; branches: { id: string; name: string }[]; placeholder: string }) { return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="mt-2"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>; }
type CatalogQueryLike = { isLoading: boolean; isError: boolean; error?: Error | null; refetch: () => unknown };
function CatalogQueryState({ query, count }: { query: CatalogQueryLike; count: number }) {
  if (query.isLoading) return <div className="m-3 flex items-center gap-2 rounded-md border bg-background p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل كتالوج الأصناف...</div>;
  if (query.isError) return <div className="m-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{query.error?.message || "تعذر تحميل كتالوج الأصناف. تحقق من الاتصال ثم أعد المحاولة."} لم يتم استنتاج أي معرّفات أو التحويل تلقائياً.</span><Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCw className="ml-1 h-4 w-4" />إعادة المحاولة</Button></div>;
  if (!count) return <div className="m-3 rounded-md border bg-background p-3 text-sm text-muted-foreground">الكتالوج فارغ حالياً. يمكنك اختيار «إدخال يدوي» بشكل صريح.</div>;
  return null;
}
function OrderDetail({ order, products, productsQuery, accessibleBranchIds, actionNotes, setActionNotes, pending, canApprove, canEdit, onAction }: { order: KitchenOrder; products: ProductOption[]; productsQuery: CatalogQueryLike; accessibleBranchIds: string[]; actionNotes: string; setActionNotes: (value: string) => void; pending: boolean; canApprove: boolean; canEdit: boolean; onAction: (action: "approve" | "prepare" | "dispatch" | "receive" | "resolve-discrepancy", details?: Record<string, unknown>) => void }) {
  const status = normalized(order.status);
  const action = status === "requested" || status === "pending" || status === "draft" ? "approve" : status === "approved" ? "prepare" : status === "prepared" ? "dispatch" : status === "dispatched" ? "receive" : null;
  const allowAction = action === "approve"
    ? canApprove && accessibleBranchIds.includes(order.centralKitchenId)
    : action === "receive"
      ? canEdit && accessibleBranchIds.includes(order.requestBranchId)
      : !!action && canEdit && accessibleBranchIds.includes(order.centralKitchenId);
  const actionConfig = action ? { approve: { label: "اعتماد الطلب", icon: ShieldCheck }, prepare: { label: "تأكيد التجهيز", icon: PackagePlus }, dispatch: { label: "تأكيد الشحن", icon: Truck }, receive: { label: "تأكيد الاستلام", icon: Check } }[action] : null;
  return <><DialogHeader><div className="flex items-start justify-between gap-3 pl-8"><div><DialogTitle className="font-mono text-xl">{order.orderNumber}</DialogTitle><DialogDescription className="mt-1">طلب الفرع {order.requestBranchName || order.requestBranchId} من {order.centralKitchenName || order.centralKitchenId}</DialogDescription></div><div className="flex items-center gap-2"><StatusBadge status={order.status} />{["prepared", "dispatched", "received"].includes(status) && <Button size="sm" variant="outline" onClick={() => printPreparationNote(order)}><Printer className="ml-1 h-4 w-4" />سند التجهيز</Button>}</div></div></DialogHeader>
    <div className="grid gap-3 border-y py-4 text-sm md:grid-cols-3"><div><span className="block text-muted-foreground">تاريخ الحاجة</span><span className="mt-1 block font-medium">{readableDate(order.neededDate)}</span></div><div><span className="block text-muted-foreground">وقت الحاجة</span><span className="mt-1 block font-medium">{readableTime(order.neededTime)}</span></div><div><span className="block text-muted-foreground">تاريخ الإنشاء</span><span className="mt-1 block font-medium">{readableDate(order.createdAt)}</span></div></div>
    {order.notes && <div className="rounded-md border-r-4 border-primary bg-muted/30 px-4 py-3 text-sm"><span className="mb-1 block text-xs text-muted-foreground">ملاحظات الطلب</span>{order.notes}</div>}
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"><span className="text-muted-foreground">وضع مخزون الطلب:</span><Badge variant="outline" className={order.inventoryMode === "real" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}>{order.inventoryMode === "real" ? "فعلي — حجوزات من مخزون المطبخ" : "ظلّي — لا توجد حركة مخزون فعلية"}</Badge></div>
    {order.driverName && <div className="grid gap-3 rounded-md border bg-orange-50/40 p-3 text-sm md:grid-cols-2"><div><span className="text-muted-foreground">السائق: </span>{order.driverName}</div><div><span className="text-muted-foreground">المركبة: </span>{order.vehicleNumber}</div></div>}
    <OrderItemsTable items={order.items || []} showPreparation={["prepared", "dispatched", "received"].includes(status)} showShipment={["dispatched", "received"].includes(status)} />
    {!!order.allocations?.length && <section className="rounded-lg border bg-emerald-50/30 p-4"><h3 className="font-semibold">الحجوزات والكميات المرحلة</h3><div className="mt-2 space-y-2 text-sm">{order.allocations.map(allocation => <div key={allocation.id} className="flex flex-wrap justify-between gap-2 rounded bg-background px-3 py-2"><span>بند #{allocation.orderItemId} · {allocation.component === "original" ? "الصنف الأصلي" : "بديل"} · {allocation.status}</span><span>محجوز {allocation.reservedQuantity} · مشحون {allocation.dispatchedQuantity} · محرر {allocation.releasedQuantity} {allocation.unit}</span></div>)}</div></section>}
    <LinkedBatches batches={order.linkedBatches || []} orderId={order.id} kitchenAccessible={accessibleBranchIds.includes(order.centralKitchenId)} />
    {!!order.shadowInventoryEntries?.length && <section className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-violet-950">سجل المخزون التجريبي</h3><p className="text-xs text-violet-700">للمراجعة فقط — لم تتغير أرصدة المخزون الفعلية.</p></div><Badge variant="outline" className="border-violet-300 text-violet-800">SHADOW</Badge></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-right">الحركة المتوقعة</TableHead><TableHead className="text-right">الصنف</TableHead><TableHead className="text-right">المصدر</TableHead><TableHead className="text-right">الكمية</TableHead><TableHead className="text-right">النوع</TableHead></TableRow></TableHeader><TableBody>{order.shadowInventoryEntries.map(entry => <TableRow key={entry.id}><TableCell>{entry.direction === "projected_kitchen_out" ? "خصم متوقع من المطبخ" : "إضافة متوقعة للفرع"}</TableCell><TableCell>{entry.productName}</TableCell><TableCell><CatalogSourceBadge source={identitySource(entry)} /></TableCell><TableCell>{entry.quantity} {entry.unit}</TableCell><TableCell>{entry.component === "substitute" ? "بديل" : "أصلي"}</TableCell></TableRow>)}</TableBody></Table></div></section>}
    <section><h3 className="mb-3 font-semibold">مسار الطلب</h3><div className="space-y-3 border-r-2 border-muted pr-4">{order.events?.length ? order.events.map(event => <div className="relative" key={event.id}><span className="absolute -right-[23px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" /><div className="flex flex-wrap items-center gap-2"><StatusBadge status={event.toStatus} /><span className="text-xs text-muted-foreground">{readableDate(event.createdAt)} · {new Date(event.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span></div>{event.notes && <p className="mt-1 text-sm text-muted-foreground">{event.notes}</p>}</div>) : <p className="text-sm text-muted-foreground">لم تُسجل تحديثات إضافية بعد.</p>}</div></section>
    {action === "prepare" && allowAction
      ? <PreparationEditor items={order.items || []} products={products} productsQuery={productsQuery} actionNotes={actionNotes} setActionNotes={setActionNotes} pending={pending} onSubmit={items => onAction("prepare", { items })} />
      : action === "dispatch" && allowAction ? <DispatchEditor items={order.items || []} pending={pending} onSubmit={details => onAction("dispatch", details)} />
      : action === "receive" && allowAction ? <ReceiptEditor items={order.items || []} pending={pending} onSubmit={details => onAction("receive", details)} />
      : actionConfig && allowAction && <div className="rounded-lg border bg-muted/20 p-3"><Label htmlFor="action-note">ملاحظة (اختياري)</Label><Input id="action-note" className="mt-2" value={actionNotes} onChange={event => setActionNotes(event.target.value)} placeholder="أضف ملاحظة للفريق..." /><Button className="mt-3 w-full sm:w-auto" disabled={pending} onClick={() => { if (action) onAction(action); }}>{pending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <actionConfig.icon className="ml-2 h-4 w-4" />}{actionConfig.label}</Button></div>}
    {!action && status === "received" && order.discrepancyStatus !== "open" && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="h-4 w-4" />اكتمل مسار هذا الطلب وتم تأكيد الاستلام.</div>}
    {status === "received" && order.discrepancyStatus === "open" && canEdit && accessibleBranchIds.includes(order.requestBranchId) && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3"><div className="flex items-center gap-2 font-medium text-amber-900"><AlertTriangle className="h-4 w-4" />فروقات استلام مفتوحة</div><Input className="mt-3" value={actionNotes} onChange={event => setActionNotes(event.target.value)} placeholder="اكتب كيف تمت معالجة الناقص أو التالف" /><Button className="mt-3" disabled={pending || !actionNotes.trim()} onClick={() => onAction("resolve-discrepancy", { notes: actionNotes.trim() })}>إغلاق الفروقات بعد المعالجة</Button></div>}
  </>;
}

const SHORTAGE_LABELS: Record<string, string> = {
  unavailable: "غير متوفر",
  out_of_stock: "نفاد المخزون",
  production_issue: "تعذر الإنتاج",
  quality_issue: "مشكلة جودة",
  other: "سبب آخر",
};

function OrderItemsTable({ items, showPreparation, showShipment }: { items: KitchenItem[]; showPreparation: boolean; showShipment: boolean }) {
  return <section><h3 className="mb-2 font-semibold">بنود الطلب <span className="text-sm font-normal text-muted-foreground">({items.length})</span></h3><div className="overflow-x-auto rounded-md border"><Table><TableHeader className="bg-muted/40"><TableRow><TableHead className="text-right">الصنف</TableHead><TableHead className="text-right">المطلوب</TableHead>{showPreparation && <><TableHead className="text-right">المجهز</TableHead><TableHead className="text-right">البديل</TableHead></>}{showShipment && <><TableHead className="text-right">المرسل</TableHead><TableHead className="text-right">المستلم</TableHead><TableHead className="text-right">تالف/ناقص</TableHead></>}<TableHead className="text-right">ملاحظات</TableHead></TableRow></TableHeader><TableBody>{items.map(item => {
    const substitute = Number(item.substituteQuantity || 0);
    const prepared = Number(item.preparedQuantity || 0);
    const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
    return <TableRow key={item.id || item.productName}><TableCell className="font-medium"><div>{item.productName}</div><CatalogSourceBadge source={identitySource(item)} /></TableCell><TableCell>{item.requestedQuantity} {item.unit}</TableCell>{showPreparation && <><TableCell>{prepared} {item.unit}</TableCell><TableCell>{substitute > 0 ? <div><span>{substitute} {item.unit} — {item.substituteProductName}</span><CatalogSourceBadge source={identitySource({ productId: item.substituteProductId, warehouseItemId: item.substituteWarehouseItemId })} /></div> : "—"}</TableCell></>}{showShipment && <><TableCell>{item.dispatchedQuantity ?? "—"} {item.unit}</TableCell><TableCell>{item.receivedQuantity ?? "—"} {item.unit}</TableCell><TableCell>{Number(item.damagedQuantity || 0)} / {Number(item.missingQuantity || 0)} {item.unit}</TableCell></>}<TableCell className="text-muted-foreground">{item.receivingNotes || item.preparationNotes || (shortage > 0 ? SHORTAGE_LABELS[item.shortageReason || ""] : item.notes) || "—"}</TableCell></TableRow>;
  })}</TableBody></Table></div></section>;
}

function CatalogSourceBadge({ source }: { source: "product" | "warehouse" }) {
  return <Badge variant="outline" className="mt-1 text-[10px] font-normal">{sourceLabel(source)}</Badge>;
}

function PreparationEditor({ items, products, productsQuery, actionNotes, setActionNotes, pending, onSubmit }: { items: KitchenItem[]; products: ProductOption[]; productsQuery: CatalogQueryLike; actionNotes: string; setActionNotes: (value: string) => void; pending: boolean; onSubmit: (items: PreparationInput[]) => void }) {
  const [drafts, setDrafts] = useState(() => items.map(item => ({
    itemId: Number(item.id),
    preparedQuantity: String(item.requestedQuantity),
    substituteQuantity: "0",
    substituteProductName: "",
    substituteUnit: item.unit,
    substituteProductId: undefined as number | undefined,
    substituteWarehouseItemId: undefined as number | undefined,
    substituteManualMode: false,
    shortageReason: "",
    preparationNotes: "",
  })));
  const update = (index: number, changes: Partial<(typeof drafts)[number]>) => setDrafts(current => current.map((item, i) => i === index ? { ...item, ...changes } : item));
  const validationError = useMemo(() => {
    for (let index = 0; index < drafts.length; index++) {
      const draft = drafts[index];
      const requested = Number(items[index]?.requestedQuantity || 0);
      const prepared = Number(draft.preparedQuantity);
      const substitute = Number(draft.substituteQuantity);
      if (!Number.isFinite(prepared) || !Number.isFinite(substitute) || prepared < 0 || substitute < 0) return "أدخل كميات صحيحة غير سالبة.";
      if (prepared + substitute > requested) return `إجمالي تجهيز ${items[index]?.productName} يتجاوز المطلوب.`;
      if (substitute > 0 && (!draft.substituteProductName.trim() || !draft.substituteUnit.trim())) return "أدخل اسم ووحدة المنتج البديل.";
      if (prepared + substitute < requested && !draft.shortageReason) return "حدد سبب النقص لكل بند غير مكتمل.";
    }
    return "";
  }, [drafts, items]);
  const submit = () => {
    if (validationError) return;
    onSubmit(drafts.map(item => {
      const substituteQuantity = Number(item.substituteQuantity);
      const requestedQuantity = Number(items.find(source => Number(source.id) === item.itemId)?.requestedQuantity || 0);
      const hasShortage = Number(item.preparedQuantity) + substituteQuantity < requestedQuantity;
      return {
        itemId: item.itemId,
        preparedQuantity: Number(item.preparedQuantity),
        substituteQuantity,
        substituteProductName: substituteQuantity > 0 ? item.substituteProductName.trim() : undefined,
        substituteUnit: substituteQuantity > 0 ? item.substituteUnit.trim() : undefined,
        substituteProductId: substituteQuantity > 0 ? item.substituteProductId : undefined,
        substituteWarehouseItemId: substituteQuantity > 0 ? item.substituteWarehouseItemId : undefined,
        shortageReason: hasShortage ? item.shortageReason || undefined : undefined,
        preparationNotes: item.preparationNotes.trim() || undefined,
      };
    }));
  };
  return <section className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4"><div className="mb-3"><h3 className="font-semibold">تسجيل التجهيز الفعلي</h3><p className="text-xs text-muted-foreground">سجّل الكمية الأصلية والبديلة. البديل يُحتسب دائماً بوحدة الصنف المطلوب.</p></div><CatalogQueryState query={productsQuery} count={products.length} /><div className="space-y-3">{drafts.map((draft, index) => {
    const requested = Number(items[index]?.requestedQuantity || 0);
    const ready = Number(draft.preparedQuantity || 0) + Number(draft.substituteQuantity || 0);
    const shortage = Math.max(0, requested - ready);
    return <div className="rounded-md border bg-background p-3" key={draft.itemId}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{items[index]?.productName} <CatalogSourceBadge source={identitySource(items[index])} /></p><Badge variant="outline">المطلوب: {requested} {items[index]?.unit}</Badge></div><div className="grid gap-3 md:grid-cols-4"><div><Label className="text-xs">الكمية الأصلية المجهزة</Label><Input className="mt-1" type="number" min="0" max={requested} step="any" value={draft.preparedQuantity} onChange={event => update(index, { preparedQuantity: event.target.value })} /></div><div><Label className="text-xs">كمية البديل</Label><Input className="mt-1" type="number" min="0" max={requested} step="any" value={draft.substituteQuantity} onChange={event => update(index, { substituteQuantity: event.target.value })} /></div><div><Label className="text-xs">اختيار البديل</Label><SearchableSelect className="mt-1" triggerClassName="h-10" disabled={Number(draft.substituteQuantity) <= 0} value={draft.substituteWarehouseItemId !== undefined ? `warehouse:${draft.substituteWarehouseItemId}` : draft.substituteProductId !== undefined ? `product:${draft.substituteProductId}` : draft.substituteManualMode ? "__manual" : undefined} onValueChange={value => { if (value === "__manual") update(index, { substituteManualMode: true, substituteProductId: undefined, substituteWarehouseItemId: undefined, substituteProductName: "" }); else { const selected = products.find(entry => catalogKey(entry) === value); if (selected) { const source = selected.source; update(index, { substituteManualMode: false, substituteProductId: source === "product" ? selected.id : undefined, substituteWarehouseItemId: source === "warehouse" ? selected.id : undefined, substituteProductName: selected.name, substituteUnit: items[index].unit }); } } }} options={[{ value: "__manual", label: "بديل يدوي", badge: "يدوي" }, ...products.map(product => ({ value: catalogKey(product), label: product.name, sublabel: product.sku, badge: sourceLabel(product.source) }))]} placeholder="اختر البديل" searchPlaceholder="ابحث عن بديل..." /><Input className="mt-2" disabled={Number(draft.substituteQuantity) <= 0 || !draft.substituteManualMode} value={draft.substituteProductName} onChange={event => update(index, { substituteProductName: event.target.value })} placeholder="اسم البديل اليدوي" /></div><div><Label className="text-xs">وحدة احتساب البديل</Label><Input className="mt-1" disabled value={draft.substituteUnit} /><p className="mt-1 text-[11px] text-muted-foreground">مطابقة لوحدة الطلب</p></div></div>{shortage > 0 && <div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label className="text-xs">سبب النقص ({shortage} {items[index]?.unit})</Label><Select value={draft.shortageReason} onValueChange={value => update(index, { shortageReason: value })}><SelectTrigger className="mt-1"><SelectValue placeholder="اختر سبب النقص" /></SelectTrigger><SelectContent>{Object.entries(SHORTAGE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">ملاحظة التجهيز</Label><Input className="mt-1" value={draft.preparationNotes} onChange={event => update(index, { preparationNotes: event.target.value })} placeholder="تفاصيل النقص أو البديل" /></div></div>}</div>;
  })}</div>{validationError && <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />{validationError}</div>}<div className="mt-4"><Label htmlFor="preparation-note">ملاحظة عامة (اختياري)</Label><Input id="preparation-note" className="mt-1" value={actionNotes} onChange={event => setActionNotes(event.target.value)} /><Button className="mt-3" disabled={pending || !!validationError} onClick={submit}>{pending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PackagePlus className="ml-2 h-4 w-4" />}تأكيد الكميات والتجهيز</Button></div></section>;
}

function DispatchEditor({ items, pending, onSubmit }: { items: KitchenItem[]; pending: boolean; onSubmit: (details: Record<string, unknown>) => void }) {
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [quantities, setQuantities] = useState(() => items.map(item => String(Number(item.preparedQuantity || 0) + Number(item.substituteQuantity || 0))));
  const invalid = !driverName.trim() || !vehicleNumber.trim() || quantities.some((value, index) => Number(value) < 0 || Number(value) > Number(items[index].preparedQuantity || 0) + Number(items[index].substituteQuantity || 0));
  return <section className="rounded-lg border border-orange-200 bg-orange-50/30 p-4"><h3 className="font-semibold">بيانات الإرسال</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label>اسم السائق</Label><Input className="mt-1" value={driverName} onChange={e => setDriverName(e.target.value)} /></div><div><Label>رقم المركبة</Label><Input className="mt-1" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} /></div></div><div className="mt-3 space-y-2">{items.map((item, index) => <div className="grid grid-cols-[1fr_160px] items-center gap-3" key={item.id}><span>{item.productName}</span><Input type="number" min="0" step="any" value={quantities[index]} onChange={e => setQuantities(current => current.map((value, i) => i === index ? e.target.value : value))} /></div>)}</div><Button className="mt-4" disabled={pending || invalid} onClick={() => onSubmit({ driverName: driverName.trim(), vehicleNumber: vehicleNumber.trim(), items: items.map((item, index) => ({ itemId: Number(item.id), dispatchedQuantity: Number(quantities[index]) })) })}><Truck className="ml-2 h-4 w-4" />تأكيد الإرسال</Button></section>;
}

function ReceiptEditor({ items, pending, onSubmit }: { items: KitchenItem[]; pending: boolean; onSubmit: (details: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState(() => items.map(item => ({ received: String(item.dispatchedQuantity || 0), damaged: "0", notes: "" })));
  const update = (index: number, changes: Partial<(typeof rows)[number]>) => setRows(current => current.map((row, i) => i === index ? { ...row, ...changes } : row));
  const invalid = rows.some((row, index) => {
    const sent = Number(items[index].dispatchedQuantity || 0); const received = Number(row.received); const damaged = Number(row.damaged);
    return received < 0 || damaged < 0 || received + damaged > sent || ((received + damaged < sent || damaged > 0) && !row.notes.trim());
  });
  return <section className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4"><h3 className="font-semibold">تسجيل الاستلام الفعلي</h3><div className="mt-3 space-y-3">{items.map((item, index) => { const sent = Number(item.dispatchedQuantity || 0); const missing = Math.max(0, sent - Number(rows[index].received || 0) - Number(rows[index].damaged || 0)); return <div className="rounded-md border bg-background p-3" key={item.id}><div className="mb-2 font-medium">{item.productName} — أرسل {sent} {item.unit}</div><div className="grid gap-2 md:grid-cols-3"><div><Label>المستلم السليم</Label><Input type="number" min="0" step="any" value={rows[index].received} onChange={e => update(index, { received: e.target.value })} /></div><div><Label>التالف</Label><Input type="number" min="0" step="any" value={rows[index].damaged} onChange={e => update(index, { damaged: e.target.value })} /></div><div><Label>الناقص: {missing}</Label><Input value={rows[index].notes} onChange={e => update(index, { notes: e.target.value })} placeholder={missing > 0 || Number(rows[index].damaged) > 0 ? "الملاحظة مطلوبة" : "ملاحظة اختيارية"} /></div></div></div>; })}</div><Button className="mt-4" disabled={pending || invalid} onClick={() => onSubmit({ items: items.map((item, index) => ({ itemId: Number(item.id), receivedQuantity: Number(rows[index].received), damagedQuantity: Number(rows[index].damaged), receivingNotes: rows[index].notes.trim() || undefined })) })}><Check className="ml-2 h-4 w-4" />تأكيد الاستلام</Button></section>;
}

function printPreparationNote(order: KitchenOrder) {
  const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
  const rows = (order.items || []).map(item => {
    const prepared = Number(item.preparedQuantity || 0);
    const substitute = Number(item.substituteQuantity || 0);
    const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
    return `<tr><td>${escape(item.productName)}</td><td>${escape(item.requestedQuantity)} ${escape(item.unit)}</td><td>${prepared} ${escape(item.unit)}</td><td>${substitute > 0 ? `${substitute} ${escape(item.substituteUnit || item.unit)} — ${escape(item.substituteProductName)}` : "—"}</td><td>${shortage} ${escape(item.unit)}</td><td>${escape(item.preparationNotes || SHORTAGE_LABELS[item.shortageReason || ""] || "")}</td></tr>`;
  }).join("");
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>سند تجهيز ${escape(order.orderNumber)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#172033}h1{font-size:22px;margin:0 0 8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.box{border:1px solid #d8dee9;border-radius:8px;padding:10px}small{display:block;color:#687386;margin-bottom:4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8dee9;padding:9px;text-align:right;font-size:12px}th{background:#f3f5f8}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:60px}.line{border-top:1px solid #172033;padding-top:8px;text-align:center}@media print{body{padding:0}}</style></head><body><h1>سند تجهيز طلب المطبخ المركزي</h1><div>${escape(order.orderNumber)}</div><div class="meta"><div class="box"><small>الفرع الطالب</small>${escape(order.requestBranchName || order.requestBranchId)}</div><div class="box"><small>المطبخ المركزي</small>${escape(order.centralKitchenName || order.centralKitchenId)}</div><div class="box"><small>تاريخ الحاجة</small>${escape(order.neededDate)}</div></div><table><thead><tr><th>الصنف</th><th>المطلوب</th><th>الأصلي المجهز</th><th>البديل</th><th>النقص</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table><div class="signatures"><div class="line">مسؤول التجهيز</div><div class="line">مسؤول الإرسال</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
  printWindow.document.close();
}