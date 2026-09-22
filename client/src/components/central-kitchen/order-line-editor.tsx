import { AlertTriangle, Plus, X } from "lucide-react";
import { AvailabilitySnapshot } from "@/components/central-kitchen/availability-snapshot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CatalogItemPicker } from "@/components/central-kitchen/catalog-item-picker";
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

type Props = {
  items: KitchenOrderDraftLine[];
  products: CentralKitchenCatalogItem[];
  kitchenId: string;
  catalogLoading: boolean;
  catalogError: boolean;
  onRetryCatalog: () => void;
  onChange: (items: KitchenOrderDraftLine[]) => void;
};

const emptyLine = (): KitchenOrderDraftLine => ({
  productName: "", unit: "قطعة", requestedQuantity: "1", reportedAvailableQuantity: "", notes: "",
});

const productKey = (item: CentralKitchenCatalogItem) => `${item.source}:${item.id}`;

export function OrderLineEditor({ items, products, kitchenId, catalogLoading, catalogError, onRetryCatalog, onChange }: Props) {
  const patch = (index: number, values: Partial<KitchenOrderDraftLine>) =>
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  const selectedKeys = new Set(items.map(item => item.warehouseItemId !== undefined ? `warehouse:${item.warehouseItemId}` : item.productId !== undefined ? `product:${item.productId}` : "").filter(Boolean));

  return <section className="overflow-hidden rounded-xl border bg-muted/15" aria-label="بنود طلب المطبخ">
    <div className="flex items-center justify-between gap-3 border-b bg-background/70 px-4 py-3">
      <div>
        <h3 className="font-semibold">بنود الطلب</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">المتوفر الذي تدخله معلومة للمطبخ ولا يغيّر رصيد المخزون.</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, emptyLine()])}>
        <Plus className="ml-1 h-4 w-4" />إضافة صنف
      </Button>
    </div>
    {catalogLoading && <div className="border-b px-4 py-3 text-sm text-muted-foreground">جارٍ تحميل أصناف المطبخ…</div>}
    {catalogError && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/25 bg-destructive/5 px-4 py-3 text-sm" role="alert">
      <span>تعذر تحميل كتالوج الأصناف. لا يمكن اختيار صنف من الكتالوج الآن.</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetryCatalog}>إعادة المحاولة</Button>
    </div>}
    {!catalogLoading && !catalogError && products.length === 0 && <div className="border-b px-4 py-3 text-sm text-muted-foreground">لا توجد أصناف متاحة حالياً. استخدم الإدخال اليدوي عند الحاجة فقط.</div>}
    <div className="space-y-3 p-3">
      {items.map((item, index) => {
        const value = item.warehouseItemId !== undefined ? `warehouse:${item.warehouseItemId}` : item.productId !== undefined ? `product:${item.productId}` : item.manualMode ? "__manual" : undefined;
        const isProduct = item.productId !== undefined;
        const quantityStep = isProduct ? "1" : "0.000001";
        const requestedInvalid = !isValidKitchenQuantity(item.requestedQuantity, isProduct);
        const stockInvalid = !isValidKitchenQuantity(item.reportedAvailableQuantity, isProduct, true);
        return <article key={index} className="rounded-lg border bg-background p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">البند {index + 1}</span>
            {items.length > 1 && <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><X className="ml-1 h-4 w-4" />حذف</Button>}
          </div>
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <Label className="text-xs">الصنف</Label>
              <CatalogItemPicker value={value} disabled={catalogLoading} products={products} selectedKeys={selectedKeys} onChange={next => {
                if (next === "__manual") {
                  patch(index, { manualMode: true, productId: undefined, warehouseItemId: undefined, productName: "", unit: "قطعة", reportedAvailableQuantity: "" });
                  return;
                }
                const selected = products.find(product => productKey(product) === next);
                if (selected) patch(index, {
                  manualMode: false, productId: selected.source === "product" ? selected.id : undefined,
                  warehouseItemId: selected.source === "warehouse" ? selected.id : undefined,
                  productName: selected.name, unit: selected.unit, reportedAvailableQuantity: "",
                });
              }} dataTestid={`catalog-item-${index}`} />
              <p className="mt-1 text-[11px] text-muted-foreground">ابحث بالاسم أو الرمز. الأصناف المختارة في بنود أخرى غير متاحة لتفادي التكرار.</p>
              {item.manualMode && <div className="mt-2 grid gap-2 sm:grid-cols-2"><Input value={item.productName} onChange={event => patch(index, { productName: event.target.value })} placeholder="اسم الصنف اليدوي" aria-label="اسم الصنف اليدوي" /><Input value={item.unit} onChange={event => patch(index, { unit: event.target.value })} placeholder="الوحدة" aria-label="وحدة الصنف اليدوي" /></div>}
              {!item.manualMode && item.productName && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs"><span className="font-medium">الصنف المختار: {item.productName}</span><Badge variant="outline">{item.unit}</Badge><AvailabilitySnapshot kitchenId={kitchenId} productId={item.productId} warehouseItemId={item.warehouseItemId} requested={item.requestedQuantity} /></div>}
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs" htmlFor={`request-qty-${index}`}>الكمية المطلوب توريدها</Label>
               <Input id={`request-qty-${index}`} className="mt-1 h-12 text-base" type="number" min={isProduct ? "1" : "0.000001"} step={quantityStep} inputMode="decimal" value={item.requestedQuantity} onChange={event => patch(index, { requestedQuantity: event.target.value })} aria-invalid={requestedInvalid} />
              <p className="mt-1 text-[11px] text-muted-foreground">{isProduct ? "المنتجات بأعداد صحيحة." : "المواد تقبل حتى 6 منازل عشرية."}</p>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs" htmlFor={`reported-stock-${index}`}>المتوفر حالياً في الفرع <span className="text-destructive">*</span></Label>
               <Input id={`reported-stock-${index}`} className="mt-1 h-12 border-amber-300 bg-amber-50/60 text-base" type="number" min="0" step={quantityStep} inputMode="decimal" value={item.reportedAvailableQuantity} onChange={event => patch(index, { reportedAvailableQuantity: event.target.value })} placeholder="مثال: 0" aria-invalid={stockInvalid} aria-describedby={`reported-stock-help-${index}`} />
              <p id={`reported-stock-help-${index}`} className="mt-1 text-[11px] text-muted-foreground">{stockInvalid ? "أدخل صفراً أو كمية صحيحة حتى 6 منازل عشرية؛ لا يُفترض الرصيد تلقائياً." : "معلومة للمطبخ ولا تغيّر رصيد المخزون."}</p>
            </div>
            <div className="md:col-span-1">
              <Label className="text-xs" htmlFor={`line-note-${index}`}>ملاحظة</Label>
              <Input id={`line-note-${index}`} className="mt-1 h-10" value={item.notes} onChange={event => patch(index, { notes: event.target.value })} placeholder="—" />
            </div>
          </div>
          {(requestedInvalid || stockInvalid) && <p className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />راجع كمية التوريد والرصيد المعلن قبل الإرسال.</p>}
        </article>;
      })}
    </div>
  </section>;
}