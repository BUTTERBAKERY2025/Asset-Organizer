import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch, Product } from "@shared/schema";
import { 
  Factory, Plus, Clock, Package, Trash2, RefreshCw, Calendar,
  Refrigerator, ShoppingCart, Snowflake, ChefHat, ArrowLeft,
  BarChart3, TrendingUp, FileSpreadsheet, User, Shield, FileText,
  Printer, Eye, AlertTriangle, CheckCircle2, Timer, Activity, PieChart
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import * as XLSX from "xlsx";

interface DailyProductionBatch {
  id: number;
  branchId: string;
  productId: number | null;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unit: string | null;
  destination: string;
  shiftId: number | null;
  productionOrderId: number | null;
  producedAt: string;
  recordedBy: string | null;
  recorderName: string | null;
  notes: string | null;
  createdAt: string;
}

interface DailyStats {
  totalBatches: number;
  totalQuantity: number;
  byDestination: Record<string, number>;
  byCategory: Record<string, number>;
  byHour: Record<string, number>;
}

const DESTINATIONS = [
  { value: "display_bar", label: "بار العرض", icon: ShoppingCart, color: "bg-green-100 text-green-800", bgClass: "from-green-500 to-emerald-600" },
  { value: "kitchen_trolley", label: "ترولي المطبخ", icon: ChefHat, color: "bg-amber-100 text-amber-800", bgClass: "from-amber-500 to-orange-600" },
  { value: "freezer", label: "الفريزر", icon: Snowflake, color: "bg-blue-100 text-blue-800", bgClass: "from-blue-500 to-indigo-600" },
  { value: "refrigerator", label: "الثلاجة", icon: Refrigerator, color: "bg-cyan-100 text-cyan-800", bgClass: "from-cyan-500 to-teal-600" },
];

const BAKERY_CATEGORIES = ["مخبوزات", "حلويات", "معجنات", "كيك", "خبز"];

const HOUR_LABELS: Record<string, string> = {
  "06": "6 صباحاً", "07": "7 صباحاً", "08": "8 صباحاً", "09": "9 صباحاً",
  "10": "10 صباحاً", "11": "11 صباحاً", "12": "12 ظهراً", "13": "1 مساءً",
  "14": "2 مساءً", "15": "3 مساءً", "16": "4 مساءً", "17": "5 مساءً",
  "18": "6 مساءً", "19": "7 مساءً", "20": "8 مساءً", "21": "9 مساءً",
  "22": "10 مساءً", "23": "11 مساءً", "00": "12 منتصف الليل",
};

export default function DailyProductionPage() {
  const [branchId, setBranchId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [productName, setProductName] = useState<string>("");
  const [productCategory, setProductCategory] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>("entry");
  const printRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);
  const { user, isAdmin } = useAuth();
  const { canEdit, canDelete, canApprove } = usePermissions();

  // Check if user can modify records (admin or has edit permission for production)
  const canModifyRecords = isAdmin || canEdit("production");
  const canDeleteRecords = isAdmin || canDelete("production");

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Auto-select first branch when branches load
  useEffect(() => {
    if (branches && branches.length > 0 && !branchId) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  const { data: batches, isLoading: batchesLoading, refetch: refetchBatches } = useQuery<DailyProductionBatch[]>({
    queryKey: ["/api/daily-production/batches", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (selectedDate) params.set("date", selectedDate);
      const res = await fetch(`/api/daily-production/batches?${params}`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    enabled: !!branchId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, date: selectedDate });
      const res = await fetch(`/api/daily-production/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!branchId && !!selectedDate,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/daily-production/batches", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats"] });
      setProductName("");
      setProductCategory("");
      setQuantity("");
      setDestination("");
      setNotes("");
      toast({ title: "تم تسجيل الدفعة بنجاح", description: `سجلها: ${user?.firstName || user?.username}` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/daily-production/batches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats"] });
      toast({ title: "تم حذف الدفعة" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !productName || !quantity || !destination) {
      toast({ title: "بيانات ناقصة", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    
    const numericQuantity = parseInt(quantity, 10);
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      toast({ title: "خطأ", description: "الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر", variant: "destructive" });
      return;
    }
    
    const product = products?.find(p => p.name === productName);
    createMutation.mutate({
      branchId,
      productId: product?.id || null,
      productName,
      productCategory: productCategory || product?.category || null,
      quantity: numericQuantity,
      unit: product?.unit || "قطعة",
      destination,
      notes: notes || null,
    });
  };

  const getDestinationInfo = (dest: string) => {
    return DESTINATIONS.find(d => d.value === dest) || { label: dest, color: "bg-gray-100 text-gray-800", icon: Package, bgClass: "from-gray-500 to-slate-600" };
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm", { locale: ar });
    } catch {
      return "";
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM HH:mm", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const formatFullDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy/MM/dd HH:mm:ss", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const getBranchName = (id: string) => branches?.find(b => b.id === id)?.name || id;

  const paginatedBatches = getPageItems(batches || [], currentPage);

  // Group batches by hour for timeline view
  const batchesByHour = (batches || []).reduce((acc, batch) => {
    const hour = format(new Date(batch.producedAt), "HH");
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(batch);
    return acc;
  }, {} as Record<string, DailyProductionBatch[]>);

  // Group batches by category
  const batchesByCategory = (batches || []).reduce((acc, batch) => {
    const cat = batch.productCategory || "غير مصنف";
    if (!acc[cat]) acc[cat] = { batches: [], totalQty: 0 };
    acc[cat].batches.push(batch);
    acc[cat].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  // Group batches by destination
  const batchesByDestination = (batches || []).reduce((acc, batch) => {
    if (!acc[batch.destination]) acc[batch.destination] = { batches: [], totalQty: 0 };
    acc[batch.destination].batches.push(batch);
    acc[batch.destination].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  // Group batches by recorder
  const batchesByRecorder = (batches || []).reduce((acc, batch) => {
    const recorder = batch.recorderName || "غير معروف";
    if (!acc[recorder]) acc[recorder] = { batches: [], totalQty: 0 };
    acc[recorder].batches.push(batch);
    acc[recorder].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  const exportToExcel = () => {
    if (!batches || batches.length === 0) return;
    
    const data = batches.map(b => ({
      "الوقت": formatFullDateTime(b.producedAt),
      "المنتج": b.productName,
      "الفئة": b.productCategory || "-",
      "الكمية": b.quantity,
      "الوحدة": b.unit || "قطعة",
      "الوجهة": getDestinationInfo(b.destination).label,
      "المسجل": b.recorderName || "-",
      "ملاحظات": b.notes || "-",
    }));

    // Add summary sheet
    const summaryData = [
      { "البيان": "الفرع", "القيمة": getBranchName(branchId) },
      { "البيان": "التاريخ", "القيمة": selectedDate },
      { "البيان": "إجمالي الدفعات", "القيمة": stats?.totalBatches || 0 },
      { "البيان": "إجمالي الكميات", "القيمة": stats?.totalQuantity || 0 },
      { "البيان": "", "القيمة": "" },
      { "البيان": "توزيع حسب الوجهة", "القيمة": "" },
      ...DESTINATIONS.map(d => ({
        "البيان": `  ${d.label}`,
        "القيمة": stats?.byDestination?.[d.value] || 0
      })),
    ];
    
    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(data);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص اليوم");
    XLSX.utils.book_append_sheet(wb, wsData, "تفاصيل الإنتاج");
    XLSX.writeFile(wb, `يومية-الإنتاج-${selectedDate}-${getBranchName(branchId)}.xlsx`);
    toast({ title: "تم تصدير التقرير" });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>يومية الإنتاج - ${selectedDate}</title>
        <style>
          * { font-family: 'Cairo', 'Segoe UI', sans-serif; }
          body { padding: 20px; direction: rtl; }
          h1 { text-align: center; color: #b45309; margin-bottom: 5px; }
          h2 { text-align: center; color: #666; margin-top: 0; font-weight: normal; }
          .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #fef3c7; border-radius: 8px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .stat-card { padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #b45309; }
          .stat-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background: #b45309; color: white; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px; }
          .section-title { background: #fef3c7; padding: 8px 15px; margin: 20px 0 10px; border-radius: 5px; font-weight: bold; }
          .recorder-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>يومية الإنتاج الفعلي</h1>
        <h2>${getBranchName(branchId)} - ${format(new Date(selectedDate), "EEEE dd MMMM yyyy", { locale: ar })}</h2>
        
        <div class="header-info">
          <span>وقت الطباعة: ${format(new Date(), "HH:mm:ss yyyy/MM/dd", { locale: ar })}</span>
          <span>المستخدم: ${user?.firstName || user?.username || "-"}</span>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats?.totalBatches || 0}</div>
            <div class="stat-label">إجمالي الدفعات</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.totalQuantity || 0}</div>
            <div class="stat-label">إجمالي الكميات</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.byDestination?.display_bar || 0}</div>
            <div class="stat-label">بار العرض</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(stats?.byDestination?.freezer || 0) + (stats?.byDestination?.refrigerator || 0)}</div>
            <div class="stat-label">التخزين</div>
          </div>
        </div>
        
        <div class="section-title">تفاصيل الإنتاج</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الوقت</th>
              <th>المنتج</th>
              <th>الفئة</th>
              <th>الكمية</th>
              <th>الوجهة</th>
              <th>المسجل</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${(batches || []).map((b, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${formatTime(b.producedAt)}</td>
                <td>${b.productName}</td>
                <td>${b.productCategory || "-"}</td>
                <td style="text-align: center; font-weight: bold;">${b.quantity}</td>
                <td>${getDestinationInfo(b.destination).label}</td>
                <td><span class="recorder-badge">${b.recorderName || "-"}</span></td>
                <td>${b.notes || "-"}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="section-title">ملخص حسب المسجلين</div>
        <table>
          <thead>
            <tr><th>المسجل</th><th>عدد الدفعات</th><th>إجمالي الكمية</th></tr>
          </thead>
          <tbody>
            ${Object.entries(batchesByRecorder).map(([name, data]) => `
              <tr>
                <td>${name}</td>
                <td style="text-align: center;">${data.batches.length}</td>
                <td style="text-align: center; font-weight: bold;">${data.totalQty}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>نظام باتر لإدارة المخابز - يومية الإنتاج الفعلي</p>
          <p>تم إنشاء هذا التقرير تلقائياً</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const bakeryProducts = products?.filter(p => BAKERY_CATEGORIES.includes(p.category)) || [];

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">الإنتاج الفعلي اليومي</h1>
              <p className="text-muted-foreground">تسجيل ومتابعة دفعات الإنتاج على مدار اليوم</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Badge variant="outline" className="gap-1 px-3 py-1.5">
                <User className="h-3 w-3" />
                {user.firstName || user.username}
                {isAdmin && <Shield className="h-3 w-3 text-amber-600 mr-1" />}
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label>الفرع *</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger data-testid="select-branch">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[160px]"
              data-testid="input-date"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchBatches()} data-testid="btn-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!batches?.length} data-testid="btn-export">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!batches?.length} data-testid="btn-print">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {branchId && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-r-4 border-r-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الدفعات</p>
                    <p className="text-2xl font-bold text-amber-700">{stats?.totalBatches || 0}</p>
                  </div>
                  <Package className="h-8 w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الكميات</p>
                    <p className="text-2xl font-bold text-green-700">{stats?.totalQuantity || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">بار العرض</p>
                    <p className="text-2xl font-bold text-blue-700">{stats?.byDestination?.display_bar || 0}</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-cyan-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">التخزين</p>
                    <p className="text-2xl font-bold text-cyan-700">
                      {(stats?.byDestination?.freezer || 0) + (stats?.byDestination?.refrigerator || 0)}
                    </p>
                  </div>
                  <Snowflake className="h-8 w-8 text-cyan-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="entry" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">تسجيل</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Timer className="h-4 w-4" />
              <span className="hidden sm:inline">الجدول الزمني</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">التقارير</span>
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">اليومية</span>
            </TabsTrigger>
          </TabsList>

          {/* Entry Tab */}
          <TabsContent value="entry" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Entry Form */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plus className="w-5 h-5 text-green-600" />
                    تسجيل دفعة جديدة
                  </CardTitle>
                  <CardDescription>سجل الإنتاج فور خروجه من المطبخ</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>المنتج *</Label>
                      <Select value={productName} onValueChange={(val) => {
                        setProductName(val);
                        const prod = products?.find(p => p.name === val);
                        if (prod?.category) setProductCategory(prod.category);
                      }}>
                        <SelectTrigger data-testid="select-product">
                          <SelectValue placeholder="اختر المنتج" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] overflow-y-auto">
                          {bakeryProducts.map((product) => (
                            <SelectItem key={product.id} value={product.name}>
                              {product.name} ({product.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="أو اكتب اسم المنتج"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        data-testid="input-product-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>الفئة</Label>
                      <Select value={productCategory} onValueChange={setProductCategory}>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          {BAKERY_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>الكمية *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="أدخل الكمية"
                        data-testid="input-quantity"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>الوجهة *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {DESTINATIONS.map((dest) => {
                          const Icon = dest.icon;
                          return (
                            <Button
                              key={dest.value}
                              type="button"
                              variant={destination === dest.value ? "default" : "outline"}
                              className={`h-auto py-3 flex flex-col gap-1 ${destination === dest.value ? "" : ""}`}
                              onClick={() => setDestination(dest.value)}
                              data-testid={`btn-dest-${dest.value}`}
                            >
                              <Icon className="h-5 w-5" />
                              <span className="text-xs">{dest.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>ملاحظات</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="ملاحظات إضافية (اختياري)"
                        rows={2}
                        data-testid="input-notes"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                      disabled={createMutation.isPending || !branchId}
                      data-testid="btn-submit"
                    >
                      {createMutation.isPending ? "جاري التسجيل..." : "تسجيل الدفعة"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Batches Table */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                    سجل الإنتاج اليوم
                  </CardTitle>
                  <CardDescription>
                    {batches?.length || 0} دفعة مسجلة في {selectedDate}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!branchId ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Factory className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>اختر الفرع لعرض سجل الإنتاج</p>
                    </div>
                  ) : batchesLoading ? (
                    <div className="space-y-3">
                      {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : !batches?.length ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>لا توجد دفعات مسجلة لهذا اليوم</p>
                      <p className="text-sm">ابدأ بتسجيل الإنتاج من النموذج</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-right">الوقت</TableHead>
                              <TableHead className="text-right">المنتج</TableHead>
                              <TableHead className="text-right">الفئة</TableHead>
                              <TableHead className="text-center">الكمية</TableHead>
                              <TableHead className="text-right">الوجهة</TableHead>
                              <TableHead className="text-right">المسجل</TableHead>
                              <TableHead className="text-left">إجراء</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedBatches.map((batch) => {
                              const destInfo = getDestinationInfo(batch.destination);
                              const DestIcon = destInfo.icon;
                              return (
                                <TableRow key={batch.id} className="hover:bg-muted/30" data-testid={`row-batch-${batch.id}`}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-muted-foreground" />
                                      {formatTime(batch.producedAt)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{batch.productName}</TableCell>
                                  <TableCell>
                                    {batch.productCategory && (
                                      <Badge variant="outline" className="text-xs">{batch.productCategory}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center font-bold">{batch.quantity}</TableCell>
                                  <TableCell>
                                    <Badge className={destInfo.color}>
                                      <DestIcon className="h-3 w-3 ml-1" />
                                      {destInfo.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                      <User className="h-3 w-3" />
                                      {batch.recorderName || "-"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {canDeleteRecords ? (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>حذف الدفعة</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              هل أنت متأكد من حذف دفعة "{batch.productName}"؟
                                              <br />
                                              <span className="text-xs text-muted-foreground">
                                                سجلها: {batch.recorderName || "-"} في {formatTime(batch.producedAt)}
                                              </span>
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                            <AlertDialogAction
                                              className="bg-red-600 hover:bg-red-700"
                                              onClick={() => deleteMutation.mutate(batch.id)}
                                            >
                                              حذف
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                                        <Shield className="h-3 w-3" />
                                        مقفل
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {batches.length > itemsPerPage && (
                        <TablePagination
                          currentPage={currentPage}
                          totalItems={batches.length}
                          itemsPerPage={itemsPerPage}
                          onPageChange={setCurrentPage}
                        />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Timer className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض الجدول الزمني</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد دفعات مسجلة لهذا اليوم</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-indigo-600" />
                      الجدول الزمني للإنتاج
                    </CardTitle>
                    <CardDescription>
                      عرض الإنتاج على مدار الساعات
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(batchesByHour)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([hour, hourBatches]) => (
                          <div key={hour} className="border-r-4 border-indigo-500 pr-4">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1">
                                <Clock className="h-3 w-3 ml-1" />
                                {HOUR_LABELS[hour] || `${hour}:00`}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {hourBatches.length} دفعة - {hourBatches.reduce((s, b) => s + b.quantity, 0)} قطعة
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {hourBatches.map((batch) => {
                                const destInfo = getDestinationInfo(batch.destination);
                                const DestIcon = destInfo.icon;
                                return (
                                  <div
                                    key={batch.id}
                                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                                  >
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${destInfo.bgClass}`}>
                                      <DestIcon className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{batch.productName}</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{formatTime(batch.producedAt)}</span>
                                        <span>•</span>
                                        <span className="font-bold text-foreground">{batch.quantity}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {batch.recorderName || "-"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض التقارير</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد بيانات لإنشاء التقارير</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Destination */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="w-5 h-5 text-green-600" />
                      توزيع حسب الوجهة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {DESTINATIONS.map((dest) => {
                        const data = batchesByDestination[dest.value];
                        const percentage = stats?.totalQuantity 
                          ? Math.round((data?.totalQty || 0) / stats.totalQuantity * 100) 
                          : 0;
                        const Icon = dest.icon;
                        return (
                          <div key={dest.value} className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${dest.bgClass}`}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-sm">{dest.label}</span>
                                <span className="text-sm text-muted-foreground">
                                  {data?.totalQty || 0} قطعة ({percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${dest.bgClass}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* By Category */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <PieChart className="w-5 h-5 text-purple-600" />
                      توزيع حسب الفئة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(batchesByCategory)
                        .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                        .map(([category, data]) => {
                          const percentage = stats?.totalQuantity 
                            ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                            : 0;
                          return (
                            <div key={category} className="flex items-center gap-3">
                              <Badge variant="outline" className="min-w-[80px] justify-center">
                                {category}
                              </Badge>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-muted-foreground">
                                    {data.batches.length} دفعة
                                  </span>
                                  <span className="font-medium">
                                    {data.totalQty} قطعة ({percentage}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-600"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                {/* By Recorder */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="w-5 h-5 text-blue-600" />
                      الإنتاج حسب المسجل
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(batchesByRecorder)
                        .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                        .map(([recorder, data]) => {
                          const percentage = stats?.totalQuantity 
                            ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                            : 0;
                          return (
                            <div key={recorder} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="p-2 bg-blue-100 rounded-full">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{recorder}</span>
                                  <Badge variant="secondary">{data.totalQty} قطعة</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {data.batches.length} دفعة • {percentage}% من الإجمالي
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                {/* Hourly Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      توزيع الإنتاج على الساعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats?.byHour || {})
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([hour, qty]) => (
                          <div key={hour} className="text-center p-3 bg-indigo-50 rounded-lg min-w-[70px]">
                            <p className="text-lg font-bold text-indigo-700">{qty}</p>
                            <p className="text-xs text-indigo-600">{HOUR_LABELS[hour] || `${hour}:00`}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Daily Journal Tab */}
          <TabsContent value="journal" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض يومية الإنتاج</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد بيانات لإنشاء اليومية</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6" ref={printRef}>
                {/* Journal Header */}
                <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                  <CardContent className="p-6">
                    <div className="text-center mb-4">
                      <h2 className="text-2xl font-bold text-amber-800">يومية الإنتاج الفعلي</h2>
                      <p className="text-amber-700">
                        {getBranchName(branchId)} - {format(new Date(selectedDate), "EEEE dd MMMM yyyy", { locale: ar })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-amber-700">{stats?.totalBatches || 0}</p>
                        <p className="text-sm text-amber-600">إجمالي الدفعات</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-green-700">{stats?.totalQuantity || 0}</p>
                        <p className="text-sm text-green-600">إجمالي القطع</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-blue-700">{Object.keys(batchesByRecorder).length}</p>
                        <p className="text-sm text-blue-600">عدد المسجلين</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-purple-700">{Object.keys(batchesByHour).length}</p>
                        <p className="text-sm text-purple-600">ساعات العمل</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" />
                        تفاصيل الإنتاج
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportToExcel}>
                          <FileSpreadsheet className="h-4 w-4 ml-2" />
                          تصدير Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                          <Printer className="h-4 w-4 ml-2" />
                          طباعة
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-amber-50">
                            <TableHead className="text-right font-bold">#</TableHead>
                            <TableHead className="text-right font-bold">الوقت</TableHead>
                            <TableHead className="text-right font-bold">المنتج</TableHead>
                            <TableHead className="text-right font-bold">الفئة</TableHead>
                            <TableHead className="text-center font-bold">الكمية</TableHead>
                            <TableHead className="text-right font-bold">الوجهة</TableHead>
                            <TableHead className="text-right font-bold">المسجل</TableHead>
                            <TableHead className="text-right font-bold">ملاحظات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batches.map((batch, index) => {
                            const destInfo = getDestinationInfo(batch.destination);
                            const DestIcon = destInfo.icon;
                            return (
                              <TableRow key={batch.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {formatTime(batch.producedAt)}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{batch.productName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {batch.productCategory || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{batch.quantity}</TableCell>
                                <TableCell>
                                  <Badge className={destInfo.color}>
                                    <DestIcon className="h-3 w-3 ml-1" />
                                    {destInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="gap-1">
                                    <User className="h-3 w-3" />
                                    {batch.recorderName || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                                  {batch.notes || "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary by Recorders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      ملخص حسب المسجلين
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50">
                          <TableHead className="text-right font-bold">المسجل</TableHead>
                          <TableHead className="text-center font-bold">عدد الدفعات</TableHead>
                          <TableHead className="text-center font-bold">إجمالي الكمية</TableHead>
                          <TableHead className="text-center font-bold">النسبة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(batchesByRecorder)
                          .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                          .map(([recorder, data]) => {
                            const percentage = stats?.totalQuantity 
                              ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                              : 0;
                            return (
                              <TableRow key={recorder}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    {recorder}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{data.batches.length}</TableCell>
                                <TableCell className="text-center font-bold">{data.totalQty}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{percentage}%</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Permission Notice */}
                {!canModifyRecords && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="font-medium text-amber-800">ملاحظة هامة</p>
                          <p className="text-sm text-amber-700">
                            لا يمكنك تعديل أو حذف السجلات بعد إدخالها. يرجى التواصل مع المشرف أو المدير للتعديلات.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
