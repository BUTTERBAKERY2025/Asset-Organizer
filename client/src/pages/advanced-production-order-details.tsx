import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowRight, Edit, Printer, Package, Calendar, Factory, 
  ClipboardList, Building2, User, Clock, TrendingUp, CheckCircle,
  AlertCircle, Loader2, FileText
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Branch } from "@shared/schema";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: "مسودة", color: "text-gray-700", bgColor: "bg-gray-100" },
  pending: { label: "قيد الانتظار", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  approved: { label: "معتمد", color: "text-blue-700", bgColor: "bg-blue-100" },
  in_progress: { label: "قيد التنفيذ", color: "text-purple-700", bgColor: "bg-purple-100" },
  completed: { label: "مكتمل", color: "text-green-700", bgColor: "bg-green-100" },
  cancelled: { label: "ملغي", color: "text-red-700", bgColor: "bg-red-100" },
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

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  targetQuantity: number;
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
  order?: any;
  items?: OrderItem[];
  schedules?: OrderSchedule[];
}

export default function AdvancedProductionOrderDetailsPage() {
  const { id } = useParams();

  const { data: rawData, isLoading } = useQuery<OrderResponse>({
    queryKey: [`/api/advanced-production-orders/${id}`],
    enabled: !!id,
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
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
      targetQuantity: Number(item.targetQuantity || item.target_quantity || item.quantity) || 0,
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

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6 p-6" dir="rtl">
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

  const totalTargetQuantity = items.reduce((sum: number, item: OrderItem) => sum + (item.targetQuantity || 0), 0);
  const totalProducedQuantity = items.reduce((sum: number, item: OrderItem) => sum + (item.producedQuantity || 0), 0);
  const totalItemsCost = items.reduce((sum: number, item: OrderItem) => sum + ((item.targetQuantity || 0) * (item.unitPrice || 0)), 0);

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/advanced-production-orders">
              <Button variant="ghost" size="icon" className="hover:bg-amber-50">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="order-title">
                  {order.title || order.orderNumber}
                </h1>
                <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-gray-500 mt-1 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                رقم الأمر: {order.orderNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="btn-print">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
            <Link href={`/advanced-production-orders/${id}/edit`}>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700" data-testid="btn-edit">
                <Edit className="h-4 w-4 ml-2" />
                تعديل
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg">تفاصيل الأمر</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
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
                      <p className="text-gray-700">{order.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

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
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">الكمية المطلوبة</TableHead>
                          <TableHead className="text-right">الكمية المنتجة</TableHead>
                          <TableHead className="text-right">سعر الوحدة</TableHead>
                          <TableHead className="text-right">الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item: OrderItem, index: number) => (
                          <TableRow key={item.id || index}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.productName}</p>
                                {item.notes && <p className="text-xs text-gray-500">{item.notes}</p>}
                              </div>
                            </TableCell>
                            <TableCell>{item.targetQuantity} {item.unit}</TableCell>
                            <TableCell>
                              <span className={item.producedQuantity >= item.targetQuantity ? "text-green-600" : "text-amber-600"}>
                                {item.producedQuantity || 0} {item.unit}
                              </span>
                            </TableCell>
                            <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="font-medium">{formatCurrency((item.targetQuantity || 0) * (item.unitPrice || 0))}</TableCell>
                          </TableRow>
                        ))}
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
                <CardContent>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الفترة</TableHead>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">الكمية</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedules.map((schedule: OrderSchedule, index: number) => (
                          <TableRow key={schedule.id || index}>
                            <TableCell>{formatDate(schedule.scheduleDate)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {schedule.shift === "morning" ? "صباحي" : schedule.shift === "evening" ? "مسائي" : "ليلي"}
                              </Badge>
                            </TableCell>
                            <TableCell>{schedule.productName}</TableCell>
                            <TableCell>{schedule.quantity}</TableCell>
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

          <div className="space-y-6">
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
                    <span className="font-bold text-amber-700">{order.completionPercentage || 0}%</span>
                  </div>
                  <Progress value={order.completionPercentage || 0} className="h-3" />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">إجمالي المنتجات</span>
                    <span className="font-medium">{items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">الكمية المطلوبة</span>
                    <span className="font-medium">{totalTargetQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">الكمية المنتجة</span>
                    <span className="font-medium text-green-600">{totalProducedQuantity}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">التكلفة المقدرة</span>
                    <span className="font-medium">{formatCurrency(order.estimatedCost || totalItemsCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">التكلفة الفعلية</span>
                    <span className="font-medium">{formatCurrency(order.actualCost || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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
    </Layout>
  );
}
