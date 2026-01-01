import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Factory, 
  FileSpreadsheet, 
  ClipboardList, 
  BarChart3, 
  TrendingUp, 
  Upload, 
  Plus, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  Package,
  Target,
  Zap,
  Brain,
  RefreshCw
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface OrderStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  daily: number;
  weekly: number;
  longTerm: number;
  totalEstimatedCost: number;
}

interface SalesUpload {
  id: number;
  fileName: string;
  uploadDate: string;
  branchId: string;
  status: string;
}

const QUICK_ACTIONS = [
  {
    title: "مخطط الإنتاج الذكي",
    description: "تخطيط الإنتاج بناءً على البيانات والتوقعات",
    icon: Brain,
    href: "/ai-production-planner",
    color: "from-purple-500 to-indigo-600",
    badge: "ذكاء اصطناعي"
  },
  {
    title: "رفع بيانات المبيعات",
    description: "استيراد بيانات المبيعات من ملفات Excel",
    icon: Upload,
    href: "/sales-data-uploads",
    color: "from-blue-500 to-cyan-600",
    badge: null
  },
  {
    title: "أوامر الإنتاج",
    description: "إدارة ومتابعة جميع أوامر الإنتاج",
    icon: ClipboardList,
    href: "/advanced-production-orders",
    color: "from-amber-500 to-orange-600",
    badge: null
  },
  {
    title: "إنشاء أمر إنتاج جديد",
    description: "إنشاء أمر إنتاج يدوي أو من توقعات",
    icon: Plus,
    href: "/advanced-production-orders/new",
    color: "from-green-500 to-emerald-600",
    badge: null
  },
  {
    title: "تقارير التشغيل",
    description: "عرض التقارير والتحليلات",
    icon: BarChart3,
    href: "/operations-reports",
    color: "from-rose-500 to-pink-600",
    badge: null
  },
  {
    title: "المنتجات",
    description: "إدارة كتالوج المنتجات والأسعار",
    icon: Package,
    href: "/products",
    color: "from-teal-500 to-green-600",
    badge: null
  }
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  in_progress: "bg-purple-100 text-purple-800 border-purple-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300"
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد الانتظار",
  approved: "معتمد",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي"
};

export default function ProductionDashboardPage() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<OrderStats>({
    queryKey: ["/api/advanced-production-orders/stats"],
  });

  const { data: recentUploads, isLoading: uploadsLoading } = useQuery<SalesUpload[]>({
    queryKey: ["/api/sales-data-uploads?limit=5"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount || 0);
  };

  const completionRate = stats ? 
    Math.round((stats.completed / Math.max(stats.total, 1)) * 100) : 0;

  const activeOrders = stats ? stats.pending + stats.approved + stats.inProgress : 0;

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3" data-testid="page-title">
              <Factory className="h-8 w-8 text-amber-600" />
              لوحة الإنتاج
            </h1>
            <p className="text-gray-600 mt-1">مركز التحكم الشامل لإدارة الإنتاج والتوقعات</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchStats()} data-testid="btn-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Link href="/advanced-production-orders/new">
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700" data-testid="btn-new-order">
                <Plus className="h-4 w-4 ml-2" />
                أمر إنتاج جديد
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-r-4 border-r-blue-500 bg-gradient-to-br from-blue-50 to-white" data-testid="card-total-orders">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">إجمالي الأوامر</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-700">{stats?.total || 0}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-amber-500 bg-gradient-to-br from-amber-50 to-white" data-testid="card-active-orders">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">أوامر نشطة</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-amber-700">{activeOrders}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-green-500 bg-gradient-to-br from-green-50 to-white" data-testid="card-completed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">مكتملة</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-green-700">{stats?.completed || 0}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-purple-500 bg-gradient-to-br from-purple-50 to-white" data-testid="card-estimated-cost">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">التكلفة المتوقعة</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-purple-700">{formatCurrency(stats?.totalEstimatedCost || 0)}</p>
                  )}
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card data-testid="card-quick-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  الوصول السريع
                </CardTitle>
                <CardDescription>اختصارات لجميع وظائف الإنتاج</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {QUICK_ACTIONS.map((action, index) => (
                    <Link key={index} href={action.href}>
                      <Card 
                        className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 overflow-hidden group"
                        data-testid={`quick-action-${index}`}
                      >
                        <div className={`h-2 bg-gradient-to-r ${action.color}`} />
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`h-10 w-10 rounded-lg bg-gradient-to-r ${action.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                              <action.icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{action.title}</h3>
                                {action.badge && (
                                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                    {action.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{action.description}</p>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card data-testid="card-order-status">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-amber-500" />
                  حالة الأوامر
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-gray-400" />
                        <span className="text-sm">مسودة</span>
                      </div>
                      <Badge variant="secondary">{stats?.draft || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                        <span className="text-sm">قيد الانتظار</span>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">{stats?.pending || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-sm">معتمد</span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">{stats?.approved || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-purple-500" />
                        <span className="text-sm">قيد التنفيذ</span>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800">{stats?.inProgress || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-green-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="text-sm">مكتمل</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{stats?.completed || 0}</Badge>
                    </div>
                  </>
                )}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">نسبة الإنجاز</span>
                    <span className="text-sm font-medium">{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-order-types">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  أنواع الأوامر
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                      <span className="text-sm">يومي</span>
                      <Badge className="bg-amber-100 text-amber-800">{stats?.daily || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50">
                      <span className="text-sm">أسبوعي</span>
                      <Badge className="bg-indigo-100 text-indigo-800">{stats?.weekly || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-teal-50">
                      <span className="text-sm">طويل الأمد</span>
                      <Badge className="bg-teal-100 text-teal-800">{stats?.longTerm || 0}</Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card data-testid="card-recent-uploads">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                  آخر عمليات رفع البيانات
                </CardTitle>
                <CardDescription>أحدث ملفات المبيعات المرفوعة</CardDescription>
              </div>
              <Link href="/sales-data-uploads">
                <Button variant="outline" size="sm" data-testid="btn-view-all-uploads">
                  عرض الكل
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {uploadsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentUploads && recentUploads.length > 0 ? (
              <div className="space-y-2">
                {recentUploads.slice(0, 5).map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{upload.fileName}</p>
                        <p className="text-xs text-gray-500">{upload.branchId}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <Badge variant={upload.status === "processed" ? "default" : "secondary"}>
                        {upload.status === "processed" ? "تمت المعالجة" : upload.status}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {upload.createdAt ? format(new Date(upload.createdAt), "dd MMM yyyy", { locale: ar }) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Upload className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>لا توجد عمليات رفع حديثة</p>
                <Link href="/sales-data-uploads">
                  <Button variant="link" className="mt-2">رفع بيانات جديدة</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
