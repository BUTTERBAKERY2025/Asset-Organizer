import { useState, useRef, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Package, AlertTriangle, Plus, Camera, Trash2, Check, X, 
  FileText, TrendingDown, Clock, Building2, Calendar, CheckCircle2, User,
  Eye, Printer, FileDown, Hash
} from "lucide-react";
import { TablePagination } from "@/components/ui/pagination";
import { ExportButtons } from "@/components/export-buttons";
import { ProductSelector } from "@/components/product-selector";
import { WASTE_REASON_LABELS, DISPLAY_BAR_CATEGORY_LABELS } from "@shared/schema";
import type { Branch, Product, WasteReport, WasteItem } from "@shared/schema";

interface AddedReceiptItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  time: string;
}

const WASTE_REASONS = [
  { value: "expired", label: "منتهي الصلاحية" },
  { value: "damaged", label: "تالف" },
  { value: "quality_issue", label: "مشكلة جودة" },
  { value: "overproduction", label: "إنتاج زائد" },
  { value: "other", label: "أخرى" },
];

export default function DisplayBarWastePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [receiptBranch, setReceiptBranch] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("receipts");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showWasteDialog, setShowWasteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [receiptForm, setReceiptForm] = useState({
    productId: "",
    quantity: "",
    notes: "",
  });

  const [addedReceiptItems, setAddedReceiptItems] = useState<AddedReceiptItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showReceiptDialog) {
      setAddedReceiptItems([]);
    }
  }, [showReceiptDialog]);

  const [wasteForm, setWasteForm] = useState({
    productId: "",
    quantity: "",
    wasteReason: "expired",
    reasonDetails: "",
    imageUrl: "",
  });

  const [selectedWasteReportId, setSelectedWasteReportId] = useState<number | null>(null);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<any | null>(null);
  const [showReceiptDetailDialog, setShowReceiptDetailDialog] = useState(false);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["/api/display-bar/receipts", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/display-bar/receipts?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: wasteReports = [] } = useQuery<WasteReport[]>({
    queryKey: ["/api/waste-reports", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) {
        params.append("dateFrom", selectedDate);
        params.append("dateTo", selectedDate);
      }
      const res = await fetch(`/api/waste-reports?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: wasteStats } = useQuery({
    queryKey: ["/api/waste-reports/stats"],
  });

  const createReceiptMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/display-bar/receipts", data),
    onSuccess: (result: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/display-bar/receipts"] });
      const product = products.find(p => p.id === variables.productId);
      setAddedReceiptItems(prev => [...prev, {
        id: Date.now(),
        productId: variables.productId,
        productName: product?.name || "منتج",
        quantity: variables.quantity,
        time: variables.receiptTime,
      }]);
      setReceiptForm({ productId: "", quantity: "", notes: "" });
      toast({ title: "تم إضافة الصنف بنجاح", description: "يمكنك إضافة صنف آخر" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const createWasteReportMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/waste-reports", data),
    onSuccess: (report: any) => {
      setSelectedWasteReportId(report.id);
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      toast({ title: "تم إنشاء تقرير الهالك" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const addWasteItemMutation = useMutation({
    mutationFn: async ({ reportId, data }: { reportId: number; data: any }) => 
      apiRequest("POST", `/api/waste-reports/${reportId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      setWasteForm({ productId: "", quantity: "", wasteReason: "expired", reasonDetails: "", imageUrl: "" });
      toast({ title: "تم إضافة الصنف التالف" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const updateWasteReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => 
      apiRequest("PATCH", `/api/waste-reports/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      toast({ title: "تم تحديث التقرير" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const handleReceiptSubmit = () => {
    if (!receiptForm.productId || !receiptForm.quantity || !receiptBranch) {
      toast({ title: "يرجى اختيار الفرع والمنتج والكمية", variant: "destructive" });
      return;
    }
    createReceiptMutation.mutate({
      branchId: receiptBranch,
      productId: parseInt(receiptForm.productId),
      quantity: parseInt(receiptForm.quantity),
      receiptDate: new Date().toISOString().split("T")[0],
      receiptTime: new Date().toTimeString().slice(0, 5),
      notes: receiptForm.notes,
      createdBy: user?.id,
    });
  };

  const handleCreateWasteReport = () => {
    createWasteReportMutation.mutate({
      branchId: selectedBranch === "all" ? branches[0]?.id : selectedBranch,
      reportDate: selectedDate,
      status: "draft",
    });
  };

  const handleAddWasteItem = () => {
    if (!selectedWasteReportId || !wasteForm.productId || !wasteForm.quantity) {
      toast({ title: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    const product = products.find(p => p.id === parseInt(wasteForm.productId));
    addWasteItemMutation.mutate({
      reportId: selectedWasteReportId,
      data: {
        productId: parseInt(wasteForm.productId),
        quantity: parseInt(wasteForm.quantity),
        unitPrice: product?.basePrice || 0,
        totalValue: (product?.basePrice || 0) * parseInt(wasteForm.quantity),
        wasteReason: wasteForm.wasteReason,
        reasonDetails: wasteForm.reasonDetails,
        imageUrl: wasteForm.imageUrl,
      },
    });
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setWasteForm(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getProductName = (productId: number) => products.find(p => p.id === productId)?.name || "-";
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "-";

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      submitted: "bg-blue-100 text-blue-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      draft: "مسودة",
      submitted: "مرسل",
      approved: "معتمد",
      rejected: "مرفوض",
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const filteredReceipts = receipts;
  const filteredWasteReports = wasteReports;

  const receiptOrders = useMemo(() => {
    const orderMap: Record<string, any> = {};
    filteredReceipts.forEach((r: any) => {
      const key = `${r.branchId}_${r.receiptDate}_${r.createdBy || 'unknown'}`;
      if (!orderMap[key]) {
        orderMap[key] = {
          id: key,
          orderNumber: Object.keys(orderMap).length + 1,
          branchId: r.branchId,
          branchName: getBranchName(r.branchId),
          receiptDate: r.receiptDate,
          createdBy: r.createdBy,
          createdByName: r.createdByName || user?.username || "غير معروف",
          items: [],
          totalQuantity: 0,
          firstTime: r.receiptTime,
          lastTime: r.receiptTime,
        };
      }
      const itemIndex = orderMap[key].items.length + 1;
      orderMap[key].items.push({
        ...r,
        index: itemIndex,
        productName: getProductName(r.productId),
      });
      orderMap[key].totalQuantity += r.quantity || 0;
      if (r.receiptTime < orderMap[key].firstTime) orderMap[key].firstTime = r.receiptTime;
      if (r.receiptTime > orderMap[key].lastTime) orderMap[key].lastTime = r.receiptTime;
    });
    return Object.values(orderMap).sort((a: any, b: any) => 
      b.lastTime.localeCompare(a.lastTime)
    );
  }, [filteredReceipts, branches, products, user]);

  const paginatedReceiptOrders = receiptOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedWasteReports = filteredWasteReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const receiptExportColumns = [
    { header: "التاريخ", key: "receiptDate", width: 12 },
    { header: "الوقت", key: "receiptTime", width: 10 },
    { header: "المنتج", key: "productName", width: 25 },
    { header: "الكمية", key: "quantity", width: 10 },
    { header: "الفرع", key: "branchName", width: 15 },
    { header: "ملاحظات", key: "notes", width: 25 },
  ];

  const wasteExportColumns = [
    { header: "التاريخ", key: "reportDate", width: 12 },
    { header: "الفرع", key: "branchName", width: 15 },
    { header: "عدد الأصناف", key: "totalItems", width: 12 },
    { header: "إجمالي القيمة", key: "totalValue", width: 15 },
    { header: "الحالة", key: "statusLabel", width: 10 },
    { header: "المسجل", key: "reporterName", width: 20 },
  ];

  const receiptsExportData = filteredReceipts.map((r: any) => ({
    ...r,
    productName: getProductName(r.productId),
    branchName: getBranchName(r.branchId),
  }));

  const wasteExportData = filteredWasteReports.map((r: WasteReport) => ({
    ...r,
    branchName: getBranchName(r.branchId),
    statusLabel: r.status === "draft" ? "مسودة" : r.status === "submitted" ? "مرسل" : r.status === "approved" ? "معتمد" : "مرفوض",
  }));

  return (
    <Layout>
      <div className="space-y-5" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              بار العرض والهالك
            </h1>
            <p className="text-sm text-muted-foreground">إدارة استلام الإنتاج ومتابعة الهالك اليومي</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-40 h-9" data-testid="select-branch">
                <Building2 className="w-4 h-4 ml-2" />
                <SelectValue placeholder="الفرع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40 h-9"
              data-testid="input-date"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-700">{receiptOrders.length}</div>
                  <div className="text-[11px] text-blue-600/70">أوامر استلام</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-green-700">
                    {filteredReceipts.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)}
                  </div>
                  <div className="text-[11px] text-green-600/70">وحدات مستلمة</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50/50 border-red-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-red-700">{filteredWasteReports.length}</div>
                  <div className="text-[11px] text-red-600/70">تقارير الهالك</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50/50 border-amber-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-700">
                    {filteredWasteReports.reduce((sum: number, r: WasteReport) => sum + (r.totalValue || 0), 0).toLocaleString()} ر.س
                  </div>
                  <div className="text-[11px] text-amber-600/70">قيمة الهالك</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="receipts" className="gap-1">
                <Package className="w-4 h-4" />
                استلام الإنتاج
              </TabsTrigger>
              <TabsTrigger value="waste" className="gap-1">
                <AlertTriangle className="w-4 h-4" />
                تقارير الهالك
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              {activeTab === "receipts" && (
                <>
                  <ExportButtons
                    data={receiptsExportData}
                    columns={receiptExportColumns}
                    fileName={`استلام_الانتاج_${selectedDate}`}
                    title="تقرير استلام الإنتاج"
                    subtitle={`التاريخ: ${selectedDate}`}
                  />
                  <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1" data-testid="btn-add-receipt">
                        <Plus className="w-4 h-4" />
                        استلام جديد
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-lg">استلام إنتاج جديد</DialogTitle>
                      </DialogHeader>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gradient-to-l from-primary/5 to-primary/10 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الفرع</p>
                            <Select value={receiptBranch} onValueChange={setReceiptBranch}>
                              <SelectTrigger className="h-7 text-xs w-[120px] border-0 bg-white/50 p-1">
                                <SelectValue placeholder="اختر الفرع" />
                              </SelectTrigger>
                              <SelectContent>
                                {branches.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">المسؤول</p>
                            <p className="text-sm font-medium">{user?.username || "غير معروف"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">التاريخ</p>
                            <p className="text-sm font-medium">{currentTime.toLocaleDateString('en-GB')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الوقت</p>
                            <p className="text-sm font-medium">{currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-4">
                          <div className="bg-muted/30 p-4 rounded-lg border">
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <Plus className="w-4 h-4 text-primary" />
                              إضافة صنف سريع
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs">المنتج (ابحث بالاسم أو الكود)</Label>
                                <ProductSelector
                                  products={products.filter(p => p.isActive !== "false")}
                                  value={receiptForm.productId}
                                  onSelect={(id) => setReceiptForm(f => ({ ...f, productId: id }))}
                                  placeholder="ابحث عن المنتج..."
                                  showPrice={true}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">الكمية</Label>
                                  <Input
                                    type="number"
                                    value={receiptForm.quantity}
                                    onChange={(e) => setReceiptForm(f => ({ ...f, quantity: e.target.value }))}
                                    placeholder="الكمية"
                                    data-testid="input-quantity-receipt"
                                    className="h-10 text-center text-lg font-semibold"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">ملاحظات</Label>
                                  <Input
                                    value={receiptForm.notes}
                                    onChange={(e) => setReceiptForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="اختياري"
                                    data-testid="input-notes-receipt"
                                    className="h-10"
                                  />
                                </div>
                              </div>
                              <Button 
                                onClick={handleReceiptSubmit} 
                                className="w-full gap-2 h-11" 
                                disabled={createReceiptMutation.isPending || !receiptForm.productId || !receiptForm.quantity || !receiptBranch}
                              >
                                {createReceiptMutation.isPending ? (
                                  <>جاري الإضافة...</>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4" />
                                    إضافة الصنف
                                  </>
                                )}
                              </Button>
                              {!receiptBranch && (
                                <p className="text-xs text-destructive text-center">يرجى اختيار الفرع أولاً</p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              الأصناف المضافة
                            </h4>
                            <Badge variant="secondary">{addedReceiptItems.length} صنف</Badge>
                          </div>
                          
                          {addedReceiptItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">لم يتم إضافة أصناف بعد</p>
                              <p className="text-xs">اختر المنتج والكمية ثم اضغط إضافة</p>
                            </div>
                          ) : (
                            <ScrollArea className="h-[280px] border rounded-lg">
                              <div className="p-2 space-y-2">
                                {addedReceiptItems.map((item, index) => (
                                  <div 
                                    key={item.id} 
                                    className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
                                        {index + 1}
                                      </div>
                                      <div>
                                        <div className="font-medium text-sm">{item.productName}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {item.time}
                                        </div>
                                      </div>
                                    </div>
                                    <Badge className="bg-green-600">{item.quantity} وحدة</Badge>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                          
                          {addedReceiptItems.length > 0 && (
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => setShowReceiptDialog(false)}
                              >
                                إنهاء وإغلاق
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              {activeTab === "waste" && (
                <>
                  <ExportButtons
                    data={wasteExportData}
                    columns={wasteExportColumns}
                    fileName={`تقرير_الهالك_${selectedDate}`}
                    title="تقرير الهالك اليومي"
                    subtitle={`التاريخ: ${selectedDate}`}
                  />
                  <Dialog open={showWasteDialog} onOpenChange={setShowWasteDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="gap-1" data-testid="btn-add-waste">
                        <AlertTriangle className="w-4 h-4" />
                        تقرير هالك جديد
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>إنشاء تقرير هالك جديد</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        {!selectedWasteReportId ? (
                          <div className="text-center py-6">
                            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                            <p className="text-muted-foreground mb-4">سيتم إنشاء تقرير هالك جديد للتاريخ {selectedDate}</p>
                            <Button onClick={handleCreateWasteReport} disabled={createWasteReportMutation.isPending}>
                              {createWasteReportMutation.isPending ? "جاري الإنشاء..." : "إنشاء التقرير"}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
                              تم إنشاء التقرير. يمكنك الآن إضافة الأصناف التالفة.
                            </div>
                            <div>
                              <Label>المنتج التالف</Label>
                              <ProductSelector
                                  products={products.filter(p => p.isActive !== "false")}
                                  value={wasteForm.productId}
                                  onSelect={(id) => setWasteForm(f => ({ ...f, productId: id }))}
                                  placeholder="ابحث عن المنتج..."
                                  showPrice={true}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>الكمية</Label>
                                <Input
                                  type="number"
                                  value={wasteForm.quantity}
                                  onChange={(e) => setWasteForm(f => ({ ...f, quantity: e.target.value }))}
                                  placeholder="الكمية"
                                  data-testid="input-quantity-waste"
                                />
                              </div>
                              <div>
                                <Label>سبب الإتلاف</Label>
                                <Select value={wasteForm.wasteReason} onValueChange={(v) => setWasteForm(f => ({ ...f, wasteReason: v }))}>
                                  <SelectTrigger data-testid="select-reason">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WASTE_REASONS.map(r => (
                                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label>تفاصيل إضافية</Label>
                              <Textarea
                                value={wasteForm.reasonDetails}
                                onChange={(e) => setWasteForm(f => ({ ...f, reasonDetails: e.target.value }))}
                                placeholder="وصف حالة المنتج..."
                                data-testid="input-details-waste"
                              />
                            </div>
                            <div>
                              <Label>صورة المنتج التالف</Label>
                              <div className="mt-2">
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={handleImageCapture}
                                  className="hidden"
                                />
                                {wasteForm.imageUrl ? (
                                  <div className="relative">
                                    <img src={wasteForm.imageUrl} alt="صورة المنتج" className="w-full h-40 object-cover rounded-lg" />
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="absolute top-2 left-2"
                                      onClick={() => setWasteForm(f => ({ ...f, imageUrl: "" }))}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    className="w-full h-24 border-dashed"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Camera className="w-6 h-6 ml-2" />
                                    التقاط صورة
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Button onClick={handleAddWasteItem} className="w-full" disabled={addWasteItemMutation.isPending}>
                              {addWasteItemMutation.isPending ? "جاري الإضافة..." : "إضافة الصنف التالف"}
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setShowWasteDialog(false);
                                setSelectedWasteReportId(null);
                              }}
                            >
                              إنهاء وإغلاق
                            </Button>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          <TabsContent value="receipts" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-right font-medium">رقم الأمر</th>
                        <th className="p-3 text-right font-medium">الفرع</th>
                        <th className="p-3 text-right font-medium">المستلم</th>
                        <th className="p-3 text-right font-medium">التاريخ</th>
                        <th className="p-3 text-right font-medium">الوقت</th>
                        <th className="p-3 text-right font-medium">عدد الأصناف</th>
                        <th className="p-3 text-right font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedReceiptOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            لا توجد أوامر استلام لهذا اليوم
                          </td>
                        </tr>
                      ) : (
                        paginatedReceiptOrders.map((order: any, index: number) => (
                          <tr key={order.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedReceiptOrder(order); setShowReceiptDetailDialog(true); }}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Hash className="w-4 h-4 text-primary" />
                                </div>
                                <span className="font-bold text-primary">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="gap-1">
                                <Building2 className="w-3 h-3" />
                                {order.branchName}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-muted-foreground" />
                                {order.createdByName}
                              </div>
                            </td>
                            <td className="p-3">{order.receiptDate}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {order.firstTime} - {order.lastTime}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge className="bg-green-100 text-green-700">{order.items.length} صنف</Badge>
                              <span className="text-xs text-muted-foreground mr-2">({order.totalQuantity} وحدة)</span>
                            </td>
                            <td className="p-3">
                              <Button size="sm" variant="ghost" className="gap-1" onClick={(e) => { e.stopPropagation(); setSelectedReceiptOrder(order); setShowReceiptDetailDialog(true); }}>
                                <Eye className="w-4 h-4" />
                                عرض
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {receiptOrders.length > itemsPerPage && (
                  <div className="p-3 border-t">
                    <TablePagination
                      currentPage={currentPage}
                      totalItems={receiptOrders.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <Dialog open={showReceiptDetailDialog} onOpenChange={setShowReceiptDetailDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    سند استلام إنتاج للعرض
                  </span>
                  <div className="flex gap-2">
                    <ExportButtons
                      data={selectedReceiptOrder?.items || []}
                      columns={[
                        { header: "#", key: "index", width: 5 },
                        { header: "الصنف", key: "productName", width: 30 },
                        { header: "الكمية", key: "quantity", width: 10 },
                        { header: "الوقت", key: "receiptTime", width: 10 },
                        { header: "ملاحظات", key: "notes", width: 25 },
                      ]}
                      fileName={`سند_استلام_${selectedReceiptOrder?.orderNumber || ''}`}
                      title="سند استلام إنتاج للعرض"
                      subtitle={`فرع ${selectedReceiptOrder?.branchName || ''}`}
                      headerInfo={selectedReceiptOrder ? [
                        { label: "رقم السند", value: `#${selectedReceiptOrder.orderNumber}` },
                        { label: "الفرع", value: selectedReceiptOrder.branchName },
                        { label: "المستلم", value: selectedReceiptOrder.createdByName },
                        { label: "التاريخ", value: selectedReceiptOrder.receiptDate },
                        { label: "وقت البداية", value: selectedReceiptOrder.firstTime },
                        { label: "وقت النهاية", value: selectedReceiptOrder.lastTime },
                        { label: "عدد الأصناف", value: `${selectedReceiptOrder.items.length} صنف` },
                        { label: "إجمالي الوحدات", value: `${selectedReceiptOrder.totalQuantity} وحدة` },
                      ] : []}
                    />
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              {selectedReceiptOrder && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gradient-to-l from-primary/5 to-primary/10 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Hash className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">رقم السند</p>
                        <p className="text-lg font-bold text-primary">#{selectedReceiptOrder.orderNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الفرع</p>
                        <p className="font-medium">{selectedReceiptOrder.branchName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">المستلم</p>
                        <p className="font-medium">{selectedReceiptOrder.createdByName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">التاريخ والوقت</p>
                        <p className="font-medium">{selectedReceiptOrder.receiptDate}</p>
                        <p className="text-xs text-muted-foreground">{selectedReceiptOrder.firstTime} - {selectedReceiptOrder.lastTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 font-semibold flex items-center justify-between">
                      <span>الأصناف المستلمة</span>
                      <Badge variant="secondary">{selectedReceiptOrder.items.length} صنف - {selectedReceiptOrder.totalQuantity} وحدة</Badge>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="p-3 text-right font-medium">#</th>
                          <th className="p-3 text-right font-medium">الصنف</th>
                          <th className="p-3 text-right font-medium">الكمية</th>
                          <th className="p-3 text-right font-medium">الوقت</th>
                          <th className="p-3 text-right font-medium">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedReceiptOrder.items.map((item: any, idx: number) => (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="p-3 text-muted-foreground">{idx + 1}</td>
                            <td className="p-3 font-medium">{item.productName}</td>
                            <td className="p-3">
                              <Badge variant="secondary">{item.quantity}</Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">{item.receiptTime}</td>
                            <td className="p-3 text-muted-foreground">{item.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-primary/5">
                        <tr>
                          <td colSpan={2} className="p-3 font-bold">الإجمالي</td>
                          <td className="p-3">
                            <Badge className="bg-primary text-white">{selectedReceiptOrder.totalQuantity} وحدة</Badge>
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowReceiptDetailDialog(false)}>
                      إغلاق
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <TabsContent value="waste" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-right font-medium">التاريخ</th>
                        <th className="p-3 text-right font-medium">الفرع</th>
                        <th className="p-3 text-right font-medium">عدد الأصناف</th>
                        <th className="p-3 text-right font-medium">إجمالي القيمة</th>
                        <th className="p-3 text-right font-medium">الحالة</th>
                        <th className="p-3 text-right font-medium">المسجل</th>
                        <th className="p-3 text-right font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedWasteReports.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            لا توجد تقارير هالك لهذا اليوم
                          </td>
                        </tr>
                      ) : (
                        paginatedWasteReports.map((report) => (
                          <tr key={report.id} className="hover:bg-muted/30">
                            <td className="p-3">{report.reportDate}</td>
                            <td className="p-3">{getBranchName(report.branchId)}</td>
                            <td className="p-3">
                              <Badge variant="outline">{report.totalItems}</Badge>
                            </td>
                            <td className="p-3 font-medium text-red-600">
                              {(report.totalValue || 0).toLocaleString()} ر.س
                            </td>
                            <td className="p-3">{getStatusBadge(report.status)}</td>
                            <td className="p-3">{report.reporterName || "-"}</td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                {report.status === "draft" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateWasteReportMutation.mutate({ id: report.id, data: { status: "submitted" } })}
                                  >
                                    إرسال
                                  </Button>
                                )}
                                {report.status === "submitted" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateWasteReportMutation.mutate({ id: report.id, data: { status: "approved" } })}
                                  >
                                    اعتماد
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredWasteReports.length > itemsPerPage && (
                  <div className="p-3 border-t">
                    <TablePagination
                      currentPage={currentPage}
                      totalItems={filteredWasteReports.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
