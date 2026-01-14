import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, Users, Mail, Phone, Briefcase, 
  MoreVertical, Edit, Trash2, CheckCircle, Clock, ArrowRight,
  Target, TrendingUp, AlertCircle, ListTodo
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeamMember {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  tasksCount?: number;
  completedTasksCount?: number;
}

interface MarketingTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  assignedTo?: string;
  dueDate?: string;
}

const TEAM_ROLES = [
  { value: "marketing_manager", label: "مدير تسويق" },
  { value: "content_creator", label: "صانع محتوى" },
  { value: "social_media_specialist", label: "أخصائي سوشيال ميديا" },
  { value: "graphic_designer", label: "مصمم جرافيك" },
  { value: "video_editor", label: "محرر فيديو" },
  { value: "copywriter", label: "كاتب محتوى" },
  { value: "influencer_coordinator", label: "منسق مؤثرين" },
  { value: "marketing_analyst", label: "محلل تسويق" },
  { value: "campaign_manager", label: "مدير حملات" },
  { value: "other", label: "أخرى" },
];

const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجل",
};

export default function MarketingTeamPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "content_creator",
    isActive: true,
  });

  const { data: teamMembers = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/marketing/team"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/team");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allTasks = [] } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/marketing/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إضافة العضو");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/team"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إضافة العضو بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة العضو", variant: "destructive" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const res = await fetch(`/api/marketing/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في تحديث العضو");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/team"] });
      setEditingMember(null);
      toast({ title: "تم تحديث العضو بنجاح" });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/team/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("فشل في حذف العضو");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/team"] });
      toast({ title: "تم حذف العضو بنجاح" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "content_creator",
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: "يرجى إدخال اسم العضو", variant: "destructive" });
      return;
    }
    if (editingMember) {
      updateMemberMutation.mutate({ id: editingMember.id, data: formData });
    } else {
      createMemberMutation.mutate(formData);
    }
  };

  const openEditDialog = (member: TeamMember) => {
    setFormData({
      name: member.name,
      email: member.email || "",
      phone: member.phone || "",
      role: member.role,
      isActive: member.isActive,
    });
    setEditingMember(member);
    setIsAddDialogOpen(true);
  };

  const getRoleLabel = (role: string) => {
    return TEAM_ROLES.find(r => r.value === role)?.label || role;
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2);
  };

  const getMemberTasks = (memberName: string) => {
    return allTasks.filter(t => t.assignedTo?.toLowerCase().includes(memberName.toLowerCase()));
  };

  const getMemberWorkload = (memberName: string) => {
    const tasks = getMemberTasks(memberName);
    const pending = tasks.filter(t => t.status === "pending").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const total = tasks.length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const urgentCount = tasks.filter(t => t.priority === "urgent" || t.priority === "high").filter(t => t.status !== "completed").length;
    
    return { pending, inProgress, completed, total, completionRate, urgentCount };
  };

  const getWorkloadLevel = (total: number) => {
    if (total === 0) return { level: "free", label: "متاح", color: "text-green-600", bgColor: "bg-green-100" };
    if (total <= 3) return { level: "light", label: "خفيف", color: "text-blue-600", bgColor: "bg-blue-100" };
    if (total <= 6) return { level: "moderate", label: "متوسط", color: "text-amber-600", bgColor: "bg-amber-100" };
    return { level: "heavy", label: "مرتفع", color: "text-red-600", bgColor: "bg-red-100" };
  };

  const activeMembers = teamMembers.filter(m => m.isActive);
  const inactiveMembers = teamMembers.filter(m => !m.isActive);

  const totalAssignedTasks = allTasks.filter(t => t.assignedTo).length;
  const totalPendingTasks = allTasks.filter(t => t.status === "pending" || t.status === "in_progress").length;
  const totalCompletedTasks = allTasks.filter(t => t.status === "completed").length;
  const avgTasksPerMember = activeMembers.length > 0 ? (totalAssignedTasks / activeMembers.length).toFixed(1) : "0";

  const roleColors: Record<string, string> = {
    marketing_manager: "bg-purple-100 text-purple-700",
    content_creator: "bg-blue-100 text-blue-700",
    social_media_specialist: "bg-pink-100 text-pink-700",
    graphic_designer: "bg-green-100 text-green-700",
    video_editor: "bg-orange-100 text-orange-700",
    copywriter: "bg-amber-100 text-amber-700",
    influencer_coordinator: "bg-cyan-100 text-cyan-700",
    marketing_analyst: "bg-indigo-100 text-indigo-700",
    campaign_manager: "bg-red-100 text-red-700",
    other: "bg-gray-100 text-gray-700",
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="page-title">فريق التسويق</h1>
              <p className="text-sm text-muted-foreground">إدارة أعضاء فريق التسويق وتتبع عبء العمل</p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingMember(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="h-11 sm:h-9" data-testid="button-add-member">
                <Plus className="w-4 h-4 ml-2" />
                إضافة عضو
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingMember ? "تعديل العضو" : "إضافة عضو جديد"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم *</Label>
                  <Input
                    className="h-11 sm:h-10"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="اسم العضو"
                    data-testid="input-member-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الدور الوظيفي</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                    <SelectTrigger className="h-11 sm:h-10" data-testid="select-member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {TEAM_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    className="h-11 sm:h-10"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    data-testid="input-member-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input
                    className="h-11 sm:h-10"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                    data-testid="input-member-phone"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingMember(null);
                    resetForm();
                  }}>
                    إلغاء
                  </Button>
                  <Button type="submit" className="h-11 sm:h-9" disabled={createMemberMutation.isPending || updateMemberMutation.isPending} data-testid="button-submit-member">
                    {(createMemberMutation.isPending || updateMemberMutation.isPending) ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamMembers.length}</p>
                  <p className="text-sm text-muted-foreground">إجمالي الأعضاء</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeMembers.length}</p>
                  <p className="text-sm text-muted-foreground">أعضاء نشطين</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <ListTodo className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalPendingTasks}</p>
                  <p className="text-sm text-muted-foreground">مهام قيد التنفيذ</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgTasksPerMember}</p>
                  <p className="text-sm text-muted-foreground">متوسط المهام/عضو</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">عبء العمل حسب العضو</CardTitle>
            <CardDescription>توزيع المهام ونسبة الإنجاز لكل عضو</CardDescription>
          </CardHeader>
          <CardContent>
            {activeMembers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">لا يوجد أعضاء نشطين</p>
            ) : (
              <div className="space-y-4">
                {activeMembers.map((member) => {
                  const workload = getMemberWorkload(member.name);
                  const workloadLevel = getWorkloadLevel(workload.total - workload.completed);
                  return (
                    <div key={member.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{getRoleLabel(member.role)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${workloadLevel.bgColor} ${workloadLevel.color} border-0`}>
                            {workloadLevel.label}
                          </Badge>
                          {workload.urgentCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 ml-1" />
                              {workload.urgentCount} عاجل
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                        <div className="p-2 bg-gray-50 rounded">
                          <p className="font-bold text-gray-700">{workload.pending}</p>
                          <p className="text-muted-foreground">معلقة</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded">
                          <p className="font-bold text-blue-700">{workload.inProgress}</p>
                          <p className="text-muted-foreground">قيد التنفيذ</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded">
                          <p className="font-bold text-green-700">{workload.completed}</p>
                          <p className="text-muted-foreground">مكتملة</p>
                        </div>
                        <div className="p-2 bg-purple-50 rounded">
                          <p className="font-bold text-purple-700">{workload.total}</p>
                          <p className="text-muted-foreground">الإجمالي</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={workload.completionRate} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-12 text-left">
                          {workload.completionRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : teamMembers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا يوجد أعضاء في الفريق</p>
              <Button className="mt-4 h-11 sm:h-9" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة عضو جديد
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => {
              const workload = getMemberWorkload(member.name);
              const workloadLevel = getWorkloadLevel(workload.total - workload.completed);
              return (
                <Card key={member.id} className="hover:shadow-md transition-shadow" data-testid={`member-card-${member.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{member.name}</h3>
                          <Badge className={roleColors[member.role] || roleColors.other}>
                            {getRoleLabel(member.role)}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid={`button-member-menu-${member.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(member)}>
                            <Edit className="w-4 h-4 ml-2" />
                            تعديل
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => deleteMemberMutation.mutate(member.id)}
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      {member.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={member.isActive ? "default" : "secondary"}>
                            {member.isActive ? "نشط" : "غير نشط"}
                          </Badge>
                          <Badge className={`${workloadLevel.bgColor} ${workloadLevel.color} border-0`}>
                            {workloadLevel.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{workload.completed}/{workload.total} مهام مكتملة</span>
                        <span>{workload.completionRate.toFixed(0)}%</span>
                      </div>
                      <Progress value={workload.completionRate} className="h-1.5 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
