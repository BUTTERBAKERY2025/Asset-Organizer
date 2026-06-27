import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Scale,
  Plus,
  ChevronLeft,
  Search,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Eye,
  Edit,
  Send,
  Vote,
  Workflow,
  PenLine,
  Download,
  Printer,
  Users,
  History,
  ArrowRight,
  CheckCheck,
  Copy,
  Link as LinkIcon,
  Loader2,
  Share2,
  Trash2,
  Lock,
  Unlock,
  RotateCcw,
} from "lucide-react";
import type { BoardResolution, BoardMember } from "@shared/schema";
import companyStampSvg from "@assets/company-stamp.svg?raw";
import officialLetterhead from "@assets/official-letterhead.png?inline";
import { exportToExcel, exportToCSV, printAsPDF } from "@/lib/export-utils";

const resolutionTypes = [
  { value: "regular", label: "قرار عادي" },
  { value: "circular", label: "قرار بالتمرير" },
  { value: "emergency", label: "قرار طارئ" },
  { value: "administrative", label: "قرار إداري" },
  { value: "financial", label: "قرار مالي" },
  { value: "general_assembly", label: "محضر الجمعية العمومية" },
  { value: "extraordinary_assembly", label: "محضر الجمعية العمومية غير العادية" },
];

const resolutionStatuses = [
  { value: "draft", label: "مسودة", color: "bg-gray-100 text-gray-800", icon: FileText },
  { value: "review", label: "قيد المراجعة", color: "bg-purple-100 text-purple-800", icon: Eye },
  { value: "proposed", label: "مقترح", color: "bg-blue-100 text-blue-800", icon: Send },
  { value: "voting", label: "قيد التصويت", color: "bg-yellow-100 text-yellow-800", icon: Vote },
  { value: "approved", label: "معتمد", color: "bg-green-100 text-green-800", icon: CheckCircle },
  { value: "rejected", label: "مرفوض", color: "bg-red-100 text-red-800", icon: XCircle },
  { value: "implemented", label: "منفذ", color: "bg-emerald-100 text-emerald-800", icon: CheckCheck },
];

const categories = [
  { value: "financial", label: "مالي" },
  { value: "operational", label: "تشغيلي" },
  { value: "strategic", label: "استراتيجي" },
  { value: "hr", label: "موارد بشرية" },
  { value: "legal", label: "قانوني" },
  { value: "governance", label: "حوكمة" },
];

const priorities = [
  { value: "low", label: "منخفضة", color: "bg-gray-100 text-gray-800" },
  { value: "medium", label: "متوسطة", color: "bg-blue-100 text-blue-800" },
  { value: "high", label: "عالية", color: "bg-amber-100 text-amber-800" },
  { value: "urgent", label: "عاجلة", color: "bg-red-100 text-red-800" },
];

const workflowSteps = [
  { id: 1, name: "إنشاء المسودة", status: "draft" },
  { id: 2, name: "مراجعة داخلية", status: "review" },
  { id: 3, name: "رفع للتصويت", status: "proposed" },
  { id: 4, name: "التصويت", status: "voting" },
  { id: 5, name: "الاعتماد", status: "approved" },
  { id: 6, name: "التنفيذ", status: "implemented" },
];

export default function ResolutionsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedResolution, setSelectedResolution] = useState<BoardResolution | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingResolution, setEditingResolution] = useState<BoardResolution | null>(null);
  const [deleteResolutionId, setDeleteResolutionId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: resolutions = [], isLoading } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
  });

  const { data: members = [] } = useQuery<BoardMember[]>({
    queryKey: ["/api/governance/board-members"],
  });

  interface ResolutionSignature {
    id: number;
    resolutionId: number;
    boardMemberId: number;
    signatureToken: string;
    signatureData: string | null;
    signatureType: string;
    status: string;
    signedAt: string | null;
    declinedAt: string | null;
    declineReason: string | null;
    expiresAt: string | null;
    createdAt: string;
    memberName: string;
    memberPosition: string;
    memberEmail: string;
  }

  const { data: signatures = [], refetch: refetchSignatures } = useQuery<ResolutionSignature[]>({
    queryKey: ["/api/governance/resolutions", selectedResolution?.id, "signatures"],
    queryFn: async () => {
      if (!selectedResolution?.id) return [];
      const res = await fetch(`/api/governance/resolutions/${selectedResolution.id}/signatures`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!selectedResolution?.id && showSignatures,
  });

  const createSignatureRequestsMutation = useMutation({
    mutationFn: async ({ resolutionId, scope }: { resolutionId: number; scope?: "chairman_secretary" | "all" }) => {
      const res = await fetch(`/api/governance/resolutions/${resolutionId}/signatures/create-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 7, scope }),
      });
      if (!res.ok) throw new Error("Failed to create signature requests");
      return res.json();
    },
    onSuccess: (data) => {
      refetchSignatures();
      toast({ title: `تم إنشاء ${data.created} طلب توقيع جديد` });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء طلبات التوقيع", variant: "destructive" });
    },
  });

  const getSigningUrl = (token: string) => {
    return `${window.location.origin}/sign-resolution.html?token=${token}`;
  };

  const copySigningUrl = async (token: string) => {
    const url = getSigningUrl(token);
    await navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ رابط التوقيع" });
  };

  const createMutation = useMutation({
    mutationFn: async (data: Partial<BoardResolution>) => {
      const res = await fetch("/api/governance/resolutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let serverMsg = "Failed to create resolution";
        try {
          const body = await res.json();
          serverMsg = body?.error || body?.message || serverMsg;
        } catch {}
        throw new Error(serverMsg);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setIsDialogOpen(false);
      toast({ title: "تم إنشاء القرار بنجاح" });
    },
    onError: (err: any) => {
      toast({
        title: "فشل في إنشاء القرار",
        description: err?.message || "حدث خطأ غير معروف",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BoardResolution> }) => {
      const res = await fetch(`/api/governance/resolutions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update resolution");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setShowEditDialog(false);
      setEditingResolution(null);
      toast({ title: "تم تحديث القرار بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث القرار", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const res = await fetch(`/api/governance/resolutions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason || "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "فشل في حذف القرار");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions-trash"] });
      setDeleteResolutionId(null);
      setDeleteReason("");
      toast({ title: "تم نقل القرار إلى سلة المحذوفات", description: "يمكنك استرجاعه من سلة المحذوفات في أي وقت" });
    },
    onError: (e: any) => {
      toast({ title: "تعذّر الحذف", description: e?.message, variant: "destructive" });
    },
  });

  // Recycle bin (سلة المحذوفات) — soft-deleted resolutions, restorable.
  const [showTrash, setShowTrash] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const { data: trashedResolutions = [], isLoading: trashLoading } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions-trash"],
    enabled: showTrash,
  });
  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/resolutions/${id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "فشل في استرجاع القرار");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions-trash"] });
      toast({ title: "تم استرجاع القرار بنجاح" });
    },
    onError: (e: any) => {
      toast({ title: "فشل الاسترجاع", description: e?.message, variant: "destructive" });
    },
  });

  const [lockResolutionId, setLockResolutionId] = useState<number | null>(null);
  const lockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/resolutions/${id}/lock`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to lock resolution");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setLockResolutionId(null);
      toast({ title: "تم قفل القرار نهائياً", description: "أصبح غير قابل للتعديل أو الحذف أو التصويت" });
    },
    onError: (e: any) => {
      toast({ title: "فشل قفل القرار", description: e?.message, variant: "destructive" });
    },
  });

  const [unlockResolutionId, setUnlockResolutionId] = useState<number | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const unlockMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/governance/resolutions/${id}/unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to unlock resolution");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setUnlockResolutionId(null);
      setUnlockReason("");
      toast({ title: "تم فتح قفل القرار", description: "أصبح قابلاً للتعديل الآن" });
    },
    onError: (e: any) => {
      toast({ title: "فشل فتح قفل القرار", description: e?.message, variant: "destructive" });
    },
  });

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingResolution) return;
    const formData = new FormData(e.currentTarget);
    const deadlineStr = formData.get("implementationDeadline") as string;
    const data = {
      resolutionType: formData.get("resolutionType") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      priority: formData.get("priority") as string,
      status: formData.get("status") as string,
      implementationDeadline: deadlineStr || undefined,
    };
    if ((editingResolution as any).isLocked) {
      toast({ title: "القرار مقفل ولا يمكن تعديله", variant: "destructive" });
      setShowEditDialog(false);
      return;
    }
    updateMutation.mutate({ id: editingResolution.id, data });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const deadlineStr = formData.get("implementationDeadline") as string;
    const data = {
      resolutionType: formData.get("resolutionType") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      priority: formData.get("priority") as string,
      implementationDeadline: deadlineStr || undefined,
    };
    createMutation.mutate(data);
  };

  const search = useSearch();
  const meetingIdFilter = useMemo(() => {
    const params = new URLSearchParams(search);
    const v = params.get("meetingId");
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }, [search]);

  // النوع الافتراضي عند الإنشاء (يُمرَّر من صفحة الجمعية العمومية عبر ?type=)
  const createTypeParam = useMemo(() => {
    const params = new URLSearchParams(search);
    const t = params.get("type");
    const valid = resolutionTypes.map((rt) => rt.value);
    return t && valid.includes(t) ? t : null;
  }, [search]);
  const defaultResolutionType = createTypeParam ?? "regular";

  useEffect(() => {
    if (createTypeParam) setIsDialogOpen(true);
  }, [createTypeParam]);

  const filteredResolutions = resolutions.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesMeeting = meetingIdFilter === null || r.meetingId === meetingIdFilter;
    const matchesTab = activeTab === "all" || 
      (activeTab === "pending" && (r.status === "draft" || r.status === "proposed" || r.status === "voting")) ||
      (activeTab === "approved" && r.status === "approved") ||
      (activeTab === "rejected" && r.status === "rejected") ||
      (activeTab === "implemented" && r.status === "implemented");
    return matchesSearch && matchesStatus && matchesTab && matchesMeeting;
  });

  const draftCount = resolutions.filter(r => r.status === "draft").length;
  const votingCount = resolutions.filter(r => r.status === "voting").length;
  const approvedCount = resolutions.filter(r => r.status === "approved").length;
  const implementedCount = resolutions.filter(r => r.status === "implemented").length;

  const getStatusBadge = (status: string) => {
    const statusInfo = resolutionStatuses.find(s => s.value === status);
    return statusInfo ? (
      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
    ) : null;
  };

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return null;
    const priorityInfo = priorities.find(p => p.value === priority);
    return priorityInfo ? (
      <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
    ) : null;
  };

  const getCurrentWorkflowStep = (status: string) => {
    const stepIndex = workflowSteps.findIndex(s => s.status === status);
    return stepIndex >= 0 ? stepIndex + 1 : 1;
  };

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={Scale}
          tone="executive"
          title="القرارات والتوصيات"
          description="سير العمل والتوقيع الإلكتروني"
          backHref="/governance"
          actions={
            <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "resolutionNumber", header: "رقم القرار", width: 15 },
                    { key: "title", header: "العنوان", width: 40 },
                    { key: "resolutionType", header: "النوع", width: 15 },
                    { key: "category", header: "التصنيف", width: 12 },
                    { key: "status", header: "الحالة", width: 12 },
                    { key: "forVotes", header: "موافق", width: 12 },
                    { key: "againstVotes", header: "رافض", width: 12 },
                    { key: "totalVotes", header: "الإجمالي", width: 12 },
                  ];
                  exportToExcel(filteredResolutions, exportColumns, "قرارات_مجلس_الإدارة", "القرارات");
                }}>
                  Excel تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "resolutionNumber", header: "رقم القرار", width: 15 },
                    { key: "title", header: "العنوان", width: 40 },
                    { key: "resolutionType", header: "النوع", width: 15 },
                    { key: "category", header: "التصنيف", width: 12 },
                    { key: "status", header: "الحالة", width: 12 },
                    { key: "forVotes", header: "موافق", width: 12 },
                    { key: "againstVotes", header: "رافض", width: 12 },
                    { key: "totalVotes", header: "الإجمالي", width: 12 },
                  ];
                  exportToCSV(filteredResolutions, exportColumns, "قرارات_مجلس_الإدارة");
                }}>
                  CSV تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "resolutionNumber", header: "رقم القرار", width: 15 },
                    { key: "title", header: "العنوان", width: 40 },
                    { key: "resolutionType", header: "النوع", width: 15 },
                    { key: "category", header: "التصنيف", width: 12 },
                    { key: "status", header: "الحالة", width: 12 },
                    { key: "forVotes", header: "موافق", width: 12 },
                    { key: "againstVotes", header: "رافض", width: 12 },
                    { key: "totalVotes", header: "الإجمالي", width: 12 },
                  ];
                  printAsPDF(filteredResolutions, exportColumns, "قرارات مجلس الإدارة", "سجل القرارات والتوصيات");
                }}>
                  طباعة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isAdmin && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowTrash(true)}
                data-testid="button-open-trash"
              >
                <Trash2 className="h-4 w-4" />
                سلة المحذوفات
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="btn-add-resolution">
                  <Plus className="h-4 w-4" />
                  قرار جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>إنشاء قرار جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="resolutionType">نوع القرار *</Label>
                      <Select name="resolutionType" defaultValue={defaultResolutionType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {resolutionTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">التصنيف</Label>
                      <Select name="category" defaultValue="operational">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="title">عنوان القرار *</Label>
                      <Input id="title" name="title" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">الأولوية</Label>
                      <Select name="priority" defaultValue="medium">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="implementationDeadline">موعد التنفيذ</Label>
                      <Input id="implementationDeadline" name="implementationDeadline" type="date" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">تفاصيل القرار *</Label>
                    <Textarea id="description" name="description" rows={5} required />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                      إنشاء كمسودة
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          }
        />

        <div className="kpi-grid">
          <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">مسودات</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">{draftCount}</p>
                </div>
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-yellow-600">قيد التصويت</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-800">{votingCount}</p>
                </div>
                <Vote className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600">معتمدة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800">{approvedCount}</p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-emerald-600">منفذة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-800">{implementedCount}</p>
                </div>
                <CheckCheck className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="بحث بالعنوان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
              data-testid="search-input"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {resolutionStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-5">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="pending">قيد المعالجة</TabsTrigger>
            <TabsTrigger value="approved">معتمدة</TabsTrigger>
            <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
            <TabsTrigger value="implemented">منفذة</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  جاري التحميل...
                </CardContent>
              </Card>
            ) : filteredResolutions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Scale className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>لا يوجد قرارات</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredResolutions.map((resolution) => (
                  <Card key={resolution.id} className="hover:shadow-lg transition-shadow" data-testid={`resolution-card-${resolution.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              {resolution.resolutionNumber}
                            </Badge>
                            {getStatusBadge(resolution.status || "draft")}
                            {getPriorityBadge(resolution.priority)}
                            <Badge variant="outline">
                              {categories.find(c => c.value === resolution.category)?.label}
                            </Badge>
                            {(resolution as any).isLocked && (
                              <Badge className="bg-amber-100 text-amber-800 gap-1" data-testid={`badge-locked-${resolution.id}`}>
                                <Lock className="h-3 w-3" /> مقفل
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg mb-2">{resolution.title}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{resolution.description}</p>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Workflow className="h-4 w-4" />
                              <span>المرحلة {getCurrentWorkflowStep(resolution.status || "draft")} من 6</span>
                            </div>
                            {resolution.totalVotes !== undefined && resolution.totalVotes !== null && resolution.totalVotes > 0 && (
                              <div className="flex items-center gap-2">
                                <ThumbsUp className="h-4 w-4 text-green-500" />
                                <span>{resolution.forVotes}</span>
                                <ThumbsDown className="h-4 w-4 text-red-500" />
                                <span>{resolution.againstVotes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setSelectedResolution(resolution);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            عرض
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={async () => {
                              const resolutionType = resolutionTypes.find(t => t.value === resolution.resolutionType)?.label || resolution.resolutionType;
                              const status = resolutionStatuses.find(s => s.value === resolution.status)?.label || resolution.status;
                              const priority = priorities.find(p => p.value === resolution.priority)?.label || resolution.priority;
                              const category = categories.find(c => c.value === resolution.category)?.label || resolution.category;
                              const isAssemblyDoc = ['general_assembly', 'ordinary'].includes(resolution.resolutionType);
                              const isExtraordinaryDoc = ['extraordinary_assembly', 'extraordinary'].includes(resolution.resolutionType);
                              const docTypeBadge = isAssemblyDoc
                                ? 'قرار الجمعية العمومية العادية'
                                : isExtraordinaryDoc
                                  ? 'قرار الجمعية العمومية غير العادية'
                                  : 'قرار مجلس الإدارة';
                              
                              // جلب التوقيعات الإلكترونية
                              let signaturesData: ResolutionSignature[] = [];
                              try {
                                const res = await fetch(`/api/governance/resolutions/${resolution.id}/signatures`);
                                if (res.ok) {
                                  signaturesData = await res.json();
                                }
                              } catch (e) {
                                console.error('Failed to fetch signatures:', e);
                              }
                              
                              const translatePosition = (pos: string) => {
                                const positions: Record<string, string> = {
                                  'chairman': 'رئيس مجلس الإدارة',
                                  'vice_chairman': 'نائب رئيس مجلس الإدارة',
                                  'member': 'عضو مجلس الإدارة',
                                  'secretary': 'أمين السر',
                                  'رئيس مجلس الإدارة': 'رئيس مجلس الإدارة',
                                  'نائب رئيس مجلس الإدارة': 'نائب رئيس مجلس الإدارة',
                                  'عضو مجلس الإدارة': 'عضو مجلس الإدارة',
                                };
                                return positions[pos] || pos;
                              };
                              
                              const escapeHtml = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));
                              const safeImgSrc = (u: any) => {
                                const v = String(u ?? '').trim();
                                return /^https:\/\//i.test(v) || /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(v) ? v : '';
                              };
                              const fmtG = (d: any) => { const x = d ? new Date(d) : new Date(); return x.getFullYear() + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0'); };
                              const memberCount = signaturesData.length;
                              const signedCount = signaturesData.filter((sg) => sg.status === 'signed').length;
                              let forV = Number(resolution.forVotes || 0), againstV = Number(resolution.againstVotes || 0), abstainV = Number(resolution.abstainVotes || 0);
                              if (forV + againstV + abstainV === 0 && signedCount > 0) forV = signedCount;
                              const totalVotes = forV + againstV + abstainV;
                              const unanimous = totalVotes > 0 && againstV === 0 && abstainV === 0;
                              const isApproved = resolution.status === 'approved' || resolution.status === 'implemented';
                              const isRejected = resolution.status === 'rejected';
                              const resultText = isApproved ? ('اعتُمد ' + (unanimous ? 'بالإجماع' : 'بالأغلبية')) : isRejected ? 'مرفوض' : status;
                              const resultClass = isApproved ? 'ok' : isRejected ? 'reject' : 'pending';
                              const badgeClass = resultClass;
                              const badgeText = isApproved ? ('✓ تم اعتماد القرار ' + (unanimous ? 'بالإجماع' : 'بالأغلبية') + ' من أعضاء مجلس الإدارة') : isRejected ? '✗ تم رفض القرار' : ('⏳ ' + status);
                              const dateStr = fmtG(resolution.createdAt);
                              const printStamp = fmtG(new Date());
                              const subjectText = escapeHtml(resolution.title || '');
                              const bodyText = escapeHtml(resolution.description || ('بناءً على الصلاحيات المخولة لمجلس الإدارة، وبعد الاطلاع على الموضوع المعروض، تقرر ما يلي:\n\n' + (resolution.title || '')));

                              const signaturesHtml = memberCount > 0
                                ? signaturesData.map((sig) => {
                                    const signed = sig.status === 'signed';
                                    const img = signed ? safeImgSrc(sig.signatureData) : '';
                                    const inner = img
                                      ? '<img class="sig-img" src="' + img + '" alt="توقيع ' + escapeHtml(sig.memberName) + '" />'
                                      : sig.status === 'declined'
                                        ? '<span class="sig-x">✗ رفض التوقيع</span>'
                                        : '<span class="sig-wait">في انتظار التوقيع</span>';
                                    const dateLine = signed && sig.signedAt ? '<span class="sig-date">تاريخ التوقيع: ' + fmtG(sig.signedAt) + '</span>' : '';
                                    const okBadge = signed ? '<span class="sig-ok">✓ موقّع</span>' : sig.status === 'declined' ? '<span class="sig-rej">✗ مرفوض</span>' : '<span class="sig-pend">⏳ معلّق</span>';
                                    return '<div class="sig-card ' + (signed ? 'signed' : sig.status) + '">'
                                      + '<div class="sig-role">' + escapeHtml(translatePosition(sig.memberPosition)) + '</div>'
                                      + '<div class="sig-name">' + escapeHtml(sig.memberName) + '</div>'
                                      + '<div class="sig-img-wrap">' + inner + '</div>'
                                      + '<div class="sig-foot">' + okBadge + dateLine + '</div>'
                                      + '</div>';
                                  }).join('')
                                : '<div class="sig-empty">لم يتم إضافة موقّعين بعد</div>';

                                                            // جلب أصوات الحاضرين/المساهمين المصوّتين على هذا القرار
                              let votesData: any[] = [];
                              try {
                                const vres = await fetch(`/api/governance/resolutions/${resolution.id}/votes`);
                                if (vres.ok) {
                                  votesData = await vres.json();
                                }
                              } catch (e) {
                                console.error('Failed to fetch votes:', e);
                              }

                              const voteLabel = (v: string) => v === 'for' ? 'موافق' : v === 'against' ? 'معارض' : v === 'abstain' ? 'ممتنع' : '';
                              const voteClass = (v: string) => v === 'for' ? 'for' : v === 'against' ? 'against' : 'abstain';
                              const voterTypeLabel = (t: string) => t === 'board_member' ? 'عضو مجلس الإدارة' : t === 'shareholder' ? 'مساهم' : t === 'proxy' ? 'وكيل' : (t || '');

                              const votersHtml = votesData.length > 0
                                ? votesData.map((v: any) => {
                                    const sig = safeImgSrc(v.signatureUrl);
                                    const name = escapeHtml(v.voterName);
                                    return `
                                    <div class="voter-card vote-${voteClass(v.vote)}">
                                      <div class="voter-head">
                                        <span class="voter-name">${name}</span>
                                        <span class="voter-vote vote-${voteClass(v.vote)}">${voteLabel(v.vote)}</span>
                                      </div>
                                      <div class="voter-meta">${escapeHtml(voterTypeLabel(v.voterType))}${v.votingPower && Number(v.votingPower) > 1 ? ' · ' + Number(v.votingPower).toLocaleString('ar-SA-u-nu-latn') + ' صوت' : ''}</div>
                                      <div class="voter-sig">
                                        ${sig
                                          ? `<img src="${sig}" alt="توقيع ${name}" class="voter-sig-img" />`
                                          : '<div class="sig-line">________________</div>'}
                                      </div>
                                    </div>
                                  `;
                                  }).join('')
                                : '';

                              const votersSectionHtml = votersHtml
                                ? `<div class="signatures-section voters-section">
                                     <div class="section-title">
                                       <div class="section-icon">👥</div>
                                       <span>توقيعات الحاضرين والمساهمين المصوّتين على القرار (${votesData.length})</span>
                                     </div>
                                     <div class="voters-grid">
                                       ${votersHtml}
                                     </div>
                                   </div>`
                                : '';
                              
                              const html = `
                                <!DOCTYPE html>
                                <html lang="ar" dir="rtl">
                                <head>
                                  <meta charset="UTF-8">
                                  <title>${escapeHtml(docTypeBadge)} - ${escapeHtml(resolution.resolutionNumber)}</title>
                                  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
                                  <style>
                                    @page { size: A4 portrait; margin: 0; }
                                    * { margin: 0; padding: 0; box-sizing: border-box; }
                                    body { font-family: 'Cairo', sans-serif; color: #333; direction: rtl; font-size: 9px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                    .letterhead { position: fixed; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; }
                                    .doc-table { position: relative; z-index: 1; width: 210mm; border-collapse: collapse; }
                                    .doc-table > thead > tr > td, .doc-table > tfoot > tr > td { padding: 0; border: none; }
                                    .space-head { height: 30mm; }
                                    .space-foot { height: 20mm; }
                                    .content-cell { padding: 0 16mm; vertical-align: top; }
                                    .section-head { break-after: avoid; page-break-after: avoid; }
                                    .info-strip, .subject-box, .vote-summary, .result-badge, .stamp-wrap { break-inside: avoid; page-break-inside: avoid; }

                                    .doc-title-main { text-align: center; font-size: 17px; font-weight: 700; color: #2b3a4f; margin-bottom: 4px; }
                                    .doc-meta-wrap { text-align: center; margin-bottom: 9px; }
                                    .doc-meta-pill { display: inline-block; background: #fbf6e9; border: 1px solid #e6d4a3; color: #7a6326; border-radius: 14px; padding: 4px 18px; font-size: 9px; font-weight: 600; }
                                    .doc-meta-pill .sep { color: #c9a45b; margin: 0 7px; }

                                    .info-strip { display: flex; background: #faf8f1; border: 1px solid #e9dfc4; border-radius: 7px; overflow: hidden; margin-bottom: 11px; }
                                    .info-cell { flex: 1; text-align: center; padding: 6px 4px; border-left: 1px solid #ece2c8; }
                                    .info-cell:last-child { border-left: none; }
                                    .info-cell .lbl { font-size: 8px; color: #b8962f; font-weight: 600; margin-bottom: 4px; }
                                    .info-cell .val { font-size: 10.5px; font-weight: 700; color: #2b3a4f; }
                                    .info-cell .val.ok { color: #2e7d52; }
                                    .info-cell .val.reject { color: #c0392b; }

                                    .section-head { font-size: 13px; font-weight: 700; color: #2b3a4f; margin: 9px 0 6px; padding-right: 9px; border-right: 3px solid #b8962f; }

                                    .subject-box { background: #f4f7fb; border: 1px solid #d8e2ee; border-right: 3px solid #2b3a4f; border-radius: 5px; padding: 7px 11px; margin-bottom: 7px; }
                                    .subject-lbl { font-size: 8px; color: #7a8aa0; font-weight: 600; margin-bottom: 2px; }
                                    .subject-txt { font-size: 11px; font-weight: 700; color: #2b3a4f; }
                                    .res-box { background: #fdfbf3; border: 1px solid #ecdcb4; border-right: 3px solid #c9a45b; border-radius: 5px; padding: 8px 11px; margin-bottom: 7px; }
                                    .res-box-text { font-size: 9.5px; color: #444; line-height: 1.85; white-space: pre-wrap; }

                                    .vote-summary { display: flex; gap: 8px; margin-bottom: 8px; }
                                    .vote-cell { flex: 1; text-align: center; border-radius: 6px; padding: 8px 4px; }
                                    .vote-cell.for { background: #eaf6ee; border: 1px solid #bfe3cd; }
                                    .vote-cell.against { background: #fbe9e9; border: 1px solid #f0c0c0; }
                                    .vote-cell.abstain { background: #eef0f2; border: 1px solid #d8dde2; }
                                    .vote-num { font-size: 20px; font-weight: 800; line-height: 1; }
                                    .vote-cell.for .vote-num { color: #2e7d52; }
                                    .vote-cell.against .vote-num { color: #c0392b; }
                                    .vote-cell.abstain .vote-num { color: #5a6472; }
                                    .vote-cap { font-size: 9px; font-weight: 600; color: #555; margin-top: 4px; }
                                    .result-badge { text-align: center; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 7px; margin-bottom: 4px; }
                                    .result-badge.ok { background: #e3f3e9; color: #2e7d52; border: 1px solid #bfe3cd; }
                                    .result-badge.reject { background: #fbe5e5; color: #b3261e; border: 1px solid #f0c0c0; }
                                    .result-badge.pending { background: #fff7e6; color: #9a7b1e; border: 1px solid #f0dca8; }

                                    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 4px; }
                                    .sig-card { border: 1px solid #e3dcc6; border-radius: 7px; padding: 8px 10px 6px; background: #fffdf8; text-align: center; page-break-inside: avoid; break-inside: avoid; }
                                    .sig-card.signed { border-color: #cfe3d6; background: #fbfdfb; }
                                    .sig-role { font-size: 8px; color: #b8962f; font-weight: 700; margin-bottom: 2px; }
                                    .sig-name { font-size: 11px; font-weight: 700; color: #2b3a4f; margin-bottom: 3px; }
                                    .sig-img-wrap { height: 36px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; border-bottom: 1px solid #e7e2d4; padding-bottom: 3px; }
                                    .sig-img { max-height: 34px; max-width: 160px; }
                                    .sig-wait { font-size: 8px; color: #b0a98f; }
                                    .sig-x { font-size: 8px; color: #c0392b; }
                                    .sig-foot { display: flex; justify-content: center; gap: 8px; align-items: center; }
                                    .sig-ok { font-size: 8px; color: #2e7d52; font-weight: 700; }
                                    .sig-rej { font-size: 8px; color: #c0392b; font-weight: 700; }
                                    .sig-pend { font-size: 8px; color: #9a7b1e; font-weight: 700; }
                                    .sig-date { font-size: 7.5px; color: #888; }
                                    .sig-empty { text-align: center; color: #aaa; font-size: 9px; padding: 14px; grid-column: 1 / -1; }

                                    .stamp-wrap { text-align: center; margin-top: 10px; }
                                    .stamp-lbl { font-size: 9px; color: #888; margin-bottom: 2px; }
                                    .stamp-wrap svg { width: 110px; height: 110px; }

                                    .voters-section { margin-top: 10px; }
                                    .voters-section .section-title { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #2b3a4f; margin: 0 0 5px; }
                                    .voters-section .section-icon { font-size: 12px; }
                                    .voters-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
                                    .voter-card { border: 1px solid #e6e0cd; border-radius: 5px; padding: 5px 7px; background: #fffdf8; }
                                    .voter-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
                                    .voter-name { font-size: 8.5px; font-weight: 700; color: #2b3a4f; }
                                    .voter-vote { font-size: 7.5px; font-weight: 700; border-radius: 8px; padding: 1px 7px; }
                                    .voter-vote.vote-for { background: #e3f3e9; color: #2e7d52; }
                                    .voter-vote.vote-against { background: #fbe5e5; color: #b3261e; }
                                    .voter-vote.vote-abstain { background: #eef0f2; color: #556; }
                                    .voter-meta { font-size: 7px; color: #888; }
                                    .voter-sig { margin-top: 2px; }
                                    .voter-sig-img { max-height: 18px; max-width: 80px; }
                                    .sig-line { color: #bbb; font-size: 8px; }

                                    .doc-note { text-align: center; font-size: 7.5px; color: #8a8a8a; margin-top: 12px; }
                                  </style>
                                </head>
                                <body>
                                  <img class="letterhead" src="${officialLetterhead}" alt="" />
                                  <table class="doc-table">
                                    <thead><tr><td><div class="space-head"></div></td></tr></thead>
                                    <tfoot><tr><td><div class="space-foot"></div></td></tr></tfoot>
                                    <tbody><tr><td class="content-cell">
                                    <div class="doc-title-main">${docTypeBadge}</div>
                                    <div class="doc-meta-wrap"><span class="doc-meta-pill">رقم القرار ${escapeHtml(resolution.resolutionNumber)}<span class="sep">•</span>التاريخ ${dateStr}م<span class="sep">•</span>النوع ${escapeHtml(resolutionType)}</span></div>
                                    <div class="info-strip">
                                      <div class="info-cell"><div class="lbl">نوع القرار</div><div class="val">${escapeHtml(resolutionType)}</div></div>
                                      <div class="info-cell"><div class="lbl">التصنيف</div><div class="val">${escapeHtml(category)}</div></div>
                                      <div class="info-cell"><div class="lbl">الأولوية</div><div class="val">${escapeHtml(priority || '-')}</div></div>
                                      <div class="info-cell"><div class="lbl">عدد الأعضاء</div><div class="val">${memberCount} أعضاء</div></div>
                                      <div class="info-cell"><div class="lbl">النتيجة</div><div class="val ${resultClass}">${resultText}</div></div>
                                    </div>
                                    <div class="section-head">نص القرار</div>
                                    ${subjectText ? '<div class="subject-box"><div class="subject-lbl">موضوع القرار</div><div class="subject-txt">' + subjectText + '</div></div>' : ''}
                                    <div class="res-box"><div class="res-box-text">${bodyText}</div></div>
                                    <div class="section-head">نتيجة التصويت</div>
                                    <div class="vote-summary">
                                      <div class="vote-cell for"><div class="vote-num">${forV}</div><div class="vote-cap">موافق</div></div>
                                      <div class="vote-cell against"><div class="vote-num">${againstV}</div><div class="vote-cap">معارض</div></div>
                                      <div class="vote-cell abstain"><div class="vote-num">${abstainV}</div><div class="vote-cap">ممتنع</div></div>
                                    </div>
                                    <div class="result-badge ${badgeClass}">${badgeText}</div>
                                    <div class="section-head">التوقيعات</div>
                                    <div class="sig-grid">${signaturesHtml}</div>
                                    <div class="stamp-wrap"><div class="stamp-lbl">ختم الشركة</div>${companyStampSvg}</div>
                                    ${votersSectionHtml}
                                    <div class="doc-note">مستند رسمي صادر إلكترونياً عبر نظام إدارة حوكمة الشركات | تاريخ الطباعة: ${printStamp} | رقم القرار ${escapeHtml(resolution.resolutionNumber)}</div>
                                    </td></tr></tbody>
                                  </table>
                                </body>
                                </html>
                              `;
                              const printWindow = window.open('', '_blank');
                              if (printWindow) {
                                printWindow.document.write(html);
                                printWindow.document.close();
                                printWindow.onload = () => setTimeout(() => printWindow.print(), 300);
                              }
                            }}
                          >
                            <Printer className="h-4 w-4" />
                            طباعة
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setSelectedResolution(resolution);
                              setShowWorkflow(true);
                            }}
                          >
                            <Workflow className="h-4 w-4" />
                            سير العمل
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setSelectedResolution(resolution);
                              setShowSignatures(true);
                            }}
                          >
                            <PenLine className="h-4 w-4" />
                            التوقيعات
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={(resolution as any).isLocked}
                            title={(resolution as any).isLocked ? "القرار مقفل ولا يمكن تعديله" : ""}
                            onClick={() => {
                              setEditingResolution(resolution);
                              setShowEditDialog(true);
                            }}
                            data-testid={`btn-edit-${resolution.id}`}
                          >
                            <Edit className="h-4 w-4" />
                            تعديل
                          </Button>
                          {isAdmin && !(resolution as any).isLocked && (resolution.status === "approved" || resolution.status === "implemented") && (
                            <AlertDialog open={lockResolutionId === resolution.id} onOpenChange={(open) => !open && setLockResolutionId(null)}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                  onClick={() => setLockResolutionId(resolution.id)}
                                  data-testid={`btn-lock-${resolution.id}`}
                                >
                                  <Lock className="h-4 w-4" />
                                  قفل نهائي
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-amber-600" /> قفل القرار {resolution.resolutionNumber}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    بعد القفل لن يتمكن أي مستخدم — حتى المدير — من تعديل القرار أو حذفه أو تعديل أصوات التصويت عليه.
                                    هذا إجراء مطلوب نظاماً للقرارات المعتمدة (الامتثال لهيئة السوق المالية ونظام الشركات).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>تراجع</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-amber-600 hover:bg-amber-700"
                                    onClick={() => lockMutation.mutate(resolution.id)}
                                    disabled={lockMutation.isPending}
                                  >
                                    {lockMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري القفل…</> : "نعم، اقفل نهائياً"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {isAdmin && (resolution as any).isLocked && (
                            <AlertDialog open={unlockResolutionId === resolution.id} onOpenChange={(open) => { if (!open) { setUnlockResolutionId(null); setUnlockReason(""); } }}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  onClick={() => setUnlockResolutionId(resolution.id)}
                                  data-testid={`btn-unlock-${resolution.id}`}
                                >
                                  <Unlock className="h-4 w-4" />
                                  فتح القفل للتعديل
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <Unlock className="h-5 w-5 text-emerald-600" /> فتح قفل القرار {resolution.resolutionNumber}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    سيتم فتح قفل القرار ليصبح قابلاً للتعديل مرة أخرى. هذا إجراء استثنائي للمسؤول فقط ويُسجَّل في سجل المراجعة.
                                    يُنصح بإعادة قفل القرار نهائياً بعد الانتهاء من التعديلات للحفاظ على الامتثال النظامي.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="px-1 py-2">
                                  <Label className="text-right block mb-1 text-sm">سبب فتح القفل (اختياري)</Label>
                                  <Textarea
                                    value={unlockReason}
                                    onChange={(e) => setUnlockReason(e.target.value)}
                                    placeholder="مثال: تصحيح خطأ إملائي في نص القرار"
                                    className="text-right"
                                    data-testid="input-unlock-reason"
                                  />
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setUnlockReason("")}>تراجع</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => unlockMutation.mutate({ id: resolution.id, reason: unlockReason })}
                                    disabled={unlockMutation.isPending}
                                  >
                                    {unlockMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري فتح القفل…</> : "نعم، افتح القفل"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {isAdmin && !(resolution as any).isLocked && (
                            <AlertDialog open={deleteResolutionId === resolution.id} onOpenChange={(open) => !open && setDeleteResolutionId(null)}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => setDeleteResolutionId(resolution.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  حذف
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-right">تأكيد حذف القرار</AlertDialogTitle>
                                  <AlertDialogDescription className="text-right">
                                    هل أنت متأكد من حذف القرار رقم <strong>{resolution.resolutionNumber}</strong>؟
                                    <br />
                                    <span className="text-amber-600">سيتم نقل القرار إلى سلة المحذوفات ويمكنك استرجاعه لاحقاً. لن يتم فقدان أي بيانات.</span>
                                    <br />
                                    <span className="text-muted-foreground text-xs">ملاحظة: القرارات التي تم التصويت عليها أو توقيعها محمية ولا يمكن حذفها نهائياً.</span>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="px-1 py-2">
                                  <Label className="text-right block mb-1 text-sm">سبب الحذف (اختياري)</Label>
                                  <Textarea
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    placeholder="مثال: تم إنشاؤه بالخطأ"
                                    className="text-right"
                                    data-testid="input-delete-reason"
                                  />
                                </div>
                                <AlertDialogFooter className="flex gap-2">
                                  <AlertDialogCancel onClick={() => setDeleteReason("")}>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate({ id: resolution.id, reason: deleteReason })}
                                    disabled={deleteMutation.isPending}
                                    data-testid="button-confirm-delete"
                                  >
                                    {deleteMutation.isPending ? (
                                      <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري الحذف...</>
                                    ) : (
                                      "نقل إلى سلة المحذوفات"
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل القرار</DialogTitle>
            </DialogHeader>
            {selectedResolution && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono">{selectedResolution.resolutionNumber}</Badge>
                  {getStatusBadge(selectedResolution.status || "draft")}
                  {getPriorityBadge(selectedResolution.priority)}
                </div>
                
                <h2 className="text-xl font-bold">{selectedResolution.title}</h2>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedResolution.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">النوع</p>
                    <p className="font-medium">{resolutionTypes.find(t => t.value === selectedResolution.resolutionType)?.label}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">التصنيف</p>
                    <p className="font-medium">{categories.find(c => c.value === selectedResolution.category)?.label}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">الأغلبية المطلوبة</p>
                    <p className="font-medium">{selectedResolution.requiredMajority}%</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">موعد التنفيذ</p>
                    <p className="font-medium">{selectedResolution.implementationDeadline || "غير محدد"}</p>
                  </div>
                </div>

                {selectedResolution.status === "voting" && (
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Vote className="h-4 w-4 text-yellow-600" />
                        نتائج التصويت الحالية
                      </h4>
                      <Progress value={selectedResolution.forVotes && selectedResolution.totalVotes ? (selectedResolution.forVotes / selectedResolution.totalVotes) * 100 : 0} className="h-4 mb-2" />
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-green-100 p-2 rounded">
                          <ThumbsUp className="h-4 w-4 mx-auto text-green-600 mb-1" />
                          <p className="font-bold text-green-800">{selectedResolution.forVotes || 0}</p>
                          <p className="text-xs text-green-600">موافق</p>
                        </div>
                        <div className="bg-red-100 p-2 rounded">
                          <ThumbsDown className="h-4 w-4 mx-auto text-red-600 mb-1" />
                          <p className="font-bold text-red-800">{selectedResolution.againstVotes || 0}</p>
                          <p className="text-xs text-red-600">رافض</p>
                        </div>
                        <div className="bg-gray-100 p-2 rounded">
                          <Minus className="h-4 w-4 mx-auto text-gray-600 mb-1" />
                          <p className="font-bold text-gray-800">{selectedResolution.abstainVotes || 0}</p>
                          <p className="text-xs text-gray-600">ممتنع</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="gap-2">
                    <Printer className="h-4 w-4" />
                    طباعة
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    تحميل PDF
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetails(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showWorkflow} onOpenChange={setShowWorkflow}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-emerald-600" />
                سير عمل القرار
              </DialogTitle>
            </DialogHeader>
            {selectedResolution && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  {workflowSteps.map((step, index) => {
                    const currentStep = getCurrentWorkflowStep(selectedResolution.status || "draft");
                    const isCompleted = index + 1 < currentStep;
                    const isCurrent = index + 1 === currentStep;
                    
                    return (
                      <div key={step.id} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-emerald-500 text-white' :
                            isCurrent ? 'bg-emerald-100 border-2 border-emerald-500 text-emerald-600' :
                            'bg-gray-100 text-gray-400'
                          }`}>
                            {isCompleted ? <CheckCircle className="h-5 w-5" /> : step.id}
                          </div>
                          <span className={`text-xs mt-2 text-center ${isCurrent ? 'font-bold text-emerald-600' : 'text-gray-500'}`}>
                            {step.name}
                          </span>
                        </div>
                        {index < workflowSteps.length - 1 && (
                          <ArrowRight className={`h-5 w-5 mx-2 ${isCompleted ? 'text-emerald-500' : 'text-gray-300'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">المرحلة الحالية</h4>
                    <p className="text-emerald-800">{workflowSteps[getCurrentWorkflowStep(selectedResolution.status || "draft") - 1]?.name}</p>
                  </CardContent>
                </Card>

                {(selectedResolution as any).isLocked ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2" data-testid="locked-notice-workflow">
                    <Lock className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-900">القرار مقفل نهائياً</p>
                      <p className="text-amber-800 mt-1">لا يمكن تغيير حالة القرار أو إعادة فتح التصويت بعد القفل النظامي.</p>
                    </div>
                  </div>
                ) : (
                <div className="flex gap-2 flex-wrap">
                  {selectedResolution.status === "draft" && (
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 gap-2"
                      onClick={() => {
                        updateMutation.mutate({ 
                          id: selectedResolution.id, 
                          data: { status: "proposed" } 
                        });
                        setShowWorkflow(false);
                      }}
                      disabled={updateMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                      رفع للمراجعة
                    </Button>
                  )}
                  {selectedResolution.status === "proposed" && (
                    <Button 
                      className="bg-yellow-600 hover:bg-yellow-700 gap-2"
                      onClick={() => {
                        updateMutation.mutate({ 
                          id: selectedResolution.id, 
                          data: { status: "voting" } 
                        });
                        setShowWorkflow(false);
                      }}
                      disabled={updateMutation.isPending}
                    >
                      <Vote className="h-4 w-4" />
                      فتح التصويت
                    </Button>
                  )}
                  {selectedResolution.status === "voting" && (
                    <Button 
                      className="bg-green-600 hover:bg-green-700 gap-2"
                      onClick={() => {
                        updateMutation.mutate({ 
                          id: selectedResolution.id, 
                          data: { status: "approved" } 
                        });
                        setShowWorkflow(false);
                      }}
                      disabled={updateMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4" />
                      اعتماد القرار
                    </Button>
                  )}
                  {selectedResolution.status === "approved" && (
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                      onClick={() => {
                        updateMutation.mutate({ 
                          id: selectedResolution.id, 
                          data: { status: "implemented" } 
                        });
                        setShowWorkflow(false);
                      }}
                      disabled={updateMutation.isPending}
                    >
                      <CheckCheck className="h-4 w-4" />
                      تأكيد التنفيذ
                    </Button>
                  )}
                  {selectedResolution.status === "voting" && (
                    <Button 
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        updateMutation.mutate({ 
                          id: selectedResolution.id, 
                          data: { status: "rejected" } 
                        });
                        setShowWorkflow(false);
                      }}
                      disabled={updateMutation.isPending}
                    >
                      <XCircle className="h-4 w-4" />
                      رفض القرار
                    </Button>
                  )}
                </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWorkflow(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSignatures} onOpenChange={setShowSignatures}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-emerald-600" />
                التوقيعات الإلكترونية - {selectedResolution?.resolutionNumber}
              </DialogTitle>
            </DialogHeader>
            {selectedResolution && (
              <div className="space-y-4">
                {(selectedResolution as any).isLocked && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2" data-testid="locked-notice-signatures">
                    <Lock className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900">
                      القرار مقفل نهائياً — يمكن عرض التوقيعات القائمة فقط، ولا يمكن إنشاء طلبات توقيع جديدة.
                    </p>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    {selectedResolution.resolutionType === 'general_assembly' || selectedResolution.resolutionType === 'extraordinary_assembly'
                      ? 'التوقيع الإلكتروني معتمد قانونياً ويحمل صفة الإلزام. يوقّع على قرار الجمعية رئيس مجلس الإدارة وأمين السر، ويمكنك إرسال رابط التوقيع لكلٍّ منهما عبر واتساب أو نسخه.'
                      : 'التوقيع الإلكتروني معتمد قانونياً ويحمل صفة الإلزام. يمكنك إرسال روابط التوقيع لأعضاء المجلس عبر البريد أو واتساب.'}
                  </p>
                </div>

                {signatures.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="text-gray-500 mb-4">
                      لم يتم إنشاء طلبات توقيع بعد
                    </div>
                    {selectedResolution.resolutionType === 'general_assembly' || selectedResolution.resolutionType === 'extraordinary_assembly' ? (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                        onClick={() => createSignatureRequestsMutation.mutate({ resolutionId: selectedResolution.id })}
                        disabled={createSignatureRequestsMutation.isPending || (selectedResolution as any).isLocked}
                        title={(selectedResolution as any).isLocked ? "القرار مقفل ولا يمكن إنشاء طلبات توقيع جديدة" : ""}
                        data-testid="button-create-signatures-chairman-secretary"
                      >
                        {createSignatureRequestsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        إنشاء روابط توقيع رئيس المجلس وأمين السر
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="text-sm text-gray-600">اختر من يوقّع على هذا القرار:</div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                            onClick={() => createSignatureRequestsMutation.mutate({ resolutionId: selectedResolution.id, scope: "chairman_secretary" })}
                            disabled={createSignatureRequestsMutation.isPending || (selectedResolution as any).isLocked}
                            title={(selectedResolution as any).isLocked ? "القرار مقفل ولا يمكن إنشاء طلبات توقيع جديدة" : ""}
                            data-testid="button-create-signatures-chairman-secretary"
                          >
                            {createSignatureRequestsMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            رئيس المجلس وأمين السر فقط
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => createSignatureRequestsMutation.mutate({ resolutionId: selectedResolution.id, scope: "all" })}
                            disabled={createSignatureRequestsMutation.isPending || (selectedResolution as any).isLocked}
                            title={(selectedResolution as any).isLocked ? "القرار مقفل ولا يمكن إنشاء طلبات توقيع جديدة" : ""}
                            data-testid="button-create-signatures-all"
                          >
                            <Send className="h-4 w-4" />
                            جميع أعضاء المجلس
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                    <Table className="min-w-[500px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">العضو</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">المنصب</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right hidden md:table-cell">التاريخ</TableHead>
                          <TableHead className="text-right">الإجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signatures.map((sig) => (
                          <TableRow key={sig.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{sig.memberName}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs sm:text-sm">{sig.memberPosition}</TableCell>
                            <TableCell>
                              {sig.status === "signed" && (
                                <Badge className="bg-green-100 text-green-800 gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  تم التوقيع
                                </Badge>
                              )}
                              {sig.status === "pending" && (
                                <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                                  <Clock className="h-3 w-3" />
                                  في الانتظار
                                </Badge>
                              )}
                              {sig.status === "declined" && (
                                <Badge className="bg-red-100 text-red-800 gap-1">
                                  <XCircle className="h-3 w-3" />
                                  مرفوض
                                </Badge>
                              )}
                              {sig.status === "expired" && (
                                <Badge className="bg-gray-100 text-gray-800 gap-1">
                                  <Clock className="h-3 w-3" />
                                  منتهي الصلاحية
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs sm:text-sm text-gray-600">
                              {sig.signedAt ? new Date(sig.signedAt).toLocaleDateString('ar-SA-u-nu-latn') : '-'}
                            </TableCell>
                            <TableCell>
                              {sig.status === "pending" && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copySigningUrl(sig.signatureToken)}
                                    title="نسخ رابط التوقيع"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(getSigningUrl(sig.signatureToken), '_blank')}
                                    title="فتح صفحة التوقيع"
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const url = getSigningUrl(sig.signatureToken);
                                      const text = `مطلوب توقيعك على القرار رقم ${selectedResolution.resolutionNumber}\n\nالرابط: ${url}`;
                                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                    }}
                                    title="إرسال عبر واتساب"
                                  >
                                    <Share2 className="h-4 w-4 text-green-600" />
                                  </Button>
                                </div>
                              )}
                              {sig.status === "signed" && sig.signatureData && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const win = window.open('', '_blank');
                                    if (win) {
                                      win.document.write(`<img src="${sig.signatureData}" style="max-width:400px;"/>`);
                                    }
                                  }}
                                  title="عرض التوقيع"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium">التوقيعات المكتملة</span>
                      <span className="font-bold">
                        {signatures.filter(s => s.status === "signed").length} / {signatures.length}
                      </span>
                    </div>

                    <Progress 
                      value={(signatures.filter(s => s.status === "signed").length / signatures.length) * 100} 
                      className="h-2"
                    />
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSignatures(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog للتعديل */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-emerald-600" />
                تعديل القرار - {editingResolution?.resolutionNumber}
              </DialogTitle>
            </DialogHeader>
            {editingResolution && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-resolutionType">نوع القرار</Label>
                  <Select name="resolutionType" defaultValue={editingResolution.resolutionType || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع القرار" />
                    </SelectTrigger>
                    <SelectContent>
                      {resolutionTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-title">عنوان القرار</Label>
                  <Input id="edit-title" name="title" defaultValue={editingResolution.title} required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-description">وصف القرار</Label>
                  <Textarea 
                    id="edit-description" 
                    name="description" 
                    defaultValue={editingResolution.description || ""} 
                    rows={5}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-category">التصنيف</Label>
                    <Select name="category" defaultValue={editingResolution.category || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التصنيف" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-priority">الأولوية</Label>
                    <Select name="priority" defaultValue={editingResolution.priority || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الأولوية" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">حالة القرار</Label>
                    <Select name="status" defaultValue={editingResolution.status || "draft"}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الحالة" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolutionStatuses.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-deadline">موعد التنفيذ</Label>
                    <Input 
                      id="edit-deadline" 
                      name="implementationDeadline" 
                      type="date"
                      defaultValue={editingResolution.implementationDeadline ? 
                        new Date(editingResolution.implementationDeadline).toISOString().split('T')[0] : ""}
                    />
                  </div>
                </div>
                
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري الحفظ...</>
                    ) : (
                      "حفظ التعديلات"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Recycle bin (سلة المحذوفات) */}
        <Dialog open={showTrash} onOpenChange={setShowTrash}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-right flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> سلة المحذوفات
              </DialogTitle>
              <DialogDescription className="text-right">
                القرارات المحذوفة محفوظة هنا ويمكن استرجاعها. لا يتم فقدان أي قرار نهائياً.
              </DialogDescription>
            </DialogHeader>
            {trashLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
              </div>
            ) : trashedResolutions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground" data-testid="text-trash-empty">
                سلة المحذوفات فارغة
              </div>
            ) : (
              <div className="space-y-2">
                {trashedResolutions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 border rounded-lg p-3"
                    data-testid={`row-trash-${r.id}`}
                  >
                    <div className="text-right">
                      <div className="font-semibold">{r.resolutionNumber}</div>
                      <div className="text-sm text-muted-foreground">{r.title}</div>
                      {(r as any).deletionReason && (
                        <div className="text-xs text-muted-foreground mt-1">السبب: {(r as any).deletionReason}</div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shrink-0"
                      onClick={() => restoreMutation.mutate(r.id)}
                      disabled={restoreMutation.isPending}
                      data-testid={`button-restore-${r.id}`}
                    >
                      <RotateCcw className="h-4 w-4" />
                      استرجاع
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
