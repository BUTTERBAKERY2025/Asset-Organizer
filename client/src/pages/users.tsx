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
import { Loader2, Users, Shield, UserCog, Eye, Plus, Trash2, Settings2, Wand2, Pencil, Search, X, Filter, KeyRound, Power, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import type { User, UserPermission, Branch } from "@shared/schema";
import { SYSTEM_MODULES, MODULE_ACTIONS, MODULE_LABELS, ACTION_LABELS, ROLE_PERMISSION_TEMPLATES, MODULE_GROUPS } from "@shared/schema";
import React, { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Lock, Unlock } from "lucide-react";

type PermissionSource = 'direct' | 'role' | 'override_grant' | 'override_deny';

interface PermissionWithSource {
  module: string;
  action: string;
  source: PermissionSource;
  roleName?: string;
  isActive: boolean;
  permissionId?: number;
}

const ROLES = [
  { value: "admin", label: "مدير", icon: Shield, description: "صلاحيات كاملة" },
  { value: "financial_accountant", label: "محاسب مالي", icon: UserCog, description: "اطلاع على التقارير المالية والتشغيلية" },
  { value: "employee", label: "موظف", icon: UserCog, description: "حسب الصلاحيات المحددة" },
  { value: "viewer", label: "مشاهد", icon: Eye, description: "حسب الصلاحيات المحددة" },
  { value: "attendance_clerk", label: "مسجل الحضور", icon: UserCog, description: "تسجيل الحضور والانصراف فقط" },
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
  const [permissionSources, setPermissionSources] = useState<Map<string, PermissionWithSource>>(new Map());
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "viewer",
    branchIds: [] as string[],
  });
  const [editUser, setEditUser] = useState({
    firstName: "",
    lastName: "",
    username: "",
    role: "viewer",
    password: "",
    branchIds: [] as string[],
  });
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<SafeUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<SafeUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      toast({
        title: "غير مصرح",
        description: "ليس لديك صلاحية للوصول لهذه الصفحة",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
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

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
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
      setNewUser({ username: "", password: "", firstName: "", lastName: "", role: "viewer", branchIds: [] });
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
    mutationFn: async ({ userId, data }: { userId: string; data: { firstName?: string; lastName?: string; username?: string; role?: string; password?: string; branchIds?: string[] } }) => {
      const updateData: any = {};
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.username !== undefined) updateData.username = data.username;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.password && data.password.trim() !== "") updateData.password = data.password;
      if (data.branchIds !== undefined) updateData.branchIds = data.branchIds;
      
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

  const { data: userPermissions = [], refetch: refetchPermissions } = useQuery<UserPermission[]>({
    queryKey: ["/api/users", selectedUser?.id, "permissions"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/users/${selectedUser.id}/permissions`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      const data = await res.json();
      const state: PermissionState = {};
      for (const perm of data) {
        state[perm.module] = perm.actions;
      }
      setPermissionState(state);
      return data;
    },
    enabled: !!selectedUser && isPermissionsDialogOpen,
    staleTime: 15000,
  });

  const { data: permissionsWithSources = [], refetch: refetchPermissionSources } = useQuery<PermissionWithSource[]>({
    queryKey: ["/api/users", selectedUser?.id, "permissions-with-sources"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/users/${selectedUser.id}/permissions-with-sources`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      const data: PermissionWithSource[] = await res.json();
      const sourcesMap = new Map<string, PermissionWithSource>();
      for (const perm of data) {
        sourcesMap.set(`${perm.module}:${perm.action}`, perm);
      }
      setPermissionSources(sourcesMap);
      return data;
    },
    enabled: !!selectedUser && isPermissionsDialogOpen,
    staleTime: 15000,
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
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "permissions-with-sources"] });
      setIsPermissionsDialogOpen(false);
      setSelectedUser(null);
      setAppliedTemplate(null);
    },
    onError: () => {
      toast({ title: "فشل حفظ الصلاحيات", variant: "destructive" });
    },
  });

  const setPermissionOverrideMutation = useMutation({
    mutationFn: async ({ permissionId, allow, reason }: { permissionId: number; allow: boolean; reason?: string }) => {
      if (!selectedUser) return;
      const res = await fetch(`/api/users/${selectedUser.id}/permission-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId, allow, reason }),
      });
      if (!res.ok) throw new Error("Failed to set permission override");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث تجاوز الصلاحية بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "permissions-with-sources"] });
    },
    onError: () => {
      toast({ title: "فشل تحديث تجاوز الصلاحية", variant: "destructive" });
    },
  });

  const removePermissionOverrideMutation = useMutation({
    mutationFn: async ({ permissionId }: { permissionId: number }) => {
      if (!selectedUser) return;
      const res = await fetch(`/api/users/${selectedUser.id}/permission-override/${permissionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove permission override");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إزالة تجاوز الصلاحية" });
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "permissions-with-sources"] });
    },
    onError: () => {
      toast({ title: "فشل إزالة تجاوز الصلاحية", variant: "destructive" });
    },
  });

  const openPermissionsDialog = (user: SafeUser) => {
    setSelectedUser(user);
    setPermissionState({});
    setPermissionSources(new Map());
    setAppliedTemplate(null);
    setIsPermissionsDialogOpen(true);
  };

  const openEditDialog = async (user: SafeUser) => {
    setSelectedUser(user);
    let userBranchIds: string[] = [];
    try {
      const res = await fetch(`/api/rbac/users/${user.id}/branches`, { credentials: "include" });
      if (res.ok) {
        const accessList = await res.json();
        userBranchIds = accessList.map((a: any) => a.branchId);
      }
    } catch {}
    if (userBranchIds.length === 0 && user.branchId) {
      userBranchIds = [user.branchId];
    }
    setEditUser({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      username: user.username || "",
      role: user.role,
      password: "",
      branchIds: userBranchIds,
    });
    setIsEditDialogOpen(true);
  };

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: string }) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user status");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ 
        title: variables.isActive === "active" ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم",
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل تحديث حالة المستخدم", variant: "destructive" });
    },
  });

  const handleConfirmDelete = () => {
    if (deleteConfirmUser) {
      deleteUserMutation.mutate(deleteConfirmUser.id);
      setDeleteConfirmUser(null);
    }
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "تم إعادة تعيين كلمة المرور بنجاح" });
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل إعادة تعيين كلمة المرور", variant: "destructive" });
    },
  });

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateUserMutation.mutate({
      userId: selectedUser.id,
      data: editUser,
    });
  };

  const SMART_INCENTIVES_SUBMODULES = [
    "smart_incentives_settings",
    "smart_incentives_challenges",
    "smart_incentives_commissions",
    "smart_incentives_bonus",
    "smart_incentives_wallet",
    "smart_incentives_statements",
  ];

  const toggleAction = (module: string, action: string) => {
    setPermissionState(prev => {
      const currentActions = prev[module] || [];
      const hasAction = currentActions.includes(action);
      const newState = { ...prev };
      
      if (hasAction) {
        newState[module] = currentActions.filter(a => a !== action);
      } else {
        newState[module] = [...currentActions, action];
      }

      if (module === "incentives") {
        for (const subModule of SMART_INCENTIVES_SUBMODULES) {
          const subActions = newState[subModule] || [];
          if (hasAction) {
            newState[subModule] = subActions.filter(a => a !== action);
          } else {
            if (!subActions.includes(action)) {
              newState[subModule] = [...subActions, action];
            }
          }
        }
      }

      return newState;
    });
  };

  const toggleAllActionsForModule = (module: string) => {
    setPermissionState(prev => {
      const currentActions = prev[module] || [];
      const allSelected = MODULE_ACTIONS.every(a => currentActions.includes(a));
      const newState = { ...prev };
      
      if (allSelected) {
        newState[module] = [];
      } else {
        newState[module] = [...MODULE_ACTIONS];
      }

      if (module === "incentives") {
        for (const subModule of SMART_INCENTIVES_SUBMODULES) {
          if (allSelected) {
            newState[subModule] = [];
          } else {
            newState[subModule] = [...MODULE_ACTIONS];
          }
        }
      }

      return newState;
    });
  };

  const toggleAllForAction = (action: string) => {
    setPermissionState(prev => {
      const allModules = MODULE_GROUPS.flatMap(g => g.modules);
      const allHaveAction = allModules.every(m => (prev[m] || []).includes(action));
      
      const newState = { ...prev };
      for (const module of allModules) {
        const currentActions = newState[module] || [];
        if (allHaveAction) {
          newState[module] = currentActions.filter(a => a !== action);
        } else {
          if (!currentActions.includes(action)) {
            newState[module] = [...currentActions, action];
          }
        }
      }
      return newState;
    });
  };

  const toggleAllForCategory = (modules: string[]) => {
    setPermissionState(prev => {
      const allSelected = modules.every(m => 
        MODULE_ACTIONS.every(a => (prev[m] || []).includes(a))
      );
      
      const newState = { ...prev };
      for (const module of modules) {
        if (allSelected) {
          newState[module] = [];
        } else {
          newState[module] = [...MODULE_ACTIONS];
        }
      }
      return newState;
    });
  };

  const getPermissionCount = () => {
    let count = 0;
    for (const actions of Object.values(permissionState)) {
      count += actions.length;
    }
    return count;
  };

  const getPermissionSource = (module: string, action: string): PermissionWithSource | null => {
    return permissionSources.get(`${module}:${action}`) || null;
  };

  const getSourceInfo = (source: PermissionSource | undefined) => {
    switch (source) {
      case 'direct':
        return { color: 'bg-green-500', label: 'صلاحية مباشرة', icon: null };
      case 'role':
        return { color: 'bg-blue-500', label: 'موروثة من الدور', icon: Lock };
      case 'override_grant':
        return { color: 'bg-amber-500', label: 'منحت بتجاوز', icon: Unlock };
      case 'override_deny':
        return { color: 'bg-red-500', label: 'محظورة بتجاوز', icon: Lock };
      default:
        return { color: 'bg-gray-300', label: 'غير محددة', icon: null };
    }
  };

  const isInheritedPermission = (module: string, action: string): boolean => {
    const source = getPermissionSource(module, action);
    return source?.source === 'role';
  };

  const ROLE_TEMPLATES = [
    { id: "cashier", label: "كاشير", icon: "💰" },
    { id: "supervisor", label: "مشرف", icon: "👨‍💼" },
    { id: "branch_manager", label: "مدير فرع", icon: "🏪" },
    { id: "production_manager", label: "مدير إنتاج", icon: "🏭" },
    { id: "viewer", label: "مشاهد فقط", icon: "👁️" },
    { id: "employee", label: "موظف عادي", icon: "👤" },
  ];

  const applyCustomTemplate = (templateId: string) => {
    const templates: Record<string, { module: string; actions: string[] }[]> = {
      cashier: [
        { module: "cashier_journal", actions: ["view", "view_list", "view_details", "create", "edit", "submit", "sign", "print"] },
        { module: "cashier_performance", actions: ["view", "view_list", "view_details"] },
        { module: "dashboard", actions: ["view"] },
        { module: "platform_home", actions: ["view"] },
        { module: "event_pos", actions: ["view", "create"] },
      ],
      supervisor: [
        { module: "dashboard", actions: ["view", "export"] },
        { module: "platform_home", actions: ["view"] },
        { module: "cashier_journal", actions: ["view", "view_list", "view_details", "approve", "reject", "print", "export"] },
        { module: "cashier_performance", actions: ["view", "view_list", "view_details", "export"] },
        { module: "operations", actions: ["view", "create", "edit"] },
        { module: "production", actions: ["view"] },
        { module: "shifts", actions: ["view", "create", "edit"] },
        { module: "quality_control", actions: ["view"] },
        { module: "inventory", actions: ["view"] },
      ],
      branch_manager: [
        { module: "dashboard", actions: ["view", "export", "print"] },
        { module: "platform_home", actions: ["view"] },
        { module: "cashier_journal", actions: ["view", "view_list", "view_details", "create", "edit", "approve", "reject", "reopen", "print", "export", "sign", "view_signatures"] },
        { module: "cashier_performance", actions: ["view", "view_list", "view_details", "export", "print"] },
        { module: "operations", actions: ["view", "create", "edit", "delete"] },
        { module: "production", actions: ["view", "create", "edit"] },
        { module: "shifts", actions: ["view", "create", "edit", "delete"] },
        { module: "quality_control", actions: ["view", "create", "edit"] },
        { module: "inventory", actions: ["view", "create", "edit"] },
        { module: "asset_transfers", actions: ["view", "create", "edit", "approve"] },
        { module: "branch_employees", actions: ["view", "create", "edit"] },
        { module: "employee_reports", actions: ["view", "export", "print"] },
        { module: "reports", actions: ["view", "export", "print"] },
        { module: "event_pos", actions: ["view", "create", "edit", "delete"] },
      ],
      production_manager: [
        { module: "dashboard", actions: ["view", "export"] },
        { module: "platform_home", actions: ["view"] },
        { module: "production", actions: ["view", "create", "edit", "delete", "approve"] },
        { module: "daily_production", actions: ["view", "create", "edit", "delete"] },
        { module: "advanced_production", actions: ["view", "create", "edit", "delete"] },
        { module: "quality_control", actions: ["view", "create", "edit", "delete"] },
        { module: "products", actions: ["view", "create", "edit"] },
        { module: "operations", actions: ["view"] },
        { module: "inventory", actions: ["view"] },
        { module: "shifts", actions: ["view", "create", "edit", "delete"] },
      ],
      viewer: MODULE_GROUPS.flatMap(g => g.modules).filter(m => m !== "users").map(module => ({
        module,
        actions: ["view"],
      })),
      employee: [
        { module: "dashboard", actions: ["view", "export"] },
        { module: "platform_home", actions: ["view"] },
        { module: "inventory", actions: ["view", "create", "edit", "export"] },
        { module: "asset_transfers", actions: ["view", "create", "edit", "export"] },
        { module: "reports", actions: ["view", "export"] },
      ],
    };
    
    const template = templates[templateId];
    if (!template) return;
    
    const newState: PermissionState = {};
    for (const perm of template) {
      newState[perm.module] = [...perm.actions];
    }
    setPermissionState(newState);
    setAppliedTemplate(templateId);
    
    const templateInfo = ROLE_TEMPLATES.find(t => t.id === templateId);
    toast({
      title: "تم تطبيق القالب",
      description: `تم تطبيق صلاحيات ${templateInfo?.label || templateId}`,
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
      <div className="p-3 sm:p-4 md:p-6 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <SettingsBreadcrumb currentPage="إدارة المستخدمين" currentIcon={Users} />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
                إدارة المستخدمين
              </h1>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">إضافة وإدارة صلاحيات المستخدمين</p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 sm:h-9 text-xs sm:text-sm" data-testid="button-add-user">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                إضافة مستخدم
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة مستخدم جديد</DialogTitle>
                <DialogDescription>أدخل بيانات المستخدم الجديد</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">الاسم الأول</Label>
                    <Input
                      id="firstName"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                      className="h-11 sm:h-10"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">اسم العائلة</Label>
                    <Input
                      id="lastName"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                      className="h-11 sm:h-10"
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
                    className="text-left h-11 sm:h-10"
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
                    className="text-left h-11 sm:h-10"
                    dir="ltr"
                    required
                    autoComplete="new-password"
                    data-testid="input-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">الصلاحية</Label>
                  <Select value={newUser.role} onValueChange={(role) => setNewUser({ ...newUser, role })}>
                    <SelectTrigger className="h-11 sm:h-10" data-testid="select-role">
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
                <div className="space-y-2">
                  <Label>الفروع المسموحة</Label>
                  <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        id="new-all-branches"
                        checked={newUser.branchIds.length === branches.length && branches.length > 0}
                        onCheckedChange={(checked) => {
                          setNewUser({ ...newUser, branchIds: checked ? branches.map(b => b.id) : [] });
                        }}
                        data-testid="checkbox-new-all-branches"
                      />
                      <label htmlFor="new-all-branches" className="text-sm font-medium text-green-700 cursor-pointer">🌐 جميع الفروع</label>
                    </div>
                    {branches.map((branch) => (
                      <div key={branch.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`new-branch-${branch.id}`}
                          checked={newUser.branchIds.includes(branch.id)}
                          onCheckedChange={(checked) => {
                            setNewUser({
                              ...newUser,
                              branchIds: checked
                                ? [...newUser.branchIds, branch.id]
                                : newUser.branchIds.filter(id => id !== branch.id),
                            });
                          }}
                          data-testid={`checkbox-new-branch-${branch.id}`}
                        />
                        <label htmlFor={`new-branch-${branch.id}`} className="text-sm cursor-pointer">{branch.name}</label>
                      </div>
                    ))}
                    {branches.length === 0 && <p className="text-xs text-muted-foreground">لا توجد فروع</p>}
                  </div>
                  {newUser.branchIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">تم اختيار {newUser.branchIds.length} فرع</p>
                  )}
                </div>
                <Button type="submit" className="w-full h-11 sm:h-9" disabled={createUserMutation.isPending} data-testid="button-submit-user">
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

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {ROLES.map((role) => {
            const count = users.filter((u) => u.role === role.value).length;
            return (
              <Card key={role.value}>
                <CardHeader className="pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
                  <CardTitle className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-lg">
                    <role.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {role.label}
                  </CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs md:text-sm hidden sm:block">{role.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                  <p className="text-lg sm:text-2xl md:text-3xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            </div>
            
            {/* Search and Filters */}
            <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث بالاسم أو اسم المستخدم..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pr-10 h-11"
                      data-testid="input-search-users"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Branch Filter */}
                <div className="w-full lg:w-48">
                  <Select value={filterBranch} onValueChange={(value) => { setFilterBranch(value); setCurrentPage(1); }}>
                    <SelectTrigger className="h-11" data-testid="filter-branch">
                      <SelectValue placeholder="الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      <SelectItem value="no_branch">بدون فرع</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Role Filter */}
                <div className="w-full lg:w-40">
                  <Select value={filterRole} onValueChange={(value) => { setFilterRole(value); setCurrentPage(1); }}>
                    <SelectTrigger className="h-11" data-testid="filter-role">
                      <SelectValue placeholder="الصلاحية" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الصلاحيات</SelectItem>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Clear Filters */}
                {(searchQuery || filterBranch !== "all" || filterRole !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 whitespace-nowrap"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterBranch("all");
                      setFilterRole("all");
                      setCurrentPage(1);
                    }}
                    data-testid="btn-clear-filters"
                  >
                    <X className="h-4 w-4 ml-1" />
                    مسح الفلاتر
                  </Button>
                )}
              </div>
              
              {/* Active Filters Summary */}
              {(searchQuery || filterBranch !== "all" || filterRole !== "all") && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span>الفلاتر النشطة:</span>
                  {searchQuery && (
                    <Badge variant="secondary">بحث: {searchQuery}</Badge>
                  )}
                  {filterBranch !== "all" && (
                    <Badge variant="secondary">
                      الفرع: {filterBranch === "no_branch" ? "بدون فرع" : branches.find(b => b.id === filterBranch)?.name || filterBranch}
                    </Badge>
                  )}
                  {filterRole !== "all" && (
                    <Badge variant="secondary">
                      الصلاحية: {ROLES.find(r => r.value === filterRole)?.label || filterRole}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              // Apply filters
              const filteredUsers = users.filter(user => {
                // Search filter
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
                  const username = (user.username || '').toLowerCase();
                  if (!fullName.includes(query) && !username.includes(query)) {
                    return false;
                  }
                }
                // Branch filter
                if (filterBranch !== "all") {
                  if (filterBranch === "no_branch") {
                    if (user.branchId) return false;
                  } else {
                    if (user.branchId !== filterBranch) return false;
                  }
                }
                // Role filter
                if (filterRole !== "all" && user.role !== filterRole) {
                  return false;
                }
                return true;
              });
              
              const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
              const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
              
              return (
                <>
                  {/* Results count */}
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      عرض {paginatedUsers.length} من {filteredUsers.length} مستخدم
                      {filteredUsers.length !== users.length && ` (من إجمالي ${users.length})`}
                    </p>
                  </div>
                  
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right font-semibold text-xs sm:text-sm">المستخدم</TableHead>
                          <TableHead className="text-right font-semibold text-xs sm:text-sm hidden md:table-cell">اسم المستخدم</TableHead>
                          <TableHead className="text-right font-semibold text-xs sm:text-sm hidden lg:table-cell">الفرع</TableHead>
                          <TableHead className="text-right font-semibold text-xs sm:text-sm hidden xl:table-cell">تاريخ التسجيل</TableHead>
                          <TableHead className="text-right font-semibold text-xs sm:text-sm">الصلاحية</TableHead>
                          <TableHead className="text-center font-semibold text-xs sm:text-sm">الحالة</TableHead>
                          <TableHead className="text-right font-semibold text-xs sm:text-sm">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              {users.length === 0 ? "لا يوجد مستخدمين" : "لا توجد نتائج مطابقة للبحث"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                              <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                              <AvatarFallback className="text-xs">{user.firstName?.[0] || user.phone?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium text-xs sm:text-sm">
                                {user.firstName || user.lastName 
                                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                  : 'مستخدم'
                                }
                              </span>
                              {user.id === currentUser?.id && (
                                <Badge variant="outline" className="mr-2 text-[10px] sm:text-xs">أنت</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs hidden md:table-cell" dir="ltr">{user.username || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs sm:text-sm hidden lg:table-cell">
                          {user.branchId === "all_branches" ? "🌐 جميع الفروع" : user.branchId ? branches.find(b => b.id === user.branchId)?.name || user.branchId : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs hidden xl:table-cell">{formatDate(user.createdAt)}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ userId: user.id, role })}
                            disabled={user.id === currentUser?.id}
                          >
                            <SelectTrigger className="w-32 h-11 sm:h-10" data-testid={`select-role-${user.id}`}>
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
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={user.isActive === "active"}
                              onCheckedChange={(checked) => {
                                if (user.id !== currentUser?.id) {
                                  toggleUserStatusMutation.mutate({
                                    userId: user.id,
                                    isActive: checked ? "active" : "inactive"
                                  });
                                }
                              }}
                              disabled={user.id === currentUser?.id || toggleUserStatusMutation.isPending}
                              data-testid={`switch-status-${user.id}`}
                            />
                            <span className={`text-xs font-medium ${user.isActive === "active" ? "text-green-600" : "text-red-500"}`}>
                              {user.isActive === "active" ? "مفعّل" : "معطّل"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-amber-600 hover:text-amber-700 h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => openEditDialog(user)}
                              data-testid={`button-edit-${user.id}`}
                              title="تعديل البيانات"
                            >
                              <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-purple-600 hover:text-purple-700 h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
                              onClick={() => setResetPasswordUser(user)}
                              disabled={user.id === currentUser?.id}
                              data-testid={`button-reset-password-${user.id}`}
                              title="إعادة تعيين كلمة المرور"
                            >
                              <KeyRound className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:text-blue-700 h-7 w-7 sm:h-8 sm:w-8 hidden md:flex"
                              onClick={() => openPermissionsDialog(user)}
                              data-testid={`button-permissions-${user.id}`}
                              title="إدارة الصلاحيات"
                            >
                              <Settings2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => setDeleteConfirmUser(user)}
                              disabled={user.id === currentUser?.id || deleteUserMutation.isPending}
                              data-testid={`button-delete-${user.id}`}
                              title="حذف المستخدم"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                        </TableBody>
                      </Table>
                    </div>
                    {totalPages > 1 && (
                      <TablePagination
                        currentPage={currentPage}
                        totalItems={filteredUsers.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                      />
                    )}
                  </>
                );
              })()}
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
              <div className="space-y-3">
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
                  <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                    {getPermissionCount()} صلاحية محددة
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground ml-2">قوالب جاهزة:</span>
                  {ROLE_TEMPLATES.map(template => (
                    <Button
                      key={template.id}
                      variant={appliedTemplate === template.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => applyCustomTemplate(template.id)}
                      className="text-xs"
                      data-testid={`button-template-${template.id}`}
                    >
                      <span className="ml-1">{template.icon}</span>
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-xs bg-muted/50 p-2 rounded-md">
                <span className="font-medium text-muted-foreground">دليل الألوان:</span>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span>صلاحية مباشرة</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <Lock className="w-3 h-3 text-blue-500" />
                  <span>موروثة من الدور</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <Unlock className="w-3 h-3 text-amber-500" />
                  <span>منحت بتجاوز</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <Lock className="w-3 h-3 text-red-500" />
                  <span>محظورة بتجاوز</span>
                </div>
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
                        MODULE_ACTIONS.map(action => {
                          const allModules = MODULE_GROUPS.flatMap(g => g.modules);
                          const allHaveAction = allModules.every(m => (permissionState[m] || []).includes(action));
                          return (
                            <TableHead key={action} className="text-center w-20">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs">{ACTION_LABELS[action]}</span>
                                <Checkbox
                                  checked={allHaveAction}
                                  onCheckedChange={() => toggleAllForAction(action)}
                                  className="h-3 w-3"
                                  data-testid={`checkbox-all-${action}`}
                                />
                              </div>
                            </TableHead>
                          );
                        })
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
                            <div className="flex items-center gap-3">
                              {selectedUser?.role !== "viewer" && (
                                <Checkbox
                                  checked={group.modules.every(m => 
                                    MODULE_ACTIONS.every(a => (permissionState[m] || []).includes(a))
                                  )}
                                  onCheckedChange={() => toggleAllForCategory(group.modules)}
                                  className="h-4 w-4"
                                  data-testid={`checkbox-category-${group.label}`}
                                />
                              )}
                              <span>{group.label}</span>
                              <span className="text-xs text-muted-foreground font-normal">
                                ({group.modules.reduce((sum, m) => sum + (permissionState[m] || []).length, 0)} صلاحية)
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-amber-50/50 sticky top-0">
                          <TableCell className="text-right font-semibold text-xs text-gray-600">الوحدة</TableCell>
                          {selectedUser?.role === "viewer" ? (
                            <TableCell className="text-center font-semibold text-xs text-gray-600">
                              {ACTION_LABELS["view"]}
                            </TableCell>
                          ) : (
                            MODULE_ACTIONS.map(action => (
                              <TableCell key={action} className="text-center font-semibold text-xs text-gray-600">
                                {ACTION_LABELS[action]}
                              </TableCell>
                            ))
                          )}
                          {selectedUser?.role !== "viewer" && (
                            <TableCell className="text-center font-semibold text-xs text-gray-600">الكل</TableCell>
                          )}
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
                                  {(() => {
                                    const source = getPermissionSource(module, "view");
                                    const sourceInfo = getSourceInfo(source?.source);
                                    const isChecked = currentActions.includes("view");
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="relative inline-flex items-center justify-center">
                                              <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={() => toggleAction(module, "view")}
                                                data-testid={`checkbox-${module}-view`}
                                              />
                                              {source && isChecked && (
                                                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${sourceInfo.color}`} />
                                              )}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            <div className="flex items-center gap-1">
                                              {sourceInfo.icon && <sourceInfo.icon className="w-3 h-3" />}
                                              <span>{sourceInfo.label}</span>
                                              {source?.roleName && <span>({source.roleName})</span>}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })()}
                                </TableCell>
                              ) : (
                                MODULE_ACTIONS.map(action => {
                                  const source = getPermissionSource(module, action);
                                  const sourceInfo = getSourceInfo(source?.source);
                                  const isChecked = currentActions.includes(action);
                                  return (
                                    <TableCell key={action} className="text-center">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="relative inline-flex items-center justify-center">
                                              <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={() => toggleAction(module, action)}
                                                data-testid={`checkbox-${module}-${action}`}
                                              />
                                              {source && isChecked && (
                                                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${sourceInfo.color}`} />
                                              )}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            <div className="flex items-center gap-1">
                                              {sourceInfo.icon && <sourceInfo.icon className="w-3 h-3" />}
                                              <span>{sourceInfo.label}</span>
                                              {source?.roleName && <span>({source.roleName})</span>}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </TableCell>
                                  );
                                })
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              <Label htmlFor="editUsername">اسم المستخدم</Label>
              <Input
                id="editUsername"
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                className="text-left"
                dir="ltr"
                data-testid="input-edit-username"
              />
              <p className="text-xs text-muted-foreground">اسم المستخدم الذي يستخدم لتسجيل الدخول</p>
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
                autoComplete="new-password"
                data-testid="input-edit-password"
              />
              <p className="text-xs text-muted-foreground">اتركها فارغة إذا لم ترد تغيير كلمة المرور</p>
            </div>
            <div className="space-y-2">
              <Label>الفروع المسموحة</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    id="edit-all-branches"
                    checked={editUser.branchIds.length === branches.length && branches.length > 0}
                    onCheckedChange={(checked) => {
                      setEditUser({ ...editUser, branchIds: checked ? branches.map(b => b.id) : [] });
                    }}
                    data-testid="checkbox-edit-all-branches"
                  />
                  <label htmlFor="edit-all-branches" className="text-sm font-medium text-green-700 cursor-pointer">🌐 جميع الفروع</label>
                </div>
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-branch-${branch.id}`}
                      checked={editUser.branchIds.includes(branch.id)}
                      onCheckedChange={(checked) => {
                        setEditUser({
                          ...editUser,
                          branchIds: checked
                            ? [...editUser.branchIds, branch.id]
                            : editUser.branchIds.filter(id => id !== branch.id),
                        });
                      }}
                      data-testid={`checkbox-edit-branch-${branch.id}`}
                    />
                    <label htmlFor={`edit-branch-${branch.id}`} className="text-sm cursor-pointer">{branch.name}</label>
                  </div>
                ))}
              </div>
              {editUser.branchIds.length > 0 && (
                <p className="text-xs text-muted-foreground">تم اختيار {editUser.branchIds.length} فرع</p>
              )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">تأكيد حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف المستخدم <strong>{deleteConfirmUser?.firstName} {deleteConfirmUser?.lastName}</strong> ({deleteConfirmUser?.username})؟
              <br />
              <span className="text-destructive">هذا الإجراء لا يمكن التراجع عنه.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "حذف المستخدم"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              إعادة تعيين كلمة المرور
            </DialogTitle>
            <DialogDescription>
              إعادة تعيين كلمة المرور للمستخدم: <strong>{resetPasswordUser?.firstName} {resetPasswordUser?.lastName}</strong> ({resetPasswordUser?.username})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-sm">
              <Shield className="w-4 h-4 inline-block ml-2" />
              كلمات المرور مشفرة ولا يمكن عرضها. يمكنك فقط إعادة تعيينها بكلمة مرور جديدة.
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
                className="text-left"
                dir="ltr"
                autoComplete="new-password"
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">يجب أن تكون كلمة المرور قوية وآمنة</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setResetPasswordUser(null); setNewPassword(""); }}
              data-testid="button-cancel-reset-password"
            >
              إلغاء
            </Button>
            <Button 
              onClick={() => {
                if (resetPasswordUser && newPassword.trim()) {
                  resetPasswordMutation.mutate({ userId: resetPasswordUser.id, password: newPassword });
                }
              }}
              disabled={!newPassword.trim() || resetPasswordMutation.isPending}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "تعيين كلمة المرور"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
