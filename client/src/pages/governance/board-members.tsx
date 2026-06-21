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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  ChevronLeft,
  Search,
  Edit,
  Trash2,
  UserCheck,
  Crown,
  Shield,
  Calendar,
  Phone,
  Mail,
  Building2,
  GraduationCap,
  Award,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Briefcase,
  TrendingUp,
  Eye,
  UserPlus,
  CalendarCheck,
  BookOpen,
} from "lucide-react";
import type { BoardMember } from "@shared/schema";

const positions = [
  { value: "chairman", label: "رئيس مجلس الإدارة" },
  { value: "vice_chairman", label: "نائب رئيس مجلس الإدارة" },
  { value: "member", label: "عضو مجلس الإدارة" },
  { value: "secretary", label: "أمين السر" },
  { value: "independent_member", label: "عضو مستقل" },
];

const memberTypes = [
  { value: "executive", label: "تنفيذي" },
  { value: "non_executive", label: "غير تنفيذي" },
  { value: "independent", label: "مستقل" },
];

const statuses = [
  { value: "active", label: "نشط", color: "bg-green-100 text-green-800" },
  { value: "resigned", label: "مستقيل", color: "bg-gray-100 text-gray-800" },
  { value: "expired", label: "منتهي العضوية", color: "bg-red-100 text-red-800" },
  { value: "suspended", label: "موقوف", color: "bg-yellow-100 text-yellow-800" },
];

const committeeTypes = [
  { value: "audit", label: "لجنة المراجعة", color: "bg-blue-100 text-blue-800" },
  { value: "remuneration", label: "لجنة المكافآت", color: "bg-purple-100 text-purple-800" },
  { value: "nomination", label: "لجنة الترشيحات", color: "bg-indigo-100 text-indigo-800" },
  { value: "risk", label: "لجنة المخاطر", color: "bg-red-100 text-red-800" },
  { value: "executive", label: "اللجنة التنفيذية", color: "bg-amber-100 text-amber-800" },
  { value: "investment", label: "لجنة الاستثمار", color: "bg-green-100 text-green-800" },
];

const trainingTypes = [
  { value: "governance", label: "حوكمة الشركات" },
  { value: "financial", label: "مالية ومحاسبية" },
  { value: "legal", label: "قانونية" },
  { value: "compliance", label: "امتثال" },
  { value: "leadership", label: "قيادة" },
  { value: "industry", label: "تخصصية" },
];

export default function BoardMembersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("members");
  const [selectedMember, setSelectedMember] = useState<BoardMember | null>(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [showAddDeclaration, setShowAddDeclaration] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery<BoardMember[]>({
    queryKey: ["/api/governance/board-members"],
  });

  const activeMembers = members.filter(m => m.status === "active");
  const expiringMembers = members.filter(m => {
    if (!m.termEndDate) return false;
    const endDate = new Date(m.termEndDate);
    const now = new Date();
    const diffDays = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 90;
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<BoardMember>) => {
      const res = await fetch("/api/governance/board-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/board-members"] });
      setIsDialogOpen(false);
      toast({ title: "تم إضافة عضو المجلس بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة عضو المجلس", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BoardMember> }) => {
      const res = await fetch(`/api/governance/board-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/board-members"] });
      setIsDialogOpen(false);
      setEditingMember(null);
      toast({ title: "تم تحديث بيانات العضو بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث بيانات العضو", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/board-members/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/board-members"] });
      toast({ title: "تم حذف العضو بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف العضو", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const appointmentDateStr = formData.get("appointmentDate") as string;
    const termEndDateStr = formData.get("termEndDate") as string;
    const data = {
      fullName: formData.get("fullName") as string,
      nationalId: formData.get("nationalId") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      position: formData.get("position") as string,
      memberType: formData.get("memberType") as string,
      nationality: formData.get("nationality") as string,
      qualifications: formData.get("qualifications") as string,
      experience: formData.get("experience") as string,
      currentEmployer: formData.get("currentEmployer") as string,
      appointmentDate: appointmentDateStr || undefined,
      termEndDate: termEndDateStr || undefined,
      status: formData.get("status") as string || "active",
    };

    if (editingMember) {
      updateMutation.mutate({ id: editingMember.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPositionIcon = (position: string) => {
    switch (position) {
      case "chairman": return <Crown className="h-4 w-4 text-amber-500" />;
      case "vice_chairman": return <Shield className="h-4 w-4 text-blue-500" />;
      default: return <UserCheck className="h-4 w-4 text-gray-500" />;
    }
  };

  const getDaysUntilExpiry = (termEndDate: string | null) => {
    if (!termEndDate) return null;
    const endDate = new Date(termEndDate);
    const now = new Date();
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Layout>
      <div className="page-container space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg sm:rounded-xl">
              <Users className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-violet-800" data-testid="page-title">
                أعضاء مجلس الإدارة
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">إدارة الأعضاء واللجان والتدريب والإفصاحات</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingMember(null);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm bg-violet-600 hover:bg-violet-700" data-testid="btn-add-member">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                إضافة عضو
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMember ? "تعديل بيانات العضو" : "إضافة عضو جديد"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">الاسم الكامل *</Label>
                    <Input id="fullName" name="fullName" defaultValue={editingMember?.fullName || ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">رقم الهوية</Label>
                    <Input id="nationalId" name="nationalId" defaultValue={editingMember?.nationalId || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input id="email" name="email" type="email" defaultValue={editingMember?.email || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input id="phone" name="phone" defaultValue={editingMember?.phone || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">المنصب *</Label>
                    <Select name="position" defaultValue={editingMember?.position || "member"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((pos) => (
                          <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberType">نوع العضوية</Label>
                    <Select name="memberType" defaultValue={editingMember?.memberType || "executive"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {memberTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">الجنسية</Label>
                    <Input id="nationality" name="nationality" defaultValue={editingMember?.nationality || "سعودي"} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentEmployer">جهة العمل الحالية</Label>
                    <Input id="currentEmployer" name="currentEmployer" defaultValue={editingMember?.currentEmployer || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointmentDate">تاريخ التعيين *</Label>
                    <Input id="appointmentDate" name="appointmentDate" type="date" defaultValue={editingMember?.appointmentDate || ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="termEndDate">تاريخ انتهاء العضوية</Label>
                    <Input id="termEndDate" name="termEndDate" type="date" defaultValue={editingMember?.termEndDate || ""} />
                  </div>
                  {editingMember && (
                    <div className="space-y-2">
                      <Label htmlFor="status">الحالة</Label>
                      <Select name="status" defaultValue={editingMember?.status || "active"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualifications">المؤهلات العلمية</Label>
                  <Textarea id="qualifications" name="qualifications" defaultValue={editingMember?.qualifications || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience">الخبرات العملية</Label>
                  <Textarea id="experience" name="experience" defaultValue={editingMember?.experience || ""} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                    {editingMember ? "تحديث" : "إضافة"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="kpi-grid">
          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-violet-600">الأعضاء النشطين</p>
                  <p className="text-lg sm:text-2xl font-bold text-violet-800">{activeMembers.length}</p>
                </div>
                <Users className="h-5 w-5 sm:h-8 sm:w-8 text-violet-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-amber-600">قرب انتهاء العضوية</p>
                  <p className="text-lg sm:text-2xl font-bold text-amber-800">{expiringMembers.length}</p>
                </div>
                <AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-blue-600">اللجان الفرعية</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{committeeTypes.length}</p>
                </div>
                <Briefcase className="h-5 w-5 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-green-600">معدل الحضور</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-800">85%</p>
                </div>
                <CalendarCheck className="h-5 w-5 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 h-auto">
            <TabsTrigger value="members" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">الأعضاء</span>
            </TabsTrigger>
            <TabsTrigger value="committees" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">اللجان</span>
            </TabsTrigger>
            <TabsTrigger value="training" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">التدريب</span>
            </TabsTrigger>
            <TabsTrigger value="declarations" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">الإفصاحات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="بحث بالاسم أو البريد..."
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
                  {statuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {expiringMembers.length > 0 && (
              <Card className="border-2 border-amber-300 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-800">تنبيه: أعضاء قرب انتهاء عضويتهم</h3>
                  </div>
                  <div className="grid gap-2">
                    {expiringMembers.map((member) => {
                      const days = getDaysUntilExpiry(member.termEndDate);
                      return (
                        <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-amber-100 text-amber-600 text-sm">
                                {member.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{member.fullName}</span>
                          </div>
                          <Badge className="bg-amber-100 text-amber-800">
                            <Clock className="h-3 w-3 ml-1" />
                            {days} يوم متبقي
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العضو</TableHead>
                      <TableHead className="text-right">المنصب</TableHead>
                      <TableHead className="text-right hidden md:table-cell">نوع العضوية</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">التواصل</TableHead>
                      <TableHead className="text-right hidden md:table-cell">فترة العضوية</TableHead>
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
                    ) : filteredMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          لا يوجد أعضاء
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMembers.map((member) => {
                        const days = getDaysUntilExpiry(member.termEndDate);
                        const isExpiring = days !== null && days > 0 && days <= 90;
                        return (
                          <TableRow key={member.id} className={isExpiring ? "bg-amber-50" : ""} data-testid={`member-row-${member.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={member.photoUrl || undefined} />
                                  <AvatarFallback className="bg-violet-100 text-violet-600">
                                    {member.fullName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{member.fullName}</p>
                                  <p className="text-sm text-gray-500">{member.nationality}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getPositionIcon(member.position)}
                                <span>{positions.find(p => p.value === member.position)?.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {memberTypes.find(t => t.value === member.memberType)?.label}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="space-y-1">
                                {member.email && (
                                  <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[120px]">{member.email}</span>
                                  </div>
                                )}
                                {member.phone && (
                                  <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <Phone className="h-3 w-3" />
                                    {member.phone}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1 text-xs">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span>{member.appointmentDate}</span>
                                {member.termEndDate && (
                                  <>
                                    <span className="text-gray-400">→</span>
                                    <span className={isExpiring ? "text-amber-600 font-medium" : ""}>{member.termEndDate}</span>
                                  </>
                                )}
                              </div>
                              {isExpiring && (
                                <Badge className="mt-1 bg-amber-100 text-amber-800 text-[10px] sm:text-xs">
                                  {days} يوم متبقي
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={statuses.find(s => s.value === member.status)?.color}>
                                {statuses.find(s => s.value === member.status)?.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setShowMemberDetails(true);
                                  }}
                                  data-testid={`view-member-${member.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingMember(member);
                                    setIsDialogOpen(true);
                                  }}
                                  data-testid={`edit-member-${member.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => {
                                    if (confirm("هل تريد حذف هذا العضو؟")) {
                                      deleteMutation.mutate(member.id);
                                    }
                                  }}
                                  data-testid={`delete-member-${member.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
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
          </TabsContent>

          <TabsContent value="committees" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {committeeTypes.map((committee) => (
                <Card key={committee.value} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className={committee.color}>{committee.label}</Badge>
                      <Button variant="ghost" size="sm">
                        <UserPlus className="h-4 w-4 ml-1" />
                        إضافة عضو
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">عدد الأعضاء</span>
                        <span className="font-medium">0</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">الرئيس</span>
                        <span className="font-medium text-gray-400">غير محدد</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">الاجتماعات</span>
                        <span className="font-medium">0</span>
                      </div>
                      <Progress value={0} className="h-2" />
                      <p className="text-xs text-gray-500 text-center">لا يوجد أعضاء في هذه اللجنة</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="training" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-violet-600" />
                شهادات التدريب والتأهيل
              </h3>
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={() => setShowAddTraining(true)}>
                <Plus className="h-4 w-4" />
                إضافة شهادة
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {trainingTypes.map((type) => (
                <Card key={type.value} className="bg-gradient-to-br from-gray-50 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-violet-600" />
                      {type.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">شهادات مسجلة</span>
                      <Badge variant="outline">0</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>لا يوجد شهادات تدريب مسجلة</p>
                <Button variant="link" className="mt-2" onClick={() => setShowAddTraining(true)}>
                  إضافة شهادة جديدة
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="declarations" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-violet-600" />
                سجل المصالح والإفصاحات
              </h3>
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={() => setShowAddDeclaration(true)}>
                <Plus className="h-4 w-4" />
                إفصاح جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-sm text-blue-600">إفصاحات سنوية</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-800">0</p>
                    </div>
                    <Calendar className="h-5 w-5 sm:h-8 sm:w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-sm text-amber-600">تعارض مصالح</p>
                      <p className="text-lg sm:text-2xl font-bold text-amber-800">0</p>
                    </div>
                    <AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-sm text-green-600">تمت المراجعة</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-800">0</p>
                    </div>
                    <CheckCircle className="h-5 w-5 sm:h-8 sm:w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>لا يوجد إفصاحات مسجلة</p>
                <Button variant="link" className="mt-2" onClick={() => setShowAddDeclaration(true)}>
                  إضافة إفصاح جديد
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showMemberDetails} onOpenChange={setShowMemberDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل العضو</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-violet-100 text-violet-600 text-xl">
                      {selectedMember.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{selectedMember.fullName}</h3>
                    <p className="text-gray-500">{positions.find(p => p.value === selectedMember.position)?.label}</p>
                    <Badge className={statuses.find(s => s.value === selectedMember.status)?.color}>
                      {statuses.find(s => s.value === selectedMember.status)?.label}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">نوع العضوية</p>
                    <p className="font-medium">{memberTypes.find(t => t.value === selectedMember.memberType)?.label}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">الجنسية</p>
                    <p className="font-medium">{selectedMember.nationality || "غير محدد"}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">تاريخ التعيين</p>
                    <p className="font-medium">{selectedMember.appointmentDate}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">انتهاء العضوية</p>
                    <p className="font-medium">{selectedMember.termEndDate || "غير محدد"}</p>
                  </div>
                </div>

                {selectedMember.qualifications && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">المؤهلات العلمية</p>
                    <p className="text-sm">{selectedMember.qualifications}</p>
                  </div>
                )}

                {selectedMember.experience && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">الخبرات العملية</p>
                    <p className="text-sm">{selectedMember.experience}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 text-center">
                      <CalendarCheck className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold text-blue-800">0</p>
                      <p className="text-sm text-blue-600">اجتماعات الحضور</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4 text-center">
                      <GraduationCap className="h-8 w-8 mx-auto text-green-500 mb-2" />
                      <p className="text-2xl font-bold text-green-800">0</p>
                      <p className="text-sm text-green-600">ساعات التدريب</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMemberDetails(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddTraining} onOpenChange={setShowAddTraining}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة شهادة تدريب</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>العضو</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العضو" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع التدريب</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainingTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>عنوان الدورة</Label>
                <Input placeholder="أدخل عنوان الدورة" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تاريخ البدء</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>المدة (ساعات)</Label>
                <Input type="number" placeholder="0" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddTraining(false)}>إلغاء</Button>
              <Button className="bg-violet-600 hover:bg-violet-700">حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddDeclaration} onOpenChange={setShowAddDeclaration}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة إفصاح مصالح</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>العضو</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العضو" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع الإفصاح</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">إفصاح سنوي</SelectItem>
                    <SelectItem value="transaction">معاملة</SelectItem>
                    <SelectItem value="related_party">أطراف ذات علاقة</SelectItem>
                    <SelectItem value="conflict">تعارض مصالح</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea placeholder="أدخل تفاصيل الإفصاح" />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الإفصاح</Label>
                <Input type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDeclaration(false)}>إلغاء</Button>
              <Button className="bg-violet-600 hover:bg-violet-700">حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
