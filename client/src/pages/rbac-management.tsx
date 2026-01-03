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
  const [activeTab, setActiveTab] = useState("roles");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isPermissionMatrixOpen, setIsPermissionMatrixOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

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
            <TabsTrigger value="roles" data-testid="tab-roles">الأدوار</TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">الأقسام</TabsTrigger>
            <TabsTrigger value="permissions" data-testid="tab-permissions">الصلاحيات</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>الأدوار الوظيفية</CardTitle>
                <CardDescription>إدارة أدوار المستخدمين وصلاحياتهم في النظام</CardDescription>
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
      </div>
    </Layout>
  );
}
