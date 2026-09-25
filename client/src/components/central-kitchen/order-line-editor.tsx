import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, PackagePlus, Plus, Search, X } from "lucide-react";
import { AvailabilitySnapshot } from "@/components/central-kitchen/availability-snapshot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CentralKitchenCatalogItem } from "@shared/central-kitchen-catalog";

export type KitchenOrderDraftLine = {
  productId?: number;
  warehouseItemId?: number;
  manualMode?: boolean;
  productName: string;
  unit: string;
  requestedQuantity: string;
  reportedAvailableQuantity: string;
  notes: string;
};

/** Pure contract helpers: blank stock is invalid while a declared zero is valid. */
export function normalizeReportedAvailableQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasAtMostSixDecimalPlaces(value: string): boolean {
  const trimmed = value.trim();
  return /^-?\d+(?:\.\d{1,6})?$/.test(trimmed);
}

export function isValidKitchenQuantity(value: string, integerOnly: boolean, allowZero = false): boolean {
  const parsed = Number(value);
  return value.trim() !== ""
    && hasAtMostSixDecimalPlaces(value)
    && Number.isFinite(parsed)
    && (allowZero ? parsed >= 0 : parsed > 0)
    && (!integerOnly || Number.isInteger(parsed));
}

export function isValidKitchenOrderLine(line: KitchenOrderDraftLine): boolean {
  const available = normalizeReportedAvailableQuantity(line.reportedAvailableQuantity);
  const isCatalogProduct = line.productId !== undefined;
  return !!line.productName.trim()
    && !!line.unit.trim()
    && isValidKitchenQuantity(line.requestedQuantity, isCatalogProduct)
    && available !== null
    && isValidKitchenQuantity(line.reportedAvailableQuantity, isCatalogProduct, true);
}

export function isKitchenOrderDraftValid(items: KitchenOrderDraftLine[]) {
  return items.length > 0 && items.every(isValidKitchenOrderLine);
}

export type KitchenDraftInvalidTarget = {
  index: number;
  selector: string;
  mobileView: "choose" | "selected";
};

/** The same field order used by the editor's "complete missing" action. */
export function getKitchenDraftInvalidTarget(items: KitchenOrderDraftLine[]): KitchenDraftInvalidTarget | null {
  if (!items.length) return { index: 0, selector: "#kitchen-catalog-search", mobileView: "choose" };
  for (const [index, item] of items.entries()) {
    if (isBlankDraftLine(item)) return { index, selector: "#kitchen-catalog-search", mobileView: "choose" };
    if (!item.productName.trim()) return { index, selector: `#manual-name-${index}`, mobileView: "selected" };
    if (!item.unit.trim()) return { index, selector: `#manual-unit-${index}`, mobileView: "selected" };
    const integerOnly = item.productId !== undefined;
    if (!isValidKitchenQuantity(item.requestedQuantity, integerOnly)) return { index, selector: `#request-qty-${index}`, mobileView: "selected" };
    if (!isValidKitchenQuantity(item.reportedAvailableQuantity, integerOnly, true)) return { index, selector: `#reported-stock-${index}`, mobileView: "selected" };
  }
  return null;
}

export function kitchenCatalogSupplyLabel(line: Pick<KitchenOrderDraftLine, "productId" | "warehouseItemId">) {
  return line.warehouseItemId !== undefined
    ? "مادة مستودع · من مخزون المطبخ"
    : line.productId !== undefined
      ? "منتج مطبخ"
      : "إدخال يدوي";
}

export type KitchenCatalogSourceFilter = "all" | CentralKitchenCatalogItem["source"];

export function normalizeKitchenCatalogSearch(value: string) {
  return value
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterKitchenCatalog(
  products: CentralKitchenCatalogItem[],
  search: string,
  source: KitchenCatalogSourceFilter,
) {
  const query = normalizeKitchenCatalogSearch(search);
  return products.filter(item => {
    if (source !== "all" && item.source !== source) return false;
    if (!query) return true;
    return normalizeKitchenCatalogSearch([item.name, item.sku, item.unit].filter(Boolean).join(" ")).includes(query);
  });
}

const isBlankDraftLine = (line: KitchenOrderDraftLine) =>
  line.productId === undefined
  && line.warehouseItemId === undefined
  && !line.manualMode
  && !line.productName.trim();

export function addKitchenCatalogItem(
  items: KitchenOrderDraftLine[],
  selected: CentralKitchenCatalogItem,
) {
  const duplicate = items.some(item => selected.source === "product"
    ? item.productId === selected.id
    : item.warehouseItemId === selected.id);
  if (duplicate) return items;
  const line: KitchenOrderDraftLine = {
    ...(selected.source === "product" ? { productId: selected.id } : { warehouseItemId: selected.id }),
    manualMode: false,
    productName: selected.name,
    unit: selected.unit,
    requestedQuantity: "1",
    reportedAvailableQuantity: "",
    notes: "",
  };
  const blankIndex = items.findIndex(isBlankDraftLine);
  if (blankIndex < 0) return [...items, line];
  return items.map((item, index) => index === blankIndex ? line : item);
}

type Props = {
  items: KitchenOrderDraftLine[];
  products: CentralKitchenCatalogItem[];
  kitchenId: string;
  catalogLoading: boolean;
  catalogError: boolean;
  onRetryCatalog: () => void;
  onChange: (items: KitchenOrderDraftLine[]) => void;
  mobileView?: "choose" | "selected";
  onMobileViewChange?: (view: "choose" | "selected") => void;
};

const emptyLine = (): KitchenOrderDraftLine => ({
  productName: "", unit: "قطعة", requestedQuantity: "1", reportedAvailableQuantity: "", notes: "",
});

const productKey = (item: CentralKitchenCatalogItem) => `${item.source}:${item.id}`;

export function OrderLineEditor({ items, products, kitchenId, catalogLoading, catalogError, onRetryCatalog, onChange, mobileView: controlledMobileView, onMobileViewChange }: Props) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<KitchenCatalogSourceFilter>("all");
  const [uncontrolledMobileView, setUncontrolledMobileView] = useState<"choose" | "selected">("choose");
  const [touched, setTouched] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileView = controlledMobileView ?? uncontrolledMobileView;
  const setMobileView = (view: "choose" | "selected") => {
    setUncontrolledMobileView(view);
    onMobileViewChange?.(view);
  };
  const patch = (index: number, values: Partial<KitchenOrderDraftLine>) => {
    setTouched(previous => [...new Set([...previous, ...Object.keys(values).map(key => `${index}:${key}`)])]);
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  };
  const selectedKeys = new Set(items.map(item => item.warehouseItemId !== undefined ? `warehouse:${item.warehouseItemId}` : item.productId !== undefined ? `product:${item.productId}` : "").filter(Boolean));
  const visibleItems = items.map((item, index) => ({ item, index })).filter(({ item }) => !isBlankDraftLine(item));
  const incompleteCount = visibleItems.filter(({ item }) => !isValidKitchenOrderLine(item)).length;
  const catalogResults = useMemo(() => filterKitchenCatalog(products, search, source), [products, search, source]);
  const focusTarget = (selector: string) => requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(selector);
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus({ preventScroll: true });
    }));
  const enterView = (view: "choose" | "selected") => {
    setMobileView(view);
    if (view === "choose") focusTarget("#kitchen-catalog-search");
    else {
      const target = getKitchenDraftInvalidTarget(items);
      focusTarget(target?.mobileView === "selected"
      ? target.selector
      : `#request-qty-${visibleItems[0]?.index ?? 0}`);
    }
  };
  const focusIncomplete = () => {
    const target = getKitchenDraftInvalidTarget(items);
    if (!target) return;
    setShowErrors(true);
    setMobileView(target.mobileView);
    focusTarget(target.selector);
  };
  const addCatalogItem = (selected: CentralKitchenCatalogItem, focusQuantity = false) => {
    const existingIndex = items.findIndex(item => selected.source === "product"
      ? item.productId === selected.id
      : item.warehouseItemId === selected.id);
    if (existingIndex >= 0) {
      if (focusQuantity) {
        setMobileView("selected");
        focusTarget(`#request-qty-${existingIndex}`);
      }
      return;
    }
    const blankIndex = items.findIndex(isBlankDraftLine);
    const nextIndex = blankIndex >= 0 ? blankIndex : items.length;
    onChange(addKitchenCatalogItem(items, selected));
    if (focusQuantity || (typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches)) {
      if (focusQuantity) setMobileView("selected");
      focusTarget(`#request-qty-${nextIndex}`);
    }
  };
  const addManualItem = () => {
    const blankIndex = items.findIndex(isBlankDraftLine);
    const line = emptyLine();
    line.manualMode = true;
    const next = blankIndex >= 0
      ? items.map((item, index) => index === blankIndex ? line : item)
      : [...items, line];
    const nextIndex = blankIndex >= 0 ? blankIndex : items.length;
    onChange(next);
    setMobileView("selected");
    focusTarget(`#manual-name-${nextIndex}`);
  };
  const removeItem = (index: number) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    setTouched(previous => previous.flatMap(key => {
      const [row, field] = key.split(":");
      const current = Number(row);
      return current === index ? [] : [`${current > index ? current - 1 : current}:${field}`];
    }));
    onChange(next.length ? next : [emptyLine()]);
    if (!next.some(item => !isBlankDraftLine(item))) {
      setMobileView("choose");
      setShowErrors(false);
      focusTarget("#kitchen-catalog-search");
    }
  };
  const firstAvailableResult = catalogResults.find(item => !selectedKeys.has(productKey(item)));

  return <section className="rounded-xl border border-border bg-card" aria-label="بنود طلب المطبخ">
    <div className="flex items-start justify-between gap-3 rounded-t-xl border-b border-border bg-card px-3 py-3 sm:px-4">
      <div className="min-w-0">
        <h3 className="font-semibold text-foreground">بنود الطلب <Badge variant="secondary" className="mr-1">{visibleItems.length} مختار</Badge></h3>
        <p className="mt-0.5 hidden text-xs text-muted-foreground lg:block">اختر بسرعة ثم عدّل الكميات والمتوفر. لا يُفترض رصيد صفري عند الإضافة.</p>
      </div>
      <Button type="button" variant="outline" size="sm" className="min-h-10 shrink-0" onClick={addManualItem}>
        <Plus className="ml-1 h-4 w-4" />إدخال يدوي
      </Button>
    </div>
    {catalogLoading && <div className="border-b px-4 py-3 text-sm text-muted-foreground">جارٍ تحميل أصناف المطبخ…</div>}
    {catalogError && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/25 bg-destructive/5 px-4 py-3 text-sm" role="alert">
      <span>تعذر تحميل كتالوج الأصناف. لا يمكن اختيار صنف من الكتالوج الآن.</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetryCatalog}>إعادة المحاولة</Button>
    </div>}
    {!catalogLoading && !catalogError && products.length === 0 && <div className="border-b px-4 py-3 text-sm text-muted-foreground">لا توجد أصناف متاحة حالياً. استخدم الإدخال اليدوي عند الحاجة فقط.</div>}
      <div className="sticky top-0 z-10 border-b border-border bg-card p-2 lg:hidden">
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="مهمة الأصناف">
          <Button type="button" variant={mobileView === "choose" ? "default" : "outline"} className="min-h-11" onClick={() => enterView("choose")} role="tab" aria-selected={mobileView === "choose"}>1. اختيار الأصناف</Button>
          <Button type="button" variant={mobileView === "selected" ? "default" : "outline"} className="min-h-11" onClick={() => enterView("selected")} role="tab" aria-selected={mobileView === "selected"}>2. الكميات ({visibleItems.length})</Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span>{visibleItems.length} مختار · {incompleteCount} ناقص الإكمال</span>
          {mobileView === "choose"
            ? <Button type="button" size="sm" className="min-h-10" onClick={() => enterView("selected")}>إدخال الكميات</Button>
            : incompleteCount > 0 && <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={focusIncomplete}>إكمال الناقص ({incompleteCount})</Button>}
        </div>
      </div>
      <div className="grid min-w-0 lg:min-h-[28rem] lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)]">
       <section className={cn("border-b border-border bg-muted/10 p-3 lg:block lg:border-b-0 lg:border-l", mobileView === "choose" ? "block" : "hidden")} aria-label="كتالوج أصناف المطبخ">
         <div className="space-y-2 bg-card pb-3">
          <Label htmlFor="kitchen-catalog-search" className="sr-only">بحث في كتالوج المطبخ</Label>
          <div className="relative">
            <Search className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              id="kitchen-catalog-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (firstAvailableResult) addCatalogItem(firstAvailableResult, true);
              }}
              className="h-11 bg-background pr-9"
              placeholder="ابحث بالاسم أو الرمز…"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-3 gap-1" aria-label="تصفية مصدر الكتالوج">
            {([
              ["all", "الكل"],
              ["product", "منتجات"],
              ["warehouse", "مواد"],
            ] as const).map(([value, label]) => <Button key={value} type="button" size="sm" variant={source === value ? "default" : "outline"} className="min-h-9 px-2" onClick={() => setSource(value)}>{label}</Button>)}
          </div>
          <p className="hidden text-[11px] text-muted-foreground lg:block">Enter يضيف أول نتيجة غير مختارة وينقل المؤشر إلى كميتها. لا يرسل الطلب.</p>
        </div>
          <div className="space-y-1 lg:max-h-[34rem] lg:overflow-y-auto lg:overscroll-contain" aria-live="polite">
          {catalogResults.slice(0, 100).map(product => {
            const key = productKey(product);
            const selected = selectedKeys.has(key);
            return <button
              key={key}
              type="button"
              disabled={selected}
              onClick={() => addCatalogItem(product)}
              className={cn("flex min-h-14 w-full items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "cursor-default border-border bg-muted/60" : "bg-card hover:border-primary/30 hover:bg-muted/40")}
              data-testid={`quick-catalog-${key}`}
            >
              <span className="min-w-0"><strong className="block truncate text-sm text-foreground">{product.name}</strong><span className="block truncate text-[11px] text-muted-foreground">{product.sku ? `${product.sku} · ` : ""}{product.unit} · {product.source === "warehouse" ? "مادة من مخزون المطبخ" : "منتج مطبخ"}</span></span>
              {selected ? <span className="flex shrink-0 items-center text-xs font-medium text-primary"><Check className="ml-1 h-4 w-4" />مختار</span> : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>;
          })}
          {!catalogLoading && !catalogError && !catalogResults.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة. غيّر البحث أو استخدم الإدخال اليدوي.</p>}
          {catalogResults.length > 100 && <p className="p-2 text-center text-xs text-muted-foreground">تظهر أول 100 نتيجة؛ اكتب جزءاً أدق من الاسم أو الرمز.</p>}
        </div>
      </section>
       <section className={cn("min-w-0 p-3 lg:block", mobileView === "selected" ? "block" : "hidden")} aria-label="الأصناف المختارة">
         <div className="mb-3 flex items-center justify-between gap-2"><div><h4 className="font-semibold text-foreground">المختار والكميات</h4><p className="text-xs text-muted-foreground">المتوفر الحالي مطلوب صراحةً، ويظل فارغاً حتى تدخله.</p></div><div className="flex items-center gap-2"><Badge variant="outline">{visibleItems.length} مختار · {incompleteCount} ناقص</Badge>{incompleteCount > 0 && <Button type="button" variant="outline" size="sm" className="hidden lg:inline-flex" onClick={focusIncomplete}>إكمال الناقص</Button>}</div></div>
         {!visibleItems.length && <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground"><PackagePlus className="mb-2 h-7 w-7" /><p className="text-sm font-medium text-foreground">لم تختر أصنافاً بعد</p><p className="mt-1 text-xs">ارجع إلى «اختيار الأصناف» ثم أضف ما تحتاجه.</p><Button type="button" variant="outline" className="mt-4 min-h-11 lg:hidden" onClick={() => enterView("choose")}>اختيار الأصناف</Button></div>}
        <div className="space-y-2">
      {visibleItems.map(({ item, index }) => {
        const isProduct = item.productId !== undefined;
        const quantityStep = isProduct ? "1" : "0.000001";
        const requestedInvalid = !isValidKitchenQuantity(item.requestedQuantity, isProduct);
        const stockInvalid = !isValidKitchenQuantity(item.reportedAvailableQuantity, isProduct, true);
        const showRequestedError = requestedInvalid && (showErrors || touched.includes(`${index}:requestedQuantity`));
        const showStockError = stockInvalid && (showErrors || touched.includes(`${index}:reportedAvailableQuantity`));
        return <article key={index} data-testid={`order-line-${index}`} className="rounded-lg border border-border bg-background p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0"><strong className="block truncate text-sm text-foreground">{item.productName || "صنف يدوي"}</strong>{!item.manualMode && <span className="text-[11px] text-muted-foreground">{kitchenCatalogSupplyLabel(item)} · {item.unit}</span>}</div>
            <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 text-destructive" onClick={() => removeItem(index)}><X className="ml-1 h-4 w-4" />حذف</Button>
          </div>
           {item.manualMode && <div className="mb-3 grid gap-2 sm:grid-cols-2"><div><Label className="text-xs" htmlFor={`manual-name-${index}`}>اسم الصنف</Label><Input id={`manual-name-${index}`} className="mt-1 h-11" value={item.productName} onChange={event => patch(index, { productName: event.target.value })} placeholder="اسم الصنف اليدوي" aria-invalid={!item.productName.trim() && (showErrors || touched.includes(`${index}:productName`))} /></div><div><Label className="text-xs" htmlFor={`manual-unit-${index}`}>الوحدة</Label><Input id={`manual-unit-${index}`} className="mt-1 h-11" value={item.unit} onChange={event => patch(index, { unit: event.target.value })} placeholder="الوحدة" aria-invalid={!item.unit.trim() && (showErrors || touched.includes(`${index}:unit`))} /></div></div>}
           <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-6">
               <div className="lg:col-span-2">
              <Label className="text-xs" htmlFor={`request-qty-${index}`}>الكمية المطلوب توريدها</Label>
                 <Input id={`request-qty-${index}`} className="mt-1 h-12 text-base" type="number" min={isProduct ? "1" : "0.000001"} step={quantityStep} inputMode={isProduct ? "numeric" : "decimal"} value={item.requestedQuantity} onChange={event => patch(index, { requestedQuantity: event.target.value })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); enterView("choose"); } }} aria-invalid={showRequestedError} />
              <p className="mt-1 text-[11px] text-muted-foreground">{isProduct ? "المنتجات بأعداد صحيحة." : "المواد تقبل حتى 6 منازل عشرية."}</p>
            </div>
               <div className="lg:col-span-2">
              <Label className="text-xs" htmlFor={`reported-stock-${index}`}>المتوفر حالياً في الفرع <span className="text-destructive">*</span></Label>
                 <Input id={`reported-stock-${index}`} className="mt-1 h-12 text-base" type="number" min="0" step={quantityStep} inputMode={isProduct ? "numeric" : "decimal"} value={item.reportedAvailableQuantity} onChange={event => patch(index, { reportedAvailableQuantity: event.target.value })} placeholder="أدخل القيمة" aria-invalid={showStockError} aria-describedby={`reported-stock-help-${index}`} />
               <p id={`reported-stock-help-${index}`} className="mt-1 text-[11px] text-muted-foreground">{showStockError ? "أدخل صفراً أو كمية صحيحة حتى 6 منازل عشرية؛ لا يُفترض الرصيد تلقائياً." : "معلومة للمطبخ ولا تغيّر رصيد المخزون."}</p>
            </div>
               <div className="min-[390px]:col-span-2 lg:col-span-2">
              <Label className="text-xs" htmlFor={`line-note-${index}`}>ملاحظة</Label>
               <Input id={`line-note-${index}`} className="mt-1 h-12" value={item.notes} onChange={event => patch(index, { notes: event.target.value })} placeholder="اختياري" />
            </div>
          </div>
           {!item.manualMode && <div className="mt-2"><AvailabilitySnapshot kitchenId={kitchenId} productId={item.productId} warehouseItemId={item.warehouseItemId} requested={item.requestedQuantity} /></div>}
           {(showRequestedError || showStockError) && <p className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />راجع كمية التوريد والرصيد المعلن قبل الإرسال.</p>}
        </article>;
      })}
        </div>
      </section>
    </div>
  </section>;
}