import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  Plus,
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ClipboardList,
  Upload,
  Download,
  Eye,
  Edit,
  Trash2,
  Bell,
  Mail,
  Printer,
  ListOrdered,
  UserCheck,
  Paperclip,
  History,
} from "lucide-react";
import type { GovernanceMeeting, BoardMember } from "@shared/schema";
import { exportToExcel, exportToCSV, printAsPDF } from "@/lib/export-utils";

const meetingTypes = [
  { value: "board", label: "اجتماع مجلس الإدارة", icon: Users, color: "bg-violet-100 text-violet-800" },
  { value: "ordinary_assembly", label: "جمعية عمومية عادية", icon: Building2, color: "bg-blue-100 text-blue-800" },
  { value: "extraordinary_assembly", label: "جمعية عمومية غير عادية", icon: Building2, color: "bg-amber-100 text-amber-800" },
  { value: "committee", label: "اجتماع لجنة", icon: Users, color: "bg-green-100 text-green-800" },
];

const meetingStatuses = [
  { value: "scheduled", label: "مجدول", color: "bg-blue-100 text-blue-800", icon: Calendar },
  { value: "in_progress", label: "جاري", color: "bg-green-100 text-green-800", icon: Clock },
  { value: "completed", label: "مكتمل", color: "bg-gray-100 text-gray-800", icon: CheckCircle },
  { value: "cancelled", label: "ملغي", color: "bg-red-100 text-red-800", icon: XCircle },
  { value: "postponed", label: "مؤجل", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
];

const locationTypes = [
  { value: "in_person", label: "حضوري", icon: MapPin },
  { value: "virtual", label: "افتراضي", icon: Video },
  { value: "hybrid", label: "مختلط", icon: Users },
];

interface AgendaItem {
  id: number;
  title: string;
  description: string;
  duration: number;
  presenter: string;
  order: number;
}

export default function MeetingsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [selectedMeeting, setSelectedMeeting] = useState<GovernanceMeeting | null>(null);
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [showAgendaBuilder, setShowAgendaBuilder] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [newAgendaItem, setNewAgendaItem] = useState({ title: "", description: "", duration: 15, presenter: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery<GovernanceMeeting[]>({
    queryKey: ["/api/governance/meetings"],
  });

  const { data: members = [] } = useQuery<BoardMember[]>({
    queryKey: ["/api/governance/board-members"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<GovernanceMeeting>) => {
      const res = await fetch("/api/governance/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create meeting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      setIsDialogOpen(false);
      toast({ title: "تم إنشاء الاجتماع بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الاجتماع", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const meetingDateStr = formData.get("meetingDate") as string;
    const data = {
      meetingType: formData.get("meetingType") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      meetingDate: meetingDateStr ? new Date(meetingDateStr) : new Date(),
      startTime: formData.get("startTime") as string,
      endTime: formData.get("endTime") as string,
      location: formData.get("location") as string,
      locationType: formData.get("locationType") as string,
      virtualMeetingLink: formData.get("virtualMeetingLink") as string,
      agenda: formData.get("agenda") as string,
      fiscalYear: new Date().getFullYear().toString(),
    };
    createMutation.mutate(data);
  };

  const upcomingMeetings = meetings.filter(m => 
    m.status === 'scheduled' && new Date(m.meetingDate) >= new Date()
  );
  
  const pastMeetings = meetings.filter(m => 
    m.status === 'completed' || new Date(m.meetingDate) < new Date()
  );

  const cancelledMeetings = meetings.filter(m => 
    m.status === 'cancelled' || m.status === 'postponed'
  );

  const getMeetingsByTab = () => {
    switch (activeTab) {
      case "upcoming": return upcomingMeetings;
      case "past": return pastMeetings;
      case "cancelled": return cancelledMeetings;
      default: return meetings;
    }
  };

  const filteredMeetings = getMeetingsByTab();

  const addAgendaItem = () => {
    if (!newAgendaItem.title) return;
    setAgendaItems([...agendaItems, { ...newAgendaItem, id: Date.now(), order: agendaItems.length + 1 }]);
    setNewAgendaItem({ title: "", description: "", duration: 15, presenter: "" });
  };

  const removeAgendaItem = (id: number) => {
    setAgendaItems(agendaItems.filter(item => item.id !== id));
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = meetingStatuses.find(s => s.value === status);
    return statusInfo ? (
      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
    ) : null;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-10 space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl">
              <Building2 className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800" data-testid="page-title">
                الاجتماعات والجمعيات
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">إدارة جدول الأعمال والمستندات والحضور</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">تصدير</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "meetingNumber", header: "رقم الاجتماع", width: 15 },
                    { key: "title", header: "العنوان", width: 30 },
                    { key: "meetingType", header: "النوع", width: 15 },
                    { key: "meetingDate", header: "التاريخ", width: 12 },
                    { key: "location", header: "المكان", width: 15 },
                    { key: "status", header: "الحالة", width: 12 },
                    { key: "attendeesCount", header: "الحضور", width: 10 },
                  ];
                  exportToExcel(filteredMeetings, exportColumns, "الاجتماعات", "الاجتماعات");
                }}>
                  Excel تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "meetingNumber", header: "رقم الاجتماع", width: 15 },
                    { key: "title", header: "العنوان", width: 30 },
                    { key: "meetingType", header: "النوع", width: 15 },
                    { key: "meetingDate", header: "التاريخ", width: 12 },
                    { key: "location", header: "المكان", width: 15 },
                    { key: "status", header: "الحالة", width: 12 },
                    { key: "attendeesCount", header: "الحضور", width: 10 },
                  ];
                  exportToCSV(filteredMeetings, exportColumns, "الاجتماعات");
                }}>
                  CSV تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "meetingNumber", header: "رقم الاجتماع", width: 15 },
                    { key: "title", header: "العنوان", width: 30 },
                    { key: "meetingType", header: "النوع", width: 15 },
                    { key: "meetingDate", header: "التاريخ", width: 12 },
                    { key: "location", header: "المكان", width: 15 },
                    { key: "status", header: "الحالة", width: 12 },
                    { key: "attendeesCount", header: "الحضور", width: 10 },
                  ];
                  printAsPDF(filteredMeetings, exportColumns, "سجل الاجتماعات", "اجتماعات مجلس الإدارة والجمعيات العامة");
                }}>
                  طباعة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm hidden sm:flex">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden md:inline">عرض التقويم</span>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700" data-testid="btn-add-meeting">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">اجتماع</span> جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>إنشاء اجتماع جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="meetingType">نوع الاجتماع *</Label>
                      <Select name="meetingType" defaultValue="board">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {meetingTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">عنوان الاجتماع *</Label>
                      <Input id="title" name="title" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meetingDate">تاريخ الاجتماع *</Label>
                      <Input id="meetingDate" name="meetingDate" type="date" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="locationType">نوع المكان</Label>
                      <Select name="locationType" defaultValue="in_person">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {locationTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startTime">وقت البدء</Label>
                      <Input id="startTime" name="startTime" type="time" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">وقت الانتهاء</Label>
                      <Input id="endTime" name="endTime" type="time" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="location">المكان</Label>
                      <Input id="location" name="location" placeholder="قاعة الاجتماعات الرئيسية" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="virtualMeetingLink">رابط الاجتماع الافتراضي</Label>
                      <Input id="virtualMeetingLink" name="virtualMeetingLink" placeholder="https://..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">وصف الاجتماع</Label>
                    <Textarea id="description" name="description" rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agenda">جدول الأعمال</Label>
                    <Textarea id="agenda" name="agenda" rows={4} placeholder="1. الموضوع الأول&#10;2. الموضوع الثاني" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      إنشاء الاجتماع
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-blue-600">اجتماعات قادمة</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{upcomingMeetings.length}</p>
                </div>
                <Calendar className="h-5 w-5 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-green-600">مكتملة هذا العام</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-800">{pastMeetings.length}</p>
                </div>
                <CheckCircle className="h-5 w-5 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-purple-600">معدل الحضور</p>
                  <p className="text-lg sm:text-2xl font-bold text-purple-800">85%</p>
                </div>
                <UserCheck className="h-5 w-5 sm:h-8 sm:w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-amber-600">قرارات معلقة</p>
                  <p className="text-lg sm:text-2xl font-bold text-amber-800">0</p>
                </div>
                <FileText className="h-5 w-5 sm:h-8 sm:w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4 h-auto">
            <TabsTrigger value="upcoming" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">قادمة</span> ({upcomingMeetings.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <History className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">سابقة</span> ({pastMeetings.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">ملغية</span> ({cancelledMeetings.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">الكل</span> ({meetings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  جاري التحميل...
                </CardContent>
              </Card>
            ) : getMeetingsByTab().length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>لا يوجد اجتماعات</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {getMeetingsByTab().map((meeting) => (
                  <Card key={meeting.id} className="hover:shadow-lg transition-shadow" data-testid={`meeting-card-${meeting.id}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-1 sm:gap-2 mb-2 flex-wrap">
                            <Badge className={`${meetingTypes.find(t => t.value === meeting.meetingType)?.color} text-[10px] sm:text-xs`}>
                              {meetingTypes.find(t => t.value === meeting.meetingType)?.label}
                            </Badge>
                            {getStatusBadge(meeting.status || "scheduled")}
                            {meeting.locationType && (
                              <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs hidden sm:flex">
                                {meeting.locationType === 'virtual' && <Video className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                                {meeting.locationType === 'in_person' && <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                                {locationTypes.find(l => l.value === meeting.locationType)?.label}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-sm sm:text-lg mb-2">{meeting.title}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-blue-500" />
                              <span>{formatDate(meeting.meetingDate)}</span>
                            </div>
                            {meeting.startTime && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-green-500" />
                                <span>{meeting.startTime} - {meeting.endTime || "..."}</span>
                              </div>
                            )}
                            {meeting.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-red-500" />
                                <span>{meeting.location}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-purple-500" />
                              <span>0 حاضر</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 sm:gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3"
                            onClick={() => {
                              setSelectedMeeting(meeting);
                              setShowMeetingDetails(true);
                            }}
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">عرض</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3"
                            onClick={() => {
                              setSelectedMeeting(meeting);
                              setShowAgendaBuilder(true);
                            }}
                          >
                            <ListOrdered className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">جدول الأعمال</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 hidden sm:flex"
                            onClick={() => {
                              setSelectedMeeting(meeting);
                              setShowAttendance(true);
                            }}
                          >
                            <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden md:inline">الحضور</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 hidden sm:flex"
                            onClick={() => {
                              setSelectedMeeting(meeting);
                              setShowDocuments(true);
                            }}
                          >
                            <Paperclip className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden md:inline">المستندات</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showMeetingDetails} onOpenChange={setShowMeetingDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل الاجتماع</DialogTitle>
            </DialogHeader>
            {selectedMeeting && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={meetingTypes.find(t => t.value === selectedMeeting.meetingType)?.color}>
                    {meetingTypes.find(t => t.value === selectedMeeting.meetingType)?.label}
                  </Badge>
                  {getStatusBadge(selectedMeeting.status || "scheduled")}
                </div>
                
                <h2 className="text-xl font-bold">{selectedMeeting.title}</h2>
                
                {selectedMeeting.description && (
                  <p className="text-gray-600">{selectedMeeting.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">التاريخ</p>
                    <p className="font-medium">{formatDate(selectedMeeting.meetingDate)}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">الوقت</p>
                    <p className="font-medium">{selectedMeeting.startTime || "-"} - {selectedMeeting.endTime || "-"}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">المكان</p>
                    <p className="font-medium">{selectedMeeting.location || "غير محدد"}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">نوع الانعقاد</p>
                    <p className="font-medium">{locationTypes.find(l => l.value === selectedMeeting.locationType)?.label || "-"}</p>
                  </div>
                </div>

                {selectedMeeting.agenda && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <ListOrdered className="h-4 w-4 text-blue-600" />
                      جدول الأعمال
                    </h4>
                    <pre className="text-sm whitespace-pre-wrap">{selectedMeeting.agenda}</pre>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="gap-2">
                    <Bell className="h-4 w-4" />
                    إرسال تذكير
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Printer className="h-4 w-4" />
                    طباعة
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMeetingDetails(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAgendaBuilder} onOpenChange={setShowAgendaBuilder}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5 text-blue-600" />
                بناء جدول الأعمال
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="col-span-2">
                  <Label>عنوان البند</Label>
                  <Input
                    value={newAgendaItem.title}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, title: e.target.value })}
                    placeholder="موضوع البند"
                  />
                </div>
                <div>
                  <Label>المدة (دقيقة)</Label>
                  <Input
                    type="number"
                    value={newAgendaItem.duration}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, duration: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>المقدم</Label>
                  <Input
                    value={newAgendaItem.presenter}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, presenter: e.target.value })}
                    placeholder="اسم المقدم"
                  />
                </div>
                <div className="col-span-4">
                  <Label>الوصف</Label>
                  <Textarea
                    value={newAgendaItem.description}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, description: e.target.value })}
                    placeholder="تفاصيل البند"
                    rows={2}
                  />
                </div>
                <div className="col-span-4">
                  <Button onClick={addAgendaItem} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                    إضافة بند
                  </Button>
                </div>
              </div>

              {agendaItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-12">#</TableHead>
                      <TableHead className="text-right">البند</TableHead>
                      <TableHead className="text-right">المدة</TableHead>
                      <TableHead className="text-right">المقدم</TableHead>
                      <TableHead className="text-right w-16">حذف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agendaItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.title}</p>
                            {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{item.duration} دقيقة</TableCell>
                        <TableCell>{item.presenter || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeAgendaItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  لم يتم إضافة بنود بعد
                </div>
              )}

              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                <span className="font-medium">إجمالي المدة:</span>
                <span className="font-bold text-blue-800">{agendaItems.reduce((sum, item) => sum + item.duration, 0)} دقيقة</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAgendaBuilder(false)}>إلغاء</Button>
              <Button className="bg-blue-600 hover:bg-blue-700">حفظ جدول الأعمال</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAttendance} onOpenChange={setShowAttendance}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                تسجيل الحضور
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {members.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العضو</TableHead>
                      <TableHead className="text-right">المنصب</TableHead>
                      <TableHead className="text-right">الحضور</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.filter(m => m.status === "active").map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.fullName}</TableCell>
                        <TableCell>{member.position}</TableCell>
                        <TableCell>
                          <Select defaultValue="absent">
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">حاضر</SelectItem>
                              <SelectItem value="absent">غائب</SelectItem>
                              <SelectItem value="proxy">بوكالة</SelectItem>
                              <SelectItem value="excused">معتذر</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input placeholder="ملاحظات" className="w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  لا يوجد أعضاء مجلس مسجلين
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAttendance(false)}>إلغاء</Button>
              <Button className="bg-blue-600 hover:bg-blue-700">حفظ الحضور</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDocuments} onOpenChange={setShowDocuments}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-blue-600" />
                مستندات الاجتماع
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">اسحب المستندات هنا أو انقر للرفع</p>
                <p className="text-sm text-gray-400 mt-1">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX</p>
              </div>

              <div className="text-center text-gray-500 py-4">
                لا يوجد مستندات مرفقة
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDocuments(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
