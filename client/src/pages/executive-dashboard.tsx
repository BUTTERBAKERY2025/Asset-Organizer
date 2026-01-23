import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "wouter";
import { Calendar, CheckSquare, Mail, AlertTriangle, Clock, Users, ArrowLeft, ArrowRight, Plus, FileText, Plane, Bell, UserCheck, BarChart3, CalendarDays, Settings2, Eye, EyeOff, Shield, Crown, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Layout } from "@/components/layout";

interface DashboardStats {
  meetingsThisWeek: number;
  pendingTasks: number;
  overdueTasks: number;
  unreadCorrespondence: number;
  upcomingMeetings: any[];
  urgentTasks: any[];
  recentCorrespondence: any[];
}

interface WidgetSettings {
  showMeetings: boolean;
  showTasks: boolean;
  showCorrespondence: boolean;
  showStats: boolean;
}

const defaultWidgetSettings: WidgetSettings = {
  showMeetings: true,
  showTasks: true,
  showCorrespondence: true,
  showStats: true,
};

export default function ExecutiveDashboard() {
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettings>(() => {
    const saved = localStorage.getItem('executive-dashboard-widgets');
    return saved ? JSON.parse(saved) : defaultWidgetSettings;
  });

  useEffect(() => {
    localStorage.setItem('executive-dashboard-widgets', JSON.stringify(widgetSettings));
  }, [widgetSettings]);

  const toggleWidget = (key: keyof WidgetSettings) => {
    setWidgetSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/executive/dashboard"],
  });

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-500 text-white",
    high: "bg-orange-500 text-white",
    normal: "bg-blue-500 text-white",
    low: "bg-gray-500 text-white",
  };

  const priorityLabels: Record<string, string> = {
    urgent: "عاجل",
    high: "مرتفع",
    normal: "عادي",
    low: "منخفض",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500 text-white",
    in_progress: "bg-blue-500 text-white",
    completed: "bg-green-500 text-white",
    cancelled: "bg-gray-500 text-white",
    scheduled: "bg-blue-500 text-white",
    received: "bg-yellow-500 text-white",
    sent: "bg-green-500 text-white",
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-amber-800" data-testid="page-title">
            السكرتارية التنفيذية
          </h1>
          <p className="text-gray-600">
            مركز قيادة الرئيس التنفيذي - BUTTER BAKERY
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="تخصيص لوحة التحكم">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64" dir="rtl">
              <div className="space-y-4">
                <h4 className="font-medium">تخصيص الويدجت</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">الإحصائيات</span>
                    <Switch 
                      checked={widgetSettings.showStats} 
                      onCheckedChange={() => toggleWidget('showStats')} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">الاجتماعات القادمة</span>
                    <Switch 
                      checked={widgetSettings.showMeetings} 
                      onCheckedChange={() => toggleWidget('showMeetings')} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">المهام العاجلة</span>
                    <Switch 
                      checked={widgetSettings.showTasks} 
                      onCheckedChange={() => toggleWidget('showTasks')} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">المراسلات الأخيرة</span>
                    <Switch 
                      checked={widgetSettings.showCorrespondence} 
                      onCheckedChange={() => toggleWidget('showCorrespondence')} 
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* اختصارات الإجراءات السريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/executive/meetings">
          <Card className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-blue-500 text-white">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-blue-800">الاجتماعات</p>
                <p className="text-xs text-blue-600">{stats?.meetingsThisWeek || 0} هذا الأسبوع</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/executive/tasks">
          <Card className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-amber-500 text-white">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">المهام</p>
                <p className="text-xs text-amber-600">{stats?.pendingTasks || 0} معلقة</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/executive/correspondence">
          <Card className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-green-500 text-white">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-green-800">المراسلات</p>
                <p className="text-xs text-green-600">{stats?.unreadCorrespondence || 0} جديدة</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/executive/calendar">
          <Card className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-purple-500 text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-purple-800">التقويم</p>
                <p className="text-xs text-purple-600">عرض الجدول</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* اختصارات الحوكمة ومجلس الإدارة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/governance">
          <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-3 rounded-xl bg-white/10 backdrop-blur">
                <Shield className="h-7 w-7 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">الحوكمة المؤسسية</p>
                <p className="text-sm text-slate-300">السياسات والإجراءات والامتثال</p>
              </div>
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/governance/board">
          <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-amber-700 to-amber-800 text-white border-0 shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-3 rounded-xl bg-white/10 backdrop-blur">
                <Crown className="h-7 w-7 text-amber-200" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">مجلس الإدارة</p>
                <p className="text-sm text-amber-200">الأعضاء والاجتماعات والقرارات</p>
              </div>
              <ArrowLeft className="h-5 w-5 text-amber-300" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {widgetSettings.showStats && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              اجتماعات هذا الأسبوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-meetings">
              {stats?.meetingsThisWeek || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              المهام المعلقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-pending-tasks">
              {stats?.pendingTasks || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              المهام المتأخرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-overdue-tasks">
              {stats?.overdueTasks || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              مراسلات غير مقروءة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-unread-corr">
              {stats?.unreadCorrespondence || 0}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {widgetSettings.showMeetings && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                الاجتماعات القادمة
              </CardTitle>
              <Link href="/executive/meetings">
                <Button variant="ghost" size="sm" className="gap-1">
                  عرض الكل
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.upcomingMeetings?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                لا توجد اجتماعات قادمة
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.upcomingMeetings?.map((meeting: any) => (
                  <div
                    key={meeting.id}
                    className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    data-testid={`meeting-card-${meeting.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{meeting.title}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Clock className="h-3 w-3" />
                          {meeting.startAt && format(new Date(meeting.startAt), "EEEE، d MMMM yyyy - h:mm a", { locale: ar })}
                        </div>
                        {meeting.location && (
                          <div className="text-sm text-gray-500 mt-1">
                            📍 {meeting.location}
                          </div>
                        )}
                      </div>
                      <Badge className={statusColors[meeting.status] || "bg-gray-500"}>
                        {meeting.status === 'scheduled' ? 'مجدول' : meeting.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {widgetSettings.showTasks && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                المهام العاجلة
              </CardTitle>
              <Link href="/executive/tasks">
                <Button variant="ghost" size="sm" className="gap-1">
                  عرض الكل
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.urgentTasks?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                لا توجد مهام عاجلة
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.urgentTasks?.map((task: any) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    data-testid={`task-card-${task.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{task.title}</h4>
                        {task.dueDate && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Clock className="h-3 w-3" />
                            موعد التسليم: {format(new Date(task.dueDate), "d MMMM yyyy", { locale: ar })}
                          </div>
                        )}
                        {task.assignedToName && (
                          <div className="text-sm text-gray-500 mt-1">
                            👤 {task.assignedToName}
                          </div>
                        )}
                      </div>
                      <Badge className={priorityColors[task.priority] || "bg-gray-500"}>
                        {priorityLabels[task.priority] || task.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {widgetSettings.showCorrespondence && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-green-500" />
                آخر المراسلات
              </CardTitle>
              <Link href="/executive/correspondence">
                <Button variant="ghost" size="sm" className="gap-1">
                  عرض الكل
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentCorrespondence?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                لا توجد مراسلات حديثة
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.recentCorrespondence?.map((corr: any) => (
                  <div
                    key={corr.id}
                    className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    data-testid={`corr-card-${corr.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-200">
                            {corr.refNumber}
                          </span>
                          <Badge variant="outline">
                            {corr.type === 'incoming' ? 'وارد' : 'صادر'}
                          </Badge>
                        </div>
                        <h4 className="font-semibold mt-1">{corr.subject}</h4>
                        {corr.senderName && corr.type === 'incoming' && (
                          <div className="text-sm text-gray-500 mt-1">
                            من: {corr.senderName}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {corr.createdAt && format(new Date(corr.createdAt), "d MMMM yyyy", { locale: ar })}
                        </div>
                      </div>
                      <Badge className={priorityColors[corr.priority] || "bg-gray-500"}>
                        {priorityLabels[corr.priority] || corr.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* روابط سريعة إضافية */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Link href="/documents">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-2 p-3">
              <FileText className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">الوثائق</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/visitors">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-2 p-3">
              <UserCheck className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">الزوار</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/travel-requests">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-2 p-3">
              <Plane className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">طلبات السفر</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/executive/reports">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-2 p-3">
              <BarChart3 className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">التقارير</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/executive/meetings">
          <Card className="cursor-pointer hover:shadow-md transition-shadow bg-amber-50 border-amber-200">
            <CardContent className="flex items-center gap-2 p-3">
              <Plus className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">إضافة جديد</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
    </Layout>
  );
}
