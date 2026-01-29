import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Plus, 
  Calendar, 
  Users, 
  FileText, 
  CheckCircle, 
  Clock,
  ArrowRight,
  ChevronLeft,
  Vote,
  Gavel
} from "lucide-react";
import { Link } from "wouter";

interface GeneralAssembly {
  id: number;
  title: string;
  meetingType: string;
  scheduledDate: string;
  location: string;
  status: string;
  quorumRequired: number;
  agenda?: string;
  notes?: string;
  attendeesCount?: number;
  createdAt: string;
}

export default function GeneralAssemblyPage() {
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    meetingType: "ordinary",
    scheduledDate: "",
    location: "",
    quorumRequired: 50,
    agenda: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery<GeneralAssembly[]>({
    queryKey: ["/api/governance/meetings"],
  });

  const { data: shareholders = [] } = useQuery<any[]>({
    queryKey: ["/api/governance/shareholders"],
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: typeof newMeeting) => {
      const response = await fetch("/api/governance/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create meeting");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      setShowNewMeeting(false);
      setNewMeeting({
        title: "",
        meetingType: "ordinary",
        scheduledDate: "",
        location: "",
        quorumRequired: 50,
        agenda: "",
      });
      toast({ title: "تم إنشاء اجتماع الجمعية العمومية بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الاجتماع", variant: "destructive" });
    },
  });

  const assemblyMeetings = meetings.filter(m => 
    m.meetingType === 'ordinary' || m.meetingType === 'extraordinary'
  );

  const ordinaryMeetings = assemblyMeetings.filter(m => m.meetingType === 'ordinary');
  const extraordinaryMeetings = assemblyMeetings.filter(m => m.meetingType === 'extraordinary');
  const upcomingMeetings = assemblyMeetings.filter(m => m.status === 'scheduled' || m.status === 'pending');
  const completedMeetings = assemblyMeetings.filter(m => m.status === 'completed');

  const totalShares = shareholders.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">مجدولة</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">قيد الانتظار</Badge>;
      case 'in_progress':
        return <Badge className="bg-green-100 text-green-800">جارية</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">مكتملة</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">ملغية</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMeetingTypeBadge = (type: string) => {
    switch (type) {
      case 'ordinary':
        return <Badge className="bg-emerald-100 text-emerald-800">عادية</Badge>;
      case 'extraordinary':
        return <Badge className="bg-purple-100 text-purple-800">غير عادية</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/governance">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              العودة للحوكمة
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Building2 className="h-7 w-7 text-blue-600" />
              الجمعية العمومية
            </h1>
            <p className="text-gray-600">إدارة اجتماعات الجمعية العادية وغير العادية</p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setShowNewMeeting(true)}>
          <Plus className="h-4 w-4" />
          اجتماع جديد
        </Button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">إجمالي الاجتماعات</p>
                <p className="text-2xl font-bold text-blue-800">{assemblyMeetings.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600">جمعيات عادية</p>
                <p className="text-2xl font-bold text-emerald-800">{ordinaryMeetings.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">جمعيات غير عادية</p>
                <p className="text-2xl font-bold text-purple-800">{extraordinaryMeetings.length}</p>
              </div>
              <Gavel className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">قادمة</p>
                <p className="text-2xl font-bold text-amber-800">{upcomingMeetings.length}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">مكتملة</p>
                <p className="text-2xl font-bold text-gray-800">{completedMeetings.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* معلومات المساهمين */}
      <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="h-10 w-10 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-800">بيانات المساهمين</h3>
                <p className="text-sm text-amber-600">
                  إجمالي المساهمين: {shareholders.length} | إجمالي الأسهم: {totalShares.toLocaleString('en-US')}
                </p>
              </div>
            </div>
            <Link href="/governance/shareholders">
              <Button variant="outline" size="sm" className="gap-2">
                عرض التفاصيل
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* قائمة الاجتماعات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            اجتماعات الجمعية العمومية
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
          ) : assemblyMeetings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد اجتماعات جمعية عمومية حالياً</p>
              <Button className="mt-4" onClick={() => setShowNewMeeting(true)}>
                <Plus className="h-4 w-4 mr-2" />
                إنشاء اجتماع جديد
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المكان</TableHead>
                  <TableHead className="text-right">نسبة النصاب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assemblyMeetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell className="font-medium">{meeting.title}</TableCell>
                    <TableCell>{getMeetingTypeBadge(meeting.meetingType)}</TableCell>
                    <TableCell>
                      {meeting.scheduledDate 
                        ? new Date(meeting.scheduledDate).toLocaleDateString('en-GB')
                        : '-'}
                    </TableCell>
                    <TableCell>{meeting.location || '-'}</TableCell>
                    <TableCell>{meeting.quorumRequired}%</TableCell>
                    <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/governance/meetings/${meeting.id}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href="/governance/voting">
                          <Button variant="outline" size="sm">
                            <Vote className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* روابط سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/governance/voting">
          <Card className="hover:border-green-400 hover:shadow-lg transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Vote className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">التصويت الإلكتروني</h3>
                <p className="text-sm text-gray-500">التصويت على قرارات الجمعية</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/governance/resolutions">
          <Card className="hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Gavel className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold">القرارات</h3>
                <p className="text-sm text-gray-500">قرارات الجمعية العمومية</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/governance/shareholders">
          <Card className="hover:border-amber-400 hover:shadow-lg transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">المساهمين</h3>
                <p className="text-sm text-gray-500">بيانات وسجل المساهمين</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* نافذة إنشاء اجتماع جديد */}
      <Dialog open={showNewMeeting} onOpenChange={setShowNewMeeting}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              إنشاء اجتماع جمعية عمومية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عنوان الاجتماع</Label>
              <Input
                value={newMeeting.title}
                onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                placeholder="مثال: الجمعية العمومية السنوية 2026"
              />
            </div>
            <div>
              <Label>نوع الجمعية</Label>
              <Select
                value={newMeeting.meetingType}
                onValueChange={(v) => setNewMeeting({ ...newMeeting, meetingType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinary">جمعية عادية</SelectItem>
                  <SelectItem value="extraordinary">جمعية غير عادية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تاريخ الاجتماع</Label>
              <Input
                type="datetime-local"
                value={newMeeting.scheduledDate}
                onChange={(e) => setNewMeeting({ ...newMeeting, scheduledDate: e.target.value })}
              />
            </div>
            <div>
              <Label>مكان الانعقاد</Label>
              <Input
                value={newMeeting.location}
                onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                placeholder="مثال: المقر الرئيسي - قاعة الاجتماعات"
              />
            </div>
            <div>
              <Label>نسبة النصاب المطلوب (%)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={newMeeting.quorumRequired}
                onChange={(e) => setNewMeeting({ ...newMeeting, quorumRequired: parseInt(e.target.value) || 50 })}
              />
            </div>
            <div>
              <Label>جدول الأعمال</Label>
              <Textarea
                value={newMeeting.agenda}
                onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                placeholder="أدخل بنود جدول الأعمال..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMeeting(false)}>إلغاء</Button>
            <Button 
              onClick={() => createMeetingMutation.mutate(newMeeting)}
              disabled={!newMeeting.title || !newMeeting.scheduledDate}
            >
              إنشاء الاجتماع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
