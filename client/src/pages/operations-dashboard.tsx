import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Factory, Users, Clock, CheckCircle, AlertTriangle, TrendingUp, Calendar, 
  ClipboardCheck, Plus, Wallet, Package, BarChart3, Target, Gift, 
  ChevronLeft, Activity, Boxes, RefreshCw, FileText
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

  const operationsLinks = [
    { title: "المنتجات", description: "إدارة كتالوج المنتجات", href: "/products", icon: Package, count: stats?.productsCount || 0, countLabel: "منتج" },
    { title: "الورديات", description: "جدولة ورديات العمل", href: "/shifts", icon: Clock, count: stats?.todayShifts || 0, countLabel: "وردية" },
    { title: "أوامر الإنتاج", description: "متابعة أوامر الإنتاج", href: "/production", icon: ClipboardCheck, count: stats?.todayOrders || 0, countLabel: "أمر" },
    { title: "مراقبة الجودة", description: "فحوصات الجودة", href: "/quality-control", icon: CheckCircle, count: stats?.qualityChecks || 0, countLabel: "فحص" },
    { title: "بار العرض والهالك", description: "استلام الإنتاج ومتابعة الهالك", href: "/display-bar-waste", icon: AlertTriangle },
    { title: "موظفي التشغيل", description: "إدارة فريق العمل", href: "/operations-employees", icon: Users },
  ];

  const salesLinks = [
    { title: "يومية الكاشير", description: "تسجيل المبيعات اليومية", href: "/cashier-journals", icon: Wallet },
    { title: "تحليلات المبيعات", description: "تحليل أداء المبيعات", href: "/sales-analytics", icon: BarChart3 },
    { title: "تخطيط الأهداف", description: "تحديد الأهداف الشهرية", href: "/targets-planning", icon: Target },
    { title: "لوحة الأهداف", description: "متابعة تحقيق الأهداف", href: "/targets-dashboard", icon: TrendingUp },
    { title: "إدارة الحوافز", description: "نظام الحوافز والمكافآت", href: "/incentives-management", icon: Gift },
    { title: "تقارير التشغيل", description: "تقارير شاملة", href: "/operations-reports", icon: FileText },
  ];

  const quickActions = [
    { label: "يومية جديدة", href: "/cashier-journals", icon: Wallet },
    { label: "وردية جديدة", href: "/shifts", icon: Clock },
    { label: "أمر إنتاج", href: "/production", icon: ClipboardCheck },
    { label: "فحص جودة", href: "/quality-control", icon: CheckCircle },
  ];

  return (
    <Layout>
      <div className="space-y-5" dir="rtl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-foreground">لوحة تحكم التشغيل</h1>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 w-7 p-0">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">نظرة عامة على عمليات الإنتاج والتشغيل اليومية</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((action, i) => (
              <Link key={i} href={action.href}>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid={`quick-${i}`}>
                  <Plus className="w-3 h-3" />
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="p-3">
              {isLoading ? <Skeleton className="h-12" /> : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Boxes className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-700">{stats?.totalProduced || 0}</div>
                    <div className="text-[11px] text-blue-600/70">إنتاج اليوم</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="p-3">
              {isLoading ? <Skeleton className="h-12" /> : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-700">{completionRate}%</div>
                    <div className="text-[11px] text-green-600/70">نسبة الإنجاز</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`${parseFloat(stats?.wastePercentage || "0") > 5 ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
            <CardContent className="p-3">
              {isLoading ? <Skeleton className="h-12" /> : (
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                    <AlertTriangle className={`w-4 h-4 ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'text-red-600' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <div className={`text-xl font-bold ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'text-red-700' : 'text-emerald-700'}`}>{stats?.wastePercentage || 0}%</div>
                    <div className={`text-[11px] ${parseFloat(stats?.wastePercentage || "0") > 5 ? 'text-red-600/70' : 'text-emerald-600/70'}`}>نسبة الهالك</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-amber-50/50 border-amber-100">
            <CardContent className="p-3">
              {isLoading ? <Skeleton className="h-12" /> : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-amber-700">{stats?.todayShifts || 0}</div>
                    <div className="text-[11px] text-amber-600/70">ورديات اليوم</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-purple-50/50 border-purple-100">
            <CardContent className="p-3">
              {isLoading ? <Skeleton className="h-12" /> : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-purple-700">{stats?.qualityPassRate || 100}%</div>
                    <div className="text-[11px] text-purple-600/70">معدل الجودة</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">التشغيل والإنتاج</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="divide-y">
                {operationsLinks.map((link, i) => (
                  <Link key={i} href={link.href}>
                    <div className="flex items-center gap-3 p-2.5 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group" data-testid={`op-link-${i}`}>
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <link.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{link.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{link.description}</div>
                      </div>
                      {link.count !== undefined && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {link.count} {link.countLabel}
                        </Badge>
                      )}
                      <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">المبيعات والأهداف</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="divide-y">
                {salesLinks.map((link, i) => (
                  <Link key={i} href={link.href}>
                    <div className="flex items-center gap-3 p-2.5 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group" data-testid={`sales-link-${i}`}>
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <link.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{link.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{link.description}</div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">أوامر مكتملة: <span className="font-medium text-foreground">{stats?.completedOrders || 0}/{stats?.todayOrders || 0}</span></span>
                <span className="text-muted-foreground">فحوصات: <span className="font-medium text-foreground">{stats?.qualityChecks || 0}</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
