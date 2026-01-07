import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Users,
  Crown,
  UserCircle,
  Coffee,
  ShoppingCart,
  Utensils,
  ClipboardList,
  Wrench,
  ChefHat,
  Star,
  Network,
  Plus,
  Edit,
  Trash2,
  Printer,
  Download,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import type { OrgJobRole } from "@shared/schema";

const ICON_MAP: Record<string, React.ReactNode> = {
  crown: <Crown className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  building: <Building2 className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  clipboard: <ClipboardList className="h-4 w-4" />,
  "user-circle": <UserCircle className="h-4 w-4" />,
  utensils: <Utensils className="h-4 w-4" />,
  "shopping-cart": <ShoppingCart className="h-4 w-4" />,
  coffee: <Coffee className="h-4 w-4" />,
  "clipboard-list": <ClipboardList className="h-4 w-4" />,
  "chef-hat": <ChefHat className="h-4 w-4" />,
  wrench: <Wrench className="h-4 w-4" />,
  user: <UserCircle className="h-4 w-4" />,
};

const COLOR_OPTIONS = [
  { value: "bg-amber-500", label: "ذهبي" },
  { value: "bg-amber-400", label: "ذهبي فاتح" },
  { value: "bg-orange-400", label: "برتقالي" },
  { value: "bg-yellow-400", label: "أصفر" },
  { value: "bg-lime-400", label: "ليموني" },
  { value: "bg-green-400", label: "أخضر" },
  { value: "bg-teal-400", label: "فيروزي" },
  { value: "bg-cyan-400", label: "سماوي" },
  { value: "bg-blue-400", label: "أزرق" },
  { value: "bg-indigo-400", label: "نيلي" },
  { value: "bg-purple-400", label: "بنفسجي" },
  { value: "bg-pink-400", label: "وردي" },
  { value: "bg-gray-400", label: "رمادي" },
];

const ICON_OPTIONS = [
  { value: "crown", label: "تاج" },
  { value: "star", label: "نجمة" },
  { value: "building", label: "مبنى" },
  { value: "users", label: "مجموعة" },
  { value: "clipboard", label: "قائمة" },
  { value: "user-circle", label: "مستخدم" },
  { value: "utensils", label: "أدوات طعام" },
  { value: "shopping-cart", label: "سلة" },
  { value: "coffee", label: "قهوة" },
  { value: "chef-hat", label: "طاقية شيف" },
  { value: "wrench", label: "مفتاح" },
];

function CompactRoleCard({
  role,
  onClick,
  onEdit,
  onDelete,
}: {
  role: OrgJobRole;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group relative bg-white border rounded-lg p-2 shadow-sm hover:shadow-md transition-all cursor-pointer min-w-[120px] max-w-[140px]"
      onClick={onClick}
      data-testid={`card-role-${role.slug}`}
    >
      <div className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600"
          data-testid={`btn-edit-${role.slug}`}
        >
          <Edit className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          data-testid={`btn-delete-${role.slug}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="flex flex-col items-center text-center">
        <div className={`w-8 h-8 rounded-full ${role.color} flex items-center justify-center text-white mb-1`}>
          {ICON_MAP[role.icon || "user"]}
        </div>
        <p className="text-xs font-bold text-gray-800 leading-tight">{role.titleAr}</p>
        <p className="text-[10px] text-gray-500 leading-tight">{role.titleEn}</p>
      </div>
    </div>
  );
}

function RoleDetailsDialog({
  role,
  open,
  onClose,
}: {
  role: OrgJobRole | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!role) return null;

  const responsibilitiesAr = (role.responsibilitiesAr as string[]) || [];
  const responsibilitiesEn = (role.responsibilitiesEn as string[]) || [];
  const qualificationsAr = (role.qualificationsAr as string[]) || [];
  const qualificationsEn = (role.qualificationsEn as string[]) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full ${role.color} flex items-center justify-center text-white`}>
              {ICON_MAP[role.icon || "user"]}
            </div>
            <div>
              <h2 className="text-lg font-bold">{role.titleAr}</h2>
              <p className="text-sm text-gray-500 font-normal">{role.titleEn}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="arabic" className="mt-3">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="arabic" className="text-xs" data-testid="tab-arabic">العربية</TabsTrigger>
            <TabsTrigger value="english" className="text-xs" data-testid="tab-english">English</TabsTrigger>
          </TabsList>

          <TabsContent value="arabic" className="space-y-3 mt-3">
            <div className="bg-amber-50 p-2 rounded-lg">
              <p className="text-sm text-gray-700">{role.summaryAr}</p>
            </div>
            {responsibilitiesAr.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-600 text-sm mb-1">المهام والمسؤوليات</h4>
                <ul className="space-y-1">
                  {responsibilitiesAr.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1 text-xs bg-gray-50 p-1.5 rounded">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100">{idx + 1}</Badge>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {qualificationsAr.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-600 text-sm mb-1">المؤهلات المطلوبة</h4>
                <ul className="space-y-1">
                  {qualificationsAr.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="english" className="space-y-3 mt-3">
            <div className="bg-amber-50 p-2 rounded-lg">
              <p className="text-sm text-gray-700">{role.summaryEn}</p>
            </div>
            {responsibilitiesEn.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-600 text-sm mb-1">Responsibilities</h4>
                <ul className="space-y-1">
                  {responsibilitiesEn.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1 text-xs bg-gray-50 p-1.5 rounded">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100">{idx + 1}</Badge>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {qualificationsEn.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-600 text-sm mb-1">Qualifications</h4>
                <ul className="space-y-1">
                  {qualificationsEn.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-3 pt-3 border-t flex justify-between items-center">
          <Link href={`/branch-employees?jobTitle=${encodeURIComponent(role.titleAr)}`}>
            <Button variant="outline" size="sm" className="gap-1 text-xs" data-testid="btn-view-employees">
              <Users className="h-3 w-3" />
              عرض الموظفين
            </Button>
          </Link>
          <Button size="sm" onClick={onClose} data-testid="btn-close-dialog">إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoleFormDialog({
  role,
  roles,
  open,
  onClose,
  onSave,
  isLoading,
}: {
  role: OrgJobRole | null;
  roles: OrgJobRole[];
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    slug: role?.slug || "",
    titleAr: role?.titleAr || "",
    titleEn: role?.titleEn || "",
    summaryAr: role?.summaryAr || "",
    summaryEn: role?.summaryEn || "",
    parentId: role?.parentId?.toString() || "",
    level: role?.level?.toString() || "1",
    orderIndex: role?.orderIndex?.toString() || "0",
    icon: role?.icon || "user",
    color: role?.color || "bg-amber-500",
    responsibilitiesAr: ((role?.responsibilitiesAr as string[]) || []).join("\n"),
    responsibilitiesEn: ((role?.responsibilitiesEn as string[]) || []).join("\n"),
    qualificationsAr: ((role?.qualificationsAr as string[]) || []).join("\n"),
    qualificationsEn: ((role?.qualificationsEn as string[]) || []).join("\n"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      slug: formData.slug || formData.titleEn.toLowerCase().replace(/\s+/g, "-"),
      titleAr: formData.titleAr,
      titleEn: formData.titleEn,
      summaryAr: formData.summaryAr,
      summaryEn: formData.summaryEn,
      parentId: formData.parentId ? parseInt(formData.parentId) : null,
      level: parseInt(formData.level) || 1,
      orderIndex: parseInt(formData.orderIndex) || 0,
      icon: formData.icon,
      color: formData.color,
      responsibilitiesAr: formData.responsibilitiesAr.split("\n").filter(Boolean),
      responsibilitiesEn: formData.responsibilitiesEn.split("\n").filter(Boolean),
      qualificationsAr: formData.qualificationsAr.split("\n").filter(Boolean),
      qualificationsEn: formData.qualificationsEn.split("\n").filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? "تعديل الوظيفة" : "إضافة وظيفة جديدة"}</DialogTitle>
          <DialogDescription>أدخل بيانات الوظيفة بالعربية والإنجليزية</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-8">
              <TabsTrigger value="basic" className="text-xs">البيانات الأساسية</TabsTrigger>
              <TabsTrigger value="responsibilities" className="text-xs">المهام</TabsTrigger>
              <TabsTrigger value="qualifications" className="text-xs">المؤهلات</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">المسمى الوظيفي (عربي) *</Label>
                  <Input
                    value={formData.titleAr}
                    onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                    placeholder="مدير الفرع"
                    required
                    className="h-8 text-sm"
                    data-testid="input-title-ar"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Job Title (English) *</Label>
                  <Input
                    value={formData.titleEn}
                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                    placeholder="Branch Manager"
                    required
                    dir="ltr"
                    className="h-8 text-sm"
                    data-testid="input-title-en"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الوصف (عربي)</Label>
                  <Textarea
                    value={formData.summaryAr}
                    onChange={(e) => setFormData({ ...formData, summaryAr: e.target.value })}
                    placeholder="وصف مختصر للوظيفة"
                    rows={2}
                    className="text-sm"
                    data-testid="input-summary-ar"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description (English)</Label>
                  <Textarea
                    value={formData.summaryEn}
                    onChange={(e) => setFormData({ ...formData, summaryEn: e.target.value })}
                    placeholder="Brief job description"
                    rows={2}
                    dir="ltr"
                    className="text-sm"
                    data-testid="input-summary-en"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الوظيفة الأعلى</Label>
                  <Select
                    value={formData.parentId}
                    onValueChange={(v) => setFormData({ ...formData, parentId: v })}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-parent">
                      <SelectValue placeholder="بدون" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون (أعلى مستوى)</SelectItem>
                      {roles.filter(r => r.id !== role?.id).map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>{r.titleAr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المستوى</Label>
                  <Input
                    type="number"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    min="1"
                    max="10"
                    className="h-8 text-sm"
                    data-testid="input-level"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الأيقونة</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(v) => setFormData({ ...formData, icon: v })}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-icon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-1">{ICON_MAP[opt.value]} {opt.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">اللون</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(v) => setFormData({ ...formData, color: v })}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-1">
                            <span className={`w-3 h-3 rounded-full ${opt.value}`} />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="responsibilities" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">المهام (عربي) - سطر لكل مهمة</Label>
                  <Textarea
                    value={formData.responsibilitiesAr}
                    onChange={(e) => setFormData({ ...formData, responsibilitiesAr: e.target.value })}
                    placeholder="إدارة العمليات اليومية&#10;تحقيق أهداف المبيعات&#10;إدارة فريق العمل"
                    rows={6}
                    className="text-sm"
                    data-testid="input-resp-ar"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Responsibilities (English) - one per line</Label>
                  <Textarea
                    value={formData.responsibilitiesEn}
                    onChange={(e) => setFormData({ ...formData, responsibilitiesEn: e.target.value })}
                    placeholder="Manage daily operations&#10;Achieve sales targets&#10;Manage team"
                    rows={6}
                    dir="ltr"
                    className="text-sm"
                    data-testid="input-resp-en"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="qualifications" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">المؤهلات (عربي) - سطر لكل مؤهل</Label>
                  <Textarea
                    value={formData.qualificationsAr}
                    onChange={(e) => setFormData({ ...formData, qualificationsAr: e.target.value })}
                    placeholder="خبرة 3 سنوات&#10;مهارات إدارية&#10;شهادة جامعية"
                    rows={4}
                    className="text-sm"
                    data-testid="input-qual-ar"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qualifications (English) - one per line</Label>
                  <Textarea
                    value={formData.qualificationsEn}
                    onChange={(e) => setFormData({ ...formData, qualificationsEn: e.target.value })}
                    placeholder="3 years experience&#10;Management skills&#10;University degree"
                    rows={4}
                    dir="ltr"
                    className="text-sm"
                    data-testid="input-qual-en"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose} data-testid="btn-cancel">إلغاء</Button>
            <Button type="submit" disabled={isLoading} className="bg-amber-600 hover:bg-amber-700" data-testid="btn-save">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {role ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganizationalStructurePage() {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedRole, setSelectedRole] = useState<OrgJobRole | null>(null);
  const [editingRole, setEditingRole] = useState<OrgJobRole | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OrgJobRole | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["/api/org-job-roles"],
    queryFn: async () => {
      const res = await fetch("/api/org-job-roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/org-job-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-job-roles"] });
      setIsFormOpen(false);
      setEditingRole(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/org-job-roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-job-roles"] });
      setIsFormOpen(false);
      setEditingRole(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/org-job-roles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-job-roles"] });
      setDeleteConfirm(null);
    },
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const exportToExcel = () => {
    const data = roles.map((role: OrgJobRole) => ({
      "المستوى": role.level,
      "المسمى الوظيفي": role.titleAr,
      "Job Title": role.titleEn,
      "الوصف": role.summaryAr,
      "Description": role.summaryEn,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الهيكل الوظيفي");
    XLSX.writeFile(wb, `الهيكل_الوظيفي_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleSave = (data: any) => {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (role: OrgJobRole) => {
    setEditingRole(role);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingRole(null);
    setIsFormOpen(true);
  };

  const levels: number[] = Array.from(new Set(roles.map((r: OrgJobRole) => r.level))).sort((a, b) => a - b);

  const getRolesByLevel = (level: number) => roles.filter((r: OrgJobRole) => r.level === level);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white print:bg-white" dir="rtl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link href="/branch-employees">
            <Button variant="outline" size="sm" className="gap-1" data-testid="btn-back">
              <ArrowLeft className="h-4 w-4" />
              العودة
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePrint()} data-testid="btn-print">
              <Printer className="h-4 w-4 ml-1" />
              طباعة
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="btn-export">
              <FileSpreadsheet className="h-4 w-4 ml-1" />
              Excel
            </Button>
            <Button size="sm" onClick={handleAdd} className="bg-amber-600 hover:bg-amber-700" data-testid="btn-add">
              <Plus className="h-4 w-4 ml-1" />
              إضافة وظيفة
            </Button>
          </div>
        </div>

        <div ref={printRef} className="print:p-4">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Network className="h-6 w-6 text-amber-600" />
              <h1 className="text-2xl font-bold text-gray-800">الهيكل الوظيفي</h1>
            </div>
            <p className="text-sm text-gray-600">إدارة التشغيل - Butter Bakery</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            </div>
          ) : roles.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Network className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">لا توجد وظائف في الهيكل الوظيفي</p>
                <Button onClick={handleAdd} className="mt-4 bg-amber-600 hover:bg-amber-700" data-testid="btn-add-first">
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة أول وظيفة
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-x-auto" data-testid="card-hierarchy">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Crown className="h-5 w-5 text-amber-500" />
                  التسلسل الهرمي الوظيفي
                  <Badge variant="outline" className="mr-2">{roles.length} وظيفة</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="space-y-4">
                  {levels.map((level: number, idx: number) => (
                    <div key={level} className="relative">
                      {idx > 0 && (
                        <div className="absolute top-0 left-1/2 w-px h-3 bg-amber-300 -translate-x-1/2 -translate-y-3" />
                      )}
                      <div className="flex flex-wrap justify-center gap-2">
                        {getRolesByLevel(level).map((role: OrgJobRole) => (
                          <CompactRoleCard
                            key={role.id}
                            role={role}
                            onClick={() => setSelectedRole(role)}
                            onEdit={() => handleEdit(role)}
                            onDelete={() => setDeleteConfirm(role)}
                          />
                        ))}
                      </div>
                      {idx < levels.length - 1 && (
                        <div className="flex justify-center mt-2">
                          <div className="w-px h-3 bg-amber-300" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 print:hidden">
            <Card className="bg-amber-50 border-amber-200" data-testid="card-level-senior">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white">
                    <Crown className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">الإدارة العليا</p>
                    <p className="text-xs text-gray-600">المستوى 1-3</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200" data-testid="card-level-middle">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">الإدارة الوسطى</p>
                    <p className="text-xs text-gray-600">المستوى 4-6</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200" data-testid="card-level-frontline">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">الموظفين التنفيذيين</p>
                    <p className="text-xs text-gray-600">المستوى 7-9</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <RoleDetailsDialog
          role={selectedRole}
          open={!!selectedRole}
          onClose={() => setSelectedRole(null)}
        />

        <RoleFormDialog
          role={editingRole}
          roles={roles}
          open={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingRole(null); }}
          onSave={handleSave}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />

        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>تأكيد الحذف</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من حذف وظيفة "{deleteConfirm?.titleAr}"؟ لا يمكن التراجع عن هذا الإجراء.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="btn-cancel-delete">إلغاء</Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                data-testid="btn-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                حذف
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
