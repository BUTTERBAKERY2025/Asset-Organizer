import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, PackagePlus, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  addWarehouseCatalogItem,
  filterWarehouseCatalog,
  isValidWarehouseDraftItem,
  warehouseCategoryLabel,
  type WarehouseCatalogEntry,
  type WarehouseTransferDraftItem,
} from "./warehouse-item-entry-helpers";

type Props = {
  catalog: WarehouseCatalogEntry[];
  items: WarehouseTransferDraftItem[];
  isRTL: boolean;
  onChange: (items: WarehouseTransferDraftItem[]) => void;
};

const acceptsDecimalInput = (value: string) => value === "" || /^\d*(?:\.\d{0,6})?$/.test(value);

export function WarehouseItemEntry({ catalog, items, isRTL, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const categories = useMemo(
    () => Array.from(new Set(catalog.map(item => item.category).filter(Boolean))).sort(),
    [catalog],
  );
  const results = useMemo(
    () => filterWarehouseCatalog(catalog, search, category),
    [catalog, category, search],
  );
  const selectedIds = new Set(items.map(item => item.itemId));
  const firstAvailable = results.find(item => !selectedIds.has(item.id));

  const patch = (index: number, values: Partial<WarehouseTransferDraftItem>) =>
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));

  const add = (entry: WarehouseCatalogEntry, focusQuantity = false) => {
    const existingIndex = items.findIndex(item => item.itemId === entry.id);
    if (existingIndex >= 0) {
      if (focusQuantity) document.querySelector<HTMLInputElement>(`#warehouse-request-qty-${existingIndex}`)?.focus();
      return;
    }
    const nextIndex = items.length;
    onChange(addWarehouseCatalogItem(items, entry));
    if (focusQuantity) requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>(`#warehouse-request-qty-${nextIndex}`)?.focus());
  };

  return (
    <section className="rounded-xl border border-border bg-card" aria-label={isRTL ? "بنود طلب المستودع" : "Warehouse request items"}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
        <div>
          <h3 className="font-semibold text-foreground">
            {isRTL ? "أصناف الطلب" : "Request items"}{" "}
            <Badge variant="secondary">{items.length} {isRTL ? "مختار" : "selected"}</Badge>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isRTL ? "عدد الأصناف فقط؛ لا تُجمع كميات بوحدات مختلفة." : "Item count only; quantities with different units are not summed."}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {isRTL ? "المتوفر المعلن يبقى غير معروف حتى تدخله." : "Declared on-hand remains unknown until entered."}
        </p>
      </header>

      <div className="grid min-h-[26rem] lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)]">
        <section className="border-b border-border bg-muted/10 p-3 lg:border-b-0 lg:border-l" aria-label={isRTL ? "كتالوج المستودع" : "Warehouse catalog"}>
          <div className="sticky top-0 z-[5] space-y-2 bg-card pb-3">
            <Label htmlFor="warehouse-catalog-search" className="sr-only">{isRTL ? "بحث في الأصناف" : "Search items"}</Label>
            <div className="relative">
              <Search className={`absolute top-3.5 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
              <Input
                ref={searchRef}
                id="warehouse-catalog-search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (firstAvailable) add(firstAvailable, true);
                }}
                className={`h-11 bg-background ${isRTL ? "pr-9" : "pl-9"}`}
                placeholder={isRTL ? "ابحث بالاسم أو الرمز…" : "Search name or code…"}
                autoComplete="off"
                data-testid="warehouse-catalog-search"
              />
            </div>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto" aria-label={isRTL ? "تصنيف الأصناف" : "Item categories"}>
              <Button type="button" size="sm" variant={category === "all" ? "default" : "outline"} onClick={() => setCategory("all")}>
                {isRTL ? "الكل" : "All"}
              </Button>
              {categories.map(value => (
                <Button key={value} type="button" size="sm" variant={category === value ? "default" : "outline"} onClick={() => setCategory(value)}>
                  {warehouseCategoryLabel(value, isRTL)}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isRTL ? "Enter يضيف أول نتيجة غير مختارة ولا يرسل الطلب." : "Enter adds the first unselected result and never submits."}
            </p>
          </div>
          <div className="max-h-[20rem] space-y-1 overflow-y-auto overscroll-contain lg:max-h-[32rem]" aria-live="polite">
            {results.slice(0, 100).map(entry => {
              const selected = selectedIds.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={selected}
                  onClick={() => add(entry)}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "cursor-default border-border bg-muted/60" : "border-transparent bg-card hover:border-primary/30 hover:bg-muted/40",
                  )}
                  data-testid={`warehouse-catalog-${entry.id}`}
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-foreground">{entry.name}</strong>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {entry.sku ? `${entry.sku} · ` : ""}{warehouseCategoryLabel(entry.category, isRTL)} · {entry.unit}
                    </span>
                  </span>
                  {selected
                    ? <span className="flex shrink-0 items-center text-xs font-medium text-primary"><Check className="me-1 h-4 w-4" />{isRTL ? "مختار" : "Selected"}</span>
                    : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              );
            })}
            {!results.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">{isRTL ? "لا توجد نتائج مطابقة." : "No matching items."}</p>}
            {results.length > 100 && <p className="p-2 text-center text-xs text-muted-foreground">{isRTL ? "تظهر أول 100 نتيجة؛ اكتب بحثاً أدق." : "Showing the first 100 results; refine your search."}</p>}
          </div>
        </section>

        <section className="min-w-0 p-3" aria-label={isRTL ? "الأصناف المختارة" : "Selected items"}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-foreground">{isRTL ? "المختار والكميات" : "Selected items and quantities"}</h4>
              <p className="text-xs text-muted-foreground">{isRTL ? "راجع المطلوب والمتوفر المعلن لكل صنف." : "Review requested and declared on-hand quantities for every item."}</p>
            </div>
            <Badge variant="outline">{items.length}</Badge>
          </div>
          {!items.length && (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
              <PackagePlus className="mb-2 h-7 w-7" />
              <p className="text-sm font-medium text-foreground">{isRTL ? "لم تختر أصنافاً بعد" : "No items selected"}</p>
              <p className="mt-1 text-xs">{isRTL ? "استخدم البحث لإضافة عدة أصناف بسرعة." : "Use search to add multiple items quickly."}</p>
            </div>
          )}
          <div className="max-h-[34rem] space-y-2 overflow-y-auto overscroll-contain pe-1">
            {items.map((item, index) => {
              const invalid = !isValidWarehouseDraftItem(item);
              return (
                <article key={item.itemId} className="rounded-lg border border-border bg-background p-3" data-testid={`item-row-${index}`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-foreground">{item.itemName}</strong>
                      <span className="text-[11px] text-muted-foreground">{item.category} · {item.unit}</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 text-destructive" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
                      <X className="me-1 h-4 w-4" />{isRTL ? "حذف" : "Remove"}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                      <Label className="text-xs" htmlFor={`warehouse-request-qty-${index}`}>{isRTL ? "الكمية المطلوبة" : "Requested quantity"}</Label>
                      <Input
                        id={`warehouse-request-qty-${index}`}
                        className="mt-1 h-12 text-base"
                        type="number"
                        min={item.unit === "قطعة" ? "1" : "0.000001"}
                        step={item.unit === "قطعة" ? "1" : "0.000001"}
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={event => {
                          if (acceptsDecimalInput(event.target.value) && (item.unit !== "قطعة" || !event.target.value.includes("."))) {
                            patch(index, { quantity: event.target.value });
                          }
                        }}
                        onKeyDown={event => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.stopPropagation();
                            searchRef.current?.focus();
                          }
                        }}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Label className="text-xs" htmlFor={`warehouse-on-hand-${index}`}>
                        {isRTL ? "المتوفر المعلن بالفرع" : "Declared branch on-hand"} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`warehouse-on-hand-${index}`}
                        className="mt-1 h-12 text-base"
                        type="number"
                        min="0"
                        step={item.unit === "قطعة" ? "1" : "0.000001"}
                        inputMode="decimal"
                        value={item.availableQuantity ?? ""}
                        onChange={event => {
                          const value = event.target.value;
                          if ((value === "" || acceptsDecimalInput(value)) && (item.unit !== "قطعة" || !value.includes("."))) {
                            patch(index, { availableQuantity: value === "" ? null : value });
                          }
                        }}
                        placeholder={isRTL ? "أدخل القيمة" : "Enter value"}
                        aria-invalid={item.availableQuantity === null}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Label className="text-xs" htmlFor={`warehouse-line-note-${index}`}>{isRTL ? "ملاحظة" : "Note"}</Label>
                      <Input id={`warehouse-line-note-${index}`} className="mt-1 h-12" value={item.notes} onChange={event => patch(index, { notes: event.target.value })} />
                    </div>
                  </div>
                  {invalid && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {isRTL ? "راجع الكمية المطلوبة وأدخل المتوفر المعلن (الصفر مقبول عند التصريح به)." : "Review requested quantity and enter declared on-hand (an explicitly entered zero is valid)."}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}