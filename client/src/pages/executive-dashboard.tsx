import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/page-header";
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
  Building2,
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
    urgent: "bg-red-600 text-white",
    high: "bg-orange-600 text-white",
    normal: "bg-blue-600 text-white",
    low: "bg-gray-500 text-white",
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
        <div className="p-4 md:p-6 lg:p-8" dir="rtl">
          <div className="max-w-[1400px] mx-auto space-y-5">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6" dir="rtl">
        <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-5">
          
          <PageHeader
            icon={Crown}
            tone="executive"
            title="السكرتارية التنفيذية"
            description="مركز قيادة الرئيس التنفيذي"
            actions={
              <Link href="/executive/meetings">
                <Button size="sm" className="h-9 gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة
                </Button>
              </Link>
            }
          />

          {/* Stats - Equal sized cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <Link href="/executive/meetings" className="block">
              <Card className="h-full border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg shrink-0">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-slate-600 truncate">اجتماعات الأسبوع</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900" data-testid="stat-meetings">
                      {stats?.meetingsThisWeek || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks" className="block">
              <Card className="h-full border border-slate-200 hover:border-amber-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-amber-600 rounded-lg shrink-0">
                    <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-slate-600 truncate">المهام المعلقة</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900" data-testid="stat-pending-tasks">
                      {stats?.pendingTasks || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks" className="block">
              <Card className={`h-full border hover:shadow-sm transition-all bg-white ${(stats?.overdueTasks || 0) > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-red-300'}`}>
                <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-red-600 rounded-lg shrink-0">
                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-slate-600 truncate">المهام المتأخرة</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900" data-testid="stat-overdue-tasks">
                      {stats?.overdueTasks || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/correspondence" className="block">
              <Card className="h-full border border-slate-200 hover:border-green-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-green-600 rounded-lg shrink-0">
                    <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-slate-600 truncate">مراسلات جديدة</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900" data-testid="stat-unread-corr">
                      {stats?.unreadCorrespondence || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Quick Access - Three columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
            <Link href="/executive/templates" className="block">
              <Card className="border-0 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 transition-colors">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-purple-500 rounded-lg">
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white">النماذج الجاهزة</p>
                    <p className="text-[10px] sm:text-xs text-purple-100">قوالب رسمية للطباعة</p>
                  </div>
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 text-purple-200" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/governance" className="block">
              <Card className="border-0 bg-slate-800 hover:bg-slate-700 transition-colors">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-slate-700 rounded-lg">
                    <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white">الحوكمة المؤسسية</p>
                    <p className="text-[10px] sm:text-xs text-slate-400">السياسات والإجراءات</p>
                  </div>
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/governance/board" className="block">
              <Card className="border-0 bg-amber-600 hover:bg-amber-500 transition-colors">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-amber-500 rounded-lg">
                    <Crown className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white">مجلس الإدارة</p>
                    <p className="text-[10px] sm:text-xs text-amber-100">الأعضاء والقرارات</p>
                  </div>
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 text-amber-300" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Main Content - Three columns on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
            
            {/* Meetings */}
            <Card className="border border-slate-200 bg-white">
              <CardHeader className="p-3 pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm font-semibold text-slate-900">الاجتماعات القادمة</CardTitle>
                  </div>
                  <Link href="/executive/meetings">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      الكل <ArrowLeft className="h-3 w-3 mr-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {stats?.upcomingMeetings?.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">لا توجد اجتماعات قادمة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats?.upcomingMeetings?.slice(0, 3).map((meeting: any) => (
                      <div
                        key={meeting.id}
                        className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        data-testid={`meeting-card-${meeting.id}`}
                      >
                        <p className="text-sm font-medium text-slate-900 leading-tight">{meeting.title}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-600 mt-1.5">
                          <Clock className="h-3 w-3" />
                          {meeting.startAt && format(new Date(meeting.startAt), "EEEE d MMMM - h:mm a", { locale: ar })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card className="border border-slate-200 bg-white">
              <CardHeader className="p-3 pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <CardTitle className="text-sm font-semibold text-slate-900">المهام العاجلة</CardTitle>
                  </div>
                  <Link href="/executive/tasks">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                      الكل <ArrowLeft className="h-3 w-3 mr-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {stats?.urgentTasks?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">لا توجد مهام عاجلة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats?.urgentTasks?.slice(0, 3).map((task: any) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        data-testid={`task-card-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 leading-tight flex-1">{task.title}</p>
                          <Badge className={`${priorityColors[task.priority]} text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 shrink-0`}>
                            {priorityLabels[task.priority] || task.priority}
                          </Badge>
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-slate-600 mt-1.5">
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
            <Card className="border border-slate-200 bg-white">
              <CardHeader className="p-3 pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-sm font-semibold text-slate-900">آخر المراسلات</CardTitle>
                  </div>
                  <Link href="/executive/correspondence">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50">
                      الكل <ArrowLeft className="h-3 w-3 mr-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {stats?.recentCorrespondence?.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">لا توجد مراسلات حديثة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats?.recentCorrespondence?.slice(0, 3).map((corr: any) => (
                      <div
                        key={corr.id}
                        className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        data-testid={`corr-card-${corr.id}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                            {corr.refNumber}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600 border-slate-300">
                            {corr.type === 'incoming' ? 'وارد' : 'صادر'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-900 leading-tight">{corr.subject}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {corr.createdAt && format(new Date(corr.createdAt), "d MMMM yyyy", { locale: ar })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links - Compact grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
            <Link href="/executive/org-structure" className="block" data-testid="link-org-structure">
              <Card className="border-2 border-amber-300 hover:shadow-md transition-all bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <div className="p-2 bg-amber-200 rounded-lg">
                    <Building2 className="h-4 w-4 text-amber-800" />
                  </div>
                  <span className="text-xs font-bold text-amber-800">الهيكل التنظيمي</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/calendar" className="block">
              <Card className="border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CalendarDays className="h-4 w-4 text-purple-700" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">التقويم</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/documents" className="block">
              <Card className="border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-4 w-4 text-blue-700" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">الوثائق</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/visitors" className="block">
              <Card className="border border-slate-200 hover:border-teal-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <UserCheck className="h-4 w-4 text-teal-700" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">الزوار</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/travel-requests" className="block">
              <Card className="border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <div className="p-2 bg-sky-100 rounded-lg">
                    <Plane className="h-4 w-4 text-sky-700" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">السفر</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/reports" className="block">
              <Card className="border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all bg-white">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-indigo-700" />
                  </div>
                  <span className="text-xs font-medium text-slate-700">التقارير</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks" className="block">
              <Card className="border border-amber-300 hover:shadow-sm transition-all bg-amber-50 hover:bg-amber-100">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                  <div className="p-2 bg-amber-200 rounded-lg">
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
