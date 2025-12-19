import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Factory, Users, Clock, CheckCircle, AlertTriangle, TrendingUp, Calendar, ClipboardCheck, Plus } from "lucide-react";
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
  const { data: stats, isLoading } = useQuery<OperationsStats>({
    queryKey: ["/api/operations/stats"],
  });

  const statCards = [
    {
      title: "المنتجات النشطة",
      value: stats?.productsCount || 0,
      icon: Factory,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "ورديات اليوم",
      value: stats?.todayShifts || 0,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "أوامر الإنتاج",
      value: `${stats?.completedOrders || 0}/${stats?.todayOrders || 0}`,
      icon: ClipboardCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
      subtitle: "مكتمل/إجمالي",
    },
    {
      title: "إجمالي الإنتاج",
      value: stats?.totalProduced || 0,
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      subtitle: "وحدة اليوم",
    },
    {
      title: "نسبة الهالك",
      value: `${stats?.wastePercentage || 0}%`,
      icon: AlertTriangle,
      color: parseFloat(stats?.wastePercentage || "0") > 5 ? "text-red-600" : "text-green-600",
      bgColor: parseFloat(stats?.wastePercentage || "0") > 5 ? "bg-red-100" : "bg-green-100",
    },
    {
      title: "معدل الجودة",
      value: `${stats?.qualityPassRate || 100}%`,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      subtitle: `${stats?.qualityChecks || 0} فحص`,
    },
  ];

  const quickActions = [
    { label: "إنشاء وردية", href: "/shifts", icon: Plus },
    { label: "أمر إنتاج جديد", href: "/production", icon: Plus },
    { label: "فحص جودة", href: "/quality-control", icon: ClipboardCheck },
    { label: "إدارة المنتجات", href: "/products", icon: Factory },
  ];

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">لوحة تحكم التشغيل</h1>
            <p className="text-muted-foreground">نظرة عامة على عمليات الإنتاج والتشغيل اليومية</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Calendar className="w-3 h-3 ml-1" />
              {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} data-testid={`stat-card-${index}`}>
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bgColor}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.title}</div>
                    {stat.subtitle && (
                      <div className="text-xs text-muted-foreground/70">{stat.subtitle}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">إجراءات سريعة</CardTitle>
              <CardDescription>الوصول السريع للمهام الشائعة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href}>
                  <Button variant="outline" className="w-full justify-start gap-2" data-testid={`quick-action-${index}`}>
                    <action.icon className="w-4 h-4" />
                    {action.label}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">أقسام التشغيل</CardTitle>
              <CardDescription>الوصول لجميع أقسام نظام التشغيل</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Link href="/products">
                <Card className="cursor-pointer hover:bg-secondary/50 transition-colors" data-testid="link-products">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <Factory className="w-8 h-8 text-blue-500" />
                    <span className="text-sm font-medium">المنتجات</span>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/shifts">
                <Card className="cursor-pointer hover:bg-secondary/50 transition-colors" data-testid="link-shifts">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <Clock className="w-8 h-8 text-amber-500" />
                    <span className="text-sm font-medium">الورديات</span>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/production">
                <Card className="cursor-pointer hover:bg-secondary/50 transition-colors" data-testid="link-production">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <ClipboardCheck className="w-8 h-8 text-green-500" />
                    <span className="text-sm font-medium">الإنتاج</span>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/quality-control">
                <Card className="cursor-pointer hover:bg-secondary/50 transition-colors" data-testid="link-quality">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                    <span className="text-sm font-medium">الجودة</span>
                  </CardContent>
                </Card>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
