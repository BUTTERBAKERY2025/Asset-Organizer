import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, Shield, Users, Building2, Key, UserPlus, Pencil, Trash2, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Department {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Role {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  hierarchyLevel: number;
  isSystemDefault: boolean;
  permissions?: RolePermission[];
}

interface Permission {
  id: number;
  module: string;
  action: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

interface RolePermission {
  id: number;
  roleId: number;
  permissionId: number;
  scope: string;
}

interface UserAssignment {
  id: number;
  userId: string;
  roleId: number;
  branchId: string | null;
  departmentId: number | null;
  scopeType: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface EffectivePermissions {
  permissions: Array<{ module: string; action: string; allowed: boolean }>;
  allowedBranches: string[];
  allowedDepartments: number[];
  primaryRole: Role | null;
}

interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  profileImageUrl?: string;
  createdAt?: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

interface UserBranchAccess {
  id: number;
  userId: string;
  branchId: string;
  accessLevel: string;
  isDefault: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: "لوحة التحكم",
  inventory: "المخزون",
  production: "الإنتاج",
  cashier: "الكاشير",
  waste: "الهدر",
  quality: "الجودة",
  targets: "الأهداف",
  reports: "التقارير",
  users: "المستخدمين",
  branches: "الفروع",
  construction: "المشاريع الإنشائية",
  settings: "الإعدادات",
};

const ACTION_LABELS: Record<string, string> = {
  view: "عرض",
  create: "إنشاء",
  edit: "تعديل",
  delete: "حذف",
  approve: "موافقة",
  export: "تصدير",
  print: "طباعة",
};

const HIERARCHY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "مدير عام", color: "bg-red-500" },
  1: { label: "مدير", color: "bg-orange-500" },
  2: { label: "مشرف", color: "bg-yellow-500" },
  3: { label: "موظف", color: "bg-green-500" },
  4: { label: "مستخدم", color: "bg-blue-500" },
  5: { label: "مشاهد", color: "bg-gray-500" },
};

export default function RBACManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin, isLoading: authLoading, isAuthenticated } = useAuth();
  const { canView, canEdit, isLoading: permsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState("users");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleLevel, setNewRoleLevel] = useState("4");
  const [isPermissionMatrixOpen, setIsPermissionMatrixOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserAssignmentDialogOpen, setIsUserAssignmentDialogOpen] = useState(false);
  const [assignmentRoleId, setAssignmentRoleId] = useState<string>("");
  const [assignmentBranchId, setAssignmentBranchId] = useState<string>("");
  const [assignmentDepartmentId, setAssignmentDepartmentId] = useState<string>("");

  const hasUsersViewPermission = isAdmin || canView("users");
  const hasUsersEditPermission = isAdmin || canEdit("users");

  useEffect(() => {
    if (!authLoading && !permsLoading && (!isAuthenticated || !hasUsersViewPermission)) {
      toast({
        title: "غير مصرح",
        description: "ليس لديك صلاحية للوصول لهذه الصفحة",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    }
  }, [authLoading, permsLoading, isAuthenticated, hasUsersViewPermission, toast]);

  const { data: departments = [], isLoading: depsLoading } = useQuery<Department[]>({
    queryKey: ["/api/rbac/departments"],
    queryFn: async () => {
      const res = await fetch("/api/rbac/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
    enabled: hasUsersViewPermission,
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/rbac/roles"],
    queryFn: async () => {
      const res = await fetch("/api/rbac/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
    enabled: hasUsersViewPermission,
  });

  const { data: allPermissions = [], isLoading: allPermsLoading } = useQuery<Permission[]>({
    queryKey: ["/api/rbac/permissions"],
    queryFn: async () => {
      const res = await fetch("/api/rbac/permissions");
      if (!res.ok) throw new Error("Failed to fetch permissions");
      return res.json();
    },
    enabled: hasUsersViewPermission,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: hasUsersViewPermission,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
    enabled: hasUsersViewPermission,
  });

  const { data: selectedUserAssignments = [], refetch: refetchUserAssignments } = useQuery<UserAssignment[]>({
    queryKey: ["/api/rbac/users", selectedUser?.id, "assignments"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/rbac/users/${selectedUser.id}/assignments`);
      if (!res.ok) throw new Error("Failed to fetch user assignments");
      return res.json();
    },
    enabled: !!selectedUser && hasUsersViewPermission,
  });

  const { data: selectedUserBranches = [], refetch: refetchUserBranches } = useQuery<UserBranchAccess[]>({
    queryKey: ["/api/rbac/users", selectedUser?.id, "branches"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/rbac/users/${selectedUser.id}/branches`);
      if (!res.ok) throw new Error("Failed to fetch user branches");
      return res.json();
    },
    enabled: !!selectedUser && hasUsersViewPermission,
  });

  const { data: rolePermissions = [], refetch: refetchRolePerms } = useQuery<RolePermission[]>({
    queryKey: ["/api/rbac/roles", selectedRole?.id, "permissions"],
    queryFn: async () => {
      if (!selectedRole) return [];
      const res = await fetch(`/api/rbac/roles/${selectedRole.id}`);
      if (!res.ok) throw new Error("Failed to fetch role permissions");
      const data = await res.json();
      return data.permissions || [];
    },
    enabled: !!selectedRole && isAdmin,
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; description: string; hierarchyLevel: number }) => {
      const res = await fetch("/api/rbac/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({ title: "تم إنشاء الدور بنجاح" });
      setIsRoleDialogOpen(false);
      setNewRoleName("");
      setNewRoleSlug("");
      setNewRoleDescription("");
      setNewRoleLevel("4");
    },
    onError: () => {
      toast({ title: "فشل إنشاء الدور", variant: "destructive" });
    },
  });

  const addRolePermMutation = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: number; permissionId: number }) => {
      const res = await fetch(`/api/rbac/roles/${roleId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId }),
      });
      if (!res.ok) throw new Error("Failed to add permission");
      return res.json();
    },
    onSuccess: () => {
      refetchRolePerms();
      toast({ title: "تم إضافة الصلاحية" });
    },
    onError: () => {
      toast({ title: "فشل إضافة الصلاحية", variant: "destructive" });
    },
  });

  const removeRolePermMutation = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: number; permissionId: number }) => {
      const res = await fetch(`/api/rbac/roles/${roleId}/permissions/${permissionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove permission");
    },
    onSuccess: () => {
      refetchRolePerms();
      toast({ title: "تم إزالة الصلاحية" });
    },
    onError: () => {
      toast({ title: "فشل إزالة الصلاحية", variant: "destructive" });
    },
  });

  const addUserAssignmentMutation = useMutation({
    mutationFn: async (data: { userId: string; roleId: number; branchId?: string; departmentId?: number }) => {
      const res = await fetch(`/api/rbac/users/${data.userId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: data.roleId,
          branchId: data.branchId || null,
          departmentId: data.departmentId || null,
          scopeType: data.branchId ? "branch" : "global",
          isPrimary: true,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to add assignment");
      return res.json();
    },
    onSuccess: () => {
      refetchUserAssignments();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "تم تعيين الدور بنجاح" });
      setAssignmentRoleId("");
      setAssignmentBranchId("");
      setAssignmentDepartmentId("");
    },
    onError: () => {
      toast({ title: "فشل تعيين الدور", variant: "destructive" });
    },
  });

  const deleteUserAssignmentMutation = useMutation({
    mutationFn: async ({ userId, assignmentId }: { userId: string; assignmentId: number }) => {
      const res = await fetch(`/api/rbac/users/${userId}/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete assignment");
    },
    onSuccess: () => {
      refetchUserAssignments();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "تم حذف التعيين" });
    },
    onError: () => {
      toast({ title: "فشل حذف التعيين", variant: "destructive" });
    },
  });

  const addUserBranchMutation = useMutation({
    mutationFn: async (data: { userId: string; branchId: string; isDefault?: boolean }) => {
      const res = await fetch(`/api/rbac/users/${data.userId}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: data.branchId,
          accessLevel: "full",
          isDefault: data.isDefault || false,
        }),
      });
      if (!res.ok) throw new Error("Failed to add branch access");
      return res.json();
    },
    onSuccess: () => {
      refetchUserBranches();
      toast({ title: "تم إضافة صلاحية الفرع" });
    },
    onError: () => {
      toast({ title: "فشل إضافة صلاحية الفرع", variant: "destructive" });
    },
  });

  const deleteUserBranchMutation = useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const res = await fetch(`/api/rbac/users/${userId}/branches/${branchId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete branch access");
    },
    onSuccess: () => {
      refetchUserBranches();
      toast({ title: "تم حذف صلاحية الفرع" });
    },
    onError: () => {
      toast({ title: "فشل حذف صلاحية الفرع", variant: "destructive" });
    },
  });

  const setDefaultBranchMutation = useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const res = await fetch(`/api/rbac/users/${userId}/branches/${branchId}/default`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to set default branch");
      return res.json();
    },
    onSuccess: () => {
      refetchUserBranches();
      toast({ title: "تم تعيين الفرع الافتراضي" });
    },
    onError: () => {
      toast({ title: "فشل تعيين الفرع الافتراضي", variant: "destructive" });
    },
  });

  const toggleModule = (module: string) => {
    setExpandedModules(prev =>
      prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]
    );
  };

  const isPermissionGranted = (permissionId: number) => {
    return rolePermissions.some(rp => rp.permissionId === permissionId);
  };

  const handlePermissionToggle = (permissionId: number) => {
    if (!selectedRole) return;
    
    if (isPermissionGranted(permissionId)) {
      removeRolePermMutation.mutate({ roleId: selectedRole.id, permissionId });
    } else {
      addRolePermMutation.mutate({ roleId: selectedRole.id, permissionId });
    }
  };

  const permissionsByModule = allPermissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  if (authLoading || depsLoading || rolesLoading || allPermsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">إدارة الأدوار والصلاحيات</h1>
            <p className="text-muted-foreground">نظام التحكم بالوصول المبني على الأدوار (RBAC)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الأقسام</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-departments-count">{departments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الأدوار</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-roles-count">{roles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الصلاحيات</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-permissions-count">{allPermissions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الوحدات</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-modules-count">{Object.keys(permissionsByModule).length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">المستخدمين</TabsTrigger>
            <TabsTrigger value="roles" data-testid="tab-roles">الأدوار</TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">الأقسام</TabsTrigger>
            <TabsTrigger value="permissions" data-testid="tab-permissions">الصلاحيات</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>المستخدمين وتعييناتهم</CardTitle>
                <CardDescription>إدارة تعيينات المستخدمين للأدوار والفروع</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المستخدم</TableHead>
                        <TableHead className="text-right">البريد الإلكتروني</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {user.profileImageUrl && (
                                <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                              )}
                              <span>{user.firstName || user.username}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                          <TableCell>
                            {user.isAdmin ? (
                              <Badge className="bg-red-500">مدير</Badge>
                            ) : (
                              <Badge variant="secondary">مستخدم</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsUserAssignmentDialogOpen(true);
                              }}
                              disabled={!hasUsersEditPermission}
                              data-testid={`button-manage-user-${user.id}`}
                            >
                              <UserPlus className="h-4 w-4 ml-2" />
                              إدارة التعيينات
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>الأدوار الوظيفية</CardTitle>
                  <CardDescription>إدارة أدوار المستخدمين وصلاحياتهم في النظام</CardDescription>
                </div>
                <Button
                  onClick={() => setIsRoleDialogOpen(true)}
                  disabled={!isAdmin}
                  data-testid="button-add-role"
                >
                  <Shield className="h-4 w-4 ml-2" />
                  إضافة دور جديد
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الدور</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">المستوى</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => {
                      const hierarchy = HIERARCHY_LABELS[role.hierarchyLevel] || HIERARCHY_LABELS[5];
                      return (
                        <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                          <TableCell className="font-medium">{role.name}</TableCell>
                          <TableCell className="text-muted-foreground">{role.description || '-'}</TableCell>
                          <TableCell>
                            <Badge className={hierarchy.color}>{hierarchy.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {role.isSystemDefault ? (
                              <Badge variant="outline">نظامي</Badge>
                            ) : (
                              <Badge variant="secondary">مخصص</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRole(role);
                                setIsPermissionMatrixOpen(true);
                              }}
                              data-testid={`button-manage-permissions-${role.id}`}
                            >
                              <Key className="h-4 w-4 ml-2" />
                              إدارة الصلاحيات
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>الأقسام</CardTitle>
                <CardDescription>الأقسام الرئيسية في المنظمة</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">اسم القسم</TableHead>
                      <TableHead className="text-right">الرمز</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id} data-testid={`row-department-${dept.id}`}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{dept.code}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{dept.description || '-'}</TableCell>
                        <TableCell>
                          {dept.isActive ? (
                            <Badge className="bg-green-500">نشط</Badge>
                          ) : (
                            <Badge variant="secondary">غير نشط</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>الصلاحيات حسب الوحدة</CardTitle>
                <CardDescription>عرض جميع الصلاحيات المتاحة في النظام</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(permissionsByModule).map(([module, modulePerms]) => (
                  <Collapsible
                    key={module}
                    open={expandedModules.includes(module)}
                    onOpenChange={() => toggleModule(module)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between" data-testid={`button-module-${module}`}>
                        <span className="font-medium">{MODULE_LABELS[module] || module}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{modulePerms.length} صلاحية</Badge>
                          {expandedModules.includes(module) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 py-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {modulePerms.map((perm) => (
                          <div
                            key={perm.id}
                            className="flex items-center gap-2 p-2 border rounded-lg"
                            data-testid={`permission-${perm.id}`}
                          >
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm font-medium">{perm.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {ACTION_LABELS[perm.action] || perm.action}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isPermissionMatrixOpen} onOpenChange={setIsPermissionMatrixOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إدارة صلاحيات: {selectedRole?.name}</DialogTitle>
              <DialogDescription>
                حدد الصلاحيات التي تريد منحها لهذا الدور
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {Object.entries(permissionsByModule).map(([module, modulePerms]) => (
                <div key={module} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{MODULE_LABELS[module] || module}</h4>
                    <Badge variant="outline">{modulePerms.filter(p => isPermissionGranted(p.id)).length}/{modulePerms.length}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {modulePerms.map((perm) => {
                      const granted = isPermissionGranted(perm.id);
                      return (
                        <div
                          key={perm.id}
                          className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                            granted ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handlePermissionToggle(perm.id)}
                          data-testid={`toggle-permission-${perm.id}`}
                        >
                          <Checkbox checked={granted} />
                          <div className="text-sm">
                            <div className="font-medium">{ACTION_LABELS[perm.action] || perm.action}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPermissionMatrixOpen(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isUserAssignmentDialogOpen} onOpenChange={setIsUserAssignmentDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إدارة تعيينات: {selectedUser?.firstName || selectedUser?.username}</DialogTitle>
              <DialogDescription>
                تعيين الأدوار والفروع للمستخدم
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  التعيينات الحالية
                </h4>
                {selectedUserAssignments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">لا توجد تعيينات حالية</p>
                ) : (
                  <div className="space-y-2">
                    {selectedUserAssignments.map((assignment) => {
                      const role = roles.find(r => r.id === assignment.roleId);
                      const branch = branches.find(b => b.id === assignment.branchId);
                      const dept = departments.find(d => d.id === assignment.departmentId);
                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`assignment-${assignment.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge className={HIERARCHY_LABELS[role?.hierarchyLevel || 5]?.color || 'bg-gray-500'}>
                              {role?.name || 'غير معروف'}
                            </Badge>
                            {branch && (
                              <Badge variant="outline">{branch.name}</Badge>
                            )}
                            {dept && (
                              <Badge variant="secondary">{dept.name}</Badge>
                            )}
                            {assignment.isPrimary && (
                              <Badge className="bg-blue-500">أساسي</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (selectedUser) {
                                deleteUserAssignmentMutation.mutate({
                                  userId: selectedUser.id,
                                  assignmentId: assignment.id,
                                });
                              }
                            }}
                            data-testid={`delete-assignment-${assignment.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-t pt-4">
                  <h5 className="font-medium mb-3">إضافة تعيين جديد</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>الدور</Label>
                      <Select value={assignmentRoleId} onValueChange={setAssignmentRoleId}>
                        <SelectTrigger data-testid="select-assignment-role">
                          <SelectValue placeholder="اختر الدور" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id.toString()}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>الفرع (اختياري)</Label>
                      <Select value={assignmentBranchId} onValueChange={setAssignmentBranchId}>
                        <SelectTrigger data-testid="select-assignment-branch">
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
                    </div>
                    <div>
                      <Label>القسم (اختياري)</Label>
                      <Select value={assignmentDepartmentId} onValueChange={setAssignmentDepartmentId}>
                        <SelectTrigger data-testid="select-assignment-department">
                          <SelectValue placeholder="جميع الأقسام" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">جميع الأقسام</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="mt-3"
                    onClick={() => {
                      if (selectedUser && assignmentRoleId) {
                        addUserAssignmentMutation.mutate({
                          userId: selectedUser.id,
                          roleId: parseInt(assignmentRoleId),
                          branchId: assignmentBranchId && assignmentBranchId !== "all" ? assignmentBranchId : undefined,
                          departmentId: assignmentDepartmentId && assignmentDepartmentId !== "all" ? parseInt(assignmentDepartmentId) : undefined,
                        });
                      }
                    }}
                    disabled={!assignmentRoleId || addUserAssignmentMutation.isPending}
                    data-testid="button-add-assignment"
                  >
                    {addUserAssignmentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 ml-2" />
                    )}
                    إضافة التعيين
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  صلاحيات الفروع
                </h4>
                {selectedUserBranches.length === 0 ? (
                  <p className="text-muted-foreground text-sm">لا توجد صلاحيات فروع محددة (يمكن الوصول لجميع الفروع)</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedUserBranches.map((access) => {
                      const branch = branches.find(b => b.id === access.branchId);
                      return (
                        <div
                          key={access.id}
                          className={`flex items-center justify-between p-2 border rounded-lg ${access.isDefault ? 'border-blue-300 bg-blue-50' : ''}`}
                          data-testid={`branch-access-${access.branchId}`}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span className="text-sm">{branch?.name || access.branchId}</span>
                            {access.isDefault && (
                              <Badge className="bg-blue-500 text-xs">افتراضي</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {!access.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (selectedUser) {
                                    setDefaultBranchMutation.mutate({
                                      userId: selectedUser.id,
                                      branchId: access.branchId,
                                    });
                                  }
                                }}
                                title="تعيين كفرع افتراضي"
                                data-testid={`set-default-branch-${access.branchId}`}
                              >
                                <Check className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (selectedUser) {
                                  deleteUserBranchMutation.mutate({
                                    userId: selectedUser.id,
                                    branchId: access.branchId,
                                  });
                                }
                              }}
                              data-testid={`delete-branch-access-${access.branchId}`}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {branches
                    .filter(b => !selectedUserBranches.some(ub => ub.branchId === b.id))
                    .map((branch) => (
                      <Button
                        key={branch.id}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedUser) {
                            addUserBranchMutation.mutate({
                              userId: selectedUser.id,
                              branchId: branch.id,
                              isDefault: selectedUserBranches.length === 0,
                            });
                          }
                        }}
                        data-testid={`add-branch-${branch.id}`}
                      >
                        <UserPlus className="h-4 w-4 ml-1" />
                        {branch.name}
                      </Button>
                    ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUserAssignmentDialogOpen(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة دور جديد</DialogTitle>
              <DialogDescription>أنشئ دور جديد وحدد مستوى صلاحياته</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">اسم الدور</Label>
                <Input
                  id="role-name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="مثال: محاسب المبيعات"
                  data-testid="input-role-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-slug">الرمز (بالإنجليزية)</Label>
                <Input
                  id="role-slug"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="مثال: sales_accountant"
                  dir="ltr"
                  data-testid="input-role-slug"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-level">مستوى الصلاحية</Label>
                <Select value={newRoleLevel} onValueChange={setNewRoleLevel}>
                  <SelectTrigger data-testid="select-role-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - مدير عام (أعلى صلاحية)</SelectItem>
                    <SelectItem value="1">1 - إدارة عليا</SelectItem>
                    <SelectItem value="2">2 - مدير / محاسب</SelectItem>
                    <SelectItem value="3">3 - مشرف</SelectItem>
                    <SelectItem value="4">4 - موظف / كاشير</SelectItem>
                    <SelectItem value="5">5 - مشاهد فقط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">الوصف (اختياري)</Label>
                <Input
                  id="role-description"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="وصف مختصر للدور"
                  data-testid="input-role-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => {
                  if (newRoleName && newRoleSlug) {
                    createRoleMutation.mutate({
                      name: newRoleName,
                      slug: newRoleSlug,
                      description: newRoleDescription,
                      hierarchyLevel: parseInt(newRoleLevel),
                    });
                  }
                }}
                disabled={!newRoleName || !newRoleSlug || createRoleMutation.isPending}
                data-testid="button-save-role"
              >
                {createRoleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                حفظ الدور
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
