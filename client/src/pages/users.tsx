import { Layout } from "@/components/layout";
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
import { Loader2, Users, Shield, UserCog, Eye, Plus, Trash2, Settings2 } from "lucide-react";
import type { User, UserPermission } from "@shared/schema";
import { SYSTEM_MODULES, MODULE_ACTIONS, MODULE_LABELS, ACTION_LABELS } from "@shared/schema";
import { useEffect, useState } from "react";

const ROLES = [
  { value: "admin", label: "مدير", icon: Shield, description: "صلاحيات كاملة" },
  { value: "employee", label: "موظف", icon: UserCog, description: "حسب الصلاحيات المحددة" },
  { value: "viewer", label: "مشاهد", icon: Eye, description: "حسب الصلاحيات المحددة" },
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
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({});
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "viewer",
  });

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

  const { data: userPermissions = [], refetch: refetchPermissions } = useQuery<UserPermission[]>({
    queryKey: ["/api/users", selectedUser?.id, "permissions"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/users/${selectedUser.id}/permissions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedUser && isPermissionsDialogOpen,
  });

  useEffect(() => {
    if (userPermissions.length > 0) {
      const state: PermissionState = {};
      for (const perm of userPermissions) {
        state[perm.module] = perm.actions;
      }
      setPermissionState(state);
    } else if (selectedUser) {
      setPermissionState({});
    }
  }, [userPermissions, selectedUser]);

  const savePermissionsMutation = useMutation({
    mutationFn: async (permissions: { module: string; actions: string[] }[]) => {
      if (!selectedUser) return;
      const res = await fetch(`/api/users/${selectedUser.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Failed to save permissions");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الصلاحيات بنجاح" });
      setIsPermissionsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "فشل حفظ الصلاحيات", variant: "destructive" });
    },
  });

  const openPermissionsDialog = (user: SafeUser) => {
    setSelectedUser(user);
    setPermissionState({});
    setIsPermissionsDialogOpen(true);
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

  const handleSavePermissions = () => {
    const permissions = Object.entries(permissionState)
      .filter(([_, actions]) => actions.length > 0)
      .map(([module, actions]) => ({ module, actions }));
    
    savePermissionsMutation.mutate(permissions);
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              قائمة المستخدمين
            </CardTitle>
            <CardDescription>عدد المستخدمين: {users.length}</CardDescription>
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
                    users.map((user) => (
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
                            {user.role !== "admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => openPermissionsDialog(user)}
                                data-testid={`button-permissions-${user.id}`}
                              >
                                <Settings2 className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              disabled={user.id === currentUser?.id || deleteUserMutation.isPending}
                              data-testid={`button-delete-${user.id}`}
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-48">الوحدة</TableHead>
                      {MODULE_ACTIONS.map(action => (
                        <TableHead key={action} className="text-center w-20">
                          {ACTION_LABELS[action]}
                        </TableHead>
                      ))}
                      <TableHead className="text-center w-20">الكل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SYSTEM_MODULES.map(module => {
                      const currentActions = permissionState[module] || [];
                      const allSelected = MODULE_ACTIONS.every(a => currentActions.includes(a));
                      
                      return (
                        <TableRow key={module}>
                          <TableCell className="font-medium">
                            {MODULE_LABELS[module]}
                          </TableCell>
                          {MODULE_ACTIONS.map(action => (
                            <TableCell key={action} className="text-center">
                              <Checkbox
                                checked={currentActions.includes(action)}
                                onCheckedChange={() => toggleAction(module, action)}
                                data-testid={`checkbox-${module}-${action}`}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleAllActionsForModule(module)}
                              data-testid={`checkbox-${module}-all`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
    </Layout>
  );
}
