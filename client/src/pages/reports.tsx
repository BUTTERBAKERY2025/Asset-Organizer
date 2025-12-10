import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Printer, FileSpreadsheet, Package, AlertTriangle, TrendingUp, Building2, 
  BarChart3, PieChart, Image, Wrench, CheckCircle2, XCircle, MapPin,
  Calendar, DollarSign, Layers, Eye, Camera, Filter, Download
} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const STATUS_LABELS: Record<string, string> = {
  good: "جيد",
  maintenance: "صيانة",
  damaged: "تالف",
  missing: "مفقود",
};

const STATUS_COLORS: Record<string, string> = {
  good: "bg-green-100 text-green-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  damaged: "bg-red-100 text-red-800",
  missing: "bg-gray-100 text-gray-800",
};

const STATUS_CHART_COLORS: Record<string, string> = {
  good: "#22c55e",
  maintenance: "#eab308",
  damaged: "#ef4444",
  missing: "#6b7280",
};

const BRANCH_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"];

export default function ReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [reportType, setReportType] = useState<string>("overview");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: inventory = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تقرير الأصول والمعدات - مخبز باتر",
  });

  const filteredInventory = inventory.filter((item: any) => {
    const branchMatch = selectedBranch === "all" || item.branchId === selectedBranch;
    const categoryMatch = selectedCategory === "all" || item.category === selectedCategory;
    return branchMatch && categoryMatch;
  });

  const allCategories = Array.from(new Set(inventory.map((item: any) => item.category))).sort();

  const overallStats = {
    total: filteredInventory.length,
    good: filteredInventory.filter((i: any) => i.status === "good").length,
    maintenance: filteredInventory.filter((i: any) => i.status === "maintenance").length,
    damaged: filteredInventory.filter((i: any) => i.status === "damaged").length,
    missing: filteredInventory.filter((i: any) => i.status === "missing").length,
    totalValue: filteredInventory.reduce((sum: number, i: any) => sum + (i.price || 0) * i.quantity, 0),
    totalQuantity: filteredInventory.reduce((sum: number, i: any) => sum + i.quantity, 0),
    withImages: filteredInventory.filter((i: any) => i.imageUrl).length,
    withPrice: filteredInventory.filter((i: any) => i.price && i.price > 0).length,
  };

  const branchStats = branches.map((branch: any) => {
    const branchItems = inventory.filter((i: any) => i.branchId === branch.id);
    return {
      id: branch.id,
      name: branch.name,
      total: branchItems.length,
      good: branchItems.filter((i: any) => i.status === "good").length,
      maintenance: branchItems.filter((i: any) => i.status === "maintenance").length,
      damaged: branchItems.filter((i: any) => i.status === "damaged").length,
      missing: branchItems.filter((i: any) => i.status === "missing").length,
      value: branchItems.reduce((sum: number, i: any) => sum + (i.price || 0) * i.quantity, 0),
      withImages: branchItems.filter((i: any) => i.imageUrl).length,
      quantity: branchItems.reduce((sum: number, i: any) => sum + i.quantity, 0),
    };
  });

  const categoryStats = allCategories.map(category => {
    const categoryItems = filteredInventory.filter((i: any) => i.category === category);
    return {
      category,
      count: categoryItems.length,
      quantity: categoryItems.reduce((sum: number, i: any) => sum + i.quantity, 0),
      value: categoryItems.reduce((sum: number, i: any) => sum + (i.price || 0) * i.quantity, 0),
      good: categoryItems.filter((i: any) => i.status === "good").length,
      maintenance: categoryItems.filter((i: any) => i.status === "maintenance").length,
      damaged: categoryItems.filter((i: any) => i.status === "damaged").length,
      withImages: categoryItems.filter((i: any) => i.imageUrl).length,
    };
  }).sort((a, b) => b.count - a.count);

  const statusChartData = [
    { name: "جيد", value: overallStats.good, color: STATUS_CHART_COLORS.good },
    { name: "صيانة", value: overallStats.maintenance, color: STATUS_CHART_COLORS.maintenance },
    { name: "تالف", value: overallStats.damaged, color: STATUS_CHART_COLORS.damaged },
    { name: "مفقود", value: overallStats.missing, color: STATUS_CHART_COLORS.missing },
  ].filter(d => d.value > 0);

  const branchChartData = branchStats.map((b, i) => ({
    name: b.name,
    total: b.total,
    value: b.value,
    fill: BRANCH_COLORS[i % BRANCH_COLORS.length],
  }));

  const categoryChartData = categoryStats.slice(0, 10).map(c => ({
    name: c.category.length > 15 ? c.category.substring(0, 15) + "..." : c.category,
    count: c.count,
    value: c.value,
  }));

  const exportToExcel = (type: string) => {
    const wb = XLSX.utils.book_new();
    
    if (type === "full" || type === "assets") {
      const assetsData = filteredInventory.map((item: any) => ({
        "الفرع": branches.find((b: any) => b.id === item.branchId)?.name || item.branchId,
        "اسم الأصل": item.name,
        "الكمية": item.quantity,
        "الوحدة": item.unit,
        "التصنيف": item.category,
        "الحالة": STATUS_LABELS[item.status] || item.status || "غير محدد",
        "السعر": item.price || 0,
        "القيمة الإجمالية": (item.price || 0) * item.quantity,
        "الرقم التسلسلي": item.serialNumber || "-",
        "صورة": item.imageUrl ? "نعم" : "لا",
        "ملاحظات": item.notes || "-",
      }));
      const ws = XLSX.utils.json_to_sheet(assetsData);
      XLSX.utils.book_append_sheet(wb, ws, "الأصول");
    }

    if (type === "full" || type === "branches") {
      const branchesData = branchStats.map(b => ({
        "الفرع": b.name,
        "إجمالي الأصول": b.total,
        "الكمية": b.quantity,
        "جيد": b.good,
        "صيانة": b.maintenance,
        "تالف": b.damaged,
        "مفقود": b.missing,
        "القيمة": b.value,
        "مع صور": b.withImages,
        "نسبة الصور": b.total > 0 ? `${Math.round((b.withImages / b.total) * 100)}%` : "0%",
      }));
      const ws = XLSX.utils.json_to_sheet(branchesData);
      XLSX.utils.book_append_sheet(wb, ws, "الفروع");
    }

    if (type === "full" || type === "categories") {
      const categoriesData = categoryStats.map(c => ({
        "التصنيف": c.category,
        "عدد الأصول": c.count,
        "الكمية": c.quantity,
        "جيد": c.good,
        "صيانة": c.maintenance,
        "تالف": c.damaged,
        "القيمة": c.value,
        "مع صور": c.withImages,
      }));
      const ws = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(wb, ws, "التصنيفات");
    }

    if (type === "full" || type === "maintenance") {
      const maintenanceData = filteredInventory
        .filter((item: any) => item.status !== "good")
        .map((item: any) => ({
          "الفرع": branches.find((b: any) => b.id === item.branchId)?.name || item.branchId,
          "اسم الأصل": item.name,
          "التصنيف": item.category,
          "الحالة": STATUS_LABELS[item.status] || item.status,
          "الكمية": item.quantity,
          "القيمة": (item.price || 0) * item.quantity,
          "ملاحظات": item.notes || "-",
        }));
      const ws = XLSX.utils.json_to_sheet(maintenanceData);
      XLSX.utils.book_append_sheet(wb, ws, "الصيانة والتالف");
    }

    if (type === "full") {
      const summaryData = [
        { "البيان": "إجمالي الأصول", "القيمة": overallStats.total },
        { "البيان": "إجمالي الكميات", "القيمة": overallStats.totalQuantity },
        { "البيان": "أصول بحالة جيدة", "القيمة": overallStats.good },
        { "البيان": "أصول تحتاج صيانة", "القيمة": overallStats.maintenance },
        { "البيان": "أصول تالفة", "القيمة": overallStats.damaged },
        { "البيان": "أصول مفقودة", "القيمة": overallStats.missing },
        { "البيان": "القيمة الإجمالية (ر.س)", "القيمة": overallStats.totalValue },
        { "البيان": "أصول مع صور", "القيمة": overallStats.withImages },
        { "البيان": "نسبة تغطية الصور", "القيمة": `${overallStats.total > 0 ? Math.round((overallStats.withImages / overallStats.total) * 100) : 0}%` },
      ];
      const ws = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, "الملخص");
    }

    const fileName = type === "full" 
      ? `تقرير_الأصول_الشامل_${new Date().toLocaleDateString("ar-SA")}.xlsx`
      : `تقرير_${type}_${new Date().toLocaleDateString("ar-SA")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">تقارير الأصول والمعدات</h1>
            <p className="text-muted-foreground">تقارير شاملة ومتطورة لجميع أصول ومعدات الفروع</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-40" data-testid="select-branch-filter">
                <MapPin className="w-4 h-4 ml-2" />
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40" data-testid="select-category-filter">
                <Layers className="w-4 h-4 ml-2" />
                <SelectValue placeholder="جميع التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {allCategories.map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => handlePrint()} data-testid="button-print">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button onClick={() => exportToExcel("full")} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              تصدير شامل
            </Button>
          </div>
        </div>

        <div ref={printRef} className="space-y-6 print:p-4">
          <div className="hidden print:block text-center mb-6">
            <h2 className="text-xl font-bold">تقرير الأصول والمعدات - مخبز باتر</h2>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("ar-SA")}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <Package className="w-8 h-8 text-amber-600" />
                  <div className="text-left">
                    <p className="text-xs text-amber-600">إجمالي الأصول</p>
                    <p className="text-2xl font-bold text-amber-800">{overallStats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="text-xs text-green-600">حالة جيدة</p>
                    <p className="text-2xl font-bold text-green-800">{overallStats.good}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <Wrench className="w-8 h-8 text-yellow-600" />
                  <div className="text-left">
                    <p className="text-xs text-yellow-600">تحتاج صيانة</p>
                    <p className="text-2xl font-bold text-yellow-800">{overallStats.maintenance}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div className="text-left">
                    <p className="text-xs text-red-600">تالف/مفقود</p>
                    <p className="text-2xl font-bold text-red-800">{overallStats.damaged + overallStats.missing}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <DollarSign className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <p className="text-xs text-blue-600">القيمة الإجمالية</p>
                    <p className="text-lg font-bold text-blue-800">{overallStats.totalValue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <Camera className="w-8 h-8 text-purple-600" />
                  <div className="text-left">
                    <p className="text-xs text-purple-600">مع صور</p>
                    <p className="text-2xl font-bold text-purple-800">{overallStats.withImages}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={reportType} onValueChange={setReportType} className="print:hidden">
            <TabsList className="grid grid-cols-6 w-full" data-testid="tabs-report-type">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BarChart3 className="w-4 h-4 ml-1" />
                نظرة عامة
              </TabsTrigger>
              <TabsTrigger value="branches" data-testid="tab-branches">
                <Building2 className="w-4 h-4 ml-1" />
                الفروع
              </TabsTrigger>
              <TabsTrigger value="categories" data-testid="tab-categories">
                <Layers className="w-4 h-4 ml-1" />
                التصنيفات
              </TabsTrigger>
              <TabsTrigger value="status" data-testid="tab-status">
                <AlertTriangle className="w-4 h-4 ml-1" />
                الحالات
              </TabsTrigger>
              <TabsTrigger value="images" data-testid="tab-images">
                <Image className="w-4 h-4 ml-1" />
                الصور
              </TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">
                <Eye className="w-4 h-4 ml-1" />
                التفاصيل
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5" />
                      توزيع حالات الأصول
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPie>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      مقارنة الفروع
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={branchChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip />
                        <Bar dataKey="total" name="عدد الأصول" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    توزيع التصنيفات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="عدد الأصول" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branches" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      تقرير الفروع المفصل
                    </CardTitle>
                    <CardDescription>مقارنة شاملة بين جميع الفروع</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToExcel("branches")}>
                    <Download className="w-4 h-4 ml-1" />
                    تصدير
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead className="text-center">الأصول</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-center">جيد</TableHead>
                        <TableHead className="text-center">صيانة</TableHead>
                        <TableHead className="text-center">تالف</TableHead>
                        <TableHead className="text-center">مفقود</TableHead>
                        <TableHead className="text-center">القيمة</TableHead>
                        <TableHead className="text-center">الصور</TableHead>
                        <TableHead className="text-center">نسبة الصحة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchStats.map((branch) => (
                        <TableRow key={branch.id}>
                          <TableCell className="font-medium">{branch.name}</TableCell>
                          <TableCell className="text-center">{branch.total}</TableCell>
                          <TableCell className="text-center">{branch.quantity}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-800">{branch.good}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-yellow-100 text-yellow-800">{branch.maintenance}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-800">{branch.damaged}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-gray-100 text-gray-800">{branch.missing}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{branch.value.toLocaleString()} ر.س</TableCell>
                          <TableCell className="text-center">
                            <span className="text-purple-600 font-medium">{branch.withImages}</span>
                            <span className="text-muted-foreground text-xs mr-1">
                              ({branch.total > 0 ? Math.round((branch.withImages / branch.total) * 100) : 0}%)
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={branch.total > 0 ? (branch.good / branch.total) * 100 : 0} 
                                className="w-16 h-2"
                              />
                              <span className="text-sm">
                                {branch.total > 0 ? Math.round((branch.good / branch.total) * 100) : 0}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>الإجمالي</TableCell>
                        <TableCell className="text-center">{overallStats.total}</TableCell>
                        <TableCell className="text-center">{overallStats.totalQuantity}</TableCell>
                        <TableCell className="text-center">{overallStats.good}</TableCell>
                        <TableCell className="text-center">{overallStats.maintenance}</TableCell>
                        <TableCell className="text-center">{overallStats.damaged}</TableCell>
                        <TableCell className="text-center">{overallStats.missing}</TableCell>
                        <TableCell className="text-center">{overallStats.totalValue.toLocaleString()} ر.س</TableCell>
                        <TableCell className="text-center">{overallStats.withImages}</TableCell>
                        <TableCell className="text-center">
                          {overallStats.total > 0 ? Math.round((overallStats.good / overallStats.total) * 100) : 0}%
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="w-5 h-5" />
                      تقرير التصنيفات
                    </CardTitle>
                    <CardDescription>تحليل الأصول حسب التصنيف</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToExcel("categories")}>
                    <Download className="w-4 h-4 ml-1" />
                    تصدير
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التصنيف</TableHead>
                        <TableHead className="text-center">عدد الأصول</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-center">جيد</TableHead>
                        <TableHead className="text-center">صيانة</TableHead>
                        <TableHead className="text-center">تالف</TableHead>
                        <TableHead className="text-center">القيمة</TableHead>
                        <TableHead className="text-center">الصور</TableHead>
                        <TableHead className="text-center">النسبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryStats.map((cat) => (
                        <TableRow key={cat.category}>
                          <TableCell className="font-medium">{cat.category}</TableCell>
                          <TableCell className="text-center">{cat.count}</TableCell>
                          <TableCell className="text-center">{cat.quantity}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-800">{cat.good}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-yellow-100 text-yellow-800">{cat.maintenance}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-800">{cat.damaged}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{cat.value.toLocaleString()} ر.س</TableCell>
                          <TableCell className="text-center">
                            <span className="text-purple-600 font-medium">{cat.withImages}</span>
                            <span className="text-muted-foreground text-xs mr-1">
                              ({cat.count > 0 ? Math.round((cat.withImages / cat.count) * 100) : 0}%)
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Progress 
                              value={overallStats.total > 0 ? (cat.count / overallStats.total) * 100 : 0} 
                              className="w-16 h-2"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="status" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-yellow-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-700">
                      <Wrench className="w-5 h-5" />
                      أصول تحتاج صيانة ({overallStats.maintenance})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-80 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>الفرع</TableHead>
                            <TableHead>الأصل</TableHead>
                            <TableHead>التصنيف</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInventory
                            .filter((item: any) => item.status === "maintenance")
                            .map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm">{branches.find((b: any) => b.id === item.branchId)?.name}</TableCell>
                                <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                <TableCell className="text-sm">{item.category}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <XCircle className="w-5 h-5" />
                      أصول تالفة ({overallStats.damaged})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-80 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>الفرع</TableHead>
                            <TableHead>الأصل</TableHead>
                            <TableHead>التصنيف</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInventory
                            .filter((item: any) => item.status === "damaged")
                            .map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm">{branches.find((b: any) => b.id === item.branchId)?.name}</TableCell>
                                <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                <TableCell className="text-sm">{item.category}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      جميع الأصول التي تحتاج متابعة
                    </CardTitle>
                    <CardDescription>صيانة، تالف، مفقود</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToExcel("maintenance")}>
                    <Download className="w-4 h-4 ml-1" />
                    تصدير
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>الأصل</TableHead>
                        <TableHead>التصنيف</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>القيمة</TableHead>
                        <TableHead>ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory
                        .filter((item: any) => item.status !== "good")
                        .map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>{branches.find((b: any) => b.id === item.branchId)?.name}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[item.status]}>
                                {STATUS_LABELS[item.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{((item.price || 0) * item.quantity).toLocaleString()} ر.س</TableCell>
                            <TableCell className="max-w-xs truncate">{item.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  {filteredInventory.filter((item: any) => item.status !== "good").length === 0 && (
                    <p className="text-center text-muted-foreground py-8">جميع الأصول بحالة جيدة</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="images" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    تقرير تغطية الصور
                  </CardTitle>
                  <CardDescription>تحليل توفر صور الأصول في كل فرع</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-4xl font-bold text-purple-700">{overallStats.withImages}</p>
                        <p className="text-sm text-purple-600">أصل مع صورة</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gray-50 border-gray-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-4xl font-bold text-gray-700">{overallStats.total - overallStats.withImages}</p>
                        <p className="text-sm text-gray-600">أصل بدون صورة</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-4xl font-bold text-green-700">
                          {overallStats.total > 0 ? Math.round((overallStats.withImages / overallStats.total) * 100) : 0}%
                        </p>
                        <p className="text-sm text-green-600">نسبة التغطية</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">تغطية الصور حسب الفرع</h3>
                    {branchStats.map((branch) => (
                      <div key={branch.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{branch.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {branch.withImages} / {branch.total} ({branch.total > 0 ? Math.round((branch.withImages / branch.total) * 100) : 0}%)
                          </span>
                        </div>
                        <Progress 
                          value={branch.total > 0 ? (branch.withImages / branch.total) * 100 : 0}
                          className="h-3"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">أصول بدون صور</h3>
                    <div className="max-h-60 overflow-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>الفرع</TableHead>
                            <TableHead>الأصل</TableHead>
                            <TableHead>التصنيف</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInventory
                            .filter((item: any) => !item.imageUrl)
                            .slice(0, 20)
                            .map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>{branches.find((b: any) => b.id === item.branchId)?.name}</TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>{item.category}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredInventory.filter((item: any) => !item.imageUrl).length > 20 && (
                      <p className="text-sm text-muted-foreground text-center">
                        عرض 20 من {filteredInventory.filter((item: any) => !item.imageUrl).length}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      جرد الأصول التفصيلي
                    </CardTitle>
                    <CardDescription>عرض {filteredInventory.length} أصل</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportToExcel("assets")}>
                    <Download className="w-4 h-4 ml-1" />
                    تصدير
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>الفرع</TableHead>
                          <TableHead>الأصل</TableHead>
                          <TableHead>الكمية</TableHead>
                          <TableHead>التصنيف</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>القيمة</TableHead>
                          <TableHead>صورة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((item: any, index: number) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                            <TableCell>{branches.find((b: any) => b.id === item.branchId)?.name}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.quantity} {item.unit}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[item.status] || "bg-gray-100"}>
                                {STATUS_LABELS[item.status] || "غير محدد"}
                              </Badge>
                            </TableCell>
                            <TableCell>{((item.price || 0) * item.quantity).toLocaleString()} ر.س</TableCell>
                            <TableCell>
                              {item.imageUrl ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="hidden print:block space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="border p-3 rounded">
                <h3 className="font-bold mb-2">ملخص الأصول</h3>
                <p>إجمالي الأصول: {overallStats.total}</p>
                <p>بحالة جيدة: {overallStats.good}</p>
                <p>تحتاج صيانة: {overallStats.maintenance}</p>
                <p>تالفة: {overallStats.damaged}</p>
                <p>مفقودة: {overallStats.missing}</p>
                <p className="font-bold mt-2">القيمة: {overallStats.totalValue.toLocaleString()} ر.س</p>
              </div>
              <div className="border p-3 rounded">
                <h3 className="font-bold mb-2">الفروع</h3>
                {branchStats.map(b => (
                  <p key={b.id}>{b.name}: {b.total} أصل ({b.good} جيد)</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
