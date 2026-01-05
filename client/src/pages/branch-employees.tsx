import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  DollarSign,
  Building,
  Globe,
  Briefcase,
  UserCheck,
  FileText,
  Phone,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import type { BranchEmployee } from "@shared/schema";

const JOB_TITLES = [
  "كاشير", "مشرف", "مدير صالة", "معبأ طلبات", "بيكري", "بستري",
  "ساندويتشات", "بيتزا", "باريستا", "واتر", "عامل", "أمين مستودع", "سائق", "حارس أمن"
];

const NATIONALITIES = [
  "سعودي", "مصري", "سوري", "نيبالي", "بنجلاديشي", "فلبيني",
  "بورمي", "هندي", "باكستاني", "يمني", "سوداني", "إندونيسي", "إثيوبي", "أخرى"
];

const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "terminated", label: "منتهي" },
  { value: "on_leave", label: "في إجازة" },
];

const HEALTH_CERT_OPTIONS = [
  { value: "none", label: "لا يوجد" },
  { value: "valid", label: "ساري" },
  { value: "expired", label: "منتهي" },
  { value: "pending", label: "قيد التجديد" },
];

const employeeFormSchema = z.object({
  branchId: z.string().min(1, "الفرع مطلوب"),
  employeeName: z.string().min(1, "اسم الموظف مطلوب"),
  employeeNameEn: z.string().optional(),
  jobTitle: z.string().min(1, "الوظيفة مطلوبة"),
  department: z.string().optional(),
  nationality: z.string().min(1, "الجنسية مطلوبة"),
  salary: z.coerce.number().min(0, "الراتب يجب أن يكون رقم موجب"),
  housingAllowance: z.coerce.number().min(0).optional(),
  transportAllowance: z.coerce.number().min(0).optional(),
  foodAllowance: z.coerce.number().min(0).optional(),
  otherAllowances: z.coerce.number().min(0).optional(),
  hireDate: z.string().optional(),
  healthCertificate: z.string().optional(),
  healthCertificateExpiry: z.string().optional(),
  iqamaNumber: z.string().optional(),
  iqamaExpiry: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  phoneNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  status: z.string().default("active"),
  contractType: z.string().optional(),
  workPermitNumber: z.string().optional(),
  notes: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    terminated: "bg-red-100 text-red-800",
    on_leave: "bg-yellow-100 text-yellow-800",
  };
  const labels: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    terminated: "منتهي",
    on_leave: "في إجازة",
  };
  return <Badge className={variants[status] || variants.active}>{labels[status] || status}</Badge>;
}

function getHealthBadge(status: string) {
  const variants: Record<string, string> = {
    valid: "bg-green-100 text-green-800",
    expired: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    none: "bg-gray-100 text-gray-800",
  };
  const labels: Record<string, string> = {
    valid: "ساري",
    expired: "منتهي",
    pending: "قيد التجديد",
    none: "لا يوجد",
  };
  return <Badge className={variants[status] || variants.none}>{labels[status] || status}</Badge>;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "--";
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(value);
}

export default function BranchEmployeesPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNationality, setSelectedNationality] = useState<string>("all");
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<BranchEmployee | null>(null);

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      return res.json();
    },
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["/api/branch-employees", selectedBranch],
    queryFn: async () => {
      const url = selectedBranch === "all" ? "/api/branch-employees" : `/api/branch-employees?branchId=${selectedBranch}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/branch-employees/stats", selectedBranch],
    queryFn: async () => {
      const url = selectedBranch === "all" ? "/api/branch-employees/stats" : `/api/branch-employees/stats?branchId=${selectedBranch}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      branchId: "",
      employeeName: "",
      jobTitle: "",
      nationality: "",
      salary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
      otherAllowances: 0,
      status: "active",
      healthCertificate: "none",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const res = await fetch("/api/branch-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إضافة الموظف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmployeeFormData }) => {
      const res = await fetch(`/api/branch-employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في تحديث الموظف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
      setIsDialogOpen(false);
      setEditingEmployee(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/branch-employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل في حذف الموظف");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees"] });
    },
  });

  const handleEdit = (employee: BranchEmployee) => {
    setEditingEmployee(employee);
    form.reset({
      branchId: employee.branchId,
      employeeName: employee.employeeName,
      employeeNameEn: employee.employeeNameEn || "",
      jobTitle: employee.jobTitle,
      department: employee.department || "",
      nationality: employee.nationality,
      salary: employee.salary,
      housingAllowance: employee.housingAllowance || 0,
      transportAllowance: employee.transportAllowance || 0,
      foodAllowance: employee.foodAllowance || 0,
      otherAllowances: employee.otherAllowances || 0,
      hireDate: employee.hireDate || "",
      healthCertificate: employee.healthCertificate || "none",
      healthCertificateExpiry: employee.healthCertificateExpiry || "",
      iqamaNumber: employee.iqamaNumber || "",
      iqamaExpiry: employee.iqamaExpiry || "",
      passportNumber: employee.passportNumber || "",
      passportExpiry: employee.passportExpiry || "",
      phoneNumber: employee.phoneNumber || "",
      emergencyContact: employee.emergencyContact || "",
      bankName: employee.bankName || "",
      bankAccountNumber: employee.bankAccountNumber || "",
      status: employee.status,
      contractType: employee.contractType || "",
      workPermitNumber: employee.workPermitNumber || "",
      notes: employee.notes || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: EmployeeFormData) => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredEmployees = (employees || []).filter((emp: BranchEmployee) => {
    if (searchQuery && !emp.employeeName.includes(searchQuery) && !emp.employeeNameEn?.includes(searchQuery)) {
      return false;
    }
    if (selectedNationality !== "all" && emp.nationality !== selectedNationality) {
      return false;
    }
    if (selectedJobTitle !== "all" && emp.jobTitle !== selectedJobTitle) {
      return false;
    }
    return true;
  });

  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b: { id: string; name: string }) => b.id === branchId);
    return branch?.name || branchId;
  };

  return (
    <Layout>
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/attendance-dashboard")} data-testid="button-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">موظفي الفروع</h1>
              <p className="text-gray-500">إدارة بيانات الموظفين والرواتب والمستندات</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingEmployee(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700" data-testid="button-add-employee">
                <Plus className="w-4 h-4 ml-2" />
                إضافة موظف
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
                <DialogDescription>أدخل بيانات الموظف الأساسية والرواتب والمستندات</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                    <TabsTrigger value="salary">الراتب والبدلات</TabsTrigger>
                    <TabsTrigger value="documents">المستندات</TabsTrigger>
                    <TabsTrigger value="contact">التواصل والبنك</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الفرع *</Label>
                        <Select value={form.watch("branchId")} onValueChange={(v) => form.setValue("branchId", v)}>
                          <SelectTrigger data-testid="select-branch">
                            <SelectValue placeholder="اختر الفرع" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches?.map((b: { id: string; name: string }) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>الحالة</Label>
                        <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>اسم الموظف بالعربي *</Label>
                        <Input {...form.register("employeeName")} placeholder="أدخل الاسم بالعربي" data-testid="input-name-ar" />
                      </div>
                      <div className="space-y-2">
                        <Label>اسم الموظف بالإنجليزي</Label>
                        <Input {...form.register("employeeNameEn")} placeholder="Enter name in English" dir="ltr" data-testid="input-name-en" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الوظيفة *</Label>
                        <Select value={form.watch("jobTitle")} onValueChange={(v) => form.setValue("jobTitle", v)}>
                          <SelectTrigger data-testid="select-job">
                            <SelectValue placeholder="اختر الوظيفة" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_TITLES.map((job) => (
                              <SelectItem key={job} value={job}>{job}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>الجنسية *</Label>
                        <Select value={form.watch("nationality")} onValueChange={(v) => form.setValue("nationality", v)}>
                          <SelectTrigger data-testid="select-nationality">
                            <SelectValue placeholder="اختر الجنسية" />
                          </SelectTrigger>
                          <SelectContent>
                            {NATIONALITIES.map((nat) => (
                              <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>القسم</Label>
                        <Input {...form.register("department")} placeholder="مطبخ، صالة، إلخ" data-testid="input-department" />
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ التعيين</Label>
                        <Input type="date" {...form.register("hireDate")} data-testid="input-hire-date" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="salary" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الراتب الأساسي (ريال) *</Label>
                        <Input type="number" {...form.register("salary")} placeholder="0" data-testid="input-salary" />
                      </div>
                      <div className="space-y-2">
                        <Label>بدل السكن (ريال)</Label>
                        <Input type="number" {...form.register("housingAllowance")} placeholder="0" data-testid="input-housing" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>بدل المواصلات (ريال)</Label>
                        <Input type="number" {...form.register("transportAllowance")} placeholder="0" data-testid="input-transport" />
                      </div>
                      <div className="space-y-2">
                        <Label>بدل الطعام (ريال)</Label>
                        <Input type="number" {...form.register("foodAllowance")} placeholder="0" data-testid="input-food" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>بدلات أخرى (ريال)</Label>
                      <Input type="number" {...form.register("otherAllowances")} placeholder="0" data-testid="input-other" />
                    </div>
                    <Card className="bg-amber-50">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <span className="font-bold">إجمالي الراتب:</span>
                          <span className="text-xl font-bold text-amber-700">
                            {formatCurrency(
                              (form.watch("salary") || 0) +
                              (form.watch("housingAllowance") || 0) +
                              (form.watch("transportAllowance") || 0) +
                              (form.watch("foodAllowance") || 0) +
                              (form.watch("otherAllowances") || 0)
                            )}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>حالة الشهادة الصحية</Label>
                        <Select value={form.watch("healthCertificate")} onValueChange={(v) => form.setValue("healthCertificate", v)}>
                          <SelectTrigger data-testid="select-health-cert">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                          <SelectContent>
                            {HEALTH_CERT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ انتهاء الشهادة الصحية</Label>
                        <Input type="date" {...form.register("healthCertificateExpiry")} data-testid="input-health-expiry" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>رقم الإقامة</Label>
                        <Input {...form.register("iqamaNumber")} placeholder="أدخل رقم الإقامة" dir="ltr" data-testid="input-iqama" />
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ انتهاء الإقامة</Label>
                        <Input type="date" {...form.register("iqamaExpiry")} data-testid="input-iqama-expiry" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>رقم الجواز</Label>
                        <Input {...form.register("passportNumber")} placeholder="أدخل رقم الجواز" dir="ltr" data-testid="input-passport" />
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ انتهاء الجواز</Label>
                        <Input type="date" {...form.register("passportExpiry")} data-testid="input-passport-expiry" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>رقم رخصة العمل</Label>
                      <Input {...form.register("workPermitNumber")} placeholder="أدخل رقم رخصة العمل" dir="ltr" data-testid="input-work-permit" />
                    </div>
                  </TabsContent>

                  <TabsContent value="contact" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>رقم الجوال</Label>
                        <Input {...form.register("phoneNumber")} placeholder="05xxxxxxxx" dir="ltr" data-testid="input-phone" />
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الطوارئ</Label>
                        <Input {...form.register("emergencyContact")} placeholder="رقم للتواصل في الطوارئ" dir="ltr" data-testid="input-emergency" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>اسم البنك</Label>
                        <Input {...form.register("bankName")} placeholder="مثال: البنك الأهلي" data-testid="input-bank-name" />
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الحساب البنكي (IBAN)</Label>
                        <Input {...form.register("bankAccountNumber")} placeholder="SAxxxxxxxxxxxxxxxxxx" dir="ltr" data-testid="input-iban" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>ملاحظات</Label>
                      <Input {...form.register("notes")} placeholder="ملاحظات إضافية" data-testid="input-notes" />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    {editingEmployee ? "تحديث" : "إضافة"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي الموظفين</p>
                  <p className="text-2xl font-bold" data-testid="text-total-employees">{stats?.totalEmployees || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي الرواتب</p>
                  <p className="text-2xl font-bold" data-testid="text-total-salaries">{formatCurrency(stats?.totalSalaries)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Globe className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">عدد الجنسيات</p>
                  <p className="text-2xl font-bold" data-testid="text-nationalities-count">{stats?.byNationality?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Briefcase className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">عدد الوظائف</p>
                  <p className="text-2xl font-bold" data-testid="text-jobs-count">{stats?.byJobTitle?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-500" />
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48" data-testid="filter-branch">
                <SelectValue placeholder="جميع الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches?.map((b: { id: string; name: string }) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <Select value={selectedNationality} onValueChange={setSelectedNationality}>
              <SelectTrigger className="w-40" data-testid="filter-nationality">
                <SelectValue placeholder="جميع الجنسيات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الجنسيات</SelectItem>
                {NATIONALITIES.map((nat) => (
                  <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-500" />
            <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
              <SelectTrigger className="w-40" data-testid="filter-job">
                <SelectValue placeholder="جميع الوظائف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الوظائف</SelectItem>
                {JOB_TITLES.map((job) => (
                  <SelectItem key={job} value={job}>{job}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم..."
              className="pr-10"
              data-testid="input-search"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الموظفين</CardTitle>
            <CardDescription>عرض {filteredEmployees.length} موظف</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>لا يوجد موظفين</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">الوظيفة</TableHead>
                    <TableHead className="text-right">الجنسية</TableHead>
                    <TableHead className="text-right">الراتب الإجمالي</TableHead>
                    <TableHead className="text-right">الشهادة الصحية</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp: BranchEmployee) => (
                    <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{emp.employeeName}</p>
                          {emp.employeeNameEn && <p className="text-sm text-gray-500" dir="ltr">{emp.employeeNameEn}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{getBranchName(emp.branchId)}</TableCell>
                      <TableCell>{emp.jobTitle}</TableCell>
                      <TableCell>{emp.nationality}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(emp.totalSalary || emp.salary)}</TableCell>
                      <TableCell>{getHealthBadge(emp.healthCertificate || "none")}</TableCell>
                      <TableCell>{getStatusBadge(emp.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)} data-testid={`button-edit-${emp.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
                                deleteMutation.mutate(emp.id);
                              }
                            }}
                            data-testid={`button-delete-${emp.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {stats && (stats.byNationality?.length > 0 || stats.byJobTitle?.length > 0) && (
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  توزيع الجنسيات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.byNationality?.map((item: { nationality: string; count: number }) => (
                    <div key={item.nationality} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{item.nationality}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  توزيع الوظائف
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.byJobTitle?.map((item: { jobTitle: string; count: number }) => (
                    <div key={item.jobTitle} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{item.jobTitle}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
