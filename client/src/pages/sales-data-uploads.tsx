import { useState, useRef } from "react";
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
import { Upload, FileSpreadsheet, Calendar, Building2, Eye, Loader2, AlertCircle, CheckCircle, Clock, TrendingUp, Package, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import * as XLSX from "xlsx";
import type { Branch } from "@shared/schema";

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
  pending: { label: "قيد الانتظار", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "جاري المعالجة", icon: Loader2, color: "bg-blue-100 text-blue-800" },
  completed: { label: "مكتمل", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  failed: { label: "فشل", icon: AlertCircle, color: "bg-red-100 text-red-800" },
};

export default function SalesDataUploadsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analyticsUploadId, setAnalyticsUploadId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

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

  const resetForm = () => {
    setSelectedFile(null);
    setPeriodStart("");
    setPeriodEnd("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      reader.onload = (e) => {
        try {
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
      return format(new Date(dateStr), "dd MMM yyyy", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              رفع بيانات المبيعات
            </h1>
            <p className="text-muted-foreground">
              رفع ملفات Excel لتحليل بيانات المبيعات وتخطيط الإنتاج
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              رفع ملف جديد
            </CardTitle>
            <CardDescription>اختر ملف Excel يحتوي على بيانات المبيعات</CardDescription>
          </CardHeader>
          <div className="px-6 pb-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                تنسيق الملف المطلوب
              </h4>
              <p className="text-sm text-blue-800 mb-2">يجب أن يحتوي ملف Excel على الأعمدة التالية (اسم أي من هذه الأعمدة مقبول):</p>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li><strong>اسم المنتج:</strong> منتج، اسم المنتج، product، name، item</li>
                <li><strong>الكمية:</strong> كمية، الكمية، quantity، qty، sold</li>
                <li><strong>الإيرادات (اختياري):</strong> إيرادات، المبيعات، revenue، total، sales</li>
              </ul>
            </div>
          </div>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch">الفرع</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodStart">من تاريخ</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  data-testid="input-period-start"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodEnd">إلى تاريخ</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  data-testid="input-period-end"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">اختر ملف Excel</Label>
                <Input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  data-testid="input-file"
                />
              </div>
            </div>

            {selectedFile && (
              <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <span className="text-sm">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            <div className="mt-6">
              <Button
                onClick={handleUpload}
                disabled={isUploading || !selectedBranch || !selectedFile || !periodStart || !periodEnd}
                className="w-full md:w-auto"
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              ملفات البيانات المرفوعة
            </CardTitle>
            <CardDescription>قائمة بجميع ملفات المبيعات المرفوعة</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !uploads || uploads.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">لا توجد ملفات مرفوعة</h3>
                <p className="text-muted-foreground">قم برفع ملف Excel لبدء تحليل بيانات المبيعات</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">اسم الملف</TableHead>
                      <TableHead className="text-right">الفرع</TableHead>
                      <TableHead className="text-right">الفترة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">إجمالي السجلات</TableHead>
                      <TableHead className="text-right">قيمة المبيعات</TableHead>
                      <TableHead className="text-right">المنتجات الفريدة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploads.map((upload) => {
                      const statusConfig = getStatusConfig(upload.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow key={upload.id} data-testid={`row-upload-${upload.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-green-600" />
                              <span data-testid={`text-filename-${upload.id}`}>{upload.fileName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-branch-${upload.id}`}>{getBranchName(upload.branchId)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-period-${upload.id}`}>
                                {formatDate(upload.periodStart)} - {formatDate(upload.periodEnd)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig.color} data-testid={`badge-status-${upload.id}`}>
                              <StatusIcon className={`w-3 h-3 ml-1 ${upload.status === 'processing' ? 'animate-spin' : ''}`} />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span data-testid={`text-records-${upload.id}`}>
                              {upload.totalRecords?.toLocaleString('ar-SA') || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium" data-testid={`text-sales-${upload.id}`}>
                              {formatCurrency(upload.totalSalesValue || 0)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-products-${upload.id}`}>
                                {upload.uniqueProducts || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Dialog 
                              open={analyticsUploadId === upload.id} 
                              onOpenChange={(open) => setAnalyticsUploadId(open ? upload.id : null)}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={upload.status !== 'completed'}
                                  data-testid={`button-analytics-${upload.id}`}
                                >
                                  <Eye className="w-4 h-4 ml-1" />
                                  عرض التحليل
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    تحليل المبيعات
                                  </DialogTitle>
                                  <DialogDescription>
                                    تحليل مبيعات المنتجات للملف: {upload.fileName}
                                  </DialogDescription>
                                </DialogHeader>
                                
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
                                  </div>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-right">اسم المنتج</TableHead>
                                        <TableHead className="text-right">التصنيف</TableHead>
                                        <TableHead className="text-right">الكمية المباعة</TableHead>
                                        <TableHead className="text-right">إجمالي الإيرادات</TableHead>
                                        <TableHead className="text-right">معدل البيع اليومي</TableHead>
                                        <TableHead className="text-right">سرعة البيع</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {analytics.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium">{item.productName}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline">{item.productCategory || "-"}</Badge>
                                          </TableCell>
                                          <TableCell>{item.totalQuantitySold?.toLocaleString('ar-SA')}</TableCell>
                                          <TableCell className="text-green-600">
                                            {formatCurrency(item.totalRevenue || 0)}
                                          </TableCell>
                                          <TableCell>{item.averageDailySales?.toFixed(1)}</TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-1">
                                              <TrendingUp className="w-3 h-3 text-blue-500" />
                                              <span>{(item.salesVelocity * 100).toFixed(1)}%</span>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
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
