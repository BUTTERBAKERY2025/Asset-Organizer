import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, Users, Plus, Pencil, Trash2, Building2, Briefcase, Phone, Mail, UserCheck, UserX, RefreshCw, Shield } from "lucide-react";
import type { User, Branch } from "@shared/schema";
import React, { useState, useEffect } from "react";
import { TablePagination } from "@/components/ui/pagination";

const JOB_TITLES = [
  { value: "cashier", label: "كاشير" },
  { value: "baker", label: "خباز" },
  { value: "supervisor", label: "مشرف" },
  { value: "branch_manager", label: "مدير فرع" },
  { value: "production_manager", label: "مدير إنتاج" },
  { value: "quality_inspector", label: "مراقب جودة" },
  { value: "delivery", label: "توصيل" },
  { value: "cleaner", label: "عامل نظافة" },
  { value: "maintenance", label: "صيانة" },
  { value: "other", label: "أخرى" },
];

type SafeUser = Omit<User, 'password'>;

export default function OperationsEmployeesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin, isLoading: authLoading, isAuthenticated } = useAuth();
  const { canView: canViewOperations, canCreate: canCreateOperations, canEdit: canEditOperations, canDelete: canDeleteOperations, isLoading: permissionsLoading } = usePermissions();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<SafeUser | null>(null);
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterJobTitle, setFilterJobTitle] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [newEmployee, setNewEmployee] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    branchId: "",
    jobTitle: "",
    role: "employee",
  });

  const [editEmployee, setEditEmployee] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    branchId: "",
    jobTitle: "",
    isActive: "active",
    password: "",
  });

  const canView = canViewOperations("operations");
  const canCreate = canCreateOperations("operations");
  const canEdit = canEditOperations("operations");
  const canDelete = canDeleteOperations("operations");

  const { data: employees = [], isLoading: employeesLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/operations-employees"],
    queryFn: async () => {
      const res = await fetch("/api/operations-employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    enabled: canView,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const filteredEmployees = employees.filter(emp => {
    if (filterBranch !== "all" && emp.branchId !== filterBranch) return false;
    if (filterJobTitle !== "all" && emp.jobTitle !== filterJobTitle) return false;
    if (filterStatus !== "all" && emp.isActive !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.toLowerCase();
      const username = (emp.username || "").toLowerCase();
      const phone = (emp.phone || "").toLowerCase();
      if (!fullName.includes(query) && !username.includes(query) && !phone.includes(query)) {
        return false;
      }
    }
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterBranch, filterJobTitle, filterStatus]);

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: typeof newEmployee) => {
      const res = await fetch("/api/operations-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create employee");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-employees"] });
      toast({ title: "تم إضافة الموظف بنجاح" });
      setIsAddDialogOpen(false);
      setNewEmployee({
        username: "",
        password: "",
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        branchId: "",
        jobTitle: "",
        role: "employee",
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل إضافة الموظف", variant: "destructive" });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editEmployee }) => {
      const updateData: any = { ...data };
      if (!updateData.password) delete updateData.password;
      
      const res = await fetch(`/api/operations-employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) throw new Error("Failed to update employee");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-employees"] });
      toast({ title: "تم تحديث بيانات الموظف بنجاح" });
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
    },
    onError: () => {
      toast({ title: "فشل تحديث بيانات الموظف", variant: "destructive" });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/operations-employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete employee");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-employees"] });
      toast({ title: "تم حذف الموظف بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل حذف الموظف", variant: "destructive" });
    },
  });

  const reapplyPermissionsMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/operations-employees/${id}/reapply-permissions`, { 
        method: "POST" 
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reapply permissions");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تطبيق صلاحيات الوظيفة بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل تطبيق الصلاحيات", variant: "destructive" });
    },
  });

  const openEditDialog = (emp: SafeUser) => {
    setSelectedEmployee(emp);
    setEditEmployee({
      firstName: emp.firstName || "",
      lastName: emp.lastName || "",
      phone: emp.phone || "",
      email: emp.email || "",
      branchId: emp.branchId || "",
      jobTitle: emp.jobTitle || "",
      isActive: emp.isActive || "active",
      password: "",
    });
    setIsEditDialogOpen(true);
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.username || !newEmployee.password) {
      toast({ title: "اسم المستخدم وكلمة المرور مطلوبان", variant: "destructive" });
      return;
    }
    if (!newEmployee.branchId) {
      toast({ title: "يرجى اختيار الفرع", variant: "destructive" });
      return;
    }
    createEmployeeMutation.mutate(newEmployee);
  };

  const handleEditEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    updateEmployeeMutation.mutate({
      id: selectedEmployee.id,
      data: editEmployee,
    });
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "-";
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branchId;
  };

  const getJobTitleLabel = (jobTitle: string | null) => {
    if (!jobTitle) return "-";
    const job = JOB_TITLES.find(j => j.value === jobTitle);
    return job?.label || jobTitle;
  };

  if (authLoading || permissionsLoading || employeesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">ليس لديك صلاحية للوصول لهذه الصفحة</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              موظفي التشغيل
            </h1>
            <p className="text-muted-foreground mt-1">إدارة موظفي الفروع وتعيين المهام والصلاحيات</p>
          </div>
          {canCreate && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-employee">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة موظف
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>إضافة موظف جديد</DialogTitle>
                  <DialogDescription>أدخل بيانات الموظف الجديد</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الاسم الأول *</Label>
                      <Input
                        value={newEmployee.firstName}
                        onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم العائلة *</Label>
                      <Input
                        value={newEmployee.lastName}
                        onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم المستخدم *</Label>
                      <Input
                        value={newEmployee.username}
                        onChange={(e) => setNewEmployee({ ...newEmployee, username: e.target.value })}
                        data-testid="input-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>كلمة المرور *</Label>
                      <Input
                        type="password"
                        value={newEmployee.password}
                        onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                        data-testid="input-password"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>رقم الجوال</Label>
                      <Input
                        value={newEmployee.phone}
                        onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                        placeholder="05xxxxxxxx"
                        data-testid="input-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الفرع *</Label>
                      <Select
                        value={newEmployee.branchId}
                        onValueChange={(v) => setNewEmployee({ ...newEmployee, branchId: v })}
                      >
                        <SelectTrigger data-testid="select-branch">
                          <SelectValue placeholder="اختر الفرع" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>المسمى الوظيفي *</Label>
                      <Select
                        value={newEmployee.jobTitle}
                        onValueChange={(v) => setNewEmployee({ ...newEmployee, jobTitle: v })}
                      >
                        <SelectTrigger data-testid="select-job-title">
                          <SelectValue placeholder="اختر الوظيفة" />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_TITLES.map((job) => (
                            <SelectItem key={job.value} value={job.value}>
                              {job.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      إلغاء
                    </Button>
                    <Button type="submit" disabled={createEmployeeMutation.isPending} data-testid="button-submit-employee">
                      {createEmployeeMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                      إضافة
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              قائمة الموظفين
            </CardTitle>
            <CardDescription>
              إجمالي {filteredEmployees.length} موظف
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="بحث بالاسم أو رقم الجوال..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-40" data-testid="filter-branch">
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterJobTitle} onValueChange={setFilterJobTitle}>
                <SelectTrigger className="w-40" data-testid="filter-job">
                  <SelectValue placeholder="جميع الوظائف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الوظائف</SelectItem>
                  {JOB_TITLES.map((job) => (
                    <SelectItem key={job.value} value={job.value}>
                      {job.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32" data-testid="filter-status">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>الوظيفة</TableHead>
                    <TableHead>الجوال</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-[100px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا يوجد موظفين
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.slice((currentPage - 1) * 10, currentPage * 10).map((emp) => (
                      <TableRow key={emp.id} data-testid={`employee-row-${emp.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span className="text-sm text-muted-foreground">{emp.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {getBranchName(emp.branchId)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                            {getJobTitleLabel(emp.jobTitle)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {emp.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              {emp.phone}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {emp.isActive === "active" ? (
                            <Badge variant="default" className="bg-green-500">
                              <UserCheck className="w-3 h-3 ml-1" />
                              نشط
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <UserX className="w-3 h-3 ml-1" />
                              غير نشط
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(emp)}
                                data-testid={`button-edit-${emp.id}`}
                                title="تعديل"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {canEdit && emp.jobTitle && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => reapplyPermissionsMutation.mutate(emp.id)}
                                disabled={reapplyPermissionsMutation.isPending}
                                data-testid={`button-reapply-permissions-${emp.id}`}
                                title="تطبيق صلاحيات الوظيفة"
                              >
                                <Shield className="w-4 h-4 text-primary" />
                              </Button>
                            )}
                            {canDelete && emp.id !== currentUser?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
                                    deleteEmployeeMutation.mutate(emp.id);
                                  }
                                }}
                                data-testid={`button-delete-${emp.id}`}
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredEmployees.length}
              itemsPerPage={10}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>تعديل بيانات الموظف</DialogTitle>
              <DialogDescription>
                {selectedEmployee?.firstName} {selectedEmployee?.lastName}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الاسم الأول</Label>
                  <Input
                    value={editEmployee.firstName}
                    onChange={(e) => setEditEmployee({ ...editEmployee, firstName: e.target.value })}
                    data-testid="edit-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم العائلة</Label>
                  <Input
                    value={editEmployee.lastName}
                    onChange={(e) => setEditEmployee({ ...editEmployee, lastName: e.target.value })}
                    data-testid="edit-last-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الجوال</Label>
                  <Input
                    value={editEmployee.phone}
                    onChange={(e) => setEditEmployee({ ...editEmployee, phone: e.target.value })}
                    data-testid="edit-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={editEmployee.email}
                    onChange={(e) => setEditEmployee({ ...editEmployee, email: e.target.value })}
                    data-testid="edit-email"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select
                    value={editEmployee.branchId}
                    onValueChange={(v) => setEditEmployee({ ...editEmployee, branchId: v })}
                  >
                    <SelectTrigger data-testid="edit-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المسمى الوظيفي</Label>
                  <Select
                    value={editEmployee.jobTitle}
                    onValueChange={(v) => setEditEmployee({ ...editEmployee, jobTitle: v })}
                  >
                    <SelectTrigger data-testid="edit-job-title">
                      <SelectValue placeholder="اختر الوظيفة" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TITLES.map((job) => (
                        <SelectItem key={job.value} value={job.value}>
                          {job.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select
                    value={editEmployee.isActive}
                    onValueChange={(v) => setEditEmployee({ ...editEmployee, isActive: v })}
                  >
                    <SelectTrigger data-testid="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">غير نشط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>كلمة مرور جديدة (اختياري)</Label>
                  <Input
                    type="password"
                    value={editEmployee.password}
                    onChange={(e) => setEditEmployee({ ...editEmployee, password: e.target.value })}
                    placeholder="اتركه فارغاً للإبقاء على الحالية"
                    data-testid="edit-password"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={updateEmployeeMutation.isPending} data-testid="button-save-employee">
                  {updateEmployeeMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  حفظ التغييرات
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
