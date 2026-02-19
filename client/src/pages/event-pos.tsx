import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  Receipt, Search, Settings, Package, Printer,
  X, Check, Store, CalendarDays,
  Sparkles, TrendingUp, Hash, Clock, Loader2,
  RotateCcw, ChevronLeft, ChevronRight, ListOrdered
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

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" dir="rtl">
      {/* Top Bar - Compact */}
      <div className="bg-gradient-to-l from-orange-500 to-amber-500 px-6 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white" data-testid="text-pos-title">
              نقطة البيع - إيفنت موسمي
            </h1>
            <p className="text-[10px] text-white/70 flex items-center gap-1">
              <Store className="w-3 h-3" />
              {(user as any)?.fullName || user?.username}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {todaySummary && (
            <div className="flex gap-2">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-1.5 text-center min-w-[80px]">
                <div className="text-[9px] text-white/60">المبيعات</div>
                <div className="text-sm font-bold text-white">{(todaySummary.totalSales || 0).toFixed(0)} <span className="text-[9px]">ر.س</span></div>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-1.5 text-center min-w-[60px]">
                <div className="text-[9px] text-white/60">الفواتير</div>
                <div className="text-sm font-bold text-white">{todaySummary.totalTransactions || 0}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowHistory(true)}
            className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center hover:bg-white/25 transition-colors active:scale-95"
            title="سجل المبيعات"
            data-testid="button-history"
          >
            <ListOrdered className="w-5 h-5 text-white" />
          </button>
          <a
            href="/event-pos-settings"
            className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center hover:bg-white/25 transition-colors active:scale-95"
            title="إعدادات نقطة البيع"
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5 text-white" />
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="max-w-6xl mx-auto h-full flex flex-row-reverse gap-4 overflow-hidden">
        {/* Products Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-200">
          {/* Search + Categories */}
          <div className="px-4 py-3 space-y-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="ابحث عن منتج..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-11 bg-gray-50 border-gray-200 h-12 text-base rounded-xl"
                data-testid="input-search-product"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center" data-testid="button-clear-search">
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                    selectedCategory === "all"
                      ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  data-testid="category-all"
                >
                  الكل ({filteredProducts.length})
                </button>
                {categories.map(cat => {
                  const count = filteredProducts.filter((bp: BranchProductWithDetails) => bp.product?.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                        selectedCategory === cat
                          ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      data-testid={`category-${cat}`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Products Grid - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            {productsLoading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin ml-2" />
                <span className="text-lg">جاري التحميل...</span>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center">
                  <Package className="w-12 h-12 text-gray-300" />
                </div>
                <p className="text-lg font-medium">لا توجد أصناف</p>
                <a href="/event-pos-settings" className="text-sm text-orange-600 hover:text-orange-700 underline font-medium">
                  اذهب للإعدادات لإضافة أصناف
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {displayProducts.map((bp: BranchProductWithDetails) => {
                  const price = bp.priceOverride ?? bp.product?.basePrice ?? 0;
                  const inCart = cart.find(c => c.productId === bp.productId);
                  return (
                    <button
                      key={bp.id}
                      onClick={() => addToCart(bp)}
                      className={`relative bg-white rounded-2xl p-4 text-center border-2 transition-all active:scale-[0.95] select-none touch-manipulation ${
                        inCart 
                          ? "border-orange-400 bg-orange-50/60 shadow-lg shadow-orange-100/50 ring-2 ring-orange-200" 
                          : "border-gray-100 hover:border-orange-200 hover:shadow-md"
                      }`}
                      data-testid={`product-card-${bp.productId}`}
                    >
                      {inCart && (
                        <div className="absolute -top-3 -left-3 w-9 h-9 bg-orange-500 text-white rounded-full text-sm flex items-center justify-center font-bold shadow-lg ring-2 ring-white">
                          {inCart.quantity}
                        </div>
                      )}
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Package className="w-7 h-7 text-orange-400" />
                      </div>
                      <div className="text-sm font-bold text-gray-800 mb-1 truncate leading-tight">{bp.product?.name}</div>
                      <div className="text-xs text-gray-400 mb-2">{bp.product?.category}</div>
                      <div className="bg-orange-50 rounded-xl py-2 px-3">
                        <span className="text-orange-600 font-black text-lg">{price.toFixed(2)}</span>
                        <span className="text-xs text-orange-400 mr-1">ر.س</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar - Fixed width */}
        <div className="w-[320px] lg:w-[350px] bg-white flex flex-col rounded-2xl shadow-sm border border-gray-200 shrink-0 overflow-hidden">
          {/* Cart Header */}
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between shrink-0">
            <h2 className="font-bold text-base flex items-center gap-2 text-gray-700">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              السلة
              {cartItemsCount > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">{cartItemsCount}</span>
              )}
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-red-400 hover:text-red-600 text-sm font-medium flex items-center gap-1 transition-colors active:scale-95 px-3 py-1.5 rounded-lg hover:bg-red-50" data-testid="button-clear-cart">
                <Trash2 className="w-4 h-4" />
                مسح الكل
              </button>
            )}
          </div>

          {/* Cart Items - Scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <ShoppingCart className="w-16 h-16 mb-3 opacity-40" />
                <p className="text-base font-medium">السلة فارغة</p>
                <p className="text-sm text-gray-300 mt-1">اضغط على المنتج لإضافته</p>
              </div>
            ) : cart.map(item => (
              <div key={item.productId} className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3" data-testid={`cart-item-${item.productId}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800 truncate">{item.productName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.unitPrice.toFixed(2)} ر.س × {item.quantity}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => updateQuantity(item.productId, -1)} 
                    className="w-10 h-10 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors active:scale-90 touch-manipulation" 
                    data-testid={`button-decrease-${item.productId}`}
                  >
                    <Minus className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="w-10 text-center text-base font-black text-gray-800">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.productId, 1)} 
                    className="w-10 h-10 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-green-50 hover:border-green-300 transition-colors active:scale-90 touch-manipulation" 
                    data-testid={`button-increase-${item.productId}`}
                  >
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                  <button 
                    onClick={() => removeFromCart(item.productId)} 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors active:scale-90 touch-manipulation mr-1" 
                    data-testid={`button-remove-${item.productId}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-sm font-black text-orange-600 w-16 text-left whitespace-nowrap">
                  {(item.unitPrice * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Cart Footer - Totals & Actions */}
          <div className="border-t bg-white p-4 space-y-3 shrink-0">
            <div className="flex justify-between text-sm text-gray-500">
              <span>المجموع بدون ضريبة</span>
              <span>{cartTotal.subtotal.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>ضريبة القيمة المضافة (15%)</span>
              <span>{cartTotal.vat.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-xl font-black border-t pt-3">
              <span className="text-gray-800">الإجمالي</span>
              <span className="text-orange-600" data-testid="text-cart-total">{cartTotal.total.toFixed(2)} ر.س</span>
            </div>

            {/* Payment Method - Large Touch Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                  paymentMethod === "cash"
                    ? "bg-green-500 text-white shadow-lg shadow-green-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                data-testid="button-payment-cash"
              >
                <Banknote className="w-6 h-6" />
                نقد
              </button>
              <button
                onClick={() => setPaymentMethod("network")}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                  paymentMethod === "network"
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                data-testid="button-payment-network"
              >
                <CreditCard className="w-6 h-6" />
                شبكة
              </button>
            </div>

            {/* Checkout Button - Extra Large */}
            <button
              className="w-full bg-gradient-to-l from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-black text-lg py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-green-200/50 disabled:shadow-none active:scale-[0.97] touch-manipulation"
              disabled={cart.length === 0 || createSaleMutation.isPending}
              onClick={handleCheckout}
              data-testid="button-checkout"
            >
              {createSaleMutation.isPending ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> جاري المعالجة...</>
              ) : (
                <><Receipt className="w-6 h-6" /> إتمام البيع {cartTotal.total > 0 && `- ${cartTotal.total.toFixed(2)} ر.س`}</>
              )}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden" dir="rtl">
          <div className="bg-gradient-to-l from-green-600 to-emerald-500 p-5">
            <DialogTitle className="flex items-center gap-3 text-white text-lg">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              إتمام البيع
            </DialogTitle>
          </div>
          <div className="p-5 space-y-5">
            <div className="bg-gradient-to-l from-orange-50 to-amber-50 rounded-2xl p-6 text-center border border-orange-100">
              <div className="text-sm text-gray-500 mb-2">الإجمالي المطلوب</div>
              <div className="text-4xl font-black text-orange-600">{cartTotal.total.toFixed(2)} <span className="text-lg">ر.س</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                  paymentMethod === "cash" ? "bg-green-500 text-white shadow-lg" : "bg-gray-100 text-gray-600"
                }`}
                data-testid="button-checkout-cash"
              >
                <Banknote className="w-6 h-6" /> نقد
              </button>
              <button
                onClick={() => setPaymentMethod("network")}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 touch-manipulation ${
                  paymentMethod === "network" ? "bg-blue-500 text-white shadow-lg" : "bg-gray-100 text-gray-600"
                }`}
                data-testid="button-checkout-network"
              >
                <CreditCard className="w-6 h-6" /> شبكة
              </button>
            </div>
            {paymentMethod === "cash" && (
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-600">المبلغ المدفوع</label>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  className="text-2xl text-center font-black h-16 rounded-2xl border-2"
                  autoFocus
                  data-testid="input-amount-paid"
                />
                {changeAmount > 0 && (
                  <div className="bg-green-50 rounded-2xl p-4 text-center border-2 border-green-200">
                    <div className="text-xs text-green-600 mb-1">الباقي</div>
                    <div className="text-3xl font-black text-green-700">{changeAmount.toFixed(2)} ر.س</div>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50, 100, 200, 500].map(v => (
                    <button 
                      key={v} 
                      onClick={() => setAmountPaid(String(v))} 
                      className="py-3 rounded-xl text-base font-bold bg-gray-100 hover:bg-orange-100 hover:text-orange-700 transition-colors active:scale-95 touch-manipulation"
                      data-testid={`button-quick-amount-${v}`}
                    >
                      {v}
                    </button>
                  ))}
                  <button 
                    onClick={() => setAmountPaid(String(cartTotal.total))} 
                    className="py-3 rounded-xl text-sm font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors active:scale-95 touch-manipulation"
                    data-testid="button-quick-amount-exact"
                  >
                    مطابق
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="p-5 pt-0 flex gap-3">
            <Button variant="outline" onClick={() => setShowCheckout(false)} className="rounded-2xl h-14 text-base px-6">إلغاء</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 flex-1 rounded-2xl h-14 text-lg font-bold active:scale-[0.97] touch-manipulation"
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
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-orange-600" />
              </div>
              الفاتورة الضريبية المبسطة
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div ref={receiptRef} className="bg-white p-5 text-sm border rounded-xl" style={{ fontFamily: "Cairo, sans-serif" }}>
              <div className="text-center border-b pb-3 mb-3">
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
            <Button variant="outline" onClick={() => setShowReceipt(false)} className="rounded-xl h-12 text-base">إغلاق</Button>
            <Button onClick={() => handlePrint()} className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 h-12 text-base active:scale-95 touch-manipulation" data-testid="button-print-receipt">
              <Printer className="w-5 h-5" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] overflow-hidden flex flex-col p-0" dir="rtl">
          <div className="bg-gradient-to-l from-orange-500 to-amber-500 p-5 shrink-0">
            <DialogTitle className="flex items-center gap-3 text-white text-lg">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              سجل مبيعات اليوم
            </DialogTitle>
          </div>
          
          {todaySummary && (
            <div className="grid grid-cols-4 gap-2 p-4 shrink-0">
              <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <div className="text-lg font-black text-green-700">{(todaySummary.totalSales || 0).toFixed(0)}</div>
                <div className="text-[10px] text-green-600">المبيعات (ر.س)</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                <Hash className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <div className="text-lg font-black text-blue-700">{todaySummary.totalTransactions || 0}</div>
                <div className="text-[10px] text-blue-600">الفواتير</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                <Banknote className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <div className="text-lg font-black text-amber-700">{(todaySummary.cashTotal || 0).toFixed(0)}</div>
                <div className="text-[10px] text-amber-600">نقد (ر.س)</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                <CreditCard className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <div className="text-lg font-black text-purple-700">{(todaySummary.networkTotal || 0).toFixed(0)}</div>
                <div className="text-[10px] text-purple-600">شبكة (ر.س)</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y">
            {todaySales.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-base">لا توجد مبيعات اليوم</p>
              </div>
            ) : todaySales.map((sale: any) => (
              <div key={sale.id} className="px-5 py-3.5 hover:bg-orange-50/50 flex items-center justify-between transition-colors" data-testid={`sale-row-${sale.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-800">{sale.invoiceNumber}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {sale.saleTime}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    sale.paymentMethod === "cash" 
                      ? "bg-green-100 text-green-700" 
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {sale.paymentMethod === "cash" ? "نقد" : "شبكة"}
                  </span>
                  <span className="font-black text-base text-orange-600">{(sale.totalAmount || 0).toFixed(2)} <span className="text-xs text-orange-400">ر.س</span></span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
