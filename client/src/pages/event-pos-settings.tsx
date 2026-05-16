import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Package, Receipt, Shield, Search,
  Plus, Trash2, Check, X, Save, Store,
  FileText, Hash, Phone, MapPin, Building2,
  Sparkles, Loader2, AlertCircle, Eye, EyeOff,
  GripVertical, DollarSign, Tag, ChevronRight,
  ImageIcon, Upload
} from "lucide-react";

const EVENT_BRANCH_ID = "EVENT-BB";

export default function EventPosSettingsPage() {
  const { user, isAdmin } = useAuth();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");
  const [productSearch, setProductSearch] = useState("");
  const [editingPrice, setEditingPrice] = useState<{ id: number; price: string } | null>(null);
  const hasEditAccess = isAdmin || canEdit("event_pos");

  const { data: branchProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/pos/branch-products", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/branch-products/${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/products");
      return res.json();
    },
  });

  const { data: invoiceSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/pos/invoice-settings", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/invoice-settings/${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

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
    logoUrl: "",
  });

  useEffect(() => {
    if (invoiceSettings && !settingsLoading) {
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
        logoUrl: invoiceSettings.logoUrl || "",
      });
    }
  }, [invoiceSettings, settingsLoading]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "حجم الصورة كبير جداً", description: "الحد الأقصى 500 كيلوبايت", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSettingsForm(f => ({ ...f, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const availableToAdd = useMemo(() => {
    const existingIds = new Set(branchProducts.map((bp: any) => bp.productId));
    let filtered = allProducts.filter((p: any) => !existingIds.has(p.id));
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allProducts, branchProducts, productSearch]);

  const productCategories = useMemo(() => {
    const cats = new Map<string, number>();
    branchProducts.forEach((bp: any) => {
      const cat = bp.product?.category || "بدون تصنيف";
      cats.set(cat, (cats.get(cat) || 0) + 1);
    });
    return cats;
  }, [branchProducts]);

  const addBranchProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("POST", "/api/pos/branch-products", {
        branchId: EVENT_BRANCH_ID,
        productId,
        isActive: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branch-products"] });
      toast({ title: "تمت إضافة المنتج بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في إضافة المنتج", description: err?.message, variant: "destructive" });
    },
  });

  const removeBranchProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pos/branch-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branch-products"] });
      toast({ title: "تم حذف المنتج" });
    },
  });

  const toggleProductMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/pos/branch-products/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branch-products"] });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, priceOverride }: { id: number; priceOverride: number | null }) => {
      const res = await apiRequest("PATCH", `/api/pos/branch-products/${id}`, { priceOverride });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branch-products"] });
      setEditingPrice(null);
      toast({ title: "تم تحديث السعر" });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pos/invoice-settings", {
        ...settingsForm,
        branchId: EVENT_BRANCH_ID,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/invoice-settings"] });
      toast({ title: "تم حفظ الإعدادات بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في حفظ الإعدادات", description: err?.message, variant: "destructive" });
    },
  });

  const addAllProductsMutation = useMutation({
    mutationFn: async () => {
      const promises = availableToAdd.slice(0, 50).map((p: any) =>
        apiRequest("POST", "/api/pos/branch-products", {
          branchId: EVENT_BRANCH_ID,
          productId: p.id,
          isActive: true,
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branch-products"] });
      toast({ title: "تمت إضافة جميع المنتجات" });
    },
  });

  if (!hasEditAccess) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-gray-800">غير مصرح بالوصول</h2>
            <p className="text-sm text-gray-500">هذه الصفحة متاحة فقط للمديرين والمستخدمين ذوي صلاحية التعديل</p>
            <a href="/event-pos" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors">
              العودة لنقطة البيع
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-l from-orange-500 to-amber-500 rounded-2xl p-5 mb-6 shadow-lg shadow-orange-200/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">إعدادات نقطة البيع الموسمية</h1>
                <p className="text-xs text-white/70 mt-0.5 flex items-center gap-1">
                  <Store className="w-3 h-3" />
                  مرتبطة بفرع: إيفنت موسمي (EVENT-BB)
                </p>
              </div>
            </div>
            <a
              href="/event-pos"
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors"
            >
              <Store className="w-4 h-4" />
              الذهاب لشاشة البيع
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </a>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-5 bg-white border shadow-sm h-auto flex-wrap">
            <TabsTrigger value="products" className="gap-1.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700" data-testid="settings-tab-products">
              <Package className="w-3.5 h-3.5" />
              إدارة الأصناف
            </TabsTrigger>
            <TabsTrigger value="invoice" className="gap-1.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700" data-testid="settings-tab-invoice">
              <Receipt className="w-3.5 h-3.5" />
              إعدادات الفاتورة
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-1.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700" data-testid="settings-tab-general">
              <Settings className="w-3.5 h-3.5" />
              إعدادات عامة
            </TabsTrigger>
          </TabsList>

          {/* Products Management Tab */}
          <TabsContent value="products" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Current Products */}
              <div className="lg:col-span-3">
                <Card className="rounded-2xl border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex items-center justify-between">
                    <h3 className="font-bold text-sm text-green-800 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      الأصناف المضافة لنقطة البيع
                      <span className="bg-green-200 text-green-800 text-[10px] font-bold rounded-full px-2 py-0.5">{branchProducts.length}</span>
                    </h3>
                  </div>

                  {/* Category summary */}
                  {productCategories.size > 0 && (
                    <div className="px-4 py-2 border-b bg-gray-50 flex gap-2 flex-wrap">
                      {Array.from(productCategories.entries()).map(([cat, count]) => (
                        <span key={cat} className="text-[10px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                          {cat}: <strong>{count}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-50">
                    {productsLoading ? (
                      <div className="p-8 text-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        جاري تحميل المنتجات...
                      </div>
                    ) : branchProducts.length === 0 ? (
                      <div className="p-10 text-center">
                        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Package className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-500 font-medium">لم يتم إضافة أصناف بعد</p>
                        <p className="text-xs text-gray-400 mt-1">أضف أصناف من القائمة المتاحة على اليسار</p>
                      </div>
                    ) : branchProducts.map((bp: any) => {
                      const effectivePrice = bp.priceOverride ?? bp.product?.basePrice ?? 0;
                      const hasOverride = bp.priceOverride !== null && bp.priceOverride !== undefined;
                      const isEditing = editingPrice?.id === bp.id;

                      return (
                        <div key={bp.id} className={`px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors ${!bp.isActive ? "opacity-50" : ""}`} data-testid={`settings-product-${bp.id}`}>
                          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-orange-400" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800 truncate">{bp.product?.name || `منتج #${bp.productId}`}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                              <span>{bp.product?.category}</span>
                              {bp.product?.unit && <span>• {bp.product.unit}</span>}
                              {hasOverride && (
                                <span className="text-orange-500 font-medium flex items-center gap-0.5">
                                  <Tag className="w-2.5 h-2.5" />
                                  سعر مخصص
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Price */}
                          <div className="flex items-center gap-1.5">
                            {isEditing && editingPrice ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={editingPrice.price}
                                  onChange={e => setEditingPrice({ id: bp.id, price: e.target.value })}
                                  className="w-20 h-7 text-xs text-center rounded-lg"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === "Enter") {
                                      const val = parseFloat(editingPrice!.price);
                                      updatePriceMutation.mutate({ id: bp.id, priceOverride: isNaN(val) ? null : val });
                                    }
                                    if (e.key === "Escape") setEditingPrice(null);
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    const val = parseFloat(editingPrice!.price);
                                    updatePriceMutation.mutate({ id: bp.id, priceOverride: isNaN(val) ? null : val });
                                  }}
                                  className="w-6 h-6 rounded bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button onClick={() => setEditingPrice(null)} className="w-6 h-6 rounded bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingPrice({ id: bp.id, price: String(effectivePrice) })}
                                className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-1"
                                title="اضغط لتعديل السعر"
                              >
                                <DollarSign className="w-3 h-3" />
                                {effectivePrice.toFixed(2)}
                              </button>
                            )}
                          </div>

                          {/* Toggle Active */}
                          <Switch
                            checked={bp.isActive}
                            onCheckedChange={(checked) => toggleProductMutation.mutate({ id: bp.id, isActive: checked })}
                            className="data-[state=checked]:bg-green-500"
                          />

                          {/* Delete */}
                          <button
                            onClick={() => removeBranchProductMutation.mutate(bp.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Available Products to Add */}
              <div className="lg:col-span-2">
                <Card className="rounded-2xl border-gray-200 shadow-sm overflow-hidden sticky top-4">
                  <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-sm text-blue-800 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-blue-600" />
                        أصناف متاحة للإضافة
                        <span className="bg-blue-200 text-blue-800 text-[10px] font-bold rounded-full px-2 py-0.5">{availableToAdd.length}</span>
                      </h3>
                      {availableToAdd.length > 0 && (
                        <button
                          onClick={() => addAllProductsMutation.mutate()}
                          disabled={addAllProductsMutation.isPending}
                          className="text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {addAllProductsMutation.isPending ? "جاري الإضافة..." : "إضافة الكل"}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400" />
                      <Input
                        placeholder="ابحث عن صنف..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        className="pr-8 h-8 text-xs bg-white border-blue-200 rounded-lg"
                        data-testid="input-search-available-products"
                      />
                    </div>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-50">
                    {availableToAdd.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        <Check className="w-8 h-8 mx-auto mb-2 text-green-300" />
                        <p className="text-xs">تم إضافة جميع المنتجات المتاحة</p>
                      </div>
                    ) : availableToAdd.map((p: any) => (
                      <div key={p.id} className="px-3 py-2 flex items-center gap-2 hover:bg-blue-50/50 transition-colors" data-testid={`available-product-${p.id}`}>
                        <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{p.name}</div>
                          <div className="text-[10px] text-gray-400">{p.category} • {(p.basePrice || 0).toFixed(2)} ر.س</div>
                        </div>
                        <button
                          onClick={() => addBranchProductMutation.mutate(p.id)}
                          disabled={addBranchProductMutation.isPending}
                          className="h-7 px-2.5 rounded-lg text-[10px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-0.5 border border-blue-100 shrink-0"
                          data-testid={`button-add-product-${p.id}`}
                        >
                          <Plus className="w-3 h-3" />
                          إضافة
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Invoice Settings Tab */}
          <TabsContent value="invoice" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50 rounded-t-2xl">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-500" />
                    بيانات المنشأة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">اسم المنشأة (عربي) *</label>
                    <Input
                      value={settingsForm.businessName}
                      onChange={e => setSettingsForm(f => ({ ...f, businessName: e.target.value }))}
                      className="rounded-lg h-9 text-sm"
                      data-testid="input-business-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">اسم المنشأة (إنجليزي)</label>
                    <Input
                      value={settingsForm.businessNameEn}
                      onChange={e => setSettingsForm(f => ({ ...f, businessNameEn: e.target.value }))}
                      className="rounded-lg h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      الرقم الضريبي *
                    </label>
                    <Input
                      value={settingsForm.vatNumber}
                      onChange={e => setSettingsForm(f => ({ ...f, vatNumber: e.target.value }))}
                      placeholder="300XXXXXXXXX"
                      className="rounded-lg h-9 text-sm"
                      dir="ltr"
                      data-testid="input-vat-number"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">السجل التجاري</label>
                    <Input
                      value={settingsForm.crNumber}
                      onChange={e => setSettingsForm(f => ({ ...f, crNumber: e.target.value }))}
                      className="rounded-lg h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50 rounded-t-2xl">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-orange-500" />
                    شعار الفاتورة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <p className="text-[11px] text-gray-400">يظهر الشعار في أعلى الفاتورة المطبوعة بشكل مصغر</p>
                  {settingsForm.logoUrl ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full bg-gray-50 rounded-xl p-4 flex items-center justify-center border border-dashed border-gray-200">
                        <img
                          src={settingsForm.logoUrl}
                          alt="شعار الفاتورة"
                          className="max-h-20 max-w-[180px] object-contain"
                          data-testid="img-logo-preview"
                        />
                      </div>
                      <div className="flex gap-2 w-full">
                        <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          تغيير الشعار
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoFileChange} data-testid="input-logo-file-change" />
                        </label>
                        <button
                          onClick={() => setSettingsForm(f => ({ ...f, logoUrl: "" }))}
                          className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium text-red-500 transition-colors"
                          data-testid="button-remove-logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors" data-testid="label-upload-logo">
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <Upload className="w-7 h-7 text-gray-300" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-gray-500">اضغط لرفع الشعار</p>
                        <p className="text-[10px] text-gray-400 mt-1">PNG, JPG, SVG - الحد الأقصى 500 كيلوبايت</p>
                      </div>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoFileChange} data-testid="input-logo-file" />
                    </label>
                  )}
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 mb-1 block">أو أدخل رابط الشعار مباشرة</label>
                    <Input
                      value={settingsForm.logoUrl.startsWith("data:") ? "" : settingsForm.logoUrl}
                      onChange={e => setSettingsForm(f => ({ ...f, logoUrl: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                      className="rounded-lg h-8 text-[11px]"
                      dir="ltr"
                      data-testid="input-logo-url"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50 rounded-t-2xl">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    بيانات التواصل والعنوان
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">العنوان</label>
                    <Input
                      value={settingsForm.address}
                      onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))}
                      className="rounded-lg h-9 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">المدينة</label>
                      <Input
                        value={settingsForm.city}
                        onChange={e => setSettingsForm(f => ({ ...f, city: e.target.value }))}
                        className="rounded-lg h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        الهاتف
                      </label>
                      <Input
                        value={settingsForm.phone}
                        onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))}
                        className="rounded-lg h-9 text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      بادئة رقم الفاتورة
                    </label>
                    <Input
                      value={settingsForm.invoicePrefix}
                      onChange={e => setSettingsForm(f => ({ ...f, invoicePrefix: e.target.value }))}
                      placeholder="EV"
                      className="rounded-lg h-9 text-sm w-32"
                      dir="ltr"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">مثال: EV-000001</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">نص أسفل الفاتورة</label>
                    <Input
                      value={settingsForm.footerText}
                      onChange={e => setSettingsForm(f => ({ ...f, footerText: e.target.value }))}
                      className="rounded-lg h-9 text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2">
                <Button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending || !settingsForm.vatNumber || !settingsForm.businessName}
                  className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2 h-10"
                  data-testid="button-save-invoice-settings"
                >
                  {saveSettingsMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                  ) : (
                    <><Save className="w-4 h-4" /> حفظ إعدادات الفاتورة</>
                  )}
                </Button>
                {!settingsForm.vatNumber && (
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    الرقم الضريبي مطلوب لحفظ الإعدادات
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* General Settings Tab */}
          <TabsContent value="general" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50 rounded-t-2xl">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Store className="w-4 h-4 text-orange-500" />
                    ربط الفرع
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Store className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800">إيفنت موسمي</div>
                        <div className="text-[10px] text-gray-500">EVENT-BB</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      نقطة البيع الموسمية مرتبطة حصرياً بفرع "إيفنت موسمي". جميع المبيعات والأصناف والفواتير تتبع لهذا الفرع.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50 rounded-t-2xl">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-500" />
                    الصلاحيات المطلوبة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-gray-500 mb-3">
                    صلاحيات الوصول لنقطة البيع الموسمية تُدار من خلال نظام الصلاحيات (RBAC) تحت وحدة <strong>event_pos</strong>.
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { action: "view", label: "عرض", desc: "مشاهدة شاشة البيع والمنتجات والمبيعات" },
                      { action: "create", label: "إنشاء", desc: "إنشاء مبيعات جديدة وإضافة منتجات" },
                      { action: "edit", label: "تعديل", desc: "تعديل إعدادات الفاتورة والأسعار" },
                      { action: "delete", label: "حذف", desc: "حذف منتجات من نقطة البيع" },
                    ].map(perm => (
                      <div key={perm.action} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                          <Shield className="w-3 h-3 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-gray-700">event_pos.{perm.action} - {perm.label}</div>
                          <div className="text-[10px] text-gray-400">{perm.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    لتعديل الصلاحيات، انتقل إلى إدارة المستخدمين والأدوار
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50 rounded-t-2xl">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-orange-500" />
                    خيارات الفاتورة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-gray-700">عرض رمز QR</div>
                      <div className="text-[10px] text-gray-400">إظهار رمز QR في الفاتورة المطبوعة</div>
                    </div>
                    <Switch
                      checked={settingsForm.showQrCode}
                      onCheckedChange={(checked) => setSettingsForm(f => ({ ...f, showQrCode: checked }))}
                      className="data-[state=checked]:bg-orange-500"
                    />
                  </div>
                  <div className="border-t pt-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">رقم الفاتورة التالي</div>
                    <div className="text-[10px] text-gray-400 mb-1">الرقم الحالي يتم توليده تلقائياً بالتتابع</div>
                    {invoiceSettings && (
                      <Badge variant="outline" className="text-xs">
                        {invoiceSettings.invoicePrefix || "EV"}-{String(invoiceSettings.nextInvoiceNumber || 1).padStart(6, "0")}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50 rounded-t-2xl">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    معلومات النظام
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">الفرع المرتبط</span>
                    <span className="font-medium text-gray-800">EVENT-BB</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">عدد الأصناف</span>
                    <span className="font-medium text-gray-800">{branchProducts.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">أصناف نشطة</span>
                    <span className="font-medium text-green-600">{branchProducts.filter((bp: any) => bp.isActive).length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">أصناف معطلة</span>
                    <span className="font-medium text-red-500">{branchProducts.filter((bp: any) => !bp.isActive).length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">ضريبة القيمة المضافة</span>
                    <span className="font-medium text-gray-800">15%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">طرق الدفع</span>
                    <span className="font-medium text-gray-800">نقد / شبكة</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}