import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Calendar, Clock, MapPin, Users, Plus, ArrowRight, Search, Filter, Edit, Trash2, Eye, Video, Phone } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Layout } from "@/components/layout";

interface Meeting {
  id: number;
  title: string;
  titleEn?: string;
  description?: string;
  branchId?: string;
  location?: string;
  meetingType: string;
  meetingLink?: string;
  startAt: string;
  endAt?: string;
  status: string;
  organizerId: string;
  organizerName?: string;
  agenda?: string;
  minutes?: string;
  createdAt: string;
  attendees?: any[];
}

const meetingTypes = [
  { value: "in_person", label: "حضوري", labelEn: "In Person" },
  { value: "virtual", label: "عن بعد", labelEn: "Virtual" },
  { value: "hybrid", label: "مختلط", labelEn: "Hybrid" },
  { value: "phone", label: "هاتفي", labelEn: "Phone" },
];

const meetingStatuses = [
  { value: "scheduled", label: "مجدول", labelEn: "Scheduled" },
  { value: "in_progress", label: "جاري", labelEn: "In Progress" },
  { value: "completed", label: "مكتمل", labelEn: "Completed" },
  { value: "cancelled", label: "ملغي", labelEn: "Cancelled" },
  { value: "postponed", label: "مؤجل", labelEn: "Postponed" },
];

export default function ExecutiveMeetings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/executive/meetings"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Meeting>) => {
      return await apiRequest("POST", "/api/executive/meetings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم إنشاء الاجتماع بنجاح" });
      setIsDialogOpen(false);
      setSelectedMeeting(null);
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الاجتماع", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Meeting> }) => {
      return await apiRequest("PUT", `/api/executive/meetings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم تحديث الاجتماع بنجاح" });
      setIsDialogOpen(false);
      setSelectedMeeting(null);
    },
    onError: () => {
      toast({ title: "فشل في تحديث الاجتماع", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/executive/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم حذف الاجتماع بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف الاجتماع", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      titleEn: formData.get("titleEn") as string,
      description: formData.get("description") as string,
      location: formData.get("location") as string,
      meetingType: formData.get("meetingType") as string,
      meetingLink: formData.get("meetingLink") as string,
      startAt: formData.get("startAt") as string,
      endAt: formData.get("endAt") as string,
      agenda: formData.get("agenda") as string,
      status: formData.get("status") as string || "scheduled",
    };

    if (selectedMeeting) {
      updateMutation.mutate({ id: selectedMeeting.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch =
      meeting.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.organizerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusInfo = meetingStatuses.find((s) => s.value === status);
    const colors: Record<string, string> = {
      scheduled: "bg-blue-500 text-white",
      in_progress: "bg-green-500 text-white",
      completed: "bg-gray-500 text-white",
      cancelled: "bg-red-500 text-white",
      postponed: "bg-yellow-500 text-white",
    };
    return (
      <Badge className={colors[status] || "bg-gray-500"}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getMeetingTypeIcon = (type: string) => {
    switch (type) {
      case "virtual":
        return <Video className="h-4 w-4" />;
      case "phone":
        return <Phone className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/executive">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowRight className="h-4 w-4" />
              العودة
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-amber-800" data-testid="page-title">
              إدارة الاجتماعات
            </h1>
            <p className="text-gray-600">
              BUTTER BAKERY - MEETINGS MANAGEMENT
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700" onClick={() => setSelectedMeeting(null)}>
              <Plus className="h-4 w-4" />
              اجتماع جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{selectedMeeting ? "تعديل الاجتماع" : "اجتماع جديد"}</DialogTitle>
              <DialogDescription>
                {selectedMeeting ? "تعديل بيانات الاجتماع" : "إضافة اجتماع جديد"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">العنوان بالعربية *</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={selectedMeeting?.title}
                    required
                    data-testid="input-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleEn">العنوان بالإنجليزية</Label>
                  <Input
                    id="titleEn"
                    name="titleEn"
                    defaultValue={selectedMeeting?.titleEn || ""}
                    data-testid="input-title-en"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={selectedMeeting?.description || ""}
                  rows={2}
                  data-testid="input-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meetingType">نوع الاجتماع *</Label>
                  <Select name="meetingType" defaultValue={selectedMeeting?.meetingType || "in_person"}>
                    <SelectTrigger data-testid="select-meeting-type">
                      <SelectValue placeholder="اختر نوع الاجتماع" />
                    </SelectTrigger>
                    <SelectContent>
                      {meetingTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">الحالة</Label>
                  <Select name="status" defaultValue={selectedMeeting?.status || "scheduled"}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      {meetingStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">المكان</Label>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={selectedMeeting?.location || ""}
                    placeholder="قاعة الاجتماعات الرئيسية"
                    data-testid="input-location"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingLink">رابط الاجتماع</Label>
                  <Input
                    id="meetingLink"
                    name="meetingLink"
                    defaultValue={selectedMeeting?.meetingLink || ""}
                    placeholder="https://meet.google.com/..."
                    data-testid="input-meeting-link"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startAt">تاريخ ووقت البداية *</Label>
                  <Input
                    id="startAt"
                    name="startAt"
                    type="datetime-local"
                    defaultValue={selectedMeeting?.startAt ? format(new Date(selectedMeeting.startAt), "yyyy-MM-dd'T'HH:mm") : ""}
                    required
                    data-testid="input-start-at"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endAt">تاريخ ووقت النهاية</Label>
                  <Input
                    id="endAt"
                    name="endAt"
                    type="datetime-local"
                    defaultValue={selectedMeeting?.endAt ? format(new Date(selectedMeeting.endAt), "yyyy-MM-dd'T'HH:mm") : ""}
                    data-testid="input-end-at"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agenda">جدول الأعمال</Label>
                <Textarea
                  id="agenda"
                  name="agenda"
                  defaultValue={selectedMeeting?.agenda || ""}
                  rows={3}
                  placeholder="1. مناقشة الأداء الشهري
2. متابعة المشاريع القائمة
3. أي موضوعات أخرى"
                  data-testid="input-agenda"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setSelectedMeeting(null);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : selectedMeeting ? "تحديث" : "إنشاء"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="البحث في الاجتماعات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="filter-status">
            <Filter className="h-4 w-4 ml-2" />
            <SelectValue placeholder="تصفية حسب الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {meetingStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">لا توجد اجتماعات</h3>
            <p className="text-gray-500 mt-2">ابدأ بإنشاء اجتماع جديد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map((meeting) => (
            <Card key={meeting.id} className="hover:shadow-lg transition-shadow" data-testid={`meeting-card-${meeting.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getMeetingTypeIcon(meeting.meetingType)}
                    <span className="text-xs text-gray-500">
                      {meetingTypes.find((t) => t.value === meeting.meetingType)?.label}
                    </span>
                  </div>
                  {getStatusBadge(meeting.status)}
                </div>
                <CardTitle className="text-lg mt-2">{meeting.title}</CardTitle>
                {meeting.titleEn && (
                  <CardDescription>{meeting.titleEn}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  {format(new Date(meeting.startAt), "EEEE، d MMMM yyyy", { locale: ar })}
                  <span className="text-amber-600 font-semibold">
                    {format(new Date(meeting.startAt), "h:mm a", { locale: ar })}
                  </span>
                </div>
                {meeting.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {meeting.location}
                  </div>
                )}
                {meeting.organizerName && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    منظم: {meeting.organizerName}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => {
                      setSelectedMeeting(meeting);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    تعديل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      if (confirm("هل أنت متأكد من حذف هذا الاجتماع؟")) {
                        deleteMutation.mutate(meeting.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </Layout>
  );
}
