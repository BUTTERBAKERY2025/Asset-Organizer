import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
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
  ImageIcon, Upload, PartyPopper, Pencil, CalendarDays,
  Bluetooth, BluetoothConnected, Printer, Unlink, Wifi
} from "lucide-react";
import {
  isBluetoothSupported, scanAndConnect, reconnectSavedPrinter, disconnectPrinter,
  forgetPrinter, getSavedPrinter, isPrinterConnected, printTest,
  getPaperWidth, setPaperWidth, onPrinterDisconnect, onPrinterReconnect,
  ensurePrinterConnection, installAutoReconnectOnVisibility, type SavedPrinter, type PaperWidth,
} from "@/lib/thermal-printer";

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

  // إعدادات ربط طابعة الكاشير (بلوتوث)
  const [savedPrinter, setSavedPrinter] = useState<SavedPrinter | null>(() => getSavedPrinter());
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerBusy, setPrinterBusy] = useState<"scan" | "reconnect" | "test" | null>(null);
  const [paperWidth, setPaperWidthState] = useState<PaperWidth>(() => getPaperWidth());
  const btSupported = isBluetoothSupported();

  useEffect(() => {
    installAutoReconnectOnVisibility();
    setPrinterConnected(isPrinterConnected());
    onPrinterDisconnect(() => setPrinterConnected(false));
    onPrinterReconnect(() => setPrinterConnected(true));
    if (getSavedPrinter() && !isPrinterConnected()) {
      void ensurePrinterConnection().then((ok) => { if (ok) setPrinterConnected(true); });
    }
    return () => { onPrinterDisconnect(null); onPrinterReconnect(null); };
  }, []);

  const handleScanConnect = async () => {
    setPrinterBusy("scan");
    try {
      const p = await scanAndConnect();
      setSavedPrinter(p);
      setPrinterConnected(true);
      toast({ title: "تم ربط الطابعة بنجاح", description: p.name });
    } catch (e: any) {
      if (e?.name !== "NotFoundError") {
        toast({ title: "تعذر ربط الطابعة", description: e?.message || "", variant: "destructive" });
      }
    } finally {
      setPrinterBusy(null);
    }
  };

  const handleReconnect = async () => {
    setPrinterBusy("reconnect");
    try {
      const p = await reconnectSavedPrinter();
      if (p) {
        setSavedPrinter(p);
        setPrinterConnected(true);
        toast({ title: "تمت إعادة الاتصال بالطابعة", description: p.name });
      } else {
        toast({ title: "لم يتم العثور على الطابعة المحفوظة", description: "اضغط \"بحث عن طابعات\" واختر الطابعة من القائمة.", variant: "destructive" });
      }
    } finally {
      setPrinterBusy(null);
    }
  };

  const handleTestPrint = async () => {
    setPrinterBusy("test");
    try {
      await printTest();
      toast({ title: "تم إرسال الطباعة التجريبية" });
    } catch (e: any) {
      toast({ title: "فشل اختبار الطباعة", description: e?.message || "", variant: "destructive" });
    } finally {
      setPrinterBusy(null);
    }
  };

  const handleForgetPrinter = () => {
    forgetPrinter();
    setSavedPrinter(null);
    setPrinterConnected(false);
    toast({ title: "تم إلغاء ربط الطابعة" });
  };

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

  const [eventForm, setEventForm] = useState({ name: "", location: "", startDate: "", endDate: "", invoicePrefix: "", notes: "" });
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  const { data: posEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/pos/events", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/events?branchId=${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  const resetEventForm = () => {
    setEventForm({ name: "", location: "", startDate: "", endDate: "", invoicePrefix: "", notes: "" });
    setEditingEventId(null);
    setShowEventForm(false);
  };

  const saveEventMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: eventForm.name.trim(),
        location: eventForm.location.trim() || null,
        startDate: eventForm.startDate || null,
        endDate: eventForm.endDate || null,
        invoicePrefix: eventForm.invoicePrefix.trim() || null,
        notes: eventForm.notes.trim() || null,
      };
      if (editingEventId) {
        const res = await apiRequest("PATCH", `/api/pos/events/${editingEventId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/pos/events", { ...payload, branchId: EVENT_BRANCH_ID, status: "active" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/events"] });
      toast({ title: editingEventId ? "تم تحديث الإيفنت" : "تم إنشاء الإيفنت بنجاح" });
      resetEventForm();
    },
    onError: () => toast({ title: "خطأ في حفظ الإيفنت", variant: "destructive" }),
  });

  const eventStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/pos/events/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/events"] });
      toast({ title: "تم تحديث حالة الإيفنت" });
    },
    onError: () => toast({ title: "خطأ في تحديث الحالة", variant: "destructive" }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/pos/events/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/events"] });
      toast({ title: "تم حذف الإيفنت" });
    },
    onError: (err: any) => {
      let msg = err?.message || "";
      const m = msg.match(/^\d+:\s*(.*)$/s);
      if (m) { try { msg = JSON.parse(m[1]).error || m[1]; } catch { msg = m[1]; } }
      toast({ title: "لا يمكن حذف الإيفنت", description: msg, variant: "destructive" });
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
            <h2 className="text-[22px] font-black text-[#1C1411]">غير مصرح بالوصول</h2>
            <p className="text-[14px] text-[#A69587] font-bold">هذه الصفحة متاحة فقط للمديرين والمستخدمين ذوي صلاحية التعديل</p>
            <Link href="/event-pos" className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors">
              العودة لنقطة البيع
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container min-h-[100dvh] bg-[#FAF8F5]" dir="rtl">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#B38250] to-[#D4A373] rounded-[24px] p-6 mb-6 shadow-lg shadow-[#D4A373]/20">
          <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-white/20 pointer-events-none blur-xl" />
          <div className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full bg-[#1C1411]/5 pointer-events-none blur-xl" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-[#1C1411]/10 backdrop-blur-md rounded-[16px] flex items-center justify-center shadow-inner">
                <Settings className="w-7 h-7 text-[#1C1411]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#1C1411]">إعدادات نقطة البيع الموسمية</h1>
                <p className="text-sm font-bold text-[#4A3219] mt-1 flex items-center gap-1.5">
                  <Store className="w-3 h-3" />
                  مرتبطة بفرع: إيفنت موسمي (EVENT-BB)
                </p>
              </div>
            </div>
            <Link
              href="/event-pos"
              className="flex items-center gap-2 bg-[#1C1411] text-[#D4A373] text-[13px] font-black px-5 py-3 rounded-[16px] transition-all hover:bg-[#2C201A] shadow-lg"
            >
              <Store className="w-4 h-4" />
              الذهاب لشاشة البيع
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm h-auto flex-wrap rounded-[20px] p-2 gap-2">
            <TabsTrigger value="events" className="gap-2 rounded-[14px] px-5 py-2.5 font-bold transition-all text-[#A69587] hover:text-[#5C422E] hover:bg-[#FAF8F5] data-[state=active]:bg-[#1C1411] data-[state=active]:text-[#D4A373] data-[state=active]:shadow-md" data-testid="settings-tab-events">
              <PartyPopper className="w-3.5 h-3.5" />
              الإيفنتات
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2 rounded-[14px] px-5 py-2.5 font-bold transition-all text-[#A69587] hover:text-[#5C422E] hover:bg-[#FAF8F5] data-[state=active]:bg-[#1C1411] data-[state=active]:text-[#D4A373] data-[state=active]:shadow-md" data-testid="settings-tab-products">
              <Package className="w-3.5 h-3.5" />
              إدارة الأصناف
            </TabsTrigger>
            <TabsTrigger value="invoice" className="gap-2 rounded-[14px] px-5 py-2.5 font-bold transition-all text-[#A69587] hover:text-[#5C422E] hover:bg-[#FAF8F5] data-[state=active]:bg-[#1C1411] data-[state=active]:text-[#D4A373] data-[state=active]:shadow-md" data-testid="settings-tab-invoice">
              <Receipt className="w-3.5 h-3.5" />
              إعدادات الفاتورة
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2 rounded-[14px] px-5 py-2.5 font-bold transition-all text-[#A69587] hover:text-[#5C422E] hover:bg-[#FAF8F5] data-[state=active]:bg-[#1C1411] data-[state=active]:text-[#D4A373] data-[state=active]:shadow-md" data-testid="settings-tab-general">
              <Settings className="w-3.5 h-3.5" />
              إعدادات عامة
            </TabsTrigger>
            <TabsTrigger value="printer" className="gap-2 rounded-[14px] px-5 py-2.5 font-bold transition-all text-[#A69587] hover:text-[#5C422E] hover:bg-[#FAF8F5] data-[state=active]:bg-[#1C1411] data-[state=active]:text-[#D4A373] data-[state=active]:shadow-md" data-testid="settings-tab-printer">
              <Printer className="w-3.5 h-3.5" />
              ربط طابعة الكاشير
            </TabsTrigger>
          </TabsList>

          {/* Events Management Tab */}
          <TabsContent value="events" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[16px] text-[#1C1411] flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-[#D4A373]" />
                إدارة الإيفنتات
              </h3>
              {hasEditAccess && !showEventForm && (
                <Button onClick={() => { resetEventForm(); setShowEventForm(true); }} className="rounded-[14px] bg-gradient-to-r from-[#D4A373] to-[#B38250] text-[#1C1411] font-black hover:from-[#E1B68A] hover:to-[#C29263] gap-2 h-11 shadow-sm" data-testid="button-new-event">
                  <Plus className="w-4 h-4" />
                  إيفنت جديد
                </Button>
              )}
            </div>

            {showEventForm && (
              <Card className="rounded-[24px] border border-[#D4A373]/40 shadow-sm overflow-hidden bg-[#FFFFFF]">
                <div className="bg-[#FAF8F5] px-5 py-4 border-b border-[#EBE3D8]">
                  <h4 className="font-black text-[15px] text-[#2C201A]">{editingEventId ? "تعديل الإيفنت" : "إيفنت جديد"}</h4>
                </div>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[13px] font-black text-[#8C6C50] mb-1.5 block">اسم الإيفنت *</label>
                    <Input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: مهرجان الرياض" className="rounded-[14px] bg-[#FAF8F5] border-[#EBE3D8] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]" data-testid="input-event-name" />
                  </div>
                  <div>
                    <label className="text-[13px] font-black text-[#8C6C50] mb-1.5 block">الموقع</label>
                    <Input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="مثال: بوليفارد الرياض" className="rounded-[14px] bg-[#FAF8F5] border-[#EBE3D8] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]" data-testid="input-event-location" />
                  </div>
                  <div>
                    <label className="text-[13px] font-black text-[#8C6C50] mb-1.5 block">تاريخ البداية</label>
                    <Input type="date" value={eventForm.startDate} onChange={e => setEventForm(f => ({ ...f, startDate: e.target.value }))} className="rounded-[14px] bg-[#FAF8F5] border-[#EBE3D8] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]" data-testid="input-event-start" />
                  </div>
                  <div>
                    <label className="text-[13px] font-black text-[#8C6C50] mb-1.5 block">تاريخ النهاية</label>
                    <Input type="date" value={eventForm.endDate} onChange={e => setEventForm(f => ({ ...f, endDate: e.target.value }))} className="rounded-[14px] bg-[#FAF8F5] border-[#EBE3D8] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]" data-testid="input-event-end" />
                  </div>
                  <div>
                    <label className="text-[13px] font-black text-[#8C6C50] mb-1.5 block">بادئة رقم الفاتورة (اختياري)</label>
                    <Input value={eventForm.invoicePrefix} onChange={e => setEventForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="مثال: RYD" className="rounded-[14px] bg-[#FAF8F5] border-[#EBE3D8] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]" data-testid="input-event-prefix" />
                  </div>
                  <div>
                    <label className="text-[13px] font-black text-[#8C6C50] mb-1.5 block">ملاحظات</label>
                    <Input value={eventForm.notes} onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} className="rounded-[14px] bg-[#FAF8F5] border-[#EBE3D8] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]" data-testid="input-event-notes" />
                  </div>
                  <div className="md:col-span-2 flex gap-2 justify-end pt-1">
                    <Button variant="outline" onClick={resetEventForm} className="rounded-[14px] bg-[#FAF8F5] border-[#EBE3D8] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]">إلغاء</Button>
                    <Button
                      onClick={() => {
                        if (!eventForm.name.trim()) { toast({ title: "اسم الإيفنت مطلوب", variant: "destructive" }); return; }
                        saveEventMutation.mutate();
                      }}
                      disabled={saveEventMutation.isPending}
                      className="rounded-xl bg-orange-500 hover:bg-orange-600 gap-1.5"
                      data-testid="button-save-event"
                    >
                      {saveEventMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      حفظ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-[24px] border border-[#EBE3D8] shadow-sm overflow-hidden bg-[#FFFFFF]">
              <div className="divide-y divide-gray-50">
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#D4A373]" /></div>
                ) : posEvents.length === 0 ? (
                  <div className="text-center py-12 text-[15px] font-black text-[#A69587]">لا توجد إيفنتات بعد — أنشئ أول إيفنت للبدء</div>
                ) : (
                  (posEvents as any[]).map((ev: any) => (
                    <div key={ev.id} className={`px-4 py-3 flex flex-wrap items-center gap-3 border-r-4 transition-colors hover:bg-[#FAF8F5] ${ev.status === "active" ? "border-r-[#86C275]" : ev.status === "closed" ? "border-r-[#C2B4A7]" : "border-r-[#EBE3D8]"}`} data-testid={`row-event-${ev.id}`}>
                      <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 ${ev.status === "active" ? "bg-gradient-to-br from-[#D4A373] to-[#B38250] shadow-sm" : "bg-[#FAF8F5] border border-[#EBE3D8]"}`}>
                        <PartyPopper className={`w-6 h-6 ${ev.status === "active" ? "text-[#1C1411]" : "text-[#A69587]"}`} />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <div className="font-black text-[15px] text-[#2C201A] flex items-center gap-2">
                          {ev.name}
                          {ev.status === "active" && <Badge className="bg-[#2E3C2B] text-[#86C275] hover:bg-[#2E3C2B] text-[11px] font-bold border-0 px-2 py-0.5 rounded-md">نشط</Badge>}
                          {ev.status === "closed" && <Badge className="bg-[#EBE3D8] text-[#5C422E] hover:bg-[#EBE3D8] text-[11px] font-bold border-0 px-2 py-0.5 rounded-md">مغلق</Badge>}
                          {ev.status === "archived" && <Badge className="bg-[#FAF8F5] text-[#A69587] border border-[#EBE3D8] hover:bg-[#FAF8F5] text-[11px] font-bold px-2 py-0.5 rounded-md">مؤرشف</Badge>}
                        </div>
                        <div className="text-[12px] font-bold text-[#A69587] flex items-center gap-3 mt-1 flex-wrap">
                          {ev.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</span>}
                          {(ev.startDate || ev.endDate) && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{ev.startDate || "؟"} ← {ev.endDate || "؟"}</span>}
                          {ev.invoicePrefix && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{ev.invoicePrefix}</span>}
                        </div>
                      </div>
                      {hasEditAccess && (
                        <div className="flex items-center gap-1.5">
                          {ev.status === "active" ? (
                            <Button variant="outline" size="sm" onClick={() => eventStatusMutation.mutate({ id: ev.id, status: "closed" })} className="rounded-[10px] h-9 px-3 text-[12px] font-black text-[#5C422E] border-[#EBE3D8] hover:bg-[#FAF8F5] bg-transparent" data-testid={`button-close-event-${ev.id}`}>إغلاق</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => eventStatusMutation.mutate({ id: ev.id, status: "active" })} className="rounded-[10px] h-9 px-3 text-[12px] font-black text-[#86C275] border-[#86C275]/30 hover:bg-[#86C275]/10 bg-transparent" data-testid={`button-activate-event-${ev.id}`}>تفعيل</Button>
                          )}
                          <button
                            onClick={() => {
                              setEditingEventId(ev.id);
                              setEventForm({ name: ev.name || "", location: ev.location || "", startDate: ev.startDate || "", endDate: ev.endDate || "", invoicePrefix: ev.invoicePrefix || "", notes: ev.notes || "" });
                              setShowEventForm(true);
                            }}
                            className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[#A69587] hover:text-[#D4A373] hover:bg-[#FAF8F5] transition-colors"
                            data-testid={`button-edit-event-${ev.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`حذف الإيفنت "${ev.name}"؟ لا يمكن الحذف إذا كانت هناك مبيعات مسجلة عليه.`)) deleteEventMutation.mutate(ev.id); }}
                            className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[#A69587] hover:text-[#E07A5F] hover:bg-[#FDF5F3] transition-colors"
                            data-testid={`button-delete-event-${ev.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Products Management Tab */}
          <TabsContent value="products" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Current Products */}
              <div className="lg:col-span-3">
                <Card className="rounded-[24px] border border-[#EBE3D8] shadow-sm overflow-hidden bg-[#FFFFFF]">
                  <div className="bg-[#FAF8F5] px-5 py-4 border-b border-[#EBE3D8] flex items-center justify-between">
                    <h3 className="font-black text-[15px] text-[#2C201A] flex items-center gap-2">
                      <Check className="w-5 h-5 text-[#86C275]" />
                      الأصناف المضافة لنقطة البيع
                      <span className="bg-[#1C1411] text-[#D4A373] text-[11px] font-black rounded-full px-2.5 py-0.5">{branchProducts.length}</span>
                    </h3>
                  </div>

                  {/* Category summary */}
                  {productCategories.size > 0 && (
                    <div className="px-5 py-3 border-b border-[#EBE3D8] bg-[#FAF8F5]/50 flex gap-2.5 flex-wrap">
                      {Array.from(productCategories.entries()).map(([cat, count]) => (
                        <span key={cat} className="text-[11px] font-bold bg-[#FFFFFF] border border-[#EBE3D8] rounded-full px-3 py-1 text-[#8C6C50] shadow-sm">
                          {cat}: <strong>{count}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-50">
                    {productsLoading ? (
                      <div className="p-10 text-center text-[15px] font-bold text-[#A69587]">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        جاري تحميل المنتجات...
                      </div>
                    ) : branchProducts.length === 0 ? (
                      <div className="p-10 text-center">
                        <div className="w-16 h-16 bg-[#FAF8F5] rounded-[20px] flex items-center justify-center mx-auto mb-4 border border-[#EBE3D8]">
                          <Package className="w-8 h-8 text-[#C2B4A7]" />
                        </div>
                        <p className="text-[15px] text-[#A69587] font-black">لم يتم إضافة أصناف بعد</p>
                        <p className="text-[13px] text-[#C2B4A7] mt-1.5 font-bold">أضف أصناف من القائمة المتاحة على اليسار</p>
                      </div>
                    ) : branchProducts.map((bp: any) => {
                      const effectivePrice = bp.priceOverride ?? bp.product?.basePrice ?? 0;
                      const hasOverride = bp.priceOverride !== null && bp.priceOverride !== undefined;
                      const isEditing = editingPrice?.id === bp.id;

                      return (
                        <div key={bp.id} className={`px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors ${!bp.isActive ? "opacity-50" : ""}`} data-testid={`settings-product-${bp.id}`}>
                          <div className="w-10 h-10 bg-[#FAF8F5] rounded-[12px] flex items-center justify-center shrink-0 border border-[#EBE3D8]">
                            <Package className="w-5 h-5 text-[#D4A373]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-black text-[#2C201A] truncate">{bp.product?.name || `منتج #${bp.productId}`}</div>
                            <div className="text-[12px] font-bold text-[#A69587] flex items-center gap-2 mt-1">
                              <span>{bp.product?.category}</span>
                              {bp.product?.unit && <span>• {bp.product.unit}</span>}
                              {hasOverride && (
                                <span className="text-[#D4A373] font-black flex items-center gap-1 bg-[#FAF8F5] px-1.5 py-0.5 rounded-md border border-[#EBE3D8]">
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
                                  className="w-20 h-8 text-[13px] text-center font-bold rounded-[10px] border-[#D4A373] focus-visible:ring-[#D4A373] focus-visible:border-[#D4A373]"
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
                                  className="w-8 h-8 rounded-[10px] bg-[#2E3C2B] text-[#86C275] flex items-center justify-center hover:bg-[#394B35]"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button onClick={() => setEditingPrice(null)} className="w-8 h-8 rounded-[10px] bg-[#FAF8F5] text-[#8C6C50] flex items-center justify-center hover:bg-[#F4EBE1] border border-[#EBE3D8]">
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
                      <h3 className="font-black text-[15px] text-[#1E2B38] flex items-center gap-2">
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
                        className="pr-9 h-10 text-[13px] font-bold bg-[#FFFFFF] border-[#86A8D2]/40 rounded-[12px] focus-visible:ring-[#86A8D2]"
                        data-testid="input-search-available-products"
                      />
                    </div>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-50">
                    {availableToAdd.length === 0 ? (
                      <div className="p-10 text-center text-[15px] font-bold text-[#A69587]">
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
                        <Upload className="w-8 h-8 text-[#C2B4A7]" />
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

          {/* Cashier Printer Tab */}
          <TabsContent value="printer" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-[24px] border border-[#EBE3D8] shadow-sm overflow-hidden bg-[#FFFFFF]">
                <CardHeader className="pb-3 border-b border-[#EBE3D8] bg-[#FAF8F5]">
                  <CardTitle className="text-sm flex items-center gap-2 text-[#1C1411] font-black">
                    <Bluetooth className="w-4 h-4 text-[#B38250]" />
                    ربط طابعة الكاشير (بلوتوث)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {!btSupported && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 leading-relaxed" data-testid="printer-bt-unsupported">
                      <div className="font-bold mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> متصفحك لا يدعم البلوتوث</div>
                      البحث عن الطابعات عبر البلوتوث يعمل على متصفح <strong>Chrome</strong> أو <strong>Edge</strong> على أجهزة أندرويد والكمبيوتر.
                      غير مدعوم حالياً على أجهزة آبل (iPhone / iPad — متصفح Safari).
                    </div>
                  )}

                  <div className={`rounded-xl border p-4 ${printerConnected ? "bg-emerald-50 border-emerald-200" : "bg-[#FAF8F5] border-[#EBE3D8]"}`} data-testid="printer-status-box">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${printerConnected ? "bg-emerald-100" : "bg-[#EBE3D8]"}`}>
                        {printerConnected
                          ? <BluetoothConnected className="w-5 h-5 text-emerald-600" />
                          : <Printer className="w-5 h-5 text-[#A69587]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[#1C1411] truncate" data-testid="printer-name">
                          {savedPrinter ? savedPrinter.name : "لا توجد طابعة مرتبطة"}
                        </div>
                        <div className={`text-[11px] font-bold ${printerConnected ? "text-emerald-600" : "text-[#A69587]"}`} data-testid="printer-status">
                          {printerConnected ? "متصلة الآن وجاهزة للطباعة" : savedPrinter ? "مرتبطة سابقاً — غير متصلة حالياً" : "اضغط بحث عن طابعات للبدء"}
                        </div>
                      </div>
                      {printerConnected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleScanConnect}
                      disabled={!btSupported || printerBusy !== null}
                      className="bg-[#1C1411] hover:bg-[#2A1F19] text-[#D4A373] rounded-xl gap-2 h-10 font-bold"
                      data-testid="button-scan-printers"
                    >
                      {printerBusy === "scan" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      بحث عن طابعات
                    </Button>
                    {savedPrinter && !printerConnected && (
                      <Button
                        onClick={handleReconnect}
                        disabled={!btSupported || printerBusy !== null}
                        variant="outline"
                        className="rounded-xl gap-2 h-10 font-bold border-[#D4A373] text-[#B38250]"
                        data-testid="button-reconnect-printer"
                      >
                        {printerBusy === "reconnect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
                        إعادة الاتصال
                      </Button>
                    )}
                    {printerConnected && (
                      <Button
                        onClick={handleTestPrint}
                        disabled={printerBusy !== null}
                        variant="outline"
                        className="rounded-xl gap-2 h-10 font-bold border-emerald-300 text-emerald-700"
                        data-testid="button-test-print"
                      >
                        {printerBusy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                        طباعة تجريبية
                      </Button>
                    )}
                    {savedPrinter && (
                      <Button
                        onClick={handleForgetPrinter}
                        disabled={printerBusy !== null}
                        variant="outline"
                        className="rounded-xl gap-2 h-10 font-bold border-red-200 text-red-600"
                        data-testid="button-forget-printer"
                      >
                        <Unlink className="w-4 h-4" />
                        إلغاء الربط
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#5C422E] mb-2 block">عرض ورق الطابعة</label>
                    <div className="flex gap-2">
                      {(["80", "58"] as PaperWidth[]).map((w) => (
                        <button
                          key={w}
                          onClick={() => { setPaperWidth(w); setPaperWidthState(w); }}
                          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${paperWidth === w ? "bg-[#1C1411] text-[#D4A373] border-[#1C1411]" : "bg-white text-[#A69587] border-[#EBE3D8] hover:border-[#D4A373]"}`}
                          data-testid={`button-paper-${w}`}
                        >
                          {w} ملم
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#A69587] mt-1">أغلب طابعات الكاشير الصغيرة 58 ملم، وطابعات الكاونتر 80 ملم.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[24px] border border-[#EBE3D8] shadow-sm overflow-hidden bg-[#FFFFFF]">
                <CardHeader className="pb-3 border-b border-[#EBE3D8] bg-[#FAF8F5]">
                  <CardTitle className="text-sm flex items-center gap-2 text-[#1C1411] font-black">
                    <Wifi className="w-4 h-4 text-[#B38250]" />
                    ملاحظات مهمة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs text-[#5C422E] leading-relaxed">
                  <div className="bg-[#FAF8F5] border border-[#EBE3D8] rounded-xl p-3">
                    <div className="font-bold mb-1">كيف يعمل الربط؟</div>
                    ١. شغّل الطابعة وفعّل البلوتوث فيها. ٢. اضغط "بحث عن طابعات" واختر الطابعة من القائمة. ٣. اضغط "طباعة تجريبية" للتأكد. بعدها ستجد زر "طباعة بلوتوث" في شاشة الفاتورة يطبع مباشرة على الطابعة بدون نافذة الطباعة.
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#EBE3D8] rounded-xl p-3">
                    <div className="font-bold mb-1">المتصفحات المدعومة</div>
                    Chrome أو Edge على أندرويد والكمبيوتر. أجهزة آبل (iPhone/iPad) لا تسمح للمتصفح بالوصول للبلوتوث — على الآيباد استخدم زر "طباعة" العادي مع تطبيق الطابعة أو AirPrint.
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#EBE3D8] rounded-xl p-3">
                    <div className="font-bold mb-1">طابعات الواي فاي</div>
                    المتصفح لا يستطيع الاتصال المباشر بطابعات الشبكة (واي فاي). إذا كانت طابعتك واي فاي: عرّفها على نفس الجهاز (كمبيوتر/تابلت) كطابعة نظام ثم استخدم زر "طباعة" العادي وستظهر ضمن قائمة الطابعات.
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#EBE3D8] rounded-xl p-3">
                    <div className="font-bold mb-1">الطباعة بالعربي</div>
                    النظام يطبع الإيصال كصورة، لذلك تظهر الأسماء العربية بشكل صحيح حتى لو كانت الطابعة لا تدعم العربية.
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