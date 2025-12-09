import { useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, Building2, AlertTriangle, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { Branch, InventoryItem } from "@shared/schema";

const COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function DashboardPage() {
  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const stats = useMemo(() => {
    const totalItems = inventoryItems.length;
    const totalValue = inventoryItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    const needsAttention = inventoryItems.filter(item => 
      item.status === "maintenance" || item.status === "damaged" || item.status === "missing"
    ).length;

    return { totalItems, totalValue, needsAttention, totalBranches: branches.length };
  }, [inventoryItems, branches]);

  const branchComparisonData = useMemo(() => {
    return branches.map(branch => {
      const branchItems = inventoryItems.filter(item => item.branchId === branch.id);
      const totalValue = branchItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
      return {
        name: branch.name,
        items: branchItems.length,
        value: totalValue,
      };
    });
  }, [branches, inventoryItems]);

  const categoryData = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    inventoryItems.forEach(item => {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    });
    return Object.entries(categoryCount).map(([name, value]) => ({ name, value }));
  }, [inventoryItems]);

  const statusData = useMemo(() => {
    const statusLabels: Record<string, string> = {
      good: "جيد",
      maintenance: "صيانة",
      damaged: "تالف",
      missing: "مفقود",
    };
    const statusCount: Record<string, number> = {};
    inventoryItems.forEach(item => {
      const status = item.status || "good";
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([status, value]) => ({
      name: statusLabels[status] || status,
      value,
    }));
  }, [inventoryItems]);

  const isLoading = branchesLoading || inventoryLoading;

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
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-dashboard-title">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">ملخص شامل لأصول جميع الفروع</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-items">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الأصناف</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalItems}</div>
              <p className="text-xs text-muted-foreground">صنف في جميع الفروع</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-value">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي القيمة</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalValue.toLocaleString('ar-SA')} ريال</div>
              <p className="text-xs text-muted-foreground">القيمة الإجمالية للأصول</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-branches">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">عدد الفروع</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBranches}</div>
              <p className="text-xs text-muted-foreground">فرع مسجل في النظام</p>
            </CardContent>
          </Card>

          <Card data-testid="card-needs-attention">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">تحتاج متابعة</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.needsAttention}</div>
              <p className="text-xs text-muted-foreground">صنف يحتاج صيانة/تالف/مفقود</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="chart-branch-comparison">
            <CardHeader>
              <CardTitle>مقارنة الفروع - عدد الأصناف</CardTitle>
              <CardDescription>عدد الأصناف في كل فرع</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [value, "عدد الأصناف"]}
                      contentStyle={{ direction: "rtl" }}
                    />
                    <Bar dataKey="items" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-branch-value">
            <CardHeader>
              <CardTitle>مقارنة الفروع - القيمة</CardTitle>
              <CardDescription>إجمالي قيمة الأصول في كل فرع (ريال)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString() + " ريال", "القيمة"]}
                      contentStyle={{ direction: "rtl" }}
                    />
                    <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="chart-category-distribution">
            <CardHeader>
              <CardTitle>توزيع الفئات</CardTitle>
              <CardDescription>توزيع الأصناف حسب الفئة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "الكمية"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-status-distribution">
            <CardHeader>
              <CardTitle>حالة الأصول</CardTitle>
              <CardDescription>توزيع الأصناف حسب الحالة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#6b7280" />
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "عدد"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
