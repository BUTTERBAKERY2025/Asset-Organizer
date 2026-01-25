import { useState, useEffect } from "react";
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
  TrendingUp,
  Users,
  Briefcase
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
    urgent: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    normal: "bg-blue-100 text-blue-700 border-blue-200",
    low: "bg-gray-100 text-gray-700 border-gray-200",
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-50" dir="rtl">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-50" dir="rtl">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
          
          {/* Header Section */}
          <div className="bg-gradient-to-l from-amber-600 via-amber-700 to-amber-800 rounded-2xl p-6 md:p-8 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <Crown className="h-8 w-8 text-amber-200" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold" data-testid="page-title">
                    السكرتارية التنفيذية
                  </h1>
                  <p className="text-amber-200 text-sm md:text-base mt-1">
                    مركز قيادة الرئيس التنفيذي - BUTTER BAKERY
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/executive/meetings">
                  <Button className="bg-white/20 hover:bg-white/30 text-white border-0 gap-2">
                    <Plus className="h-4 w-4" />
                    اجتماع جديد
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/executive/meetings">
              <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-white hover:bg-blue-50 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">اجتماعات الأسبوع</p>
                      <p className="text-3xl font-bold text-gray-900" data-testid="stat-meetings">
                        {stats?.meetingsThisWeek || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-xs text-blue-600">
                    <TrendingUp className="h-3 w-3 ml-1" />
                    عرض التفاصيل
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks">
              <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-white hover:bg-amber-50 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">المهام المعلقة</p>
                      <p className="text-3xl font-bold text-gray-900" data-testid="stat-pending-tasks">
                        {stats?.pendingTasks || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-amber-100 rounded-xl group-hover:bg-amber-200 transition-colors">
                      <CheckSquare className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-xs text-amber-600">
                    <TrendingUp className="h-3 w-3 ml-1" />
                    عرض التفاصيل
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks">
              <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-white hover:bg-red-50 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">المهام المتأخرة</p>
                      <p className="text-3xl font-bold text-gray-900" data-testid="stat-overdue-tasks">
                        {stats?.overdueTasks || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-xl group-hover:bg-red-200 transition-colors">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  {(stats?.overdueTasks || 0) > 0 && (
                    <div className="mt-3 flex items-center text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3 ml-1" />
                      تحتاج متابعة
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/correspondence">
              <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-white hover:bg-green-50 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">مراسلات جديدة</p>
                      <p className="text-3xl font-bold text-gray-900" data-testid="stat-unread-corr">
                        {stats?.unreadCorrespondence || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                      <Mail className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-xs text-green-600">
                    <TrendingUp className="h-3 w-3 ml-1" />
                    عرض التفاصيل
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Quick Access Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/governance">
              <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 bg-gradient-to-l from-slate-700 to-slate-800 text-white border-0 overflow-hidden">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-white/10 rounded-xl backdrop-blur group-hover:bg-white/20 transition-colors">
                    <Shield className="h-8 w-8 text-amber-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">الحوكمة المؤسسية</h3>
                    <p className="text-slate-300 text-sm mt-1">السياسات والإجراءات والامتثال</p>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/governance/board">
              <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 bg-gradient-to-l from-amber-600 to-amber-700 text-white border-0 overflow-hidden">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-white/10 rounded-xl backdrop-blur group-hover:bg-white/20 transition-colors">
                    <Crown className="h-8 w-8 text-amber-200" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">مجلس الإدارة</h3>
                    <p className="text-amber-200 text-sm mt-1">الأعضاء والاجتماعات والقرارات</p>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-amber-300 group-hover:text-white transition-colors" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Meetings */}
            <Card className="border-0 shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-l from-blue-50 to-white pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-base font-semibold">الاجتماعات القادمة</CardTitle>
                  </div>
                  <Link href="/executive/meetings">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1">
                      عرض الكل
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {stats?.upcomingMeetings?.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-3">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">لا توجد اجتماعات قادمة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats?.upcomingMeetings?.slice(0, 3).map((meeting: any) => (
                      <div
                        key={meeting.id}
                        className="p-4 rounded-xl bg-gray-50 hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100"
                        data-testid={`meeting-card-${meeting.id}`}
                      >
                        <h4 className="font-medium text-gray-900 mb-2">{meeting.title}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          {meeting.startAt && format(new Date(meeting.startAt), "EEEE، d MMMM - h:mm a", { locale: ar })}
                        </div>
                        {meeting.location && (
                          <div className="text-sm text-gray-400 mt-1">
                            📍 {meeting.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Urgent Tasks */}
            <Card className="border-0 shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-l from-amber-50 to-white pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <CardTitle className="text-base font-semibold">المهام العاجلة</CardTitle>
                  </div>
                  <Link href="/executive/tasks">
                    <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1">
                      عرض الكل
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {stats?.urgentTasks?.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-3">
                      <CheckSquare className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">لا توجد مهام عاجلة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats?.urgentTasks?.slice(0, 3).map((task: any) => (
                      <div
                        key={task.id}
                        className="p-4 rounded-xl bg-gray-50 hover:bg-amber-50/50 transition-colors border border-transparent hover:border-amber-100"
                        data-testid={`task-card-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          <Badge className={`${priorityColors[task.priority]} border text-xs`}>
                            {priorityLabels[task.priority] || task.priority}
                          </Badge>
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                            <Clock className="h-4 w-4" />
                            موعد التسليم: {format(new Date(task.dueDate), "d MMMM yyyy", { locale: ar })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Correspondence */}
            <Card className="border-0 shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-l from-green-50 to-white pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Mail className="h-5 w-5 text-green-600" />
                    </div>
                    <CardTitle className="text-base font-semibold">آخر المراسلات</CardTitle>
                  </div>
                  <Link href="/executive/correspondence">
                    <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50 gap-1">
                      عرض الكل
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {stats?.recentCorrespondence?.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-3">
                      <Mail className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">لا توجد مراسلات حديثة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats?.recentCorrespondence?.slice(0, 3).map((corr: any) => (
                      <div
                        key={corr.id}
                        className="p-4 rounded-xl bg-gray-50 hover:bg-green-50/50 transition-colors border border-transparent hover:border-green-100"
                        data-testid={`corr-card-${corr.id}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-1 rounded-md bg-gray-200 text-gray-600 font-mono">
                            {corr.refNumber}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {corr.type === 'incoming' ? 'وارد' : 'صادر'}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-gray-900">{corr.subject}</h4>
                        <div className="text-xs text-gray-400 mt-2">
                          {corr.createdAt && format(new Date(corr.createdAt), "d MMMM yyyy", { locale: ar })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <Link href="/executive/calendar">
              <Card className="group cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-purple-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                    <CalendarDays className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">التقويم</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/documents">
              <Card className="group cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-blue-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">الوثائق</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/visitors">
              <Card className="group cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-teal-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="p-3 bg-teal-50 rounded-xl group-hover:bg-teal-100 transition-colors">
                    <UserCheck className="h-5 w-5 text-teal-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">الزوار</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/travel-requests">
              <Card className="group cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-sky-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="p-3 bg-sky-50 rounded-xl group-hover:bg-sky-100 transition-colors">
                    <Plane className="h-5 w-5 text-sky-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">طلبات السفر</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/reports">
              <Card className="group cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-indigo-200 bg-white">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">التقارير</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/executive/tasks">
              <Card className="group cursor-pointer hover:shadow-md transition-all duration-300 border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="p-3 bg-amber-200 rounded-xl group-hover:bg-amber-300 transition-colors">
                    <Plus className="h-5 w-5 text-amber-700" />
                  </div>
                  <span className="text-sm font-medium text-amber-800">مهمة جديدة</span>
                </CardContent>
              </Card>
            </Link>
          </div>

        </div>
      </div>
    </Layout>
  );
}
