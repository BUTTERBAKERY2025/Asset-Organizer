import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams, Link } from "wouter";
import { 
  ArrowRight, Edit, Printer, Package, Calendar, Factory, 
  ClipboardList, Building2, Clock, TrendingUp, CheckCircle,
  AlertCircle, Loader2, FileText, Download, FileSpreadsheet,
  Play, XCircle, Send, ThumbsUp, RotateCcw, ChevronLeft,
  Sparkles, ArrowUpDown, Target, BarChart3, TrendingDown,
  AlertTriangle, CircleCheck, MinusCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/hooks/useBranches";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
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
import { Textarea } from "@/components/ui/textarea";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  draft: { label: "مسودة", color: "text-gray-700", bgColor: "bg-gray-100", icon: FileText },
  pending: { label: "قيد المراجعة", color: "text-yellow-700", bgColor: "bg-yellow-100", icon: Clock },
  approved: { label: "معتمد", color: "text-blue-700", bgColor: "bg-blue-100", icon: ThumbsUp },
  in_progress: { label: "قيد التنفيذ", color: "text-purple-700", bgColor: "bg-purple-100", icon: Play },
  completed: { label: "مكتمل", color: "text-green-700", bgColor: "bg-green-100", icon: CheckCircle },
  cancelled: { label: "ملغي", color: "text-red-700", bgColor: "bg-red-100", icon: XCircle },
};

const ORDER_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  daily: { label: "يومي", color: "bg-blue-100 text-blue-700" },
  weekly: { label: "أسبوعي", color: "bg-purple-100 text-purple-700" },
  long_term: { label: "طويل الأمد", color: "bg-amber-100 text-amber-700" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  normal: { label: "عادية", color: "bg-gray-100 text-gray-700" },
  high: { label: "عالية", color: "bg-orange-100 text-orange-700" },
  urgent: { label: "عاجلة", color: "bg-red-100 text-red-700" },
};

const WORKFLOW_STEPS = [
  { status: 'draft', label: 'مسودة', description: 'إنشاء وتعديل الأمر' },
  { status: 'pending', label: 'مراجعة', description: 'بانتظار الاعتماد' },
  { status: 'approved', label: 'معتمد', description: 'جاهز للتنفيذ' },
  { status: 'in_progress', label: 'تنفيذ', description: 'الإنتاج جارٍ' },
  { status: 'completed', label: 'مكتمل', description: 'تم الإنجاز' },
];

const STATUS_ACTIONS: Record<string, { nextStatus: string; label: string; icon: any; color: string; description: string }[]> = {
  draft: [
    { nextStatus: 'pending', label: 'إرسال للمراجعة', icon: Send, color: 'bg-yellow-500 hover:bg-yellow-600 text-white', description: 'إرسال الأمر للمراجعة والاعتماد' },
  ],
  pending: [
    { nextStatus: 'approved', label: 'اعتماد الأمر', icon: ThumbsUp, color: 'bg-blue-500 hover:bg-blue-600 text-white', description: 'اعتماد الأمر والموافقة على التنفيذ' },
    { nextStatus: 'draft', label: 'إرجاع للتعديل', icon: RotateCcw, color: 'bg-gray-500 hover:bg-gray-600 text-white', description: 'إرجاع الأمر للتعديل' },
  ],
  approved: [
    { nextStatus: 'in_progress', label: 'بدء التنفيذ', icon: Play, color: 'bg-purple-500 hover:bg-purple-600 text-white', description: 'بدء تنفيذ الإنتاج' },
  ],
  in_progress: [
    { nextStatus: 'completed', label: 'إتمام الأمر', icon: CheckCircle, color: 'bg-green-500 hover:bg-green-600 text-white', description: 'تم إكمال جميع المنتجات' },
  ],
};

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  category?: string;
  targetQuantity: number;
  originalQuantity?: number;
  producedQuantity: number;
  unit: string;
  unitPrice: number;
  notes: string;
}

interface ComparisonItem {
  orderItemId: number | null;
  productName: string;
  category: string;
  targetQuantity: number;
  actualProduced: number;
  variance: number;
  achievementPct: number;
  unit: string;
  batchCount: number;
  isExtraProduction?: boolean;
}

interface OrderResponse {
  id: number;
  orderNumber: string;
  title: string;
  description: string;
  sourceBranchId: string;
  targetBranchId: string;
  orderType: string;
  priority: string;
  status: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  actualCost: number;
  completionPercentage: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  targetSalesValue?: number;
  sourceSalesValue?: number;
  order?: any;
  items?: OrderItem[];
  schedules?: any[];
  dailyProductionComparison?: ComparisonItem[];
  comparisonScope?: string;
}

export default function AdvancedProductionOrderDetailsPage() {
  const { id } = useParams();
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ nextStatus: string; label: string } | null>(null);
  const [statusNotes, setStatusNotes] = useState("");

  const { data: rawData, isLoading } = useQuery<OrderResponse>({
    queryKey: [`/api/advanced-production-orders/${id}`],
    enabled: !!id,
  });

  const { branches } = useBranches();

  const statusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/advanced-production-orders/${id}/status`, { status, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('advanced-production') });
      toast({ title: "تم تغيير الحالة بنجاح" });
      setStatusDialogOpen(false);
      setStatusNotes("");
      setPendingAction(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err?.message || "فشل في تغيير الحالة", variant: "destructive" });
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `أمر إنتاج`,
  });

  const orderData = rawData ? (() => {
    const response = rawData as any;
    const order = response.order || response;
    const rawItems = response.items || [];
    const comparison = response.dailyProductionComparison || [];
    const comparisonScope = response.comparisonScope || '';
    
    const items = rawItems.map((item: any) => ({
      id: item.id,
      productId: item.productId || item.product_id,
      productName: item.productName || item.product_name || "",
      category: item.category || item.productCategory || item.product_category || "",
      targetQuantity: Number(item.targetQuantity || item.target_quantity || item.quantity) || 0,
      originalQuantity: Number(item.originalQuantity || item.original_quantity) || 0,
      producedQuantity: Number(item.producedQuantity || item.produced_quantity) || 0,
      unit: item.unit || "قطعة",
      unitPrice: Number(item.unitPrice || item.unit_price) || 0,
      notes: item.notes || ""
    }));
    
    return { order, items, comparison, comparisonScope };
  })() : null;

  const getBranchName = (branchId: string) => {
    return branches?.find((b) => b.id === branchId)?.name || branchId;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const exportToExcel = () => {
    if (!orderData) return;
    const { order, items, comparison } = orderData;
    
    const orderInfo = [
      ["رقم الأمر", order.orderNumber],
      ["العنوان", order.title || "-"],
      ["الحالة", STATUS_CONFIG[order.status]?.label || order.status],
      ["النوع", ORDER_TYPE_CONFIG[order.orderType]?.label || order.orderType],
      ["الفرع", getBranchName(order.sourceBranchId)],
      ["تاريخ البدء", formatDate(order.startDate)],
      ["تاريخ الانتهاء", formatDate(order.endDate)],
    ];

    const comparisonData = comparison.map((item: ComparisonItem, index: number) => [
      index + 1,
      item.productName,
      item.category || 'عام',
      item.targetQuantity,
      item.actualProduced,
      item.variance,
      `${item.achievementPct}%`,
      item.unit,
    ]);

    const wb = XLSX.utils.book_new();
    
    const wsInfo = XLSX.utils.aoa_to_sheet(orderInfo);
    XLSX.utils.book_append_sheet(wb, wsInfo, "معلومات الأمر");

    const wsComparison = XLSX.utils.aoa_to_sheet([
      ["#", "المنتج", "الفئة", "الكمية المطلوبة", "الكمية المنتجة فعلياً", "الفرق", "نسبة الإنجاز", "الوحدة"],
      ...comparisonData
    ]);
    XLSX.utils.book_append_sheet(wb, wsComparison, "مقارنة الإنتاج");

    XLSX.writeFile(wb, `مقارنة_انتاج_${order.orderNumber}.xlsx`);
  };

  const handleStatusAction = (nextStatus: string, label: string) => {
    setPendingAction({ nextStatus, label });
    setStatusDialogOpen(true);
  };

  const confirmStatusChange = () => {
    if (!pendingAction) return;
    statusMutation.mutate({ status: pendingAction.nextStatus, notes: statusNotes });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6" dir="rtl">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  const order = orderData?.order;
  const items = orderData?.items || [];
  const comparison = orderData?.comparison || [];

  if (!order) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6" dir="rtl">
          <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">أمر الإنتاج غير موجود</h2>
          <p className="text-gray-600 mb-4">لم يتم العثور على أمر الإنتاج المطلوب</p>
          <Link href="/advanced-production-orders">
            <Button>
              <ArrowRight className="h-4 w-4 ml-2" />
              العودة للقائمة
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;
  const typeConfig = ORDER_TYPE_CONFIG[order.orderType] || ORDER_TYPE_CONFIG.daily;
  const priorityConfig = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal;
  const StatusIcon = statusConfig.icon;
  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.status === order.status);
  const actions = STATUS_ACTIONS[order.status] || [];

  const orderItemsComparison = comparison.filter((c: ComparisonItem) => !c.isExtraProduction);
  const extraProduction = comparison.filter((c: ComparisonItem) => c.isExtraProduction);
  
  const totalTarget = orderItemsComparison.reduce((s: number, c: ComparisonItem) => s + c.targetQuantity, 0);
  const totalProduced = orderItemsComparison.reduce((s: number, c: ComparisonItem) => s + c.actualProduced, 0);
  const totalVariance = totalProduced - totalTarget;
  const overallAchievement = totalTarget > 0 ? Math.round((totalProduced / totalTarget) * 100) : 0;
  const fulfilledCount = orderItemsComparison.filter((c: ComparisonItem) => c.achievementPct >= 100).length;
  const partialCount = orderItemsComparison.filter((c: ComparisonItem) => c.achievementPct > 0 && c.achievementPct < 100).length;
  const notStartedCount = orderItemsComparison.filter((c: ComparisonItem) => c.achievementPct === 0).length;

  return (
    <Layout>
      <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/advanced-production-orders">
              <Button variant="ghost" size="icon" className="hover:bg-amber-50 h-11 w-11 min-h-[44px] min-w-[44px] sm:h-10 sm:w-10 sm:min-h-0 sm:min-w-0" data-testid="btn-back">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900" data-testid="order-title">
                  {order.title || order.orderNumber}
                </h1>
                <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0 gap-1`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-gray-500 mt-1 flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {order.orderNumber}</span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {getBranchName(order.sourceBranchId)}</span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(order.startDate)}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => handlePrint()} data-testid="btn-print">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={exportToExcel} data-testid="btn-excel">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              Excel
            </Button>
            {(order.status === 'draft' || order.status === 'pending') && (
              <Link href={`/advanced-production-orders/${id}/edit`}>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 h-11 sm:h-9" data-testid="btn-edit">
                  <Edit className="h-4 w-4 ml-2" />
                  تعديل
                </Button>
              </Link>
            )}
          </div>
        </div>

        {order.status !== 'cancelled' && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                {WORKFLOW_STEPS.map((step, index) => {
                  const isCompleted = currentStepIndex > index;
                  const isCurrent = currentStepIndex === index;
                  const StepIcon = STATUS_CONFIG[step.status]?.icon || Clock;
                  return (
                    <div key={step.status} className="flex items-center flex-1">
                      <div className={`flex flex-col items-center flex-1 ${isCurrent ? 'scale-105' : ''}`}>
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                          isCompleted ? 'bg-green-500 text-white' :
                          isCurrent ? 'bg-amber-500 text-white ring-4 ring-amber-200' :
                          'bg-gray-200 text-gray-400'
                        }`}>
                          {isCompleted ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                        </div>
                        <p className={`text-[10px] sm:text-xs mt-1 font-medium text-center ${
                          isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
                        }`}>{step.label}</p>
                      </div>
                      {index < WORKFLOW_STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 mx-1 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {actions.length > 0 && (
          <Card className="border-2 border-amber-200 shadow-md bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">الخطوة التالية</p>
                    <p className="text-xs text-amber-700">{actions[0]?.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {actions.map(action => {
                    const ActionIcon = action.icon;
                    return (
                      <Button
                        key={action.nextStatus}
                        onClick={() => handleStatusAction(action.nextStatus, action.label)}
                        disabled={statusMutation.isPending}
                        className={`${action.color} gap-2 h-11 sm:h-10 flex-1 sm:flex-none`}
                        data-testid={`btn-status-${action.nextStatus}`}
                      >
                        {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon className="h-4 w-4" />}
                        {action.label}
                      </Button>
                    );
                  })}
                  {order.status !== 'cancelled' && order.status !== 'completed' && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusAction('cancelled', 'إلغاء الأمر')}
                      disabled={statusMutation.isPending}
                      className="border-red-300 text-red-600 hover:bg-red-50 h-11 sm:h-10"
                      data-testid="btn-status-cancel"
                    >
                      <XCircle className="h-4 w-4 ml-1" />
                      إلغاء
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {order.status === 'cancelled' && (
          <Card className="border-2 border-gray-300 bg-gray-50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-400" />
                <div>
                  <p className="font-bold text-gray-700">هذا الأمر ملغي</p>
                  <p className="text-xs text-gray-500">يمكنك إعادة تفعيله كمسودة</p>
                </div>
              </div>
              <Button
                onClick={() => handleStatusAction('draft', 'إعادة تفعيل')}
                disabled={statusMutation.isPending}
                className="bg-gray-600 hover:bg-gray-700 text-white"
                data-testid="btn-reactivate"
              >
                <RotateCcw className="h-4 w-4 ml-2" />
                إعادة تفعيل
              </Button>
            </CardContent>
          </Card>
        )}

        {(order.status === 'approved' || order.status === 'in_progress') && (
          <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center">
                    <Factory className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-purple-900">الإنتاج اليومي</p>
                    <p className="text-xs text-purple-700">انتقل لصفحة الإنتاج اليومي لتسجيل الدفعات المنتجة</p>
                  </div>
                </div>
                <Link href={`/daily-production?branchId=${order.sourceBranchId}`}>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-11 sm:h-10" data-testid="btn-go-production">
                    <Factory className="h-4 w-4" />
                    فتح الإنتاج اليومي
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div ref={printRef} className="space-y-4 sm:space-y-6 print:block">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className={`border-0 shadow-sm ${overallAchievement >= 100 ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200' : overallAchievement >= 50 ? 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200' : 'bg-gradient-to-br from-red-50 to-orange-100 border-red-200'}`}>
              <CardContent className="p-3 sm:p-4 text-center">
                <BarChart3 className={`w-6 h-6 mx-auto mb-1 ${overallAchievement >= 100 ? 'text-green-600' : overallAchievement >= 50 ? 'text-amber-600' : 'text-red-600'}`} />
                <p className={`text-2xl sm:text-3xl font-bold ${overallAchievement >= 100 ? 'text-green-700' : overallAchievement >= 50 ? 'text-amber-700' : 'text-red-700'}`} data-testid="stat-achievement">
                  {overallAchievement}%
                </p>
                <p className="text-xs text-gray-600">نسبة الإنجاز الكلية</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="p-3 sm:p-4 text-center">
                <CircleCheck className="w-6 h-6 mx-auto mb-1 text-green-600" />
                <p className="text-2xl sm:text-3xl font-bold text-green-700" data-testid="stat-fulfilled">{fulfilledCount}</p>
                <p className="text-xs text-gray-600">مكتمل ({items.length} صنف)</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardContent className="p-3 sm:p-4 text-center">
                <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-amber-600" />
                <p className="text-2xl sm:text-3xl font-bold text-amber-700" data-testid="stat-partial">{partialCount}</p>
                <p className="text-xs text-gray-600">إنتاج جزئي</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50">
              <CardContent className="p-3 sm:p-4 text-center">
                <MinusCircle className="w-6 h-6 mx-auto mb-1 text-red-600" />
                <p className="text-2xl sm:text-3xl font-bold text-red-700" data-testid="stat-not-started">{notStartedCount}</p>
                <p className="text-xs text-gray-600">لم يبدأ بعد</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <ArrowUpDown className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">مقارنة أمر الإنتاج مع الإنتاج الفعلي</CardTitle>
                  {orderData?.comparisonScope && (
                    <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-600">
                      <Clock className="h-3 w-3 ml-1" />
                      {orderData.comparisonScope}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-gray-600">
                    <Target className="h-4 w-4" />
                    المطلوب: <strong>{totalTarget.toLocaleString()}</strong>
                  </span>
                  <span className="flex items-center gap-1 text-gray-600">
                    <Factory className="h-4 w-4" />
                    المنتج: <strong className="text-blue-600">{totalProduced.toLocaleString()}</strong>
                  </span>
                  <span className={`flex items-center gap-1 font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalVariance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {totalVariance >= 0 ? '+' : ''}{totalVariance.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {orderItemsComparison.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="text-right font-semibold w-[40px]">#</TableHead>
                        <TableHead className="text-right font-semibold">المنتج</TableHead>
                        <TableHead className="text-right font-semibold hidden md:table-cell">الفئة</TableHead>
                        <TableHead className="text-center font-semibold">
                          <span className="flex items-center justify-center gap-1"><Target className="h-3.5 w-3.5" /> المطلوب</span>
                        </TableHead>
                        <TableHead className="text-center font-semibold">
                          <span className="flex items-center justify-center gap-1"><Factory className="h-3.5 w-3.5" /> المنتج فعلياً</span>
                        </TableHead>
                        <TableHead className="text-center font-semibold">الفرق</TableHead>
                        <TableHead className="text-center font-semibold w-[160px]">نسبة الإنجاز</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItemsComparison.map((item: ComparisonItem, index: number) => {
                        const isOver = item.variance > 0;
                        const isUnder = item.variance < 0;
                        const isExact = item.variance === 0 && item.actualProduced > 0;
                        const pct = Math.min(item.achievementPct, 100);
                        return (
                          <TableRow key={item.orderItemId || index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50 transition-colors`} data-testid={`comparison-row-${index}`}>
                            <TableCell className="font-medium text-gray-400 text-sm">{index + 1}</TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{item.productName}</p>
                              {item.batchCount > 0 && (
                                <p className="text-[10px] text-gray-400">{item.batchCount} دفعة إنتاج</p>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">{item.category || 'عام'}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium text-sm">{item.targetQuantity.toLocaleString()} <span className="text-[10px] text-gray-400">{item.unit}</span></TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold text-sm ${item.actualProduced > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                                {item.actualProduced.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-gray-400 mr-1">{item.unit}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-xs ${
                                isOver ? 'bg-green-100 text-green-700 border-green-200' :
                                isExact ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                isUnder ? 'bg-red-100 text-red-700 border-red-200' :
                                'bg-gray-100 text-gray-500 border-gray-200'
                              }`}>
                                {item.variance > 0 ? '+' : ''}{item.variance.toLocaleString()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      item.achievementPct >= 100 ? 'bg-green-500' :
                                      item.achievementPct >= 75 ? 'bg-blue-500' :
                                      item.achievementPct >= 50 ? 'bg-amber-500' :
                                      item.achievementPct > 0 ? 'bg-orange-500' :
                                      'bg-gray-300'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold min-w-[36px] text-left ${
                                  item.achievementPct >= 100 ? 'text-green-600' :
                                  item.achievementPct >= 50 ? 'text-amber-600' :
                                  'text-red-600'
                                }`}>
                                  {item.achievementPct}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-gradient-to-l from-blue-50 to-indigo-50 font-bold border-t-2">
                        <TableCell colSpan={3} className="text-right font-bold text-sm">الإجمالي</TableCell>
                        <TableCell className="text-center font-bold text-sm">{totalTarget.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-sm text-blue-700">{totalProduced.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs font-bold ${totalVariance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {totalVariance >= 0 ? '+' : ''}{totalVariance.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(overallAchievement, 100)} className="h-3 flex-1" />
                            <span className={`text-xs font-bold ${overallAchievement >= 100 ? 'text-green-600' : 'text-amber-600'}`}>{overallAchievement}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ArrowUpDown className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium mb-1">لا توجد بيانات مقارنة</p>
                  <p className="text-sm">لم يتم تسجيل إنتاج يومي لهذا الأمر بعد</p>
                </div>
              )}
            </CardContent>
          </Card>

          {extraProduction.length > 0 && (
            <Card className="border-0 shadow-sm border-t-4 border-t-amber-400">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base">إنتاج إضافي (خارج أمر الإنتاج)</CardTitle>
                  <Badge variant="secondary">{extraProduction.length} صنف</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="min-w-[400px]">
                    <TableHeader>
                      <TableRow className="bg-amber-50/50">
                        <TableHead className="text-right font-semibold">#</TableHead>
                        <TableHead className="text-right font-semibold">المنتج</TableHead>
                        <TableHead className="text-right font-semibold">الفئة</TableHead>
                        <TableHead className="text-center font-semibold">الكمية المنتجة</TableHead>
                        <TableHead className="text-center font-semibold">عدد الدفعات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extraProduction.map((item: ComparisonItem, index: number) => (
                        <TableRow key={index} className="hover:bg-amber-50/50">
                          <TableCell className="text-sm">{index + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{item.category || 'عام'}</Badge></TableCell>
                          <TableCell className="text-center font-bold text-amber-700">{item.actualProduced.toLocaleString()} {item.unit}</TableCell>
                          <TableCell className="text-center text-sm">{item.batchCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base">تفاصيل الأمر</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">نوع الأمر</p>
                    <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">الأولوية</p>
                    <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">الفرع</p>
                    <p className="font-medium text-sm flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      {getBranchName(order.sourceBranchId)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">الفترة</p>
                    <p className="font-medium text-sm flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      {formatDate(order.startDate)} - {formatDate(order.endDate)}
                    </p>
                  </div>
                </div>
                {order.targetSalesValue > 0 && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">المبيعات المستهدفة</p>
                        <p className="font-bold text-sm text-blue-600">{formatCurrency(order.targetSalesValue)}</p>
                      </div>
                      {order.sourceSalesValue > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">المبيعات المصدر</p>
                          <p className="font-bold text-sm">{formatCurrency(order.sourceSalesValue)}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {order.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-base">ملخص الأداء</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">نسبة الإنجاز الإجمالية</span>
                    <span className={`font-bold ${overallAchievement >= 100 ? 'text-green-600' : 'text-amber-600'}`}>{overallAchievement}%</span>
                  </div>
                  <Progress value={Math.min(overallAchievement, 100)} className="h-3" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">إجمالي الأصناف في الأمر</span>
                    <span className="font-medium">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5 text-green-500" /> مكتمل</span>
                    <span className="font-medium text-green-600">{fulfilledCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> جزئي</span>
                    <span className="font-medium text-amber-600">{partialCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1"><MinusCircle className="h-3.5 w-3.5 text-red-500" /> لم يبدأ</span>
                    <span className="font-medium text-red-600">{notStartedCount}</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">الكمية المطلوبة</span>
                    <span className="font-medium">{totalTarget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">الكمية المنتجة</span>
                    <span className="font-bold text-blue-600">{totalProduced.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">الفرق</span>
                    <span className={`font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalVariance >= 0 ? '+' : ''}{totalVariance.toLocaleString()}
                    </span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>تاريخ الإنشاء</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>آخر تحديث</span>
                    <span>{formatDate(order.updatedAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تغيير الحالة</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد {pendingAction?.label}؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="ملاحظات (اختياري)..."
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              className="text-right"
              data-testid="input-status-notes"
            />
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => { setStatusNotes(""); setPendingAction(null); }}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={statusMutation.isPending}>
              {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
