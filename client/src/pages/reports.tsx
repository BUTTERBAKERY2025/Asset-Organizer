import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, FileSpreadsheet, FileBarChart, Package, Hammer, AlertTriangle, TrendingUp, Building2 } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";

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

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  on_hold: "معلق",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  on_hold: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function ReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
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

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/construction/projects"],
    queryFn: async () => {
      const res = await fetch("/api/construction/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const { data: contractors = [] } = useQuery<any[]>({
    queryKey: ["/api/construction/contractors"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contractors");
      if (!res.ok) throw new Error("Failed to fetch contractors");
      return res.json();
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تقرير شامل - مخبز باتر",
  });

  const filteredInventory = selectedBranch === "all" 
    ? inventory 
    : inventory.filter((item: any) => item.branchId === selectedBranch);

  const filteredProjects = selectedBranch === "all"
    ? projects
    : projects.filter((project: any) => project.branchId === selectedBranch);

  const inventoryStats = {
    total: filteredInventory.length,
    good: filteredInventory.filter((i: any) => i.status === "good").length,
    maintenance: filteredInventory.filter((i: any) => i.status === "maintenance").length,
    damaged: filteredInventory.filter((i: any) => i.status === "damaged").length,
    missing: filteredInventory.filter((i: any) => i.status === "missing").length,
    totalValue: filteredInventory.reduce((sum: number, i: any) => sum + (i.price || 0) * i.quantity, 0),
  };

  const projectStats = {
    total: filteredProjects.length,
    planned: filteredProjects.filter((p: any) => p.status === "planned").length,
    inProgress: filteredProjects.filter((p: any) => p.status === "in_progress").length,
    completed: filteredProjects.filter((p: any) => p.status === "completed").length,
    totalBudget: filteredProjects.reduce((sum: number, p: any) => sum + (parseFloat(p.budget) || 0), 0),
    avgProgress: filteredProjects.length > 0 
      ? Math.round(filteredProjects.reduce((sum: number, p: any) => sum + (p.progressPercentage || 0), 0) / filteredProjects.length)
      : 0,
  };

  const categorySummary = filteredInventory.reduce((acc: Record<string, { count: number; value: number }>, item: any) => {
    const category = item.category || "غير مصنف";
    if (!acc[category]) acc[category] = { count: 0, value: 0 };
    acc[category].count += item.quantity;
    acc[category].value += (item.price || 0) * item.quantity;
    return acc;
  }, {});

  const exportToExcel = () => {
    const inventoryData = filteredInventory.map((item: any) => ({
      "الفرع": branches.find((b: any) => b.id === item.branchId)?.name || item.branchId,
      "الاسم": item.name,
      "الكمية": item.quantity,
      "الوحدة": item.unit,
      "الفئة": item.category,
      "الحالة": STATUS_LABELS[item.status] || item.status,
      "السعر": item.price || 0,
      "القيمة الإجمالية": (item.price || 0) * item.quantity,
    }));

    const projectsData = filteredProjects.map((project: any) => ({
      "الفرع": branches.find((b: any) => b.id === project.branchId)?.name || project.branchId,
      "اسم المشروع": project.name,
      "الحالة": PROJECT_STATUS_LABELS[project.status] || project.status,
      "الميزانية": parseFloat(project.budget) || 0,
      "نسبة الإنجاز": `${project.progressPercentage || 0}%`,
      "تاريخ البدء": project.startDate || "-",
      "تاريخ الانتهاء المتوقع": project.expectedEndDate || "-",
    }));

    const summaryData = [
      { "البيان": "إجمالي الأصول", "القيمة": inventoryStats.total },
      { "البيان": "أصول بحالة جيدة", "القيمة": inventoryStats.good },
      { "البيان": "أصول تحتاج صيانة", "القيمة": inventoryStats.maintenance },
      { "البيان": "أصول تالفة", "القيمة": inventoryStats.damaged },
      { "البيان": "أصول مفقودة", "القيمة": inventoryStats.missing },
      { "البيان": "القيمة الإجمالية للأصول", "القيمة": inventoryStats.totalValue },
      { "البيان": "إجمالي المشاريع", "القيمة": projectStats.total },
      { "البيان": "مشاريع قيد التنفيذ", "القيمة": projectStats.inProgress },
      { "البيان": "مشاريع مكتملة", "القيمة": projectStats.completed },
      { "البيان": "إجمالي ميزانية المشاريع", "القيمة": projectStats.totalBudget },
    ];

    const wb = XLSX.utils.book_new();
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "ملخص");

    const inventoryWs = XLSX.utils.json_to_sheet(inventoryData);
    XLSX.utils.book_append_sheet(wb, inventoryWs, "الأصول");

    const projectsWs = XLSX.utils.json_to_sheet(projectsData);
    XLSX.utils.book_append_sheet(wb, projectsWs, "المشاريع");

    XLSX.writeFile(wb, `تقرير_شامل_${new Date().toLocaleDateString("ar-SA")}.xlsx`);
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">التقارير الشاملة</h1>
            <p className="text-muted-foreground">عرض وتصدير تقارير الأصول والمشاريع الإنشائية</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48" data-testid="select-branch-filter">
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
            <Button variant="outline" onClick={() => handlePrint()} data-testid="button-print">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button onClick={exportToExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
          </div>
        </div>

        <div ref={printRef} className="space-y-6 print:p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-assets">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">إجمالي الأصول</CardTitle>
                <Package className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventoryStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {inventoryStats.good} جيد • {inventoryStats.maintenance} صيانة
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-value">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">القيمة الإجمالية</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventoryStats.totalValue.toLocaleString()} ر.س</div>
                <p className="text-xs text-muted-foreground">قيمة جميع الأصول</p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-projects">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">المشاريع الإنشائية</CardTitle>
                <Hammer className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {projectStats.inProgress} قيد التنفيذ • {projectStats.completed} مكتمل
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-project-budget">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">ميزانية المشاريع</CardTitle>
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectStats.totalBudget.toLocaleString()} ر.س</div>
                <p className="text-xs text-muted-foreground">متوسط الإنجاز {projectStats.avgProgress}%</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="assets" className="print:hidden">
            <TabsList data-testid="tabs-report-type">
              <TabsTrigger value="assets" data-testid="tab-assets">تقرير الأصول</TabsTrigger>
              <TabsTrigger value="maintenance" data-testid="tab-maintenance">تقرير الصيانة</TabsTrigger>
              <TabsTrigger value="projects" data-testid="tab-projects">تقرير المشاريع</TabsTrigger>
              <TabsTrigger value="categories" data-testid="tab-categories">ملخص الفئات</TabsTrigger>
            </TabsList>

            <TabsContent value="assets" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    جرد الأصول الكامل
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>الفئة</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>القيمة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.slice(0, 20).map((item: any) => (
                        <TableRow key={item.id} data-testid={`row-asset-${item.id}`}>
                          <TableCell>{branches.find((b: any) => b.id === item.branchId)?.name || item.branchId}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[item.status]}>
                              {STATUS_LABELS[item.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{((item.price || 0) * item.quantity).toLocaleString()} ر.س</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredInventory.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      عرض 20 من {filteredInventory.length} • استخدم التصدير لعرض الكل
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    الأصول التي تحتاج صيانة أو تالفة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>الفئة</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory
                        .filter((item: any) => item.status === "maintenance" || item.status === "damaged" || item.status === "missing")
                        .map((item: any) => (
                          <TableRow key={item.id} data-testid={`row-maintenance-${item.id}`}>
                            <TableCell>{branches.find((b: any) => b.id === item.branchId)?.name || item.branchId}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.quantity} {item.unit}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[item.status]}>
                                {STATUS_LABELS[item.status]}
                              </Badge>
                            </TableCell>
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

            <TabsContent value="projects" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hammer className="w-5 h-5" />
                    المشاريع الإنشائية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>اسم المشروع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الميزانية</TableHead>
                        <TableHead>نسبة الإنجاز</TableHead>
                        <TableHead>تاريخ البدء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.map((project: any) => (
                        <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                          <TableCell>{branches.find((b: any) => b.id === project.branchId)?.name || project.branchId}</TableCell>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell>
                            <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                              {PROJECT_STATUS_LABELS[project.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{parseFloat(project.budget || 0).toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full" 
                                  style={{ width: `${project.progressPercentage || 0}%` }}
                                />
                              </div>
                              <span className="text-sm">{project.progressPercentage || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{project.startDate || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredProjects.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد مشاريع إنشائية</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileBarChart className="w-5 h-5" />
                    ملخص الفئات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفئة</TableHead>
                        <TableHead>عدد العناصر</TableHead>
                        <TableHead>القيمة الإجمالية</TableHead>
                        <TableHead>النسبة من الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(categorySummary)
                        .sort(([, a], [, b]) => (b as any).value - (a as any).value)
                        .map(([category, data]: [string, any]) => (
                          <TableRow key={category} data-testid={`row-category-${category}`}>
                            <TableCell className="font-medium">{category}</TableCell>
                            <TableCell>{data.count}</TableCell>
                            <TableCell>{data.value.toLocaleString()} ر.س</TableCell>
                            <TableCell>
                              {inventoryStats.totalValue > 0 
                                ? `${Math.round((data.value / inventoryStats.totalValue) * 100)}%`
                                : "0%"
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="hidden print:block space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">تقرير شامل - مخبز باتر</h2>
              <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("ar-SA")}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="border p-3 rounded">
                <h3 className="font-bold mb-2">ملخص الأصول</h3>
                <p>إجمالي الأصول: {inventoryStats.total}</p>
                <p>بحالة جيدة: {inventoryStats.good}</p>
                <p>تحتاج صيانة: {inventoryStats.maintenance}</p>
                <p>تالفة: {inventoryStats.damaged}</p>
                <p>مفقودة: {inventoryStats.missing}</p>
                <p className="font-bold mt-2">القيمة: {inventoryStats.totalValue.toLocaleString()} ر.س</p>
              </div>
              <div className="border p-3 rounded">
                <h3 className="font-bold mb-2">ملخص المشاريع</h3>
                <p>إجمالي المشاريع: {projectStats.total}</p>
                <p>مخطط: {projectStats.planned}</p>
                <p>قيد التنفيذ: {projectStats.inProgress}</p>
                <p>مكتمل: {projectStats.completed}</p>
                <p className="font-bold mt-2">الميزانية: {projectStats.totalBudget.toLocaleString()} ر.س</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
