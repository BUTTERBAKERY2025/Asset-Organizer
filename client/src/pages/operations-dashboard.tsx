import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Factory, Users, Clock, CheckCircle, AlertTriangle, TrendingUp, Calendar, 
  ClipboardCheck, Plus, Wallet, Package, BarChart3, Target, Gift, 
  ArrowUpRight, Zap, Activity, Boxes, RefreshCw, FileText
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface OperationsStats {
  productsCount: number;
  todayShifts: number;
  todayOrders: number;
  completedOrders: number;
  totalProduced: number;
  totalWasted: number;
  wastePercentage: string;
  qualityChecks: number;
  qualityPassRate: string;
}

export default function OperationsDashboardPage() {
  const { data: stats, isLoading, refetch } = useQuery<OperationsStats>({
    queryKey: ["/api/operations/stats"],
  });

  const completionRate = stats?.todayOrders 
    ? Math.round((stats.completedOrders / stats.todayOrders) * 100) 
    : 0;

  const operationsModules = [
    {
      title: "المنتجات",
      description: "إدارة كتالوج المنتجات والأسعار",
      href: "/products",
      icon: Package,
      color: "bg-blue-500",
      stats: `${stats?.productsCount || 0} منتج نشط`,
    },
    {
      title: "الورديات",
      description: "جدولة وإدارة ورديات العمل",
      href: "/shifts",
      icon: Clock,
      color: "bg-amber-500",
      stats: `${stats?.todayShifts || 0} وردية اليوم`,
    },
    {
      title: "أوامر الإنتاج",
      description: "متابعة أوامر الإنتاج اليومية",
      href: "/production",
      icon: ClipboardCheck,
      color: "bg-green-500",
      stats: `${stats?.completedOrders || 0}/${stats?.todayOrders || 0} مكتمل`,
    },
    {
      title: "مراقبة الجودة",
      description: "فحوصات الجودة والتقييم",
      href: "/quality-control",
      icon: CheckCircle,
      color: "bg-emerald-500",
      stats: `${stats?.qualityPassRate || 100}% معدل النجاح`,
    },
    {
      title: "موظفي التشغيل",
      description: "إدارة فريق العمل",
      href: "/operations-employees",
      icon: Users,
      color: "bg-purple-500",
      stats: "إدارة الموظفين",
    },
  ];

  const salesModules = [
    {
      title: "يومية الكاشير",
      description: "تسجيل ومتابعة المبيعات اليومية",
      href: "/cashier-journals",
      icon: Wallet,
      color: "bg-orange-500",
    },
    {
      title: "تحليلات المبيعات",
      description: "تحليل أداء المبيعات والفروع",
      href: "/sales-analytics",
      icon: BarChart3,
      color: "bg-indigo-500",
    },
    {
      title: "تخطيط الأهداف",
      description: "تحديد الأهداف الشهرية للفروع",
      href: "/targets-planning",
      icon: Target,
      color: "bg-rose-500",
    },
    {
      title: "لوحة الأهداف",
      description: "متابعة تحقيق الأهداف",
      href: "/targets-dashboard",
      icon: TrendingUp,
      color: "bg-cyan-500",
    },
    {
      title: "إدارة الحوافز",
      description: "نظام الحوافز والمكافآت",
      href: "/incentives-management",
      icon: Gift,
      color: "bg-pink-500",
    },
    {
      title: "تقارير التشغيل",
      description: "تقارير شاملة للعمليات",
      href: "/operations-reports",
      icon: FileText,
      color: "bg-slate-500",
    },
  ];

  const quickActions = [
    { label: "إضافة يومية كاشير", href: "/cashier-journals", icon: Plus, color: "text-orange-600" },
    { label: "إنشاء وردية جديدة", href: "/shifts", icon: Plus, color: "text-amber-600" },
    { label: "أمر إنتاج جديد", href: "/production", icon: Plus, color: "text-green-600" },
    { label: "إجراء فحص جودة", href: "/quality-control", icon: CheckCircle, color: "text-emerald-600" },
  ];

  const statCards = [
    {
      title: "إجمالي الإنتاج",
      value: stats?.totalProduced || 0,
      suffix: "وحدة",
      icon: Boxes,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      title: "نسبة الإنجاز",
      value: completionRate,
      suffix: "%",
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      showProgress: true,
    },
    {
      title: "نسبة الهالك",
      value: parseFloat(stats?.wastePercentage || "0"),
      suffix: "%",
      icon: AlertTriangle,
      color: parseFloat(stats?.wastePercentage || "0") > 5 ? "text-red-600" : "text-green-600",
      bgColor: parseFloat(stats?.wastePercentage || "0") > 5 ? "bg-red-50" : "bg-green-50",
      borderColor: parseFloat(stats?.wastePercentage || "0") > 5 ? "border-red-200" : "border-green-200",
    },
    {
      title: "فحوصات الجودة",
      value: stats?.qualityChecks || 0,
      suffix: "فحص",
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Factory className="w-4 h-4 text-primary" />
              </div>
              لوحة تحكم التشغيل
            </h1>
            <p className="text-muted-foreground mt-1">نظرة عامة شاملة على عمليات الإنتاج والتشغيل اليومية</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              تحديث
            </Button>
            <Badge variant="outline" className="text-sm py-1.5 px-3">
              <Calendar className="w-4 h-4 ml-2" />
              {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className={`${stat.bgColor} ${stat.borderColor} border`} data-testid={`stat-card-${index}`}>
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{stat.title}</span>
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
                      <span className="text-sm text-muted-foreground">{stat.suffix}</span>
                    </div>
                    {stat.showProgress && (
                      <Progress value={stat.value as number} className="h-2" />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <CardTitle className="text-lg">إجراءات سريعة</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href}>
                  <Button 
                    variant="outline" 
                    className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:bg-background/80 hover:border-primary/30 transition-all"
                    data-testid={`quick-action-${index}`}
                  >
                    <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center`}>
                      <action.icon className={`w-4 h-4 ${action.color}`} />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">أقسام التشغيل والإنتاج</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {operationsModules.map((module, index) => (
              <Link key={index} href={module.href}>
                <Card 
                  className="h-full cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
                  data-testid={`module-${module.href.replace('/', '')}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-lg ${module.color} flex items-center justify-center shadow-sm`}>
                        <module.icon className="w-5 h-5 text-white" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{module.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{module.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {module.stats}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">المبيعات والأهداف</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesModules.map((module, index) => (
              <Link key={index} href={module.href}>
                <Card 
                  className="h-full cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
                  data-testid={`sales-module-${module.href.replace('/', '')}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg ${module.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                        <module.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground">{module.title}</h3>
                          <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{module.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              ملخص اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">{stats?.todayShifts || 0}</div>
                <div className="text-xs text-muted-foreground">ورديات نشطة</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{stats?.completedOrders || 0}</div>
                <div className="text-xs text-muted-foreground">أوامر مكتملة</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">{stats?.totalProduced || 0}</div>
                <div className="text-xs text-muted-foreground">وحدات منتجة</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-emerald-600">{stats?.qualityPassRate || 100}%</div>
                <div className="text-xs text-muted-foreground">جودة الإنتاج</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
