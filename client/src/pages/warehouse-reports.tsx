import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExportButtons } from "@/components/export-buttons";
import { Link } from "wouter";
import { PageHeader } from "@/components/dashboard/page-header";
import { 
  BarChart3, Package, TrendingUp, TrendingDown, AlertTriangle, 
  FileText, ArrowRight, Boxes, Send, Clock, CheckCircle, Truck, Calendar,
  Printer, Download
} from "lucide-react";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import type { Branch, WarehouseItem, MaterialTransfer, BranchStock } from "@shared/schema";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

type MonthlyReport = {
  byBranch: Array<{
    branchId: string;
    branchName: string;
    totalIncoming: number;
    totalOutgoing: number;
    netMovement: number;
    transferCount: number;
  }>;
  byItem: Array<{
    itemId: number;
    itemName: string;
    category: string;
    unit: string;
    totalIncoming: number;
    totalOutgoing: number;
    netMovement: number;
  }>;
  transfers: Array<{
    id: number;
    transferNumber: string;
    sourceBranchName: string | null;
    destinationBranchName: string;
    status: string;
    deliveryDate: string | null;
    hasDiscrepancy: boolean | null;
    itemCount: number;
    totalQuantity: number;
  }>;
  summary: {
    totalTransfers: number;
    deliveredTransfers: number;
    totalItemsReceived: number;
    transfersWithDiscrepancy: number;
  };
};

export default function WarehouseReportsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
  // Monthly report state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  
  // Advanced reports state
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [reportDateFrom, setReportDateFrom] = useState<string>("");
  const [reportDateTo, setReportDateTo] = useState<string>("");
  const [reportBranchId, setReportBranchId] = useState<string>("all");

  const { data: bundle } = useQuery<{
    items?: any[];
    transfers?: any[];
    movementLogs?: any[];
    branches?: any[];
  }>({
    queryKey: ["/api/warehouse/bundle", selectedBranch !== "all" ? selectedBranch : undefined],
    staleTime: 60 * 1000,
  });

  const branches = bundle?.branches;
  const warehouseItems = bundle?.items;
  const transfers = bundle?.transfers;
  const movementLogs = bundle?.movementLogs;

  const { data: branchStock } = useQuery<BranchStock[]>({
    queryKey: ["/api/warehouse/branch-stock", selectedBranch !== "all" ? selectedBranch : undefined],
  });

  // Monthly report query
  const { data: monthlyReport, isLoading: isLoadingMonthly } = useQuery<MonthlyReport>({
    queryKey: ["/api/warehouse/monthly-report", selectedBranch, selectedMonth, selectedYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("month", selectedMonth.toString());
      params.append("year", selectedYear.toString());
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/warehouse/monthly-report?${params.toString()}`);
      return res.json();
    },
  });

  // Item Account Statement query
  const { data: itemStatement, isLoading: isLoadingItemStatement } = useQuery({
    queryKey: ["/api/warehouse/reports/item-statement", selectedItemId, reportBranchId, reportDateFrom, reportDateTo],
    queryFn: async () => {
      if (!selectedItemId) return null;
      const params = new URLSearchParams();
      if (reportBranchId !== "all") params.append("branchId", reportBranchId);
      if (reportDateFrom) params.append("startDate", reportDateFrom);
      if (reportDateTo) params.append("endDate", reportDateTo);
      const res = await fetch(`/api/warehouse/reports/item-statement/${selectedItemId}?${params.toString()}`);
      return res.json();
    },
    enabled: !!selectedItemId,
  });

  // Top Requested Products query
  const { data: topRequested, isLoading: isLoadingTopRequested } = useQuery({
    queryKey: ["/api/warehouse/reports/top-requested", reportBranchId, reportDateFrom, reportDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (reportBranchId !== "all") params.append("branchId", reportBranchId);
      if (reportDateFrom) params.append("startDate", reportDateFrom);
      if (reportDateTo) params.append("endDate", reportDateTo);
      params.append("limit", "20");
      const res = await fetch(`/api/warehouse/reports/top-requested?${params.toString()}`);
      return res.json();
    },
  });

  // Comparisons query
  const { data: comparisons, isLoading: isLoadingComparisons } = useQuery({
    queryKey: ["/api/warehouse/reports/comparisons", selectedMonth, selectedYear, reportBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("month", selectedMonth.toString());
      params.append("year", selectedYear.toString());
      if (reportBranchId !== "all") params.append("branchId", reportBranchId);
      const res = await fetch(`/api/warehouse/reports/comparisons?${params.toString()}`);
      return res.json();
    },
  });

  // Branch Performance query
  const { data: branchPerformance, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ["/api/warehouse/reports/branch-performance", reportDateFrom, reportDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (reportDateFrom) params.append("startDate", reportDateFrom);
      if (reportDateTo) params.append("endDate", reportDateTo);
      const res = await fetch(`/api/warehouse/reports/branch-performance?${params.toString()}`);
      return res.json();
    },
  });

  const filteredTransfers = transfers?.filter(t => {
    if (selectedBranch !== "all" && t.destinationBranchId !== selectedBranch && t.sourceBranchId !== selectedBranch) return false;
    if (dateFrom && new Date(t.createdAt!) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.createdAt!) > new Date(dateTo)) return false;
    return true;
  }) || [];

  const transferStats = {
    total: filteredTransfers.length,
    pending: filteredTransfers.filter(t => t.status === "pending").length,
    inTransit: filteredTransfers.filter(t => t.status === "in_transit").length,
    delivered: filteredTransfers.filter(t => t.status === "delivered").length,
  };

  const lowStockItems = branchStock?.filter(s => {
    const item = warehouseItems?.find(i => i.id === s.itemId);
    return item && (s.currentQuantity || 0) <= (item.reorderPoint || 0);
  }) || [];

  const transferStatusData = [
    { name: isRTL ? "قيد الانتظار" : "Pending", value: transferStats.pending, color: "#FFBB28" },
    { name: isRTL ? "في الطريق" : "In Transit", value: transferStats.inTransit, color: "#0088FE" },
    { name: isRTL ? "تم التسليم" : "Delivered", value: transferStats.delivered, color: "#00C49F" },
  ].filter(d => d.value > 0);

  const stockByBranchData = branches?.map(branch => {
    const branchItems = branchStock?.filter(s => s.branchId === branch.id) || [];
    const totalQuantity = branchItems.reduce((sum, s) => sum + (s.currentQuantity || 0), 0);
    return {
      name: branch.name,
      quantity: totalQuantity,
    };
  }).filter(d => d.quantity > 0) || [];

  const stockColumns = [
    { header: isRTL ? "الفرع" : "Branch", key: "branchName", width: 20 },
    { header: isRTL ? "الصنف" : "Item", key: "itemName", width: 25 },
    { header: isRTL ? "الكمية الحالية" : "Current Qty", key: "currentQuantity", width: 15 },
    { header: isRTL ? "الحد الأدنى" : "Min Level", key: "minLevel", width: 15 },
    { header: isRTL ? "الحالة" : "Status", key: "status", width: 15 },
  ];

  const stockExportData = branchStock?.map(s => {
    const branch = branches?.find(b => b.id === s.branchId);
    const item = warehouseItems?.find(i => i.id === s.itemId);
    const isLow = item && (s.currentQuantity || 0) <= (item.reorderPoint || 0);
    return {
      branchName: branch?.name || s.branchId,
      itemName: item?.name || `صنف ${s.itemId}`,
      currentQuantity: s.currentQuantity,
      minLevel: item?.reorderPoint || 0,
      status: isLow ? (isRTL ? "منخفض" : "Low") : (isRTL ? "جيد" : "Good"),
    };
  }) || [];

  const transferColumns = [
    { header: isRTL ? "رقم التحويل" : "Transfer #", key: "transferNumber", width: 18 },
    { header: isRTL ? "من" : "From", key: "sourceName", width: 18 },
    { header: isRTL ? "إلى" : "To", key: "destName", width: 18 },
    { header: isRTL ? "الحالة" : "Status", key: "statusText", width: 15 },
    { header: isRTL ? "التاريخ" : "Date", key: "dateText", width: 15 },
  ];

  const transferExportData = filteredTransfers.map(t => {
    const source = branches?.find(b => b.id === t.sourceBranchId);
    const dest = branches?.find(b => b.id === t.destinationBranchId);
    return {
      transferNumber: t.transferNumber,
      sourceName: source?.name || t.sourceBranchId || (isRTL ? "المستودع الرئيسي" : "Main Warehouse"),
      destName: dest?.name || t.destinationBranchId,
      statusText: t.status,
      dateText: t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-GB") : "",
    };
  });

  // Monthly report export columns and data
  const monthlyBranchColumns = [
    { header: isRTL ? "الفرع" : "Branch", key: "branchName", width: 25 },
    { header: isRTL ? "الوارد" : "Incoming", key: "totalIncoming", width: 15 },
    { header: isRTL ? "الصادر" : "Outgoing", key: "totalOutgoing", width: 15 },
    { header: isRTL ? "الصافي" : "Net Movement", key: "netMovement", width: 15 },
    { header: isRTL ? "عدد التحويلات" : "Transfer Count", key: "transferCount", width: 15 },
  ];

  const monthlyBranchExportData = monthlyReport?.byBranch?.map(row => ({
    branchName: row.branchName,
    totalIncoming: row.totalIncoming,
    totalOutgoing: row.totalOutgoing,
    netMovement: row.netMovement,
    transferCount: row.transferCount,
  })) || [];

  const monthlyItemColumns = [
    { header: isRTL ? "الصنف" : "Item", key: "itemName", width: 25 },
    { header: isRTL ? "الفئة" : "Category", key: "category", width: 15 },
    { header: isRTL ? "الوحدة" : "Unit", key: "unit", width: 10 },
    { header: isRTL ? "الوارد" : "Incoming", key: "totalIncoming", width: 12 },
    { header: isRTL ? "الصادر" : "Outgoing", key: "totalOutgoing", width: 12 },
    { header: isRTL ? "الصافي" : "Net Movement", key: "netMovement", width: 12 },
  ];

  const monthlyItemExportData = monthlyReport?.byItem?.map(row => ({
    itemName: row.itemName,
    category: row.category,
    unit: row.unit,
    totalIncoming: row.totalIncoming,
    totalOutgoing: row.totalOutgoing,
    netMovement: row.netMovement,
  })) || [];

  const monthlyTransfersColumns = [
    { header: isRTL ? "رقم التحويل" : "Transfer #", key: "transferNumber", width: 15 },
    { header: isRTL ? "من" : "From", key: "sourceBranchName", width: 18 },
    { header: isRTL ? "إلى" : "To", key: "destinationBranchName", width: 18 },
    { header: isRTL ? "تاريخ التسليم" : "Delivery Date", key: "deliveryDate", width: 15 },
    { header: isRTL ? "عدد الأصناف" : "Item Count", key: "itemCount", width: 10 },
    { header: isRTL ? "الكمية" : "Total Qty", key: "totalQuantity", width: 10 },
    { header: isRTL ? "الحالة" : "Status", key: "statusText", width: 12 },
  ];

  const monthlyTransfersExportData = monthlyReport?.transfers?.map(t => ({
    transferNumber: t.transferNumber,
    sourceBranchName: t.sourceBranchName || (isRTL ? "المستودع الرئيسي" : "Main Warehouse"),
    destinationBranchName: t.destinationBranchName,
    deliveryDate: t.deliveryDate ? new Date(t.deliveryDate).toLocaleDateString(isRTL ? "en-GB" : "en-US") : "-",
    itemCount: t.itemCount,
    totalQuantity: t.totalQuantity,
    statusText: t.hasDiscrepancy ? (isRTL ? "فرق" : "Discrepancy") : (isRTL ? "مكتمل" : "Complete"),
  })) || [];

  // Low stock export columns and data
  const lowStockColumns = [
    { header: isRTL ? "الصنف" : "Item", key: "itemName", width: 25 },
    { header: isRTL ? "الفرع" : "Branch", key: "branchName", width: 20 },
    { header: isRTL ? "الكمية الحالية" : "Current Qty", key: "currentQuantity", width: 15 },
    { header: isRTL ? "الحد الأدنى" : "Reorder Point", key: "reorderPoint", width: 15 },
    { header: isRTL ? "الفئة" : "Category", key: "category", width: 15 },
  ];

  const lowStockExportData = lowStockItems.map(stock => {
    const item = warehouseItems?.find(i => i.id === stock.itemId);
    const branch = branches?.find(b => b.id === stock.branchId);
    return {
      itemName: item?.name || `صنف ${stock.itemId}`,
      branchName: branch?.name || stock.branchId,
      currentQuantity: stock.currentQuantity || 0,
      reorderPoint: item?.reorderPoint || 0,
      category: item?.category || "-",
    };
  });

  // Print functionality
  const monthlyReportRef = useRef<HTMLDivElement>(null);
  const handlePrintMonthly = useReactToPrint({
    contentRef: monthlyReportRef,
    documentTitle: `${isRTL ? "التقرير الشهري" : "Monthly Report"} - ${selectedMonth}/${selectedYear}`,
  });

  const getMonthName = (month: number) => {
    return new Date(2024, month - 1).toLocaleDateString(isRTL ? 'en-GB' : 'en-US', { month: 'long' });
  };

  return (
    <Layout>
      <div className="page-container space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <PageHeader
          icon={BarChart3}
          tone="executive"
          title={isRTL ? "تقارير المخازن" : "Warehouse Reports"}
          description={isRTL ? "تقارير شاملة عن المخزون والطلبات والتحويلات" : "Comprehensive reports on inventory, requests and transfers"}
          backHref="/warehouse-dashboard"
        />

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-base sm:text-lg">{isRTL ? "فلاتر التقرير" : "Report Filters"}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">{isRTL ? "الفرع" : "Branch"}</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch">
                    <SelectValue placeholder={isRTL ? "جميع الفروع" : "All Branches"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "جميع الفروع" : "All Branches"}</SelectItem>
                    {branches?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">{isRTL ? "من تاريخ" : "From Date"}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11 sm:h-10"
                  data-testid="input-date-from"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">{isRTL ? "إلى تاريخ" : "To Date"}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11 sm:h-10"
                  data-testid="input-date-to"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          <Card data-testid="stat-transfers-total">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{isRTL ? "إجمالي التحويلات" : "Total Transfers"}</p>
                  <p className="text-xl sm:text-2xl font-bold">{transferStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-delivered">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{isRTL ? "تحويلات مستلمة" : "Delivered"}</p>
                  <p className="text-xl sm:text-2xl font-bold">{transferStats.delivered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-low-stock">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{isRTL ? "مواد منخفضة" : "Low Stock"}</p>
                  <p className="text-xl sm:text-2xl font-bold">{lowStockItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 overflow-x-auto">
            <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs md:text-sm">
              {isRTL ? "نظرة عامة" : "Overview"}
            </TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly" className="text-xs md:text-sm">
              <Calendar className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isRTL ? "الشهري" : "Monthly"}
            </TabsTrigger>
            <TabsTrigger value="item-statement" data-testid="tab-item-statement" className="text-xs md:text-sm">
              <FileText className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isRTL ? "كشف الصنف" : "Item Statement"}
            </TabsTrigger>
            <TabsTrigger value="top-requested" data-testid="tab-top-requested" className="text-xs md:text-sm">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isRTL ? "الأكثر طلباً" : "Top Requested"}
            </TabsTrigger>
            <TabsTrigger value="comparisons" data-testid="tab-comparisons" className="text-xs md:text-sm">
              <BarChart3 className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isRTL ? "المقارنات" : "Comparisons"}
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance" className="text-xs md:text-sm">
              <Boxes className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              {isRTL ? "أداء الفروع" : "Performance"}
            </TabsTrigger>
            <TabsTrigger value="stock" data-testid="tab-stock" className="text-xs md:text-sm">
              {isRTL ? "المخزون" : "Stock"}
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="tab-transfers" className="text-xs md:text-sm">
              {isRTL ? "التحويلات" : "Transfers"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{isRTL ? "حالات التحويلات" : "Transfer Status"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {transferStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={transferStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {transferStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        {isRTL ? "لا توجد بيانات" : "No data"}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? "المخزون حسب الفرع" : "Stock by Branch"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {stockByBranchData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stockByBranchData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="quantity" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      {isRTL ? "لا توجد بيانات" : "No data"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly Report Tab */}
          <TabsContent value="monthly" className="space-y-4">
            {/* Month/Year Selector with Export Buttons */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-end justify-between">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-2">
                      <Label>{isRTL ? "الشهر" : "Month"}</Label>
                      <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                        <SelectTrigger className="w-32" data-testid="select-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                            <SelectItem key={m} value={m.toString()}>
                              {new Date(2024, m-1).toLocaleDateString(isRTL ? 'en-GB' : 'en-US', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? "السنة" : "Year"}</Label>
                      <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-24" data-testid="select-year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map(y => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePrintMonthly()}
                      className="gap-2"
                      data-testid="btn-print-monthly"
                    >
                      <Printer className="h-4 w-4" />
                      {isRTL ? "طباعة" : "Print"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Printable Monthly Report Content */}
            <div ref={monthlyReportRef} className="space-y-4 print:p-4">
              {/* Print Header - only visible when printing */}
              <div className="hidden print:block print:mb-6">
                <h1 className="text-2xl font-bold text-center mb-2">
                  {isRTL ? "التقرير الشهري للمخازن" : "Monthly Warehouse Report"}
                </h1>
                <p className="text-center text-muted-foreground">
                  {getMonthName(selectedMonth)} {selectedYear}
                </p>
              </div>

              {/* Summary Cards */}
              {monthlyReport?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-blue-600">{monthlyReport.summary.totalTransfers}</p>
                      <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي التحويلات" : "Total Transfers"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">{monthlyReport.summary.deliveredTransfers}</p>
                      <p className="text-sm text-muted-foreground">{isRTL ? "تم التسليم" : "Delivered"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-purple-600">{monthlyReport.summary.totalItemsReceived}</p>
                      <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الكميات" : "Total Items"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-amber-600">{monthlyReport.summary.transfersWithDiscrepancy}</p>
                      <p className="text-sm text-muted-foreground">{isRTL ? "تحويلات بفروقات" : "With Discrepancy"}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* By Branch Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between print:pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Boxes className="w-5 h-5" />
                    {isRTL ? "حركة المواد حسب الفرع" : "Movement by Branch"}
                  </CardTitle>
                  <div className="print:hidden">
                    <ExportButtons
                      data={monthlyBranchExportData}
                      columns={monthlyBranchColumns}
                      fileName={`monthly-branch-${selectedMonth}-${selectedYear}`}
                      title={isRTL ? "حركة المواد حسب الفرع" : "Movement by Branch"}
                      subtitle={`${getMonthName(selectedMonth)} ${selectedYear}`}
                      sheetName={isRTL ? "حسب الفرع" : "By Branch"}
                    />
                  </div>
                </CardHeader>
              <CardContent>
                {monthlyReport?.byBranch && monthlyReport.byBranch.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الوارد" : "Incoming"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الصادر" : "Outgoing"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الصافي" : "Net"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "عدد التحويلات" : "Transfers"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.byBranch.map((row) => (
                        <TableRow key={row.branchId}>
                          <TableCell className="font-medium">{row.branchName}</TableCell>
                          <TableCell className="text-center text-green-600 font-mono">+{row.totalIncoming}</TableCell>
                          <TableCell className="text-center text-red-600 font-mono">-{row.totalOutgoing}</TableCell>
                          <TableCell className="text-center font-mono font-bold">
                            <span className={row.netMovement >= 0 ? "text-green-600" : "text-red-600"}>
                              {row.netMovement >= 0 ? '+' : ''}{row.netMovement}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{row.transferCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {isRTL ? "لا توجد بيانات لهذا الشهر" : "No data for this month"}
                  </div>
                )}
              </CardContent>
            </Card>

              {/* By Item Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between print:pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {isRTL ? "حركة المواد حسب الصنف" : "Movement by Item"}
                  </CardTitle>
                  <div className="print:hidden">
                    <ExportButtons
                      data={monthlyItemExportData}
                      columns={monthlyItemColumns}
                      fileName={`monthly-items-${selectedMonth}-${selectedYear}`}
                      title={isRTL ? "حركة المواد حسب الصنف" : "Movement by Item"}
                      subtitle={`${getMonthName(selectedMonth)} ${selectedYear}`}
                      sheetName={isRTL ? "حسب الصنف" : "By Item"}
                    />
                  </div>
                </CardHeader>
              <CardContent>
                {monthlyReport?.byItem && monthlyReport.byItem.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? "الصنف" : "Item"}</TableHead>
                        <TableHead>{isRTL ? "الفئة" : "Category"}</TableHead>
                        <TableHead>{isRTL ? "الوحدة" : "Unit"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الوارد" : "Incoming"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الصافي" : "Net"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.byItem.slice(0, 15).map((row) => (
                        <TableRow key={row.itemId}>
                          <TableCell className="font-medium">{row.itemName}</TableCell>
                          <TableCell className="text-muted-foreground">{row.category}</TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell className="text-center text-green-600 font-mono">+{row.totalIncoming}</TableCell>
                          <TableCell className="text-center font-mono font-bold">
                            <span className={row.netMovement >= 0 ? "text-green-600" : "text-red-600"}>
                              {row.netMovement >= 0 ? '+' : ''}{row.netMovement}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {isRTL ? "لا توجد بيانات لهذا الشهر" : "No data for this month"}
                  </div>
                )}
              </CardContent>
            </Card>

              {/* Transfers List */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between print:pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    {isRTL ? "قائمة التحويلات المستلمة" : "Delivered Transfers List"}
                  </CardTitle>
                  <div className="print:hidden">
                    <ExportButtons
                      data={monthlyTransfersExportData}
                      columns={monthlyTransfersColumns}
                      fileName={`monthly-transfers-${selectedMonth}-${selectedYear}`}
                      title={isRTL ? "قائمة التحويلات المستلمة" : "Delivered Transfers List"}
                      subtitle={`${getMonthName(selectedMonth)} ${selectedYear}`}
                      sheetName={isRTL ? "التحويلات" : "Transfers"}
                    />
                  </div>
                </CardHeader>
              <CardContent>
                {monthlyReport?.transfers && monthlyReport.transfers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? "رقم التحويل" : "Transfer #"}</TableHead>
                        <TableHead>{isRTL ? "من" : "From"}</TableHead>
                        <TableHead>{isRTL ? "إلى" : "To"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "تاريخ التسليم" : "Delivery Date"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الأصناف" : "Items"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الكمية" : "Qty"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.transfers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono font-medium">{t.transferNumber}</TableCell>
                          <TableCell>{t.sourceBranchName}</TableCell>
                          <TableCell>{t.destinationBranchName}</TableCell>
                          <TableCell className="text-center">
                            {t.deliveryDate ? new Date(t.deliveryDate).toLocaleDateString(isRTL ? 'en-GB' : 'en-US') : '-'}
                          </TableCell>
                          <TableCell className="text-center">{t.itemCount}</TableCell>
                          <TableCell className="text-center font-mono">{t.totalQuantity}</TableCell>
                          <TableCell className="text-center">
                            {t.hasDiscrepancy ? (
                              <Badge variant="destructive" className="text-xs">
                                {isRTL ? "فرق" : "Discrepancy"}
                              </Badge>
                            ) : (
                              <Badge className="bg-green-500 text-xs">
                                {isRTL ? "مكتمل" : "Complete"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {isRTL ? "لا توجد تحويلات مستلمة لهذا الشهر" : "No delivered transfers for this month"}
                  </div>
                )}
              </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Item Account Statement Tab - كشف حساب حسب الصنف */}
          <TabsContent value="item-statement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {isRTL ? "كشف حساب حسب الصنف" : "Item Account Statement"}
                </CardTitle>
                <CardDescription>
                  {isRTL ? "عرض حركة صنف معين خلال فترة محددة" : "View movement history for a specific item"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <Label>{isRTL ? "اختر الصنف" : "Select Item"}</Label>
                    <Select value={selectedItemId?.toString() || ""} onValueChange={(v) => setSelectedItemId(parseInt(v))}>
                      <SelectTrigger data-testid="select-item-statement">
                        <SelectValue placeholder={isRTL ? "اختر صنف..." : "Select item..."} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        {warehouseItems?.map(item => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.name} ({item.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الفرع" : "Branch"}</Label>
                    <Select value={reportBranchId} onValueChange={setReportBranchId}>
                      <SelectTrigger className="w-40" data-testid="select-report-branch">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? "كل الفروع" : "All Branches"}</SelectItem>
                        {branches?.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
                    <Input
                      type="date"
                      value={reportDateFrom}
                      onChange={(e) => setReportDateFrom(e.target.value)}
                      className="w-40"
                      data-testid="input-date-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
                    <Input
                      type="date"
                      value={reportDateTo}
                      onChange={(e) => setReportDateTo(e.target.value)}
                      className="w-40"
                      data-testid="input-date-to"
                    />
                  </div>
                </div>

                {selectedItemId && itemStatement && (
                  <div className="space-y-4 mt-6">
                    {/* Item Info Card */}
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap gap-6 items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">{isRTL ? "الصنف" : "Item"}</p>
                            <p className="text-lg font-bold">{itemStatement.item?.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{isRTL ? "الفئة" : "Category"}</p>
                            <p className="font-medium">{itemStatement.item?.category}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{isRTL ? "الوحدة" : "Unit"}</p>
                            <p className="font-medium">{itemStatement.item?.unit}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-green-600">{itemStatement.summary?.totalIn || 0}</p>
                          <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي الوارد" : "Total In"}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-red-600">{itemStatement.summary?.totalOut || 0}</p>
                          <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي الصادر" : "Total Out"}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-blue-600">{itemStatement.summary?.netChange || 0}</p>
                          <p className="text-xs text-muted-foreground">{isRTL ? "صافي التغيير" : "Net Change"}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-gray-600">{itemStatement.summary?.openingBalance || 0}</p>
                          <p className="text-xs text-muted-foreground">{isRTL ? "الرصيد الافتتاحي" : "Opening"}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-purple-600">{itemStatement.summary?.closingBalance || 0}</p>
                          <p className="text-xs text-muted-foreground">{isRTL ? "الرصيد الختامي" : "Closing"}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Movements Table */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>{isRTL ? "حركات الصنف" : "Item Movements"}</CardTitle>
                        {itemStatement.movements?.length > 0 && (
                          <ExportButtons
                            data={itemStatement.movements.map((m: any) => ({
                              date: m.date,
                              type: m.type,
                              branch: m.branchName,
                              transferNumber: m.transferNumber || '-',
                              quantityIn: m.quantityIn,
                              quantityOut: m.quantityOut,
                              balance: m.balance,
                              notes: m.notes || ''
                            }))}
                            columns={[
                              { key: 'date', header: isRTL ? 'التاريخ' : 'Date' },
                              { key: 'type', header: isRTL ? 'النوع' : 'Type' },
                              { key: 'branch', header: isRTL ? 'الفرع' : 'Branch' },
                              { key: 'transferNumber', header: isRTL ? 'رقم التحويل' : 'Transfer #' },
                              { key: 'quantityIn', header: isRTL ? 'وارد' : 'In' },
                              { key: 'quantityOut', header: isRTL ? 'صادر' : 'Out' },
                              { key: 'balance', header: isRTL ? 'الرصيد' : 'Balance' },
                              { key: 'notes', header: isRTL ? 'ملاحظات' : 'Notes' }
                            ]}
                            fileName={`item-statement-${itemStatement.item?.name}-${new Date().toISOString().split('T')[0]}`}
                            title={`${isRTL ? 'كشف حساب' : 'Account Statement'} - ${itemStatement.item?.name}`}
                            sheetName={isRTL ? "حركات الصنف" : "Item Movements"}
                          />
                        )}
                      </CardHeader>
                      <CardContent>
                        {itemStatement.movements?.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                                  <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                                  <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                                  <TableHead>{isRTL ? "رقم التحويل" : "Transfer #"}</TableHead>
                                  <TableHead className="text-center text-green-600">{isRTL ? "وارد" : "In"}</TableHead>
                                  <TableHead className="text-center text-red-600">{isRTL ? "صادر" : "Out"}</TableHead>
                                  <TableHead className="text-center">{isRTL ? "الرصيد" : "Balance"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {itemStatement.movements.map((m: any, idx: number) => (
                                  <TableRow key={idx}>
                                    <TableCell>{m.date ? new Date(m.date).toLocaleDateString(isRTL ? 'en-GB' : 'en-US') : '-'}</TableCell>
                                    <TableCell>
                                      <Badge variant={m.type === 'وارد' ? 'default' : 'secondary'} className={m.type === 'وارد' ? 'bg-green-500' : 'bg-red-500'}>
                                        {m.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{m.branchName}</TableCell>
                                    <TableCell className="font-mono text-sm">{m.transferNumber || '-'}</TableCell>
                                    <TableCell className="text-center text-green-600 font-mono">{m.quantityIn > 0 ? `+${m.quantityIn}` : ''}</TableCell>
                                    <TableCell className="text-center text-red-600 font-mono">{m.quantityOut > 0 ? `-${m.quantityOut}` : ''}</TableCell>
                                    <TableCell className="text-center font-bold font-mono">{m.balance}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            {isRTL ? "لا توجد حركات لهذا الصنف في الفترة المحددة" : "No movements for this item in the selected period"}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {!selectedItemId && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{isRTL ? "اختر صنف لعرض كشف الحساب" : "Select an item to view its account statement"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Requested Products Tab - أكثر المنتجات طلباً */}
          <TabsContent value="top-requested" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {isRTL ? "أكثر المنتجات طلباً" : "Top Requested Products"}
                </CardTitle>
                <CardDescription>
                  {isRTL ? "ترتيب الأصناف حسب إجمالي الكميات المطلوبة" : "Products ranked by total requested quantities"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end mb-6">
                  <div className="space-y-2">
                    <Label>{isRTL ? "الفرع" : "Branch"}</Label>
                    <Select value={reportBranchId} onValueChange={setReportBranchId}>
                      <SelectTrigger className="w-40" data-testid="select-top-requested-branch">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? "كل الفروع" : "All Branches"}</SelectItem>
                        {branches?.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
                    <Input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="w-40" data-testid="input-top-requested-date-from" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
                    <Input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="w-40" data-testid="input-top-requested-date-to" />
                  </div>
                  {topRequested?.length > 0 && (
                    <ExportButtons
                      data={topRequested.map((item: any, idx: number) => ({
                        rank: idx + 1,
                        itemName: item.itemName,
                        category: item.category,
                        branchName: item.branchName,
                        requestCount: item.requestCount,
                        totalQuantityRequested: item.totalQuantityRequested,
                        unit: item.unit
                      }))}
                      columns={[
                        { key: 'rank', header: isRTL ? 'الترتيب' : 'Rank' },
                        { key: 'itemName', header: isRTL ? 'الصنف' : 'Item' },
                        { key: 'category', header: isRTL ? 'الفئة' : 'Category' },
                        { key: 'branchName', header: isRTL ? 'الفرع' : 'Branch' },
                        { key: 'requestCount', header: isRTL ? 'عدد الطلبات' : 'Requests' },
                        { key: 'totalQuantityRequested', header: isRTL ? 'إجمالي الكمية' : 'Total Qty' },
                        { key: 'unit', header: isRTL ? 'الوحدة' : 'Unit' }
                      ]}
                      fileName={`top-requested-${new Date().toISOString().split('T')[0]}`}
                      title={isRTL ? "أكثر المنتجات طلباً" : "Top Requested Products"}
                      sheetName={isRTL ? "الأكثر طلباً" : "Top Requested"}
                    />
                  )}
                </div>

                {topRequested?.length > 0 ? (
                  <div className="space-y-4">
                    {/* Chart */}
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topRequested.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="itemName" type="category" width={150} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="totalQuantityRequested" fill="#8884d8" name={isRTL ? "الكمية المطلوبة" : "Requested Qty"} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>{isRTL ? "الصنف" : "Item"}</TableHead>
                          <TableHead>{isRTL ? "الفئة" : "Category"}</TableHead>
                          <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "عدد الطلبات" : "Requests"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "إجمالي الكمية" : "Total Qty"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topRequested.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.branchName}</TableCell>
                            <TableCell className="text-center">{item.requestCount}</TableCell>
                            <TableCell className="text-center font-mono font-bold">{item.totalQuantityRequested} {item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{isRTL ? "لا توجد بيانات طلبات" : "No request data available"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comparisons Tab - المقارنات */}
          <TabsContent value="comparisons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {isRTL ? "مقارنة الأعلى استلاماً وطلباً" : "Top Received vs Requested Comparison"}
                </CardTitle>
                <CardDescription>
                  {isRTL ? "مقارنة بين أكثر الأصناف استلاماً وطلباً حسب الشهر" : "Compare top received vs requested items by month"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end mb-6">
                  <div className="space-y-2">
                    <Label>{isRTL ? "الشهر" : "Month"}</Label>
                    <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                      <SelectTrigger className="w-32" data-testid="select-comparisons-month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <SelectItem key={m} value={m.toString()}>
                            {new Date(2024, m-1).toLocaleDateString(isRTL ? 'en-GB' : 'en-US', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "السنة" : "Year"}</Label>
                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                      <SelectTrigger className="w-24" data-testid="select-comparisons-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الفرع" : "Branch"}</Label>
                    <Select value={reportBranchId} onValueChange={setReportBranchId}>
                      <SelectTrigger className="w-40" data-testid="select-comparisons-branch">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? "كل الفروع" : "All Branches"}</SelectItem>
                        {branches?.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {comparisons && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Received */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-green-600 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          {isRTL ? "الأعلى استلاماً" : "Top Received"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {comparisons.topReceived?.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>{isRTL ? "الصنف" : "Item"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "الكمية" : "Qty"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comparisons.topReceived.map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-bold">{idx + 1}</TableCell>
                                  <TableCell>{item.itemName}</TableCell>
                                  <TableCell className="text-center font-mono text-green-600">{item.totalReceived} {item.unit}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Top Requested */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-blue-600 flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          {isRTL ? "الأعلى طلباً" : "Top Requested"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {comparisons.topRequested?.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>{isRTL ? "الصنف" : "Item"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "الكمية" : "Qty"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comparisons.topRequested.map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-bold">{idx + 1}</TableCell>
                                  <TableCell>{item.itemName}</TableCell>
                                  <TableCell className="text-center font-mono text-blue-600">{item.totalRequested} {item.unit}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Branch Efficiency */}
                    <Card className="lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                          <Boxes className="w-4 h-4" />
                          {isRTL ? "كفاءة التوريد حسب الفرع" : "Supply Efficiency by Branch"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {comparisons.byBranch?.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "المستلم" : "Received"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "المطلوب" : "Requested"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "نسبة الكفاءة" : "Efficiency"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comparisons.byBranch.map((branch: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{branch.branchName}</TableCell>
                                  <TableCell className="text-center font-mono text-green-600">{branch.totalReceived}</TableCell>
                                  <TableCell className="text-center font-mono text-blue-600">{branch.totalRequested}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={branch.efficiency >= 90 ? 'default' : branch.efficiency >= 70 ? 'secondary' : 'destructive'}>
                                      {branch.efficiency}%
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branch Performance Tab - تحليل أداء الفروع */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="w-5 h-5" />
                  {isRTL ? "تحليل أداء الفروع" : "Branch Performance Analysis"}
                </CardTitle>
                <CardDescription>
                  {isRTL ? "مؤشرات أداء كل فرع في البضاعة المستلمة والمحولة" : "KPIs for each branch in received and transferred goods"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end mb-6">
                  <div className="space-y-2">
                    <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
                    <Input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="w-40" data-testid="input-performance-date-from" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
                    <Input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="w-40" data-testid="input-performance-date-to" />
                  </div>
                  {branchPerformance?.length > 0 && (
                    <ExportButtons
                      data={branchPerformance.map((b: any) => ({
                        branchName: b.branchName,
                        totalReceived: b.totalReceived,
                        totalSent: b.totalSent,
                        netMovement: b.netMovement,
                        transfersReceived: b.transfersReceived,
                        transfersSent: b.transfersSent,
                        discrepancyCount: b.discrepancyCount,
                        discrepancyRate: b.discrepancyRate + '%',
                        avgDeliveryDays: b.avgDeliveryDays,
                        topReceivedItem: b.topReceivedItem || '-',
                        topSentItem: b.topSentItem || '-'
                      }))}
                      columns={[
                        { key: 'branchName', header: isRTL ? 'الفرع' : 'Branch' },
                        { key: 'totalReceived', header: isRTL ? 'المستلم' : 'Received' },
                        { key: 'totalSent', header: isRTL ? 'المرسل' : 'Sent' },
                        { key: 'netMovement', header: isRTL ? 'الصافي' : 'Net' },
                        { key: 'transfersReceived', header: isRTL ? 'تحويلات مستلمة' : 'Transfers Recv' },
                        { key: 'transfersSent', header: isRTL ? 'تحويلات مرسلة' : 'Transfers Sent' },
                        { key: 'discrepancyRate', header: isRTL ? 'نسبة الفروقات' : 'Discrepancy %' },
                        { key: 'avgDeliveryDays', header: isRTL ? 'متوسط أيام التسليم' : 'Avg Delivery Days' },
                        { key: 'topReceivedItem', header: isRTL ? 'أعلى صنف استلاماً' : 'Top Received' },
                        { key: 'topSentItem', header: isRTL ? 'أعلى صنف إرسالاً' : 'Top Sent' }
                      ]}
                      fileName={`branch-performance-${new Date().toISOString().split('T')[0]}`}
                      title={isRTL ? "تحليل أداء الفروع" : "Branch Performance Analysis"}
                      sheetName={isRTL ? "أداء الفروع" : "Performance"}
                    />
                  )}
                </div>

                {branchPerformance?.length > 0 ? (
                  <div className="space-y-6">
                    {/* Performance Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {branchPerformance.map((branch: any, idx: number) => (
                        <Card key={idx} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{branch.branchName}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">{isRTL ? "المستلم" : "Received"}</p>
                                <p className="font-bold text-green-600">{branch.totalReceived}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{isRTL ? "المرسل" : "Sent"}</p>
                                <p className="font-bold text-red-600">{branch.totalSent}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{isRTL ? "الصافي" : "Net"}</p>
                                <p className={`font-bold ${branch.netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {branch.netMovement >= 0 ? '+' : ''}{branch.netMovement}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{isRTL ? "نسبة الفروقات" : "Discrepancy"}</p>
                                <Badge variant={branch.discrepancyRate <= 5 ? 'default' : branch.discrepancyRate <= 15 ? 'secondary' : 'destructive'}>
                                  {branch.discrepancyRate}%
                                </Badge>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{isRTL ? "متوسط التسليم" : "Avg Delivery"}</p>
                                <p className="font-bold">{branch.avgDeliveryDays} {isRTL ? "يوم" : "days"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{isRTL ? "عدد التحويلات" : "Transfers"}</p>
                                <p className="font-bold">{branch.transfersReceived + branch.transfersSent}</p>
                              </div>
                            </div>
                            {branch.topReceivedItem && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs text-muted-foreground">{isRTL ? "أعلى صنف استلاماً:" : "Top received:"}</p>
                                <p className="text-sm font-medium truncate">{branch.topReceivedItem}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Performance Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>{isRTL ? "جدول الأداء التفصيلي" : "Detailed Performance Table"}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "المستلم" : "Recv"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "المرسل" : "Sent"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "الصافي" : "Net"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "تحويلات" : "Transfers"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "فروقات" : "Discrepancy"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "متوسط التسليم" : "Avg Days"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {branchPerformance.map((branch: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{branch.branchName}</TableCell>
                                  <TableCell className="text-center text-green-600 font-mono">{branch.totalReceived}</TableCell>
                                  <TableCell className="text-center text-red-600 font-mono">{branch.totalSent}</TableCell>
                                  <TableCell className={`text-center font-mono font-bold ${branch.netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {branch.netMovement >= 0 ? '+' : ''}{branch.netMovement}
                                  </TableCell>
                                  <TableCell className="text-center">{branch.transfersReceived + branch.transfersSent}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={branch.discrepancyRate <= 5 ? 'default' : branch.discrepancyRate <= 15 ? 'secondary' : 'destructive'}>
                                      {branch.discrepancyRate}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center font-mono">{branch.avgDeliveryDays}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Boxes className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{isRTL ? "لا توجد بيانات أداء" : "No performance data available"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{isRTL ? "تقرير المخزون" : "Stock Report"}</CardTitle>
                  <CardDescription>
                    {isRTL ? `${stockExportData.length} سجل` : `${stockExportData.length} records`}
                  </CardDescription>
                </div>
                <ExportButtons
                  data={stockExportData}
                  columns={stockColumns}
                  fileName={`stock-report-${new Date().toISOString().split('T')[0]}`}
                  title={isRTL ? "تقرير المخزون" : "Stock Report"}
                  sheetName={isRTL ? "المخزون" : "Stock"}
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-right font-semibold">{isRTL ? "الفرع" : "Branch"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "الصنف" : "Item"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "الكمية" : "Quantity"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "الحالة" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockExportData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2">{row.branchName}</td>
                          <td className="p-2">{row.itemName}</td>
                          <td className="p-2">{row.currentQuantity}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              row.status === (isRTL ? "منخفض" : "Low") 
                                ? "bg-red-100 text-red-700" 
                                : "bg-green-100 text-green-700"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {lowStockItems.length > 0 && (
              <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {isRTL ? "تنبيهات المخزون المنخفض" : "Low Stock Alerts"}
                    <Badge variant="destructive" className="mr-2">{lowStockItems.length}</Badge>
                  </CardTitle>
                  <ExportButtons
                    data={lowStockExportData}
                    columns={lowStockColumns}
                    fileName={`low-stock-report-${new Date().toISOString().split('T')[0]}`}
                    title={isRTL ? "تقرير المخزون المنخفض" : "Low Stock Report"}
                    sheetName={isRTL ? "المخزون المنخفض" : "Low Stock"}
                  />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {lowStockItems.map((stock, idx) => {
                      const item = warehouseItems?.find(i => i.id === stock.itemId);
                      const branch = branches?.find(b => b.id === stock.branchId);
                      return (
                        <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-200">
                          <p className="font-medium">{item?.name || `صنف ${stock.itemId}`}</p>
                          <p className="text-sm text-muted-foreground">{branch?.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-red-600 font-bold">{stock.currentQuantity}</span>
                            <span className="text-muted-foreground">/ {item?.reorderPoint || 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="transfers" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{isRTL ? "تقرير التحويلات" : "Transfers Report"}</CardTitle>
                  <CardDescription>
                    {isRTL ? `${transferExportData.length} تحويل` : `${transferExportData.length} transfers`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/transfer-requests">
                    <Button variant="outline" size="sm" className="gap-2" data-testid="btn-view-transfers">
                      {isRTL ? "عرض التحويلات" : "View Transfers"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <ExportButtons
                    data={transferExportData}
                    columns={transferColumns}
                    fileName={`transfers-report-${new Date().toISOString().split('T')[0]}`}
                    title={isRTL ? "تقرير التحويلات" : "Transfers Report"}
                    sheetName={isRTL ? "التحويلات" : "Transfers"}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-right font-semibold">{isRTL ? "رقم التحويل" : "Transfer #"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "من" : "From"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "إلى" : "To"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "الحالة" : "Status"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "التاريخ" : "Date"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferExportData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-mono">{row.transferNumber}</td>
                          <td className="p-2">{row.sourceName}</td>
                          <td className="p-2">{row.destName}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              row.statusText === "delivered" ? "bg-green-100 text-green-700" :
                              row.statusText === "in_transit" ? "bg-blue-100 text-blue-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {row.statusText}
                            </span>
                          </td>
                          <td className="p-2">{row.dateText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
