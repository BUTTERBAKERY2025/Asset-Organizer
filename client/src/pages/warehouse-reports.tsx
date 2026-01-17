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
  FileText, ArrowRight, Boxes, Send, Clock, CheckCircle, Truck
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import type { Branch, WarehouseItem, MaterialRequest, MaterialTransfer, BranchStock } from "@shared/schema";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function WarehouseReportsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: warehouseItems } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
  });

  const { data: requests } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/warehouse/material-requests"],
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

  const filteredRequests = requests?.filter(r => {
    if (selectedBranch !== "all" && r.branchId !== selectedBranch) return false;
    if (dateFrom && new Date(r.createdAt!) < new Date(dateFrom)) return false;
    if (dateTo && new Date(r.createdAt!) > new Date(dateTo)) return false;
    return true;
  }) || [];

  const filteredTransfers = transfers?.filter(t => {
    if (selectedBranch !== "all" && t.destinationBranchId !== selectedBranch && t.sourceBranchId !== selectedBranch) return false;
    if (dateFrom && new Date(t.createdAt!) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.createdAt!) > new Date(dateTo)) return false;
    return true;
  }) || [];

  const requestStats = {
    total: filteredRequests.length,
    pending: filteredRequests.filter(r => r.status === "pending").length,
    approved: filteredRequests.filter(r => r.status === "approved").length,
    fulfilled: filteredRequests.filter(r => r.status === "fulfilled").length,
    rejected: filteredRequests.filter(r => r.status === "rejected").length,
    forwarded: filteredRequests.filter(r => r.status === "forwarded_to_purchasing").length,
  };

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

  const requestStatusData = [
    { name: isRTL ? "قيد الانتظار" : "Pending", value: requestStats.pending, color: "#FFBB28" },
    { name: isRTL ? "موافق عليه" : "Approved", value: requestStats.approved, color: "#00C49F" },
    { name: isRTL ? "مُنفذ" : "Fulfilled", value: requestStats.fulfilled, color: "#0088FE" },
    { name: isRTL ? "مرفوض" : "Rejected", value: requestStats.rejected, color: "#FF8042" },
    { name: isRTL ? "محول للمشتريات" : "To Purchasing", value: requestStats.forwarded, color: "#8884d8" },
  ].filter(d => d.value > 0);

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

  const requestColumns = [
    { header: isRTL ? "رقم الطلب" : "Request #", key: "requestNumber", width: 18 },
    { header: isRTL ? "الفرع" : "Branch", key: "branchName", width: 20 },
    { header: isRTL ? "الحالة" : "Status", key: "statusText", width: 15 },
    { header: isRTL ? "التاريخ" : "Date", key: "dateText", width: 15 },
  ];

  const requestExportData = filteredRequests.map(r => {
    const branch = branches?.find(b => b.id === r.branchId);
    return {
      requestNumber: r.requestNumber,
      branchName: branch?.name || r.branchId,
      statusText: r.status,
      dateText: r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-SA") : "",
    };
  });

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="stat-requests-total">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي الطلبات" : "Total Requests"}</p>
                  <p className="text-2xl font-bold">{requestStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
            <TabsTrigger value="stock" data-testid="tab-stock">
              {isRTL ? "المخزون" : "Stock"}
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              {isRTL ? "الطلبات" : "Requests"}
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="tab-transfers">
              {isRTL ? "التحويلات" : "Transfers"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{isRTL ? "حالات الطلبات" : "Request Status"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {requestStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={requestStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {requestStatusData.map((entry, index) => (
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
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {isRTL ? "تنبيهات المخزون المنخفض" : "Low Stock Alerts"}
                  </CardTitle>
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

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{isRTL ? "تقرير الطلبات" : "Requests Report"}</CardTitle>
                  <CardDescription>
                    {isRTL ? `${requestExportData.length} طلب` : `${requestExportData.length} requests`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ExportButtons
                    data={requestExportData}
                    columns={requestColumns}
                    fileName={`requests-report-${new Date().toISOString().split('T')[0]}`}
                    title={isRTL ? "تقرير الطلبات" : "Requests Report"}
                    sheetName={isRTL ? "الطلبات" : "Requests"}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-right font-semibold">{isRTL ? "رقم الطلب" : "Request #"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "الفرع" : "Branch"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "الحالة" : "Status"}</th>
                        <th className="p-2 text-right font-semibold">{isRTL ? "التاريخ" : "Date"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requestExportData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-mono">{row.requestNumber}</td>
                          <td className="p-2">{row.branchName}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              row.statusText === "approved" ? "bg-green-100 text-green-700" :
                              row.statusText === "pending" ? "bg-yellow-100 text-yellow-700" :
                              row.statusText === "fulfilled" ? "bg-blue-100 text-blue-700" :
                              row.statusText === "rejected" ? "bg-red-100 text-red-700" :
                              "bg-purple-100 text-purple-700"
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
