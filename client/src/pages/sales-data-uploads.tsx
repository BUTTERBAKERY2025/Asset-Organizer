import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/hooks/useBranches";
import { Upload, FileSpreadsheet, Calendar, Building2, Eye, Loader2, AlertCircle, CheckCircle, Clock, TrendingUp, Package, DollarSign, Target, Sparkles, Send, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLocation, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface SalesDataUpload {
  id: number;
  branchId: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalRecords: number;
  totalSalesValue: number;
  uniqueProducts: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface ProductSalesAnalytics {
  id: number;
  productName: string;
  productCategory: string | null;
  totalQuantitySold: number;
  totalRevenue: number;
  averageDailySales: number;
  salesVelocity: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "قيد الانتظار", icon: Clock, color: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300" },
  processing: { label: "جاري المعالجة", icon: Loader2, color: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300" },
  completed: { label: "مكتمل", icon: CheckCircle, color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" },
  failed: { label: "فشل", icon: AlertCircle, color: "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300" },
};

interface ForecastResult {
  success: boolean;
  message: string;
  forecast: {
    uploadId: number;
    branchId: string;
    targetSales: number;
    planDate: string;
    totalProducts: number;
    productionItems?: number;
    salesOnlyItems?: number;
    totalForecastedQuantity: number;
    items: {
      productName: string;
      productCategory: string | null;
      salesRatio: number;
      forecastedQuantity: number;
      forecastedSalesAmount: number;
    }[];
    excludedItems?: {
      productName: string;
      category: string | null;
      forecastedSalesAmount: number;
      reason: string;
    }[];
  };
  productionOrder: any;
}

export default function SalesDataUploadsPage() {
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || "");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analyticsUploadId, setAnalyticsUploadId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [forecastBranch, setForecastBranch] = useState<string>(userBranchId || "");
  const [forecastTargetSales, setForecastTargetSales] = useState<string>("");
  const [forecastDate, setForecastDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [forecastNotes, setForecastNotes] = useState<string>("");
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>("analytics");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (userBranchId) {
      setSelectedBranch(userBranchId);
      setForecastBranch(userBranchId);
    }
  }, [userBranchId]);

  const { data: uploads, isLoading } = useQuery<SalesDataUpload[]>({
    queryKey: ["/api/sales-data-uploads"],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<ProductSalesAnalytics[]>({
    queryKey: [`/api/sales-data-uploads/${analyticsUploadId}/analytics`],
    enabled: analyticsUploadId !== null,
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { branchId: string; fileName: string; periodStart: string; periodEnd: string; fileData: string }) => {
      return apiRequest("POST", "/api/sales-data-uploads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-data-uploads"] });
      toast({ title: "تم رفع الملف بنجاح", description: "جاري تحليل البيانات..." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ في رفع الملف", 
        description: error.message || "فشل في رفع الملف", 
        variant: "destructive" 
      });
    },
  });

  const forecastMutation = useMutation({
    mutationFn: async (data: { uploadId: number; branchId: string; targetSales: string; planDate: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/sales-data-uploads/${data.uploadId}/generate-forecast`, {
        branchId: data.branchId,
        targetSales: data.targetSales,
        planDate: data.planDate,
        notes: data.notes
      });
      return response.json();
    },
    onSuccess: (data: ForecastResult) => {
      setForecastResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-production-orders"] });
      toast({ 
        title: "تم توليد توقعات الإنتاج", 
        description: `تم إنشاء أمر إنتاج يحتوي على ${data.forecast.totalProducts} منتج` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ في توليد التوقعات", 
        description: error.message || "فشل في توليد توقعات الإنتاج", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setPeriodStart("");
    setPeriodEnd("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForecastForm = () => {
    setForecastBranch("");
    setForecastTargetSales("");
    setForecastDate(new Date().toISOString().split('T')[0]);
    setForecastNotes("");
    setForecastResult(null);
    setActiveTab("analytics");
  };

  const handleGenerateForecast = () => {
    if (!analyticsUploadId || !forecastBranch || !forecastTargetSales || !forecastDate) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    forecastMutation.mutate({
      uploadId: analyticsUploadId,
      branchId: forecastBranch,
      targetSales: forecastTargetSales,
      planDate: forecastDate,
      notes: forecastNotes
    });
  };

  const handleDialogOpen = (uploadId: number) => {
    resetForecastForm();
    setAnalyticsUploadId(uploadId);
  };

  const handleDialogClose = () => {
    resetForecastForm();
    setAnalyticsUploadId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isValidType = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidType) {
        toast({
          title: "نوع ملف غير صالح",
          description: "يرجى اختيار ملف Excel (.xlsx أو .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await import("xlsx");
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (error) {
          reject(new Error("فشل في قراءة ملف Excel"));
        }
      };
      reader.onerror = () => reject(new Error("فشل في قراءة الملف"));
      reader.readAsBinaryString(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedBranch || !selectedFile || !periodStart || !periodEnd) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const parsedData = await parseExcelFile(selectedFile);
      
      if (parsedData.length === 0) {
        toast({
          title: "ملف فارغ",
          description: "لا توجد بيانات في الملف المختار",
          variant: "destructive",
        });
        return;
      }

      await uploadMutation.mutateAsync({
        branchId: selectedBranch,
        fileName: selectedFile.name,
        periodStart,
        periodEnd,
        fileData: JSON.stringify(parsedData),
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في معالجة الملف",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-4 sm:space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8 shrink-0" data-testid="btn-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground" data-testid="text-page-title">
                رفع بيانات المبيعات
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                رفع ملفات Excel لتحليل بيانات المبيعات وتخطيط الإنتاج
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
              رفع ملف جديد
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">اختر ملف Excel يحتوي على بيانات المبيعات</CardDescription>
          </CardHeader>
          <div className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
            <div className="p-3 sm:p-4 bg-accent/40 rounded-lg border border-border">
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
                تنسيق الملف المطلوب
              </h4>
              <p className="text-xs sm:text-sm text-foreground mb-2">يجب أن يحتوي ملف Excel على الأعمدة التالية:</p>
              <ul className="text-xs sm:text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>اسم المنتج:</strong> منتج، product، name، item</li>
                <li><strong>الكمية:</strong> كمية، quantity، qty، sold</li>
                <li><strong>الإيرادات:</strong> إيرادات، revenue، total، sales</li>
              </ul>
            </div>
          </div>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="branch" className="text-xs sm:text-sm">الفرع</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
                  <SelectTrigger data-testid="select-branch" className="h-11 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="periodStart" className="text-xs sm:text-sm">من تاريخ</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  data-testid="input-period-start"
                  className="h-11 sm:h-10 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="periodEnd" className="text-xs sm:text-sm">إلى تاريخ</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  data-testid="input-period-end"
                  className="h-11 sm:h-10 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="file" className="text-xs sm:text-sm">اختر ملف Excel</Label>
                <Input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  data-testid="input-file"
                  className="h-11 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {selectedFile && (
              <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-muted rounded-lg flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 shrink-0" />
                <span className="text-xs sm:text-sm truncate">{selectedFile.name}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            <div className="mt-4 sm:mt-6">
              <Button
                onClick={handleUpload}
                disabled={isUploading || !selectedBranch || !selectedFile || !periodStart || !periodEnd}
                className="w-full sm:w-auto h-11 sm:h-10 text-sm"
                data-testid="button-upload"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الرفع...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 ml-2" />
                    رفع الملف
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
              ملفات البيانات المرفوعة
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">قائمة بجميع ملفات المبيعات المرفوعة</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !uploads || uploads.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <FileSpreadsheet className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                <h3 className="text-sm sm:text-lg font-semibold mb-2">لا توجد ملفات مرفوعة</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">قم برفع ملف Excel لبدء تحليل بيانات المبيعات</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right text-xs sm:text-sm">اسم الملف</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">الفرع</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">الفترة</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">الحالة</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">السجلات</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">المبيعات</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm hidden lg:table-cell">المنتجات</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploads.map((upload) => {
                      const statusConfig = getStatusConfig(upload.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow key={upload.id} data-testid={`row-upload-${upload.id}`}>
                          <TableCell className="py-2 sm:py-3">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 shrink-0" />
                              <span data-testid={`text-filename-${upload.id}`} className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[1400px] mx-auto">{upload.fileName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-3 hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-branch-${upload.id}`} className="text-xs sm:text-sm">{getBranchName(upload.branchId)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-3 hidden lg:table-cell">
                            <div className="flex items-center gap-1 text-xs sm:text-sm">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-period-${upload.id}`}>
                                {formatDate(upload.periodStart)} - {formatDate(upload.periodEnd)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-3">
                            <Badge className={`${statusConfig.color} text-[10px] sm:text-xs`} data-testid={`badge-status-${upload.id}`}>
                              <StatusIcon className={`w-3 h-3 ml-1 ${upload.status === 'processing' ? 'animate-spin' : ''}`} />
                              <span className="hidden sm:inline">{statusConfig.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 sm:py-3 hidden md:table-cell">
                            <span data-testid={`text-records-${upload.id}`} className="text-xs sm:text-sm">
                              {upload.totalRecords?.toLocaleString('en-US') || 0}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 sm:py-3">
                            <span className="text-green-600 font-medium text-xs sm:text-sm" data-testid={`text-sales-${upload.id}`}>
                              {formatCurrency(upload.totalSalesValue || 0)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 sm:py-3 hidden lg:table-cell">
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-products-${upload.id}`} className="text-xs sm:text-sm">
                                {upload.uniqueProducts || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 sm:py-3">
                            <Dialog 
                              open={analyticsUploadId === upload.id} 
                              onOpenChange={(open) => open ? handleDialogOpen(upload.id) : handleDialogClose()}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={upload.status !== 'completed'}
                                  data-testid={`button-analytics-${upload.id}`}
                                >
                                  <Eye className="w-4 h-4 ml-1" />
                                  تحليل وتوقعات
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" dir="rtl">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    تحليل المبيعات وتوقعات الإنتاج
                                  </DialogTitle>
                                  <DialogDescription>
                                    تحليل بيانات الملف: {upload.fileName}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                  <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                                      <TrendingUp className="w-4 h-4" />
                                      التحليل
                                    </TabsTrigger>
                                    <TabsTrigger value="forecast" className="flex items-center gap-2">
                                      <Target className="w-4 h-4" />
                                      توليد التوقعات
                                    </TabsTrigger>
                                    <TabsTrigger value="result" className="flex items-center gap-2" disabled={!forecastResult}>
                                      <Sparkles className="w-4 h-4" />
                                      النتيجة
                                    </TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="analytics" className="mt-4">
                                    {analyticsLoading ? (
                                      <div className="space-y-3 py-4">
                                        {[...Array(5)].map((_, i) => (
                                          <Skeleton key={i} className="h-12 w-full" />
                                        ))}
                                      </div>
                                    ) : !analytics || analytics.length === 0 ? (
                                      <div className="text-center py-8">
                                        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                        <p className="text-muted-foreground">لا توجد بيانات تحليلية متاحة</p>
                                        <p className="text-sm text-muted-foreground mt-2">تأكد من أن ملف Excel يحتوي على أعمدة المنتج والكمية</p>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                          <Card>
                                            <CardContent className="p-4 text-center">
                                              <Package className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                                              <div className="text-2xl font-bold">{analytics.length}</div>
                                              <div className="text-sm text-muted-foreground">منتج</div>
                                            </CardContent>
                                          </Card>
                                          <Card>
                                            <CardContent className="p-4 text-center">
                                              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                              <div className="text-2xl font-bold">{analytics.reduce((sum, a) => sum + (a.totalQuantitySold || 0), 0).toLocaleString('en-US')}</div>
                                              <div className="text-sm text-muted-foreground">إجمالي الكمية</div>
                                            </CardContent>
                                          </Card>
                                          <Card>
                                            <CardContent className="p-4 text-center">
                                              <DollarSign className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                                              <div className="text-2xl font-bold">{formatCurrency(analytics.reduce((sum, a) => sum + (a.totalRevenue || 0), 0))}</div>
                                              <div className="text-sm text-muted-foreground">إجمالي الإيرادات</div>
                                            </CardContent>
                                          </Card>
                                        </div>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="text-right">اسم المنتج</TableHead>
                                              <TableHead className="text-right">التصنيف</TableHead>
                                              <TableHead className="text-right">الكمية المباعة</TableHead>
                                              <TableHead className="text-right">إجمالي الإيرادات</TableHead>
                                              <TableHead className="text-right">معدل البيع اليومي</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {analytics.slice(0, 10).map((item) => (
                                              <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.productName}</TableCell>
                                                <TableCell>
                                                  <Badge variant="outline">{item.productCategory || "-"}</Badge>
                                                </TableCell>
                                                <TableCell>{item.totalQuantitySold?.toLocaleString('en-US')}</TableCell>
                                                <TableCell className="text-green-600">
                                                  {formatCurrency(item.totalRevenue || 0)}
                                                </TableCell>
                                                <TableCell>{item.averageDailySales?.toFixed(1)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                        {analytics.length > 10 && (
                                          <p className="text-sm text-muted-foreground text-center mt-2">
                                            عرض 10 منتجات من أصل {analytics.length}
                                          </p>
                                        )}
                                        <div className="flex justify-center mt-4">
                                          <Button onClick={() => setActiveTab("forecast")}>
                                            <Target className="w-4 h-4 ml-2" />
                                            توليد توقعات الإنتاج
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </TabsContent>

                                  <TabsContent value="forecast" className="mt-4">
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                          <Target className="w-5 h-5 text-purple-500" />
                                          توليد توقعات الإنتاج
                                        </CardTitle>
                                        <CardDescription>
                                          أدخل المبيعات المستهدفة وسيتم حساب كميات الإنتاج بناءً على نسب المبيعات السابقة
                                        </CardDescription>
                                      </CardHeader>
                                      <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>الفرع المستهدف *</Label>
                                            <Select value={forecastBranch} onValueChange={setForecastBranch} disabled={!canSelectBranch}>
                                              <SelectTrigger>
                                                <SelectValue placeholder="اختر الفرع" />
                                              </SelectTrigger>
                                              <SelectContent className="max-h-60 overflow-y-auto">
                                                {branches?.map((branch) => (
                                                  <SelectItem key={branch.id} value={branch.id}>
                                                    {branch.name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-2">
                                            <Label>تاريخ الإنتاج *</Label>
                                            <Input
                                              type="date"
                                              value={forecastDate}
                                              onChange={(e) => setForecastDate(e.target.value)}
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>المبيعات المستهدفة (ريال) *</Label>
                                          <div className="relative">
                                            <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                            <Input
                                              type="number"
                                              min="0"
                                              step="100"
                                              value={forecastTargetSales}
                                              onChange={(e) => setForecastTargetSales(e.target.value)}
                                              placeholder="مثال: 50000"
                                              className="pr-10"
                                            />
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            أدخل إجمالي المبيعات المتوقعة لليوم بالريال السعودي
                                          </p>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>ملاحظات (اختياري)</Label>
                                          <Textarea
                                            value={forecastNotes}
                                            onChange={(e) => setForecastNotes(e.target.value)}
                                            placeholder="أي ملاحظات إضافية..."
                                            rows={2}
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            onClick={handleGenerateForecast}
                                            disabled={forecastMutation.isPending || !forecastBranch || !forecastTargetSales || !forecastDate}
                                            className="flex-1"
                                          >
                                            {forecastMutation.isPending ? (
                                              <>
                                                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                                جاري التوليد...
                                              </>
                                            ) : (
                                              <>
                                                <Sparkles className="w-4 h-4 ml-2" />
                                                توليد أمر الإنتاج
                                              </>
                                            )}
                                          </Button>
                                          <Button variant="outline" onClick={() => setActiveTab("analytics")}>
                                            <ArrowLeft className="w-4 h-4 ml-2" />
                                            رجوع
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </TabsContent>

                                  <TabsContent value="result" className="mt-4">
                                    {forecastResult?.forecast?.items ? (
                                      <div className="space-y-4">
                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
                                          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 mb-2">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="font-medium">{forecastResult.message || 'تم إنشاء التوقعات'}</span>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                                            <div className="text-center">
                                              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{forecastResult.forecast.productionItems || forecastResult.forecast.totalProducts || 0}</div>
                                              <div className="text-sm text-emerald-600 dark:text-emerald-400">أصناف الإنتاج</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{(forecastResult.forecast.totalForecastedQuantity || 0).toLocaleString('en-US')}</div>
                                              <div className="text-sm text-emerald-600 dark:text-emerald-400">إجمالي الكمية</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(forecastResult.forecast.targetSales || 0)}</div>
                                              <div className="text-sm text-emerald-600 dark:text-emerald-400">المبيعات المستهدفة</div>
                                            </div>
                                            {(forecastResult.forecast.salesOnlyItems ?? 0) > 0 && (
                                              <div className="text-center">
                                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{forecastResult.forecast.salesOnlyItems}</div>
                                                <div className="text-sm text-amber-600 dark:text-amber-400">تحضير بعد الطلب</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {(forecastResult.forecast.excludedItems?.length ?? 0) > 0 && (
                                          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
                                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 mb-2">
                                              <AlertCircle className="w-4 h-4" />
                                              <span className="text-sm font-medium">أصناف لم تُضاف لأمر الإنتاج (تُحضّر بعد الطلب)</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              {forecastResult.forecast.excludedItems!.map((item: any, idx: number) => (
                                                <Badge key={idx} variant="outline" className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-900 text-xs">
                                                  {item.productName} ({item.category || 'غير مصنف'})
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <Card>
                                          <CardHeader>
                                            <CardTitle className="text-lg">تفاصيل أمر الإنتاج</CardTitle>
                                            <CardDescription>
                                              رقم الأمر: {forecastResult.productionOrder?.orderNumber || '-'}
                                            </CardDescription>
                                          </CardHeader>
                                          <CardContent>
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="text-right">المنتج</TableHead>
                                                  <TableHead className="text-right">التصنيف</TableHead>
                                                  <TableHead className="text-right">نسبة المبيعات</TableHead>
                                                  <TableHead className="text-right">الكمية المتوقعة</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {forecastResult.forecast.items.slice(0, 15).map((item, idx) => (
                                                  <TableRow key={idx}>
                                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                                    <TableCell>
                                                      <Badge variant="outline">{item.productCategory || "-"}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                      <Badge className="bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">{item.salesRatio}%</Badge>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-green-600">
                                                      {item.forecastedQuantity.toLocaleString('en-US')}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                            {forecastResult.forecast.items.length > 15 && (
                                              <p className="text-sm text-muted-foreground text-center mt-2">
                                                عرض 15 منتج من أصل {forecastResult.forecast.items.length}
                                              </p>
                                            )}
                                          </CardContent>
                                        </Card>

                                        <div className="flex gap-2">
                                          <Button
                                            onClick={() => {
                                              const orderId = forecastResult?.productionOrder?.order?.id || forecastResult?.productionOrder?.id;
                                              if (orderId) {
                                                navigate(`/advanced-production-orders/${orderId}/edit`);
                                              } else {
                                                navigate("/advanced-production-orders");
                                              }
                                            }}
                                            className="flex-1"
                                          >
                                            <Send className="w-4 h-4 ml-2" />
                                            عرض أمر الإنتاج
                                          </Button>
                                          <Button variant="outline" onClick={() => {
                                            setForecastResult(null);
                                            setActiveTab("forecast");
                                          }}>
                                            توليد توقعات جديدة
                                          </Button>
                                        </div>
                                      </div>
                                    ) : forecastResult ? (
                                      <div className="text-center py-8">
                                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                                        <p className="text-red-600 font-medium">حدث خطأ في توليد التوقعات</p>
                                        <p className="text-sm text-muted-foreground mt-2">يرجى المحاولة مرة أخرى</p>
                                        <Button variant="outline" className="mt-4" onClick={() => {
                                          setForecastResult(null);
                                          setActiveTab("forecast");
                                        }}>
                                          إعادة المحاولة
                                        </Button>
                                      </div>
                                    ) : null}
                                  </TabsContent>
                                </Tabs>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
