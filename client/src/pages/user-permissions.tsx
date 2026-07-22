import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Loader2, ArrowRight, Shield, Search, CheckSquare, Eye, XSquare, Copy,
  History, SlidersHorizontal, ListChecks, Save, RotateCcw, Trash2, Plus, Lock, Unlock,
} from "lucide-react";
import {
  MODULE_ACTIONS,
  MODULE_LABELS as SHARED_MODULE_LABELS,
  ACTION_LABELS as SHARED_ACTION_LABELS,
  ROLE_PERMISSION_TEMPLATES,
  getGroupedModules,
} from "@shared/schema";

const MODULE_LABELS: Record<string, string> = {
  ...SHARED_MODULE_LABELS,
  assets: "الأصول",
  projects: "المشاريع",
};
const ACTION_LABELS: Record<string, string> = SHARED_ACTION_LABELS;

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  viewer: "مشاهد",
  attendance_clerk: "مسجل حضور",
  hr_manager: "مدير موارد بشرية",
  hr_specialist: "أخصائي موارد بشرية",
  financial_manager: "مدير مالي",
  financial_accountant: "محاسب مالي",
  operations_manager: "مدير عمليات",
  branch_manager: "مدير فرع",
  shareholder: "مساهم",
  employee: "موظف",
  user: "مستخدم",
};

type PermissionSourceType = "direct" | "role" | "override_grant" | "override_deny";

interface PermissionWithSource {
  module: string;
  action: string;
  source: PermissionSourceType;
  roleName?: string;
  isActive: boolean;
}

interface PermissionState {
  [module: string]: string[];
}

interface EffectivePermissionsResponse {
  userId: string;
  username: string;
  firstName: string | null;
  role: string;
  note: string | null;
  permissions: { module: string; actions: { action: string; sources: string[] }[] }[];
}

interface AuditLog {
  id: number;
  targetUserId: string;
  changedByUserId: string;
  action: string;
  module: string | null;
  oldActions: string[] | null;
  newActions: string[] | null;
  templateApplied: string | null;
  createdAt: string;
  targetUserName?: string;
  changedByUserName?: string;
}

interface OverrideRow {
  id: number;
  userId: string;
  permissionId: number;
  allow: boolean;
  reason: string | null;
}

interface RbacPermission {
  id: number;
  module: string;
  action: string;
}

interface SafeUser {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  branchId: string | null;
  isActive: boolean;
}

const SMART_INCENTIVES_SUBMODULES = [
  "smart_incentives_settings",
  "smart_incentives_challenges",
  "smart_incentives_commissions",
  "smart_incentives_bonus",
  "smart_incentives_wallet",
  "smart_incentives_statements",
];

const ROLE_TEMPLATES = [
  { id: "cashier", label: "كاشير", icon: "💰" },
  { id: "supervisor", label: "مشرف", icon: "👨‍💼" },
  { id: "branch_manager", label: "مدير فرع", icon: "🏪" },
  { id: "production_manager", label: "مدير إنتاج", icon: "🏭" },
  { id: "viewer", label: "مشاهد فقط", icon: "👁️" },
  { id: "employee", label: "موظف عادي", icon: "👤" },
];

const CUSTOM_TEMPLATES: Record<string, { module: string; actions: string[] }[]> = {
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
  viewer: getGroupedModules().flatMap((g) => g.modules).filter((m) => m !== "users").map((module) => ({ module, actions: ["view"] })),
  employee: [
    { module: "dashboard", actions: ["view", "export"] },
    { module: "platform_home", actions: ["view"] },
    { module: "inventory", actions: ["view", "create", "edit", "export"] },
    { module: "asset_transfers", actions: ["view", "create", "edit", "export"] },
    { module: "reports", actions: ["view", "export"] },
  ],
};

const SOURCE_META: Record<string, { color: string; label: string }> = {
  direct: { color: "bg-green-500", label: "صلاحية مباشرة" },
  role: { color: "bg-blue-500", label: "موروثة من الدور" },
  override_grant: { color: "bg-amber-500", label: "منحت بتجاوز" },
  override_deny: { color: "bg-red-500", label: "محظورة بتجاوز" },
};

const EFFECTIVE_SOURCE_META: Record<string, { label: string; className: string }> = {
  admin: { label: "مدير النظام", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  role_auto: { label: "تلقائي من الدور", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  direct: { label: "منح يدوي / قالب", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
};

const AUDIT_ACTION_META: Record<string, { label: string; className: string }> = {
  grant: { label: "منح", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  revoke: { label: "سحب", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  modify: { label: "تعديل", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  apply_template: { label: "تطبيق قالب", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  role_change: { label: "تغيير دور", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  status_change: { label: "تغيير حالة", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
};

const STATUS_VALUE_LABELS: Record<string, string> = {
  active: "نشط",
  inactive: "موقوف",
};

function formatAuditValue(action: string, values: string[] | null): string {
  if (!values || values.length === 0) return "—";
  if (action === "role_change") return values.map((v) => ROLE_LABELS[v] || v).join("، ");
  if (action === "status_change") return values.map((v) => STATUS_VALUE_LABELS[v] || v).join("، ");
  return values.map((v) => ACTION_LABELS[v] || v).join("، ");
}

function userDisplayName(u: SafeUser | undefined | null): string {
  if (!u) return "";
  const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return full || u.username;
}

export default function UserPermissionsPage() {
  const [, params] = useRoute("/user-permissions/:userId");
  const userId = params?.userId || "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { canEdit } = usePermissions();
  const canWrite = isAdmin || canEdit("users");

  const [activeTab, setActiveTab] = useState("matrix");
  const [permissionState, setPermissionState] = useState<PermissionState>({});
  const [initialState, setInitialState] = useState<PermissionState>({});
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const [moduleSearch, setModuleSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<"all" | "granted" | "empty">("all");
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [copySourceUserId, setCopySourceUserId] = useState("");
  const [effectiveSearch, setEffectiveSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  // override form
  const [ovModule, setOvModule] = useState("");
  const [ovPermissionId, setOvPermissionId] = useState("");
  const [ovAllow, setOvAllow] = useState("true");
  const [ovReason, setOvReason] = useState("");

  const { data: users = [] } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });
  const targetUser = users.find((u) => u.id === userId);

  const { data: currentPermissions, isLoading: permsLoading } = useQuery<{ module: string; actions: string[] }[]>({
    queryKey: ["/api/users", userId, "permissions"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/permissions`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (currentPermissions) {
      const state: PermissionState = {};
      for (const perm of currentPermissions) state[perm.module] = [...perm.actions];
      setPermissionState(state);
      setInitialState(JSON.parse(JSON.stringify(state)));
      setAppliedTemplate(null);
    }
  }, [currentPermissions]);

  const { data: permissionsWithSources = [] } = useQuery<PermissionWithSource[]>({
    queryKey: ["/api/users", userId, "permissions-with-sources"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/permissions-with-sources`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const sourcesMap = useMemo(() => {
    const m = new Map<string, PermissionWithSource>();
    for (const p of permissionsWithSources) m.set(`${p.module}:${p.action}`, p);
    return m;
  }, [permissionsWithSources]);

  const { data: effectivePerms, isLoading: effectiveLoading } = useQuery<EffectivePermissionsResponse>({
    queryKey: ["/api/rbac/users", userId, "effective-permissions-detailed"],
    queryFn: async () => {
      const res = await fetch(`/api/rbac/users/${userId}/effective-permissions-detailed`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!userId && activeTab === "effective",
  });

  const { data: overrides = [] } = useQuery<OverrideRow[]>({
    queryKey: ["/api/rbac/users", userId, "overrides"],
    queryFn: async () => {
      const res = await fetch(`/api/rbac/users/${userId}/overrides`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!userId && activeTab === "overrides",
  });

  const { data: rbacPermissions = [] } = useQuery<RbacPermission[]>({
    queryKey: ["/api/rbac/permissions"],
    queryFn: async () => {
      const res = await fetch(`/api/rbac/permissions`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: activeTab === "overrides",
  });

  const permById = useMemo(() => {
    const m = new Map<number, RbacPermission>();
    for (const p of rbacPermissions) m.set(p.id, p);
    return m;
  }, [rbacPermissions]);

  const ovModules = useMemo(() => {
    const set = new Set(rbacPermissions.map((p) => p.module));
    return Array.from(set).sort((a, b) => (MODULE_LABELS[a] || a).localeCompare(MODULE_LABELS[b] || b, "ar"));
  }, [rbacPermissions]);

  const { data: auditData, isLoading: auditLoading } = useQuery<{ total: number; logs: AuditLog[] }>({
    queryKey: ["/api/permission-audit-logs", userId, auditActionFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ userId, limit: "200" });
      if (auditActionFilter !== "all") p.set("action", auditActionFilter);
      const res = await fetch(`/api/permission-audit-logs?${p.toString()}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!userId && activeTab === "audit",
  });

  // ------- diff -------
  const diff = useMemo(() => {
    const added: { module: string; action: string }[] = [];
    const removed: { module: string; action: string }[] = [];
    const modules = new Set([...Object.keys(initialState), ...Object.keys(permissionState)]);
    for (const m of Array.from(modules)) {
      const before = new Set(initialState[m] || []);
      const after = new Set(permissionState[m] || []);
      for (const a of Array.from(after)) if (!before.has(a)) added.push({ module: m, action: a });
      for (const a of Array.from(before)) if (!after.has(a)) removed.push({ module: m, action: a });
    }
    return { added, removed };
  }, [initialState, permissionState]);
  const changeCount = diff.added.length + diff.removed.length;

  // ------- matrix helpers -------
  const toggleAction = (module: string, action: string) => {
    if (!canWrite) return;
    setPermissionState((prev) => {
      const current = prev[module] || [];
      const has = current.includes(action);
      const newState = { ...prev };
      newState[module] = has ? current.filter((a) => a !== action) : [...current, action];
      if (module === "incentives") {
        for (const sub of SMART_INCENTIVES_SUBMODULES) {
          const subActions = newState[sub] || [];
          newState[sub] = has ? subActions.filter((a) => a !== action) : subActions.includes(action) ? subActions : [...subActions, action];
        }
      }
      return newState;
    });
  };

  const setRow = (module: string, actions: string[]) => {
    if (!canWrite) return;
    setPermissionState((prev) => {
      const newState = { ...prev, [module]: [...actions] };
      if (module === "incentives") {
        for (const sub of SMART_INCENTIVES_SUBMODULES) newState[sub] = [...actions];
      }
      return newState;
    });
  };

  const toggleAllForAction = (action: string, modules: string[]) => {
    if (!canWrite) return;
    setPermissionState((prev) => {
      const allHave = modules.every((m) => (prev[m] || []).includes(action));
      const newState = { ...prev };
      for (const m of modules) {
        const cur = newState[m] || [];
        newState[m] = allHave ? cur.filter((a) => a !== action) : cur.includes(action) ? cur : [...cur, action];
      }
      if (modules.includes("incentives")) {
        for (const sub of SMART_INCENTIVES_SUBMODULES) {
          const cur = newState[sub] || [];
          newState[sub] = allHave ? cur.filter((a) => a !== action) : cur.includes(action) ? cur : [...cur, action];
        }
      }
      return newState;
    });
  };

  const toggleAllForCategory = (modules: string[]) => {
    if (!canWrite) return;
    setPermissionState((prev) => {
      const allSelected = modules.every((m) => MODULE_ACTIONS.every((a) => (prev[m] || []).includes(a)));
      const newState = { ...prev };
      for (const m of modules) newState[m] = allSelected ? [] : [...MODULE_ACTIONS];
      if (modules.includes("incentives")) {
        for (const sub of SMART_INCENTIVES_SUBMODULES) newState[sub] = allSelected ? [] : [...MODULE_ACTIONS];
      }
      return newState;
    });
  };

  const applyCustomTemplate = (templateId: string) => {
    if (!canWrite) return;
    const template = CUSTOM_TEMPLATES[templateId];
    if (!template) return;
    const newState: PermissionState = {};
    for (const perm of template) newState[perm.module] = [...perm.actions];
    setPermissionState(newState);
    setAppliedTemplate(templateId);
    const info = ROLE_TEMPLATES.find((t) => t.id === templateId);
    toast({ title: "تم تطبيق القالب", description: `تم تطبيق صلاحيات ${info?.label || templateId} — راجع ثم احفظ` });
  };

  const applyRoleTemplate = () => {
    if (!canWrite || !targetUser) return;
    const template = ROLE_PERMISSION_TEMPLATES[targetUser.role];
    if (!template) {
      toast({ title: "لا يوجد قالب افتراضي لهذا الدور", variant: "destructive" });
      return;
    }
    const newState: PermissionState = {};
    for (const perm of template) newState[perm.module] = [...perm.actions];
    setPermissionState(newState);
    setAppliedTemplate(targetUser.role);
    toast({ title: "تم تطبيق القالب الافتراضي للدور", description: "راجع التغييرات ثم احفظ" });
  };

  const copyFromUser = async () => {
    if (!canWrite || !copySourceUserId) return;
    try {
      const res = await fetch(`/api/users/${copySourceUserId}/permissions`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: { module: string; actions: string[] }[] = await res.json();
      const newState: PermissionState = {};
      for (const perm of data) newState[perm.module] = [...perm.actions];
      setPermissionState(newState);
      setAppliedTemplate(null);
      const src = users.find((u) => u.id === copySourceUserId);
      toast({ title: "تم نسخ الصلاحيات", description: `نُسخت صلاحيات ${userDisplayName(src)} — راجع ثم احفظ` });
    } catch {
      toast({ title: "فشل نسخ الصلاحيات", variant: "destructive" });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions = Object.entries(permissionState)
        .filter(([, actions]) => actions.length > 0)
        .map(([module, actions]) => ({ module, actions }));
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions, templateApplied: appliedTemplate }),
      });
      if (!res.ok) throw new Error("save failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الصلاحيات بنجاح" });
      setIsDiffOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "permissions-with-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users", userId, "effective-permissions-detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permission-audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-permissions"] });
    },
    onError: () => toast({ title: "فشل حفظ الصلاحيات", variant: "destructive" }),
  });

  const createOverrideMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rbac/users/${userId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId: parseInt(ovPermissionId), allow: ovAllow === "true", reason: ovReason || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "فشل إنشاء الاستثناء");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إضافة الاستثناء" });
      setOvModule(""); setOvPermissionId(""); setOvReason(""); setOvAllow("true");
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users", userId, "overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "permissions-with-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permission-audit-logs"] });
    },
    onError: (e: any) => toast({ title: e?.message || "فشل إنشاء الاستثناء", variant: "destructive" }),
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (overrideId: number) => {
      const res = await fetch(`/api/rbac/users/${userId}/overrides/${overrideId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "فشل حذف الاستثناء");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حذف الاستثناء" });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users", userId, "overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "permissions-with-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permission-audit-logs"] });
    },
    onError: (e: any) => toast({ title: e?.message || "فشل حذف الاستثناء", variant: "destructive" }),
  });

  // ------- visible groups (search + filter) -------
  const visibleGroups = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    return getGroupedModules()
      .map((g) => ({
        label: g.label,
        modules: g.modules.filter((m) => {
          if (q && !((MODULE_LABELS[m] || m).toLowerCase().includes(q) || m.toLowerCase().includes(q))) return false;
          const granted = (permissionState[m] || []).length > 0;
          if (moduleFilter === "granted" && !granted) return false;
          if (moduleFilter === "empty" && granted) return false;
          return true;
        }),
      }))
      .filter((g) => g.modules.length > 0);
  }, [moduleSearch, moduleFilter, permissionState]);

  const totalGranted = useMemo(
    () => Object.values(permissionState).reduce((n, a) => n + a.length, 0),
    [permissionState],
  );

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!userId || (users.length > 0 && !targetUser)) {
    return (
      <Layout>
        <div className="p-8 text-center space-y-4">
          <p className="text-muted-foreground">المستخدم غير موجود</p>
          <Button variant="outline" onClick={() => navigate("/users")} data-testid="button-back-users">
            <ArrowRight className="w-4 h-4 ml-2" /> العودة للمستخدمين
          </Button>
        </div>
      </Layout>
    );
  }

  const filteredEffective = (effectivePerms?.permissions || []).filter((p) => {
    const q = effectiveSearch.trim().toLowerCase();
    if (!q) return true;
    return (MODULE_LABELS[p.module] || p.module).toLowerCase().includes(q) || p.module.toLowerCase().includes(q);
  });

  return (
    <Layout>
      <div className="space-y-4 pb-24" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/users")} data-testid="button-back">
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-page-title">
                إدارة صلاحيات: {userDisplayName(targetUser)}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span data-testid="text-username">@{targetUser?.username}</span>
                <Badge variant="secondary" data-testid="badge-role">{ROLE_LABELS[targetUser?.role || ""] || targetUser?.role}</Badge>
                {targetUser && (
                  <Badge variant={targetUser.isActive ? "default" : "destructive"} data-testid="badge-status">
                    {targetUser.isActive ? "نشط" : "موقوف"}
                  </Badge>
                )}
                <Badge variant="outline" data-testid="badge-count">{totalGranted} صلاحية محددة</Badge>
              </div>
            </div>
          </div>
          {targetUser?.role === "admin" && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
              مدير النظام — يملك كل الصلاحيات تلقائيًا بغض النظر عن المصفوفة
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="matrix" data-testid="tab-matrix"><ListChecks className="w-4 h-4 ml-1" /> مصفوفة الصلاحيات</TabsTrigger>
            <TabsTrigger value="effective" data-testid="tab-effective"><Eye className="w-4 h-4 ml-1" /> الصلاحيات الفعلية</TabsTrigger>
            <TabsTrigger value="overrides" data-testid="tab-overrides"><SlidersHorizontal className="w-4 h-4 ml-1" /> الاستثناءات</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit"><History className="w-4 h-4 ml-1" /> سجل التدقيق</TabsTrigger>
          </TabsList>

          {/* ------------------- MATRIX ------------------- */}
          <TabsContent value="matrix" className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                {/* Templates + copy */}
                {canWrite && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">قوالب جاهزة:</span>
                    {ROLE_TEMPLATES.map((t) => (
                      <Button key={t.id} variant="outline" size="sm" onClick={() => applyCustomTemplate(t.id)} data-testid={`button-template-${t.id}`}>
                        <span className="ml-1">{t.icon}</span> {t.label}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={applyRoleTemplate} data-testid="button-role-template">
                      <RotateCcw className="w-3.5 h-3.5 ml-1" /> القالب الافتراضي للدور
                    </Button>
                    <div className="flex items-center gap-1 mr-auto">
                      <Select value={copySourceUserId} onValueChange={setCopySourceUserId}>
                        <SelectTrigger className="w-52 h-8" data-testid="select-copy-user">
                          <SelectValue placeholder="نسخ صلاحيات من مستخدم..." />
                        </SelectTrigger>
                        <SelectContent>
                          {users.filter((u) => u.id !== userId).map((u) => (
                            <SelectItem key={u.id} value={u.id}>{userDisplayName(u)} (@{u.username})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="secondary" size="sm" disabled={!copySourceUserId} onClick={copyFromUser} data-testid="button-copy-permissions">
                        <Copy className="w-3.5 h-3.5 ml-1" /> نسخ
                      </Button>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">دليل الألوان:</span>
                  {Object.entries(SOURCE_META).map(([k, m]) => (
                    <span key={k} className="flex items-center gap-1">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${m.color}`} /> {m.label}
                    </span>
                  ))}
                </div>

                {/* Search + filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-56">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      placeholder="ابحث عن وحدة..."
                      className="pr-9"
                      data-testid="input-module-search"
                    />
                  </div>
                  <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as any)}>
                    <SelectTrigger className="w-44" data-testid="select-module-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الوحدات</SelectItem>
                      <SelectItem value="granted">الممنوحة فقط</SelectItem>
                      <SelectItem value="empty">الفارغة فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {permsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <TooltipProvider delayDuration={150}>
                    <table className="w-full text-sm border-collapse min-w-[1100px]">
                      <thead className="sticky top-0 z-20 bg-background shadow-sm">
                        <tr className="border-b">
                          <th className="text-right p-2 font-semibold min-w-44 sticky right-0 bg-background z-30">الوحدة</th>
                          {MODULE_ACTIONS.map((action) => (
                            <th key={action} className="p-1.5 text-center font-medium whitespace-nowrap">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs">{ACTION_LABELS[action] || action}</span>
                              </div>
                            </th>
                          ))}
                          {canWrite && <th className="p-1.5 text-center text-xs font-medium min-w-32">أدوات سريعة</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleGroups.map((group) => (
                          <GroupRows
                            key={group.label}
                            group={group}
                            permissionState={permissionState}
                            sourcesMap={sourcesMap}
                            canWrite={canWrite}
                            toggleAction={toggleAction}
                            setRow={setRow}
                            toggleAllForAction={toggleAllForAction}
                            toggleAllForCategory={toggleAllForCategory}
                          />
                        ))}
                        {visibleGroups.length === 0 && (
                          <tr><td colSpan={MODULE_ACTIONS.length + 2} className="p-8 text-center text-muted-foreground">لا توجد وحدات مطابقة</td></tr>
                        )}
                      </tbody>
                    </table>
                  </TooltipProvider>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ------------------- EFFECTIVE ------------------- */}
          <TabsContent value="effective" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4" /> الصلاحيات الفعلية (ما يعمل به النظام فعلًا بعد الدور والتجاوزات)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {effectivePerms?.note && (
                  <div className="text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md p-3">{effectivePerms.note}</div>
                )}
                <div className="relative max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={effectiveSearch} onChange={(e) => setEffectiveSearch(e.target.value)} placeholder="ابحث عن وحدة..." className="pr-9" data-testid="input-effective-search" />
                </div>
                {effectiveLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : filteredEffective.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد صلاحيات فعلية</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {filteredEffective.map((p) => (
                      <div key={p.module} className="border rounded-lg p-3" data-testid={`effective-module-${p.module}`}>
                        <div className="font-medium mb-2">{MODULE_LABELS[p.module] || p.module}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {p.actions.map((a) => (
                            <Tooltip key={a.action}>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="cursor-default">{ACTION_LABELS[a.action] || a.action}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="flex gap-1">
                                  {a.sources.map((s) => (
                                    <span key={s} className={`px-1.5 py-0.5 rounded text-xs ${EFFECTIVE_SOURCE_META[s]?.className || "bg-gray-100"}`}>
                                      {EFFECTIVE_SOURCE_META[s]?.label || s}
                                    </span>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------- OVERRIDES ------------------- */}
          <TabsContent value="overrides" className="space-y-4">
            {canWrite && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة استثناء</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">الوحدة</label>
                    <Select value={ovModule} onValueChange={(v) => { setOvModule(v); setOvPermissionId(""); }}>
                      <SelectTrigger className="w-48" data-testid="select-override-module"><SelectValue placeholder="اختر الوحدة" /></SelectTrigger>
                      <SelectContent>
                        {ovModules.map((m) => <SelectItem key={m} value={m}>{MODULE_LABELS[m] || m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">الإجراء</label>
                    <Select value={ovPermissionId} onValueChange={setOvPermissionId} disabled={!ovModule}>
                      <SelectTrigger className="w-40" data-testid="select-override-action"><SelectValue placeholder="الإجراء" /></SelectTrigger>
                      <SelectContent>
                        {rbacPermissions.filter((p) => p.module === ovModule).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{ACTION_LABELS[p.action] || p.action}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">النوع</label>
                    <Select value={ovAllow} onValueChange={setOvAllow}>
                      <SelectTrigger className="w-32" data-testid="select-override-allow"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">منح ✅</SelectItem>
                        <SelectItem value="false">منع ⛔</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 flex-1 min-w-52">
                    <label className="text-xs text-muted-foreground">السبب (اختياري)</label>
                    <Input value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="سبب الاستثناء..." data-testid="input-override-reason" />
                  </div>
                  <Button
                    disabled={!ovPermissionId || createOverrideMutation.isPending}
                    onClick={() => createOverrideMutation.mutate()}
                    data-testid="button-add-override"
                  >
                    {createOverrideMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />} إضافة
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">الاستثناءات الحالية ({overrides.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {overrides.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">لا توجد استثناءات لهذا المستخدم</p>
                ) : (
                  <div className="space-y-2">
                    {overrides.map((o) => {
                      const perm = permById.get(o.permissionId);
                      return (
                        <div key={o.id} className="flex items-center justify-between border rounded-lg p-3" data-testid={`override-row-${o.id}`}>
                          <div className="flex items-center gap-3">
                            {o.allow ? <Unlock className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-red-600" />}
                            <div>
                              <div className="font-medium text-sm">
                                {perm ? `${MODULE_LABELS[perm.module] || perm.module} — ${ACTION_LABELS[perm.action] || perm.action}` : `صلاحية #${o.permissionId}`}
                              </div>
                              {o.reason && <div className="text-xs text-muted-foreground">{o.reason}</div>}
                            </div>
                            <Badge className={o.allow ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}>
                              {o.allow ? "منح بتجاوز" : "منع بتجاوز"}
                            </Badge>
                          </div>
                          {canWrite && (
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => deleteOverrideMutation.mutate(o.id)}
                              disabled={deleteOverrideMutation.isPending}
                              data-testid={`button-delete-override-${o.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------- AUDIT ------------------- */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> سجل تدقيق صلاحيات هذا المستخدم</CardTitle>
                  <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                    <SelectTrigger className="w-44" data-testid="select-audit-action"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأنواع</SelectItem>
                      {Object.entries(AUDIT_ACTION_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : !auditData || auditData.logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد سجلات</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-right text-muted-foreground">
                          <th className="p-2">التاريخ</th>
                          <th className="p-2">بواسطة</th>
                          <th className="p-2">النوع</th>
                          <th className="p-2">الوحدة</th>
                          <th className="p-2">قبل</th>
                          <th className="p-2">بعد</th>
                          <th className="p-2">ملاحظة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditData.logs.map((log) => {
                          const meta = AUDIT_ACTION_META[log.action] || { label: log.action, className: "bg-gray-100 text-gray-800" };
                          return (
                            <tr key={log.id} className="border-b hover:bg-muted/40" data-testid={`audit-row-${log.id}`}>
                              <td className="p-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("ar-SA")}</td>
                              <td className="p-2">{log.changedByUserName || log.changedByUserId}</td>
                              <td className="p-2"><Badge className={meta.className}>{meta.label}</Badge></td>
                              <td className="p-2">{log.module ? MODULE_LABELS[log.module] || log.module : "—"}</td>
                              <td className="p-2 max-w-56 truncate" title={formatAuditValue(log.action, log.oldActions)}>{formatAuditValue(log.action, log.oldActions)}</td>
                              <td className="p-2 max-w-56 truncate" title={formatAuditValue(log.action, log.newActions)}>{formatAuditValue(log.action, log.newActions)}</td>
                              <td className="p-2 max-w-48 truncate" title={log.templateApplied || ""}>{log.templateApplied || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sticky save bar */}
        {canWrite && activeTab === "matrix" && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3" dir="rtl">
              <div className="text-sm">
                {changeCount === 0 ? (
                  <span className="text-muted-foreground">لا توجد تغييرات غير محفوظة</span>
                ) : (
                  <span className="font-medium">
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ml-2">{changeCount}</Badge>
                    تغيير غير محفوظ ({diff.added.length} إضافة، {diff.removed.length} إزالة)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={changeCount === 0}
                  onClick={() => { setPermissionState(JSON.parse(JSON.stringify(initialState))); setAppliedTemplate(null); }}
                  data-testid="button-reset-changes"
                >
                  <RotateCcw className="w-4 h-4 ml-1" /> تراجع
                </Button>
                <Button disabled={changeCount === 0} onClick={() => setIsDiffOpen(true)} data-testid="button-review-save">
                  <Save className="w-4 h-4 ml-1" /> مراجعة وحفظ
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Diff preview dialog */}
        <Dialog open={isDiffOpen} onOpenChange={setIsDiffOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>مراجعة التغييرات قبل الحفظ</DialogTitle>
              <DialogDescription>سيتم تسجيل هذه التغييرات في سجل التدقيق تلقائيًا.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {diff.added.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">صلاحيات ستُضاف ({diff.added.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {diff.added.map((d, i) => (
                      <Badge key={i} className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        + {MODULE_LABELS[d.module] || d.module}: {ACTION_LABELS[d.action] || d.action}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {diff.removed.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">صلاحيات ستُزال ({diff.removed.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {diff.removed.map((d, i) => (
                      <Badge key={i} className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        - {MODULE_LABELS[d.module] || d.module}: {ACTION_LABELS[d.action] || d.action}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {changeCount === 0 && <p className="text-muted-foreground text-sm">لا توجد تغييرات</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDiffOpen(false)} data-testid="button-cancel-save">إلغاء</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || changeCount === 0} data-testid="button-confirm-save">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />} تأكيد الحفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function GroupRows({
  group, permissionState, sourcesMap, canWrite,
  toggleAction, setRow, toggleAllForAction, toggleAllForCategory,
}: {
  group: { label: string; modules: string[] };
  permissionState: PermissionState;
  sourcesMap: Map<string, PermissionWithSource>;
  canWrite: boolean;
  toggleAction: (m: string, a: string) => void;
  setRow: (m: string, actions: string[]) => void;
  toggleAllForAction: (a: string, modules: string[]) => void;
  toggleAllForCategory: (modules: string[]) => void;
}) {
  const groupCount = group.modules.reduce((n, m) => n + (permissionState[m] || []).length, 0);
  return (
    <>
      <tr className="bg-muted/60 border-b">
        <td className="p-2 font-semibold sticky right-0 bg-muted/60 z-10" data-testid={`group-header-${group.label}`}>
          <div className="flex items-center gap-2">
            {canWrite && (
              <Checkbox
                checked={group.modules.every((m) => MODULE_ACTIONS.every((a) => (permissionState[m] || []).includes(a)))}
                onCheckedChange={() => toggleAllForCategory(group.modules)}
                data-testid={`checkbox-group-${group.label}`}
              />
            )}
            <span className="text-primary">{group.label}</span>
            <span className="text-xs text-muted-foreground">({groupCount} صلاحية)</span>
          </div>
        </td>
        {MODULE_ACTIONS.map((action) => (
          <td key={action} className="p-1.5 text-center">
            {canWrite && (
              <Checkbox
                checked={group.modules.every((m) => (permissionState[m] || []).includes(action))}
                onCheckedChange={() => toggleAllForAction(action, group.modules)}
                data-testid={`checkbox-group-${group.label}-${action}`}
              />
            )}
          </td>
        ))}
        {canWrite && <td />}
      </tr>
      {group.modules.map((module) => {
        const actions = permissionState[module] || [];
        return (
          <tr key={module} className="border-b hover:bg-muted/30">
            <td className="p-2 sticky right-0 bg-background z-10 font-medium whitespace-nowrap" data-testid={`row-module-${module}`}>
              {MODULE_LABELS[module] || module}
              {actions.length > 0 && <span className="text-xs text-muted-foreground mr-1">({actions.length})</span>}
            </td>
            {MODULE_ACTIONS.map((action) => {
              const checked = actions.includes(action);
              const source = sourcesMap.get(`${module}:${action}`);
              const meta = source ? SOURCE_META[source.source] : null;
              return (
                <td key={action} className="p-1.5 text-center">
                  <div className="relative inline-flex">
                    <Checkbox
                      checked={checked}
                      disabled={!canWrite}
                      onCheckedChange={() => toggleAction(module, action)}
                      data-testid={`checkbox-${module}-${action}`}
                    />
                    {meta && checked && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`absolute -top-1 -left-1 w-2 h-2 rounded-full ${meta.color}`} />
                        </TooltipTrigger>
                        <TooltipContent>{meta.label}{source?.roleName ? ` (${source.roleName})` : ""}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </td>
              );
            })}
            {canWrite && (
              <td className="p-1.5 text-center whitespace-nowrap">
                <div className="flex items-center justify-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRow(module, [...MODULE_ACTIONS])} data-testid={`button-all-${module}`}>
                        <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>منح الكل</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRow(module, ["view", "view_list", "view_details"])} data-testid={`button-view-${module}`}>
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>عرض فقط</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRow(module, [])} data-testid={`button-clear-${module}`}>
                        <XSquare className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>مسح الصف</TooltipContent>
                  </Tooltip>
                </div>
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
