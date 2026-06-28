import { useState, useMemo, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  Gavel,
  BarChart3,
  PieChart,
  TrendingUp,
  AlertCircle,
  UserCheck,
  UserX,
  ClipboardList,
  Send,
  Eye,
  Edit,
  Trash2,
  Download,
  Printer,
  Share2,
  Bell,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Target,
  Shield,
  Scale,
  CircleDot,
  CheckSquare,
  XCircle,
  MinusCircle,
  RefreshCw,
  ExternalLink,
  MoreVertical,
  PlayCircle,
  PauseCircle,
  Ban,
  CalendarCheck
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { printAssemblyResolution, exportAssemblyResolutionExcel } from "@/lib/assembly-resolution-print";
import { printAssemblyMeeting, exportAssemblyMeetingExcel } from "@/lib/assembly-meeting-print";

interface Shareholder {
  id: number;
  fullName: string;
  nationalId?: string;
  email?: string;
  phone?: string;
  numberOfShares: number;
  sharePercentage?: string;
  votingRights: boolean;
  memberType: string;
  status: string;
}

interface GeneralAssembly {
  id: number;
  title: string;
  meetingType: string;
  scheduledDate: string;
  meetingDate?: string;
  location: string;
  locationType?: string;
  virtualMeetingLink?: string;
  description?: string;
  status: string;
  quorumRequired: number;
  agenda?: string | null;
  notes?: string | null;
  attendeesCount?: number;
  createdAt: string;
}

interface BoardResolution {
  id: number;
  resolutionNumber: string;
  title: string;
  description?: string;
  resolutionType: string;
  status: string;
  votingDeadline?: string;
  meetingId?: number | null;
  forVotes?: number | null;
  againstVotes?: number | null;
  abstainVotes?: number | null;
  totalVotes?: number | null;
  requiredMajority?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  category?: string | null;
}

export default function GeneralAssemblyPage() {
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<GeneralAssembly | null>(null);
  const [attendanceList, setAttendanceList] = useState<Record<number, boolean>>({});
  const [proxyList, setProxyList] = useState<Record<number, string>>({});
  const [signatureList, setSignatureList] = useState<Record<number, string>>({});
  const [signingShareholderId, setSigningShareholderId] = useState<number | null>(null);
  const sigPadRef = useRef<SignatureCanvas | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [invitationMeetingId, setInvitationMeetingId] = useState<number | null>(null);
  const [invitationChannels, setInvitationChannels] = useState({ sendWhatsApp: true, sendSMS: false });
  const [invitationResults, setInvitationResults] = useState<any>(null);
  const [showEditMeeting, setShowEditMeeting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<GeneralAssembly | null>(null);
  const [deletingMeeting, setDeletingMeeting] = useState<GeneralAssembly | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    meetingType: "ordinary",
    meetingDate: "",
    location: "",
    quorumRequired: 50,
    agenda: "",
    virtualMeetingLink: "",
    locationType: "in_person",
    description: "",
    notes: "",
    status: "scheduled",
  });
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    meetingType: "ordinary",
    scheduledDate: "",
    location: "",
    quorumRequired: 50,
    agenda: "",
    meetingLink: "",
    meetingPlatform: "zoom",
    sendWhatsApp: true,
    sendEmail: true,
    sendSMS: false,
    invitationMessage: "",
    resolutions: [] as { title: string; content: string }[],
  });
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [noticeForcePrompt, setNoticeForcePrompt] = useState<string | null>(null);

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<GeneralAssembly[]>({
    queryKey: ["/api/governance/meetings"],
  });

  const { data: shareholders = [], isLoading: shareholdersLoading } = useQuery<Shareholder[]>({
    queryKey: ["/api/governance/shareholders"],
  });

  const { data: resolutions = [] } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
  });

  const { data: meetingRsvps = [] } = useQuery<any[]>({
    queryKey: ["/api/governance/meetings", invitationMeetingId, "rsvps"],
    queryFn: async () => {
      if (!invitationMeetingId) return [];
      const res = await fetch(`/api/governance/meetings/${invitationMeetingId}/rsvps`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!invitationMeetingId && showInvitations,
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: typeof newMeeting & { force?: boolean }) => {
      const { force, ...payload } = data as typeof newMeeting & { force?: boolean };
      const url = force ? "/api/governance/meetings?force=1" : "/api/governance/meetings";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) {
        let body: any = {};
        try { body = await response.json(); } catch { /* ignore non-JSON */ }
        const err: any = new Error(body.error || "فشل في إنشاء الاجتماع");
        err.code = body.code;
        err.canForce = body.canForce;
        throw err;
      }
      return response.json();
    },
    onSuccess: (data) => {
      setNoticeForcePrompt(null);
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      setShowNewMeeting(false);
      setNewMeeting({
        title: "",
        meetingType: "ordinary",
        scheduledDate: "",
        location: "",
        quorumRequired: 50,
        agenda: "",
        meetingLink: "",
        meetingPlatform: "zoom",
        sendWhatsApp: true,
        sendEmail: true,
        sendSMS: false,
        invitationMessage: "",
        resolutions: [],
      });
      if (data.invitationResults) {
        const ir = data.invitationResults;
        if (ir.error) {
          toast({ title: `تم إنشاء الاجتماع بنجاح`, description: ir.error });
        } else if (ir.sent > 0) {
          toast({ title: `تم إنشاء الاجتماع وإرسال ${ir.sent} دعوة بنجاح${ir.failed > 0 ? ` (${ir.failed} فشل)` : ''}` });
        } else {
          toast({ title: "تم إنشاء الاجتماع بنجاح" });
        }
      } else {
        toast({ title: "تم إنشاء اجتماع الجمعية العمومية بنجاح" });
      }
    },
    onError: (error: any) => {
      if (error?.code === "NOTICE_PERIOD_VIOLATION" && error?.canForce) {
        setNoticeForcePrompt(error.message || "مدة الإشعار غير كافية");
        return;
      }
      toast({
        title: "فشل في إنشاء الاجتماع",
        description: error?.message && error.message !== "فشل في إنشاء الاجتماع" ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const sendInvitationsMutation = useMutation({
    mutationFn: async ({ meetingId, channels }: { meetingId: number; channels: { sendWhatsApp: boolean; sendSMS: boolean } }) => {
      const response = await fetch(`/api/governance/meetings/${meetingId}/send-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(channels),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to send invitations");
      return response.json();
    },
    onSuccess: (data) => {
      setInvitationResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings", invitationMeetingId, "rsvps"] });
      toast({ 
        title: data.whatsappLinks?.length > 0 
          ? `تم إنشاء روابط واتساب وتأكيد الحضور لـ ${data.whatsappLinks.length} مساهم`
          : `تم إرسال ${data.sent} دعوة بنجاح${data.failed > 0 ? ` (${data.failed} فشل)` : ''}`,
        variant: data.failed > 0 && !data.whatsappLinks?.length ? "destructive" : "default",
      });
    },
    onError: () => {
      toast({ title: "فشل في إرسال الدعوات", variant: "destructive" });
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/governance/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        let errBody: any = {};
        try { errBody = await response.json(); } catch { /* ignore non-JSON */ }
        throw new Error(errBody.error || "فشل في تحديث الاجتماع");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      setShowEditMeeting(false);
      setEditingMeeting(null);
      toast({ title: "تم تحديث الاجتماع بنجاح" });
    },
    onError: (error: any) => {
      toast({
        title: "فشل في تحديث الاجتماع",
        description: error?.message && error.message !== "فشل في تحديث الاجتماع" ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/governance/meetings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete meeting");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      setShowDeleteConfirm(false);
      setDeletingMeeting(null);
      toast({ title: "تم حذف الاجتماع بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف الاجتماع", variant: "destructive" });
    },
  });

  const openEditDialog = (meeting: GeneralAssembly) => {
    setEditingMeeting(meeting);
    const dateStr = meeting.meetingDate || meeting.scheduledDate;
    let formattedDate = "";
    if (dateStr) {
      try {
        formattedDate = new Date(dateStr).toISOString().slice(0, 16);
      } catch { formattedDate = ""; }
    }
    setEditForm({
      title: meeting.title || "",
      meetingType: meeting.meetingType || "ordinary",
      meetingDate: formattedDate,
      location: meeting.location || "",
      quorumRequired: meeting.quorumRequired || 50,
      agenda: meeting.agenda || "",
      virtualMeetingLink: meeting.virtualMeetingLink || "",
      locationType: meeting.locationType || "in_person",
      description: meeting.description || "",
      notes: meeting.notes || "",
      status: meeting.status || "scheduled",
    });
    setShowEditMeeting(true);
  };

  const handleUpdateMeeting = () => {
    if (!editingMeeting) return;
    const updateData: any = {
      title: editForm.title,
      meetingType: editForm.meetingType,
      location: editForm.location || null,
      locationType: editForm.locationType,
      quorumRequired: editForm.quorumRequired.toString(),
      agenda: editForm.agenda || null,
      notes: editForm.notes || null,
      description: editForm.description || null,
      virtualMeetingLink: editForm.virtualMeetingLink || null,
      status: editForm.status,
    };
    if (editForm.meetingDate) {
      updateData.meetingDate = new Date(editForm.meetingDate).toISOString();
    }
    updateMeetingMutation.mutate({ id: editingMeeting.id, data: updateData });
  };

  const handleChangeStatus = (meeting: GeneralAssembly, newStatus: string) => {
    updateMeetingMutation.mutate({ id: meeting.id, data: { status: newStatus } });
  };

  // حسابات المساهمين
  const shareholderStats = useMemo(() => {
    const totalShares = shareholders.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);
    const votingShares = shareholders.filter(s => s.votingRights).reduce((sum, s) => sum + (s.numberOfShares || 0), 0);
    const activeMembers = shareholders.filter(s => s.status === 'active').length;
    const foundingMembers = shareholders.filter(s => s.memberType === 'founding').length;
    const regularMembers = shareholders.filter(s => s.memberType === 'regular').length;
    
    return {
      totalShares,
      votingShares,
      totalMembers: shareholders.length,
      activeMembers,
      foundingMembers,
      regularMembers,
      votingPercentage: totalShares > 0 ? ((votingShares / totalShares) * 100).toFixed(1) : 0,
    };
  }, [shareholders]);

  // حسابات الاجتماعات
  const meetingStats = useMemo(() => {
    const assemblyMeetings = meetings.filter(m => 
      m.meetingType === 'ordinary' || m.meetingType === 'extraordinary' || m.meetingType === 'ordinary_assembly' || m.meetingType === 'extraordinary_assembly'
    );
    return {
      total: assemblyMeetings.length,
      ordinary: assemblyMeetings.filter(m => m.meetingType === 'ordinary' || m.meetingType === 'ordinary_assembly').length,
      extraordinary: assemblyMeetings.filter(m => m.meetingType === 'extraordinary' || m.meetingType === 'extraordinary_assembly').length,
      scheduled: assemblyMeetings.filter(m => m.status === 'scheduled').length,
      completed: assemblyMeetings.filter(m => m.status === 'completed').length,
      upcoming: assemblyMeetings.filter(m => {
        if (!m.scheduledDate) return false;
        return new Date(m.scheduledDate) > new Date();
      }),
    };
  }, [meetings]);

  // حساب النصاب
  const calculateQuorum = (attendees: number[]) => {
    const attendingShares = attendees.reduce((sum, id) => {
      const shareholder = shareholders.find(s => s.id === id);
      return sum + (shareholder?.numberOfShares || 0);
    }, 0);
    const percentage = shareholderStats.totalShares > 0 
      ? (attendingShares / shareholderStats.totalShares) * 100 
      : 0;
    return {
      shares: attendingShares,
      percentage: percentage.toFixed(2),
      hasQuorum: percentage >= (selectedMeeting?.quorumRequired || 50),
    };
  };

  const assemblyMeetings = meetings.filter(m => 
    m.meetingType === 'ordinary' || m.meetingType === 'extraordinary' || m.meetingType === 'ordinary_assembly' || m.meetingType === 'extraordinary_assembly'
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      in_progress: 'bg-green-100 text-green-800 border-green-300',
      completed: 'bg-gray-100 text-gray-800 border-gray-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      // حالات القرارات
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      proposed: 'bg-sky-100 text-sky-800 border-sky-300',
      voting: 'bg-amber-100 text-amber-800 border-amber-300',
      approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      implemented: 'bg-green-100 text-green-900 border-green-400',
    };
    const labels: Record<string, string> = {
      scheduled: 'مجدولة',
      pending: 'قيد الانتظار',
      in_progress: 'جارية',
      completed: 'مكتملة',
      cancelled: 'ملغية',
      draft: 'مسودة',
      proposed: 'مقترح',
      voting: 'تحت التصويت',
      approved: 'معتمد',
      rejected: 'مرفوض',
      implemented: 'تم التنفيذ',
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{labels[status] || status}</Badge>;
  };

  const getMeetingTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      ordinary: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      extraordinary: 'bg-purple-100 text-purple-800 border-purple-300',
      ordinary_assembly: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      extraordinary_assembly: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    const labels: Record<string, string> = {
      ordinary: 'عادية',
      extraordinary: 'غير عادية',
      ordinary_assembly: 'عادية',
      extraordinary_assembly: 'غير عادية',
    };
    return <Badge className={styles[type] || 'bg-gray-100'}>{labels[type] || type}</Badge>;
  };

  const attendingIds = Object.entries(attendanceList).filter(([, v]) => v).map(([k]) => parseInt(k));
  const quorumData = calculateQuorum(attendingIds);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/governance">
            <Button variant="ghost" size="sm" className="gap-2 text-xs sm:text-sm">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">العودة للحوكمة</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2 sm:gap-3">
              <Building2 className="h-5 w-5 sm:h-7 sm:w-7 text-blue-600" />
              الجمعية العمومية
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">إدارة اجتماعات الجمعية العادية وغير العادية وفق نظام الشركات السعودي</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 text-xs sm:text-sm" onClick={() => setShowInvitations(true)}>
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">إرسال الدعوات</span>
            <span className="sm:hidden">دعوات</span>
          </Button>
          <Button className="gap-2 text-xs sm:text-sm" onClick={() => setShowNewMeeting(true)}>
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">اجتماع جديد</span>
            <span className="sm:hidden">جديد</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl text-xs sm:text-sm">
          <TabsTrigger value="overview" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">نظرة عامة</span>
            <span className="sm:hidden">عامة</span>
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">الاجتماعات</span>
            <span className="sm:hidden">اجتماعات</span>
          </TabsTrigger>
          <TabsTrigger value="shareholders" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">المساهمين</span>
            <span className="sm:hidden">مساهمين</span>
          </TabsTrigger>
          <TabsTrigger value="resolutions" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <Gavel className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">القرارات</span>
            <span className="sm:hidden">قرارات</span>
          </TabsTrigger>
        </TabsList>

        {/* نظرة عامة */}
        <TabsContent value="overview" className="space-y-6">
          {/* إحصائيات رئيسية */}
          <div className="kpi-grid">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-blue-600 font-medium">إجمالي المساهمين</p>
                    <p className="text-lg sm:text-xl md:text-3xl font-bold text-blue-800">{shareholderStats.totalMembers}</p>
                    <p className="text-[10px] sm:text-xs text-blue-500 mt-1">
                      {shareholderStats.activeMembers} نشط | {shareholderStats.foundingMembers} مؤسس
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-blue-200 rounded-full">
                    <Users className="h-5 w-5 sm:h-8 sm:w-8 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-amber-600 font-medium">إجمالي الأسهم</p>
                    <p className="text-lg sm:text-xl md:text-3xl font-bold text-amber-800">{shareholderStats.totalShares.toLocaleString('en-US')}</p>
                    <p className="text-[10px] sm:text-xs text-amber-500 mt-1">
                      {shareholderStats.votingPercentage}% لها حق التصويت
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-amber-200 rounded-full">
                    <PieChart className="h-5 w-5 sm:h-8 sm:w-8 text-amber-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-emerald-600 font-medium">جمعيات عادية</p>
                    <p className="text-lg sm:text-xl md:text-3xl font-bold text-emerald-800">{meetingStats.ordinary}</p>
                    <p className="text-[10px] sm:text-xs text-emerald-500 mt-1">
                      {meetingStats.scheduled} مجدولة
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-emerald-200 rounded-full">
                    <Calendar className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-purple-600 font-medium">جمعيات غير عادية</p>
                    <p className="text-lg sm:text-xl md:text-3xl font-bold text-purple-800">{meetingStats.extraordinary}</p>
                    <p className="text-[10px] sm:text-xs text-purple-500 mt-1">
                      {meetingStats.completed} مكتملة
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-purple-200 rounded-full">
                    <Gavel className="h-5 w-5 sm:h-8 sm:w-8 text-purple-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* الاجتماعات القادمة وأكبر المساهمين */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* الاجتماعات القادمة */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  الاجتماعات القادمة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meetingStats.upcoming.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد اجتماعات قادمة</p>
                    <Button size="sm" className="mt-3" onClick={() => setShowNewMeeting(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      جدولة اجتماع
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {meetingStats.upcoming.slice(0, 3).map((meeting) => (
                      <div key={meeting.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${meeting.meetingType === 'ordinary' || meeting.meetingType === 'ordinary_assembly' ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                            <Building2 className={`h-5 w-5 ${meeting.meetingType === 'ordinary' || meeting.meetingType === 'ordinary_assembly' ? 'text-emerald-600' : 'text-purple-600'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{meeting.title}</p>
                            <p className="text-sm text-gray-500">
                              {meeting.scheduledDate ? new Date(meeting.scheduledDate).toLocaleDateString('en-GB') : '-'}
                            </p>
                          </div>
                        </div>
                        {getMeetingTypeBadge(meeting.meetingType)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* أكبر المساهمين */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                  أكبر المساهمين
                </CardTitle>
              </CardHeader>
              <CardContent>
                {shareholders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد بيانات مساهمين</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...shareholders]
                      .sort((a, b) => (b.numberOfShares || 0) - (a.numberOfShares || 0))
                      .slice(0, 5)
                      .map((shareholder, index) => {
                        const percentage = shareholderStats.totalShares > 0 
                          ? ((shareholder.numberOfShares || 0) / shareholderStats.totalShares * 100).toFixed(1)
                          : 0;
                        return (
                          <div key={shareholder.id} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-amber-100 text-amber-700' :
                              index === 1 ? 'bg-gray-100 text-gray-700' :
                              index === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{shareholder.fullName}</span>
                                <span className="text-sm text-gray-600">{percentage}%</span>
                              </div>
                              <Progress value={Number(percentage)} className="h-2" />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* النصاب القانوني */}
          <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-600" />
                معلومات النصاب القانوني
              </CardTitle>
              <CardDescription>حسب نظام الشركات السعودي 1443هـ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <span className="font-semibold">الجمعية العادية</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">نصاب الانعقاد: 25% من رأس المال</p>
                  <p className="text-sm text-gray-600">الأغلبية المطلوبة: 50% + 1</p>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold">الجمعية غير العادية</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">نصاب الانعقاد: 50% من رأس المال</p>
                  <p className="text-sm text-gray-600">الأغلبية المطلوبة: 75%</p>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    <span className="font-semibold">قرارات خاصة</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">تعديل النظام الأساسي</p>
                  <p className="text-sm text-gray-600">الأغلبية المطلوبة: 75%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* الاجتماعات */}
        <TabsContent value="meetings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                اجتماعات الجمعية العمومية
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  تصدير
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  تحديث
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {meetingsLoading ? (
                <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
              ) : assemblyMeetings.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">لا توجد اجتماعات جمعية عمومية</p>
                  <p className="text-sm mb-4">قم بإنشاء اجتماع جديد للبدء</p>
                  <Button onClick={() => setShowNewMeeting(true)}>
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
                      <TableHead className="text-right">النصاب</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assemblyMeetings.map((meeting) => (
                      <TableRow key={meeting.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{meeting.title}</TableCell>
                        <TableCell>{getMeetingTypeBadge(meeting.meetingType)}</TableCell>
                        <TableCell>
                          {meeting.scheduledDate 
                            ? new Date(meeting.scheduledDate).toLocaleDateString('en-GB')
                            : '-'}
                        </TableCell>
                        <TableCell>{meeting.location || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{meeting.quorumRequired}%</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-meeting-${meeting.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => openEditDialog(meeting)} data-testid={`button-edit-meeting-${meeting.id}`}>
                                <Edit className="h-4 w-4 ml-2" />
                                تعديل الاجتماع
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedMeeting(meeting);
                                setShowAttendance(true);
                              }}>
                                <UserCheck className="h-4 w-4 ml-2" />
                                سجل الحضور
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedMeeting(meeting);
                                setShowAgenda(true);
                              }}>
                                <ClipboardList className="h-4 w-4 ml-2" />
                                جدول الأعمال
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setInvitationMeetingId(meeting.id);
                                setShowInvitations(true);
                                setInvitationResults(null);
                              }}>
                                <Send className="h-4 w-4 ml-2" />
                                إرسال الدعوات
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <RefreshCw className="h-4 w-4 ml-2" />
                                  تغيير الحالة
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => handleChangeStatus(meeting, 'scheduled')} disabled={meeting.status === 'scheduled'}>
                                    <CalendarCheck className="h-4 w-4 ml-2 text-blue-600" />
                                    مجدولة
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleChangeStatus(meeting, 'in_progress')} disabled={meeting.status === 'in_progress'}>
                                    <PlayCircle className="h-4 w-4 ml-2 text-green-600" />
                                    جاري الانعقاد
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleChangeStatus(meeting, 'completed')} disabled={meeting.status === 'completed'}>
                                    <CheckCircle className="h-4 w-4 ml-2 text-emerald-600" />
                                    مكتمل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleChangeStatus(meeting, 'postponed')} disabled={meeting.status === 'postponed'}>
                                    <PauseCircle className="h-4 w-4 ml-2 text-yellow-600" />
                                    مؤجل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleChangeStatus(meeting, 'cancelled')} disabled={meeting.status === 'cancelled'}>
                                    <Ban className="h-4 w-4 ml-2 text-red-600" />
                                    ملغي
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <Link href="/governance/voting">
                                <DropdownMenuItem>
                                  <Vote className="h-4 w-4 ml-2" />
                                  التصويت
                                </DropdownMenuItem>
                              </Link>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await printAssemblyMeeting(meeting as any);
                                  } catch (e) {
                                    console.error(e);
                                    toast({ title: "تعذر فتح نافذة الطباعة", variant: "destructive" });
                                  }
                                }}
                                data-testid={`button-print-meeting-${meeting.id}`}
                              >
                                <Printer className="h-4 w-4 ml-2" />
                                طباعة المحضر (مع التواقيع)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await exportAssemblyMeetingExcel(meeting as any);
                                    toast({ title: "تم تصدير المحضر بصيغة Excel" });
                                  } catch (e) {
                                    console.error(e);
                                    toast({ title: "تعذر تصدير المحضر", variant: "destructive" });
                                  }
                                }}
                                data-testid={`button-export-meeting-${meeting.id}`}
                              >
                                <Download className="h-4 w-4 ml-2" />
                                تصدير المحضر (Excel)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600"
                                onClick={() => {
                                  setDeletingMeeting(meeting);
                                  setShowDeleteConfirm(true);
                                }}
                                data-testid={`button-delete-meeting-${meeting.id}`}
                              >
                                <Trash2 className="h-4 w-4 ml-2" />
                                حذف الاجتماع
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* المساهمين */}
        <TabsContent value="shareholders" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 flex items-center gap-4">
                <Users className="h-10 w-10 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600">إجمالي المساهمين</p>
                  <p className="text-2xl font-bold text-blue-800">{shareholderStats.totalMembers}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4 flex items-center gap-4">
                <UserCheck className="h-10 w-10 text-emerald-600" />
                <div>
                  <p className="text-sm text-emerald-600">لهم حق التصويت</p>
                  <p className="text-2xl font-bold text-emerald-800">
                    {shareholders.filter(s => s.votingRights).length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex items-center gap-4">
                <PieChart className="h-10 w-10 text-amber-600" />
                <div>
                  <p className="text-sm text-amber-600">إجمالي الأسهم</p>
                  <p className="text-2xl font-bold text-amber-800">{shareholderStats.totalShares.toLocaleString('en-US')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                قائمة المساهمين
              </CardTitle>
              <Link href="/governance/shareholders">
                <Button variant="outline" size="sm" className="gap-2">
                  إدارة المساهمين
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {shareholdersLoading ? (
                <div className="text-center py-8">جاري التحميل...</div>
              ) : shareholders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>لا توجد بيانات مساهمين</p>
                  <Link href="/governance/shareholders">
                    <Button className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      إضافة مساهمين
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الهوية</TableHead>
                      <TableHead className="text-right">عدد الأسهم</TableHead>
                      <TableHead className="text-right">النسبة</TableHead>
                      <TableHead className="text-right">حق التصويت</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareholders.map((shareholder) => {
                      const percentage = shareholderStats.totalShares > 0 
                        ? ((shareholder.numberOfShares || 0) / shareholderStats.totalShares * 100).toFixed(2)
                        : 0;
                      return (
                        <TableRow key={shareholder.id}>
                          <TableCell className="font-medium">{shareholder.fullName}</TableCell>
                          <TableCell>{shareholder.nationalId || '-'}</TableCell>
                          <TableCell>{(shareholder.numberOfShares || 0).toLocaleString('en-US')}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{percentage}%</Badge>
                          </TableCell>
                          <TableCell>
                            {shareholder.votingRights ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={shareholder.memberType === 'founding' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}>
                              {shareholder.memberType === 'founding' ? 'مؤسس' : 'عادي'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={shareholder.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {shareholder.status === 'active' ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* القرارات */}
        <TabsContent value="resolutions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-indigo-600" />
                  قرارات الجمعية العمومية
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  قرارات الجمعيات العادية وغير العادية مع طباعة وتصدير رسمي يتضمن التواقيع وبيانات التصويت
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Link href="/governance/resolutions?type=general_assembly">
                  <Button variant="outline" className="gap-2" data-testid="button-new-resolution">
                    <Plus className="h-4 w-4" />
                    قرار جديد
                  </Button>
                </Link>
                <Link href="/governance/voting">
                  <Button className="gap-2" data-testid="button-electronic-voting">
                    <Vote className="h-4 w-4" />
                    التصويت الإلكتروني
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                // عرض قرارات الجمعية العمومية فقط (عادية وغير عادية)
                const assemblyResolutions = resolutions.filter((r) =>
                  ["general_assembly", "extraordinary_assembly", "ordinary", "extraordinary"].includes(r.resolutionType)
                );
                if (assemblyResolutions.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500" data-testid="empty-assembly-resolutions">
                      <Gavel className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p>لا توجد قرارات جمعية عمومية حالياً</p>
                      <Link href="/governance/resolutions?type=general_assembly">
                        <Button className="mt-4">
                          <Plus className="h-4 w-4 ml-2" />
                          إنشاء قرار جديد
                        </Button>
                      </Link>
                    </div>
                  );
                }
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">رقم القرار</TableHead>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">التصويت</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assemblyResolutions.slice(0, 20).map((resolution) => {
                        const linkedMeeting = resolution.meetingId
                          ? meetings.find((m) => m.id === resolution.meetingId)
                          : undefined;
                        const totalV = resolution.totalVotes || 0;
                        const forV = resolution.forVotes || 0;
                        const againstV = resolution.againstVotes || 0;
                        const abstainV = resolution.abstainVotes || 0;
                        return (
                          <TableRow key={resolution.id} data-testid={`row-resolution-${resolution.id}`}>
                            <TableCell className="font-mono text-xs" data-testid={`text-resolution-number-${resolution.id}`}>
                              {resolution.resolutionNumber}
                            </TableCell>
                            <TableCell className="font-medium max-w-[280px] truncate" title={resolution.title}>
                              {resolution.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {resolution.resolutionType === "extraordinary" || resolution.resolutionType === "extraordinary_assembly"
                                  ? "غير عادية"
                                  : "عادية"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {totalV > 0 ? (
                                <div className="flex gap-1 text-xs">
                                  <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200" title="موافق">
                                    ✓ {forV}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200" title="معارض">
                                    ✗ {againstV}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200" title="ممتنع">
                                    − {abstainV}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">لا يوجد</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(resolution.status)}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1" data-testid={`button-resolution-actions-${resolution.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                    إجراءات
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        await printAssemblyResolution(
                                          resolution as any,
                                          linkedMeeting
                                            ? {
                                                id: linkedMeeting.id,
                                                title: linkedMeeting.title,
                                                meetingType: linkedMeeting.meetingType,
                                                meetingDate: linkedMeeting.meetingDate,
                                                scheduledDate: linkedMeeting.scheduledDate,
                                                location: linkedMeeting.location,
                                              }
                                            : undefined
                                        );
                                      } catch (e) {
                                        console.error(e);
                                        toast({ title: "تعذر فتح نافذة الطباعة", variant: "destructive" });
                                      }
                                    }}
                                    data-testid={`menu-print-${resolution.id}`}
                                  >
                                    <Printer className="h-4 w-4 ml-2" />
                                    طباعة قرار رسمي (مع التواقيع)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        await exportAssemblyResolutionExcel(
                                          resolution as any,
                                          linkedMeeting
                                            ? {
                                                id: linkedMeeting.id,
                                                title: linkedMeeting.title,
                                                meetingType: linkedMeeting.meetingType,
                                                meetingDate: linkedMeeting.meetingDate,
                                                scheduledDate: linkedMeeting.scheduledDate,
                                                location: linkedMeeting.location,
                                              }
                                            : undefined
                                        );
                                        toast({ title: "تم تصدير القرار بصيغة Excel" });
                                      } catch (e) {
                                        console.error(e);
                                        toast({ title: "تعذر التصدير", variant: "destructive" });
                                      }
                                    }}
                                    data-testid={`menu-export-${resolution.id}`}
                                  >
                                    <Download className="h-4 w-4 ml-2" />
                                    تصدير Excel (بيانات + توقيعات)
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      // Already open for voting → just go manage the votes.
                                      if (resolution.status === "voting") {
                                        setLocation("/governance/voting");
                                        return;
                                      }

                                      const isDecided =
                                        resolution.status === "approved" || resolution.status === "rejected";
                                      const isLocked = Boolean((resolution as any).isLocked);

                                      // Re-opening a decided/locked resolution is a deliberate, audited action.
                                      // Capture an explicit reason for traceability.
                                      let reason: string | undefined;
                                      if (isDecided || isLocked) {
                                        const entered = window.prompt(
                                          isLocked
                                            ? "هذا القرار مقفل نظامياً. لإعادة فتح التصويت سيتم فتح القفل. اكتب سبب إعادة الفتح (سيُسجّل في سجل التدقيق):"
                                            : "هذا القرار محسوم (معتمد/مرفوض). اكتب سبب إعادة فتح التصويت عليه (سيُسجّل في سجل التدقيق):"
                                        );
                                        // Cancel → abort. Empty string is allowed.
                                        if (entered === null) return;
                                        reason = entered.trim();
                                      }

                                      try {
                                        // Single atomic endpoint: unlocks (if needed), sets status to "voting",
                                        // and writes the audit log in one transaction — no partial state.
                                        const res = await fetch(
                                          `/api/governance/resolutions/${resolution.id}/reopen-voting`,
                                          {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            credentials: "include",
                                            body: JSON.stringify({ reason }),
                                          }
                                        );
                                        if (res.ok) {
                                          queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
                                          toast({ title: "تم فتح التصويت على القرار" });
                                          setLocation("/governance/voting");
                                        } else {
                                          const err = await res.json().catch(() => ({}));
                                          toast({
                                            title: "تعذر فتح التصويت",
                                            description: err?.error || "حدث خطأ أثناء فتح التصويت على القرار.",
                                            variant: "destructive",
                                          });
                                        }
                                      } catch (e) {
                                        console.error("Failed to reopen voting:", e);
                                        toast({
                                          title: "تعذر فتح التصويت",
                                          description: "تعذر الاتصال بالخادم. حاول مرة أخرى.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    data-testid={`menu-vote-${resolution.id}`}
                                  >
                                    <Vote className="h-4 w-4 ml-2" />
                                    فتح التصويت / إدارة الأصوات
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setLocation(`/governance/resolutions?id=${resolution.id}`)}
                                    data-testid={`menu-details-${resolution.id}`}
                                  >
                                    <Eye className="h-4 w-4 ml-2" />
                                    تفاصيل القرار وإدارة التواقيع
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* نافذة إنشاء اجتماع جديد */}
      <Dialog open={showNewMeeting} onOpenChange={setShowNewMeeting}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-blue-600" />
              إنشاء اجتماع جمعية عمومية
            </DialogTitle>
            <DialogDescription className="text-sm">
              أدخل بيانات الاجتماع الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>عنوان الاجتماع *</Label>
              <Input
                value={newMeeting.title}
                onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                placeholder="مثال: الجمعية العمومية السنوية 2026"
              />
            </div>
            <div>
              <Label>نوع الجمعية *</Label>
              <Select
                value={newMeeting.meetingType}
                onValueChange={(v) => setNewMeeting({ ...newMeeting, meetingType: v, quorumRequired: v === 'ordinary' ? 25 : 50 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinary">جمعية عادية (نصاب 25%)</SelectItem>
                  <SelectItem value="extraordinary">جمعية غير عادية (نصاب 50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تاريخ ووقت الاجتماع *</Label>
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
                onChange={(e) => setNewMeeting({ ...newMeeting, quorumRequired: parseInt(e.target.value) || 25 })}
              />
            </div>
            <div className="col-span-2">
              <Label>جدول الأعمال</Label>
              <Textarea
                value={newMeeting.agenda}
                onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                placeholder="1. الافتتاح والترحيب&#10;2. التحقق من النصاب&#10;3. اعتماد جدول الأعمال&#10;4. ..."
                rows={4}
              />
            </div>

            {/* القرارات المطروحة للتصويت (٢ في واحد) */}
            <Separator className="col-span-2 my-1" />
            <div className="col-span-2 p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold flex items-center gap-2 text-gray-800">
                  <Gavel className="h-4 w-4 text-amber-600" />
                  القرارات المطروحة للتصويت (اختياري)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs shrink-0"
                  onClick={() => setNewMeeting({ ...newMeeting, resolutions: [...newMeeting.resolutions, { title: "", content: "" }] })}
                  data-testid="button-add-resolution"
                >
                  <Plus className="h-3 w-3" />
                  إضافة قرار
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                يمكنك إضافة قرار واحد أو أكثر. تُنشأ تلقائياً مربوطة بالاجتماع، ويُرسل نصّها للمساهمين مع الدعوة في رسالة واحدة.
              </p>
              {newMeeting.resolutions.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2" data-testid="text-no-resolutions">
                  لا توجد قرارات مضافة — اضغط "إضافة قرار" لطرح قرار للتصويت.
                </p>
              )}
              {newMeeting.resolutions.map((r, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-amber-200 p-2 space-y-2" data-testid={`card-resolution-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700">القرار {idx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      onClick={() => setNewMeeting({ ...newMeeting, resolutions: newMeeting.resolutions.filter((_, i) => i !== idx) })}
                      data-testid={`button-remove-resolution-${idx}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">عنوان القرار</Label>
                    <Input
                      value={r.title}
                      onChange={(e) => {
                        const updated = [...newMeeting.resolutions];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setNewMeeting({ ...newMeeting, resolutions: updated });
                      }}
                      placeholder="مثال: زيادة رأس مال الشركة"
                      data-testid={`input-resolution-title-${idx}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">نص القرار</Label>
                    <Textarea
                      value={r.content}
                      onChange={(e) => {
                        const updated = [...newMeeting.resolutions];
                        updated[idx] = { ...updated[idx], content: e.target.value };
                        setNewMeeting({ ...newMeeting, resolutions: updated });
                      }}
                      placeholder="اكتب نص القرار المطروح للتصويت على المساهمين..."
                      rows={3}
                      data-testid={`textarea-resolution-content-${idx}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* رابط الاجتماع */}
            <Separator className="col-span-2 my-1" />
            <div className="col-span-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Share2 className="h-4 w-4 text-blue-600" />
                رابط الاجتماع الإلكتروني
              </Label>
            </div>
            <div>
              <Label className="text-xs">المنصة</Label>
              <Select
                value={newMeeting.meetingPlatform}
                onValueChange={(v) => setNewMeeting({ ...newMeeting, meetingPlatform: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="teams">Teams</SelectItem>
                  <SelectItem value="meet">Meet</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الرابط</Label>
              <Input
                className="h-9"
                value={newMeeting.meetingLink}
                onChange={(e) => setNewMeeting({ ...newMeeting, meetingLink: e.target.value })}
                placeholder="https://..."
                dir="ltr"
              />
            </div>

            {/* إرسال الدعوات */}
            <Separator className="col-span-2 my-2" />
            <div className="col-span-2 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <Label className="text-sm font-semibold flex items-center gap-2 mb-3 text-gray-800">
                <Send className="h-5 w-5 text-green-600" />
                إرسال الدعوات للمساهمين
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div 
                  onClick={() => setNewMeeting({ ...newMeeting, sendWhatsApp: !newMeeting.sendWhatsApp })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                    newMeeting.sendWhatsApp 
                      ? 'bg-green-500 text-white shadow-lg scale-105' 
                      : 'bg-white border-2 border-gray-200 hover:border-green-400'
                  }`}
                >
                  <svg className={`h-8 w-8 ${newMeeting.sendWhatsApp ? 'text-white' : 'text-green-600'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className={`font-bold text-sm ${newMeeting.sendWhatsApp ? 'text-white' : 'text-green-700'}`}>واتساب</span>
                  {newMeeting.sendWhatsApp && <CheckCircle className="h-4 w-4 text-white" />}
                </div>
                <div 
                  onClick={() => setNewMeeting({ ...newMeeting, sendEmail: !newMeeting.sendEmail })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                    newMeeting.sendEmail 
                      ? 'bg-blue-500 text-white shadow-lg scale-105' 
                      : 'bg-white border-2 border-gray-200 hover:border-blue-400'
                  }`}
                >
                  <Mail className={`h-8 w-8 ${newMeeting.sendEmail ? 'text-white' : 'text-blue-600'}`} />
                  <span className={`font-bold text-sm ${newMeeting.sendEmail ? 'text-white' : 'text-blue-700'}`}>إيميل</span>
                  {newMeeting.sendEmail && <CheckCircle className="h-4 w-4 text-white" />}
                </div>
                <div 
                  onClick={() => setNewMeeting({ ...newMeeting, sendSMS: !newMeeting.sendSMS })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                    newMeeting.sendSMS 
                      ? 'bg-purple-500 text-white shadow-lg scale-105' 
                      : 'bg-white border-2 border-gray-200 hover:border-purple-400'
                  }`}
                >
                  <Phone className={`h-8 w-8 ${newMeeting.sendSMS ? 'text-white' : 'text-purple-600'}`} />
                  <span className={`font-bold text-sm ${newMeeting.sendSMS ? 'text-white' : 'text-purple-700'}`}>رسالة SMS</span>
                  {newMeeting.sendSMS && <CheckCircle className="h-4 w-4 text-white" />}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-600 text-center">
                  سيتم إرسال الدعوة تلقائياً إلى <strong>{shareholders.filter(s => s.votingRights && s.phone).length}</strong> مساهم لديهم أرقام جوال مسجلة
                </p>
                {shareholders.filter(s => s.votingRights).length > 0 && (
                  <div className="bg-white rounded-lg p-2 max-h-32 overflow-y-auto text-xs space-y-1">
                    {shareholders.filter(s => s.votingRights).map(s => (
                      <div key={s.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50">
                        <span className="font-medium">{s.fullName}</span>
                        {s.phone ? (
                          <span className="text-green-600 flex items-center gap-1" dir="ltr">
                            <CheckCircle className="h-3 w-3" />
                            {s.phone}
                          </span>
                        ) : (
                          <span className="text-red-500 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            لا يوجد رقم
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowNewMeeting(false)}>إلغاء</Button>
            <Button 
              size="sm"
              onClick={() => createMeetingMutation.mutate(newMeeting)}
              disabled={!newMeeting.title || !newMeeting.scheduledDate || createMeetingMutation.isPending}
              className="gap-1"
            >
              {createMeetingMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الاجتماع'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تنبيه مدة الإشعار غير الكافية (تجاوز للمدير فقط) */}
      <AlertDialog open={!!noticeForcePrompt} onOpenChange={(open) => { if (!open) setNoticeForcePrompt(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              مدة الإشعار غير كافية
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-relaxed">
              {noticeForcePrompt}
              <br />
              {isAdmin
                ? "بصفتك مديراً يمكنك تجاوز هذا الشرط وإنشاء الاجتماع على مسؤوليتك (سيتم تسجيل التجاوز في سجل المراجعة). هل تريد المتابعة؟"
                : "يرجى تعديل تاريخ الاجتماع ليتوافق مع مدة الإشعار النظامية."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="button-cancel-force-meeting">تعديل التاريخ</AlertDialogCancel>
            {isAdmin && (
              <AlertDialogAction
                data-testid="button-force-create-meeting"
                disabled={createMeetingMutation.isPending}
                onClick={(e) => { e.preventDefault(); createMeetingMutation.mutate({ ...newMeeting, force: true }); }}
              >
                {createMeetingMutation.isPending ? 'جاري الإنشاء...' : 'تجاوز وإنشاء الاجتماع'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* نافذة تسجيل الحضور */}
      <Dialog open={showAttendance} onOpenChange={setShowAttendance}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              تسجيل حضور المساهمين
            </DialogTitle>
            <DialogDescription>
              {selectedMeeting?.title}
            </DialogDescription>
          </DialogHeader>
          
          {/* ملخص النصاب */}
          <Card className={`${quorumData.hasQuorum ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {quorumData.hasQuorum ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-yellow-600" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {quorumData.hasQuorum ? 'تم اكتمال النصاب' : 'النصاب غير مكتمل'}
                    </p>
                    <p className="text-sm text-gray-600">
                      الأسهم الحاضرة: {quorumData.shares.toLocaleString('en-US')} ({quorumData.percentage}%)
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm text-gray-600">النصاب المطلوب</p>
                  <p className="text-xl font-bold">{selectedMeeting?.quorumRequired || 50}%</p>
                </div>
              </div>
              <Progress 
                value={Number(quorumData.percentage)} 
                className="mt-3 h-3"
              />
            </CardContent>
          </Card>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-12">حاضر</TableHead>
                <TableHead className="text-right">المساهم</TableHead>
                <TableHead className="text-right">عدد الأسهم</TableHead>
                <TableHead className="text-right">النسبة</TableHead>
                <TableHead className="text-right">التوكيل (اختياري)</TableHead>
                <TableHead className="text-right">التوقيع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shareholders.filter(s => s.votingRights).map((shareholder) => {
                const percentage = shareholderStats.totalShares > 0 
                  ? ((shareholder.numberOfShares || 0) / shareholderStats.totalShares * 100).toFixed(2)
                  : 0;
                return (
                  <TableRow key={shareholder.id}>
                    <TableCell>
                      <Checkbox
                        checked={attendanceList[shareholder.id] || false}
                        onCheckedChange={(checked) => 
                          setAttendanceList({ ...attendanceList, [shareholder.id]: !!checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{shareholder.fullName}</TableCell>
                    <TableCell>{(shareholder.numberOfShares || 0).toLocaleString('en-US')}</TableCell>
                    <TableCell>{percentage}%</TableCell>
                    <TableCell>
                      <Input
                        placeholder="اسم الموكَّل"
                        value={proxyList[shareholder.id] || ''}
                        onChange={(e) => setProxyList({ ...proxyList, [shareholder.id]: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      {signatureList[shareholder.id] ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={signatureList[shareholder.id]}
                            alt="توقيع"
                            className="h-8 w-20 object-contain border rounded bg-white"
                            data-testid={`img-signature-preview-${shareholder.id}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            disabled={!attendanceList[shareholder.id]}
                            onClick={() => setSigningShareholderId(shareholder.id)}
                            data-testid={`button-resign-${shareholder.id}`}
                          >
                            تعديل
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={!attendanceList[shareholder.id]}
                          onClick={() => setSigningShareholderId(shareholder.id)}
                          data-testid={`button-sign-${shareholder.id}`}
                        >
                          توقيع
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttendance(false)}>إلغاء</Button>
            <Button 
              className="gap-2"
              onClick={async () => {
                if (!selectedMeeting) return;
                const nowIso = new Date().toISOString();
                const attendees = shareholders.filter(s => s.votingRights).map(s => ({
                  shareholderId: s.id,
                  attendeeName: s.fullName,
                  representedShares: s.numberOfShares || 0,
                  present: attendanceList[s.id] || false,
                  proxyName: proxyList[s.id] || null,
                  votingPower: shareholderStats.totalShares > 0 
                    ? ((s.numberOfShares || 0) / shareholderStats.totalShares * 100).toFixed(4)
                    : "0",
                  signatureUrl: (attendanceList[s.id] && signatureList[s.id]) ? signatureList[s.id] : null,
                  signedAt: (attendanceList[s.id] && signatureList[s.id]) ? nowIso : null,
                }));
                try {
                  const res = await fetch(`/api/governance/meetings/${selectedMeeting.id}/attendance/bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ attendees }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    toast({ title: `تم حفظ سجل الحضور بنجاح (${data.saved} مساهم)` });
                    setShowAttendance(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
                  } else {
                    const err = await res.json();
                    toast({ title: err.error || "فشل في حفظ سجل الحضور", variant: "destructive" });
                  }
                } catch (e) {
                  toast({ title: "فشل في حفظ سجل الحضور", variant: "destructive" });
                }
              }}
            >
              <CheckSquare className="h-4 w-4" />
              حفظ الحضور
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة رسم التوقيع */}
      <Dialog open={signingShareholderId !== null} onOpenChange={(open) => { if (!open) setSigningShareholderId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>توقيع المساهم</DialogTitle>
            <DialogDescription>
              {shareholders.find(s => s.id === signingShareholderId)?.fullName}
            </DialogDescription>
          </DialogHeader>
          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
            <SignatureCanvas
              ref={(ref) => { sigPadRef.current = ref; }}
              penColor="black"
              backgroundColor="rgba(255,255,255,1)"
              canvasProps={{ className: "w-full h-48 rounded-lg", "data-testid": "canvas-signature" } as any}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">ارسم توقيعك بالإصبع أو الفأرة في المساحة أعلاه</p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => sigPadRef.current?.clear()}
              data-testid="button-clear-signature"
            >
              مسح
            </Button>
            <Button
              variant="outline"
              onClick={() => setSigningShareholderId(null)}
              data-testid="button-cancel-signature"
            >
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
                  toast({ title: "يرجى رسم التوقيع أولاً", variant: "destructive" });
                  return;
                }
                if (signingShareholderId === null) return;
                const dataUrl = sigPadRef.current.toDataURL("image/png");
                setSignatureList({ ...signatureList, [signingShareholderId]: dataUrl });
                setSigningShareholderId(null);
              }}
              data-testid="button-save-signature"
            >
              حفظ التوقيع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة جدول الأعمال */}
      <Dialog open={showAgenda} onOpenChange={setShowAgenda}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              جدول الأعمال
            </DialogTitle>
            <DialogDescription>
              {selectedMeeting?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMeeting?.agenda ? (
              <div className="whitespace-pre-wrap p-4 bg-gray-50 rounded-lg border">
                {selectedMeeting.agenda}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لم يتم تحديد جدول أعمال لهذا الاجتماع</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgenda(false)}>إغلاق</Button>
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة إرسال الدعوات عبر واتساب */}
      <Dialog open={showInvitations} onOpenChange={(open) => { 
        setShowInvitations(open); 
        if (!open) { setInvitationResults(null); setInvitationMeetingId(null); }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              إرسال دعوات واتساب للمساهمين
            </DialogTitle>
            <DialogDescription>
              إرسال دعوات الاجتماع عبر واتساب و SMS للمساهمين المسجلين بأرقام جوالاتهم
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* اختيار الاجتماع */}
            <div>
              <Label className="text-sm font-semibold">اختر الاجتماع</Label>
              <Select 
                value={invitationMeetingId?.toString() || ""} 
                onValueChange={(val) => { setInvitationMeetingId(parseInt(val)); setInvitationResults(null); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر اجتماع الجمعية العمومية" />
                </SelectTrigger>
                <SelectContent>
                  {assemblyMeetings.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id.toString()}>
                      {meeting.title} - {(meeting.meetingDate || meeting.scheduledDate) ? new Date(meeting.meetingDate || meeting.scheduledDate).toLocaleDateString('en-GB') : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* قنوات الإرسال */}
            <div className="grid grid-cols-2 gap-3">
              <div 
                onClick={() => setInvitationChannels(prev => ({ ...prev, sendWhatsApp: !prev.sendWhatsApp }))}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                  invitationChannels.sendWhatsApp 
                    ? 'bg-green-50 border-green-500 shadow-sm' 
                    : 'border-gray-200 hover:border-green-300'
                }`}
                data-testid="toggle-whatsapp-channel"
              >
                <svg className={`h-7 w-7 ${invitationChannels.sendWhatsApp ? 'text-green-600' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <div>
                  <p className="font-semibold text-sm">واتساب</p>
                  <p className="text-xs text-gray-500">رسالة دعوة كاملة</p>
                </div>
                {invitationChannels.sendWhatsApp && <CheckCircle className="h-5 w-5 text-green-600 mr-auto" />}
              </div>
              <div 
                onClick={() => setInvitationChannels(prev => ({ ...prev, sendSMS: !prev.sendSMS }))}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                  invitationChannels.sendSMS 
                    ? 'bg-purple-50 border-purple-500 shadow-sm' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                data-testid="toggle-sms-channel"
              >
                <Phone className={`h-7 w-7 ${invitationChannels.sendSMS ? 'text-purple-600' : 'text-gray-400'}`} />
                <div>
                  <p className="font-semibold text-sm">رسالة SMS</p>
                  <p className="text-xs text-gray-500">رسالة نصية مختصرة</p>
                </div>
                {invitationChannels.sendSMS && <CheckCircle className="h-5 w-5 text-purple-600 mr-auto" />}
              </div>
            </div>

            {/* قائمة المساهمين وأرقامهم */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-3 flex items-center justify-between border-b">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  المساهمون وأرقام الجوال المسجلة
                </span>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                    <Phone className="h-3 w-3 ml-1" />
                    {shareholders.filter(s => s.phone && s.votingRights).length} لديه رقم
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                    <XCircle className="h-3 w-3 ml-1" />
                    {shareholders.filter(s => !s.phone && s.votingRights).length} بدون رقم
                  </Badge>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="text-right w-8">#</TableHead>
                    <TableHead className="text-right">المساهم</TableHead>
                    <TableHead className="text-right">رقم الجوال</TableHead>
                    <TableHead className="text-right">النسبة</TableHead>
                    <TableHead className="text-right w-28">تأكيد الحضور</TableHead>
                    <TableHead className="text-right w-24">حالة الإرسال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shareholders.filter(s => s.votingRights).map((shareholder, idx) => {
                    const resultForShareholder = invitationResults?.results?.filter(
                      (r: any) => r.name === shareholder.fullName
                    );
                    return (
                      <TableRow key={shareholder.id} className="text-sm">
                        <TableCell className="text-gray-500">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{shareholder.fullName}</TableCell>
                        <TableCell dir="ltr" className="text-left">
                          {shareholder.phone ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <Phone className="h-3 w-3" />
                              {shareholder.phone}
                            </span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              غير مسجل
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{shareholder.sharePercentage ? `${Number(shareholder.sharePercentage).toFixed(2)}%` : '-'}</TableCell>
                        <TableCell>
                          {(() => {
                            const rsvp = meetingRsvps.find((r: any) => r.shareholderId === shareholder.id);
                            if (!rsvp) return <span className="text-xs text-gray-400">-</span>;
                            if (rsvp.status === 'confirmed') return (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                <CheckCircle className="h-3 w-3 ml-1" />
                                أكد الحضور
                              </Badge>
                            );
                            if (rsvp.status === 'declined') return (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                                <XCircle className="h-3 w-3 ml-1" />
                                اعتذر
                              </Badge>
                            );
                            return (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                <Clock className="h-3 w-3 ml-1" />
                                بانتظار الرد
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {invitationResults ? (
                            resultForShareholder && resultForShareholder.length > 0 ? (
                              <div className="space-y-1">
                                {resultForShareholder.map((r: any, i: number) => {
                                  const whatsappLink = invitationResults?.whatsappLinks?.find(
                                    (l: any) => l.name === shareholder.fullName
                                  );
                                  if (!r.success && r.channel === 'whatsapp' && whatsappLink) {
                                    return (
                                      <a 
                                        key={i}
                                        href={whatsappLink.whatsappLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 hover:bg-green-200 transition-colors border border-green-300 cursor-pointer"
                                        data-testid={`link-whatsapp-${shareholder.id}`}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        أرسل عبر واتساب
                                      </a>
                                    );
                                  }
                                  return (
                                    <Badge key={i} variant="outline" className={`text-xs ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                      {r.channel === 'whatsapp' ? 'واتس' : 'SMS'}: {r.success ? 'تم' : 'فشل'}
                                    </Badge>
                                  );
                                })}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500">
                                {shareholder.phone ? 'لم يُرسل' : 'لا يوجد رقم'}
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* نتائج الإرسال */}
            {invitationResults && (
              <div className={`p-4 rounded-lg border ${invitationResults.failed > 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {invitationResults.failed > 0 ? (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span className="font-semibold">نتائج الإرسال</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-green-600">{invitationResults.sent}</p>
                    <p className="text-xs text-gray-600">تم الإرسال</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-red-600">{invitationResults.failed}</p>
                    <p className="text-xs text-gray-600">فشل</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-gray-600">{invitationResults.totalShareholders || '-'}</p>
                    <p className="text-xs text-gray-600">إجمالي المساهمين</p>
                  </div>
                </div>
                {invitationResults.whatsappLinks?.length > 0 && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 font-medium mb-2 text-sm flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      يمكنك إرسال الدعوات يدوياً عبر واتساب بالضغط على الروابط أعلاه
                    </p>
                    <p className="text-green-700 text-xs">
                      الإرسال التلقائي غير متاح حالياً. اضغط على "أرسل عبر واتساب" بجانب كل مساهم لفتح محادثة واتساب مع نص الدعوة جاهز.
                    </p>
                  </div>
                )}
                {invitationResults.withoutPhones?.length > 0 && (
                  <div className="mt-3 p-2 bg-white rounded text-xs">
                    <p className="text-red-600 font-medium mb-1">مساهمون بدون أرقام جوال:</p>
                    <p className="text-gray-600">{invitationResults.withoutPhones.map((s: any) => s.name).join('، ')}</p>
                  </div>
                )}
              </div>
            )}

            {meetingRsvps.length > 0 && (
              <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">ملخص تأكيدات الحضور</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center p-2 bg-white rounded border border-green-200">
                    <p className="text-lg font-bold text-green-600">{meetingRsvps.filter((r: any) => r.status === 'confirmed').length}</p>
                    <p className="text-xs text-gray-600">أكدوا الحضور</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-red-200">
                    <p className="text-lg font-bold text-red-600">{meetingRsvps.filter((r: any) => r.status === 'declined').length}</p>
                    <p className="text-xs text-gray-600">اعتذروا</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-yellow-200">
                    <p className="text-lg font-bold text-yellow-600">{meetingRsvps.filter((r: any) => r.status === 'pending').length}</p>
                    <p className="text-xs text-gray-600">بانتظار الرد</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowInvitations(false); setInvitationResults(null); }}>إغلاق</Button>
            <Button 
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => {
                if (invitationMeetingId) {
                  sendInvitationsMutation.mutate({ 
                    meetingId: invitationMeetingId, 
                    channels: invitationChannels 
                  });
                }
              }}
              disabled={!invitationMeetingId || (!invitationChannels.sendWhatsApp && !invitationChannels.sendSMS) || sendInvitationsMutation.isPending}
              data-testid="button-send-invitations"
            >
              {sendInvitationsMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  إرسال الدعوات
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تعديل الاجتماع */}
      <Dialog open={showEditMeeting} onOpenChange={(open) => { setShowEditMeeting(open); if (!open) setEditingMeeting(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              تعديل الاجتماع
            </DialogTitle>
            <DialogDescription>تعديل بيانات اجتماع الجمعية العمومية</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>عنوان الاجتماع *</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                data-testid="input-edit-meeting-title"
              />
            </div>
            <div>
              <Label>نوع الاجتماع</Label>
              <Select
                value={editForm.meetingType}
                onValueChange={(v) => setEditForm({ ...editForm, meetingType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinary">عادية</SelectItem>
                  <SelectItem value="extraordinary">غير عادية</SelectItem>
                  <SelectItem value="board">مجلس إدارة</SelectItem>
                  <SelectItem value="committee">لجنة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>حالة الاجتماع</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">مجدولة</SelectItem>
                  <SelectItem value="in_progress">جاري الانعقاد</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="postponed">مؤجل</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تاريخ ووقت الاجتماع</Label>
              <Input
                type="datetime-local"
                value={editForm.meetingDate}
                onChange={(e) => setEditForm({ ...editForm, meetingDate: e.target.value })}
              />
            </div>
            <div>
              <Label>مكان الانعقاد</Label>
              <Input
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="مثال: المقر الرئيسي - قاعة الاجتماعات"
              />
            </div>
            <div>
              <Label>نوع الموقع</Label>
              <Select
                value={editForm.locationType}
                onValueChange={(v) => setEditForm({ ...editForm, locationType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">حضوري</SelectItem>
                  <SelectItem value="virtual">افتراضي (أون لاين)</SelectItem>
                  <SelectItem value="hybrid">مختلط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>نسبة النصاب المطلوب (%)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={editForm.quorumRequired}
                onChange={(e) => setEditForm({ ...editForm, quorumRequired: parseInt(e.target.value) || 50 })}
              />
            </div>
            {(editForm.locationType === 'virtual' || editForm.locationType === 'hybrid') && (
              <div className="col-span-2">
                <Label>رابط الاجتماع الإلكتروني</Label>
                <Input
                  value={editForm.virtualMeetingLink}
                  onChange={(e) => setEditForm({ ...editForm, virtualMeetingLink: e.target.value })}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>
            )}
            <div className="col-span-2">
              <Label>الوصف</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="وصف تفصيلي للاجتماع..."
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>جدول الأعمال</Label>
              <Textarea
                value={editForm.agenda}
                onChange={(e) => setEditForm({ ...editForm, agenda: e.target.value })}
                placeholder="1. الافتتاح والترحيب&#10;2. التحقق من النصاب&#10;3. ..."
                rows={4}
              />
            </div>
            <div className="col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowEditMeeting(false); setEditingMeeting(null); }}>إلغاء</Button>
            <Button 
              onClick={handleUpdateMeeting}
              disabled={!editForm.title || updateMeetingMutation.isPending}
              className="gap-2"
              data-testid="button-save-edit-meeting"
            >
              {updateMeetingMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تأكيد الحذف */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف الاجتماع
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف الاجتماع "{deletingMeeting?.title}"؟
              <br />
              <span className="text-red-500 font-medium">هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع البيانات المرتبطة بالاجتماع.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => { setShowDeleteConfirm(false); setDeletingMeeting(null); }}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 gap-2"
              onClick={() => {
                if (deletingMeeting) {
                  deleteMeetingMutation.mutate(deletingMeeting.id);
                }
              }}
              disabled={deleteMeetingMutation.isPending}
              data-testid="button-confirm-delete-meeting"
            >
              {deleteMeetingMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف الاجتماع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
