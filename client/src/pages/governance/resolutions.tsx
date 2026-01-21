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
} from "lucide-react";
import type { BoardResolution } from "@shared/schema";

const resolutionTypes = [
  { value: "regular", label: "قرار عادي" },
  { value: "circular", label: "قرار بالتمرير" },
  { value: "emergency", label: "قرار طارئ" },
  { value: "administrative", label: "قرار إداري" },
  { value: "financial", label: "قرار مالي" },
];

const resolutionStatuses = [
  { value: "draft", label: "مسودة", color: "bg-gray-100 text-gray-800" },
  { value: "proposed", label: "مقترح", color: "bg-blue-100 text-blue-800" },
  { value: "voting", label: "قيد التصويت", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "معتمد", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "مرفوض", color: "bg-red-100 text-red-800" },
  { value: "implemented", label: "منفذ", color: "bg-emerald-100 text-emerald-800" },
];

const categories = [
  { value: "financial", label: "مالي" },
  { value: "operational", label: "تشغيلي" },
  { value: "strategic", label: "استراتيجي" },
  { value: "hr", label: "موارد بشرية" },
  { value: "legal", label: "قانوني" },
  { value: "governance", label: "حوكمة" },
];

export default function ResolutionsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resolutions = [], isLoading } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
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
      implementationDeadline: deadlineStr ? new Date(deadlineStr) : null,
    };
    createMutation.mutate(data);
  };

  const filteredResolutions = resolutions.filter((res) => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.resolutionNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || res.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getVotePercentage = (res: BoardResolution) => {
    if (!res.totalVotes || res.totalVotes === 0) return 0;
    return ((res.forVotes || 0) / res.totalVotes) * 100;
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
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Scale className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-indigo-800" data-testid="page-title">
                قرارات مجلس الإدارة
              </h1>
              <p className="text-gray-600">توثيق ومتابعة قرارات المجلس</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" data-testid="btn-add-resolution">
                <Plus className="h-4 w-4" />
                قرار جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
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
                    <Select name="priority" defaultValue="normal">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">منخفضة</SelectItem>
                        <SelectItem value="normal">عادية</SelectItem>
                        <SelectItem value="high">عالية</SelectItem>
                        <SelectItem value="urgent">عاجلة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="implementationDeadline">موعد التنفيذ</Label>
                    <Input id="implementationDeadline" name="implementationDeadline" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">نص القرار *</Label>
                  <Textarea id="description" name="description" rows={4} required />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">إنشاء القرار</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-600">إجمالي القرارات</p>
                  <p className="text-2xl font-bold text-indigo-800">{resolutions.length}</p>
                </div>
                <Scale className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">قيد التصويت</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {resolutions.filter(r => r.status === 'voting').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">معتمدة</p>
                  <p className="text-2xl font-bold text-green-800">
                    {resolutions.filter(r => r.status === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">بحاجة للتنفيذ</p>
                  <p className="text-2xl font-bold text-red-800">
                    {resolutions.filter(r => r.status === 'approved' && r.implementationStatus === 'pending').length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="بحث بالعنوان أو الرقم..."
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

        <div className="grid gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                جاري التحميل...
              </CardContent>
            </Card>
          ) : filteredResolutions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                لا يوجد قرارات
              </CardContent>
            </Card>
          ) : (
            filteredResolutions.map((resolution) => (
              <Card key={resolution.id} className="hover:shadow-md transition-shadow" data-testid={`resolution-card-${resolution.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {resolution.resolutionNumber}
                        </Badge>
                        <Badge className={resolutionStatuses.find(s => s.value === resolution.status)?.color}>
                          {resolutionStatuses.find(s => s.value === resolution.status)?.label}
                        </Badge>
                        <Badge variant="outline">
                          {resolutionTypes.find(t => t.value === resolution.resolutionType)?.label}
                        </Badge>
                        {resolution.priority === 'urgent' && (
                          <Badge className="bg-red-100 text-red-800">عاجل</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{resolution.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{resolution.description}</p>
                      
                      {resolution.status === 'voting' && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">نتائج التصويت</span>
                            <span className="text-sm text-gray-500">
                              {resolution.totalVotes || 0} صوت
                            </span>
                          </div>
                          <Progress value={getVotePercentage(resolution)} className="h-2 mb-2" />
                          <div className="flex justify-between text-sm">
                            <div className="flex items-center gap-1 text-green-600">
                              <ThumbsUp className="h-4 w-4" />
                              <span>{resolution.forVotes || 0} موافق</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-600">
                              <ThumbsDown className="h-4 w-4" />
                              <span>{resolution.againstVotes || 0} رافض</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Minus className="h-4 w-4" />
                              <span>{resolution.abstainVotes || 0} ممتنع</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link href={`/governance/resolutions/${resolution.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
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
      </div>
    </Layout>
  );
}
