import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Calendar, 
  CheckSquare, 
  Mail, 
  AlertTriangle, 
  Clock, 
  ArrowLeft, 
  Plus, 
  FileText, 
  Plane, 
  UserCheck, 
  BarChart3, 
  CalendarDays, 
  Shield, 
  Crown,
} from "lucide-react";
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

export default function ExecutiveDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/executive/dashboard"],
  });

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-100 text-red-800 border-red-300",
    high: "bg-orange-100 text-orange-800 border-orange-300",
    normal: "bg-blue-100 text-blue-800 border-blue-300",
    low: "bg-gray-100 text-gray-800 border-gray-300",
  };

  const priorityLabels: Record<string, string> = {
    urgent: "عاجل",
    high: "مرتفع",
    normal: "عادي",
    low: "منخفض",
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-gray-50" dir="rtl">
          <div className="max-w-6xl mx-auto p-4 space-y-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen" dir="rtl">
        <div className="max-w-6xl mx-auto p-3 md:p-4 space-y-4">
          
          {/* Header */}
          <div className="bg-amber-700 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-600 rounded-lg">
                  <Crown className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white" data-testid="page-title">
                    السكرتارية التنفيذية
                  </h1>
                  <p className="text-amber-100 text-xs">
                    مركز قيادة الرئيس التنفيذي
                  </p>
                </div>
              </div>
              <Link href="/executive/meetings">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  جديد
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/executive/meetings">
              <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600">اجتماعات الأسبوع</p>
                      <p className="text-xl font-bold text-gray-900 mt-1" data-testid="stat-meetings">
                        {stats?.meetingsThisWeek || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-4 w-4 text-blue-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks">
              <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600">المهام المعلقة</p>
                      <p className="text-xl font-bold text-gray-900 mt-1" data-testid="stat-pending-tasks">
                        {stats?.pendingTasks || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <CheckSquare className="h-4 w-4 text-amber-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks">
              <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600">المهام المتأخرة</p>
                      <p className="text-xl font-bold text-gray-900 mt-1" data-testid="stat-overdue-tasks">
                        {stats?.overdueTasks || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/correspondence">
              <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600">مراسلات جديدة</p>
                      <p className="text-xl font-bold text-gray-900 mt-1" data-testid="stat-unread-corr">
                        {stats?.unreadCorrespondence || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Mail className="h-4 w-4 text-green-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Quick Access */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/governance">
              <Card className="cursor-pointer hover:shadow-md transition-shadow bg-slate-700 border-0">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="p-2 bg-slate-600 rounded-lg">
                    <Shield className="h-4 w-4 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">الحوكمة المؤسسية</p>
                    <p className="text-xs text-slate-300">السياسات والإجراءات</p>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-slate-400 mr-auto" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/governance/board">
              <Card className="cursor-pointer hover:shadow-md transition-shadow bg-amber-600 border-0">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="p-2 bg-amber-500 rounded-lg">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">مجلس الإدارة</p>
                    <p className="text-xs text-amber-100">الأعضاء والقرارات</p>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-amber-200 mr-auto" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Meetings */}
            <Card className="border border-gray-200 bg-white">
              <CardHeader className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm font-semibold text-gray-900">الاجتماعات القادمة</CardTitle>
                  </div>
                  <Link href="/executive/meetings">
                    <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 h-7 px-2">
                      عرض الكل <ArrowLeft className="h-3 w-3 mr-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {stats?.upcomingMeetings?.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">لا توجد اجتماعات قادمة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats?.upcomingMeetings?.slice(0, 3).map((meeting: any) => (
                      <div
                        key={meeting.id}
                        className="p-2 rounded-lg bg-gray-50 border border-gray-100"
                        data-testid={`meeting-card-${meeting.id}`}
                      >
                        <p className="text-sm font-medium text-gray-900">{meeting.title}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                          <Clock className="h-3 w-3" />
                          {meeting.startAt && format(new Date(meeting.startAt), "EEEE، d MMMM - h:mm a", { locale: ar })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card className="border border-gray-200 bg-white">
              <CardHeader className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <CardTitle className="text-sm font-semibold text-gray-900">المهام العاجلة</CardTitle>
                  </div>
                  <Link href="/executive/tasks">
                    <Button variant="ghost" size="sm" className="text-xs text-amber-600 hover:text-amber-700 h-7 px-2">
                      عرض الكل <ArrowLeft className="h-3 w-3 mr-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {stats?.urgentTasks?.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckSquare className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">لا توجد مهام عاجلة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats?.urgentTasks?.slice(0, 3).map((task: any) => (
                      <div
                        key={task.id}
                        className="p-2 rounded-lg bg-gray-50 border border-gray-100"
                        data-testid={`task-card-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">{task.title}</p>
                          <Badge className={`${priorityColors[task.priority]} text-[10px] px-1.5 py-0`}>
                            {priorityLabels[task.priority] || task.priority}
                          </Badge>
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.dueDate), "d MMMM yyyy", { locale: ar })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Correspondence */}
            <Card className="border border-gray-200 bg-white">
              <CardHeader className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-sm font-semibold text-gray-900">آخر المراسلات</CardTitle>
                  </div>
                  <Link href="/executive/correspondence">
                    <Button variant="ghost" size="sm" className="text-xs text-green-600 hover:text-green-700 h-7 px-2">
                      عرض الكل <ArrowLeft className="h-3 w-3 mr-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {stats?.recentCorrespondence?.length === 0 ? (
                  <div className="text-center py-6">
                    <Mail className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">لا توجد مراسلات حديثة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats?.recentCorrespondence?.slice(0, 3).map((corr: any) => (
                      <div
                        key={corr.id}
                        className="p-2 rounded-lg bg-gray-50 border border-gray-100"
                        data-testid={`corr-card-${corr.id}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-mono">
                            {corr.refNumber}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-700 border-gray-300">
                            {corr.type === 'incoming' ? 'وارد' : 'صادر'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{corr.subject}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {corr.createdAt && format(new Date(corr.createdAt), "d MMMM yyyy", { locale: ar })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <Link href="/executive/calendar">
              <Card className="cursor-pointer hover:shadow-sm transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-2 flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <CalendarDays className="h-4 w-4 text-purple-700" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">التقويم</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/documents">
              <Card className="cursor-pointer hover:shadow-sm transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-2 flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <FileText className="h-4 w-4 text-blue-700" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">الوثائق</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/visitors">
              <Card className="cursor-pointer hover:shadow-sm transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-2 flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 bg-teal-100 rounded-lg">
                    <UserCheck className="h-4 w-4 text-teal-700" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">الزوار</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/travel-requests">
              <Card className="cursor-pointer hover:shadow-sm transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-2 flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 bg-sky-100 rounded-lg">
                    <Plane className="h-4 w-4 text-sky-700" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">السفر</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/reports">
              <Card className="cursor-pointer hover:shadow-sm transition-shadow border border-gray-200 bg-white">
                <CardContent className="p-2 flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 bg-indigo-100 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-indigo-700" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">التقارير</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks">
              <Card className="cursor-pointer hover:shadow-sm transition-shadow border border-amber-300 bg-amber-50">
                <CardContent className="p-2 flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 bg-amber-200 rounded-lg">
                    <Plus className="h-4 w-4 text-amber-800" />
                  </div>
                  <span className="text-xs font-medium text-amber-800">إضافة</span>
                </CardContent>
              </Card>
            </Link>
          </div>

        </div>
      </div>
    </Layout>
  );
}
