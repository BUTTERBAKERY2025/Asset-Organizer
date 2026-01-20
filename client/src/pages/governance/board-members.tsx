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
} from "lucide-react";
import type { BoardMember } from "@shared/schema";

const positions = [
  { value: "chairman", label: "رئيس مجلس الإدارة" },
  { value: "vice_chairman", label: "نائب رئيس مجلس الإدارة" },
  { value: "member", label: "عضو مجلس الإدارة" },
  { value: "secretary", label: "أمين المجلس" },
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

export default function BoardMembersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery<BoardMember[]>({
    queryKey: ["/api/governance/board-members"],
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
      appointmentDate: appointmentDateStr ? new Date(appointmentDateStr) : null,
      termEndDate: termEndDateStr ? new Date(termEndDateStr) : null,
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

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-violet-800" data-testid="page-title">
                أعضاء مجلس الإدارة
              </h1>
              <p className="text-gray-600">إدارة أعضاء المجلس والمناصب والفترات</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingMember(null);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700" data-testid="btn-add-member">
                <Plus className="h-4 w-4" />
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

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العضو</TableHead>
                  <TableHead className="text-right">المنصب</TableHead>
                  <TableHead className="text-right">نوع العضوية</TableHead>
                  <TableHead className="text-right">التواصل</TableHead>
                  <TableHead className="text-right">فترة العضوية</TableHead>
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
                  filteredMembers.map((member) => (
                    <TableRow key={member.id} data-testid={`member-row-${member.id}`}>
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
                      <TableCell>
                        {memberTypes.find(t => t.value === member.memberType)?.label}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {member.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Mail className="h-3 w-3" />
                              {member.email}
                            </div>
                          )}
                          {member.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span>{member.appointmentDate}</span>
                          {member.termEndDate && (
                            <>
                              <span className="text-gray-400">→</span>
                              <span>{member.termEndDate}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statuses.find(s => s.value === member.status)?.color}>
                          {statuses.find(s => s.value === member.status)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
