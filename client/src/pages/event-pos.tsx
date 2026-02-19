import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  Receipt, Search, Settings, Package, Printer,
  X, Check, Store, ChevronRight, CalendarDays,
  Sparkles, TrendingUp, Hash, Clock, Loader2
} from "lucide-react";
import { useReactToPrint } from "react-to-print";

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
  
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("pos");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    businessName: "باتر بيكري",
    businessNameEn: "Butter Bakery",
    vatNumber: "",
    crNumber: "",
    address: "",
    city: "",
    phone: "",
    footerText: "شكراً لزيارتكم",
    showQrCode: true,
    invoicePrefix: "EV",
  });
  const [showProductManager, setShowProductManager] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/branches");
      return res.json();
    },
  });

  const { data: branchProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/pos/branch-products", selectedBranch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/branch-products/${selectedBranch}`);
      return res.json();
    },
    enabled: !!selectedBranch,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/products");
      return res.json();
    },
  });

  const { data: invoiceSettings } = useQuery({
    queryKey: ["/api/pos/invoice-settings", selectedBranch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/invoice-settings/${selectedBranch}`);
      return res.json();
    },
    enabled: !!selectedBranch,
  });

  const { data: todaySales = [] } = useQuery({
    queryKey: ["/api/pos/sales", selectedBranch, new Date().toISOString().slice(0, 10)],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("GET", `/api/pos/sales/${selectedBranch}?dateFrom=${today}&dateTo=${today}`);
      return res.json();
    },
    enabled: !!selectedBranch,
    refetchInterval: 30000,
  });

  const { data: todaySummary } = useQuery({
    queryKey: ["/api/pos/summary", selectedBranch],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("GET", `/api/pos/summary/${selectedBranch}/${today}`);
      return res.json();
    },
    enabled: !!selectedBranch,
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

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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
        branchId: selectedBranch,
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

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pos/invoice-settings", { ...settingsForm, branchId: selectedBranch });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/invoice-settings"] });
      setShowSettings(false);
      toast({ title: "تم حفظ إعدادات الفاتورة" });
    },
  });

  const addBranchProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("POST", "/api/pos/branch-products", { branchId: selectedBranch, productId, isActive: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branch-products"] });
      toast({ title: "تمت إضافة المنتج" });
    },
  });

  const removeBranchProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pos/branch-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branch-products"] });
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

  if (!selectedBranch) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800" data-testid="text-pos-title">نقطة البيع - إيفنت موسمي</h1>
              <p className="text-sm text-gray-500">نظام نقاط البيع للفعاليات والمناسبات</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches?.map((b: any) => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className="group bg-white rounded-xl border-2 border-gray-100 p-5 text-right transition-all hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100/50 active:scale-[0.98]"
                data-testid={`branch-option-${b.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-orange-400 transition-colors" />
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <Store className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
                <h3 className="font-bold text-gray-800 text-base mb-1">{b.name}</h3>
                <p className="text-xs text-gray-400">{b.location || "اختر للبدء بالبيع"}</p>
              </button>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const branchName = branches?.find((b: any) => b.id === selectedBranch)?.name || selectedBranch;

  const availableToAdd = allProducts.filter((p: any) => 
    p.isActive === "true" && !branchProducts.some((bp: any) => bp.productId === p.id)
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-l from-orange-500 to-amber-500 rounded-2xl p-4 sm:p-5 mb-5 shadow-lg shadow-orange-200/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedBranch("")}
                className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
                data-testid="button-back"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  نقطة البيع - إيفنت موسمي
                </h1>
                <p className="text-xs text-white/70 mt-0.5">{branchName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {todaySummary && (
                <div className="flex-1 sm:flex-initial grid grid-cols-2 gap-2">
                  <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                    <div className="text-[10px] text-white/60">المبيعات</div>
                    <div className="text-sm font-bold text-white">{(todaySummary.totalSales || 0).toFixed(0)} <span className="text-[10px]">ر.س</span></div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                    <div className="text-[10px] text-white/60">الفواتير</div>
                    <div className="text-sm font-bold text-white">{todaySummary.totalTransactions || 0}</div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowProductManager(true)}
                className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center hover:bg-white/25 transition-colors"
                data-testid="button-manage-products"
              >
                <Package className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => {
                  if (invoiceSettings) {
                    setSettingsForm({
                      businessName: invoiceSettings.businessName || "باتر بيكري",
                      businessNameEn: invoiceSettings.businessNameEn || "",
                      vatNumber: invoiceSettings.vatNumber || "",
                      crNumber: invoiceSettings.crNumber || "",
                      address: invoiceSettings.address || "",
                      city: invoiceSettings.city || "",
                      phone: invoiceSettings.phone || "",
                      footerText: invoiceSettings.footerText || "شكراً لزيارتكم",
                      showQrCode: invoiceSettings.showQrCode ?? true,
                      invoicePrefix: invoiceSettings.invoicePrefix || "EV",
                    });
                  }
                  setShowSettings(true);
                }}
                className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center hover:bg-white/25 transition-colors"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-white border shadow-sm">
            <TabsTrigger value="pos" className="gap-1.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700" data-testid="tab-pos">
              <ShoppingCart className="w-3.5 h-3.5" />
              شاشة البيع
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700" data-testid="tab-history">
              <CalendarDays className="w-3.5 h-3.5" />
              سجل المبيعات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Products Area */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="ابحث عن منتج..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pr-10 bg-white border-gray-200 h-10 text-sm rounded-xl"
                      data-testid="input-search-product"
                    />
                  </div>
                </div>

                {categories.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSelectedCategory("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedCategory === "all"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600"
                      }`}
                      data-testid="category-all"
                    >
                      الكل
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedCategory === cat
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600"
                        }`}
                        data-testid={`category-${cat}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                <div className="min-h-[300px]">
                  {productsLoading ? (
                    <div className="flex items-center justify-center h-64 text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin ml-2" />
                      جاري التحميل...
                    </div>
                  ) : displayProducts.length === 0 ? (
                    <Card className="border-dashed border-2 border-gray-200">
                      <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium">لا توجد منتجات في هذا الفرع</p>
                        <Button variant="outline" size="sm" onClick={() => setShowProductManager(true)} className="mt-1 rounded-lg text-xs">
                          <Plus className="w-3 h-3 ml-1" />
                          إضافة منتجات
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {displayProducts.map((bp: BranchProductWithDetails) => {
                        const price = bp.priceOverride ?? bp.product?.basePrice ?? 0;
                        const inCart = cart.find(c => c.productId === bp.productId);
                        return (
                          <button
                            key={bp.id}
                            onClick={() => addToCart(bp)}
                            className={`relative bg-white rounded-xl p-3 text-center border-2 transition-all hover:shadow-md active:scale-[0.97] ${
                              inCart ? "border-orange-400 bg-orange-50/50 shadow-sm shadow-orange-100" : "border-gray-100 hover:border-orange-200"
                            }`}
                            data-testid={`product-card-${bp.productId}`}
                          >
                            {inCart && (
                              <div className="absolute -top-2.5 -left-2.5 w-7 h-7 bg-orange-500 text-white rounded-full text-xs flex items-center justify-center font-bold shadow-md">
                                {inCart.quantity}
                              </div>
                            )}
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <Package className="w-5 h-5 text-orange-400" />
                            </div>
                            <div className="text-xs font-semibold text-gray-800 mb-0.5 truncate leading-tight">{bp.product?.name}</div>
                            <div className="text-[10px] text-gray-400 mb-1.5">{bp.product?.category}</div>
                            <div className="bg-orange-50 rounded-md py-1 px-2">
                              <span className="text-orange-600 font-bold text-sm">{price.toFixed(2)}</span>
                              <span className="text-[10px] text-orange-400 mr-0.5">ر.س</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Cart Sidebar */}
              <div className="lg:col-span-1">
                <Card className="sticky top-4 border-gray-200 shadow-sm overflow-hidden rounded-2xl">
                  <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-bold text-sm flex items-center gap-2 text-gray-700">
                      <ShoppingCart className="w-4 h-4 text-orange-500" />
                      السلة
                      {cartItemsCount > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{cartItemsCount}</span>
                      )}
                    </h2>
                    {cart.length > 0 && (
                      <button onClick={clearCart} className="text-red-400 hover:text-red-600 text-[11px] font-medium flex items-center gap-0.5 transition-colors" data-testid="button-clear-cart">
                        <Trash2 className="w-3 h-3" />
                        مسح الكل
                      </button>
                    )}
                  </div>

                  <div className="max-h-[320px] overflow-y-auto p-2.5 space-y-1.5">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                        <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-xs">السلة فارغة</p>
                        <p className="text-[10px] text-gray-300 mt-1">اضغط على المنتج لإضافته</p>
                      </div>
                    ) : cart.map(item => (
                      <div key={item.productId} className="bg-gray-50 rounded-xl p-2.5 flex items-center gap-2" data-testid={`cart-item-${item.productId}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">{item.productName}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{item.unitPrice.toFixed(2)} ر.س × {item.quantity}</div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => updateQuantity(item.productId, -1)} className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors" data-testid={`button-decrease-${item.productId}`}>
                            <Minus className="w-3 h-3 text-gray-500" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, 1)} className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-green-50 hover:border-green-200 transition-colors" data-testid={`button-increase-${item.productId}`}>
                            <Plus className="w-3 h-3 text-gray-500" />
                          </button>
                          <button onClick={() => removeFromCart(item.productId)} className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mr-0.5" data-testid={`button-remove-${item.productId}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs font-bold text-orange-600 w-14 text-left whitespace-nowrap">
                          {(item.unitPrice * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cart Footer */}
                  <div className="border-t bg-white p-3 space-y-2">
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>المجموع بدون ضريبة</span>
                      <span>{cartTotal.subtotal.toFixed(2)} ر.س</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>ضريبة القيمة المضافة (15%)</span>
                      <span>{cartTotal.vat.toFixed(2)} ر.س</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t pt-2 mt-1">
                      <span className="text-gray-800">الإجمالي</span>
                      <span className="text-orange-600" data-testid="text-cart-total">{cartTotal.total.toFixed(2)} ر.س</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => setPaymentMethod("cash")}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                          paymentMethod === "cash"
                            ? "bg-green-500 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        data-testid="button-payment-cash"
                      >
                        <Banknote className="w-4 h-4" />
                        نقد
                      </button>
                      <button
                        onClick={() => setPaymentMethod("network")}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                          paymentMethod === "network"
                            ? "bg-blue-500 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        data-testid="button-payment-network"
                      >
                        <CreditCard className="w-4 h-4" />
                        شبكة
                      </button>
                    </div>

                    <button
                      className="w-full bg-gradient-to-l from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-green-200/40 disabled:shadow-none active:scale-[0.98]"
                      disabled={cart.length === 0 || createSaleMutation.isPending}
                      onClick={handleCheckout}
                      data-testid="button-checkout"
                    >
                      {createSaleMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> جاري المعالجة...</>
                      ) : (
                        <><Receipt className="w-4 h-4" /> إتمام البيع - {cartTotal.total.toFixed(2)} ر.س</>
                      )}
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {todaySummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Card className="border-green-100 bg-green-50/50">
                  <CardContent className="p-3.5 text-center">
                    <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <div className="text-xl font-bold text-green-700">{(todaySummary.totalSales || 0).toFixed(0)}</div>
                    <div className="text-[10px] text-green-600">إجمالي المبيعات (ر.س)</div>
                  </CardContent>
                </Card>
                <Card className="border-blue-100 bg-blue-50/50">
                  <CardContent className="p-3.5 text-center">
                    <Hash className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <div className="text-xl font-bold text-blue-700">{todaySummary.totalTransactions || 0}</div>
                    <div className="text-[10px] text-blue-600">عدد الفواتير</div>
                  </CardContent>
                </Card>
                <Card className="border-amber-100 bg-amber-50/50">
                  <CardContent className="p-3.5 text-center">
                    <Banknote className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                    <div className="text-xl font-bold text-amber-700">{(todaySummary.cashTotal || 0).toFixed(0)}</div>
                    <div className="text-[10px] text-amber-600">نقد (ر.س)</div>
                  </CardContent>
                </Card>
                <Card className="border-purple-100 bg-purple-50/50">
                  <CardContent className="p-3.5 text-center">
                    <CreditCard className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                    <div className="text-xl font-bold text-purple-700">{(todaySummary.networkTotal || 0).toFixed(0)}</div>
                    <div className="text-[10px] text-purple-600">شبكة (ر.س)</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="rounded-2xl border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-orange-500" />
                  مبيعات اليوم
                </h3>
              </div>
              <div className="divide-y max-h-[55vh] overflow-y-auto">
                {todaySales.length === 0 ? (
                  <div className="p-10 text-center text-gray-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد مبيعات اليوم</p>
                  </div>
                ) : todaySales.map((sale: any) => (
                  <div key={sale.id} className="px-4 py-3 hover:bg-orange-50/50 flex items-center justify-between transition-colors" data-testid={`sale-row-${sale.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-gray-800">{sale.invoiceNumber}</div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {sale.saleTime}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        sale.paymentMethod === "cash" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {sale.paymentMethod === "cash" ? "نقد" : "شبكة"}
                      </span>
                      <span className="font-bold text-sm text-orange-600">{(sale.totalAmount || 0).toFixed(2)} <span className="text-[10px] text-orange-400">ر.س</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-green-600" />
              </div>
              إتمام البيع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gradient-to-l from-orange-50 to-amber-50 rounded-xl p-5 text-center border border-orange-100">
              <div className="text-xs text-gray-500 mb-1">الإجمالي المطلوب</div>
              <div className="text-3xl font-bold text-orange-600">{cartTotal.total.toFixed(2)} <span className="text-base">ر.س</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  paymentMethod === "cash" ? "bg-green-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Banknote className="w-4 h-4" /> نقد
              </button>
              <button
                onClick={() => setPaymentMethod("network")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  paymentMethod === "network" ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <CreditCard className="w-4 h-4" /> شبكة
              </button>
            </div>
            {paymentMethod === "cash" && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-600">المبلغ المدفوع</label>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  className="text-lg text-center font-bold h-12 rounded-xl"
                  autoFocus
                  data-testid="input-amount-paid"
                />
                {changeAmount > 0 && (
                  <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                    <div className="text-[10px] text-green-600">الباقي</div>
                    <div className="text-2xl font-bold text-green-700">{changeAmount.toFixed(2)} ر.س</div>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 20, 50, 100, 200, 500].map(v => (
                    <button key={v} onClick={() => setAmountPaid(String(v))} className="py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-orange-100 hover:text-orange-700 transition-colors">
                      {v}
                    </button>
                  ))}
                  <button onClick={() => setAmountPaid(String(cartTotal.total))} className="py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                    مطابق
                  </button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowCheckout(false)} className="rounded-xl">إلغاء</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 flex-1 rounded-xl"
              onClick={handleCompleteSale}
              disabled={createSaleMutation.isPending}
              data-testid="button-complete-sale"
            >
              {createSaleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              {createSaleMutation.isPending ? "جاري..." : "تأكيد البيع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
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
            <Button variant="outline" onClick={() => setShowReceipt(false)} className="rounded-xl">إغلاق</Button>
            <Button onClick={() => handlePrint()} className="gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600" data-testid="button-print-receipt">
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4 text-gray-600" />
              </div>
              إعدادات الفاتورة الضريبية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">اسم المنشأة (عربي)</label>
              <Input value={settingsForm.businessName} onChange={e => setSettingsForm(f => ({ ...f, businessName: e.target.value }))} className="rounded-lg h-9 text-sm" data-testid="input-business-name" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">اسم المنشأة (إنجليزي)</label>
              <Input value={settingsForm.businessNameEn} onChange={e => setSettingsForm(f => ({ ...f, businessNameEn: e.target.value }))} className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">الرقم الضريبي *</label>
              <Input value={settingsForm.vatNumber} onChange={e => setSettingsForm(f => ({ ...f, vatNumber: e.target.value }))} placeholder="300XXXXXXXXX" className="rounded-lg h-9 text-sm" data-testid="input-vat-number" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">السجل التجاري</label>
              <Input value={settingsForm.crNumber} onChange={e => setSettingsForm(f => ({ ...f, crNumber: e.target.value }))} className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">العنوان</label>
              <Input value={settingsForm.address} onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))} className="rounded-lg h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">المدينة</label>
                <Input value={settingsForm.city} onChange={e => setSettingsForm(f => ({ ...f, city: e.target.value }))} className="rounded-lg h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">الهاتف</label>
                <Input value={settingsForm.phone} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} className="rounded-lg h-9 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">بادئة رقم الفاتورة</label>
              <Input value={settingsForm.invoicePrefix} onChange={e => setSettingsForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="EV" className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">نص أسفل الفاتورة</label>
              <Input value={settingsForm.footerText} onChange={e => setSettingsForm(f => ({ ...f, footerText: e.target.value }))} className="rounded-lg h-9 text-sm" />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowSettings(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending || !settingsForm.vatNumber} className="rounded-xl" data-testid="button-save-settings">
              {saveSettingsMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Manager Dialog */}
      <Dialog open={showProductManager} onOpenChange={setShowProductManager}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-orange-600" />
              </div>
              إدارة منتجات الفرع
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <h4 className="font-semibold text-xs text-gray-600 mb-2 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-green-500" />
                المنتجات المضافة ({branchProducts.length})
              </h4>
              <div className="space-y-1.5">
                {branchProducts.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">لم يتم إضافة منتجات بعد</p>
                )}
                {branchProducts.map((bp: any) => (
                  <div key={bp.id} className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2 border border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                        <Package className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <div>
                        <span className="font-medium text-xs text-gray-800">{bp.product?.name || `منتج #${bp.productId}`}</span>
                        <span className="text-[10px] text-gray-400 mr-1.5">{bp.product?.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-orange-600">
                        {(bp.priceOverride ?? bp.product?.basePrice ?? 0).toFixed(2)} ر.س
                      </span>
                      <button onClick={() => removeBranchProductMutation.mutate(bp.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-xs text-gray-600 mb-2 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-blue-500" />
                إضافة منتجات ({availableToAdd.length} متاح)
              </h4>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {availableToAdd.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">تم إضافة جميع المنتجات المتاحة</p>
                )}
                {availableToAdd.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div>
                        <span className="font-medium text-xs text-gray-800">{p.name}</span>
                        <span className="text-[10px] text-gray-400 mr-1.5">{p.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{(p.basePrice || 0).toFixed(2)} ر.س</span>
                      <button
                        onClick={() => addBranchProductMutation.mutate(p.id)}
                        className="h-7 px-2.5 rounded-lg text-[10px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-0.5 border border-blue-100"
                        data-testid={`button-add-product-${p.id}`}
                      >
                        <Plus className="w-3 h-3" />
                        إضافة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}