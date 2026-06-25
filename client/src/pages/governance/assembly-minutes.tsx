import { useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { printMeetingMinutes } from "@/lib/meeting-minutes-print";
import {
  FileText,
  Plus,
  ChevronLeft,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Vote,
  Users,
  Building2,
  Gavel,
  Printer,
  Download,
  Edit,
  Trash2,
  MapPin,
  Video,
  Send,
  Loader2,
  MoreVertical,
  Archive,
  FileCheck,
  FilePen,
  Lock,
} from "lucide-react";

interface Shareholder {
  id: number;
  fullName: string;
  numberOfShares: number | null;
  shareholdingPercentage: string | null;
  votingRights: boolean;
}

interface MeetingMinutes {
  id: number;
  meetingId: number;
  minutesNumber: string;
  content: string;
  summary: string | null;
  attendanceList: any;
  discussionPoints: any;
  decisions: any;
  votingResults: any;
  status: string;
  preparedBy: string | null;
  preparedAt: string | null;
  createdAt: string;
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
}

interface BoardResolution {
  id: number;
  resolutionNumber: string;
  title: string;
  description: string;
  resolutionType: string;
  status: string;
  createdAt: string;
}

interface GovernanceMeeting {
  id: number;
  meetingNumber: string;
  meetingType: string;
  title: string;
  description: string | null;
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  locationType: string;
  virtualMeetingLink: string | null;
  agenda: string | null;
  status: string;
  quorumRequired: string;
  createdAt: string;
}

const minutesStatuses = [
  { value: "draft", label: "مسودة", color: "bg-gray-100 text-gray-800" },
  { value: "pending_review", label: "قيد المراجعة", color: "bg-blue-100 text-blue-800" },
  { value: "pending_signature", label: "بانتظار التوقيع", color: "bg-yellow-100 text-yellow-800" },
  { value: "signed", label: "موقّع", color: "bg-green-100 text-green-800" },
  { value: "archived", label: "مؤرشف", color: "bg-purple-100 text-purple-800" },
];

export default function AssemblyMinutesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<MeetingMinutes | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [deleteMinutesId, setDeleteMinutesId] = useState<number | null>(null);
  const [signingAttendeeIndex, setSigningAttendeeIndex] = useState<number | null>(null);
  const sigPadRef = useRef<SignatureCanvas | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    assemblyType: "ordinary_assembly",
    title: "",
    meetingDate: "",
    meetingTime: "17:00",
    endTime: "",
    location: "",
    locationType: "virtual",
    virtualMeetingLink: "",
    quorumRequired: "50",
    agenda: "",
    content: "",
    decisions: [{ description: "", responsible: "" }],
    createResolution: true,
  });

  const { data: minutes = [], isLoading } = useQuery<MeetingMinutes[]>({
    queryKey: ["/api/governance/minutes"],
  });

  const { data: shareholders = [] } = useQuery<Shareholder[]>({
    queryKey: ["/api/governance/shareholders"],
  });

  const { data: resolutions = [] } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
  });

  const { data: meetings = [] } = useQuery<GovernanceMeeting[]>({
    queryKey: ["/api/governance/meetings"],
  });

  const totalShares = shareholders.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);

  const [lockMinutesId, setLockMinutesId] = useState<number | null>(null);
  const lockMinutesMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/minutes/${id}/lock`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to lock minutes");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      setLockMinutesId(null);
      toast({ title: "تم قفل المحضر نهائياً", description: "أصبح غير قابل للتعديل أو الحذف" });
    },
    onError: (e: any) => {
      toast({ title: "فشل قفل المحضر", description: e?.message, variant: "destructive" });
    },
  });

  const deleteMinutesMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/minutes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في حذف المحضر");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      setDeleteMinutesId(null);
      toast({ title: "تم حذف المحضر بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في حذف المحضر", variant: "destructive" });
    },
  });

  const updateAttendanceListMutation = useMutation({
    mutationFn: async ({ id, attendanceList }: { id: number; attendanceList: any[] }) => {
      const res = await fetch(`/api/governance/minutes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attendanceList }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل في حفظ التوقيع");
      }
      return res.json();
    },
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      if (selectedMinutes && updated && updated.id === selectedMinutes.id) {
        setSelectedMinutes({ ...selectedMinutes, attendanceList: updated.attendanceList });
      }
      toast({ title: "تم حفظ التوقيع بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في حفظ التوقيع", variant: "destructive" });
    },
  });

  const updateMinutesStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/governance/minutes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في تحديث الحالة");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      toast({ title: "تم تحديث حالة المحضر بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في تحديث الحالة", variant: "destructive" });
    },
  });

  const createMinutesMutation = useMutation({
    mutationFn: async (data: any) => {
      const meetingRes = await fetch("/api/governance/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meetingType: data.assemblyType,
          title: data.title,
          description: data.content,
          meetingDate: data.meetingDate ? new Date(data.meetingDate) : new Date(),
          startTime: data.meetingTime,
          endTime: data.endTime,
          location: data.location,
          locationType: data.locationType,
          virtualMeetingLink: data.virtualMeetingLink,
          agenda: data.agenda,
          quorumRequired: data.quorumRequired,
          fiscalYear: new Date().getFullYear().toString(),
          status: "completed",
        }),
      });
      if (!meetingRes.ok) {
        const err = await meetingRes.json();
        throw new Error(err.error || "فشل في إنشاء الاجتماع");
      }
      const meeting = await meetingRes.json();

      const attendanceList = shareholders
        .filter(s => s.votingRights)
        .map(s => ({
          name: s.fullName,
          role: "مساهم",
          shares: s.numberOfShares || 0,
          percentage: totalShares > 0 ? ((s.numberOfShares || 0) / totalShares * 100).toFixed(2) : "0",
          status: "present",
        }));

      const decisionsData = data.decisions
        .filter((d: any) => d.description.trim())
        .map((d: any, i: number) => ({
          number: i + 1,
          description: d.description,
          responsible: d.responsible,
          deadline: "",
        }));

      const minutesRes = await fetch("/api/governance/minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meetingId: meeting.id,
          content: data.content,
          summary: data.title,
          attendanceList,
          discussionPoints: data.agenda ? data.agenda.split("\n").filter((l: string) => l.trim()).map((topic: string, i: number) => ({
            topic: topic.replace(/^\d+\.\s*/, ""),
            discussion: "",
            conclusion: "",
          })) : [],
          decisions: decisionsData,
          status: "draft",
        }),
      });
      if (!minutesRes.ok) {
        const err = await minutesRes.json();
        throw new Error(err.error || "فشل في إنشاء المحضر");
      }
      const minutesResult = await minutesRes.json();

      let resolution = null;
      if (data.createResolution) {
        const resType = data.assemblyType === "extraordinary_assembly" ? "extraordinary_assembly" : "general_assembly";
        const resolutionRes = await fetch("/api/governance/resolutions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: data.title,
            description: data.content,
            resolutionType: resType,
            category: "legal",
            priority: "high",
            status: "draft",
            votingRequired: true,
          }),
        });
        if (resolutionRes.ok) {
          resolution = await resolutionRes.json();
        }
      }

      return { meeting, minutes: minutesResult, resolution };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setShowCreate(false);
      resetForm();
      const msg = result.resolution
        ? `تم إنشاء محضر الجمعية وقرار التصويت رقم ${result.resolution.resolutionNumber} بنجاح`
        : "تم إنشاء محضر الجمعية بنجاح";
      toast({ title: msg });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إنشاء المحضر", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setForm({
      assemblyType: "ordinary_assembly",
      title: "",
      meetingDate: "",
      meetingTime: "17:00",
      endTime: "",
      location: "",
      locationType: "virtual",
      virtualMeetingLink: "",
      quorumRequired: "50",
      agenda: "",
      content: "",
      decisions: [{ description: "", responsible: "" }],
      createResolution: true,
    });
  };

  const addDecision = () => {
    setForm({ ...form, decisions: [...form.decisions, { description: "", responsible: "" }] });
  };

  const removeDecision = (index: number) => {
    setForm({ ...form, decisions: form.decisions.filter((_, i) => i !== index) });
  };

  const updateDecision = (index: number, field: string, value: string) => {
    const updated = [...form.decisions];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, decisions: updated });
  };

  const getStatusBadge = (status: string) => {
    const s = minutesStatuses.find(ms => ms.value === status);
    return <Badge className={s?.color || "bg-gray-100 text-gray-800"}>{s?.label || status}</Badge>;
  };

  const getAssemblyTypeLabel = (type: string) => {
    if (type === "ordinary_assembly") return "جمعية عمومية عادية";
    if (type === "extraordinary_assembly") return "جمعية عمومية غير عادية";
    return type;
  };


  const printMinutes = async (m: MeetingMinutes) => {
    const meeting = getMeetingForMinutes(m.meetingId);
    await printMeetingMinutes(m, meeting);
  };

  const exportMinutesAsPdf = (m: MeetingMinutes) => {
    printMinutes(m);
  };

  const assemblyMeetingIds = new Set(
    meetings
      .filter(m => m.meetingType === "ordinary_assembly" || m.meetingType === "extraordinary_assembly")
      .map(m => m.id)
  );

  const assemblyMinutes = minutes.filter(m => assemblyMeetingIds.has(m.meetingId));

  const filteredMinutes = activeTab === "all"
    ? assemblyMinutes
    : assemblyMinutes.filter(m => m.status === activeTab);

  const getMeetingForMinutes = (meetingId: number) => meetings.find(m => m.id === meetingId);

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('ar-SA-u-nu-latn', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return date;
    }
  };

  return (
    <Layout>
      <div className="page-container" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/governance">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <FileText className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-emerald-800">محاضر الجمعيات العمومية</h1>
                <p className="text-sm text-gray-500">توثيق وأرشفة محاضر اجتماعات الجمعية العمومية والقرارات</p>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            إنشاء محضر جديد
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-blue-600">إجمالي المحاضر</p>
              <p className="text-xl font-bold text-blue-800">{assemblyMinutes.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4 text-center">
              <Edit className="h-6 w-6 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600">مسودات</p>
              <p className="text-xl font-bold text-gray-800">{assemblyMinutes.filter(m => m.status === "draft").length}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-green-600">موقّعة</p>
              <p className="text-xl font-bold text-green-800">{assemblyMinutes.filter(m => m.status === "signed").length}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 text-purple-500 mx-auto mb-1" />
              <p className="text-xs text-purple-600">المساهمين</p>
              <p className="text-xl font-bold text-purple-800">{shareholders.filter(s => s.votingRights).length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">الكل ({assemblyMinutes.length})</TabsTrigger>
            <TabsTrigger value="draft">مسودات ({assemblyMinutes.filter(m => m.status === "draft").length})</TabsTrigger>
            <TabsTrigger value="signed">موقّعة ({assemblyMinutes.filter(m => m.status === "signed").length})</TabsTrigger>
            <TabsTrigger value="archived">مؤرشفة ({assemblyMinutes.filter(m => m.status === "archived").length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">جاري التحميل...</CardContent>
              </Card>
            ) : filteredMinutes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">لا توجد محاضر جمعيات</p>
                  <p className="text-sm mb-4">ابدأ بإنشاء محضر جمعية عمومية جديد</p>
                  <Button onClick={() => setShowCreate(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    إنشاء محضر جديد
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredMinutes.map((m) => {
                  const meeting = getMeetingForMinutes(m.meetingId);
                  return (
                    <Card key={m.id} className="hover:shadow-lg transition-shadow" data-testid={`minutes-card-${m.id}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">{m.minutesNumber}</Badge>
                              {getStatusBadge(m.status)}
                              {meeting && (
                                <Badge variant="outline" className="text-xs">
                                  {getAssemblyTypeLabel(meeting.meetingType)}
                                </Badge>
                              )}
                              {m.isLocked && (
                                <Badge className="bg-amber-100 text-amber-800 gap-1" data-testid={`badge-locked-${m.id}`}>
                                  <Lock className="h-3 w-3" /> مقفل
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg">{m.summary || meeting?.title || "محضر جمعية"}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                              {meeting && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{formatDate(meeting.meetingDate)}</span>
                                </div>
                              )}
                              {m.attendanceList && Array.isArray(m.attendanceList) && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  <span>{m.attendanceList.length} حاضر</span>
                                </div>
                              )}
                              {m.decisions && Array.isArray(m.decisions) && (
                                <div className="flex items-center gap-1">
                                  <Gavel className="h-4 w-4" />
                                  <span>{m.decisions.length} قرار</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => { setSelectedMinutes(m); setShowDetails(true); }}
                              data-testid={`view-minutes-${m.id}`}
                            >
                              <Eye className="h-4 w-4" />
                              عرض
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => printMinutes(m)}
                              data-testid={`print-minutes-${m.id}`}
                            >
                              <Printer className="h-4 w-4" />
                              طباعة
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => exportMinutesAsPdf(m)}
                              data-testid={`export-minutes-${m.id}`}
                            >
                              <Download className="h-4 w-4" />
                              تصدير
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={async () => {
                                const linkedRes = resolutions.find(r =>
                                  r.title === (m.summary || meeting?.title) &&
                                  (r.resolutionType === "general_assembly" || r.resolutionType === "extraordinary_assembly")
                                );
                                if (linkedRes) {
                                  if ((linkedRes as any).isLocked) {
                                    toast({ title: "القرار المرتبط مقفل نهائياً", description: "لا يمكن إعادة فتح التصويت", variant: "destructive" });
                                    return;
                                  }
                                  if (m.isLocked) {
                                    toast({ title: "المحضر مقفل ولا يمكن تعديل القرار المرتبط", variant: "destructive" });
                                    return;
                                  }
                                  if (linkedRes.status !== 'voting' && linkedRes.status !== 'approved' && linkedRes.status !== 'rejected') {
                                    await fetch(`/api/governance/resolutions/${linkedRes.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      credentials: 'include',
                                      body: JSON.stringify({ status: 'voting' }),
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
                                  }
                                  setLocation('/governance/voting');
                                } else {
                                  toast({ title: "لا يوجد قرار مرتبط بهذا المحضر للتصويت عليه", variant: "destructive" });
                                }
                              }}
                              data-testid={`vote-minutes-${m.id}`}
                            >
                              <Vote className="h-4 w-4" />
                              التصويت
                            </Button>
                            {isAdmin && !m.isLocked && (m.status === "signed" || m.status === "archived") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => setLockMinutesId(m.id)}
                                data-testid={`btn-lock-minutes-${m.id}`}
                              >
                                <Lock className="h-4 w-4" />
                                قفل نهائي
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="px-2" data-testid={`actions-minutes-${m.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {m.status === "draft" && !m.isLocked && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "pending_review" })}
                                    data-testid={`status-review-${m.id}`}
                                  >
                                    <FileCheck className="h-4 w-4 ml-2" />
                                    إرسال للمراجعة
                                  </DropdownMenuItem>
                                )}
                                {m.status === "pending_review" && !m.isLocked && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "pending_signature" })}
                                    data-testid={`status-sign-${m.id}`}
                                  >
                                    <FilePen className="h-4 w-4 ml-2" />
                                    جاهز للتوقيع
                                  </DropdownMenuItem>
                                )}
                                {m.status === "pending_signature" && !m.isLocked && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "signed" })}
                                    data-testid={`status-signed-${m.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 ml-2" />
                                    تم التوقيع
                                  </DropdownMenuItem>
                                )}
                                {m.status !== "archived" && m.status !== "draft" && !m.isLocked && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "archived" })}
                                    data-testid={`status-archive-${m.id}`}
                                  >
                                    <Archive className="h-4 w-4 ml-2" />
                                    أرشفة
                                  </DropdownMenuItem>
                                )}
                                {m.status !== "draft" && !m.isLocked && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "draft" })}
                                    data-testid={`status-draft-${m.id}`}
                                  >
                                    <Edit className="h-4 w-4 ml-2" />
                                    إعادة لمسودة
                                  </DropdownMenuItem>
                                )}
                                {m.isLocked && (
                                  <DropdownMenuItem disabled className="text-amber-700">
                                    <Lock className="h-4 w-4 ml-2" />
                                    المحضر مقفل نهائياً
                                  </DropdownMenuItem>
                                )}
                                {isAdmin && !m.isLocked && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onClick={() => setDeleteMinutesId(m.id)}
                                      data-testid={`delete-minutes-${m.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 ml-2" />
                                      حذف المحضر
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-emerald-600" />
                إنشاء محضر جمعية عمومية
              </DialogTitle>
              <DialogDescription>
                أنشئ محضر اجتماع جمعية عمومية متكامل مع إمكانية إنشاء قرار للتصويت عليه من المساهمين
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>نوع الجمعية *</Label>
                  <Select
                    value={form.assemblyType}
                    onValueChange={(v) => setForm({ ...form, assemblyType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordinary_assembly">جمعية عمومية عادية</SelectItem>
                      <SelectItem value="extraordinary_assembly">جمعية عمومية غير عادية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>عنوان المحضر *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="مثال: محضر اجتماع الجمعية العمومية العادية 2026"
                  />
                </div>
              </div>

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                تفاصيل الاجتماع
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>تاريخ الاجتماع *</Label>
                  <Input
                    type="date"
                    value={form.meetingDate}
                    onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>وقت البدء</Label>
                  <Input
                    type="time"
                    value={form.meetingTime}
                    onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>وقت الانتهاء</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>نوع الانعقاد</Label>
                  <Select
                    value={form.locationType}
                    onValueChange={(v) => setForm({ ...form, locationType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">حضوري</SelectItem>
                      <SelectItem value="virtual">عن بُعد (إلكتروني)</SelectItem>
                      <SelectItem value="hybrid">مختلط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المكان / رابط الاجتماع</Label>
                  {form.locationType === "in_person" ? (
                    <Input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="قاعة الاجتماعات الرئيسية"
                    />
                  ) : (
                    <Input
                      value={form.virtualMeetingLink}
                      onChange={(e) => setForm({ ...form, virtualMeetingLink: e.target.value })}
                      placeholder="https://..."
                    />
                  )}
                </div>
              </div>

              <div>
                <Label>النصاب المطلوب (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.quorumRequired}
                  onChange={(e) => setForm({ ...form, quorumRequired: e.target.value })}
                />
              </div>

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                جدول الأعمال
              </h3>

              <div>
                <Textarea
                  value={form.agenda}
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                  placeholder={"1. الموضوع الأول\n2. الموضوع الثاني\n3. الموضوع الثالث"}
                  rows={5}
                />
              </div>

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                محتوى المحضر
              </h3>

              <div>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="اكتب نص محضر الاجتماع الكامل هنا..."
                  rows={10}
                />
              </div>

              <Separator />
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  القرارات المتخذة
                </h3>
                <Button variant="outline" size="sm" onClick={addDecision} className="gap-1">
                  <Plus className="h-3 w-3" />
                  إضافة قرار
                </Button>
              </div>

              {form.decisions.map((decision, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <span className="mt-2 text-sm font-mono text-gray-400 min-w-[24px]">{index + 1}.</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2">
                      <Input
                        value={decision.description}
                        onChange={(e) => updateDecision(index, "description", e.target.value)}
                        placeholder="نص القرار"
                      />
                    </div>
                    <div>
                      <Input
                        value={decision.responsible}
                        onChange={(e) => updateDecision(index, "responsible", e.target.value)}
                        placeholder="المسؤول عن التنفيذ"
                      />
                    </div>
                  </div>
                  {form.decisions.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeDecision(index)} className="mt-1">
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                المساهمين ({shareholders.filter(s => s.votingRights).length} مساهم - إجمالي الأسهم: {totalShares.toLocaleString()})
              </h3>

              <Card className="bg-gray-50">
                <CardContent className="p-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المساهم</TableHead>
                        <TableHead className="text-right">عدد الأسهم</TableHead>
                        <TableHead className="text-right">النسبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shareholders.filter(s => s.votingRights).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.fullName}</TableCell>
                          <TableCell className="text-sm">{(s.numberOfShares || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm">
                            {totalShares > 0 ? ((s.numberOfShares || 0) / totalShares * 100).toFixed(2) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Separator />
              <Card className={form.createResolution ? "bg-emerald-50 border-emerald-300" : "bg-gray-50"}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={form.createResolution}
                      onCheckedChange={(checked) => setForm({ ...form, createResolution: !!checked })}
                    />
                    <div>
                      <p className="font-semibold text-sm">إنشاء قرار للتصويت الإلكتروني</p>
                      <p className="text-xs text-gray-500">
                        سيتم إنشاء قرار تلقائياً مرتبط بهذا المحضر ليتمكن جميع المساهمين من التصويت عليه إلكترونياً
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>إلغاء</Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => createMinutesMutation.mutate(form)}
                disabled={!form.title || !form.meetingDate || !form.content || createMinutesMutation.isPending}
              >
                {createMinutesMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    إنشاء المحضر
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedMinutes && (() => {
              const meeting = getMeetingForMinutes(selectedMinutes.meetingId);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      {selectedMinutes.summary || meeting?.title || "محضر الجمعية"}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono">{selectedMinutes.minutesNumber}</Badge>
                      {getStatusBadge(selectedMinutes.status)}
                      {meeting && <Badge variant="outline">{getAssemblyTypeLabel(meeting.meetingType)}</Badge>}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex gap-2 mb-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => printMinutes(selectedMinutes)}
                      data-testid="detail-print-minutes"
                    >
                      <Printer className="h-4 w-4" />
                      طباعة المحضر
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => exportMinutesAsPdf(selectedMinutes)}
                      data-testid="detail-export-minutes"
                    >
                      <Download className="h-4 w-4" />
                      تصدير PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                      onClick={() => {
                        if (selectedMinutes.isLocked) {
                          toast({ title: "المحضر مقفل نهائياً", description: "لا يمكن إرسال طلبات توقيع جديدة", variant: "destructive" });
                          return;
                        }
                        setLocation(`/governance/resolutions?meetingId=${selectedMinutes.meetingId}`);
                      }}
                      disabled={!!selectedMinutes.isLocked}
                      title={selectedMinutes.isLocked ? "المحضر مقفل نهائياً" : ""}
                      data-testid="detail-send-signatures"
                    >
                      {selectedMinutes.isLocked ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      {selectedMinutes.isLocked ? "مقفل" : "إرسال طلبات توقيع"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {meeting && (
                      <Card>
                        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">التاريخ</p>
                            <p className="font-medium">{formatDate(meeting.meetingDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">الوقت</p>
                            <p className="font-medium">{meeting.startTime || "-"} - {meeting.endTime || "-"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">نوع الانعقاد</p>
                            <p className="font-medium">
                              {meeting.locationType === "virtual" ? "عن بُعد" : meeting.locationType === "hybrid" ? "مختلط" : "حضوري"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">المكان</p>
                            <p className="font-medium">{meeting.location || meeting.virtualMeetingLink || "-"}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedMinutes.content && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          محتوى المحضر
                        </h4>
                        <Card>
                          <CardContent className="p-4 text-sm whitespace-pre-wrap leading-7">
                            {selectedMinutes.content}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {selectedMinutes.attendanceList && Array.isArray(selectedMinutes.attendanceList) && selectedMinutes.attendanceList.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          قائمة الحضور ({selectedMinutes.attendanceList.length})
                        </h4>
                        <Card>
                          <CardContent className="p-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">الاسم</TableHead>
                                  <TableHead className="text-right">الأسهم</TableHead>
                                  <TableHead className="text-right">النسبة</TableHead>
                                  <TableHead className="text-right">التوقيع</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedMinutes.attendanceList.map((a: any, i: number) => {
                                  const hasSig = typeof a.signatureUrl === 'string' && a.signatureUrl.startsWith('data:image/');
                                  const isPresent = !a.status || a.status === 'present' || a.status === 'proxy';
                                  return (
                                    <TableRow key={i}>
                                      <TableCell className="font-medium text-sm">{a.name}</TableCell>
                                      <TableCell className="text-sm">{(a.shares || 0).toLocaleString()}</TableCell>
                                      <TableCell className="text-sm">{a.percentage}%</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          {hasSig && (
                                            <img
                                              src={a.signatureUrl}
                                              alt="توقيع"
                                              className="h-8 w-20 object-contain border rounded bg-white"
                                              data-testid={`img-attendee-signature-${i}`}
                                            />
                                          )}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            disabled={!isPresent || !!selectedMinutes?.isLocked}
                                            title={selectedMinutes?.isLocked ? "المحضر مقفل ولا يمكن تعديل التواقيع" : ""}
                                            onClick={() => { if (selectedMinutes?.isLocked) return; setSigningAttendeeIndex(i); }}
                                            data-testid={`button-sign-attendee-${i}`}
                                          >
                                            {hasSig ? 'تعديل' : 'توقيع'}
                                          </Button>
                                          {hasSig && !selectedMinutes?.isLocked && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                              onClick={() => {
                                                if (!selectedMinutes || selectedMinutes.isLocked) return;
                                                const next = (selectedMinutes.attendanceList as any[]).map((x, idx) =>
                                                  idx === i ? { ...x, signatureUrl: null, signedAt: null } : x
                                                );
                                                updateAttendanceListMutation.mutate({ id: selectedMinutes.id, attendanceList: next });
                                              }}
                                              data-testid={`button-clear-attendee-signature-${i}`}
                                            >
                                              مسح
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {selectedMinutes.decisions && Array.isArray(selectedMinutes.decisions) && selectedMinutes.decisions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Gavel className="h-4 w-4" />
                          القرارات المتخذة ({selectedMinutes.decisions.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedMinutes.decisions.map((d: any, i: number) => (
                            <Card key={i}>
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono text-gray-400 text-sm mt-0.5">{d.number || i + 1}.</span>
                                  <div>
                                    <p className="text-sm">{d.description}</p>
                                    {d.responsible && (
                                      <p className="text-xs text-gray-500 mt-1">المسؤول: {d.responsible}</p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={signingAttendeeIndex !== null} onOpenChange={(open) => { if (!open) setSigningAttendeeIndex(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>توقيع المساهم</DialogTitle>
              <DialogDescription>
                {selectedMinutes && signingAttendeeIndex !== null
                  ? (selectedMinutes.attendanceList as any[])?.[signingAttendeeIndex]?.name
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
              <SignatureCanvas
                ref={(ref) => { sigPadRef.current = ref; }}
                penColor="black"
                backgroundColor="rgba(255,255,255,1)"
                canvasProps={{ className: "w-full h-48 rounded-lg", "data-testid": "canvas-attendee-signature" } as any}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">ارسم التوقيع بالإصبع أو الفأرة في المساحة أعلاه</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => sigPadRef.current?.clear()} data-testid="button-clear-attendee-canvas">مسح</Button>
              <Button variant="outline" onClick={() => setSigningAttendeeIndex(null)} data-testid="button-cancel-attendee-signature">إلغاء</Button>
              <Button
                onClick={() => {
                  if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
                    toast({ title: "يرجى رسم التوقيع أولاً", variant: "destructive" });
                    return;
                  }
                  if (!selectedMinutes || signingAttendeeIndex === null) return;
                  if (selectedMinutes.isLocked) {
                    toast({ title: "المحضر مقفل ولا يمكن تعديل التواقيع", variant: "destructive" });
                    return;
                  }
                  const dataUrl = sigPadRef.current.toDataURL("image/png");
                  const next = (selectedMinutes.attendanceList as any[]).map((x, idx) =>
                    idx === signingAttendeeIndex ? { ...x, signatureUrl: dataUrl, signedAt: new Date().toISOString() } : x
                  );
                  updateAttendanceListMutation.mutate(
                    { id: selectedMinutes.id, attendanceList: next },
                    { onSuccess: () => setSigningAttendeeIndex(null) }
                  );
                }}
                disabled={updateAttendanceListMutation.isPending}
                data-testid="button-save-attendee-signature"
              >
                {updateAttendanceListMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التوقيع"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={lockMinutesId !== null} onOpenChange={(open) => !open && setLockMinutesId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" /> قفل المحضر نهائياً
              </AlertDialogTitle>
              <AlertDialogDescription>
                بعد القفل لن يتمكن أي مستخدم — حتى المدير — من تعديل المحضر أو حذفه أو تغيير حالته.
                هذا إجراء مطلوب نظاماً لمحاضر الجمعية الموقعة (الامتثال لهيئة السوق المالية ونظام الشركات).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => lockMinutesId && lockMinutesMutation.mutate(lockMinutesId)}
                disabled={lockMinutesMutation.isPending}
              >
                {lockMinutesMutation.isPending ? "جاري القفل…" : "نعم، اقفل نهائياً"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteMinutesId !== null} onOpenChange={(open) => !open && setDeleteMinutesId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف المحضر</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذا المحضر؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteMinutesId && deleteMinutesMutation.mutate(deleteMinutesId)}
                data-testid="confirm-delete-minutes"
              >
                {deleteMinutesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "حذف"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
