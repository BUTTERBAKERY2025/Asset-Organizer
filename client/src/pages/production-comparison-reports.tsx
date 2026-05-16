import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Calendar, TrendingUp, TrendingDown, Building2, Package, AlertTriangle, BarChart3, PieChart, Download, RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart as RechartsPie, Pie, Cell } from "recharts";
import { ExportButtons } from "@/components/export-buttons";
import { ExportColumn } from "@/lib/export-utils";

const COLORS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export default function ProductionComparisonReports() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [dateRange, setDateRange] = useState({
    start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0],
    end: currentDate.toISOString().split('T')[0],
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
  });

  const { data: monthlyReport, isLoading: loadingMonthly, refetch: refetchMonthly } = useQuery<any>({
    queryKey: ["/api/production-comparison-reports/monthly-waste", selectedYear, selectedMonth, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: selectedYear,
        month: selectedMonth,
      });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/production-comparison-reports/monthly-waste?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: branchPerformance, isLoading: loadingBranch, refetch: refetchBranch } = useQuery<any>({
    queryKey: ["/api/production-comparison-reports/branch-performance", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const res = await fetch(`/api/production-comparison-reports/branch-performance?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: trends, isLoading: loadingTrends, refetch: refetchTrends } = useQuery<any>({
    queryKey: ["/api/production-comparison-reports/trends", dateRange, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        groupBy: "daily",
      });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/production-comparison-reports/trends?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: topWaste, isLoading: loadingTopWaste, refetch: refetchTopWaste } = useQuery<any>({
    queryKey: ["/api/production-comparison-reports/top-waste-products", dateRange, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        limit: "10",
      });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/production-comparison-reports/top-waste-products?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleRefreshAll = () => {
    refetchMonthly();
    refetchBranch();
    refetchTrends();
    refetchTopWaste();
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b: any) => b.id === branchId);
    return branch?.name || branchId;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value) + " ر.س";
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(Math.round(value));
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Export columns for different reports
  const monthlyExportColumns: ExportColumn[] = [
    { header: "الفئة", key: "category", width: 20 },
    { header: "الإنتاج", key: "produced", width: 15 },
    { header: "المبيعات", key: "sold", width: 15 },
    { header: "الهدر", key: "waste", width: 15 },
    { header: "نسبة الهدر %", key: "wastePercentage", width: 15 },
    { header: "قيمة الهدر", key: "wasteValue", width: 18 },
  ];

  const branchExportColumns: ExportColumn[] = [
    { header: "الفرع", key: "branchName", width: 25 },
    { header: "الإنتاج", key: "totalProduced", width: 15 },
    { header: "المبيعات", key: "totalSold", width: 15 },
    { header: "الهدر", key: "totalWaste", width: 15 },
    { header: "الكفاءة %", key: "efficiency", width: 15 },
    { header: "قيمة الهدر", key: "wasteValue", width: 18 },
  ];

  const trendsExportColumns: ExportColumn[] = [
    { header: "التاريخ", key: "date", width: 15 },
    { header: "الإنتاج", key: "produced", width: 15 },
    { header: "المبيعات", key: "sold", width: 15 },
    { header: "الهدر", key: "waste", width: 15 },
    { header: "الكفاءة %", key: "efficiency", width: 15 },
  ];

  const productsExportColumns: ExportColumn[] = [
    { header: "المنتج", key: "productName", width: 30 },
    { header: "الفئة", key: "category", width: 20 },
    { header: "الإنتاج", key: "totalProduced", width: 15 },
    { header: "الهدر", key: "totalWaste", width: 15 },
    { header: "نسبة الهدر %", key: "wastePercentage", width: 15 },
    { header: "قيمة الهدر", key: "totalWasteValue", width: 18 },
  ];

  // Prepare export data for each tab
  const monthlyExportData = useMemo(() => {
    if (!monthlyReport?.byCategory) return [];
    return monthlyReport.byCategory.map((item: any) => ({
      ...item,
      wastePercentage: item.wastePercentage?.toFixed(1) || "0.0",
      wasteValue: item.wasteValue?.toFixed(0) || "0",
    }));
  }, [monthlyReport]);

  const branchExportData = useMemo(() => {
    if (!branchPerformance?.branches) return [];
    return branchPerformance.branches.map((branch: any) => ({
      ...branch,
      branchName: getBranchName(branch.branchId),
      efficiency: branch.efficiency?.toFixed(1) || "0.0",
      wasteValue: branch.wasteValue?.toFixed(0) || "0",
    }));
  }, [branchPerformance, branches]);

  const trendsExportData = useMemo(() => {
    if (!trends?.data) return [];
    return trends.data.map((item: any) => ({
      ...item,
      efficiency: item.efficiency?.toFixed(1) || "0.0",
    }));
  }, [trends]);

  const productsExportData = useMemo(() => {
    if (!topWaste?.products) return [];
    return topWaste.products.map((product: any) => ({
      ...product,
      wastePercentage: product.wastePercentage?.toFixed(1) || "0.0",
      totalWasteValue: product.totalWasteValue?.toFixed(0) || "0",
    }));
  }, [topWaste]);

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-4" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-amber-900" data-testid="text-page-title">تقارير مقارنة الإنتاج</h1>
              <p className="text-amber-700 mt-1">تحليل شامل للهدر والكفاءة الإنتاجية</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px]" data-testid="select-branch">
                <Building2 className="h-4 w-4 ml-2" />
                <SelectValue placeholder="الفرع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
          </div>
        </div>

        <Tabs defaultValue="monthly" className="space-y-6">
          <TabsList className="bg-white/50 p-1">
            <TabsTrigger value="monthly" className="gap-2" data-testid="tab-monthly">
              <Calendar className="h-4 w-4" />
              التقرير الشهري
            </TabsTrigger>
            <TabsTrigger value="branches" className="gap-2" data-testid="tab-branches">
              <Building2 className="h-4 w-4" />
              أداء الفروع
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-2" data-testid="tab-trends">
              <TrendingUp className="h-4 w-4" />
              الاتجاهات
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2" data-testid="tab-products">
              <Package className="h-4 w-4" />
              أعلى الهدر
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/50 p-4 rounded-lg">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[120px]" data-testid="select-year">
                    <SelectValue placeholder="السنة" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[140px]" data-testid="select-month">
                    <SelectValue placeholder="الشهر" />
                  </SelectTrigger>
                  <SelectContent>
                    {ARABIC_MONTHS.map((month, idx) => (
                      <SelectItem key={idx + 1} value={(idx + 1).toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ExportButtons
                data={monthlyExportData}
                columns={monthlyExportColumns}
                fileName={`تقرير-الهدر-الشهري-${ARABIC_MONTHS[parseInt(selectedMonth) - 1]}-${selectedYear}`}
                title="تقرير الهدر الشهري"
                subtitle={`${ARABIC_MONTHS[parseInt(selectedMonth) - 1]} ${selectedYear}`}
                headerInfo={[
                  { label: "الشهر", value: ARABIC_MONTHS[parseInt(selectedMonth) - 1] },
                  { label: "السنة", value: selectedYear },
                  { label: "الفرع", value: selectedBranch === "all" ? "جميع الفروع" : getBranchName(selectedBranch) },
                ]}
              />
            </div>

            {loadingMonthly ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : monthlyReport ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-700">إجمالي الإنتاج</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-900" data-testid="text-total-produced">
                        {formatNumber(monthlyReport.summary.totalProduced)}
                      </div>
                      <p className="text-xs text-blue-600 mt-1">وحدة</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-700">إجمالي المبيعات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-900" data-testid="text-total-sold">
                        {formatNumber(monthlyReport.summary.totalSold)}
                      </div>
                      <p className="text-xs text-green-600 mt-1">وحدة</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-700">إجمالي الهدر</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-900" data-testid="text-total-waste">
                        {formatNumber(monthlyReport.summary.totalWasteQuantity)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-red-600">وحدة</span>
                        <Badge variant="destructive" className="text-xs">
                          {formatPercent(monthlyReport.summary.wastePercentage)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-amber-700">قيمة الهدر</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-900" data-testid="text-waste-value">
                        {formatCurrency(monthlyReport.summary.totalWasteValue)}
                      </div>
                      <p className="text-xs text-amber-600 mt-1">ريال سعودي</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-amber-600" />
                        الهدر حسب الفئة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {monthlyReport.byCategory?.length > 0 ? (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={monthlyReport.byCategory}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ category, wastePercentage }) => `${category}: ${wastePercentage.toFixed(1)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="waste"
                                nameKey="category"
                              >
                                {monthlyReport.byCategory.map((_: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => formatNumber(value)} />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-gray-500">
                          لا توجد بيانات
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-amber-600" />
                        أعلى 10 منتجات هدراً
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {monthlyReport.topWasteProducts?.length > 0 ? (
                        <div className="space-y-3">
                          {monthlyReport.topWasteProducts.slice(0, 5).map((product: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{product.name}</p>
                                <p className="text-xs text-gray-500">{product.category}</p>
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-red-600">{formatCurrency(product.wasteValue)}</p>
                                <p className="text-xs text-gray-500">{formatNumber(product.waste)} وحدة</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-gray-500">
                          لا توجد بيانات
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <p className="text-gray-500">لا توجد بيانات للفترة المحددة</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="branches" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/50 p-4 rounded-lg">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">من:</span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="border rounded-md px-3 py-2 text-sm"
                    data-testid="input-start-date"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">إلى:</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="border rounded-md px-3 py-2 text-sm"
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <ExportButtons
                data={branchExportData}
                columns={branchExportColumns}
                fileName={`تقرير-أداء-الفروع-${dateRange.start}-${dateRange.end}`}
                title="تقرير أداء الفروع"
                subtitle={`من ${dateRange.start} إلى ${dateRange.end}`}
                headerInfo={[
                  { label: "من تاريخ", value: dateRange.start },
                  { label: "إلى تاريخ", value: dateRange.end },
                ]}
              />
            </div>

            {loadingBranch ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : branchPerformance?.branches?.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-700">أفضل فرع</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-green-900" data-testid="text-best-branch">
                        {getBranchName(branchPerformance.overallStats.bestBranch)}
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        كفاءة: {formatPercent(branchPerformance.branches[0]?.efficiency || 0)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-amber-700">متوسط الكفاءة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-amber-900" data-testid="text-avg-efficiency">
                        {formatPercent(branchPerformance.overallStats.avgEfficiency)}
                      </div>
                      <p className="text-xs text-amber-600 mt-1">لجميع الفروع</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-700">يحتاج تحسين</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-red-900" data-testid="text-worst-branch">
                        {getBranchName(branchPerformance.overallStats.worstBranch)}
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        كفاءة: {formatPercent(branchPerformance.branches[branchPerformance.branches.length - 1]?.efficiency || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>مقارنة أداء الفروع</CardTitle>
                    <CardDescription>ترتيب الفروع حسب نسبة الكفاءة (المبيعات ÷ الإنتاج)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {branchPerformance.branches.map((branch: any, idx: number) => (
                        <div key={branch.branchId} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={idx === 0 ? "default" : idx === branchPerformance.branches.length - 1 ? "destructive" : "secondary"}>
                                #{idx + 1}
                              </Badge>
                              <span className="font-medium">{getBranchName(branch.branchId)}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-green-600">كفاءة: {formatPercent(branch.efficiency)}</span>
                              <span className="text-red-600">هدر: {formatPercent(branch.wastePercentage)}</span>
                              <span className="text-gray-500">{formatNumber(branch.recordCount)} سجل</span>
                            </div>
                          </div>
                          <Progress 
                            value={branch.efficiency} 
                            className="h-2"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>رسم بياني للمقارنة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={branchPerformance.branches.map((b: any) => ({
                          ...b,
                          name: getBranchName(b.branchId),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => formatNumber(value)} />
                          <Legend />
                          <Bar dataKey="totalProduced" name="الإنتاج" fill="#3b82f6" />
                          <Bar dataKey="totalSold" name="المبيعات" fill="#10b981" />
                          <Bar dataKey="totalWaste" name="الهدر" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <p className="text-gray-500">لا توجد بيانات للفترة المحددة</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/50 p-4 rounded-lg">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">من:</span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">إلى:</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <ExportButtons
                data={trendsExportData}
                columns={trendsExportColumns}
                fileName={`تقرير-الاتجاهات-${dateRange.start}-${dateRange.end}`}
                title="تقرير الاتجاهات الزمنية"
                subtitle={`من ${dateRange.start} إلى ${dateRange.end}`}
                headerInfo={[
                  { label: "من تاريخ", value: dateRange.start },
                  { label: "إلى تاريخ", value: dateRange.end },
                  { label: "الفرع", value: selectedBranch === "all" ? "جميع الفروع" : getBranchName(selectedBranch) },
                ]}
              />
            </div>

            {loadingTrends ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : trends?.trends?.length > 0 ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                      اتجاه الإنتاج والمبيعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends.trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => formatNumber(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="produced" name="الإنتاج" stroke="#3b82f6" strokeWidth={2} />
                          <Line type="monotone" dataKey="sold" name="المبيعات" stroke="#10b981" strokeWidth={2} />
                          <Line type="monotone" dataKey="waste" name="الهدر" stroke="#ef4444" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-amber-600" />
                      نسبة الكفاءة اليومية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trends.trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Bar dataKey="efficiency" name="الكفاءة %" fill="#f59e0b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <p className="text-gray-500">لا توجد بيانات للفترة المحددة</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/50 p-4 rounded-lg">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">من:</span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">إلى:</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <ExportButtons
                data={productsExportData}
                columns={productsExportColumns}
                fileName={`أعلى-المنتجات-هدراً-${dateRange.start}-${dateRange.end}`}
                title="تقرير أعلى المنتجات هدراً"
                subtitle={`من ${dateRange.start} إلى ${dateRange.end}`}
                headerInfo={[
                  { label: "من تاريخ", value: dateRange.start },
                  { label: "إلى تاريخ", value: dateRange.end },
                  { label: "الفرع", value: selectedBranch === "all" ? "جميع الفروع" : getBranchName(selectedBranch) },
                ]}
              />
            </div>

            {loadingTopWaste ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : topWaste?.topProducts?.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700">إجمالي المنتجات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-products">
                        {topWaste.totalUniqueProducts}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">منتج مختلف</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-700">منتجات بها هدر</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600" data-testid="text-products-with-waste">
                        {topWaste.productsWithWaste}
                      </div>
                      <p className="text-xs text-red-500 mt-1">
                        {topWaste.totalUniqueProducts > 0 
                          ? formatPercent((topWaste.productsWithWaste / topWaste.totalUniqueProducts) * 100)
                          : "0%"
                        }
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-amber-700">قيمة الهدر الكلية</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600" data-testid="text-total-waste-value">
                        {formatCurrency(topWaste.topProducts.reduce((sum: number, p: any) => sum + p.totalWasteValue, 0))}
                      </div>
                      <p className="text-xs text-amber-500 mt-1">لأعلى 10 منتجات</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      أعلى 10 منتجات هدراً بالقيمة
                    </CardTitle>
                    <CardDescription>المنتجات الأكثر خسارة مالية</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">#</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">المنتج</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">الفئة</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">الكمية المهدرة</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">قيمة الهدر</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">نسبة الهدر</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">التكرار</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topWaste.topProducts.map((product: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-gray-50" data-testid={`row-product-${idx}`}>
                              <td className="py-3 px-2">
                                <Badge variant={idx < 3 ? "destructive" : "secondary"}>{idx + 1}</Badge>
                              </td>
                              <td className="py-3 px-2 font-medium">{product.productName}</td>
                              <td className="py-3 px-2 text-gray-500">{product.category}</td>
                              <td className="py-3 px-2">{formatNumber(product.totalWaste)}</td>
                              <td className="py-3 px-2 text-red-600 font-bold">{formatCurrency(product.totalWasteValue)}</td>
                              <td className="py-3 px-2">
                                <Badge variant={product.wastePercentage > 20 ? "destructive" : "secondary"}>
                                  {formatPercent(product.wastePercentage)}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-gray-500">{product.occurrences} مرة</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>رسم بياني لقيمة الهدر</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topWaste.topProducts} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                          <YAxis type="category" dataKey="productName" width={150} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="totalWasteValue" name="قيمة الهدر" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <p className="text-gray-500">لا توجد بيانات للفترة المحددة</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </Layout>
  );
}
