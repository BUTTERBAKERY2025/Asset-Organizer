import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { CentralKitchenOperationsResponse, CentralKitchenRuntimeMode } from "@shared/central-kitchen-live";
import { AlertTriangle, ArrowLeft, Factory, Loader2, PackageCheck, Play, RefreshCw, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RecipeMaterialsPreview, useRecipeMaterialRequirements } from "@/components/central-kitchen/recipe-materials";
import { RecipeExceptions, exceptionQueryKey, useOrderRecipeExceptions } from "@/components/central-kitchen/recipe-exceptions";
import { linkedBatchPayload, matchingApprovedException, type ExceptionBinding } from "@/components/central-kitchen/recipe-exception-flow";

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
    kitchenId,
    productId: production?.productId || 0,
    quantity: batchQty,
    enabled: production !== null,
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
  const grouped = useMemo(() => {
    const map = new Map<string, CentralKitchenOperationsResponse["demands"]>();
    operations.data?.demands.forEach(demand => map.set(demand.unit, [...(map.get(demand.unit) || []), demand]));
    return [...map.entries()];
  }, [operations.data]);
  const canProduce = canCreate("production");

  return <section className="space-y-5">
    <Card className="overflow-hidden border-0 bg-[linear-gradient(120deg,hsl(264_38%_20%),hsl(280_42%_30%))] text-white shadow-lg">
      <CardContent className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-3 flex items-center gap-2 text-amber-200"><Factory className="h-5 w-5" /><span className="text-xs font-semibold tracking-[.14em]">غرفة تحكم المطبخ المركزي</span></div><h2 className="text-2xl font-bold">الطلب المعتمد يتحول إلى إنتاج، ثم جاهزية للشحن.</h2><p className="mt-2 max-w-2xl text-sm text-violet-100">المواد المعروضة تخص مخزون فرع المطبخ فقط. لا يوجد استهلاك خام تلقائي أو افتراض لوصفة تصنيع.</p></div>
          <div className="flex flex-wrap items-center gap-2"><Select value={kitchenId} onValueChange={onKitchenChange}><SelectTrigger className="w-52 border-white/20 bg-white/10 text-white"><SelectValue placeholder="اختر المطبخ" /></SelectTrigger><SelectContent>{kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="secondary" onClick={() => refresh()} aria-label="تحديث"><RefreshCw className={`h-4 w-4 ${operations.isFetching ? "animate-spin" : ""}`} /></Button>{operations.data && <Badge variant="outline" className={`${modeStyle[operations.data.runtime.mode]} border`}>{modeLabel[operations.data.runtime.mode]}</Badge>}</div>
        </div>
      </CardContent>
    </Card>
    {!kitchenId ? <State icon={<Factory className="h-7 w-7" />} title="اختر مطبخاً مركزياً" text="اعرض احتياجات الفرع المعتمدة وحالة تغطيتها." /> : operations.isLoading ? <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div> : operations.isError ? <State icon={<AlertTriangle className="h-7 w-7" />} title="البيانات التشغيلية غير متاحة" text={operations.error instanceof Error ? operations.error.message : "تحقق من الاتصال."} action={<Button variant="outline" onClick={() => operations.refetch()}>إعادة المحاولة</Button>} /> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="بنود معتمدة" value={qty(operations.data!.demands.length)} note="لا تُجمع الكميات بين الوحدات" />
        <Metric label="وحدات تشغيل" value={qty(operations.data!.totals.byUnit.length)} note="كل وحدة لها رصيدها المستقل" tone="violet" />
        <Metric label="بنود غير مغطاة" value={qty(operations.data!.demands.filter(d => d.uncoveredQuantity > 0).length)} note="راجع المتبقي داخل كل وحدة" tone="danger" />
        <Metric label="بنود قيد الإنتاج" value={qty(operations.data!.demands.filter(d => d.linkedUnfinishedQuantity > 0).length)} note="دفعات مرتبطة لم تُنه بعد" tone="good" />
      </div>
      {isAdmin && <Card className="border-dashed"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">ضبط وضع المخزون</p><p className="text-xs text-muted-foreground">الظلّي لا يرحّل المخزون. التغيير إلى الفعلي أو الإيقاف يحتاج تأكيداً صريحاً.</p></div><Select value={operations.data!.runtime.mode} onValueChange={value => { if (value !== operations.data!.runtime.mode) setModeDraft(value as CentralKitchenRuntimeMode); }}><SelectTrigger className="w-44"><Settings2 className="ml-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shadow">تشغيل ظلّي</SelectItem><SelectItem value="real">مخزون فعلي</SelectItem><SelectItem value="paused">إيقاف</SelectItem></SelectContent></Select></CardContent></Card>}
      {grouped.length === 0 ? <State icon={<PackageCheck className="h-7 w-7" />} title="لا توجد احتياجات معتمدة" text="ستظهر البنود هنا بعد اعتماد طلبات الفروع." /> : grouped.map(([unit, demands]) => <Card key={unit} className="overflow-hidden"><CardContent className="p-0"><div className="border-b bg-muted/35 px-4 py-3"><p className="font-semibold">وحدة: {unit}</p><p className="text-xs text-muted-foreground">الأرقام لا تُدمج عبر وحدات مختلفة.</p></div><div className="divide-y">{demands.map(d => { const covered = Math.max(0, d.targetQuantity - d.uncoveredQuantity); return <div key={d.orderItemId} className="grid gap-3 p-4 md:grid-cols-[1.4fr_2fr_auto] md:items-center"><div><Link href={`/central-kitchen-orders?orderId=${d.orderId}`} className="font-mono text-sm font-bold text-primary">{d.orderNumber}</Link><p className="mt-1 font-semibold">{d.name}</p><p className="text-xs text-muted-foreground">{d.kind === "warehouse" ? "صنف مستودع — لا يمكن فتح دفعة إنتاج" : "منتج كتالوج"} {d.neededDate ? `· الحاجة ${d.neededDate}` : ""}</p>{d.catalogInactive && <p role="alert" className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />الصنف غير مفعّل حالياً؛ يظهر احتياج الطلب المعتمد ورصيد المخزون للمتابعة فقط، ولا يمكن بدء عمليات جديدة عليه.</p>}</div><div><div className="mb-1 flex justify-between text-xs"><span>المغطّى {qty(covered)} / {qty(d.targetQuantity)}</span><span className={d.uncoveredQuantity > 0 ? "text-rose-700" : "text-emerald-700"}>المتبقي {qty(d.uncoveredQuantity)}</span></div><Progress value={Math.min(100, (covered / Math.max(1, d.targetQuantity)) * 100)} className="h-2" /><p className="mt-2 text-[11px] text-muted-foreground">متاح {qty(d.availableQuantity)} · محجوز {qty(d.reservedQuantity)} · قيد الإنتاج {qty(d.linkedUnfinishedQuantity)}</p></div><div className="flex gap-2 md:justify-end"><Link href={`/central-kitchen-orders?orderId=${d.orderId}`} className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium">التفاصيل <ArrowLeft className="mr-1 h-3.5 w-3.5" /></Link>{d.kind === "product" && !d.catalogInactive && d.uncoveredQuantity > 0 && canProduce && operations.data!.runtime.mode !== "paused" && <Button size="sm" onClick={() => { setProduction({ orderId: d.orderId, itemId: d.orderItemId, productId: d.catalogId, unit: d.unit, name: d.name, uncovered: d.uncoveredQuantity }); setBatchQty(String(d.uncoveredQuantity)); setBatchMode("recipe"); batchAttemptRef.current = null; }}><Play className="ml-1 h-3.5 w-3.5" />بدء إنتاج</Button>}</div></div>; })}</div></CardContent></Card>)}
    </>}
    <Dialog open={modeDraft !== null} onOpenChange={open => !open && setModeDraft(null)}><DialogContent dir="rtl"><DialogHeader><DialogTitle>تأكيد تغيير وضع تشغيل المطبخ</DialogTitle><DialogDescription>{modeDraft === "real" ? "سيؤثر التفعيل على الطلبات الجديدة فقط: ستُنشأ حجوزات من مخزون فرع المطبخ. لا يُرحّل أو يُصحح أي رصيد أو طلب قديم." : modeDraft === "paused" ? "سيوقف الإيقاف ترحيل المخزون للطلبات الحقيقية المعلّقة ويمنع بدء أو إنهاء دفعات الإنتاج المرتبطة إلى أن يُستأنف التشغيل. تبقى الأرصدة والحجوزات الحالية محفوظة." : "سيعود أثر الطلبات الجديدة إلى السجل الظلّي فقط، دون تعديل أي طلب أو رصيد قديم."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setModeDraft(null)}>إلغاء</Button><Button disabled={runtimeMutation.isPending} onClick={() => modeDraft && runtimeMutation.mutate(modeDraft)}>{runtimeMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تأكيد التغيير</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={production !== null} onOpenChange={open => { if (!open && !batchMutation.isPending) { setProduction(null); setBatchMode("recipe"); } }}><DialogContent dir="rtl" className="max-h-[92dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>بدء دفعة إنتاج</DialogTitle><DialogDescription>{production?.name} · أقصى احتياج غير مغطى: {production && qty(production.uncovered)} {production?.unit}. المسار المعتاد بوصفة معتمدة؛ الإنتاج دون وصفة يتطلب استثناء معتمداً ومطابقاً لهذه الدفعة.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><div><Label>كمية صحيحة</Label><Input className="mt-1" type="number" min="1" step="1" disabled={batchMutation.isPending} value={batchQty} onChange={e => setBatchQty(e.target.value)} /></div><div><Label>تاريخ الإنتاج</Label><Input className="mt-1" type="date" disabled={batchMutation.isPending} value={date} onChange={e => setDate(e.target.value)} /></div></div><div className="flex flex-wrap gap-2"><Button type="button" disabled={batchMutation.isPending} variant={batchMode === "recipe" ? "default" : "outline"} onClick={() => setBatchMode("recipe")}>إنتاج بوصفة معتمدة (الافتراضي)</Button><Button type="button" disabled={batchMutation.isPending} variant={batchMode === "exception" ? "default" : "outline"} onClick={() => setBatchMode("exception")}>طلب استثناء دون وصفة</Button></div>{production && batchMode === "recipe" && <RecipeMaterialsPreview query={recipeRequirements} kitchenId={kitchenId} onRetry={() => recipeRequirements.refetch()} />}{production && batchMode === "exception" && <><RecipeExceptions key={`${production.orderId}:${production.itemId}:${batchQty}:${date}`} orderId={production.orderId} binding={binding} allowRequest /><p className="text-xs text-amber-900">لا توجد لقطة وصفة أو إثبات لصرف مواد خام في دفعة الاستثناء. {approvedException ? `الاستثناء المعتمد المطابق #${approvedException.id} متاح للاستخدام مرة واحدة.` : "انتظر الاعتماد المطابق قبل إنشاء الدفعة."}</p></>}<DialogFooter><Button variant="outline" disabled={batchMutation.isPending} onClick={() => setProduction(null)}>إلغاء</Button><Button disabled={batchMutation.isPending || !binding || !Number.isInteger(binding.quantity) || binding.quantity < 1 || (batchMode === "recipe" ? recipeRequirements.isLoading || recipeRequirements.isError || !recipeRequirements.data?.recipe : !exceptions.data || !approvedException)} onClick={() => batchMutation.mutate()}>{batchMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إنشاء الدفعة</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "danger" | "violet" | "good" }) { return <Card className={tone === "danger" ? "border-rose-200 bg-rose-50/50" : tone === "violet" ? "border-violet-200 bg-violet-50/50" : tone === "good" ? "border-emerald-200 bg-emerald-50/50" : ""}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></CardContent></Card>; }
function State({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <Card><CardContent className="flex flex-col items-center py-14 text-center"><div className="mb-3 text-muted-foreground">{icon}</div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</CardContent></Card>; }