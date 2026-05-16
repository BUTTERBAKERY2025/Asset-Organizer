import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Layout } from "@/components/layout";
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
} from "lucide-react";
import type { BoardResolution, BoardMember } from "@shared/schema";
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
    mutationFn: async (resolutionId: number) => {
      const res = await fetch(`/api/governance/resolutions/${resolutionId}/signatures/create-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 7 }),
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
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/resolutions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete resolution");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setDeleteResolutionId(null);
      toast({ title: "تم حذف القرار بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف القرار", variant: "destructive" });
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
      <div className="max-w-none p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <Scale className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-800" data-testid="page-title">
                القرارات والتوصيات
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">سير العمل والتوقيع الإلكتروني</p>
            </div>
          </div>
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
                      <Select name="resolutionType" defaultValue="regular">
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
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                              
                              const signaturesHtml = signaturesData.length > 0 
                                ? signaturesData.map(sig => `
                                    <div class="signature-card ${sig.status === 'signed' ? 'signed' : 'pending'}">
                                      <div class="sig-header">
                                        <div class="sig-name">${sig.memberName}</div>
                                        <div class="sig-position">${translatePosition(sig.memberPosition)}</div>
                                      </div>
                                      <div class="sig-content">
                                        ${sig.status === 'signed' && sig.signatureData 
                                          ? `<img src="${sig.signatureData}" alt="توقيع ${sig.memberName}" class="sig-image" />`
                                          : sig.status === 'declined'
                                            ? '<div class="sig-declined">رفض التوقيع</div>'
                                            : '<div class="sig-pending">في انتظار التوقيع</div>'
                                        }
                                      </div>
                                      <div class="sig-footer">
                                        ${sig.status === 'signed' && sig.signedAt 
                                          ? `<span class="sig-date">تاريخ التوقيع: ${new Date(sig.signedAt).toLocaleDateString('ar-SA')}</span>`
                                          : ''
                                        }
                                        <span class="sig-status ${sig.status}">${sig.status === 'signed' ? '✓ موقّع' : sig.status === 'declined' ? '✗ مرفوض' : '⏳ معلّق'}</span>
                                      </div>
                                    </div>
                                  `).join('')
                                : `
                                    <div class="signature-card pending">
                                      <div class="sig-header">
                                        <div class="sig-name">رئيس مجلس الإدارة</div>
                                      </div>
                                      <div class="sig-content">
                                        <div class="sig-line">________________________</div>
                                      </div>
                                    </div>
                                    <div class="signature-card pending">
                                      <div class="sig-header">
                                        <div class="sig-name">نائب رئيس مجلس الإدارة</div>
                                      </div>
                                      <div class="sig-content">
                                        <div class="sig-line">________________________</div>
                                      </div>
                                    </div>
                                    <div class="signature-card pending">
                                      <div class="sig-header">
                                        <div class="sig-name">أمين سر المجلس</div>
                                      </div>
                                      <div class="sig-content">
                                        <div class="sig-line">________________________</div>
                                      </div>
                                    </div>
                                  `;
                              
                              const html = `
                                <!DOCTYPE html>
                                <html dir="rtl" lang="ar">
                                <head>
                                  <meta charset="UTF-8">
                                  <title>قرار رقم ${resolution.resolutionNumber}</title>
                                  <style>
                                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                                    
                                    /* Single-Page Setup */
                                    @page { 
                                      size: A4 landscape; 
                                      margin: 8mm 8mm 8mm 8mm;
                                    }
                                    
                                    * { box-sizing: border-box; margin: 0; padding: 0; }
                                    
                                    html, body { 
                                      font-family: 'Cairo', sans-serif; 
                                      direction: rtl; 
                                      background: white;
                                      color: #1a1a1a;
                                      line-height: 1.4;
                                      font-size: 10pt;
                                    }
                                    
                                    .document {
                                      width: 100%;
                                      max-width: 281mm;
                                      margin: 0 auto;
                                      padding: 0;
                                      background: white;
                                    }
                                    
                                    /* Keep critical small blocks together; allow long text to flow naturally */
                                    .header, .resolution-title-box, .voting-box, .result-badge,
                                    .signature-card, .section-title, .meta-section, .footer,
                                    .signatures-section {
                                      page-break-inside: avoid;
                                      break-inside: avoid;
                                    }
                                    
                                    .section-title {
                                      page-break-after: avoid;
                                      break-after: avoid;
                                      margin-top: 8px;
                                    }
                                    
                                    @media print {
                                      .document { padding: 0; }
                                      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                                    }
                                    
                                    /* Header Section - compact */
                                    .header {
                                      display: flex;
                                      justify-content: space-between;
                                      align-items: center;
                                      padding: 6px 10px;
                                      margin-bottom: 8px;
                                      background: linear-gradient(to left, #f8faf9, #fff, #f8faf9);
                                      border: 1.5px solid #1a5f3c;
                                      border-radius: 6px;
                                    }
                                    
                                    .logo-section {
                                      display: flex;
                                      align-items: center;
                                      gap: 8px;
                                    }
                                    
                                    .logo-circle {
                                      width: 36px;
                                      height: 36px;
                                      background: linear-gradient(135deg, #d4a853, #b8962f);
                                      border-radius: 50%;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      color: white;
                                      font-weight: 800;
                                      font-size: 16px;
                                    }
                                    
                                    .company-info { text-align: right; }
                                    
                                    .company-name-ar {
                                      font-size: 13px;
                                      font-weight: 800;
                                      color: #1a5f3c;
                                    }
                                    
                                    .company-name-en {
                                      font-size: 8px;
                                      color: #555;
                                      font-weight: 600;
                                    }
                                    
                                    .company-details {
                                      font-size: 7px;
                                      color: #777;
                                      margin-top: 1px;
                                    }
                                    
                                    .doc-title-section {
                                      text-align: center;
                                      flex-shrink: 0;
                                    }
                                    
                                    .doc-type-badge {
                                      background: linear-gradient(135deg, #1a5f3c 0%, #2d8f5e 100%);
                                      color: white;
                                      padding: 5px 22px;
                                      font-size: 12px;
                                      font-weight: 700;
                                      border-radius: 4px;
                                      display: inline-block;
                                    }
                                    
                                    .resolution-number {
                                      font-size: 10px;
                                      color: #1a5f3c;
                                      font-weight: 700;
                                      margin-top: 3px;
                                    }
                                    
                                    .meta-section {
                                      text-align: left;
                                      font-size: 8px;
                                      color: #444;
                                      background: #f5f5f5;
                                      padding: 5px 8px;
                                      border-radius: 4px;
                                      min-width: 120px;
                                    }
                                    
                                    .meta-item {
                                      margin-bottom: 2px;
                                      display: flex;
                                      justify-content: space-between;
                                      gap: 6px;
                                    }
                                    
                                    .meta-label { color: #888; font-weight: 600; }
                                    
                                    /* Main Content - Two Column Layout */
                                    .main-content {
                                      display: grid;
                                      grid-template-columns: 1fr 240px;
                                      gap: 10px;
                                      margin-top: 6px;
                                    }
                                    
                                    .content-section {
                                      background: #fafafa;
                                      border: 1px solid #e0e0e0;
                                      border-radius: 6px;
                                      padding: 8px 10px;
                                    }
                                    
                                    .section-title {
                                      display: flex;
                                      align-items: center;
                                      gap: 6px;
                                      font-size: 10px;
                                      font-weight: 700;
                                      color: #1a5f3c;
                                      margin-bottom: 6px;
                                      padding-bottom: 4px;
                                      border-bottom: 1.5px solid #1a5f3c;
                                    }
                                    
                                    .section-icon {
                                      width: 18px;
                                      height: 18px;
                                      background: linear-gradient(135deg, #1a5f3c, #2d8f5e);
                                      color: white;
                                      border-radius: 50%;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      font-size: 9px;
                                      font-weight: bold;
                                      flex-shrink: 0;
                                    }
                                    
                                    .resolution-title-box {
                                      background: linear-gradient(to left, #e8f5e9, #fff, #e8f5e9);
                                      padding: 6px 10px;
                                      border-radius: 5px;
                                      text-align: center;
                                      margin-bottom: 6px;
                                      border: 1px solid #c8e6c9;
                                    }
                                    
                                    .resolution-title-box h2 {
                                      font-size: 11px;
                                      font-weight: 700;
                                      color: #1a1a1a;
                                      line-height: 1.4;
                                    }
                                    
                                    .resolution-text {
                                      line-height: 1.6;
                                      text-align: justify;
                                      white-space: pre-wrap;
                                      font-size: 9.5px;
                                      color: #333;
                                      padding: 6px 8px;
                                      background: white;
                                      border-radius: 4px;
                                      border: 1px solid #eee;
                                    }
                                    
                                    /* Voting Section */
                                    .voting-box {
                                      display: flex;
                                      justify-content: space-around;
                                      background: linear-gradient(to bottom, #f0f7f4, #e8f5e9);
                                      padding: 6px 10px;
                                      border-radius: 5px;
                                      margin-top: 6px;
                                      border: 1px solid #c8e6c9;
                                    }
                                    
                                    .vote-item { text-align: center; padding: 2px 8px; }
                                    
                                    .vote-count {
                                      font-size: 16px;
                                      font-weight: 800;
                                      display: block;
                                    }
                                    
                                    .vote-count.for { color: #2e7d32; }
                                    .vote-count.against { color: #c62828; }
                                    .vote-count.abstain { color: #757575; }
                                    
                                    .vote-label {
                                      font-size: 8px;
                                      color: #555;
                                      font-weight: 600;
                                    }
                                    
                                    .result-badge {
                                      text-align: center;
                                      margin-top: 5px;
                                      padding: 5px 10px;
                                      background: ${resolution.status === 'approved' || resolution.status === 'implemented' ? 'linear-gradient(to left, #e8f5e9, #c8e6c9)' : resolution.status === 'rejected' ? 'linear-gradient(to left, #ffebee, #ffcdd2)' : 'linear-gradient(to left, #fff3e0, #ffe0b2)'};
                                      border-radius: 4px;
                                      font-size: 10px;
                                      font-weight: 700;
                                      color: ${resolution.status === 'approved' || resolution.status === 'implemented' ? '#1b5e20' : resolution.status === 'rejected' ? '#b71c1c' : '#e65100'};
                                      border: 1px solid ${resolution.status === 'approved' || resolution.status === 'implemented' ? '#a5d6a7' : resolution.status === 'rejected' ? '#ef9a9a' : '#ffcc80'};
                                    }
                                    
                                    /* Signatures Section */
                                    .signatures-section {
                                      background: linear-gradient(to bottom, #fff, #fafafa);
                                      border: 1px solid #e0e0e0;
                                      border-radius: 6px;
                                      padding: 8px 10px;
                                    }
                                    
                                    .signatures-grid {
                                      display: grid;
                                      grid-template-columns: 1fr 1fr;
                                      gap: 6px;
                                    }
                                    
                                    .signature-card {
                                      background: white;
                                      border: 1px solid #e0e0e0;
                                      border-radius: 5px;
                                      padding: 5px 6px;
                                      text-align: center;
                                    }
                                    
                                    .signature-card.signed {
                                      background: linear-gradient(to bottom, #f1f8e9, #e8f5e9);
                                      border-color: #aed581;
                                    }
                                    
                                    .sig-header {
                                      margin-bottom: 3px;
                                      padding-bottom: 3px;
                                      border-bottom: 1px dashed #ddd;
                                    }
                                    
                                    .sig-name {
                                      font-size: 9px;
                                      font-weight: 700;
                                      color: #1a1a1a;
                                      line-height: 1.2;
                                    }
                                    
                                    .sig-position {
                                      font-size: 7px;
                                      color: #666;
                                      margin-top: 1px;
                                    }
                                    
                                    .sig-content {
                                      min-height: 28px;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      padding: 2px;
                                    }
                                    
                                    .sig-image {
                                      max-width: 80px;
                                      max-height: 26px;
                                      object-fit: contain;
                                    }
                                    
                                    .sig-line {
                                      color: #bbb;
                                      font-size: 11px;
                                      letter-spacing: 1px;
                                    }
                                    
                                    .sig-pending {
                                      color: #ff9800;
                                      font-size: 7px;
                                      font-style: italic;
                                      padding: 2px 6px;
                                      background: #fff8e1;
                                      border-radius: 8px;
                                    }
                                    
                                    .sig-declined {
                                      color: #f44336;
                                      font-size: 7px;
                                      padding: 2px 6px;
                                      background: #ffebee;
                                      border-radius: 8px;
                                    }
                                    
                                    .sig-footer {
                                      display: flex;
                                      justify-content: space-between;
                                      align-items: center;
                                      margin-top: 3px;
                                      padding-top: 3px;
                                      border-top: 1px dotted #eee;
                                      font-size: 7px;
                                    }
                                    
                                    .sig-date {
                                      color: #888;
                                    }
                                    
                                    .sig-status {
                                      padding: 3px 10px;
                                      border-radius: 12px;
                                      font-weight: 600;
                                    }
                                    
                                    .sig-status.signed {
                                      background: #e8f5e9;
                                      color: #2e7d32;
                                    }
                                    
                                    .sig-status.pending {
                                      background: #fff3e0;
                                      color: #e65100;
                                    }
                                    
                                    .sig-status.declined {
                                      background: #ffebee;
                                      color: #c62828;
                                    }
                                    
                                    /* Footer */
                                    .footer {
                                      margin-top: 6px;
                                      padding: 4px 10px;
                                      background: #f5f5f5;
                                      border-radius: 4px;
                                      display: flex;
                                      justify-content: space-between;
                                      align-items: center;
                                      font-size: 7px;
                                      color: #666;
                                    }
                                    
                                    .footer-right {
                                      display: flex;
                                      align-items: center;
                                      gap: 5px;
                                    }
                                    
                                    .footer-left {
                                      text-align: left;
                                    }
                                    
                                    /* Page Number Counter (for browsers that don't support @page counter) */
                                    .page-number {
                                      position: fixed;
                                      bottom: 5mm;
                                      left: 50%;
                                      transform: translateX(-50%);
                                      font-size: 9px;
                                      color: #888;
                                    }
                                    
                                    @media print {
                                      body { 
                                        print-color-adjust: exact; 
                                        -webkit-print-color-adjust: exact; 
                                      }
                                      .document { 
                                        padding: 0; 
                                      }
                                      .page-number {
                                        display: block;
                                      }
                                      /* Orphan and Widow control */
                                      p, .resolution-text {
                                        orphans: 3;
                                        widows: 3;
                                      }
                                    }
                                    
                                    @media screen {
                                      .page-number {
                                        display: none;
                                      }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="document">
                                    <div class="header">
                                      <div class="logo-section">
                                        <div class="logo-circle">B</div>
                                        <div class="company-info">
                                          <div class="company-name-ar">شركة الزبد الأفضل التجارية</div>
                                          <div class="company-name-en">THE BUTTER BEST TRADING COMPANY</div>
                                          <div class="company-details">شركة مساهمة مقفلة | سجل تجاري: 7026155296 | المملكة العربية السعودية</div>
                                        </div>
                                      </div>
                                      <div class="doc-title-section">
                                        <div class="doc-type-badge">قـــرار مجلس الإدارة</div>
                                        <div class="resolution-number">رقم: ${resolution.resolutionNumber}</div>
                                      </div>
                                      <div class="meta-section">
                                        <div class="meta-item"><span class="meta-label">التاريخ:</span> <span>${resolution.createdAt ? new Date(resolution.createdAt).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA')}</span></div>
                                        <div class="meta-item"><span class="meta-label">النوع:</span> <span>${resolutionType}</span></div>
                                        <div class="meta-item"><span class="meta-label">التصنيف:</span> <span>${category}</span></div>
                                        ${priority ? `<div class="meta-item"><span class="meta-label">الأولوية:</span> <span>${priority}</span></div>` : ''}
                                      </div>
                                    </div>
                                    
                                    <div class="main-content">
                                      <div class="content-section">
                                        <div class="section-title">
                                          <div class="section-icon">١</div>
                                          <span>نص القرار</span>
                                        </div>
                                        <div class="resolution-title-box">
                                          <h2>${resolution.title}</h2>
                                        </div>
                                        <div class="resolution-text">
                                          ${resolution.description || 'بناءً على الصلاحيات المخولة لمجلس الإدارة، وبعد الاطلاع على الموضوع المعروض، تقرر ما يلي:\n\n' + resolution.title}
                                        </div>
                                        
                                        <div class="section-title" style="margin-top: 8px;">
                                          <div class="section-icon">٢</div>
                                          <span>نتيجة التصويت</span>
                                        </div>
                                        <div class="voting-box">
                                          <div class="vote-item">
                                            <div class="vote-count for">${resolution.forVotes || 0}</div>
                                            <div class="vote-label">موافق</div>
                                          </div>
                                          <div class="vote-item">
                                            <div class="vote-count against">${resolution.againstVotes || 0}</div>
                                            <div class="vote-label">معارض</div>
                                          </div>
                                          <div class="vote-item">
                                            <div class="vote-count abstain">${resolution.abstainVotes || 0}</div>
                                            <div class="vote-label">ممتنع</div>
                                          </div>
                                        </div>
                                        <div class="result-badge">
                                          ${resolution.status === 'approved' || resolution.status === 'implemented' ? '✓ تم اعتماد القرار بالأغلبية' : resolution.status === 'rejected' ? '✗ تم رفض القرار' : '⏳ ' + status}
                                        </div>
                                      </div>
                                      
                                      <div class="signatures-section">
                                        <div class="section-title">
                                          <div class="section-icon">✍</div>
                                          <span>التوقيعات</span>
                                        </div>
                                        <div class="signatures-grid">
                                          ${signaturesHtml}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div class="footer">
                                      <div class="footer-right">شركة الزبد الأفضل التجارية (شركة مساهمة مقفلة) | سجل تجاري: 7026155296</div>
                                      <div class="footer-left">تم الطباعة: ${new Date().toLocaleDateString('ar-SA')} | وثيقة رسمية</div>
                                    </div>
                                  </div>
                                  <script>
                                    // Page numbering for browsers
                                    window.onload = function() {
                                      // This will work when printing
                                    };
                                  </script>
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
                            onClick={() => {
                              setEditingResolution(resolution);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            تعديل
                          </Button>
                          {isAdmin && (
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
                                    <span className="text-red-600">هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع البيانات المرتبطة بالقرار.</span>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex gap-2">
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate(resolution.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    {deleteMutation.isPending ? (
                                      <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري الحذف...</>
                                    ) : (
                                      "نعم، احذف القرار"
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    {selectedResolution.resolutionType === 'general_assembly' || selectedResolution.resolutionType === 'extraordinary_assembly'
                      ? 'التوقيع الإلكتروني معتمد قانونياً ويحمل صفة الإلزام. يمكنك إرسال روابط التوقيع لجميع المساهمين عبر البريد أو واتساب.'
                      : 'التوقيع الإلكتروني معتمد قانونياً ويحمل صفة الإلزام. يمكنك إرسال روابط التوقيع لأعضاء المجلس عبر البريد أو واتساب.'}
                  </p>
                </div>

                {signatures.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="text-gray-500 mb-4">
                      لم يتم إنشاء طلبات توقيع بعد
                    </div>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                      onClick={() => createSignatureRequestsMutation.mutate(selectedResolution.id)}
                      disabled={createSignatureRequestsMutation.isPending}
                    >
                      {createSignatureRequestsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {selectedResolution.resolutionType === 'general_assembly' || selectedResolution.resolutionType === 'extraordinary_assembly'
                        ? 'إنشاء طلبات التوقيع لجميع المساهمين'
                        : 'إنشاء طلبات التوقيع لجميع أعضاء المجلس'}
                    </Button>
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
                              {sig.signedAt ? new Date(sig.signedAt).toLocaleDateString('ar-SA') : '-'}
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
      </div>
    </Layout>
  );
}
