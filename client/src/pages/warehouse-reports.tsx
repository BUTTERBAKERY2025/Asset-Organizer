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

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: warehouseItems } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
  });

  const { data: transfers } = useQuery<MaterialTransfer[]>({
    queryKey: ["/api/warehouse/material-transfers"],
  });

  const { data: branchStock } = useQuery<BranchStock[]>({
    queryKey: ["/api/warehouse/branch-stock", selectedBranch !== "all" ? selectedBranch : undefined],
  });

  const { data: movementLogs } = useQuery<any[]>({
    queryKey: ["/api/warehouse/movement-logs"],
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
      dateText: t.createdAt ? new Date(t.createdAt).toLocaleDateString("ar-SA") : "",
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
    deliveryDate: t.deliveryDate ? new Date(t.deliveryDate).toLocaleDateString(isRTL ? "ar-SA" : "en-US") : "-",
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
    return new Date(2024, month - 1).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'long' });
  };

  return (
    <Layout>
      <div className="p-4 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isRTL ? "تقارير المخازن" : "Warehouse Reports"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isRTL ? "تقارير شاملة عن المخزون والطلبات والتحويلات" : "Comprehensive reports on inventory, requests and transfers"}
              </p>
            </div>
          </div>
          <Link href="/warehouse-dashboard">
            <Button variant="outline" size="sm" className="gap-2" data-testid="btn-back-dashboard">
              {isRTL ? "العودة للوحة التحكم" : "Back to Dashboard"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? "فلاتر التقرير" : "Report Filters"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? "الفرع" : "Branch"}</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-branch">
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
                <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  data-testid="input-date-from"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  data-testid="input-date-to"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card data-testid="stat-transfers-total">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <Truck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي التحويلات" : "Total Transfers"}</p>
                  <p className="text-2xl font-bold">{transferStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-delivered">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
                  <CheckCircle className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "تحويلات مستلمة" : "Delivered"}</p>
                  <p className="text-2xl font-bold">{transferStats.delivered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-low-stock">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "مواد منخفضة" : "Low Stock"}</p>
                  <p className="text-2xl font-bold">{lowStockItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              {isRTL ? "نظرة عامة" : "Overview"}
            </TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">
              <Calendar className="w-4 h-4 mr-1" />
              {isRTL ? "التقرير الشهري" : "Monthly"}
            </TabsTrigger>
            <TabsTrigger value="stock" data-testid="tab-stock">
              {isRTL ? "المخزون" : "Stock"}
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="tab-transfers">
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
                              {new Date(2024, m-1).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'long' })}
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
                            {t.deliveryDate ? new Date(t.deliveryDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
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
