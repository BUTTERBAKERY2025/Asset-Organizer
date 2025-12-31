import { useState, useMemo, useRef, useEffect } from "react";
import { Check, Search, Package, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Product } from "@shared/schema";

interface ProductSelectorProps {
  products: Product[];
  value: string;
  onSelect: (productId: string, product: Product) => void;
  placeholder?: string;
  showPrice?: boolean;
  disabled?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  "مخبوزات": "bg-amber-100 text-amber-700 border-amber-200",
  "مشروبات": "bg-blue-100 text-blue-700 border-blue-200",
  "حلويات": "bg-pink-100 text-pink-700 border-pink-200",
  "بيتزا": "bg-red-100 text-red-700 border-red-200",
  "سلطات ووجبات": "bg-green-100 text-green-700 border-green-200",
  "هدايا وإكسسوارات": "bg-purple-100 text-purple-700 border-purple-200",
  "أخرى": "bg-gray-100 text-gray-700 border-gray-200",
};

export function ProductSelector({
  products,
  value,
  onSelect,
  placeholder = "ابحث عن المنتج...",
  showPrice = true,
  disabled = false,
}: ProductSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(
    () => products.find(p => String(p.id) === value),
    [products, value]
  );

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.sku || "").toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  }, [products, search]);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    filteredProducts.forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredProducts]);

  const flatList = useMemo(() => {
    return groupedProducts.flatMap(([_, items]) => items);
  }, [groupedProducts]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, flatList.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatList[highlightedIndex]) {
          handleSelect(flatList[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearch("");
        break;
    }
  };

  const handleSelect = (product: Product) => {
    onSelect(String(product.id), product);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect("", {} as Product);
  };

  return (
    <div className="relative" dir="rtl">
      <div
        className={cn(
          "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-all",
          isOpen ? "ring-2 ring-primary border-primary" : "hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        data-testid="product-selector-trigger"
      >
        {selectedProduct ? (
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="font-medium">{selectedProduct.name}</span>
              {selectedProduct.sku && (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedProduct.sku}</code>
              )}
            </div>
            {showPrice && selectedProduct.basePrice && (
              <Badge variant="secondary" className="mr-2">
                {selectedProduct.basePrice.toFixed(2)} ر.س
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -my-1"
              onClick={handleClear}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2 text-muted-foreground">
            <Search className="w-4 h-4" />
            <span>{placeholder}</span>
          </div>
        )}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setSearch("");
            }}
          />
          <div className="absolute top-full mt-1 w-full z-50 bg-background border rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b bg-muted/30">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب للبحث السريع... (الاسم، الكود، الفئة)"
                  className="pr-10 h-10"
                  data-testid="product-search-input"
                />
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs px-1.5">↑↓</Badge>
                <span>للتنقل</span>
                <Badge variant="outline" className="text-xs px-1.5 mr-2">Enter</Badge>
                <span>للاختيار</span>
                <Badge variant="outline" className="text-xs px-1.5 mr-2">Esc</Badge>
                <span>للإغلاق</span>
              </div>
            </div>

            <ScrollArea className="max-h-[320px]" ref={listRef}>
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>لا توجد نتائج للبحث "{search}"</p>
                </div>
              ) : (
                <div className="p-1">
                  {groupedProducts.map(([category, items]) => (
                    <div key={category} className="mb-2">
                      <div className={cn(
                        "sticky top-0 px-2 py-1.5 text-xs font-semibold rounded flex items-center justify-between",
                        CATEGORY_COLORS[category] || "bg-gray-100 text-gray-700"
                      )}>
                        <span>{category}</span>
                        <Badge variant="secondary" className="text-xs h-5">
                          {items.length}
                        </Badge>
                      </div>
                      {items.map(product => {
                        const flatIndex = flatList.findIndex(p => p.id === product.id);
                        const isHighlighted = flatIndex === highlightedIndex;
                        const isSelected = String(product.id) === value;

                        return (
                          <div
                            key={product.id}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-all",
                              isHighlighted && "bg-primary/10",
                              isSelected && "bg-primary/20",
                              !isHighlighted && !isSelected && "hover:bg-muted/50"
                            )}
                            onClick={() => handleSelect(product)}
                            onMouseEnter={() => setHighlightedIndex(flatIndex)}
                            data-testid={`product-option-${product.id}`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && <Check className="w-4 h-4 text-primary" />}
                              <span className={cn("text-sm", isSelected && "font-medium")}>
                                {product.name}
                              </span>
                              {product.sku && (
                                <code className="text-xs bg-muted px-1 py-0.5 rounded text-muted-foreground">
                                  {product.sku}
                                </code>
                              )}
                            </div>
                            {showPrice && (
                              <div className="flex items-center gap-2 text-xs">
                                {product.priceExclVat && (
                                  <span className="text-muted-foreground">
                                    {product.priceExclVat.toFixed(2)}
                                  </span>
                                )}
                                {product.basePrice && (
                                  <Badge variant="outline" className="font-medium">
                                    {product.basePrice.toFixed(2)} ر.س
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
              <span>{filteredProducts.length} منتج</span>
              <span>{groupedProducts.length} فئة</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
