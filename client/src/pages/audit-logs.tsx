import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { TablePagination } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search, Loader2, FileText, RefreshCw, Filter, History, Users, Activity, TrendingUp,
  Clock, Plus, Edit, Trash2, Eye, LogIn, LogOut, Wifi, Monitor, Smartphone, Tablet, Globe,
  ShieldAlert, BarChart3, Calendar, MapPin, Network, Info, X, AlertTriangle,
} from "lucide-react";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { SecurityHero, SECURITY_TABS_LIST, SECURITY_TAB_TRIGGER } from "@/components/security/security-hero";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { SystemAuditLog, User } from "@shared/schema";
import { ExportButtons } from "@/components/export-buttons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  AreaChart, Area, Legend, PieChart, Pie, Cell,
} from "recharts";

const PAGE_SIZE = 25;

const exportColumns = [
  { header: "التاريخ", key: "createdAt", width: 18 },
  { header: "الوحدة", key: "module", width: 15 },
  { header: "الإجراء", key: "action", width: 12 },
  { header: "العنصر", key: "entityName", width: 20 },
  { header: "المستخدم", key: "userName", width: 15 },
  { header: "IP", key: "ipAddress", width: 14 },
  { header: "التفاصيل", key: "details", width: 35 },
];

const userStatsExportColumns = [
  { header: "المستخدم", key: "userName", width: 20 },
  { header: "إجمالي العمليات", key: "totalActions", width: 15 },
  { header: "إنشاء", key: "creates", width: 10 },
  { header: "تعديل", key: "updates", width: 10 },
  { header: "حذف", key: "deletes", width: 10 },
  { header: "عرض", key: "views", width: 10 },
  { header: "دخول", key: "logins", width: 10 },
  { header: "أكثر قسم", key: "topModule", width: 15 },
  { header: "آخر نشاط", key: "lastActivity", width: 18 },
];

// قائمة الأقسام للفلترة
const MODULES = [
  { value: "all", label: "جميع الأقسام" },
  { value: "inventory", label: "المخزون" },
  { value: "projects", label: "المشاريع" },
  { value: "contractors", label: "المقاولين" },
  { value: "transfers", label: "التحويلات" },
  { value: "users", label: "المستخدمين" },
  { value: "roles", label: "الأدوار" },
  { value: "permissions", label: "الصلاحيات" },
  { value: "rbac_management", label: "إدارة الصلاحيات" },
  { value: "contracts", label: "العقود" },
  { value: "cashier", label: "الكاشير" },
  { value: "cashier_journal", label: "يومية الكاشير" },
  { value: "production", label: "الإنتاج" },
  { value: "warehouse", label: "المخازن" },
  { value: "salary_closing", label: "إغلاق الرواتب" },
  { value: "salary", label: "الرواتب" },
  { value: "payment_requests", label: "طلبات الدفع" },
  { value: "backups", label: "النسخ الاحتياطي" },
  { value: "assets", label: "الأصول" },
];

// خريطة أسماء الأقسام للعرض (أوسع من قائمة الفلترة)
const MODULE_LABELS: Record<string, string> = MODULES.reduce((acc, m) => {
  acc[m.value] = m.label;
  return acc;
}, {} as Record<string, string>);

const ACTIONS = [
  { value: "create", label: "إنشاء", color: "bg-green-500" },
  { value: "update", label: "تعديل", color: "bg-blue-500" },
  { value: "delete", label: "حذف", color: "bg-red-500" },
  { value: "view", label: "عرض", color: "bg-gray-500" },
  { value: "export", label: "تصدير", color: "bg-purple-500" },
  { value: "transfer", label: "تحويل", color: "bg-orange-500" },
  { value: "approve", label: "موافقة", color: "bg-emerald-500" },
  { value: "reject", label: "رفض", color: "bg-rose-500" },
  { value: "close", label: "إغلاق", color: "bg-amber-600" },
  { value: "reopen", label: "إعادة فتح", color: "bg-yellow-500" },
  { value: "apply_ld", label: "غرامة تأخير", color: "bg-red-600" },
  { value: "mark_paid", label: "تعليم مدفوع", color: "bg-teal-500" },
  { value: "login", label: "تسجيل دخول", color: "bg-cyan-500" },
  { value: "logout", label: "تسجيل خروج", color: "bg-slate-500" },
];

const ACTION_FILTER_OPTIONS = [{ value: "all", label: "جميع العمليات" }, ...ACTIONS];

// العمليات/الأقسام الحساسة (للتمييز البصري — متوافقة مع الخادم)
const SENSITIVE_MODULES = new Set([
  "users", "roles", "permissions", "rbac_management",
  "salary_closing", "salary", "backups", "payment_requests", "contracts",
]);
const SENSITIVE_ACTIONS = new Set([
  "delete", "reject", "reopen", "apply_ld", "close",
  "permission_change", "role_change", "login",
]);
const isSensitiveLog = (log: SystemAuditLog) =>
  SENSITIVE_ACTIONS.has(log.action) || SENSITIVE_MODULES.has(log.module);

const DATE_PRESETS = [
  { value: "all", label: "كل الفترات" },
  { value: "today", label: "اليوم" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يوماً" },
  { value: "month", label: "هذا الشهر" },
  { value: "custom", label: "فترة مخصصة" },
];

const CHART_COLORS = ["#7c3aed", "#10b981", "#6366f1", "#f43f5e", "#d946ef", "#f59e0b", "#06b6d4", "#84cc16", "#ec4899", "#0ea5e9"];

interface UserStats {
  userId: string;
  userName: string;
  totalActions: number;
  creates: number;
  updates: number;
  deletes: number;
  views: number;
  logins: number;
  lastActivity: string | null;
  topModule: string | null;
}

interface OnlineUser {
  sessionId: string;
  userId: string;
  userName: string;
  deviceInfo: { browser: string; os: string; device: string } | null;
  ipAddress: string | null;
  lastActivityAt: string;
  createdAt: string;
}

interface Branch { id: string; name: string }

interface AuditAnalytics {
  byDay: { day: string; count: number }[];
  byModule: { module: string; count: number }[];
  byAction: { action: string; count: number }[];
  topUsers: { userId: string | null; userName: string | null; count: number }[];
  total: number;
}

export default function AuditLogsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [securityPage, setSecurityPage] = useState(1);
  const [activeTab, setActiveTab] = useState("logs");
  const [selectedLog, setSelectedLog] = useState<SystemAuditLog | null>(null);

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // حساب نطاق التاريخ من الاختصار المختار
  const dateRange = useMemo(() => {
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const toISO = (d: Date | null) => (d ? d.toISOString() : "");
    const DAY = 86400000;
    switch (datePreset) {
      case "today": return { from: toISO(startOfDay(now)), to: "" };
      case "7d": return { from: toISO(startOfDay(new Date(now.getTime() - 6 * DAY))), to: "" };
      case "30d": return { from: toISO(startOfDay(new Date(now.getTime() - 29 * DAY))), to: "" };
      case "month": return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: "" };
      case "custom": return {
        from: customFrom ? new Date(customFrom).toISOString() : "",
        to: customTo ? new Date(new Date(customTo).getTime() + DAY - 1).toISOString() : "",
      };
      default: return { from: "", to: "" };
    }
  }, [datePreset, customFrom, customTo]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedModule !== "all") p.set("module", selectedModule);
    if (selectedAction !== "all") p.set("action", selectedAction);
    if (selectedUser !== "all") p.set("userId", selectedUser);
    if (selectedBranch !== "all") p.set("branchId", selectedBranch);
    if (searchQuery) p.set("q", searchQuery);
    if (dateRange.from) p.set("dateFrom", dateRange.from);
    if (dateRange.to) p.set("dateTo", dateRange.to);
    return p.toString();
  }, [selectedModule, selectedAction, selectedUser, selectedBranch, searchQuery, dateRange]);

  // Reset pagination when filters change
  useEffect(() => { setCurrentPage(1); setSecurityPage(1); }, [baseParams]);

  // Fetch reference data
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  const { data: userStats = [], isLoading: statsLoading, refetch: refetchStats } = useQuery<UserStats[]>({
    queryKey: ["/api/system-audit-logs/user-stats"],
  });

  const { data: onlineUsers = [], isLoading: onlineLoading, refetch: refetchOnline } = useQuery<OnlineUser[]>({
    queryKey: ["/api/online-users"],
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 60000),
  });

  // Main paginated logs query (server-side)
  const logsQs = `${baseParams}&page=${currentPage}&pageSize=${PAGE_SIZE}`;
  const { data: logsData, isLoading, refetch } = useQuery<{ rows: SystemAuditLog[]; total: number }>({
    queryKey: ["/api/system-audit-logs/query", logsQs],
    queryFn: async () => {
      const res = await fetch(`/api/system-audit-logs/query?${logsQs}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });
  const logs = logsData?.rows ?? [];
  const totalLogs = logsData?.total ?? 0;

  // Security alerts query (sensitive only)
  const securityQs = `${baseParams}&sensitiveOnly=1&page=${securityPage}&pageSize=${PAGE_SIZE}`;
  const { data: securityData, isLoading: securityLoading } = useQuery<{ rows: SystemAuditLog[]; total: number }>({
    queryKey: ["/api/system-audit-logs/query", "security", securityQs],
    queryFn: async () => {
      const res = await fetch(`/api/system-audit-logs/query?${securityQs}`);
      if (!res.ok) throw new Error("Failed to fetch security alerts");
      return res.json();
    },
    enabled: activeTab === "security",
  });
  const securityLogs = securityData?.rows ?? [];
  const totalSecurity = securityData?.total ?? 0;

  // Analytics query
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AuditAnalytics>({
    queryKey: ["/api/system-audit-logs/analytics", baseParams],
    queryFn: async () => {
      const res = await fetch(`/api/system-audit-logs/analytics?${baseParams}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: activeTab === "analytics",
  });

  const handleRefresh = () => { refetch(); refetchStats(); refetchOnline(); };

  const resetFilters = () => {
    setSearchInput(""); setSearchQuery("");
    setSelectedModule("all"); setSelectedUser("all"); setSelectedBranch("all");
    setSelectedAction("all"); setDatePreset("all"); setCustomFrom(""); setCustomTo("");
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case "Mobile": return <Smartphone className="w-4 h-4" />;
      case "Tablet": return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    const actionInfo = ACTIONS.find(a => a.value === action);
    return (
      <Badge className={`${actionInfo?.color || 'bg-gray-500'} text-white text-[10px] sm:text-xs`}>
        {actionInfo?.label || action}
      </Badge>
    );
  };

  const getModuleLabel = (module: string) => MODULE_LABELS[module] || module;
  const getBranchName = (id: string | null) => (id ? (branches.find(b => b.id === id)?.name || id) : "—");

  const formatDate = (date: string | Date) => {
    try { return format(new Date(date), "PPpp", { locale: ar }); } catch { return String(date); }
  };
  const formatShortDate = (date: string | Date | null) => {
    if (!date) return "-";
    try { return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ar }); } catch { return String(date); }
  };

  // إجمالي عام (كل الأوقات) من تقرير المستخدمين
  const summaryStats = useMemo(() => {
    const total = userStats.reduce((sum, u) => sum + u.totalActions, 0);
    const creates = userStats.reduce((sum, u) => sum + u.creates, 0);
    const updates = userStats.reduce((sum, u) => sum + u.updates, 0);
    const deletes = userStats.reduce((sum, u) => sum + u.deletes, 0);
    const activeUsers = userStats.filter(u => u.totalActions > 0).length;
    return { total, creates, updates, deletes, activeUsers };
  }, [userStats]);

  function AuditStatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "violet" | "emerald" | "indigo" | "rose" | "fuchsia" }) {
    const tones = {
      violet: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-100", icon: "bg-violet-100 text-violet-700" },
      emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100", icon: "bg-emerald-100 text-emerald-700" },
      indigo: { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-100", icon: "bg-indigo-100 text-indigo-700" },
      rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-100", icon: "bg-rose-100 text-rose-700" },
      fuchsia: { bg: "bg-fuchsia-50", text: "text-fuchsia-700", ring: "ring-fuchsia-100", icon: "bg-fuchsia-100 text-fuchsia-700" },
    } as const;
    const t = tones[tone];
    return (
      <Card className={`border ${t.ring.replace("ring-", "border-")} ${t.bg} shadow-sm hover:shadow-md transition group`} data-testid={`stat-card-${tone}`}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className={`${t.icon} p-2 rounded-xl ring-1 ${t.ring} group-hover:scale-110 transition shadow-sm`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">{label}</p>
            <p className={`text-lg font-bold ${t.text} tabular-nums`}>{value.toLocaleString('en')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ===== لوحة الفلاتر المشتركة =====
  function FiltersPanel() {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-0">
          <CardTitle className="flex items-center justify-between gap-2 text-base sm:text-lg">
            <span className="flex items-center gap-2"><Filter className="w-4 h-4 sm:w-5 sm:h-5" /> البحث والتصفية</span>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-muted-foreground" data-testid="button-reset-filters">
              <X className="w-3.5 h-3.5 ml-1" /> مسح الفلاتر
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في العنصر/المستخدم/IP/التفاصيل..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pr-10 h-10"
                data-testid="input-search-logs"
              />
            </div>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-10" data-testid="select-user-filter"><SelectValue placeholder="المستخدم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المستخدمين</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="h-10" data-testid="select-branch-filter"><SelectValue placeholder="الفرع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="h-10" data-testid="select-module-filter"><SelectValue placeholder="القسم" /></SelectTrigger>
              <SelectContent>
                {MODULES.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="h-10" data-testid="select-action-filter"><SelectValue placeholder="نوع العملية" /></SelectTrigger>
              <SelectContent>
                {ACTION_FILTER_OPTIONS.map(a => (<SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="h-10" data-testid="select-date-preset">
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /><SelectValue placeholder="الفترة" /></span>
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map(d => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {datePreset === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">من تاريخ</label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-10" data-testid="input-date-from" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">إلى تاريخ</label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-10" data-testid="input-date-to" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ===== جدول السجلات (قابل لإعادة الاستخدام: عادي / أمني) =====
  function LogsTable({ rows, total, page, onPage, loading, highlightSensitive }: {
    rows: SystemAuditLog[]; total: number; page: number; onPage: (p: number) => void; loading: boolean; highlightSensitive?: boolean;
  }) {
    if (loading) {
      return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }
    if (rows.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>لا توجد سجلات للعرض</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right hidden sm:table-cell">القسم</TableHead>
              <TableHead className="text-right">العملية</TableHead>
              <TableHead className="text-right">العنصر</TableHead>
              <TableHead className="text-right hidden md:table-cell">المستخدم</TableHead>
              <TableHead className="text-right hidden lg:table-cell">الفرع</TableHead>
              <TableHead className="text-right hidden xl:table-cell">IP</TableHead>
              <TableHead className="text-center">تفاصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((log) => {
              const sensitive = highlightSensitive && isSensitiveLog(log);
              return (
                <TableRow
                  key={log.id}
                  className={`cursor-pointer hover:bg-muted/50 ${sensitive ? "bg-rose-50/60" : ""}`}
                  onClick={() => setSelectedLog(log)}
                  data-testid={`row-audit-log-${log.id}`}
                >
                  <TableCell className="text-[10px] sm:text-xs whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-[10px] sm:text-xs">{getModuleLabel(log.module)}</Badge></TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      {sensitive && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                      {getActionBadge(log.action)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-xs sm:text-sm max-w-[180px] truncate">{log.entityName || log.entityId}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs sm:text-sm">{log.userName || "غير محدد"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{getBranchName(log.branchId)}</TableCell>
                  <TableCell className="hidden xl:table-cell font-mono text-[10px] text-muted-foreground">{log.ipAddress || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }} data-testid={`button-view-log-${log.id}`}>
                      <Info className="w-4 h-4 text-violet-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination currentPage={page} totalItems={total} itemsPerPage={PAGE_SIZE} onPageChange={onPage} />
      </div>
    );
  }

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <SettingsBreadcrumb currentPage="سجل التدقيق" currentIcon={History} />

        <SecurityHero
          icon={History}
          title="سجل التدقيق"
          description="تتبّع جميع العمليات والتغييرات والأنشطة في النظام"
          actions={
            <Button onClick={handleRefresh} className="bg-white text-violet-700 hover:bg-violet-50 shadow-md font-semibold" data-testid="button-refresh-logs">
              <RefreshCw className="w-4 h-4 ml-2" /> تحديث
            </Button>
          }
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {AuditStatCard({ icon: <Activity className="w-5 h-5" />, label: "إجمالي العمليات", value: summaryStats.total, tone: "violet" })}
          {AuditStatCard({ icon: <Plus className="w-5 h-5" />, label: "إنشاء", value: summaryStats.creates, tone: "emerald" })}
          {AuditStatCard({ icon: <Edit className="w-5 h-5" />, label: "تعديل", value: summaryStats.updates, tone: "indigo" })}
          {AuditStatCard({ icon: <Trash2 className="w-5 h-5" />, label: "حذف", value: summaryStats.deletes, tone: "rose" })}
          {AuditStatCard({ icon: <Users className="w-5 h-5" />, label: "مستخدمين نشطين", value: summaryStats.activeUsers, tone: "fuchsia" })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full grid-cols-3 lg:grid-cols-5 ${SECURITY_TABS_LIST}`}>
            <TabsTrigger value="logs" className={`flex items-center gap-2 ${SECURITY_TAB_TRIGGER}`} data-testid="tab-logs">
              <FileText className="w-4 h-4" /> سجل العمليات
            </TabsTrigger>
            <TabsTrigger value="analytics" className={`flex items-center gap-2 ${SECURITY_TAB_TRIGGER}`} data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4" /> التحليلات
            </TabsTrigger>
            <TabsTrigger value="security" className={`flex items-center gap-2 ${SECURITY_TAB_TRIGGER}`} data-testid="tab-security">
              <ShieldAlert className="w-4 h-4" /> تنبيهات أمنية
            </TabsTrigger>
            <TabsTrigger value="users" className={`flex items-center gap-2 ${SECURITY_TAB_TRIGGER}`} data-testid="tab-users">
              <Users className="w-4 h-4" /> تقرير المستخدمين
            </TabsTrigger>
            <TabsTrigger value="online" className={`flex items-center gap-2 ${SECURITY_TAB_TRIGGER}`} data-testid="tab-online">
              <Wifi className="w-4 h-4" /> المتصلين الآن
              {onlineUsers.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-700 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {onlineUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ===== Logs Tab ===== */}
          <TabsContent value="logs" className="space-y-4 mt-4">
            {FiltersPanel()}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" /> سجل العمليات
                  <Badge variant="secondary" className="mr-2 text-xs">{totalLogs.toLocaleString('en')} سجل</Badge>
                </CardTitle>
                <ExportButtons
                  data={logs.map(l => ({ ...l, module: getModuleLabel(l.module) }))}
                  columns={exportColumns}
                  fileName="سجل_التدقيق"
                  title="سجل التدقيق"
                  subtitle="جميع العمليات والتغييرات في النظام"
                  sheetName="سجل التدقيق"
                />
              </CardHeader>
              <CardContent>
                {LogsTable({ rows: logs, total: totalLogs, page: currentPage, onPage: setCurrentPage, loading: isLoading, highlightSensitive: true })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Analytics Tab ===== */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            {FiltersPanel()}
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : !analytics || analytics.total === 0 ? (
              <Card><CardContent className="text-center py-16 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>لا توجد بيانات للفترة المحددة</p>
              </CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="p-3 sm:p-4 md:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><TrendingUp className="w-5 h-5 text-violet-600" /> النشاط عبر الوقت</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={analytics.byDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} reversed />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <ReTooltip />
                        <Area type="monotone" dataKey="count" name="عدد العمليات" stroke="#7c3aed" strokeWidth={2} fill="url(#colorAct)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="p-3 sm:p-4 md:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><BarChart3 className="w-5 h-5 text-indigo-600" /> النشاط حسب القسم</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics.byModule.map(m => ({ ...m, label: getModuleLabel(m.module) }))} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
                          <ReTooltip />
                          <Bar dataKey="count" name="العمليات" radius={[0, 6, 6, 0]}>
                            {analytics.byModule.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-3 sm:p-4 md:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Activity className="w-5 h-5 text-rose-600" /> النشاط حسب نوع العملية</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analytics.byAction.map(a => ({ name: ACTIONS.find(x => x.value === a.action)?.label || a.action, value: a.count }))}
                            dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                            label={(e: any) => `${e.name}: ${e.value}`} labelLine={false}
                          >
                            {analytics.byAction.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                          </Pie>
                          <ReTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="p-3 sm:p-4 md:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Users className="w-5 h-5 text-fuchsia-600" /> أنشط المستخدمين</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(220, analytics.topUsers.length * 40)}>
                      <BarChart data={analytics.topUsers.map(u => ({ name: u.userName || "غير معروف", count: u.count }))} layout="vertical" margin={{ left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                        <ReTooltip />
                        <Bar dataKey="count" name="العمليات" fill="#d946ef" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ===== Security Tab ===== */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-center gap-2 text-sm text-rose-700">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>تعرض هذه الصفحة العمليات الحساسة فقط: الحذف، تغيير الصلاحيات والأدوار، إغلاق/إعادة فتح الرواتب، طلبات الدفع، النسخ الاحتياطي، وتسجيلات الدخول.</span>
            </div>
            {FiltersPanel()}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ShieldAlert className="w-5 h-5 text-rose-600" /> العمليات الحساسة
                  <Badge variant="secondary" className="mr-2 text-xs bg-rose-100 text-rose-700">{totalSecurity.toLocaleString('en')} عملية</Badge>
                </CardTitle>
                <ExportButtons
                  data={securityLogs.map(l => ({ ...l, module: getModuleLabel(l.module) }))}
                  columns={exportColumns}
                  fileName="تنبيهات_أمنية"
                  title="التنبيهات الأمنية"
                  subtitle="العمليات الحساسة في النظام"
                  sheetName="تنبيهات أمنية"
                />
              </CardHeader>
              <CardContent>
                {LogsTable({ rows: securityLogs, total: totalSecurity, page: securityPage, onPage: setSecurityPage, loading: securityLoading, highlightSensitive: true })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Users Tab ===== */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> تقرير أنشطة المستخدمين
                  <Badge variant="secondary" className="mr-2 text-xs">{userStats.length} مستخدم</Badge>
                </CardTitle>
                <ExportButtons
                  data={userStats.map(s => ({ ...s, lastActivity: formatShortDate(s.lastActivity), topModule: getModuleLabel(s.topModule || '') }))}
                  columns={userStatsExportColumns}
                  fileName="تقرير_أنشطة_المستخدمين"
                  title="تقرير أنشطة المستخدمين"
                  subtitle="إحصائيات العمليات لكل مستخدم"
                  sheetName="أنشطة المستخدمين"
                />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : userStats.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>لا توجد بيانات للعرض</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-center">إجمالي</TableHead>
                          <TableHead className="text-center"><span className="flex items-center justify-center gap-1"><Plus className="w-3 h-3 text-green-500" /> إنشاء</span></TableHead>
                          <TableHead className="text-center"><span className="flex items-center justify-center gap-1"><Edit className="w-3 h-3 text-blue-500" /> تعديل</span></TableHead>
                          <TableHead className="text-center"><span className="flex items-center justify-center gap-1"><Trash2 className="w-3 h-3 text-red-500" /> حذف</span></TableHead>
                          <TableHead className="text-center"><span className="flex items-center justify-center gap-1"><Eye className="w-3 h-3 text-gray-500" /> عرض</span></TableHead>
                          <TableHead className="text-center"><span className="flex items-center justify-center gap-1"><LogIn className="w-3 h-3 text-cyan-500" /> دخول</span></TableHead>
                          <TableHead className="text-right hidden md:table-cell">أكثر قسم</TableHead>
                          <TableHead className="text-right hidden lg:table-cell"><span className="flex items-center gap-1"><Clock className="w-3 h-3" /> آخر نشاط</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userStats.map((stat, index) => (
                          <TableRow key={stat.userId} className="cursor-pointer hover:bg-muted/50"
                            onClick={() => { setSelectedUser(stat.userId); setActiveTab("logs"); }}
                            data-testid={`row-user-stats-${stat.userId}`}>
                            <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-medium">{stat.userName}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary" className="font-bold">{stat.totalActions.toLocaleString('en')}</Badge></TableCell>
                            <TableCell className="text-center"><span className="text-green-600 font-medium">{stat.creates.toLocaleString('en')}</span></TableCell>
                            <TableCell className="text-center"><span className="text-blue-600 font-medium">{stat.updates.toLocaleString('en')}</span></TableCell>
                            <TableCell className="text-center"><span className="text-red-600 font-medium">{stat.deletes.toLocaleString('en')}</span></TableCell>
                            <TableCell className="text-center"><span className="text-gray-600 font-medium">{stat.views.toLocaleString('en')}</span></TableCell>
                            <TableCell className="text-center"><span className="text-cyan-600 font-medium">{stat.logins.toLocaleString('en')}</span></TableCell>
                            <TableCell className="hidden md:table-cell">{stat.topModule && (<Badge variant="outline" className="text-xs">{getModuleLabel(stat.topModule)}</Badge>)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{formatShortDate(stat.lastActivity)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Online Tab ===== */}
          <TabsContent value="online" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /> المستخدمون المتصلون حالياً
                  <Badge variant="secondary" className="mr-2 text-xs bg-green-100 text-green-700">{onlineUsers.length} متصل</Badge>
                </CardTitle>
                <Button onClick={() => refetchOnline()} variant="outline" size="sm"><RefreshCw className="w-4 h-4 ml-2" /> تحديث</Button>
              </CardHeader>
              <CardContent>
                {onlineLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : onlineUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground"><Wifi className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>لا يوجد مستخدمون متصلون حالياً</p></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {onlineUsers.map((user) => (
                      <Card key={user.sessionId} className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-md transition-shadow" data-testid={`card-online-user-${user.userId}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">{user.userName?.charAt(0) || "?"}</div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                              </div>
                              <div><p className="font-semibold text-green-800">{user.userName}</p><p className="text-xs text-green-600">متصل الآن</p></div>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            {user.deviceInfo && (<div className="flex items-center gap-2 text-green-700">{getDeviceIcon(user.deviceInfo.device)}<span>{user.deviceInfo.device} - {user.deviceInfo.browser}</span></div>)}
                            {user.deviceInfo && (<div className="flex items-center gap-2 text-green-600"><Globe className="w-4 h-4" /><span>{user.deviceInfo.os}</span></div>)}
                            {user.ipAddress && (<div className="flex items-center gap-2 text-green-600"><Activity className="w-4 h-4" /><span className="font-mono text-xs">{user.ipAddress}</span></div>)}
                            <div className="flex items-center gap-2 text-green-600"><Clock className="w-4 h-4" /><span className="text-xs">آخر نشاط: {formatShortDate(user.lastActivityAt)}</span></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {LogDetailDialog({ log: selectedLog, onClose: () => setSelectedLog(null) })}
    </Layout>
  );

  // ===== نافذة تفاصيل العملية =====
  function LogDetailDialog({ log, onClose }: { log: SystemAuditLog | null; onClose: () => void }) {
    let parsedDetails: any = null;
    if (log?.details) { try { parsedDetails = JSON.parse(log.details); } catch { parsedDetails = null; } }
    const beforeAfter = parsedDetails && typeof parsedDetails === "object"
      ? (parsedDetails.before || parsedDetails.after || parsedDetails.old || parsedDetails.new)
      : null;
    const before = parsedDetails?.before ?? parsedDetails?.old;
    const after = parsedDetails?.after ?? parsedDetails?.new;
    const device = parsedDetails && (parsedDetails.browser || parsedDetails.os || parsedDetails.device)
      ? { browser: parsedDetails.browser, os: parsedDetails.os, device: parsedDetails.device } : null;

    const Row = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
      <div className="flex justify-between gap-3 py-2 border-b border-dashed border-slate-100 last:border-0">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <span className={`text-sm font-medium text-left break-all ${mono ? "font-mono text-xs" : ""}`}>{value ?? "—"}</span>
      </div>
    );

    return (
      <Dialog open={!!log} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-violet-600" /> تفاصيل العملية
              {log && isSensitiveLog(log) && (<Badge className="bg-rose-500 text-white text-[10px]">حساسة</Badge>)}
            </DialogTitle>
          </DialogHeader>
          {log && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <Row label="التاريخ والوقت" value={formatDate(log.createdAt)} />
                <Row label="القسم" value={getModuleLabel(log.module)} />
                <Row label="نوع العملية" value={getActionBadge(log.action)} />
                <Row label="المستخدم" value={log.userName || "غير محدد"} />
                <Row label="الفرع" value={getBranchName(log.branchId)} />
                <Row label="العنصر" value={log.entityName || log.entityId} />
                <Row label="معرّف العنصر" value={log.entityId} mono />
                {log.targetId && <Row label="المستهدف" value={log.targetId} mono />}
                <Row label="عنوان IP" value={log.ipAddress} mono />
              </div>

              {log.description && (
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                  <p className="text-xs text-violet-500 mb-1">الوصف</p>
                  <p className="text-sm text-violet-900">{log.description}</p>
                </div>
              )}

              {device && (
                <div className="rounded-lg bg-slate-50 border p-3">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Monitor className="w-3.5 h-3.5" /> الجهاز</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {device.device && <Badge variant="outline">{device.device}</Badge>}
                    {device.browser && <Badge variant="outline">{device.browser}</Badge>}
                    {device.os && <Badge variant="outline">{device.os}</Badge>}
                  </div>
                </div>
              )}

              {(before !== undefined || after !== undefined) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {before !== undefined && (
                    <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
                      <p className="text-xs text-rose-500 mb-2">قبل التغيير</p>
                      <pre className="text-[11px] whitespace-pre-wrap break-all text-rose-900">{JSON.stringify(before, null, 2)}</pre>
                    </div>
                  )}
                  {after !== undefined && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                      <p className="text-xs text-emerald-500 mb-2">بعد التغيير</p>
                      <pre className="text-[11px] whitespace-pre-wrap break-all text-emerald-900">{JSON.stringify(after, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}

              {parsedDetails && !beforeAfter && !device && (
                <div className="rounded-lg bg-slate-50 border p-3">
                  <p className="text-xs text-muted-foreground mb-2">التفاصيل الكاملة</p>
                  <pre className="text-[11px] whitespace-pre-wrap break-all text-slate-700">{JSON.stringify(parsedDetails, null, 2)}</pre>
                </div>
              )}

              {!parsedDetails && log.details && (
                <div className="rounded-lg bg-slate-50 border p-3">
                  <p className="text-xs text-muted-foreground mb-2">التفاصيل</p>
                  <p className="text-sm text-slate-700 break-all">{log.details}</p>
                </div>
              )}

              {log.userAgent && (
                <div className="text-[10px] text-muted-foreground font-mono break-all border-t pt-2">
                  <Network className="w-3 h-3 inline ml-1" />{log.userAgent}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
}
