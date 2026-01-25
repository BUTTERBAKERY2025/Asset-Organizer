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
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import type { BoardResolution, BoardMember } from "@shared/schema";
import { exportToExcel, exportToCSV, printAsPDF } from "@/lib/export-utils";

const resolutionTypes = [
  { value: "regular", label: "قرار عادي" },
  { value: "circular", label: "قرار بالتمرير" },
  { value: "emergency", label: "قرار طارئ" },
  { value: "administrative", label: "قرار إداري" },
  { value: "financial", label: "قرار مالي" },
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      if (!res.ok) return [];
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
      if (!res.ok) throw new Error("Failed to create resolution");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setIsDialogOpen(false);
      toast({ title: "تم إنشاء القرار بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء القرار", variant: "destructive" });
    },
  });

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

  const filteredResolutions = resolutions.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesTab = activeTab === "all" || 
      (activeTab === "pending" && (r.status === "draft" || r.status === "proposed" || r.status === "voting")) ||
      (activeTab === "approved" && r.status === "approved") ||
      (activeTab === "rejected" && r.status === "rejected") ||
      (activeTab === "implemented" && r.status === "implemented");
    return matchesSearch && matchesStatus && matchesTab;
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
      <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <Scale className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-emerald-800" data-testid="page-title">
                القرارات والتوصيات
              </h1>
              <p className="text-gray-600">سير العمل والتوقيع الإلكتروني</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">مسودات</p>
                  <p className="text-2xl font-bold text-gray-800">{draftCount}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">قيد التصويت</p>
                  <p className="text-2xl font-bold text-yellow-800">{votingCount}</p>
                </div>
                <Vote className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">معتمدة</p>
                  <p className="text-2xl font-bold text-green-800">{approvedCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600">منفذة</p>
                  <p className="text-2xl font-bold text-emerald-800">{implementedCount}</p>
                </div>
                <CheckCheck className="h-8 w-8 text-emerald-500" />
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
                            onClick={() => {
                              const resolutionType = resolutionTypes.find(t => t.value === resolution.resolutionType)?.label || resolution.resolutionType;
                              const status = resolutionStatuses.find(s => s.value === resolution.status)?.label || resolution.status;
                              const priority = priorities.find(p => p.value === resolution.priority)?.label || resolution.priority;
                              const category = categories.find(c => c.value === resolution.category)?.label || resolution.category;
                              const html = `
                                <!DOCTYPE html>
                                <html dir="rtl" lang="ar">
                                <head>
                                  <meta charset="UTF-8">
                                  <title>قرار رقم ${resolution.resolutionNumber}</title>
                                  <style>
                                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                                    @page { size: A4 portrait; margin: 12mm 12mm; }
                                    * { box-sizing: border-box; margin: 0; padding: 0; }
                                    body { 
                                      font-family: 'Cairo', sans-serif; 
                                      padding: 0; 
                                      direction: rtl; 
                                      background: white;
                                      color: #1a1a1a;
                                      line-height: 1.4;
                                      font-size: 13px;
                                    }
                                    .document {
                                      max-width: 210mm;
                                      margin: 0 auto;
                                      padding: 25px;
                                      background: white;
                                    }
                                    .letterhead {
                                      text-align: center;
                                      padding-bottom: 12px;
                                      margin-bottom: 15px;
                                      border-bottom: 2px double #1a5f3c;
                                    }
                                    .company-name {
                                      font-size: 22px;
                                      font-weight: 800;
                                      color: #1a5f3c;
                                      margin-bottom: 2px;
                                    }
                                    .company-subtitle {
                                      font-size: 11px;
                                      color: #666;
                                      margin-bottom: 3px;
                                    }
                                    .company-info {
                                      font-size: 10px;
                                      color: #888;
                                      margin-bottom: 8px;
                                    }
                                    .document-type {
                                      display: inline-block;
                                      background: linear-gradient(135deg, #1a5f3c 0%, #2d8f5e 100%);
                                      color: white;
                                      padding: 6px 30px;
                                      font-size: 16px;
                                      font-weight: 700;
                                      border-radius: 4px;
                                      margin-top: 5px;
                                    }
                                    .resolution-meta {
                                      display: flex;
                                      justify-content: space-between;
                                      align-items: center;
                                      background: #f8f9fa;
                                      border: 1px solid #e9ecef;
                                      border-radius: 6px;
                                      padding: 12px 15px;
                                      margin-bottom: 15px;
                                    }
                                    .meta-right { text-align: right; }
                                    .meta-left { text-align: left; }
                                    .resolution-number-box {
                                      font-size: 14px;
                                      font-weight: 700;
                                      color: #1a5f3c;
                                    }
                                    .resolution-date {
                                      font-size: 11px;
                                      color: #666;
                                      margin-top: 2px;
                                    }
                                    .meta-badge {
                                      display: inline-block;
                                      padding: 4px 10px;
                                      border-radius: 15px;
                                      font-size: 11px;
                                      font-weight: 600;
                                    }
                                    .badge-type { background: #e8f5e9; color: #2e7d32; margin-left: 5px; }
                                    .badge-priority { background: #fff3e0; color: #e65100; }
                                    .main-title {
                                      text-align: center;
                                      margin: 15px 0;
                                      padding: 12px;
                                      background: linear-gradient(to left, #f8f9fa, white, #f8f9fa);
                                      border-right: 3px solid #1a5f3c;
                                      border-left: 3px solid #1a5f3c;
                                    }
                                    .main-title h2 {
                                      font-size: 16px;
                                      font-weight: 700;
                                      color: #1a1a1a;
                                      line-height: 1.4;
                                    }
                                    .section {
                                      margin-bottom: 12px;
                                    }
                                    .section-header {
                                      display: flex;
                                      align-items: center;
                                      margin-bottom: 8px;
                                      padding-bottom: 5px;
                                      border-bottom: 1px solid #1a5f3c;
                                    }
                                    .section-icon {
                                      width: 22px;
                                      height: 22px;
                                      background: #1a5f3c;
                                      color: white;
                                      border-radius: 50%;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      margin-left: 8px;
                                      font-size: 11px;
                                      font-weight: bold;
                                    }
                                    .section-title {
                                      font-size: 13px;
                                      font-weight: 700;
                                      color: #1a5f3c;
                                    }
                                    .section-content {
                                      padding: 12px;
                                      background: #fafafa;
                                      border: 1px solid #eee;
                                      border-radius: 5px;
                                      line-height: 1.7;
                                      text-align: justify;
                                      white-space: pre-wrap;
                                      font-size: 12px;
                                    }
                                    .voting-section {
                                      margin: 15px 0;
                                      padding: 12px;
                                      background: #f8f9fa;
                                      border-radius: 6px;
                                      border: 1px solid #e9ecef;
                                    }
                                    .voting-title {
                                      text-align: center;
                                      font-size: 13px;
                                      font-weight: 700;
                                      color: #1a5f3c;
                                      margin-bottom: 10px;
                                    }
                                    .votes-grid {
                                      display: flex;
                                      justify-content: center;
                                      gap: 20px;
                                    }
                                    .vote-item {
                                      text-align: center;
                                      min-width: 70px;
                                    }
                                    .vote-count {
                                      font-size: 24px;
                                      font-weight: 800;
                                      display: block;
                                    }
                                    .vote-count.for { color: #2e7d32; }
                                    .vote-count.against { color: #c62828; }
                                    .vote-count.abstain { color: #757575; }
                                    .vote-type {
                                      font-size: 11px;
                                      color: #666;
                                      font-weight: 600;
                                    }
                                    .result-box {
                                      text-align: center;
                                      margin-top: 10px;
                                      padding: 8px;
                                      background: ${resolution.status === 'approved' || resolution.status === 'implemented' ? '#e8f5e9' : resolution.status === 'rejected' ? '#ffebee' : '#fff3e0'};
                                      border-radius: 5px;
                                      font-size: 14px;
                                      font-weight: 700;
                                      color: ${resolution.status === 'approved' || resolution.status === 'implemented' ? '#2e7d32' : resolution.status === 'rejected' ? '#c62828' : '#e65100'};
                                    }
                                    .signatures {
                                      margin-top: 25px;
                                      display: grid;
                                      grid-template-columns: 1fr 1fr;
                                      gap: 25px;
                                    }
                                    .signature-box {
                                      text-align: center;
                                      padding-top: 35px;
                                      border-top: 1px solid #333;
                                    }
                                    .signature-title {
                                      font-size: 12px;
                                      font-weight: 600;
                                      color: #333;
                                    }
                                    .signature-name {
                                      font-size: 10px;
                                      color: #666;
                                      margin-top: 3px;
                                    }
                                    .footer {
                                      margin-top: 20px;
                                      padding-top: 10px;
                                      border-top: 1px solid #ddd;
                                      text-align: center;
                                      font-size: 11px;
                                      color: #999;
                                    }
                                    .footer-line {
                                      margin: 3px 0;
                                    }
                                    @media print {
                                      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                                      .document { padding: 0; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="document">
                                    <div class="letterhead">
                                      <div class="company-name">شركة الزبد الأفضل التجارية</div>
                                      <div class="company-subtitle">BUTTER BAKERY SYSTEM - CEO COMMAND</div>
                                      <div class="company-info">شركة مساهمة | سجل تجاري: 7026155296 | المملكة العربية السعودية</div>
                                      <div class="document-type">قـــرار إداري</div>
                                    </div>
                                    
                                    <div class="resolution-meta">
                                      <div class="meta-right">
                                        <div class="resolution-number-box">رقم القرار: ${resolution.resolutionNumber}</div>
                                        <div class="resolution-date">التاريخ: ${resolution.createdAt ? new Date(resolution.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                      </div>
                                      <div class="meta-left">
                                        <span class="meta-badge badge-type">${resolutionType}</span>
                                        ${priority ? `<span class="meta-badge badge-priority">${priority}</span>` : ''}
                                      </div>
                                    </div>

                                    <div class="main-title">
                                      <h2>${resolution.title}</h2>
                                    </div>

                                    <div class="section">
                                      <div class="section-header">
                                        <div class="section-icon">١</div>
                                        <span class="section-title">نص القرار</span>
                                      </div>
                                      <div class="section-content">
                                        ${resolution.description || 'بناءً على الصلاحيات المخولة لمجلس الإدارة، وبعد الاطلاع على الموضوع المعروض، تقرر ما يلي:\n\n' + resolution.title}
                                      </div>
                                    </div>

                                    <div class="voting-section">
                                      <div class="voting-title">نتيجة التصويت</div>
                                      <div class="votes-grid">
                                        <div class="vote-item">
                                          <span class="vote-count for">${resolution.forVotes || 0}</span>
                                          <span class="vote-type">موافق</span>
                                        </div>
                                        <div class="vote-item">
                                          <span class="vote-count against">${resolution.againstVotes || 0}</span>
                                          <span class="vote-type">معارض</span>
                                        </div>
                                        <div class="vote-item">
                                          <span class="vote-count abstain">${resolution.abstainVotes || 0}</span>
                                          <span class="vote-type">ممتنع</span>
                                        </div>
                                      </div>
                                      <div class="result-box">
                                        ${resolution.status === 'approved' || resolution.status === 'implemented' ? '✓ تم اعتماد القرار بالأغلبية' : resolution.status === 'rejected' ? '✗ تم رفض القرار' : '⏳ ' + status}
                                      </div>
                                    </div>

                                    <div class="signatures">
                                      <div class="signature-box">
                                        <div class="signature-title">رئيس مجلس الإدارة</div>
                                        <div class="signature-name">________________________</div>
                                      </div>
                                      <div class="signature-box">
                                        <div class="signature-title">أمين سر المجلس</div>
                                        <div class="signature-name">________________________</div>
                                      </div>
                                    </div>

                                    <div class="footer">
                                      <div class="footer-line">شركة الزبد الأفضل التجارية (شركة مساهمة) - سجل تجاري: 7026155296</div>
                                      <div class="footer-line">تم الطباعة: ${new Date().toLocaleDateString('en-GB')} | وثيقة رسمية</div>
                                    </div>
                                  </div>
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

                <div className="flex gap-2">
                  {selectedResolution.status === "draft" && (
                    <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                      <Send className="h-4 w-4" />
                      رفع للمراجعة
                    </Button>
                  )}
                  {selectedResolution.status === "proposed" && (
                    <Button className="bg-yellow-600 hover:bg-yellow-700 gap-2">
                      <Vote className="h-4 w-4" />
                      فتح التصويت
                    </Button>
                  )}
                  {selectedResolution.status === "approved" && (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                      <CheckCheck className="h-4 w-4" />
                      تأكيد التنفيذ
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
                    التوقيع الإلكتروني معتمد قانونياً ويحمل صفة الإلزام. يمكنك إرسال روابط التوقيع لأعضاء المجلس عبر البريد أو واتساب.
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
                      إنشاء طلبات التوقيع لجميع أعضاء المجلس
                    </Button>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">العضو</TableHead>
                          <TableHead className="text-right">المنصب</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الإجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signatures.map((sig) => (
                          <TableRow key={sig.id}>
                            <TableCell className="font-medium">{sig.memberName}</TableCell>
                            <TableCell>{sig.memberPosition}</TableCell>
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
                            <TableCell className="text-gray-600">
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
      </div>
    </Layout>
  );
}
