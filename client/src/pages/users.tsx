import { Layout } from "@/components/layout";
import { ExportButtons } from "@/components/export-buttons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { TablePagination } from "@/components/ui/pagination";
import { Loader2, Users, Shield, UserCog, Eye, Plus, Trash2, Settings2, Wand2, Pencil } from "lucide-react";
import type { User, UserPermission } from "@shared/schema";
import { SYSTEM_MODULES, MODULE_ACTIONS, MODULE_LABELS, ACTION_LABELS, ROLE_PERMISSION_TEMPLATES, MODULE_GROUPS } from "@shared/schema";
import React, { useEffect, useState } from "react";

const ROLES = [
  { value: "admin", label: "مدير", icon: Shield, description: "صلاحيات كاملة" },
  { value: "employee", label: "موظف", icon: UserCog, description: "حسب الصلاحيات المحددة" },
  { value: "viewer", label: "مشاهد", icon: Eye, description: "حسب الصلاحيات المحددة" },
];

const exportColumns = [
  { header: "الاسم", key: "name", width: 20 },
  { header: "اسم المستخدم", key: "username", width: 15 },
  { header: "البريد", key: "email", width: 25 },
  { header: "الدور", key: "role", width: 12 },
  { header: "الفرع", key: "branchId", width: 15 },
];

type SafeUser = Omit<User, 'password'>;

interface PermissionState {
  [module: string]: string[];
}

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin, isLoading: authLoading, isAuthenticated } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({});
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "viewer",
  });
  const [editUser, setEditUser] = useState({
    firstName: "",
    lastName: "",
    role: "viewer",
    password: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      toast({
        title: "غير مصرح",
        description: "ليس لديك صلاحية للوصول لهذه الصفحة",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    }
  }, [authLoading, isAuthenticated, isAdmin, toast]);

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isAdmin,
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "تم إضافة المستخدم بنجاح" });
      setIsAddDialogOpen(false);
      setNewUser({ username: "", password: "", firstName: "", lastName: "", role: "viewer" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل إضافة المستخدم", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "تم تحديث الصلاحية بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل تحديث الصلاحية", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "تم حذف المستخدم بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل حذف المستخدم", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { firstName?: string; lastName?: string; role?: string; password?: string } }) => {
      const updateData: any = {};
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.password && data.password.trim() !== "") updateData.password = data.password;
      
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "تم تحديث بيانات المستخدم بنجاح" });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل تحديث بيانات المستخدم", variant: "destructive" });
    },
  });

  const { data: userPermissions = [] } = useQuery<UserPermission[]>({
    queryKey: ["/api/users", selectedUser?.id, "permissions"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/users/${selectedUser.id}/permissions`);
      if (!res.ok) return [];
      const data = await res.json();
      const state: PermissionState = {};
      for (const perm of data) {
        state[perm.module] = perm.actions;
      }
      setPermissionState(state);
      return data;
    },
    enabled: !!selectedUser && isPermissionsDialogOpen,
    staleTime: 0,
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async ({ permissions, templateApplied }: { permissions: { module: string; actions: string[] }[]; templateApplied: string | null }) => {
      if (!selectedUser) return;
      const res = await fetch(`/api/users/${selectedUser.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions, templateApplied }),
      });
      if (!res.ok) throw new Error("Failed to save permissions");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الصلاحيات بنجاح" });
      setIsPermissionsDialogOpen(false);
      setSelectedUser(null);
      setAppliedTemplate(null);
    },
    onError: () => {
      toast({ title: "فشل حفظ الصلاحيات", variant: "destructive" });
    },
  });

  const openPermissionsDialog = (user: SafeUser) => {
    setSelectedUser(user);
    setPermissionState({});
    setAppliedTemplate(null);
    setIsPermissionsDialogOpen(true);
  };

  const openEditDialog = (user: SafeUser) => {
    setSelectedUser(user);
    setEditUser({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role,
      password: "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateUserMutation.mutate({
      userId: selectedUser.id,
      data: editUser,
    });
  };

  const toggleAction = (module: string, action: string) => {
    setPermissionState(prev => {
      const currentActions = prev[module] || [];
      const hasAction = currentActions.includes(action);
      
      if (hasAction) {
        return {
          ...prev,
          [module]: currentActions.filter(a => a !== action),
        };
      } else {
        return {
          ...prev,
          [module]: [...currentActions, action],
        };
      }
    });
  };

  const toggleAllActionsForModule = (module: string) => {
    setPermissionState(prev => {
      const currentActions = prev[module] || [];
      const allSelected = MODULE_ACTIONS.every(a => currentActions.includes(a));
      
      if (allSelected) {
        return {
          ...prev,
          [module]: [],
        };
      } else {
        return {
          ...prev,
          [module]: [...MODULE_ACTIONS],
        };
      }
    });
  };

  const applyRoleTemplate = () => {
    if (!selectedUser) return;
    
    const template = ROLE_PERMISSION_TEMPLATES[selectedUser.role];
    if (!template) return;
    
    const newState: PermissionState = {};
    for (const perm of template) {
      newState[perm.module] = [...perm.actions];
    }
    setPermissionState(newState);
    setAppliedTemplate(selectedUser.role);
    
    toast({
      title: "تم تطبيق القالب",
      description: `تم تطبيق الصلاحيات الافتراضية لدور ${ROLES.find(r => r.value === selectedUser.role)?.label || selectedUser.role}`,
    });
  };

  const handleSavePermissions = () => {
    const permissions = Object.entries(permissionState)
      .filter(([_, actions]) => actions.length > 0)
      .map(([module, actions]) => ({ module, actions }));
    
    savePermissionsMutation.mutate({ permissions, templateApplied: appliedTemplate });
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast({ title: "اسم المستخدم وكلمة المرور مطلوبان", variant: "destructive" });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              إدارة المستخدمين
            </h1>
            <p className="text-muted-foreground mt-1">إضافة وإدارة صلاحيات المستخدمين</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-user">
                <Plus className="w-4 h-4 ml-2" />
                إضافة مستخدم
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة مستخدم جديد</DialogTitle>
                <DialogDescription>أدخل بيانات المستخدم الجديد</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">الاسم الأول</Label>
                    <Input
                      id="firstName"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">اسم العائلة</Label>
                    <Input
                      id="lastName"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">اسم المستخدم *</Label>
                  <Input
                    id="username"
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="username"
                    className="text-left"
                    dir="ltr"
                    required
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="••••••••"
                    className="text-left"
                    dir="ltr"
                    required
                    data-testid="input-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">الصلاحية</Label>
                  <Select value={newUser.role} onValueChange={(role) => setNewUser({ ...newUser, role })}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label} - {role.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createUserMutation.isPending} data-testid="button-submit-user">
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الإضافة...
                    </>
                  ) : (
                    "إضافة المستخدم"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROLES.map((role) => {
            const count = users.filter((u) => u.role === role.value).length;
            return (
              <Card key={role.value}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <role.icon className="w-5 h-5" />
                    {role.label}
                  </CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                قائمة المستخدمين
                <Badge variant="secondary" className="mr-2">{users.length}</Badge>
              </CardTitle>
              <CardDescription>إجمالي عدد المستخدمين: {users.length}</CardDescription>
            </div>
            <ExportButtons
              data={users.map(user => ({
                ...user,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'مستخدم',
              }))}
              columns={exportColumns}
              fileName="users"
              title="تقرير المستخدمين"
              sheetName="المستخدمين"
            />
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">اسم المستخدم</TableHead>
                    <TableHead className="text-right">تاريخ التسجيل</TableHead>
                    <TableHead className="text-right">الصلاحية</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا يوجد مستخدمين
                      </TableCell>
                    </TableRow>
                  ) : (
                    users
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                              <AvatarFallback>{user.firstName?.[0] || user.phone?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium">
                                {user.firstName || user.lastName 
                                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                  : 'مستخدم'
                                }
                              </span>
                              {user.id === currentUser?.id && (
                                <Badge variant="outline" className="mr-2 text-xs">أنت</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono" dir="ltr">{user.username || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ userId: user.id, role })}
                            disabled={user.id === currentUser?.id}
                          >
                            <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-amber-600 hover:text-amber-700"
                              onClick={() => openEditDialog(user)}
                              data-testid={`button-edit-${user.id}`}
                              title="تعديل البيانات"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={() => openPermissionsDialog(user)}
                              data-testid={`button-permissions-${user.id}`}
                              title="إدارة الصلاحيات"
                            >
                              <Settings2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              disabled={user.id === currentUser?.id || deleteUserMutation.isPending}
                              data-testid={`button-delete-${user.id}`}
                              title="حذف المستخدم"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
              totalItems={users.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              إدارة صلاحيات المستخدم
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <span>
                  تحديد صلاحيات {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.username})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedUser?.role === "admin" ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 text-amber-500" />
              <p>المدير لديه صلاحيات كاملة على النظام</p>
              <p className="text-sm">لا يمكن تعديل صلاحيات المدير</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {selectedUser?.role === "viewer" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-blue-800 text-sm">
                      <Eye className="w-4 h-4 inline-block ml-2" />
                      المشاهد يمكنه العرض فقط. حدد الوحدات التي يستطيع مشاهدتها.
                    </div>
                  )}
                  {selectedUser?.role === "employee" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-sm">
                      <UserCog className="w-4 h-4 inline-block ml-2" />
                      الموظف لديه صلاحيات مخصصة حسب الاختيار أدناه.
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applyRoleTemplate}
                  className="mr-4"
                  data-testid="button-apply-template"
                >
                  <Wand2 className="w-4 h-4 ml-2" />
                  تطبيق القالب الافتراضي
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-48">الوحدة</TableHead>
                      {selectedUser?.role === "viewer" ? (
                        <TableHead className="text-center w-20">
                          {ACTION_LABELS["view"]}
                        </TableHead>
                      ) : (
                        MODULE_ACTIONS.map(action => (
                          <TableHead key={action} className="text-center w-20">
                            {ACTION_LABELS[action]}
                          </TableHead>
                        ))
                      )}
                      {selectedUser?.role !== "viewer" && (
                        <TableHead className="text-center w-20">الكل</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULE_GROUPS.map((group) => (
                      <React.Fragment key={group.label}>
                        <TableRow className="bg-muted/50">
                          <TableCell 
                            colSpan={selectedUser?.role === "viewer" ? 2 : MODULE_ACTIONS.length + 2} 
                            className="font-bold text-primary py-2"
                          >
                            {group.label}
                          </TableCell>
                        </TableRow>
                        {group.modules.map(module => {
                          const currentActions = permissionState[module] || [];
                          const allSelected = MODULE_ACTIONS.every(a => currentActions.includes(a));
                          
                          return (
                            <TableRow key={module}>
                              <TableCell className="font-medium pr-6">
                                {MODULE_LABELS[module]}
                              </TableCell>
                              {selectedUser?.role === "viewer" ? (
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={currentActions.includes("view")}
                                    onCheckedChange={() => toggleAction(module, "view")}
                                    data-testid={`checkbox-${module}-view`}
                                  />
                                </TableCell>
                              ) : (
                                MODULE_ACTIONS.map(action => (
                                  <TableCell key={action} className="text-center">
                                    <Checkbox
                                      checked={currentActions.includes(action)}
                                      onCheckedChange={() => toggleAction(module, action)}
                                      data-testid={`checkbox-${module}-${action}`}
                                    />
                                  </TableCell>
                                ))
                              )}
                              {selectedUser?.role !== "viewer" && (
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={() => toggleAllActionsForModule(module)}
                                    data-testid={`checkbox-${module}-all`}
                                  />
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPermissionsDialogOpen(false)}
                  data-testid="button-cancel-permissions"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSavePermissions}
                  disabled={savePermissionsMutation.isPending}
                  data-testid="button-save-permissions"
                >
                  {savePermissionsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    "حفظ الصلاحيات"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              تعديل بيانات المستخدم
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <span>تعديل بيانات {selectedUser.username}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">الاسم الأول</Label>
                <Input
                  id="editFirstName"
                  value={editUser.firstName}
                  onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })}
                  data-testid="input-edit-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">اسم العائلة</Label>
                <Input
                  id="editLastName"
                  value={editUser.lastName}
                  onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })}
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">الدور</Label>
              <Select 
                value={editUser.role} 
                onValueChange={(role) => setEditUser({ ...editUser, role })}
                disabled={selectedUser?.id === currentUser?.id}
              >
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUser?.id === currentUser?.id && (
                <p className="text-xs text-muted-foreground">لا يمكنك تغيير دورك الخاص</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPassword">كلمة المرور الجديدة</Label>
              <Input
                id="editPassword"
                type="password"
                value={editUser.password}
                onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                placeholder="اتركها فارغة للإبقاء على كلمة المرور الحالية"
                className="text-left"
                dir="ltr"
                data-testid="input-edit-password"
              />
              <p className="text-xs text-muted-foreground">اتركها فارغة إذا لم ترد تغيير كلمة المرور</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={updateUserMutation.isPending} 
                data-testid="button-submit-edit"
              >
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  "حفظ التغييرات"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
