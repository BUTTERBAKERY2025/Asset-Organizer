import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import {
  Calendar,
  Clock,
  Users,
  FileText,
  ClipboardCheck,
  CalendarDays,
  UserCheck,
  Timer,
  BarChart3,
  ChevronLeft,
  Fingerprint,
  FileSignature,
  CalendarClock,
  ListChecks,
  Loader2,
} from "lucide-react";

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  badge?: string;
}

export default function AttendanceDashboardPage() {
  const [, navigate] = useLocation();

  const { data: stats, isLoading, error } = useQuery<{
    totalEmployees: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    templatesCount: number;
    schedulesCount: number;
    reportsCount: number;
    attendanceRate: number;
  } | null>({
    queryKey: ["/api/attendance-dashboard-stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0,
    refetchOnMount: true,
  });
  
  console.log("Stats data:", stats, "Loading:", isLoading, "Error:", error);

  const quickActions: QuickAction[] = [
    {
      title: "تسجيل الحضور والانصراف",
      description: "تسجيل حضور وانصراف الموظفين مع التوقيع الإلكتروني",
      icon: <Fingerprint className="w-6 h-6" />,
      href: "/attendance-check",
      color: "bg-green-500",
      badge: "الأكثر استخداماً",
    },
    {
      title: "إدارة الورديات",
      description: "إنشاء وإدارة قوالب الورديات وجداول العمل",
      icon: <CalendarClock className="w-6 h-6" />,
      href: "/shift-management",
      color: "bg-blue-500",
    },
    {
      title: "تقارير التايم شيت",
      description: "إنشاء تقارير الدوام الشهرية مع التوقيعات",
      icon: <FileSignature className="w-6 h-6" />,
      href: "/timesheet",
      color: "bg-purple-500",
    },
    {
      title: "موظفي الفروع",
      description: "إدارة بيانات الموظفين والرواتب والمستندات",
      icon: <Users className="w-6 h-6" />,
      href: "/branch-employees",
      color: "bg-amber-500",
    },
  ];

  const managementCards = [
    {
      title: "الهيكل التنظيمي",
      description: "الإدارات والأقسام والمناصب",
      icon: <ClipboardCheck className="w-4 h-4" />,
      href: "/organizational-structure",
      stats: stats?.totalEmployees || 0,
      statsLabel: "موظف",
    },
    {
      title: "التقارير الشاملة",
      description: "تقارير تحليلية وإغلاق الرواتب",
      icon: <BarChart3 className="w-4 h-4" />,
      href: "/employee-reports",
      stats: stats?.reportsCount || 0,
      statsLabel: "تقرير",
    },
    {
      title: "سجل الحضور",
      description: "سجل الحضور والانصراف التفصيلي",
      icon: <FileText className="w-4 h-4" />,
      href: "/attendance-records",
      stats: stats?.schedulesCount || 0,
      statsLabel: "سجل",
    },
    {
      title: "نسبة الحضور الشهري",
      description: "متوسط نسبة الحضور للشهر الحالي",
      icon: <UserCheck className="w-4 h-4" />,
      href: "/timesheet?tab=history",
      stats: stats?.attendanceRate ? `${stats.attendanceRate}%` : "-",
      statsLabel: "نسبة الحضور",
    },
  ];

  const todayStats = [
    {
      label: "إجمالي الموظفين",
      value: stats?.totalEmployees || 0,
      icon: <Users className="w-5 h-5 text-blue-500" />,
    },
    {
      label: "الحاضرون اليوم",
      value: stats?.presentToday || 0,
      icon: <UserCheck className="w-5 h-5 text-green-500" />,
    },
    {
      label: "المتأخرون",
      value: stats?.lateToday || 0,
      icon: <Timer className="w-5 h-5 text-amber-500" />,
    },
    {
      label: "الغائبون",
      value: stats?.absentToday || 0,
      icon: <Clock className="w-5 h-5 text-red-500" />,
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={() => navigate("/operations")}
              data-testid="btn-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" data-testid="text-page-title">
                إدارة موظفي الفروع الشاملة
              </h1>
              <p className="text-muted-foreground">
                إدارة شاملة لموظفي الفروع والورديات والحضور وتقارير التايم شيت
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {todayStats.map((stat, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="pt-6">
                    <div className="flex justify-center mb-2">{stat.icon}</div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">الإجراءات السريعة</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {quickActions.map((action, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary"
                    onClick={() => navigate(action.href)}
                    data-testid={`card-action-${index}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${action.color} text-white shrink-0`}>
                          {action.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <h3 className="font-semibold text-sm">{action.title}</h3>
                            {action.badge && (
                              <Badge variant="secondary" className="text-[10px] px-1">
                                {action.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">الإدارة والتقارير</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {managementCards.map((card, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
                    onClick={() => navigate(card.href)}
                    data-testid={`card-management-${index}`}
                  >
                    <CardContent className="p-3 text-center">
                      <div className="flex justify-center mb-2">
                        <div className="p-2 rounded-lg bg-muted">{card.icon}</div>
                      </div>
                      <p className="text-xl font-bold text-primary">{card.stats}</p>
                      <p className="text-xs text-muted-foreground mb-1">{card.statsLabel}</p>
                      <p className="text-sm font-medium">{card.title}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-sm">
                  <ListChecks className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-800">دليل سريع:</span>
                  <span className="text-amber-700">إعداد الورديات ← تسجيل الحضور ← إنشاء تقارير التايم شيت</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
