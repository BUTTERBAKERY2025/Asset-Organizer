import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Printer, FileSpreadsheet, Hammer, Building2, Users, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import type { Branch, ConstructionProject, ConstructionCategory, Contractor, ProjectWorkItem } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  on_hold: "متوقف",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  on_hold: "bg-gray-100 text-gray-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const WORK_STATUS_LABELS: Record<string, string> = {
  pending: "معلق",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
};

const CHART_COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function ConstructionReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: projects = [] } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
    queryFn: async () => {
      const res = await fetch("/api/construction/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<ConstructionCategory[]>({
    queryKey: ["/api/construction/categories"],
    queryFn: async () => {
      const res = await fetch("/api/construction/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contractors");
      if (!res.ok) throw new Error("Failed to fetch contractors");
      return res.json();
    },
  });

  const { data: workItems = [] } = useQuery<ProjectWorkItem[]>({
    queryKey: ["/api/construction/work-items"],
    queryFn: async () => {
      const res = await fetch("/api/construction/work-items");
      if (!res.ok) throw new Error("Failed to fetch work items");
      return res.json();
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تقرير المشاريع الإنشائية",
  });

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const categoryMap = useMemo(() => {
    const map: Record<number, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const contractorMap = useMemo(() => {
    const map: Record<number, string> = {};
    contractors.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [contractors]);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (selectedBranch !== "all") {
      result = result.filter(p => p.branchId === selectedBranch);
    }
    return result;
  }, [projects, selectedBranch]);

  const projectComparisonData = useMemo(() => {
    return filteredProjects.map(project => ({
      name: project.title.length > 20 ? project.title.substring(0, 20) + "..." : project.title,
      fullName: project.title,
      budget: Number(project.budget) || 0,
      progress: project.progressPercent || 0,
      branch: branchMap[project.branchId] || project.branchId,
      status: STATUS_LABELS[project.status] || project.status,
    }));
  }, [filteredProjects, branchMap]);

  const branchComparisonData = useMemo(() => {
    return branches.map(branch => {
      const branchProjects = projects.filter(p => p.branchId === branch.id);
      const totalBudget = branchProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const completed = branchProjects.filter(p => p.status === "completed").length;
      const inProgress = branchProjects.filter(p => p.status === "in_progress").length;
      const avgProgress = branchProjects.length > 0
        ? Math.round(branchProjects.reduce((sum, p) => sum + (p.progressPercent || 0), 0) / branchProjects.length)
        : 0;
      return {
        name: branch.name.replace("فرع ", ""),
        total: branchProjects.length,
        completed,
        inProgress,
        budget: totalBudget,
        avgProgress,
      };
    });
  }, [branches, projects]);

  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    filteredProjects.forEach(p => {
      summary[p.status] = (summary[p.status] || 0) + 1;
    });
    return Object.entries(summary).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
    }));
  }, [filteredProjects]);

  const projectMap = useMemo(() => {
    const map: Record<number, string> = {};
    projects.forEach(p => { map[p.id] = p.title; });
    return map;
  }, [projects]);

  const workItemsByProject = useMemo(() => {
    const projectIds = new Set(filteredProjects.map(p => p.id));
    return workItems.filter(w => projectIds.has(w.projectId));
  }, [workItems, filteredProjects]);

  const workItemsByCategoryData = useMemo(() => {
    const categoryCount: Record<number, { count: number; cost: number; actualCost: number }> = {};
    workItemsByProject.forEach(w => {
      if (w.categoryId) {
        if (!categoryCount[w.categoryId]) {
          categoryCount[w.categoryId] = { count: 0, cost: 0, actualCost: 0 };
        }
        categoryCount[w.categoryId].count += 1;
        categoryCount[w.categoryId].cost += Number(w.costEstimate) || 0;
        categoryCount[w.categoryId].actualCost += Number(w.actualCost) || 0;
      }
    });
    const totalActualCost = Object.values(categoryCount).reduce((sum, d) => sum + d.actualCost, 0);
    return Object.entries(categoryCount)
      .map(([catId, data], index) => ({
        id: parseInt(catId),
        name: categoryMap[parseInt(catId)] || `فئة ${catId}`,
        count: data.count,
        cost: data.cost,
        actualCost: data.actualCost,
        percentage: totalActualCost > 0 ? (data.actualCost / totalActualCost * 100) : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.actualCost - a.actualCost);
  }, [workItemsByProject, categoryMap]);

  const workItemsStatusData = useMemo(() => {
    const statusCount: Record<string, number> = {};
    workItemsByProject.forEach(w => {
      statusCount[w.status] = (statusCount[w.status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([status, count], index) => ({
      name: WORK_STATUS_LABELS[status] || status,
      value: count,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [workItemsByProject]);

  const projectWorkItemsSummary = useMemo(() => {
    return filteredProjects.map(project => {
      const projectItems = workItems.filter(w => w.projectId === project.id);
      const totalCost = projectItems.reduce((sum, w) => sum + (Number(w.actualCost) || 0), 0);
      const completedItems = projectItems.filter(w => w.status === "completed").length;
      const categoryBreakdown: Record<string, { count: number; cost: number }> = {};
      projectItems.forEach(w => {
        const catName = w.categoryId ? (categoryMap[w.categoryId] || `فئة ${w.categoryId}`) : "غير محدد";
        if (!categoryBreakdown[catName]) {
          categoryBreakdown[catName] = { count: 0, cost: 0 };
        }
        categoryBreakdown[catName].count += 1;
        categoryBreakdown[catName].cost += Number(w.actualCost) || 0;
      });
      return {
        projectId: project.id,
        projectName: project.title,
        branchName: branchMap[project.branchId] || project.branchId,
        totalItems: projectItems.length,
        completedItems,
        totalCost,
        categoryBreakdown,
      };
    });
  }, [filteredProjects, workItems, categoryMap, branchMap]);

  const exportToExcel = () => {
    const projectsData = filteredProjects.map(project => ({
      "الفرع": branchMap[project.branchId] || project.branchId,
      "اسم المشروع": project.title,
      "الوصف": project.description || "",
      "الحالة": STATUS_LABELS[project.status] || project.status,
      "الميزانية": Number(project.budget) || 0,
      "نسبة الإنجاز": `${project.progressPercent || 0}%`,
      "تاريخ البدء": project.startDate || "-",
      "تاريخ الانتهاء المتوقع": project.targetCompletionDate || "-",
      "ملاحظات": project.notes || "",
    }));

    const branchSummary = branchComparisonData.map(branch => ({
      "الفرع": branch.name,
      "إجمالي المشاريع": branch.total,
      "مكتملة": branch.completed,
      "قيد التنفيذ": branch.inProgress,
      "إجمالي الميزانية": branch.budget,
      "متوسط التقدم": `${branch.avgProgress}%`,
    }));

    const wb = XLSX.utils.book_new();
    
    const projectsWs = XLSX.utils.json_to_sheet(projectsData);
    XLSX.utils.book_append_sheet(wb, projectsWs, "المشاريع");

    const summaryWs = XLSX.utils.json_to_sheet(branchSummary);
    XLSX.utils.book_append_sheet(wb, summaryWs, "ملخص الفروع");

    XLSX.writeFile(wb, `تقرير_المشاريع_${new Date().toLocaleDateString("ar-SA")}.xlsx`);
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">تقارير المشاريع الإنشائية</h1>
            <p className="text-muted-foreground">مقارنة وتحليل المشاريع والبنود والفئات</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48" data-testid="select-branch-filter">
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((branch) => (
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">إجمالي المشاريع</CardTitle>
                <Hammer className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredProjects.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">قيد التنفيذ</CardTitle>
                <Clock className="w-4 h-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredProjects.filter(p => p.status === "in_progress").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">مكتملة</CardTitle>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredProjects.filter(p => p.status === "completed").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">إجمالي الميزانية</CardTitle>
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0).toLocaleString()} ر.س
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="comparison" className="print:hidden">
            <TabsList data-testid="tabs-report-type">
              <TabsTrigger value="comparison" data-testid="tab-comparison">مقارنة المشاريع</TabsTrigger>
              <TabsTrigger value="branches" data-testid="tab-branches">مقارنة الفروع</TabsTrigger>
              <TabsTrigger value="workitems" data-testid="tab-workitems">البنود والفئات</TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">تفاصيل المشاريع</TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة ميزانيات المشاريع</CardTitle>
                </CardHeader>
                <CardContent>
                  {projectComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={projectComparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip 
                          formatter={(value: number) => `${value.toLocaleString()} ر.س`}
                          labelFormatter={(label) => {
                            const item = projectComparisonData.find(d => d.name === label);
                            return item?.fullName || label;
                          }}
                        />
                        <Bar dataKey="budget" fill="#f59e0b" name="الميزانية" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد مشاريع للعرض</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مقارنة نسب التقدم</CardTitle>
                </CardHeader>
                <CardContent>
                  {projectComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={projectComparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip formatter={(value: number) => `${value}%`} />
                        <Bar dataKey="progress" fill="#22c55e" name="نسبة التقدم" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد مشاريع للعرض</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>توزيع المشاريع حسب الحالة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusSummary.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statusSummary}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {statusSummary.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>المقاولون المسجلون</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contractors.slice(0, 5).map((contractor) => (
                        <div key={contractor.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{contractor.name}</p>
                            <p className="text-sm text-muted-foreground">{contractor.specialization || "غير محدد"}</p>
                          </div>
                          {contractor.rating && (
                            <Badge variant="secondary">{contractor.rating}/5</Badge>
                          )}
                        </div>
                      ))}
                      {contractors.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">لا يوجد مقاولون</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="branches" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة المشاريع بين الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  {branchComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#3b82f6" name="إجمالي المشاريع" />
                        <Bar dataKey="completed" fill="#22c55e" name="مكتملة" />
                        <Bar dataKey="inProgress" fill="#f59e0b" name="قيد التنفيذ" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ملخص الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>عدد المشاريع</TableHead>
                        <TableHead>مكتملة</TableHead>
                        <TableHead>قيد التنفيذ</TableHead>
                        <TableHead>إجمالي الميزانية</TableHead>
                        <TableHead>متوسط التقدم</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchComparisonData.map((branch) => (
                        <TableRow key={branch.name}>
                          <TableCell className="font-medium">{branch.name}</TableCell>
                          <TableCell>{branch.total}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">{branch.completed}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-yellow-100 text-yellow-800">{branch.inProgress}</Badge>
                          </TableCell>
                          <TableCell>{branch.budget.toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={branch.avgProgress} className="w-16" />
                              <span>{branch.avgProgress}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workitems" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>تفصيل التكاليف حسب الفئة</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>الفئة</TableHead>
                        <TableHead>عدد البنود</TableHead>
                        <TableHead>إجمالي التكلفة</TableHead>
                        <TableHead>النسبة</TableHead>
                        <TableHead className="w-32">التوزيع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workItemsByCategoryData.map((cat, index) => (
                        <TableRow key={cat.id} data-testid={`row-category-${cat.id}`}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{cat.name}</TableCell>
                          <TableCell>{cat.count}</TableCell>
                          <TableCell className="font-bold text-amber-600">{cat.actualCost.toLocaleString()} ر.س</TableCell>
                          <TableCell>{cat.percentage.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Progress value={cat.percentage} className="w-24" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {workItemsByCategoryData.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell></TableCell>
                          <TableCell>الإجمالي</TableCell>
                          <TableCell>{workItemsByCategoryData.reduce((sum, c) => sum + c.count, 0)}</TableCell>
                          <TableCell className="text-amber-600">{workItemsByCategoryData.reduce((sum, c) => sum + c.actualCost, 0).toLocaleString()} ر.س</TableCell>
                          <TableCell>100%</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {workItemsByCategoryData.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد بنود عمل</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>توزيع التكاليف حسب الفئة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {workItemsByCategoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={workItemsByCategoryData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="actualCost"
                            label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                          >
                            {workItemsByCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toLocaleString()} ر.س`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">لا توجد بنود عمل</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>حالة بنود العمل</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {workItemsStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={workItemsStatusData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {workItemsStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">لا توجد بنود عمل</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>مقارنة التكاليف بين الفئات</CardTitle>
                </CardHeader>
                <CardContent>
                  {workItemsByCategoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={workItemsByCategoryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip formatter={(value: number) => `${value.toLocaleString()} ر.س`} />
                        <Bar dataKey="actualCost" fill="#f59e0b" name="التكلفة الفعلية" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد بنود عمل</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ملخص البنود لكل مشروع</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المشروع</TableHead>
                        <TableHead>الفرع</TableHead>
                        <TableHead>إجمالي البنود</TableHead>
                        <TableHead>المكتملة</TableHead>
                        <TableHead>التكلفة التقديرية</TableHead>
                        <TableHead>توزيع الفئات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectWorkItemsSummary.map((summary) => (
                        <TableRow key={summary.projectId} data-testid={`row-workitems-${summary.projectId}`}>
                          <TableCell className="font-medium">{summary.projectName}</TableCell>
                          <TableCell>{summary.branchName}</TableCell>
                          <TableCell>{summary.totalItems}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">{summary.completedItems}</Badge>
                          </TableCell>
                          <TableCell>{summary.totalCost.toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(summary.categoryBreakdown)
                                .sort((a, b) => b[1].cost - a[1].cost)
                                .slice(0, 3)
                                .map(([cat, data]) => (
                                <Badge key={cat} variant="outline" className="text-xs">
                                  {cat}: {data.cost.toLocaleString()} ر.س
                                </Badge>
                              ))}
                              {Object.keys(summary.categoryBreakdown).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{Object.keys(summary.categoryBreakdown).length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {projectWorkItemsSummary.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد مشاريع</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>تفاصيل جميع المشاريع</CardTitle>
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
                        <TableHead>تاريخ الانتهاء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.map((project) => (
                        <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                          <TableCell>{branchMap[project.branchId]}</TableCell>
                          <TableCell className="font-medium">{project.title}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[project.status]}>
                              {STATUS_LABELS[project.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{Number(project.budget || 0).toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={project.progressPercent || 0} className="w-16" />
                              <span>{project.progressPercent || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{project.startDate || "-"}</TableCell>
                          <TableCell>{project.targetCompletionDate || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredProjects.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد مشاريع</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="hidden print:block">
            <h2 className="text-xl font-bold mb-4">تقرير المشاريع الإنشائية - {new Date().toLocaleDateString("ar-SA")}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفرع</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الميزانية</TableHead>
                  <TableHead>التقدم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>{branchMap[project.branchId]}</TableCell>
                    <TableCell>{project.title}</TableCell>
                    <TableCell>{STATUS_LABELS[project.status]}</TableCell>
                    <TableCell>{Number(project.budget || 0).toLocaleString()} ر.س</TableCell>
                    <TableCell>{project.progressPercent || 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
