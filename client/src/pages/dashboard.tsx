import { useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, Building2, AlertTriangle, DollarSign, Factory, Warehouse, CreditCard, Users, Shield, ClipboardList, BarChart3, Settings, FileText, Truck, Calendar, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useBranches } from "@/hooks/useBranches";
import { useLocation } from "wouter";
import type { InventoryItem } from "@shared/schema";

const systemModules = [
  { id: "production", name: "الإنتاج", icon: Factory, color: "#f59e0b", path: "/production-orders" },
  { id: "inventory", name: "المخزون", icon: Package, color: "#3b82f6", path: "/inventory" },
  { id: "cashier", name: "الكاشير", icon: CreditCard, color: "#22c55e", path: "/cashier-journals" },
  { id: "warehouse", name: "المخازن", icon: Warehouse, color: "#f97316", path: "/warehouse" },
  { id: "employees", name: "الموظفين", icon: Users, color: "#8b5cf6", path: "/branch-employees" },
  { id: "governance", name: "الحوكمة", icon: Shield, color: "#1e40af", path: "/governance" },
  { id: "executive", name: "السكرتارية", icon: ClipboardList, color: "#ec4899", path: "/executive" },
  { id: "reports", name: "التقارير", icon: BarChart3, color: "#ef4444", path: "/reports" },
  { id: "documents", name: "الوثائق", icon: FileText, color: "#06b6d4", path: "/documents" },
  { id: "transfers", name: "التحويلات", icon: Truck, color: "#84cc16", path: "/asset-transfers" },
  { id: "attendance", name: "الحضور", icon: Calendar, color: "#a855f7", path: "/attendance" },
  { id: "analytics", name: "التحليلات", icon: TrendingUp, color: "#14b8a6", path: "/command-center" },
];

const COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { branches, isLoading: branchesLoading } = useBranches();

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: (prev) => prev,
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
      <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-6" dir="rtl">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-dashboard-title">لوحة التحكم الرئيسية</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">نظام إدارة مخبز باتر - CEO Command</p>
        </div>

        {/* أقسام النظام - تصميم محسّن */}
        <div className="bg-gray-50 rounded-2xl p-3 sm:p-4 md:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">أقسام النظام</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {systemModules.map((module) => {
              const IconComponent = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => setLocation(module.path)}
                  className="group bg-white rounded-xl overflow-hidden flex flex-col items-center justify-center gap-2 sm:gap-3 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
                  style={{ 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    minHeight: '110px'
                  }}
                  data-testid={`module-card-${module.id}`}
                >
                  {/* شريط ملون علوي */}
                  <div 
                    className="w-full h-1.5 transition-all duration-300 group-hover:h-2"
                    style={{ backgroundColor: module.color }}
                  />
                  
                  {/* محتوى الكارت */}
                  <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 pt-1">
                    {/* خلفية متدرجة للأيقونة */}
                    <div 
                      className="p-2.5 sm:p-3 rounded-xl transition-all duration-300 group-hover:scale-110"
                      style={{ 
                        background: `linear-gradient(135deg, ${module.color}15 0%, ${module.color}25 100%)`,
                      }}
                    >
                      <IconComponent 
                        className="w-7 h-7 sm:w-9 sm:h-9" 
                        style={{ color: module.color }}
                        strokeWidth={1.5}
                      />
                    </div>
                    <span className="text-sm sm:text-base font-semibold text-gray-700 text-center group-hover:text-gray-900 transition-colors">
                      {module.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">إحصائيات الأصول</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card data-testid="card-total-items">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">إجمالي الأصناف</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-lg sm:text-xl md:text-2xl font-bold">{stats.totalItems}</div>
              <p className="text-xs text-muted-foreground">صنف في جميع الفروع</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-value">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">إجمالي القيمة</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-lg sm:text-xl md:text-2xl font-bold">{stats.totalValue.toLocaleString('en-US')} ريال</div>
              <p className="text-xs text-muted-foreground">القيمة الإجمالية للأصول</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-branches">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">عدد الفروع</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-lg sm:text-xl md:text-2xl font-bold">{stats.totalBranches}</div>
              <p className="text-xs text-muted-foreground">فرع مسجل في النظام</p>
            </CardContent>
          </Card>

          <Card data-testid="card-needs-attention">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">تحتاج متابعة</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-orange-500">{stats.needsAttention}</div>
              <p className="text-xs text-muted-foreground">صنف يحتاج صيانة/تالف/مفقود</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <Card data-testid="chart-branch-comparison">
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">مقارنة الفروع - عدد الأصناف</CardTitle>
              <CardDescription className="text-xs sm:text-sm">عدد الأصناف في كل فرع</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="h-[200px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} className="hidden sm:block" />
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
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">مقارنة الفروع - القيمة</CardTitle>
              <CardDescription className="text-xs sm:text-sm">إجمالي قيمة الأصول في كل فرع (ريال)</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="h-[200px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => value.toLocaleString('en-US')} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} className="hidden sm:block" />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString('en-US') + " ريال", "القيمة"]}
                      contentStyle={{ direction: "rtl" }}
                    />
                    <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <Card data-testid="chart-category-distribution">
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">توزيع الفئات</CardTitle>
              <CardDescription className="text-xs sm:text-sm">توزيع الأصناف حسب الفئة</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="h-[200px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={70}
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
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">حالة الأصول</CardTitle>
              <CardDescription className="text-xs sm:text-sm">توزيع الأصناف حسب الحالة</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="h-[200px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={70}
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
