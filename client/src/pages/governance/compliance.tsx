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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Plus,
  ChevronLeft,
  Search,
  Edit,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  FileText,
  RefreshCw,
} from "lucide-react";
import type { ComplianceRequirement } from "@shared/schema";

const complianceCategories = [
  { value: "license", label: "ترخيص" },
  { value: "registration", label: "تسجيل" },
  { value: "permit", label: "تصريح" },
  { value: "certification", label: "شهادة" },
  { value: "report", label: "تقرير" },
  { value: "filing", label: "إيداع" },
];

const frequencies = [
  { value: "one_time", label: "مرة واحدة" },
  { value: "annual", label: "سنوي" },
  { value: "semi_annual", label: "نصف سنوي" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "monthly", label: "شهري" },
  { value: "as_needed", label: "عند الحاجة" },
];

const complianceStatuses = [
  { value: "valid", label: "ساري", color: "bg-green-100 text-green-800", icon: CheckCircle },
  { value: "expiring_soon", label: "قارب الانتهاء", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
  { value: "expired", label: "منتهي", color: "bg-red-100 text-red-800", icon: XCircle },
  { value: "under_renewal", label: "قيد التجديد", color: "bg-blue-100 text-blue-800", icon: RefreshCw },
  { value: "pending", label: "معلق", color: "bg-gray-100 text-gray-800", icon: Clock },
];

export default function CompliancePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requirements = [], isLoading } = useQuery<ComplianceRequirement[]>({
    queryKey: ["/api/governance/compliance"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ComplianceRequirement>) => {
      const res = await fetch("/api/governance/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create requirement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/compliance"] });
      setIsDialogOpen(false);
      toast({ title: "تم إضافة المتطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة المتطلب", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ComplianceRequirement> }) => {
      const res = await fetch(`/api/governance/compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update requirement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/compliance"] });
      setIsDialogOpen(false);
      setEditingRequirement(null);
      toast({ title: "تم تحديث المتطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث المتطلب", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const validFromStr = formData.get("validFrom") as string;
    const validUntilStr = formData.get("validUntil") as string;
    const nextDueDateStr = formData.get("nextDueDate") as string;
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      regulatoryBody: formData.get("regulatoryBody") as string,
      frequency: formData.get("frequency") as string,
      validFrom: validFromStr ? new Date(validFromStr) : null,
      validUntil: validUntilStr ? new Date(validUntilStr) : null,
      nextDueDate: nextDueDateStr ? new Date(nextDueDateStr) : null,
      reminderDays: parseInt(formData.get("reminderDays") as string) || 30,
      documentNumber: formData.get("documentNumber") as string,
      priority: formData.get("priority") as string,
    };

    if (editingRequirement) {
      updateMutation.mutate({ id: editingRequirement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredRequirements = requirements.filter((req) => {
    const matchesSearch = req.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || req.currentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDaysUntilExpiry = (date: string | null) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
            <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-red-800" data-testid="page-title">
                الامتثال النظامي
              </h1>
              <p className="text-gray-600">متابعة التراخيص والتجديدات والمتطلبات</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingRequirement(null);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-red-600 hover:bg-red-700" data-testid="btn-add-requirement">
                <Plus className="h-4 w-4" />
                إضافة متطلب
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRequirement ? "تعديل المتطلب" : "إضافة متطلب جديد"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="title">العنوان *</Label>
                    <Input id="title" name="title" defaultValue={editingRequirement?.title || ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">التصنيف *</Label>
                    <Select name="category" defaultValue={editingRequirement?.category || "license"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {complianceCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regulatoryBody">الجهة المنظمة *</Label>
                    <Input id="regulatoryBody" name="regulatoryBody" defaultValue={editingRequirement?.regulatoryBody || ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frequency">التكرار *</Label>
                    <Select name="frequency" defaultValue={editingRequirement?.frequency || "annual"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencies.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">الأولوية</Label>
                    <Select name="priority" defaultValue={editingRequirement?.priority || "normal"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">منخفضة</SelectItem>
                        <SelectItem value="normal">عادية</SelectItem>
                        <SelectItem value="high">عالية</SelectItem>
                        <SelectItem value="critical">حرجة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validFrom">ساري من</Label>
                    <Input id="validFrom" name="validFrom" type="date" defaultValue={editingRequirement?.validFrom || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validUntil">ساري حتى</Label>
                    <Input id="validUntil" name="validUntil" type="date" defaultValue={editingRequirement?.validUntil || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextDueDate">موعد الاستحقاق القادم</Label>
                    <Input id="nextDueDate" name="nextDueDate" type="date" defaultValue={editingRequirement?.nextDueDate || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminderDays">أيام التذكير</Label>
                    <Input id="reminderDays" name="reminderDays" type="number" defaultValue={editingRequirement?.reminderDays || 30} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="documentNumber">رقم الوثيقة</Label>
                    <Input id="documentNumber" name="documentNumber" defaultValue={editingRequirement?.documentNumber || ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea id="description" name="description" defaultValue={editingRequirement?.description || ""} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-red-600 hover:bg-red-700">
                    {editingRequirement ? "تحديث" : "إضافة"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">ساري</p>
                  <p className="text-2xl font-bold text-green-800">
                    {requirements.filter(r => r.currentStatus === 'valid').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">قارب الانتهاء</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {requirements.filter(r => r.currentStatus === 'expiring_soon').length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">منتهي</p>
                  <p className="text-2xl font-bold text-red-800">
                    {requirements.filter(r => r.currentStatus === 'expired').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">قيد التجديد</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {requirements.filter(r => r.currentStatus === 'under_renewal').length}
                  </p>
                </div>
                <RefreshCw className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="بحث..."
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
              {complianceStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المتطلب</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  <TableHead className="text-right">الجهة المنظمة</TableHead>
                  <TableHead className="text-right">التكرار</TableHead>
                  <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredRequirements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      لا يوجد متطلبات
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequirements.map((req) => {
                    const daysUntil = getDaysUntilExpiry(req.validUntil);
                    return (
                      <TableRow key={req.id} data-testid={`compliance-row-${req.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{req.title}</p>
                            {req.documentNumber && (
                              <p className="text-sm text-gray-500">رقم: {req.documentNumber}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {complianceCategories.find(c => c.value === req.category)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{req.regulatoryBody}</TableCell>
                        <TableCell>
                          {frequencies.find(f => f.value === req.frequency)?.label}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{req.validUntil || '-'}</span>
                            {daysUntil !== null && daysUntil <= 30 && daysUntil > 0 && (
                              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                {daysUntil} يوم
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={complianceStatuses.find(s => s.value === req.currentStatus)?.color}>
                            {complianceStatuses.find(s => s.value === req.currentStatus)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingRequirement(req);
                                setIsDialogOpen(true);
                              }}
                              data-testid={`edit-compliance-${req.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
