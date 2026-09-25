import React, { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, Loader2, PackagePlus, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isValidKitchenQuantity } from "./order-line-editor";
import { normalizeKitchenCatalogSearch } from "./order-line-editor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVisualViewportDialog } from "./use-visual-viewport-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CentralKitchenCatalogItem } from "@shared/central-kitchen-catalog";
import {
  buildFulfillmentFields,
  fetchProductionFulfillmentReadiness,
  getInitialMixedFulfillment,
  getPrepareFulfillmentMode,
  getProductionProofSummary,
  getSavedPreparationSource,
  type PrepareFulfillmentItem,
  type ProductionFulfillmentReadiness,
  type ProductionFulfillmentReadinessState,
  validateMixedFulfillmentQuantities,
} from "./prepare-fulfillment-model";

export type PreparationInput = {
  itemId: number;
  preparedQuantity: number;
  preparedFromStock?: number;
  preparedFromProduction?: number;
  substituteQuantity: number;
  substituteProductName?: string;
  substituteUnit?: string;
  substituteProductId?: number;
  substituteWarehouseItemId?: number;
  shortageReason?: string;
  preparationNotes?: string;
};

export type PreparationEditorItem = PrepareFulfillmentItem & {
  id?: string | number;
  productName: string;
  unit: string;
  notes?: string;
  substituteQuantity?: number | null;
  substituteProductName?: string | null;
  substituteUnit?: string | null;
  substituteProductId?: string | number | null;
  substituteWarehouseItemId?: string | number | null;
  shortageReason?: string | null;
  preparationNotes?: string | null;
};

type CatalogQueryLike = {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  refetch: () => unknown;
};

type PreparationDraft = {
  itemId: number;
  preparedQuantity: string;
  preparedFromStock: string;
  preparedFromProduction: string;
  substituteQuantity: string;
  substituteProductName: string;
  substituteUnit: string;
  substituteProductId?: number;
  substituteWarehouseItemId?: number;
  substituteManualMode: boolean;
  shortageReason: string;
  preparationNotes: string;
};

const SHORTAGE_LABELS: Record<string, string> = {
  unavailable: "غير متوفر",
  out_of_stock: "نفاد المخزون",
  production_issue: "تعذر الإنتاج",
  quality_issue: "مشكلة جودة",
  other: "سبب آخر",
};

const catalogKey = (item: Pick<CentralKitchenCatalogItem, "id" | "source">) => `${item.source}:${item.id}`;
const sourceLabel = (source: "product" | "warehouse") => source === "warehouse" ? "المستودع" : "المنتجات";
const itemSource = (item: Pick<PreparationEditorItem, "productId" | "warehouseItemId">) =>
  item.warehouseItemId != null ? "warehouse" : "product";

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function SubstitutePicker({ value, onValueChange, products, disabled }: {
  value?: string;
  onValueChange: (value: string) => void;
  products: CentralKitchenCatalogItem[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const style = useVisualViewportDialog({ open, maxHeight: 720, viewportFraction: 1 });
  const options = [{ value: "__manual", label: "بديل يدوي", sublabel: undefined as string | undefined, badge: "يدوي" }, ...products.map(product => ({
    value: catalogKey(product), label: product.name, sublabel: product.sku, badge: sourceLabel(product.source),
  }))];
  const selected = options.find(option => option.value === value);
  const results = options.filter(option => normalizeKitchenCatalogSearch(`${option.label} ${option.sublabel || ""}`).includes(normalizeKitchenCatalogSearch(search)));
  return <>
    <div className="md:hidden">
      <Button type="button" variant="outline" className="min-h-11 w-full justify-between text-right" disabled={disabled} onClick={() => setOpen(true)}>{selected?.label || "اختر البديل"}<Search className="mr-2 h-4 w-4 shrink-0" /></Button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" style={{ ...style, display: "flex", flexDirection: "column" }} className="box-border h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 [&>button.absolute]:left-2 [&>button.absolute]:right-auto [&>button.absolute]:top-2 [&>button.absolute]:flex [&>button.absolute]:h-11 [&>button.absolute]:w-11 [&>button.absolute]:items-center [&>button.absolute]:justify-center">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pl-16 text-right"><DialogTitle>اختيار البديل</DialogTitle><DialogDescription>ابحث عن صنف من كتالوج المطبخ أو اختر بديلاً يدوياً صراحةً.</DialogDescription></DialogHeader>
        <div className="shrink-0 border-b p-3"><label htmlFor="kitchen-substitute-search" className="sr-only">بحث عن بديل</label><Input id="kitchen-substitute-search" className="min-h-12 text-base" value={search} onChange={event => setSearch(event.target.value)} placeholder="الاسم أو الرمز…" /></div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3 pb-6" aria-label="نتائج البحث عن بديل">{results.map(option => <button type="button" key={option.value} onClick={() => { onValueChange(option.value); setOpen(false); setSearch(""); }} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border p-3 text-right focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 break-words">{option.label}<span className="block text-xs text-muted-foreground">{option.sublabel}</span></span><span className="shrink-0 text-xs">{option.badge}</span></button>)}{!results.length && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة. جرّب اسماً آخر أو استخدم البديل اليدوي.</p>}</div>
        <div className="shrink-0 border-t bg-background p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"><Button variant="outline" className="min-h-11 w-full" onClick={() => setOpen(false)}>العودة للتجهيز</Button></div>
      </DialogContent></Dialog>
    </div>
    <div className="hidden md:block"><SearchableSelect triggerClassName="h-11" disabled={disabled} value={value} onValueChange={onValueChange} options={options} placeholder="اختر البديل" searchPlaceholder="ابحث عن بديل..." /></div>
  </>;
}

function readinessState(query: {
  isPending?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  data?: unknown;
}): ProductionFulfillmentReadinessState {
  if (query.isPending || query.isLoading || (!query.isError && !query.data)) return { status: "loading" };
  if (query.isError || !query.data) return { status: "error" };
  const data = query.data as ProductionFulfillmentReadiness;
  return { status: "ready", eligibleQuantity: data.eligibleQuantity };
}

function CatalogQueryState({ query, count }: { query: CatalogQueryLike; count: number }) {
  if (query.isLoading) {
    return <div className="mb-3 flex items-center gap-2 rounded-md border bg-background p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل كتالوج الأصناف...</div>;
  }
  if (query.isError) {
    return <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{query.error?.message || "تعذر تحميل كتالوج الأصناف."}</span><Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCw className="ml-1 h-4 w-4" />إعادة المحاولة</Button></div>;
  }
  if (!count) return <div className="mb-3 rounded-md border bg-background p-3 text-sm text-muted-foreground">الكتالوج فارغ حالياً. يمكنك اختيار «بديل يدوي» بشكل صريح.</div>;
  return null;
}

function ProductionReadiness({
  query,
  onRetry,
}: {
  query: {
    isPending?: boolean;
    isLoading?: boolean;
    isError?: boolean;
    error?: unknown;
    data?: unknown;
    refetch: () => unknown;
  };
  onRetry: () => unknown;
}) {
  const state = readinessState(query);
  if (state.status === "loading") {
    return <div className="mt-3 flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900"><Loader2 className="h-4 w-4 animate-spin" />جارٍ التحقق من الإنتاج المكتمل المرتبط بالطلب؛ لا تُسجّل كمية إنتاج قبل اكتمال التحقق.</div>;
  }
  if (state.status === "error") {
    const message = query.error instanceof Error ? query.error.message : "تعذر قراءة دليل الإنتاج المكتمل المرتبط بالطلب.";
    return <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"><div><p className="font-semibold">دليل الإنتاج غير متاح</p><p className="mt-1">{message} لا يوجد افتراض بأن الكمية المؤهلة تساوي صفراً.</p></div><Button type="button" size="sm" variant="outline" onClick={onRetry}><RefreshCw className="ml-1 h-3.5 w-3.5" />إعادة التحقق</Button></div>;
  }
  const data = query.data as ProductionFulfillmentReadiness;
  return <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-950">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">الكمية المؤهلة من الإنتاج المكتمل المرتبط بالطلب</span><Badge variant="outline" className="border-violet-300 bg-background">{state.eligibleQuantity}</Badge></div>
    {data.batches.length ? <div className="mt-2 flex flex-wrap gap-2">{data.batches.map(batch => <span key={batch.batchId} className="rounded border border-violet-200 bg-background px-2 py-1">دفعة #{batch.batchId} · {batch.quantity}</span>)}</div> : <p className="mt-2">لا توجد دفعة إنتاج مكتملة مؤهلة حالياً. أنشئ أو أنهِ دفعة مرتبطة بهذا الطلب من <a className="font-semibold underline underline-offset-2" href="/production-dashboard?tab=operations">غرفة تشغيل الإنتاج</a> أثناء اعتماد الطلب، ثم أعد التحقق.</p>}
  </div>;
}

export function PreparationEditor({
  orderId,
  inventoryMode,
  items,
  products,
  productsQuery,
  actionNotes,
  setActionNotes,
  pending,
  onSubmit,
}: {
  orderId: string | number;
  inventoryMode?: string | null;
  items: PreparationEditorItem[];
  products: CentralKitchenCatalogItem[];
  productsQuery: CatalogQueryLike;
  actionNotes: string;
  setActionNotes: (value: string) => void;
  pending: boolean;
  onSubmit: (items: PreparationInput[]) => void;
}) {
  const [drafts, setDrafts] = useState<PreparationDraft[]>(() => items.map(item => {
    const itemId = Number(item.id);
    const mode = getPrepareFulfillmentMode(item, inventoryMode);
    const initial = mode === "mixed"
      ? getInitialMixedFulfillment(item)
      : { stock: String(item.requestedQuantity), production: "0" };
    return {
      itemId,
      preparedQuantity: initial.stock,
      preparedFromStock: initial.stock,
      preparedFromProduction: initial.production,
      substituteQuantity: String(item.substituteQuantity || 0),
      substituteProductName: item.substituteProductName || "",
      substituteUnit: item.substituteUnit || item.unit,
      substituteProductId: item.substituteProductId == null ? undefined : Number(item.substituteProductId),
      substituteWarehouseItemId: item.substituteWarehouseItemId == null ? undefined : Number(item.substituteWarehouseItemId),
      substituteManualMode: false,
      shortageReason: item.shortageReason || "",
      preparationNotes: item.preparationNotes || "",
    };
  }));
  const update = (index: number, changes: Partial<PreparationDraft>) => setDrafts(current => current.map((item, i) => i === index ? { ...item, ...changes } : item));
  const readinessQueries = useQueries({
    queries: items.map(item => {
      const mode = getPrepareFulfillmentMode(item, inventoryMode);
      const itemId = Number(item.id);
      return {
        queryKey: [`/api/central-kitchen-orders/${orderId}/items/${itemId}/production-fulfillment`],
        queryFn: () => fetchProductionFulfillmentReadiness(orderId, itemId),
        enabled: mode === "mixed" && Number.isInteger(itemId) && itemId > 0,
        staleTime: 0,
        retry: false,
      };
    }),
  });

  const validationError = useMemo(() => {
    for (let index = 0; index < drafts.length; index++) {
      const draft = drafts[index];
      const item = items[index];
      const requested = numberValue(item?.requestedQuantity);
      const substitute = Number(draft.substituteQuantity);
      const mode = getPrepareFulfillmentMode(item, inventoryMode);
       const integerOnly = item.productId != null;
       if (!isValidKitchenQuantity(draft.substituteQuantity, integerOnly, true)) return "أدخل كمية بديل صحيحة غير سالبة بوحدة الصنف المطلوب.";
      let prepared = Number(draft.preparedQuantity);
      if (mode === "mixed") {
        const query = readinessQueries[index];
        const checked = validateMixedFulfillmentQuantities({
          requestedQuantity: requested,
          stockQuantity: draft.preparedFromStock,
          productionQuantity: draft.preparedFromProduction,
          readiness: readinessState(query),
        });
        if (checked.error) return `${item.productName}: ${checked.error}`;
        prepared = checked.totalPrepared;
      }
       if (mode !== "mixed" && !isValidKitchenQuantity(draft.preparedQuantity, integerOnly, true)) return "أدخل كمية تجهيز صحيحة غير سالبة.";
      if (prepared + substitute > requested + 0.000001) return `إجمالي تجهيز ${item.productName} يتجاوز المطلوب.`;
      if (substitute > 0 && (!draft.substituteProductName.trim() || !draft.substituteUnit.trim())) return "أدخل اسم ووحدة المنتج البديل.";
      if (prepared + substitute < requested - 0.000001 && !draft.shortageReason) return "حدد سبب النقص لكل بند غير مكتمل.";
    }
    return "";
  }, [drafts, inventoryMode, items, readinessQueries]);

  const submit = () => {
    if (validationError) return;
    onSubmit(drafts.map((draft, index) => {
      const item = items[index];
      const mode = getPrepareFulfillmentMode(item, inventoryMode);
      const source = mode === "mixed"
        ? validateMixedFulfillmentQuantities({
            requestedQuantity: Number(item.requestedQuantity),
            stockQuantity: draft.preparedFromStock,
            productionQuantity: draft.preparedFromProduction,
            readiness: readinessState(readinessQueries[index]),
          })
        : { error: null, totalPrepared: Number(draft.preparedQuantity), stockQuantity: Number(draft.preparedQuantity), productionQuantity: 0 };
      const substituteQuantity = Number(draft.substituteQuantity);
      const hasShortage = source.totalPrepared + substituteQuantity < Number(item.requestedQuantity) - 0.000001;
      return {
        itemId: draft.itemId,
        preparedQuantity: source.totalPrepared,
        ...buildFulfillmentFields(mode, source.stockQuantity, source.productionQuantity),
        substituteQuantity,
        substituteProductName: substituteQuantity > 0 ? draft.substituteProductName.trim() : undefined,
        substituteUnit: substituteQuantity > 0 ? draft.substituteUnit.trim() : undefined,
        substituteProductId: substituteQuantity > 0 ? draft.substituteProductId : undefined,
        substituteWarehouseItemId: substituteQuantity > 0 ? draft.substituteWarehouseItemId : undefined,
        shortageReason: hasShortage ? draft.shortageReason || undefined : undefined,
        preparationNotes: draft.preparationNotes.trim() || undefined,
      };
    }));
  };

  return <section className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4">
    <div className="mb-3"><h3 className="font-semibold">تسجيل التجهيز الفعلي</h3><p className="text-xs text-muted-foreground">سجّل الكمية الأصلية والبديلة. البديل يُحتسب دائماً بوحدة الصنف المطلوب.</p></div>
    <CatalogQueryState query={productsQuery} count={products.length} />
    <div className="space-y-3">{drafts.map((draft, index) => {
      const item = items[index];
      const requested = numberValue(item?.requestedQuantity);
      const mode = getPrepareFulfillmentMode(item, inventoryMode);
      const query = readinessQueries[index];
      const readiness = readinessState(query);
      const prepared = mode === "mixed" ? Number(draft.preparedFromStock || 0) + Number(draft.preparedFromProduction || 0) : Number(draft.preparedQuantity || 0);
      const shortage = Math.max(0, requested - prepared - Number(draft.substituteQuantity || 0));
      return <div className="rounded-md border bg-background p-3" key={draft.itemId}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item?.productName} <span className="mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{sourceLabel(itemSource(item))}</span></p><Badge variant="outline">المطلوب: {requested} {item?.unit}</Badge></div>
        {mode === "mixed" ? <>
          <div className="mb-3 rounded-md border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-950"><p className="font-semibold">مصدر التجهيز المختلط</p><p className="mt-1">الإنتاج يُحتسب من دفعة وصفة مكتملة فقط. الإجمالي يستهلك مخزون المنتج النهائي مرة واحدة، ولا يضيف استهلاك مخزون إنتاج إضافياً.</p></div>
          <div className="grid gap-3 md:grid-cols-2">
             <div><Label className="text-xs" htmlFor={`stock-${draft.itemId}`}>جاهز من المخزون</Label><Input id={`stock-${draft.itemId}`} className="mt-1 min-h-11" type="number" inputMode="numeric" min="0" max={requested} step="1" value={draft.preparedFromStock} onChange={event => update(index, { preparedFromStock: event.target.value })} /></div>
             <div><Label className="text-xs" htmlFor={`production-${draft.itemId}`}>إنتاج جديد مكتمل مرتبط بالطلب</Label><Input id={`production-${draft.itemId}`} className="mt-1 min-h-11" type="number" inputMode="numeric" min="0" max={requested} step="1" value={draft.preparedFromProduction} onChange={event => update(index, { preparedFromProduction: event.target.value })} /><p className="mt-1 text-[11px] text-muted-foreground">لا تُقبل هذه الكمية إلا من دليل دفعة مكتملة مرتبط بهذا البند.</p></div>
          </div>
          <ProductionReadiness query={query} onRetry={() => query.refetch()} />
         </> : <div><Label className="text-xs" htmlFor={`prepared-${draft.itemId}`}>الكمية الأصلية المجهزة</Label><Input id={`prepared-${draft.itemId}`} className="mt-1 min-h-11" type="number" inputMode={item.productId != null ? "numeric" : "decimal"} min="0" max={requested} step={item.productId != null ? "1" : "0.000001"} value={draft.preparedQuantity} onChange={event => update(index, { preparedQuantity: event.target.value })} /></div>}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
           <div><Label className="text-xs" htmlFor={`substitute-${draft.itemId}`}>كمية البديل</Label><Input id={`substitute-${draft.itemId}`} className="mt-1 min-h-11" type="number" inputMode={item.productId != null ? "numeric" : "decimal"} min="0" max={requested} step={item.productId != null ? "1" : "0.000001"} value={draft.substituteQuantity} onChange={event => update(index, { substituteQuantity: event.target.value })} /></div>
           <div><Label className="text-xs">اختيار البديل</Label><div className="mt-1"><SubstitutePicker disabled={Number(draft.substituteQuantity) <= 0} value={draft.substituteWarehouseItemId !== undefined ? `warehouse:${draft.substituteWarehouseItemId}` : draft.substituteProductId !== undefined ? `product:${draft.substituteProductId}` : draft.substituteManualMode ? "__manual" : undefined} onValueChange={value => { if (value === "__manual") update(index, { substituteManualMode: true, substituteProductId: undefined, substituteWarehouseItemId: undefined, substituteProductName: "" }); else { const selected = products.find(entry => catalogKey(entry) === value); if (selected) { const source = selected.source; update(index, { substituteManualMode: false, substituteProductId: source === "product" ? selected.id : undefined, substituteWarehouseItemId: source === "warehouse" ? selected.id : undefined, substituteProductName: selected.name, substituteUnit: item.unit }); } } }} products={products} /></div><Input className="mt-2 min-h-11" disabled={Number(draft.substituteQuantity) <= 0 || !draft.substituteManualMode} value={draft.substituteProductName} onChange={event => update(index, { substituteProductName: event.target.value })} placeholder="اسم البديل اليدوي" /></div>
          <div><Label className="text-xs">وحدة احتساب البديل</Label><Input className="mt-1" disabled value={draft.substituteUnit} /><p className="mt-1 text-[11px] text-muted-foreground">مطابقة لوحدة الطلب</p></div>
        </div>
        {shortage > 0 && <div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label className="text-xs">سبب النقص ({shortage} {item?.unit})</Label><Select value={draft.shortageReason} onValueChange={value => update(index, { shortageReason: value })}><SelectTrigger className="mt-1"><SelectValue placeholder="اختر سبب النقص" /></SelectTrigger><SelectContent>{Object.entries(SHORTAGE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">ملاحظة التجهيز</Label><Input className="mt-1" value={draft.preparationNotes} onChange={event => update(index, { preparationNotes: event.target.value })} placeholder="تفاصيل النقص أو البديل" /></div></div>}
      </div>;
    })}</div>
    {validationError && <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />{validationError}</div>}
    <div className="mt-4"><Label htmlFor="preparation-note">ملاحظة عامة (اختياري)</Label><Input id="preparation-note" className="mt-1" value={actionNotes} onChange={event => setActionNotes(event.target.value)} /><Button className="mt-3" disabled={pending || !!validationError} onClick={submit}>{pending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PackagePlus className="ml-2 h-4 w-4" />}تأكيد الكميات والتجهيز</Button></div>
  </section>;
}

export function SavedPreparationSummary({ item }: { item: PreparationEditorItem }) {
  const source = getSavedPreparationSource(item);
  const proof = getProductionProofSummary(item.productionFulfillmentEvidence);
  if (source.kind === "unrecorded") {
    return <div><span>مصدر التجهيز غير مسجل</span>{proof.batchIds.length > 0 && <span className="block text-xs text-muted-foreground">دفعات الإثبات: {proof.batchIds.join("، ")}</span>}{proof.labels.length > 0 && <span className="block text-xs text-muted-foreground">{proof.labels.join(" · ")}</span>}</div>;
  }
  return <div><span>المخزون: {source.stockQuantity} · الإنتاج المكتمل: {source.productionQuantity}</span>{source.proofBatchIds.length > 0 && <span className="block text-xs text-muted-foreground">دفعات الإثبات: {source.proofBatchIds.join("، ")}</span>}{source.proofLabels.length > 0 && <span className="block text-xs text-muted-foreground">{source.proofLabels.join(" · ")}</span>}</div>;
}