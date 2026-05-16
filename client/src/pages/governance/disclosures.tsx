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
import { useToast } from "@/hooks/use-toast";
import {
  FileCheck,
  Plus,
  ChevronLeft,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Send,
  Eye,
  Download,
} from "lucide-react";
import type { Disclosure } from "@shared/schema";

const disclosureTypes = [
  { value: "annual_report", label: "تقرير سنوي" },
  { value: "quarterly_report", label: "تقرير ربعي" },
  { value: "financial_statement", label: "قائمة مالية" },
  { value: "board_changes", label: "تغييرات مجلس الإدارة" },
  { value: "material_event", label: "حدث جوهري" },
  { value: "ownership_change", label: "تغيير ملكية" },
  { value: "dividend_announcement", label: "إعلان توزيعات" },
  { value: "other", label: "أخرى" },
];

const disclosureStatuses = [
  { value: "draft", label: "مسودة", color: "bg-gray-100 text-gray-800" },
  { value: "pending_review", label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "معتمد", color: "bg-blue-100 text-blue-800" },
  { value: "submitted", label: "مقدم", color: "bg-green-100 text-green-800" },
  { value: "published", label: "منشور", color: "bg-emerald-100 text-emerald-800" },
  { value: "rejected", label: "مرفوض", color: "bg-red-100 text-red-800" },
];

const fiscalQuarters = [
  { value: "Q1", label: "الربع الأول" },
  { value: "Q2", label: "الربع الثاني" },
  { value: "Q3", label: "الربع الثالث" },
  { value: "Q4", label: "الربع الرابع" },
];

export default function DisclosuresPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: disclosures = [], isLoading } = useQuery<Disclosure[]>({
    queryKey: ["/api/governance/disclosures"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Disclosure>) => {
      const res = await fetch("/api/governance/disclosures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create disclosure");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/disclosures"] });
      setIsDialogOpen(false);
      toast({ title: "تم إنشاء الإفصاح بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الإفصاح", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dueDateStr = formData.get("dueDate") as string;
    const periodStartStr = formData.get("reportingPeriodStart") as string;
    const periodEndStr = formData.get("reportingPeriodEnd") as string;
    const data = {
      disclosureType: formData.get("disclosureType") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      fiscalYear: formData.get("fiscalYear") as string,
      fiscalQuarter: formData.get("fiscalQuarter") as string || null,
      regulatoryBody: formData.get("regulatoryBody") as string,
      category: formData.get("category") as string,
      dueDate: dueDateStr || null,
      reportingPeriodStart: periodStartStr || null,
      reportingPeriodEnd: periodEndStr || null,
      content: formData.get("content") as string,
    };
    createMutation.mutate(data);
  };

  const filteredDisclosures = disclosures.filter((d) => {
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.disclosureNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDaysUntilDue = (date: string | null) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl">
              <FileCheck className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-teal-800" data-testid="page-title">
                الإفصاحات والتقارير
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">رفع القوائم المالية والتقارير النظامية</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="btn-add-disclosure">
                <Plus className="h-4 w-4" />
                إفصاح جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إنشاء إفصاح جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="disclosureType">نوع الإفصاح *</Label>
                    <Select name="disclosureType" defaultValue="annual_report">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {disclosureTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regulatoryBody">الجهة المنظمة *</Label>
                    <Input id="regulatoryBody" name="regulatoryBody" placeholder="هيئة السوق المالية" required />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="title">عنوان الإفصاح *</Label>
                    <Input id="title" name="title" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiscalYear">السنة المالية *</Label>
                    <Input id="fiscalYear" name="fiscalYear" defaultValue={new Date().getFullYear().toString()} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiscalQuarter">الربع المالي</Label>
                    <Select name="fiscalQuarter">
                      <SelectTrigger>
                        <SelectValue placeholder="اختياري" />
                      </SelectTrigger>
                      <SelectContent>
                        {fiscalQuarters.map((q) => (
                          <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportingPeriodStart">بداية فترة التقرير</Label>
                    <Input id="reportingPeriodStart" name="reportingPeriodStart" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportingPeriodEnd">نهاية فترة التقرير</Label>
                    <Input id="reportingPeriodEnd" name="reportingPeriodEnd" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                    <Input id="dueDate" name="dueDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">التصنيف</Label>
                    <Select name="category" defaultValue="financial">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="financial">مالي</SelectItem>
                        <SelectItem value="operational">تشغيلي</SelectItem>
                        <SelectItem value="governance">حوكمة</SelectItem>
                        <SelectItem value="regulatory">تنظيمي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">وصف الإفصاح</Label>
                  <Textarea id="description" name="description" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">محتوى الإفصاح</Label>
                  <Textarea id="content" name="content" rows={4} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-teal-600 hover:bg-teal-700">إنشاء الإفصاح</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-teal-600">إجمالي الإفصاحات</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-teal-800">{disclosures.length}</p>
                </div>
                <FileCheck className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-yellow-600">قيد المراجعة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-800">
                    {disclosures.filter(d => d.status === 'pending_review').length}
                  </p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600">منشور</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800">
                    {disclosures.filter(d => d.status === 'published').length}
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600">مقدم</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800">
                    {disclosures.filter(d => d.status === 'submitted').length}
                  </p>
                </div>
                <Send className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
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
              {disclosureStatuses.map((s) => (
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
          ) : filteredDisclosures.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                لا يوجد إفصاحات
              </CardContent>
            </Card>
          ) : (
            filteredDisclosures.map((disclosure) => {
              const daysUntil = getDaysUntilDue(disclosure.dueDate);
              return (
                <Card key={disclosure.id} className="hover:shadow-md transition-shadow" data-testid={`disclosure-card-${disclosure.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 sm:gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">
                            {disclosure.disclosureNumber}
                          </Badge>
                          <Badge className={`text-[10px] sm:text-xs ${disclosureStatuses.find(s => s.value === disclosure.status)?.color}`}>
                            {disclosureStatuses.find(s => s.value === disclosure.status)?.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {disclosureTypes.find(t => t.value === disclosure.disclosureType)?.label}
                          </Badge>
                          {disclosure.fiscalQuarter && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs">{fiscalQuarters.find(q => q.value === disclosure.fiscalQuarter)?.label}</Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{disclosure.title}</h3>
                        {disclosure.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{disclosure.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>السنة المالية: {disclosure.fiscalYear}</span>
                          </div>
                          {disclosure.dueDate && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>الاستحقاق: {new Date(disclosure.dueDate).toLocaleDateString('en-GB')}</span>
                              {daysUntil !== null && daysUntil <= 7 && daysUntil > 0 && (
                                <Badge className="bg-red-100 text-red-800 text-xs mr-1">
                                  {daysUntil} يوم
                                </Badge>
                              )}
                            </div>
                          )}
                          {disclosure.regulatoryBody && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              <span>{disclosure.regulatoryBody}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 ml-2" />
                          عرض
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 ml-2" />
                          تحميل
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
