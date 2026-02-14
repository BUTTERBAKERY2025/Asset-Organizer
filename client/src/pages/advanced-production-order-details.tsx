import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams, Link } from "wouter";
import { 
  ArrowRight, Edit, Printer, Package, Calendar, Factory, 
  ClipboardList, Building2, User, Clock, TrendingUp, CheckCircle,
  AlertCircle, Loader2, FileText, Download, FileSpreadsheet,
  Play, Pause, XCircle, Send, ThumbsUp, RotateCcw, ChevronLeft,
  ArrowLeftRight, Sparkles
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

interface OrderSchedule {
  id: number;
  scheduleDate: string;
  shift: string;
  productId: number;
  productName: string;
  quantity: number;
  status: string;
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
  schedules?: OrderSchedule[];
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
    const rawSchedules = response.schedules || [];
    
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
    
    const schedules = rawSchedules.map((schedule: any) => ({
      id: schedule.id,
      scheduleDate: schedule.scheduleDate || schedule.schedule_date,
      shift: schedule.shift,
      productId: schedule.productId || schedule.product_id,
      productName: schedule.productName || schedule.product_name || "",
      quantity: Number(schedule.quantity) || 0,
      status: schedule.status || "pending"
    }));
    
    return { order, items, schedules };
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
    const { order, items } = orderData;
    
    const orderInfo = [
      ["رقم الأمر", order.orderNumber],
      ["العنوان", order.title || "-"],
      ["الحالة", STATUS_CONFIG[order.status]?.label || order.status],
      ["النوع", ORDER_TYPE_CONFIG[order.orderType]?.label || order.orderType],
      ["الأولوية", PRIORITY_CONFIG[order.priority]?.label || order.priority],
      ["الفرع المصدر", getBranchName(order.sourceBranchId)],
      ["الفرع المستهدف", getBranchName(order.targetBranchId)],
      ["تاريخ البدء", formatDate(order.startDate)],
      ["تاريخ الانتهاء", formatDate(order.endDate)],
      ["نسبة الإنجاز", `${order.completionPercentage || 0}%`],
      ["التكلفة المقدرة", formatCurrency(order.estimatedCost || 0)],
      ["التكلفة الفعلية", formatCurrency(order.actualCost || 0)],
    ];

    const itemsData = items.map((item: OrderItem, index: number) => [
      index + 1,
      item.productName,
      item.category || 'عام',
      item.targetQuantity,
      item.producedQuantity || 0,
      item.unit,
      item.unitPrice,
      (item.targetQuantity || 0) * (item.unitPrice || 0)
    ]);

    const wb = XLSX.utils.book_new();
    
    const wsInfo = XLSX.utils.aoa_to_sheet(orderInfo);
    XLSX.utils.book_append_sheet(wb, wsInfo, "معلومات الأمر");

    const wsItems = XLSX.utils.aoa_to_sheet([
      ["#", "المنتج", "الفئة", "الكمية المطلوبة", "الكمية المنتجة", "الوحدة", "سعر الوحدة", "الإجمالي"],
      ...itemsData
    ]);
    XLSX.utils.book_append_sheet(wb, wsItems, "المنتجات");

    XLSX.writeFile(wb, `امر_انتاج_${order.orderNumber}.xlsx`);
  };

  const exportToPdf = async () => {
    if (!orderData) return;
    const { order, items } = orderData;

    try {
      const response = await fetch("/api/pdf/production-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          title: order.title || '',
          status: STATUS_CONFIG[order.status]?.label || order.status,
          priority: PRIORITY_CONFIG[order.priority]?.label || order.priority,
          orderType: ORDER_TYPE_CONFIG[order.orderType]?.label || order.orderType,
          branchName: getBranchName(order.sourceBranchId),
          targetDate: formatDate(order.endDate),
          notes: order.notes || '',
          estimatedCost: order.estimatedCost || 0,
          actualCost: order.actualCost || 0,
          targetSalesValue: order.targetSalesValue || 0,
          sourceSalesValue: order.sourceSalesValue || 0,
          items: items.map((item: OrderItem) => {
            const originalQty = item.originalQuantity || 0;
            const targetQty = item.targetQuantity || 0;
            const increaseQty = originalQty > 0 ? targetQty - originalQty : 0;
            return {
              productName: item.productName,
              category: item.category || 'عام',
              targetQuantity: targetQty,
              producedQuantity: item.producedQuantity || 0,
              unitPrice: item.unitPrice || 0,
              total: targetQty * (item.unitPrice || 0),
              originalQuantity: originalQty,
              increaseQuantity: increaseQty > 0 ? increaseQty : 0,
            };
          }),
        }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `امر_انتاج_${order.orderNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting production order PDF:", error);
    }
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  const order = orderData?.order;
  const items = orderData?.items || [];
  const schedules = orderData?.schedules || [];

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

  const totalTargetQuantity = items.reduce((sum: number, item: OrderItem) => sum + (item.targetQuantity || 0), 0);
  const totalProducedQuantity = items.reduce((sum: number, item: OrderItem) => sum + (item.producedQuantity || 0), 0);
  const totalItemsCost = items.reduce((sum: number, item: OrderItem) => sum + ((item.targetQuantity || 0) * (item.unitPrice || 0)), 0);
  const completionPct = totalTargetQuantity > 0 ? Math.round((totalProducedQuantity / totalTargetQuantity) * 100) : (order.completionPercentage || 0);

  return (
    <Layout>
      <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6" dir="rtl">
        {/* Header */}
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
              <p className="text-gray-500 mt-1 flex items-center gap-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                رقم الأمر: {order.orderNumber}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => handlePrint()} data-testid="btn-print">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={exportToPdf} data-testid="btn-pdf">
              <Download className="h-4 w-4 ml-2" />
              PDF
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

        {/* Workflow Steps */}
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
                        <div className={`h-0.5 flex-1 mx-1 ${
                          isCompleted ? 'bg-green-400' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
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

        {/* Cancelled - Reactivate */}
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

        {/* Link to Daily Production - show when approved or in_progress */}
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
                    <p className="text-xs text-purple-700">انتقل لصفحة الإنتاج اليومي لتسجيل الدفعات المنتجة حسب هذا الأمر</p>
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

        <div ref={printRef} className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 print:block">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Order Details */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg">تفاصيل الأمر</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">نوع الأمر</p>
                    <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">الأولوية</p>
                    <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">تاريخ البدء</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {formatDate(order.startDate)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">تاريخ الانتهاء</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {formatDate(order.endDate)}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      الفرع المصدر
                    </p>
                    <p className="font-medium">{getBranchName(order.sourceBranchId)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      الفرع المستهدف
                    </p>
                    <p className="font-medium">{getBranchName(order.targetBranchId)}</p>
                  </div>
                </div>

                {order.description && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-sm text-gray-500 mb-2">الوصف</p>
                      <p className="text-gray-700">{order.description}</p>
                    </div>
                  </>
                )}

                {order.notes && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-sm text-gray-500 mb-2">ملاحظات</p>
                      <p className="text-gray-700 whitespace-pre-line text-sm">{order.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Products Table */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">منتجات الأمر</CardTitle>
                  </div>
                  <Badge variant="secondary">{items.length} منتج</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {items.length > 0 ? (
                  <div className="rounded-lg border overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right hidden md:table-cell">الفئة</TableHead>
                          <TableHead className="text-right">الكمية المطلوبة</TableHead>
                          <TableHead className="text-right">الكمية المنتجة</TableHead>
                          <TableHead className="text-right">التقدم</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item: OrderItem, index: number) => {
                          const itemPct = item.targetQuantity > 0 ? Math.round((item.producedQuantity / item.targetQuantity) * 100) : 0;
                          return (
                            <TableRow key={item.id || index}>
                              <TableCell className="font-medium text-xs sm:text-sm">{index + 1}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-xs sm:text-sm">{item.productName}</p>
                                  {item.notes && <p className="text-[10px] sm:text-xs text-gray-500">{item.notes}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline" className="text-[10px] sm:text-xs bg-slate-50 border-slate-300 text-slate-600">
                                  {item.category || 'عام'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm">{item.targetQuantity} {item.unit}</TableCell>
                              <TableCell>
                                <span className={`text-xs sm:text-sm font-medium ${item.producedQuantity >= item.targetQuantity ? "text-green-600" : "text-amber-600"}`}>
                                  {item.producedQuantity || 0} {item.unit}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 min-w-[80px]">
                                  <Progress value={Math.min(itemPct, 100)} className="h-2 flex-1" />
                                  <span className={`text-[10px] font-bold ${itemPct >= 100 ? 'text-green-600' : 'text-amber-600'}`}>{itemPct}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs sm:text-sm font-medium">{formatCurrency((item.targetQuantity || 0) * (item.unitPrice || 0))}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>لا توجد منتجات في هذا الأمر</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedules */}
            {schedules.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-lg">جدول الإنتاج</CardTitle>
                    </div>
                    <Badge variant="secondary">{schedules.length} موعد</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="rounded-lg border overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الفترة</TableHead>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">الكمية</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedules.map((schedule: OrderSchedule, index: number) => (
                          <TableRow key={schedule.id || index}>
                            <TableCell className="text-xs sm:text-sm">{formatDate(schedule.scheduleDate)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {schedule.shift === "morning" ? "صباحي" : schedule.shift === "evening" ? "مسائي" : "ليلي"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{schedule.productName}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs sm:text-sm">{schedule.quantity}</TableCell>
                            <TableCell>
                              <Badge className={
                                schedule.status === "completed" ? "bg-green-100 text-green-700" :
                                schedule.status === "in_progress" ? "bg-purple-100 text-purple-700" :
                                "bg-gray-100 text-gray-700"
                              }>
                                {schedule.status === "completed" ? "مكتمل" : schedule.status === "in_progress" ? "جاري" : "معلق"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Progress Summary */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg">ملخص التقدم</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">نسبة الإنجاز</span>
                    <span className="font-bold text-amber-700">{completionPct}%</span>
                  </div>
                  <Progress value={completionPct} className="h-3" />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">إجمالي المنتجات</span>
                    <span className="font-medium">{items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">الكمية المطلوبة</span>
                    <span className="font-medium">{totalTargetQuantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">الكمية المنتجة</span>
                    <span className="font-medium text-green-600">{totalProducedQuantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">المتبقي</span>
                    <span className="font-medium text-amber-600">{Math.max(0, totalTargetQuantity - totalProducedQuantity).toLocaleString()}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">التكلفة المقدرة</span>
                    <span className="font-medium text-sm">{formatCurrency(order.estimatedCost || totalItemsCost)}</span>
                  </div>
                  {order.targetSalesValue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm">المبيعات المستهدفة</span>
                      <span className="font-medium text-sm text-blue-600">{formatCurrency(order.targetSalesValue)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <CardTitle className="text-lg">سجل التواريخ</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">تاريخ الإنشاء</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">آخر تحديث</span>
                  <span>{formatDate(order.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Status Change Confirmation Dialog */}
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
