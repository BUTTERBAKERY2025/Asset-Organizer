import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Calendar, CheckSquare, Mail, AlertTriangle, Clock, Users, ArrowLeft, ArrowRight, Plus, FileText, Plane, Bell, UserCheck, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

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
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
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
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-amber-800" data-testid="page-title">
            السكرتارية التنفيذية
          </h1>
          <p className="text-gray-600">
            BUTTER BAKERY SYSTEM - CEO COMMAND CENTER
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/executive/meetings">
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              الاجتماعات
            </Button>
          </Link>
          <Link href="/executive/tasks">
            <Button variant="outline" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              المهام
            </Button>
          </Link>
          <Link href="/executive/correspondence">
            <Button variant="outline" className="gap-2">
              <Mail className="h-4 w-4" />
              المراسلات
            </Button>
          </Link>
          <Link href="/documents">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              الوثائق
            </Button>
          </Link>
          <Link href="/visitors">
            <Button variant="outline" className="gap-2">
              <UserCheck className="h-4 w-4" />
              الزوار
            </Button>
          </Link>
          <Link href="/travel-requests">
            <Button variant="outline" className="gap-2">
              <Plane className="h-4 w-4" />
              السفر
            </Button>
          </Link>
          <Link href="/executive/reports">
            <Button variant="outline" className="gap-2 bg-amber-100 hover:bg-amber-200">
              <BarChart3 className="h-4 w-4" />
              التقارير
            </Button>
          </Link>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
      </div>

      <div className="flex justify-center gap-4 pt-4">
        <Link href="/executive/meetings/new">
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4" />
            اجتماع جديد
          </Button>
        </Link>
        <Link href="/executive/tasks/new">
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4" />
            مهمة جديدة
          </Button>
        </Link>
        <Link href="/executive/correspondence/new">
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4" />
            مراسلة جديدة
          </Button>
        </Link>
      </div>
    </div>
  );
}
