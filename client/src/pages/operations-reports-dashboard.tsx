import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Factory, 
  CheckCircle, XCircle, Clock, AlertTriangle, Download, Wallet, CreditCard, Truck,
  Building2, Activity, Target, Package
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";
import type { Branch } from "@shared/schema";
import * as XLSX from "xlsx";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة ائتمان",
  mada: "مدى",
  apple_pay: "Apple Pay",
  stc_pay: "STC Pay",
  hunger_station: "هنقرستيشن",
  toyou: "ToYou",
  jahez: "جاهز",
  marsool: "مرسول",
  keeta: "كيتا",
  the_chefs: "ذا شيفز",
  talabat: "طلبات",
  other: "أخرى",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "مقدمة",
  posted: "مرحّلة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغاة",
  passed: "ناجح",
  failed: "فاشل",
  needs_improvement: "يحتاج تحسين",
};

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];

interface OperationsReport {
  salesReport: {
    totalSales: number;
    cashSales: number;
    networkSales: number;
    deliverySales: number;
    totalTransactions: number;
    averageTicket: number;
    totalShortages: number;
    shortageAmount: number;
    totalSurpluses: number;
    surplusAmount: number;
    journalsByStatus: { status: string; count: number }[];
    paymentMethodBreakdown: { method: string; amount: number; count: number }[];
    dailySales: { date: string; sales: number; transactions: number }[];
  };
  productionReport: {
    totalOrders: number;
    pendingOrders: number;
    inProgressOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalQuantityProduced: number;
    qualityPassRate: number;
    qualityChecks: { status: string; count: number }[];
    ordersByProduct: { productName: string; quantity: number; orderCount: number }[];
    dailyProduction: { date: string; quantity: number; orders: number }[];
  };
  shiftsReport: {
    totalShifts: number;
    shiftsWithEmployees: number;
    totalEmployeeAssignments: number;
    shiftsByType: { type: string; count: number }[];
    employeesByRole: { role: string; count: number }[];
  };
  branchComparison: {
    branchId: string;
    branchName: string;
    totalSales: number;
    totalOrders: number;
    qualityPassRate: number;
    averageTicket: number;
  }[];
}

function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendLabel,
  color = "text-primary",
  bgColor = "bg-primary/10"
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: string;
  bgColor?: string;
}) {
  return (
    <Card data-testid={`kpi-card-${title.replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {trendLabel && (
              <div className="flex items-center gap-1 mt-1 text-xs">
                {trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                {trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                <span className={trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}>
                  {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OperationsReportsDashboardPage() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const [filters, setFilters] = useState({
    branchId: "",
    startDate: thirtyDaysAgo,
    endDate: today,
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const queryString = new URLSearchParams({
    ...(filters.branchId && { branchId: filters.branchId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  }).toString();

  const { data: report, isLoading } = useQuery<OperationsReport>({
    queryKey: [`/api/operations/reports?${queryString}`],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("ar-SA").format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const handleExport = () => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    const salesData = [
      ["تقرير المبيعات"],
      ["إجمالي المبيعات", report.salesReport.totalSales],
      ["المبيعات النقدية", report.salesReport.cashSales],
      ["مبيعات الشبكة", report.salesReport.networkSales],
      ["مبيعات التوصيل", report.salesReport.deliverySales],
      ["إجمالي العمليات", report.salesReport.totalTransactions],
      ["متوسط قيمة الفاتورة", report.salesReport.averageTicket],
      ["عدد حالات العجز", report.salesReport.totalShortages],
      ["إجمالي العجز", report.salesReport.shortageAmount],
      ["عدد حالات الفائض", report.salesReport.totalSurpluses],
      ["إجمالي الفائض", report.salesReport.surplusAmount],
    ];
    const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
    XLSX.utils.book_append_sheet(wb, salesSheet, "المبيعات");

    const productionData = [
      ["تقرير الإنتاج"],
      ["إجمالي الأوامر", report.productionReport.totalOrders],
      ["قيد الانتظار", report.productionReport.pendingOrders],
      ["قيد التنفيذ", report.productionReport.inProgressOrders],
      ["مكتملة", report.productionReport.completedOrders],
      ["ملغاة", report.productionReport.cancelledOrders],
      ["الكمية المنتجة", report.productionReport.totalQuantityProduced],
      ["نسبة النجاح في الجودة", `${report.productionReport.qualityPassRate.toFixed(1)}%`],
    ];
    const productionSheet = XLSX.utils.aoa_to_sheet(productionData);
    XLSX.utils.book_append_sheet(wb, productionSheet, "الإنتاج");

    const branchData = [
      ["مقارنة الفروع"],
      ["الفرع", "المبيعات", "الأوامر", "نسبة الجودة", "متوسط الفاتورة"],
      ...report.branchComparison.map(b => [
        b.branchName,
        b.totalSales,
        b.totalOrders,
        `${b.qualityPassRate.toFixed(1)}%`,
        b.averageTicket.toFixed(2),
      ]),
    ];
    const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
    XLSX.utils.book_append_sheet(wb, branchSheet, "مقارنة الفروع");

    XLSX.writeFile(wb, `تقارير_التشغيل_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">لوحة تقارير التشغيل</h1>
            <p className="text-muted-foreground">تقارير شاملة لجميع عمليات التشغيل والإنتاج والمبيعات</p>
          </div>
          <Button onClick={handleExport} disabled={!report} className="gap-2" data-testid="button-export">
            <Download className="w-4 h-4" />
            تصدير Excel
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">الفلاتر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>الفرع</Label>
                <Select value={filters.branchId} onValueChange={(v) => setFilters({ ...filters, branchId: v })}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">جميع الفروع</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ branchId: "", startDate: thirtyDaysAgo, endDate: today })}
                  data-testid="button-reset-filters"
                >
                  إعادة تعيين
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : report ? (
          <Tabs defaultValue="sales" className="space-y-6">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="sales" data-testid="tab-sales">المبيعات</TabsTrigger>
              <TabsTrigger value="production" data-testid="tab-production">الإنتاج</TabsTrigger>
              <TabsTrigger value="shifts" data-testid="tab-shifts">الورديات</TabsTrigger>
              <TabsTrigger value="branches" data-testid="tab-branches">مقارنة الفروع</TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                  title="إجمالي المبيعات"
                  value={formatCurrency(report.salesReport.totalSales)}
                  icon={DollarSign}
                  color="text-green-600"
                  bgColor="bg-green-100"
                />
                <KPICard
                  title="المبيعات النقدية"
                  value={formatCurrency(report.salesReport.cashSales)}
                  icon={Wallet}
                  color="text-emerald-600"
                  bgColor="bg-emerald-100"
                />
                <KPICard
                  title="مبيعات الشبكة"
                  value={formatCurrency(report.salesReport.networkSales)}
                  icon={CreditCard}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <KPICard
                  title="مبيعات التوصيل"
                  value={formatCurrency(report.salesReport.deliverySales)}
                  icon={Truck}
                  color="text-purple-600"
                  bgColor="bg-purple-100"
                />
                <KPICard
                  title="إجمالي العمليات"
                  value={formatNumber(report.salesReport.totalTransactions)}
                  icon={ShoppingCart}
                  color="text-indigo-600"
                  bgColor="bg-indigo-100"
                />
                <KPICard
                  title="متوسط قيمة الفاتورة"
                  value={formatCurrency(report.salesReport.averageTicket)}
                  icon={Target}
                  color="text-cyan-600"
                  bgColor="bg-cyan-100"
                />
                <KPICard
                  title="إجمالي العجز"
                  value={formatCurrency(report.salesReport.shortageAmount)}
                  icon={TrendingDown}
                  color="text-red-600"
                  bgColor="bg-red-100"
                  trendLabel={`${report.salesReport.totalShortages} حالة`}
                />
                <KPICard
                  title="إجمالي الفائض"
                  value={formatCurrency(report.salesReport.surplusAmount)}
                  icon={TrendingUp}
                  color="text-amber-600"
                  bgColor="bg-amber-100"
                  trendLabel={`${report.salesReport.totalSurpluses} حالة`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">المبيعات اليومية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={report.salesReport.dailySales}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => `التاريخ: ${label}`}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="sales" 
                            name="المبيعات" 
                            stroke="#10B981" 
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">توزيع طرق الدفع</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.salesReport.paymentMethodBreakdown}
                            dataKey="amount"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ method, percent }) => 
                              `${PAYMENT_METHOD_LABELS[method] || method}: ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {report.salesReport.paymentMethodBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">حالة اليوميات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.salesReport.journalsByStatus}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="status" 
                          fontSize={12}
                          tickFormatter={(value) => STATUS_LABELS[value] || value}
                        />
                        <YAxis fontSize={12} />
                        <Tooltip 
                          labelFormatter={(label) => STATUS_LABELS[label] || label}
                        />
                        <Bar dataKey="count" name="العدد" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="production" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                  title="إجمالي الأوامر"
                  value={formatNumber(report.productionReport.totalOrders)}
                  icon={Package}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <KPICard
                  title="قيد الانتظار"
                  value={formatNumber(report.productionReport.pendingOrders)}
                  icon={Clock}
                  color="text-yellow-600"
                  bgColor="bg-yellow-100"
                />
                <KPICard
                  title="قيد التنفيذ"
                  value={formatNumber(report.productionReport.inProgressOrders)}
                  icon={Activity}
                  color="text-orange-600"
                  bgColor="bg-orange-100"
                />
                <KPICard
                  title="مكتملة"
                  value={formatNumber(report.productionReport.completedOrders)}
                  icon={CheckCircle}
                  color="text-green-600"
                  bgColor="bg-green-100"
                />
                <KPICard
                  title="ملغاة"
                  value={formatNumber(report.productionReport.cancelledOrders)}
                  icon={XCircle}
                  color="text-red-600"
                  bgColor="bg-red-100"
                />
                <KPICard
                  title="الكمية المنتجة"
                  value={formatNumber(report.productionReport.totalQuantityProduced)}
                  icon={Factory}
                  color="text-indigo-600"
                  bgColor="bg-indigo-100"
                />
                <KPICard
                  title="نسبة نجاح الجودة"
                  value={formatPercent(report.productionReport.qualityPassRate)}
                  icon={report.productionReport.qualityPassRate >= 90 ? CheckCircle : AlertTriangle}
                  color={report.productionReport.qualityPassRate >= 90 ? "text-green-600" : "text-yellow-600"}
                  bgColor={report.productionReport.qualityPassRate >= 90 ? "bg-green-100" : "bg-yellow-100"}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الإنتاج اليومي</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.productionReport.dailyProduction}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="quantity" name="الكمية" fill="#10B981" />
                          <Bar dataKey="orders" name="الأوامر" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">نتائج فحوصات الجودة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.productionReport.qualityChecks}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ status, percent }) => 
                              `${STATUS_LABELS[status] || status}: ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {report.productionReport.qualityChecks.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.status === 'passed' ? '#10B981' : entry.status === 'failed' ? '#EF4444' : '#F59E0B'} 
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">الإنتاج حسب المنتج</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.productionReport.ordersByProduct.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis type="category" dataKey="productName" fontSize={12} width={150} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="quantity" name="الكمية" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shifts" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                  title="إجمالي الورديات"
                  value={formatNumber(report.shiftsReport.totalShifts)}
                  icon={Clock}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <KPICard
                  title="الورديات مع موظفين"
                  value={formatNumber(report.shiftsReport.shiftsWithEmployees)}
                  icon={Users}
                  color="text-green-600"
                  bgColor="bg-green-100"
                />
                <KPICard
                  title="إجمالي التكليفات"
                  value={formatNumber(report.shiftsReport.totalEmployeeAssignments)}
                  icon={Users}
                  color="text-indigo-600"
                  bgColor="bg-indigo-100"
                />
                <KPICard
                  title="نسبة التغطية"
                  value={report.shiftsReport.totalShifts > 0 
                    ? formatPercent((report.shiftsReport.shiftsWithEmployees / report.shiftsReport.totalShifts) * 100)
                    : "100%"
                  }
                  icon={Target}
                  color="text-purple-600"
                  bgColor="bg-purple-100"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الورديات حسب النوع</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.shiftsReport.shiftsByType}
                            dataKey="count"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {report.shiftsReport.shiftsByType.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الموظفين حسب الدور</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.shiftsReport.employeesByRole}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="role" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="count" name="العدد" fill="#8B5CF6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="branches" className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">مقارنة المبيعات بين الفروع</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.branchComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="branchName" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                          <Bar dataKey="totalSales" name="المبيعات" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">تفاصيل أداء الفروع</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-right py-3 px-4">الفرع</th>
                            <th className="text-right py-3 px-4">المبيعات</th>
                            <th className="text-right py-3 px-4">الأوامر</th>
                            <th className="text-right py-3 px-4">نسبة الجودة</th>
                            <th className="text-right py-3 px-4">متوسط الفاتورة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.branchComparison.map((branch) => (
                            <tr key={branch.branchId} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-4 font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-muted-foreground" />
                                  {branch.branchName}
                                </div>
                              </td>
                              <td className="py-3 px-4">{formatCurrency(branch.totalSales)}</td>
                              <td className="py-3 px-4">{formatNumber(branch.totalOrders)}</td>
                              <td className="py-3 px-4">
                                <span className={branch.qualityPassRate >= 90 ? "text-green-600" : "text-yellow-600"}>
                                  {formatPercent(branch.qualityPassRate)}
                                </span>
                              </td>
                              <td className="py-3 px-4">{formatCurrency(branch.averageTicket)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
