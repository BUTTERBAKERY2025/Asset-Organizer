import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { format, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import {
  BarChart3,
  Upload,
  FileSpreadsheet,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  ArrowLeft,
  RefreshCw,
  Download,
  Filter,
  Snowflake,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Info,
  Tag,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { COMPARISON_CATEGORIES, COMPARISON_STATUS, MADE_TO_ORDER_CATEGORIES, type Branch, type DailyComparison, type ComparisonSummary } from "@shared/schema";

// Categories included in comparison (excluding made-to-order like drinks/pizza)
const COMPARABLE_CATEGORIES = COMPARISON_CATEGORIES.filter(
  cat => !(MADE_TO_ORDER_CATEGORIES as readonly string[]).includes(cat)
);

const CATEGORY_COLORS: Record<string, string> = {
  "إفطار": "#f59e0b",
  "مخبوزات": "#10b981",
  "حلويات": "#ec4899",
  "بيتزا": "#ef4444",
  "باريستا": "#8b5cf6",
  "تجمعات": "#06b6d4",
  "أخرى": "#6b7280",
};

const STATUS_COLORS = {
  normal: "#10b981",
  waste: "#ef4444",
  shortage: "#f59e0b",
  stored: "#3b82f6",
  made_to_order: "#8b5cf6",
};

interface StatusHistory {
  id: number;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
  userName: string | null;
}

export default function ProductionComparisonsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [uploadBranch, setUploadBranch] = useState<string>("");
  const [uploadDate, setUploadDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState("overview");
  
  // Status change state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedComparison, setSelectedComparison] = useState<DailyComparison | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusReason, setStatusReason] = useState<string>("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: comparisons = [], isLoading: comparisonsLoading } = useQuery<DailyComparison[]>({
    queryKey: ["/api/production-comparisons", selectedBranch, dateRange.start, dateRange.end, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      
      const res = await apiRequest("GET", `/api/production-comparisons?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch comparisons");
      return res.json();
    },
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/production-comparisons/summary", selectedBranch, dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      
      const res = await apiRequest("GET", `/api/production-comparisons/summary?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: uncategorizedProducts = [] } = useQuery<{productName: string}[]>({
    queryKey: ["/api/uncategorized-products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/uncategorized-products");
      if (!res.ok) throw new Error("Failed to fetch uncategorized products");
      return res.json();
    },
  });

  const [confirmComparisonOpen, setConfirmComparisonOpen] = useState(false);

  const handleRunComparisonClick = () => {
    if (uncategorizedProducts.length > 0) {
      setConfirmComparisonOpen(true);
    } else {
      runComparisonMutation.mutate();
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/production-comparisons/upload-sales", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "فشل رفع الملف");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "تم رفع الملف بنجاح",
        description: `تم استيراد ${data.recordsImported} سجل من ملف المبيعات`,
      });
      setUploadDialogOpen(false);
      setSalesFile(null);
      setUploadBranch("");
      queryClient.invalidateQueries({ queryKey: ["/api/production-comparisons"] });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في رفع الملف",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runComparisonMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/production-comparisons/run", {
        branchId: selectedBranch === "all" ? undefined : selectedBranch,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to run comparison");
      }
      return res.json();
    },
    onSuccess: (data: { comparisonsCreated: number }) => {
      toast({
        title: "تم إجراء المقارنة بنجاح",
        description: `تم إنشاء ${data.comparisonsCreated} مقارنة`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/production-comparisons"] });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في إجراء المقارنة",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Status change mutation
  const statusChangeMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: string; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/production-comparisons/${id}/status`, {
        status,
        reason,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث الحالة",
        description: "تم تغيير حالة المقارنة بنجاح",
      });
      setStatusDialogOpen(false);
      setSelectedComparison(null);
      setNewStatus("");
      setStatusReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/production-comparisons"] });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في تحديث الحالة",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (comparison: DailyComparison) => {
    setSelectedComparison(comparison);
    setNewStatus(comparison.status || "normal");
    setStatusReason("");
    setStatusDialogOpen(true);
  };

  const handleStatusSubmit = () => {
    if (selectedComparison && newStatus) {
      statusChangeMutation.mutate({
        id: selectedComparison.id,
        status: newStatus,
        reason: statusReason || undefined,
      });
    }
  };

  const fetchStatusHistory = async (comparisonId: number) => {
    try {
      const res = await apiRequest("GET", `/api/production-comparisons/${comparisonId}/history`);
      if (res.ok) {
        const history = await res.json();
        setStatusHistory(history);
        setHistoryDialogOpen(true);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "تعذر تحميل سجل المقارنات",
        description: (error as Error)?.message || "تحقق من الاتصال وحاول مرة أخرى",
        variant: "destructive",
      });
    }
  };

  const handleUpload = useCallback(() => {
    if (!salesFile || !uploadBranch) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الملف والفرع",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", salesFile);
    formData.append("branchId", uploadBranch);
    formData.append("defaultDate", uploadDate);
    uploadMutation.mutate(formData);
  }, [salesFile, uploadBranch, uploadDate, uploadMutation, toast]);

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, { produced: number; sold: number; waste: number }> = {};
    
    comparisons.forEach((c) => {
      const cat = c.productCategory || "أخرى";
      if (!breakdown[cat]) {
        breakdown[cat] = { produced: 0, sold: 0, waste: 0 };
      }
      breakdown[cat].produced += c.producedQuantity || 0;
      breakdown[cat].sold += c.soldQuantity || 0;
      if ((c.difference || 0) > 0) {
        breakdown[cat].waste += c.difference || 0;
      }
    });

    return Object.entries(breakdown).map(([category, data]) => ({
      category,
      ...data,
      fill: CATEGORY_COLORS[category] || "#6b7280",
    }));
  }, [comparisons]);

  const dailyTrend = useMemo(() => {
    const byDate: Record<string, { date: string; produced: number; sold: number; difference: number }> = {};
    
    comparisons.forEach((c) => {
      const date = c.comparisonDate;
      if (!byDate[date]) {
        byDate[date] = { date, produced: 0, sold: 0, difference: 0 };
      }
      byDate[date].produced += c.producedQuantity || 0;
      byDate[date].sold += c.soldQuantity || 0;
      byDate[date].difference += c.difference || 0;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [comparisons]);

  const statusDistribution = useMemo(() => {
    const counts = { normal: 0, waste: 0, shortage: 0, stored: 0 };
    comparisons.forEach((c) => {
      const status = c.status as keyof typeof counts;
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: COMPARISON_STATUS[status as keyof typeof COMPARISON_STATUS]?.label || status,
      value: count,
      fill: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
    }));
  }, [comparisons]);

  const totals = useMemo(() => {
    return comparisons.reduce(
      (acc, c) => {
        acc.produced += c.producedQuantity || 0;
        acc.sold += c.soldQuantity || 0;
        acc.productionValue += c.productionValue || 0;
        acc.salesValue += c.salesValue || 0;
        if ((c.difference || 0) > 0) {
          acc.waste += c.difference || 0;
          acc.wasteValue += c.valueDifference || 0;
        } else {
          acc.shortage += Math.abs(c.difference || 0);
        }
        return acc;
      },
      { produced: 0, sold: 0, waste: 0, shortage: 0, productionValue: 0, salesValue: 0, wasteValue: 0 }
    );
  }, [comparisons]);

  const formatNumber = (num: number) => num.toLocaleString("en-US");
  const formatCurrency = (num: number) => `${formatNumber(num)} ر.س`;

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-none space-y-4" dir="rtl">
        <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/production")}
              className="rounded-full"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-7 w-7 text-indigo-600" />
                مقارنات الإنتاج والمبيعات
              </h1>
              <p className="text-slate-500 text-sm">تحليل الفروقات اليومية والشهرية بين الإنتاج والمبيعات الفعلية</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/production-comparison-reports")}
              className="gap-2"
              data-testid="button-waste-reports"
            >
              <PieChartIcon className="h-4 w-4" />
              تقارير تحليل الهدر
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/product-category-management")}
              className="gap-2"
              data-testid="button-manage-categories"
            >
              <Tag className="h-4 w-4" />
              إدارة التصنيفات
            </Button>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" data-testid="button-upload-sales">
                  <Upload className="h-4 w-4" />
                  رفع ملف المبيعات
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    رفع ملف مبيعات فودكس
                  </DialogTitle>
                  <DialogDescription>
                    قم برفع ملف Excel يحتوي على بيانات المبيعات اليومية من نظام فودكس
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label>الفرع</Label>
                    <Select value={uploadBranch} onValueChange={setUploadBranch}>
                      <SelectTrigger data-testid="select-upload-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>تاريخ المبيعات</Label>
                    <Input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className="mt-1"
                      data-testid="input-sales-date"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      حدد تاريخ المبيعات في حال عدم وجود عمود التاريخ في الملف
                    </p>
                  </div>

                  <div>
                    <Label>ملف المبيعات (Excel)</Label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setSalesFile(e.target.files?.[0] || null)}
                      className="mt-1"
                      data-testid="input-sales-file"
                    />
                    {salesFile && (
                      <p className="text-sm text-slate-500 mt-1">
                        الملف المحدد: {salesFile.name}
                      </p>
                    )}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium mb-1">تنسيق الملف المطلوب:</p>
                        <ul className="text-xs space-y-0.5 list-disc list-inside">
                          <li>عمود اسم المنتج (Product)</li>
                          <li>عمود الكمية المباعة (Quantity)</li>
                          <li>عمود قيمة المبيعات (Sales) - اختياري</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending || !salesFile || !uploadBranch}
                    className="bg-indigo-600 hover:bg-indigo-700"
                    data-testid="button-confirm-upload"
                  >
                    {uploadMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Upload className="h-4 w-4 ml-2" />
                    )}
                    رفع الملف
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="gap-2"
              onClick={handleRunComparisonClick}
              disabled={runComparisonMutation.isPending}
              data-testid="button-run-comparison"
            >
              {runComparisonMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              إجراء المقارنة
            </Button>
            
            <Select
              value=""
              onValueChange={(value) => {
                const params = new URLSearchParams({
                  format: value,
                  startDate: dateRange.start,
                  endDate: dateRange.end,
                });
                if (selectedBranch !== "all") params.append("branchId", selectedBranch);
                if (selectedCategory !== "all") params.append("category", selectedCategory);
                window.open(`/api/production-comparisons/export?${params.toString()}`, "_blank");
              }}
            >
              <SelectTrigger className="w-[130px]" data-testid="select-export">
                <Download className="h-4 w-4 ml-2" />
                <SelectValue placeholder="تصدير" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
            
            {uncategorizedProducts.length > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {uncategorizedProducts.length} منتج غير مصنف
              </Badge>
            )}
          </div>
        </div>

        {/* Warning dialog for uncategorized products */}
        <AlertDialog open={confirmComparisonOpen} onOpenChange={setConfirmComparisonOpen}>
          <AlertDialogContent dir="rtl" className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                تحذير: منتجات غير مصنفة
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right">
                يوجد {uncategorizedProducts.length} منتج غير مصنف في النظام.
                المنتجات غير المصنفة ستظهر تحت فئة "أخرى" في التقارير.
                <br /><br />
                هل تريد المتابعة بإجراء المقارنة؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmComparisonOpen(false);
                  navigate("/product-category-management");
                }}
              >
                <Tag className="h-4 w-4 ml-2" />
                تصنيف المنتجات
              </Button>
              <AlertDialogAction
                onClick={() => {
                  setConfirmComparisonOpen(false);
                  runComparisonMutation.mutate();
                }}
              >
                متابعة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2">
            <Label className="text-slate-600">الفرع:</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px]" data-testid="select-branch-filter">
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-slate-600">الفئة:</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[150px]" data-testid="select-category-filter">
                <SelectValue placeholder="جميع الفئات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفئات</SelectItem>
                {COMPARABLE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-slate-600">من:</Label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="w-[160px]"
              data-testid="input-date-start"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-slate-600">إلى:</Label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="w-[160px]"
              data-testid="input-date-end"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">إجمالي الإنتاج</p>
                  <p className="text-2xl font-bold text-green-700" data-testid="text-total-produced">
                    {formatNumber(totals.produced)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(totals.productionValue)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Package className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold text-blue-700" data-testid="text-total-sold">
                    {formatNumber(totals.sold)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(totals.salesValue)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">الهدر</p>
                  <p className="text-2xl font-bold text-red-700" data-testid="text-total-waste">
                    {formatNumber(totals.waste)}
                  </p>
                  <p className="text-xs text-red-400">
                    {formatCurrency(Math.abs(totals.wasteValue))}
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">النقص</p>
                  <p className="text-2xl font-bold text-amber-700" data-testid="text-total-shortage">
                    {formatNumber(totals.shortage)}
                  </p>
                  <p className="text-xs text-amber-400">
                    {totals.produced > 0 ? ((totals.shortage / totals.produced) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="daily" className="gap-2" data-testid="tab-daily">
              <Calendar className="h-4 w-4" />
              التفاصيل اليومية
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2" data-testid="tab-categories">
              <Package className="h-4 w-4" />
              حسب الفئة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    اتجاه الإنتاج والمبيعات
                  </CardTitle>
                  <CardDescription>المقارنة اليومية خلال الفترة المحددة</CardDescription>
                </CardHeader>
                <CardContent>
                  {comparisonsLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : dailyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={dailyTrend}>
                        <defs>
                          <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorSold" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          tickFormatter={(val) => format(parseISO(val), "MM/dd")}
                        />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="produced"
                          name="الإنتاج"
                          stroke="#10b981"
                          fillOpacity={1}
                          fill="url(#colorProduced)"
                        />
                        <Area
                          type="monotone"
                          dataKey="sold"
                          name="المبيعات"
                          stroke="#3b82f6"
                          fillOpacity={1}
                          fill="url(#colorSold)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-400">
                      لا توجد بيانات للعرض
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-purple-600" />
                    توزيع الحالات
                  </CardTitle>
                  <CardDescription>نسبة كل حالة من إجمالي المقارنات</CardDescription>
                </CardHeader>
                <CardContent>
                  {comparisonsLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : statusDistribution.some((s) => s.value > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-400">
                      لا توجد بيانات للعرض
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                  مقارنة الفئات
                </CardTitle>
                <CardDescription>الإنتاج مقابل المبيعات والهدر حسب الفئة</CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis
                        dataKey="category"
                        type="category"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        width={80}
                      />
                      <Legend />
                      <Bar dataKey="produced" name="الإنتاج" fill="#10b981" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="sold" name="المبيعات" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="waste" name="الهدر" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-400">
                    لا توجد بيانات للعرض
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  التفاصيل اليومية
                </CardTitle>
                <CardDescription>
                  جميع المقارنات للفترة المحددة ({comparisons.length} سجل)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : comparisons.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>المنتج</TableHead>
                          <TableHead>الفئة</TableHead>
                          <TableHead className="text-center">الإنتاج</TableHead>
                          <TableHead className="text-center">المبيعات</TableHead>
                          <TableHead className="text-center">الفرق</TableHead>
                          <TableHead className="text-center">قيمة الهدر</TableHead>
                          <TableHead className="text-center">الحالة</TableHead>
                          <TableHead className="text-center">قابل للتخزين</TableHead>
                          <TableHead className="text-center">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisons.slice(0, 50).map((c) => (
                          <TableRow key={c.id} data-testid={`row-comparison-${c.id}`}>
                            <TableCell className="font-medium">
                              {format(parseISO(c.comparisonDate), "yyyy/MM/dd")}
                            </TableCell>
                            <TableCell>{c.productName}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: CATEGORY_COLORS[c.productCategory || "أخرى"],
                                  color: CATEGORY_COLORS[c.productCategory || "أخرى"],
                                }}
                              >
                                {c.productCategory || "أخرى"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium text-green-700">
                              {formatNumber(c.producedQuantity || 0)}
                            </TableCell>
                            <TableCell className="text-center font-medium text-blue-700">
                              {formatNumber(c.soldQuantity || 0)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`font-bold ${
                                  (c.difference || 0) > 0
                                    ? "text-red-600"
                                    : (c.difference || 0) < 0
                                    ? "text-amber-600"
                                    : "text-green-600"
                                }`}
                              >
                                {(c.difference || 0) > 0 ? "+" : ""}
                                {formatNumber(c.difference || 0)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {(c.wasteValue || 0) > 0 ? (
                                <span className="font-medium text-red-600">
                                  {formatNumber(c.wasteValue || 0)} ر.س
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="cursor-pointer hover:opacity-80"
                                style={{
                                  backgroundColor:
                                    STATUS_COLORS[c.status as keyof typeof STATUS_COLORS] + "20",
                                  borderColor:
                                    STATUS_COLORS[c.status as keyof typeof STATUS_COLORS],
                                  color: STATUS_COLORS[c.status as keyof typeof STATUS_COLORS],
                                }}
                                onClick={() => handleStatusChange(c)}
                              >
                                {COMPARISON_STATUS[c.status as keyof typeof COMPARISON_STATUS]
                                  ?.label || c.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {c.isStorable ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Snowflake className="h-4 w-4 text-blue-500 mx-auto" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{c.storageNotes || "قابل للتخزين بالفريزر"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <XCircle className="h-4 w-4 text-slate-300 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleStatusChange(c)}
                                        data-testid={`button-change-status-${c.id}`}
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>تغيير الحالة</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => fetchStatusHistory(c.id)}
                                        data-testid={`button-history-${c.id}`}
                                      >
                                        <Clock className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>سجل التغييرات</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {comparisons.length > 50 && (
                      <p className="text-center text-sm text-slate-500 mt-4">
                        يتم عرض أول 50 سجل من أصل {comparisons.length} سجل
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد مقارنات للفترة المحددة</p>
                    <p className="text-sm mt-2">
                      قم برفع ملف مبيعات ثم اضغط على "إجراء المقارنة"
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-purple-800 text-sm">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>ملاحظة:</strong> فئات المشروبات (باريستا) والبيتزا مستثناة من المقارنات لأنها تُصنع حسب طلب العميل ولا يوجد فيها هالك.
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMPARABLE_CATEGORIES.map((category) => {
                const catData = categoryBreakdown.find((c) => c.category === category);
                const efficiency =
                  catData && catData.produced > 0
                    ? ((catData.sold / catData.produced) * 100).toFixed(1)
                    : "0";
                const wastePercent =
                  catData && catData.produced > 0
                    ? ((catData.waste / catData.produced) * 100).toFixed(1)
                    : "0";

                return (
                  <Card
                    key={category}
                    className="border-0 shadow-md hover:shadow-lg transition-shadow"
                    data-testid={`card-category-${category}`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[category] }}
                          />
                          {category}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            parseFloat(efficiency) >= 90
                              ? "border-green-500 text-green-600"
                              : parseFloat(efficiency) >= 70
                              ? "border-amber-500 text-amber-600"
                              : "border-red-500 text-red-600"
                          }
                        >
                          كفاءة {efficiency}%
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">الإنتاج</span>
                          <span className="font-bold text-green-700">
                            {formatNumber(catData?.produced || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">المبيعات</span>
                          <span className="font-bold text-blue-700">
                            {formatNumber(catData?.sold || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">الهدر</span>
                          <span className="font-bold text-red-700">
                            {formatNumber(catData?.waste || 0)} ({wastePercent}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-400"
                            style={{ width: `${Math.min(parseFloat(efficiency), 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Status Change Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تغيير حالة المقارنة</DialogTitle>
              <DialogDescription>
                {selectedComparison && (
                  <span>
                    {selectedComparison.productName} - {format(parseISO(selectedComparison.comparisonDate), "yyyy/MM/dd")}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الحالة الجديدة</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPARISON_STATUS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }}
                          />
                          {val.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>سبب التغيير (اختياري)</Label>
                <Input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="أدخل سبب التغيير..."
                  data-testid="input-status-reason"
                />
              </div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleStatusSubmit}
                disabled={statusChangeMutation.isPending}
                data-testid="button-submit-status"
              >
                {statusChangeMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Status History Dialog */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>سجل تغييرات الحالة</DialogTitle>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {statusHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p>لا توجد تغييرات مسجلة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {statusHistory.map((h) => (
                    <div key={h.id} className="border rounded-lg p-3 bg-slate-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: STATUS_COLORS[h.previousStatus as keyof typeof STATUS_COLORS] + "20" || "#f1f5f9",
                            borderColor: STATUS_COLORS[h.previousStatus as keyof typeof STATUS_COLORS] || "#94a3b8",
                            color: STATUS_COLORS[h.previousStatus as keyof typeof STATUS_COLORS] || "#64748b",
                          }}
                        >
                          {COMPARISON_STATUS[h.previousStatus as keyof typeof COMPARISON_STATUS]?.label || h.previousStatus || "جديد"}
                        </Badge>
                        <span className="text-slate-400">→</span>
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: STATUS_COLORS[h.newStatus as keyof typeof STATUS_COLORS] + "20",
                            borderColor: STATUS_COLORS[h.newStatus as keyof typeof STATUS_COLORS],
                            color: STATUS_COLORS[h.newStatus as keyof typeof STATUS_COLORS],
                          }}
                        >
                          {COMPARISON_STATUS[h.newStatus as keyof typeof COMPARISON_STATUS]?.label || h.newStatus}
                        </Badge>
                      </div>
                      {h.reason && (
                        <p className="text-sm text-slate-600 mb-1">
                          <strong>السبب:</strong> {h.reason}
                        </p>
                      )}
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{h.userName || "مستخدم"}</span>
                        <span>•</span>
                        <span>{format(new Date(h.createdAt), "yyyy/MM/dd HH:mm", { locale: ar })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </Layout>
  );
}
