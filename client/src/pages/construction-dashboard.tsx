import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Hammer, DollarSign, Clock, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Building2, Users, Download, FileSpreadsheet, Printer, BarChart3, PieChartIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart, Area } from "recharts";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import { finalizeBrandedWorkbook } from "@/lib/excel-utils";
import type { Branch, ConstructionProject, Contractor, ConstructionCategory, ProjectWorkItem } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  on_hold: "متوقف",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  in_progress: "#f59e0b",
  on_hold: "#6b7280",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const CHART_COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-SA', { 
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  }).format(value) + ' ر.س';
};

export default function ConstructionDashboardPage() {
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تقرير لوحة تحكم المشاريع الإنشائية",
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
    queryFn: async () => {
      const res = await fetch("/api/construction/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
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

  const { data: categories = [] } = useQuery<ConstructionCategory[]>({
    queryKey: ["/api/construction/categories"],
    queryFn: async () => {
      const res = await fetch("/api/construction/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: allWorkItems = [] } = useQuery<ProjectWorkItem[]>({
    queryKey: ["/api/construction/work-items"],
    queryFn: async () => {
      const res = await fetch("/api/construction/work-items");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = branchesLoading || projectsLoading;

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

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalActualCost = projects.reduce((sum, p) => sum + (Number(p.actualCost) || 0), 0);
    const budgetVariance = totalBudget - totalActualCost;
    const budgetVariancePercent = totalBudget > 0 ? ((budgetVariance / totalBudget) * 100) : 0;
    const avgProgress = totalProjects > 0 
      ? Math.round(projects.reduce((sum, p) => sum + (p.progressPercent || 0), 0) / totalProjects)
      : 0;
    const activeProjects = projects.filter(p => p.status === "in_progress").length;
    const completedProjects = projects.filter(p => p.status === "completed").length;
    const plannedProjects = projects.filter(p => p.status === "planned").length;
    const delayedProjects = projects.filter(p => {
      if (!p.targetCompletionDate) return false;
      const target = new Date(p.targetCompletionDate);
      return target < new Date() && p.status !== "completed" && p.status !== "cancelled";
    }).length;
    const totalWorkItems = allWorkItems.length;
    const completedWorkItems = allWorkItems.filter(w => w.status === "completed").length;

    return { 
      totalProjects, totalBudget, totalActualCost, budgetVariance, budgetVariancePercent,
      avgProgress, activeProjects, completedProjects, plannedProjects, delayedProjects,
      totalWorkItems, completedWorkItems
    };
  }, [projects, allWorkItems]);

  const statusData = useMemo(() => {
    const statusCount: Record<string, number> = {};
    projects.forEach(p => {
      statusCount[p.status] = (statusCount[p.status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || "#6b7280",
    }));
  }, [projects]);

  const budgetComparisonData = useMemo(() => {
    return projects.map(p => ({
      name: p.title.length > 20 ? p.title.substring(0, 20) + '...' : p.title,
      fullName: p.title,
      budget: Number(p.budget) || 0,
      actualCost: Number(p.actualCost) || 0,
      variance: (Number(p.budget) || 0) - (Number(p.actualCost) || 0),
      progress: p.progressPercent || 0,
    })).sort((a, b) => b.budget - a.budget);
  }, [projects]);

  const categorySpendingData = useMemo(() => {
    const categoryTotals: Record<number, { name: string; amount: number; count: number }> = {};
    
    allWorkItems.forEach(item => {
      const catId = item.categoryId || 0;
      const catName = catId ? categoryMap[catId] || 'غير مصنف' : 'غير مصنف';
      if (!categoryTotals[catId]) {
        categoryTotals[catId] = { name: catName, amount: 0, count: 0 };
      }
      categoryTotals[catId].amount += Number(item.actualCost) || 0;
      categoryTotals[catId].count += 1;
    });

    return Object.values(categoryTotals)
      .sort((a, b) => b.amount - a.amount)
      .map((cat, index) => ({
        ...cat,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [allWorkItems, categoryMap]);

  const branchComparisonData = useMemo(() => {
    return branches.map((branch, index) => {
      const branchProjects = projects.filter(p => p.branchId === branch.id);
      const totalBudget = branchProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const totalActualCost = branchProjects.reduce((sum, p) => sum + (Number(p.actualCost) || 0), 0);
      const avgProgress = branchProjects.length > 0
        ? Math.round(branchProjects.reduce((sum, p) => sum + (p.progressPercent || 0), 0) / branchProjects.length)
        : 0;
      return {
        name: branch.name.replace("فرع ", ""),
        fullName: branch.name,
        projects: branchProjects.length,
        budget: totalBudget,
        actualCost: totalActualCost,
        variance: totalBudget - totalActualCost,
        progress: avgProgress,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
  }, [branches, projects]);

  const topProjects = useMemo(() => {
    return [...projects]
      .filter(p => p.status === "in_progress")
      .sort((a, b) => (Number(b.budget) || 0) - (Number(a.budget) || 0))
      .slice(0, 5);
  }, [projects]);

  const exportToExcel = () => {
    const projectsData = projects.map(p => ({
      'المشروع': p.title,
      'الفرع': branchMap[p.branchId] || p.branchId,
      'الحالة': STATUS_LABELS[p.status] || p.status,
      'الميزانية': Number(p.budget) || 0,
      'التكلفة الفعلية': Number(p.actualCost) || 0,
      'الفارق': (Number(p.budget) || 0) - (Number(p.actualCost) || 0),
      'نسبة التقدم': `${p.progressPercent || 0}%`,
      'تاريخ البدء': p.startDate || '',
      'تاريخ الانتهاء المتوقع': p.targetCompletionDate || '',
    }));

    const categoryData = categorySpendingData.map(c => ({
      'الفئة': c.name,
      'إجمالي الصرف': c.amount,
      'عدد البنود': c.count,
    }));

    const branchData = branchComparisonData.map(b => ({
      'الفرع': b.fullName,
      'عدد المشاريع': b.projects,
      'الميزانية': b.budget,
      'التكلفة الفعلية': b.actualCost,
      'الفارق': b.variance,
      'متوسط التقدم': `${b.progress}%`,
    }));

    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(projectsData);
    XLSX.utils.book_append_sheet(wb, ws1, "المشاريع");
    
    const ws2 = XLSX.utils.json_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, ws2, "الفئات");
    
    const ws3 = XLSX.utils.json_to_sheet(branchData);
    XLSX.utils.book_append_sheet(wb, ws3, "الفروع");

    finalizeBrandedWorkbook(wb, "تقرير لوحة تحكم المشاريع الإنشائية");
    XLSX.writeFile(wb, `تقرير_لوحة_التحكم_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" dir="rtl" ref={printRef}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">لوحة تحكم المشاريع الإنشائية</h1>
            <p className="text-muted-foreground">نظرة عامة شاملة على جميع المشاريع والإحصائيات والمقارنات</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={exportToExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
            <Button variant="outline" onClick={() => handlePrint()} data-testid="button-print">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-projects" className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-amber-800">إجمالي المشاريع</CardTitle>
              <Hammer className="w-5 h-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900">{stats.totalProjects}</div>
              <div className="flex gap-2 mt-2 text-xs">
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                  {stats.completedProjects} مكتمل
                </Badge>
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                  {stats.activeProjects} قيد التنفيذ
                </Badge>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                  {stats.plannedProjects} مخطط
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-budget" className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">إجمالي الميزانية</CardTitle>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(stats.totalBudget)}</div>
              <p className="text-xs text-blue-600 mt-1">ميزانية جميع المشاريع</p>
            </CardContent>
          </Card>

          <Card data-testid="card-actual-cost" className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">التكلفة الفعلية</CardTitle>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totalActualCost)}</div>
              <div className="flex items-center gap-1 mt-1">
                {stats.budgetVariance >= 0 ? (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-600">وفر {formatCurrency(stats.budgetVariance)}</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-red-600">تجاوز {formatCurrency(Math.abs(stats.budgetVariance))}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-progress" className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-800">متوسط التقدم</CardTitle>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">{stats.avgProgress}%</div>
              <Progress value={stats.avgProgress} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="card-work-items">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">بنود العمل</CardTitle>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWorkItems}</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedWorkItems} مكتمل من أصل {stats.totalWorkItems}
              </p>
              <Progress 
                value={stats.totalWorkItems > 0 ? (stats.completedWorkItems / stats.totalWorkItems) * 100 : 0} 
                className="mt-2 h-2" 
              />
            </CardContent>
          </Card>

          <Card data-testid="card-contractors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المقاولون</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contractors.length}</div>
              <p className="text-xs text-muted-foreground">مقاول مسجل في النظام</p>
            </CardContent>
          </Card>

          <Card data-testid="card-categories">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">فئات العمل</CardTitle>
              <PieChartIcon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">فئة لتصنيف بنود العمل</p>
            </CardContent>
          </Card>
        </div>

        {stats.delayedProjects > 0 && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800 font-medium">
                تنبيه: يوجد {stats.delayedProjects} مشروع متأخر عن الموعد المحدد
              </span>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="comparison" className="print:hidden">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="comparison" data-testid="tab-comparison">مقارنة الميزانية</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">تحليل الفئات</TabsTrigger>
            <TabsTrigger value="branches" data-testid="tab-branches">مقارنة الفروع</TabsTrigger>
            <TabsTrigger value="status" data-testid="tab-status">حالة المشاريع</TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>مقارنة الميزانية والتكلفة الفعلية</CardTitle>
                <CardDescription>مقارنة تفصيلية بين الميزانية المخططة والتكلفة الفعلية لكل مشروع</CardDescription>
              </CardHeader>
              <CardContent>
                {budgetComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={budgetComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = {
                            budget: 'الميزانية',
                            actualCost: 'التكلفة الفعلية',
                            variance: 'الفارق',
                          };
                          return [formatCurrency(value), labels[name] || name];
                        }}
                        labelFormatter={(label) => {
                          const item = budgetComparisonData.find(d => d.name === label);
                          return item?.fullName || label;
                        }}
                      />
                      <Legend formatter={(value) => {
                        const labels: Record<string, string> = {
                          budget: 'الميزانية',
                          actualCost: 'التكلفة الفعلية',
                        };
                        return labels[value] || value;
                      }} />
                      <Bar dataKey="budget" fill="#3b82f6" name="budget" barSize={20} />
                      <Bar dataKey="actualCost" fill="#22c55e" name="actualCost" barSize={20} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    لا توجد بيانات للعرض
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>جدول المقارنة التفصيلي</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المشروع</TableHead>
                      <TableHead>الميزانية</TableHead>
                      <TableHead>التكلفة الفعلية</TableHead>
                      <TableHead>الفارق</TableHead>
                      <TableHead>نسبة الصرف</TableHead>
                      <TableHead>التقدم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetComparisonData.map((item, index) => {
                      const spendPercent = item.budget > 0 ? (item.actualCost / item.budget) * 100 : 0;
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.fullName}</TableCell>
                          <TableCell>{formatCurrency(item.budget)}</TableCell>
                          <TableCell>{formatCurrency(item.actualCost)}</TableCell>
                          <TableCell className={item.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(spendPercent, 100)} className="w-16 h-2" />
                              <span className="text-sm">{spendPercent.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.progress >= 100 ? 'default' : 'outline'}>
                              {item.progress}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>توزيع الصرف حسب الفئة</CardTitle>
                  <CardDescription>تحليل إجمالي الصرف لكل فئة من فئات بنود العمل</CardDescription>
                </CardHeader>
                <CardContent>
                  {categorySpendingData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={categorySpendingData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={140}
                          paddingAngle={2}
                          dataKey="amount"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {categorySpendingData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      لا توجد بيانات
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>تفاصيل الصرف حسب الفئة</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفئة</TableHead>
                        <TableHead>إجمالي الصرف</TableHead>
                        <TableHead>عدد البنود</TableHead>
                        <TableHead>النسبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorySpendingData.map((cat, index) => {
                        const totalSpending = categorySpendingData.reduce((sum, c) => sum + c.amount, 0);
                        const percent = totalSpending > 0 ? (cat.amount / totalSpending) * 100 : 0;
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                {cat.name}
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(cat.amount)}</TableCell>
                            <TableCell>{cat.count}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={percent} className="w-16 h-2" />
                                <span className="text-sm">{percent.toFixed(1)}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="branches" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة الفروع</CardTitle>
                  <CardDescription>مقارنة الميزانية والتكلفة الفعلية بين الفروع</CardDescription>
                </CardHeader>
                <CardContent>
                  {branchComparisonData.some(b => b.projects > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend formatter={(value) => value === 'budget' ? 'الميزانية' : value === 'actualCost' ? 'التكلفة الفعلية' : value} />
                        <Bar dataKey="budget" fill="#3b82f6" name="budget" />
                        <Bar dataKey="actualCost" fill="#22c55e" name="actualCost" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      لا توجد بيانات
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>تقدم الفروع</CardTitle>
                  <CardDescription>متوسط نسبة التقدم لكل فرع</CardDescription>
                </CardHeader>
                <CardContent>
                  {branchComparisonData.some(b => b.projects > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value: number) => `${value}%`} />
                        <Bar dataKey="progress" name="نسبة التقدم">
                          {branchComparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      لا توجد بيانات
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>ملخص الفروع</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الفرع</TableHead>
                      <TableHead>عدد المشاريع</TableHead>
                      <TableHead>الميزانية</TableHead>
                      <TableHead>التكلفة الفعلية</TableHead>
                      <TableHead>الفارق</TableHead>
                      <TableHead>متوسط التقدم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchComparisonData.map((branch, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{branch.fullName}</TableCell>
                        <TableCell>{branch.projects}</TableCell>
                        <TableCell>{formatCurrency(branch.budget)}</TableCell>
                        <TableCell>{formatCurrency(branch.actualCost)}</TableCell>
                        <TableCell className={branch.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {branch.variance >= 0 ? '+' : ''}{formatCurrency(branch.variance)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={branch.progress} className="w-16 h-2" />
                            <span>{branch.progress}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>توزيع المشاريع حسب الحالة</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      لا توجد مشاريع
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    أكبر المشاريع قيد التنفيذ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topProjects.length > 0 ? (
                    <div className="space-y-4">
                      {topProjects.map((project) => (
                        <div key={project.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`project-card-${project.id}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium">{project.title}</h3>
                              <Badge variant="outline">{branchMap[project.branchId]}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              الميزانية: {formatCurrency(Number(project.budget) || 0)}
                            </p>
                            <div className="flex items-center gap-2">
                              <Progress value={project.progressPercent || 0} className="flex-1 h-2" />
                              <span className="text-sm font-medium">{project.progressPercent || 0}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد مشاريع قيد التنفيذ
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="print:block hidden">
          <div className="grid grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>ملخص المشاريع</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المشروع</TableHead>
                      <TableHead>الميزانية</TableHead>
                      <TableHead>التكلفة</TableHead>
                      <TableHead>التقدم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.title}</TableCell>
                        <TableCell>{formatCurrency(Number(p.budget) || 0)}</TableCell>
                        <TableCell>{formatCurrency(Number(p.actualCost) || 0)}</TableCell>
                        <TableCell>{p.progressPercent || 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
