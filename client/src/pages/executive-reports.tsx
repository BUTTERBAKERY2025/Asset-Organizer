import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useReactToPrint } from "react-to-print";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import { 
  FileText, 
  Printer, 
  Download, 
  Calendar, 
  CheckSquare, 
  Mail, 
  Users, 
  Plane, 
  ArrowRight,
  BarChart3,
  PieChart,
  TrendingUp,
  FileSpreadsheet,
  Bell,
  RefreshCw
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ar } from "date-fns/locale";

interface ReportData {
  meetings: {
    total: number;
    completed: number;
    cancelled: number;
    upcoming: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
  correspondence: {
    total: number;
    sent: number;
    received: number;
    pending: number;
  };
  visitors: {
    total: number;
    checkedIn: number;
    checkedOut: number;
  };
  travel: {
    total: number;
    approved: number;
    pending: number;
    totalBudget: number;
  };
}

const reportTypes = [
  { value: "weekly", label: "تقرير أسبوعي" },
  { value: "monthly", label: "تقرير شهري" },
  { value: "meetings", label: "تقرير الاجتماعات" },
  { value: "tasks", label: "تقرير المهام" },
  { value: "correspondence", label: "تقرير المراسلات" },
  { value: "visitors", label: "تقرير الزوار" },
  { value: "travel", label: "تقرير السفر" },
];

export default function ExecutiveReports() {
  const [reportType, setReportType] = useState("weekly");
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/executive/dashboard"],
  });

  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: ["/api/executive/meetings"],
  });

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["/api/executive/tasks"],
  });

  const { data: correspondence = [] } = useQuery<any[]>({
    queryKey: ["/api/executive/correspondence"],
  });

  const { data: visitorStats } = useQuery<any>({
    queryKey: ["/api/visitor-stats"],
  });

  const { data: travelStats } = useQuery<any>({
    queryKey: ["/api/travel-stats"],
  });

  const { data: visitors = [] } = useQuery<any[]>({
    queryKey: ["/api/visitors"],
  });

  const generateRemindersMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/system-notifications/generate-reminders");
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "تم إنشاء التذكيرات",
        description: `تم إنشاء ${data.remindersCreated || 0} تذكير جديد`
      });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء التذكيرات", variant: "destructive" });
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `تقرير السكرتارية التنفيذية - ${format(new Date(), 'yyyy-MM-dd')}`,
  });

  const exportToExcel = (data: any[], filename: string, sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: `تم تصدير ${filename} بنجاح` });
  };

  const exportMeetings = () => {
    const exportData = meetings.map((m: any) => ({
      'العنوان': m.title,
      'التاريخ': format(new Date(m.startAt), 'yyyy/MM/dd HH:mm'),
      'النوع': m.meetingType,
      'الحالة': m.status,
      'الموقع': m.location || '-',
    }));
    exportToExcel(exportData, 'الاجتماعات', 'Meetings');
  };

  const exportTasks = () => {
    const exportData = tasks.map((t: any) => ({
      'العنوان': t.title,
      'الأولوية': t.priority,
      'تاريخ الاستحقاق': t.dueDate ? format(new Date(t.dueDate), 'yyyy/MM/dd') : '-',
      'الحالة': t.status,
    }));
    exportToExcel(exportData, 'المهام', 'Tasks');
  };

  const exportVisitors = () => {
    const exportData = visitors.map((v: any) => ({
      'الاسم': v.name,
      'الشركة': v.company || '-',
      'الغرض': v.purpose || '-',
      'وقت الدخول': v.checkInTime ? format(new Date(v.checkInTime), 'yyyy/MM/dd HH:mm') : '-',
      'وقت الخروج': v.checkOutTime ? format(new Date(v.checkOutTime), 'yyyy/MM/dd HH:mm') : '-',
    }));
    exportToExcel(exportData, 'الزوار', 'Visitors');
  };

  const getReportTitle = () => {
    const type = reportTypes.find(r => r.value === reportType);
    return type?.label || "تقرير";
  };

  const getDateRange = () => {
    const now = new Date();
    if (reportType === "weekly") {
      return `${format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy/MM/dd', { locale: ar })} - ${format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy/MM/dd', { locale: ar })}`;
    }
    return `${format(startOfMonth(now), 'yyyy/MM/dd', { locale: ar })} - ${format(endOfMonth(now), 'yyyy/MM/dd', { locale: ar })}`;
  };

  if (statsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/executive">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-amber-800" data-testid="page-title">
              تقارير السكرتارية التنفيذية
            </h1>
            <p className="text-gray-600">
              تقارير PDF موحدة وقابلة للطباعة
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="نوع التقرير" />
            </SelectTrigger>
            <SelectContent>
              {reportTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => handlePrint()} className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            تصدير البيانات والتذكيرات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportMeetings} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              تصدير الاجتماعات
            </Button>
            <Button variant="outline" onClick={exportTasks} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              تصدير المهام
            </Button>
            <Button variant="outline" onClick={exportVisitors} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              تصدير الزوار
            </Button>
            <Button 
              variant="outline" 
              onClick={() => generateRemindersMutation.mutate()}
              disabled={generateRemindersMutation.isPending}
              className="gap-2 bg-blue-50 hover:bg-blue-100"
            >
              {generateRemindersMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              إنشاء تذكيرات تلقائية
            </Button>
          </div>
        </CardContent>
      </Card>

      <div ref={printRef} className="bg-white p-8 rounded-lg shadow print:shadow-none">
        <div className="print:block">
          <div className="text-center mb-8 border-b-2 border-amber-500 pb-4">
            <h1 className="text-2xl font-bold text-amber-800">BUTTER BAKERY</h1>
            <h2 className="text-xl font-semibold mt-2">{getReportTitle()}</h2>
            <p className="text-gray-600 mt-1">{getDateRange()}</p>
            <p className="text-sm text-gray-500 mt-1">
              تاريخ الإنشاء: {format(new Date(), 'yyyy/MM/dd HH:mm', { locale: ar })}
            </p>
          </div>

          {(reportType === "weekly" || reportType === "monthly") && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      الاجتماعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats?.meetingsThisWeek || meetings.length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-amber-500" />
                      المهام المعلقة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">
                      {stats?.pendingTasks || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4 text-green-500" />
                      المراسلات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {correspondence.length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      الزوار
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {visitorStats?.todayVisitors || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      ملخص الاجتماعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>إجمالي الاجتماعات</span>
                        <Badge variant="outline">{meetings.length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>مكتملة</span>
                        <Badge className="bg-green-500">{meetings.filter((m: any) => m.status === 'completed').length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>مجدولة</span>
                        <Badge className="bg-blue-500">{meetings.filter((m: any) => m.status === 'scheduled').length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>ملغية</span>
                        <Badge className="bg-gray-500">{meetings.filter((m: any) => m.status === 'cancelled').length}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-amber-500" />
                      ملخص المهام
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>إجمالي المهام</span>
                        <Badge variant="outline">{tasks.length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>مكتملة</span>
                        <Badge className="bg-green-500">{tasks.filter((t: any) => t.status === 'completed').length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>قيد التنفيذ</span>
                        <Badge className="bg-blue-500">{tasks.filter((t: any) => t.status === 'in_progress').length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>معلقة</span>
                        <Badge className="bg-yellow-500">{tasks.filter((t: any) => t.status === 'pending').length}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-cyan-500" />
                    ملخص طلبات السفر
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-cyan-600">
                        {travelStats?.pendingRequests || 0}
                      </div>
                      <div className="text-sm text-gray-600">طلبات معلقة</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {travelStats?.approvedRequests || 0}
                      </div>
                      <div className="text-sm text-gray-600">طلبات موافق عليها</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {travelStats?.completedTrips || 0}
                      </div>
                      <div className="text-sm text-gray-600">رحلات مكتملة</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600">
                        {(travelStats?.totalBudget || 0).toLocaleString()} ر.س
                      </div>
                      <div className="text-sm text-gray-600">إجمالي الميزانية</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {reportType === "meetings" && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الاجتماعات</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-2">العنوان</th>
                      <th className="text-right p-2">التاريخ</th>
                      <th className="text-right p-2">النوع</th>
                      <th className="text-right p-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.slice(0, 20).map((meeting: any) => (
                      <tr key={meeting.id} className="border-b">
                        <td className="p-2">{meeting.title}</td>
                        <td className="p-2">{format(new Date(meeting.startAt), 'yyyy/MM/dd HH:mm', { locale: ar })}</td>
                        <td className="p-2">{meeting.meetingType}</td>
                        <td className="p-2">
                          <Badge variant="outline">{meeting.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {reportType === "tasks" && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل المهام</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-2">العنوان</th>
                      <th className="text-right p-2">الأولوية</th>
                      <th className="text-right p-2">تاريخ الاستحقاق</th>
                      <th className="text-right p-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.slice(0, 20).map((task: any) => (
                      <tr key={task.id} className="border-b">
                        <td className="p-2">{task.title}</td>
                        <td className="p-2">{task.priority}</td>
                        <td className="p-2">{task.dueDate ? format(new Date(task.dueDate), 'yyyy/MM/dd', { locale: ar }) : '-'}</td>
                        <td className="p-2">
                          <Badge variant="outline">{task.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {reportType === "visitors" && (
            <Card>
              <CardHeader>
                <CardTitle>إحصائيات الزوار</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {visitorStats?.todayVisitors || 0}
                    </div>
                    <div className="text-sm text-gray-600">زوار اليوم</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {visitorStats?.currentlyInside || 0}
                    </div>
                    <div className="text-sm text-gray-600">داخل المبنى حالياً</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">
                      {visitorStats?.weeklyVisitors || 0}
                    </div>
                    <div className="text-sm text-gray-600">زوار هذا الأسبوع</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {visitorStats?.monthlyVisitors || 0}
                    </div>
                    <div className="text-sm text-gray-600">زوار هذا الشهر</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {reportType === "travel" && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل طلبات السفر</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-cyan-600">
                      {travelStats?.pendingRequests || 0}
                    </div>
                    <div className="text-sm text-gray-600">طلبات معلقة</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {travelStats?.approvedRequests || 0}
                    </div>
                    <div className="text-sm text-gray-600">طلبات موافق عليها</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {travelStats?.completedTrips || 0}
                    </div>
                    <div className="text-sm text-gray-600">رحلات مكتملة</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">
                      {(travelStats?.totalSpent || 0).toLocaleString()} ر.س
                    </div>
                    <div className="text-sm text-gray-600">إجمالي المصروفات</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {reportType === "correspondence" && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل المراسلات</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-2">الموضوع</th>
                      <th className="text-right p-2">النوع</th>
                      <th className="text-right p-2">التاريخ</th>
                      <th className="text-right p-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correspondence.slice(0, 20).map((corr: any) => (
                      <tr key={corr.id} className="border-b">
                        <td className="p-2">{corr.subject}</td>
                        <td className="p-2">{corr.type}</td>
                        <td className="p-2">{format(new Date(corr.createdAt), 'yyyy/MM/dd', { locale: ar })}</td>
                        <td className="p-2">
                          <Badge variant="outline">{corr.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
            <p>تقرير صادر من نظام السكرتارية التنفيذية - BUTTER BAKERY</p>
            <p>جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
