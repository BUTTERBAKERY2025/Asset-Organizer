import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import type { GovernanceMeeting } from "@shared/schema";

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

export default function MeetingsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery<GovernanceMeeting[]>({
    queryKey: ["/api/governance/meetings"],
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
    const data = {
      meetingType: formData.get("meetingType") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      meetingDate: new Date(formData.get("meetingDate") as string),
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

  const filteredMeetings = meetings.filter((meeting) => {
    if (activeTab === "all") return true;
    if (activeTab === "board") return meeting.meetingType === "board";
    if (activeTab === "assembly") return meeting.meetingType.includes("assembly");
    return true;
  });

  const upcomingMeetings = meetings.filter(m => 
    m.status === 'scheduled' && new Date(m.meetingDate) > new Date()
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-blue-800" data-testid="page-title">
                الاجتماعات والجمعيات
              </h1>
              <p className="text-gray-600">إدارة اجتماعات مجلس الإدارة والجمعية العمومية</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="btn-add-meeting">
                <Plus className="h-4 w-4" />
                اجتماع جديد
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
                    <Input id="meetingDate" name="meetingDate" type="datetime-local" required />
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
                  <Textarea id="agenda" name="agenda" rows={4} placeholder="1. افتتاح الاجتماع&#10;2. ..." />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">إنشاء الاجتماع</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">إجمالي الاجتماعات</p>
                  <p className="text-2xl font-bold text-blue-800">{meetings.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">اجتماعات قادمة</p>
                  <p className="text-2xl font-bold text-green-800">{upcomingMeetings.length}</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-violet-600">اجتماعات المجلس</p>
                  <p className="text-2xl font-bold text-violet-800">
                    {meetings.filter(m => m.meetingType === 'board').length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-violet-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">الجمعيات العمومية</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {meetings.filter(m => m.meetingType.includes('assembly')).length}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="board">مجلس الإدارة</TabsTrigger>
            <TabsTrigger value="assembly">الجمعية العمومية</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4">
            <div className="grid gap-4">
              {isLoading ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    جاري التحميل...
                  </CardContent>
                </Card>
              ) : filteredMeetings.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    لا يوجد اجتماعات
                  </CardContent>
                </Card>
              ) : (
                filteredMeetings.map((meeting) => (
                  <Card key={meeting.id} className="hover:shadow-md transition-shadow" data-testid={`meeting-card-${meeting.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${meetingTypes.find(t => t.value === meeting.meetingType)?.color || 'bg-gray-100'}`}>
                            {meeting.meetingType === 'board' ? (
                              <Users className="h-6 w-6" />
                            ) : (
                              <Building2 className="h-6 w-6" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{meeting.title}</h3>
                              <Badge className={meetingStatuses.find(s => s.value === meeting.status)?.color}>
                                {meetingStatuses.find(s => s.value === meeting.status)?.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 mb-2">
                              {meetingTypes.find(t => t.value === meeting.meetingType)?.label}
                            </p>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(meeting.meetingDate).toLocaleDateString('ar-SA', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                              {meeting.startTime && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {meeting.startTime}
                                  {meeting.endTime && ` - ${meeting.endTime}`}
                                </div>
                              )}
                              {meeting.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {meeting.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/governance/meetings/${meeting.id}`}>
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4 ml-2" />
                              التفاصيل
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
