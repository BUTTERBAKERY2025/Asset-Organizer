import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Hammer, DollarSign, Clock, CheckCircle2, AlertTriangle, TrendingUp, Building2, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import type { Branch, ConstructionProject, Contractor } from "@shared/schema";

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

const CHART_COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function ConstructionDashboardPage() {
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

  const isLoading = branchesLoading || projectsLoading;

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const avgProgress = totalProjects > 0 
      ? Math.round(projects.reduce((sum, p) => sum + (p.progressPercent || 0), 0) / totalProjects)
      : 0;
    const activeProjects = projects.filter(p => p.status === "in_progress").length;
    const completedProjects = projects.filter(p => p.status === "completed").length;
    const delayedProjects = projects.filter(p => {
      if (!p.targetCompletionDate) return false;
      const target = new Date(p.targetCompletionDate);
      return target < new Date() && p.status !== "completed" && p.status !== "cancelled";
    }).length;

    return { totalProjects, totalBudget, avgProgress, activeProjects, completedProjects, delayedProjects };
  }, [projects]);

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

  const branchProjectsData = useMemo(() => {
    return branches.map(branch => {
      const branchProjects = projects.filter(p => p.branchId === branch.id);
      const totalBudget = branchProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const avgProgress = branchProjects.length > 0
        ? Math.round(branchProjects.reduce((sum, p) => sum + (p.progressPercent || 0), 0) / branchProjects.length)
        : 0;
      return {
        name: branch.name.replace("فرع ", ""),
        projects: branchProjects.length,
        budget: totalBudget,
        progress: avgProgress,
      };
    });
  }, [branches, projects]);

  const budgetByBranchData = useMemo(() => {
    return branches.map((branch, index) => {
      const branchProjects = projects.filter(p => p.branchId === branch.id);
      const totalBudget = branchProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      return {
        name: branch.name.replace("فرع ", ""),
        value: totalBudget,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    }).filter(d => d.value > 0);
  }, [branches, projects]);

  const topProjects = useMemo(() => {
    return [...projects]
      .filter(p => p.status === "in_progress")
      .sort((a, b) => (Number(b.budget) || 0) - (Number(a.budget) || 0))
      .slice(0, 5);
  }, [projects]);

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
      <div className="space-y-6" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">لوحة تحكم المشاريع الإنشائية</h1>
          <p className="text-muted-foreground">نظرة عامة على جميع المشاريع والإحصائيات</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-projects">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المشاريع</CardTitle>
              <Hammer className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeProjects} قيد التنفيذ • {stats.completedProjects} مكتمل
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-budget">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الميزانية</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBudget.toLocaleString()} ر.س</div>
              <p className="text-xs text-muted-foreground">ميزانية جميع المشاريع</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-progress">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">متوسط التقدم</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgProgress}%</div>
              <Progress value={stats.avgProgress} className="mt-2" />
            </CardContent>
          </Card>

          <Card data-testid="card-contractors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المقاولون</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contractors.length}</div>
              <p className="text-xs text-muted-foreground">مقاول مسجل</p>
            </CardContent>
          </Card>
        </div>

        {stats.delayedProjects > 0 && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800">
                يوجد {stats.delayedProjects} مشروع متأخر عن الموعد المحدد
              </span>
            </CardContent>
          </Card>
        )}

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
              <CardTitle>المشاريع حسب الفرع</CardTitle>
            </CardHeader>
            <CardContent>
              {branchProjectsData.some(d => d.projects > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={branchProjectsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === "projects") return [value, "المشاريع"];
                        if (name === "progress") return [`${value}%`, "التقدم"];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="projects" fill="#f59e0b" name="المشاريع" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  لا توجد مشاريع
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>توزيع الميزانية حسب الفرع</CardTitle>
            </CardHeader>
            <CardContent>
              {budgetByBranchData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={budgetByBranchData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                    >
                      {budgetByBranchData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toLocaleString()} ر.س`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  لا توجد ميزانيات
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>تقدم المشاريع حسب الفرع</CardTitle>
            </CardHeader>
            <CardContent>
              {branchProjectsData.some(d => d.projects > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={branchProjectsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="progress" fill="#22c55e" name="نسبة التقدم" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  لا توجد مشاريع
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                  <div key={project.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`project-card-${project.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{project.title}</h3>
                        <Badge variant="outline">{branchMap[project.branchId]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        الميزانية: {Number(project.budget || 0).toLocaleString()} ر.س
                      </p>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progressPercent || 0} className="flex-1" />
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
    </Layout>
  );
}
