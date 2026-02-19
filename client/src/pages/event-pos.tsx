import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  Receipt, Search, Settings, Package, ArrowRight, Printer,
  X, Check, AlertCircle, Store, ChevronLeft
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
        cashierName: user?.fullName || user?.username || "",
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
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-pos-title">نقطة البيع - إيفنت</h1>
            <p className="text-gray-500">اختر الفرع للبدء</p>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="text-right" data-testid="select-branch">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((b: any) => (
                  <SelectItem key={b.id} value={b.id} data-testid={`branch-option-${b.id}`}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  const branchName = branches?.find((b: any) => b.id === selectedBranch)?.name || selectedBranch;

  const availableToAdd = allProducts.filter((p: any) => 
    p.isActive === "true" && !branchProducts.some((bp: any) => bp.productId === p.id)
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-amber-600 to-orange-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setSelectedBranch("")} data-testid="button-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Store className="w-5 h-5" />
              نقطة البيع
            </h1>
            <p className="text-xs text-white/80">{branchName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {todaySummary && (
            <div className="text-left text-xs bg-white/15 rounded-lg px-3 py-1">
              <div>المبيعات: <span className="font-bold">{(todaySummary.totalSales || 0).toFixed(2)} ر.س</span></div>
              <div>الفواتير: <span className="font-bold">{todaySummary.totalTransactions || 0}</span></div>
            </div>
          )}
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setShowProductManager(true)} data-testid="button-manage-products">
            <Package className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => {
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
          }} data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 grid grid-cols-2 w-64">
          <TabsTrigger value="pos" data-testid="tab-pos">البيع</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">سجل المبيعات</TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="flex-1 overflow-hidden mt-0 p-0">
          <div className="flex h-full">
            {/* Products Grid */}
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="ابحث عن منتج..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pr-10 bg-white"
                    data-testid="input-search-product"
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  <Badge
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedCategory("all")}
                    data-testid="category-all"
                  >
                    الكل
                  </Badge>
                  {categories.map(cat => (
                    <Badge
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => setSelectedCategory(cat)}
                      data-testid={`category-${cat}`}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {productsLoading ? (
                  <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>
                ) : displayProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    <Package className="w-12 h-12" />
                    <p>لا توجد منتجات</p>
                    <Button variant="outline" size="sm" onClick={() => setShowProductManager(true)}>إضافة منتجات</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {displayProducts.map((bp: BranchProductWithDetails) => {
                      const price = bp.priceOverride ?? bp.product?.basePrice ?? 0;
                      const inCart = cart.find(c => c.productId === bp.productId);
                      return (
                        <button
                          key={bp.id}
                          onClick={() => addToCart(bp)}
                          className={`relative bg-white rounded-xl p-3 text-center shadow-sm border-2 transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 ${
                            inCart ? "border-amber-400 bg-amber-50" : "border-transparent"
                          }`}
                          data-testid={`product-card-${bp.productId}`}
                        >
                          {inCart && (
                            <div className="absolute -top-2 -left-2 w-6 h-6 bg-amber-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                              {inCart.quantity}
                            </div>
                          )}
                          <div className="text-sm font-semibold text-gray-800 mb-1 truncate">{bp.product?.name}</div>
                          <div className="text-xs text-gray-400 mb-1">{bp.product?.category}</div>
                          <div className="text-amber-600 font-bold text-sm">{price.toFixed(2)} ر.س</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Cart Sidebar */}
            <div className="w-80 lg:w-96 bg-white border-r shadow-lg flex flex-col">
              <div className="p-3 border-b flex items-center justify-between">
                <h2 className="font-bold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  السلة
                  {cart.length > 0 && <Badge variant="secondary" className="text-xs">{cart.length}</Badge>}
                </h2>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-500 hover:text-red-700 text-xs" data-testid="button-clear-cart">
                    <Trash2 className="w-3 h-3 ml-1" />
                    مسح
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-300">
                    <ShoppingCart className="w-12 h-12 mb-2" />
                    <p className="text-sm">السلة فارغة</p>
                  </div>
                ) : cart.map(item => (
                  <div key={item.productId} className="bg-gray-50 rounded-lg p-2 flex items-center gap-2" data-testid={`cart-item-${item.productId}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.productName}</div>
                      <div className="text-xs text-gray-500">{item.unitPrice.toFixed(2)} ر.س</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, -1)} data-testid={`button-decrease-${item.productId}`}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, 1)} data-testid={`button-increase-${item.productId}`}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeFromCart(item.productId)} data-testid={`button-remove-${item.productId}`}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="text-sm font-bold text-amber-600 w-16 text-left">
                      {(item.unitPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Footer */}
              <div className="border-t p-3 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>المجموع (بدون ضريبة)</span>
                  <span>{cartTotal.subtotal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>ضريبة القيمة المضافة (15%)</span>
                  <span>{cartTotal.vat.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>الإجمالي</span>
                  <span className="text-amber-600" data-testid="text-cart-total">{cartTotal.total.toFixed(2)} ر.س</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("cash")}
                    className="gap-1"
                    data-testid="button-payment-cash"
                  >
                    <Banknote className="w-4 h-4" />
                    نقد
                  </Button>
                  <Button
                    variant={paymentMethod === "network" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("network")}
                    className="gap-1"
                    data-testid="button-payment-network"
                  >
                    <CreditCard className="w-4 h-4" />
                    شبكة
                  </Button>
                </div>

                <Button
                  className="w-full bg-gradient-to-l from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold text-lg h-12"
                  disabled={cart.length === 0 || createSaleMutation.isPending}
                  onClick={handleCheckout}
                  data-testid="button-checkout"
                >
                  <Receipt className="w-5 h-5 ml-2" />
                  {createSaleMutation.isPending ? "جاري المعالجة..." : `إتمام البيع - ${cartTotal.total.toFixed(2)} ر.س`}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-auto p-4 mt-0">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">مبيعات اليوم</h3>
              {todaySummary && (
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-700">{(todaySummary.totalSales || 0).toFixed(0)}</div>
                    <div className="text-xs text-green-600">إجمالي المبيعات</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-700">{todaySummary.totalTransactions || 0}</div>
                    <div className="text-xs text-blue-600">عدد الفواتير</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-700">{(todaySummary.cashTotal || 0).toFixed(0)}</div>
                    <div className="text-xs text-amber-600">نقد</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-700">{(todaySummary.networkTotal || 0).toFixed(0)}</div>
                    <div className="text-xs text-purple-600">شبكة</div>
                  </div>
                </div>
              )}
            </div>
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {todaySales.length === 0 ? (
                <div className="p-8 text-center text-gray-400">لا توجد مبيعات اليوم</div>
              ) : todaySales.map((sale: any) => (
                <div key={sale.id} className="p-3 hover:bg-gray-50 flex items-center justify-between" data-testid={`sale-row-${sale.id}`}>
                  <div>
                    <div className="font-medium text-sm">{sale.invoiceNumber}</div>
                    <div className="text-xs text-gray-500">{sale.saleTime}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {sale.paymentMethod === "cash" ? "نقد" : "شبكة"}
                    </Badge>
                    <span className="font-bold text-amber-600">{(sale.totalAmount || 0).toFixed(2)} ر.س</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              إتمام البيع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">الإجمالي المطلوب</div>
              <div className="text-3xl font-bold text-amber-600">{cartTotal.total.toFixed(2)} ر.س</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={paymentMethod === "cash" ? "default" : "outline"} onClick={() => setPaymentMethod("cash")} className="gap-1">
                <Banknote className="w-4 h-4" /> نقد
              </Button>
              <Button variant={paymentMethod === "network" ? "default" : "outline"} onClick={() => setPaymentMethod("network")} className="gap-1">
                <CreditCard className="w-4 h-4" /> شبكة
              </Button>
            </div>
            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">المبلغ المدفوع</label>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  className="text-lg text-center font-bold"
                  autoFocus
                  data-testid="input-amount-paid"
                />
                {changeAmount > 0 && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-green-600">الباقي</div>
                    <div className="text-2xl font-bold text-green-700">{changeAmount.toFixed(2)} ر.س</div>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-1">
                  {[5, 10, 20, 50, 100, 200, 500].map(v => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setAmountPaid(String(v))} className="text-xs">
                      {v}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setAmountPaid(String(cartTotal.total))} className="text-xs bg-amber-50">
                    مطابق
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCheckout(false)}>إلغاء</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 flex-1"
              onClick={handleCompleteSale}
              disabled={createSaleMutation.isPending}
              data-testid="button-complete-sale"
            >
              <Check className="w-4 h-4 ml-1" />
              {createSaleMutation.isPending ? "جاري..." : "تأكيد البيع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              الفاتورة الضريبية المبسطة
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div ref={receiptRef} className="bg-white p-4 text-sm" style={{ fontFamily: "Cairo, sans-serif" }}>
              <div className="text-center border-b pb-3 mb-3">
                <h3 className="font-bold text-lg">{invoiceSettings?.businessName || "باتر بيكري"}</h3>
                {invoiceSettings?.businessNameEn && <p className="text-xs text-gray-500">{invoiceSettings.businessNameEn}</p>}
                {invoiceSettings?.address && <p className="text-xs">{invoiceSettings.address}</p>}
                {invoiceSettings?.city && <p className="text-xs">{invoiceSettings.city}</p>}
                {invoiceSettings?.phone && <p className="text-xs">هاتف: {invoiceSettings.phone}</p>}
                {invoiceSettings?.vatNumber && <p className="text-xs font-medium mt-1">الرقم الضريبي: {invoiceSettings.vatNumber}</p>}
                {invoiceSettings?.crNumber && <p className="text-xs">السجل التجاري: {invoiceSettings.crNumber}</p>}
              </div>

              <div className="text-center mb-3">
                <p className="font-bold">فاتورة ضريبية مبسطة</p>
                <p className="text-xs">رقم الفاتورة: {lastSale.invoiceNumber}</p>
                <p className="text-xs">{lastSale.saleDate} - {lastSale.saleTime}</p>
              </div>

              <table className="w-full text-xs mb-3">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-1">المنتج</th>
                    <th className="text-center py-1">الكمية</th>
                    <th className="text-center py-1">السعر</th>
                    <th className="text-left py-1">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSale.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-dashed">
                      <td className="py-1">{item.productName}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-center">{item.unitPrice?.toFixed(2)}</td>
                      <td className="text-left">{item.totalPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t pt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>المجموع بدون ضريبة</span>
                  <span>{lastSale.subtotal?.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span>ضريبة القيمة المضافة (15%)</span>
                  <span>{lastSale.vatAmount?.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t pt-1">
                  <span>الإجمالي شامل الضريبة</span>
                  <span>{lastSale.totalAmount?.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-gray-500">
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
                <p className="text-xs text-gray-500">{invoiceSettings?.footerText || "شكراً لزيارتكم"}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>إغلاق</Button>
            <Button onClick={() => handlePrint()} className="gap-1" data-testid="button-print-receipt">
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              إعدادات الفاتورة الضريبية المبسطة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-sm font-medium">اسم المنشأة (عربي)</label>
              <Input value={settingsForm.businessName} onChange={e => setSettingsForm(f => ({ ...f, businessName: e.target.value }))} data-testid="input-business-name" />
            </div>
            <div>
              <label className="text-sm font-medium">اسم المنشأة (إنجليزي)</label>
              <Input value={settingsForm.businessNameEn} onChange={e => setSettingsForm(f => ({ ...f, businessNameEn: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">الرقم الضريبي *</label>
              <Input value={settingsForm.vatNumber} onChange={e => setSettingsForm(f => ({ ...f, vatNumber: e.target.value }))} placeholder="300XXXXXXXXX" data-testid="input-vat-number" />
            </div>
            <div>
              <label className="text-sm font-medium">السجل التجاري</label>
              <Input value={settingsForm.crNumber} onChange={e => setSettingsForm(f => ({ ...f, crNumber: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">العنوان</label>
              <Input value={settingsForm.address} onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">المدينة</label>
                <Input value={settingsForm.city} onChange={e => setSettingsForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">الهاتف</label>
                <Input value={settingsForm.phone} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">بادئة رقم الفاتورة</label>
              <Input value={settingsForm.invoicePrefix} onChange={e => setSettingsForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="EV" />
            </div>
            <div>
              <label className="text-sm font-medium">نص أسفل الفاتورة</label>
              <Input value={settingsForm.footerText} onChange={e => setSettingsForm(f => ({ ...f, footerText: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>إلغاء</Button>
            <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending || !settingsForm.vatNumber} data-testid="button-save-settings">
              {saveSettingsMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Manager Dialog */}
      <Dialog open={showProductManager} onOpenChange={setShowProductManager}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              إدارة منتجات الفرع
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <h4 className="font-medium mb-2">المنتجات المضافة ({branchProducts.length})</h4>
              <div className="space-y-1">
                {branchProducts.map((bp: any) => (
                  <div key={bp.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{bp.product?.name || `منتج #${bp.productId}`}</span>
                      <span className="text-xs text-gray-500 mr-2">{bp.product?.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-600">
                        {(bp.priceOverride ?? bp.product?.basePrice ?? 0).toFixed(2)} ر.س
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => removeBranchProductMutation.mutate(bp.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">إضافة منتجات ({availableToAdd.length} متاح)</h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {availableToAdd.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-xs text-gray-500 mr-2">{p.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{(p.basePrice || 0).toFixed(2)} ر.س</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addBranchProductMutation.mutate(p.id)} data-testid={`button-add-product-${p.id}`}>
                        <Plus className="w-3 h-3 ml-1" />
                        إضافة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}