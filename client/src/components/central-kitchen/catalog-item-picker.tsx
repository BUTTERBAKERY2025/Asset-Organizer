import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useVisualViewportDialog } from "@/components/central-kitchen/use-visual-viewport-dialog";
import type { CentralKitchenCatalogItem } from "@shared/central-kitchen-catalog";

type Props = {
  value?: string;
  products: CentralKitchenCatalogItem[];
  selectedKeys: Set<string>;
  disabled?: boolean;
  onChange: (value: string) => void;
  dataTestid?: string;
};

const keyFor = (item: CentralKitchenCatalogItem) => `${item.source}:${item.id}`;

export function CatalogItemPicker({ value, products, selectedKeys, disabled, onChange, dataTestid }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const dialogStyle = useVisualViewportDialog({ open, maxHeight: 680, viewportFraction: 0.92 });
  const selected = products.find(item => keyFor(item) === value);
  const results = useMemo(() => {
    const query = term.trim().toLocaleLowerCase("ar");
    if (!query) return products;
    return products.filter(item => [item.name, item.sku, item.unit, item.source === "warehouse" ? "مستودع مواد" : "منتج"]
      .filter(Boolean).some(part => String(part).toLocaleLowerCase("ar").includes(query)));
  }, [products, term]);
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setTerm("");
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" className="mt-1 h-auto min-h-12 w-full justify-between whitespace-normal px-3 py-2 text-right" disabled={disabled} data-testid={dataTestid}>
        <span className="min-w-0">
          {selected ? <><span className="block break-words whitespace-normal font-medium">{selected.name}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{selected.sku ? `الرمز: ${selected.sku} · ` : ""}{selected.unit}</span></> : <span className="text-muted-foreground">{value === "__manual" ? "إدخال يدوي" : "اختر صنفاً من الكتالوج"}</span>}
        </span>
        <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
    </DialogTrigger>
    <DialogContent dir="rtl" style={{ ...dialogStyle, display: "flex", flexDirection: "column" }} className="h-[min(680px,92dvh)] max-w-lg gap-0 overflow-hidden p-0 sm:rounded-xl [&>button]:left-2 [&>button]:right-auto [&>button]:top-2 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
      <DialogHeader className="border-b py-4 pl-14 pr-5 text-right">
        <DialogTitle>اختيار صنف</DialogTitle>
        <DialogDescription>ابحث بالاسم أو الرمز، ثم اختر الصنف مرة واحدة.</DialogDescription>
      </DialogHeader>
      <div className="border-b px-4 py-3">
        <label className="sr-only" htmlFor="catalog-picker-search">ابحث في الأصناف</label>
        <div className="relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="catalog-picker-search" autoFocus value={term} onChange={event => setTerm(event.target.value)} className="h-11 pr-9" placeholder="اكتب اسم الصنف أو رمزه" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" aria-label="نتائج الأصناف">
        <button type="button" onClick={() => choose("__manual")} className="mb-1 flex min-h-14 w-full items-center justify-between rounded-lg border border-dashed px-3 text-right hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span><span className="block font-medium">إدخال يدوي</span><span className="text-xs text-muted-foreground">للصنف غير الموجود في الكتالوج</span></span><Badge variant="outline">يدوي</Badge>
        </button>
        {results.map(item => {
          const itemKey = keyFor(item);
          const unavailable = selectedKeys.has(itemKey) && value !== itemKey;
          return <button key={itemKey} type="button" disabled={unavailable} data-testid={dataTestid ? `${dataTestid}-option-${itemKey}` : undefined} onClick={() => choose(itemKey)} className={cn("mb-1 flex min-h-16 w-full items-center justify-between rounded-lg px-3 py-2 text-right transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45", value === itemKey && "bg-primary/10")}>
            <span className="min-w-0"><span className="block break-words whitespace-normal font-medium">{item.name}</span><span className="block text-xs text-muted-foreground">{item.sku ? `الرمز: ${item.sku} · ` : ""}{item.unit}{unavailable ? " · مضاف إلى الطلب" : ""}</span></span>
            <span className="mr-3 flex shrink-0 items-center gap-2"><Badge variant="outline">{item.source === "warehouse" ? "مستودع" : "منتج"}</Badge>{value === itemKey && <Check className="h-4 w-4 text-primary" />}</span>
          </button>;
        })}
        {!results.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">لا توجد أصناف مطابقة لعبارة البحث.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}