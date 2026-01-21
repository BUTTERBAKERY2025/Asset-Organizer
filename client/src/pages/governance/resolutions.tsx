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
} from "lucide-react";
import type { BoardResolution, BoardMember } from "@shared/schema";

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
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              تصدير
            </Button>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-emerald-600" />
                التوقيعات الإلكترونية
              </DialogTitle>
            </DialogHeader>
            {selectedResolution && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    التوقيع الإلكتروني معتمد قانونياً ويحمل صفة الإلزام
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العضو</TableHead>
                      <TableHead className="text-right">المنصب</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.filter(m => m.status === "active").length > 0 ? (
                      members.filter(m => m.status === "active").map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.fullName}</TableCell>
                          <TableCell>{member.position}</TableCell>
                          <TableCell>
                            <Badge className="bg-gray-100 text-gray-600">في الانتظار</Badge>
                          </TableCell>
                          <TableCell className="text-gray-400">-</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                          لا يوجد أعضاء مجلس مسجلين
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="font-medium">التوقيعات المكتملة</span>
                  <span className="font-bold">0 / {members.filter(m => m.status === "active").length}</span>
                </div>

                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <PenLine className="h-4 w-4" />
                  التوقيع على القرار
                </Button>
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
