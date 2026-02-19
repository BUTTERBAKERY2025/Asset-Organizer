import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  Receipt, Search, Settings, Package, Printer,
  X, Check, Store, CalendarDays,
  Sparkles, TrendingUp, Hash, Clock, Loader2,
  ListOrdered, Zap, Coffee
} from "lucide-react";
import { useReactToPrint } from "react-to-print";

const EVENT_BRANCH_ID = "EVENT-BB";

interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  vatRate: number;
  quantity: number;
}

interface BranchProductWithDetails {
  id: number;
  branchId: string;
  productId: number;
  isActive: boolean;
  priceOverride: number | null;
  sortOrder: number | null;
  product?: {
    id: number;
    name: string;
    category: string;
    basePrice: number | null;
    vatRate: number | null;
    unit: string | null;
  };
}

const categoryIcons: Record<string, any> = {
  "حلويات": Coffee,
  "مشروبات": Coffee,
  "معجنات": Package,
  "كيك": Coffee,
};

export default function EventPosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: branchProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/pos/branch-products", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/branch-products/${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const { data: invoiceSettings } = useQuery({
    queryKey: ["/api/pos/invoice-settings", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/invoice-settings/${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const { data: todaySales = [] } = useQuery({
    queryKey: ["/api/pos/sales", EVENT_BRANCH_ID, new Date().toISOString().slice(0, 10)],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("GET", `/api/pos/sales/${EVENT_BRANCH_ID}?dateFrom=${today}&dateTo=${today}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: todaySummary } = useQuery({
    queryKey: ["/api/pos/summary", EVENT_BRANCH_ID],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("GET", `/api/pos/summary/${EVENT_BRANCH_ID}/${today}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filteredProducts = useMemo(() => {
    const activeProducts = (branchProducts as BranchProductWithDetails[]).filter((bp: BranchProductWithDetails) => bp.isActive && bp.product);
    if (!searchQuery.trim()) return activeProducts;
    const q = searchQuery.toLowerCase();
    return activeProducts.filter((bp: BranchProductWithDetails) => 
      bp.product?.name?.toLowerCase().includes(q) || 
      bp.product?.category?.toLowerCase().includes(q)
    );
  }, [branchProducts, searchQuery]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    (branchProducts as BranchProductWithDetails[]).forEach((bp: BranchProductWithDetails) => {
      if (bp.product?.category) cats.add(bp.product.category);
    });
    return Array.from(cats);
  }, [branchProducts]);

  const displayProducts = useMemo(() => {
    if (selectedCategory === "all") return filteredProducts;
    return filteredProducts.filter((bp: BranchProductWithDetails) => bp.product?.category === selectedCategory);
  }, [filteredProducts, selectedCategory]);

  const cartTotal = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    cart.forEach(item => {
      const priceExclVat = item.unitPrice / (1 + item.vatRate);
      const itemSubtotal = priceExclVat * item.quantity;
      const itemVat = (item.unitPrice - priceExclVat) * item.quantity;
      subtotal += itemSubtotal;
      vatTotal += itemVat;
    });
    return { subtotal: Math.round(subtotal * 100) / 100, vat: Math.round(vatTotal * 100) / 100, total: Math.round((subtotal + vatTotal) * 100) / 100 };
  }, [cart]);

  const cartItemsCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  const changeAmount = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, Math.round((paid - cartTotal.total) * 100) / 100);
  }, [amountPaid, cartTotal.total]);

  const addToCart = useCallback((bp: BranchProductWithDetails) => {
    if (!bp.product) return;
    const price = bp.priceOverride ?? bp.product.basePrice ?? 0;
    const vatRate = bp.product.vatRate ?? 0.15;
    
    setCart(prev => {
      const existing = prev.find(c => c.productId === bp.productId);
      if (existing) {
        return prev.map(c => c.productId === bp.productId ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { productId: bp.productId, productName: bp.product!.name, unitPrice: price, vatRate, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map(c => {
        if (c.productId === productId) {
          const newQty = c.quantity + delta;
          return newQty <= 0 ? null : { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(c => c.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setAmountPaid("");
    setPaymentMethod("cash");
  }, []);

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const saleData = {
        branchId: EVENT_BRANCH_ID,
        cashierId: user?.id || "",
        cashierName: (user as any)?.fullName || user?.username || "",
        saleDate: now.toISOString().slice(0, 10),
        saleTime: now.toTimeString().slice(0, 8),
        subtotal: cartTotal.subtotal,
        vatAmount: cartTotal.vat,
        totalAmount: cartTotal.total,
        paymentMethod,
        amountPaid: paymentMethod === "cash" ? parseFloat(amountPaid) || cartTotal.total : cartTotal.total,
        changeAmount: paymentMethod === "cash" ? changeAmount : 0,
        status: "completed",
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          vatAmount: Math.round((item.unitPrice - item.unitPrice / (1 + item.vatRate)) * item.quantity * 100) / 100,
          totalPrice: Math.round(item.unitPrice * item.quantity * 100) / 100,
        })),
      };
      const res = await apiRequest("POST", "/api/pos/sales", saleData);
      return res.json();
    },
    onSuccess: (data: any) => {
      setLastSale({ ...data, items: cart.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        totalPrice: Math.round(item.unitPrice * item.quantity * 100) / 100,
      })), paymentMethod, amountPaid: parseFloat(amountPaid) || cartTotal.total, changeAmount });
      setShowCheckout(false);
      setShowReceipt(true);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/pos/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos/summary"] });
      toast({ title: "تم إتمام البيع بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في إتمام البيع", description: err?.message, variant: "destructive" });
    },
  });

  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (paymentMethod === "cash") {
      setAmountPaid(String(cartTotal.total));
    }
    setShowCheckout(true);
  };

  const handleCompleteSale = () => {
    if (paymentMethod === "cash" && (parseFloat(amountPaid) || 0) < cartTotal.total) {
      toast({ title: "المبلغ المدفوع أقل من الإجمالي", variant: "destructive" });
      return;
    }
    createSaleMutation.mutate();
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="h-[100dvh] flex flex-col bg-[#f0f2f5] overflow-hidden select-none" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 px-5 py-2 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900 leading-tight" data-testid="text-pos-title">إيفنت موسمي</h1>
              <p className="text-[10px] text-gray-400 leading-tight">{(user as any)?.fullName || user?.username}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-[11px] text-gray-400">
            <span>{dateStr}</span>
            <span className="mx-1.5">|</span>
            <span className="font-mono font-bold text-gray-600">{timeStr}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {todaySummary && (
            <>
              <div className="flex items-center gap-1.5 bg-green-50 text-green-700 rounded-lg px-3 py-1.5 border border-green-200">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{(todaySummary.totalSales || 0).toFixed(0)}</span>
                <span className="text-[10px] text-green-500">ر.س</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 border border-blue-200">
                <Receipt className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{todaySummary.totalTransactions || 0}</span>
                <span className="text-[10px] text-blue-500">فاتورة</span>
              </div>
            </>
          )}
          <div className="h-8 w-px bg-gray-200 mx-1" />
          <button
            onClick={() => setShowHistory(true)}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90 touch-manipulation"
            title="سجل المبيعات"
            data-testid="button-history"
          >
            <ListOrdered className="w-4.5 h-4.5 text-gray-600" />
          </button>
          <a
            href="/event-pos-settings"
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90 touch-manipulation"
            title="الإعدادات"
            data-testid="button-settings"
          >
            <Settings className="w-4.5 h-4.5 text-gray-600" />
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden px-6 py-4">
      <div className="max-w-6xl mx-auto h-full flex gap-4 overflow-hidden">
        {/* RIGHT: Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-200">
          {/* Search Bar */}
          <div className="px-5 pt-4 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="ابحث عن منتج بالاسم أو الفئة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-12 pl-10 bg-white border-gray-200 h-[52px] text-[15px] rounded-2xl shadow-sm focus:shadow-md transition-shadow"
                data-testid="input-search-product"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute left-4 top-1/2 -translate-y-1/2 w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors" data-testid="button-clear-search">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {/* Category Chips */}
          {categories.length > 0 && (
            <div className="px-5 pb-3 shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation border ${
                    selectedCategory === "all"
                      ? "bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-900/20"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid="category-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  الكل
                  <span className={`text-[11px] font-bold ${selectedCategory === "all" ? "text-gray-400" : "text-gray-400"}`}>
                    {filteredProducts.length}
                  </span>
                </button>
                {categories.map(cat => {
                  const count = filteredProducts.filter((bp: BranchProductWithDetails) => bp.product?.category === cat).length;
                  const IconComp = categoryIcons[cat] || Package;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation border ${
                        selectedCategory === cat
                          ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                          : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                      }`}
                      data-testid={`category-${cat}`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      {cat}
                      <span className={`text-[11px] font-bold ${selectedCategory === cat ? "text-orange-200" : "text-gray-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {productsLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  </div>
                  <p className="text-base text-gray-400 font-medium">جاري تحميل المنتجات...</p>
                </div>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-28 h-28 bg-gray-100 rounded-[2rem] flex items-center justify-center mb-5">
                  <Package className="w-14 h-14 text-gray-300" />
                </div>
                <p className="text-xl font-bold text-gray-400 mb-2">لا توجد أصناف</p>
                <p className="text-sm text-gray-300 mb-4">أضف منتجات من صفحة الإعدادات</p>
                <a href="/event-pos-settings" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors active:scale-95 touch-manipulation" data-testid="link-add-products">
                  <Settings className="w-4 h-4" />
                  إعدادات نقطة البيع
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayProducts.map((bp: BranchProductWithDetails) => {
                  const price = bp.priceOverride ?? bp.product?.basePrice ?? 0;
                  const inCart = cart.find(c => c.productId === bp.productId);
                  return (
                    <button
                      key={bp.id}
                      onClick={() => addToCart(bp)}
                      className={`group relative bg-white rounded-[20px] p-5 text-center transition-all duration-200 active:scale-[0.96] select-none touch-manipulation ${
                        inCart 
                          ? "ring-[3px] ring-orange-400 shadow-xl shadow-orange-100/60" 
                          : "shadow-sm hover:shadow-lg border border-gray-100 hover:border-orange-200"
                      }`}
                      data-testid={`product-card-${bp.productId}`}
                    >
                      {inCart && (
                        <div className="absolute -top-2 -left-2 min-w-[32px] h-8 bg-orange-500 text-white rounded-xl text-sm px-2 flex items-center justify-center font-black shadow-lg shadow-orange-300/50 z-10">
                          {inCart.quantity}
                        </div>
                      )}
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors ${
                        inCart 
                          ? "bg-orange-500 shadow-md shadow-orange-200" 
                          : "bg-gradient-to-br from-orange-50 to-amber-50 group-hover:from-orange-100 group-hover:to-amber-100"
                      }`}>
                        <Package className={`w-8 h-8 ${inCart ? "text-white" : "text-orange-400"}`} />
                      </div>
                      <div className="text-[15px] font-bold text-gray-800 mb-1 line-clamp-2 leading-snug min-h-[40px] flex items-center justify-center">
                        {bp.product?.name}
                      </div>
                      <div className="text-[11px] text-gray-400 mb-3 font-medium">{bp.product?.category}</div>
                      <div className={`rounded-xl py-2.5 px-4 transition-colors ${
                        inCart ? "bg-orange-50 border border-orange-200" : "bg-gray-50"
                      }`}>
                        <span className="text-orange-600 font-black text-xl">{price.toFixed(2)}</span>
                        <span className="text-[11px] text-orange-400 mr-1 font-bold">ر.س</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LEFT: Cart Panel */}
        <div className="w-[340px] bg-white flex flex-col rounded-2xl shadow-sm border border-gray-200 shrink-0 overflow-hidden">
          {/* Cart Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="font-black text-[15px] text-gray-800 leading-tight">الطلب الحالي</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {cartItemsCount > 0 ? `${cartItemsCount} صنف` : "لا توجد أصناف"}
                </p>
              </div>
            </div>
            {cart.length > 0 && (
              <button 
                onClick={clearCart} 
                className="flex items-center gap-1 text-[12px] font-bold text-red-400 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors active:scale-95 touch-manipulation" 
                data-testid="button-clear-cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                مسح
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6">
                <div className="w-20 h-20 bg-gray-50 rounded-[1.5rem] flex items-center justify-center mb-4">
                  <ShoppingCart className="w-10 h-10 text-gray-200" />
                </div>
                <p className="text-[15px] font-bold text-gray-300 mb-1">السلة فارغة</p>
                <p className="text-[12px] text-gray-300 text-center">اضغط على أي منتج لإضافته للطلب</p>
              </div>
            ) : (
              <div className="p-3 space-y-1.5">
                {cart.map((item, idx) => (
                  <div 
                    key={item.productId} 
                    className="bg-gray-50/80 rounded-2xl p-3.5 transition-all" 
                    data-testid={`cart-item-${item.productId}`}
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex-1 min-w-0 ml-2">
                        <div className="text-[13px] font-bold text-gray-800 truncate leading-tight">{item.productName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{item.unitPrice.toFixed(2)} ر.س / وحدة</div>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.productId)} 
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 touch-manipulation shrink-0" 
                        data-testid={`button-remove-${item.productId}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <button 
                          onClick={() => updateQuantity(item.productId, -1)} 
                          className="w-10 h-9 flex items-center justify-center hover:bg-red-50 transition-colors active:scale-90 touch-manipulation border-l border-gray-200" 
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="w-4 h-4 text-gray-500" />
                        </button>
                        <span className="w-10 text-center text-[14px] font-black text-gray-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.productId, 1)} 
                          className="w-10 h-9 flex items-center justify-center hover:bg-green-50 transition-colors active:scale-90 touch-manipulation border-r border-gray-200" 
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      <div className="text-[15px] font-black text-gray-800">
                        {(item.unitPrice * item.quantity).toFixed(2)} <span className="text-[11px] font-bold text-gray-400">ر.س</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="border-t border-gray-100 shrink-0">
            {/* Totals */}
            <div className="px-5 py-3 space-y-1.5 bg-gray-50/50">
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-400">المجموع بدون ضريبة</span>
                <span className="text-gray-500 font-bold">{cartTotal.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-400">ضريبة القيمة المضافة 15%</span>
                <span className="text-gray-500 font-bold">{cartTotal.vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-[15px] font-black text-gray-800">الإجمالي</span>
                <span className="text-[22px] font-black text-orange-600" data-testid="text-cart-total">
                  {cartTotal.total.toFixed(2)} <span className="text-[12px]">ر.س</span>
                </span>
              </div>
            </div>

            {/* Payment + Checkout */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold transition-all active:scale-95 touch-manipulation ${
                    paymentMethod === "cash"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/25"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  data-testid="button-payment-cash"
                >
                  <Banknote className="w-5 h-5" />
                  نقد
                </button>
                <button
                  onClick={() => setPaymentMethod("network")}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold transition-all active:scale-95 touch-manipulation ${
                    paymentMethod === "network"
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  data-testid="button-payment-network"
                >
                  <CreditCard className="w-5 h-5" />
                  شبكة
                </button>
              </div>

              <button
                className="w-full bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-400 text-white font-black text-[16px] py-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-orange-500/20 disabled:shadow-none active:scale-[0.97] touch-manipulation"
                disabled={cart.length === 0 || createSaleMutation.isPending}
                onClick={handleCheckout}
                data-testid="button-checkout"
              >
                {createSaleMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> جاري المعالجة...</>
                ) : (
                  <><Receipt className="w-5 h-5" /> إتمام الطلب {cartTotal.total > 0 && <span className="bg-white/20 px-3 py-0.5 rounded-lg text-[13px]">{cartTotal.total.toFixed(2)} ر.س</span>}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-[420px] rounded-3xl p-0 overflow-hidden" dir="rtl">
          <div className="bg-gradient-to-l from-green-600 to-emerald-500 p-6">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              إتمام البيع
            </DialogTitle>
          </div>
          <div className="p-6 space-y-5">
            <div className="bg-gradient-to-l from-orange-50 to-amber-50 rounded-2xl p-6 text-center border border-orange-100">
              <div className="text-sm text-gray-500 mb-2">الإجمالي المطلوب</div>
              <div className="text-[42px] font-black text-orange-600 leading-tight">{cartTotal.total.toFixed(2)} <span className="text-lg">ر.س</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                  paymentMethod === "cash" ? "bg-green-500 text-white shadow-lg shadow-green-500/30" : "bg-gray-100 text-gray-600"
                }`}
                data-testid="button-checkout-cash"
              >
                <Banknote className="w-6 h-6" /> نقد
              </button>
              <button
                onClick={() => setPaymentMethod("network")}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                  paymentMethod === "network" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "bg-gray-100 text-gray-600"
                }`}
                data-testid="button-checkout-network"
              >
                <CreditCard className="w-6 h-6" /> شبكة
              </button>
            </div>
            {paymentMethod === "cash" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">المبلغ المدفوع</label>
                  <Input
                    type="number"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    className="text-3xl text-center font-black h-[64px] rounded-2xl border-2 border-gray-200 focus:border-green-400"
                    autoFocus
                    data-testid="input-amount-paid"
                  />
                </div>
                {changeAmount > 0 && (
                  <div className="bg-green-50 rounded-2xl p-4 text-center border-2 border-green-200">
                    <div className="text-xs text-green-600 mb-1 font-bold">الباقي</div>
                    <div className="text-3xl font-black text-green-700">{changeAmount.toFixed(2)} ر.س</div>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50, 100, 200, 500].map(v => (
                    <button 
                      key={v} 
                      onClick={() => setAmountPaid(String(v))} 
                      className="py-3.5 rounded-xl text-[15px] font-bold bg-gray-100 hover:bg-orange-100 hover:text-orange-700 transition-colors active:scale-95 touch-manipulation"
                      data-testid={`button-quick-amount-${v}`}
                    >
                      {v}
                    </button>
                  ))}
                  <button 
                    onClick={() => setAmountPaid(String(cartTotal.total))} 
                    className="py-3.5 rounded-xl text-[13px] font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors active:scale-95 touch-manipulation"
                    data-testid="button-quick-amount-exact"
                  >
                    مطابق
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <Button variant="outline" onClick={() => setShowCheckout(false)} className="rounded-2xl h-14 text-[15px] px-6 font-bold">إلغاء</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 flex-1 rounded-2xl h-14 text-lg font-black active:scale-[0.97] touch-manipulation shadow-lg shadow-green-600/20"
              onClick={handleCompleteSale}
              disabled={createSaleMutation.isPending}
              data-testid="button-complete-sale"
            >
              {createSaleMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Check className="w-5 h-5 ml-2" />}
              {createSaleMutation.isPending ? "جاري..." : "تأكيد البيع"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
              الفاتورة الضريبية المبسطة
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div ref={receiptRef} className="bg-white p-5 text-sm border rounded-xl" style={{ fontFamily: "Cairo, sans-serif" }}>
              <div className="text-center border-b pb-3 mb-3">
                {invoiceSettings?.logoUrl && (
                  <img
                    src={invoiceSettings.logoUrl}
                    alt="شعار"
                    className="max-h-14 max-w-[140px] object-contain mx-auto mb-2"
                    data-testid="img-receipt-logo"
                  />
                )}
                <h3 className="font-bold text-base">{invoiceSettings?.businessName || "باتر بيكري"}</h3>
                {invoiceSettings?.businessNameEn && <p className="text-[10px] text-gray-500">{invoiceSettings.businessNameEn}</p>}
                {invoiceSettings?.address && <p className="text-[10px] text-gray-600">{invoiceSettings.address}</p>}
                {invoiceSettings?.city && <p className="text-[10px] text-gray-600">{invoiceSettings.city}</p>}
                {invoiceSettings?.phone && <p className="text-[10px] text-gray-600">هاتف: {invoiceSettings.phone}</p>}
                {invoiceSettings?.vatNumber && <p className="text-[10px] font-medium mt-1">الرقم الضريبي: {invoiceSettings.vatNumber}</p>}
                {invoiceSettings?.crNumber && <p className="text-[10px]">السجل التجاري: {invoiceSettings.crNumber}</p>}
              </div>
              <div className="text-center mb-3">
                <p className="font-bold text-sm">فاتورة ضريبية مبسطة</p>
                <p className="text-[10px] text-gray-600">رقم الفاتورة: {lastSale.invoiceNumber}</p>
                <p className="text-[10px] text-gray-600">{lastSale.saleDate} - {lastSale.saleTime}</p>
              </div>
              <table className="w-full text-[10px] mb-3">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-1.5 font-semibold">المنتج</th>
                    <th className="text-center py-1.5 font-semibold">الكمية</th>
                    <th className="text-center py-1.5 font-semibold">السعر</th>
                    <th className="text-left py-1.5 font-semibold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSale.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-dashed border-gray-100">
                      <td className="py-1.5">{item.productName}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-center">{item.unitPrice?.toFixed(2)}</td>
                      <td className="text-left">{item.totalPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t pt-2 space-y-1 text-[10px]">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع بدون ضريبة</span>
                  <span>{lastSale.subtotal?.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>ضريبة القيمة المضافة (15%)</span>
                  <span>{lastSale.vatAmount?.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between font-bold text-xs border-t pt-1.5">
                  <span>الإجمالي شامل الضريبة</span>
                  <span>{lastSale.totalAmount?.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-gray-500 pt-1">
                  <span>طريقة الدفع</span>
                  <span>{lastSale.paymentMethod === "cash" ? "نقد" : "شبكة"}</span>
                </div>
                {lastSale.paymentMethod === "cash" && (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>المبلغ المدفوع</span>
                      <span>{lastSale.amountPaid?.toFixed(2)} ر.س</span>
                    </div>
                    {lastSale.changeAmount > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>الباقي</span>
                        <span>{lastSale.changeAmount?.toFixed(2)} ر.س</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="text-center mt-4 pt-3 border-t">
                <p className="text-[10px] text-gray-400">{invoiceSettings?.footerText || "شكراً لزيارتكم"}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)} className="rounded-xl h-12 text-[15px] font-bold">إغلاق</Button>
            <Button onClick={() => handlePrint()} className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 h-12 text-[15px] font-bold active:scale-95 touch-manipulation" data-testid="button-print-receipt">
              <Printer className="w-5 h-5" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] overflow-hidden flex flex-col p-0" dir="rtl">
          <div className="bg-gradient-to-l from-gray-900 to-gray-800 p-5 shrink-0">
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-black">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              سجل مبيعات اليوم
            </DialogTitle>
          </div>
          
          {todaySummary && (
            <div className="grid grid-cols-4 gap-2 p-4 shrink-0 bg-gray-50 border-b">
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{(todaySummary.totalSales || 0).toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-medium">المبيعات</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <Hash className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{todaySummary.totalTransactions || 0}</div>
                <div className="text-[10px] text-gray-400 font-medium">الفواتير</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <Banknote className="w-4 h-4 text-green-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{(todaySummary.cashTotal || 0).toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-medium">نقد</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <CreditCard className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <div className="text-base font-black text-gray-800">{(todaySummary.networkTotal || 0).toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-medium">شبكة</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {todaySales.length === 0 ? (
              <div className="p-16 text-center">
                <Receipt className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                <p className="text-base font-bold text-gray-400">لا توجد مبيعات اليوم</p>
              </div>
            ) : todaySales.map((sale: any) => (
              <div key={sale.id} className="px-5 py-3.5 hover:bg-gray-50 flex items-center justify-between transition-colors" data-testid={`sale-row-${sale.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-bold text-[13px] text-gray-800">{sale.invoiceNumber}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {sale.saleTime}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                    sale.paymentMethod === "cash" 
                      ? "bg-green-100 text-green-700" 
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {sale.paymentMethod === "cash" ? "نقد" : "شبكة"}
                  </span>
                  <span className="font-black text-[15px] text-gray-800">{(sale.totalAmount || 0).toFixed(2)} <span className="text-[11px] text-gray-400">ر.س</span></span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
