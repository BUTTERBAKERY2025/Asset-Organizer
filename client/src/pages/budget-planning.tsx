import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, 
  Loader2, Building2, PieChart, BarChart3, Save, Plus
} from "lucide-react";
import { Link } from "wouter";
import type { 
  ConstructionProject, 
  ConstructionCategory, 
  ProjectBudgetAllocation,
  PaymentRequest,
  ProjectWorkItem,
  Branch
} from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from "recharts";

export default function BudgetPlanningPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<number, number>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee } = useAuth();
  const canEdit = isAdmin || isEmployee;

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ConstructionProject[]>({
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

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: paymentRequests = [] } = useQuery<PaymentRequest[]>({
    queryKey: ["/api/payment-requests"],
    queryFn: async () => {
      const res = await fetch("/api/payment-requests");
      if (!res.ok) throw new Error("Failed to fetch payment requests");
      return res.json();
    },
  });

  const { data: allWorkItems = [] } = useQuery<ProjectWorkItem[]>({
    queryKey: ["/api/construction/work-items"],
    queryFn: async () => {
      const res = await fetch("/api/construction/work-items");
      if (!res.ok) throw new Error("Failed to fetch work items");
      return res.json();
    },
  });

  const { data: budgetAllocations = [], isLoading: allocationsLoading } = useQuery<ProjectBudgetAllocation[]>({
    queryKey: ["/api/construction/projects", selectedProjectId, "budget-allocations"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/construction/projects/${selectedProjectId}/budget-allocations`);
      if (!res.ok) throw new Error("Failed to fetch budget allocations");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: { projectId: number; categoryId: number; plannedAmount: number }) => {
      const res = await fetch("/api/construction/budget-allocations/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save budget allocation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", selectedProjectId, "budget-allocations"] });
    },
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || branchId;
  };

  const getCategoryName = (categoryId: number) => {
    return categories.find(c => c.id === categoryId)?.name || "-";
  };

  const getProjectWorkItems = (projectId: number) => {
    return allWorkItems.filter(w => w.projectId === projectId);
  };

  const getProjectActualCostFromWorkItems = (projectId: number) => {
    return getProjectWorkItems(projectId).reduce((sum, w) => sum + (Number(w.actualCost) || 0), 0);
  };

  const getProjectPayments = (projectId: number) => {
    return paymentRequests.filter(p => p.projectId === projectId && p.status === "paid");
  };

  const getProjectPaidAmount = (projectId: number) => {
    return getProjectPayments(projectId).reduce((sum, p) => sum + p.amount, 0);
  };

  const getCategoryActualCostFromWorkItems = (projectId: number, categoryId: number) => {
    return allWorkItems
      .filter(w => w.projectId === projectId && w.categoryId === categoryId)
      .reduce((sum, w) => sum + (Number(w.actualCost) || 0), 0);
  };

  const getCategoryActualCost = (projectId: number, categoryId: number) => {
    const fromWorkItems = getCategoryActualCostFromWorkItems(projectId, categoryId);
    const fromPayments = paymentRequests
      .filter(p => p.projectId === projectId && p.categoryId === categoryId && p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(fromWorkItems, fromPayments);
  };

  const getAllocationForCategory = (categoryId: number) => {
    return budgetAllocations.find(a => a.categoryId === categoryId);
  };

  const handleSaveBudgetAllocations = async () => {
    if (!selectedProjectId) return;
    
    try {
      for (const [categoryId, amount] of Object.entries(budgetInputs)) {
        await upsertMutation.mutateAsync({
          projectId: selectedProjectId,
          categoryId: parseInt(categoryId),
          plannedAmount: amount,
        });
      }
      toast({ title: "تم حفظ توزيع الميزانية بنجاح" });
      setIsEditingBudget(false);
      setBudgetInputs({});
    } catch (error) {
      toast({ title: "فشل في حفظ توزيع الميزانية", variant: "destructive" });
    }
  };

  const startEditingBudget = () => {
    const inputs: Record<number, number> = {};
    budgetAllocations.forEach(a => {
      if (a.categoryId) {
        inputs[a.categoryId] = a.plannedAmount;
      }
    });
    setBudgetInputs(inputs);
    setIsEditingBudget(true);
  };

  const totalPlannedBudget = budgetAllocations.reduce((sum, a) => sum + a.plannedAmount, 0);
  const totalActualFromWorkItems = selectedProjectId ? getProjectActualCostFromWorkItems(selectedProjectId) : 0;
  const totalActualFromPayments = selectedProjectId ? getProjectPaidAmount(selectedProjectId) : 0;
  const totalActualCost = selectedProjectId 
    ? Math.max(selectedProject?.actualCost || 0, totalActualFromWorkItems)
    : 0;
  const budgetVariance = totalPlannedBudget - totalActualCost;
  const variancePercentage = totalPlannedBudget > 0 ? ((budgetVariance / totalPlannedBudget) * 100) : 0;

  const projectsSummary = projects.map(project => {
    const workItemsCost = getProjectActualCostFromWorkItems(project.id);
    const paidAmount = getProjectPaidAmount(project.id);
    const budget = project.budget || 0;
    const actualCost = Math.max(project.actualCost || 0, workItemsCost);
    const variance = budget - actualCost;
    const variancePercent = budget > 0 ? ((variance / budget) * 100) : 0;
    
    return {
      ...project,
      workItemsCost,
      paidAmount,
      actualCost,
      variance,
      variancePercent,
      branchName: getBranchName(project.branchId),
    };
  });

  const categoryVarianceData = categories.map(cat => {
    const allocation = getAllocationForCategory(cat.id);
    const planned = allocation?.plannedAmount || 0;
    const actualFromWorkItems = selectedProjectId ? getCategoryActualCostFromWorkItems(selectedProjectId, cat.id) : 0;
    const actual = actualFromWorkItems;
    const variance = planned - actual;
    
    return {
      name: cat.name,
      categoryId: cat.id,
      مخطط: planned,
      فعلي: actual,
      variance,
      variancePercent: planned > 0 ? ((variance / planned) * 100) : 0,
    };
  }).filter(d => d.مخطط > 0 || d.فعلي > 0);

  const pieChartData = categoryVarianceData.map(d => ({
    name: d.name,
    value: d.مخطط,
  }));

  const COLORS = ['#d4a853', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  if (projectsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-butter-gold" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تخطيط الميزانية وتحليل الفروقات</h1>
            <p className="text-gray-600 mt-1">توزيع الميزانية على التصنيفات ومقارنة التكلفة الفعلية بالمخططة</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="project-budget">ميزانية المشروع</TabsTrigger>
            <TabsTrigger value="variance">تحليل الفروقات</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الميزانيات</CardTitle>
                  <DollarSign className="h-4 w-4 text-butter-gold" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {projects.reduce((sum, p) => sum + (p.budget || 0), 0).toLocaleString()} ر.س
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    لجميع المشاريع
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي التكاليف الفعلية</CardTitle>
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {projects.reduce((sum, p) => sum + (p.actualCost || 0), 0).toLocaleString()} ر.س
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    المصروف حتى الآن
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الفروقات</CardTitle>
                  {projects.reduce((sum, p) => sum + ((p.budget || 0) - (p.actualCost || 0)), 0) >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    projects.reduce((sum, p) => sum + ((p.budget || 0) - (p.actualCost || 0)), 0) >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {projects.reduce((sum, p) => sum + ((p.budget || 0) - (p.actualCost || 0)), 0).toLocaleString()} ر.س
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {projects.reduce((sum, p) => sum + ((p.budget || 0) - (p.actualCost || 0)), 0) >= 0 ? 'وفر في الميزانية' : 'تجاوز في الميزانية'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>ملخص المشاريع</CardTitle>
                <CardDescription>مقارنة الميزانية والتكلفة الفعلية لكل مشروع</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المشروع</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">الميزانية</TableHead>
                        <TableHead className="text-right">التكلفة الفعلية</TableHead>
                        <TableHead className="text-right">الفرق</TableHead>
                        <TableHead className="text-right">نسبة الانحراف</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectsSummary.map((project) => (
                        <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                          <TableCell>
                            <Link href={`/construction-projects/${project.id}`}>
                              <span className="text-blue-600 hover:underline cursor-pointer font-medium">
                                {project.title}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>{project.branchName}</TableCell>
                          <TableCell className="font-medium">
                            {(project.budget || 0).toLocaleString()} ر.س
                          </TableCell>
                          <TableCell className="font-medium">
                            {(project.actualCost || 0).toLocaleString()} ر.س
                          </TableCell>
                          <TableCell className={project.variance >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {project.variance >= 0 ? '+' : ''}{project.variance.toLocaleString()} ر.س
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              project.variancePercent >= 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }>
                              {project.variancePercent >= 0 ? '+' : ''}{project.variancePercent.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {project.variance >= 0 ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-sm">ضمن الميزانية</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-sm">تجاوز</span>
                              </div>
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

          <TabsContent value="project-budget">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>اختر المشروع</CardTitle>
                <CardDescription>حدد المشروع لعرض وتعديل توزيع الميزانية</CardDescription>
              </CardHeader>
              <CardContent>
                <Select 
                  value={selectedProjectId?.toString() || ""} 
                  onValueChange={(val) => setSelectedProjectId(parseInt(val))}
                >
                  <SelectTrigger className="w-full md:w-[400px]" data-testid="select-project">
                    <SelectValue placeholder="اختر مشروع..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title} - {getBranchName(project.branchId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedProject && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-gray-500">ميزانية المشروع</div>
                      <div className="text-xl font-bold">{(selectedProject.budget || 0).toLocaleString()} ر.س</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-gray-500">المخصص للتصنيفات</div>
                      <div className="text-xl font-bold">{totalPlannedBudget.toLocaleString()} ر.س</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-gray-500">التكلفة الفعلية</div>
                      <div className="text-xl font-bold">{totalActualCost.toLocaleString()} ر.س</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-gray-500">الفرق</div>
                      <div className={`text-xl font-bold ${budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {budgetVariance >= 0 ? '+' : ''}{budgetVariance.toLocaleString()} ر.س
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>توزيع الميزانية على التصنيفات</CardTitle>
                      <CardDescription>حدد المبلغ المخصص لكل تصنيف من أعمال البناء</CardDescription>
                    </div>
                    {canEdit && !isEditingBudget && (
                      <Button onClick={startEditingBudget} data-testid="button-edit-budget">
                        <Pencil className="ml-2 h-4 w-4" />
                        تعديل التوزيع
                      </Button>
                    )}
                    {isEditingBudget && (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditingBudget(false)}>
                          إلغاء
                        </Button>
                        <Button onClick={handleSaveBudgetAllocations} disabled={upsertMutation.isPending}>
                          {upsertMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                          حفظ
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {allocationsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-butter-gold" />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">التصنيف</TableHead>
                              <TableHead className="text-right">المبلغ المخطط</TableHead>
                              <TableHead className="text-right">المصروف الفعلي</TableHead>
                              <TableHead className="text-right">الفرق</TableHead>
                              <TableHead className="text-right">نسبة الاستهلاك</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categories.map((category) => {
                              const allocation = getAllocationForCategory(category.id);
                              const planned = isEditingBudget 
                                ? (budgetInputs[category.id] || allocation?.plannedAmount || 0)
                                : (allocation?.plannedAmount || 0);
                              const actual = getCategoryActualCost(selectedProjectId!, category.id);
                              const variance = planned - actual;
                              const consumptionPercent = planned > 0 ? (actual / planned) * 100 : 0;

                              return (
                                <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                                  <TableCell className="font-medium">{category.name}</TableCell>
                                  <TableCell>
                                    {isEditingBudget ? (
                                      <Input
                                        type="number"
                                        value={budgetInputs[category.id] || allocation?.plannedAmount || 0}
                                        onChange={(e) => setBudgetInputs({
                                          ...budgetInputs,
                                          [category.id]: parseFloat(e.target.value) || 0
                                        })}
                                        className="w-32"
                                        data-testid={`input-budget-${category.id}`}
                                      />
                                    ) : (
                                      <span>{planned.toLocaleString()} ر.س</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{actual.toLocaleString()} ر.س</TableCell>
                                  <TableCell className={variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {variance >= 0 ? '+' : ''}{variance.toLocaleString()} ر.س
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Progress 
                                        value={Math.min(consumptionPercent, 100)} 
                                        className="w-20 h-2"
                                      />
                                      <span className={consumptionPercent > 100 ? 'text-red-600' : ''}>
                                        {consumptionPercent.toFixed(0)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="variance">
            {!selectedProjectId ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>اختر مشروعاً من تبويب "ميزانية المشروع" لعرض تحليل الفروقات</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>مقارنة المخطط بالفعلي</CardTitle>
                      <CardDescription>حسب التصنيف</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {categoryVarianceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={categoryVarianceData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                            <YAxis dataKey="name" type="category" width={80} />
                            <Tooltip 
                              formatter={(value: number) => `${value.toLocaleString()} ر.س`}
                              labelStyle={{ textAlign: 'right' }}
                            />
                            <Legend />
                            <Bar dataKey="مخطط" fill="#d4a853" />
                            <Bar dataKey="فعلي" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          لا توجد بيانات ميزانية لهذا المشروع
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>توزيع الميزانية المخططة</CardTitle>
                      <CardDescription>نسبة كل تصنيف من الميزانية</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {pieChartData.length > 0 && pieChartData.some(d => d.value > 0) ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${value.toLocaleString()} ر.س`} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          لا توجد بيانات ميزانية لهذا المشروع
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>تقرير الانحرافات</CardTitle>
                    <CardDescription>تفاصيل الفروقات بين المخطط والفعلي</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">التصنيف</TableHead>
                            <TableHead className="text-right">المخطط</TableHead>
                            <TableHead className="text-right">الفعلي</TableHead>
                            <TableHead className="text-right">الفرق</TableHead>
                            <TableHead className="text-right">نسبة الانحراف</TableHead>
                            <TableHead className="text-right">التقييم</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryVarianceData.length > 0 ? (
                            categoryVarianceData.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>{item.مخطط.toLocaleString()} ر.س</TableCell>
                                <TableCell>{item.فعلي.toLocaleString()} ر.س</TableCell>
                                <TableCell className={item.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {item.variance >= 0 ? '+' : ''}{item.variance.toLocaleString()} ر.س
                                </TableCell>
                                <TableCell>
                                  <Badge className={
                                    item.variancePercent >= 0 
                                      ? 'bg-green-100 text-green-800' 
                                      : Math.abs(item.variancePercent) <= 10
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                  }>
                                    {item.variancePercent >= 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {item.variance >= 0 ? (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <CheckCircle2 className="h-4 w-4" />
                                      <span>ممتاز</span>
                                    </div>
                                  ) : Math.abs(item.variancePercent) <= 10 ? (
                                    <div className="flex items-center gap-1 text-yellow-600">
                                      <AlertTriangle className="h-4 w-4" />
                                      <span>مقبول</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-red-600">
                                      <AlertTriangle className="h-4 w-4" />
                                      <span>تجاوز كبير</span>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                لا توجد بيانات ميزانية لهذا المشروع. قم بتوزيع الميزانية على التصنيفات أولاً.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

const Pencil = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>
);
